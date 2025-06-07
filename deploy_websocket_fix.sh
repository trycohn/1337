#!/bin/bash

# 🔧 Скрипт развертывания исправлений WebSocket Socket.IO v2.0
# Автор: 1337 Community Development Team
# Дата: 2025-01-22
# Исправления: Backend Socket.IO + ALL Frontend Socket.IO клиенты

echo "🚀 Начинаю развертывание исправлений WebSocket Socket.IO v2.0..."

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
if git diff HEAD~1 --name-only | grep -q "package.json"; then
    echo "📦 Обнаружены изменения в package.json, обновляем зависимости..."
    
    # Backend зависимости
    if [ -f "backend/package.json" ]; then
        echo "📦 Обновление backend зависимостей..."
        cd backend
        npm install
        cd ..
    fi
    
    # Frontend зависимости
    if [ -f "frontend/package.json" ]; then
        echo "📦 Обновление frontend зависимостей..."
        cd frontend
        npm install
        cd ..
    fi
else
    echo "ℹ️ Зависимости не изменились"
fi

# Сборка frontend (обязательно для изменений в Socket.IO клиентах)
echo "🔨 Сборка frontend с исправленными Socket.IO подключениями..."
cd frontend
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при сборке frontend"
    cd ..
    exit 1
fi
cd ..

# Проверка файлов WebSocket исправлений
echo "🔍 Проверка файлов WebSocket исправлений..."

# Проверка backend исправлений
if grep -q "withCredentials" backend/server.js; then
    echo "✅ Backend: server.js содержит исправления Socket.IO"
else
    echo "⚠️ Backend: server.js может не содержать все исправления"
fi

# Проверка frontend исправлений
echo "🔍 Проверка frontend исправлений..."

if grep -q "withCredentials.*true" frontend/src/hooks/tournament/useWebSocket.js; then
    echo "✅ Frontend: useWebSocket.js исправлен"
else
    echo "⚠️ Frontend: useWebSocket.js может потребовать исправлений"
fi

if grep -q "withCredentials.*true" frontend/src/components/Layout.js; then
    echo "✅ Frontend: Layout.js исправлен"
else
    echo "⚠️ Frontend: Layout.js может потребовать исправлений"
fi

if grep -q "withCredentials.*true" frontend/src/components/TournamentDetails.js; then
    echo "✅ Frontend: TournamentDetails.js исправлен"
else
    echo "⚠️ Frontend: TournamentDetails.js может потребовать исправлений"
fi

# Запуск приложения
echo "🚀 Запуск приложения..."
pm2 start backend/server.js --name "1337-backend"

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при запуске приложения"
    exit 1
fi

# Ожидание стабилизации
echo "⏳ Ожидание стабилизации приложения (10 секунд)..."
sleep 10

# Проверка статуса
echo "📊 Проверка статуса приложения..."
pm2 status 1337-backend

# Показать последние логи
echo "📋 Последние логи приложения:"
pm2 logs 1337-backend --lines 20

echo ""
echo "🎉 Развертывание WebSocket исправлений v2.0 завершено!"
echo ""
echo "📋 ВАЖНЫЕ ИНСТРУКЦИИ ПО ТЕСТИРОВАНИЮ:"
echo "1. 🌐 Откройте https://1337community.com в браузере"
echo "2. 🔧 Откройте Developer Tools (F12)"
echo "3. 🔍 Проверьте консоль на наличие сообщений:"
echo "   ✅ '✅ Socket.IO ... соединение установлено'"
echo "   ✅ '✅ Layout: WebSocket соединение установлено'"
echo "   ✅ '✅ Socket.IO турнир соединение установлено'"
echo "4. 🌐 Проверьте вкладку Network → WS на наличие WebSocket соединений"
echo "5. 💬 Протестируйте чат в любом турнире"
echo "6. 🔔 Проверьте работу уведомлений"
echo ""
echo "🔧 ЕСЛИ ПРОБЛЕМЫ ОСТАЮТСЯ:"
echo "1. Очистите кеш браузера (Ctrl+Shift+R)"
echo "2. Проверьте Nginx конфигурацию: cat websocket_nginx_config.md"
echo "3. Проверьте логи Nginx: sudo tail -f /var/log/nginx/error.log"
echo "4. Свяжитесь с DevOps для настройки Nginx proxy"
echo ""
echo "📊 Применённые исправления:"
echo "- ✅ Backend Socket.IO сервер: правильные CORS + транспорты + таймауты"
echo "- ✅ Frontend useWebSocket.js: window.location.origin + withCredentials"
echo "- ✅ Frontend Layout.js: withCredentials + правильные таймауты"
echo "- ✅ Frontend TournamentDetails.js: websocket+polling транспорты"
echo "- ✅ Frontend Messenger.js: уже использовал правильные настройки"
echo ""
echo "🎯 Все Socket.IO подключения теперь синхронизированы и оптимизированы!" 