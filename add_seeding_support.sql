-- ===============================================
-- 🎲 МИГРАЦИЯ: ПОДДЕРЖКА ТИПОВ РАСПРЕДЕЛЕНИЯ
-- ===============================================
-- 
-- Добавляет поля для настройки распределения участников
-- в турнирной сетке с различными алгоритмами
--

BEGIN;

-- 1. Добавляем поля для настроек распределения в таблицу tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS seeding_type VARCHAR(50) DEFAULT 'random';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS seeding_config JSONB DEFAULT '{}';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS excluded_participants_count INTEGER DEFAULT 0;

-- 2. Создаем индекс для быстрого поиска по типу распределения
CREATE INDEX IF NOT EXISTS idx_tournaments_seeding_type ON tournaments(seeding_type);

-- 3. Добавляем комментарии к новым полям
COMMENT ON COLUMN tournaments.seeding_type IS 'Тип распределения участников: random, ranking, balanced, manual, snake_draft';
COMMENT ON COLUMN tournaments.seeding_config IS 'Конфигурация распределения в формате JSON (ratingType, direction, customOrder и т.д.)';
COMMENT ON COLUMN tournaments.excluded_participants_count IS 'Количество исключенных участников при выравнивании до степени двойки';

-- 4. Обновляем существующие турниры, добавляя настройки по умолчанию
UPDATE tournaments 
SET 
    seeding_type = CASE 
        WHEN seeding_type IS NULL THEN 'random'
        ELSE seeding_type
    END,
    seeding_config = CASE 
        WHEN seeding_config IS NULL THEN '{}'::jsonb
        ELSE seeding_config
    END,
    excluded_participants_count = CASE 
        WHEN excluded_participants_count IS NULL THEN 0
        ELSE excluded_participants_count
    END
WHERE seeding_type IS NULL OR seeding_config IS NULL OR excluded_participants_count IS NULL;

-- 5. Создаем constraint для валидации типов распределения
ALTER TABLE tournaments 
ADD CONSTRAINT check_seeding_type 
CHECK (seeding_type IN ('random', 'ranking', 'balanced', 'manual', 'snake_draft'));

-- 6. Создаем функцию для автоматической валидации seeding_config
CREATE OR REPLACE FUNCTION validate_seeding_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Валидируем структуру seeding_config в зависимости от типа
    IF NEW.seeding_type = 'ranking' THEN
        -- Для ranking должны быть указаны ratingType и direction
        IF NOT (NEW.seeding_config ? 'ratingType') THEN
            NEW.seeding_config = NEW.seeding_config || '{"ratingType": "faceit_elo"}'::jsonb;
        END IF;
        
        IF NOT (NEW.seeding_config ? 'direction') THEN
            NEW.seeding_config = NEW.seeding_config || '{"direction": "desc"}'::jsonb;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Создаем триггер для автоматической валидации
DROP TRIGGER IF EXISTS trigger_validate_seeding_config ON tournaments;
CREATE TRIGGER trigger_validate_seeding_config
    BEFORE INSERT OR UPDATE ON tournaments
    FOR EACH ROW
    EXECUTE FUNCTION validate_seeding_config();

-- 8. Добавляем индекс для JSON поля seeding_config
CREATE INDEX IF NOT EXISTS idx_tournaments_seeding_config_gin ON tournaments USING gin(seeding_config);

-- 9. Создаем view для удобного просмотра настроек распределения
CREATE OR REPLACE VIEW tournament_seeding_info AS
SELECT 
    t.id,
    t.name,
    t.seeding_type,
    t.seeding_config,
    t.excluded_participants_count,
    CASE 
        WHEN t.seeding_type = 'random' THEN 'Случайное распределение'
        WHEN t.seeding_type = 'ranking' THEN 'По рейтингу'
        WHEN t.seeding_type = 'balanced' THEN 'Сбалансированное'
        WHEN t.seeding_type = 'manual' THEN 'Ручное'
        WHEN t.seeding_type = 'snake_draft' THEN 'Змейка'
        ELSE 'Неизвестно'
    END as seeding_type_display,
    t.seeding_config->>'ratingType' as rating_type,
    t.seeding_config->>'direction' as sort_direction,
    (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = t.id) as total_participants,
    (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = t.id) - t.excluded_participants_count as participants_in_bracket
FROM tournaments t;

-- 10. Добавляем права доступа к view
GRANT SELECT ON tournament_seeding_info TO PUBLIC;

COMMIT;

-- ===============================================
-- 📊 ИНФОРМАЦИЯ О МИГРАЦИИ
-- ===============================================
/*
Эта миграция добавляет полную поддержку различных типов 
распределения участников в турнирной сетке:

✅ Новые поля:
- seeding_type: тип распределения (random, ranking, balanced, manual, snake_draft)
- seeding_config: JSON конфигурация с параметрами распределения
- excluded_participants_count: количество исключенных участников

✅ Функции:
- Автоматическая валидация конфигурации
- Индексы для быстрого поиска
- View для удобного просмотра настроек

✅ Совместимость:
- Существующие турниры получают настройки по умолчанию
- Обратная совместимость полностью сохранена
*/ 