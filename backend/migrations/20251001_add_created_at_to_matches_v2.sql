BEGIN;

-- Add created_at to matches for consistent chronological sorting
ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE;

-- Backfill nulls to now() (safe approximation for historical rows)
UPDATE matches SET created_at = NOW() WHERE created_at IS NULL;

-- Set default for future inserts
ALTER TABLE matches ALTER COLUMN created_at SET DEFAULT NOW();

-- Create index by source_type and created_at for fast history listing
CREATE INDEX IF NOT EXISTS idx_matches_source_created_at ON matches(source_type, created_at DESC NULLS LAST);

COMMIT;

