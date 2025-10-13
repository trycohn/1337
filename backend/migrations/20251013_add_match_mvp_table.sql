-- ============================================================================
-- МИГРАЦИЯ: Таблица для хранения MVP матчей
-- Дата: 13 октября 2025
-- Описание: Расчет MVP на основе формулы из matchzy_players
-- ============================================================================

-- Таблица для хранения MVP данных игроков в матчах
CREATE TABLE IF NOT EXISTS match_player_mvp (
    id SERIAL PRIMARY KEY,
    matchzy_matchid INTEGER NOT NULL,
    our_match_id INTEGER,
    steamid64 BIGINT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    mapnumber SMALLINT NOT NULL,
    
    -- Компоненты формулы
    s_base DECIMAL(10,4) DEFAULT 0,
    s_impact DECIMAL(10,4) DEFAULT 0,
    s_obj DECIMAL(10,4) DEFAULT 0,
    
    -- Итоговый MVP скор (нормализованный по раундам)
    mvp_score DECIMAL(10,4) DEFAULT 0,
    
    -- Дополнительные метрики для тай-брейков
    rounds_played INTEGER DEFAULT 0,
    impact_per_round DECIMAL(10,4) DEFAULT 0,
    clutch_score_per_round DECIMAL(10,4) DEFAULT 0,
    adr DECIMAL(10,4) DEFAULT 0,
    deaths_per_round DECIMAL(10,4) DEFAULT 0,
    
    -- Мета
    calculated_at TIMESTAMP DEFAULT NOW(),
    
    -- Уникальность: один расчет на игрока на карте матча
    UNIQUE(matchzy_matchid, mapnumber, steamid64),
    
    -- Foreign keys
    FOREIGN KEY (matchzy_matchid) REFERENCES matchzy_matches(matchid) ON DELETE CASCADE,
    FOREIGN KEY (our_match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_match_mvp_matchzy ON match_player_mvp(matchzy_matchid);
CREATE INDEX IF NOT EXISTS idx_match_mvp_our_match ON match_player_mvp(our_match_id);
CREATE INDEX IF NOT EXISTS idx_match_mvp_score ON match_player_mvp(mvp_score DESC);
CREATE INDEX IF NOT EXISTS idx_match_mvp_user ON match_player_mvp(user_id);
CREATE INDEX IF NOT EXISTS idx_match_mvp_map ON match_player_mvp(matchzy_matchid, mapnumber);

-- Комментарии
COMMENT ON TABLE match_player_mvp IS 'MVP расчеты для игроков в турнирных и кастомных матчах';
COMMENT ON COLUMN match_player_mvp.s_base IS 'База: 1.8*K - 1.0*D + 0.6*A + DMG/25';
COMMENT ON COLUMN match_player_mvp.s_impact IS 'Импакт: 1.5*EK + 1.0*TK + 3*C1 + 5*C2 + 0.5*MK2 + 1.2*MK3 + 2.5*MK4 + 4.0*MK5';
COMMENT ON COLUMN match_player_mvp.s_obj IS 'Объективы: 2.0*MV';
COMMENT ON COLUMN match_player_mvp.mvp_score IS 'Итоговый скор: (s_base + s_impact + s_obj) / max(1, R)';

-- Успех
DO $$
BEGIN
    RAISE NOTICE '✅ Таблица match_player_mvp создана успешно!';
    RAISE NOTICE '📊 Готово к расчету MVP для турнирных и кастомных матчей';
END $$;

