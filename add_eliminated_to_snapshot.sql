-- Добавление выбывших участников в снапшот раунда 1 турнира 23

-- 1. Сначала посмотрим кто должен выбыть
WITH losers AS (
    SELECT 
        m.id as match_id,
        m.round,
        CASE 
            WHEN m.winner_team_id = m.team1_id THEN m.team2_id
            WHEN m.winner_team_id = m.team2_id THEN m.team1_id
        END as loser_team_id,
        CASE 
            WHEN m.winner_team_id = m.team1_id THEN tt2.name
            WHEN m.winner_team_id = m.team2_id THEN tt1.name
        END as loser_team_name
    FROM matches m
    LEFT JOIN tournament_teams tt1 ON tt1.id = m.team1_id
    LEFT JOIN tournament_teams tt2 ON tt2.id = m.team2_id
    WHERE m.tournament_id = 23 AND m.round = 1 AND m.winner_team_id IS NOT NULL
)
SELECT 
    '👥 УЧАСТНИКИ КОТОРЫЕ ДОЛЖНЫ ВЫБЫТЬ' as "═══════════════════",
    l.match_id as "ID матча",
    l.loser_team_name as "Команда",
    ttm.participant_id as "participant_id",
    ttm.user_id as "user_id",
    COALESCE(u.username, tp.name) as "Имя"
FROM losers l
JOIN tournament_team_members ttm ON ttm.team_id = l.loser_team_id
LEFT JOIN users u ON u.id = ttm.user_id
LEFT JOIN tournament_participants tp ON tp.id = ttm.participant_id
ORDER BY l.match_id;

-- 2. Создаем JSON массив выбывших
WITH losers AS (
    SELECT 
        m.id as match_id,
        m.round,
        CASE 
            WHEN m.winner_team_id = m.team1_id THEN m.team2_id
            WHEN m.winner_team_id = m.team2_id THEN m.team1_id
        END as loser_team_id
    FROM matches m
    WHERE m.tournament_id = 23 AND m.round = 1 AND m.winner_team_id IS NOT NULL
),
eliminated_players AS (
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'participant_id', ttm.participant_id,
                'user_id', ttm.user_id,
                'name', COALESCE(u.username, tp.name),
                'eliminated_in_round', l.round,
                'eliminated_in_match', l.match_id,
                'team_id', l.loser_team_id
            )
        ) as eliminated_json
    FROM losers l
    JOIN tournament_team_members ttm ON ttm.team_id = l.loser_team_id
    LEFT JOIN users u ON u.id = ttm.user_id
    LEFT JOIN tournament_participants tp ON tp.id = ttm.participant_id
)
-- 3. Обновляем снапшот раунда 1
UPDATE full_mix_snapshots
SET snapshot = jsonb_set(
    COALESCE(snapshot, '{}'::jsonb),
    '{meta,eliminated}',
    COALESCE((SELECT eliminated_json FROM eliminated_players), '[]'::jsonb),
    true
)
WHERE tournament_id = 23 AND round_number = 1
RETURNING 
    '✅ ОБНОВЛЕН СНАПШОТ' as " ",
    round_number as "Раунд",
    jsonb_array_length(snapshot->'meta'->'eliminated') as "Кол-во выбывших";

-- 4. Проверка результата
SELECT 
    '🏴 ВЫБЫВШИЕ В СНАПШОТЕ' as "═══════════════════",
    jsonb_array_elements(snapshot->'meta'->'eliminated')->>'name' as "Имя участника",
    (jsonb_array_elements(snapshot->'meta'->'eliminated')->>'eliminated_in_round')::int as "Раунд",
    (jsonb_array_elements(snapshot->'meta'->'eliminated')->>'team_id')::int as "ID команды"
FROM full_mix_snapshots
WHERE tournament_id = 23 AND round_number = 1;

