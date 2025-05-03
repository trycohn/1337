-- Добавление столбца token_expiry в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMP; 

-- Добавление столбца cs2_premier_rank в таблицу users для хранения ранга Premier
ALTER TABLE users ADD COLUMN IF NOT EXISTS cs2_premier_rank INTEGER DEFAULT 0; 

-- Добавляем столбец для хранения FACEIT ELO
ALTER TABLE users ADD COLUMN IF NOT EXISTS faceit_elo INTEGER DEFAULT 0; 

-- Добавляем столбец для хранения времени последней активности пользователя
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT NOW(); 

-- Создаем таблицу для хранения друзей
CREATE TABLE IF NOT EXISTS friends (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_friendship UNIQUE(user_id, friend_id),
    CONSTRAINT not_self_friend CHECK(user_id != friend_id)
);

-- Индекс для ускорения поиска друзей
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);

-- Таблицы для системы сообщений
CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) DEFAULT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'private', -- private, group
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_participants (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_admin BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, document, announcement
    content_meta JSONB DEFAULT NULL, -- Для хранения метаданных (название файла, размер и т.д.)
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_status (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    UNIQUE(message_id, user_id)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_status_message_id ON message_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_status_user_id ON message_status(user_id);

-- Функция для обновления времени последнего обновления чата
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chats
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления времени при отправке сообщения
CREATE TRIGGER update_chat_timestamp_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_timestamp();

-- Добавление столбцов full_description и rules в таблицу tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS full_description TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rules TEXT;

-- При окончании списка миграций по турнирам
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_pool TEXT;

-- Добавление столбца bracket_type в таблицу tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bracket_type VARCHAR(50) DEFAULT 'single_elimination';

-- Добавление столбца team_size в таблицу tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 1;

-- Создание таблицы tournament_teams для хранения команд микс-турниров
CREATE TABLE IF NOT EXISTS tournament_teams (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы tournament_team_members для связи участников и команд
CREATE TABLE IF NOT EXISTS tournament_team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_id ON tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_team_members_team_id ON tournament_team_members(team_id);

-- Таблицы для хранения участников команд
-- Изменения для поддержки ссылок на участников
ALTER TABLE tournament_team_members ADD COLUMN IF NOT EXISTS participant_id INTEGER REFERENCES tournament_participants(id) ON DELETE CASCADE;

-- Разрешаем хранить nullable user_id, чтобы можно было сохранять участников без user_id
ALTER TABLE tournament_team_members ALTER COLUMN user_id DROP NOT NULL;

-- Создаем индекс для ускорения поиска по participant_id
CREATE INDEX IF NOT EXISTS idx_tournament_team_members_participant_id ON tournament_team_members(participant_id);

-- Создаем таблицу maps, если она еще не существует
CREATE TABLE IF NOT EXISTS maps (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    game VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Создаем индекс для быстрого поиска по игре
CREATE INDEX IF NOT EXISTS idx_maps_game ON maps(game);

-- Добавляем карты для Counter-Strike 2, если их еще нет
DO $$
BEGIN
    -- Проверяем, есть ли карты для CS2
    IF NOT EXISTS (SELECT 1 FROM maps WHERE game = 'Counter-Strike 2' LIMIT 1) THEN
        -- Вставляем карты для CS2
        INSERT INTO maps (name, game, display_name, created_at) VALUES
            ('de_dust2', 'Counter-Strike 2', 'Dust II', NOW()),
            ('de_mirage', 'Counter-Strike 2', 'Mirage', NOW()),
            ('de_nuke', 'Counter-Strike 2', 'Nuke', NOW()),
            ('de_train', 'Counter-Strike 2', 'Train', NOW()),
            ('de_anubis', 'Counter-Strike 2', 'Anubis', NOW()),
            ('de_ancient', 'Counter-Strike 2', 'Ancient', NOW()),
            ('de_inferno', 'Counter-Strike 2', 'Inferno', NOW()),
            ('de_vertigo', 'Counter-Strike 2', 'Vertigo', NOW()),
            ('de_overpass', 'Counter-Strike 2', 'Overpass', NOW());
    END IF;
END $$; 