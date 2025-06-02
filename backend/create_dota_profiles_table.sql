-- Создание таблицы для профилей Dota 2
-- Эта таблица хранит информацию о профилях игроков Dota 2

CREATE TABLE IF NOT EXISTS dota_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    steam_id VARCHAR(255) NOT NULL,
    dota_stats JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_dota_profiles_user_id ON dota_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_dota_profiles_steam_id ON dota_profiles(steam_id);

-- Функция для обновления updated_at (если еще не существует)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_dota_profiles_updated_at ON dota_profiles;
CREATE TRIGGER update_dota_profiles_updated_at 
    BEFORE UPDATE ON dota_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Сообщение об успешном создании
DO $$
BEGIN
    RAISE NOTICE '✅ Таблица dota_profiles успешно создана или обновлена';
END
$$; 