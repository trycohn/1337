#!/bin/bash

# 🔧 Скрипт развертывания исправлений WebSocket Socket.IO
# Автор: 1337 Community Development Team
# Дата: 2025-01-22

echo "🚀 Начинаю развертывание исправлений WebSocket Socket.IO..."

# Проверяем, что мы в правильной директории
if [ ! -f "backend/server.js" ]; then
    echo "❌ Ошибка: Запустите скрипт из корневой директории проекта"
    exit 1
fi

# Остановка приложения
echo "⏸️ Остановка приложения..."
pm2 stop 1337-backend 2>/dev/null || echo "ℹ️ Приложение не было запущено через PM2"

# Обновление кода
echo "📥 Обновление кода из GitHub..."
git stash push -m "Автосохранение перед обновлением $(date)"
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при обновлении кода из GitHub"
    exit 1
fi

# Проверка изменений в package.json
echo "📦 Проверка зависимостей..."
if git diff HEAD~1 package.json | grep -q "dependencies\|devDependencies"; then
    echo "🔄 Обновление зависимостей..."
    npm install
else
    echo "ℹ️ Зависимости не изменились"
fi

# Проверка изменений frontend
if git diff HEAD~1 --name-only | grep -q "frontend/"; then
    echo "🏗️ Сборка frontend..."
    cd frontend
    npm run build
    cd ..
else
    echo "ℹ️ Frontend не изменился"
fi

# Проверка синтаксиса Node.js
echo "✅ Проверка синтаксиса backend..."
node -c backend/server.js

if [ $? -ne 0 ]; then
    echo "❌ Ошибка синтаксиса в backend/server.js"
    exit 1
fi

# Запуск приложения
echo "▶️ Запуск приложения..."
pm2 start ecosystem.config.js 2>/dev/null || pm2 start backend/server.js --name "1337-backend"

# Ожидание запуска
echo "⏳ Ожидание запуска приложения..."
sleep 5

# Проверка статуса
pm2 list | grep -q "1337-backend.*online"
if [ $? -eq 0 ]; then
    echo "✅ Приложение успешно запущено"
else
    echo "❌ Ошибка запуска приложения"
    echo "📋 Логи приложения:"
    pm2 logs 1337-backend --lines 20
    exit 1
fi

# Проверка подключения к API
echo "🔍 Проверка API..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/testdb)
if [ "$response" = "200" ]; then
    echo "✅ API отвечает корректно"
else
    echo "⚠️ API не отвечает (код: $response)"
fi

# Вывод полезной информации
echo ""
echo "🎉 Развертывание завершено!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Проверьте конфигурацию Nginx (см. websocket_nginx_config.md)"
echo "2. Перезагрузите Nginx: sudo systemctl reload nginx"
echo "3. Протестируйте WebSocket на https://1337community.com"
echo ""
echo "🔧 Команды для диагностики:"
echo "   pm2 logs 1337-backend         # Логи приложения"
echo "   pm2 status                    # Статус процессов"
echo "   sudo nginx -t                 # Проверка конфигурации Nginx"
echo "   sudo systemctl status nginx   # Статус Nginx"
echo ""
echo "🌐 Тестирование:"
echo "   Откройте https://1337community.com"
echo "   Проверьте консоль браузера (F12)"
echo "   Убедитесь в отсутствии ошибок WebSocket"

# Показать текущие логи
echo ""
echo "📜 Последние логи приложения:"
pm2 logs 1337-backend --lines 10 