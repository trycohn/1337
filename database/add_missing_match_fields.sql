-- Добавление недостающих полей в таблицу matches
-- Необходимо для корректной работы турнирных сеток

-- Добавляем основные поля для турнирной сетки
ALTER TABLE matches ADD COLUMN IF NOT EXISTS next_match_id INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_number INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_third_place_match BOOLEAN DEFAULT FALSE;

-- Добавляем поле maps_data если его еще нет
ALTER TABLE matches ADD COLUMN IF NOT EXISTS maps_data JSONB;

-- Добавляем поля из single_elimination_schema_update.sql если их еще нет
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_name VARCHAR(50);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_title VARCHAR(100);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_preliminary_round BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bye_match BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_next_match_id INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS position_in_round INTEGER;

-- Добавляем внешние ключи
ALTER TABLE matches 
ADD CONSTRAINT IF NOT EXISTS matches_next_match_id_fkey 
FOREIGN KEY (next_match_id) REFERENCES matches(id);

ALTER TABLE matches 
ADD CONSTRAINT IF NOT EXISTS matches_loser_next_match_id_fkey 
FOREIGN KEY (loser_next_match_id) REFERENCES matches(id);

-- Добавляем индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_matches_next_match ON matches(next_match_id);
CREATE INDEX IF NOT EXISTS idx_matches_match_number ON matches(match_number);
CREATE INDEX IF NOT EXISTS idx_matches_third_place ON matches(is_third_place_match);
CREATE INDEX IF NOT EXISTS idx_matches_preliminary ON matches(is_preliminary_round);
CREATE INDEX IF NOT EXISTS idx_matches_loser_next ON matches(loser_next_match_id);

-- Добавляем комментарии к полям
COMMENT ON COLUMN matches.next_match_id IS 'ID следующего матча куда переходит победитель';
COMMENT ON COLUMN matches.match_number IS 'Номер матча в рамках раунда';
COMMENT ON COLUMN matches.is_third_place_match IS 'Матч за третье место';
COMMENT ON COLUMN matches.maps_data IS 'Данные о сыгранных картах в формате JSON';
COMMENT ON COLUMN matches.round_name IS 'Название раунда: Финал, Полуфинал, 1/4, 1/8, Предварительный';
COMMENT ON COLUMN matches.match_title IS 'Полное название матча для отображения';
COMMENT ON COLUMN matches.is_preliminary_round IS 'Матч предварительного раунда отсева';
COMMENT ON COLUMN matches.bye_match IS 'Матч с автопроходом (bye)';
COMMENT ON COLUMN matches.loser_next_match_id IS 'ID матча куда переходит проигравший (для матча за 3-е место)';
COMMENT ON COLUMN matches.position_in_round IS 'Позиция матча в раунде для правильной сортировки';

-- Выводим информацию о завершении
DO $$
BEGIN
    RAISE NOTICE 'Added all missing fields to matches table successfully!';
    RAISE NOTICE 'Fields: next_match_id, match_number, is_third_place_match, maps_data';
    RAISE NOTICE 'Fields: round_name, match_title, is_preliminary_round, bye_match';
    RAISE NOTICE 'Fields: loser_next_match_id, position_in_round';
    RAISE NOTICE 'Added foreign keys and indexes for optimization';
END $$; 