-- Добавление поддержки листа ожидания для командных турниров
-- Дата: 2025-10-06
-- Автор: 1337 Community Development Team

-- 1. Добавляем флаги для турнира
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS waiting_list_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS waiting_list_require_faceit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS waiting_list_require_steam BOOLEAN DEFAULT FALSE;

-- 2. Добавляем флаг для участников
ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS in_waiting_list BOOLEAN DEFAULT FALSE;

-- 3. Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_tournament_participants_waiting_list 
ON tournament_participants(tournament_id, in_waiting_list) 
WHERE in_waiting_list = TRUE;

CREATE INDEX IF NOT EXISTS idx_tournaments_waiting_list_enabled 
ON tournaments(id, waiting_list_enabled) 
WHERE waiting_list_enabled = TRUE;

-- 4. Комментарии
COMMENT ON COLUMN tournaments.waiting_list_enabled IS 'Включен ли лист ожидания для соло игроков';
COMMENT ON COLUMN tournaments.waiting_list_require_faceit IS 'Требуется ли привязка FACEIT для листа ожидания';
COMMENT ON COLUMN tournaments.waiting_list_require_steam IS 'Требуется ли привязка Steam для листа ожидания';
COMMENT ON COLUMN tournament_participants.in_waiting_list IS 'Находится ли участник в листе ожидания (для командных турниров)';
