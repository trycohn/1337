-- Миграция: добавление поля bracket_type в tournaments
-- Дата: 2025-01-27
-- Описание: Добавляет поле bracket_type для выбора типа турнирной сетки

-- Добавляем поле bracket_type если его нет
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bracket_type VARCHAR(50) DEFAULT 'single_elimination';

-- Добавляем ограничение на допустимые значения (используем блок DO для проверки)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'tournaments' 
        AND constraint_name = 'tournaments_bracket_type_check'
    ) THEN
        ALTER TABLE tournaments ADD CONSTRAINT tournaments_bracket_type_check 
            CHECK (bracket_type IN ('single_elimination', 'double_elimination'));
        RAISE NOTICE '✅ Добавлено ограничение tournaments_bracket_type_check';
    ELSE
        RAISE NOTICE 'ℹ️ Ограничение tournaments_bracket_type_check уже существует';
    END IF;
END $$;

-- Добавляем индекс для оптимизации поиска
CREATE INDEX IF NOT EXISTS idx_tournaments_bracket_type ON tournaments(bracket_type);

-- Обновляем существующие турниры без типа сетки
UPDATE tournaments 
SET bracket_type = 'single_elimination' 
WHERE bracket_type IS NULL;

-- Добавляем комментарий для документации
COMMENT ON COLUMN tournaments.bracket_type IS 'Тип турнирной сетки: single_elimination или double_elimination'; 