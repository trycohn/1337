-- Безопасная вставка достижений без использования ON CONFLICT
-- Используйте этот скрипт вместо основного INSERT, если возникают проблемы

DO $$
DECLARE
    achievement_data RECORD;
    achievement_exists BOOLEAN;
BEGIN
    -- Турнирные достижения
    FOR achievement_data IN VALUES
        ('Первые шаги', 'Принял участие в первом турнире', '🎯', 'tournaments', 'common', 10, 'tournaments_participated', 1),
        ('Турнирный боец', 'Принял участие в 5 турнирах', '⚔️', 'tournaments', 'rare', 25, 'tournaments_participated', 5),
        ('Турнирный ветеран', 'Принял участие в 25 турнирах', '🛡️', 'tournaments', 'epic', 50, 'tournaments_participated', 25),
        ('Первая победа', 'Выиграл первый турнир', '👑', 'tournaments', 'rare', 50, 'tournaments_won', 1),
        ('Чемпион', 'Выиграл 5 турниров', '🏆', 'tournaments', 'legendary', 100, 'tournaments_won', 5),
        
        -- Игровые достижения
        ('Дебютант', 'Сыграл первый матч', '🎮', 'games', 'common', 5, 'matches_played', 1),
        ('Активный игрок', 'Сыграл 50 матчей', '🎯', 'games', 'rare', 30, 'matches_played', 50),
        ('Ветеран', 'Сыграл 200 матчей', '⭐', 'games', 'epic', 75, 'matches_played', 200),
        ('Первая победа в матче', 'Выиграл первый матч', '✨', 'games', 'common', 15, 'matches_won', 1),
        ('Мастер побед', 'Выиграл 100 матчей', '🔥', 'games', 'legendary', 150, 'matches_won', 100),
        
        -- Социальные достижения
        ('Дружелюбный', 'Добавил первого друга', '👥', 'social', 'common', 10, 'friends_count', 1),
        ('Популярный', 'Имеет 10 друзей', '🤝', 'social', 'rare', 25, 'friends_count', 10),
        ('Звезда сообщества', 'Имеет 50 друзей', '🌟', 'social', 'epic', 75, 'friends_count', 50),
        
        -- Серийные достижения
        ('Удачная серия', 'Выиграл 3 матча подряд', '📈', 'streaks', 'rare', 30, 'win_streak', 3),
        ('Доминирование', 'Выиграл 10 матчей подряд', '💪', 'streaks', 'legendary', 100, 'win_streak', 10),
        ('Непобедимый', 'Выиграл 25 матчей подряд', '👑', 'streaks', 'mythical', 250, 'win_streak', 25),
        
        -- Производительность
        ('Снайпер', 'Достиг 80% винрейта (минимум 20 игр)', '🎯', 'performance', 'epic', 100, 'winrate_threshold', 80),
        ('Легенда', 'Достиг 90% винрейта (минимум 50 игр)', '⚡', 'performance', 'mythical', 200, 'winrate_threshold', 90),
        
        -- Особые достижения
        ('Ранний пользователь', 'Один из первых 1000 пользователей', '🌟', 'special', 'legendary', 500, 'early_user', 1000),
        ('Год с нами', 'Активен в течение года', '🎂', 'special', 'epic', 100, 'active_days', 365)
    LOOP
        -- Проверяем, существует ли уже достижение с таким названием
        SELECT EXISTS(SELECT 1 FROM achievements WHERE title = achievement_data.column1) INTO achievement_exists;
        
        IF NOT achievement_exists THEN
            INSERT INTO achievements (title, description, icon, category, rarity, points, condition_type, condition_value)
            VALUES (achievement_data.column1, achievement_data.column2, achievement_data.column3, 
                   achievement_data.column4, achievement_data.column5, achievement_data.column6,
                   achievement_data.column7, achievement_data.column8);
            RAISE NOTICE 'Добавлено достижение: %', achievement_data.column1;
        ELSE
            RAISE NOTICE 'Достижение уже существует: %', achievement_data.column1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Проверка и добавление достижений завершены';
END $$; 