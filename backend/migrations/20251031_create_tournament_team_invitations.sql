-- Миграция для системы приглашений в турнирные команды капитанами
-- Дата: 2025-10-31

-- Создание таблицы приглашений в турнирные команды
CREATE TABLE IF NOT EXISTS tournament_team_invitations (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    
    -- Уникальность: один пользователь не может иметь несколько pending приглашений в одну команду
    UNIQUE(team_id, invited_user_id, status)
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_tournament_team_invitations_invited_user 
    ON tournament_team_invitations(invited_user_id, status);
    
CREATE INDEX IF NOT EXISTS idx_tournament_team_invitations_team 
    ON tournament_team_invitations(team_id, status);
    
CREATE INDEX IF NOT EXISTS idx_tournament_team_invitations_tournament 
    ON tournament_team_invitations(tournament_id);

-- Комментарии
COMMENT ON TABLE tournament_team_invitations IS 'Приглашения игроков в турнирные команды капитанами';
COMMENT ON COLUMN tournament_team_invitations.inviter_id IS 'ID капитана, который отправил приглашение';
COMMENT ON COLUMN tournament_team_invitations.invited_user_id IS 'ID приглашенного игрока';
COMMENT ON COLUMN tournament_team_invitations.message IS 'Персональное сообщение от капитана';
COMMENT ON COLUMN tournament_team_invitations.status IS 'pending - ожидает ответа, accepted - принято, rejected - отклонено, cancelled - отменено отправителем';

-- Триггер для обновления updated_at
CREATE TRIGGER update_tournament_team_invitations_updated_at
    BEFORE UPDATE ON tournament_team_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

