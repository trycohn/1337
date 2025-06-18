-- ===== МИГРАЦИЯ: ФУНКЦИОНАЛ ПРИГЛАШЕНИЯ АДМИНИСТРАТОРОВ ТУРНИРОВ =====
-- Дата создания: 2025-01-22
-- Автор: 1337 Community Development Team
-- Описание: Создание таблиц и функций для управления администраторами турниров

-- 1. Создание таблицы администраторов турниров
CREATE TABLE IF NOT EXISTS tournament_admins (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{"can_edit_matches": true, "can_manage_participants": true, "can_invite_admins": true}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tournament_id, user_id)
);

-- 2. Создание таблицы приглашений администраторов
CREATE TABLE IF NOT EXISTS admin_invitations (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    expires_at TIMESTAMP NOT NULL,
    responded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tournament_id, invitee_id, status) -- Предотвращает дублирующие pending приглашения
);

-- 3. Создание или обновление системного пользователя
INSERT INTO users (username, email, password_hash, is_system_user, avatar_url, created_at) 
VALUES (
    '1337community', 
    'system@1337community.com', 
    '$2b$10$dummyhash', 
    true,
    '/api/uploads/avatars/system-logo.png',
    NOW()
)
ON CONFLICT (username) DO UPDATE SET
    is_system_user = true,
    email = 'system@1337community.com';

-- 4. Создание индексов для оптимизации
CREATE INDEX IF NOT EXISTS idx_tournament_admins_tournament_id ON tournament_admins(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_admins_user_id ON tournament_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_tournament_id ON admin_invitations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_invitee_id ON admin_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_status ON admin_invitations(status);

-- 5. Функция для принятия приглашения администратора
CREATE OR REPLACE FUNCTION accept_admin_invitation(
    invitation_id INTEGER,
    user_id INTEGER
) RETURNS JSONB AS $$
DECLARE
    invitation_record RECORD;
    result JSONB;
BEGIN
    -- Проверяем существование и валидность приглашения
    SELECT ai.*, t.name as tournament_name 
    INTO invitation_record
    FROM admin_invitations ai
    JOIN tournaments t ON ai.tournament_id = t.id
    WHERE ai.id = invitation_id 
    AND ai.invitee_id = user_id 
    AND ai.status = 'pending' 
    AND ai.expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN '{"success": false, "message": "Приглашение не найдено или истекло"}'::jsonb;
    END IF;
    
    -- Проверяем, не является ли пользователь уже администратором
    IF EXISTS (
        SELECT 1 FROM tournament_admins 
        WHERE tournament_id = invitation_record.tournament_id 
        AND user_id = user_id
    ) THEN
        -- Обновляем статус приглашения
        UPDATE admin_invitations 
        SET status = 'accepted', responded_at = NOW() 
        WHERE id = invitation_id;
        
        RETURN '{"success": true, "message": "Вы уже являетесь администратором этого турнира"}'::jsonb;
    END IF;
    
    -- Добавляем пользователя в администраторы
    INSERT INTO tournament_admins (tournament_id, user_id, permissions)
    VALUES (
        invitation_record.tournament_id, 
        user_id, 
        '{"can_edit_matches": true, "can_manage_participants": true, "can_invite_admins": true}'::jsonb
    );
    
    -- Обновляем статус приглашения
    UPDATE admin_invitations 
    SET status = 'accepted', responded_at = NOW() 
    WHERE id = invitation_id;
    
    result := jsonb_build_object(
        'success', true,
        'message', format('Вы успешно стали администратором турнира "%s"', invitation_record.tournament_name),
        'tournament_id', invitation_record.tournament_id,
        'tournament_name', invitation_record.tournament_name
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. Функция для отклонения приглашения администратора
CREATE OR REPLACE FUNCTION decline_admin_invitation(
    invitation_id INTEGER,
    user_id INTEGER
) RETURNS JSONB AS $$
DECLARE
    invitation_record RECORD;
    result JSONB;
BEGIN
    -- Проверяем существование приглашения
    SELECT ai.*, t.name as tournament_name 
    INTO invitation_record
    FROM admin_invitations ai
    JOIN tournaments t ON ai.tournament_id = t.id
    WHERE ai.id = invitation_id 
    AND ai.invitee_id = user_id 
    AND ai.status = 'pending';
    
    IF NOT FOUND THEN
        RETURN '{"success": false, "message": "Приглашение не найдено"}'::jsonb;
    END IF;
    
    -- Обновляем статус приглашения
    UPDATE admin_invitations 
    SET status = 'declined', responded_at = NOW() 
    WHERE id = invitation_id;
    
    result := jsonb_build_object(
        'success', true,
        'message', format('Приглашение в администраторы турнира "%s" отклонено', invitation_record.tournament_name),
        'tournament_id', invitation_record.tournament_id,
        'tournament_name', invitation_record.tournament_name
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. Автоматическое обновление истекших приглашений
CREATE OR REPLACE FUNCTION update_expired_invitations() RETURNS void AS $$
BEGIN
    UPDATE admin_invitations 
    SET status = 'expired' 
    WHERE status = 'pending' 
    AND expires_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- 🆕 7.1. Улучшенная функция очистки с возвращением количества обновленных записей
CREATE OR REPLACE FUNCTION cleanup_expired_admin_invitations() RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql;

-- 🆕 7.2. Функция для автоматической очистки при каждом новом приглашении (триггер)
CREATE OR REPLACE FUNCTION auto_cleanup_expired_invitations() RETURNS TRIGGER AS $$
BEGIN
    -- Очищаем истекшие приглашения перед вставкой нового
    PERFORM cleanup_expired_admin_invitations();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 🆕 7.3. Создание триггера для автоматической очистки
DROP TRIGGER IF EXISTS auto_cleanup_trigger ON admin_invitations;
CREATE TRIGGER auto_cleanup_trigger
    BEFORE INSERT ON admin_invitations
    FOR EACH STATEMENT
    EXECUTE FUNCTION auto_cleanup_expired_invitations();

-- 8. Функция для отправки уведомления о приглашении (триггер)
CREATE OR REPLACE FUNCTION send_admin_invitation_notification() RETURNS TRIGGER AS $$
DECLARE
    system_user_id INTEGER;
    tournament_name TEXT;
    inviter_username TEXT;
    chat_id INTEGER;
    message_text TEXT;
BEGIN
    -- Получаем ID системного пользователя
    SELECT id INTO system_user_id 
    FROM users 
    WHERE username = '1337community' AND is_system_user = true;
    
    IF system_user_id IS NULL THEN
        RETURN NEW; -- Если системный пользователь не найден, просто возвращаем
    END IF;
    
    -- Получаем информацию о турнире и приглашающем
    SELECT t.name, u.username 
    INTO tournament_name, inviter_username
    FROM tournaments t
    JOIN users u ON NEW.inviter_id = u.id
    WHERE t.id = NEW.tournament_id;
    
    -- Находим чат турнира
    SELECT id INTO chat_id
    FROM chats 
    WHERE name = tournament_name AND type = 'group';
    
    IF chat_id IS NOT NULL THEN
        -- Формируем текст сообщения
        message_text := format(
            '🤝 %s приглашает вас стать администратором турнира "%s"!

Вы получите права на:
• Управление участниками
• Редактирование результатов матчей  
• Приглашение других администраторов

Выберите действие:', 
            inviter_username, 
            tournament_name
        );
        
        -- Создаем сообщение с кнопками
        INSERT INTO messages (chat_id, sender_id, content, message_type, metadata)
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
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Создание триггера для автоматической отправки сообщений
DROP TRIGGER IF EXISTS admin_invitation_notification_trigger ON admin_invitations;
CREATE TRIGGER admin_invitation_notification_trigger
    AFTER INSERT ON admin_invitations
    FOR EACH ROW 
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION send_admin_invitation_notification();

-- 10. Добавление колонки is_system_user если она не существует
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_system_user'
    ) THEN
        ALTER TABLE users ADD COLUMN is_system_user BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 11. Создание задачи для очистки истекших приглашений (опционально)
-- Можно добавить в cron или вызывать периодически
-- SELECT update_expired_invitations();

COMMIT;

-- ===== ИНФОРМАЦИЯ ДЛЯ РАЗРАБОТЧИКОВ =====
/*
Созданные таблицы:
1. tournament_admins - администраторы турниров с правами
2. admin_invitations - приглашения в администраторы

Созданные функции:
1. accept_admin_invitation(invitation_id, user_id) - принятие приглашения
2. decline_admin_invitation(invitation_id, user_id) - отклонение приглашения  
3. update_expired_invitations() - обновление истекших приглашений
4. send_admin_invitation_notification() - отправка уведомлений (триггер)

API Endpoints (нужно добавить в routes):
- POST /tournaments/:id/invite-admin - приглашение администратора
- DELETE /tournaments/:id/admins/:userId - удаление администратора
- POST /admin-invitations/:id/accept - принятие приглашения
- POST /admin-invitations/:id/decline - отклонение приглашения

Права администраторов (permissions JSON):
- can_edit_matches: редактирование результатов матчей
- can_manage_participants: управление участниками
- can_invite_admins: приглашение администраторов
*/ 