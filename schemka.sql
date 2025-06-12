--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Ubuntu 14.18-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 17.2

-- Started on 2025-06-12 17:04:33

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
-- TOC entry 6 (class 2615 OID 17571)
-- Name: pgagent; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA pgagent;


ALTER SCHEMA pgagent OWNER TO postgres;

--
-- TOC entry 4099 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA pgagent; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA pgagent IS 'pgAgent system tables';


--
-- TOC entry 2 (class 3079 OID 17572)
-- Name: pgagent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgagent WITH SCHEMA pgagent;


--
-- TOC entry 4101 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgagent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgagent IS 'A PostgreSQL job scheduler';


--
-- TOC entry 327 (class 1255 OID 28122)
-- Name: accept_admin_invitation(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.accept_admin_invitation(invitation_id integer, accepting_user_id integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    invitation_record RECORD;
    tournament_record RECORD;
BEGIN
    -- Получаем данные приглашения
    SELECT ai.*, t.name as tournament_name, t.created_by
    INTO invitation_record
    FROM admin_invitations ai
    JOIN tournaments t ON ai.tournament_id = t.id
    WHERE ai.id = invitation_id 
      AND ai.invitee_id = accepting_user_id 
      AND ai.status = 'pending'
      AND ai.expires_at > NOW();
    
    -- Проверяем, что приглашение найдено и валидно
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Проверяем, не является ли пользователь уже администратором
    IF EXISTS (
        SELECT 1 FROM tournament_admins 
        WHERE tournament_id = invitation_record.tournament_id 
          AND user_id = accepting_user_id
    ) THEN
        -- Обновляем статус приглашения, но не добавляем в админы повторно
        UPDATE admin_invitations 
        SET status = 'accepted', responded_at = NOW()
        WHERE id = invitation_id;
        RETURN TRUE;
    END IF;
    
    -- Добавляем пользователя в администраторы
    INSERT INTO tournament_admins (
        tournament_id, 
        user_id, 
        permissions,
        assigned_by,
        assigned_at
    ) VALUES (
        invitation_record.tournament_id,
        accepting_user_id,
        COALESCE(invitation_record.permissions, '{"manage_matches": true, "manage_participants": true, "invite_admins": false}'::jsonb),
        invitation_record.inviter_id,
        NOW()
    );
    
    -- Обновляем статус приглашения
    UPDATE admin_invitations 
    SET status = 'accepted', responded_at = NOW()
    WHERE id = invitation_id;
    
    -- Логируем событие (если таблица существует)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_logs') THEN
        INSERT INTO tournament_logs (tournament_id, user_id, event_type, event_data, created_at)
        VALUES (
            invitation_record.tournament_id,
            accepting_user_id,
            'admin_invitation_accepted',
            jsonb_build_object(
                'invitation_id', invitation_id,
                'tournament_name', invitation_record.tournament_name,
                'inviter_id', invitation_record.inviter_id
            ),
            NOW()
        );
    END IF;
    
    RETURN TRUE;
    
EXCEPTION WHEN OTHERS THEN
    -- В случае ошибки возвращаем FALSE
    RETURN FALSE;
END;
$$;


ALTER FUNCTION public.accept_admin_invitation(invitation_id integer, accepting_user_id integer) OWNER TO postgres;

--
-- TOC entry 322 (class 1255 OID 27950)
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
-- TOC entry 4103 (class 0 OID 0)
-- Dependencies: 322
-- Name: FUNCTION calculate_level_from_xp(xp integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.calculate_level_from_xp(xp integer) IS 'Вычисляет уровень игрока на основе накопленного XP';


--
-- TOC entry 321 (class 1255 OID 26687)
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
-- TOC entry 324 (class 1255 OID 27953)
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
-- TOC entry 4104 (class 0 OID 0)
-- Dependencies: 324
-- Name: FUNCTION check_and_unlock_achievements(p_user_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.check_and_unlock_achievements(p_user_id integer) IS 'Проверяет и разблокирует новые достижения для пользователя';


--
-- TOC entry 326 (class 1255 OID 28124)
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
-- TOC entry 328 (class 1255 OID 28123)
-- Name: decline_admin_invitation(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.decline_admin_invitation(invitation_id integer, declining_user_id integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    invitation_record RECORD;
BEGIN
    -- Получаем данные приглашения
    SELECT ai.*, t.name as tournament_name
    INTO invitation_record
    FROM admin_invitations ai
    JOIN tournaments t ON ai.tournament_id = t.id
    WHERE ai.id = invitation_id 
      AND ai.invitee_id = declining_user_id 
      AND ai.status = 'pending';
    
    -- Проверяем, что приглашение найдено
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Обновляем статус приглашения
    UPDATE admin_invitations 
    SET status = 'declined', responded_at = NOW()
    WHERE id = invitation_id;
    
    -- Логируем событие (если таблица существует)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_logs') THEN
        INSERT INTO tournament_logs (tournament_id, user_id, event_type, event_data, created_at)
        VALUES (
            invitation_record.tournament_id,
            declining_user_id,
            'admin_invitation_declined',
            jsonb_build_object(
                'invitation_id', invitation_id,
                'tournament_name', invitation_record.tournament_name,
                'inviter_id', invitation_record.inviter_id
            ),
            NOW()
        );
    END IF;
    
    RETURN TRUE;
    
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


ALTER FUNCTION public.decline_admin_invitation(invitation_id integer, declining_user_id integer) OWNER TO postgres;

--
-- TOC entry 329 (class 1255 OID 28206)
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
-- TOC entry 325 (class 1255 OID 28193)
-- Name: send_admin_invitation_notification(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.send_admin_invitation_notification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    tournament_record RECORD;
    inviter_record RECORD;
    system_user_id INTEGER;
    chat_id INTEGER;
    message_text TEXT;
BEGIN
    -- Получаем данные о турнире и пригласившем
    SELECT t.*, u.username as inviter_username
    INTO tournament_record
    FROM tournaments t
    JOIN users u ON NEW.inviter_id = u.id
    WHERE t.id = NEW.tournament_id;
    
    -- Получаем ID системного пользователя
    SELECT id INTO system_user_id 
    FROM users 
    WHERE username = '1337community' AND is_system_user = true
    LIMIT 1;
    
    -- Если системный пользователь найден, отправляем уведомление
    IF system_user_id IS NOT NULL THEN
        -- Ищем чат турнира
        SELECT id INTO chat_id
        FROM chats 
        WHERE name = tournament_record.name 
          AND type = 'group'
        LIMIT 1;
        
        -- Если чат найден, создаем сообщение
        IF chat_id IS NOT NULL THEN
            message_text := format(
                '🤝 %s приглашает вас стать администратором турнира "%s"!

Вы получите права на:
• Управление участниками
• Редактирование результатов матчей  
• Приглашение других администраторов

Приглашение действительно до: %s

Для ответа используйте команды в чате или перейдите на страницу турнира.',
                tournament_record.inviter_username,
                tournament_record.name,
                TO_CHAR(NEW.expires_at AT TIME ZONE 'Europe/Moscow', 'DD.MM.YYYY HH24:MI')
            );
            
            -- Создаем сообщение с метаданными для кнопок
            INSERT INTO messages (chat_id, sender_id, content, message_type, metadata, created_at)
            VALUES (
                chat_id,
                system_user_id,
                message_text,
                'admin_invitation',
                jsonb_build_object(
                    'invitation_id', NEW.id,
                    'tournament_id', NEW.tournament_id,
                    'inviter_id', NEW.inviter_id,
                    'invitee_id', NEW.invitee_id,
                    'actions', jsonb_build_array(
                        jsonb_build_object(
                            'type', 'accept_admin_invitation',
                            'label', '✅ Принять',
                            'invitation_id', NEW.id
                        ),
                        jsonb_build_object(
                            'type', 'decline_admin_invitation',
                            'label', '❌ Отклонить', 
                            'invitation_id', NEW.id
                        )
                    )
                ),
                NOW()
            );
        END IF;
    END IF;
    
    RETURN NEW;
    
EXCEPTION WHEN OTHERS THEN
    -- В случае ошибки не прерываем основную операцию
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.send_admin_invitation_notification() OWNER TO postgres;

--
-- TOC entry 311 (class 1255 OID 26273)
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
-- TOC entry 307 (class 1255 OID 26164)
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
-- TOC entry 318 (class 1255 OID 26306)
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
-- TOC entry 323 (class 1255 OID 27951)
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
-- TOC entry 4108 (class 0 OID 0)
-- Dependencies: 323
-- Name: FUNCTION update_user_progress(p_user_id integer, p_action_type character varying, p_action_data jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_user_progress(p_user_id integer, p_action_type character varying, p_action_data jsonb) IS 'Обновляет прогресс пользователя при выполнении действий';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 294 (class 1259 OID 27912)
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
-- TOC entry 4109 (class 0 OID 0)
-- Dependencies: 294
-- Name: TABLE achievement_action_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.achievement_action_logs IS 'Логи всех действий пользователей для отслеживания прогресса';


--
-- TOC entry 293 (class 1259 OID 27911)
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
-- TOC entry 4110 (class 0 OID 0)
-- Dependencies: 293
-- Name: achievement_action_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.achievement_action_logs_id_seq OWNED BY public.achievement_action_logs.id;


--
-- TOC entry 290 (class 1259 OID 27869)
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
-- TOC entry 4111 (class 0 OID 0)
-- Dependencies: 290
-- Name: TABLE achievement_categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.achievement_categories IS 'Категории достижений для группировки';


--
-- TOC entry 289 (class 1259 OID 27868)
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
-- TOC entry 4112 (class 0 OID 0)
-- Dependencies: 289
-- Name: achievement_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.achievement_categories_id_seq OWNED BY public.achievement_categories.id;


--
-- TOC entry 285 (class 1259 OID 26644)
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
-- TOC entry 4113 (class 0 OID 0)
-- Dependencies: 285
-- Name: TABLE achievements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.achievements IS 'Основная таблица всех доступных достижений';


--
-- TOC entry 284 (class 1259 OID 26643)
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
-- TOC entry 4114 (class 0 OID 0)
-- Dependencies: 284
-- Name: achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.achievements_id_seq OWNED BY public.achievements.id;


--
-- TOC entry 298 (class 1259 OID 28154)
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
    CONSTRAINT admin_invitations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.admin_invitations OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 17781)
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
    participant_type character varying(10),
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
    CONSTRAINT tournaments_participant_type_check CHECK (((participant_type)::text = ANY ((ARRAY['solo'::character varying, 'team'::character varying])::text[])))
);


ALTER TABLE public.tournaments OWNER TO postgres;

--
-- TOC entry 4116 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE tournaments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tournaments IS 'Обновлен турнир 59: изменен тип игры с "cs2" на "Counter-Strike 2" для корректной работы выбора карт';


--
-- TOC entry 4117 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN tournaments.winner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.winner_id IS 'ID победителя турнира (ссылка на tournament_participants или tournament_teams)';


--
-- TOC entry 4118 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN tournaments.winner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.winner_name IS 'Имя победителя турнира';


--
-- TOC entry 4119 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN tournaments.second_place_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.second_place_id IS 'ID участника, занявшего второе место';


--
-- TOC entry 4120 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN tournaments.second_place_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.second_place_name IS 'Имя участника, занявшего второе место';


--
-- TOC entry 4121 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN tournaments.third_place_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.third_place_id IS 'ID участника, занявшего третье место';


--
-- TOC entry 4122 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN tournaments.third_place_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.third_place_name IS 'Имя участника, занявшего третье место';


--
-- TOC entry 4123 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN tournaments.chat_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournaments.chat_id IS 'ID группового чата турнира';


--
-- TOC entry 244 (class 1259 OID 17792)
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
    avatar_url character varying(255),
    is_verified boolean DEFAULT false,
    verification_token character varying(255),
    token_expiry timestamp without time zone,
    cs2_premier_rank integer DEFAULT 0,
    faceit_elo integer DEFAULT 0,
    last_active timestamp without time zone DEFAULT now(),
    last_notifications_seen timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_system_user boolean DEFAULT false
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 300 (class 1259 OID 28201)
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
-- TOC entry 297 (class 1259 OID 28153)
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
-- TOC entry 4125 (class 0 OID 0)
-- Dependencies: 297
-- Name: admin_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_invitations_id_seq OWNED BY public.admin_invitations.id;


--
-- TOC entry 253 (class 1259 OID 18118)
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
-- TOC entry 252 (class 1259 OID 18117)
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
-- TOC entry 4127 (class 0 OID 0)
-- Dependencies: 252
-- Name: admin_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_requests_id_seq OWNED BY public.admin_requests.id;


--
-- TOC entry 261 (class 1259 OID 26203)
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
-- TOC entry 260 (class 1259 OID 26202)
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
-- TOC entry 4128 (class 0 OID 0)
-- Dependencies: 260
-- Name: chat_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_participants_id_seq OWNED BY public.chat_participants.id;


--
-- TOC entry 259 (class 1259 OID 26192)
-- Name: chats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chats (
    id integer NOT NULL,
    name character varying(100) DEFAULT NULL::character varying,
    type character varying(20) DEFAULT 'private'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chats OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 26191)
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
-- TOC entry 4129 (class 0 OID 0)
-- Dependencies: 258
-- Name: chats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chats_id_seq OWNED BY public.chats.id;


--
-- TOC entry 281 (class 1259 OID 26482)
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
-- TOC entry 4130 (class 0 OID 0)
-- Dependencies: 281
-- Name: TABLE dota_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.dota_profiles IS 'Профили игроков Dota 2 с данными из OpenDota API';


--
-- TOC entry 4131 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN dota_profiles.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.user_id IS 'ID пользователя из таблицы users';


--
-- TOC entry 4132 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN dota_profiles.steam_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.steam_id IS 'Steam ID пользователя';


--
-- TOC entry 4133 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN dota_profiles.dota_stats; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.dota_stats IS 'JSON данные статистики из OpenDota API';


--
-- TOC entry 4134 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN dota_profiles.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.created_at IS 'Дата создания профиля';


--
-- TOC entry 4135 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN dota_profiles.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.updated_at IS 'Дата последнего обновления профиля';


--
-- TOC entry 4136 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN dota_profiles.estimated_mmr; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dota_profiles.estimated_mmr IS 'Приблизительный MMR рассчитанный на основе rank_tier';


--
-- TOC entry 280 (class 1259 OID 26481)
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
-- TOC entry 4137 (class 0 OID 0)
-- Dependencies: 280
-- Name: dota_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dota_profiles_id_seq OWNED BY public.dota_profiles.id;


--
-- TOC entry 257 (class 1259 OID 26167)
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
-- TOC entry 256 (class 1259 OID 26166)
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
-- TOC entry 4138 (class 0 OID 0)
-- Dependencies: 256
-- Name: friends_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.friends_id_seq OWNED BY public.friends.id;


--
-- TOC entry 247 (class 1259 OID 18053)
-- Name: games; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.games (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.games OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 18052)
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
-- TOC entry 4139 (class 0 OID 0)
-- Dependencies: 246
-- Name: games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;


--
-- TOC entry 269 (class 1259 OID 26355)
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
-- TOC entry 4140 (class 0 OID 0)
-- Dependencies: 269
-- Name: TABLE maps; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.maps IS 'Таблица для хранения информации о картах игр';


--
-- TOC entry 268 (class 1259 OID 26354)
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
-- TOC entry 4141 (class 0 OID 0)
-- Dependencies: 268
-- Name: maps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.maps_id_seq OWNED BY public.maps.id;


--
-- TOC entry 226 (class 1259 OID 17730)
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
    maps_data jsonb
);


ALTER TABLE public.matches OWNER TO postgres;

--
-- TOC entry 4142 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN matches.maps_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.maps_data IS 'Данные о сыгранных картах в формате JSON для CS2 и других игр';


--
-- TOC entry 227 (class 1259 OID 17737)
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
-- TOC entry 4143 (class 0 OID 0)
-- Dependencies: 227
-- Name: matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.matches_id_seq OWNED BY public.matches.id;


--
-- TOC entry 265 (class 1259 OID 26248)
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
-- TOC entry 264 (class 1259 OID 26247)
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
-- TOC entry 4144 (class 0 OID 0)
-- Dependencies: 264
-- Name: message_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.message_status_id_seq OWNED BY public.message_status.id;


--
-- TOC entry 263 (class 1259 OID 26226)
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    chat_id integer,
    sender_id integer,
    content text NOT NULL,
    message_type character varying(20) DEFAULT 'text'::character varying,
    content_meta jsonb,
    is_pinned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 26225)
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
-- TOC entry 4145 (class 0 OID 0)
-- Dependencies: 262
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- TOC entry 249 (class 1259 OID 18069)
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
    invitation_id integer
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 18068)
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
-- TOC entry 4146 (class 0 OID 0)
-- Dependencies: 248
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 279 (class 1259 OID 26456)
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
-- TOC entry 278 (class 1259 OID 26455)
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
-- TOC entry 4147 (class 0 OID 0)
-- Dependencies: 278
-- Name: organization_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organization_requests_id_seq OWNED BY public.organization_requests.id;


--
-- TOC entry 275 (class 1259 OID 26408)
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
-- TOC entry 274 (class 1259 OID 26407)
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
-- TOC entry 4148 (class 0 OID 0)
-- Dependencies: 274
-- Name: organizer_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organizer_members_id_seq OWNED BY public.organizer_members.id;


--
-- TOC entry 273 (class 1259 OID 26388)
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
-- TOC entry 272 (class 1259 OID 26387)
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
-- TOC entry 4149 (class 0 OID 0)
-- Dependencies: 272
-- Name: organizers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organizers_id_seq OWNED BY public.organizers.id;


--
-- TOC entry 228 (class 1259 OID 17738)
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
-- TOC entry 229 (class 1259 OID 17744)
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
-- TOC entry 4150 (class 0 OID 0)
-- Dependencies: 229
-- Name: participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.participants_id_seq OWNED BY public.participants.id;


--
-- TOC entry 230 (class 1259 OID 17745)
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
-- TOC entry 231 (class 1259 OID 17751)
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
-- TOC entry 4151 (class 0 OID 0)
-- Dependencies: 231
-- Name: player_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.player_stats_id_seq OWNED BY public.player_stats.id;


--
-- TOC entry 232 (class 1259 OID 17752)
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
-- TOC entry 233 (class 1259 OID 17756)
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
-- TOC entry 4152 (class 0 OID 0)
-- Dependencies: 233
-- Name: players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.players_id_seq OWNED BY public.players.id;


--
-- TOC entry 234 (class 1259 OID 17757)
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
-- TOC entry 235 (class 1259 OID 17761)
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
-- TOC entry 4153 (class 0 OID 0)
-- Dependencies: 235
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- TOC entry 296 (class 1259 OID 28126)
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
-- TOC entry 295 (class 1259 OID 28125)
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
-- TOC entry 4155 (class 0 OID 0)
-- Dependencies: 295
-- Name: tournament_admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_admins_id_seq OWNED BY public.tournament_admins.id;


--
-- TOC entry 299 (class 1259 OID 28196)
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
-- TOC entry 267 (class 1259 OID 26276)
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
-- TOC entry 266 (class 1259 OID 26275)
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
-- TOC entry 4158 (class 0 OID 0)
-- Dependencies: 266
-- Name: tournament_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_invitations_id_seq OWNED BY public.tournament_invitations.id;


--
-- TOC entry 283 (class 1259 OID 26510)
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
-- TOC entry 4159 (class 0 OID 0)
-- Dependencies: 283
-- Name: TABLE tournament_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tournament_logs IS 'Журнал событий турниров';


--
-- TOC entry 4160 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN tournament_logs.tournament_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_logs.tournament_id IS 'ID турнира';


--
-- TOC entry 4161 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN tournament_logs.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_logs.user_id IS 'ID пользователя, инициировавшего событие (может быть NULL для системных событий)';


--
-- TOC entry 4162 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN tournament_logs.event_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_logs.event_type IS 'Тип события (tournament_created, participant_joined, match_completed и т.д.)';


--
-- TOC entry 4163 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN tournament_logs.event_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_logs.event_data IS 'Дополнительные данные события в формате JSON';


--
-- TOC entry 4164 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN tournament_logs.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_logs.created_at IS 'Время создания записи';


--
-- TOC entry 282 (class 1259 OID 26509)
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
-- TOC entry 4166 (class 0 OID 0)
-- Dependencies: 282
-- Name: tournament_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_logs_id_seq OWNED BY public.tournament_logs.id;


--
-- TOC entry 271 (class 1259 OID 26366)
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
-- TOC entry 270 (class 1259 OID 26365)
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
-- TOC entry 4168 (class 0 OID 0)
-- Dependencies: 270
-- Name: tournament_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_messages_id_seq OWNED BY public.tournament_messages.id;


--
-- TOC entry 277 (class 1259 OID 26429)
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
-- TOC entry 276 (class 1259 OID 26428)
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
-- TOC entry 4169 (class 0 OID 0)
-- Dependencies: 276
-- Name: tournament_organizers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_organizers_id_seq OWNED BY public.tournament_organizers.id;


--
-- TOC entry 236 (class 1259 OID 17767)
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
    CONSTRAINT check_cs2_premier_rank_range CHECK (((cs2_premier_rank IS NULL) OR ((cs2_premier_rank >= 0) AND (cs2_premier_rank <= 50000)))),
    CONSTRAINT check_faceit_elo_range CHECK (((faceit_elo IS NULL) OR ((faceit_elo >= 1) AND (faceit_elo <= 5000)))),
    CONSTRAINT chk_cs2_premier_rank_range CHECK (((cs2_premier_rank IS NULL) OR ((cs2_premier_rank >= 0) AND (cs2_premier_rank <= 40000)))),
    CONSTRAINT chk_faceit_elo_range CHECK (((faceit_elo IS NULL) OR ((faceit_elo >= 0) AND (faceit_elo <= 10000)))),
    CONSTRAINT tournament_participants_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'banned'::character varying, 'pending'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'confirmed'::character varying])::text[])))
);


ALTER TABLE public.tournament_participants OWNER TO postgres;

--
-- TOC entry 4170 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN tournament_participants.in_team; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_participants.in_team IS 'Флаг указывающий находится ли участник в команде (для микс турниров)';


--
-- TOC entry 4171 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN tournament_participants.faceit_elo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_participants.faceit_elo IS 'FACEIT ELO рейтинг участника (для незарегистрированных участников или переопределения)';


--
-- TOC entry 4172 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN tournament_participants.cs2_premier_rank; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_participants.cs2_premier_rank IS 'CS2 Premier Rank участника (для незарегистрированных участников или переопределения)';


--
-- TOC entry 237 (class 1259 OID 17771)
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
-- TOC entry 4173 (class 0 OID 0)
-- Dependencies: 237
-- Name: tournament_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_participants_id_seq OWNED BY public.tournament_participants.id;


--
-- TOC entry 251 (class 1259 OID 18092)
-- Name: tournament_team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_team_members (
    id integer NOT NULL,
    team_id integer NOT NULL,
    user_id integer,
    participant_id integer
);


ALTER TABLE public.tournament_team_members OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 18091)
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
-- TOC entry 4174 (class 0 OID 0)
-- Dependencies: 250
-- Name: tournament_team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_team_members_id_seq OWNED BY public.tournament_team_members.id;


--
-- TOC entry 238 (class 1259 OID 17772)
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
-- TOC entry 239 (class 1259 OID 17776)
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
-- TOC entry 4175 (class 0 OID 0)
-- Dependencies: 239
-- Name: tournament_team_players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_team_players_id_seq OWNED BY public.tournament_team_players.id;


--
-- TOC entry 240 (class 1259 OID 17777)
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
-- TOC entry 241 (class 1259 OID 17780)
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
-- TOC entry 4176 (class 0 OID 0)
-- Dependencies: 241
-- Name: tournament_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournament_teams_id_seq OWNED BY public.tournament_teams.id;


--
-- TOC entry 243 (class 1259 OID 17791)
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
-- TOC entry 4177 (class 0 OID 0)
-- Dependencies: 243
-- Name: tournaments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tournaments_id_seq OWNED BY public.tournaments.id;


--
-- TOC entry 287 (class 1259 OID 26661)
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
-- TOC entry 4178 (class 0 OID 0)
-- Dependencies: 287
-- Name: TABLE user_achievements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_achievements IS 'Связь пользователей с полученными достижениями';


--
-- TOC entry 286 (class 1259 OID 26660)
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
-- TOC entry 4179 (class 0 OID 0)
-- Dependencies: 286
-- Name: user_achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_achievements_id_seq OWNED BY public.user_achievements.id;


--
-- TOC entry 292 (class 1259 OID 27881)
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
-- TOC entry 4180 (class 0 OID 0)
-- Dependencies: 292
-- Name: TABLE user_progress; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_progress IS 'Общая статистика прогресса пользователей';


--
-- TOC entry 291 (class 1259 OID 27880)
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
-- TOC entry 4181 (class 0 OID 0)
-- Dependencies: 291
-- Name: user_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_progress_id_seq OWNED BY public.user_progress.id;


--
-- TOC entry 255 (class 1259 OID 18204)
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
-- TOC entry 4182 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN user_tournament_stats.team_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_tournament_stats.team_name IS 'Название команды, в которой участвовал игрок (для командных турниров)';


--
-- TOC entry 4183 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN user_tournament_stats.is_team_member; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_tournament_stats.is_team_member IS 'Флаг: участвовал ли игрок в команде (true) или как одиночный игрок (false)';


--
-- TOC entry 254 (class 1259 OID 18203)
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
-- TOC entry 245 (class 1259 OID 17796)
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
-- TOC entry 4184 (class 0 OID 0)
-- Dependencies: 245
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 288 (class 1259 OID 26688)
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
-- TOC entry 3633 (class 2604 OID 27915)
-- Name: achievement_action_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_action_logs ALTER COLUMN id SET DEFAULT nextval('public.achievement_action_logs_id_seq'::regclass);


--
-- TOC entry 3611 (class 2604 OID 27872)
-- Name: achievement_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_categories ALTER COLUMN id SET DEFAULT nextval('public.achievement_categories_id_seq'::regclass);


--
-- TOC entry 3596 (class 2604 OID 26647)
-- Name: achievements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements ALTER COLUMN id SET DEFAULT nextval('public.achievements_id_seq'::regclass);


--
-- TOC entry 3638 (class 2604 OID 28157)
-- Name: admin_invitations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations ALTER COLUMN id SET DEFAULT nextval('public.admin_invitations_id_seq'::regclass);


--
-- TOC entry 3535 (class 2604 OID 18121)
-- Name: admin_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_requests ALTER COLUMN id SET DEFAULT nextval('public.admin_requests_id_seq'::regclass);


--
-- TOC entry 3559 (class 2604 OID 26206)
-- Name: chat_participants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_participants ALTER COLUMN id SET DEFAULT nextval('public.chat_participants_id_seq'::regclass);


--
-- TOC entry 3554 (class 2604 OID 26195)
-- Name: chats id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chats ALTER COLUMN id SET DEFAULT nextval('public.chats_id_seq'::regclass);


--
-- TOC entry 3591 (class 2604 OID 26485)
-- Name: dota_profiles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dota_profiles ALTER COLUMN id SET DEFAULT nextval('public.dota_profiles_id_seq'::regclass);


--
-- TOC entry 3550 (class 2604 OID 26170)
-- Name: friends id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends ALTER COLUMN id SET DEFAULT nextval('public.friends_id_seq'::regclass);


--
-- TOC entry 3530 (class 2604 OID 18056)
-- Name: games id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);


--
-- TOC entry 3574 (class 2604 OID 26358)
-- Name: maps id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maps ALTER COLUMN id SET DEFAULT nextval('public.maps_id_seq'::regclass);


--
-- TOC entry 3489 (class 2604 OID 17798)
-- Name: matches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches ALTER COLUMN id SET DEFAULT nextval('public.matches_id_seq'::regclass);


--
-- TOC entry 3568 (class 2604 OID 26251)
-- Name: message_status id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status ALTER COLUMN id SET DEFAULT nextval('public.message_status_id_seq'::regclass);


--
-- TOC entry 3564 (class 2604 OID 26229)
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- TOC entry 3531 (class 2604 OID 18072)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 3587 (class 2604 OID 26459)
-- Name: organization_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests ALTER COLUMN id SET DEFAULT nextval('public.organization_requests_id_seq'::regclass);


--
-- TOC entry 3582 (class 2604 OID 26411)
-- Name: organizer_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizer_members ALTER COLUMN id SET DEFAULT nextval('public.organizer_members_id_seq'::regclass);


--
-- TOC entry 3578 (class 2604 OID 26391)
-- Name: organizers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizers ALTER COLUMN id SET DEFAULT nextval('public.organizers_id_seq'::regclass);


--
-- TOC entry 3493 (class 2604 OID 17799)
-- Name: participants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.participants ALTER COLUMN id SET DEFAULT nextval('public.participants_id_seq'::regclass);


--
-- TOC entry 3495 (class 2604 OID 17800)
-- Name: player_stats id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats ALTER COLUMN id SET DEFAULT nextval('public.player_stats_id_seq'::regclass);


--
-- TOC entry 3499 (class 2604 OID 17801)
-- Name: players id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);


--
-- TOC entry 3501 (class 2604 OID 17802)
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- TOC entry 3635 (class 2604 OID 28129)
-- Name: tournament_admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins ALTER COLUMN id SET DEFAULT nextval('public.tournament_admins_id_seq'::regclass);


--
-- TOC entry 3570 (class 2604 OID 26279)
-- Name: tournament_invitations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations ALTER COLUMN id SET DEFAULT nextval('public.tournament_invitations_id_seq'::regclass);


--
-- TOC entry 3594 (class 2604 OID 26513)
-- Name: tournament_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_logs ALTER COLUMN id SET DEFAULT nextval('public.tournament_logs_id_seq'::regclass);


--
-- TOC entry 3576 (class 2604 OID 26369)
-- Name: tournament_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_messages ALTER COLUMN id SET DEFAULT nextval('public.tournament_messages_id_seq'::regclass);


--
-- TOC entry 3585 (class 2604 OID 26432)
-- Name: tournament_organizers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_organizers ALTER COLUMN id SET DEFAULT nextval('public.tournament_organizers_id_seq'::regclass);


--
-- TOC entry 3503 (class 2604 OID 17804)
-- Name: tournament_participants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants ALTER COLUMN id SET DEFAULT nextval('public.tournament_participants_id_seq'::regclass);


--
-- TOC entry 3534 (class 2604 OID 18095)
-- Name: tournament_team_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members ALTER COLUMN id SET DEFAULT nextval('public.tournament_team_members_id_seq'::regclass);


--
-- TOC entry 3507 (class 2604 OID 17805)
-- Name: tournament_team_players id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_players ALTER COLUMN id SET DEFAULT nextval('public.tournament_team_players_id_seq'::regclass);


--
-- TOC entry 3509 (class 2604 OID 17806)
-- Name: tournament_teams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams ALTER COLUMN id SET DEFAULT nextval('public.tournament_teams_id_seq'::regclass);


--
-- TOC entry 3510 (class 2604 OID 17807)
-- Name: tournaments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournaments ALTER COLUMN id SET DEFAULT nextval('public.tournaments_id_seq'::regclass);


--
-- TOC entry 3607 (class 2604 OID 26664)
-- Name: user_achievements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements ALTER COLUMN id SET DEFAULT nextval('public.user_achievements_id_seq'::regclass);


--
-- TOC entry 3615 (class 2604 OID 27884)
-- Name: user_progress id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress ALTER COLUMN id SET DEFAULT nextval('public.user_progress_id_seq'::regclass);


--
-- TOC entry 3521 (class 2604 OID 17808)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3860 (class 2606 OID 27920)
-- Name: achievement_action_logs achievement_action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_action_logs
    ADD CONSTRAINT achievement_action_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3852 (class 2606 OID 27879)
-- Name: achievement_categories achievement_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_categories
    ADD CONSTRAINT achievement_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3833 (class 2606 OID 26657)
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- TOC entry 3835 (class 2606 OID 26659)
-- Name: achievements achievements_title_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_title_key UNIQUE (title);


--
-- TOC entry 3871 (class 2606 OID 28166)
-- Name: admin_invitations admin_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_pkey PRIMARY KEY (id);


--
-- TOC entry 3873 (class 2606 OID 28168)
-- Name: admin_invitations admin_invitations_tournament_id_invitee_id_status_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_tournament_id_invitee_id_status_key UNIQUE (tournament_id, invitee_id, status) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3745 (class 2606 OID 18125)
-- Name: admin_requests admin_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_requests
    ADD CONSTRAINT admin_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3747 (class 2606 OID 18127)
-- Name: admin_requests admin_requests_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_requests
    ADD CONSTRAINT admin_requests_tournament_id_user_id_key UNIQUE (tournament_id, user_id);


--
-- TOC entry 3768 (class 2606 OID 26214)
-- Name: chat_participants chat_participants_chat_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_chat_id_user_id_key UNIQUE (chat_id, user_id);


--
-- TOC entry 3770 (class 2606 OID 26212)
-- Name: chat_participants chat_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_pkey PRIMARY KEY (id);


--
-- TOC entry 3766 (class 2606 OID 26201)
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- TOC entry 3820 (class 2606 OID 26491)
-- Name: dota_profiles dota_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dota_profiles
    ADD CONSTRAINT dota_profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 3822 (class 2606 OID 26493)
-- Name: dota_profiles dota_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dota_profiles
    ADD CONSTRAINT dota_profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 3760 (class 2606 OID 26176)
-- Name: friends friends_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_pkey PRIMARY KEY (id);


--
-- TOC entry 3733 (class 2606 OID 18060)
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- TOC entry 3793 (class 2606 OID 26363)
-- Name: maps maps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maps
    ADD CONSTRAINT maps_pkey PRIMARY KEY (id);


--
-- TOC entry 3691 (class 2606 OID 17810)
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- TOC entry 3780 (class 2606 OID 26256)
-- Name: message_status message_status_message_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_message_id_user_id_key UNIQUE (message_id, user_id);


--
-- TOC entry 3782 (class 2606 OID 26254)
-- Name: message_status message_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_pkey PRIMARY KEY (id);


--
-- TOC entry 3776 (class 2606 OID 26236)
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- TOC entry 3737 (class 2606 OID 18078)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3818 (class 2606 OID 26466)
-- Name: organization_requests organization_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests
    ADD CONSTRAINT organization_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3805 (class 2606 OID 26417)
-- Name: organizer_members organizer_members_organizer_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizer_members
    ADD CONSTRAINT organizer_members_organizer_id_user_id_key UNIQUE (organizer_id, user_id);


--
-- TOC entry 3807 (class 2606 OID 26415)
-- Name: organizer_members organizer_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizer_members
    ADD CONSTRAINT organizer_members_pkey PRIMARY KEY (id);


--
-- TOC entry 3799 (class 2606 OID 26398)
-- Name: organizers organizers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_pkey PRIMARY KEY (id);


--
-- TOC entry 3801 (class 2606 OID 26400)
-- Name: organizers organizers_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_slug_key UNIQUE (slug);


--
-- TOC entry 3693 (class 2606 OID 17812)
-- Name: participants participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_pkey PRIMARY KEY (id);


--
-- TOC entry 3695 (class 2606 OID 17814)
-- Name: player_stats player_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_pkey PRIMARY KEY (id);


--
-- TOC entry 3697 (class 2606 OID 17816)
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- TOC entry 3699 (class 2606 OID 17818)
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- TOC entry 3867 (class 2606 OID 28135)
-- Name: tournament_admins tournament_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins
    ADD CONSTRAINT tournament_admins_pkey PRIMARY KEY (id);


--
-- TOC entry 3869 (class 2606 OID 28137)
-- Name: tournament_admins tournament_admins_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins
    ADD CONSTRAINT tournament_admins_tournament_id_user_id_key UNIQUE (tournament_id, user_id);


--
-- TOC entry 3787 (class 2606 OID 26285)
-- Name: tournament_invitations tournament_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations
    ADD CONSTRAINT tournament_invitations_pkey PRIMARY KEY (id);


--
-- TOC entry 3789 (class 2606 OID 26287)
-- Name: tournament_invitations tournament_invitations_tournament_id_user_id_status_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations
    ADD CONSTRAINT tournament_invitations_tournament_id_user_id_status_key UNIQUE (tournament_id, user_id, status);


--
-- TOC entry 3831 (class 2606 OID 26518)
-- Name: tournament_logs tournament_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_logs
    ADD CONSTRAINT tournament_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3795 (class 2606 OID 26374)
-- Name: tournament_messages tournament_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_messages
    ADD CONSTRAINT tournament_messages_pkey PRIMARY KEY (id);


--
-- TOC entry 3811 (class 2606 OID 26435)
-- Name: tournament_organizers tournament_organizers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_organizers
    ADD CONSTRAINT tournament_organizers_pkey PRIMARY KEY (id);


--
-- TOC entry 3813 (class 2606 OID 26437)
-- Name: tournament_organizers tournament_organizers_tournament_id_organizer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_organizers
    ADD CONSTRAINT tournament_organizers_tournament_id_organizer_id_key UNIQUE (tournament_id, organizer_id);


--
-- TOC entry 3704 (class 2606 OID 17824)
-- Name: tournament_participants tournament_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_pkey PRIMARY KEY (id);


--
-- TOC entry 3706 (class 2606 OID 26322)
-- Name: tournament_participants tournament_participants_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_id_user_id_key UNIQUE (tournament_id, user_id);


--
-- TOC entry 3741 (class 2606 OID 18097)
-- Name: tournament_team_members tournament_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members
    ADD CONSTRAINT tournament_team_members_pkey PRIMARY KEY (id);


--
-- TOC entry 3743 (class 2606 OID 18099)
-- Name: tournament_team_members tournament_team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members
    ADD CONSTRAINT tournament_team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- TOC entry 3708 (class 2606 OID 17826)
-- Name: tournament_team_players tournament_team_players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_players
    ADD CONSTRAINT tournament_team_players_pkey PRIMARY KEY (id);


--
-- TOC entry 3710 (class 2606 OID 17828)
-- Name: tournament_team_players tournament_team_players_tournament_team_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_players
    ADD CONSTRAINT tournament_team_players_tournament_team_id_player_id_key UNIQUE (tournament_team_id, player_id);


--
-- TOC entry 3713 (class 2606 OID 17830)
-- Name: tournament_teams tournament_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_pkey PRIMARY KEY (id);


--
-- TOC entry 3715 (class 2606 OID 17832)
-- Name: tournament_teams tournament_teams_tournament_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_tournament_id_team_id_key UNIQUE (tournament_id, team_id);


--
-- TOC entry 3724 (class 2606 OID 17834)
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- TOC entry 3764 (class 2606 OID 26178)
-- Name: friends unique_friendship; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT unique_friendship UNIQUE (user_id, friend_id);


--
-- TOC entry 3735 (class 2606 OID 18067)
-- Name: games unique_game_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT unique_game_name UNIQUE (name);


--
-- TOC entry 3727 (class 2606 OID 18228)
-- Name: users unique_steam_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT unique_steam_id UNIQUE (steam_id);


--
-- TOC entry 3717 (class 2606 OID 18090)
-- Name: tournament_teams unique_team_name_per_tournament; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT unique_team_name_per_tournament UNIQUE (tournament_id, name);


--
-- TOC entry 3846 (class 2606 OID 26668)
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- TOC entry 3848 (class 2606 OID 27938)
-- Name: user_achievements user_achievements_user_achievement_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_achievement_unique UNIQUE (user_id, achievement_id);


--
-- TOC entry 3850 (class 2606 OID 26670)
-- Name: user_achievements user_achievements_user_id_achievement_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id);


--
-- TOC entry 3856 (class 2606 OID 27903)
-- Name: user_progress user_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_pkey PRIMARY KEY (id);


--
-- TOC entry 3858 (class 2606 OID 27905)
-- Name: user_progress user_progress_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_key UNIQUE (user_id);


--
-- TOC entry 3756 (class 2606 OID 18211)
-- Name: user_tournament_stats user_tournament_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tournament_stats
    ADD CONSTRAINT user_tournament_stats_pkey PRIMARY KEY (id);


--
-- TOC entry 3758 (class 2606 OID 26642)
-- Name: user_tournament_stats user_tournament_stats_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tournament_stats
    ADD CONSTRAINT user_tournament_stats_unique UNIQUE (user_id, tournament_id);


--
-- TOC entry 3729 (class 2606 OID 17836)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3731 (class 2606 OID 17838)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3836 (class 1259 OID 27939)
-- Name: idx_achievements_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_active ON public.achievements USING btree (is_active);


--
-- TOC entry 3837 (class 1259 OID 26681)
-- Name: idx_achievements_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_category ON public.achievements USING btree (category);


--
-- TOC entry 3838 (class 1259 OID 26683)
-- Name: idx_achievements_condition_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_condition_type ON public.achievements USING btree (condition_type);


--
-- TOC entry 3839 (class 1259 OID 26682)
-- Name: idx_achievements_rarity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_rarity ON public.achievements USING btree (rarity);


--
-- TOC entry 3861 (class 1259 OID 27946)
-- Name: idx_action_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_action_created_at ON public.achievement_action_logs USING btree (created_at);


--
-- TOC entry 3874 (class 1259 OID 28192)
-- Name: idx_admin_invitations_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_active ON public.admin_invitations USING btree (tournament_id, invitee_id, status) WHERE ((status)::text = 'pending'::text);


--
-- TOC entry 3875 (class 1259 OID 28191)
-- Name: idx_admin_invitations_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_expires_at ON public.admin_invitations USING btree (expires_at);


--
-- TOC entry 3876 (class 1259 OID 28189)
-- Name: idx_admin_invitations_invitee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_invitee_id ON public.admin_invitations USING btree (invitee_id);


--
-- TOC entry 3877 (class 1259 OID 28190)
-- Name: idx_admin_invitations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_status ON public.admin_invitations USING btree (status);


--
-- TOC entry 3878 (class 1259 OID 28188)
-- Name: idx_admin_invitations_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_invitations_tournament_id ON public.admin_invitations USING btree (tournament_id);


--
-- TOC entry 3771 (class 1259 OID 26267)
-- Name: idx_chat_participants_chat_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_participants_chat_id ON public.chat_participants USING btree (chat_id);


--
-- TOC entry 3772 (class 1259 OID 26268)
-- Name: idx_chat_participants_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_participants_user_id ON public.chat_participants USING btree (user_id);


--
-- TOC entry 3823 (class 1259 OID 26500)
-- Name: idx_dota_profiles_steam_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dota_profiles_steam_id ON public.dota_profiles USING btree (steam_id);


--
-- TOC entry 3824 (class 1259 OID 26501)
-- Name: idx_dota_profiles_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dota_profiles_updated_at ON public.dota_profiles USING btree (updated_at);


--
-- TOC entry 3825 (class 1259 OID 26499)
-- Name: idx_dota_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dota_profiles_user_id ON public.dota_profiles USING btree (user_id);


--
-- TOC entry 3761 (class 1259 OID 26190)
-- Name: idx_friends_friend_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friends_friend_id ON public.friends USING btree (friend_id);


--
-- TOC entry 3762 (class 1259 OID 26189)
-- Name: idx_friends_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friends_user_id ON public.friends USING btree (user_id);


--
-- TOC entry 3790 (class 1259 OID 26385)
-- Name: idx_maps_game; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maps_game ON public.maps USING btree (game);


--
-- TOC entry 3689 (class 1259 OID 17841)
-- Name: idx_matches_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_tournament ON public.matches USING btree (tournament_id);


--
-- TOC entry 3777 (class 1259 OID 26271)
-- Name: idx_message_status_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_status_message_id ON public.message_status USING btree (message_id);


--
-- TOC entry 3778 (class 1259 OID 26272)
-- Name: idx_message_status_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_status_user_id ON public.message_status USING btree (user_id);


--
-- TOC entry 3773 (class 1259 OID 26269)
-- Name: idx_messages_chat_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_chat_id ON public.messages USING btree (chat_id);


--
-- TOC entry 3774 (class 1259 OID 26270)
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


--
-- TOC entry 3814 (class 1259 OID 26479)
-- Name: idx_organization_requests_reviewed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organization_requests_reviewed_by ON public.organization_requests USING btree (reviewed_by);


--
-- TOC entry 3815 (class 1259 OID 26478)
-- Name: idx_organization_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organization_requests_status ON public.organization_requests USING btree (status);


--
-- TOC entry 3816 (class 1259 OID 26477)
-- Name: idx_organization_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organization_requests_user_id ON public.organization_requests USING btree (user_id);


--
-- TOC entry 3802 (class 1259 OID 26450)
-- Name: idx_organizer_members_organizer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizer_members_organizer ON public.organizer_members USING btree (organizer_id);


--
-- TOC entry 3803 (class 1259 OID 26451)
-- Name: idx_organizer_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizer_members_user ON public.organizer_members USING btree (user_id);


--
-- TOC entry 3796 (class 1259 OID 26449)
-- Name: idx_organizers_manager; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizers_manager ON public.organizers USING btree (manager_user_id);


--
-- TOC entry 3797 (class 1259 OID 26448)
-- Name: idx_organizers_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizers_slug ON public.organizers USING btree (slug);


--
-- TOC entry 3863 (class 1259 OID 28185)
-- Name: idx_tournament_admins_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_admins_tournament_id ON public.tournament_admins USING btree (tournament_id);


--
-- TOC entry 3864 (class 1259 OID 28187)
-- Name: idx_tournament_admins_tournament_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_admins_tournament_user ON public.tournament_admins USING btree (tournament_id, user_id);


--
-- TOC entry 3865 (class 1259 OID 28186)
-- Name: idx_tournament_admins_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_admins_user_id ON public.tournament_admins USING btree (user_id);


--
-- TOC entry 3718 (class 1259 OID 17842)
-- Name: idx_tournament_format; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_format ON public.tournaments USING btree (format);


--
-- TOC entry 3783 (class 1259 OID 26305)
-- Name: idx_tournament_invitations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_invitations_status ON public.tournament_invitations USING btree (status);


--
-- TOC entry 3784 (class 1259 OID 26304)
-- Name: idx_tournament_invitations_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_invitations_tournament_id ON public.tournament_invitations USING btree (tournament_id);


--
-- TOC entry 3785 (class 1259 OID 26303)
-- Name: idx_tournament_invitations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_invitations_user_id ON public.tournament_invitations USING btree (user_id);


--
-- TOC entry 3826 (class 1259 OID 26530)
-- Name: idx_tournament_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_logs_created_at ON public.tournament_logs USING btree (created_at DESC);


--
-- TOC entry 3827 (class 1259 OID 26531)
-- Name: idx_tournament_logs_event_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_logs_event_type ON public.tournament_logs USING btree (event_type);


--
-- TOC entry 3828 (class 1259 OID 26529)
-- Name: idx_tournament_logs_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_logs_tournament_id ON public.tournament_logs USING btree (tournament_id);


--
-- TOC entry 3829 (class 1259 OID 28195)
-- Name: idx_tournament_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_logs_user_id ON public.tournament_logs USING btree (user_id);


--
-- TOC entry 3808 (class 1259 OID 26453)
-- Name: idx_tournament_organizers_organizer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_organizers_organizer ON public.tournament_organizers USING btree (organizer_id);


--
-- TOC entry 3809 (class 1259 OID 26452)
-- Name: idx_tournament_organizers_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_organizers_tournament ON public.tournament_organizers USING btree (tournament_id);


--
-- TOC entry 3700 (class 1259 OID 27992)
-- Name: idx_tournament_participants_cs2_premier_rank; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_participants_cs2_premier_rank ON public.tournament_participants USING btree (cs2_premier_rank) WHERE (cs2_premier_rank IS NOT NULL);


--
-- TOC entry 3701 (class 1259 OID 27991)
-- Name: idx_tournament_participants_faceit_elo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_participants_faceit_elo ON public.tournament_participants USING btree (faceit_elo) WHERE (faceit_elo IS NOT NULL);


--
-- TOC entry 3702 (class 1259 OID 27988)
-- Name: idx_tournament_participants_in_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_participants_in_team ON public.tournament_participants USING btree (tournament_id, in_team);


--
-- TOC entry 3738 (class 1259 OID 26317)
-- Name: idx_tournament_team_members_participant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_team_members_participant_id ON public.tournament_team_members USING btree (participant_id);


--
-- TOC entry 3739 (class 1259 OID 26311)
-- Name: idx_tournament_team_members_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_team_members_team_id ON public.tournament_team_members USING btree (team_id);


--
-- TOC entry 3711 (class 1259 OID 26310)
-- Name: idx_tournament_teams_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_teams_tournament_id ON public.tournament_teams USING btree (tournament_id);


--
-- TOC entry 3719 (class 1259 OID 28016)
-- Name: idx_tournaments_chat_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_chat_id ON public.tournaments USING btree (chat_id);


--
-- TOC entry 3720 (class 1259 OID 27973)
-- Name: idx_tournaments_second_place_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_second_place_id ON public.tournaments USING btree (second_place_id);


--
-- TOC entry 3721 (class 1259 OID 27974)
-- Name: idx_tournaments_third_place_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_third_place_id ON public.tournaments USING btree (third_place_id);


--
-- TOC entry 3722 (class 1259 OID 27972)
-- Name: idx_tournaments_winner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_winner_id ON public.tournaments USING btree (winner_id);


--
-- TOC entry 3840 (class 1259 OID 27941)
-- Name: idx_user_achievements_achievement; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_achievement ON public.user_achievements USING btree (achievement_id);


--
-- TOC entry 3841 (class 1259 OID 26685)
-- Name: idx_user_achievements_achievement_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_achievement_id ON public.user_achievements USING btree (achievement_id);


--
-- TOC entry 3842 (class 1259 OID 27942)
-- Name: idx_user_achievements_unlocked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_unlocked ON public.user_achievements USING btree (unlocked_at);


--
-- TOC entry 3843 (class 1259 OID 27940)
-- Name: idx_user_achievements_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_user ON public.user_achievements USING btree (user_id);


--
-- TOC entry 3844 (class 1259 OID 26684)
-- Name: idx_user_achievements_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_user_id ON public.user_achievements USING btree (user_id);


--
-- TOC entry 3862 (class 1259 OID 27945)
-- Name: idx_user_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action ON public.achievement_action_logs USING btree (user_id, action_type);


--
-- TOC entry 3853 (class 1259 OID 27943)
-- Name: idx_user_progress_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_progress_level ON public.user_progress USING btree (level);


--
-- TOC entry 3854 (class 1259 OID 27944)
-- Name: idx_user_progress_xp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_progress_xp ON public.user_progress USING btree (total_xp);


--
-- TOC entry 3748 (class 1259 OID 26536)
-- Name: idx_user_tournament_stats_is_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_is_team ON public.user_tournament_stats USING btree (is_team);


--
-- TOC entry 3749 (class 1259 OID 27976)
-- Name: idx_user_tournament_stats_is_team_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_is_team_member ON public.user_tournament_stats USING btree (is_team_member);


--
-- TOC entry 3750 (class 1259 OID 26547)
-- Name: idx_user_tournament_stats_performance; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_performance ON public.user_tournament_stats USING btree (user_id, wins, final_position);


--
-- TOC entry 3751 (class 1259 OID 26535)
-- Name: idx_user_tournament_stats_result; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_result ON public.user_tournament_stats USING btree (result);


--
-- TOC entry 3752 (class 1259 OID 27975)
-- Name: idx_user_tournament_stats_team_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_team_name ON public.user_tournament_stats USING btree (team_name);


--
-- TOC entry 3753 (class 1259 OID 26534)
-- Name: idx_user_tournament_stats_tournament_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_tournament_id ON public.user_tournament_stats USING btree (tournament_id);


--
-- TOC entry 3754 (class 1259 OID 26533)
-- Name: idx_user_tournament_stats_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tournament_stats_user_id ON public.user_tournament_stats USING btree (user_id);


--
-- TOC entry 3725 (class 1259 OID 28008)
-- Name: idx_users_last_notifications_seen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_last_notifications_seen ON public.users USING btree (last_notifications_seen);


--
-- TOC entry 3791 (class 1259 OID 26364)
-- Name: maps_game_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX maps_game_idx ON public.maps USING btree (game);


--
-- TOC entry 3951 (class 2620 OID 28194)
-- Name: admin_invitations admin_invitation_notification_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER admin_invitation_notification_trigger AFTER INSERT ON public.admin_invitations FOR EACH ROW WHEN (((new.status)::text = 'pending'::text)) EXECUTE FUNCTION public.send_admin_invitation_notification();


--
-- TOC entry 3949 (class 2620 OID 27947)
-- Name: achievement_categories update_achievement_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_achievement_categories_updated_at BEFORE UPDATE ON public.achievement_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3948 (class 2620 OID 27948)
-- Name: achievements update_achievements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_achievements_updated_at BEFORE UPDATE ON public.achievements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3943 (class 2620 OID 26274)
-- Name: messages update_chat_timestamp_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_chat_timestamp_trigger AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_chat_timestamp();


--
-- TOC entry 3947 (class 2620 OID 26532)
-- Name: dota_profiles update_dota_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_dota_profiles_updated_at BEFORE UPDATE ON public.dota_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3946 (class 2620 OID 26480)
-- Name: organization_requests update_organization_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_organization_requests_updated_at BEFORE UPDATE ON public.organization_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3945 (class 2620 OID 26454)
-- Name: organizers update_organizers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_organizers_updated_at BEFORE UPDATE ON public.organizers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3944 (class 2620 OID 26307)
-- Name: tournament_invitations update_tournament_invitations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_tournament_invitations_updated_at BEFORE UPDATE ON public.tournament_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3950 (class 2620 OID 27949)
-- Name: user_progress update_user_progress_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON public.user_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3942 (class 2620 OID 26537)
-- Name: user_tournament_stats update_user_tournament_stats_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_tournament_stats_updated_at BEFORE UPDATE ON public.user_tournament_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3935 (class 2606 OID 27921)
-- Name: achievement_action_logs achievement_action_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_action_logs
    ADD CONSTRAINT achievement_action_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3931 (class 2606 OID 27930)
-- Name: achievements achievements_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.achievement_categories(id);


--
-- TOC entry 3939 (class 2606 OID 28180)
-- Name: admin_invitations admin_invitations_invitee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3940 (class 2606 OID 28175)
-- Name: admin_invitations admin_invitations_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3941 (class 2606 OID 28170)
-- Name: admin_invitations admin_invitations_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3904 (class 2606 OID 18128)
-- Name: admin_requests admin_requests_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_requests
    ADD CONSTRAINT admin_requests_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3905 (class 2606 OID 18133)
-- Name: admin_requests admin_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_requests
    ADD CONSTRAINT admin_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3910 (class 2606 OID 26215)
-- Name: chat_participants chat_participants_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- TOC entry 3911 (class 2606 OID 26220)
-- Name: chat_participants chat_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3928 (class 2606 OID 26494)
-- Name: dota_profiles dota_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dota_profiles
    ADD CONSTRAINT dota_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3888 (class 2606 OID 26325)
-- Name: tournament_participants fk_invited_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT fk_invited_user FOREIGN KEY (invited_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3879 (class 2606 OID 18195)
-- Name: matches fk_loser_next_match; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT fk_loser_next_match FOREIGN KEY (loser_next_match_id) REFERENCES public.matches(id);


--
-- TOC entry 3889 (class 2606 OID 18222)
-- Name: tournament_participants fk_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3908 (class 2606 OID 26184)
-- Name: friends friends_friend_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3909 (class 2606 OID 26179)
-- Name: friends friends_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3880 (class 2606 OID 18190)
-- Name: matches matches_loser_next_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_loser_next_match_id_fkey FOREIGN KEY (loser_next_match_id) REFERENCES public.matches(id);


--
-- TOC entry 3881 (class 2606 OID 18185)
-- Name: matches matches_next_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_next_match_id_fkey FOREIGN KEY (next_match_id) REFERENCES public.matches(id);


--
-- TOC entry 3882 (class 2606 OID 18164)
-- Name: matches matches_source_match1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_source_match1_id_fkey FOREIGN KEY (source_match1_id) REFERENCES public.matches(id);


--
-- TOC entry 3883 (class 2606 OID 18169)
-- Name: matches matches_source_match2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_source_match2_id_fkey FOREIGN KEY (source_match2_id) REFERENCES public.matches(id);


--
-- TOC entry 3884 (class 2606 OID 17843)
-- Name: matches matches_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3914 (class 2606 OID 26257)
-- Name: message_status message_status_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- TOC entry 3915 (class 2606 OID 26262)
-- Name: message_status message_status_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3912 (class 2606 OID 26237)
-- Name: messages messages_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- TOC entry 3913 (class 2606 OID 26242)
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3898 (class 2606 OID 18148)
-- Name: notifications notifications_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3899 (class 2606 OID 18143)
-- Name: notifications notifications_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3900 (class 2606 OID 18079)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3926 (class 2606 OID 26472)
-- Name: organization_requests organization_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests
    ADD CONSTRAINT organization_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- TOC entry 3927 (class 2606 OID 26467)
-- Name: organization_requests organization_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests
    ADD CONSTRAINT organization_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3922 (class 2606 OID 26418)
-- Name: organizer_members organizer_members_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizer_members
    ADD CONSTRAINT organizer_members_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- TOC entry 3923 (class 2606 OID 26423)
-- Name: organizer_members organizer_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizer_members
    ADD CONSTRAINT organizer_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3921 (class 2606 OID 26401)
-- Name: organizers organizers_manager_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_manager_user_id_fkey FOREIGN KEY (manager_user_id) REFERENCES public.users(id);


--
-- TOC entry 3885 (class 2606 OID 17848)
-- Name: participants participants_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3886 (class 2606 OID 17853)
-- Name: player_stats player_stats_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- TOC entry 3887 (class 2606 OID 17858)
-- Name: player_stats player_stats_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- TOC entry 3936 (class 2606 OID 28148)
-- Name: tournament_admins tournament_admins_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins
    ADD CONSTRAINT tournament_admins_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- TOC entry 3937 (class 2606 OID 28138)
-- Name: tournament_admins tournament_admins_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins
    ADD CONSTRAINT tournament_admins_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3938 (class 2606 OID 28143)
-- Name: tournament_admins tournament_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_admins
    ADD CONSTRAINT tournament_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3916 (class 2606 OID 26298)
-- Name: tournament_invitations tournament_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations
    ADD CONSTRAINT tournament_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3917 (class 2606 OID 26288)
-- Name: tournament_invitations tournament_invitations_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations
    ADD CONSTRAINT tournament_invitations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3918 (class 2606 OID 26293)
-- Name: tournament_invitations tournament_invitations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_invitations
    ADD CONSTRAINT tournament_invitations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3929 (class 2606 OID 26519)
-- Name: tournament_logs tournament_logs_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_logs
    ADD CONSTRAINT tournament_logs_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3930 (class 2606 OID 26524)
-- Name: tournament_logs tournament_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_logs
    ADD CONSTRAINT tournament_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3919 (class 2606 OID 26380)
-- Name: tournament_messages tournament_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_messages
    ADD CONSTRAINT tournament_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3920 (class 2606 OID 26375)
-- Name: tournament_messages tournament_messages_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_messages
    ADD CONSTRAINT tournament_messages_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3924 (class 2606 OID 26443)
-- Name: tournament_organizers tournament_organizers_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_organizers
    ADD CONSTRAINT tournament_organizers_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- TOC entry 3925 (class 2606 OID 26438)
-- Name: tournament_organizers tournament_organizers_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_organizers
    ADD CONSTRAINT tournament_organizers_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3890 (class 2606 OID 17873)
-- Name: tournament_participants tournament_participants_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3891 (class 2606 OID 18110)
-- Name: tournament_participants tournament_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3901 (class 2606 OID 26312)
-- Name: tournament_team_members tournament_team_members_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members
    ADD CONSTRAINT tournament_team_members_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.tournament_participants(id) ON DELETE CASCADE;


--
-- TOC entry 3902 (class 2606 OID 18100)
-- Name: tournament_team_members tournament_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members
    ADD CONSTRAINT tournament_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tournament_teams(id) ON DELETE CASCADE;


--
-- TOC entry 3903 (class 2606 OID 18105)
-- Name: tournament_team_members tournament_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_members
    ADD CONSTRAINT tournament_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3892 (class 2606 OID 17878)
-- Name: tournament_team_players tournament_team_players_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_players
    ADD CONSTRAINT tournament_team_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- TOC entry 3893 (class 2606 OID 17883)
-- Name: tournament_team_players tournament_team_players_tournament_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_team_players
    ADD CONSTRAINT tournament_team_players_tournament_team_id_fkey FOREIGN KEY (tournament_team_id) REFERENCES public.tournament_teams(id) ON DELETE CASCADE;


--
-- TOC entry 3894 (class 2606 OID 18084)
-- Name: tournament_teams tournament_teams_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3895 (class 2606 OID 17888)
-- Name: tournament_teams tournament_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- TOC entry 3896 (class 2606 OID 17893)
-- Name: tournament_teams tournament_teams_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3897 (class 2606 OID 28011)
-- Name: tournaments tournaments_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE SET NULL;


--
-- TOC entry 3932 (class 2606 OID 26676)
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- TOC entry 3933 (class 2606 OID 26671)
-- Name: user_achievements user_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3934 (class 2606 OID 27906)
-- Name: user_progress user_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3906 (class 2606 OID 18217)
-- Name: user_tournament_stats user_tournament_stats_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tournament_stats
    ADD CONSTRAINT user_tournament_stats_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- TOC entry 3907 (class 2606 OID 18212)
-- Name: user_tournament_stats user_tournament_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tournament_stats
    ADD CONSTRAINT user_tournament_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4100 (class 0 OID 0)
-- Dependencies: 7
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- TOC entry 4102 (class 0 OID 0)
-- Dependencies: 327
-- Name: FUNCTION accept_admin_invitation(invitation_id integer, accepting_user_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.accept_admin_invitation(invitation_id integer, accepting_user_id integer) TO app_role;


--
-- TOC entry 4105 (class 0 OID 0)
-- Dependencies: 326
-- Name: FUNCTION cleanup_expired_invitations(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_expired_invitations() TO app_role;


--
-- TOC entry 4106 (class 0 OID 0)
-- Dependencies: 328
-- Name: FUNCTION decline_admin_invitation(invitation_id integer, declining_user_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.decline_admin_invitation(invitation_id integer, declining_user_id integer) TO app_role;


--
-- TOC entry 4107 (class 0 OID 0)
-- Dependencies: 329
-- Name: FUNCTION maintenance_cleanup(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.maintenance_cleanup() TO app_role;


--
-- TOC entry 4115 (class 0 OID 0)
-- Dependencies: 298
-- Name: TABLE admin_invitations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admin_invitations TO app_role;


--
-- TOC entry 4124 (class 0 OID 0)
-- Dependencies: 300
-- Name: TABLE active_admin_invitations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.active_admin_invitations TO app_role;


--
-- TOC entry 4126 (class 0 OID 0)
-- Dependencies: 297
-- Name: SEQUENCE admin_invitations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.admin_invitations_id_seq TO app_role;


--
-- TOC entry 4154 (class 0 OID 0)
-- Dependencies: 296
-- Name: TABLE tournament_admins; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tournament_admins TO app_role;


--
-- TOC entry 4156 (class 0 OID 0)
-- Dependencies: 295
-- Name: SEQUENCE tournament_admins_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.tournament_admins_id_seq TO app_role;


--
-- TOC entry 4157 (class 0 OID 0)
-- Dependencies: 299
-- Name: TABLE tournament_admins_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.tournament_admins_view TO app_role;


--
-- TOC entry 4165 (class 0 OID 0)
-- Dependencies: 283
-- Name: TABLE tournament_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tournament_logs TO app_role;


--
-- TOC entry 4167 (class 0 OID 0)
-- Dependencies: 282
-- Name: SEQUENCE tournament_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.tournament_logs_id_seq TO app_role;


-- Completed on 2025-06-12 17:04:35

--
-- PostgreSQL database dump complete
--

