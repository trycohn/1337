-- Создание таблицы для карт
CREATE TABLE IF NOT EXISTS maps (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    game VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для ускорения поиска карт по игре
CREATE INDEX IF NOT EXISTS maps_game_idx ON maps (game);

-- Добавление карт CS2
INSERT INTO maps (name, game, display_name) VALUES
('de_dust2', 'Counter-Strike 2', 'Dust II'),
('de_mirage', 'Counter-Strike 2', 'Mirage'),
('de_nuke', 'Counter-Strike 2', 'Nuke'),
('de_train', 'Counter-Strike 2', 'Train'),
('de_anubis', 'Counter-Strike 2', 'Anubis'),
('de_ancient', 'Counter-Strike 2', 'Ancient'),
('de_inferno', 'Counter-Strike 2', 'Inferno'),
('de_vertigo', 'Counter-Strike 2', 'Vertigo'),
('de_overpass', 'Counter-Strike 2', 'Overpass')
ON CONFLICT (name, game) DO NOTHING;

-- Комментарий к таблице
COMMENT ON TABLE maps IS 'Таблица для хранения информации о картах игр'; 