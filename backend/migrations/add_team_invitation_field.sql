-- Миграция для добавления поля team_invitation_id в таблицу notifications
-- Дата: 2025-01-29

-- Добавляем поле team_invitation_id в таблицу notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS team_invitation_id INTEGER;

-- Добавляем внешний ключ для связи с таблицей user_team_invitations
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_team_invitation
    FOREIGN KEY (team_invitation_id) REFERENCES user_team_invitations(id) ON DELETE CASCADE; 