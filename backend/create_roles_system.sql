-- Обновляем роли пользователей с ID 1 и 2 до администраторов
UPDATE users SET role = 'admin' WHERE id IN (1, 2);

-- Создаем таблицу для заявок на создание организаций
CREATE TABLE IF NOT EXISTS organization_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    website_url VARCHAR(500),
    vk_url VARCHAR(500),
    telegram_url VARCHAR(500),
    logo_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    admin_comment TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_organization_requests_user_id ON organization_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_requests_status ON organization_requests(status);
CREATE INDEX IF NOT EXISTS idx_organization_requests_reviewed_by ON organization_requests(reviewed_by);

-- Триггер для обновления updated_at
CREATE TRIGGER update_organization_requests_updated_at 
    BEFORE UPDATE ON organization_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 