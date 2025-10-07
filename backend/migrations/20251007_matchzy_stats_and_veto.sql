-- matchzy статистика и история veto для матчей, созданных через лобби
-- ВАЖНО: таблицы привязаны к нашим матчам (matches.id) и к админ-лобби (admin_match_lobbies.id)

-- 1) Общая сводка матча (из matchzy)
CREATE TABLE IF NOT EXISTS matchzy_matches (
    matchid           INTEGER PRIMARY KEY,
    our_match_id      INTEGER UNIQUE REFERENCES matches(id) ON DELETE SET NULL,
    lobby_id          INTEGER REFERENCES admin_match_lobbies(id) ON DELETE SET NULL,
    start_time        TIMESTAMPTZ NOT NULL,
    end_time          TIMESTAMPTZ,
    winner            VARCHAR(255) NOT NULL DEFAULT '',
    series_type       VARCHAR(16)  NOT NULL DEFAULT 'bo1',
    team1_name        VARCHAR(255) NOT NULL DEFAULT '',
    team1_score       INTEGER      NOT NULL DEFAULT 0,
    team2_name        VARCHAR(255) NOT NULL DEFAULT '',
    team2_score       INTEGER      NOT NULL DEFAULT 0,
    server_ip         VARCHAR(255) NOT NULL DEFAULT '0'
);

CREATE INDEX IF NOT EXISTS idx_matchzy_matches_our_match ON matchzy_matches(our_match_id);
CREATE INDEX IF NOT EXISTS idx_matchzy_matches_lobby ON matchzy_matches(lobby_id);

-- 2) По-карточная статистика
CREATE TABLE IF NOT EXISTS matchzy_maps (
    matchid      INTEGER     NOT NULL REFERENCES matchzy_matches(matchid) ON DELETE CASCADE,
    mapnumber    SMALLINT    NOT NULL,
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ,
    winner       VARCHAR(255) NOT NULL DEFAULT '',
    mapname      VARCHAR(64)  NOT NULL,
    team1_score  INTEGER      NOT NULL DEFAULT 0,
    team2_score  INTEGER      NOT NULL DEFAULT 0,
    -- доп. поля для UX
    picked_by_name   VARCHAR(255),
    picked_by_team_id INTEGER,
    is_decider      BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY (matchid, mapnumber)
);

CREATE INDEX IF NOT EXISTS idx_matchzy_maps_match ON matchzy_maps(matchid);
CREATE INDEX IF NOT EXISTS idx_matchzy_maps_name ON matchzy_maps(mapname);

-- 3) По-игрокам (агрегат за карту)
CREATE TABLE IF NOT EXISTS matchzy_players (
    matchid                     INTEGER     NOT NULL,
    mapnumber                   SMALLINT    NOT NULL,
    steamid64                   BIGINT      NOT NULL,
    team                        VARCHAR(255) NOT NULL,
    name                        VARCHAR(255) NOT NULL,
    kills                       INTEGER      NOT NULL DEFAULT 0,
    deaths                      INTEGER      NOT NULL DEFAULT 0,
    damage                      INTEGER      NOT NULL DEFAULT 0,
    assists                     INTEGER      NOT NULL DEFAULT 0,
    enemy5ks                    INTEGER      NOT NULL DEFAULT 0,
    enemy4ks                    INTEGER      NOT NULL DEFAULT 0,
    enemy3ks                    INTEGER      NOT NULL DEFAULT 0,
    enemy2ks                    INTEGER      NOT NULL DEFAULT 0,
    utility_count               INTEGER      NOT NULL DEFAULT 0,
    utility_damage              INTEGER      NOT NULL DEFAULT 0,
    utility_successes           INTEGER      NOT NULL DEFAULT 0,
    utility_enemies             INTEGER      NOT NULL DEFAULT 0,
    flash_count                 INTEGER      NOT NULL DEFAULT 0,
    flash_successes             INTEGER      NOT NULL DEFAULT 0,
    health_points_removed_total INTEGER      NOT NULL DEFAULT 0,
    health_points_dealt_total   INTEGER      NOT NULL DEFAULT 0,
    shots_fired_total           INTEGER      NOT NULL DEFAULT 0,
    shots_on_target_total       INTEGER      NOT NULL DEFAULT 0,
    v1_count                    INTEGER      NOT NULL DEFAULT 0,
    v1_wins                     INTEGER      NOT NULL DEFAULT 0,
    v2_count                    INTEGER      NOT NULL DEFAULT 0,
    v2_wins                     INTEGER      NOT NULL DEFAULT 0,
    entry_count                 INTEGER      NOT NULL DEFAULT 0,
    entry_wins                  INTEGER      NOT NULL DEFAULT 0,
    equipment_value             INTEGER      NOT NULL DEFAULT 0,
    money_saved                 INTEGER      NOT NULL DEFAULT 0,
    kill_reward                 INTEGER      NOT NULL DEFAULT 0,
    live_time                   INTEGER      NOT NULL DEFAULT 0,
    head_shot_kills             INTEGER      NOT NULL DEFAULT 0,
    cash_earned                 INTEGER      NOT NULL DEFAULT 0,
    enemies_flashed             INTEGER      NOT NULL DEFAULT 0,
    PRIMARY KEY(matchid, mapnumber, steamid64),
    FOREIGN KEY (matchid) REFERENCES matchzy_matches(matchid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_matchzy_players_match_map ON matchzy_players(matchid, mapnumber);
CREATE INDEX IF NOT EXISTS idx_matchzy_players_team ON matchzy_players(team);
CREATE INDEX IF NOT EXISTS idx_matchzy_players_steam ON matchzy_players(steamid64);

-- 4) История шагов veto (бан/пик/decider/side) — линкуется с лобби, затем с матчем
CREATE TABLE IF NOT EXISTS matchzy_pickban_steps (
    id               BIGSERIAL PRIMARY KEY,
    lobby_id         INTEGER REFERENCES admin_match_lobbies(id) ON DELETE CASCADE,
    matchid          INTEGER REFERENCES matchzy_matches(matchid) ON DELETE SET NULL,
    our_match_id     INTEGER REFERENCES matches(id) ON DELETE SET NULL,
    series_type      VARCHAR(16)  NOT NULL DEFAULT 'bo1',
    step_index       SMALLINT     NOT NULL,
    action           VARCHAR(16)  NOT NULL,
    team_name        VARCHAR(255),
    team_id          INTEGER,
    mapname          VARCHAR(64)  NOT NULL,
    actor_steamid64  BIGINT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pb_action_chk CHECK (action IN ('ban','pick','decider','protect','remove','side'))
);

CREATE INDEX IF NOT EXISTS idx_pb_by_lobby  ON matchzy_pickban_steps(lobby_id, step_index);
CREATE INDEX IF NOT EXISTS idx_pb_by_match  ON matchzy_pickban_steps(matchid, step_index);
CREATE INDEX IF NOT EXISTS idx_pb_by_our    ON matchzy_pickban_steps(our_match_id, step_index);

-- 5) Итоговый порядок карт серии (кто пикал, decider)
CREATE TABLE IF NOT EXISTS matchzy_series_maps (
    matchid            INTEGER     NOT NULL REFERENCES matchzy_matches(matchid) ON DELETE CASCADE,
    mapnumber          SMALLINT    NOT NULL,
    mapname            VARCHAR(64) NOT NULL,
    picked_by_name     VARCHAR(255),
    picked_by_team_id  INTEGER,
    is_decider         BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY(matchid, mapnumber)
);

-- Подсказки для оптимизатора
CREATE INDEX IF NOT EXISTS idx_series_maps_match ON matchzy_series_maps(matchid);


