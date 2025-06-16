-- Добавляем колонки для восстановления пароля
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;

-- Добавляем индекс для быстрого поиска по токену
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON users(password_reset_token); 