-- Миграция: создание таблицы для журнала событий турнира
-- Дата: 2024-12-19
-- Описание: Создание таблицы tournament_logs для ведения журнала событий турниров

-- Создаем таблицу для журнала событий турнира, если она не существует
CREATE TABLE IF NOT EXISTS tournament_logs (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_tournament_logs_tournament_id ON tournament_logs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_created_at ON tournament_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_event_type ON tournament_logs(event_type);

-- Комментарии к таблице и столбцам для документации
COMMENT ON TABLE tournament_logs IS 'Журнал событий турниров';
COMMENT ON COLUMN tournament_logs.tournament_id IS 'ID турнира';
COMMENT ON COLUMN tournament_logs.user_id IS 'ID пользователя, инициировавшего событие (может быть NULL для системных событий)';
COMMENT ON COLUMN tournament_logs.event_type IS 'Тип события (tournament_created, participant_joined, match_completed и т.д.)';
COMMENT ON COLUMN tournament_logs.event_data IS 'Дополнительные данные события в формате JSON';
COMMENT ON COLUMN tournament_logs.created_at IS 'Время создания записи';

-- Проверяем, что таблица создана успешно и выполняем финальные действия
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    -- Проверяем существование таблицы
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tournament_logs'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'Таблица tournament_logs успешно создана или уже существует';
        
        -- Добавляем тестовую запись, чтобы убедиться что всё работает
        -- (будет удалена после проверки)
        INSERT INTO tournament_logs (tournament_id, user_id, event_type, event_data, created_at)
        SELECT 1, 1, 'system_test', '{"test": true, "migration": "create_tournament_logs_table"}'::jsonb, NOW()
        WHERE EXISTS (SELECT 1 FROM tournaments WHERE id = 1 LIMIT 1);

        -- Удаляем тестовую запись
        DELETE FROM tournament_logs WHERE event_type = 'system_test' AND event_data @> '{"test": true}';
        
        RAISE NOTICE 'Миграция create_tournament_logs_table выполнена успешно';
    ELSE
        RAISE EXCEPTION 'Ошибка создания таблицы tournament_logs';
    END IF;
END $$; 