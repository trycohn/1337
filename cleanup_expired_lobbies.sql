-- 🧹 Очистка устаревших лобби (созданы более 1 часа назад)

-- 1. Удаляем выборы карт для устаревших лобби
DELETE FROM map_selections
WHERE lobby_id IN (
    SELECT id FROM match_lobbies
    WHERE created_at < NOW() - INTERVAL '1 hour'
      AND status IN ('waiting', 'ready', 'picking')
);

-- 2. Удаляем приглашения для устаревших лобби
DELETE FROM lobby_invitations
WHERE lobby_id IN (
    SELECT id FROM match_lobbies
    WHERE created_at < NOW() - INTERVAL '1 hour'
      AND status IN ('waiting', 'ready', 'picking')
);

-- 3. Удаляем устаревшие лобби
DELETE FROM match_lobbies
WHERE created_at < NOW() - INTERVAL '1 hour'
  AND status IN ('waiting', 'ready', 'picking');

-- 4. Проверка результата
SELECT 
    COUNT(*) as active_lobbies_count,
    MIN(created_at) as oldest_lobby,
    MAX(created_at) as newest_lobby
FROM match_lobbies
WHERE status IN ('waiting', 'ready', 'picking');

