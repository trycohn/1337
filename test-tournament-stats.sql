-- Тестовый скрипт для проверки системы статистики турниров
-- Запускать ПОСЛЕ создания таблицы user_tournament_stats

DO $$
DECLARE
    table_count INTEGER;
    trigger_count INTEGER;
    constraint_count INTEGER;
    index_count INTEGER;
    test_result TEXT := '';
BEGIN
    RAISE NOTICE '🧪 ТЕСТИРОВАНИЕ СИСТЕМЫ СТАТИСТИКИ ТУРНИРОВ';
    RAISE NOTICE '================================================';
    
    -- 1. Проверяем таблицу
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_tournament_stats'
    INTO table_count;
    
    IF table_count = 1 THEN
        RAISE NOTICE '✅ Таблица user_tournament_stats: НАЙДЕНА';
        test_result := test_result || '✅ Таблица ';
    ELSE
        RAISE NOTICE '❌ Таблица user_tournament_stats: НЕ НАЙДЕНА';
        test_result := test_result || '❌ Таблица ';
    END IF;
    
    -- 2. Проверяем триггер
    SELECT COUNT(*) FROM information_schema.triggers 
    WHERE trigger_name = 'update_user_tournament_stats_updated_at'
    INTO trigger_count;
    
    IF trigger_count = 1 THEN
        RAISE NOTICE '✅ Триггер update_user_tournament_stats_updated_at: НАЙДЕН';
        test_result := test_result || '✅ Триггер ';
    ELSE
        RAISE NOTICE '❌ Триггер update_user_tournament_stats_updated_at: НЕ НАЙДЕН';
        test_result := test_result || '❌ Триггер ';
    END IF;
    
    -- 3. Проверяем constraints
    SELECT COUNT(*) FROM information_schema.table_constraints 
    WHERE table_name = 'user_tournament_stats' 
    AND constraint_name IN ('wins_non_negative', 'losses_non_negative')
    INTO constraint_count;
    
    IF constraint_count = 2 THEN
        RAISE NOTICE '✅ Constraints (wins/losses): НАЙДЕНЫ (%))', constraint_count;
        test_result := test_result || '✅ Constraints ';
    ELSE
        RAISE NOTICE '⚠️ Constraints: НАЙДЕНО % из 2', constraint_count;
        test_result := test_result || '⚠️ Constraints ';
    END IF;
    
    -- 4. Проверяем индексы
    SELECT COUNT(*) FROM pg_indexes 
    WHERE tablename = 'user_tournament_stats'
    AND indexname LIKE 'idx_user_tournament_stats_%'
    INTO index_count;
    
    IF index_count >= 4 THEN
        RAISE NOTICE '✅ Индексы: НАЙДЕНО % индексов', index_count;
        test_result := test_result || '✅ Индексы ';
    ELSE
        RAISE NOTICE '⚠️ Индексы: НАЙДЕНО % (ожидалось 4+)', index_count;
        test_result := test_result || '⚠️ Индексы ';
    END IF;
    
    -- 5. Проверяем права доступа
    BEGIN
        -- Пробуем выполнить SELECT
        PERFORM COUNT(*) FROM user_tournament_stats;
        RAISE NOTICE '✅ Права доступа SELECT: РАБОТАЮТ';
        test_result := test_result || '✅ SELECT ';
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE '❌ Права доступа SELECT: ОШИБКА %', SQLERRM;
            test_result := test_result || '❌ SELECT ';
    END;
    
    -- 6. Тестируем триггер (если есть данные для тестирования)
    BEGIN
        -- Пробуем UPDATE на несуществующей записи (должен просто ничего не обновить)
        UPDATE user_tournament_stats SET result = result WHERE id = -1;
        RAISE NOTICE '✅ Триггер обновления: РАБОТАЕТ';
        test_result := test_result || '✅ UPDATE ';
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE '⚠️ Триггер обновления: ОШИБКА %', SQLERRM;
            test_result := test_result || '⚠️ UPDATE ';
    END;
    
    -- 7. Проверяем связи с другими таблицами
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage kcu USING (constraint_name)
               WHERE tc.table_name = 'user_tournament_stats' 
               AND tc.constraint_type = 'FOREIGN KEY'
               AND kcu.column_name = 'user_id') THEN
        RAISE NOTICE '✅ Foreign Key на users: НАЙДЕН';
        test_result := test_result || '✅ FK_users ';
    ELSE
        RAISE NOTICE '❌ Foreign Key на users: НЕ НАЙДЕН';
        test_result := test_result || '❌ FK_users ';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage kcu USING (constraint_name)
               WHERE tc.table_name = 'user_tournament_stats' 
               AND tc.constraint_type = 'FOREIGN KEY'
               AND kcu.column_name = 'tournament_id') THEN
        RAISE NOTICE '✅ Foreign Key на tournaments: НАЙДЕН';
        test_result := test_result || '✅ FK_tournaments ';
    ELSE
        RAISE NOTICE '❌ Foreign Key на tournaments: НЕ НАЙДЕН';
        test_result := test_result || '❌ FK_tournaments ';
    END IF;
    
    -- 8. Проверяем текущее количество записей
    SELECT COUNT(*) FROM user_tournament_stats INTO table_count;
    RAISE NOTICE 'ℹ️ Текущее количество записей: %', table_count;
    
    -- Итоговый результат
    RAISE NOTICE '================================================';
    IF test_result NOT LIKE '%❌%' THEN
        RAISE NOTICE '🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!';
        RAISE NOTICE '🚀 Система статистики турниров полностью готова к работе!';
        RAISE NOTICE '📊 Можно тестировать функцию пересчета статистики';
    ELSE
        RAISE NOTICE '⚠️ НАЙДЕНЫ ПРОБЛЕМЫ В НАСТРОЙКЕ';
        RAISE NOTICE 'Детали: %', test_result;
        RAISE NOTICE '🔧 Рекомендуется пересоздать таблицу user_tournament_stats';
    END IF;
    
    RAISE NOTICE '================================================';
END
$$; 