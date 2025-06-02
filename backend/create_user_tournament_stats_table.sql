-- Создание таблицы для статистики пользователей в турнирах
-- Эта таблица хранит результаты участия пользователей в турнирах

-- Создаем таблицу если она не существует
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

-- Индексы для производительности (создаем только если не существуют)
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_user_id ON user_tournament_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_tournament_id ON user_tournament_stats(tournament_id);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_result ON user_tournament_stats(result);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_is_team ON user_tournament_stats(is_team);

-- Создаем функцию для обновления updated_at (если еще не существует)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Проверяем и создаем триггер только если он не существует
DO $$
BEGIN
    -- Проверяем, существует ли триггер
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_user_tournament_stats_updated_at' 
        AND event_object_table = 'user_tournament_stats'
    ) THEN
        -- Создаем триггер
        CREATE TRIGGER update_user_tournament_stats_updated_at 
            BEFORE UPDATE ON user_tournament_stats
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE '✅ Триггер update_user_tournament_stats_updated_at создан';
    ELSE
        RAISE NOTICE 'ℹ️ Триггер update_user_tournament_stats_updated_at уже существует';
    END IF;
END
$$;

-- Добавляем проверочные constraints (только если не существуют)
DO $$
BEGIN
    -- Проверяем constraint на wins
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'wins_non_negative' 
        AND table_name = 'user_tournament_stats'
    ) THEN
        ALTER TABLE user_tournament_stats 
        ADD CONSTRAINT wins_non_negative CHECK (wins >= 0);
        RAISE NOTICE '✅ Constraint wins_non_negative добавлен';
    END IF;
    
    -- Проверяем constraint на losses
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'losses_non_negative' 
        AND table_name = 'user_tournament_stats'
    ) THEN
        ALTER TABLE user_tournament_stats 
        ADD CONSTRAINT losses_non_negative CHECK (losses >= 0);
        RAISE NOTICE '✅ Constraint losses_non_negative добавлен';
    END IF;
END
$$;

-- Финальная проверка и сообщение об успехе
DO $$
DECLARE
    table_exists BOOLEAN;
    trigger_exists BOOLEAN;
    record_count INTEGER;
BEGIN
    -- Проверяем таблицу
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_tournament_stats'
    ) INTO table_exists;
    
    -- Проверяем триггер
    SELECT EXISTS (
        SELECT FROM information_schema.triggers 
        WHERE trigger_name = 'update_user_tournament_stats_updated_at'
        AND event_object_table = 'user_tournament_stats'
    ) INTO trigger_exists;
    
    -- Подсчитываем записи
    SELECT COUNT(*) FROM user_tournament_stats INTO record_count;
    
    -- Выводим итоговый статус
    IF table_exists AND trigger_exists THEN
        RAISE NOTICE '🎉 УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО!';
        RAISE NOTICE '✅ Таблица user_tournament_stats: СОЗДАНА';
        RAISE NOTICE '✅ Триггер обновления: АКТИВЕН';
        RAISE NOTICE '✅ Индексы: СОЗДАНЫ';
        RAISE NOTICE '✅ Constraints: ДОБАВЛЕНЫ';
        RAISE NOTICE '📊 Текущих записей: %', record_count;
        RAISE NOTICE '🚀 Система статистики турниров готова к работе!';
    ELSE
        RAISE NOTICE '⚠️ Не все компоненты созданы успешно';
        RAISE NOTICE 'Таблица: %', CASE WHEN table_exists THEN '✅' ELSE '❌' END;
        RAISE NOTICE 'Триггер: %', CASE WHEN trigger_exists THEN '✅' ELSE '❌' END;
    END IF;
END
$$; 