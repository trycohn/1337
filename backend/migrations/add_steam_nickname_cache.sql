-- Добавляем поля для кэширования Steam никнейма
ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_nickname VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_nickname_updated TIMESTAMP;

-- Создаем индекс для оптимизации запросов по steam_id
CREATE INDEX IF NOT EXISTS idx_users_steam_id ON users(steam_id) WHERE steam_id IS NOT NULL;

-- Создаем индекс для оптимизации запросов по кэшу никнейма
CREATE INDEX IF NOT EXISTS idx_users_steam_nickname_cache ON users(steam_nickname_updated) WHERE steam_nickname_updated IS NOT NULL; 