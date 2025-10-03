-- backend/migrations/20251003_add_final_match_format.sql
-- Добавление поддержки особого формата для финальных матчей
-- Дата: 3 октября 2025
-- Версия: 1.0.0

-- ============================================
-- ДОБАВЛЕНИЕ ПОЛЕЙ ФОРМАТОВ МАТЧЕЙ
-- ============================================

-- Добавляем lobby_match_format (если еще не существует)
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS lobby_match_format VARCHAR(10) DEFAULT NULL;

-- Добавляем final_match_format
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS final_match_format VARCHAR(10) DEFAULT NULL;

-- Удаляем старые constraints если есть
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_lobby_match_format_check;
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_final_match_format_check;

-- Добавляем constraints для валидации
ALTER TABLE tournaments
ADD CONSTRAINT tournaments_lobby_match_format_check 
CHECK (lobby_match_format IN ('bo1', 'bo3', 'bo5') OR lobby_match_format IS NULL);

ALTER TABLE tournaments
ADD CONSTRAINT tournaments_final_match_format_check 
CHECK (final_match_format IN ('bo1', 'bo3', 'bo5') OR final_match_format IS NULL);

-- Комментарии
COMMENT ON COLUMN tournaments.lobby_match_format IS 'Формат матчей по умолчанию для всех матчей турнира (если не задан - выбор в лобби)';
COMMENT ON COLUMN tournaments.final_match_format IS 'Особый формат для финальных матчей (final, semifinal, grand_final). Если NULL - используется lobby_match_format';

-- ============================================
-- ПРОВЕРКА МИГРАЦИИ
-- ============================================

DO $$
DECLARE
    lobby_exists BOOLEAN;
    final_exists BOOLEAN;
BEGIN
    -- Проверяем lobby_match_format
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tournaments' 
        AND column_name = 'lobby_match_format'
    ) INTO lobby_exists;
    
    -- Проверяем final_match_format
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tournaments' 
        AND column_name = 'final_match_format'
    ) INTO final_exists;
    
    IF lobby_exists THEN
        RAISE NOTICE '✅ Колонка lobby_match_format успешно добавлена';
    ELSE
        RAISE EXCEPTION '❌ Ошибка: колонка lobby_match_format не добавлена';
    END IF;
    
    IF final_exists THEN
        RAISE NOTICE '✅ Колонка final_match_format успешно добавлена';
    ELSE
        RAISE EXCEPTION '❌ Ошибка: колонка final_match_format не добавлена';
    END IF;
    
    RAISE NOTICE '🎉 Миграция 20251003_add_final_match_format успешно завершена!';
    RAISE NOTICE '📋 Добавлены поля: lobby_match_format, final_match_format';
END $$;

