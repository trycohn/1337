-- Добавление поля next_match_id в таблицу matches
-- Это поле необходимо для корректной работы турнирных сеток

-- Добавляем поле next_match_id
ALTER TABLE matches ADD COLUMN IF NOT EXISTS next_match_id INTEGER;

-- Добавляем внешний ключ
ALTER TABLE matches 
ADD CONSTRAINT IF NOT EXISTS matches_next_match_id_fkey 
FOREIGN KEY (next_match_id) REFERENCES matches(id);

-- Добавляем индекс для оптимизации
CREATE INDEX IF NOT EXISTS idx_matches_next_match ON matches(next_match_id);

-- Добавляем комментарий
COMMENT ON COLUMN matches.next_match_id IS 'ID следующего матча куда переходит победитель';

-- Выводим информацию о завершении
DO $$
BEGIN
    RAISE NOTICE 'Added next_match_id field to matches table successfully!';
END $$; 