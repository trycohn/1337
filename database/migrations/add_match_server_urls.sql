-- Добавление колонок для хранения ссылок подключения к серверам матча
-- Дата: 2025-10-20

ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS connect_url TEXT,
ADD COLUMN IF NOT EXISTS gotv_url TEXT;

COMMENT ON COLUMN matches.connect_url IS 'Ссылка для подключения к серверу (steam://connect/...)';
COMMENT ON COLUMN matches.gotv_url IS 'Ссылка для подключения к GOTV (steam://connect/...)';

