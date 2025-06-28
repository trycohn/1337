-- 🧹 БЕЗОПАСНЫЙ СКРИПТ ОЧИСТКИ ДУБЛИРУЮЩИХСЯ МАТЧЕЙ
-- ===================================================
-- 
-- ⚠️ ИНСТРУКЦИЯ:
-- 1. Сначала выполните: ROLLBACK; (если транзакция заблокирована)
-- 2. Замените tournament_id = 59 на нужный ID турнира
-- 3. Выполняйте команды по блокам (не все сразу)
-- 
-- 🔧 ВЕРСИЯ: Без транзакций для избежания блокировок

-- 📊 ШАГ 1: АНАЛИЗ ТЕКУЩЕЙ СИТУАЦИИ
-- ===============================

-- Сброс заблокированной транзакции (выполните сначала если нужно)
-- ROLLBACK;

-- Проверяем общую статистику
SELECT 
    '=== ОБЩАЯ СТАТИСТИКА ТУРНИРА 59 ===' as info,
    COUNT(*) as total_matches,
    COUNT(DISTINCT match_number) as unique_match_numbers,
    MAX(match_number) as max_match_number,
    COUNT(*) - COUNT(DISTINCT match_number) as potential_duplicates
FROM matches 
WHERE tournament_id = 59;

-- 🔍 ШАГ 2: ПОИСК ДУБЛИРУЮЩИХСЯ МАТЧЕЙ
-- ===================================

SELECT 
    '=== ДУБЛИРУЮЩИЕСЯ МАТЧИ ===' as info;

SELECT 
    tournament_id,
    match_number,
    round,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY id DESC) as match_ids,
    string_agg(DISTINCT 
        CASE 
            WHEN team1_id IS NOT NULL AND team2_id IS NOT NULL 
            THEN team1_id::text || ' vs ' || team2_id::text
            WHEN team1_id IS NOT NULL 
            THEN 'team1: ' || team1_id::text
            WHEN team2_id IS NOT NULL 
            THEN 'team2: ' || team2_id::text
            ELSE 'no teams'
        END, 
        ', '
    ) as teams_info
FROM matches 
WHERE tournament_id = 59
GROUP BY tournament_id, match_number, round, COALESCE(team1_id, -1), COALESCE(team2_id, -1)
HAVING COUNT(*) > 1
ORDER BY match_number, round;

-- 🗑️ ШАГ 3: УДАЛЕНИЕ ДУБЛЕЙ (ВЫПОЛНИТЕ ОТДЕЛЬНО!)
-- ===============================================
-- 
-- ⚠️ ВНИМАНИЕ: Выполните этот блок отдельно после анализа выше!
-- 
-- BEGIN;
-- 
-- WITH duplicates AS (
--     SELECT 
--         id,
--         ROW_NUMBER() OVER (
--             PARTITION BY tournament_id, match_number, round, COALESCE(team1_id, -1), COALESCE(team2_id, -1) 
--             ORDER BY id DESC
--         ) as rn
--     FROM matches 
--     WHERE tournament_id = 59
-- )
-- DELETE FROM matches 
-- WHERE id IN (
--     SELECT id 
--     FROM duplicates 
--     WHERE rn > 1
-- );
-- 
-- COMMIT;

-- ✅ ШАГ 4: ПРОВЕРКА РЕЗУЛЬТАТА
-- ============================

SELECT 
    '=== РЕЗУЛЬТАТ ПОСЛЕ ОЧИСТКИ ===' as info,
    COUNT(*) as remaining_matches,
    COUNT(DISTINCT match_number) as unique_match_numbers,
    MAX(match_number) as max_match_number
FROM matches 
WHERE tournament_id = 59;

-- 📋 ШАГ 5: ПРОСМОТР ОСТАВШИХСЯ МАТЧЕЙ
-- ===================================

SELECT 
    id,
    match_number,
    round,
    team1_id,
    team2_id,
    winner_team_id,
    status,
    bracket_type
FROM matches 
WHERE tournament_id = 59
ORDER BY match_number, round
LIMIT 20; -- Ограничиваем вывод для удобства

-- 🎯 ИНСТРУКЦИЯ ПО БЕЗОПАСНОМУ ИСПОЛЬЗОВАНИЮ:
-- ==========================================
-- 
-- 1. Выполните блоки 1-2 для анализа
-- 2. Если есть дубликаты, раскомментируйте и выполните блок 3
-- 3. Выполните блоки 4-5 для проверки результата
-- 
-- 🔧 При ошибке "transaction is aborted":
-- 1. Выполните: ROLLBACK;
-- 2. Начните заново с блока 1 