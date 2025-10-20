-- Миграция: Добавление tournament_lobby_id в matchzy_matches
-- Дата: 2025-10-20
-- Описание: Разделяем lobby_id (для кастомных) и tournament_lobby_id (для турнирных)

BEGIN;

-- Добавляем поле tournament_lobby_id для турнирных лобби
ALTER TABLE matchzy_matches 
ADD COLUMN IF NOT EXISTS tournament_lobby_id INTEGER REFERENCES match_lobbies(id) ON DELETE SET NULL;

-- Добавляем индекс для оптимизации
CREATE INDEX IF NOT EXISTS idx_matchzy_matches_tournament_lobby ON matchzy_matches(tournament_lobby_id);

-- Комментарий
COMMENT ON COLUMN matchzy_matches.lobby_id IS 'ID кастомного лобби (admin_match_lobbies)';
COMMENT ON COLUMN matchzy_matches.tournament_lobby_id IS 'ID турнирного лобби (match_lobbies)';

COMMIT;

-- Вывод
DO $$
BEGIN
    RAISE NOTICE '✅ Поле tournament_lobby_id успешно добавлено в таблицу matchzy_matches';
END $$;

