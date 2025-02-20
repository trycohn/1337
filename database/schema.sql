-- ========================
-- 1. Таблица пользователей
-- ========================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================
-- 2. Таблица турниров
--    (включаем поле type: solo/teams)
-- =============================
CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL, -- Автор турнира
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  game VARCHAR(50) NOT NULL CHECK (game IN ('Quake', 'Counter Strike 2', 'Dota 2', 'Valorant')),
  type VARCHAR(10) NOT NULL DEFAULT 'solo',         -- solo или teams
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 3. Таблица участников (для solo-турниров)
-- ===========================================
CREATE TABLE IF NOT EXISTS tournament_participants (
  id SERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,               -- Имя участника (solo)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 4. Таблица команд (для командных турниров)
--    Если в будущем нужны команды
-- ===========================================
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================
-- 5. Таблица матчей
--    ВАЖНО: нет ссылок (FOREIGN KEY) на team1_id / team2_id!
--    Сохраняем только FK на tournament_id, чтобы при удалении
--    турнира матчи тоже удалялись.
-- =================================================================
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  team1_id INT,           -- МОЖЕТ быть ID участника ИЛИ команды
  team2_id INT,           -- аналогично
  winner_team_id INT,     -- при необходимости (или winner_id)
  status VARCHAR(50) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 6. Таблица турнирных администраторов
-- ===========================================
CREATE TABLE IF NOT EXISTS tournament_admins (
  id SERIAL PRIMARY KEY,
  tournament_id INT REFERENCES tournaments(id) ON DELETE CASCADE,
  admin_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tournament_id, admin_id)
);

-- ===========================================
-- 7. При необходимости: статистика игроков
--    Если планируете хранить очки, ассисты и т. п.
-- ===========================================
CREATE TABLE IF NOT EXISTS player_stats (
  id SERIAL PRIMARY KEY,
  match_id INT REFERENCES matches(id) ON DELETE CASCADE,
  -- если solo: player_id -> tournament_participants?
  -- если teams: team_id -> teams / tournament_teams?
  -- В зависимости от логики
  points INT DEFAULT 0,
  assists INT DEFAULT 0,
  rebounds INT DEFAULT 0
);
