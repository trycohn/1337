-- ============================================================================
-- МИГРАЦИЯ: Система обратной связи после матчей (Post-Match Feedback)
-- Дата: 2 октября 2025
-- Описание: Создание таблиц для сбора feedback от игроков после матчей
-- ============================================================================

-- Таблица обратной связи после матча
CREATE TABLE IF NOT EXISTS match_feedback (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
  
  -- Кто оценивает и кого
  reviewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reviewed_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  -- Тип оценки (соперник или тиммейт)
  feedback_type VARCHAR(20) NOT NULL CHECK (
    feedback_type IN ('opponent', 'teammate')
  ),
  
  -- Оценки
  fairness_rating VARCHAR(20) CHECK (
    fairness_rating IN ('clean', 'normal', 'suspicious', 'cheating')
  ),
  
  behavior_rating VARCHAR(20) CHECK (
    behavior_rating IN ('excellent', 'good', 'normal', 'toxic')
  ),
  
  teamplay_rating VARCHAR(20) CHECK (
    teamplay_rating IN ('excellent', 'normal', 'poor')
  ),
  
  communication_rating VARCHAR(20) CHECK (
    communication_rating IN ('good', 'normal', 'silent', 'toxic')
  ),
  
  -- Дополнительные данные (опционально)
  comment TEXT,
  
  -- Награда
  coins_rewarded INTEGER DEFAULT 10,
  
  -- Мета
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Уникальность: один reviewer может оценить один раз конкретного reviewed в конкретном матче
  UNIQUE(match_id, reviewer_id, reviewed_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_feedback_match ON match_feedback(match_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reviewer ON match_feedback(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reviewed ON match_feedback(reviewed_id);
CREATE INDEX IF NOT EXISTS idx_feedback_tournament ON match_feedback(tournament_id);
CREATE INDEX IF NOT EXISTS idx_feedback_fairness ON match_feedback(fairness_rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON match_feedback(created_at);

-- Комментарии
COMMENT ON TABLE match_feedback IS 'Обратная связь игроков после матчей';
COMMENT ON COLUMN match_feedback.feedback_type IS 'Тип: opponent (соперник) или teammate (тиммейт)';
COMMENT ON COLUMN match_feedback.fairness_rating IS 'Оценка честности: clean, normal, suspicious, cheating';
COMMENT ON COLUMN match_feedback.behavior_rating IS 'Оценка поведения: excellent, good, normal, toxic';

-- ============================================================================
-- АГРЕГИРОВАННАЯ РЕПУТАЦИЯ ИГРОКА
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_reputation (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Счетчики обратной связи
  total_feedbacks INTEGER DEFAULT 0,
  
  -- Честность (главный показатель для античита)
  clean_reports INTEGER DEFAULT 0,
  normal_reports INTEGER DEFAULT 0,
  suspicious_reports INTEGER DEFAULT 0,
  cheating_reports INTEGER DEFAULT 0,
  
  -- Поведение
  excellent_behavior INTEGER DEFAULT 0,
  good_behavior INTEGER DEFAULT 0,
  normal_behavior INTEGER DEFAULT 0,
  toxic_behavior INTEGER DEFAULT 0,
  
  -- Командная игра
  excellent_teamplay INTEGER DEFAULT 0,
  normal_teamplay INTEGER DEFAULT 0,
  poor_teamplay INTEGER DEFAULT 0,
  
  -- Коммуникация
  good_communication INTEGER DEFAULT 0,
  normal_communication INTEGER DEFAULT 0,
  silent_communication INTEGER DEFAULT 0,
  toxic_communication INTEGER DEFAULT 0,
  
  -- Вычисляемые показатели (0.00-100.00)
  fairness_score DECIMAL(5,2) DEFAULT 50.00,
  behavior_score DECIMAL(5,2) DEFAULT 50.00,
  teamplay_score DECIMAL(5,2) DEFAULT 50.00,
  communication_score DECIMAL(5,2) DEFAULT 50.00,
  
  -- Репутационный индекс (общий, 0-100)
  reputation_index INTEGER DEFAULT 50 CHECK (reputation_index BETWEEN 0 AND 100),
  
  -- Мета
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_reputation_index ON player_reputation(reputation_index);
CREATE INDEX IF NOT EXISTS idx_reputation_fairness ON player_reputation(fairness_score);
CREATE INDEX IF NOT EXISTS idx_reputation_cheating ON player_reputation(cheating_reports);

-- Комментарии
COMMENT ON TABLE player_reputation IS 'Агрегированная репутация игрока на основе feedback';
COMMENT ON COLUMN player_reputation.reputation_index IS 'Общий репутационный индекс (0-100)';
COMMENT ON COLUMN player_reputation.fairness_score IS 'Оценка честности игры (0-100)';

-- ============================================================================
-- ТАБЛИЦА: Уведомления о pending feedback
-- ============================================================================

CREATE TABLE IF NOT EXISTS match_feedback_pending (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  -- Статус
  prompted_at TIMESTAMP DEFAULT NOW(),
  feedback_given BOOLEAN DEFAULT FALSE,
  feedback_given_at TIMESTAMP,
  
  -- Уникальность
  UNIQUE(match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_pending_user ON match_feedback_pending(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_pending_match ON match_feedback_pending(match_id);

COMMENT ON TABLE match_feedback_pending IS 'Отслеживание запросов на feedback после матчей';

-- ============================================================================
-- ДОБАВЛЕНИЕ ПОЛЯ user_coins (если не существует)
-- ============================================================================

-- Таблица для хранения coins пользователей
CREATE TABLE IF NOT EXISTS user_coins (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned INTEGER DEFAULT 0,
  lifetime_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_coins_balance ON user_coins(balance);

COMMENT ON TABLE user_coins IS 'Баланс виртуальной валюты (coins) пользователей';

-- История транзакций coins
CREATE TABLE IF NOT EXISTS coin_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type VARCHAR(50) NOT NULL CHECK (
    transaction_type IN ('earn', 'spend')
  ),
  source VARCHAR(100), -- 'match_feedback', 'tournament_win', 'daily_login', etc
  reference_id INTEGER, -- ID связанной сущности (match_id, tournament_id)
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created ON coin_transactions(created_at);

COMMENT ON TABLE coin_transactions IS 'История транзакций виртуальной валюты';

-- ============================================================================
-- ФУНКЦИЯ: Обновление репутации игрока
-- ============================================================================

CREATE OR REPLACE FUNCTION update_player_reputation(p_user_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_total INTEGER;
  v_clean INTEGER;
  v_normal INTEGER;
  v_suspicious INTEGER;
  v_cheating INTEGER;
  v_good_behavior INTEGER;
  v_toxic_behavior INTEGER;
  v_excellent_teamplay INTEGER;
  v_poor_teamplay INTEGER;
  v_fairness_score DECIMAL(5,2);
  v_behavior_score DECIMAL(5,2);
  v_teamplay_score DECIMAL(5,2);
  v_reputation_index INTEGER;
BEGIN
  -- Подсчитать статистику
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN fairness_rating = 'clean' THEN 1 END),
    COUNT(CASE WHEN fairness_rating = 'normal' THEN 1 END),
    COUNT(CASE WHEN fairness_rating = 'suspicious' THEN 1 END),
    COUNT(CASE WHEN fairness_rating = 'cheating' THEN 1 END),
    COUNT(CASE WHEN behavior_rating = 'good' OR behavior_rating = 'excellent' THEN 1 END),
    COUNT(CASE WHEN behavior_rating = 'toxic' THEN 1 END),
    COUNT(CASE WHEN teamplay_rating = 'excellent' THEN 1 END),
    COUNT(CASE WHEN teamplay_rating = 'poor' THEN 1 END)
  INTO 
    v_total,
    v_clean,
    v_normal,
    v_suspicious,
    v_cheating,
    v_good_behavior,
    v_toxic_behavior,
    v_excellent_teamplay,
    v_poor_teamplay
  FROM match_feedback
  WHERE reviewed_id = p_user_id;
  
  -- Если нет данных, установить значения по умолчанию
  IF v_total = 0 THEN
    v_fairness_score := 50.00;
    v_behavior_score := 50.00;
    v_teamplay_score := 50.00;
    v_reputation_index := 50;
  ELSE
    -- Вычислить Fairness Score (вес 70%)
    v_fairness_score := (
      (v_clean * 100.0) +
      (v_normal * 75.0) +
      (v_suspicious * 25.0) +
      (v_cheating * 0.0)
    ) / v_total;
    
    -- Вычислить Behavior Score (вес 20%)
    v_behavior_score := (
      (v_good_behavior * 100.0) +
      ((v_total - v_good_behavior - v_toxic_behavior) * 60.0) +
      (v_toxic_behavior * 0.0)
    ) / v_total;
    
    -- Вычислить Teamplay Score (вес 10%)
    v_teamplay_score := (
      (v_excellent_teamplay * 100.0) +
      ((v_total - v_excellent_teamplay - v_poor_teamplay) * 60.0) +
      (v_poor_teamplay * 20.0)
    ) / v_total;
    
    -- Вычислить общий Reputation Index
    v_reputation_index := ROUND(
      v_fairness_score * 0.7 +
      v_behavior_score * 0.2 +
      v_teamplay_score * 0.1
    );
    
    -- Нормализация (0-100)
    v_reputation_index := GREATEST(0, LEAST(100, v_reputation_index));
  END IF;
  
  -- Обновить или создать запись
  INSERT INTO player_reputation (
    user_id,
    total_feedbacks,
    clean_reports,
    normal_reports,
    suspicious_reports,
    cheating_reports,
    good_behavior,
    toxic_behavior,
    excellent_teamplay,
    poor_teamplay,
    fairness_score,
    behavior_score,
    teamplay_score,
    reputation_index,
    updated_at
  ) VALUES (
    p_user_id,
    v_total,
    v_clean,
    v_normal,
    v_suspicious,
    v_cheating,
    v_good_behavior,
    v_toxic_behavior,
    v_excellent_teamplay,
    v_poor_teamplay,
    v_fairness_score,
    v_behavior_score,
    v_teamplay_score,
    v_reputation_index,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_feedbacks = EXCLUDED.total_feedbacks,
    clean_reports = EXCLUDED.clean_reports,
    normal_reports = EXCLUDED.normal_reports,
    suspicious_reports = EXCLUDED.suspicious_reports,
    cheating_reports = EXCLUDED.cheating_reports,
    good_behavior = EXCLUDED.good_behavior,
    toxic_behavior = EXCLUDED.toxic_behavior,
    excellent_teamplay = EXCLUDED.excellent_teamplay,
    poor_teamplay = EXCLUDED.poor_teamplay,
    fairness_score = EXCLUDED.fairness_score,
    behavior_score = EXCLUDED.behavior_score,
    teamplay_score = EXCLUDED.teamplay_score,
    reputation_index = EXCLUDED.reputation_index,
    updated_at = NOW();
    
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_player_reputation IS 'Пересчитывает репутацию игрока на основе всех полученных feedbacks';

-- ============================================================================
-- УСПЕХ
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Миграция Post-Match Feedback системы успешно применена!';
  RAISE NOTICE '📊 Созданы таблицы: match_feedback, player_reputation, match_feedback_pending';
  RAISE NOTICE '💰 Созданы таблицы: user_coins, coin_transactions';
  RAISE NOTICE '🔧 Создана функция: update_player_reputation()';
END $$;

