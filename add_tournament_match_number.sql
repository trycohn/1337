-- 🆕 МИГРАЦИЯ: Добавление локальной нумерации матчей внутри турнира
-- ===============================================================
-- Добавляет поле tournament_match_number для локальной нумерации
-- матчей в рамках каждого турнира (начиная с 1)

-- 1. Добавляем новое поле
ALTER TABLE matches 
ADD COLUMN tournament_match_number INTEGER;

-- 2. Добавляем комментарий к полю
COMMENT ON COLUMN matches.tournament_match_number IS 'Номер матча внутри турнира (начинается с 1 для каждого турнира)';

-- 3. Заполняем существующие записи локальными номерами
UPDATE matches 
SET tournament_match_number = subquery.row_num
FROM (
    SELECT id, 
           ROW_NUMBER() OVER (
               PARTITION BY tournament_id 
               ORDER BY 
                   CASE bracket_type 
                       WHEN 'winner' THEN 1 
                       WHEN 'semifinal' THEN 2 
                       WHEN 'final' THEN 3 
                       WHEN 'placement' THEN 4 
                       WHEN 'loser' THEN 5 
                       WHEN 'grand_final' THEN 6 
                       WHEN 'grand_final_reset' THEN 7 
                       ELSE 8 
                   END,
                   round, 
                   match_number,
                   id
           ) as row_num
    FROM matches
) subquery
WHERE matches.id = subquery.id;

-- 4. Добавляем NOT NULL constraint (после заполнения данных)
ALTER TABLE matches 
ALTER COLUMN tournament_match_number SET NOT NULL;

-- 5. Добавляем индекс для производительности
CREATE INDEX idx_matches_tournament_match_number 
ON matches(tournament_id, tournament_match_number);

-- 6. Проверяем результат
SELECT 
    tournament_id,
    COUNT(*) as total_matches,
    MIN(tournament_match_number) as min_local_num,
    MAX(tournament_match_number) as max_local_num,
    MIN(match_number) as min_global_num,
    MAX(match_number) as max_global_num
FROM matches 
GROUP BY tournament_id 
ORDER BY tournament_id DESC 
LIMIT 5; 