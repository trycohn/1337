-- Миграция для создания системы команд пользователей
-- Дата: 2025-01-29

-- Таблица команд
CREATE TABLE IF NOT EXISTS user_teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    description TEXT,
    captain_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    avatar_url VARCHAR(255),
    is_permanent BOOLEAN DEFAULT true, -- true для постоянных команд, false для разовых
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE SET NULL, -- для разовых команд
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица участников команд
CREATE TABLE IF NOT EXISTS user_team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES user_teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- member, captain
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- Таблица приглашений в команды
CREATE TABLE IF NOT EXISTS user_team_invitations (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES user_teams(id) ON DELETE CASCADE,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    UNIQUE(team_id, invited_user_id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_user_teams_captain ON user_teams(captain_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_tournament ON user_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_user_team_members_team ON user_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_user_team_members_user ON user_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_team_invitations_team ON user_team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_user_team_invitations_user ON user_team_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_user_team_invitations_status ON user_team_invitations(status);

-- Функция обновления updated_at
CREATE OR REPLACE FUNCTION update_user_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER user_teams_updated_at_trigger
    BEFORE UPDATE ON user_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_user_teams_updated_at(); 