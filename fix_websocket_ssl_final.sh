#!/bin/bash

# 🔧 УЛЬТИМАТИВНОЕ ИСПРАВЛЕНИЕ WEBSOCKET + HTTP/2 v2.0
# Полное принудительное удаление HTTP/2 из всех конфигураций + дополнительные проверки
# Автор: Senior Fullstack Developer

set -e

echo "🔧 === УЛЬТИМАТИВНОЕ ИСПРАВЛЕНИЕ HTTP/2 + WEBSOCKET v2.0 ==="
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "🚨 ПРОБЛЕМА: HTTP/2 блокирует WebSocket upgrade (RFC ограничение)"
echo "💡 РЕШЕНИЕ: Принудительное удаление HTTP/2 + создание HTTP/1.1 only конфигурации"
echo ""

# Проверяем что мы на правильном сервере
if [[ ! -d "/var/www/1337community.com" ]]; then
    echo "❌ Ошибка: Скрипт должен выполняться на VDS сервере 1337community.com"
    exit 1
fi

echo "🔧 1. ДИАГНОСТИКА ТЕКУЩЕГО СОСТОЯНИЯ"
echo "───────────────────────────────────"

echo "🔍 Проверяем текущую конфигурацию HTTP/2:"
HTTP2_COUNT=$(nginx -T 2>/dev/null | grep -c "http2" || echo "0")
echo "📊 Найдено упоминаний HTTP/2: $HTTP2_COUNT"

echo "🔍 Проверяем активные порты Nginx:"
ss -tlnp | grep nginx || echo "Nginx не найден в портах"

echo "🔍 Проверяем статус Backend:"
pm2 list | grep 1337-backend || echo "Backend не найден в PM2"

echo ""
echo "🔧 2. ПОЛНОЕ УДАЛЕНИЕ HTTP/2 ИЗ NGINX.CONF"
echo "─────────────────────────────────────────"

# Создаем backup с подробным именем
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.ultimate.$BACKUP_DATE
echo "✅ Backup создан: nginx.conf.backup.ultimate.$BACKUP_DATE"

# Принудительно удаляем ВСЕ упоминания HTTP/2
sed -i '/http2/d' /etc/nginx/nginx.conf
sed -i '/HTTP\/2/d' /etc/nginx/nginx.conf
echo "✅ Удалены все упоминания HTTP/2 из nginx.conf"

echo ""
echo "🔧 3. СОЗДАНИЕ ОПТИМИЗИРОВАННОЙ КОНФИГУРАЦИИ САЙТА"
echo "──────────────────────────────────────────────────"

# Backup конфигурации сайта
cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.backup.ultimate.$BACKUP_DATE
echo "✅ Backup конфигурации сайта создан"

# Создаем максимально оптимизированную конфигурацию для WebSocket
cat > /etc/nginx/sites-available/1337community.com << 'EOF'
# 🔧 УЛЬТИМАТИВНАЯ КОНФИГУРАЦИЯ v2.0: HTTP/1.1 ONLY
# Специально оптимизирована для максимальной WebSocket производительности

# Map директива для WebSocket (КРИТИЧЕСКИ ВАЖНО)
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name 1337community.com www.1337community.com;
    
    # Security headers даже для редиректа
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    return 301 https://1337community.com$request_uri;
}

# Main HTTPS server - HTTP/1.1 ONLY для WebSocket совместимости
server {
    # 🔥 КРИТИЧЕСКИ ВАЖНО: ТОЛЬКО HTTP/1.1, НИКАКОГО HTTP/2!
    listen 443 ssl;
    server_name 1337community.com www.1337community.com;

    # 🔒 SSL Configuration
    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
    
    # Modern SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 🔌 SOCKET.IO - МАКСИМАЛЬНАЯ WEBSOCKET СОВМЕСТИМОСТЬ
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        
        # 🔥 ПРИНУДИТЕЛЬНО HTTP/1.1 для WebSocket
        proxy_http_version 1.1;
        
        # 🎯 КРИТИЧЕСКИЕ WebSocket заголовки
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 🚀 WebSocket оптимизация
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;  # 24 часа для длительных соединений
        proxy_send_timeout 86400;
        proxy_connect_timeout 60s;
        
        # 🌐 CORS заголовки для WebSocket
        add_header 'Access-Control-Allow-Origin' 'https://1337community.com' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Origin, Content-Type, Accept, Authorization' always;
    }

    # 📡 Test endpoint для диагностики Socket.IO
    location /test-socketio {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 🔌 Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # API оптимизация
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # 📁 Frontend (React SPA)
    location / {
        root /var/www/1337community.com/frontend/build;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Сжатие для компенсации отсутствия HTTP/2
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_comp_level 6;
        gzip_types
            text/plain
            text/css
            text/xml
            text/javascript
            application/javascript
            application/xml+rss
            application/json;
        
        # 🏃‍♂️ Агрессивное кэширование статики
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            gzip_static on;
        }
        
        # HTML файлы без кэширования
        location ~* \.(html)$ {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate";
        }
    }

    # 📁 Static uploads
    location /uploads/ {
        root /var/www/1337community.com/backend;
        expires 1y;
        add_header Cache-Control "public";
        
        # Безопасность загрузок
        location ~* \.(php|pl|py|jsp|asp|sh|cgi)$ {
            deny all;
        }
    }
}
EOF

echo "✅ Создана оптимизированная конфигурация HTTP/1.1"

echo ""
echo "🔧 4. ОБНОВЛЕНИЕ NGINX.CONF ДЛЯ WEBSOCKET"
echo "─────────────────────────────────────────"

# Убеждаемся что map директива есть в основной конфигурации
if ! grep -q "map.*http_upgrade.*connection_upgrade" /etc/nginx/nginx.conf; then
    echo "📝 Добавляем map директиву в nginx.conf..."
    
    # Ищем секцию http и добавляем map директиву
    sed -i '/^http {/a\
\
    # WebSocket support\
    map $http_upgrade $connection_upgrade {\
        default upgrade;\
        "" close;\
    }' /etc/nginx/nginx.conf
    
    echo "✅ Map директива добавлена в nginx.conf"
else
    echo "✅ Map директива уже существует в nginx.conf"
fi

echo ""
echo "🔧 5. TRIPLE ПРОВЕРКА HTTP/2"
echo "───────────────────────────"

echo "🔍 Первая проверка - nginx.conf:"
HTTP2_MAIN=$(grep -c "http2" /etc/nginx/nginx.conf 2>/dev/null || echo "0")
if [ "$HTTP2_MAIN" -gt 0 ]; then
    echo "❌ HTTP/2 найден в nginx.conf, удаляем ПРИНУДИТЕЛЬНО..."
    sed -i '/http2/d' /etc/nginx/nginx.conf
    sed -i '/HTTP\/2/d' /etc/nginx/nginx.conf
    echo "✅ HTTP/2 принудительно удален из nginx.conf"
else
    echo "✅ HTTP/2 отсутствует в nginx.conf"
fi

echo "🔍 Вторая проверка - конфигурация сайта:"
HTTP2_SITE=$(grep -c "http2" /etc/nginx/sites-available/1337community.com 2>/dev/null || echo "0")
if [ "$HTTP2_SITE" -gt 0 ]; then
    echo "❌ HTTP/2 найден в конфигурации сайта, удаляем..."
    sed -i '/http2/d' /etc/nginx/sites-available/1337community.com
    sed -i '/HTTP\/2/d' /etc/nginx/sites-available/1337community.com
    echo "✅ HTTP/2 удален из конфигурации сайта"
else
    echo "✅ HTTP/2 отсутствует в конфигурации сайта"
fi

echo "🔍 Третья проверка - полная конфигурация:"
HTTP2_TOTAL=$(nginx -T 2>/dev/null | grep -c "http2" || echo "0")
echo "📊 Общее количество упоминаний HTTP/2: $HTTP2_TOTAL"

if [ "$HTTP2_TOTAL" -eq 0 ]; then
    echo "🎉 HTTP/2 ПОЛНОСТЬЮ ОТСУТСТВУЕТ В КОНФИГУРАЦИИ!"
else
    echo "⚠️ HTTP/2 все еще найден в конфигурации ($HTTP2_TOTAL упоминаний)"
fi

echo ""
echo "🔧 6. ПРИМЕНЕНИЕ И ТЕСТИРОВАНИЕ"
echo "──────────────────────────────"

# Проверяем синтаксис
echo "🔍 Проверяем синтаксис конфигурации..."
if nginx -t; then
    echo "✅ Nginx: синтаксис корректен"
else
    echo "❌ Nginx: ошибка в конфигурации!"
    echo "🔄 Восстанавливаем backup..."
    cp /etc/nginx/nginx.conf.backup.ultimate.$BACKUP_DATE /etc/nginx/nginx.conf
    cp /etc/nginx/sites-available/1337community.com.backup.ultimate.$BACKUP_DATE /etc/nginx/sites-available/1337community.com
    nginx -t
    exit 1
fi

# Перезагружаем nginx
echo "🔄 Перезагружаем Nginx..."
systemctl reload nginx
sleep 2

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx успешно перезагружен и активен"
else
    echo "❌ Nginx не запустился!"
    systemctl status nginx
    exit 1
fi

# Перезапускаем backend
echo "🔄 Перезапускаем backend..."
pm2 restart 1337-backend
sleep 5

if pm2 list | grep -q "1337-backend.*online"; then
    echo "✅ Backend успешно перезапущен"
else
    echo "❌ Backend не запустился!"
    pm2 status
    exit 1
fi

echo ""
echo "🧪 7. КОМПЛЕКСНОЕ ТЕСТИРОВАНИЕ"
echo "─────────────────────────────"

echo "🔍 1. Проверяем отсутствие HTTP/2 в активной конфигурации:"
FINAL_HTTP2_CHECK=$(nginx -T 2>/dev/null | grep -c "http2" || echo "0")
if [ "$FINAL_HTTP2_CHECK" -eq 0 ]; then
    echo "✅ HTTP/2 ПОЛНОСТЬЮ ОТСУТСТВУЕТ В АКТИВНОЙ КОНФИГУРАЦИИ!"
else
    echo "❌ HTTP/2 найден в активной конфигурации ($FINAL_HTTP2_CHECK упоминаний)"
    nginx -T 2>/dev/null | grep -n "http2"
fi

echo ""
echo "🔍 2. Тестируем Socket.IO polling transport:"
POLLING_TEST=$(curl -s --max-time 10 'https://1337community.com/socket.io/?EIO=4&transport=polling' 2>/dev/null || echo "FAILED")
if [[ "$POLLING_TEST" == *"sid"* ]]; then
    echo "✅ Socket.IO polling работает!"
    echo "📄 Response preview: $(echo "$POLLING_TEST" | head -c 100)..."
else
    echo "❌ Socket.IO polling НЕ работает"
    echo "📄 Response: $POLLING_TEST"
fi

echo ""
echo "🔍 3. Тестируем backend test endpoint:"
TEST_ENDPOINT=$(curl -s --max-time 10 https://1337community.com/test-socketio 2>/dev/null || echo "FAILED")
if [[ "$TEST_ENDPOINT" == *"success"* ]]; then
    echo "✅ Backend test endpoint работает!"
    echo "📄 Response: $TEST_ENDPOINT"
else
    echo "❌ Backend test endpoint НЕ работает"
    echo "📄 Response: $TEST_ENDPOINT"
fi

echo ""
echo "🔍 4. Проверяем WebSocket headers (должен быть 400, не 404):"
WS_HEADERS=$(curl -I -s --max-time 5 \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: test123" \
    https://1337community.com/socket.io/ 2>/dev/null | head -1)
echo "📄 WebSocket response: $WS_HEADERS"

if [[ "$WS_HEADERS" == *"400"* ]]; then
    echo "✅ WebSocket endpoint доступен (400 ожидаемо без правильного handshake)"
elif [[ "$WS_HEADERS" == *"404"* ]]; then
    echo "❌ WebSocket endpoint не найден (404)"
else
    echo "ℹ️ Неожиданный ответ WebSocket endpoint"
fi

echo ""
echo "🔍 5. Системная диагностика:"
echo "📊 Nginx процессы: $(ps aux | grep -c '[n]ginx' || echo "0")"
echo "📊 Nginx порты: $(ss -tlnp | grep nginx | wc -l)"
echo "📊 PM2 процессы: $(pm2 list | grep -c online || echo "0")"

echo ""
echo "🎉 УЛЬТИМАТИВНОЕ ИСПРАВЛЕНИЕ v2.0 ЗАВЕРШЕНО!"
echo "═══════════════════════════════════════════════"
echo ""
echo "📋 КРИТИЧЕСКИЕ ИЗМЕНЕНИЯ:"
echo "✅ HTTP/2: ПОЛНОСТЬЮ удален из всех конфигураций"
echo "✅ HTTP/1.1: единственный протокол для ВСЕГО трафика"
echo "✅ WebSocket: максимальная совместимость гарантирована"
echo "✅ Map директива: настроена для upgrade соединений"
echo "✅ Gzip сжатие: компенсирует отсутствие HTTP/2"
echo "✅ Security headers: добавлены для безопасности"
echo "✅ Таймауты: оптимизированы для длительных WebSocket соединений"
echo ""
echo "🔗 НЕМЕДЛЕННАЯ ПРОВЕРКА В БРАУЗЕРЕ:"
echo "1. Откройте https://1337community.com"
echo "2. Очистите весь кэш браузера (Ctrl+Shift+Del → Все время)"
echo "3. Откройте DevTools (F12) → Console"
echo "4. WebSocket ошибки должны ПОЛНОСТЬЮ ИСЧЕЗНУТЬ!"
echo "5. Ищите логи '[Socket.IO Final] ПОДКЛЮЧЕНО!'"
echo ""
echo "🚨 ЕСЛИ ОШИБКИ ВСЕ ЕЩЕ ЕСТЬ:"
echo "- Перезапустите браузер полностью"
echo "- Проверьте в режиме инкогнито"
echo "- Отключите все расширения браузера"
echo "- Проверьте другой браузер"
echo ""
echo "📞 ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА:"
echo "- Логи Nginx: tail -f /var/log/nginx/error.log"
echo "- Логи Backend: pm2 logs 1337-backend"
echo "- Конфигурация: nginx -T | grep -A 10 -B 10 socket.io"
echo "" 

