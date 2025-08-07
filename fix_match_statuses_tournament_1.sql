-- ===============================================
-- ИСПРАВЛЕНИЕ СТАТУСОВ МАТЧЕЙ В ТУРНИРЕ ID=1
-- ===============================================
-- 
-- Проблема: Матчи имеют статус 'pending', но при этом есть победители
-- Решение: Обновить статус всех матчей с победителями на 'completed'

-- ШАГ 1: Проверка текущего состояния
SELECT 
    'Текущее состояние' as info,
    COUNT(*) as total_matches,
    COUNT(CASE WHEN winner_team_id IS NOT NULL THEN 1 END) as matches_with_winner,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_status,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_status
FROM matches 
WHERE tournament_id = 1;

-- ШАГ 2: Показать проблемные матчи
SELECT 
    match_number,
    status,
    winner_team_id,
    score1,
    score2,
    bracket_type,
    round_name
FROM matches 
WHERE tournament_id = 1 
    AND winner_team_id IS NOT NULL 
    AND status = 'pending'
ORDER BY match_number;

-- ШАГ 3: Исправление статусов
UPDATE matches 
SET 
    status = 'completed'
WHERE tournament_id = 1 
    AND winner_team_id IS NOT NULL 
    AND status = 'pending';

-- ШАГ 4: Проверка результата
SELECT 
    'После исправления' as info,
    COUNT(*) as total_matches,
    COUNT(CASE WHEN winner_team_id IS NOT NULL THEN 1 END) as matches_with_winner,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_status,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_status
FROM matches 
WHERE tournament_id = 1;

-- ШАГ 5: Показать финальный результат
SELECT 
    match_number,
    status,
    COALESCE(t1.name, 'BYE') as team1,
    COALESCE(t2.name, 'BYE') as team2,
    score1,
    score2,
    COALESCE(tw.name, 'Нет победителя') as winner,
    bracket_type,
    round_name
FROM matches m
LEFT JOIN tournament_teams t1 ON m.team1_id = t1.id
LEFT JOIN tournament_teams t2 ON m.team2_id = t2.id  
LEFT JOIN tournament_teams tw ON m.winner_team_id = tw.id
WHERE m.tournament_id = 1
ORDER BY m.match_number;