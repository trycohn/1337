-- 🔧 ИСПРАВЛЕНИЕ CHECK CONSTRAINT ДЛЯ DOUBLE ELIMINATION
-- 
-- Проблема: DoubleEliminationEngine использует 'grand_final_reset', 
-- но CHECK constraint не включает это значение
--
-- Ошибка: new row for relation "matches" violates check constraint "matches_bracket_type_check"
-- 
-- Дата: 30 января 2025
-- Применить на: продакшен сервере

-- Проверяем текущий constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'matches_bracket_type_check';

-- Удаляем старый constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_bracket_type_check;

-- Добавляем обновленный constraint с поддержкой grand_final_reset
ALTER TABLE matches ADD CONSTRAINT matches_bracket_type_check
    CHECK (bracket_type IN (
        'winner', 
        'loser', 
        'grand_final', 
        'grand_final_reset',  -- 🆕 Добавлено для Double Elimination
        'placement', 
        'final', 
        'semifinal'
    ));

-- Проверяем что constraint обновлен
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'matches_bracket_type_check';

-- Выводим подтверждение
SELECT '✅ CHECK constraint обновлен для поддержки Double Elimination (grand_final_reset)' AS status; 