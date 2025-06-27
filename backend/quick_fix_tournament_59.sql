-- Быстрое исправление турнира 59
-- Проблема: матч 1615 переполнен - 3 входящих матча в 2 позиции

-- 1. Диагностика текущей ситуации
SELECT 
    id, round, match_number, team1_id, team2_id, winner_team_id, 
    next_match_id, status
FROM matches 
WHERE tournament_id = 59 
ORDER BY round, match_number;

-- 2. БЫСТРОЕ РЕШЕНИЕ: Очищаем переполненный матч 1615
UPDATE matches 
SET team1_id = NULL, team2_id = NULL, winner_team_id = NULL, 
    score1 = NULL, score2 = NULL, maps_data = NULL
WHERE id = 1615;

-- 3. Размещаем только команду 372 (победитель матча 1612) в team1
-- Оставляем team2 пустым для будущего победителя
UPDATE matches 
SET team1_id = 372
WHERE id = 1615;

-- 4. Проверяем результат
SELECT 
    id, round, match_number, team1_id, team2_id, winner_team_id, 
    next_match_id, status
FROM matches 
WHERE tournament_id = 59 AND id IN (1612, 1613, 1614, 1615, 1616, 1617)
ORDER BY round, match_number;

-- 5. Проверяем связи next_match_id
SELECT 
    m1.id as source_match,
    m1.winner_team_id as source_winner,
    m1.next_match_id,
    m2.id as target_match,
    m2.team1_id as target_team1,
    m2.team2_id as target_team2
FROM matches m1
LEFT JOIN matches m2 ON m1.next_match_id = m2.id
WHERE m1.tournament_id = 59 AND m1.next_match_id IS NOT NULL
ORDER BY m1.round, m1.match_number; 