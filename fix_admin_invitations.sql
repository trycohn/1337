-- ===== БЫСТРОЕ ИСПРАВЛЕНИЕ ТАБЛИЦЫ ADMIN_INVITATIONS =====
-- Дата: 2025-01-22
-- Цель: Убрать уникальный индекс и добавить поддержку статуса 'cancelled'

BEGIN;

-- 1. Удаляем старый уникальный индекс если он существует
DO $$ 
BEGIN
    -- Удаляем уникальный индекс если он существует
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_invitations_tournament_id_invitee_id_status_key'
    ) THEN
        ALTER TABLE admin_invitations DROP CONSTRAINT admin_invitations_tournament_id_invitee_id_status_key;
        RAISE NOTICE 'Удален старый уникальный индекс admin_invitations_tournament_id_invitee_id_status_key';
    ELSE
        RAISE NOTICE 'Уникальный индекс admin_invitations_tournament_id_invitee_id_status_key не найден';
    END IF;
END $$;

-- 2. Обновляем ограничение статуса для поддержки нового статуса 'cancelled'
DO $$ 
BEGIN
    -- Удаляем старое ограничение если существует
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_invitations_status_check'
    ) THEN
        ALTER TABLE admin_invitations DROP CONSTRAINT admin_invitations_status_check;
        RAISE NOTICE 'Удалено старое ограничение статуса';
    ELSE
        RAISE NOTICE 'Ограничение статуса admin_invitations_status_check не найдено';
    END IF;
    
    -- Добавляем новое ограничение с поддержкой 'cancelled'
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
        RAISE NOTICE 'Добавлена колонка is_system_user в таблицу users';
    ELSE
        RAISE NOTICE 'Колонка is_system_user уже существует в таблице users';
    END IF;
END $$;

-- 4. Обновляем системного пользователя
DO $$ 
BEGIN
    -- Проверяем существует ли пользователь
    IF NOT EXISTS (SELECT 1 FROM users WHERE username = '1337community') THEN
        -- Создаем нового пользователя
        INSERT INTO users (username, email, password_hash, is_system_user, avatar_url, created_at) 
        VALUES (
            '1337community', 
            'system@1337community.com', 
            '$2b$10$dummyhash', 
            true,
            '/api/uploads/avatars/system-logo.png',
            NOW()
        );
        RAISE NOTICE 'Создан новый системный пользователь 1337community';
    ELSE
        -- Обновляем существующего пользователя
        UPDATE users SET
            is_system_user = true,
            email = 'system@1337community.com'
        WHERE username = '1337community';
        RAISE NOTICE 'Обновлен существующий пользователь 1337community';
    END IF;
END $$;

-- 5. Финальная проверка и вывод результатов
DO $$ 
BEGIN
    RAISE NOTICE 'Исправление таблицы admin_invitations завершено успешно!';
    RAISE NOTICE 'Структура таблицы и ограничения обновлены для поддержки повторных приглашений';
END $$;

-- 6. Показываем текущую структуру таблицы (для информации)
SELECT 
    'Структура таблицы admin_invitations:' as info;

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'admin_invitations' 
ORDER BY ordinal_position;

-- 7. Показываем ограничения таблицы (для информации)
SELECT 
    'Ограничения таблицы admin_invitations:' as info;

SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'admin_invitations'::regclass;

COMMIT; 