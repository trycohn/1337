CREATE TABLE tournament_invitations (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, user_id, status)
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_tournament_invitations_user_id ON tournament_invitations(user_id);
CREATE INDEX idx_tournament_invitations_tournament_id ON tournament_invitations(tournament_id);
CREATE INDEX idx_tournament_invitations_status ON tournament_invitations(status);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tournament_invitations_updated_at
    BEFORE UPDATE ON tournament_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 