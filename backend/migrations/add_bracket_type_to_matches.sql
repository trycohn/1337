-- Миграция: добавление поля bracket_type в matches
-- Дата: 2025-01-15
-- Описание: Добавляет поле bracket_type для матчей турнирной сетки

-- Добавляем поле bracket_type если его нет
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket_type VARCHAR(20) DEFAULT 'winner';

-- Добавляем ограничение на допустимые значения
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'matches' 
        AND constraint_name = 'matches_bracket_type_check'
    ) THEN
        ALTER TABLE matches ADD CONSTRAINT matches_bracket_type_check 
            CHECK (bracket_type IN ('winner', 'loser', 'grand_final', 'placement'));
        RAISE NOTICE '✅ Добавлено ограничение matches_bracket_type_check';
    ELSE
        RAISE NOTICE 'ℹ️ Ограничение matches_bracket_type_check уже существует';
    END IF;
END $$;

-- Добавляем индекс для оптимизации поиска
CREATE INDEX IF NOT EXISTS idx_matches_bracket_type ON matches(bracket_type);

-- Обновляем существующие матчи без типа сетки
UPDATE matches 
SET bracket_type = 'winner' 
WHERE bracket_type IS NULL;

-- Добавляем комментарий для документации
COMMENT ON COLUMN matches.bracket_type IS 'Тип матча в сетке: winner, loser, grand_final, placement'; 