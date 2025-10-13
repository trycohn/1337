-- ============================================================================
-- МИГРАЦИЯ: Система статистики турниров с MVP и панелью лидеров
-- Версия: 1.0.0
-- Дата: 13 октября 2025
-- Описание: Добавление таблиц для агрегированной статистики игроков в рамках
--           турниров с автоматическим обновлением через триггеры
-- ============================================================================

-- ============================================================================
-- ТАБЛИЦА 1: Агрегированная статистика игроков в турнире
-- ============================================================================
CREATE TABLE IF NOT EXISTS tournament_player_stats (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    steam_id VARCHAR(20),
    
    -- ========================================
    -- ОБЩИЕ ПОКАЗАТЕЛИ
    -- ========================================
    matches_played INTEGER DEFAULT 0,
    rounds_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    
    -- ========================================
    -- ФРАГИ
    -- ========================================
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    total_assists INTEGER DEFAULT 0,
    kd_ratio DECIMAL(10,2) DEFAULT 0,
    
    -- ========================================
    -- ТОЧНОСТЬ
    -- ========================================
    total_headshot_kills INTEGER DEFAULT 0,
    hs_percentage DECIMAL(5,2) DEFAULT 0,
    shots_fired INTEGER DEFAULT 0,
    shots_on_target INTEGER DEFAULT 0,
    accuracy DECIMAL(5,2) DEFAULT 0,
    
    -- ========================================
    -- УРОН И ЭКОНОМИКА
    -- ========================================
    total_damage BIGINT DEFAULT 0,
    avg_adr DECIMAL(10,2) DEFAULT 0,
    total_money_earned BIGINT DEFAULT 0,
    total_equipment_value BIGINT DEFAULT 0,
    
    -- ========================================
    -- КЛАЧИ
    -- ========================================
    clutch_1v1_attempts INTEGER DEFAULT 0,
    clutch_1v1_won INTEGER DEFAULT 0,
    clutch_1v1_rate DECIMAL(5,2) DEFAULT 0,
    clutch_1v2_attempts INTEGER DEFAULT 0,
    clutch_1v2_won INTEGER DEFAULT 0,
    clutch_1v2_rate DECIMAL(5,2) DEFAULT 0,
    
    -- ========================================
    -- ENTRY FRAGGING
    -- ========================================
    entry_attempts INTEGER DEFAULT 0,
    entry_wins INTEGER DEFAULT 0,
    entry_success_rate DECIMAL(5,2) DEFAULT 0,
    
    -- ========================================
    -- УТИЛИТА
    -- ========================================
    utility_damage INTEGER DEFAULT 0,
    enemies_flashed INTEGER DEFAULT 0,
    flash_assists INTEGER DEFAULT 0,
    
    -- ========================================
    -- МУЛЬТИКИЛЛЫ
    -- ========================================
    enemy_5ks INTEGER DEFAULT 0,
    enemy_4ks INTEGER DEFAULT 0,
    enemy_3ks INTEGER DEFAULT 0,
    enemy_2ks INTEGER DEFAULT 0,
    
    -- ========================================
    -- ПРОДВИНУТЫЕ РЕЙТИНГИ
    -- ========================================
    avg_rating DECIMAL(10,2) DEFAULT 0,
    avg_kast DECIMAL(5,2) DEFAULT 0,
    impact_rating DECIMAL(10,2) DEFAULT 0,
    
    -- ========================================
    -- MVP ТУРНИРА
    -- ========================================
    is_tournament_mvp BOOLEAN DEFAULT FALSE,
    mvp_rating DECIMAL(10,2) DEFAULT 0,
    mvp_points DECIMAL(10,2) DEFAULT 0,  -- Для ранжирования кандидатов
    
    -- ========================================
    -- СЛУЖЕБНЫЕ ПОЛЯ
    -- ========================================
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Уникальность: один игрок = одна запись на турнир
    UNIQUE(tournament_id, user_id)
);

-- Комментарии к таблице
COMMENT ON TABLE tournament_player_stats IS 'Агрегированная статистика игроков в рамках турнира с автоматическим обновлением';
COMMENT ON COLUMN tournament_player_stats.mvp_rating IS 'Взвешенный рейтинг для определения MVP турнира';
COMMENT ON COLUMN tournament_player_stats.mvp_points IS 'Баллы MVP: Rating*0.35 + (K/D)*0.20 + ADR/100*0.15 + KAST*0.15 + HS%*0.10 + Clutch*0.05';

-- ============================================================================
-- ТАБЛИЦА 2: Топ достижений турнира (для быстрого доступа к лидерборду)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tournament_achievements (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value DECIMAL(10,2) NOT NULL,
    rank INTEGER NOT NULL,
    player_name VARCHAR(255),
    
    -- Служебные поля
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Уникальность: один тип достижения, один игрок, один ранг на турнир
    UNIQUE(tournament_id, achievement_type, user_id)
);

-- Комментарии к таблице
COMMENT ON TABLE tournament_achievements IS 'Топ достижений турнира: MVP, Most Kills, Highest ADR, Best HS%, Clutch King, Eco Master';
COMMENT ON COLUMN tournament_achievements.achievement_type IS 'Типы: mvp, most_kills, highest_adr, best_hs, clutch_king, eco_master, most_assists, best_accuracy';
COMMENT ON COLUMN tournament_achievements.rank IS 'Место в топе (1-3 для подиума)';

-- ============================================================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ============================================================================

-- Основные индексы для tournament_player_stats
CREATE INDEX IF NOT EXISTS idx_tps_tournament_id ON tournament_player_stats(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tps_user_id ON tournament_player_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_tps_steam_id ON tournament_player_stats(steam_id);
CREATE INDEX IF NOT EXISTS idx_tps_mvp_rating ON tournament_player_stats(tournament_id, mvp_rating DESC);
CREATE INDEX IF NOT EXISTS idx_tps_total_kills ON tournament_player_stats(tournament_id, total_kills DESC);
CREATE INDEX IF NOT EXISTS idx_tps_avg_adr ON tournament_player_stats(tournament_id, avg_adr DESC);

-- Индексы для tournament_achievements
CREATE INDEX IF NOT EXISTS idx_ta_tournament_id ON tournament_achievements(tournament_id);
CREATE INDEX IF NOT EXISTS idx_ta_achievement_type ON tournament_achievements(tournament_id, achievement_type);
CREATE INDEX IF NOT EXISTS idx_ta_rank ON tournament_achievements(tournament_id, achievement_type, rank);

-- Индекс для быстрого поиска матчей турнира (если отсутствует)
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);

-- Индекс для быстрого поиска статистики игроков в матчах (если отсутствует)
CREATE INDEX IF NOT EXISTS idx_pms_match_id ON player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_pms_user_id ON player_match_stats(user_id);

-- ============================================================================
-- МИГРАЦИЯ: Завершено
-- ============================================================================

-- Лог миграции
DO $$
BEGIN
    RAISE NOTICE '✅ Миграция 20251013_add_tournament_stats успешно применена';
    RAISE NOTICE '📊 Созданы таблицы: tournament_player_stats, tournament_achievements';
    RAISE NOTICE '🔍 Созданы индексы для оптимизации запросов';
END $$;

