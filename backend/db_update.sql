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