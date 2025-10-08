-- Таблица для хранения CS2 серверов
CREATE TABLE IF NOT EXISTS cs2_servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 27015,
    rcon_password VARCHAR(255) NOT NULL,
    server_password VARCHAR(255),
    gotv_host VARCHAR(255),
    gotv_port INTEGER DEFAULT 27020,
    gotv_password VARCHAR(255),
    status VARCHAR(50) DEFAULT 'offline', -- offline, online, in_use, maintenance
    max_slots INTEGER DEFAULT 10,
    location VARCHAR(100), -- 'EU', 'NA', 'RU' и т.д.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_check_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb -- для дополнительных настроек
);

-- Индексы для быстрого поиска
CREATE INDEX idx_cs2_servers_status ON cs2_servers(status);
CREATE INDEX idx_cs2_servers_active ON cs2_servers(is_active);
CREATE INDEX idx_cs2_servers_location ON cs2_servers(location);

-- Добавляем поле server_id в admin_match_lobbies для привязки сервера к лобби
ALTER TABLE admin_match_lobbies 
ADD COLUMN IF NOT EXISTS server_id INTEGER REFERENCES cs2_servers(id) ON DELETE SET NULL;

-- Добавляем индекс
CREATE INDEX IF NOT EXISTS idx_admin_match_lobbies_server_id ON admin_match_lobbies(server_id);

-- Комментарии
COMMENT ON TABLE cs2_servers IS 'Хранение CS2 серверов с данными для подключения и RCON';
COMMENT ON COLUMN cs2_servers.rcon_password IS 'RCON пароль для управления сервером';
COMMENT ON COLUMN cs2_servers.status IS 'Статус сервера: offline/online/in_use/maintenance';
COMMENT ON COLUMN cs2_servers.metadata IS 'Дополнительные настройки сервера в JSON формате';

