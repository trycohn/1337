-- Добавление уникального ограничения для таблицы achievements
-- Выполните этот скрипт, если получаете ошибку ON CONFLICT

DO $$
BEGIN
    -- Проверяем, существует ли уже уникальное ограничение на title
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'achievements' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name LIKE '%title%'
    ) THEN
        -- Добавляем уникальное ограничение
        ALTER TABLE achievements ADD CONSTRAINT achievements_title_unique UNIQUE (title);
        RAISE NOTICE '✅ Добавлено уникальное ограничение для achievements.title';
    ELSE
        RAISE NOTICE '✅ Уникальное ограничение для achievements.title уже существует';
    END IF;
END $$; 