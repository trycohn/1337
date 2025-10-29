-- Добавление конфигурации анкеты и таблицы заявок

-- 1) JSONB application_form_config в tournaments
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS application_form_config JSONB DEFAULT '{}';

COMMENT ON COLUMN tournaments.application_form_config IS 'Конфигурация анкеты участника (enabled, fields, min_age, fill_mode)';

-- 2) Таблица заявок на участие
CREATE TABLE IF NOT EXISTS tournament_applications (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  reviewer_id INTEGER NULL REFERENCES users(id),
  reason TEXT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_applications_tournament_id ON tournament_applications(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_applications_user_id ON tournament_applications(user_id);

-- Триггер updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tournament_applications_updated_at ON tournament_applications;
CREATE TRIGGER trg_tournament_applications_updated_at
BEFORE UPDATE ON tournament_applications
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();


