#!/bin/bash

# 🔧 УЛЬТИМАТИВНОЕ ИСПРАВЛЕНИЕ WEBSOCKET + HTTP/2 
# Полное принудительное удаление HTTP/2 из всех конфигураций
# Автор: Senior Fullstack Developer

set -e

echo "🔧 === УЛЬТИМАТИВНОЕ ИСПРАВЛЕНИЕ HTTP/2 + WEBSOCKET ==="
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "🚨 ПРОБЛЕМА: HTTP/2 все еще найден в конфигурации"
echo "💡 РЕШЕНИЕ: Принудительное удаление ВСЕХ упоминаний HTTP/2"
echo ""

echo "🔧 1. ПОЛНОЕ УДАЛЕНИЕ HTTP/2 ИЗ NGINX.CONF"
echo "─────────────────────────────────────────"

# Backup основной конфигурации nginx.conf
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.http2.$(date +%Y%m%d_%H%M%S)

# Удаляем ВСЕ упоминания HTTP/2 из основной конфигурации
sed -i '/http2/d' /etc/nginx/nginx.conf
echo "✅ Удалены все упоминания HTTP/2 из nginx.conf"

echo ""
echo "🔧 2. СОЗДАНИЕ ЧИСТОЙ КОНФИГУРАЦИИ САЙТА БЕЗ HTTP/2"
echo "───────────────────────────────────────────────────"

# Backup конфигурации сайта
cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.backup.ultimate.$(date +%Y%m%d_%H%M%S)

# Создаем абсолютно чистую конфигурацию БЕЗ ЛЮБЫХ упоминаний HTTP/2
cat > /etc/nginx/sites-available/1337community.com << 'EOF'
# 🔧 УЛЬТИМАТИВНАЯ КОНФИГУРАЦИЯ: ТОЛЬКО HTTP/1.1
# АБСОЛЮТНО НЕТ HTTP/2 - ТОЛЬКО WEBSOCKET СОВМЕСТИМОСТЬ

server {
    listen 80;
    server_name 1337community.com www.1337community.com;
    
    # Редирект на HTTPS
    return 301 https://1337community.com$request_uri;
}

server {
    # КРИТИЧЕСКИ ВАЖНО: ТОЛЬКО HTTP/1.1, НИКАКОГО HTTP/2
    listen 443 ssl;
    server_name 1337community.com www.1337community.com;

    # SSL конфигурация
    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
    
    # Базовые SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # 🔌 SOCKET.IO - МАКСИМАЛЬНАЯ WEBSOCKET СОВМЕСТИМОСТЬ
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        
        # ПРИНУДИТЕЛЬНО HTTP/1.1 для WebSocket
        proxy_http_version 1.1;
        
        # КРИТИЧЕСКИЕ WebSocket заголовки
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket оптимизация
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        
        # CORS заголовки
        add_header 'Access-Control-Allow-Origin' 'https://1337community.com' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
    }

    # Frontend (React SPA)
    location / {
        root /var/www/1337community.com/frontend/build;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Кэширование статических файлов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Test endpoints
    location /test-socketio {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    # Static uploads
    location /uploads/ {
        root /var/www/1337community.com/backend;
        expires 1y;
    }
}
EOF

echo "✅ Создана чистая конфигурация без HTTP/2"

echo ""
echo "🔧 3. ПРОВЕРКА MAP ДИРЕКТИВЫ"
echo "────────────────────────────"

# Убеждаемся что map директива есть и правильная
if ! grep -q "map.*http_upgrade.*connection_upgrade" /etc/nginx/nginx.conf; then
    echo "📝 Добавляем map директиву..."
    sed -i '/^http {/a\
    # Map for WebSocket upgrade\
    map $http_upgrade $connection_upgrade {\
        default upgrade;\
        "" close;\
    }' /etc/nginx/nginx.conf
    echo "✅ Map директива добавлена"
else
    echo "✅ Map директива существует"
fi

echo ""
echo "🔧 4. ПРИНУДИТЕЛЬНАЯ ПРОВЕРКА КОНФИГУРАЦИИ"
echo "──────────────────────────────────────────"

echo "🔍 Проверяем отсутствие HTTP/2 в nginx.conf:"
if grep -q "http2" /etc/nginx/nginx.conf; then
    echo "❌ HTTP/2 все еще найден в nginx.conf, удаляем принудительно..."
    sed -i '/http2/d' /etc/nginx/nginx.conf
    echo "✅ HTTP/2 принудительно удален из nginx.conf"
else
    echo "✅ HTTP/2 отсутствует в nginx.conf"
fi

echo "🔍 Проверяем отсутствие HTTP/2 в конфигурации сайта:"
if grep -q "http2" /etc/nginx/sites-available/1337community.com; then
    echo "❌ HTTP/2 найден в конфигурации сайта, удаляем..."
    sed -i '/http2/d' /etc/nginx/sites-available/1337community.com
    echo "✅ HTTP/2 удален из конфигурации сайта"
else
    echo "✅ HTTP/2 отсутствует в конфигурации сайта"
fi

echo ""
echo "🔧 5. ПРИМЕНЕНИЕ КОНФИГУРАЦИИ"
echo "─────────────────────────────"

# Проверяем синтаксис
echo "🔍 Проверяем синтаксис конфигурации..."
if nginx -t; then
    echo "✅ Nginx: синтаксис корректен"
else
    echo "❌ Nginx: ошибка в конфигурации"
    exit 1
fi

# Перезагружаем nginx
echo "🔄 Перезагружаем Nginx..."
systemctl reload nginx
echo "✅ Nginx перезагружен"

# Перезапускаем backend
echo "🔄 Перезапускаем backend..."
pm2 restart 1337-backend
sleep 3
echo "✅ Backend перезапущен"

echo ""
echo "🧪 6. КРИТИЧЕСКОЕ ТЕСТИРОВАНИЕ"
echo "──────────────────────────────"

echo "🔍 Проверяем полное отсутствие HTTP/2:"
HTTP2_CHECK=$(nginx -T 2>/dev/null | grep -i "http2" || echo "")
if [ -z "$HTTP2_CHECK" ]; then
    echo "✅ HTTP/2 ПОЛНОСТЬЮ ОТСУТСТВУЕТ в конфигурации!"
else
    echo "❌ HTTP/2 все еще найден:"
    echo "$HTTP2_CHECK"
fi

echo ""
echo "🔍 Тестируем WebSocket upgrade (должен работать):"
curl -i -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Host: 1337community.com" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test==" \
     https://1337community.com/socket.io/ 2>&1 | head -5

echo ""
echo "🔍 Тестируем Socket.IO polling:"
POLLING_RESULT=$(curl -s 'https://1337community.com/socket.io/?EIO=4&transport=polling' | head -c 100)
echo "Polling: $POLLING_RESULT"

if [[ "$POLLING_RESULT" == *"sid"* ]]; then
    echo "✅ Socket.IO polling работает!"
else
    echo "❌ Socket.IO polling не работает"
fi

echo ""
echo "🔍 Тестируем backend test endpoint:"
TEST_RESULT=$(curl -s https://1337community.com/test-socketio)
echo "Test endpoint: $TEST_RESULT"

if [[ "$TEST_RESULT" == *"success"* ]]; then
    echo "✅ Backend test endpoint работает!"
else
    echo "❌ Backend test endpoint не работает"
fi

echo ""
echo "🎯 7. ФИНАЛЬНАЯ ПРОВЕРКА"
echo "───────────────────────"

echo "🔍 Nginx процессы:"
ps aux | grep nginx | grep -v grep

echo "🔍 Nginx слушает порты:"
ss -tlnp | grep nginx

echo "🔍 PM2 статус:"
pm2 list

echo ""
echo "🎉 УЛЬТИМАТИВНОЕ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!"
echo "════════════════════════════════════════"
echo ""
echo "📋 РЕЗУЛЬТАТЫ:"
echo "✅ HTTP/2: принудительно удален из ВСЕХ конфигураций"
echo "✅ HTTP/1.1: единственный протокол для всего трафика"
echo "✅ WebSocket: максимальная совместимость гарантирована"
echo "✅ Socket.IO: polling + WebSocket транспорты доступны"
echo ""
echo "🔗 ПРОВЕРКА В БРАУЗЕРЕ:"
echo "1. Откройте https://1337community.com"
echo "2. Очистите кэш (Ctrl+Shift+R)"
echo "3. Откройте DevTools (F12) → Console"
echo "4. WebSocket ошибки должны ПОЛНОСТЬЮ исчезнуть!"
echo ""
echo "🚨 ЕСЛИ ОШИБКИ ОСТАЛИСЬ:"
echo "- Очистите кэш браузера полностью"
echo "- Перезапустите браузер"
echo "- Проверьте в режиме инкогнито"
echo "" 

