-- ========================================
-- ДОБАВЛЕНИЕ ОПЦИИ FULL DOUBLE ELIMINATION
-- ========================================

-- 🎯 ЦЕЛЬ: Добавить опцию "Full Double Elimination" с Grand Final Triumph
-- как настраиваемый параметр турнира

BEGIN;

-- ШАГ 1: ДОБАВЛЕНИЕ ПОЛЯ В ТАБЛИЦУ TOURNAMENTS
-- ========================================

ALTER TABLE tournaments 
ADD COLUMN full_double_elimination BOOLEAN DEFAULT false;

-- Добавляем комментарий к полю
COMMENT ON COLUMN tournaments.full_double_elimination IS 
'Включить Full Double Elimination: требует дополнительный матч (Grand Final Triumph) если участник из нижней сетки выигрывает Гранд Финал';

-- ШАГ 2: ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ ТУРНИРОВ
-- ========================================

-- Устанавливаем false для всех существующих Double Elimination турниров
-- (можно будет включить вручную если нужно)
UPDATE tournaments 
SET full_double_elimination = false 
WHERE bracket_type = 'double_elimination';

-- ШАГ 3: ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ========================================

-- Показываем структуру таблицы с новым полем
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'tournaments' 
    AND column_name IN ('bracket_type', 'full_double_elimination')
ORDER BY ordinal_position;

-- Показываем текущие турниры с новым полем
SELECT 
    id,
    name,
    bracket_type,
    full_double_elimination,
    status
FROM tournaments 
WHERE bracket_type = 'double_elimination'
ORDER BY created_at DESC
LIMIT 10;

COMMIT;

SELECT '✅ Миграция выполнена! Поле full_double_elimination добавлено в таблицу tournaments.' as result;

-- ========================================
-- ИНСТРУКЦИИ ПО ИСПОЛЬЗОВАНИЮ:
-- ========================================

/*
🎯 НАЗНАЧЕНИЕ:
Добавляет поле full_double_elimination в таблицу tournaments для управления
созданием Grand Final Triumph матча.

📋 ЛОГИКА РАБОТЫ:
- false (по умолчанию): Стандартный Double Elimination без Grand Final Triumph
- true: Full Double Elimination с Grand Final Triumph если участник из нижней сетки побеждает

🎮 ВЛИЯНИЕ НА ГЕНЕРАЦИЮ СЕТКИ:
- При full_double_elimination = false: создается только Grand Final
- При full_double_elimination = true: создается Grand Final + Grand Final Triumph

⚙️ НАСТРОЙКА:
- Опция доступна при создании турнира
- Опция доступна при генерации/перегенерации сетки
- Можно изменить в настройках существующего турнира
*/