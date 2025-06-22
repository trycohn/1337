-- Обновление URL аватаров команд с относительных на абсолютные
-- Выполнить на продакшн сервере

UPDATE user_teams 
SET avatar_url = CONCAT('https://1337community.com', avatar_url)
WHERE avatar_url IS NOT NULL 
  AND avatar_url LIKE '/uploads/team-avatars/%'
  AND avatar_url NOT LIKE 'https://%';

-- Проверка результата
SELECT id, name, avatar_url 
FROM user_teams 
WHERE avatar_url IS NOT NULL; 