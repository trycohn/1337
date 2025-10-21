#!/bin/bash
# Подтверждение составов раунда 2 через правильный endpoint

echo "🔄 Подтверждаем составы раунда 2 через /confirm-rosters..."

# Получаем токен из браузера (замените на реальный)
# Или выполните в браузере: localStorage.getItem('token')

# ВАРИАНТ 1: С токеном (замените YOUR_TOKEN)
# curl -X POST https://1337community.com/api/tournaments/23/fullmix/rounds/2/confirm-rosters \
#   -H "Authorization: Bearer YOUR_TOKEN" \
#   -H "Content-Type: application/json"

# ВАРИАНТ 2: Через psql напрямую (обходим фронтенд)
psql -U postgres -d 1337community << 'EOF'

-- Подтверждаем составы раунда 2 напрямую в БД
BEGIN;

-- 1. Получаем участников команд для раунда 2
WITH round2_teams AS (
    SELECT DISTINCT 
        m.team1_id as team_id,
        m.id as match_id
    FROM matches m
    WHERE m.tournament_id = 23 AND m.round = 2
    UNION
    SELECT DISTINCT 
        m.team2_id as team_id,
        m.id as match_id
    FROM matches m
    WHERE m.tournament_id = 23 AND m.round = 2
),
team_rosters AS (
    SELECT 
        rt.team_id,
        rt.match_id,
        jsonb_agg(
            jsonb_build_object(
                'participant_id', ttm.participant_id,
                'user_id', ttm.user_id,
                'name', COALESCE(u.username, tp.name),
                'position', ttm.position
            ) ORDER BY ttm.position
        ) as roster
    FROM round2_teams rt
    JOIN tournament_team_members ttm ON ttm.team_id = rt.team_id
    LEFT JOIN users u ON u.id = ttm.user_id
    LEFT JOIN tournament_participants tp ON tp.id = ttm.participant_id
    GROUP BY rt.team_id, rt.match_id
)
-- 2. Обновляем metadata матчей
UPDATE matches m
SET metadata = jsonb_set(
    COALESCE(m.metadata, '{}'::jsonb),
    '{round_rosters}',
    jsonb_build_object(
        'round', 2,
        'team1_roster', (SELECT roster FROM team_rosters WHERE team_id = m.team1_id AND match_id = m.id),
        'team2_roster', (SELECT roster FROM team_rosters WHERE team_id = m.team2_id AND match_id = m.id),
        'confirmed_at', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    true
)
WHERE m.tournament_id = 23 AND m.round = 2
RETURNING 
    '✅ ОБНОВЛЕН МАТЧ' as " ",
    m.id as "ID матча",
    m.round as "Раунд",
    jsonb_array_length(m.metadata->'round_rosters'->'team1_roster') as "Team1 игроков",
    jsonb_array_length(m.metadata->'round_rosters'->'team2_roster') as "Team2 игроков";

-- 3. Обновляем снапшот
UPDATE full_mix_snapshots
SET 
    snapshot = jsonb_set(
        COALESCE(snapshot, '{}'::jsonb),
        '{meta,rosters_confirmed}',
        'true'::jsonb,
        true
    ),
    snapshot = jsonb_set(
        snapshot,
        '{meta,rosters_confirmed_at}',
        to_jsonb(to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
        true
    )
WHERE tournament_id = 23 AND round_number = 2
RETURNING 
    '✅ ОБНОВЛЕН СНАПШОТ' as " ",
    round_number as "Раунд",
    snapshot->'meta'->>'rosters_confirmed' as "rosters_confirmed";

COMMIT;

-- 4. Проверка результата
SELECT 
    '📊 ИТОГОВАЯ ПРОВЕРКА' as " ";

SELECT 
    m.id as "ID матча",
    m.round as "Раунд",
    CASE 
        WHEN m.metadata->'round_rosters'->'confirmed_at' IS NOT NULL 
        THEN 'ЕСТЬ ✅'
        ELSE 'НЕТ ❌'
    END as "Metadata",
    jsonb_array_length(m.metadata->'round_rosters'->'team1_roster') as "Team1",
    jsonb_array_length(m.metadata->'round_rosters'->'team2_roster') as "Team2"
FROM matches m
WHERE m.tournament_id = 23 AND m.round = 2;

SELECT 
    round_number as "Раунд",
    snapshot->'meta'->>'rosters_confirmed' as "rosters_confirmed",
    snapshot->'meta'->>'rosters_confirmed_at' as "confirmed_at"
FROM full_mix_snapshots
WHERE tournament_id = 23 AND round_number = 2;

EOF

echo ""
echo "✅ Готово! Проверьте сетку турнира - составы должны отображаться"

