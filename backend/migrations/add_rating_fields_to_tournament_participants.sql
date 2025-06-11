-- Миграция: Добавление полей рейтинга в tournament_participants
-- Дата: 2025-01-25
-- Описание: Добавляем поля faceit_elo и cs2_premier_rank для хранения рейтингов незарегистрированных участников микс турниров

-- Добавляем поле faceit_elo
ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS faceit_elo INTEGER;

-- Добавляем поле cs2_premier_rank
ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS cs2_premier_rank INTEGER;

-- Добавляем поле in_team для поддержки микс турниров (если не существует)
ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS in_team BOOLEAN DEFAULT FALSE;

-- Добавляем комментарии для документации
COMMENT ON COLUMN tournament_participants.faceit_elo IS 'FACEIT ELO рейтинг участника (для незарегистрированных участников или переопределения)';
COMMENT ON COLUMN tournament_participants.cs2_premier_rank IS 'CS2 Premier Rank участника (для незарегистрированных участников или переопределения)';
COMMENT ON COLUMN tournament_participants.in_team IS 'Флаг указывающий находится ли участник в команде (для микс турниров)';

-- Создаем индексы для оптимизации поиска по рейтингам
CREATE INDEX IF NOT EXISTS idx_tournament_participants_faceit_elo 
ON tournament_participants(faceit_elo) WHERE faceit_elo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_participants_cs2_premier_rank 
ON tournament_participants(cs2_premier_rank) WHERE cs2_premier_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_participants_in_team 
ON tournament_participants(tournament_id, in_team);

-- Добавляем ограничения для корректности данных
ALTER TABLE tournament_participants 
ADD CONSTRAINT chk_faceit_elo_range 
CHECK (faceit_elo IS NULL OR (faceit_elo >= 0 AND faceit_elo <= 10000));

ALTER TABLE tournament_participants 
ADD CONSTRAINT chk_cs2_premier_rank_range 
CHECK (cs2_premier_rank IS NULL OR (cs2_premier_rank >= 0 AND cs2_premier_rank <= 40000));

-- Проверяем результат
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'tournament_participants' 
AND column_name IN ('faceit_elo', 'cs2_premier_rank', 'in_team')
ORDER BY ordinal_position; 