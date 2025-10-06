-- backend/migrations/20251003_add_branding_field.sql
-- Добавление поля branding для white-label системы
-- Дата: 3 октября 2025

-- Добавляем поле branding (JSONB)
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';

-- Комментарий
COMMENT ON COLUMN tournaments.branding IS 'White-label брендинг турнира: логотип, цвета, спонсоры, кастомный домен (JSONB)';

-- Проверка
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tournaments' AND column_name = 'branding'
    ) THEN
        RAISE NOTICE '✅ Колонка branding успешно добавлена';
    ELSE
        RAISE EXCEPTION '❌ Ошибка: колонка branding не добавлена';
    END IF;
END $$;

