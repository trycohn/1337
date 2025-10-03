-- backend/migrations/20251003_create_tournament_drafts.sql
-- Миграция для системы черновиков турниров
-- Дата: 3 октября 2025
-- Автор: AI Fullstack Developer
-- Версия: 1.0.0

-- ============================================
-- СОЗДАНИЕ ТАБЛИЦЫ ЧЕРНОВИКОВ
-- ============================================

CREATE TABLE IF NOT EXISTS tournament_drafts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Данные черновика (JSONB для гибкости)
    draft_data JSONB NOT NULL DEFAULT '{}',
    /*
    draft_data structure:
    {
        "template": {...},      // Выбранный шаблон (если был)
        "basicInfo": {...},     // Базовая информация
        "format": {...},        // Настройки формата
        "rules": {...},         // Правила
        "branding": {...}       // Брендинг
    }
    */
    
    -- Текущий шаг wizard (1-6)
    current_step INTEGER DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 6),
    
    -- Название черновика (для удобства)
    draft_name VARCHAR(255),
    
    -- Временные метки
    created_at TIMESTAMP DEFAULT NOW(),
    last_saved_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',
    
    -- Мета-информация
    meta JSONB DEFAULT '{}',
    /*
    meta structure:
    {
        "auto_saved": true,
        "save_count": 42,
        "source": "wizard" | "manual"
    }
    */
    
    -- Ограничение: один активный черновик на пользователя
    CONSTRAINT one_active_draft_per_user UNIQUE (user_id, id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON tournament_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_expires_at ON tournament_drafts(expires_at);
CREATE INDEX IF NOT EXISTS idx_drafts_last_saved ON tournament_drafts(user_id, last_saved_at DESC);

-- Комментарии
COMMENT ON TABLE tournament_drafts IS 'Черновики турниров для Wizard интерфейса';
COMMENT ON COLUMN tournament_drafts.draft_data IS 'JSONB с данными всех шагов Wizard';
COMMENT ON COLUMN tournament_drafts.current_step IS 'Текущий шаг Wizard (1-6)';
COMMENT ON COLUMN tournament_drafts.expires_at IS 'Черновики автоматически удаляются через 7 дней';

-- ============================================
-- ФУНКЦИЯ ОЧИСТКИ УСТАРЕВШИХ ЧЕРНОВИКОВ
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_drafts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tournament_drafts
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Удалено % устаревших черновиков', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_drafts() IS 'Удаление устаревших черновиков (expires_at < NOW)';

-- ============================================
-- ТРИГГЕР АВТООБНОВЛЕНИЯ last_saved_at
-- ============================================

CREATE OR REPLACE FUNCTION update_draft_last_saved()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_saved_at = NOW();
    
    -- Увеличиваем счетчик сохранений
    IF NEW.meta IS NULL THEN
        NEW.meta = '{}';
    END IF;
    
    NEW.meta = jsonb_set(
        NEW.meta,
        '{save_count}',
        to_jsonb(COALESCE((NEW.meta->>'save_count')::INTEGER, 0) + 1)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_draft_last_saved
BEFORE UPDATE ON tournament_drafts
FOR EACH ROW
EXECUTE FUNCTION update_draft_last_saved();

COMMENT ON TRIGGER trigger_update_draft_last_saved ON tournament_drafts IS 'Автообновление last_saved_at при каждом сохранении';

-- ============================================
-- ПОЛИТИКА БЕЗОПАСНОСТИ (Row Level Security)
-- ============================================

-- Включаем RLS
ALTER TABLE tournament_drafts ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи видят только свои черновики
CREATE POLICY drafts_user_isolation ON tournament_drafts
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::INTEGER);

COMMENT ON POLICY drafts_user_isolation ON tournament_drafts IS 'Пользователи видят только свои черновики';

-- ============================================
-- ПРЕДЗАПОЛНЕННЫЕ ДАННЫЕ ДЛЯ ТЕСТИРОВАНИЯ
-- ============================================

-- Можно добавить тестовый черновик для разработки
-- INSERT INTO tournament_drafts (user_id, draft_data, current_step) VALUES
-- (1, '{"basicInfo": {"name": "Test Draft"}}', 2);

-- ============================================
-- ПРОВЕРКА МИГРАЦИИ
-- ============================================

DO $$
BEGIN
    -- Проверяем, что таблица создана
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tournament_drafts'
    ) THEN
        RAISE NOTICE '✅ Таблица tournament_drafts успешно создана';
    ELSE
        RAISE EXCEPTION '❌ Ошибка: таблица tournament_drafts не создана';
    END IF;
    
    -- Проверяем индексы
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'tournament_drafts' AND indexname = 'idx_drafts_user_id'
    ) THEN
        RAISE NOTICE '✅ Индексы успешно созданы';
    END IF;
    
    -- Проверяем функции
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'cleanup_expired_drafts'
    ) THEN
        RAISE NOTICE '✅ Функция cleanup_expired_drafts создана';
    END IF;
    
    RAISE NOTICE '🎉 Миграция 20251003_create_tournament_drafts успешно завершена!';
END $$;

