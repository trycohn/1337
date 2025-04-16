-- Добавление столбца token_expiry в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMP; 