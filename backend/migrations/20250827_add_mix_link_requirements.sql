-- Добавляем флаги требований привязки аккаунтов для MIX турниров
-- require_faceit_linked: при типе рейтинга FACEIT
-- require_steam_linked: при типе рейтинга CS2 Premier

ALTER TABLE tournaments 
    ADD COLUMN IF NOT EXISTS require_faceit_linked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS require_steam_linked BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tournaments.require_faceit_linked IS 'Требовать привязки FACEIT аккаунта для участия (для MIX с mix_rating_type=faceit)';
COMMENT ON COLUMN tournaments.require_steam_linked  IS 'Требовать привязки Steam аккаунта для участия (для MIX с mix_rating_type=premier)';


