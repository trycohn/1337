#!/bin/bash

# Деплой исправлений импорта статистики матчей
# Дата: 2025-10-20

echo "🚀 Начинаем деплой исправлений..."

cd /var/www/1337community.com

# 1. Пуллим изменения
echo "📥 Получаем изменения из GitHub..."
git pull origin main

# 2. Применяем миграции БД
echo "🗄️ Применяем миграции БД..."

# Миграция 1: server_id в match_lobbies
echo "  → Добавление server_id в match_lobbies..."
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f database/migrations/add_server_id_to_match_lobbies.sql

# Миграция 2: tournament_lobby_id в matchzy_matches
echo "  → Добавление tournament_lobby_id в matchzy_matches..."
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f database/migrations/add_tournament_lobby_id_to_matchzy.sql

# 3. Очищаем старые некорректные записи (опционально)
echo "🧹 Очищаем старые записи..."
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME <<EOF
-- Удаляем записи с некорректными foreign keys
DELETE FROM matchzy_matches WHERE matchid = 436834;
EOF

# 4. Перезапускаем backend
echo "🔄 Перезапускаем backend..."
pm2 restart 1337-backend

# 5. Проверяем статус
echo "✅ Проверяем статус..."
pm2 status 1337-backend

echo ""
echo "🎉 Деплой завершен!"
echo ""
echo "📋 Проверьте логи:"
echo "   pm2 logs 1337-backend --lines 50"
echo ""
echo "🧪 Тестовая последовательность:"
echo "   1. Создайте турнирное лобби"
echo "   2. Завершите пики/баны"
echo "   3. Сыграйте матч до конца"
echo "   4. Проверьте страницу /tournaments/lobby/{id}"
echo ""

