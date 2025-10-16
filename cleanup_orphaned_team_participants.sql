-- 🧹 ОЧИСТКА "ОСИРОТЕВШИХ" УЧАСТНИКОВ КОМАНДНЫХ ТУРНИРОВ
-- Удаляет записи из tournament_participants для командных турниров,
-- где пользователь не состоит ни в одной команде

-- Перед удалением смотрим, сколько таких записей есть
SELECT 
    tp.id,
    tp.tournament_id,
    tp.user_id,
    tp.name,
    t.name as tournament_name,
    t.participant_type
FROM tournament_participants tp
JOIN tournaments t ON tp.tournament_id = t.id
WHERE t.participant_type = 'team'
AND tp.user_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 
    FROM tournament_team_members ttm
    JOIN tournament_teams tt ON ttm.team_id = tt.id
    WHERE tt.tournament_id = tp.tournament_id 
    AND ttm.user_id = tp.user_id
);

-- Удаление осиротевших записей (раскомментируйте после проверки)
-- DELETE FROM tournament_participants
-- WHERE id IN (
--     SELECT tp.id
--     FROM tournament_participants tp
--     JOIN tournaments t ON tp.tournament_id = t.id
--     WHERE t.participant_type = 'team'
--     AND tp.user_id IS NOT NULL
--     AND NOT EXISTS (
--         SELECT 1 
--         FROM tournament_team_members ttm
--         JOIN tournament_teams tt ON ttm.team_id = tt.id
--         WHERE tt.tournament_id = tp.tournament_id 
--         AND ttm.user_id = tp.user_id
--     )
-- );

-- Проверка конкретного пользователя в турнире 22
SELECT 
    'Участники турнира 22:' as info;
SELECT 
    tp.id,
    tp.user_id,
    tp.name,
    tp.in_team
FROM tournament_participants tp
WHERE tp.tournament_id = 22
ORDER BY tp.id;

SELECT 
    'Команды турнира 22:' as info;
SELECT 
    tt.id,
    tt.name,
    tt.creator_id
FROM tournament_teams tt
WHERE tt.tournament_id = 22;

SELECT 
    'Участники команд турнира 22:' as info;
SELECT 
    ttm.id,
    ttm.team_id,
    ttm.user_id,
    ttm.participant_id,
    ttm.is_captain
FROM tournament_team_members ttm
JOIN tournament_teams tt ON ttm.team_id = tt.id
WHERE tt.tournament_id = 22;

