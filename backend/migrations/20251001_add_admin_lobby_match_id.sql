BEGIN;

ALTER TABLE admin_match_lobbies
    ADD COLUMN IF NOT EXISTS match_id INTEGER,
    ADD CONSTRAINT admin_lobby_match_fk FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_lobby_match_id ON admin_match_lobbies(match_id);

COMMIT;

