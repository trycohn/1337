-- Matches extension for custom matches + veto steps table
BEGIN;

-- 1) Extend matches table
ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(16) NOT NULL DEFAULT 'tournament',
    ADD COLUMN IF NOT EXISTS custom_lobby_id INTEGER,
    ADD COLUMN IF NOT EXISTS game VARCHAR(64),
    ADD COLUMN IF NOT EXISTS connect_url TEXT,
    ADD COLUMN IF NOT EXISTS gotv_url TEXT,
    ADD COLUMN IF NOT EXISTS maps_data JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS team1_players JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS team2_players JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS result JSONB DEFAULT '{}'::jsonb;

-- Constraints for source_type
ALTER TABLE matches
    ADD CONSTRAINT matches_source_type_check
    CHECK (source_type IN ('tournament','custom'));

-- Optional integrity constraints
-- For existing data we cannot enforce immediately with NOT VALID
ALTER TABLE matches
    ADD CONSTRAINT matches_custom_fk_notnull
    CHECK (
        (source_type = 'tournament' AND tournament_id IS NOT NULL)
        OR
        (source_type = 'custom' AND custom_lobby_id IS NOT NULL)
    ) NOT VALID;

-- Useful indexes
-- created_at может отсутствовать в старых схемах, индексируем по id как прокси времени
CREATE INDEX IF NOT EXISTS idx_matches_source_id ON matches(source_type, id DESC);
CREATE INDEX IF NOT EXISTS idx_matches_custom_lobby ON matches(custom_lobby_id);
CREATE INDEX IF NOT EXISTS idx_matches_maps_data_gin ON matches USING GIN (maps_data);

-- 2) Create veto steps table (shared by tournament and custom)
CREATE TABLE IF NOT EXISTS match_veto_steps (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    action_order INTEGER NOT NULL,
    action_type VARCHAR(8) NOT NULL CHECK (action_type IN ('pick','ban')),
    team_id INTEGER,
    map_name VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (match_id, action_order)
);

CREATE INDEX IF NOT EXISTS idx_match_veto_steps_match ON match_veto_steps(match_id);

COMMIT;

