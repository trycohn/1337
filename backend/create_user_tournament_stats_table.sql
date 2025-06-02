-- Создание таблицы для статистики пользователей в турнирах
-- Эта таблица хранит результаты участия пользователей в турнирах

CREATE TABLE IF NOT EXISTS user_tournament_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    result VARCHAR(100) NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    is_team BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Уникальность: один пользователь - один результат в турнире
    UNIQUE(user_id, tournament_id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_user_id ON user_tournament_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_tournament_id ON user_tournament_stats(tournament_id);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_result ON user_tournament_stats(result);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_is_team ON user_tournament_stats(is_team);

-- Функция для обновления updated_at (если еще не существует)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_user_tournament_stats_updated_at ON user_tournament_stats;
CREATE TRIGGER update_user_tournament_stats_updated_at 
    BEFORE UPDATE ON user_tournament_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Проверочные constraints
ALTER TABLE user_tournament_stats 
ADD CONSTRAINT wins_non_negative CHECK (wins >= 0);

ALTER TABLE user_tournament_stats 
ADD CONSTRAINT losses_non_negative CHECK (losses >= 0);

-- Сообщение об успешном создании
DO $$
BEGIN
    RAISE NOTICE '✅ Таблица user_tournament_stats успешно создана или обновлена';
    RAISE NOTICE '📊 Готова к хранению результатов турниров пользователей';
END
$$; 