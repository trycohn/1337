-- ============================================================================
-- СКРИПТ: Пересчет MVP для существующих матчей
-- Дата: 13 октября 2025
-- Описание: Применяет формулу MVP к уже сыгранным турнирным и кастомным матчам
-- ============================================================================

-- ВНИМАНИЕ: Этот скрипт НЕ запускается автоматически!
-- Он предназначен для ручного выполнения через Node.js скрипт или Query Tool

DO $$
DECLARE
    v_match RECORD;
    v_player RECORD;
    v_map RECORD;
    v_rounds INTEGER;
    v_K INTEGER;
    v_D INTEGER;
    v_A INTEGER;
    v_DMG INTEGER;
    v_EK INTEGER;
    v_TK INTEGER := 0;
    v_C1 INTEGER;
    v_C2 INTEGER;
    v_MK2 INTEGER;
    v_MK3 INTEGER;
    v_MK4 INTEGER;
    v_MK5 INTEGER;
    v_MV INTEGER := 0;
    v_S_base DECIMAL(10,4);
    v_S_impact DECIMAL(10,4);
    v_S_obj DECIMAL(10,4);
    v_mvp_score DECIMAL(10,4);
    v_impact_per_round DECIMAL(10,4);
    v_clutch_score_per_round DECIMAL(10,4);
    v_adr DECIMAL(10,4);
    v_deaths_per_round DECIMAL(10,4);
    v_user_id INTEGER;
    v_processed_count INTEGER := 0;
    v_players_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🏆 [MVP Recalculator] Начинаем пересчет MVP для существующих матчей...';
    
    -- Очищаем таблицу перед пересчетом
    DELETE FROM match_player_mvp;
    RAISE NOTICE '🗑️ Старые данные удалены';
    
    -- Находим все матчи с импортированной статистикой
    FOR v_match IN 
        SELECT DISTINCT
            mm.matchid,
            mm.our_match_id
        FROM matchzy_matches mm
        JOIN matches m ON m.id = mm.our_match_id
        WHERE mm.our_match_id IS NOT NULL
          AND m.source_type IN ('tournament', 'custom')
          AND EXISTS (
              SELECT 1 FROM matchzy_players mp 
              WHERE mp.matchid = mm.matchid
          )
        ORDER BY mm.matchid
    LOOP
        RAISE NOTICE '📊 Обрабатываем matchid=%', v_match.matchid;
        
        -- Обрабатываем каждую карту матча
        FOR v_map IN
            SELECT 
                mapnumber,
                team1_score + team2_score as rounds_played
            FROM matchzy_maps
            WHERE matchid = v_match.matchid
            ORDER BY mapnumber
        LOOP
            v_rounds := GREATEST(v_map.rounds_played, 1);
            
            -- Обрабатываем каждого игрока на карте
            FOR v_player IN
                SELECT 
                    steamid64,
                    name,
                    kills,
                    deaths,
                    assists,
                    damage,
                    entry_wins,
                    v1_wins,
                    v2_wins,
                    enemy2ks,
                    enemy3ks,
                    enemy4ks,
                    enemy5ks
                FROM matchzy_players
                WHERE matchid = v_match.matchid
                  AND mapnumber = v_map.mapnumber
            LOOP
                -- Извлекаем данные
                v_K := COALESCE(v_player.kills, 0);
                v_D := COALESCE(v_player.deaths, 0);
                v_A := COALESCE(v_player.assists, 0);
                v_DMG := COALESCE(v_player.damage, 0);
                v_EK := COALESCE(v_player.entry_wins, 0);
                v_C1 := COALESCE(v_player.v1_wins, 0);
                v_C2 := COALESCE(v_player.v2_wins, 0);
                v_MK2 := COALESCE(v_player.enemy2ks, 0);
                v_MK3 := COALESCE(v_player.enemy3ks, 0);
                v_MK4 := COALESCE(v_player.enemy4ks, 0);
                v_MK5 := COALESCE(v_player.enemy5ks, 0);
                
                -- Рассчитываем формулу
                v_S_base := 1.8 * v_K - 1.0 * v_D + 0.6 * v_A + v_DMG / 25.0;
                v_S_impact := 1.5 * v_EK + 1.0 * v_TK + 3 * v_C1 + 5 * v_C2 
                            + 0.5 * v_MK2 + 1.2 * v_MK3 + 2.5 * v_MK4 + 4.0 * v_MK5;
                v_S_obj := 2.0 * v_MV;
                
                v_mvp_score := (v_S_base + v_S_impact + v_S_obj) / GREATEST(v_rounds, 1);
                
                -- Метрики для тай-брейков
                v_impact_per_round := v_S_impact / GREATEST(v_rounds, 1);
                v_clutch_score_per_round := (3 * v_C1 + 5 * v_C2) / GREATEST(v_rounds, 1);
                v_adr := v_DMG::DECIMAL / GREATEST(v_rounds, 1);
                v_deaths_per_round := v_D::DECIMAL / GREATEST(v_rounds, 1);
                
                -- Получаем user_id
                SELECT id INTO v_user_id
                FROM users
                WHERE steam_id = v_player.steamid64::TEXT;
                
                -- Сохраняем в таблицу
                INSERT INTO match_player_mvp (
                    matchzy_matchid, our_match_id, steamid64, user_id, mapnumber,
                    s_base, s_impact, s_obj, mvp_score,
                    rounds_played, impact_per_round, clutch_score_per_round, adr, deaths_per_round,
                    calculated_at
                ) VALUES (
                    v_match.matchid,
                    v_match.our_match_id,
                    v_player.steamid64,
                    v_user_id,
                    v_map.mapnumber,
                    v_S_base,
                    v_S_impact,
                    v_S_obj,
                    v_mvp_score,
                    v_rounds,
                    v_impact_per_round,
                    v_clutch_score_per_round,
                    v_adr,
                    v_deaths_per_round,
                    NOW()
                );
                
                v_players_count := v_players_count + 1;
            END LOOP;
        END LOOP;
        
        v_processed_count := v_processed_count + 1;
        
        -- Логируем каждые 10 матчей
        IF v_processed_count % 10 = 0 THEN
            RAISE NOTICE '✅ Обработано % матчей...', v_processed_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ ============================================';
    RAISE NOTICE '✅ Пересчет завершен!';
    RAISE NOTICE '✅ Обработано матчей: %', v_processed_count;
    RAISE NOTICE '✅ Обработано игроков: %', v_players_count;
    RAISE NOTICE '✅ ============================================';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '❌ Ошибка пересчета MVP: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- Показываем топ-5 MVP по всем матчам
SELECT 
    u.username,
    mp.name as ingame_name,
    mvp.mvp_score,
    mvp.s_base,
    mvp.s_impact,
    mvp.our_match_id as match_id,
    mvp.mapnumber
FROM match_player_mvp mvp
LEFT JOIN users u ON u.id = mvp.user_id
LEFT JOIN matchzy_players mp 
    ON mp.matchid = mvp.matchzy_matchid 
    AND mp.mapnumber = mvp.mapnumber 
    AND mp.steamid64 = mvp.steamid64
ORDER BY mvp.mvp_score DESC
LIMIT 5;

