-- ==============================================
-- МИГРАЦИИ ДЛЯ СИСТЕМЫ ДОСТИЖЕНИЙ
-- ==============================================

-- Создание таблицы категорий достижений
CREATE TABLE IF NOT EXISTS achievement_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(20),
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы достижений
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(20) DEFAULT '🏆',
    category_id INTEGER REFERENCES achievement_categories(id),
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    xp_reward INTEGER DEFAULT 0,
    conditions JSONB, -- JSON с условиями для получения достижения
    is_active BOOLEAN DEFAULT true,
    is_hidden BOOLEAN DEFAULT false, -- Скрытые достижения (показываются только после получения)
    unlock_order INTEGER, -- Порядок разблокировки для связанных достижений
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы пользовательских достижений
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress JSONB, -- JSON с текущим прогрессом
    is_new BOOLEAN DEFAULT true, -- Отметка о том, что достижение новое (для уведомлений)
    notified_at TIMESTAMP, -- Когда пользователь был уведомлен
    UNIQUE(user_id, achievement_id)
);

-- Создание таблицы прогресса пользователей (общая статистика)
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    tournaments_created INTEGER DEFAULT 0,
    tournaments_won INTEGER DEFAULT 0,
    tournaments_participated INTEGER DEFAULT 0,
    matches_won INTEGER DEFAULT 0,
    matches_lost INTEGER DEFAULT 0,
    matches_draw INTEGER DEFAULT 0,
    friends_count INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    daily_streak_current INTEGER DEFAULT 0,
    daily_streak_longest INTEGER DEFAULT 0,
    last_login_date DATE,
    profile_completion_percentage INTEGER DEFAULT 0,
    steam_connected BOOLEAN DEFAULT false,
    faceit_connected BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы логов действий для отслеживания прогресса
CREATE TABLE IF NOT EXISTS achievement_action_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    action_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- ОБНОВЛЕНИЕ СТРУКТУРЫ СУЩЕСТВУЮЩИХ ТАБЛИЦ
-- ==============================================

-- Шаг 1: Добавляем базовые колонки в achievement_categories
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievement_categories' AND column_name = 'name') THEN
        ALTER TABLE achievement_categories ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT 'Категория';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievement_categories' AND column_name = 'icon') THEN
        ALTER TABLE achievement_categories ADD COLUMN icon VARCHAR(50) DEFAULT '🏆';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievement_categories' AND column_name = 'description') THEN
        ALTER TABLE achievement_categories ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievement_categories' AND column_name = 'sort_order') THEN
        ALTER TABLE achievement_categories ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievement_categories' AND column_name = 'created_at') THEN
        ALTER TABLE achievement_categories ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievement_categories' AND column_name = 'updated_at') THEN
        ALTER TABLE achievement_categories ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Шаг 2: Добавляем базовые колонки в achievements
DO $$ 
BEGIN
    -- Сначала проверяем и обрабатываем поле title (из старых версий)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'title') THEN
        -- Убираем NOT NULL constraint с title если он есть
        ALTER TABLE achievements ALTER COLUMN title DROP NOT NULL;
    ELSE
        -- Добавляем title как nullable поле если его нет
        ALTER TABLE achievements ADD COLUMN title VARCHAR(255);
    END IF;
    
    -- Проверяем и обрабатываем поле category (из старых версий)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'category') THEN
        -- Убираем NOT NULL constraint с category если он есть
        ALTER TABLE achievements ALTER COLUMN category DROP NOT NULL;
    ELSE
        -- Добавляем category как nullable поле если его нет
        ALTER TABLE achievements ADD COLUMN category VARCHAR(255);
    END IF;
    
    -- Проверяем и обрабатываем поле condition_type (из старых версий)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'condition_type') THEN
        -- Убираем NOT NULL constraint с condition_type если он есть
        ALTER TABLE achievements ALTER COLUMN condition_type DROP NOT NULL;
    ELSE
        -- Добавляем condition_type как nullable поле если его нет
        ALTER TABLE achievements ADD COLUMN condition_type VARCHAR(255);
    END IF;
    
    -- Проверяем и обрабатываем поле condition_value (из старых версий)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'condition_value') THEN
        -- Убираем NOT NULL constraint с condition_value если он есть
        ALTER TABLE achievements ALTER COLUMN condition_value DROP NOT NULL;
    ELSE
        -- Добавляем condition_value как nullable поле если его нет
        ALTER TABLE achievements ADD COLUMN condition_value INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'name') THEN
        ALTER TABLE achievements ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT 'Новое достижение';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'description') THEN
        ALTER TABLE achievements ADD COLUMN description TEXT DEFAULT 'Описание достижения';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'icon') THEN
        ALTER TABLE achievements ADD COLUMN icon VARCHAR(50) DEFAULT '🏆';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'rarity') THEN
        ALTER TABLE achievements ADD COLUMN rarity VARCHAR(20) DEFAULT 'common';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'xp_reward') THEN
        ALTER TABLE achievements ADD COLUMN xp_reward INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'conditions') THEN
        ALTER TABLE achievements ADD COLUMN conditions JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'is_active') THEN
        ALTER TABLE achievements ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'is_hidden') THEN
        ALTER TABLE achievements ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'unlock_order') THEN
        ALTER TABLE achievements ADD COLUMN unlock_order INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'created_at') THEN
        ALTER TABLE achievements ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'updated_at') THEN
        ALTER TABLE achievements ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Шаг 3: Добавляем category_id ПОСЛЕ создания всех колонок
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'category_id') THEN
        ALTER TABLE achievements ADD COLUMN category_id INTEGER;
    END IF;
END $$;

-- Шаг 4: Добавляем foreign key constraint отдельно (если его нет)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%achievements_category_id_fkey%' 
        AND table_name = 'achievements'
    ) THEN
        ALTER TABLE achievements ADD CONSTRAINT achievements_category_id_fkey FOREIGN KEY (category_id) REFERENCES achievement_categories(id);
    END IF;
END $$;

-- Шаг 5: Сначала очищаем некорректные данные rarity, затем добавляем CHECK constraint
DO $$
BEGIN
    -- Сначала обновляем все некорректные значения rarity на 'common'
    UPDATE achievements 
    SET rarity = 'common' 
    WHERE rarity IS NULL OR rarity NOT IN ('common', 'rare', 'epic', 'legendary');
    
    -- Теперь безопасно добавляем CHECK constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%achievements_rarity_check%' 
        AND table_name = 'achievements'
    ) THEN
        ALTER TABLE achievements ADD CONSTRAINT achievements_rarity_check CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'));
    END IF;
END $$;

-- Шаг 6: Обновляем user_achievements
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_achievements' AND column_name = 'user_id') THEN
        ALTER TABLE user_achievements ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_achievements' AND column_name = 'achievement_id') THEN
        ALTER TABLE user_achievements ADD COLUMN achievement_id INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_achievements' AND column_name = 'unlocked_at') THEN
        ALTER TABLE user_achievements ADD COLUMN unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_achievements' AND column_name = 'progress') THEN
        ALTER TABLE user_achievements ADD COLUMN progress JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_achievements' AND column_name = 'is_new') THEN
        ALTER TABLE user_achievements ADD COLUMN is_new BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_achievements' AND column_name = 'notified_at') THEN
        ALTER TABLE user_achievements ADD COLUMN notified_at TIMESTAMP;
    END IF;
END $$;

-- Шаг 7: Обновляем user_progress
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'user_id') THEN
        ALTER TABLE user_progress ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'total_xp') THEN
        ALTER TABLE user_progress ADD COLUMN total_xp INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'level') THEN
        ALTER TABLE user_progress ADD COLUMN level INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'tournaments_created') THEN
        ALTER TABLE user_progress ADD COLUMN tournaments_created INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'tournaments_won') THEN
        ALTER TABLE user_progress ADD COLUMN tournaments_won INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'tournaments_participated') THEN
        ALTER TABLE user_progress ADD COLUMN tournaments_participated INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'matches_won') THEN
        ALTER TABLE user_progress ADD COLUMN matches_won INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'matches_lost') THEN
        ALTER TABLE user_progress ADD COLUMN matches_lost INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'matches_draw') THEN
        ALTER TABLE user_progress ADD COLUMN matches_draw INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'friends_count') THEN
        ALTER TABLE user_progress ADD COLUMN friends_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'messages_sent') THEN
        ALTER TABLE user_progress ADD COLUMN messages_sent INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'daily_streak_current') THEN
        ALTER TABLE user_progress ADD COLUMN daily_streak_current INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'daily_streak_longest') THEN
        ALTER TABLE user_progress ADD COLUMN daily_streak_longest INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'last_login_date') THEN
        ALTER TABLE user_progress ADD COLUMN last_login_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'profile_completion_percentage') THEN
        ALTER TABLE user_progress ADD COLUMN profile_completion_percentage INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'steam_connected') THEN
        ALTER TABLE user_progress ADD COLUMN steam_connected BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'faceit_connected') THEN
        ALTER TABLE user_progress ADD COLUMN faceit_connected BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'created_at') THEN
        ALTER TABLE user_progress ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'updated_at') THEN
        ALTER TABLE user_progress ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Шаг 8: Обновляем achievement_action_logs
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievement_action_logs' AND column_name = 'user_id') THEN
        ALTER TABLE achievement_action_logs ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievement_action_logs' AND column_name = 'action_type') THEN
        ALTER TABLE achievement_action_logs ADD COLUMN action_type VARCHAR(100) NOT NULL DEFAULT 'unknown';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievement_action_logs' AND column_name = 'action_data') THEN
        ALTER TABLE achievement_action_logs ADD COLUMN action_data JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'achievement_action_logs' AND column_name = 'created_at') THEN
        ALTER TABLE achievement_action_logs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Шаг 9: Добавляем UNIQUE constraint для user_achievements
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_achievements_user_achievement_unique' 
        AND table_name = 'user_achievements'
    ) THEN
        ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_user_achievement_unique UNIQUE (user_id, achievement_id);
    END IF;
END $$;

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category_id);
CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON achievements(rarity);
CREATE INDEX IF NOT EXISTS idx_achievements_active ON achievements(is_active);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(unlocked_at);
CREATE INDEX IF NOT EXISTS idx_user_progress_level ON user_progress(level);
CREATE INDEX IF NOT EXISTS idx_user_progress_xp ON user_progress(total_xp);
CREATE INDEX IF NOT EXISTS idx_user_action ON achievement_action_logs(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_action_created_at ON achievement_action_logs(created_at);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Удаляем существующие триггеры если они есть, затем создаем новые
DROP TRIGGER IF EXISTS update_achievement_categories_updated_at ON achievement_categories CASCADE;
CREATE TRIGGER update_achievement_categories_updated_at 
    BEFORE UPDATE ON achievement_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_achievements_updated_at ON achievements CASCADE;
CREATE TRIGGER update_achievements_updated_at 
    BEFORE UPDATE ON achievements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress CASCADE;
CREATE TRIGGER update_user_progress_updated_at 
    BEFORE UPDATE ON user_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция для вычисления уровня по XP
CREATE OR REPLACE FUNCTION calculate_level_from_xp(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
    IF xp < 1000 THEN
        RETURN 1;
    END IF;
    
    -- Прогрессивная система уровней: каждый следующий уровень требует больше XP
    RETURN LEAST(100, FLOOR(SQRT(xp / 1000)) + 1);
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления прогресса пользователя
CREATE OR REPLACE FUNCTION update_user_progress(
    p_user_id INTEGER,
    p_action_type VARCHAR(100),
    p_action_data JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
    current_progress user_progress%ROWTYPE;
    old_level INTEGER;
    new_level INTEGER;
BEGIN
    -- Получаем текущий прогресс или создаем новый
    SELECT * INTO current_progress 
    FROM user_progress 
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO user_progress (user_id) VALUES (p_user_id);
        SELECT * INTO current_progress 
        FROM user_progress 
        WHERE user_id = p_user_id;
    END IF;
    
    old_level := current_progress.level;
    
    -- Обновляем статистику в зависимости от типа действия
    CASE p_action_type
        WHEN 'tournament_created' THEN
            UPDATE user_progress 
            SET tournaments_created = tournaments_created + 1,
                total_xp = total_xp + 100
            WHERE user_id = p_user_id;
            
        WHEN 'tournament_won' THEN
            UPDATE user_progress 
            SET tournaments_won = tournaments_won + 1,
                total_xp = total_xp + 500
            WHERE user_id = p_user_id;
            
        WHEN 'tournament_participated' THEN
            UPDATE user_progress 
            SET tournaments_participated = tournaments_participated + 1,
                total_xp = total_xp + 50
            WHERE user_id = p_user_id;
            
        WHEN 'match_won' THEN
            UPDATE user_progress 
            SET matches_won = matches_won + 1,
                total_xp = total_xp + 25
            WHERE user_id = p_user_id;
            
        WHEN 'match_lost' THEN
            UPDATE user_progress 
            SET matches_lost = matches_lost + 1,
                total_xp = total_xp + 10
            WHERE user_id = p_user_id;
            
        WHEN 'match_draw' THEN
            UPDATE user_progress 
            SET matches_draw = matches_draw + 1,
                total_xp = total_xp + 15
            WHERE user_id = p_user_id;
            
        WHEN 'friend_added' THEN
            UPDATE user_progress 
            SET friends_count = friends_count + 1,
                total_xp = total_xp + 20
            WHERE user_id = p_user_id;
            
        WHEN 'message_sent' THEN
            UPDATE user_progress 
            SET messages_sent = messages_sent + 1,
                total_xp = total_xp + 1
            WHERE user_id = p_user_id;
            
        WHEN 'daily_login' THEN
            UPDATE user_progress 
            SET daily_streak_current = CASE 
                    WHEN last_login_date = CURRENT_DATE - INTERVAL '1 day' 
                    THEN daily_streak_current + 1
                    ELSE 1
                END,
                daily_streak_longest = GREATEST(daily_streak_longest, 
                    CASE 
                        WHEN last_login_date = CURRENT_DATE - INTERVAL '1 day' 
                        THEN daily_streak_current + 1
                        ELSE 1
                    END),
                last_login_date = CURRENT_DATE,
                total_xp = total_xp + (daily_streak_current * 5)
            WHERE user_id = p_user_id;
            
        WHEN 'profile_updated' THEN
            -- Вычисляем процент заполнения профиля
            DECLARE
                completion_percentage INTEGER;
            BEGIN
                SELECT CASE 
                    WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND((COUNT(CASE WHEN 
                        (username IS NOT NULL AND username != '') OR
                        (email IS NOT NULL AND email != '') OR
                        (first_name IS NOT NULL AND first_name != '') OR
                        (last_name IS NOT NULL AND last_name != '') OR
                        (bio IS NOT NULL AND bio != '') OR
                        (avatar_url IS NOT NULL AND avatar_url != '') OR
                        (steam_id IS NOT NULL AND steam_id != '') OR
                        (faceit_username IS NOT NULL AND faceit_username != '')
                        THEN 1 END) * 100.0 / 8))
                END INTO completion_percentage
                FROM users WHERE id = p_user_id;
                
                UPDATE user_progress 
                SET profile_completion_percentage = completion_percentage,
                    total_xp = total_xp + GREATEST(0, completion_percentage - current_progress.profile_completion_percentage)
                WHERE user_id = p_user_id;
            END;
            
        WHEN 'steam_connected' THEN
            UPDATE user_progress 
            SET steam_connected = true,
                total_xp = total_xp + 100
            WHERE user_id = p_user_id;
            
        WHEN 'faceit_connected' THEN
            UPDATE user_progress 
            SET faceit_connected = true,
                total_xp = total_xp + 100
            WHERE user_id = p_user_id;
    END CASE;
    
    -- Обновляем уровень на основе нового XP
    SELECT total_xp INTO current_progress.total_xp 
    FROM user_progress WHERE user_id = p_user_id;
    
    new_level := calculate_level_from_xp(current_progress.total_xp);
    
    UPDATE user_progress 
    SET level = new_level 
    WHERE user_id = p_user_id;
    
    -- Логируем действие
    INSERT INTO achievement_action_logs (user_id, action_type, action_data)
    VALUES (p_user_id, p_action_type, p_action_data);
    
    -- Если уровень повысился, создаем специальное событие
    IF new_level > old_level THEN
        INSERT INTO achievement_action_logs (user_id, action_type, action_data)
        VALUES (p_user_id, 'level_up', jsonb_build_object('old_level', old_level, 'new_level', new_level));
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Функция для проверки и разблокировки достижений
CREATE OR REPLACE FUNCTION check_and_unlock_achievements(p_user_id INTEGER)
RETURNS TABLE(achievement_id INTEGER, achievement_name VARCHAR, newly_unlocked BOOLEAN) AS $$
DECLARE
    achievement_record RECORD;
    user_stats user_progress%ROWTYPE;
    conditions_met BOOLEAN;
    is_unlocked BOOLEAN;
    is_new_unlock BOOLEAN;
BEGIN
    -- Получаем статистику пользователя
    SELECT * INTO user_stats FROM user_progress WHERE user_id = p_user_id;
    
    -- Если нет записи прогресса, создаем её
    IF NOT FOUND THEN
        PERFORM update_user_progress(p_user_id, 'profile_created');
        SELECT * INTO user_stats FROM user_progress WHERE user_id = p_user_id;
    END IF;
    
    -- Проверяем все активные достижения
    FOR achievement_record IN 
        SELECT a.* FROM achievements a 
        WHERE a.is_active = true
        ORDER BY a.unlock_order NULLS LAST, a.id
    LOOP
        -- Проверяем, не разблокировано ли уже
        SELECT EXISTS(
            SELECT 1 FROM user_achievements 
            WHERE user_id = p_user_id AND achievement_id = achievement_record.id
        ) INTO is_unlocked;
        
        -- Если уже разблокировано, пропускаем
        IF is_unlocked THEN
            CONTINUE;
        END IF;
        
        -- Проверяем условия достижения
        conditions_met := false;
        
        -- Примеры проверки условий (можно расширить)
        CASE achievement_record.name
            WHEN 'Первый турнир' THEN
                conditions_met := user_stats.tournaments_created >= 1;
            WHEN 'Победитель' THEN
                conditions_met := user_stats.tournaments_won >= 1;
            WHEN 'Опытный игрок' THEN
                conditions_met := user_stats.tournaments_participated >= 10;
            WHEN 'Социальная бабочка' THEN
                conditions_met := user_stats.friends_count >= 5;
            WHEN 'Болтун' THEN
                conditions_met := user_stats.messages_sent >= 100;
            WHEN 'Преданный' THEN
                conditions_met := user_stats.daily_streak_current >= 7;
            WHEN 'Марафонец' THEN
                conditions_met := user_stats.daily_streak_longest >= 30;
            WHEN 'Уровень 10' THEN
                conditions_met := user_stats.level >= 10;
            WHEN 'Мастер' THEN
                conditions_met := user_stats.level >= 50;
            WHEN 'Легенда' THEN
                conditions_met := user_stats.level >= 100;
            WHEN 'Полный профиль' THEN
                conditions_met := user_stats.profile_completion_percentage >= 100;
            WHEN 'Steam подключен' THEN
                conditions_met := user_stats.steam_connected = true;
            WHEN 'FACEIT подключен' THEN
                conditions_met := user_stats.faceit_connected = true;
            ELSE
                -- Для более сложных условий используем JSONB
                IF achievement_record.conditions IS NOT NULL THEN
                    -- Здесь можно добавить более сложную логику проверки JSONB условий
                    conditions_met := false;
                END IF;
        END CASE;
        
        -- Если условия выполнены, разблокируем достижение
        IF conditions_met THEN
            INSERT INTO user_achievements (user_id, achievement_id)
            VALUES (p_user_id, achievement_record.id);
            
            -- Добавляем XP за достижение
            UPDATE user_progress 
            SET total_xp = total_xp + achievement_record.xp_reward
            WHERE user_id = p_user_id;
            
            -- Возвращаем информацию о разблокированном достижении
            achievement_id := achievement_record.id;
            achievement_name := achievement_record.name;
            newly_unlocked := true;
            RETURN NEXT;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =================================================================== 
-- ВСТАВКА БАЗОВЫХ ДАННЫХ (ТОЛЬКО ПОСЛЕ ВСЕХ ИЗМЕНЕНИЙ СТРУКТУРЫ)
-- ===================================================================

-- Безопасная вставка категорий достижений
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Турниры') THEN
        INSERT INTO achievement_categories (name, icon, description, sort_order) 
        VALUES ('Турниры', '🏆', 'Достижения, связанные с турнирами', 1);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Матчи') THEN
        INSERT INTO achievement_categories (name, icon, description, sort_order) 
        VALUES ('Матчи', '⚔️', 'Достижения в матчах и играх', 2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Социальные') THEN
        INSERT INTO achievement_categories (name, icon, description, sort_order) 
        VALUES ('Социальные', '👥', 'Социальные взаимодействия', 3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Серии') THEN
        INSERT INTO achievement_categories (name, icon, description, sort_order) 
        VALUES ('Серии', '🔥', 'Достижения за постоянство', 4);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Особые') THEN
        INSERT INTO achievement_categories (name, icon, description, sort_order) 
        VALUES ('Особые', '💎', 'Уникальные и редкие достижения', 5);
    END IF;
END $$;

-- Безопасная вставка базовых достижений
DO $$
DECLARE
    cat_tournaments INTEGER;
    cat_matches INTEGER;
    cat_social INTEGER;
    cat_streaks INTEGER;
    cat_special INTEGER;
BEGIN
    -- Получаем ID категорий
    SELECT id INTO cat_tournaments FROM achievement_categories WHERE name = 'Турниры';
    SELECT id INTO cat_matches FROM achievement_categories WHERE name = 'Матчи';
    SELECT id INTO cat_social FROM achievement_categories WHERE name = 'Социальные';
    SELECT id INTO cat_streaks FROM achievement_categories WHERE name = 'Серии';
    SELECT id INTO cat_special FROM achievement_categories WHERE name = 'Особые';
    
    -- Вставляем достижения только если их нет
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Первый турнир') THEN
        INSERT INTO achievements (name, description, icon, category_id, rarity, xp_reward, conditions)
        VALUES ('Первый турнир', 'Создайте свой первый турнир', '🎯', cat_tournaments, 'common', 100, '{"tournaments_created": 1}'::jsonb);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Организатор') THEN
        INSERT INTO achievements (name, description, icon, category_id, rarity, xp_reward, conditions)
        VALUES ('Организатор', 'Создайте 5 турниров', '📋', cat_tournaments, 'rare', 250, '{"tournaments_created": 5}'::jsonb);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Первая победа') THEN
        INSERT INTO achievements (name, description, icon, category_id, rarity, xp_reward, conditions)
        VALUES ('Первая победа', 'Выиграйте ваш первый турнир', '🥇', cat_tournaments, 'rare', 200, '{"tournaments_won": 1}'::jsonb);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Первая кровь') THEN
        INSERT INTO achievements (name, description, icon, category_id, rarity, xp_reward, conditions)
        VALUES ('Первая кровь', 'Выиграйте первый матч', '🩸', cat_matches, 'common', 50, '{"matches_won": 1}'::jsonb);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Дружелюбный') THEN
        INSERT INTO achievements (name, description, icon, category_id, rarity, xp_reward, conditions)
        VALUES ('Дружелюбный', 'Добавьте 5 друзей', '👋', cat_social, 'common', 75, '{"friends_count": 5}'::jsonb);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Постоянство') THEN
        INSERT INTO achievements (name, description, icon, category_id, rarity, xp_reward, conditions)
        VALUES ('Постоянство', 'Заходите 3 дня подряд', '📅', cat_streaks, 'common', 60, '{"daily_streak_current": 3}'::jsonb);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Steam подключен') THEN
        INSERT INTO achievements (name, description, icon, category_id, rarity, xp_reward, conditions)
        VALUES ('Steam подключен', 'Подключите Steam аккаунт', '🎮', cat_special, 'common', 100, '{"steam_connected": true}'::jsonb);
    END IF;
END $$;

-- Комментарии для документации
COMMENT ON TABLE achievement_categories IS 'Категории достижений для группировки';
COMMENT ON TABLE achievements IS 'Основная таблица всех доступных достижений';
COMMENT ON TABLE user_achievements IS 'Связь пользователей с полученными достижениями';
COMMENT ON TABLE user_progress IS 'Общая статистика прогресса пользователей';
COMMENT ON TABLE achievement_action_logs IS 'Логи всех действий пользователей для отслеживания прогресса';

COMMENT ON FUNCTION update_user_progress IS 'Обновляет прогресс пользователя при выполнении действий';
COMMENT ON FUNCTION check_and_unlock_achievements IS 'Проверяет и разблокирует новые достижения для пользователя';
COMMENT ON FUNCTION calculate_level_from_xp IS 'Вычисляет уровень игрока на основе накопленного XP'; 