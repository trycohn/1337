-- Миграция: Добавление полей для хранения информации о призерах турнира
-- Дата создания: 2025-01-22
-- Описание: Добавляет поля winner_id, winner_name, second_place_id, second_place_name, third_place_id, third_place_name в таблицу tournaments
--           и поля team_name, is_team_member в таблицу user_tournament_stats для учета командных призеров

-- Добавляем поля для хранения информации о призерах в таблицу tournaments
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS winner_id INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS winner_name VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS second_place_id INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS second_place_name VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS third_place_id INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS third_place_name VARCHAR(255) DEFAULT NULL;

-- Добавляем поля для хранения информации о команде в статистике пользователей
ALTER TABLE user_tournament_stats
ADD COLUMN IF NOT EXISTS team_name VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_team_member BOOLEAN DEFAULT FALSE;

-- Добавляем комментарии к новым полям tournaments
COMMENT ON COLUMN tournaments.winner_id IS 'ID победителя турнира (ссылка на tournament_participants или tournament_teams)';
COMMENT ON COLUMN tournaments.winner_name IS 'Имя победителя турнира';
COMMENT ON COLUMN tournaments.second_place_id IS 'ID участника, занявшего второе место';
COMMENT ON COLUMN tournaments.second_place_name IS 'Имя участника, занявшего второе место';
COMMENT ON COLUMN tournaments.third_place_id IS 'ID участника, занявшего третье место';
COMMENT ON COLUMN tournaments.third_place_name IS 'Имя участника, занявшего третье место';

-- Добавляем комментарии к новым полям user_tournament_stats
COMMENT ON COLUMN user_tournament_stats.team_name IS 'Название команды, в которой участвовал игрок (для командных турниров)';
COMMENT ON COLUMN user_tournament_stats.is_team_member IS 'Флаг: участвовал ли игрок в команде (true) или как одиночный игрок (false)';

-- Создаем индексы для улучшения производительности запросов
CREATE INDEX IF NOT EXISTS idx_tournaments_winner_id ON tournaments(winner_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_second_place_id ON tournaments(second_place_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_third_place_id ON tournaments(third_place_id);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_team_name ON user_tournament_stats(team_name);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_is_team_member ON user_tournament_stats(is_team_member);

-- Логирование миграции (только если есть существующие турниры)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM tournaments LIMIT 1) THEN
        INSERT INTO tournament_logs (tournament_id, user_id, event_type, event_data, created_at)
        SELECT 
            (SELECT id FROM tournaments ORDER BY id LIMIT 1), -- Берем ID первого существующего турнира
            1, 
            'migration', 
            '{"migration": "add_tournament_winners", "description": "Добавлены поля для хранения информации о призерах турнира и командной статистики"}',
            NOW()
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_logs');
    END IF;
END $$;

COMMIT; 