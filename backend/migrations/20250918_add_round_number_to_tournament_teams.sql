BEGIN;

ALTER TABLE IF EXISTS tournament_teams
ADD COLUMN IF NOT EXISTS round_number INTEGER NULL;

UPDATE tournament_teams
SET round_number = CAST(substring(name FROM '^R(\\d+)-') AS INTEGER)
WHERE round_number IS NULL AND name ~ '^R\\d+-';

CREATE INDEX IF NOT EXISTS idx_tournament_teams_round ON tournament_teams(tournament_id, round_number);

COMMIT;
