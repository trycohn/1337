-- Добавляем флаг скрытого турнира и расширяем список типов сеток (добавляем 'swiss')

-- 1) Скрытые турниры
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_tournaments_is_hidden ON tournaments(is_hidden);

-- 2) Расширяем ограничение типов сетки турнира
DO $$
BEGIN
    -- Удаляем старое ограничение, если оно существует
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'tournaments' 
          AND constraint_name = 'tournaments_bracket_type_check'
    ) THEN
        ALTER TABLE tournaments DROP CONSTRAINT tournaments_bracket_type_check;
    END IF;

    -- Добавляем новое ограничение с поддержкой 'swiss'
    ALTER TABLE tournaments ADD CONSTRAINT tournaments_bracket_type_check 
        CHECK (bracket_type IN ('single_elimination', 'double_elimination', 'swiss'));
END $$;

COMMENT ON COLUMN tournaments.is_hidden IS 'Флаг скрытого турнира (не отображается в публичных списках)';

