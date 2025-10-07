-- Добавление полей для подключения к БД сервера (для получения результатов матчей)

ALTER TABLE cs2_servers
ADD COLUMN IF NOT EXISTS db_host VARCHAR(255),
ADD COLUMN IF NOT EXISTS db_port INTEGER DEFAULT 3306,
ADD COLUMN IF NOT EXISTS db_user VARCHAR(255),
ADD COLUMN IF NOT EXISTS db_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS db_name VARCHAR(255);

-- Комментарии
COMMENT ON COLUMN cs2_servers.db_host IS 'IP адрес MySQL/MariaDB сервера (для статистики MatchZy)';
COMMENT ON COLUMN cs2_servers.db_port IS 'Порт БД (обычно 3306)';
COMMENT ON COLUMN cs2_servers.db_user IS 'Пользователь БД';
COMMENT ON COLUMN cs2_servers.db_password IS 'Пароль БД';
COMMENT ON COLUMN cs2_servers.db_name IS 'Название БД (где MatchZy сохраняет статистику)';

