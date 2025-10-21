-- Сброс флага подтверждения раунда 2 для повторного подтверждения

-- 1. Проверяем текущее состояние
SELECT 
    '🔍 ТЕКУЩЕЕ СОСТОЯНИЕ РАУНДА 2' as " ",
    round_number as "Раунд",
    approved_teams as "approved_teams",
    approved_matches as "approved_matches",
    snapshot->'meta'->>'rosters_confirmed' as "rosters_confirmed"
FROM full_mix_snapshots
WHERE tournament_id = 23 AND round_number = 2;

-- 2. Сбрасываем флаги для повторного подтверждения
UPDATE full_mix_snapshots
SET 
    approved_teams = false,
    approved_matches = false,
    snapshot = jsonb_set(
        COALESCE(snapshot, '{}'::jsonb),
        '{meta,rosters_confirmed}',
        'false'::jsonb,
        true
    )
WHERE tournament_id = 23 AND round_number = 2
RETURNING 
    '✅ СБРОШЕНЫ ФЛАГИ' as " ",
    round_number as "Раунд",
    approved_teams as "approved_teams (после)",
    snapshot->'meta'->>'rosters_confirmed' as "rosters_confirmed (после)";

-- 3. Проверяем результат
SELECT 
    '📊 РЕЗУЛЬТАТ' as " ",
    round_number as "Раунд",
    approved_teams as "approved_teams",
    snapshot->'meta'->>'rosters_confirmed' as "rosters_confirmed"
FROM full_mix_snapshots
WHERE tournament_id = 23 AND round_number = 2;

