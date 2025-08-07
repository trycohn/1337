-- ===============================================
-- БЫСТРОЕ ИСПРАВЛЕНИЕ РЕЗУЛЬТАТОВ ТУРНИРА ID=1
-- ===============================================

-- ШАГ 1: Исправляем статусы всех завершенных матчей
UPDATE matches 
SET status = 'completed'
WHERE tournament_id = 1 
    AND winner_team_id IS NOT NULL 
    AND status = 'pending';

-- ШАГ 2: Убеждаемся что турнир имеет статус completed
UPDATE tournaments 
SET status = 'completed'
WHERE id = 1;

-- ШАГ 3: Проверяем результат
SELECT 
    'Проверка турнира' as info,
    id,
    name,
    status,
    format
FROM tournaments 
WHERE id = 1;

-- ШАГ 4: Проверяем финальный матч
SELECT 
    'Финальный матч' as info,
    id,
    match_number,
    status,
    bracket_type,
    winner_team_id,
    team1_id,
    team2_id,
    score1,
    score2,
    round,
    round_name
FROM matches 
WHERE tournament_id = 1 
    AND bracket_type = 'grand_final';

-- ШАГ 5: Проверяем все завершенные матчи
SELECT 
    COUNT(*) as total_matches,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_matches,
    COUNT(CASE WHEN winner_team_id IS NOT NULL THEN 1 END) as matches_with_winners
FROM matches 
WHERE tournament_id = 1;