-- ================================================
-- МИГРАЦИЯ: Система приглашений в турниры и запросы на вступление в команды
-- Дата: 2025-10-30
-- Описание: Добавляет функциональность инвайт-ссылок для закрытых турниров
--           и систему запросов на вступление в существующие команды турнира
-- ================================================

-- ========================================
-- 1. Таблица инвайт-ссылок турниров
-- ========================================
CREATE TABLE IF NOT EXISTS tournament_invites (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(32) UNIQUE NOT NULL, -- Уникальный код приглашения (UUID или короткий хэш)
    max_uses INTEGER DEFAULT NULL, -- Максимальное количество использований (NULL = неограниченно)
    current_uses INTEGER DEFAULT 0, -- Текущее количество использований
    expires_at TIMESTAMP DEFAULT NULL, -- Дата истечения приглашения (NULL = бессрочно)
    is_active BOOLEAN DEFAULT TRUE, -- Активность приглашения
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_tournament_invites_code ON tournament_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_tournament_invites_tournament ON tournament_invites(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_invites_active ON tournament_invites(is_active, expires_at);

-- ========================================
-- 2. Таблица использований инвайт-ссылок
-- ========================================
CREATE TABLE IF NOT EXISTS tournament_invite_uses (
    id SERIAL PRIMARY KEY,
    invite_id INTEGER NOT NULL REFERENCES tournament_invites(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    used_at TIMESTAMP DEFAULT NOW(),
    ip_address VARCHAR(45), -- IP адрес для отслеживания злоупотреблений
    UNIQUE(invite_id, user_id) -- Один пользователь не может использовать одну ссылку дважды
);

CREATE INDEX IF NOT EXISTS idx_invite_uses_invite ON tournament_invite_uses(invite_id);
CREATE INDEX IF NOT EXISTS idx_invite_uses_user ON tournament_invite_uses(user_id);

-- ========================================
-- 3. Таблица запросов на вступление в команды
-- ========================================
CREATE TABLE IF NOT EXISTS team_join_requests (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
    message TEXT, -- Сообщение от пользователя (опционально)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    reviewed_by INTEGER REFERENCES users(id), -- Кто рассмотрел запрос
    reviewed_at TIMESTAMP,
    UNIQUE(team_id, user_id, tournament_id) -- Один пользователь может подать только одну заявку в команду
);

CREATE INDEX IF NOT EXISTS idx_team_join_requests_team ON team_join_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_user ON team_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_status ON team_join_requests(status);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_tournament ON team_join_requests(tournament_id);

-- ========================================
-- 4. Функция для автоматического обновления updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_tournament_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для обновления updated_at
DROP TRIGGER IF EXISTS trigger_tournament_invites_updated_at ON tournament_invites;
CREATE TRIGGER trigger_tournament_invites_updated_at
    BEFORE UPDATE ON tournament_invites
    FOR EACH ROW
    EXECUTE FUNCTION update_tournament_invites_updated_at();

DROP TRIGGER IF EXISTS trigger_team_join_requests_updated_at ON team_join_requests;
CREATE TRIGGER trigger_team_join_requests_updated_at
    BEFORE UPDATE ON team_join_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_tournament_invites_updated_at();

-- ========================================
-- 5. Комментарии к таблицам
-- ========================================
COMMENT ON TABLE tournament_invites IS 'Инвайт-ссылки для приглашения в закрытые турниры';
COMMENT ON TABLE tournament_invite_uses IS 'История использования инвайт-ссылок';
COMMENT ON TABLE team_join_requests IS 'Запросы на вступление в существующие команды турнира';

COMMENT ON COLUMN tournament_invites.invite_code IS 'Уникальный код приглашения (используется в URL)';
COMMENT ON COLUMN tournament_invites.max_uses IS 'Максимальное количество использований (NULL = неограниченно)';
COMMENT ON COLUMN tournament_invites.expires_at IS 'Дата истечения приглашения (NULL = бессрочно)';

COMMENT ON COLUMN team_join_requests.status IS 'Статус запроса: pending, accepted, rejected';
COMMENT ON COLUMN team_join_requests.message IS 'Сообщение от пользователя при подаче заявки';
COMMENT ON COLUMN team_join_requests.reviewed_by IS 'ID пользователя (капитана), рассмотревшего заявку';

-- ========================================
-- ЗАВЕРШЕНО
-- ========================================
-- ✅ Миграция создана успешно
-- 
-- Использование:
-- 1. Инвайт-ссылки: /tournaments/invite/{invite_code}
-- 2. Запросы в команды: уведомления капитану через систему чата

