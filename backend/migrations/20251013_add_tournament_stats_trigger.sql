-- ============================================================================
-- ТРИГГЕР: Автоматическое обновление статистики турнира при добавлении
--          статистики игрока в матче
-- Версия: 1.0.0
-- Дата: 13 октября 2025
-- Описание: Опциональная оптимизация для автоматического инкрементального
--           обновления статистики турнира после каждого матча
-- ============================================================================

-- ⚠️ ВНИМАНИЕ: Этот триггер опционален! 
-- Основная логика обновления реализована в TournamentStatsService.updateStatsAfterMatch()
-- Триггер может использоваться для дополнительной автоматизации, но не обязателен

-- ============================================================================
-- ФУНКЦИЯ: Автоматическое обновление статистики турнира
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_update_tournament_player_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_tournament_id INTEGER;
    v_user_id INTEGER;
    v_rounds_played INTEGER;
    v_is_winner BOOLEAN;
BEGIN
    -- Получаем tournament_id из матча
    SELECT tournament_id INTO v_tournament_id
    FROM matches
    WHERE id = NEW.match_id;

    IF v_tournament_id IS NULL THEN
        RAISE NOTICE 'Match % not found or has no tournament_id', NEW.match_id;
        RETURN NEW;
    END IF;

    -- Получаем user_id (если есть)
    v_user_id := NEW.user_id;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'player_match_stats record % has no user_id, skipping', NEW.id;
        RETURN NEW;
    END IF;

    -- Получаем количество раундов (примерное)
    v_rounds_played := COALESCE(NEW.rounds_played, 0);
    IF v_rounds_played = 0 THEN
        -- Пытаемся рассчитать из суммы убийств и смертей (приблизительно)
        v_rounds_played := GREATEST(NEW.kills + NEW.deaths, 1);
    END IF;

    -- Определяем победу (требует дополнительной логики)
    -- Пока используем простое определение: если есть winner_team_id в матче
    v_is_winner := FALSE;  -- Будет установлено через сервис

    -- Инкрементальное обновление статистики игрока в турнире
    INSERT INTO tournament_player_stats (
        tournament_id, user_id, steam_id,
        matches_played, rounds_played, wins, losses,
        total_kills, total_deaths, total_assists,
        total_headshot_kills, total_damage,
        shots_fired, shots_on_target,
        clutch_1v1_attempts, clutch_1v1_won,
        clutch_1v2_attempts, clutch_1v2_won,
        entry_attempts, entry_wins,
        utility_damage, enemies_flashed, flash_assists,
        enemy_5ks, enemy_4ks, enemy_3ks, enemy_2ks,
        total_money_earned, total_equipment_value,
        updated_at
    )
    VALUES (
        v_tournament_id, v_user_id, NEW.steam_id,
        1, v_rounds_played, 0, 0,
        COALESCE(NEW.kills, 0), COALESCE(NEW.deaths, 0), COALESCE(NEW.assists, 0),
        COALESCE(NEW.head_shot_kills, 0), COALESCE(NEW.damage_dealt, 0),
        COALESCE(NEW.shots_fired_total, 0), COALESCE(NEW.shots_on_target_total, 0),
        COALESCE(NEW.v1_count, 0), COALESCE(NEW.v1_wins, 0),
        COALESCE(NEW.v2_count, 0), COALESCE(NEW.v2_wins, 0),
        COALESCE(NEW.entry_count, 0), COALESCE(NEW.entry_wins, 0),
        COALESCE(NEW.utility_damage, 0), COALESCE(NEW.enemies_flashed, 0), COALESCE(NEW.flash_assists, 0),
        COALESCE(NEW.enemy_5ks, 0), COALESCE(NEW.enemy_4ks, 0), COALESCE(NEW.enemy_3ks, 0), COALESCE(NEW.enemy_2ks, 0),
        COALESCE(NEW.cash_earned, 0), COALESCE(NEW.equipment_value, 0),
        NOW()
    )
    ON CONFLICT (tournament_id, user_id)
    DO UPDATE SET
        matches_played = tournament_player_stats.matches_played + 1,
        rounds_played = tournament_player_stats.rounds_played + EXCLUDED.rounds_played,
        total_kills = tournament_player_stats.total_kills + EXCLUDED.total_kills,
        total_deaths = tournament_player_stats.total_deaths + EXCLUDED.total_deaths,
        total_assists = tournament_player_stats.total_assists + EXCLUDED.total_assists,
        total_headshot_kills = tournament_player_stats.total_headshot_kills + EXCLUDED.total_headshot_kills,
        total_damage = tournament_player_stats.total_damage + EXCLUDED.total_damage,
        shots_fired = tournament_player_stats.shots_fired + EXCLUDED.shots_fired,
        shots_on_target = tournament_player_stats.shots_on_target + EXCLUDED.shots_on_target,
        clutch_1v1_attempts = tournament_player_stats.clutch_1v1_attempts + EXCLUDED.clutch_1v1_attempts,
        clutch_1v1_won = tournament_player_stats.clutch_1v1_won + EXCLUDED.clutch_1v1_won,
        clutch_1v2_attempts = tournament_player_stats.clutch_1v2_attempts + EXCLUDED.clutch_1v2_attempts,
        clutch_1v2_won = tournament_player_stats.clutch_1v2_won + EXCLUDED.clutch_1v2_won,
        entry_attempts = tournament_player_stats.entry_attempts + EXCLUDED.entry_attempts,
        entry_wins = tournament_player_stats.entry_wins + EXCLUDED.entry_wins,
        utility_damage = tournament_player_stats.utility_damage + EXCLUDED.utility_damage,
        enemies_flashed = tournament_player_stats.enemies_flashed + EXCLUDED.enemies_flashed,
        flash_assists = tournament_player_stats.flash_assists + EXCLUDED.flash_assists,
        enemy_5ks = tournament_player_stats.enemy_5ks + EXCLUDED.enemy_5ks,
        enemy_4ks = tournament_player_stats.enemy_4ks + EXCLUDED.enemy_4ks,
        enemy_3ks = tournament_player_stats.enemy_3ks + EXCLUDED.enemy_3ks,
        enemy_2ks = tournament_player_stats.enemy_2ks + EXCLUDED.enemy_2ks,
        total_money_earned = tournament_player_stats.total_money_earned + EXCLUDED.total_money_earned,
        total_equipment_value = tournament_player_stats.total_equipment_value + EXCLUDED.total_equipment_value,
        updated_at = NOW();

    -- Пересчитываем производные метрики
    UPDATE tournament_player_stats
    SET 
        kd_ratio = CASE 
            WHEN total_deaths > 0 THEN ROUND(total_kills::DECIMAL / total_deaths, 2)
            ELSE total_kills::DECIMAL
        END,
        hs_percentage = CASE 
            WHEN total_kills > 0 THEN ROUND((total_headshot_kills::DECIMAL / total_kills) * 100, 2)
            ELSE 0
        END,
        accuracy = CASE 
            WHEN shots_fired > 0 THEN ROUND((shots_on_target::DECIMAL / shots_fired) * 100, 2)
            ELSE 0
        END,
        avg_adr = CASE 
            WHEN rounds_played > 0 THEN ROUND(total_damage::DECIMAL / rounds_played, 2)
            ELSE 0
        END,
        clutch_1v1_rate = CASE 
            WHEN clutch_1v1_attempts > 0 THEN ROUND((clutch_1v1_won::DECIMAL / clutch_1v1_attempts) * 100, 2)
            ELSE 0
        END,
        clutch_1v2_rate = CASE 
            WHEN clutch_1v2_attempts > 0 THEN ROUND((clutch_1v2_won::DECIMAL / clutch_1v2_attempts) * 100, 2)
            ELSE 0
        END,
        entry_success_rate = CASE 
            WHEN entry_attempts > 0 THEN ROUND((entry_wins::DECIMAL / entry_attempts) * 100, 2)
            ELSE 0
        END
    WHERE tournament_id = v_tournament_id AND user_id = v_user_id;

    RAISE NOTICE 'Updated tournament stats for user % in tournament %', v_user_id, v_tournament_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- СОЗДАНИЕ ТРИГГЕРА (ОТКЛЮЧЕН ПО УМОЛЧАНИЮ)
-- ============================================================================

-- ⚠️ ВНИМАНИЕ: Триггер отключен по умолчанию!
-- Раскомментируйте следующие строки для включения автоматического обновления

/*
DROP TRIGGER IF EXISTS trg_auto_update_tournament_stats ON player_match_stats;

CREATE TRIGGER trg_auto_update_tournament_stats
AFTER INSERT ON player_match_stats
FOR EACH ROW
EXECUTE FUNCTION auto_update_tournament_player_stats();

COMMENT ON TRIGGER trg_auto_update_tournament_stats ON player_match_stats IS 
'Автоматическое инкрементальное обновление статистики турнира после добавления статистики игрока в матче';
*/

-- ============================================================================
-- КОММЕНТАРИИ
-- ============================================================================
COMMENT ON FUNCTION auto_update_tournament_player_stats() IS 
'Функция для автоматического инкрементального обновления статистики турнира. 
Вызывается триггером после вставки записи в player_match_stats.
⚠️ Триггер отключен по умолчанию, основная логика в TournamentStatsService.';

-- ============================================================================
-- МИГРАЦИЯ: Завершено
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Миграция 20251013_add_tournament_stats_trigger завершена';
    RAISE NOTICE '📊 Создана функция auto_update_tournament_player_stats()';
    RAISE NOTICE '⚠️ Триггер НЕ активирован (комментарий в файле миграции)';
    RAISE NOTICE '💡 Основная логика обновления: TournamentStatsService.updateStatsAfterMatch()';
END $$;

