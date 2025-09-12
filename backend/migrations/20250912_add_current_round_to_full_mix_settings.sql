-- Add current_round to tournament_full_mix_settings
ALTER TABLE tournament_full_mix_settings
ADD COLUMN IF NOT EXISTS current_round integer NOT NULL DEFAULT 1;

-- Backfill: keep existing rows at 1 if nulls existed
UPDATE tournament_full_mix_settings SET current_round = COALESCE(current_round, 1);

