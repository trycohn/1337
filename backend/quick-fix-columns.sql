-- ⚡ Быстрое исправление: Добавление недостающих колонок в user_tournament_stats
-- Выполните этот скрипт ПЕРЕД основным init-v4-ultimate-db-simple.sql

DO $$
BEGIN
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
    
    RAISE NOTICE '🚀 Исправление колонок завершено успешно!';
END $$;

-- Создаем недостающий индекс
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_performance 
ON user_tournament_stats(user_id, wins, final_position); 