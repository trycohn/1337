-- Добавление времени завершения турнира
BEGIN;

ALTER TABLE tournaments
    ADD COLUMN IF NOT EXISTS completed_at timestamp without time zone;

-- Бэкаповое заполнение для уже завершённых турниров
UPDATE tournaments
SET completed_at = COALESCE(end_date, updated_at, created_at)
WHERE status = 'completed' AND completed_at IS NULL;

-- Индекс для сортировки/фильтрации
CREATE INDEX IF NOT EXISTS idx_tournaments_completed_at ON tournaments (completed_at);

COMMIT;


