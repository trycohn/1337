#!/bin/bash

# 🚀 Скрипт развертывания исправлений WebSocket на VDS
# Дата: $(date)
# Описание: Исправление задержек обновления статуса турнира

echo "🚀 Начинаем развертывание исправлений WebSocket..."

# Переходим в директорию проекта
cd /var/www/1337community.com

# Сохраняем текущую ветку
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Текущая ветка: $CURRENT_BRANCH"

# Создаем бэкап
echo "💾 Создаем бэкап..."
cp -r backend backend_backup_$(date +%Y%m%d_%H%M%S)
cp -r frontend frontend_backup_$(date +%Y%m%d_%H%M%S)

# Получаем последние изменения
echo "📥 Получаем последние изменения..."
git fetch origin
git pull origin $CURRENT_BRANCH

# Проверяем статус
echo "📊 Проверяем статус файлов..."
git status

# Перезапускаем backend
echo "🔄 Перезапускаем backend..."
pm2 restart 1337-backend

# Проверяем статус backend
echo "✅ Проверяем статус backend..."
pm2 status 1337-backend

# Обновляем frontend (если используется build)
if [ -d "frontend/build" ]; then
    echo "🏗️ Обновляем frontend build..."
    cd frontend
    npm run build
    cd ..
fi

# Перезагружаем nginx (если необходимо)
echo "🔄 Перезагружаем nginx..."
sudo nginx -t && sudo systemctl reload nginx

# Проверяем логи backend
echo "📋 Последние логи backend:"
pm2 logs 1337-backend --lines 20

echo "✅ Развертывание завершено!"
echo ""
echo "🔍 Для проверки WebSocket исправлений:"
echo "1. Откройте турнир в браузере"
echo "2. Нажмите 'Начать турнир'"
echo "3. Статус должен обновиться мгновенно"
echo ""
echo "📊 Для мониторинга WebSocket:"
echo "GET /api/tournaments/websocket/stats" 