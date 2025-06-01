-- Создание таблицы для профилей Dota 2
CREATE TABLE IF NOT EXISTS dota_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    steam_id VARCHAR(20) NOT NULL,
    dota_stats JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_dota_profiles_user_id ON dota_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_dota_profiles_steam_id ON dota_profiles(steam_id);
CREATE INDEX IF NOT EXISTS idx_dota_profiles_updated_at ON dota_profiles(updated_at);

-- Добавление комментариев
COMMENT ON TABLE dota_profiles IS 'Профили игроков Dota 2 с данными из OpenDota API';
COMMENT ON COLUMN dota_profiles.user_id IS 'ID пользователя из таблицы users';
COMMENT ON COLUMN dota_profiles.steam_id IS 'Steam ID пользователя';
COMMENT ON COLUMN dota_profiles.dota_stats IS 'JSON данные статистики из OpenDota API';
COMMENT ON COLUMN dota_profiles.created_at IS 'Дата создания профиля';
COMMENT ON COLUMN dota_profiles.updated_at IS 'Дата последнего обновления профиля'; 