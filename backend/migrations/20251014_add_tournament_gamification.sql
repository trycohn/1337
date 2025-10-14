-- ============================================================================
-- МИГРАЦИЯ: Геймификация турниров v4.30.0
-- Achievement badges + Leet Coins награды + Global Leaderboards
-- ============================================================================

-- ============================================================================
-- ТАБЛИЦА 1: Достижения игроков в турнирах
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_tournament_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    rank INTEGER NOT NULL,
    value DECIMAL(10,2),
    coins_awarded INTEGER DEFAULT 0,
    awarded_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(tournament_id, user_id, achievement_type)
);

COMMENT ON TABLE user_tournament_achievements IS 'Достижения игроков в турнирах с наградами Leet Coins';
COMMENT ON COLUMN user_tournament_achievements.achievement_type IS 'mvp, most_kills, highest_adr, best_hs, clutch_king, eco_master, most_assists, best_accuracy';
COMMENT ON COLUMN user_tournament_achievements.rank IS '1 = золото, 2 = серебро, 3 = бронза';

-- ============================================================================
-- ТАБЛИЦА 2: Глобальный лидерборд MVP
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_mvp_leaderboard (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Счетчики MVP
    total_mvp_count INTEGER DEFAULT 0,
    gold_medals INTEGER DEFAULT 0,    -- Топ-1 в категориях
    silver_medals INTEGER DEFAULT 0,  -- Топ-2
    bronze_medals INTEGER DEFAULT 0,  -- Топ-3
    
    -- Агрегированная статистика
    tournaments_played INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    avg_kd_ratio DECIMAL(10,2) DEFAULT 0,
    avg_adr DECIMAL(10,2) DEFAULT 0,
    avg_hs_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Лучшие показатели
    best_kd DECIMAL(10,2) DEFAULT 0,
    best_adr DECIMAL(10,2) DEFAULT 0,
    best_hs_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Рейтинг
    global_mvp_score DECIMAL(10,2) DEFAULT 0,
    
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id)
);

COMMENT ON TABLE global_mvp_leaderboard IS 'Глобальный рейтинг MVP игроков по всем турнирам';
COMMENT ON COLUMN global_mvp_leaderboard.global_mvp_score IS 'Общий рейтинг: (total_mvp × 100) + (gold × 10) + (silver × 5) + (bronze × 2)';

-- ============================================================================
-- ТАБЛИЦА 3: Конфигурация наград Leet Coins
-- ============================================================================
CREATE TABLE IF NOT EXISTS achievement_rewards_config (
    achievement_type VARCHAR(50) PRIMARY KEY,
    rank_1_reward INTEGER DEFAULT 0,  -- Золото
    rank_2_reward INTEGER DEFAULT 0,  -- Серебро
    rank_3_reward INTEGER DEFAULT 0,  -- Бронза
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Сид наград (можно настроить)
INSERT INTO achievement_rewards_config (achievement_type, rank_1_reward, rank_2_reward, rank_3_reward, description) VALUES
('mvp', 500, 250, 100, 'MVP турнира - главная награда'),
('most_kills', 200, 100, 50, 'Больше всех убийств в турнире'),
('highest_adr', 150, 75, 30, 'Самый высокий средний урон'),
('best_hs', 150, 75, 30, 'Лучший процент headshot'),
('clutch_king', 200, 100, 50, 'Король клачей 1v1'),
('eco_master', 100, 50, 25, 'Лучшая экономика'),
('most_assists', 100, 50, 25, 'Больше всех ассистов'),
('best_accuracy', 100, 50, 25, 'Лучшая точность стрельбы')
ON CONFLICT (achievement_type) DO NOTHING;

-- ============================================================================
-- ИНДЕКСЫ
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_uta_user_id ON user_tournament_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_uta_tournament_id ON user_tournament_achievements(tournament_id);
CREATE INDEX IF NOT EXISTS idx_uta_achievement_type ON user_tournament_achievements(achievement_type, rank);

CREATE INDEX IF NOT EXISTS idx_gml_mvp_score ON global_mvp_leaderboard(global_mvp_score DESC);
CREATE INDEX IF NOT EXISTS idx_gml_mvp_count ON global_mvp_leaderboard(total_mvp_count DESC);

-- ============================================================================
-- ФУНКЦИЯ: Обновление глобального лидерборда MVP
-- ============================================================================
CREATE OR REPLACE FUNCTION update_global_mvp_leaderboard()
RETURNS TRIGGER AS $$
DECLARE
    v_gold_count INTEGER;
    v_silver_count INTEGER;
    v_bronze_count INTEGER;
BEGIN
    -- Подсчитываем медали игрока
    SELECT 
        COUNT(*) FILTER (WHERE rank = 1) as gold,
        COUNT(*) FILTER (WHERE rank = 2) as silver,
        COUNT(*) FILTER (WHERE rank = 3) as bronze
    INTO v_gold_count, v_silver_count, v_bronze_count
    FROM user_tournament_achievements
    WHERE user_id = NEW.user_id;

    -- Обновляем глобальный лидерборд
    INSERT INTO global_mvp_leaderboard (
        user_id,
        total_mvp_count,
        gold_medals,
        silver_medals,
        bronze_medals,
        global_mvp_score,
        updated_at
    )
    VALUES (
        NEW.user_id,
        CASE WHEN NEW.achievement_type = 'mvp' THEN 1 ELSE 0 END,
        v_gold_count,
        v_silver_count,
        v_bronze_count,
        (v_gold_count * 10) + (v_silver_count * 5) + (v_bronze_count * 2),
        NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        total_mvp_count = CASE 
            WHEN NEW.achievement_type = 'mvp' THEN global_mvp_leaderboard.total_mvp_count + 1
            ELSE global_mvp_leaderboard.total_mvp_count
        END,
        gold_medals = v_gold_count,
        silver_medals = v_silver_count,
        bronze_medals = v_bronze_count,
        global_mvp_score = (v_gold_count * 10) + (v_silver_count * 5) + (v_bronze_count * 2),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер на автообновление глобального лидерборда
DROP TRIGGER IF EXISTS trg_update_global_mvp_leaderboard ON user_tournament_achievements;

CREATE TRIGGER trg_update_global_mvp_leaderboard
AFTER INSERT ON user_tournament_achievements
FOR EACH ROW
EXECUTE FUNCTION update_global_mvp_leaderboard();

-- ============================================================================
-- ФУНКЦИЯ: Агрегация статистики для глобального лидерборда
-- ============================================================================
CREATE OR REPLACE FUNCTION aggregate_global_player_stats(p_user_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE global_mvp_leaderboard
    SET
        tournaments_played = (
            SELECT COUNT(DISTINCT tournament_id)
            FROM tournament_player_stats
            WHERE user_id = p_user_id
        ),
        total_kills = (
            SELECT SUM(total_kills)
            FROM tournament_player_stats
            WHERE user_id = p_user_id
        ),
        avg_kd_ratio = (
            SELECT AVG(kd_ratio)
            FROM tournament_player_stats
            WHERE user_id = p_user_id
        ),
        avg_adr = (
            SELECT AVG(avg_adr)
            FROM tournament_player_stats
            WHERE user_id = p_user_id
        ),
        avg_hs_percentage = (
            SELECT AVG(hs_percentage)
            FROM tournament_player_stats
            WHERE user_id = p_user_id
        ),
        best_kd = (
            SELECT MAX(kd_ratio)
            FROM tournament_player_stats
            WHERE user_id = p_user_id
        ),
        best_adr = (
            SELECT MAX(avg_adr)
            FROM tournament_player_stats
            WHERE user_id = p_user_id
        ),
        best_hs_percentage = (
            SELECT MAX(hs_percentage)
            FROM tournament_player_stats
            WHERE user_id = p_user_id
        ),
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ЗАВЕРШЕНИЕ
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Миграция 20251014_add_tournament_gamification завершена';
    RAISE NOTICE '🏆 Созданы таблицы: user_tournament_achievements, global_mvp_leaderboard';
    RAISE NOTICE '💰 Настроены награды Leet Coins за достижения';
    RAISE NOTICE '🎯 Триггер автообновления глобального лидерборда активирован';
END $$;

