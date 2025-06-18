-- ===== ПРОСТОЕ ИСПРАВЛЕНИЕ ТАБЛИЦЫ ADMIN_INVITATIONS =====
-- Дата: 2025-01-22
-- Цель: Убрать уникальный индекс и добавить поддержку статуса 'cancelled'

BEGIN;

-- 1. Удаляем старый уникальный индекс если он существует
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_invitations_tournament_id_invitee_id_status_key'
    ) THEN
        ALTER TABLE admin_invitations DROP CONSTRAINT admin_invitations_tournament_id_invitee_id_status_key;
        RAISE NOTICE 'Удален старый уникальный индекс';
    ELSE
        RAISE NOTICE 'Уникальный индекс не найден (это нормально)';
    END IF;
END $$;

-- 2. Обновляем ограничение статуса для поддержки 'cancelled'
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_invitations_status_check'
    ) THEN
        ALTER TABLE admin_invitations DROP CONSTRAINT admin_invitations_status_check;
        RAISE NOTICE 'Удалено старое ограничение статуса';
    ELSE
        RAISE NOTICE 'Старое ограничение статуса не найдено';
    END IF;
    
    ALTER TABLE admin_invitations ADD CONSTRAINT admin_invitations_status_check 
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));
    
    RAISE NOTICE 'Добавлено новое ограничение статуса с поддержкой cancelled';
END $$;

-- 3. Добавляем колонку is_system_user если не существует
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_system_user'
    ) THEN
        ALTER TABLE users ADD COLUMN is_system_user BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Добавлена колонка is_system_user';
    ELSE
        RAISE NOTICE 'Колонка is_system_user уже существует';
    END IF;
END $$;

-- 4. Обновляем системного пользователя
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE username = '1337community') THEN
        INSERT INTO users (username, email, password_hash, is_system_user, avatar_url, created_at) 
        VALUES (
            '1337community', 
            'system@1337community.com', 
            '$2b$10$dummyhash', 
            true,
            '/api/uploads/avatars/system-logo.png',
            NOW()
        );
        RAISE NOTICE 'Создан системный пользователь 1337community';
    ELSE
        UPDATE users SET
            is_system_user = true,
            email = 'system@1337community.com'
        WHERE username = '1337community';
        RAISE NOTICE 'Обновлен системный пользователь 1337community';
    END IF;
END $$;

-- 5. Финальное сообщение
DO $$ 
BEGIN
    RAISE NOTICE '=== ИСПРАВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО! ===';
    RAISE NOTICE 'Теперь можно отправлять повторные приглашения администраторов';
END $$;

COMMIT; 