BEGIN;

UPDATE tournament_teams
SET name = regexp_replace(name, '^R(\\d+)-\\s*', '', 'i')
WHERE name ~ '^R\\d+-';

COMMIT;
