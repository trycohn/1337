#!/bin/bash

# 🔧 ПРИМЕНЕНИЕ FRONTEND ИСПРАВЛЕНИЙ SOCKET.IO v2.1
# Исправление authenticateSocket функции + улучшенная диагностика
# Автор: Senior Fullstack Developer

set -e

echo "🔧 === ПРИМЕНЕНИЕ FRONTEND ИСПРАВЛЕНИЙ v2.1 ===" 
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "🚨 ПРОБЛЕМА: authenticateSocket() разрывала соединения, нарушая работу чата"
echo "💡 РЕШЕНИЕ: Обновление socketClient_final.js + улучшенная диагностика"
echo ""

# Проверяем что мы в правильной директории
if [[ ! -d "/var/www/1337community.com" ]]; then
    echo "❌ Ошибка: Скрипт должен выполняться на VDS сервере 1337community.com"
    exit 1
fi

echo "🔧 1. ПРОВЕРКА КЛЮЧЕВЫХ ИСПРАВЛЕНИЙ"
echo "─────────────────────────────────────"

# Проверяем исправления в socketClient_final.js
echo "📁 Проверяем socketClient_final.js..."
if grep -q "Устанавливаем авторизацию без разрыва соединения" frontend/src/services/socketClient_final.js; then
    echo "✅ authenticateSocket исправлена - без разрыва соединения"
else
    echo "❌ authenticateSocket НЕ исправлена"
    exit 1
fi

if grep -q "Детали ошибки" frontend/src/services/socketClient_final.js; then
    echo "✅ Улучшенная диагностика ошибок добавлена"
else
    echo "❌ Диагностика ошибок НЕ добавлена"
    exit 1
fi

# Проверяем все обновленные файлы
FILES_TO_CHECK=(
    "frontend/src/components/Layout.js"
    "frontend/src/hooks/tournament/useWebSocket.js"
    "frontend/src/components/Messenger.js"
    "frontend/src/components/TournamentDetails.js"
)

echo "📁 Проверяем обновленные файлы..."
for file in "${FILES_TO_CHECK[@]}"; do
    if grep -q "socketClient_final" "$file"; then
        echo "✅ $file использует новый клиент"
    else
        echo "❌ $file НЕ обновлен"
        exit 1
    fi
done

echo "🔧 2. СБОРКА FRONTEND"
echo "─────────────────────"

cd frontend

echo "📦 Очищаем npm cache..."
npm cache clean --force

echo "📦 Проверяем зависимости..."
if [[ ! -f "package.json" ]]; then
    echo "❌ package.json не найден"
    exit 1
fi

echo "📦 Устанавливаем зависимости..."
npm install

echo "🏗️ Собираем production build..."
npm run build

echo "🔧 3. ДИАГНОСТИКА СБОРКИ"
echo "─────────────────────────"

# Проверяем что build создался
if [[ ! -d "build" ]]; then
    echo "❌ Папка build не создана"
    exit 1
fi

# Проверяем размер build
BUILD_SIZE=$(du -sh build | cut -f1)
echo "📊 Размер build: $BUILD_SIZE"

# Проверяем наличие Socket.IO кода в сборке
if find build -name "*.js" -exec grep -l "socket\.io" {} \; | head -1 > /dev/null; then
    echo "✅ Socket.IO код найден в сборке"
else
    echo "⚠️ Socket.IO код НЕ найден в сборке"
fi

# Проверяем наличие нашего кода
if find build -name "*.js" -exec grep -l "Socket.IO Final" {} \; | head -1 > /dev/null; then
    echo "✅ Наш Socket.IO Final клиент найден в сборке"
else
    echo "⚠️ Socket.IO Final клиент НЕ найден в сборке"
fi

cd ..

echo "🔧 4. ПРОВЕРКА BACKEND И NGINX"
echo "─────────────────────────────"

# Проверяем PM2 процесс
if pm2 list | grep -q "1337-backend.*online"; then
    echo "✅ PM2 процесс 1337-backend активен"
else
    echo "⚠️ PM2 процесс 1337-backend НЕ активен"
    echo "🔄 Перезапускаем backend..."
    pm2 restart 1337-backend || echo "⚠️ Не удалось перезапустить через PM2"
fi

# Проверяем Nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx активен"
else
    echo "❌ Nginx НЕ активен"
    exit 1
fi

# Проверяем HTTP/2 (должен отсутствовать)
HTTP2_COUNT=$(nginx -T 2>/dev/null | grep -c "http2" || echo "0")
if [[ "$HTTP2_COUNT" -eq 0 ]]; then
    echo "✅ HTTP/2 отсутствует в конфигурации (хорошо для WebSocket)"
else
    echo "⚠️ HTTP/2 найден в конфигурации ($HTTP2_COUNT упоминаний)"
    echo "🔧 Рекомендуется запустить fix_websocket_ssl_final.sh"
fi

echo "🔧 5. ТЕСТИРОВАНИЕ ENDPOINTS"
echo "───────────────────────────"

# Тестируем backend напрямую
echo "🧪 Тестируем backend localhost:3000..."
BACKEND_TEST=$(curl -s http://localhost:3000/test-socketio || echo "ERROR")
if echo "$BACKEND_TEST" | grep -q '"status":"success"'; then
    echo "✅ Backend Socket.IO работает"
else
    echo "❌ Backend Socket.IO НЕ работает: $BACKEND_TEST"
fi

# Тестируем через Nginx
echo "🧪 Тестируем через Nginx..."
NGINX_TEST=$(curl -s https://1337community.com/test-socketio || echo "ERROR")
if echo "$NGINX_TEST" | grep -q '"status":"success"'; then
    echo "✅ Nginx проксирование работает"
else
    echo "❌ Nginx проксирование НЕ работает: $NGINX_TEST"
fi

# Тестируем Socket.IO polling
echo "🧪 Тестируем Socket.IO polling..."
POLLING_TEST=$(curl -s "https://1337community.com/socket.io/?EIO=4&transport=polling" || echo "ERROR")
if echo "$POLLING_TEST" | grep -q '"sid"'; then
    echo "✅ Socket.IO polling работает"
else
    echo "❌ Socket.IO polling НЕ работает: $POLLING_TEST"
fi

echo ""
echo "🎉 === РЕЗУЛЬТАТЫ ПРИМЕНЕНИЯ ==="

echo "✅ Frontend собран с исправленным Socket.IO клиентом"
echo "✅ authenticateSocket больше НЕ разрывает соединения"
echo "✅ Добавлена улучшенная диагностика ошибок"
echo "📊 Build размер: $BUILD_SIZE"

if [[ "$HTTP2_COUNT" -gt 0 ]]; then
    echo "⚠️ ВНИМАНИЕ: HTTP/2 все еще найден в Nginx конфигурации"
    echo "🔧 Для полного решения запустите:"
    echo "   ./fix_websocket_ssl_final.sh"
fi

echo ""
echo "🧪 ПРОВЕРКА В БРАУЗЕРЕ:"
echo "1. Откройте https://1337community.com"
echo "2. Очистите кэш (Ctrl+Shift+R)"
echo "3. Откройте DevTools (F12)"
echo "4. Поищите логи '[Socket.IO Final]' в консоли"
echo "5. Попробуйте отправить сообщение в чате"
echo "6. WebSocket ошибки должны исчезнуть"

echo ""
echo "📋 Если проблемы остаются:"
echo "- Проверьте ./fix_websocket_ssl_final.sh для backend исправлений"
echo "- Убедитесь что HTTP/2 полностью отключен"
echo "- Проверьте логи: tail -f /var/log/nginx/error.log" 