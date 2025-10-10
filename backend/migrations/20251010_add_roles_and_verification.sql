-- Roles, user_roles, and user_verifications (KYC)

-- 1) Base roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL CHECK (code ~ '^[a-z_]+$'),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2) User to roles (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT NOW(),
    granted_by INT REFERENCES users(id),
    UNIQUE(user_id, role_id)
);

-- 3) KYC: user verifications
CREATE TABLE IF NOT EXISTS user_verifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- passport | id_card | driver_license
    document_number VARCHAR(64),
    country_code CHAR(2),
    files JSONB, -- [{ path, type, uploaded_at }]
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    admin_comment TEXT,
    reviewed_by INT REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4) Seed base roles
INSERT INTO roles (code, name, description) VALUES
    ('user','Обычный пользователь','Базовый доступ'),
    ('platform_admin','Администратор платформы','Полный доступ к платформе'),
    ('organizer','Турнирный организатор','Создание и управление турнирами'),
    ('verified_user','Верифицированный пользователь','KYC пройден'),
    ('moderator','Модератор','Модерация контента и чатов'),
    ('referee','Судья','Управление матчами и результатами'),
    ('anti_cheat_reviewer','Античит-ревьюер','Проверка подозрительных игроков'),
    ('support','Саппорт','Поддержка пользователей'),
    ('content_manager','Контент-менеджер','Публичные тексты и баннеры'),
    ('server_admin','Серверный админ','CS2/инфраструктура'),
    ('finance_manager','Финансы','Выплаты и призы')
ON CONFLICT (code) DO NOTHING;

-- 5) Backfill: grant everyone base 'user'
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'user'
ON CONFLICT DO NOTHING;

-- 6) Backfill: platform admins (IDs provided)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'platform_admin'
WHERE u.id IN (1, 2, 34, 36, 46)
ON CONFLICT DO NOTHING;

-- 7) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);


