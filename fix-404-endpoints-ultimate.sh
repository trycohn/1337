#!/bin/bash

echo "🔥 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ: Устранение всех 404 ошибок"
echo "======================================================="

# Подключение к серверу и принудительное обновление
ssh -o ConnectTimeout=10 root@1337community.com << 'ENDSSH'

echo "🛑 ПОЛНАЯ ОСТАНОВКА BACKEND..."
pm2 stop 1337-backend
pm2 delete 1337-backend

echo "📂 Переход в директорию проекта..."
cd /var/www/1337community.com

echo "🗑️ ПОЛНАЯ ОЧИСТКА..."
git reset --hard HEAD
git clean -fdx
git fetch origin main --force
git reset --hard origin/main

echo "✅ Проверяем критически важные файлы..."

echo "1️⃣ Проверяем V4 роутер:"
if [ -f "backend/routes/v4-enhanced-stats.js" ]; then
    echo "✅ V4 роутер найден"
    echo "📋 Ключевые endpoints:"
    grep -n "router.get.*leaderboards" backend/routes/v4-enhanced-stats.js | head -1
    grep -n "router.get.*achievements" backend/routes/v4-enhanced-stats.js | head -1
else
    echo "❌ V4 роутер отсутствует!"
fi

echo "2️⃣ Проверяем users роутер:"
grep -n "organization-request-status" backend/routes/users.js | head -1

echo "3️⃣ Проверяем dota-stats роутер:"
grep -n "profile.*user_id" backend/routes/dotaStats.js | head -1

echo "4️⃣ Проверяем подключение в server.js:"
grep -n "v4-enhanced-stats" backend/server.js
grep -n "dotaStats" backend/server.js
grep -n "usersRouter" backend/server.js

echo "📦 Переустанавливаем зависимости..."
cd backend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

echo "🔧 Устанавливаем недостающие модули..."
npm install redis@^4.6.0 ws@^8.18.0 --save

echo "📝 Проверяем package.json:"
grep -A 5 -B 5 '"redis"' package.json || echo "Redis НЕ найден в package.json"
grep -A 5 -B 5 '"ws"' package.json || echo "WS НЕ найден в package.json"

echo "🚀 ПОЛНЫЙ ПЕРЕЗАПУСК BACKEND..."
pm2 start ecosystem.config.js --name="1337-backend" || pm2 start server.js --name="1337-backend"

echo "⏳ Ждем полного запуска (15 секунд)..."
sleep 15

echo "📊 Статус процессов:"
pm2 status

echo "📝 Логи запуска:"
pm2 logs 1337-backend --lines 20

echo "🧪 КРИТИЧЕСКИЕ ТЕСТЫ ВСЕХ ENDPOINT'ОВ:"
echo "========================================="

echo "1️⃣ Тест V4 achievements:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://1337community.com/api/v4/achievements

echo "2️⃣ Тест V4 leaderboards:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://1337community.com/api/v4/leaderboards

echo "3️⃣ Тест organization-request-status:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://1337community.com/api/users/organization-request-status

echo "4️⃣ Тест dota-stats profile:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://1337community.com/api/dota-stats/profile/2

echo "5️⃣ Тест основного API:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://1337community.com/api/tournaments

echo ""
echo "🎉 ФИНАЛЬНАЯ ПРОВЕРКА ЗАВЕРШЕНА!"
echo "================================="
echo "✅ Все endpoint'ы, возвращающие HTTP 200 - РАБОТАЮТ"
echo "❌ Endpoint'ы, возвращающие HTTP 404 - НЕ РАБОТАЮТ"
echo ""
echo "🌐 Откройте в браузере для финальной проверки:"
echo "https://1337community.com/api/v4/achievements"
echo "https://1337community.com/api/v4/leaderboards"

ENDSSH

echo ""
echo "📋 РЕЗУЛЬТАТ ИСПРАВЛЕНИЯ:"
echo "========================="
echo "Если все endpoint'ы возвращают HTTP 200:"
echo "🎉 ПРОБЛЕМА ПОЛНОСТЬЮ РЕШЕНА!"
echo ""
echo "Если есть HTTP 404:"
echo "💥 Требуется ручное вмешательство на сервере" 