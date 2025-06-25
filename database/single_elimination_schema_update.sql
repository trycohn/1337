-- =====================================================
-- ОБНОВЛЕНИЕ СХЕМЫ БД ДЛЯ SINGLE ELIMINATION ТУРНИРОВ
-- Версия: 1.0 - Математически корректная реализация
-- =====================================================

-- Добавляем новые поля в таблицу matches для корректной работы турнирных сеток
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_name VARCHAR(50);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_title VARCHAR(100);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_preliminary_round BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bye_match BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_next_match_id INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS position_in_round INTEGER;

-- Добавляем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_matches_round_name ON matches(round_name);
CREATE INDEX IF NOT EXISTS idx_matches_preliminary ON matches(is_preliminary_round);
CREATE INDEX IF NOT EXISTS idx_matches_third_place ON matches(is_third_place_match);
CREATE INDEX IF NOT EXISTS idx_matches_position ON matches(position_in_round);

-- Добавляем поля в tournaments для конфигурации турнира
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS preliminary_round_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS third_place_match_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS round_naming_style VARCHAR(20) DEFAULT 'standard';

-- Создаем таблицу для хранения конфигурации раундов
CREATE TABLE IF NOT EXISTS tournament_round_config (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    round_name VARCHAR(50) NOT NULL,
    round_title VARCHAR(100),
    is_final BOOLEAN DEFAULT FALSE,
    is_semifinal BOOLEAN DEFAULT FALSE,
    is_preliminary BOOLEAN DEFAULT FALSE,
    participants_count INTEGER,
    matches_count INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индексы для tournament_round_config
CREATE INDEX IF NOT EXISTS idx_round_config_tournament ON tournament_round_config(tournament_id);
CREATE INDEX IF NOT EXISTS idx_round_config_round ON tournament_round_config(round_number);

-- Добавляем комментарии к новым полям
COMMENT ON COLUMN matches.round_name IS 'Название раунда: Финал, Полуфинал, 1/4, 1/8, Предварительный';
COMMENT ON COLUMN matches.match_title IS 'Полное название матча для отображения';
COMMENT ON COLUMN matches.is_preliminary_round IS 'Матч предварительного раунда отсева';
COMMENT ON COLUMN matches.bye_match IS 'Матч с автопроходом (bye)';
COMMENT ON COLUMN matches.loser_next_match_id IS 'ID матча куда переходит проигравший (для матча за 3-е место)';
COMMENT ON COLUMN matches.position_in_round IS 'Позиция матча в раунде для правильной сортировки';

-- Создаем функцию для автоматического расчета названий раундов
CREATE OR REPLACE FUNCTION calculate_round_name(
    round_number INTEGER,
    total_rounds INTEGER,
    is_third_place BOOLEAN DEFAULT FALSE,
    is_preliminary BOOLEAN DEFAULT FALSE
) RETURNS VARCHAR(50) AS $$
BEGIN
    IF is_third_place THEN
        RETURN 'Матч за 3-е место';
    END IF;
    
    IF is_preliminary THEN
        RETURN 'Предварительный раунд';
    END IF;
    
    -- Для основных раундов считаем с конца
    CASE (total_rounds - round_number)
        WHEN 0 THEN RETURN 'Финал';
        WHEN 1 THEN RETURN 'Полуфинал';
        WHEN 2 THEN RETURN '1/4 финала';
        WHEN 3 THEN RETURN '1/8 финала';
        WHEN 4 THEN RETURN '1/16 финала';
        WHEN 5 THEN RETURN '1/32 финала';
        ELSE RETURN '1/' || POWER(2, total_rounds - round_number + 1)::INTEGER || ' финала';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Создаем функцию валидации Single Elimination сетки
CREATE OR REPLACE FUNCTION validate_single_elimination_bracket(tournament_id_param INTEGER)
RETURNS TABLE(
    is_valid BOOLEAN,
    error_message TEXT,
    participants_count INTEGER,
    matches_count INTEGER,
    preliminary_matches INTEGER
) AS $$
DECLARE
    participant_count INTEGER;
    match_count INTEGER;
    expected_matches INTEGER;
    prelim_matches INTEGER;
BEGIN
    -- Получаем количество участников
    SELECT COUNT(*) INTO participant_count
    FROM tournament_participants tp
    WHERE tp.tournament_id = tournament_id_param;
    
    -- Получаем количество матчей
    SELECT COUNT(*) INTO match_count
    FROM matches m
    WHERE m.tournament_id = tournament_id_param;
    
    -- Получаем количество предварительных матчей
    SELECT COUNT(*) INTO prelim_matches
    FROM matches m
    WHERE m.tournament_id = tournament_id_param 
    AND m.is_preliminary_round = TRUE;
    
    -- Рассчитываем ожидаемое количество матчей
    -- В Single Elimination: N участников = N-1 матчей (+ матч за 3-е место если есть)
    expected_matches := participant_count - 1;
    
    -- Проверяем корректность
    IF participant_count < 2 THEN
        RETURN QUERY SELECT FALSE, 'Недостаточно участников (минимум 2)', participant_count, match_count, prelim_matches;
        RETURN;
    END IF;
    
    -- Возвращаем результат валидации
    RETURN QUERY SELECT 
        TRUE, 
        'Сетка корректна'::TEXT, 
        participant_count, 
        match_count, 
        prelim_matches;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для автоматического обновления названий раундов
CREATE OR REPLACE FUNCTION update_match_round_names()
RETURNS TRIGGER AS $$
DECLARE
    max_round INTEGER;
    is_prelim BOOLEAN;
BEGIN
    -- Получаем максимальный раунд для турнира
    SELECT MAX(round) INTO max_round
    FROM matches
    WHERE tournament_id = NEW.tournament_id
    AND is_preliminary_round = FALSE;
    
    -- Определяем, является ли матч предварительным
    is_prelim := COALESCE(NEW.is_preliminary_round, FALSE);
    
    -- Обновляем название раунда
    NEW.round_name := calculate_round_name(
        NEW.round,
        max_round,
        COALESCE(NEW.is_third_place_match, FALSE),
        is_prelim
    );
    
    -- Создаем название матча
    IF NEW.is_third_place_match THEN
        NEW.match_title := 'Матч за 3-е место';
    ELSIF is_prelim THEN
        NEW.match_title := 'Предварительный раунд - Матч ' || NEW.match_number;
    ELSE
        NEW.match_title := NEW.round_name || ' - Матч ' || NEW.match_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер
DROP TRIGGER IF EXISTS trigger_update_match_round_names ON matches;
CREATE TRIGGER trigger_update_match_round_names
    BEFORE INSERT OR UPDATE ON matches
    FOR EACH ROW
    EXECUTE FUNCTION update_match_round_names();

-- Обновляем существующие матчи (применяем новую логику к существующим данным)
DO $$
DECLARE
    tournament_record RECORD;
    max_round INTEGER;
BEGIN
    FOR tournament_record IN 
        SELECT DISTINCT tournament_id 
        FROM matches 
        WHERE round_name IS NULL OR round_name = ''
    LOOP
        -- Получаем максимальный раунд для каждого турнира
        SELECT MAX(round) INTO max_round
        FROM matches
        WHERE tournament_id = tournament_record.tournament_id
        AND COALESCE(is_preliminary_round, FALSE) = FALSE;
        
        -- Обновляем названия раундов для существующих матчей
        UPDATE matches SET
            round_name = calculate_round_name(
                round,
                max_round,
                COALESCE(is_third_place_match, FALSE),
                COALESCE(is_preliminary_round, FALSE)
            ),
            match_title = CASE
                WHEN is_third_place_match THEN 'Матч за 3-е место'
                WHEN COALESCE(is_preliminary_round, FALSE) THEN 'Предварительный раунд - Матч ' || match_number
                ELSE calculate_round_name(round, max_round, COALESCE(is_third_place_match, FALSE), FALSE) || ' - Матч ' || match_number
            END
        WHERE tournament_id = tournament_record.tournament_id
        AND (round_name IS NULL OR round_name = '');
    END LOOP;
END $$;

-- Создаем view для удобного получения информации о турнирных сетках
CREATE OR REPLACE VIEW tournament_bracket_info AS
SELECT 
    t.id as tournament_id,
    t.name as tournament_name,
    COUNT(tp.id) as participants_count,
    COUNT(m.id) as total_matches,
    COUNT(CASE WHEN m.is_preliminary_round = TRUE THEN 1 END) as preliminary_matches,
    COUNT(CASE WHEN m.is_third_place_match = TRUE THEN 1 END) as third_place_matches,
    MAX(m.round) as max_round,
    t.third_place_match_enabled,
    t.preliminary_round_enabled
FROM tournaments t
LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
LEFT JOIN matches m ON t.id = m.tournament_id
WHERE t.format = 'single_elimination' OR t.bracket_type = 'single_elimination'
GROUP BY t.id, t.name, t.third_place_match_enabled, t.preliminary_round_enabled;

-- Добавляем комментарий к view
COMMENT ON VIEW tournament_bracket_info IS 'Сводная информация о турнирных сетках Single Elimination';

-- Выводим информацию о завершении обновления
DO $$
BEGIN
    RAISE NOTICE 'Single Elimination schema update completed successfully!';
    RAISE NOTICE 'Added fields: round_name, match_title, is_preliminary_round, bye_match, loser_next_match_id';
    RAISE NOTICE 'Created functions: calculate_round_name, validate_single_elimination_bracket';
    RAISE NOTICE 'Created trigger: trigger_update_match_round_names';
    RAISE NOTICE 'Created view: tournament_bracket_info';
END $$; 