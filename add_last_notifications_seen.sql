-- Добавление поля для отслеживания последнего просмотра уведомлений
-- Выполнить на VDS сервере в базе данных

-- Добавляем поле last_notifications_seen в таблицу users
ALTER TABLE users 
ADD COLUMN last_notifications_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Устанавливаем текущее время для всех существующих пользователей
UPDATE users 
SET last_notifications_seen = CURRENT_TIMESTAMP 
WHERE last_notifications_seen IS NULL;

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_users_last_notifications_seen 
ON users(last_notifications_seen);

-- Проверяем что поле добавлено
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'last_notifications_seen'; 