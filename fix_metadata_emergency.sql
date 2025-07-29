-- 🚨 ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ METADATA ADMIN_INVITATION
-- Добавляет actions и удаляет блокирующие поля

BEGIN;

-- 1. Проверяем текущее состояние
SELECT 
    id,
    content,
    message_type,
    metadata ? 'invitation_id' as has_invitation_id,
    metadata ? 'actions' as has_actions,
    metadata ? 'processed' as has_processed,
    metadata ? 'action' as has_action,
    metadata
FROM messages 
WHERE message_type = 'admin_invitation' 
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 2. Удаляем блокирующие поля
UPDATE messages 
SET metadata = (metadata - 'processed' - 'action')
WHERE message_type = 'admin_invitation'
  AND (metadata ? 'processed' OR metadata ? 'action')
  AND created_at >= NOW() - INTERVAL '24 hours';

-- 3. Добавляем actions если их нет
UPDATE messages 
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{actions}',
    jsonb_build_array(
        jsonb_build_object(
            'type', 'accept_admin_invitation',
            'label', '✅ Принять',
            'invitation_id', (metadata ->> 'invitation_id')::integer
        ),
        jsonb_build_object(
            'type', 'decline_admin_invitation',
            'label', '❌ Отклонить',
            'invitation_id', (metadata ->> 'invitation_id')::integer
        )
    )
)
WHERE message_type = 'admin_invitation'
  AND metadata ? 'invitation_id'
  AND NOT (metadata ? 'actions')
  AND created_at >= NOW() - INTERVAL '24 hours';

-- 4. Проверяем результат
SELECT 
    id,
    metadata ? 'invitation_id' as has_invitation_id,
    metadata ? 'actions' as has_actions,
    jsonb_array_length(metadata -> 'actions') as actions_count,
    metadata ? 'processed' as has_processed_after,
    metadata ? 'action' as has_action_after,
    metadata -> 'invitation_id' as invitation_id
FROM messages 
WHERE message_type = 'admin_invitation' 
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

COMMIT;

-- 5. Информация о результате
DO $$
DECLARE
    msg_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO msg_count
    FROM messages 
    WHERE message_type = 'admin_invitation' 
      AND created_at >= NOW() - INTERVAL '24 hours';
      
    RAISE NOTICE 'Обработано % сообщений admin_invitation за последние 24 часа', msg_count;
END $$; 