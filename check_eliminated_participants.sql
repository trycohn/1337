-- Проверка выбывших участников в турнире 23

-- 1. Проверяем выбывших в снапшотах
SELECT 
    '🏴 ВЫБЫВШИЕ В СНАПШОТАХ' as "═══════════════════",
    round_number as "Раунд",
    jsonb_array_length(COALESCE(snapshot->'meta'->'eliminated', '[]'::jsonb)) as "Кол-во выбывших",
    snapshot->'meta'->'eliminated' as "Список выбывших"
FROM full_mix_snapshots
WHERE tournament_id = 23
ORDER BY round_number;

-- 2. Проигравшие команды (должны выбыть)
SELECT 
    '❌ ПРОИГРАВШИЕ КОМАНДЫ' as "═══════════════════",
    m.round as "Раунд",
    m.id as "ID матча",
    CASE 
        WHEN m.winner_team_id = m.team1_id THEN tt2.name
        WHEN m.winner_team_id = m.team2_id THEN tt1.name
        ELSE 'Нет победителя'
    END as "Проигравшая команда",
    CASE 
        WHEN m.winner_team_id = m.team1_id THEN m.team2_id
        WHEN m.winner_team_id = m.team2_id THEN m.team1_id
        ELSE NULL
    END as "ID проигравшей"
FROM matches m
LEFT JOIN tournament_teams tt1 ON tt1.id = m.team1_id
LEFT JOIN tournament_teams tt2 ON tt2.id = m.team2_id
WHERE m.tournament_id = 23 AND m.winner_team_id IS NOT NULL
ORDER BY m.round, m.id;

-- 3. Участники проигравших команд (должны быть в eliminated)
SELECT 
    '👥 УЧАСТНИКИ ПРОИГРАВШИХ' as "═══════════════════",
    ttm.team_id as "ID команды",
    tt.name as "Команда",
    ttm.participant_id as "ID участника",
    COALESCE(u.username, tp.name) as "Имя",
    ttm.user_id as "User ID"
FROM tournament_team_members ttm
JOIN tournament_teams tt ON tt.id = ttm.team_id
LEFT JOIN users u ON u.id = ttm.user_id
LEFT JOIN tournament_participants tp ON tp.id = ttm.participant_id
WHERE ttm.team_id IN (
    SELECT 
        CASE 
            WHEN m.winner_team_id = m.team1_id THEN m.team2_id
            WHEN m.winner_team_id = m.team2_id THEN m.team1_id
        END as loser_team_id
    FROM matches m
    WHERE m.tournament_id = 23 AND m.winner_team_id IS NOT NULL AND m.round = 1
)
ORDER BY ttm.team_id;

-- 4. Все участники турнира
SELECT 
    '👤 ВСЕ УЧАСТНИКИ' as "═══════════════════",
    COUNT(*)::int as "Всего участников"
FROM tournament_participants
WHERE tournament_id = 23;

-- 5. Рекомендация
DO $$
DECLARE
    eliminated_count INT;
    losers_team_count INT;
    losers_player_count INT;
BEGIN
    -- Считаем выбывших в снапшотах
    SELECT COALESCE(
        jsonb_array_length(
            (SELECT snapshot->'meta'->'eliminated' 
             FROM full_mix_snapshots 
             WHERE tournament_id = 23 
             ORDER BY round_number DESC LIMIT 1)
        ),
        0
    ) INTO eliminated_count;
    
    -- Считаем проигравшие команды
    SELECT COUNT(DISTINCT 
        CASE 
            WHEN m.winner_team_id = m.team1_id THEN m.team2_id
            WHEN m.winner_team_id = m.team2_id THEN m.team1_id
        END
    )::INT INTO losers_team_count
    FROM matches m
    WHERE m.tournament_id = 23 AND m.winner_team_id IS NOT NULL AND m.round = 1;
    
    -- Считаем участников проигравших команд
    SELECT COUNT(*)::INT INTO losers_player_count
    FROM tournament_team_members ttm
    WHERE ttm.team_id IN (
        SELECT 
            CASE 
                WHEN m.winner_team_id = m.team1_id THEN m.team2_id
                WHEN m.winner_team_id = m.team2_id THEN m.team1_id
            END
        FROM matches m
        WHERE m.tournament_id = 23 AND m.winner_team_id IS NOT NULL AND m.round = 1
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '💡 АНАЛИЗ ВЫБЫВШИХ';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '🏴 В снапшотах помечено выбывших: %', eliminated_count;
    RAISE NOTICE '❌ Проигравших команд в раунде 1: %', losers_team_count;
    RAISE NOTICE '👥 Участников проигравших команд: %', losers_player_count;
    RAISE NOTICE '';
    
    IF eliminated_count < losers_player_count THEN
        RAISE NOTICE '⚠️  ПРОБЛЕМА: Не все выбывшие помечены в снапшотах!';
        RAISE NOTICE '    Ожидалось: %, Фактически: %', losers_player_count, eliminated_count;
        RAISE NOTICE '';
        RAISE NOTICE '🔧 РЕШЕНИЕ:';
        RAISE NOTICE '    1. Проверьте логи backend при сохранении результатов матчей';
        RAISE NOTICE '    2. Перезапустите backend с новым кодом';
        RAISE NOTICE '    3. Или вручную добавьте выбывших в снапшот';
    ELSE
        RAISE NOTICE '✅ Выбывшие корректно помечены';
    END IF;
    RAISE NOTICE '';
END
$$;

