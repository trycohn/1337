-- Скрипт для добавления CS2 сервера через Query в PGAdmin
-- Замените значения на реальные данные вашего сервера

-- 1. Проверить существующие серверы
SELECT id, name, host, port, status, location 
FROM cs2_servers 
ORDER BY id;

-- 2. Добавить новый сервер
-- ВАЖНО: Замените значения на реальные!
INSERT INTO cs2_servers (
    name,
    description,
    host,
    port,
    rcon_password,
    server_password,
    gotv_host,
    gotv_port,
    gotv_password,
    max_slots,
    location,
    status
) VALUES (
    'Main Server 1337',                    -- Название сервера
    'Основной игровой сервер CS2',        -- Описание
    '80.87.200.23',                        -- IP сервера
    27015,                                 -- Порт сервера
    'your_rcon_password_here',             -- RCON пароль (ВАЖНО: поменять!)
    'server_password',                     -- Пароль для подключения игроков
    '80.87.200.23',                        -- GOTV IP (обычно тот же)
    27020,                                 -- GOTV порт
    'gotv_password',                       -- GOTV пароль
    10,                                    -- Максимум слотов
    'RU',                                  -- Локация (EU, NA, RU, AS)
    'offline'                              -- Статус (offline, online, in_use, maintenance)
)
RETURNING *;

-- 3. Обновить данные существующего сервера (если нужно)
-- UPDATE cs2_servers 
-- SET 
--     host = '80.87.200.23',
--     port = 27015,
--     rcon_password = 'new_rcon_password',
--     status = 'online'
-- WHERE id = 1
-- RETURNING *;

-- 4. Проверить все серверы с их статусами
SELECT 
    id,
    name,
    host || ':' || port as address,
    status,
    location,
    is_active,
    created_at,
    last_check_at
FROM cs2_servers
ORDER BY id;

-- 5. Посмотреть историю команд на сервере
SELECT 
    c.id,
    s.name as server_name,
    c.command,
    c.status,
    c.response,
    c.duration_ms,
    u.username as executed_by,
    c.executed_at
FROM cs2_server_commands c
JOIN cs2_servers s ON s.id = c.server_id
LEFT JOIN users u ON u.id = c.executed_by
ORDER BY c.executed_at DESC
LIMIT 20;

-- 6. Удалить сервер (если нужно)
-- DELETE FROM cs2_servers WHERE id = 1;

-- 7. Привязать сервер к лобби
-- UPDATE admin_match_lobbies 
-- SET server_id = 1 
-- WHERE id = 123;

-- 8. Посмотреть лобби с привязанными серверами
SELECT 
    l.id as lobby_id,
    l.title,
    l.status,
    s.name as server_name,
    s.host || ':' || s.port as server_address
FROM admin_match_lobbies l
LEFT JOIN cs2_servers s ON s.id = l.server_id
WHERE l.server_id IS NOT NULL
ORDER BY l.created_at DESC
LIMIT 10;

