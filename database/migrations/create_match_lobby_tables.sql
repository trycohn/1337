-- Миграция для создания таблиц лобби матча
-- Дата: 2025-01-27

-- 1. Таблица настроек лобби для турниров
CREATE TABLE IF NOT EXISTS tournament_lobby_settings (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT FALSE,
    match_format VARCHAR(10) DEFAULT NULL, -- 'bo1', 'bo3', 'bo5' или NULL для выбора в лобби
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id)
);

-- 2. Таблица карт турнира (для CS2)
CREATE TABLE IF NOT EXISTS tournament_maps (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    map_name VARCHAR(50) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, map_name)
);

-- 3. Таблица лобби матчей
CREATE TABLE IF NOT EXISTS match_lobbies (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, ready, picking, completed
    match_format VARCHAR(10), -- bo1, bo3, bo5
    first_picker_team_id INTEGER REFERENCES tournament_teams(id),
    current_turn_team_id INTEGER REFERENCES tournament_teams(id),
    team1_ready BOOLEAN DEFAULT FALSE,
    team2_ready BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(match_id)
);

-- 4. Таблица выбора карт
CREATE TABLE IF NOT EXISTS map_selections (
    id SERIAL PRIMARY KEY,
    lobby_id INTEGER NOT NULL REFERENCES match_lobbies(id) ON DELETE CASCADE,
    map_name VARCHAR(50) NOT NULL,
    action_type VARCHAR(10) NOT NULL, -- 'pick' или 'ban'
    team_id INTEGER REFERENCES tournament_teams(id),
    action_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Таблица приглашений в лобби
CREATE TABLE IF NOT EXISTS lobby_invitations (
    id SERIAL PRIMARY KEY,
    lobby_id INTEGER NOT NULL REFERENCES match_lobbies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES tournament_teams(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, declined
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    UNIQUE(lobby_id, user_id)
);

-- Индексы для оптимизации
CREATE INDEX idx_tournament_lobby_settings_tournament_id ON tournament_lobby_settings(tournament_id);
CREATE INDEX idx_tournament_maps_tournament_id ON tournament_maps(tournament_id);
CREATE INDEX idx_match_lobbies_match_id ON match_lobbies(match_id);
CREATE INDEX idx_match_lobbies_tournament_id ON match_lobbies(tournament_id);
CREATE INDEX idx_match_lobbies_status ON match_lobbies(status);
CREATE INDEX idx_map_selections_lobby_id ON map_selections(lobby_id);
CREATE INDEX idx_lobby_invitations_user_id ON lobby_invitations(user_id);
CREATE INDEX idx_lobby_invitations_status ON lobby_invitations(status);

-- Добавление столбца в таблицу tournaments для быстрой проверки
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS lobby_enabled BOOLEAN DEFAULT FALSE;

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_tournament_lobby_settings_updated_at BEFORE UPDATE ON tournament_lobby_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_match_lobbies_updated_at BEFORE UPDATE ON match_lobbies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Комментарии к таблицам
COMMENT ON TABLE tournament_lobby_settings IS 'Настройки лобби для турниров';
COMMENT ON TABLE tournament_maps IS 'Список карт для турнира CS2';
COMMENT ON TABLE match_lobbies IS 'Активные лобби матчей';
COMMENT ON TABLE map_selections IS 'История выбора карт в лобби';
COMMENT ON TABLE lobby_invitations IS 'Приглашения участников в лобби'; 