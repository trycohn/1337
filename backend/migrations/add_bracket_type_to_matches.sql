-- Миграция: добавление поля bracket_type в matches
-- Дата: 2025-01-15 (обновлено 2025-01-29)
-- Описание: Добавляет поле bracket_type для матчей турнирной сетки

-- Добавляем поле bracket_type если его нет
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket_type VARCHAR(20) DEFAULT 'winner';

-- 🆕 Обновляем ограничение на допустимые значения (добавляем 'final' для финальных матчей)
DO $$
BEGIN
    -- Удаляем старое ограничение если существует
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'matches' 
        AND constraint_name = 'matches_bracket_type_check'
    ) THEN
        ALTER TABLE matches DROP CONSTRAINT matches_bracket_type_check;
        RAISE NOTICE '🔄 Удалено старое ограничение matches_bracket_type_check';
    END IF;
    
    -- Добавляем обновленное ограничение с поддержкой 'final'
    ALTER TABLE matches ADD CONSTRAINT matches_bracket_type_check 
        CHECK (bracket_type IN ('winner', 'loser', 'grand_final', 'placement', 'final'));
    RAISE NOTICE '✅ Добавлено обновленное ограничение matches_bracket_type_check с поддержкой final';
END $$;

-- Добавляем индекс для оптимизации поиска
CREATE INDEX IF NOT EXISTS idx_matches_bracket_type ON matches(bracket_type);

-- Обновляем существующие матчи без типа сетки
UPDATE matches 
SET bracket_type = 'winner' 
WHERE bracket_type IS NULL;

-- 🆕 Обновляем комментарий для документации
COMMENT ON COLUMN matches.bracket_type IS 'Тип матча в сетке: winner, loser, grand_final, placement, final (за 1-е место)'; 