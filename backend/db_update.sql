-- Добавление столбца token_expiry в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMP; 

-- Добавление столбца cs2_premier_rank в таблицу users для хранения ранга Premier
ALTER TABLE users ADD COLUMN IF NOT EXISTS cs2_premier_rank INTEGER DEFAULT 0; 

-- Добавляем столбец для хранения FACEIT ELO
ALTER TABLE users ADD COLUMN IF NOT EXISTS faceit_elo INTEGER DEFAULT 0; 