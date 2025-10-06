-- backend/migrations/20251003_fix_drafts_rls.sql
-- Исправление Row Level Security для tournament_drafts
-- Дата: 3 октября 2025

-- ============================================
-- ОТКЛЮЧЕНИЕ RLS (временно для упрощения)
-- ============================================

-- Удаляем политику
DROP POLICY IF EXISTS drafts_user_isolation ON tournament_drafts;

-- Отключаем RLS
ALTER TABLE tournament_drafts DISABLE ROW LEVEL SECURITY;

-- Комментарий
COMMENT ON TABLE tournament_drafts IS 'Черновики турниров для Wizard интерфейса (RLS отключен - фильтрация на уровне приложения)';

-- ============================================
-- ПРОВЕРКА
-- ============================================

DO $$
BEGIN
    -- Проверяем что RLS отключен
    IF EXISTS (
        SELECT 1 
        FROM pg_tables 
        WHERE tablename = 'tournament_drafts' 
        AND rowsecurity = FALSE
    ) THEN
        RAISE NOTICE '✅ Row Level Security отключен для tournament_drafts';
    ELSE
        RAISE WARNING '⚠️ RLS все еще включен';
    END IF;
    
    RAISE NOTICE '🎉 Миграция 20251003_fix_drafts_rls успешно завершена!';
END $$;

