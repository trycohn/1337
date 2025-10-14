-- ============================================================================
-- ТЕСТОВЫЙ СКРИПТ: Начисление наград за существующие турниры
-- Использование: sudo -u postgres psql -d tournament_db -f test_award_achievements.sql
-- ============================================================================

-- Проверка наличия таблиц
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_player_stats') THEN
        RAISE EXCEPTION 'Таблица tournament_player_stats не найдена! Примените миграцию 20251013_add_tournament_stats.sql';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tournament_achievements') THEN
        RAISE EXCEPTION 'Таблица user_tournament_achievements не найдена! Примените миграцию 20251014_add_tournament_gamification.sql';
    END IF;
    
    RAISE NOTICE '✅ Все необходимые таблицы существуют';
END $$;

-- ============================================================================
-- Просмотр текущих наград
-- ============================================================================
DO $$ BEGIN RAISE NOTICE '📊 Текущая конфигурация наград:'; END $$;

SELECT 
    achievement_type as "Достижение",
    rank_1_reward as "Золото",
    rank_2_reward as "Серебро",
    rank_3_reward as "Бронза"
FROM achievement_rewards_config
ORDER BY rank_1_reward DESC;

-- ============================================================================
-- Проверка существующих достижений
-- ============================================================================
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '🏆 Турниры с достижениями:'; END $$;

SELECT 
    ta.tournament_id as "ID турнира",
    t.name as "Турнир",
    COUNT(*) as "Достижений",
    COUNT(DISTINCT ta.user_id) as "Игроков"
FROM tournament_achievements ta
LEFT JOIN tournaments t ON ta.tournament_id = t.id
GROUP BY ta.tournament_id, t.name
ORDER BY ta.tournament_id DESC
LIMIT 10;

-- ============================================================================
-- Глобальный лидерборд (топ-10)
-- ============================================================================
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '🌍 Топ-10 глобального рейтинга MVP:'; END $$;

SELECT 
    ROW_NUMBER() OVER (ORDER BY global_mvp_score DESC) as "Ранг",
    u.username as "Игрок",
    gml.total_mvp_count as "MVP",
    gml.gold_medals as "Золото",
    gml.silver_medals as "Серебро",
    gml.bronze_medals as "Бронза",
    gml.global_mvp_score as "Баллы"
FROM global_mvp_leaderboard gml
LEFT JOIN users u ON gml.user_id = u.id
WHERE gml.tournaments_played > 0
ORDER BY gml.global_mvp_score DESC
LIMIT 10;

-- ============================================================================
-- Проверка начисленных монет
-- ============================================================================
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '💰 Монеты начисленные за достижения:'; END $$;

SELECT 
    u.username as "Игрок",
    SUM(uta.coins_awarded) as "Монет",
    COUNT(*) as "Достижений"
FROM user_tournament_achievements uta
LEFT JOIN users u ON uta.user_id = u.id
GROUP BY u.username
ORDER BY SUM(uta.coins_awarded) DESC
LIMIT 10;

-- ============================================================================
-- ГОТОВО
-- ============================================================================
DO $$ 
BEGIN 
    RAISE NOTICE '';
    RAISE NOTICE '✅ Проверка завершена!';
    RAISE NOTICE '💡 Для начисления наград за турнир используйте API:';
    RAISE NOTICE '   POST /api/tournaments/:id/stats/finalize';
END $$;

