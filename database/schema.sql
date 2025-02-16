-- database/schema.sql

-- 1. Таблица пользователей
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Таблица турниров с параметром игры и форматом турнира
CREATE TABLE tournaments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  game VARCHAR(50) NOT NULL CHECK (game IN ('Quake', 'Counter Strike 2', 'Dota 2', 'Valorant')),
  format VARCHAR(50) NOT NULL DEFAULT 'single_elimination', -- ✅ Новый столбец для формата турнира
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Таблица команд (глобальные команды)
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Таблица игроков (глобальные игроки)
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  position VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Промежуточная таблица для связи турниров и команд
CREATE TABLE tournament_teams (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE(tournament_id, team_id)
);

-- 6. Таблица для составов команд в турнирах
CREATE TABLE tournament_team_players (
  id SERIAL PRIMARY KEY,
  tournament_team_id INTEGER REFERENCES tournament_teams(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  is_captain BOOLEAN DEFAULT FALSE,
  UNIQUE(tournament_team_id, player_id)
);

-- 7. Таблица матчей с поддержкой разных форматов турниров
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  team1_id INTEGER REFERENCES tournament_teams(id) ON DELETE SET NULL,
  team2_id INTEGER REFERENCES tournament_teams(id) ON DELETE SET NULL,
  score1 INTEGER DEFAULT 0,
  score2 INTEGER DEFAULT 0,
  winner_team_id INTEGER REFERENCES tournament_teams(id) ON DELETE SET NULL,
  match_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'scheduled' -- ✅ Добавлен статус матча ('scheduled', 'completed', 'won_by_default')
);

-- 8. Таблица статистики игроков
CREATE TABLE player_stats (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  rebounds INTEGER DEFAULT 0
);

-- 9. Таблица для администраторов турниров
CREATE TABLE tournament_admins (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
  admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tournament_id, admin_id)
);

-- ✅ Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_tournament_format ON tournaments(format);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);

CREATE TABLE IF NOT EXISTS tournament_participants (
  id SERIAL PRIMARY KEY,
  tournament_id INT REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tournaments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  game VARCHAR(50) NOT NULL CHECK (game IN ('Quake','Counter Strike 2','Dota 2','Valorant')),
  type VARCHAR(10) NOT NULL DEFAULT 'solo', -- 🆕 solo или teams
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  tournament_id INT REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  team1_id INT,
  team2_id INT,
  status VARCHAR(50) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);