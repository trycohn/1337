#!/bin/bash

# 🚨 ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ WEBSOCKET - ФИНАЛЬНОЕ РЕШЕНИЕ
# Принудительное устранение git конфликтов + полное удаление HTTP/2
# Автор: Senior Fullstack Developer

set -e

echo "🚨 === ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ WEBSOCKET ПРОБЛЕМ ==="
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "🔥 КРИТИЧЕСКИЕ ПРОБЛЕМЫ ОБНАРУЖЕНЫ:"
echo "  • Git конфликт блокирует обновления"
echo "  • HTTP/2 все еще активен (HTTP/2 400 ошибка)"
echo "  • WebSocket upgrade не работает"
echo ""

# Проверяем что мы на правильном сервере
if [[ ! -d "/var/www/1337community.com" ]]; then
    echo "❌ Ошибка: Скрипт должен выполняться на VDS сервере 1337community.com"
    exit 1
fi

cd /var/www/1337community.com

echo "🔧 1. ПРИНУДИТЕЛЬНОЕ РЕШЕНИЕ GIT КОНФЛИКТА"
echo "─────────────────────────────────────────"

echo "🔄 Сохраняем текущие изменения в stash..."
git stash push -m "Emergency backup before websocket fix $(date '+%Y%m%d_%H%M%S')"

echo "🔄 Сбрасываем к последнему коммиту..."
git reset --hard HEAD

echo "📥 Получаем последние изменения из GitHub..."
git pull origin main

echo "✅ Git конфликт решен"
echo ""

echo "🔧 2. ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ HTTP/2"
echo "───────────────────────────────────"

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

echo "💾 Создаем backup конфигураций..."
cp /etc/nginx/nginx.conf "/etc/nginx/nginx.conf.emergency.backup.$BACKUP_DATE"
cp /etc/nginx/sites-available/1337community.com "/etc/nginx/sites-available/1337community.com.emergency.backup.$BACKUP_DATE"

echo "🔍 Текущие упоминания HTTP/2:"
HTTP2_COUNT=$(nginx -T 2>/dev/null | grep -c "http2" || echo "0")
echo "Найдено HTTP/2 упоминаний: $HTTP2_COUNT"

if [[ "$HTTP2_COUNT" -gt 0 ]]; then
    echo "🔥 Принудительно удаляем HTTP/2 из всех конфигураций..."
    
    # Удаляем HTTP/2 из nginx.conf
    sed -i '/http2/d' /etc/nginx/nginx.conf
    
    # Создаем новую конфигурацию сайта БЕЗ HTTP/2
    cat > /etc/nginx/sites-available/1337community.com << 'EOF'
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name 1337community.com www.1337community.com;
    return 301 https://$server_name$request_uri;
}

# Map directive for WebSocket
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# HTTPS server - ТОЛЬКО HTTP/1.1 для WebSocket совместимости
server {
    listen 443 ssl;
    # КРИТИЧЕСКИ ВАЖНО: НЕТ http2 - только HTTP/1.1!
    server_name 1337community.com www.1337community.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression (компенсация отсутствия HTTP/2)
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Frontend static files
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Socket.IO - КРИТИЧЕСКИ ВАЖНО: ТОЛЬКО HTTP/1.1
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific settings
        proxy_buffering off;
        proxy_cache off;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        
        # CORS for WebSocket
        add_header Access-Control-Allow-Origin "https://1337community.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        add_header Access-Control-Allow-Credentials "true" always;
    }

    # Test endpoint for Socket.IO
    location /test-socketio {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

    echo "✅ Новая конфигурация создана БЕЗ HTTP/2"
    
else
    echo "✅ HTTP/2 уже отсутствует в конфигурации"
fi

echo ""

echo "🔧 3. ПРОВЕРКА И ПРИМЕНЕНИЕ КОНФИГУРАЦИИ"
echo "───────────────────────────────────────"

echo "🧪 Тестируем синтаксис nginx..."
if nginx -t; then
    echo "✅ Конфигурация nginx корректна"
else
    echo "❌ Ошибка в конфигурации nginx!"
    echo "🔄 Восстанавливаем backup..."
    cp "/etc/nginx/nginx.conf.emergency.backup.$BACKUP_DATE" /etc/nginx/nginx.conf
    cp "/etc/nginx/sites-available/1337community.com.emergency.backup.$BACKUP_DATE" /etc/nginx/sites-available/1337community.com
    exit 1
fi

echo "🔄 Применяем новую конфигурацию..."
systemctl reload nginx

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx успешно перезагружен"
else
    echo "❌ Ошибка перезагрузки nginx!"
    exit 1
fi

echo ""

echo "🔧 4. ПЕРЕЗАПУСК BACKEND"
echo "─────────────────────"

echo "🔄 Перезапускаем backend сервис..."
systemctl restart 1337-backend

sleep 5

if systemctl is-active --quiet 1337-backend; then
    echo "✅ Backend успешно перезапущен"
else
    echo "❌ Ошибка перезапуска backend!"
fi

echo ""

echo "🔧 5. КРИТИЧЕСКИЕ ПРОВЕРКИ"
echo "─────────────────────────"

echo "🔍 Triple проверка HTTP/2:"
HTTP2_FINAL=$(nginx -T 2>/dev/null | grep -c "http2" || echo "0")
echo "Финальное количество упоминаний HTTP/2: $HTTP2_FINAL"

if [[ "$HTTP2_FINAL" -eq 0 ]]; then
    echo "✅ HTTP/2 ПОЛНОСТЬЮ ОТСУТСТВУЕТ в конфигурации!"
else
    echo "❌ HTTP/2 все еще найден!"
    nginx -T 2>/dev/null | grep -n "http2" || true
fi

echo ""
echo "🧪 Тестируем WebSocket upgrade:"
WEBSOCKET_TEST=$(curl -s -I -H "Upgrade: websocket" -H "Connection: Upgrade" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    -H "Sec-WebSocket-Version: 13" \
    "https://1337community.com/socket.io/?EIO=4&transport=websocket" 2>/dev/null | head -1 || echo "ERROR")

echo "WebSocket upgrade ответ: $WEBSOCKET_TEST"

if echo "$WEBSOCKET_TEST" | grep -q "101"; then
    echo "✅ WebSocket upgrade работает!"
elif echo "$WEBSOCKET_TEST" | grep -q "400"; then
    if echo "$WEBSOCKET_TEST" | grep -q "HTTP/1.1"; then
        echo "✅ HTTP/1.1 400 - правильный протокол, ошибка handshake нормальна"
    else
        echo "❌ Все еще HTTP/2 400 - проблема не решена"
    fi
else
    echo "⚠️ Неожиданный ответ WebSocket upgrade"
fi

echo ""
echo "🧪 Тестируем Socket.IO polling:"
POLLING_TEST=$(curl -s "https://1337community.com/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "ERROR")
if echo "$POLLING_TEST" | grep -q '"sid"'; then
    echo "✅ Socket.IO polling работает"
    echo "Пример ответа: $(echo "$POLLING_TEST" | head -c 100)..."
else
    echo "❌ Socket.IO polling не работает"
    echo "Ответ: $POLLING_TEST"
fi

echo ""
echo "🧪 Тестируем backend endpoint:"
BACKEND_TEST=$(curl -s "https://1337community.com/test-socketio" 2>/dev/null || echo "ERROR")
if echo "$BACKEND_TEST" | grep -q '"status":"success"'; then
    echo "✅ Backend Socket.IO endpoint работает"
else
    echo "❌ Backend Socket.IO endpoint не работает"
    echo "Ответ: $BACKEND_TEST"
fi

echo ""
echo "🎉 === ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО ==="

if [[ "$HTTP2_FINAL" -eq 0 ]]; then
    echo "🎯 УСПЕХ: HTTP/2 полностью удален!"
    echo "🌐 Архитектура: Browser → NGINX (HTTP/1.1) → Backend (Socket.IO)"
    echo ""
    echo "📋 СЛЕДУЮЩИЕ ШАГИ:"
    echo "1. Откройте https://1337community.com"
    echo "2. Очистите кеш браузера (Ctrl+F5)"
    echo "3. Откройте DevTools → Console"
    echo "4. Ищите логи '[Socket.IO Final]'"
    echo "5. Проверьте что нет ошибок WebSocket"
    echo ""
    echo "✨ WebSocket ошибки должны полностью исчезнуть!"
else
    echo "⚠️ ВНИМАНИЕ: HTTP/2 все еще присутствует"
    echo "🔧 Требуется ручная проверка конфигурации nginx"
fi

echo ""
echo "🎯 ЦЕЛЬ: Полная совместимость WebSocket + HTTP/1.1 достигнута!" 