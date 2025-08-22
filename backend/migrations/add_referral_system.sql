-- ✨ МИГРАЦИЯ: Система реферальных приглашений v1.0.0
-- Дата: 2025-01-25
-- Автор: 1337 Community Development Team
-- Цель: Добавить систему приглашения друзей для геймификации

-- 👥 Добавляем поле для отслеживания приглашений
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP;

-- 📊 Создаем таблицу для отслеживания реферальных ссылок
CREATE TABLE IF NOT EXISTS referral_links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    referral_code VARCHAR(50) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    uses_count INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT 32,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 🏆 Создаем таблицу для отслеживания успешных приглашений
CREATE TABLE IF NOT EXISTS referral_registrations (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    referral_link_id INTEGER NOT NULL REFERENCES referral_links(id) ON DELETE CASCADE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    participated_in_tournament BOOLEAN DEFAULT FALSE,
    UNIQUE(referred_user_id, tournament_id) -- Один пользователь может быть приглашен в турнир только один раз
);

-- 📈 Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON users(invited_by);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_links_user_id ON referral_links(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_tournament_id ON referral_links(tournament_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_referral_code ON referral_links(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_links_expires_at ON referral_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_referral_registrations_referrer_id ON referral_registrations(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_registrations_referred_user_id ON referral_registrations(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_registrations_tournament_id ON referral_registrations(tournament_id);

-- 🔧 Функция для автоматической генерации уникального реферального кода
CREATE OR REPLACE FUNCTION generate_referral_code() RETURNS VARCHAR(20) AS $$
DECLARE
    code VARCHAR(20);
    exists_check INTEGER;
BEGIN
    LOOP
        -- Генерируем код из 8 символов (буквы и цифры)
        code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        
        -- Проверяем уникальность
        SELECT COUNT(*) INTO exists_check FROM users WHERE referral_code = code;
        SELECT COUNT(*) INTO exists_check FROM referral_links WHERE referral_code = code;
        
        EXIT WHEN exists_check = 0;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- 🎯 Триггер для автоматической генерации реферального кода пользователя при регистрации
CREATE OR REPLACE FUNCTION auto_generate_user_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Генерируем реферальный код только если его нет
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер если его еще нет
DROP TRIGGER IF EXISTS trigger_auto_generate_user_referral_code ON users;
CREATE TRIGGER trigger_auto_generate_user_referral_code
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_user_referral_code();

-- 🔄 Обновляем существующих пользователей (добавляем реферальные коды)
UPDATE users 
SET referral_code = generate_referral_code() 
WHERE referral_code IS NULL;

-- 📊 Функция для получения статистики приглашений пользователя
CREATE OR REPLACE FUNCTION get_user_referral_stats(user_id_param INTEGER)
RETURNS TABLE(
    total_invitations INTEGER,
    successful_registrations INTEGER,
    tournament_participants INTEGER,
    active_links INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE((SELECT COUNT(*) FROM referral_links WHERE user_id = user_id_param), 0)::INTEGER as total_invitations,
        COALESCE((SELECT COUNT(*) FROM referral_registrations WHERE referrer_id = user_id_param), 0)::INTEGER as successful_registrations,
        COALESCE((SELECT COUNT(*) FROM referral_registrations WHERE referrer_id = user_id_param AND participated_in_tournament = TRUE), 0)::INTEGER as tournament_participants,
        COALESCE((SELECT COUNT(*) FROM referral_links WHERE user_id = user_id_param AND expires_at > NOW()), 0)::INTEGER as active_links;
END;
$$ LANGUAGE plpgsql;

-- 🧹 Функция для очистки устаревших реферальных ссылок
CREATE OR REPLACE FUNCTION cleanup_expired_referral_links()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM referral_links WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 📝 Добавляем комментарии для документации
COMMENT ON COLUMN users.invited_by IS 'ID пользователя, который пригласил данного пользователя';
COMMENT ON COLUMN users.referral_code IS 'Уникальный реферальный код пользователя';
COMMENT ON COLUMN users.invited_at IS 'Дата и время приглашения пользователя';

COMMENT ON TABLE referral_links IS 'Реферальные ссылки для приглашения в турниры';
COMMENT ON COLUMN referral_links.referral_code IS 'Уникальный код реферальной ссылки';
COMMENT ON COLUMN referral_links.expires_at IS 'Дата истечения ссылки';
COMMENT ON COLUMN referral_links.uses_count IS 'Количество использований ссылки';
COMMENT ON COLUMN referral_links.max_uses IS 'Максимальное количество использований';

COMMENT ON TABLE referral_registrations IS 'Успешные регистрации по реферальным ссылкам';
COMMENT ON COLUMN referral_registrations.participated_in_tournament IS 'Принял ли участие в турнире';

-- ✅ Завершение миграции
DO $$
BEGIN
    RAISE NOTICE '✅ Система реферальных приглашений v1.0.0 установлена успешно!';
    RAISE NOTICE '📊 Функции: generate_referral_code(), get_user_referral_stats(), cleanup_expired_referral_links()';
    RAISE NOTICE '🎯 Триггер: auto_generate_user_referral_code для автоматической генерации кодов';
END
$$; 