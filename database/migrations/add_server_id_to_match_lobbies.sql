-- Миграция: Добавление server_id в match_lobbies для турнирных матчей
-- Дата: 2025-10-20
-- Описание: Добавляем поле server_id для связи турнирных лобби с CS2 серверами

BEGIN;

-- Добавляем поле server_id в match_lobbies
ALTER TABLE match_lobbies 
ADD COLUMN IF NOT EXISTS server_id INTEGER REFERENCES cs2_servers(id) ON DELETE SET NULL;

-- Добавляем индекс для оптимизации
CREATE INDEX IF NOT EXISTS idx_match_lobbies_server_id ON match_lobbies(server_id);

-- Комментарий
COMMENT ON COLUMN match_lobbies.server_id IS 'ID CS2 сервера, на котором играется матч';

COMMIT;

-- Вывод
DO $$
BEGIN
    RAISE NOTICE '✅ Поле server_id успешно добавлено в таблицу match_lobbies';
END $$;

