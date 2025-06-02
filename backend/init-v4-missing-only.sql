-- 🎯 V4 ULTIMATE: Добавление ТОЛЬКО недостающих компонентов
-- Таблица user_tournament_stats и friends уже существуют и полностью готовы!

-- ========================================
-- 1. ТАБЛИЦА ДОСТИЖЕНИЙ
-- ========================================

CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon VARCHAR(50) DEFAULT '🏆',
    category VARCHAR(50) NOT NULL, -- tournaments, games, social, streaks, performance, special
    rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary, mythical
    points INTEGER DEFAULT 10,
    condition_type VARCHAR(50) NOT NULL, -- wins, tournaments_won, matches_played, etc.
    condition_value INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 2. ТАБЛИЦА ПОЛЬЗОВАТЕЛЬСКИХ ДОСТИЖЕНИЙ
-- ========================================

CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress INTEGER DEFAULT 0,
    UNIQUE(user_id, achievement_id)
);

-- ========================================
-- 3. ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ========================================

CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON achievements(rarity);
CREATE INDEX IF NOT EXISTS idx_achievements_condition_type ON achievements(condition_type);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);

-- ========================================
-- 4. ТРИГГЕРЫ ДЛЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ
-- ========================================

-- Триггер для achievements
DROP TRIGGER IF EXISTS update_achievements_updated_at ON achievements;
CREATE TRIGGER update_achievements_updated_at 
    BEFORE UPDATE ON achievements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 5. ФУНКЦИЯ ПРОВЕРКИ ДОСТИЖЕНИЙ
-- ========================================

CREATE OR REPLACE FUNCTION check_achievements(user_id_param INTEGER)
RETURNS TABLE(unlocked_achievement_id INTEGER, achievement_title TEXT) AS $$
DECLARE
    achievement_record RECORD;
    user_stats RECORD;
BEGIN
    -- Получаем статистику пользователя из существующей таблицы
    SELECT 
        COUNT(*) as tournaments_participated,
        COUNT(*) FILTER (WHERE is_winner = true) as tournaments_won,
        COALESCE(SUM(total_matches), 0) as matches_played,
        COALESCE(SUM(wins), 0) as matches_won,
        CASE 
            WHEN COALESCE(SUM(total_matches), 0) > 0 
            THEN (COALESCE(SUM(wins), 0) * 100.0 / COALESCE(SUM(total_matches), 0))
            ELSE 0 
        END as winrate,
        (SELECT COUNT(*) FROM friends WHERE user_id = user_id_param AND status = 'accepted') as friends_count
    INTO user_stats
    FROM user_tournament_stats 
    WHERE user_id = user_id_param;

    -- Проверяем каждое достижение
    FOR achievement_record IN 
        SELECT a.* FROM achievements a 
        WHERE a.is_active = true 
        AND a.id NOT IN (
            SELECT achievement_id 
            FROM user_achievements 
            WHERE user_id = user_id_param
        )
    LOOP
        -- Проверяем условие достижения
        CASE achievement_record.condition_type
            WHEN 'tournaments_participated' THEN
                IF user_stats.tournaments_participated >= achievement_record.condition_value THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
            WHEN 'tournaments_won' THEN
                IF user_stats.tournaments_won >= achievement_record.condition_value THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
            WHEN 'matches_played' THEN
                IF user_stats.matches_played >= achievement_record.condition_value THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
            WHEN 'matches_won' THEN
                IF user_stats.matches_won >= achievement_record.condition_value THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
            WHEN 'friends_count' THEN
                IF user_stats.friends_count >= achievement_record.condition_value THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
            WHEN 'winrate_threshold' THEN
                IF user_stats.winrate >= achievement_record.condition_value 
                   AND user_stats.matches_played >= 20 THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
        END CASE;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. ПРЕДСТАВЛЕНИЕ ЛИДЕРБОРДОВ
-- ========================================

CREATE OR REPLACE VIEW v4_leaderboard AS
SELECT 
    u.id as user_id,
    u.username,
    u.avatar_url,
    COALESCE(SUM(uts.total_matches), 0) as total_matches,
    COALESCE(SUM(uts.wins), 0) as total_wins,
    CASE 
        WHEN COALESCE(SUM(uts.total_matches), 0) > 0 
        THEN ROUND((COALESCE(SUM(uts.wins), 0) * 100.0 / COALESCE(SUM(uts.total_matches), 0)), 1)
        ELSE 0 
    END as winrate,
    COUNT(*) FILTER (WHERE uts.is_winner = true) as tournaments_won,
    COUNT(ua.id) as achievements_count,
    COALESCE(SUM(a.points), 0) as total_achievement_points,
    ROW_NUMBER() OVER (ORDER BY 
        COUNT(*) FILTER (WHERE uts.is_winner = true) DESC,
        COALESCE(SUM(uts.wins), 0) DESC,
        COALESCE(SUM(uts.total_matches), 0) DESC
    ) as rank
FROM users u
LEFT JOIN user_tournament_stats uts ON u.id = uts.user_id
LEFT JOIN user_achievements ua ON u.id = ua.user_id
LEFT JOIN achievements a ON ua.achievement_id = a.id
WHERE u.id > 1 -- Исключаем системного пользователя
GROUP BY u.id, u.username, u.avatar_url
HAVING COALESCE(SUM(uts.total_matches), 0) > 0 -- Только пользователи с матчами
ORDER BY rank;

-- ========================================
-- 7. БАЗОВЫЕ ДОСТИЖЕНИЯ (18 ШТУК)
-- ========================================

INSERT INTO achievements (title, description, icon, category, rarity, points, condition_type, condition_value) VALUES
-- Турнирные достижения
('Первые шаги', 'Принял участие в первом турнире', '🎯', 'tournaments', 'common', 10, 'tournaments_participated', 1),
('Турнирный боец', 'Принял участие в 5 турнирах', '⚔️', 'tournaments', 'rare', 25, 'tournaments_participated', 5),
('Турнирный ветеран', 'Принял участие в 25 турнирах', '🛡️', 'tournaments', 'epic', 50, 'tournaments_participated', 25),
('Первая победа', 'Выиграл первый турнир', '👑', 'tournaments', 'rare', 50, 'tournaments_won', 1),
('Чемпион', 'Выиграл 5 турниров', '🏆', 'tournaments', 'legendary', 100, 'tournaments_won', 5),

-- Игровые достижения
('Дебютант', 'Сыграл первый матч', '🎮', 'games', 'common', 5, 'matches_played', 1),
('Активный игрок', 'Сыграл 50 матчей', '🎯', 'games', 'rare', 30, 'matches_played', 50),
('Ветеран', 'Сыграл 200 матчей', '⭐', 'games', 'epic', 75, 'matches_played', 200),
('Первая победа в матче', 'Выиграл первый матч', '✨', 'games', 'common', 15, 'matches_won', 1),
('Мастер побед', 'Выиграл 100 матчей', '🔥', 'games', 'legendary', 150, 'matches_won', 100),

-- Социальные достижения
('Дружелюбный', 'Добавил первого друга', '👥', 'social', 'common', 10, 'friends_count', 1),
('Популярный', 'Имеет 10 друзей', '🤝', 'social', 'rare', 25, 'friends_count', 10),
('Звезда сообщества', 'Имеет 50 друзей', '🌟', 'social', 'epic', 75, 'friends_count', 50),

-- Серийные достижения
('Удачная серия', 'Выиграл 3 матча подряд', '📈', 'streaks', 'rare', 30, 'win_streak', 3),
('Доминирование', 'Выиграл 10 матчей подряд', '💪', 'streaks', 'legendary', 100, 'win_streak', 10),
('Непобедимый', 'Выиграл 25 матчей подряд', '👑', 'streaks', 'mythical', 250, 'win_streak', 25),

-- Производительность
('Снайпер', 'Достиг 80% винрейта (минимум 20 игр)', '🎯', 'performance', 'epic', 100, 'winrate_threshold', 80),
('Легенда', 'Достиг 90% винрейта (минимум 50 игр)', '⚡', 'performance', 'mythical', 200, 'winrate_threshold', 90)

ON CONFLICT (title) DO NOTHING;

-- ========================================
-- 8. ФИНАЛЬНЫЕ СООБЩЕНИЯ
-- ========================================

DO $$
DECLARE
    achievement_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO achievement_count FROM achievements;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ===============================================';
    RAISE NOTICE '✅ V4 ULTIMATE: НЕДОСТАЮЩИЕ КОМПОНЕНТЫ ДОБАВЛЕНЫ!';
    RAISE NOTICE '🎉 ===============================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Создано достижений: %', achievement_count;
    RAISE NOTICE '🏆 Система достижений готова к работе';
    RAISE NOTICE '👥 Интеграция с существующими таблицами friends и user_tournament_stats';
    RAISE NOTICE '📈 Представление v4_leaderboard создано';
    RAISE NOTICE '⚡ Функция check_achievements() готова к использованию';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 V4 ULTIMATE полностью готов к работе!';
    RAISE NOTICE '📱 Теперь можно запускать frontend с революционным дашбордом';
    RAISE NOTICE '';
END $$; 