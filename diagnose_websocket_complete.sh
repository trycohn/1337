#!/bin/bash

# 🔍 ПОЛНАЯ ДИАГНОСТИКА WEBSOCKET ПРОБЛЕМ
# Выявление причины падения WebSocket соединений в браузере
# Автор: Senior Fullstack Developer

set -e

echo "🔍 === ПОЛНАЯ ДИАГНОСТИКА WEBSOCKET ПРОБЛЕМ ==="
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "🔍 1. ПРОВЕРКА NGINX КОНФИГУРАЦИИ"
echo "─────────────────────────────────"

echo "📋 Проверяем активную конфигурацию Nginx:"
nginx -T 2>/dev/null | grep -A 20 "listen 443"

echo ""
echo "📋 Проверяем Socket.IO location:"
nginx -T 2>/dev/null | grep -A 15 "location /socket.io/"

echo ""
echo "📋 Проверяем HTTP/2 настройки:"
nginx -T 2>/dev/null | grep -i "http2" || echo "HTTP/2 не найден в конфигурации"

echo ""
echo "🔍 2. ТЕСТИРОВАНИЕ WEBSOCKET ЗАГОЛОВКОВ"
echo "──────────────────────────────────────"

echo "📡 Тестируем WebSocket upgrade напрямую:"
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Host: 1337community.com" \
     -H "Origin: https://1337community.com" \
     -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     -H "Sec-WebSocket-Version: 13" \
     https://1337community.com/socket.io/ || echo "WebSocket upgrade failed"

echo ""
echo "🔍 3. ПРОВЕРКА BACKEND SOCKET.IO"
echo "───────────────────────────────"

echo "📡 Socket.IO polling test:"
response=$(curl -s 'https://1337community.com/socket.io/?EIO=4&transport=polling' | head -c 100)
echo "Response: $response"

echo ""
echo "📡 Backend test endpoint:"
response=$(curl -s https://1337community.com/test-socketio)
echo "Response: $response"

echo ""
echo "🔍 4. ПРОВЕРКА ЛОГОВ"
echo "──────────────────"

echo "📋 Nginx error logs (последние 10 строк):"
tail -n 10 /var/log/nginx/error.log 2>/dev/null || echo "Nginx error log недоступен"

echo ""
echo "📋 PM2 backend logs (последние 5 строк):"
pm2 logs 1337-backend --lines 5 --nostream 2>/dev/null || echo "PM2 logs недоступны"

echo ""
echo "🔍 5. АНАЛИЗ ПРОБЛЕМЫ"
echo "──────────────────"

echo "🔍 Проверяем протокол для Socket.IO location..."

# Проверяем, действительно ли Socket.IO location использует HTTP/1.1
if nginx -T 2>/dev/null | grep -A 10 "location /socket.io/" | grep -q "proxy_http_version 1.1"; then
    echo "✅ proxy_http_version 1.1 настроен для Socket.IO"
else
    echo "❌ proxy_http_version 1.1 НЕ найден для Socket.IO"
fi

# Проверяем наличие WebSocket заголовков
if nginx -T 2>/dev/null | grep -A 10 "location /socket.io/" | grep -q "proxy_set_header Upgrade"; then
    echo "✅ WebSocket Upgrade заголовок настроен"
else
    echo "❌ WebSocket Upgrade заголовок НЕ найден"
fi

# Проверяем HTTP/2 на уровне сервера
if nginx -T 2>/dev/null | grep -B 5 -A 5 "listen 443" | grep -q "http2 on"; then
    echo "⚠️  HTTP/2 включен глобально - может блокировать WebSocket upgrade"
    GLOBAL_HTTP2=true
else
    echo "✅ HTTP/2 не включен глобально"
    GLOBAL_HTTP2=false
fi

echo ""
echo "🎯 6. РЕКОМЕНДАЦИИ"
echo "─────────────────"

if [ "$GLOBAL_HTTP2" = true ]; then
    echo "🚨 ПРОБЛЕМА НАЙДЕНА: HTTP/2 включен глобально"
    echo "   Это блокирует WebSocket upgrade для Socket.IO"
    echo ""
    echo "💡 РЕШЕНИЕ: Нужно отключить HTTP/2 глобально"
    echo "   Nginx не может смешивать HTTP/2 и HTTP/1.1 в одном server блоке"
    echo ""
    echo "🔧 Применить исправление:"
    echo "   ./fix_websocket_final_v2.sh"
else
    echo "🤔 HTTP/2 не включен глобально, ищем другие проблемы..."
fi

echo ""
echo "📊 SUMMARY:"
echo "- Socket.IO polling: работает"
echo "- Backend: работает"
echo "- WebSocket upgrade: падает"
echo "- Причина: вероятно HTTP/2 конфликт"
echo "" 
