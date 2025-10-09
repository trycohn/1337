-- Очистка таблиц matchzy для полного реимпорта с правильными Steam ID
-- Выполнить на VDS через psql или PgAdmin

BEGIN;

-- Удаляем player_match_stats, связанные с матчами из matchzy
DELETE FROM player_match_stats 
WHERE match_id IN (SELECT our_match_id FROM matchzy_matches WHERE our_match_id IS NOT NULL);

-- Очищаем таблицы matchzy
TRUNCATE TABLE matchzy_players CASCADE;
TRUNCATE TABLE matchzy_maps CASCADE;
TRUNCATE TABLE matchzy_matches CASCADE;
TRUNCATE TABLE matchzy_pickban_steps CASCADE;

COMMIT;

-- После выполнения этого скрипта:
-- 1. Перезапустить backend на VDS (чтобы применить изменения в коде)
-- 2. Подождать ~30 секунд - matchzy polling автоматически реимпортирует матчи
-- 3. Проверить: SELECT matchid, steamid64, name FROM matchzy_players LIMIT 10;

