-- SQL скрипт для создания чатов турниров, у которых их нет

-- Создание чатов для турниров без chat_id
DO $$
DECLARE
    tournament_record RECORD;
    new_chat_id INTEGER;
BEGIN
    -- Проходим по всем турнирам без chat_id
    FOR tournament_record IN 
        SELECT id, name, created_by 
        FROM tournaments 
        WHERE chat_id IS NULL
    LOOP
        -- Создаем новый групповой чат
        INSERT INTO chats (name, type, created_at)
        VALUES ('Турнир: ' || tournament_record.name, 'group', NOW())
        RETURNING id INTO new_chat_id;
        
        -- Привязываем чат к турниру
        UPDATE tournaments 
        SET chat_id = new_chat_id 
        WHERE id = tournament_record.id;
        
        -- Добавляем создателя турнира как администратора чата
        INSERT INTO chat_participants (chat_id, user_id, is_admin, joined_at)
        VALUES (new_chat_id, tournament_record.created_by, true, NOW());
        
        -- Добавляем всех участников турнира в чат
        INSERT INTO chat_participants (chat_id, user_id, is_admin, joined_at)
        SELECT new_chat_id, tp.user_id, false, NOW()
        FROM tournament_participants tp
        WHERE tp.tournament_id = tournament_record.id
          AND tp.user_id IS NOT NULL
          AND tp.user_id != tournament_record.created_by
        ON CONFLICT (chat_id, user_id) DO NOTHING;
        
        RAISE NOTICE 'Создан чат % для турнира %', new_chat_id, tournament_record.name;
    END LOOP;
END $$; 