#!/bin/bash

echo "🚀 Принудительное обновление V4 ULTIMATE на сервере"
echo "=================================================="

# Проверяем подключение к серверу
echo "📡 Подключаемся к серверу..."
ssh -o ConnectTimeout=10 root@1337community.com << 'ENDSSH'

echo "🔧 Останавливаем backend..."
pm2 stop 1337-backend

echo "📂 Переходим в директорию проекта..."
cd /var/www/1337community.com

echo "📊 Проверяем текущий статус Git..."
git status
git log --oneline -3

echo "🔄 Принудительно обновляем код..."
git fetch origin main
git reset --hard origin/main
git clean -fd

echo "✅ Проверяем обновления..."
git log --oneline -3

echo "🔍 Проверяем наличие V4 роутера..."
if [ -f "backend/routes/v4-enhanced-stats.js" ]; then
    echo "✅ V4 роутер найден"
    echo "📋 Проверяем ключевые endpoints..."
    grep -n "enhanced-stats" backend/routes/v4-enhanced-stats.js | head -2
    grep -n "user-achievements" backend/routes/v4-enhanced-stats.js | head -2
    grep -n "leaderboards" backend/routes/v4-enhanced-stats.js | head -2
else
    echo "❌ V4 роутер не найден!"
fi

echo "🔍 Проверяем подключение V4 в server.js..."
grep -n "v4-enhanced-stats" backend/server.js

echo "📦 Устанавливаем недостающие зависимости..."
cd backend
npm install redis@^4.6.0 ws@^8.18.0

echo "🔄 Очищаем PM2 логи..."
pm2 flush 1337-backend

echo "🚀 Запускаем backend..."
pm2 start 1337-backend

echo "⏳ Ждем 5 секунд для запуска..."
sleep 5

echo "📊 Проверяем статус..."
pm2 status

echo "📝 Проверяем логи..."
pm2 logs 1337-backend --lines 10

echo "🧪 Тестируем V4 endpoints..."
echo "Testing /api/v4/achievements:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://1337community.com/api/v4/achievements

echo "Testing /api/v4/leaderboards:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://1337community.com/api/v4/leaderboards

echo "Testing /api/users/organization-request-status (needs auth):"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://1337community.com/api/users/organization-request-status

echo "Testing /api/dota-stats/profile/2:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://1337community.com/api/dota-stats/profile/2

echo ""
echo "🎉 Принудительное обновление завершено!"
echo "Все V4 endpoints должны теперь работать (возвращать 200 вместо 404)"

ENDSSH

echo ""
echo "📋 Результат:"
echo "✅ Если видите HTTP 200 для endpoints - все работает!"
echo "❌ Если видите HTTP 404 - проблема продолжается"
echo ""
echo "🌐 Проверьте в браузере:"
echo "https://1337community.com/api/v4/achievements"
echo "https://1337community.com/api/v4/leaderboards" 