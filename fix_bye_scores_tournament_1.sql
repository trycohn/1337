-- ========================================
-- УСТАНОВКА СИМВОЛИЧЕСКОГО СЧЕТА ДЛЯ BYE vs BYE МАТЧЕЙ
-- ========================================

-- 🎯 ЦЕЛЬ: Установить символический счет 1:0 для завершенных BYE vs BYE матчей
-- для улучшения отображения в интерфейсе

-- ШАГ 1: АНАЛИЗ ТЕКУЩИХ BYE vs BYE МАТЧЕЙ
-- ========================================

SELECT 
    '📊 ТЕКУЩИЕ BYE vs BYE МАТЧИ:' as info,
    match_number,
    round,
    team1_id,
    team2_id,
    score1,
    score2,
    winner_team_id,
    status,
    CASE 
        WHEN score1 = 0 AND score2 = 0 AND status = 'completed' THEN '🔄 Обновить на 1:0'
        WHEN score1 = 1 AND score2 = 0 AND status = 'completed' THEN '✅ Уже корректно'
        ELSE '❓ Проверить'
    END as action_needed
FROM matches 
WHERE tournament_id = 1
    AND team1_id IS NULL 
    AND team2_id IS NULL
ORDER BY round, match_number;

-- ШАГ 2: НАЧАЛО ТРАНЗАКЦИИ
-- ========================================

BEGIN;

-- ШАГ 3: ОБНОВЛЕНИЕ СЧЕТА BYE vs BYE МАТЧЕЙ
-- ========================================

-- Устанавливаем символический счет 1:0 для BYE vs BYE матчей
UPDATE matches 
SET 
    score1 = 1,
    score2 = 0
WHERE tournament_id = 1
    AND team1_id IS NULL 
    AND team2_id IS NULL
    AND status = 'completed'
    AND (score1 = 0 AND score2 = 0);

-- Проверка количества обновленных записей
SELECT 
    '✅ ОБНОВЛЕНО BYE vs BYE МАТЧЕЙ:' as info,
    COUNT(*) as updated_matches
FROM matches 
WHERE tournament_id = 1
    AND team1_id IS NULL 
    AND team2_id IS NULL
    AND status = 'completed'
    AND score1 = 1 
    AND score2 = 0;

-- ШАГ 4: ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ========================================

-- Текущее состояние всех BYE матчей
SELECT 
    '🔍 ФИНАЛЬНОЕ СОСТОЯНИЕ BYE МАТЧЕЙ:' as section,
    match_number,
    round,
    CASE 
        WHEN team1_id IS NULL AND team2_id IS NULL THEN 'BYE vs BYE'
        WHEN team1_id IS NULL THEN 'BYE vs Команда'
        WHEN team2_id IS NULL THEN 'Команда vs BYE'
        ELSE 'Обычный матч'
    END as match_type,
    score1,
    score2,
    status,
    CASE 
        WHEN team1_id IS NULL AND team2_id IS NULL AND score1 = 1 AND score2 = 0 THEN '✅ Символический счет'
        WHEN team1_id IS NULL AND team2_id IS NULL AND score1 = 0 AND score2 = 0 THEN '❌ Нулевой счет'
        WHEN status = 'completed' THEN '✅ Завершен'
        ELSE '⏳ В процессе'
    END as display_status
FROM matches 
WHERE tournament_id = 1
    AND (team1_id IS NULL OR team2_id IS NULL)
ORDER BY round, match_number;

-- ШАГ 5: ВЛИЯНИЕ НА FRONTEND
-- ========================================

SELECT 
    '🎨 ВЛИЯНИЕ НА ОТОБРАЖЕНИЕ:' as section,
    'Символический счет 1:0 поможет frontend понять что матч завершен' as benefit1,
    'BYE vs BYE матчи будут показывать корректный статус' as benefit2,
    'Интерфейс будет отображать "✅ Завершен" вместо "⏳ Ожидание"' as benefit3,
    'Счет 1:0 является стандартным для BYE побед в спорте' as benefit4;

-- ШАГ 6: ПОДТВЕРЖДЕНИЕ ИЛИ ОТКАТ
-- ========================================

-- Раскомментируйте одну из строк ниже:
-- COMMIT;    -- ✅ Применить изменения счета
-- ROLLBACK;  -- ❌ Отменить изменения

SELECT '🎯 ВНИМАНИЕ! Раскомментируйте COMMIT или ROLLBACK выше!' as warning;

-- =========================================
-- ИНСТРУКЦИИ ПО ИСПОЛЬЗОВАНИЮ:
-- =========================================

/*
🎯 НАЗНАЧЕНИЕ:
Устанавливает символический счет 1:0 для завершенных BYE vs BYE матчей
вместо 0:0, что помогает frontend лучше понимать статус матча.

📋 ПОРЯДОК ВЫПОЛНЕНИЯ:
1. Выполните скрипт до строки BEGIN для анализа
2. Изучите какие матчи будут обновлены
3. Выполните весь скрипт
4. Проверьте результаты
5. Раскомментируйте COMMIT для применения

🎨 ОЖИДАЕМЫЙ ЭФФЕКТ:
- BYE vs BYE матчи получат счет 1:0 вместо 0:0
- Frontend будет корректно отображать их как завершенные
- Интерфейс покажет "✅ Завершен" вместо "⏳ Ожидание"

⚠️ БЕЗОПАСНОСТЬ:
- Изменения касаются только BYE vs BYE матчей
- Обычные матчи не затрагиваются
- Возможен откат через ROLLBACK
*/