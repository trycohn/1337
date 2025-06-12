-- Добавляем столбец chat_id в таблицу tournaments для связи с чатом
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS chat_id INTEGER REFERENCES chats(id) ON DELETE SET NULL;

-- Создаем индекс для оптимизации поиска
CREATE INDEX IF NOT EXISTS idx_tournaments_chat_id ON tournaments(chat_id);

-- Комментарий к столбцу
COMMENT ON COLUMN tournaments.chat_id IS 'ID группового чата турнира'; 