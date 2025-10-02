-- ============================================================================
-- МИГРАЦИЯ: Детальная статистика с MatchZy интеграцией
-- Дата: 2 октября 2025
-- Описание: Таблицы для хранения детальной статистики игроков из MatchZy
-- Версия: 2.0 (с перспективой роста до v3.0 - AI/Heatmaps)
-- ============================================================================

-- Общая статистика матча (от MatchZy)
CREATE TABLE IF NOT EXISTS match_stats (
  id SERIAL PRIMARY KEY,
  match_id INTEGER UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  
  -- Основные данные матча
  map_name VARCHAR(50),
  rounds_played INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  
  -- Команды
  team1_score INTEGER,
  team2_score INTEGER,
  team1_name VARCHAR(100),
  team2_name VARCHAR(100),
  
  -- Demo файл
  demo_url VARCHAR(500),
  demo_file_path VARCHAR(500),
  demo_size_bytes BIGINT,
  
  -- Raw JSON от MatchZy (для будущего парсинга)
  raw_matchzy_data JSONB,
  
  -- Мета
  created_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP
);

CREATE INDEX idx_match_stats_match ON match_stats(match_id);
CREATE INDEX idx_match_stats_map ON match_stats(map_name);
CREATE INDEX idx_match_stats_processed ON match_stats(processed);

COMMENT ON TABLE match_stats IS 'Общая статистика матча от MatchZy';
COMMENT ON COLUMN match_stats.raw_matchzy_data IS 'Полный JSON от MatchZy для будущего использования';

-- ============================================================================
-- Детальная статистика игрока в матче
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_match_stats (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  steam_id VARCHAR(17) NOT NULL,
  team_id INTEGER REFERENCES tournament_teams(id) ON DELETE SET NULL,
  
  -- Основная статистика
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  headshots INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  rounds_played INTEGER DEFAULT 0,
  
  -- Продвинутые метрики
  adr DECIMAL(6,2) DEFAULT 0,                    -- Average Damage per Round
  kast DECIMAL(5,2) DEFAULT 0,                   -- Kill/Assist/Survive/Trade %
  rating DECIMAL(4,2) DEFAULT 0,                 -- HLTV 2.0 rating
  impact DECIMAL(4,2) DEFAULT 0,                 -- Impact rating
  hs_percentage DECIMAL(5,2) DEFAULT 0,          -- Headshot %
  
  -- Clutches (1vX situations)
  clutch_1v1_won INTEGER DEFAULT 0,
  clutch_1v1_total INTEGER DEFAULT 0,
  clutch_1v2_won INTEGER DEFAULT 0,
  clutch_1v2_total INTEGER DEFAULT 0,
  clutch_1v3_won INTEGER DEFAULT 0,
  clutch_1v3_total INTEGER DEFAULT 0,
  clutch_1v4_won INTEGER DEFAULT 0,
  clutch_1v4_total INTEGER DEFAULT 0,
  clutch_1v5_won INTEGER DEFAULT 0,
  clutch_1v5_total INTEGER DEFAULT 0,
  
  -- Utility
  flash_assists INTEGER DEFAULT 0,
  utility_damage INTEGER DEFAULT 0,
  enemies_flashed INTEGER DEFAULT 0,
  teammates_flashed INTEGER DEFAULT 0,          -- Friendly fire флешки
  
  -- Entry fragging
  entry_kills INTEGER DEFAULT 0,                -- Первый килл в раунде
  entry_deaths INTEGER DEFAULT 0,               -- Первая смерть в раунде
  opening_kills INTEGER DEFAULT 0,              -- Opening duels выиграно
  opening_deaths INTEGER DEFAULT 0,             -- Opening duels проиграно
  trade_kills INTEGER DEFAULT 0,                -- Месть за тиммейта
  
  -- MVP и другое
  mvp INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,                      -- In-game score
  
  -- Weapon stats (JSONB для гибкости)
  weapon_stats JSONB DEFAULT '{}',              -- {"ak47": {"kills": 12, "hs": 9, ...}, ...}
  
  -- Economy (для Варианта 3)
  money_spent INTEGER DEFAULT 0,
  equipment_value INTEGER DEFAULT 0,
  
  -- 🆕 Для Варианта 3 (пока NULL, заполним позже)
  position_data JSONB,                          -- Координаты для heatmaps
  round_by_round_stats JSONB,                   -- Детали каждого раунда
  
  -- Мета
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(match_id, user_id)
);

CREATE INDEX idx_player_match_stats_user ON player_match_stats(user_id);
CREATE INDEX idx_player_match_stats_match ON player_match_stats(match_id);
CREATE INDEX idx_player_match_stats_steam ON player_match_stats(steam_id);
CREATE INDEX idx_player_match_stats_rating ON player_match_stats(rating DESC);
CREATE INDEX idx_player_match_stats_kd ON player_match_stats((kills::DECIMAL / NULLIF(deaths, 1)) DESC);

COMMENT ON TABLE player_match_stats IS 'Детальная статистика игрока в конкретном матче от MatchZy';

-- ============================================================================
-- Агрегированная статистика игрока (все матчи)
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_aggregated_stats (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Общие показатели
  total_matches INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  total_rounds INTEGER DEFAULT 0,
  
  -- K/D/A
  total_kills INTEGER DEFAULT 0,
  total_deaths INTEGER DEFAULT 0,
  total_assists INTEGER DEFAULT 0,
  total_headshots INTEGER DEFAULT 0,
  kd_ratio DECIMAL(4,2) DEFAULT 0,
  kda_ratio DECIMAL(4,2) DEFAULT 0,
  
  -- Средние показатели
  avg_kills_per_match DECIMAL(5,2) DEFAULT 0,
  avg_deaths_per_match DECIMAL(5,2) DEFAULT 0,
  avg_assists_per_match DECIMAL(5,2) DEFAULT 0,
  avg_adr DECIMAL(6,2) DEFAULT 0,
  avg_kast DECIMAL(5,2) DEFAULT 0,
  avg_rating DECIMAL(4,2) DEFAULT 0,
  avg_hs_percentage DECIMAL(5,2) DEFAULT 0,
  avg_impact DECIMAL(4,2) DEFAULT 0,
  
  -- Clutches (агрегация)
  total_clutch_won INTEGER DEFAULT 0,
  total_clutch_total INTEGER DEFAULT 0,
  clutch_success_rate DECIMAL(5,2) DEFAULT 0,
  clutch_1v1_rate DECIMAL(5,2) DEFAULT 0,
  clutch_1v2_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Entry fragging
  total_entry_kills INTEGER DEFAULT 0,
  total_entry_deaths INTEGER DEFAULT 0,
  entry_success_rate DECIMAL(5,2) DEFAULT 0,
  total_opening_kills INTEGER DEFAULT 0,
  total_opening_deaths INTEGER DEFAULT 0,
  opening_duel_success_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Utility
  total_flash_assists INTEGER DEFAULT 0,
  total_utility_damage INTEGER DEFAULT 0,
  avg_utility_damage_per_round DECIMAL(5,2) DEFAULT 0,
  
  -- MVP
  total_mvp INTEGER DEFAULT 0,
  mvp_rate DECIMAL(5,2) DEFAULT 0,
  
  -- По картам (JSONB) - для Варианта 2
  map_stats JSONB DEFAULT '{}',
  -- Формат: {"dust2": {"matches": 15, "wins": 10, "kd": 1.35, "adr": 105, ...}, ...}
  
  -- По оружию (JSONB) - для Варианта 2
  weapon_stats JSONB DEFAULT '{}',
  -- Формат: {"ak47": {"kills": 450, "headshots": 324, "hs_rate": 72, ...}, ...}
  
  -- 🆕 Для Варианта 3 (пока пустые, заполним позже)
  heatmap_data JSONB,                           -- Данные для тепловых карт
  ai_insights JSONB,                            -- AI рекомендации
  training_plan JSONB,                          -- Персональный план тренировок
  
  -- Последнее обновление
  updated_at TIMESTAMP DEFAULT NOW(),
  last_match_at TIMESTAMP
);

CREATE INDEX idx_player_aggregated_user ON player_aggregated_stats(user_id);
CREATE INDEX idx_player_aggregated_rating ON player_aggregated_stats(avg_rating DESC);
CREATE INDEX idx_player_aggregated_kd ON player_aggregated_stats(kd_ratio DESC);
CREATE INDEX idx_player_aggregated_matches ON player_aggregated_stats(total_matches DESC);

COMMENT ON TABLE player_aggregated_stats IS 'Агрегированная статистика игрока по всем матчам';

-- ============================================================================
-- Статистика игрока по картам (детально)
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_map_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  map_name VARCHAR(50) NOT NULL,
  
  -- Общее
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  rounds_played INTEGER DEFAULT 0,
  
  -- Статистика
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  kd_ratio DECIMAL(4,2) DEFAULT 0,
  avg_adr DECIMAL(6,2) DEFAULT 0,
  avg_rating DECIMAL(4,2) DEFAULT 0,
  hs_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- T/CT разделение (для Варианта 2)
  t_side_rounds INTEGER DEFAULT 0,
  t_side_wins INTEGER DEFAULT 0,
  t_side_kd DECIMAL(4,2) DEFAULT 0,
  ct_side_rounds INTEGER DEFAULT 0,
  ct_side_wins INTEGER DEFAULT 0,
  ct_side_kd DECIMAL(4,2) DEFAULT 0,
  
  -- Мета
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, map_name)
);

CREATE INDEX idx_player_map_stats_user ON player_map_stats(user_id);
CREATE INDEX idx_player_map_stats_map ON player_map_stats(map_name);
CREATE INDEX idx_player_map_stats_winrate ON player_map_stats(win_rate DESC);

COMMENT ON TABLE player_map_stats IS 'Статистика игрока по каждой карте отдельно';

-- ============================================================================
-- Статистика аномалий (для античита)
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_stats_anomalies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  
  -- Тип аномалии
  anomaly_type VARCHAR(50) NOT NULL CHECK (
    anomaly_type IN (
      'high_hs_percentage',      -- >75% HS
      'sudden_improvement',      -- Резкий рост показателей
      'excessive_wallbangs',     -- Много wallbang киллов
      'low_utility_high_kills',  -- Мало utility, много киллов
      'perfect_spray',           -- Идеальный spray control
      'instant_reactions',       -- Нечеловеческая реакция
      'prefiring_pattern'        -- Паттерн префайров
    )
  ),
  
  -- Данные аномалии
  severity VARCHAR(20) CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  value DECIMAL(10,2),                         -- Значение метрики
  expected_value DECIMAL(10,2),                -- Ожидаемое значение
  deviation_percentage DECIMAL(5,2),           -- Отклонение в %
  
  -- Детали
  description TEXT,
  evidence JSONB,                              -- Доказательства (раунды, timestamps)
  
  -- Статус
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  confirmed_cheat BOOLEAN DEFAULT FALSE,
  
  -- Мета
  detected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_anomalies_user ON player_stats_anomalies(user_id);
CREATE INDEX idx_anomalies_match ON player_stats_anomalies(match_id);
CREATE INDEX idx_anomalies_severity ON player_stats_anomalies(severity);
CREATE INDEX idx_anomalies_reviewed ON player_stats_anomalies(reviewed);

COMMENT ON TABLE player_stats_anomalies IS 'Обнаруженные аномалии в статистике для античита';

-- ============================================================================
-- ФУНКЦИЯ: Обновление агрегированной статистики игрока
-- ============================================================================

CREATE OR REPLACE FUNCTION update_player_aggregated_stats_v2(p_user_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_matches RECORD;
  v_map_stats JSONB;
  v_weapon_stats JSONB;
BEGIN
  -- 1. Агрегировать основную статистику
  SELECT 
    COUNT(DISTINCT pms.match_id) as total_matches,
    COUNT(DISTINCT CASE WHEN m.winner_team_id = pms.team_id THEN pms.match_id END) as wins,
    SUM(pms.rounds_played) as total_rounds,
    SUM(pms.kills) as kills,
    SUM(pms.deaths) as deaths,
    SUM(pms.assists) as assists,
    SUM(pms.headshots) as headshots,
    AVG(pms.adr) as avg_adr,
    AVG(pms.kast) as avg_kast,
    AVG(pms.rating) as avg_rating,
    AVG(pms.impact) as avg_impact,
    AVG(pms.hs_percentage) as avg_hs,
    SUM(pms.clutch_1v1_won + pms.clutch_1v2_won + pms.clutch_1v3_won + 
        pms.clutch_1v4_won + pms.clutch_1v5_won) as clutch_won,
    SUM(pms.clutch_1v1_total + pms.clutch_1v2_total + pms.clutch_1v3_total + 
        pms.clutch_1v4_total + pms.clutch_1v5_total) as clutch_total,
    SUM(pms.entry_kills) as entry_kills,
    SUM(pms.entry_deaths) as entry_deaths,
    SUM(pms.opening_kills) as opening_kills,
    SUM(pms.opening_deaths) as opening_deaths,
    SUM(pms.flash_assists) as flash_assists,
    SUM(pms.utility_damage) as utility_damage,
    SUM(pms.mvp) as mvp
  INTO v_matches
  FROM player_match_stats pms
  LEFT JOIN matches m ON m.id = pms.match_id
  WHERE pms.user_id = p_user_id;
  
  -- 2. Агрегировать статистику по картам
  SELECT jsonb_object_agg(
    map_name,
    jsonb_build_object(
      'matches', matches,
      'wins', wins,
      'kd', kd_ratio,
      'adr', avg_adr,
      'rating', avg_rating
    )
  ) INTO v_map_stats
  FROM (
    SELECT 
      ms.map_name,
      COUNT(*) as matches,
      COUNT(CASE WHEN m.winner_team_id = pms.team_id THEN 1 END) as wins,
      CASE WHEN SUM(pms.deaths) > 0 
        THEN ROUND((SUM(pms.kills)::DECIMAL / SUM(pms.deaths))::NUMERIC, 2)
        ELSE SUM(pms.kills) 
      END as kd_ratio,
      ROUND(AVG(pms.adr)::NUMERIC, 2) as avg_adr,
      ROUND(AVG(pms.rating)::NUMERIC, 2) as avg_rating
    FROM player_match_stats pms
    JOIN match_stats ms ON ms.match_id = pms.match_id
    LEFT JOIN matches m ON m.id = pms.match_id
    WHERE pms.user_id = p_user_id
    GROUP BY ms.map_name
  ) map_data;
  
  -- 3. Агрегировать статистику по оружию
  SELECT jsonb_object_agg(
    weapon,
    stats
  ) INTO v_weapon_stats
  FROM (
    SELECT 
      weapon_data.key as weapon,
      jsonb_build_object(
        'kills', SUM((weapon_data.value->>'kills')::INTEGER),
        'headshots', SUM((weapon_data.value->>'headshots')::INTEGER),
        'damage', SUM((weapon_data.value->>'damage')::INTEGER)
      ) as stats
    FROM player_match_stats pms,
    LATERAL jsonb_each(pms.weapon_stats) as weapon_data
    WHERE pms.user_id = p_user_id
      AND jsonb_typeof(pms.weapon_stats) = 'object'
    GROUP BY weapon_data.key
  ) weapon_data;
  
  -- 4. Сохранить агрегированные данные
  INSERT INTO player_aggregated_stats (
    user_id,
    total_matches,
    total_wins,
    total_losses,
    win_rate,
    total_rounds,
    total_kills,
    total_deaths,
    total_assists,
    total_headshots,
    kd_ratio,
    kda_ratio,
    avg_kills_per_match,
    avg_deaths_per_match,
    avg_assists_per_match,
    avg_adr,
    avg_kast,
    avg_rating,
    avg_hs_percentage,
    avg_impact,
    total_clutch_won,
    total_clutch_total,
    clutch_success_rate,
    clutch_1v1_rate,
    clutch_1v2_rate,
    total_entry_kills,
    total_entry_deaths,
    entry_success_rate,
    total_opening_kills,
    total_opening_deaths,
    opening_duel_success_rate,
    total_flash_assists,
    total_utility_damage,
    avg_utility_damage_per_round,
    total_mvp,
    mvp_rate,
    map_stats,
    weapon_stats,
    updated_at,
    last_match_at
  ) VALUES (
    p_user_id,
    v_matches.total_matches,
    v_matches.wins,
    v_matches.total_matches - v_matches.wins,
    CASE WHEN v_matches.total_matches > 0 THEN (v_matches.wins::DECIMAL / v_matches.total_matches * 100) ELSE 0 END,
    v_matches.total_rounds,
    v_matches.kills,
    v_matches.deaths,
    v_matches.assists,
    v_matches.headshots,
    CASE WHEN v_matches.deaths > 0 THEN (v_matches.kills::DECIMAL / v_matches.deaths) ELSE v_matches.kills END,
    CASE WHEN v_matches.deaths > 0 THEN ((v_matches.kills + v_matches.assists)::DECIMAL / v_matches.deaths) ELSE v_matches.kills + v_matches.assists END,
    CASE WHEN v_matches.total_matches > 0 THEN (v_matches.kills::DECIMAL / v_matches.total_matches) ELSE 0 END,
    CASE WHEN v_matches.total_matches > 0 THEN (v_matches.deaths::DECIMAL / v_matches.total_matches) ELSE 0 END,
    CASE WHEN v_matches.total_matches > 0 THEN (v_matches.assists::DECIMAL / v_matches.total_matches) ELSE 0 END,
    v_matches.avg_adr,
    v_matches.avg_kast,
    v_matches.avg_rating,
    v_matches.avg_hs,
    v_matches.avg_impact,
    v_matches.clutch_won,
    v_matches.clutch_total,
    CASE WHEN v_matches.clutch_total > 0 THEN (v_matches.clutch_won::DECIMAL / v_matches.clutch_total * 100) ELSE 0 END,
    -- Clutch rates по типам (пока упрощенно, детали в Варианте 3)
    50.0,  -- placeholder для 1v1
    35.0,  -- placeholder для 1v2
    v_matches.entry_kills,
    v_matches.entry_deaths,
    CASE WHEN (v_matches.entry_kills + v_matches.entry_deaths) > 0 
      THEN (v_matches.entry_kills::DECIMAL / (v_matches.entry_kills + v_matches.entry_deaths) * 100) 
      ELSE 0 END,
    v_matches.opening_kills,
    v_matches.opening_deaths,
    CASE WHEN (v_matches.opening_kills + v_matches.opening_deaths) > 0 
      THEN (v_matches.opening_kills::DECIMAL / (v_matches.opening_kills + v_matches.opening_deaths) * 100) 
      ELSE 0 END,
    v_matches.flash_assists,
    v_matches.utility_damage,
    CASE WHEN v_matches.total_rounds > 0 THEN (v_matches.utility_damage::DECIMAL / v_matches.total_rounds) ELSE 0 END,
    v_matches.mvp,
    CASE WHEN v_matches.total_matches > 0 THEN (v_matches.mvp::DECIMAL / v_matches.total_matches * 100) ELSE 0 END,
    COALESCE(v_map_stats, '{}'::jsonb),
    COALESCE(v_weapon_stats, '{}'::jsonb),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_matches = EXCLUDED.total_matches,
    total_wins = EXCLUDED.total_wins,
    total_losses = EXCLUDED.total_losses,
    win_rate = EXCLUDED.win_rate,
    total_rounds = EXCLUDED.total_rounds,
    total_kills = EXCLUDED.total_kills,
    total_deaths = EXCLUDED.total_deaths,
    total_assists = EXCLUDED.total_assists,
    total_headshots = EXCLUDED.total_headshots,
    kd_ratio = EXCLUDED.kd_ratio,
    kda_ratio = EXCLUDED.kda_ratio,
    avg_kills_per_match = EXCLUDED.avg_kills_per_match,
    avg_deaths_per_match = EXCLUDED.avg_deaths_per_match,
    avg_assists_per_match = EXCLUDED.avg_assists_per_match,
    avg_adr = EXCLUDED.avg_adr,
    avg_kast = EXCLUDED.avg_kast,
    avg_rating = EXCLUDED.avg_rating,
    avg_hs_percentage = EXCLUDED.avg_hs_percentage,
    avg_impact = EXCLUDED.avg_impact,
    total_clutch_won = EXCLUDED.total_clutch_won,
    total_clutch_total = EXCLUDED.total_clutch_total,
    clutch_success_rate = EXCLUDED.clutch_success_rate,
    total_entry_kills = EXCLUDED.total_entry_kills,
    total_entry_deaths = EXCLUDED.total_entry_deaths,
    entry_success_rate = EXCLUDED.entry_success_rate,
    total_opening_kills = EXCLUDED.total_opening_kills,
    total_opening_deaths = EXCLUDED.total_opening_deaths,
    opening_duel_success_rate = EXCLUDED.opening_duel_success_rate,
    total_flash_assists = EXCLUDED.total_flash_assists,
    total_utility_damage = EXCLUDED.total_utility_damage,
    avg_utility_damage_per_round = EXCLUDED.avg_utility_damage_per_round,
    total_mvp = EXCLUDED.total_mvp,
    mvp_rate = EXCLUDED.mvp_rate,
    map_stats = EXCLUDED.map_stats,
    weapon_stats = EXCLUDED.weapon_stats,
    updated_at = NOW(),
    last_match_at = NOW();
    
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_player_aggregated_stats_v2 IS 'Пересчитывает всю статистику игрока v2.0 (с MatchZy данными)';

-- ============================================================================
-- УСПЕХ
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Миграция детальной статистики (MatchZy v2.0) успешно применена!';
  RAISE NOTICE '📊 Созданы таблицы:';
  RAISE NOTICE '   • match_stats (общая статистика матча)';
  RAISE NOTICE '   • player_match_stats (детальная статистика игрока в матче)';
  RAISE NOTICE '   • player_aggregated_stats (агрегация по всем матчам)';
  RAISE NOTICE '   • player_map_stats (статистика по картам)';
  RAISE NOTICE '   • player_stats_anomalies (детекция аномалий)';
  RAISE NOTICE '🔧 Создана функция: update_player_aggregated_stats_v2()';
  RAISE NOTICE '🚀 Готово к приему данных от MatchZy!';
END $$;

