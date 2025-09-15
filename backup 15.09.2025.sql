--
-- PostgreSQL database dump
--

-- Dumped from database version 14.19 (Ubuntu 14.19-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 17.2

-- Started on 2025-09-15 15:43:13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 7 (class 2615 OID 17571)
-- Name: pgagent; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA pgagent;


ALTER SCHEMA pgagent OWNER TO postgres;

--
-- TOC entry 4542 (class 0 OID 0)
-- Dependencies: 7
-- Name: SCHEMA pgagent; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA pgagent IS 'pgAgent system tables';


--
-- TOC entry 3 (class 3079 OID 33348)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- TOC entry 4544 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- TOC entry 2 (class 3079 OID 17572)
-- Name: pgagent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgagent WITH SCHEMA pgagent;


--
-- TOC entry 4545 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgagent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgagent IS 'A PostgreSQL job scheduler';


--
-- TOC entry 408 (class 1255 OID 28519)
-- Name: accept_admin_invitation(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.accept_admin_invitation(invitation_id integer, accepting_user_id integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    invitation_record RECORD;
    is_already_admin BOOLEAN;
BEGIN
    -- Проверяем существование и валидность приглашения
    SELECT * INTO invitation_record 
    FROM admin_invitations 
    WHERE id = invitation_id 
    AND invitee_id = accepting_user_id 
    AND status = 'pending' 
    AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Проверяем, не является ли уже администратором
    SELECT EXISTS(
        SELECT 1 FROM tournament_admins 
        WHERE tournament_id = invitation_record.tournament_id 
        AND user_id = accepting_user_id
    ) INTO is_already_admin;
    
    IF NOT is_already_admin THEN
        -- Добавляем в администраторы
        INSERT INTO tournament_admins (tournament_id, user_id, permissions, assigned_by)
        VALUES (
            invitation_record.tournament_id, 
            accepting_user_id, 
            invitation_record.permissions,
            invitation_record.inviter_id
        );
    END IF;
    
    -- Обновляем статус приглашения
    UPDATE admin_invitations 
    SET status = 'accepted', responded_at = NOW() 
    WHERE id = invitation_id;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION public.accept_admin_invitation(invitation_id integer, accepting_user_id integer) OWNER TO postgres;

--
-- TOC entry 370 (class 1255 OID 28316)
-- Name: auto_cleanup_expired_invitations(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_cleanup_expired_invitations() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Очищаем истекшие приглашения перед вставкой нового
    PERFORM cleanup_expired_admin_invitations();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_cleanup_expired_invitations() OWNER TO postgres;

--
-- TOC entry 406 (class 1255 OID 28660)
-- Name: auto_generate_user_referral_code(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_generate_user_referral_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Генерируем реферальный код только если его нет
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code();
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_generate_user_referral_code() OWNER TO postgres;

--
-- TOC entry 385 (class 1255 OID 27950)
-- Name: calculate_level_from_xp(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_level_from_xp(xp integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF xp < 1000 THEN
        RETURN 1;
    END IF;
    
    -- Прогрессивная система уровней: каждый следующий уровень требует больше XP
    RETURN LEAST(100, FLOOR(SQRT(xp / 1000)) + 1);
END;
$$;


ALTER FUNCTION public.calculate_level_from_xp(xp integer) OWNER TO postgres;

--
-- TOC entry 4546 (class 0 OID 0)
-- Dependencies: 385
-- Name: FUNCTION calculate_level_from_xp(xp integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.calculate_level_from_xp(xp integer) IS 'Вычисляет уровень игрока на основе накопленного XP';


--
-- TOC entry 403 (class 1255 OID 28496)
-- Name: calculate_round_name(integer, integer, boolean, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_round_name(round_number integer, total_rounds integer, is_third_place boolean DEFAULT false, is_preliminary boolean DEFAULT false) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF is_third_place THEN
        RETURN 'Матч за 3-е место';
    END IF;
    
    IF is_preliminary THEN
        RETURN 'Предварительный раунд';
    END IF;
    
    -- Для основных раундов считаем с конца
    CASE (total_rounds - round_number)
        WHEN 0 THEN RETURN 'Финал';
        WHEN 1 THEN RETURN 'Полуфинал';
        WHEN 2 THEN RETURN '1/4 финала';
        WHEN 3 THEN RETURN '1/8 финала';
        WHEN 4 THEN RETURN '1/16 финала';
        WHEN 5 THEN RETURN '1/32 финала';
        ELSE RETURN '1/' || POWER(2, total_rounds - round_number + 1)::INTEGER || ' финала';
    END CASE;
END;
$$;


ALTER FUNCTION public.calculate_round_name(round_number integer, total_rounds integer, is_third_place boolean, is_preliminary boolean) OWNER TO postgres;

--
-- TOC entry 383 (class 1255 OID 26687)
-- Name: check_achievements(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_achievements(user_id_param integer) RETURNS TABLE(unlocked_achievement_id integer, achievement_title text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    achievement_record RECORD;
    user_stats RECORD;
BEGIN
    -- Получаем статистику пользователя из существующей таблицы
    SELECT 
        COUNT(*) as tournaments_participated,
        COUNT(*) FILTER (WHERE is_winner = true) as tournaments_won,
        COALESCE(SUM(total_matches), 0) as matches_played,
        COALESCE(SUM(wins), 0) as matches_won,
        CASE 
            WHEN COALESCE(SUM(total_matches), 0) > 0 
            THEN (COALESCE(SUM(wins), 0) * 100.0 / COALESCE(SUM(total_matches), 0))
            ELSE 0 
        END as winrate,
        (SELECT COUNT(*) FROM friends WHERE user_id = user_id_param AND status = 'accepted') as friends_count
    INTO user_stats
    FROM user_tournament_stats 
    WHERE user_id = user_id_param;

    -- Проверяем каждое достижение
    FOR achievement_record IN 
        SELECT a.* FROM achievements a 
        WHERE a.is_active = true 
        AND a.id NOT IN (
            SELECT achievement_id 
            FROM user_achievements 
            WHERE user_id = user_id_param
        )
    LOOP
        -- Проверяем условие достижения
        CASE achievement_record.condition_type
            WHEN 'tournaments_participated' THEN
                IF user_stats.tournaments_participated >= achievement_record.condition_value THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
            WHEN 'tournaments_won' THEN
                IF user_stats.tournaments_won >= achievement_record.condition_value THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
            WHEN 'matches_played' THEN
                IF user_stats.matches_played >= achievement_record.condition_value THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
            WHEN 'matches_won' THEN
                IF user_stats.matches_won >= achievement_record.condition_value THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
            WHEN 'friends_count' THEN
                IF user_stats.friends_count >= achievement_record.condition_value THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
            WHEN 'winrate_threshold' THEN
                IF user_stats.winrate >= achievement_record.condition_value 
                   AND user_stats.matches_played >= 20 THEN
                    INSERT INTO user_achievements (user_id, achievement_id) 
                    VALUES (user_id_param, achievement_record.id);
                    unlocked_achievement_id := achievement_record.id;
                    achievement_title := achievement_record.title;
                    RETURN NEXT;
                END IF;
        END CASE;
    END LOOP;
END;
$$;


ALTER FUNCTION public.check_achievements(user_id_param integer) OWNER TO postgres;

--
-- TOC entry 387 (class 1255 OID 27953)
-- Name: check_and_unlock_achievements(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_and_unlock_achievements(p_user_id integer) RETURNS TABLE(achievement_id integer, achievement_name character varying, newly_unlocked boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
    achievement_record RECORD;
    user_stats user_progress%ROWTYPE;
    conditions_met BOOLEAN;
    is_unlocked BOOLEAN;
    is_new_unlock BOOLEAN;
BEGIN
    -- Получаем статистику пользователя
    SELECT * INTO user_stats FROM user_progress WHERE user_id = p_user_id;
    
    -- Если нет записи прогресса, создаем её
    IF NOT FOUND THEN
        PERFORM update_user_progress(p_user_id, 'profile_created');
        SELECT * INTO user_stats FROM user_progress WHERE user_id = p_user_id;
    END IF;
    
    -- Проверяем все активные достижения
    FOR achievement_record IN 
        SELECT a.* FROM achievements a 
        WHERE a.is_active = true
        ORDER BY a.unlock_order NULLS LAST, a.id
    LOOP
        -- Проверяем, не разблокировано ли уже
        SELECT EXISTS(
            SELECT 1 FROM user_achievements 
            WHERE user_id = p_user_id AND achievement_id = achievement_record.id
        ) INTO is_unlocked;
        
        -- Если уже разблокировано, пропускаем
        IF is_unlocked THEN
            CONTINUE;
        END IF;
        
        -- Проверяем условия достижения
        conditions_met := false;
        
        -- Примеры проверки условий (можно расширить)
        CASE achievement_record.name
            WHEN 'Первый турнир' THEN
                conditions_met := user_stats.tournaments_created >= 1;
            WHEN 'Победитель' THEN
                conditions_met := user_stats.tournaments_won >= 1;
            WHEN 'Опытный игрок' THEN
                conditions_met := user_stats.tournaments_participated >= 10;
            WHEN 'Социальная бабочка' THEN
                conditions_met := user_stats.friends_count >= 5;
            WHEN 'Болтун' THEN
                conditions_met := user_stats.messages_sent >= 100;
            WHEN 'Преданный' THEN
                conditions_met := user_stats.daily_streak_current >= 7;
            WHEN 'Марафонец' THEN
                conditions_met := user_stats.daily_streak_longest >= 30;
            WHEN 'Уровень 10' THEN
                conditions_met := user_stats.level >= 10;
            WHEN 'Мастер' THEN
                conditions_met := user_stats.level >= 50;
            WHEN 'Легенда' THEN
                conditions_met := user_stats.level >= 100;
            WHEN 'Полный профиль' THEN
                conditions_met := user_stats.profile_completion_percentage >= 100;
            WHEN 'Steam подключен' THEN
                conditions_met := user_stats.steam_connected = true;
            WHEN 'FACEIT подключен' THEN
                conditions_met := user_stats.faceit_connected = true;
            ELSE
                -- Для более сложных условий используем JSONB
                IF achievement_record.conditions IS NOT NULL THEN
                    -- Здесь можно добавить более сложную логику проверки JSONB условий
                    conditions_met := false;
                END IF;
        END CASE;
        
        -- Если условия выполнены, разблокируем достижение
        IF conditions_met THEN
            INSERT INTO user_achievements (user_id, achievement_id)
            VALUES (p_user_id, achievement_record.id);
            
            -- Добавляем XP за достижение
            UPDATE user_progress 
            SET total_xp = total_xp + achievement_record.xp_reward
            WHERE user_id = p_user_id;
            
            -- Возвращаем информацию о разблокированном достижении
            achievement_id := achievement_record.id;
            achievement_name := achievement_record.name;
            newly_unlocked := true;
            RETURN NEXT;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$;


ALTER FUNCTION public.check_and_unlock_achievements(p_user_id integer) OWNER TO postgres;

--
-- TOC entry 4547 (class 0 OID 0)
-- Dependencies: 387
-- Name: FUNCTION check_and_unlock_achievements(p_user_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.check_and_unlock_achievements(p_user_id integer) IS 'Проверяет и разблокирует новые достижения для пользователя';


--
-- TOC entry 369 (class 1255 OID 28315)
-- Name: cleanup_expired_admin_invitations(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_expired_admin_invitations() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Обновляем статус истекших приглашений
    UPDATE admin_invitations 
    SET status = 'expired'
    WHERE status = 'pending' 
      AND expires_at <= NOW();
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    -- Логируем если есть обновления
    IF affected_rows > 0 THEN
        RAISE NOTICE 'Обновлено % истекших приглашений администраторов', affected_rows;
    END IF;
    
    RETURN affected_rows;
END;
$$;


ALTER FUNCTION public.cleanup_expired_admin_invitations() OWNER TO postgres;

--
-- TOC entry 391 (class 1255 OID 28124)
-- Name: cleanup_expired_invitations(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_expired_invitations() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Обновляем статус истекших приглашений
    UPDATE admin_invitations 
    SET status = 'expired'
    WHERE status = 'pending' 
      AND expires_at <= NOW();
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    RETURN affected_rows;
END;
$$;


ALTER FUNCTION public.cleanup_expired_invitations() OWNER TO postgres;

--
-- TOC entry 414 (class 1255 OID 28663)
-- Name: cleanup_expired_referral_links(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_expired_referral_links() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM referral_links WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_expired_referral_links() OWNER TO postgres;

--
-- TOC entry 393 (class 1255 OID 28537)
-- Name: create_message_status_for_participants(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_message_status_for_participants() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Создаем статус "непрочитано" для всех участников чата, кроме отправителя
    INSERT INTO message_status (message_id, user_id, is_read)
    SELECT NEW.id, cp.user_id, false
    FROM chat_participants cp
    WHERE cp.chat_id = NEW.chat_id 
    AND cp.user_id != COALESCE(NEW.sender_id, 0);
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_message_status_for_participants() OWNER TO postgres;

--
-- TOC entry 409 (class 1255 OID 28520)
-- Name: decline_admin_invitation(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.decline_admin_invitation(invitation_id integer, declining_user_id integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Обновляем статус приглашения
    UPDATE admin_invitations 
    SET status = 'declined', responded_at = NOW() 
    WHERE id = invitation_id 
    AND invitee_id = declining_user_id 
    AND status = 'pending' 
    AND expires_at > NOW();
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION public.decline_admin_invitation(invitation_id integer, declining_user_id integer) OWNER TO postgres;

--
-- TOC entry 416 (class 1255 OID 28659)
-- Name: generate_referral_code(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_referral_code() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    code VARCHAR(20);
    exists_check INTEGER;
BEGIN
    LOOP
        -- Генерируем код из 8 символов (буквы и цифры)
        code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        
        -- Проверяем уникальность
        SELECT COUNT(*) INTO exists_check FROM users WHERE referral_code = code;
        SELECT COUNT(*) INTO exists_check FROM referral_links WHERE referral_code = code;
        
        EXIT WHEN exists_check = 0;
    END LOOP;
    
    RETURN code;
END;
$$;


ALTER FUNCTION public.generate_referral_code() OWNER TO postgres;

--
-- TOC entry 413 (class 1255 OID 28662)
-- Name: get_user_referral_stats(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_referral_stats(user_id_param integer) RETURNS TABLE(total_invitations integer, successful_registrations integer, tournament_participants integer, active_links integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE((SELECT COUNT(*) FROM referral_links WHERE user_id = user_id_param), 0)::INTEGER as total_invitations,
        COALESCE((SELECT COUNT(*) FROM referral_registrations WHERE referrer_id = user_id_param), 0)::INTEGER as successful_registrations,
        COALESCE((SELECT COUNT(*) FROM referral_registrations WHERE referrer_id = user_id_param AND participated_in_tournament = TRUE), 0)::INTEGER as tournament_participants,
        COALESCE((SELECT COUNT(*) FROM referral_links WHERE user_id = user_id_param AND expires_at > NOW()), 0)::INTEGER as active_links;
END;
$$;


ALTER FUNCTION public.get_user_referral_stats(user_id_param integer) OWNER TO postgres;

--
-- TOC entry 402 (class 1255 OID 28206)
-- Name: maintenance_cleanup(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.maintenance_cleanup() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    expired_invitations INTEGER;
    old_logs INTEGER;
    result_text TEXT;
BEGIN
    -- Очищаем истекшие приглашения
    expired_invitations := cleanup_expired_invitations();
    
    -- Удаляем старые логи (старше 1 года)
    DELETE FROM tournament_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS old_logs = ROW_COUNT;
    
    result_text := format(
        'Maintenance completed: %s expired invitations updated, %s old logs removed',
        expired_invitations,
        old_logs
    );
    
    RETURN result_text;
END;
$$;


ALTER FUNCTION public.maintenance_cleanup() OWNER TO postgres;

--
-- TOC entry 415 (class 1255 OID 29168)
-- Name: recalc_tournament_players_count(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recalc_tournament_players_count(p_tournament_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_format TEXT;
    v_players_count INTEGER := 0;
BEGIN
    SELECT format INTO v_format FROM tournaments WHERE id = p_tournament_id;

    IF v_format = 'mix' THEN
        -- TeamGenerator берет список через ParticipantRepository.getAllByTournamentId ⇒ считаем tp-строки
        SELECT COUNT(*) INTO v_players_count
        FROM tournament_participants tp
        WHERE tp.tournament_id = p_tournament_id;
    ELSE
        -- Для не-MIX оставляем классический подсчет
        SELECT COUNT(*) INTO v_players_count
        FROM tournament_participants tp
        WHERE tp.tournament_id = p_tournament_id;
    END IF;

    UPDATE tournaments t
    SET players_count = CASE WHEN t.format = 'mix' THEN v_players_count ELSE t.players_count END
    WHERE t.id = p_tournament_id;
END;
$$;


ALTER FUNCTION public.recalc_tournament_players_count(p_tournament_id integer) OWNER TO postgres;

--
-- TOC entry 392 (class 1255 OID 28193)
-- Name: send_admin_invitation_notification(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.send_admin_invitation_notification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    system_user_id INTEGER;
    tournament_record RECORD;
    private_chat_id INTEGER;
    message_text TEXT;
    existing_chat_count INTEGER;
BEGIN
    -- Получаем ID системного пользователя
    SELECT id INTO system_user_id 
    FROM users 
    WHERE username = '1337community' AND is_system_user = true
    LIMIT 1;
    
    IF system_user_id IS NULL THEN
        RAISE NOTICE 'Системный пользователь 1337community не найден';
        RETURN NEW;
    END IF;
    
    RAISE NOTICE 'Найден системный пользователь ID: %', system_user_id;
    
    -- Получаем данные о турнире и пригласившем пользователе
    SELECT 
        t.id,
        t.name as tournament_name,
        u.username as inviter_username
    INTO tournament_record
    FROM tournaments t
    JOIN users u ON NEW.inviter_id = u.id
    WHERE t.id = NEW.tournament_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Турнир с ID % не найден', NEW.tournament_id;
        RETURN NEW;
    END IF;
    
    RAISE NOTICE 'Найден турнир: % (ID: %)', tournament_record.tournament_name, tournament_record.id;
    
    -- Ищем существующий личный чат между системным пользователем и приглашаемым
    SELECT COUNT(*) INTO existing_chat_count
    FROM chats c
    WHERE c.type = 'private' 
      AND EXISTS (
          SELECT 1 FROM chat_participants cp1 
          WHERE cp1.chat_id = c.id AND cp1.user_id = system_user_id
      )
      AND EXISTS (
          SELECT 1 FROM chat_participants cp2 
          WHERE cp2.chat_id = c.id AND cp2.user_id = NEW.invitee_id
      );
    
    IF existing_chat_count > 0 THEN
        -- Находим существующий чат
        SELECT c.id INTO private_chat_id
        FROM chats c
        WHERE c.type = 'private' 
          AND EXISTS (
              SELECT 1 FROM chat_participants cp1 
              WHERE cp1.chat_id = c.id AND cp1.user_id = system_user_id
          )
          AND EXISTS (
              SELECT 1 FROM chat_participants cp2 
              WHERE cp2.chat_id = c.id AND cp2.user_id = NEW.invitee_id
          )
        LIMIT 1;
        
        RAISE NOTICE 'Используем существующий личный чат ID: %', private_chat_id;
    ELSE
        -- Создаем новый личный чат
        INSERT INTO chats (name, type, created_at)
        VALUES ('Личные сообщения', 'private', NOW())
        RETURNING id INTO private_chat_id;
        
        -- Добавляем системного пользователя в чат
        INSERT INTO chat_participants (chat_id, user_id, is_admin, joined_at)
        VALUES (private_chat_id, system_user_id, true, NOW());
        
        -- Добавляем приглашаемого пользователя в чат
        INSERT INTO chat_participants (chat_id, user_id, is_admin, joined_at)
        VALUES (private_chat_id, NEW.invitee_id, false, NOW());
        
        RAISE NOTICE 'Создан новый личный чат ID: % между пользователями % и %', 
            private_chat_id, system_user_id, NEW.invitee_id;
    END IF;
    
    -- Формируем текст сообщения
    message_text := format(
        'Приглашение в администраторы турнира!

%s приглашает вас стать администратором турнира "%s".

Вы получите права на:
- Управление участниками турнира
- Редактирование результатов матчей  
- Приглашение других администраторов

Приглашение действительно до: %s

Выберите действие:',
        tournament_record.inviter_username,
        tournament_record.tournament_name,
        TO_CHAR(NEW.expires_at AT TIME ZONE 'Europe/Moscow', 'DD.MM.YYYY HH24:MI')
    );
    
    -- Отправляем сообщение с интерактивными кнопками
    INSERT INTO messages (chat_id, sender_id, content, message_type, metadata, created_at)
    VALUES (
        private_chat_id,
        system_user_id,
        message_text,
        'admin_invitation',
        jsonb_build_object(
            'invitation_id', NEW.id,
            'tournament_id', NEW.tournament_id,
            'inviter_id', NEW.inviter_id,
            'invitee_id', NEW.invitee_id,
            'tournament_name', tournament_record.tournament_name,
            'actions', jsonb_build_array(
                jsonb_build_object(
                    'type', 'accept_admin_invitation',
                    'label', 'Принять',
                    'invitation_id', NEW.id
                ),
                jsonb_build_object(
                    'type', 'decline_admin_invitation',
                    'label', 'Отклонить', 
                    'invitation_id', NEW.id
                )
            )
        ),
        NOW()
    );
    
    RAISE NOTICE 'Отправлено личное сообщение-приглашение в чат % пользователю % (invitation_id: %)', 
        private_chat_id, NEW.invitee_id, NEW.id;
    
    RETURN NEW;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Ошибка при отправке личного приглашения: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.send_admin_invitation_notification() OWNER TO postgres;

--
-- TOC entry 410 (class 1255 OID 29169)
-- Name: trg_tp_after_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_tp_after_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM recalc_tournament_players_count(COALESCE(NEW.tournament_id, OLD.tournament_id));
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.trg_tp_after_change() OWNER TO postgres;

--
-- TOC entry 412 (class 1255 OID 29173)
-- Name: trg_tt_after_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_tt_after_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM recalc_tournament_players_count(COALESCE(NEW.tournament_id, OLD.tournament_id));
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.trg_tt_after_change() OWNER TO postgres;

--
-- TOC entry 411 (class 1255 OID 29171)
-- Name: trg_ttm_after_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_ttm_after_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tournament_id INTEGER;
BEGIN
    SELECT tt.tournament_id INTO v_tournament_id
    FROM tournament_teams tt
    WHERE tt.id = COALESCE(NEW.team_id, OLD.team_id);

    IF v_tournament_id IS NOT NULL THEN
        PERFORM recalc_tournament_players_count(v_tournament_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.trg_ttm_after_change() OWNER TO postgres;

--
-- TOC entry 388 (class 1255 OID 28516)
-- Name: update_admin_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_admin_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_admin_updated_at_column() OWNER TO postgres;

--
-- TOC entry 371 (class 1255 OID 26273)
-- Name: update_chat_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_chat_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE chats
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_chat_timestamp() OWNER TO postgres;

--
-- TOC entry 365 (class 1255 OID 26164)
-- Name: update_friends_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_friends_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_friends_updated_at() OWNER TO postgres;

--
-- TOC entry 407 (class 1255 OID 28498)
-- Name: update_match_round_names(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_match_round_names() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    max_round INTEGER;
    is_prelim BOOLEAN;
BEGIN
    -- Получаем максимальный раунд для турнира
    SELECT MAX(round) INTO max_round
    FROM matches
    WHERE tournament_id = NEW.tournament_id
    AND is_preliminary_round = FALSE;
    
    -- Определяем, является ли матч предварительным
    is_prelim := COALESCE(NEW.is_preliminary_round, FALSE);
    
    -- Обновляем название раунда
    NEW.round_name := calculate_round_name(
        NEW.round,
        max_round,
        COALESCE(NEW.is_third_place_match, FALSE),
        is_prelim
    );
    
    -- Создаем название матча
    IF NEW.is_third_place_match THEN
        NEW.match_title := 'Матч за 3-е место';
    ELSIF is_prelim THEN
        NEW.match_title := 'Предварительный раунд - Матч ' || NEW.match_number;
    ELSE
        NEW.match_title := NEW.round_name || ' - Матч ' || NEW.match_number;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_match_round_names() OWNER TO postgres;

--
-- TOC entry 342 (class 1255 OID 28670)
-- Name: update_tournaments_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_tournaments_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$;


ALTER FUNCTION public.update_tournaments_updated_at() OWNER TO postgres;

--
-- TOC entry 345 (class 1255 OID 26306)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- TOC entry 386 (class 1255 OID 27951)
-- Name: update_user_progress(integer, character varying, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_progress(p_user_id integer, p_action_type character varying, p_action_data jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_progress user_progress%ROWTYPE;
    old_level INTEGER;
    new_level INTEGER;
BEGIN
    -- Получаем текущий прогресс или создаем новый
    SELECT * INTO current_progress 
    FROM user_progress 
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO user_progress (user_id) VALUES (p_user_id);
        SELECT * INTO current_progress 
        FROM user_progress 
        WHERE user_id = p_user_id;
    END IF;
    
    old_level := current_progress.level;
    
    -- Обновляем статистику в зависимости от типа действия
    CASE p_action_type
        WHEN 'tournament_created' THEN
            UPDATE user_progress 
            SET tournaments_created = tournaments_created + 1,
                total_xp = total_xp + 100
            WHERE user_id = p_user_id;
            
        WHEN 'tournament_won' THEN
            UPDATE user_progress 
            SET tournaments_won = tournaments_won + 1,
                total_xp = total_xp + 500
            WHERE user_id = p_user_id;
            
        WHEN 'tournament_participated' THEN
            UPDATE user_progress 
            SET tournaments_participated = tournaments_participated + 1,
                total_xp = total_xp + 50
            WHERE user_id = p_user_id;
            
        WHEN 'match_won' THEN
            UPDATE user_progress 
            SET matches_won = matches_won + 1,
                total_xp = total_xp + 25
            WHERE user_id = p_user_id;
            
        WHEN 'match_lost' THEN
            UPDATE user_progress 
            SET matches_lost = matches_lost + 1,
                total_xp = total_xp + 10
            WHERE user_id = p_user_id;
            
        WHEN 'match_draw' THEN
            UPDATE user_progress 
            SET matches_draw = matches_draw + 1,
                total_xp = total_xp + 15
            WHERE user_id = p_user_id;
            
        WHEN 'friend_added' THEN
            UPDATE user_progress 
            SET friends_count = friends_count + 1,
                total_xp = total_xp + 20
            WHERE user_id = p_user_id;
            
        WHEN 'message_sent' THEN
            UPDATE user_progress 
            SET messages_sent = messages_sent + 1,
                total_xp = total_xp + 1
            WHERE user_id = p_user_id;
            
        WHEN 'daily_login' THEN
            UPDATE user_progress 
            SET daily_streak_current = CASE 
                    WHEN last_login_date = CURRENT_DATE - INTERVAL '1 day' 
                    THEN daily_streak_current + 1
                    ELSE 1
                END,
                daily_streak_longest = GREATEST(daily_streak_longest, 
                    CASE 
                        WHEN last_login_date = CURRENT_DATE - INTERVAL '1 day' 
                        THEN daily_streak_current + 1
                        ELSE 1
                    END),
                last_login_date = CURRENT_DATE,
                total_xp = total_xp + (daily_streak_current * 5)
            WHERE user_id = p_user_id;
            
        WHEN 'profile_updated' THEN
            -- Вычисляем процент заполнения профиля
            DECLARE
                completion_percentage INTEGER;
            BEGIN
                SELECT CASE 
                    WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND((COUNT(CASE WHEN 
                        (username IS NOT NULL AND username != '') OR
                        (email IS NOT NULL AND email != '') OR
                        (first_name IS NOT NULL AND first_name != '') OR
                        (last_name IS NOT NULL AND last_name != '') OR
                        (bio IS NOT NULL AND bio != '') OR
                        (avatar_url IS NOT NULL AND avatar_url != '') OR
                        (steam_id IS NOT NULL AND steam_id != '') OR
                        (faceit_username IS NOT NULL AND faceit_username != '')
                        THEN 1 END) * 100.0 / 8))
                END INTO completion_percentage
                FROM users WHERE id = p_user_id;
                
                UPDATE user_progress 
                SET profile_completion_percentage = completion_percentage,
                    total_xp = total_xp + GREATEST(0, completion_percentage - current_progress.profile_completion_percentage)
                WHERE user_id = p_user_id;
            END;
            
        WHEN 'steam_connected' THEN
            UPDATE user_progress 
            SET steam_connected = true,
                total_xp = total_xp + 100
            WHERE user_id = p_user_id;
            
        WHEN 'faceit_connected' THEN
            UPDATE user_progress 
            SET faceit_connected = true,
                total_xp = total_xp + 100
            WHERE user_id = p_user_id;
    END CASE;
    
    -- Обновляем уровень на основе нового XP
    SELECT total_xp INTO current_progress.total_xp 
    FROM user_progress WHERE user_id = p_user_id;
    
    new_level := calculate_level_from_xp(current_progress.total_xp);
    
    UPDATE user_progress 
    SET level = new_level 
    WHERE user_id = p_user_id;
    
    -- Логируем действие
    INSERT INTO achievement_action_logs (user_id, action_type, action_data)
    VALUES (p_user_id, p_action_type, p_action_data);
    
    -- Если уровень повысился, создаем специальное событие
    IF new_level > old_level THEN
        INSERT INTO achievement_action_logs (user_id, action_type, action_data)
        VALUES (p_user_id, 'level_up', jsonb_build_object('old_level', old_level, 'new_level', new_level));
    END IF;
END;
$$;


ALTER FUNCTION public.update_user_progress(p_user_id integer, p_action_type character varying, p_action_data jsonb) OWNER TO postgres;

--
-- TOC entry 4550 (class 0 OID 0)
-- Dependencies: 386
-- Name: FUNCTION update_user_progress(p_user_id integer, p_action_type character varying, p_action_data jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_user_progress(p_user_id integer, p_action_type character varying, p_action_data jsonb) IS 'Обновляет прогресс пользователя при выполнении действий';


--
-- TOC entry 379 (class 1255 OID 28408)
-- Name: update_user_teams_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_teams_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_user_teams_updated_at() OWNER TO postgres;

--
-- TOC entry 405 (class 1255 OID 28547)
-- Name: validate_seeding_config(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_seeding_config() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Валидируем структуру seeding_config в зависимости от типа
    IF NEW.seeding_type = 'ranking' THEN
        -- Для ranking должны быть указаны ratingType и direction
        IF NOT (NEW.seeding_config ? 'ratingType') THEN
            NEW.seeding_config = NEW.seeding_config || '{"ratingType": "faceit_elo"}'::jsonb;
        END IF;
        
        IF NOT (NEW.seeding_config ? 'direction') THEN
            NEW.seeding_config = NEW.seeding_config || '{"direction": "desc"}'::jsonb;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_seeding_config() OWNER TO postgres;

--
-- TOC entry 404 (class 1255 OID 28497)
-- Name: validate_single_elimination_bracket(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_single_elimination_bracket(tournament_id_param integer) RETURNS TABLE(is_valid boolean, error_message text, participants_count integer, matches_count integer, preliminary_matches integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    participant_count INTEGER;
    match_count INTEGER;
    expected_matches INTEGER;
    prelim_matches INTEGER;
BEGIN
    -- Получаем количество участников
    SELECT COUNT(*) INTO participant_count
    FROM tournament_participants tp
    WHERE tp.tournament_id = tournament_id_param;
    
    -- Получаем количество матчей
    SELECT COUNT(*) INTO match_count
    FROM matches m
    WHERE m.tournament_id = tournament_id_param;
    
    -- Получаем количество предварительных матчей
    SELECT COUNT(*) INTO prelim_matches
    FROM matches m
    WHERE m.tournament_id = tournament_id_param 
    AND m.is_preliminary_round = TRUE;
    
    -- Рассчитываем ожидаемое количество матчей
    -- В Single Elimination: N участников = N-1 матчей (+ матч за 3-е место если есть)
    expected_matches := participant_count - 1;
    
    -- Проверяем корректность
    IF participant_count < 2 THEN
        RETURN QUERY SELECT FALSE, 'Недостаточно участников (минимум 2)', participant_count, match_count, prelim_matches;
        RETURN;
    END IF;
    
    -- Возвращаем результат валидации
    RETURN QUERY SELECT 
        TRUE, 
        'Сетка корректна'::TEXT, 
        participant_count, 
        match_count, 
        prelim_matches;
END;
$$;


ALTER FUNCTION public.validate_single_elimination_bracket(tournament_id_param integer) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 297 (class 1259 OID 27912)
-- Name: achievement_action_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.achievement_action_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    action_type character varying(100) NOT NULL,
    action_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.achievement_action_logs OWNER TO postgres;

--
-- TOC entry 4551 (class 0 OID 0)
-- Dependencies: 297
-- Name: TABLE achievement_action_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.achievement_action_logs IS 'Логи всех действий пользователей для отслеживания прогресса';


--
-- TOC entry 296 (class 1259 OID 27911)
-- Name: achievement_action_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.achievement_action_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.achievement_action_logs_id_seq OWNER TO postgres;

--
-- TOC entry 4552 (class 0 OID 0)
-- Dependencies: 296
-- Name: achievement_action_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.achievement_action_logs_id_seq OWNED BY public.achievement_action_logs.id;


--
-- TOC entry 293 (class 1259 OID 27869)
-- Name: achievement_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.achievement_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(20),
    description text,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.achievement_categories OWNER TO postgres;

--
-- TOC entry 4553 (class 0 OID 0)
-- Dependencies: 293
-- Name: TABLE achievement_categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.achievement_categories IS 'Категории достижений для группировки';


--
-- TOC entry 292 (class 1259 OID 27868)
-- Name: achievement_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.achievement_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.achievement_categories_id_seq OWNER TO postgres;

--
-- TOC entry 4554 (class 0 OID 0)
-- Dependencies: 292
-- Name: achievement_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.achievement_categories_id_seq OWNED BY public.achievement_categories.id;


--
-- TOC entry 288 (class 1259 OID 26644)
-- Name: achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.achievements (
    id integer NOT NULL,
    title character varying(255),
    description text NOT NULL,
    icon character varying(50) DEFAULT '🏆'::character varying,
    category character varying(50),
    rarity character varying(20) DEFAULT 'common'::character varying,
    points integer DEFAULT 10,
    condition_type character varying(50),
    condition_value integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    name character varying(255) DEFAULT 'Новое достижение'::character varying NOT NULL,
    xp_reward integer DEFAULT 0,
    conditions jsonb DEFAULT '{}'::jsonb,
    is_hidden boolean DEFAULT false,
    unlock_order integer,
    category_id integer,
    CONSTRAINT achievements_rarity_check CHECK (((rarity)::text = ANY ((ARRAY['common'::character varying, 'rare'::character varying, 'epic'::character varying, 'legendary'::character varying])::text[])))
);


ALTER TABLE public.achievements OWNER TO postgres;

--
-- TOC entry 4555 (class 0 OID 0)
-- Dependencies: 288
-- Name: TABLE achievements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.achievements IS 'Основная таблица всех доступных достижений';


--
-- TOC entry 287 (class 1259 OID 26643)
-- Name: achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.achievements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.achievements_id_seq OWNER TO postgres;

--
-- TOC entry 4556 (class 0 OID 0)
-- Dependencies: 287
-- Name: achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.achievements_id_seq OWNED BY public.achievements.id;


--
-- TOC entry 301 (class 1259 OID 28154)
-- Name: admin_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_invitations (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    inviter_id integer NOT NULL,
    invitee_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    message text,
    permissions jsonb DEFAULT '{"invite_admins": false, "manage_matches": true, "manage_participants": true}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT admin_invitations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying, 'expired'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.admin_invitations OWNER TO postgres;

--
-- TOC entry 4557 (class 0 OID 0)
-- Dependencies: 301
-- Name: TABLE admin_invitations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.admin_invitations IS 'Приглашения пользователей стать администраторами турниров';


--
-- TOC entry 4558 (class 0 OID 0)
-- Dependencies: 301
-- Name: COLUMN admin_invitations.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.admin_invitations.status IS 'Статус приглашения: pending, accepted, declined, expired, cancelled';


--
-- TOC entry 4559 (class 0 OID 0)
-- Dependencies: 301
-- Name: COLUMN admin_invitations.expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.admin_invitations.expires_at IS 'Время истечения приглашения (по умолчанию 7 дней)';


--
-- TOC entry 245 (class 1259 OID 17781)
-- Name: tournaments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournaments (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_by integer,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    game character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    format character varying(50) DEFAULT 'single_elimination'::character varying,
    type character varying(10) DEFAULT 'solo'::character varying,
    user_id integer DEFAULT 1 NOT NULL,
    participant_type character varying(50),
    max_participants integer,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    full_description text,
    rules text,
    prize_pool text,
    bracket_type character varying(50) DEFAULT 'single_elimination'::character varying,
    team_size integer DEFAULT 1,
    winner_id integer,
    winner_name character varying(255) DEFAULT NULL::character varying,
    second_place_id integer,
    second_place_name character varying(255) DEFAULT NULL::character varying,
    third_place_id integer,
    third_place_name character varying(255) DEFAULT NULL::character varying,
    chat_id integer,
    preliminary_round_enabled boolean DEFAULT true,
    third_place_match_enabled boolean DEFAULT false,
    round_naming_style character varying(20) DEFAULT 'standard'::character varying,
    mix_rating_type character varying(20) DEFAULT 'faceit'::character varying,
    seeding_type character varying(50) DEFAULT 'random'::character varying,
    seeding_config jsonb DEFAULT '{}'::jsonb,
    excluded_participants_count integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    lobby_enabled boolean DEFAULT false,
    full_double_elimination boolean DEFAULT false,
    completed_at timestamp without time zone,
    players_count integer DEFAULT 0,
    require_faceit_linked boolean DEFAULT false,
    require_steam_linked boolean DEFAULT false,
    is_series_final boolean DEFAULT false,
    access_type character varying(10) DEFAULT 'open'::character varying,
    mix_type character varying(16),
    is_hidden boolean DEFAULT false,
    CONSTRAINT check_seeding_type CHECK (((seeding_type)::text = ANY ((ARRAY['random'::character varying, 'ranking'::character varying, 'balanced'::character varying, 'manual'::character varying, 'snake_draft'::character varying])::text[]))),
    CONSTRAINT tournaments_access_type_check CHECK (((access_type)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying])::text[]))),
    CONSTRAINT tournaments_bracket_type_check CHECK (((bracket_type)::text = ANY ((ARRAY['single_elimination'::character varying, 'double_elimination'::character varying, 'swiss'::character varying])::text[]))),
    CONSTRAINT tournaments_mix_rating_type_check CHECK (((mix_rating_type)::text = ANY ((ARRAY['faceit'::character varying, 'premier'::character varying, 'mixed'::character varying])::text[]))),
    CONSTRAINT tournaments_mix_type_check CHECK (((mix_type)::text = ANY ((ARRAY['classic'::character varying, 'full'::character varying])::text[]))),
    CONSTRAINT tournaments_participant_type_check CHECK (((participant_type)::text = ANY (ARRAY[('solo'::character varying)::text, ('team'::character varying)::text])))
);


ALTER TABLE public.tournaments OWNER TO postgres;

--
-- TOC entry 4561 (class 0 OID 0)
-- Dependencies: 245
-- Name: TABLE tournaments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tournaments IS 'Обновлен турнир 59: изменен тип игры с "cs2" на "Counter-Strike 2" для корректной работы выбора карт';


--
-- TOC entry 4562 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.participant_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.participant_type IS 'Тип участников: solo (микс), team (общий), cs2_classic_5v5 (CS2 классик), cs2_wingman_2v2 (CS2 вингман)';


--
-- TOC entry 4563 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.bracket_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.bracket_type IS 'Тип турнирной сетки: single_elimination или double_elimination';


--
-- TOC entry 4564 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.winner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.winner_id IS 'ID победителя турнира (ссылка на tournament_participants или tournament_teams)';


--
-- TOC entry 4565 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.winner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.winner_name IS 'Имя победителя турнира';


--
-- TOC entry 4566 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.second_place_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.second_place_id IS 'ID участника, занявшего второе место';


--
-- TOC entry 4567 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.second_place_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.second_place_name IS 'Имя участника, занявшего второе место';


--
-- TOC entry 4568 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.third_place_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.third_place_id IS 'ID участника, занявшего третье место';


--
-- TOC entry 4569 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.third_place_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.third_place_name IS 'Имя участника, занявшего третье место';


--
-- TOC entry 4570 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.chat_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.chat_id IS 'ID группового чата турнира';


--
-- TOC entry 4571 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.mix_rating_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.mix_rating_type IS 'Тип рейтинга для микс турниров: faceit, premier или mixed (без учета рейтинга)';


--
-- TOC entry 4572 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.seeding_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.seeding_type IS 'Тип распределения участников: random, ranking, balanced, manual, snake_draft';


--
-- TOC entry 4573 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.seeding_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.seeding_config IS 'Конфигурация распределения в формате JSON (ratingType, direction, customOrder и т.д.)';


--
-- TOC entry 4574 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.excluded_participants_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.excluded_participants_count IS 'Количество исключенных участников при выравнивании до степени двойки';


--
-- TOC entry 4575 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.full_double_elimination; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.full_double_elimination IS 'Включить Full Double Elimination: требует дополнительный матч (Grand Final Triumph) если участник из нижней сетки выигрывает Гранд Финал';


--
-- TOC entry 4576 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.require_faceit_linked; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.require_faceit_linked IS 'Требовать привязки FACEIT аккаунта для участия (для MIX с mix_rating_type=faceit)';


--
-- TOC entry 4577 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.require_steam_linked; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.require_steam_linked IS 'Требовать привязки Steam аккаунта для участия (для MIX с mix_rating_type=premier)';


--
-- TOC entry 4578 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.mix_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.mix_type IS 'Тип микс турнира: classic — классический микс, full — full mix по раундам';


--
-- TOC entry 4579 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN tournaments.is_hidden; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.is_hidden IS 'Флаг скрытого турнира (не отображается в публичных списках)';


--
-- TOC entry 247 (class 1259 OID 17792)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100),
    password_hash character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    role character varying(20) DEFAULT 'user'::character varying,
    steam_id character varying(50),
    faceit_id character varying(50),
    full_name character varying(100),
    birth_date date,
    steam_url character varying(255),
    avatar_url character varying(255) DEFAULT '/uploads/avatars/preloaded/circle-user.svg'::character varying,
    is_verified boolean DEFAULT false,
    verification_token character varying(255),
    token_expiry timestamp without time zone,
    cs2_premier_rank integer DEFAULT 0,
    faceit_elo integer DEFAULT 0,
    last_active timestamp without time zone DEFAULT now(),
    last_notifications_seen timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_system_user boolean DEFAULT false,
    password_reset_token character varying(255),
    password_reset_expires timestamp without time zone,
    steam_nickname character varying(255),
    steam_nickname_updated timestamp without time zone,
    invited_by integer,
    referral_code character varying(20),
    invited_at timestamp without time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 4580 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN users.invited_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.invited_by IS 'ID пользователя, который пригласил данного пользователя';


--
-- TOC entry 4581 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN users.referral_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.referral_code IS 'Уникальный реферальный код пользователя';


--
-- TOC entry 4582 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN users.invited_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.invited_at IS 'Дата и время приглашения пользователя';


--
-- TOC entry 303 (class 1259 OID 28201)
-- Name: active_admin_invitations; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.active_admin_invitations AS
 SELECT ai.id,
    ai.tournament_id,
    ai.inviter_id,
    ai.invitee_id,
    ai.status,
    ai.message,
    ai.permissions,
    ai.created_at,
    ai.expires_at,
    ai.responded_at,
    t.name AS tournament_name,
    inviter.username AS inviter_username,
    invitee.username AS invitee_username,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM information_schema.columns
              WHERE (((columns.table_name)::name = 'users'::name) AND ((columns.column_name)::name = 'email'::name)))) THEN ( SELECT u.email
               FROM public.users u
              WHERE (u.id = invitee.id))
            ELSE NULL::character varying
        END AS invitee_email
   FROM (((public.admin_invitations ai
     JOIN public.tournaments t ON ((ai.tournament_id = t.id)))
     JOIN public.users inviter ON ((ai.inviter_id = inviter.id)))
     JOIN public.users invitee ON ((ai.invitee_id = invitee.id)))
  WHERE (((ai.status)::text = 'pending'::text) AND (ai.expires_at > now()));


ALTER VIEW public.active_admin_invitations OWNER TO postgres;

--
-- TOC entry 300 (class 1259 OID 28153)
-- Name: admin_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_invitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_invitations_id_seq OWNER TO postgres;

--
-- TOC entry 4584 (class 0 OID 0)
-- Dependencies: 300
-- Name: admin_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_invitations_id_seq OWNED BY public.admin_invitations.id;


--
-- TOC entry 256 (class 1259 OID 18118)
-- Name: admin_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_requests (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    user_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.admin_requests OWNER TO postgres;

--
-- TOC entry 4586 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE admin_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.admin_requests IS 'Запросы пользователей на получение прав администратора турнира';


--
-- TOC entry 4587 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN admin_requests.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.admin_requests.status IS 'Статус запроса: pending, accepted, rejected';


--
-- TOC entry 255 (class 1259 OID 18117)
-- Name: admin_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_requests_id_seq OWNER TO postgres;

--
-- TOC entry 4588 (class 0 OID 0)
-- Dependencies: 255
-- Name: admin_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_requests_id_seq OWNED BY public.admin_requests.id;


--
-- TOC entry 264 (class 1259 OID 26203)
-- Name: chat_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_participants (
    id integer NOT NULL,
    chat_id integer,
    user_id integer,
    is_admin boolean DEFAULT false,
    is_muted boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_participants OWNER TO postgres;

--
-- TOC entry 263 (class 1259 OID 26202)
-- Name: chat_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_participants_id_seq OWNER TO postgres;

--
-- TOC entry 4589 (class 0 OID 0)
-- Dependencies: 263
-- Name: chat_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_participants_id_seq OWNED BY public.chat_participants.id;


--
-- TOC entry 262 (class 1259 OID 26192)
-- Name: chats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chats (
    id integer NOT NULL,
    name character varying(100) DEFAULT NULL::character varying,
    type character varying(20) DEFAULT 'private'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer
);


ALTER TABLE public.chats OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 26191)
-- Name: chats_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chats_id_seq OWNER TO postgres;

--
-- TOC entry 4590 (class 0 OID 0)
-- Dependencies: 261
-- Name: chats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chats_id_seq OWNED BY public.chats.id;


--
-- TOC entry 329 (class 1259 OID 29315)
-- Name: default_map_pool; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.default_map_pool (
    id integer NOT NULL,
    map_name character varying(50) NOT NULL,
    game character varying(255) DEFAULT 'Counter-Strike 2'::character varying NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.default_map_pool OWNER TO postgres;

--
-- TOC entry 328 (class 1259 OID 29314)
-- Name: default_map_pool_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.default_map_pool_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.default_map_pool_id_seq OWNER TO postgres;

--
-- TOC entry 4591 (class 0 OID 0)
-- Dependencies: 328
-- Name: default_map_pool_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.default_map_pool_id_seq OWNED BY public.default_map_pool.id;


--
-- TOC entry 284 (class 1259 OID 26482)
-- Name: dota_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dota_profiles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    steam_id character varying(20) NOT NULL,
    dota_stats jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estimated_mmr integer
);


ALTER TABLE public.dota_profiles OWNER TO postgres;

--
-- TOC entry 4592 (class 0 OID 0)
-- Dependencies: 284
-- Name: TABLE dota_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.dota_profiles IS 'Профили игроков Dota 2 с данными из OpenDota API';


--
-- TOC entry 4593 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN dota_profiles.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.user_id IS 'ID пользователя из таблицы users';


--
-- TOC entry 4594 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN dota_profiles.steam_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.steam_id IS 'Steam ID пользователя';


--
-- TOC entry 4595 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN dota_profiles.dota_stats; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.dota_stats IS 'JSON данные статистики из OpenDota API';


--
-- TOC entry 4596 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN dota_profiles.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.created_at IS 'Дата создания профиля';


--
-- TOC entry 4597 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN dota_profiles.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.updated_at IS 'Дата последнего обновления профиля';


--
-- TOC entry 4598 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN dota_profiles.estimated_mmr; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.estimated_mmr IS 'Приблизительный MMR рассчитанный на основе rank_tier';


--
-- TOC entry 283 (class 1259 OID 26481)
-- Name: dota_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dota_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dota_profiles_id_seq OWNER TO postgres;

--
-- TOC entry 4599 (class 0 OID 0)
-- Dependencies: 283
-- Name: dota_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dota_profiles_id_seq OWNED BY public.dota_profiles.id;


--
-- TOC entry 260 (class 1259 OID 26167)
-- Name: friends; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.friends (
    id integer NOT NULL,
    user_id integer NOT NULL,
    friend_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT not_self_friend CHECK ((user_id <> friend_id))
);


ALTER TABLE public.friends OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 26166)
-- Name: friends_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.friends_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.friends_id_seq OWNER TO postgres;

--
-- TOC entry 4600 (class 0 OID 0)
-- Dependencies: 259
-- Name: friends_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.friends_id_seq OWNED BY public.friends.id;


--
-- TOC entry 338 (class 1259 OID 31975)
-- Name: full_mix_previews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.full_mix_previews (
    tournament_id integer NOT NULL,
    round_number integer NOT NULL,
    preview jsonb NOT NULL,
    created_by integer,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.full_mix_previews OWNER TO postgres;

--
-- TOC entry 337 (class 1259 OID 31789)
-- Name: full_mix_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.full_mix_snapshots (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    round_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    approved_teams boolean DEFAULT false NOT NULL,
    approved_matches boolean DEFAULT false NOT NULL,
    CONSTRAINT full_mix_snapshots_round_number_check CHECK ((round_number >= 1))
);


ALTER TABLE public.full_mix_snapshots OWNER TO postgres;

--
-- TOC entry 336 (class 1259 OID 31788)
-- Name: full_mix_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.full_mix_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.full_mix_snapshots_id_seq OWNER TO postgres;

--
-- TOC entry 4601 (class 0 OID 0)
-- Dependencies: 336
-- Name: full_mix_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.full_mix_snapshots_id_seq OWNED BY public.full_mix_snapshots.id;


--
-- TOC entry 250 (class 1259 OID 18053)
-- Name: games; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.games (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.games OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 18052)
-- Name: games_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.games_id_seq OWNER TO postgres;

--
-- TOC entry 4602 (class 0 OID 0)
-- Dependencies: 249
-- Name: games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;


--
-- TOC entry 327 (class 1259 OID 28864)
-- Name: lobby_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lobby_invitations (
    id integer NOT NULL,
    lobby_id integer NOT NULL,
    user_id integer NOT NULL,
    team_id integer,
    status character varying(20) DEFAULT 'pending'::character varying,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    responded_at timestamp without time zone
);


ALTER TABLE public.lobby_invitations OWNER TO postgres;

--
-- TOC entry 4603 (class 0 OID 0)
-- Dependencies: 327
-- Name: TABLE lobby_invitations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lobby_invitations IS 'Приглашения участников в лобби';


--
-- TOC entry 326 (class 1259 OID 28863)
-- Name: lobby_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lobby_invitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lobby_invitations_id_seq OWNER TO postgres;

--
-- TOC entry 4604 (class 0 OID 0)
-- Dependencies: 326
-- Name: lobby_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lobby_invitations_id_seq OWNED BY public.lobby_invitations.id;


--
-- TOC entry 325 (class 1259 OID 28846)
-- Name: map_selections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.map_selections (
    id integer NOT NULL,
    lobby_id integer NOT NULL,
    map_name character varying(50) NOT NULL,
    action_type character varying(10) NOT NULL,
    team_id integer,
    action_order integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.map_selections OWNER TO postgres;

--
-- TOC entry 4605 (class 0 OID 0)
-- Dependencies: 325
-- Name: TABLE map_selections; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.map_selections IS 'История выбора карт в лобби';


--
-- TOC entry 324 (class 1259 OID 28845)
-- Name: map_selections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.map_selections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.map_selections_id_seq OWNER TO postgres;

--
-- TOC entry 4606 (class 0 OID 0)
-- Dependencies: 324
-- Name: map_selections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.map_selections_id_seq OWNED BY public.map_selections.id;


--
-- TOC entry 272 (class 1259 OID 26355)
-- Name: maps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.maps (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    game character varying(100) NOT NULL,
    display_name character varying(100),
    image_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.maps OWNER TO postgres;

--
-- TOC entry 4607 (class 0 OID 0)
-- Dependencies: 272
-- Name: TABLE maps; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.maps IS 'Таблица для хранения информации о картах игр';


--
-- TOC entry 271 (class 1259 OID 26354)
-- Name: maps_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.maps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.maps_id_seq OWNER TO postgres;

--
-- TOC entry 4608 (class 0 OID 0)
-- Dependencies: 271
-- Name: maps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.maps_id_seq OWNED BY public.maps.id;


--
-- TOC entry 323 (class 1259 OID 28812)
-- Name: match_lobbies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.match_lobbies (
    id integer NOT NULL,
    match_id integer NOT NULL,
    tournament_id integer NOT NULL,
    status character varying(20) DEFAULT 'waiting'::character varying,
    match_format character varying(10),
    first_picker_team_id integer,
    current_turn_team_id integer,
    team1_ready boolean DEFAULT false,
    team2_ready boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


ALTER TABLE public.match_lobbies OWNER TO postgres;

--
-- TOC entry 4609 (class 0 OID 0)
-- Dependencies: 323
-- Name: TABLE match_lobbies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.match_lobbies IS 'Активные лобби матчей';


--
-- TOC entry 322 (class 1259 OID 28811)
-- Name: match_lobbies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.match_lobbies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.match_lobbies_id_seq OWNER TO postgres;

--
-- TOC entry 4610 (class 0 OID 0)
-- Dependencies: 322
-- Name: match_lobbies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.match_lobbies_id_seq OWNED BY public.match_lobbies.id;


--
-- TOC entry 229 (class 1259 OID 17730)
-- Name: matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matches (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    round integer NOT NULL,
    team1_id integer,
    team2_id integer,
    score1 integer,
    score2 integer,
    winner_team_id integer,
    match_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'pending'::character varying,
    match_number integer,
    is_third_place_match boolean DEFAULT false,
    source_match1_id integer,
    source_match2_id integer,
    next_match_id integer,
    bracket_type character varying(20),
    loser_next_match_id integer,
    target_slot character varying(10),
    maps_data jsonb,
    round_name character varying(100),
    match_title character varying(100),
    is_preliminary_round boolean DEFAULT false,
    bye_match boolean DEFAULT false,
    position_in_round integer,
    tournament_match_number integer NOT NULL,
    CONSTRAINT matches_bracket_type_check CHECK (((bracket_type)::text = ANY ((ARRAY['winner'::character varying, 'loser'::character varying, 'loser_semifinal'::character varying, 'loser_final'::character varying, 'grand_final'::character varying, 'grand_final_reset'::character varying, 'placement'::character varying, 'final'::character varying, 'semifinal'::character varying])::text[])))
);


ALTER TABLE public.matches OWNER TO postgres;

--
-- TOC entry 4611 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN matches.next_match_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.next_match_id IS 'ID следующего матча куда переходит победитель';


--
-- TOC entry 4612 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN matches.bracket_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.bracket_type IS 'Тип матча: winner, loser, loser_semifinal (малый финал лузеров), loser_final (финал лузеров), grand_final, placement, final, semifinal';


--
-- TOC entry 4613 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN matches.loser_next_match_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.loser_next_match_id IS 'ID матча куда переходит проигравший (для матча за 3-е место)';


--
-- TOC entry 4614 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN matches.maps_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.maps_data IS 'Данные о сыгранных картах в формате JSON для CS2 и других игр';


--
-- TOC entry 4615 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN matches.round_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.round_name IS 'Название раунда для отображения пользователям';


--
-- TOC entry 4616 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN matches.match_title; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.match_title IS 'Полное название матча для отображения';


--
-- TOC entry 4617 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN matches.is_preliminary_round; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.is_preliminary_round IS 'Матч предварительного раунда отсева';


--
-- TOC entry 4618 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN matches.bye_match; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.bye_match IS 'Матч с автопроходом (bye)';


--
-- TOC entry 4619 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN matches.position_in_round; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.position_in_round IS 'Позиция матча в раунде для правильной сортировки';


--
-- TOC entry 4620 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN matches.tournament_match_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.tournament_match_number IS 'Номер матча внутри турнира (начинается с 1 для каждого турнира)';


--
-- TOC entry 230 (class 1259 OID 17737)
-- Name: matches_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.matches_id_seq OWNER TO postgres;

--
-- TOC entry 4621 (class 0 OID 0)
-- Dependencies: 230
-- Name: matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.matches_id_seq OWNED BY public.matches.id;


--
-- TOC entry 268 (class 1259 OID 26248)
-- Name: message_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_status (
    id integer NOT NULL,
    message_id integer,
    user_id integer,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone
);


ALTER TABLE public.message_status OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 26247)
-- Name: message_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.message_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.message_status_id_seq OWNER TO postgres;

--
-- TOC entry 4622 (class 0 OID 0)
-- Dependencies: 267
-- Name: message_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.message_status_id_seq OWNED BY public.message_status.id;


--
-- TOC entry 266 (class 1259 OID 26226)
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    chat_id integer,
    sender_id integer,
    content text NOT NULL,
    message_type character varying(64) DEFAULT 'text'::character varying,
    content_meta jsonb,
    is_pinned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- TOC entry 4623 (class 0 OID 0)
-- Dependencies: 266
-- Name: COLUMN messages.message_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.messages.message_type IS 'Тип сообщения (text, image, file, document, announcement, admin_invitation_interactive, tournament_invite_interactive, match_lobby_invite_interactive, etc)';


--
-- TOC entry 265 (class 1259 OID 26225)
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- TOC entry 4624 (class 0 OID 0)
-- Dependencies: 265
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- TOC entry 252 (class 1259 OID 18069)
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tournament_id integer,
    requester_id integer,
    invitation_id integer,
    team_invitation_id integer
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 18068)
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- TOC entry 4625 (class 0 OID 0)
-- Dependencies: 251
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 282 (class 1259 OID 26456)
-- Name: organization_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_requests (
    id integer NOT NULL,
    user_id integer,
    organization_name character varying(255) NOT NULL,
    description text NOT NULL,
    website_url character varying(500),
    vk_url character varying(500),
    telegram_url character varying(500),
    logo_url character varying(500),
    status character varying(50) DEFAULT 'pending'::character varying,
    admin_comment text,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.organization_requests OWNER TO postgres;

--
-- TOC entry 281 (class 1259 OID 26455)
-- Name: organization_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organization_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.organization_requests_id_seq OWNER TO postgres;

--
-- TOC entry 4626 (class 0 OID 0)
-- Dependencies: 281
-- Name: organization_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organization_requests_id_seq OWNED BY public.organization_requests.id;


--
-- TOC entry 278 (class 1259 OID 26408)
-- Name: organizer_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizer_members (
    id integer NOT NULL,
    organizer_id integer,
    user_id integer,
    role character varying(50) DEFAULT 'member'::character varying,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.organizer_members OWNER TO postgres;

--
-- TOC entry 277 (class 1259 OID 26407)
-- Name: organizer_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organizer_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.organizer_members_id_seq OWNER TO postgres;

--
-- TOC entry 4627 (class 0 OID 0)
-- Dependencies: 277
-- Name: organizer_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organizer_members_id_seq OWNED BY public.organizer_members.id;


--
-- TOC entry 276 (class 1259 OID 26388)
-- Name: organizers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    logo_url character varying(500),
    website_url character varying(500),
    vk_url character varying(500),
    telegram_url character varying(500),
    contact_email character varying(255),
    contact_phone character varying(50),
    manager_user_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.organizers OWNER TO postgres;

--
-- TOC entry 275 (class 1259 OID 26387)
-- Name: organizers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organizers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.organizers_id_seq OWNER TO postgres;

--
-- TOC entry 4628 (class 0 OID 0)
-- Dependencies: 275
-- Name: organizers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organizers_id_seq OWNED BY public.organizers.id;


--
-- TOC entry 231 (class 1259 OID 17738)
-- Name: participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.participants (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.participants OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 17744)
-- Name: participants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.participants_id_seq OWNER TO postgres;

--
-- TOC entry 4629 (class 0 OID 0)
-- Dependencies: 232
-- Name: participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.participants_id_seq OWNED BY public.participants.id;


--
-- TOC entry 233 (class 1259 OID 17745)
-- Name: player_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_stats (
    id integer NOT NULL,
    match_id integer,
    player_id integer,
    points integer DEFAULT 0,
    assists integer DEFAULT 0,
    rebounds integer DEFAULT 0
);


ALTER TABLE public.player_stats OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 17751)
-- Name: player_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.player_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.player_stats_id_seq OWNER TO postgres;

--
-- TOC entry 4630 (class 0 OID 0)
-- Dependencies: 234
-- Name: player_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.player_stats_id_seq OWNED BY public.player_stats.id;


--
-- TOC entry 235 (class 1259 OID 17752)
-- Name: players; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.players (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    "position" character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.players OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 17756)
-- Name: players_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.players_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.players_id_seq OWNER TO postgres;

--
-- TOC entry 4631 (class 0 OID 0)
-- Dependencies: 236
-- Name: players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.players_id_seq OWNED BY public.players.id;


--
-- TOC entry 315 (class 1259 OID 28596)
-- Name: referral_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referral_links (
    id integer NOT NULL,
    user_id integer NOT NULL,
    tournament_id integer NOT NULL,
    referral_code character varying(50) NOT NULL,
    expires_at timestamp without time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    uses_count integer DEFAULT 0,
    max_uses integer DEFAULT 32,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true
);


ALTER TABLE public.referral_links OWNER TO postgres;

--
-- TOC entry 4632 (class 0 OID 0)
-- Dependencies: 315
-- Name: TABLE referral_links; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.referral_links IS 'Реферальные ссылки для приглашения в турниры';


--
-- TOC entry 4633 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN referral_links.referral_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.referral_links.referral_code IS 'Уникальный код реферальной ссылки';


--
-- TOC entry 4634 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN referral_links.expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.referral_links.expires_at IS 'Дата истечения ссылки';


--
-- TOC entry 4635 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN referral_links.uses_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.referral_links.uses_count IS 'Количество использований ссылки';


--
-- TOC entry 4636 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN referral_links.max_uses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.referral_links.max_uses IS 'Максимальное количество использований';


--
-- TOC entry 314 (class 1259 OID 28595)
-- Name: referral_links_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.referral_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.referral_links_id_seq OWNER TO postgres;

--
-- TOC entry 4637 (class 0 OID 0)
-- Dependencies: 314
-- Name: referral_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.referral_links_id_seq OWNED BY public.referral_links.id;


--
-- TOC entry 317 (class 1259 OID 28620)
-- Name: referral_registrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referral_registrations (
    id integer NOT NULL,
    referrer_id integer NOT NULL,
    referred_user_id integer NOT NULL,
    tournament_id integer NOT NULL,
    referral_link_id integer NOT NULL,
    registered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    participated_in_tournament boolean DEFAULT false
);


ALTER TABLE public.referral_registrations OWNER TO postgres;

--
-- TOC entry 4638 (class 0 OID 0)
-- Dependencies: 317
-- Name: TABLE referral_registrations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.referral_registrations IS 'Успешные регистрации по реферальным ссылкам';


--
-- TOC entry 4639 (class 0 OID 0)
-- Dependencies: 317
-- Name: COLUMN referral_registrations.participated_in_tournament; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.referral_registrations.participated_in_tournament IS 'Принял ли участие в турнире';


--
-- TOC entry 316 (class 1259 OID 28619)
-- Name: referral_registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.referral_registrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.referral_registrations_id_seq OWNER TO postgres;

--
-- TOC entry 4640 (class 0 OID 0)
-- Dependencies: 316
-- Name: referral_registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.referral_registrations_id_seq OWNED BY public.referral_registrations.id;


--
-- TOC entry 330 (class 1259 OID 29619)
-- Name: site_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_settings (
    key text NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.site_settings OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 17757)
-- Name: teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teams (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    city character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.teams OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 17761)
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.teams_id_seq OWNER TO postgres;

--
-- TOC entry 4641 (class 0 OID 0)
-- Dependencies: 238
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- TOC entry 299 (class 1259 OID 28126)
-- Name: tournament_admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_admins (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    user_id integer NOT NULL,
    permissions jsonb DEFAULT '{"invite_admins": false, "manage_matches": true, "manage_participants": true}'::jsonb NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by integer,
    notes text
);


ALTER TABLE public.tournament_admins OWNER TO postgres;

--
-- TOC entry 4642 (class 0 OID 0)
-- Dependencies: 299
-- Name: TABLE tournament_admins; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tournament_admins IS 'Администраторы турниров с их правами доступа';


--
-- TOC entry 4643 (class 0 OID 0)
-- Dependencies: 299
-- Name: COLUMN tournament_admins.permissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_admins.permissions IS 'JSON с правами доступа администратора';


--
-- TOC entry 298 (class 1259 OID 28125)
-- Name: tournament_admins_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_admins_id_seq OWNER TO postgres;

--
-- TOC entry 4645 (class 0 OID 0)
-- Dependencies: 298
-- Name: tournament_admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_admins_id_seq OWNED BY public.tournament_admins.id;


--
-- TOC entry 302 (class 1259 OID 28196)
-- Name: tournament_admins_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.tournament_admins_view AS
 SELECT ta.id,
    ta.tournament_id,
    ta.user_id,
    ta.permissions,
    ta.assigned_at,
    ta.assigned_by,
    u.username,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM information_schema.columns
              WHERE (((columns.table_name)::name = 'users'::name) AND ((columns.column_name)::name = 'avatar_url'::name)))) THEN ( SELECT u2.avatar_url
               FROM public.users u2
              WHERE (u2.id = u.id))
            ELSE NULL::character varying
        END AS avatar_url,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM information_schema.columns
              WHERE (((columns.table_name)::name = 'users'::name) AND ((columns.column_name)::name = 'email'::name)))) THEN ( SELECT u2.email
               FROM public.users u2
              WHERE (u2.id = u.id))
            ELSE NULL::character varying
        END AS email,
    t.name AS tournament_name,
    (t.created_by = ta.user_id) AS is_creator,
    assigner.username AS assigned_by_username
   FROM (((public.tournament_admins ta
     JOIN public.users u ON ((ta.user_id = u.id)))
     JOIN public.tournaments t ON ((ta.tournament_id = t.id)))
     LEFT JOIN public.users assigner ON ((ta.assigned_by = assigner.id)));


ALTER VIEW public.tournament_admins_view OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 17767)
-- Name: tournament_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_participants (
    id integer NOT NULL,
    tournament_id integer,
    name character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer,
    status character varying(20) DEFAULT 'active'::character varying,
    invited_user_id integer,
    in_team boolean DEFAULT false,
    faceit_elo integer,
    cs2_premier_rank integer,
    placement integer,
    CONSTRAINT check_cs2_premier_rank_range CHECK (((cs2_premier_rank IS NULL) OR ((cs2_premier_rank >= 0) AND (cs2_premier_rank <= 50000)))),
    CONSTRAINT check_faceit_elo_range CHECK (((faceit_elo IS NULL) OR ((faceit_elo >= 1) AND (faceit_elo <= 5000)))),
    CONSTRAINT chk_cs2_premier_rank_range CHECK (((cs2_premier_rank IS NULL) OR ((cs2_premier_rank >= 0) AND (cs2_premier_rank <= 40000)))),
    CONSTRAINT chk_faceit_elo_range CHECK (((faceit_elo IS NULL) OR ((faceit_elo >= 0) AND (faceit_elo <= 10000)))),
    CONSTRAINT tournament_participants_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'banned'::character varying, 'pending'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'confirmed'::character varying])::text[])))
);


ALTER TABLE public.tournament_participants OWNER TO postgres;

--
-- TOC entry 4648 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN tournament_participants.in_team; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_participants.in_team IS 'Флаг указывающий находится ли участник в команде (для микс турниров)';


--
-- TOC entry 4649 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN tournament_participants.faceit_elo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_participants.faceit_elo IS 'FACEIT ELO рейтинг участника (для незарегистрированных участников или переопределения)';


--
-- TOC entry 4650 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN tournament_participants.cs2_premier_rank; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_participants.cs2_premier_rank IS 'CS2 Premier Rank участника (для незарегистрированных участников или переопределения)';


--
-- TOC entry 312 (class 1259 OID 28500)
-- Name: tournament_bracket_info; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.tournament_bracket_info AS
 SELECT t.id AS tournament_id,
    t.name AS tournament_name,
    count(tp.id) AS participants_count,
    count(m.id) AS total_matches,
    count(
        CASE
            WHEN (m.is_preliminary_round = true) THEN 1
            ELSE NULL::integer
        END) AS preliminary_matches,
    count(
        CASE
            WHEN (m.is_third_place_match = true) THEN 1
            ELSE NULL::integer
        END) AS third_place_matches,
    max(m.round) AS max_round,
    t.third_place_match_enabled,
    t.preliminary_round_enabled
   FROM ((public.tournaments t
     LEFT JOIN public.tournament_participants tp ON ((t.id = tp.tournament_id)))
     LEFT JOIN public.matches m ON ((t.id = m.tournament_id)))
  WHERE (((t.format)::text = 'single_elimination'::text) OR ((t.bracket_type)::text = 'single_elimination'::text))
  GROUP BY t.id, t.name, t.third_place_match_enabled, t.preliminary_round_enabled;


ALTER VIEW public.tournament_bracket_info OWNER TO postgres;

--
-- TOC entry 4651 (class 0 OID 0)
-- Dependencies: 312
-- Name: VIEW tournament_bracket_info; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.tournament_bracket_info IS 'Сводная информация о турнирных сетках Single Elimination';


--
-- TOC entry 335 (class 1259 OID 31771)
-- Name: tournament_full_mix_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_full_mix_settings (
    tournament_id integer NOT NULL,
    wins_to_win integer DEFAULT 3 NOT NULL,
    rating_mode character varying(20) DEFAULT 'random'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    current_round integer DEFAULT 1 NOT NULL,
    CONSTRAINT tournament_full_mix_settings_wins_to_win_check CHECK ((wins_to_win >= 1))
);


ALTER TABLE public.tournament_full_mix_settings OWNER TO postgres;

--
-- TOC entry 270 (class 1259 OID 26276)
-- Name: tournament_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_invitations (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    user_id integer NOT NULL,
    invited_by integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tournament_invitations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.tournament_invitations OWNER TO postgres;

--
-- TOC entry 269 (class 1259 OID 26275)
-- Name: tournament_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_invitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_invitations_id_seq OWNER TO postgres;

--
-- TOC entry 4652 (class 0 OID 0)
-- Dependencies: 269
-- Name: tournament_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_invitations_id_seq OWNED BY public.tournament_invitations.id;


--
-- TOC entry 319 (class 1259 OID 28681)
-- Name: tournament_lobby_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_lobby_settings (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    enabled boolean DEFAULT false,
    match_format character varying(10) DEFAULT NULL::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tournament_lobby_settings OWNER TO postgres;

--
-- TOC entry 4653 (class 0 OID 0)
-- Dependencies: 319
-- Name: TABLE tournament_lobby_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tournament_lobby_settings IS 'Настройки лобби для турниров';


--
-- TOC entry 318 (class 1259 OID 28680)
-- Name: tournament_lobby_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_lobby_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_lobby_settings_id_seq OWNER TO postgres;

--
-- TOC entry 4654 (class 0 OID 0)
-- Dependencies: 318
-- Name: tournament_lobby_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_lobby_settings_id_seq OWNED BY public.tournament_lobby_settings.id;


--
-- TOC entry 286 (class 1259 OID 26510)
-- Name: tournament_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_logs (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    user_id integer,
    event_type character varying(50) NOT NULL,
    event_data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tournament_logs OWNER TO postgres;

--
-- TOC entry 4655 (class 0 OID 0)
-- Dependencies: 286
-- Name: TABLE tournament_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tournament_logs IS 'Журнал событий турниров';


--
-- TOC entry 4656 (class 0 OID 0)
-- Dependencies: 286
-- Name: COLUMN tournament_logs.tournament_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_logs.tournament_id IS 'ID турнира';


--
-- TOC entry 4657 (class 0 OID 0)
-- Dependencies: 286
-- Name: COLUMN tournament_logs.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_logs.user_id IS 'ID пользователя, инициировавшего событие (может быть NULL для системных событий)';


--
-- TOC entry 4658 (class 0 OID 0)
-- Dependencies: 286
-- Name: COLUMN tournament_logs.event_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_logs.event_type IS 'Тип события (tournament_created, participant_joined, match_completed и т.д.)';


--
-- TOC entry 4659 (class 0 OID 0)
-- Dependencies: 286
-- Name: COLUMN tournament_logs.event_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_logs.event_data IS 'Дополнительные данные события в формате JSON';


--
-- TOC entry 4660 (class 0 OID 0)
-- Dependencies: 286
-- Name: COLUMN tournament_logs.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_logs.created_at IS 'Время создания записи';


--
-- TOC entry 285 (class 1259 OID 26509)
-- Name: tournament_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_logs_id_seq OWNER TO postgres;

--
-- TOC entry 4662 (class 0 OID 0)
-- Dependencies: 285
-- Name: tournament_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_logs_id_seq OWNED BY public.tournament_logs.id;


--
-- TOC entry 321 (class 1259 OID 28796)
-- Name: tournament_maps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_maps (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    map_name character varying(50) NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tournament_maps OWNER TO postgres;

--
-- TOC entry 4664 (class 0 OID 0)
-- Dependencies: 321
-- Name: TABLE tournament_maps; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tournament_maps IS 'Список карт для турнира CS2';


--
-- TOC entry 320 (class 1259 OID 28795)
-- Name: tournament_maps_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_maps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_maps_id_seq OWNER TO postgres;

--
-- TOC entry 4665 (class 0 OID 0)
-- Dependencies: 320
-- Name: tournament_maps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_maps_id_seq OWNED BY public.tournament_maps.id;


--
-- TOC entry 274 (class 1259 OID 26366)
-- Name: tournament_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_messages (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    sender_id integer NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tournament_messages OWNER TO postgres;

--
-- TOC entry 273 (class 1259 OID 26365)
-- Name: tournament_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_messages_id_seq OWNER TO postgres;

--
-- TOC entry 4666 (class 0 OID 0)
-- Dependencies: 273
-- Name: tournament_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_messages_id_seq OWNED BY public.tournament_messages.id;


--
-- TOC entry 280 (class 1259 OID 26429)
-- Name: tournament_organizers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_organizers (
    id integer NOT NULL,
    tournament_id integer,
    organizer_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tournament_organizers OWNER TO postgres;

--
-- TOC entry 279 (class 1259 OID 26428)
-- Name: tournament_organizers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_organizers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_organizers_id_seq OWNER TO postgres;

--
-- TOC entry 4667 (class 0 OID 0)
-- Dependencies: 279
-- Name: tournament_organizers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_organizers_id_seq OWNED BY public.tournament_organizers.id;


--
-- TOC entry 240 (class 1259 OID 17771)
-- Name: tournament_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_participants_id_seq OWNER TO postgres;

--
-- TOC entry 4668 (class 0 OID 0)
-- Dependencies: 240
-- Name: tournament_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_participants_id_seq OWNED BY public.tournament_participants.id;


--
-- TOC entry 334 (class 1259 OID 30118)
-- Name: tournament_promotions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_promotions (
    id integer NOT NULL,
    final_tournament_id integer NOT NULL,
    qualifier_tournament_id integer NOT NULL,
    team_id integer NOT NULL,
    placed integer NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tournament_promotions_placed_check CHECK ((placed >= 1))
);


ALTER TABLE public.tournament_promotions OWNER TO postgres;

--
-- TOC entry 333 (class 1259 OID 30117)
-- Name: tournament_promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_promotions_id_seq OWNER TO postgres;

--
-- TOC entry 4669 (class 0 OID 0)
-- Dependencies: 333
-- Name: tournament_promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_promotions_id_seq OWNED BY public.tournament_promotions.id;


--
-- TOC entry 332 (class 1259 OID 30094)
-- Name: tournament_qualifiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_qualifiers (
    id integer NOT NULL,
    final_tournament_id integer NOT NULL,
    qualifier_tournament_id integer NOT NULL,
    slots integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tournament_qualifiers_slots_check CHECK (((slots >= 1) AND (slots <= 3)))
);


ALTER TABLE public.tournament_qualifiers OWNER TO postgres;

--
-- TOC entry 331 (class 1259 OID 30093)
-- Name: tournament_qualifiers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_qualifiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_qualifiers_id_seq OWNER TO postgres;

--
-- TOC entry 4670 (class 0 OID 0)
-- Dependencies: 331
-- Name: tournament_qualifiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_qualifiers_id_seq OWNED BY public.tournament_qualifiers.id;


--
-- TOC entry 311 (class 1259 OID 28479)
-- Name: tournament_round_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_round_config (
    id integer NOT NULL,
    tournament_id integer,
    round_number integer NOT NULL,
    round_name character varying(50) NOT NULL,
    round_title character varying(100),
    is_final boolean DEFAULT false,
    is_semifinal boolean DEFAULT false,
    is_preliminary boolean DEFAULT false,
    participants_count integer,
    matches_count integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tournament_round_config OWNER TO postgres;

--
-- TOC entry 310 (class 1259 OID 28478)
-- Name: tournament_round_config_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_round_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_round_config_id_seq OWNER TO postgres;

--
-- TOC entry 4671 (class 0 OID 0)
-- Dependencies: 310
-- Name: tournament_round_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_round_config_id_seq OWNED BY public.tournament_round_config.id;


--
-- TOC entry 313 (class 1259 OID 28550)
-- Name: tournament_seeding_info; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.tournament_seeding_info AS
 SELECT t.id,
    t.name,
    t.seeding_type,
    t.seeding_config,
    t.excluded_participants_count,
        CASE
            WHEN ((t.seeding_type)::text = 'random'::text) THEN 'Случайное распределение'::text
            WHEN ((t.seeding_type)::text = 'ranking'::text) THEN 'По рейтингу'::text
            WHEN ((t.seeding_type)::text = 'balanced'::text) THEN 'Сбалансированное'::text
            WHEN ((t.seeding_type)::text = 'manual'::text) THEN 'Ручное'::text
            WHEN ((t.seeding_type)::text = 'snake_draft'::text) THEN 'Змейка'::text
            ELSE 'Неизвестно'::text
        END AS seeding_type_display,
    (t.seeding_config ->> 'ratingType'::text) AS rating_type,
    (t.seeding_config ->> 'direction'::text) AS sort_direction,
    ( SELECT count(*) AS count
           FROM public.tournament_participants
          WHERE (tournament_participants.tournament_id = t.id)) AS total_participants,
    (( SELECT count(*) AS count
           FROM public.tournament_participants
          WHERE (tournament_participants.tournament_id = t.id)) - t.excluded_participants_count) AS participants_in_bracket
   FROM public.tournaments t;


ALTER VIEW public.tournament_seeding_info OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 18092)
-- Name: tournament_team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_team_members (
    id integer NOT NULL,
    team_id integer NOT NULL,
    user_id integer,
    participant_id integer,
    is_captain boolean DEFAULT false,
    captain_rating integer
);


ALTER TABLE public.tournament_team_members OWNER TO postgres;

--
-- TOC entry 4673 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN tournament_team_members.is_captain; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_team_members.is_captain IS 'Является ли участник капитаном команды (только один на команду)';


--
-- TOC entry 4674 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN tournament_team_members.captain_rating; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_team_members.captain_rating IS 'Рейтинг капитана на момент назначения (для статистики)';


--
-- TOC entry 253 (class 1259 OID 18091)
-- Name: tournament_team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_team_members_id_seq OWNER TO postgres;

--
-- TOC entry 4675 (class 0 OID 0)
-- Dependencies: 253
-- Name: tournament_team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_team_members_id_seq OWNED BY public.tournament_team_members.id;


--
-- TOC entry 241 (class 1259 OID 17772)
-- Name: tournament_team_players; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_team_players (
    id integer NOT NULL,
    tournament_team_id integer,
    player_id integer,
    is_captain boolean DEFAULT false
);


ALTER TABLE public.tournament_team_players OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 17776)
-- Name: tournament_team_players_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_team_players_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_team_players_id_seq OWNER TO postgres;

--
-- TOC entry 4676 (class 0 OID 0)
-- Dependencies: 242
-- Name: tournament_team_players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_team_players_id_seq OWNED BY public.tournament_team_players.id;


--
-- TOC entry 243 (class 1259 OID 17777)
-- Name: tournament_teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_teams (
    id integer NOT NULL,
    tournament_id integer,
    team_id integer,
    creator_id integer,
    name character varying(100) NOT NULL
);


ALTER TABLE public.tournament_teams OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 17780)
-- Name: tournament_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournament_teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_teams_id_seq OWNER TO postgres;

--
-- TOC entry 4677 (class 0 OID 0)
-- Dependencies: 244
-- Name: tournament_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_teams_id_seq OWNED BY public.tournament_teams.id;


--
-- TOC entry 246 (class 1259 OID 17791)
-- Name: tournaments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tournaments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournaments_id_seq OWNER TO postgres;

--
-- TOC entry 4678 (class 0 OID 0)
-- Dependencies: 246
-- Name: tournaments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournaments_id_seq OWNED BY public.tournaments.id;


--
-- TOC entry 290 (class 1259 OID 26661)
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_achievements (
    id integer NOT NULL,
    user_id integer,
    achievement_id integer,
    unlocked_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    progress integer DEFAULT 0,
    is_new boolean DEFAULT true,
    notified_at timestamp without time zone
);


ALTER TABLE public.user_achievements OWNER TO postgres;

--
-- TOC entry 4679 (class 0 OID 0)
-- Dependencies: 290
-- Name: TABLE user_achievements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_achievements IS 'Связь пользователей с полученными достижениями';


--
-- TOC entry 289 (class 1259 OID 26660)
-- Name: user_achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_achievements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_achievements_id_seq OWNER TO postgres;

--
-- TOC entry 4680 (class 0 OID 0)
-- Dependencies: 289
-- Name: user_achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_achievements_id_seq OWNED BY public.user_achievements.id;


--
-- TOC entry 295 (class 1259 OID 27881)
-- Name: user_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_progress (
    id integer NOT NULL,
    user_id integer NOT NULL,
    total_xp integer DEFAULT 0,
    level integer DEFAULT 1,
    tournaments_created integer DEFAULT 0,
    tournaments_won integer DEFAULT 0,
    tournaments_participated integer DEFAULT 0,
    matches_won integer DEFAULT 0,
    matches_lost integer DEFAULT 0,
    matches_draw integer DEFAULT 0,
    friends_count integer DEFAULT 0,
    messages_sent integer DEFAULT 0,
    daily_streak_current integer DEFAULT 0,
    daily_streak_longest integer DEFAULT 0,
    last_login_date date,
    profile_completion_percentage integer DEFAULT 0,
    steam_connected boolean DEFAULT false,
    faceit_connected boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_progress OWNER TO postgres;

--
-- TOC entry 4681 (class 0 OID 0)
-- Dependencies: 295
-- Name: TABLE user_progress; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_progress IS 'Общая статистика прогресса пользователей';


--
-- TOC entry 294 (class 1259 OID 27880)
-- Name: user_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_progress_id_seq OWNER TO postgres;

--
-- TOC entry 4682 (class 0 OID 0)
-- Dependencies: 294
-- Name: user_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_progress_id_seq OWNED BY public.user_progress.id;


--
-- TOC entry 309 (class 1259 OID 28374)
-- Name: user_team_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_team_invitations (
    id integer NOT NULL,
    team_id integer NOT NULL,
    inviter_id integer NOT NULL,
    invited_user_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    responded_at timestamp without time zone
);


ALTER TABLE public.user_team_invitations OWNER TO postgres;

--
-- TOC entry 308 (class 1259 OID 28373)
-- Name: user_team_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_team_invitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_team_invitations_id_seq OWNER TO postgres;

--
-- TOC entry 4683 (class 0 OID 0)
-- Dependencies: 308
-- Name: user_team_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_team_invitations_id_seq OWNED BY public.user_team_invitations.id;


--
-- TOC entry 307 (class 1259 OID 28353)
-- Name: user_team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_team_members (
    id integer NOT NULL,
    team_id integer NOT NULL,
    user_id integer NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_team_members OWNER TO postgres;

--
-- TOC entry 306 (class 1259 OID 28352)
-- Name: user_team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_team_members_id_seq OWNER TO postgres;

--
-- TOC entry 4684 (class 0 OID 0)
-- Dependencies: 306
-- Name: user_team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_team_members_id_seq OWNED BY public.user_team_members.id;


--
-- TOC entry 305 (class 1259 OID 28331)
-- Name: user_teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_teams (
    id integer NOT NULL,
    name character varying(20) NOT NULL,
    description text,
    captain_id integer NOT NULL,
    avatar_url character varying(255),
    is_permanent boolean DEFAULT true,
    tournament_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_teams OWNER TO postgres;

--
-- TOC entry 304 (class 1259 OID 28330)
-- Name: user_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_teams_id_seq OWNER TO postgres;

--
-- TOC entry 4685 (class 0 OID 0)
-- Dependencies: 304
-- Name: user_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_teams_id_seq OWNED BY public.user_teams.id;


--
-- TOC entry 258 (class 1259 OID 18204)
-- Name: user_tournament_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_tournament_stats (
    id integer NOT NULL,
    user_id integer NOT NULL,
    tournament_id integer NOT NULL,
    result character varying(50),
    wins integer DEFAULT 0,
    losses integer DEFAULT 0,
    is_team boolean DEFAULT false,
    final_position integer,
    prize_amount numeric(10,2) DEFAULT 0,
    is_winner boolean DEFAULT false,
    total_matches integer DEFAULT 0,
    points_scored integer DEFAULT 0,
    points_conceded integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    team_name character varying(255) DEFAULT NULL::character varying,
    is_team_member boolean DEFAULT false,
    CONSTRAINT losses_non_negative CHECK ((losses >= 0)),
    CONSTRAINT wins_non_negative CHECK ((wins >= 0))
);


ALTER TABLE public.user_tournament_stats OWNER TO postgres;

--
-- TOC entry 4686 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN user_tournament_stats.team_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_tournament_stats.team_name IS 'Название команды, в которой участвовал игрок (для командных турниров)';


--
-- TOC entry 4687 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN user_tournament_stats.is_team_member; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_tournament_stats.is_team_member IS 'Флаг: участвовал ли игрок в команде (true) или как одиночный игрок (false)';


--
-- TOC entry 257 (class 1259 OID 18203)
-- Name: user_tournament_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.user_tournament_stats ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.user_tournament_stats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 248 (class 1259 OID 17796)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 4688 (class 0 OID 0)
-- Dependencies: 248
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 291 (class 1259 OID 26688)
-- Name: v4_leaderboard; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v4_leaderboard AS
 SELECT u.id AS user_id,
    u.username,
    u.avatar_url,
    COALESCE(sum(uts.total_matches), (0)::bigint) AS total_matches,
    COALESCE(sum(uts.wins), (0)::bigint) AS total_wins,
        CASE
            WHEN (COALESCE(sum(uts.total_matches), (0)::bigint) > 0) THEN round((((COALESCE(sum(uts.wins), (0)::bigint))::numeric * 100.0) / (COALESCE(sum(uts.total_matches), (0)::bigint))::numeric), 1)
            ELSE (0)::numeric
        END AS winrate,
    count(*) FILTER (WHERE (uts.is_winner = true)) AS tournaments_won,
    count(ua.id) AS achievements_count,
    COALESCE(sum(a.points), (0)::bigint) AS total_achievement_points,
    row_number() OVER (ORDER BY (count(*) FILTER (WHERE (uts.is_winner = true))) DESC, COALESCE(sum(uts.wins), (0)::bigint) DESC, COALESCE(sum(uts.total_matches), (0)::bigint) DESC) AS rank
   FROM (((public.users u
     LEFT JOIN public.user_tournament_stats uts ON ((u.id = uts.user_id)))
     LEFT JOIN public.user_achievements ua ON ((u.id = ua.user_id)))
     LEFT JOIN public.achievements a ON ((ua.achievement_id = a.id)))
  WHERE (u.id > 1)
  GROUP BY u.id, u.username, u.avatar_url
 HAVING (COALESCE(sum(uts.total_matches), (0)::bigint) > 0)
  ORDER BY (row_number() OVER (ORDER BY (count(*) FILTER (WHERE (uts.is_winner = true))) DESC, COALESCE(sum(uts.wins), (0)::bigint) DESC, COALESCE(sum(uts.total_matches), (0)::bigint) DESC));


ALTER VIEW public.v4_leaderboard OWNER TO postgres;

--
-- TOC entry 3817 (class 2604 OID 27915)
-- Name: achievement_action_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_action_logs ALTER COLUMN id SET DEFAULT nextval('public.achievement_action_logs_id_seq'::regclass);


--
-- TOC entry 3795 (class 2604 OID 27872)
-- Name: achievement_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_categories ALTER COLUMN id SET DEFAULT nextval('public.achievement_categories_id_seq'::regclass);


--
-- TOC entry 3780 (class 2604 OID 26647)
-- Name: achievements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements ALTER COLUMN id SET DEFAULT nextval('public.achievements_id_seq'::regclass);


--
-- TOC entry 3822 (class 2604 OID 28157)
-- Name: admin_invitations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations ALTER COLUMN id SET DEFAULT nextval('public.admin_invitations_id_seq'::regclass);


--
-- TOC entry 3719 (class 2604 OID 18121)
-- Name: admin_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_requests ALTER COLUMN id SET DEFAULT nextval('public.admin_requests_id_seq'::regclass);


--
-- TOC entry 3743 (class 2604 OID 26206)
-- Name: chat_participants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_participants ALTER COLUMN id SET DEFAULT nextval('public.chat_participants_id_seq'::regclass);


--
-- TOC entry 3738 (class 2604 OID 26195)
-- Name: chats id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chats ALTER COLUMN id SET DEFAULT nextval('public.chats_id_seq'::regclass);


--
-- TOC entry 3871 (class 2604 OID 29318)
-- Name: default_map_pool id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_map_pool ALTER COLUMN id SET DEFAULT nextval('public.default_map_pool_id_seq'::regclass);


--
-- TOC entry 3775 (class 2604 OID 26485)
-- Name: dota_profiles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dota_profiles ALTER COLUMN id SET DEFAULT nextval('public.dota_profiles_id_seq'::regclass);


--
-- TOC entry 3734 (class 2604 OID 26170)
-- Name: friends id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends ALTER COLUMN id SET DEFAULT nextval('public.friends_id_seq'::regclass);


--
-- TOC entry 3886 (class 2604 OID 31792)
-- Name: full_mix_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.full_mix_snapshots ALTER COLUMN id SET DEFAULT nextval('public.full_mix_snapshots_id_seq'::regclass);


--
-- TOC entry 3713 (class 2604 OID 18056)
-- Name: games id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);


--
-- TOC entry 3868 (class 2604 OID 28867)
-- Name: lobby_invitations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lobby_invitations ALTER COLUMN id SET DEFAULT nextval('public.lobby_invitations_id_seq'::regclass);


--
-- TOC entry 3866 (class 2604 OID 28849)
-- Name: map_selections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.map_selections ALTER COLUMN id SET DEFAULT nextval('public.map_selections_id_seq'::regclass);


--
-- TOC entry 3758 (class 2604 OID 26358)
-- Name: maps id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maps ALTER COLUMN id SET DEFAULT nextval('public.maps_id_seq'::regclass);


--
-- TOC entry 3860 (class 2604 OID 28815)
-- Name: match_lobbies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_lobbies ALTER COLUMN id SET DEFAULT nextval('public.match_lobbies_id_seq'::regclass);


--
-- TOC entry 3653 (class 2604 OID 17798)
-- Name: matches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches ALTER COLUMN id SET DEFAULT nextval('public.matches_id_seq'::regclass);


--
-- TOC entry 3752 (class 2604 OID 26251)
-- Name: message_status id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status ALTER COLUMN id SET DEFAULT nextval('public.message_status_id_seq'::regclass);


--
-- TOC entry 3748 (class 2604 OID 26229)
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- TOC entry 3714 (class 2604 OID 18072)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 3771 (class 2604 OID 26459)
-- Name: organization_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests ALTER COLUMN id SET DEFAULT nextval('public.organization_requests_id_seq'::regclass);


--
-- TOC entry 3766 (class 2604 OID 26411)
-- Name: organizer_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizer_members ALTER COLUMN id SET DEFAULT nextval('public.organizer_members_id_seq'::regclass);


--
-- TOC entry 3762 (class 2604 OID 26391)
-- Name: organizers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizers ALTER COLUMN id SET DEFAULT nextval('public.organizers_id_seq'::regclass);


--
-- TOC entry 3659 (class 2604 OID 17799)
-- Name: participants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.participants ALTER COLUMN id SET DEFAULT nextval('public.participants_id_seq'::regclass);


--
-- TOC entry 3661 (class 2604 OID 17800)
-- Name: player_stats id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats ALTER COLUMN id SET DEFAULT nextval('public.player_stats_id_seq'::regclass);


--
-- TOC entry 3665 (class 2604 OID 17801)
-- Name: players id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);


--
-- TOC entry 3842 (class 2604 OID 28599)
-- Name: referral_links id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_links ALTER COLUMN id SET DEFAULT nextval('public.referral_links_id_seq'::regclass);


--
-- TOC entry 3849 (class 2604 OID 28623)
-- Name: referral_registrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_registrations ALTER COLUMN id SET DEFAULT nextval('public.referral_registrations_id_seq'::regclass);


--
-- TOC entry 3667 (class 2604 OID 17802)
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- TOC entry 3819 (class 2604 OID 28129)
-- Name: tournament_admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins ALTER COLUMN id SET DEFAULT nextval('public.tournament_admins_id_seq'::regclass);


--
-- TOC entry 3754 (class 2604 OID 26279)
-- Name: tournament_invitations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations ALTER COLUMN id SET DEFAULT nextval('public.tournament_invitations_id_seq'::regclass);


--
-- TOC entry 3852 (class 2604 OID 28684)
-- Name: tournament_lobby_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_lobby_settings ALTER COLUMN id SET DEFAULT nextval('public.tournament_lobby_settings_id_seq'::regclass);


--
-- TOC entry 3778 (class 2604 OID 26513)
-- Name: tournament_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_logs ALTER COLUMN id SET DEFAULT nextval('public.tournament_logs_id_seq'::regclass);


--
-- TOC entry 3857 (class 2604 OID 28799)
-- Name: tournament_maps id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_maps ALTER COLUMN id SET DEFAULT nextval('public.tournament_maps_id_seq'::regclass);


--
-- TOC entry 3760 (class 2604 OID 26369)
-- Name: tournament_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_messages ALTER COLUMN id SET DEFAULT nextval('public.tournament_messages_id_seq'::regclass);


--
-- TOC entry 3769 (class 2604 OID 26432)
-- Name: tournament_organizers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_organizers ALTER COLUMN id SET DEFAULT nextval('public.tournament_organizers_id_seq'::regclass);


--
-- TOC entry 3669 (class 2604 OID 17804)
-- Name: tournament_participants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants ALTER COLUMN id SET DEFAULT nextval('public.tournament_participants_id_seq'::regclass);


--
-- TOC entry 3879 (class 2604 OID 30121)
-- Name: tournament_promotions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_promotions ALTER COLUMN id SET DEFAULT nextval('public.tournament_promotions_id_seq'::regclass);


--
-- TOC entry 3876 (class 2604 OID 30097)
-- Name: tournament_qualifiers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_qualifiers ALTER COLUMN id SET DEFAULT nextval('public.tournament_qualifiers_id_seq'::regclass);


--
-- TOC entry 3837 (class 2604 OID 28482)
-- Name: tournament_round_config id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_round_config ALTER COLUMN id SET DEFAULT nextval('public.tournament_round_config_id_seq'::regclass);


--
-- TOC entry 3717 (class 2604 OID 18095)
-- Name: tournament_team_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members ALTER COLUMN id SET DEFAULT nextval('public.tournament_team_members_id_seq'::regclass);


--
-- TOC entry 3673 (class 2604 OID 17805)
-- Name: tournament_team_players id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_players ALTER COLUMN id SET DEFAULT nextval('public.tournament_team_players_id_seq'::regclass);


--
-- TOC entry 3675 (class 2604 OID 17806)
-- Name: tournament_teams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams ALTER COLUMN id SET DEFAULT nextval('public.tournament_teams_id_seq'::regclass);


--
-- TOC entry 3676 (class 2604 OID 17807)
-- Name: tournaments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournaments ALTER COLUMN id SET DEFAULT nextval('public.tournaments_id_seq'::regclass);


--
-- TOC entry 3791 (class 2604 OID 26664)
-- Name: user_achievements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements ALTER COLUMN id SET DEFAULT nextval('public.user_achievements_id_seq'::regclass);


--
-- TOC entry 3799 (class 2604 OID 27884)
-- Name: user_progress id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress ALTER COLUMN id SET DEFAULT nextval('public.user_progress_id_seq'::regclass);


--
-- TOC entry 3834 (class 2604 OID 28377)
-- Name: user_team_invitations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_invitations ALTER COLUMN id SET DEFAULT nextval('public.user_team_invitations_id_seq'::regclass);


--
-- TOC entry 3831 (class 2604 OID 28356)
-- Name: user_team_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_members ALTER COLUMN id SET DEFAULT nextval('public.user_team_members_id_seq'::regclass);


--
-- TOC entry 3827 (class 2604 OID 28334)
-- Name: user_teams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_teams ALTER COLUMN id SET DEFAULT nextval('public.user_teams_id_seq'::regclass);


--
-- TOC entry 3703 (class 2604 OID 17808)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4162 (class 2606 OID 27920)
-- Name: achievement_action_logs achievement_action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_action_logs
    ADD CONSTRAINT achievement_action_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4154 (class 2606 OID 27879)
-- Name: achievement_categories achievement_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_categories
    ADD CONSTRAINT achievement_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4135 (class 2606 OID 26657)
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- TOC entry 4137 (class 2606 OID 26659)
-- Name: achievements achievements_title_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_title_key UNIQUE (title);


--
-- TOC entry 4173 (class 2606 OID 28166)
-- Name: admin_invitations admin_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_pkey PRIMARY KEY (id);


--
-- TOC entry 4036 (class 2606 OID 18125)
-- Name: admin_requests admin_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_requests
    ADD CONSTRAINT admin_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4038 (class 2606 OID 18127)
-- Name: admin_requests admin_requests_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_requests
    ADD CONSTRAINT admin_requests_tournament_id_user_id_key UNIQUE (tournament_id, user_id);


--
-- TOC entry 4065 (class 2606 OID 26214)
-- Name: chat_participants chat_participants_chat_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_chat_id_user_id_key UNIQUE (chat_id, user_id);


--
-- TOC entry 4067 (class 2606 OID 26212)
-- Name: chat_participants chat_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_pkey PRIMARY KEY (id);


--
-- TOC entry 4060 (class 2606 OID 26201)
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- TOC entry 4245 (class 2606 OID 29325)
-- Name: default_map_pool default_map_pool_game_map_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_map_pool
    ADD CONSTRAINT default_map_pool_game_map_name_unique UNIQUE (game, map_name);


--
-- TOC entry 4247 (class 2606 OID 29323)
-- Name: default_map_pool default_map_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_map_pool
    ADD CONSTRAINT default_map_pool_pkey PRIMARY KEY (id);


--
-- TOC entry 4122 (class 2606 OID 26491)
-- Name: dota_profiles dota_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dota_profiles
    ADD CONSTRAINT dota_profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4124 (class 2606 OID 26493)
-- Name: dota_profiles dota_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dota_profiles
    ADD CONSTRAINT dota_profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 4054 (class 2606 OID 26176)
-- Name: friends friends_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_pkey PRIMARY KEY (id);


--
-- TOC entry 4271 (class 2606 OID 31983)
-- Name: full_mix_previews full_mix_previews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.full_mix_previews
    ADD CONSTRAINT full_mix_previews_pkey PRIMARY KEY (tournament_id, round_number);


--
-- TOC entry 4266 (class 2606 OID 31798)
-- Name: full_mix_snapshots full_mix_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.full_mix_snapshots
    ADD CONSTRAINT full_mix_snapshots_pkey PRIMARY KEY (id);


--
-- TOC entry 4021 (class 2606 OID 18060)
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- TOC entry 4241 (class 2606 OID 28873)
-- Name: lobby_invitations lobby_invitations_lobby_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lobby_invitations
    ADD CONSTRAINT lobby_invitations_lobby_id_user_id_key UNIQUE (lobby_id, user_id);


--
-- TOC entry 4243 (class 2606 OID 28871)
-- Name: lobby_invitations lobby_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lobby_invitations
    ADD CONSTRAINT lobby_invitations_pkey PRIMARY KEY (id);


--
-- TOC entry 4236 (class 2606 OID 28852)
-- Name: map_selections map_selections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.map_selections
    ADD CONSTRAINT map_selections_pkey PRIMARY KEY (id);


--
-- TOC entry 4095 (class 2606 OID 26363)
-- Name: maps maps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maps
    ADD CONSTRAINT maps_pkey PRIMARY KEY (id);


--
-- TOC entry 4231 (class 2606 OID 28824)
-- Name: match_lobbies match_lobbies_match_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_lobbies
    ADD CONSTRAINT match_lobbies_match_id_key UNIQUE (match_id);


--
-- TOC entry 4233 (class 2606 OID 28822)
-- Name: match_lobbies match_lobbies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_lobbies
    ADD CONSTRAINT match_lobbies_pkey PRIMARY KEY (id);


--
-- TOC entry 3960 (class 2606 OID 17810)
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- TOC entry 4082 (class 2606 OID 26256)
-- Name: message_status message_status_message_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_message_id_user_id_key UNIQUE (message_id, user_id);


--
-- TOC entry 4084 (class 2606 OID 26254)
-- Name: message_status message_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_pkey PRIMARY KEY (id);


--
-- TOC entry 4077 (class 2606 OID 26236)
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- TOC entry 4025 (class 2606 OID 18078)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 4120 (class 2606 OID 26466)
-- Name: organization_requests organization_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests
    ADD CONSTRAINT organization_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4107 (class 2606 OID 26417)
-- Name: organizer_members organizer_members_organizer_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizer_members
    ADD CONSTRAINT organizer_members_organizer_id_user_id_key UNIQUE (organizer_id, user_id);


--
-- TOC entry 4109 (class 2606 OID 26415)
-- Name: organizer_members organizer_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizer_members
    ADD CONSTRAINT organizer_members_pkey PRIMARY KEY (id);


--
-- TOC entry 4101 (class 2606 OID 26398)
-- Name: organizers organizers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_pkey PRIMARY KEY (id);


--
-- TOC entry 4103 (class 2606 OID 26400)
-- Name: organizers organizers_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_slug_key UNIQUE (slug);


--
-- TOC entry 3962 (class 2606 OID 17812)
-- Name: participants participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_pkey PRIMARY KEY (id);


--
-- TOC entry 3964 (class 2606 OID 17814)
-- Name: player_stats player_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_pkey PRIMARY KEY (id);


--
-- TOC entry 3966 (class 2606 OID 17816)
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- TOC entry 4207 (class 2606 OID 28606)
-- Name: referral_links referral_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_links
    ADD CONSTRAINT referral_links_pkey PRIMARY KEY (id);


--
-- TOC entry 4209 (class 2606 OID 28608)
-- Name: referral_links referral_links_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_links
    ADD CONSTRAINT referral_links_referral_code_key UNIQUE (referral_code);


--
-- TOC entry 4214 (class 2606 OID 28627)
-- Name: referral_registrations referral_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_registrations
    ADD CONSTRAINT referral_registrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4216 (class 2606 OID 28629)
-- Name: referral_registrations referral_registrations_referred_user_id_tournament_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_registrations
    ADD CONSTRAINT referral_registrations_referred_user_id_tournament_id_key UNIQUE (referred_user_id, tournament_id);


--
-- TOC entry 4250 (class 2606 OID 29626)
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);


--
-- TOC entry 3968 (class 2606 OID 17818)
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- TOC entry 4169 (class 2606 OID 28135)
-- Name: tournament_admins tournament_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins
    ADD CONSTRAINT tournament_admins_pkey PRIMARY KEY (id);


--
-- TOC entry 4171 (class 2606 OID 28137)
-- Name: tournament_admins tournament_admins_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins
    ADD CONSTRAINT tournament_admins_tournament_id_user_id_key UNIQUE (tournament_id, user_id);


--
-- TOC entry 4264 (class 2606 OID 31780)
-- Name: tournament_full_mix_settings tournament_full_mix_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_full_mix_settings
    ADD CONSTRAINT tournament_full_mix_settings_pkey PRIMARY KEY (tournament_id);


--
-- TOC entry 4089 (class 2606 OID 26285)
-- Name: tournament_invitations tournament_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations
    ADD CONSTRAINT tournament_invitations_pkey PRIMARY KEY (id);


--
-- TOC entry 4091 (class 2606 OID 26287)
-- Name: tournament_invitations tournament_invitations_tournament_id_user_id_status_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations
    ADD CONSTRAINT tournament_invitations_tournament_id_user_id_status_key UNIQUE (tournament_id, user_id, status);


--
-- TOC entry 4219 (class 2606 OID 28690)
-- Name: tournament_lobby_settings tournament_lobby_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_lobby_settings
    ADD CONSTRAINT tournament_lobby_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4221 (class 2606 OID 28692)
-- Name: tournament_lobby_settings tournament_lobby_settings_tournament_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_lobby_settings
    ADD CONSTRAINT tournament_lobby_settings_tournament_id_key UNIQUE (tournament_id);


--
-- TOC entry 4133 (class 2606 OID 26518)
-- Name: tournament_logs tournament_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_logs
    ADD CONSTRAINT tournament_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4224 (class 2606 OID 28803)
-- Name: tournament_maps tournament_maps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_maps
    ADD CONSTRAINT tournament_maps_pkey PRIMARY KEY (id);


--
-- TOC entry 4226 (class 2606 OID 28805)
-- Name: tournament_maps tournament_maps_tournament_id_map_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_maps
    ADD CONSTRAINT tournament_maps_tournament_id_map_name_key UNIQUE (tournament_id, map_name);


--
-- TOC entry 4097 (class 2606 OID 26374)
-- Name: tournament_messages tournament_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_messages
    ADD CONSTRAINT tournament_messages_pkey PRIMARY KEY (id);


--
-- TOC entry 4113 (class 2606 OID 26435)
-- Name: tournament_organizers tournament_organizers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_organizers
    ADD CONSTRAINT tournament_organizers_pkey PRIMARY KEY (id);


--
-- TOC entry 4115 (class 2606 OID 26437)
-- Name: tournament_organizers tournament_organizers_tournament_id_organizer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_organizers
    ADD CONSTRAINT tournament_organizers_tournament_id_organizer_id_key UNIQUE (tournament_id, organizer_id);


--
-- TOC entry 3974 (class 2606 OID 17824)
-- Name: tournament_participants tournament_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_pkey PRIMARY KEY (id);


--
-- TOC entry 3976 (class 2606 OID 26322)
-- Name: tournament_participants tournament_participants_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_id_user_id_key UNIQUE (tournament_id, user_id);


--
-- TOC entry 4259 (class 2606 OID 30127)
-- Name: tournament_promotions tournament_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_promotions
    ADD CONSTRAINT tournament_promotions_pkey PRIMARY KEY (id);


--
-- TOC entry 4261 (class 2606 OID 30258)
-- Name: tournament_promotions tournament_promotions_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_promotions
    ADD CONSTRAINT tournament_promotions_unique UNIQUE (final_tournament_id, qualifier_tournament_id, team_id, placed);


--
-- TOC entry 4254 (class 2606 OID 30104)
-- Name: tournament_qualifiers tournament_qualifiers_final_tournament_id_qualifier_tournam_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_qualifiers
    ADD CONSTRAINT tournament_qualifiers_final_tournament_id_qualifier_tournam_key UNIQUE (final_tournament_id, qualifier_tournament_id);


--
-- TOC entry 4256 (class 2606 OID 30102)
-- Name: tournament_qualifiers tournament_qualifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_qualifiers
    ADD CONSTRAINT tournament_qualifiers_pkey PRIMARY KEY (id);


--
-- TOC entry 4200 (class 2606 OID 28488)
-- Name: tournament_round_config tournament_round_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_round_config
    ADD CONSTRAINT tournament_round_config_pkey PRIMARY KEY (id);


--
-- TOC entry 4032 (class 2606 OID 18097)
-- Name: tournament_team_members tournament_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members
    ADD CONSTRAINT tournament_team_members_pkey PRIMARY KEY (id);


--
-- TOC entry 4034 (class 2606 OID 18099)
-- Name: tournament_team_members tournament_team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members
    ADD CONSTRAINT tournament_team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- TOC entry 3978 (class 2606 OID 17826)
-- Name: tournament_team_players tournament_team_players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_players
    ADD CONSTRAINT tournament_team_players_pkey PRIMARY KEY (id);


--
-- TOC entry 3980 (class 2606 OID 17828)
-- Name: tournament_team_players tournament_team_players_tournament_team_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_players
    ADD CONSTRAINT tournament_team_players_tournament_team_id_player_id_key UNIQUE (tournament_team_id, player_id);


--
-- TOC entry 3984 (class 2606 OID 17830)
-- Name: tournament_teams tournament_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_pkey PRIMARY KEY (id);


--
-- TOC entry 3986 (class 2606 OID 17832)
-- Name: tournament_teams tournament_teams_tournament_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_tournament_id_team_id_key UNIQUE (tournament_id, team_id);


--
-- TOC entry 4002 (class 2606 OID 17834)
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- TOC entry 4058 (class 2606 OID 26178)
-- Name: friends unique_friendship; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT unique_friendship UNIQUE (user_id, friend_id);


--
-- TOC entry 4023 (class 2606 OID 18067)
-- Name: games unique_game_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT unique_game_name UNIQUE (name);


--
-- TOC entry 4013 (class 2606 OID 18228)
-- Name: users unique_steam_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT unique_steam_id UNIQUE (steam_id);


--
-- TOC entry 3988 (class 2606 OID 18090)
-- Name: tournament_teams unique_team_name_per_tournament; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT unique_team_name_per_tournament UNIQUE (tournament_id, name);


--
-- TOC entry 4148 (class 2606 OID 26668)
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- TOC entry 4150 (class 2606 OID 27938)
-- Name: user_achievements user_achievements_user_achievement_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_achievement_unique UNIQUE (user_id, achievement_id);


--
-- TOC entry 4152 (class 2606 OID 26670)
-- Name: user_achievements user_achievements_user_id_achievement_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id);


--
-- TOC entry 4158 (class 2606 OID 27903)
-- Name: user_progress user_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_pkey PRIMARY KEY (id);


--
-- TOC entry 4160 (class 2606 OID 27905)
-- Name: user_progress user_progress_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_key UNIQUE (user_id);


--
-- TOC entry 4194 (class 2606 OID 28383)
-- Name: user_team_invitations user_team_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_invitations
    ADD CONSTRAINT user_team_invitations_pkey PRIMARY KEY (id);


--
-- TOC entry 4196 (class 2606 OID 28385)
-- Name: user_team_invitations user_team_invitations_team_id_invited_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_invitations
    ADD CONSTRAINT user_team_invitations_team_id_invited_user_id_key UNIQUE (team_id, invited_user_id);


--
-- TOC entry 4187 (class 2606 OID 28360)
-- Name: user_team_members user_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_members
    ADD CONSTRAINT user_team_members_pkey PRIMARY KEY (id);


--
-- TOC entry 4189 (class 2606 OID 28362)
-- Name: user_team_members user_team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_members
    ADD CONSTRAINT user_team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- TOC entry 4183 (class 2606 OID 28341)
-- Name: user_teams user_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_pkey PRIMARY KEY (id);


--
-- TOC entry 4050 (class 2606 OID 18211)
-- Name: user_tournament_stats user_tournament_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tournament_stats
    ADD CONSTRAINT user_tournament_stats_pkey PRIMARY KEY (id);


--
-- TOC entry 4052 (class 2606 OID 26642)
-- Name: user_tournament_stats user_tournament_stats_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tournament_stats
    ADD CONSTRAINT user_tournament_stats_unique UNIQUE (user_id, tournament_id);


--
-- TOC entry 4015 (class 2606 OID 17836)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4017 (class 2606 OID 17838)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4019 (class 2606 OID 28594)
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- TOC entry 4138 (class 1259 OID 27939)
-- Name: idx_achievements_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_active ON public.achievements USING btree (is_active);


--
-- TOC entry 4139 (class 1259 OID 26681)
-- Name: idx_achievements_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_category ON public.achievements USING btree (category);


--
-- TOC entry 4140 (class 1259 OID 26683)
-- Name: idx_achievements_condition_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_condition_type ON public.achievements USING btree (condition_type);


--
-- TOC entry 4141 (class 1259 OID 26682)
-- Name: idx_achievements_rarity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_rarity ON public.achievements USING btree (rarity);


--
-- TOC entry 4163 (class 1259 OID 27946)
-- Name: idx_action_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_action_created_at ON public.achievement_action_logs USING btree (created_at);


--
-- TOC entry 4174 (class 1259 OID 28192)
-- Name: idx_admin_invitations_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_active ON public.admin_invitations USING btree (tournament_id, invitee_id, status) WHERE ((status)::text = 'pending'::text);


--
-- TOC entry 4175 (class 1259 OID 28191)
-- Name: idx_admin_invitations_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_expires_at ON public.admin_invitations USING btree (expires_at);


--
-- TOC entry 4176 (class 1259 OID 28189)
-- Name: idx_admin_invitations_invitee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_invitee_id ON public.admin_invitations USING btree (invitee_id);


--
-- TOC entry 4177 (class 1259 OID 28515)
-- Name: idx_admin_invitations_inviter_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_inviter_id ON public.admin_invitations USING btree (inviter_id);


--
-- TOC entry 4178 (class 1259 OID 28190)
-- Name: idx_admin_invitations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_status ON public.admin_invitations USING btree (status);


--
-- TOC entry 4179 (class 1259 OID 28188)
-- Name: idx_admin_invitations_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_tournament_id ON public.admin_invitations USING btree (tournament_id);


--
-- TOC entry 4039 (class 1259 OID 28514)
-- Name: idx_admin_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_requests_status ON public.admin_requests USING btree (status);


--
-- TOC entry 4040 (class 1259 OID 28512)
-- Name: idx_admin_requests_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_requests_tournament_id ON public.admin_requests USING btree (tournament_id);


--
-- TOC entry 4041 (class 1259 OID 28513)
-- Name: idx_admin_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_requests_user_id ON public.admin_requests USING btree (user_id);


--
-- TOC entry 4068 (class 1259 OID 26267)
-- Name: idx_chat_participants_chat_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_participants_chat_id ON public.chat_participants USING btree (chat_id);


--
-- TOC entry 4069 (class 1259 OID 28532)
-- Name: idx_chat_participants_is_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_participants_is_admin ON public.chat_participants USING btree (is_admin);


--
-- TOC entry 4070 (class 1259 OID 26268)
-- Name: idx_chat_participants_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_participants_user_id ON public.chat_participants USING btree (user_id);


--
-- TOC entry 4061 (class 1259 OID 28531)
-- Name: idx_chats_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chats_created_at ON public.chats USING btree (created_at DESC);


--
-- TOC entry 4062 (class 1259 OID 28530)
-- Name: idx_chats_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chats_created_by ON public.chats USING btree (created_by);


--
-- TOC entry 4063 (class 1259 OID 28529)
-- Name: idx_chats_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chats_type ON public.chats USING btree (type);


--
-- TOC entry 4248 (class 1259 OID 29326)
-- Name: idx_default_map_pool_game_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_default_map_pool_game_order ON public.default_map_pool USING btree (game, display_order);


--
-- TOC entry 4125 (class 1259 OID 26500)
-- Name: idx_dota_profiles_steam_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dota_profiles_steam_id ON public.dota_profiles USING btree (steam_id);


--
-- TOC entry 4126 (class 1259 OID 26501)
-- Name: idx_dota_profiles_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dota_profiles_updated_at ON public.dota_profiles USING btree (updated_at);


--
-- TOC entry 4127 (class 1259 OID 26499)
-- Name: idx_dota_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dota_profiles_user_id ON public.dota_profiles USING btree (user_id);


--
-- TOC entry 4267 (class 1259 OID 31871)
-- Name: idx_fms_tournament_round; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fms_tournament_round ON public.full_mix_snapshots USING btree (tournament_id, round_number);


--
-- TOC entry 4055 (class 1259 OID 26190)
-- Name: idx_friends_friend_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friends_friend_id ON public.friends USING btree (friend_id);


--
-- TOC entry 4056 (class 1259 OID 26189)
-- Name: idx_friends_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friends_user_id ON public.friends USING btree (user_id);


--
-- TOC entry 4272 (class 1259 OID 31984)
-- Name: idx_full_mix_previews_tid_round; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_full_mix_previews_tid_round ON public.full_mix_previews USING btree (tournament_id, round_number);


--
-- TOC entry 4262 (class 1259 OID 31786)
-- Name: idx_fullmix_settings_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fullmix_settings_tournament ON public.tournament_full_mix_settings USING btree (tournament_id);


--
-- TOC entry 4268 (class 1259 OID 31804)
-- Name: idx_fullmix_snapshots_t_round; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_fullmix_snapshots_t_round ON public.full_mix_snapshots USING btree (tournament_id, round_number);


--
-- TOC entry 4269 (class 1259 OID 31946)
-- Name: idx_fullmix_snapshots_tid_round; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fullmix_snapshots_tid_round ON public.full_mix_snapshots USING btree (tournament_id, round_number);


--
-- TOC entry 4237 (class 1259 OID 33265)
-- Name: idx_invites_user_lobby; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invites_user_lobby ON public.lobby_invitations USING btree (user_id, lobby_id);


--
-- TOC entry 4238 (class 1259 OID 28895)
-- Name: idx_lobby_invitations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lobby_invitations_status ON public.lobby_invitations USING btree (status);


--
-- TOC entry 4239 (class 1259 OID 28894)
-- Name: idx_lobby_invitations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lobby_invitations_user_id ON public.lobby_invitations USING btree (user_id);


--
-- TOC entry 4234 (class 1259 OID 28893)
-- Name: idx_map_selections_lobby_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_map_selections_lobby_id ON public.map_selections USING btree (lobby_id);


--
-- TOC entry 4092 (class 1259 OID 26385)
-- Name: idx_maps_game; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maps_game ON public.maps USING btree (game);


--
-- TOC entry 4227 (class 1259 OID 28890)
-- Name: idx_match_lobbies_match_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_match_lobbies_match_id ON public.match_lobbies USING btree (match_id);


--
-- TOC entry 4228 (class 1259 OID 28892)
-- Name: idx_match_lobbies_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_match_lobbies_status ON public.match_lobbies USING btree (status);


--
-- TOC entry 4229 (class 1259 OID 28891)
-- Name: idx_match_lobbies_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_match_lobbies_tournament_id ON public.match_lobbies USING btree (tournament_id);


--
-- TOC entry 3948 (class 1259 OID 28673)
-- Name: idx_matches_bracket_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_bracket_type ON public.matches USING btree (bracket_type);


--
-- TOC entry 3949 (class 1259 OID 28555)
-- Name: idx_matches_next_match; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_next_match ON public.matches USING btree (next_match_id);


--
-- TOC entry 3950 (class 1259 OID 28474)
-- Name: idx_matches_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_position ON public.matches USING btree (position_in_round);


--
-- TOC entry 3951 (class 1259 OID 28472)
-- Name: idx_matches_preliminary; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_preliminary ON public.matches USING btree (is_preliminary_round);


--
-- TOC entry 3952 (class 1259 OID 28467)
-- Name: idx_matches_round_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_round_name ON public.matches USING btree (round_name);


--
-- TOC entry 3953 (class 1259 OID 29102)
-- Name: idx_matches_special_types; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_special_types ON public.matches USING btree (tournament_id, bracket_type) WHERE ((bracket_type)::text = ANY ((ARRAY['loser_semifinal'::character varying, 'loser_final'::character varying, 'grand_final'::character varying, 'grand_final_reset'::character varying])::text[]));


--
-- TOC entry 3954 (class 1259 OID 28473)
-- Name: idx_matches_third_place; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_third_place ON public.matches USING btree (is_third_place_match);


--
-- TOC entry 3955 (class 1259 OID 31944)
-- Name: idx_matches_tid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_tid ON public.matches USING btree (tournament_id);


--
-- TOC entry 3956 (class 1259 OID 31945)
-- Name: idx_matches_tid_round; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_tid_round ON public.matches USING btree (tournament_id, round);


--
-- TOC entry 3957 (class 1259 OID 17841)
-- Name: idx_matches_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_tournament ON public.matches USING btree (tournament_id);


--
-- TOC entry 3958 (class 1259 OID 29098)
-- Name: idx_matches_tournament_match_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_tournament_match_number ON public.matches USING btree (tournament_id, tournament_match_number);


--
-- TOC entry 4078 (class 1259 OID 28535)
-- Name: idx_message_status_is_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_status_is_read ON public.message_status USING btree (is_read);


--
-- TOC entry 4079 (class 1259 OID 26271)
-- Name: idx_message_status_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_status_message_id ON public.message_status USING btree (message_id);


--
-- TOC entry 4080 (class 1259 OID 26272)
-- Name: idx_message_status_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_status_user_id ON public.message_status USING btree (user_id);


--
-- TOC entry 4071 (class 1259 OID 26269)
-- Name: idx_messages_chat_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_chat_id ON public.messages USING btree (chat_id);


--
-- TOC entry 4072 (class 1259 OID 33277)
-- Name: idx_messages_chat_sender_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_chat_sender_created ON public.messages USING btree (chat_id, sender_id, created_at DESC);


--
-- TOC entry 4073 (class 1259 OID 28533)
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);


--
-- TOC entry 4074 (class 1259 OID 29950)
-- Name: idx_messages_message_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_message_type ON public.messages USING btree (message_type);


--
-- TOC entry 4075 (class 1259 OID 26270)
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


--
-- TOC entry 4116 (class 1259 OID 26479)
-- Name: idx_organization_requests_reviewed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organization_requests_reviewed_by ON public.organization_requests USING btree (reviewed_by);


--
-- TOC entry 4117 (class 1259 OID 26478)
-- Name: idx_organization_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organization_requests_status ON public.organization_requests USING btree (status);


--
-- TOC entry 4118 (class 1259 OID 26477)
-- Name: idx_organization_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organization_requests_user_id ON public.organization_requests USING btree (user_id);


--
-- TOC entry 4104 (class 1259 OID 26450)
-- Name: idx_organizer_members_organizer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizer_members_organizer ON public.organizer_members USING btree (organizer_id);


--
-- TOC entry 4105 (class 1259 OID 26451)
-- Name: idx_organizer_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizer_members_user ON public.organizer_members USING btree (user_id);


--
-- TOC entry 4098 (class 1259 OID 26449)
-- Name: idx_organizers_manager; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizers_manager ON public.organizers USING btree (manager_user_id);


--
-- TOC entry 4099 (class 1259 OID 26448)
-- Name: idx_organizers_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizers_slug ON public.organizers USING btree (slug);


--
-- TOC entry 4003 (class 1259 OID 28221)
-- Name: idx_password_reset_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_token ON public.users USING btree (password_reset_token);


--
-- TOC entry 4201 (class 1259 OID 28655)
-- Name: idx_referral_links_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_links_expires_at ON public.referral_links USING btree (expires_at);


--
-- TOC entry 4202 (class 1259 OID 28665)
-- Name: idx_referral_links_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_links_is_active ON public.referral_links USING btree (is_active);


--
-- TOC entry 4203 (class 1259 OID 28654)
-- Name: idx_referral_links_referral_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_links_referral_code ON public.referral_links USING btree (referral_code);


--
-- TOC entry 4204 (class 1259 OID 28653)
-- Name: idx_referral_links_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_links_tournament_id ON public.referral_links USING btree (tournament_id);


--
-- TOC entry 4205 (class 1259 OID 28652)
-- Name: idx_referral_links_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_links_user_id ON public.referral_links USING btree (user_id);


--
-- TOC entry 4210 (class 1259 OID 28657)
-- Name: idx_referral_registrations_referred_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_registrations_referred_user_id ON public.referral_registrations USING btree (referred_user_id);


--
-- TOC entry 4211 (class 1259 OID 28656)
-- Name: idx_referral_registrations_referrer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_registrations_referrer_id ON public.referral_registrations USING btree (referrer_id);


--
-- TOC entry 4212 (class 1259 OID 28658)
-- Name: idx_referral_registrations_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_registrations_tournament_id ON public.referral_registrations USING btree (tournament_id);


--
-- TOC entry 4197 (class 1259 OID 28495)
-- Name: idx_round_config_round; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_round_config_round ON public.tournament_round_config USING btree (round_number);


--
-- TOC entry 4198 (class 1259 OID 28494)
-- Name: idx_round_config_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_round_config_tournament ON public.tournament_round_config USING btree (tournament_id);


--
-- TOC entry 4165 (class 1259 OID 28185)
-- Name: idx_tournament_admins_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_admins_tournament_id ON public.tournament_admins USING btree (tournament_id);


--
-- TOC entry 4166 (class 1259 OID 28187)
-- Name: idx_tournament_admins_tournament_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_admins_tournament_user ON public.tournament_admins USING btree (tournament_id, user_id);


--
-- TOC entry 4167 (class 1259 OID 28186)
-- Name: idx_tournament_admins_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_admins_user_id ON public.tournament_admins USING btree (user_id);


--
-- TOC entry 3989 (class 1259 OID 17842)
-- Name: idx_tournament_format; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_format ON public.tournaments USING btree (format);


--
-- TOC entry 4085 (class 1259 OID 26305)
-- Name: idx_tournament_invitations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_invitations_status ON public.tournament_invitations USING btree (status);


--
-- TOC entry 4086 (class 1259 OID 26304)
-- Name: idx_tournament_invitations_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_invitations_tournament_id ON public.tournament_invitations USING btree (tournament_id);


--
-- TOC entry 4087 (class 1259 OID 26303)
-- Name: idx_tournament_invitations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_invitations_user_id ON public.tournament_invitations USING btree (user_id);


--
-- TOC entry 4217 (class 1259 OID 28698)
-- Name: idx_tournament_lobby_settings_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_lobby_settings_tournament_id ON public.tournament_lobby_settings USING btree (tournament_id);


--
-- TOC entry 4128 (class 1259 OID 26530)
-- Name: idx_tournament_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_logs_created_at ON public.tournament_logs USING btree (created_at DESC);


--
-- TOC entry 4129 (class 1259 OID 26531)
-- Name: idx_tournament_logs_event_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_logs_event_type ON public.tournament_logs USING btree (event_type);


--
-- TOC entry 4130 (class 1259 OID 26529)
-- Name: idx_tournament_logs_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_logs_tournament_id ON public.tournament_logs USING btree (tournament_id);


--
-- TOC entry 4131 (class 1259 OID 28195)
-- Name: idx_tournament_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_logs_user_id ON public.tournament_logs USING btree (user_id);


--
-- TOC entry 4222 (class 1259 OID 28889)
-- Name: idx_tournament_maps_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_maps_tournament_id ON public.tournament_maps USING btree (tournament_id);


--
-- TOC entry 4110 (class 1259 OID 26453)
-- Name: idx_tournament_organizers_organizer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_organizers_organizer ON public.tournament_organizers USING btree (organizer_id);


--
-- TOC entry 4111 (class 1259 OID 26452)
-- Name: idx_tournament_organizers_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_organizers_tournament ON public.tournament_organizers USING btree (tournament_id);


--
-- TOC entry 3969 (class 1259 OID 27992)
-- Name: idx_tournament_participants_cs2_premier_rank; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_participants_cs2_premier_rank ON public.tournament_participants USING btree (cs2_premier_rank) WHERE (cs2_premier_rank IS NOT NULL);


--
-- TOC entry 3970 (class 1259 OID 27991)
-- Name: idx_tournament_participants_faceit_elo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_participants_faceit_elo ON public.tournament_participants USING btree (faceit_elo) WHERE (faceit_elo IS NOT NULL);


--
-- TOC entry 3971 (class 1259 OID 27988)
-- Name: idx_tournament_participants_in_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_participants_in_team ON public.tournament_participants USING btree (tournament_id, in_team);


--
-- TOC entry 4257 (class 1259 OID 30138)
-- Name: idx_tournament_promotions_final; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_promotions_final ON public.tournament_promotions USING btree (final_tournament_id);


--
-- TOC entry 4251 (class 1259 OID 30115)
-- Name: idx_tournament_qualifiers_final; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_qualifiers_final ON public.tournament_qualifiers USING btree (final_tournament_id);


--
-- TOC entry 4252 (class 1259 OID 30116)
-- Name: idx_tournament_qualifiers_qualifier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_qualifiers_qualifier ON public.tournament_qualifiers USING btree (qualifier_tournament_id);


--
-- TOC entry 4026 (class 1259 OID 28583)
-- Name: idx_tournament_team_members_captain_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_team_members_captain_rating ON public.tournament_team_members USING btree (captain_rating) WHERE (captain_rating IS NOT NULL);


--
-- TOC entry 4027 (class 1259 OID 28582)
-- Name: idx_tournament_team_members_is_captain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_team_members_is_captain ON public.tournament_team_members USING btree (is_captain) WHERE (is_captain = true);


--
-- TOC entry 4028 (class 1259 OID 26317)
-- Name: idx_tournament_team_members_participant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_team_members_participant_id ON public.tournament_team_members USING btree (participant_id);


--
-- TOC entry 4029 (class 1259 OID 26311)
-- Name: idx_tournament_team_members_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_team_members_team_id ON public.tournament_team_members USING btree (team_id);


--
-- TOC entry 3981 (class 1259 OID 26310)
-- Name: idx_tournament_teams_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_teams_tournament_id ON public.tournament_teams USING btree (tournament_id);


--
-- TOC entry 3990 (class 1259 OID 28667)
-- Name: idx_tournaments_bracket_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_bracket_type ON public.tournaments USING btree (bracket_type);


--
-- TOC entry 3991 (class 1259 OID 28016)
-- Name: idx_tournaments_chat_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_chat_id ON public.tournaments USING btree (chat_id);


--
-- TOC entry 3992 (class 1259 OID 29106)
-- Name: idx_tournaments_completed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_completed_at ON public.tournaments USING btree (completed_at);


--
-- TOC entry 3993 (class 1259 OID 28563)
-- Name: idx_tournaments_cs2_participants; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_cs2_participants ON public.tournaments USING btree (game, participant_type, format) WHERE ((game)::text = 'Counter-Strike 2'::text);


--
-- TOC entry 3994 (class 1259 OID 33238)
-- Name: idx_tournaments_is_hidden; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_is_hidden ON public.tournaments USING btree (is_hidden);


--
-- TOC entry 3995 (class 1259 OID 28561)
-- Name: idx_tournaments_participant_type_game; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_participant_type_game ON public.tournaments USING btree (participant_type, game);


--
-- TOC entry 3996 (class 1259 OID 27973)
-- Name: idx_tournaments_second_place_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_second_place_id ON public.tournaments USING btree (second_place_id);


--
-- TOC entry 3997 (class 1259 OID 28549)
-- Name: idx_tournaments_seeding_config_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_seeding_config_gin ON public.tournaments USING gin (seeding_config);


--
-- TOC entry 3998 (class 1259 OID 28545)
-- Name: idx_tournaments_seeding_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_seeding_type ON public.tournaments USING btree (seeding_type);


--
-- TOC entry 3999 (class 1259 OID 27974)
-- Name: idx_tournaments_third_place_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_third_place_id ON public.tournaments USING btree (third_place_id);


--
-- TOC entry 4000 (class 1259 OID 27972)
-- Name: idx_tournaments_winner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_winner_id ON public.tournaments USING btree (winner_id);


--
-- TOC entry 3972 (class 1259 OID 29177)
-- Name: idx_tp_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tp_tournament_id ON public.tournament_participants USING btree (tournament_id);


--
-- TOC entry 3982 (class 1259 OID 29176)
-- Name: idx_tt_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tt_tournament_id ON public.tournament_teams USING btree (tournament_id);


--
-- TOC entry 4030 (class 1259 OID 29175)
-- Name: idx_ttm_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ttm_team_id ON public.tournament_team_members USING btree (team_id);


--
-- TOC entry 4142 (class 1259 OID 27941)
-- Name: idx_user_achievements_achievement; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_achievement ON public.user_achievements USING btree (achievement_id);


--
-- TOC entry 4143 (class 1259 OID 26685)
-- Name: idx_user_achievements_achievement_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_achievement_id ON public.user_achievements USING btree (achievement_id);


--
-- TOC entry 4144 (class 1259 OID 27942)
-- Name: idx_user_achievements_unlocked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_unlocked ON public.user_achievements USING btree (unlocked_at);


--
-- TOC entry 4145 (class 1259 OID 27940)
-- Name: idx_user_achievements_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_user ON public.user_achievements USING btree (user_id);


--
-- TOC entry 4146 (class 1259 OID 26684)
-- Name: idx_user_achievements_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_user_id ON public.user_achievements USING btree (user_id);


--
-- TOC entry 4164 (class 1259 OID 27945)
-- Name: idx_user_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action ON public.achievement_action_logs USING btree (user_id, action_type);


--
-- TOC entry 4155 (class 1259 OID 27943)
-- Name: idx_user_progress_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_progress_level ON public.user_progress USING btree (level);


--
-- TOC entry 4156 (class 1259 OID 27944)
-- Name: idx_user_progress_xp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_progress_xp ON public.user_progress USING btree (total_xp);


--
-- TOC entry 4190 (class 1259 OID 28407)
-- Name: idx_user_team_invitations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_team_invitations_status ON public.user_team_invitations USING btree (status);


--
-- TOC entry 4191 (class 1259 OID 28405)
-- Name: idx_user_team_invitations_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_team_invitations_team ON public.user_team_invitations USING btree (team_id);


--
-- TOC entry 4192 (class 1259 OID 28406)
-- Name: idx_user_team_invitations_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_team_invitations_user ON public.user_team_invitations USING btree (invited_user_id);


--
-- TOC entry 4184 (class 1259 OID 28403)
-- Name: idx_user_team_members_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_team_members_team ON public.user_team_members USING btree (team_id);


--
-- TOC entry 4185 (class 1259 OID 28404)
-- Name: idx_user_team_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_team_members_user ON public.user_team_members USING btree (user_id);


--
-- TOC entry 4180 (class 1259 OID 28401)
-- Name: idx_user_teams_captain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_teams_captain ON public.user_teams USING btree (captain_id);


--
-- TOC entry 4181 (class 1259 OID 28402)
-- Name: idx_user_teams_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_teams_tournament ON public.user_teams USING btree (tournament_id);


--
-- TOC entry 4042 (class 1259 OID 26536)
-- Name: idx_user_tournament_stats_is_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_is_team ON public.user_tournament_stats USING btree (is_team);


--
-- TOC entry 4043 (class 1259 OID 27976)
-- Name: idx_user_tournament_stats_is_team_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_is_team_member ON public.user_tournament_stats USING btree (is_team_member);


--
-- TOC entry 4044 (class 1259 OID 26547)
-- Name: idx_user_tournament_stats_performance; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_performance ON public.user_tournament_stats USING btree (user_id, wins, final_position);


--
-- TOC entry 4045 (class 1259 OID 26535)
-- Name: idx_user_tournament_stats_result; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_result ON public.user_tournament_stats USING btree (result);


--
-- TOC entry 4046 (class 1259 OID 27975)
-- Name: idx_user_tournament_stats_team_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_team_name ON public.user_tournament_stats USING btree (team_name);


--
-- TOC entry 4047 (class 1259 OID 26534)
-- Name: idx_user_tournament_stats_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_tournament_id ON public.user_tournament_stats USING btree (tournament_id);


--
-- TOC entry 4048 (class 1259 OID 26533)
-- Name: idx_user_tournament_stats_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_user_id ON public.user_tournament_stats USING btree (user_id);


--
-- TOC entry 4004 (class 1259 OID 33430)
-- Name: idx_users_email_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email_trgm ON public.users USING gin (email public.gin_trgm_ops);


--
-- TOC entry 4005 (class 1259 OID 28650)
-- Name: idx_users_invited_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_invited_by ON public.users USING btree (invited_by);


--
-- TOC entry 4006 (class 1259 OID 28008)
-- Name: idx_users_last_notifications_seen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_last_notifications_seen ON public.users USING btree (last_notifications_seen);


--
-- TOC entry 4007 (class 1259 OID 28651)
-- Name: idx_users_referral_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_referral_code ON public.users USING btree (referral_code);


--
-- TOC entry 4008 (class 1259 OID 28266)
-- Name: idx_users_steam_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_steam_id ON public.users USING btree (steam_id) WHERE (steam_id IS NOT NULL);


--
-- TOC entry 4009 (class 1259 OID 28267)
-- Name: idx_users_steam_nickname_cache; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_steam_nickname_cache ON public.users USING btree (steam_nickname_updated) WHERE (steam_nickname_updated IS NOT NULL);


--
-- TOC entry 4010 (class 1259 OID 33429)
-- Name: idx_users_username_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username_trgm ON public.users USING gin (username public.gin_trgm_ops);


--
-- TOC entry 4011 (class 1259 OID 29193)
-- Name: idx_users_verification_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_verification_token ON public.users USING btree (verification_token);


--
-- TOC entry 4093 (class 1259 OID 26364)
-- Name: maps_game_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX maps_game_idx ON public.maps USING btree (game);


--
-- TOC entry 4387 (class 2620 OID 28329)
-- Name: admin_invitations admin_invitation_notification_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER admin_invitation_notification_trigger AFTER INSERT ON public.admin_invitations FOR EACH ROW WHEN (((new.status)::text = 'pending'::text)) EXECUTE FUNCTION public.send_admin_invitation_notification();


--
-- TOC entry 4388 (class 2620 OID 28317)
-- Name: admin_invitations auto_cleanup_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER auto_cleanup_trigger BEFORE INSERT ON public.admin_invitations FOR EACH STATEMENT EXECUTE FUNCTION public.auto_cleanup_expired_invitations();


--
-- TOC entry 4378 (class 2620 OID 28538)
-- Name: messages create_message_status_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER create_message_status_trigger AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.create_message_status_for_participants();


--
-- TOC entry 4372 (class 2620 OID 28671)
-- Name: tournaments tournaments_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tournaments_updated_at_trigger BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.update_tournaments_updated_at();


--
-- TOC entry 4370 (class 2620 OID 29170)
-- Name: tournament_participants trg_tp_aiud_recalc_players; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_tp_aiud_recalc_players AFTER INSERT OR DELETE OR UPDATE ON public.tournament_participants FOR EACH ROW EXECUTE FUNCTION public.trg_tp_after_change();


--
-- TOC entry 4371 (class 2620 OID 29174)
-- Name: tournament_teams trg_tt_aiud_recalc_players; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_tt_aiud_recalc_players AFTER INSERT OR DELETE OR UPDATE ON public.tournament_teams FOR EACH ROW EXECUTE FUNCTION public.trg_tt_after_change();


--
-- TOC entry 4375 (class 2620 OID 29172)
-- Name: tournament_team_members trg_ttm_aiud_recalc_players; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ttm_aiud_recalc_players AFTER INSERT OR DELETE OR UPDATE ON public.tournament_team_members FOR EACH ROW EXECUTE FUNCTION public.trg_ttm_after_change();


--
-- TOC entry 4374 (class 2620 OID 29206)
-- Name: users trigger_auto_generate_user_referral_code; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_auto_generate_user_referral_code BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.auto_generate_user_referral_code();


--
-- TOC entry 4369 (class 2620 OID 28499)
-- Name: matches trigger_update_match_round_names; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_match_round_names BEFORE INSERT OR UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_match_round_names();


--
-- TOC entry 4373 (class 2620 OID 28548)
-- Name: tournaments trigger_validate_seeding_config; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_validate_seeding_config BEFORE INSERT OR UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.validate_seeding_config();


--
-- TOC entry 4385 (class 2620 OID 27947)
-- Name: achievement_categories update_achievement_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_achievement_categories_updated_at BEFORE UPDATE ON public.achievement_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4384 (class 2620 OID 27948)
-- Name: achievements update_achievements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_achievements_updated_at BEFORE UPDATE ON public.achievements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4376 (class 2620 OID 28517)
-- Name: admin_requests update_admin_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_admin_requests_updated_at BEFORE UPDATE ON public.admin_requests FOR EACH ROW EXECUTE FUNCTION public.update_admin_updated_at_column();


--
-- TOC entry 4379 (class 2620 OID 28536)
-- Name: messages update_chat_timestamp_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_chat_timestamp_trigger AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_chat_timestamp();


--
-- TOC entry 4383 (class 2620 OID 26532)
-- Name: dota_profiles update_dota_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_dota_profiles_updated_at BEFORE UPDATE ON public.dota_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4391 (class 2620 OID 28897)
-- Name: match_lobbies update_match_lobbies_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_match_lobbies_updated_at BEFORE UPDATE ON public.match_lobbies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4382 (class 2620 OID 26480)
-- Name: organization_requests update_organization_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_organization_requests_updated_at BEFORE UPDATE ON public.organization_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4381 (class 2620 OID 26454)
-- Name: organizers update_organizers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_organizers_updated_at BEFORE UPDATE ON public.organizers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4392 (class 2620 OID 31787)
-- Name: tournament_full_mix_settings update_tournament_full_mix_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_tournament_full_mix_settings_updated_at BEFORE UPDATE ON public.tournament_full_mix_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4380 (class 2620 OID 26307)
-- Name: tournament_invitations update_tournament_invitations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_tournament_invitations_updated_at BEFORE UPDATE ON public.tournament_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4390 (class 2620 OID 28896)
-- Name: tournament_lobby_settings update_tournament_lobby_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_tournament_lobby_settings_updated_at BEFORE UPDATE ON public.tournament_lobby_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4386 (class 2620 OID 27949)
-- Name: user_progress update_user_progress_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON public.user_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4377 (class 2620 OID 26537)
-- Name: user_tournament_stats update_user_tournament_stats_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_tournament_stats_updated_at BEFORE UPDATE ON public.user_tournament_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4389 (class 2620 OID 28409)
-- Name: user_teams user_teams_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_teams_updated_at_trigger BEFORE UPDATE ON public.user_teams FOR EACH ROW EXECUTE FUNCTION public.update_user_teams_updated_at();


--
-- TOC entry 4331 (class 2606 OID 27921)
-- Name: achievement_action_logs achievement_action_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_action_logs
    ADD CONSTRAINT achievement_action_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4327 (class 2606 OID 27930)
-- Name: achievements achievements_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.achievement_categories(id);


--
-- TOC entry 4335 (class 2606 OID 28180)
-- Name: admin_invitations admin_invitations_invitee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4336 (class 2606 OID 28175)
-- Name: admin_invitations admin_invitations_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4337 (class 2606 OID 28170)
-- Name: admin_invitations admin_invitations_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4300 (class 2606 OID 18128)
-- Name: admin_requests admin_requests_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_requests
    ADD CONSTRAINT admin_requests_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4301 (class 2606 OID 18133)
-- Name: admin_requests admin_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_requests
    ADD CONSTRAINT admin_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4306 (class 2606 OID 26215)
-- Name: chat_participants chat_participants_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- TOC entry 4307 (class 2606 OID 26220)
-- Name: chat_participants chat_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4324 (class 2606 OID 26494)
-- Name: dota_profiles dota_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dota_profiles
    ADD CONSTRAINT dota_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4282 (class 2606 OID 26325)
-- Name: tournament_participants fk_invited_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT fk_invited_user FOREIGN KEY (invited_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4273 (class 2606 OID 18195)
-- Name: matches fk_loser_next_match; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT fk_loser_next_match FOREIGN KEY (loser_next_match_id) REFERENCES public.matches(id);


--
-- TOC entry 4293 (class 2606 OID 28411)
-- Name: notifications fk_notifications_team_invitation; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notifications_team_invitation FOREIGN KEY (team_invitation_id) REFERENCES public.user_team_invitations(id) ON DELETE CASCADE;


--
-- TOC entry 4283 (class 2606 OID 18222)
-- Name: tournament_participants fk_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4304 (class 2606 OID 26184)
-- Name: friends friends_friend_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4305 (class 2606 OID 26179)
-- Name: friends friends_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4368 (class 2606 OID 31799)
-- Name: full_mix_snapshots full_mix_snapshots_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.full_mix_snapshots
    ADD CONSTRAINT full_mix_snapshots_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4360 (class 2606 OID 28874)
-- Name: lobby_invitations lobby_invitations_lobby_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lobby_invitations
    ADD CONSTRAINT lobby_invitations_lobby_id_fkey FOREIGN KEY (lobby_id) REFERENCES public.match_lobbies(id) ON DELETE CASCADE;


--
-- TOC entry 4361 (class 2606 OID 28884)
-- Name: lobby_invitations lobby_invitations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lobby_invitations
    ADD CONSTRAINT lobby_invitations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tournament_teams(id);


--
-- TOC entry 4362 (class 2606 OID 28879)
-- Name: lobby_invitations lobby_invitations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lobby_invitations
    ADD CONSTRAINT lobby_invitations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4358 (class 2606 OID 28853)
-- Name: map_selections map_selections_lobby_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.map_selections
    ADD CONSTRAINT map_selections_lobby_id_fkey FOREIGN KEY (lobby_id) REFERENCES public.match_lobbies(id) ON DELETE CASCADE;


--
-- TOC entry 4359 (class 2606 OID 32576)
-- Name: map_selections map_selections_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.map_selections
    ADD CONSTRAINT map_selections_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tournament_teams(id) ON DELETE SET NULL;


--
-- TOC entry 4354 (class 2606 OID 28840)
-- Name: match_lobbies match_lobbies_current_turn_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_lobbies
    ADD CONSTRAINT match_lobbies_current_turn_team_id_fkey FOREIGN KEY (current_turn_team_id) REFERENCES public.tournament_teams(id);


--
-- TOC entry 4355 (class 2606 OID 28835)
-- Name: match_lobbies match_lobbies_first_picker_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_lobbies
    ADD CONSTRAINT match_lobbies_first_picker_team_id_fkey FOREIGN KEY (first_picker_team_id) REFERENCES public.tournament_teams(id);


--
-- TOC entry 4356 (class 2606 OID 28825)
-- Name: match_lobbies match_lobbies_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_lobbies
    ADD CONSTRAINT match_lobbies_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- TOC entry 4357 (class 2606 OID 28830)
-- Name: match_lobbies match_lobbies_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_lobbies
    ADD CONSTRAINT match_lobbies_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4274 (class 2606 OID 18190)
-- Name: matches matches_loser_next_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_loser_next_match_id_fkey FOREIGN KEY (loser_next_match_id) REFERENCES public.matches(id);


--
-- TOC entry 4275 (class 2606 OID 18185)
-- Name: matches matches_next_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_next_match_id_fkey FOREIGN KEY (next_match_id) REFERENCES public.matches(id);


--
-- TOC entry 4276 (class 2606 OID 18164)
-- Name: matches matches_source_match1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_source_match1_id_fkey FOREIGN KEY (source_match1_id) REFERENCES public.matches(id);


--
-- TOC entry 4277 (class 2606 OID 18169)
-- Name: matches matches_source_match2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_source_match2_id_fkey FOREIGN KEY (source_match2_id) REFERENCES public.matches(id);


--
-- TOC entry 4278 (class 2606 OID 17843)
-- Name: matches matches_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4310 (class 2606 OID 26257)
-- Name: message_status message_status_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- TOC entry 4311 (class 2606 OID 26262)
-- Name: message_status message_status_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4308 (class 2606 OID 26237)
-- Name: messages messages_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- TOC entry 4309 (class 2606 OID 26242)
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4294 (class 2606 OID 18148)
-- Name: notifications notifications_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4295 (class 2606 OID 18143)
-- Name: notifications notifications_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4296 (class 2606 OID 18079)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4322 (class 2606 OID 26472)
-- Name: organization_requests organization_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests
    ADD CONSTRAINT organization_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- TOC entry 4323 (class 2606 OID 26467)
-- Name: organization_requests organization_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests
    ADD CONSTRAINT organization_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4318 (class 2606 OID 26418)
-- Name: organizer_members organizer_members_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizer_members
    ADD CONSTRAINT organizer_members_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- TOC entry 4319 (class 2606 OID 26423)
-- Name: organizer_members organizer_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizer_members
    ADD CONSTRAINT organizer_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4317 (class 2606 OID 26401)
-- Name: organizers organizers_manager_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_manager_user_id_fkey FOREIGN KEY (manager_user_id) REFERENCES public.users(id);


--
-- TOC entry 4279 (class 2606 OID 17848)
-- Name: participants participants_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4280 (class 2606 OID 17853)
-- Name: player_stats player_stats_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- TOC entry 4281 (class 2606 OID 17858)
-- Name: player_stats player_stats_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- TOC entry 4346 (class 2606 OID 28614)
-- Name: referral_links referral_links_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_links
    ADD CONSTRAINT referral_links_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4347 (class 2606 OID 28609)
-- Name: referral_links referral_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_links
    ADD CONSTRAINT referral_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4348 (class 2606 OID 28645)
-- Name: referral_registrations referral_registrations_referral_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_registrations
    ADD CONSTRAINT referral_registrations_referral_link_id_fkey FOREIGN KEY (referral_link_id) REFERENCES public.referral_links(id) ON DELETE CASCADE;


--
-- TOC entry 4349 (class 2606 OID 28635)
-- Name: referral_registrations referral_registrations_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_registrations
    ADD CONSTRAINT referral_registrations_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4350 (class 2606 OID 28630)
-- Name: referral_registrations referral_registrations_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_registrations
    ADD CONSTRAINT referral_registrations_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4351 (class 2606 OID 28640)
-- Name: referral_registrations referral_registrations_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_registrations
    ADD CONSTRAINT referral_registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4332 (class 2606 OID 28148)
-- Name: tournament_admins tournament_admins_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins
    ADD CONSTRAINT tournament_admins_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- TOC entry 4333 (class 2606 OID 28138)
-- Name: tournament_admins tournament_admins_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins
    ADD CONSTRAINT tournament_admins_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4334 (class 2606 OID 28143)
-- Name: tournament_admins tournament_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins
    ADD CONSTRAINT tournament_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4367 (class 2606 OID 31781)
-- Name: tournament_full_mix_settings tournament_full_mix_settings_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_full_mix_settings
    ADD CONSTRAINT tournament_full_mix_settings_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4312 (class 2606 OID 26298)
-- Name: tournament_invitations tournament_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations
    ADD CONSTRAINT tournament_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4313 (class 2606 OID 26288)
-- Name: tournament_invitations tournament_invitations_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations
    ADD CONSTRAINT tournament_invitations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4314 (class 2606 OID 26293)
-- Name: tournament_invitations tournament_invitations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations
    ADD CONSTRAINT tournament_invitations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4352 (class 2606 OID 28693)
-- Name: tournament_lobby_settings tournament_lobby_settings_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_lobby_settings
    ADD CONSTRAINT tournament_lobby_settings_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4325 (class 2606 OID 26519)
-- Name: tournament_logs tournament_logs_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_logs
    ADD CONSTRAINT tournament_logs_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4326 (class 2606 OID 26524)
-- Name: tournament_logs tournament_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_logs
    ADD CONSTRAINT tournament_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4353 (class 2606 OID 28806)
-- Name: tournament_maps tournament_maps_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_maps
    ADD CONSTRAINT tournament_maps_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4315 (class 2606 OID 26380)
-- Name: tournament_messages tournament_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_messages
    ADD CONSTRAINT tournament_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4316 (class 2606 OID 26375)
-- Name: tournament_messages tournament_messages_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_messages
    ADD CONSTRAINT tournament_messages_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4320 (class 2606 OID 26443)
-- Name: tournament_organizers tournament_organizers_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_organizers
    ADD CONSTRAINT tournament_organizers_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- TOC entry 4321 (class 2606 OID 26438)
-- Name: tournament_organizers tournament_organizers_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_organizers
    ADD CONSTRAINT tournament_organizers_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4284 (class 2606 OID 17873)
-- Name: tournament_participants tournament_participants_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4285 (class 2606 OID 18110)
-- Name: tournament_participants tournament_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4365 (class 2606 OID 30128)
-- Name: tournament_promotions tournament_promotions_final_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_promotions
    ADD CONSTRAINT tournament_promotions_final_tournament_id_fkey FOREIGN KEY (final_tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4366 (class 2606 OID 30133)
-- Name: tournament_promotions tournament_promotions_qualifier_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_promotions
    ADD CONSTRAINT tournament_promotions_qualifier_tournament_id_fkey FOREIGN KEY (qualifier_tournament_id) REFERENCES public.tournaments(id) ON DELETE SET NULL;


--
-- TOC entry 4363 (class 2606 OID 30105)
-- Name: tournament_qualifiers tournament_qualifiers_final_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_qualifiers
    ADD CONSTRAINT tournament_qualifiers_final_tournament_id_fkey FOREIGN KEY (final_tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4364 (class 2606 OID 30110)
-- Name: tournament_qualifiers tournament_qualifiers_qualifier_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_qualifiers
    ADD CONSTRAINT tournament_qualifiers_qualifier_tournament_id_fkey FOREIGN KEY (qualifier_tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4345 (class 2606 OID 28489)
-- Name: tournament_round_config tournament_round_config_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_round_config
    ADD CONSTRAINT tournament_round_config_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4297 (class 2606 OID 26312)
-- Name: tournament_team_members tournament_team_members_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members
    ADD CONSTRAINT tournament_team_members_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.tournament_participants(id) ON DELETE CASCADE;


--
-- TOC entry 4298 (class 2606 OID 18100)
-- Name: tournament_team_members tournament_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members
    ADD CONSTRAINT tournament_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tournament_teams(id) ON DELETE CASCADE;


--
-- TOC entry 4299 (class 2606 OID 18105)
-- Name: tournament_team_members tournament_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members
    ADD CONSTRAINT tournament_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4286 (class 2606 OID 17878)
-- Name: tournament_team_players tournament_team_players_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_players
    ADD CONSTRAINT tournament_team_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- TOC entry 4287 (class 2606 OID 17883)
-- Name: tournament_team_players tournament_team_players_tournament_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_players
    ADD CONSTRAINT tournament_team_players_tournament_team_id_fkey FOREIGN KEY (tournament_team_id) REFERENCES public.tournament_teams(id) ON DELETE CASCADE;


--
-- TOC entry 4288 (class 2606 OID 18084)
-- Name: tournament_teams tournament_teams_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4289 (class 2606 OID 17888)
-- Name: tournament_teams tournament_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- TOC entry 4290 (class 2606 OID 17893)
-- Name: tournament_teams tournament_teams_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4291 (class 2606 OID 28011)
-- Name: tournaments tournaments_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE SET NULL;


--
-- TOC entry 4328 (class 2606 OID 26676)
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- TOC entry 4329 (class 2606 OID 26671)
-- Name: user_achievements user_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4330 (class 2606 OID 27906)
-- Name: user_progress user_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4342 (class 2606 OID 28396)
-- Name: user_team_invitations user_team_invitations_invited_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_invitations
    ADD CONSTRAINT user_team_invitations_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4343 (class 2606 OID 28391)
-- Name: user_team_invitations user_team_invitations_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_invitations
    ADD CONSTRAINT user_team_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4344 (class 2606 OID 28386)
-- Name: user_team_invitations user_team_invitations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_invitations
    ADD CONSTRAINT user_team_invitations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.user_teams(id) ON DELETE CASCADE;


--
-- TOC entry 4340 (class 2606 OID 28363)
-- Name: user_team_members user_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_members
    ADD CONSTRAINT user_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.user_teams(id) ON DELETE CASCADE;


--
-- TOC entry 4341 (class 2606 OID 28368)
-- Name: user_team_members user_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_team_members
    ADD CONSTRAINT user_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4338 (class 2606 OID 28342)
-- Name: user_teams user_teams_captain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4339 (class 2606 OID 28347)
-- Name: user_teams user_teams_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE SET NULL;


--
-- TOC entry 4302 (class 2606 OID 18217)
-- Name: user_tournament_stats user_tournament_stats_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tournament_stats
    ADD CONSTRAINT user_tournament_stats_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 4303 (class 2606 OID 18212)
-- Name: user_tournament_stats user_tournament_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tournament_stats
    ADD CONSTRAINT user_tournament_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4292 (class 2606 OID 28588)
-- Name: users users_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4543 (class 0 OID 0)
-- Dependencies: 8
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- TOC entry 4548 (class 0 OID 0)
-- Dependencies: 391
-- Name: FUNCTION cleanup_expired_invitations(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_expired_invitations() TO app_role;


--
-- TOC entry 4549 (class 0 OID 0)
-- Dependencies: 402
-- Name: FUNCTION maintenance_cleanup(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.maintenance_cleanup() TO app_role;


--
-- TOC entry 4560 (class 0 OID 0)
-- Dependencies: 301
-- Name: TABLE admin_invitations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admin_invitations TO app_role;


--
-- TOC entry 4583 (class 0 OID 0)
-- Dependencies: 303
-- Name: TABLE active_admin_invitations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.active_admin_invitations TO app_role;


--
-- TOC entry 4585 (class 0 OID 0)
-- Dependencies: 300
-- Name: SEQUENCE admin_invitations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.admin_invitations_id_seq TO app_role;


--
-- TOC entry 4644 (class 0 OID 0)
-- Dependencies: 299
-- Name: TABLE tournament_admins; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tournament_admins TO app_role;


--
-- TOC entry 4646 (class 0 OID 0)
-- Dependencies: 298
-- Name: SEQUENCE tournament_admins_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.tournament_admins_id_seq TO app_role;


--
-- TOC entry 4647 (class 0 OID 0)
-- Dependencies: 302
-- Name: TABLE tournament_admins_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.tournament_admins_view TO app_role;


--
-- TOC entry 4661 (class 0 OID 0)
-- Dependencies: 286
-- Name: TABLE tournament_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tournament_logs TO app_role;


--
-- TOC entry 4663 (class 0 OID 0)
-- Dependencies: 285
-- Name: SEQUENCE tournament_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.tournament_logs_id_seq TO app_role;


--
-- TOC entry 4672 (class 0 OID 0)
-- Dependencies: 313
-- Name: TABLE tournament_seeding_info; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.tournament_seeding_info TO PUBLIC;


-- Completed on 2025-09-15 15:43:16

--
-- PostgreSQL database dump complete
--

