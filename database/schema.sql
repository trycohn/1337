-- database/schema.sql

-- 1. Таблица пользователей
CREATE TABLE users (
  id SERIAL PRIMARY KEY,                         -- [Строка 2: Первичный ключ]
  username VARCHAR(50) UNIQUE NOT NULL,          -- [Строка 3: Уникальное имя пользователя]
  email VARCHAR(100) UNIQUE NOT NULL,            -- [Строка 4: Уникальный email]
  password_hash VARCHAR(255) NOT NULL,           -- [Строка 5: Хэш пароля]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- [Строка 6: Дата регистрации]
);

-- 2. Таблица турниров с параметром игры
CREATE TABLE tournaments (
  id SERIAL PRIMARY KEY,                          -- [Строка 11: Первичный ключ]
  name VARCHAR(100) NOT NULL,                     -- [Строка 12: Название турнира]
  description TEXT,                               -- [Строка 13: Описание турнира]
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- [Строка 14: Пользователь, создавший турнир]
  status VARCHAR(20) NOT NULL DEFAULT 'active',   -- [Строка 15: Статус турнира]
  game VARCHAR(50) NOT NULL CHECK (game IN ('Quake', 'Counter Strike 2', 'Dota 2', 'Valorant')), -- [Строка 16: Игра турнира]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- [Строка 17: Дата создания турнира]
);

-- 3. Таблица команд (глобальные команды)
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,                          -- [Строка 22: Первичный ключ]
  name VARCHAR(100) NOT NULL,                     -- [Строка 23: Название команды]
  city VARCHAR(100) NOT NULL,                     -- [Строка 24: Город команды]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- [Строка 25: Дата регистрации команды]
);

-- 4. Таблица игроков (глобальные игроки)
CREATE TABLE players (
  id SERIAL PRIMARY KEY,                          -- [Строка 30: Первичный ключ]
  name VARCHAR(100) NOT NULL,                     -- [Строка 31: Имя игрока]
  position VARCHAR(50),                           -- [Строка 32: Позиция игрока (опционально)]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- [Строка 33: Дата добавления игрока]
);

-- 5. Промежуточная таблица для связи турниров и команд
CREATE TABLE tournament_teams (
  id SERIAL PRIMARY KEY,                          -- [Строка 38: Первичный ключ]
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE, -- [Строка 39: Ссылка на турнир]
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,             -- [Строка 40: Ссылка на команду]
  UNIQUE(tournament_id, team_id)                  -- [Строка 41: Уникальность пары турнира и команды]
);

-- 6. Таблица для составов команд в турнирах
CREATE TABLE tournament_team_players (
  id SERIAL PRIMARY KEY,                          -- [Строка 46: Первичный ключ]
  tournament_team_id INTEGER REFERENCES tournament_teams(id) ON DELETE CASCADE, -- [Строка 47: Ссылка на запись турнира-команды]
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,         -- [Строка 48: Ссылка на игрока]
  is_captain BOOLEAN DEFAULT FALSE,               -- [Строка 49: Флаг капитана]
  UNIQUE(tournament_team_id, player_id)            -- [Строка 50: Игрок может быть в команде только один раз для данного турнира]
);

-- 7. Таблица матчей (для турнира, команды представлены через tournament_teams)
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,                          -- [Строка 55: Первичный ключ]
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,  -- [Строка 56: Турнир, к которому относится матч]
  round INTEGER NOT NULL,                         -- [Строка 57: Номер раунда]
  team1_id INTEGER REFERENCES tournament_teams(id), -- [Строка 58: Первая команда (запись из tournament_teams)]
  team2_id INTEGER REFERENCES tournament_teams(id), -- [Строка 59: Вторая команда (запись из tournament_teams)]
  score1 INTEGER,                                 -- [Строка 60: Счёт первой команды]
  score2 INTEGER,                                 -- [Строка 61: Счёт второй команды]
  winner_team_id INTEGER REFERENCES tournament_teams(id), -- [Строка 62: Победившая команда (запись из tournament_teams)]
  match_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- [Строка 63: Дата проведения матча]
);

-- 8. Таблица статистики игроков
CREATE TABLE player_stats (
  id SERIAL PRIMARY KEY,                          -- [Строка 68: Первичный ключ]
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE, -- [Строка 69: Ссылка на матч]
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE, -- [Строка 70: Ссылка на игрока]
  points INTEGER DEFAULT 0,                       -- [Строка 71: Очки игрока]
  assists INTEGER DEFAULT 0,                      -- [Строка 72: Передачи]
  rebounds INTEGER DEFAULT 0                      -- [Строка 73: Подборы]
);
