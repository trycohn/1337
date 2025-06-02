-- 🔧 ПОЛНОЕ исправление таблицы user_tournament_stats
-- Проверяем и добавляем ВСЕ необходимые колонки

DO $$
BEGIN
    RAISE NOTICE 'Начинаем проверку структуры таблицы user_tournament_stats...';
    
    -- Проверяем и добавляем total_matches
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tournament_stats' AND column_name = 'total_matches') THEN
        ALTER TABLE user_tournament_stats ADD COLUMN total_matches INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Добавлена колонка total_matches';
    ELSE
        RAISE NOTICE '✅ Колонка total_matches уже существует';
    END IF;
    
    -- Проверяем и добавляем wins
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tournament_stats' AND column_name = 'wins') THEN
        ALTER TABLE user_tournament_stats ADD COLUMN wins INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Добавлена колонка wins';
    ELSE
        RAISE NOTICE '✅ Колонка wins уже существует';
    END IF;
    
    -- Проверяем и добавляем losses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tournament_stats' AND column_name = 'losses') THEN
        ALTER TABLE user_tournament_stats ADD COLUMN losses INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Добавлена колонка losses';
    ELSE
        RAISE NOTICE '✅ Колонка losses уже существует';
    END IF;
    
    -- Проверяем и добавляем points_scored
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tournament_stats' AND column_name = 'points_scored') THEN
        ALTER TABLE user_tournament_stats ADD COLUMN points_scored INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Добавлена колонка points_scored';
    ELSE
        RAISE NOTICE '✅ Колонка points_scored уже существует';
    END IF;
    
    -- Проверяем и добавляем points_conceded
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tournament_stats' AND column_name = 'points_conceded') THEN
        ALTER TABLE user_tournament_stats ADD COLUMN points_conceded INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Добавлена колонка points_conceded';
    ELSE
        RAISE NOTICE '✅ Колонка points_conceded уже существует';
    END IF;
    
    -- Проверяем и добавляем final_position
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tournament_stats' AND column_name = 'final_position') THEN
        ALTER TABLE user_tournament_stats ADD COLUMN final_position INTEGER;
        RAISE NOTICE '✅ Добавлена колонка final_position';
    ELSE
        RAISE NOTICE '✅ Колонка final_position уже существует';
    END IF;
    
    -- Проверяем и добавляем prize_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tournament_stats' AND column_name = 'prize_amount') THEN
        ALTER TABLE user_tournament_stats ADD COLUMN prize_amount DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE '✅ Добавлена колонка prize_amount';
    ELSE
        RAISE NOTICE '✅ Колонка prize_amount уже существует';
    END IF;
    
    -- Проверяем и добавляем is_winner
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tournament_stats' AND column_name = 'is_winner') THEN
        ALTER TABLE user_tournament_stats ADD COLUMN is_winner BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Добавлена колонка is_winner';
    ELSE
        RAISE NOTICE '✅ Колонка is_winner уже существует';
    END IF;
    
    -- Проверяем и добавляем created_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tournament_stats' AND column_name = 'created_at') THEN
        ALTER TABLE user_tournament_stats ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE '✅ Добавлена колонка created_at';
    ELSE
        RAISE NOTICE '✅ Колонка created_at уже существует';
    END IF;
    
    -- Проверяем и добавляем updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tournament_stats' AND column_name = 'updated_at') THEN
        ALTER TABLE user_tournament_stats ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE '✅ Добавлена колонка updated_at';
    ELSE
        RAISE NOTICE '✅ Колонка updated_at уже существует';
    END IF;
    
    RAISE NOTICE '🚀 Проверка и добавление колонок завершены успешно!';
    RAISE NOTICE '📊 Теперь можно выполнять основной скрипт инициализации V4';
END $$;

-- Создаем все необходимые индексы
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_user_id ON user_tournament_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_tournament_id ON user_tournament_stats(tournament_id);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_performance ON user_tournament_stats(user_id, wins, final_position);

-- Проверяем уникальное ограничение
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'user_tournament_stats' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%user_id%tournament_id%'
    ) THEN
        ALTER TABLE user_tournament_stats ADD CONSTRAINT user_tournament_stats_unique UNIQUE (user_id, tournament_id);
        RAISE NOTICE '✅ Добавлено уникальное ограничение (user_id, tournament_id)';
    ELSE
        RAISE NOTICE '✅ Уникальное ограничение уже существует';
    END IF;
END $$; 