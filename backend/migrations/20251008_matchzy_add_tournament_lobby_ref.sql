-- Добавляем ссылку на турнирные лобби в matchzy_matches
ALTER TABLE matchzy_matches
    ADD COLUMN IF NOT EXISTS tournament_lobby_id INTEGER REFERENCES match_lobbies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matchzy_matches_tournament_lobby ON matchzy_matches(tournament_lobby_id);


