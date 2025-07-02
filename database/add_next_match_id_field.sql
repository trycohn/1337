-- Добавление поля next_match_id в таблицу matches
-- Это поле необходимо для корректной работы турнирных сеток

-- Добавляем поле next_match_id
ALTER TABLE matches ADD COLUMN IF NOT EXISTS next_match_id INTEGER;

-- Добавляем внешний ключ с проверкой существования
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_next_match_id_fkey') THEN
        ALTER TABLE matches 
        ADD CONSTRAINT matches_next_match_id_fkey 
        FOREIGN KEY (next_match_id) REFERENCES matches(id);
        RAISE NOTICE 'Added constraint matches_next_match_id_fkey';
    END IF;
END $$;

-- Добавляем индекс для оптимизации
CREATE INDEX IF NOT EXISTS idx_matches_next_match ON matches(next_match_id);

-- Добавляем комментарий
COMMENT ON COLUMN matches.next_match_id IS 'ID следующего матча куда переходит победитель';

-- Выводим информацию о завершении
DO $$
BEGIN
    RAISE NOTICE 'Added next_match_id field to matches table successfully!';
END $$; 