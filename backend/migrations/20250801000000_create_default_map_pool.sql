-- Создание глобального дефолтного маппула для платформы

CREATE TABLE IF NOT EXISTS default_map_pool (
    id SERIAL PRIMARY KEY,
    map_name VARCHAR(50) NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE default_map_pool IS 'Глобальный дефолтный пул карт для турниров платформы';

-- Индекс для сортировки
CREATE INDEX IF NOT EXISTS idx_default_map_pool_order ON default_map_pool(display_order);

-- Первичное наполнение: Ancient, Dust II, Inferno, Mirage, Nuke, Overpass, Train
-- Используем ON CONFLICT для идемпотентности
INSERT INTO default_map_pool (map_name, display_order) VALUES
    ('ancient', 1),
    ('dust2', 2),
    ('inferno', 3),
    ('mirage', 4),
    ('nuke', 5),
    ('overpass', 6),
    ('train', 7)
ON CONFLICT (map_name) DO UPDATE SET display_order = EXCLUDED.display_order;


