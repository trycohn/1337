-- backend/migrations/20251003_create_tournament_templates.sql
-- Создание системы шаблонов турниров
-- Дата: 3 октября 2025
-- Версия: 1.0.0

-- ============================================
-- СОЗДАНИЕ ТАБЛИЦЫ ШАБЛОНОВ
-- ============================================

CREATE TABLE IF NOT EXISTS tournament_templates (
    id SERIAL PRIMARY KEY,
    
    -- Основная информация
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
    
    -- Визуальные элементы
    thumbnail_url VARCHAR(255),
    icon VARCHAR(10), -- Emoji иконка для UI
    
    -- Метаданные
    is_official BOOLEAN DEFAULT FALSE,
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    use_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Конфигурация шаблона (JSONB для гибкости)
    config JSONB NOT NULL,
    /*
    config structure:
    {
        "format": "single" | "double" | "mix",
        "bracket_type": "single_elimination" | "double_elimination" | "swiss",
        "participant_type": "team" | "solo",
        "team_size": 5,
        "max_teams": 16,
        "game": "counter strike 2",
        "lobby_enabled": true,
        "lobby_match_format": "bo1" | "bo3" | "bo5",
        "final_match_format": null | "bo1" | "bo3" | "bo5",
        "seeding_type": "random",
        "recommended_duration": "3-4 hours",
        "prize_pool_suggestion": "small" | "medium" | "large",
        "tournament_type": "open",
        "rules_template": "standard_cs2"
    }
    */
    
    -- Временные метки
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_templates_category ON tournament_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_official ON tournament_templates(is_official, is_active);
CREATE INDEX IF NOT EXISTS idx_templates_use_count ON tournament_templates(use_count DESC);

-- Комментарии
COMMENT ON TABLE tournament_templates IS 'Шаблоны турниров для быстрого создания';
COMMENT ON COLUMN tournament_templates.config IS 'JSONB конфигурация всех параметров турнира';
COMMENT ON COLUMN tournament_templates.use_count IS 'Счетчик использования шаблона (для статистики)';

-- ============================================
-- ПРЕДЗАПОЛНЕННЫЕ ОФИЦИАЛЬНЫЕ ШАБЛОНЫ
-- ============================================

-- Шаблон 1: Daily Cup (ежедневный быстрый турнир)
INSERT INTO tournament_templates (
    name, 
    description, 
    category, 
    icon,
    is_official, 
    is_active,
    config
) VALUES (
    '⚡ Daily Cup',
    'Быстрый ежедневный турнир на 32 участника. Single Elimination BO1 - идеально для короткой сессии 3-4 часа.',
    'daily',
    '⚡',
    TRUE,
    TRUE,
    '{
        "format": "single",
        "bracket_type": "single_elimination",
        "participant_type": "team",
        "team_size": 5,
        "max_teams": 32,
        "game": "counter strike 2",
        "lobby_enabled": true,
        "lobby_match_format": "bo1",
        "final_match_format": null,
        "seeding_type": "random",
        "tournament_type": "open",
        "recommended_duration": "3-4 часа",
        "prize_pool_suggestion": "small"
    }'::jsonb
);

-- Шаблон 2: Weekly Championship (еженедельный чемпионат)
INSERT INTO tournament_templates (
    name, 
    description, 
    category, 
    icon,
    is_official, 
    is_active,
    config
) VALUES (
    '🏆 Weekly Championship',
    'Еженедельный чемпионат на 16 команд. Double Elimination BO3 с особым форматом финала BO5 - полноценное соревнование на 2 дня.',
    'weekly',
    '🏆',
    TRUE,
    TRUE,
    '{
        "format": "double",
        "bracket_type": "double_elimination",
        "participant_type": "team",
        "team_size": 5,
        "max_teams": 16,
        "game": "counter strike 2",
        "lobby_enabled": true,
        "lobby_match_format": "bo3",
        "final_match_format": "bo5",
        "seeding_type": "rating",
        "tournament_type": "open",
        "recommended_duration": "2 дня",
        "prize_pool_suggestion": "medium"
    }'::jsonb
);

-- Шаблон 3: Monthly League (месячная лига Swiss)
INSERT INTO tournament_templates (
    name, 
    description, 
    category, 
    icon,
    is_official, 
    is_active,
    config
) VALUES (
    '👑 Monthly League',
    'Месячная лига на 32 команды. Swiss System с 5 раундами BO3 - профессиональный формат с накоплением очков.',
    'monthly',
    '👑',
    TRUE,
    TRUE,
    '{
        "format": "single",
        "bracket_type": "swiss",
        "participant_type": "team",
        "team_size": 5,
        "max_teams": 32,
        "game": "counter strike 2",
        "lobby_enabled": true,
        "lobby_match_format": "bo3",
        "final_match_format": "bo5",
        "seeding_type": "balanced",
        "tournament_type": "open",
        "recommended_duration": "4 недели",
        "prize_pool_suggestion": "large"
    }'::jsonb
);

-- Шаблон 4: Mix Tournament (микс турнир)
INSERT INTO tournament_templates (
    name, 
    description, 
    category, 
    icon,
    is_official, 
    is_active,
    config
) VALUES (
    '🎲 Classic Mix',
    'Классический Mix турнир - автоматическое формирование команд по рейтингу. Single Elimination BO1, быстрый и честный.',
    'daily',
    '🎲',
    TRUE,
    TRUE,
    '{
        "format": "mix",
        "bracket_type": "single_elimination",
        "participant_type": "solo",
        "team_size": 5,
        "max_teams": null,
        "game": "counter strike 2",
        "lobby_enabled": true,
        "lobby_match_format": "bo1",
        "final_match_format": "bo3",
        "seeding_type": "random",
        "tournament_type": "open",
        "recommended_duration": "4-5 часов",
        "prize_pool_suggestion": "small",
        "mix_type": "classic",
        "mix_rating_type": "faceit"
    }'::jsonb
);

-- Шаблон 5: Wingman 2v2 Cup
INSERT INTO tournament_templates (
    name, 
    description, 
    category, 
    icon,
    is_official, 
    is_active,
    config
) VALUES (
    '⚡ Wingman 2v2 Cup',
    'Быстрый турнир в формате Wingman 2v2. Single Elimination BO1 - динамичный формат для небольших команд.',
    'daily',
    '⚡',
    TRUE,
    TRUE,
    '{
        "format": "single",
        "bracket_type": "single_elimination",
        "participant_type": "team",
        "team_size": 2,
        "max_teams": 16,
        "game": "counter strike 2",
        "lobby_enabled": true,
        "lobby_match_format": "bo1",
        "final_match_format": "bo3",
        "seeding_type": "random",
        "tournament_type": "open",
        "recommended_duration": "2-3 часа",
        "prize_pool_suggestion": "small"
    }'::jsonb
);

-- ============================================
-- ФУНКЦИЯ ИНКРЕМЕНТА use_count
-- ============================================

CREATE OR REPLACE FUNCTION increment_template_use_count(template_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE tournament_templates
    SET use_count = use_count + 1
    WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_template_use_count IS 'Увеличение счетчика использования шаблона';

-- ============================================
-- ТРИГГЕР АВТООБНОВЛЕНИЯ updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_timestamp
BEFORE UPDATE ON tournament_templates
FOR EACH ROW
EXECUTE FUNCTION update_template_timestamp();

-- ============================================
-- ПРОВЕРКА МИГРАЦИИ
-- ============================================

DO $$
DECLARE
    template_count INTEGER;
BEGIN
    -- Проверяем создание таблицы
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tournament_templates'
    ) THEN
        RAISE NOTICE '✅ Таблица tournament_templates успешно создана';
    ELSE
        RAISE EXCEPTION '❌ Ошибка: таблица tournament_templates не создана';
    END IF;
    
    -- Проверяем предзаполненные шаблоны
    SELECT COUNT(*) INTO template_count
    FROM tournament_templates
    WHERE is_official = TRUE;
    
    IF template_count >= 5 THEN
        RAISE NOTICE '✅ Предзаполнено % официальных шаблонов', template_count;
    ELSE
        RAISE WARNING '⚠️ Найдено только % официальных шаблонов (ожидалось 5)', template_count;
    END IF;
    
    -- Проверяем индексы
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'tournament_templates' AND indexname = 'idx_templates_category'
    ) THEN
        RAISE NOTICE '✅ Индексы успешно созданы';
    END IF;
    
    RAISE NOTICE '🎉 Миграция 20251003_create_tournament_templates успешно завершена!';
    RAISE NOTICE '📋 Доступно шаблонов: %', template_count;
END $$;

