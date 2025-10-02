-- ============================================================================
-- МИГРАЦИЯ: Система Trust Scores (Античит MVP v1.0)
-- Дата: 2 октября 2025
-- Описание: Создание таблиц для хранения Steam Trust Factor данных
-- ============================================================================

-- Создание таблицы для хранения Trust Scores пользователей
CREATE TABLE IF NOT EXISTS user_trust_scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  steam_id VARCHAR(17) NOT NULL,
  
  -- Основной Trust Score (0-100)
  trust_score INTEGER NOT NULL CHECK (trust_score BETWEEN 0 AND 100),
  
  -- Действие на основе Trust Score
  trust_action VARCHAR(20) NOT NULL CHECK (
    trust_action IN ('HARD_BAN', 'SOFT_BAN', 'WATCH_LIST', 'NORMAL', 'TRUSTED')
  ),
  
  -- Параметры Steam аккаунта
  account_age_days INTEGER,
  steam_level INTEGER DEFAULT 0,
  cs2_hours INTEGER DEFAULT 0,
  profile_public BOOLEAN DEFAULT FALSE,
  games_count INTEGER DEFAULT 0,
  
  -- Информация о банах
  vac_bans INTEGER DEFAULT 0,
  game_bans INTEGER DEFAULT 0,
  last_ban_days INTEGER,
  is_community_banned BOOLEAN DEFAULT FALSE,
  is_trade_banned BOOLEAN DEFAULT FALSE,
  
  -- Метаданные
  checked_at TIMESTAMP DEFAULT NOW(),
  check_count INTEGER DEFAULT 1,
  details JSONB, -- Детальная информация (JSON)
  
  -- Уникальность
  UNIQUE(user_id),
  UNIQUE(steam_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_trust_scores_score ON user_trust_scores(trust_score);
CREATE INDEX IF NOT EXISTS idx_trust_scores_action ON user_trust_scores(trust_action);
CREATE INDEX IF NOT EXISTS idx_trust_scores_steam_id ON user_trust_scores(steam_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_checked_at ON user_trust_scores(checked_at);

-- Комментарии для документации
COMMENT ON TABLE user_trust_scores IS 'Хранение Trust Scores пользователей для античит-системы';
COMMENT ON COLUMN user_trust_scores.trust_score IS 'Оценка доверия к аккаунту (0-100, выше = лучше)';
COMMENT ON COLUMN user_trust_scores.trust_action IS 'Рекомендуемое действие на основе Trust Score';
COMMENT ON COLUMN user_trust_scores.account_age_days IS 'Возраст Steam аккаунта в днях';
COMMENT ON COLUMN user_trust_scores.cs2_hours IS 'Количество часов в Counter-Strike 2';
COMMENT ON COLUMN user_trust_scores.details IS 'Детальная информация в JSON формате';

-- ============================================================================
-- ТАБЛИЦА: История изменений Trust Score
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_trust_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  old_score INTEGER,
  new_score INTEGER,
  old_action VARCHAR(20),
  new_action VARCHAR(20),
  reason VARCHAR(255),
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_history_user ON user_trust_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_history_date ON user_trust_history(changed_at);

COMMENT ON TABLE user_trust_history IS 'История изменений Trust Scores для аудита';

-- ============================================================================
-- ДОБАВЛЕНИЕ ПОЛЯ is_banned В ТАБЛИЦУ users (если не существует)
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='is_banned') THEN
    ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN users.is_banned IS 'Флаг бана пользователя (античит)';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='ban_reason') THEN
    ALTER TABLE users ADD COLUMN ban_reason TEXT;
    COMMENT ON COLUMN users.ban_reason IS 'Причина бана пользователя';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='banned_at') THEN
    ALTER TABLE users ADD COLUMN banned_at TIMESTAMP;
    COMMENT ON COLUMN users.banned_at IS 'Дата и время бана';
  END IF;
END $$;

-- ============================================================================
-- УСПЕХ
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Миграция античит-системы успешно применена!';
  RAISE NOTICE '📊 Созданы таблицы: user_trust_scores, user_trust_history';
  RAISE NOTICE '🔧 Добавлены поля в users: is_banned, ban_reason, banned_at';
END $$;

