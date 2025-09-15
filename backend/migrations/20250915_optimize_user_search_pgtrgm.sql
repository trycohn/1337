-- Оптимизация поиска пользователей: pg_trgm + GIN индексы

-- 1) Включаем расширение трёхграммного поиска
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) Индексы для ускорения ILIKE и similarity по username/email
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING GIN (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING GIN (email gin_trgm_ops);

-- 3) Рекомендация оптимизатору
ANALYZE users;


