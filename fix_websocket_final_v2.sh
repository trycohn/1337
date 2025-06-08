#!/bin/bash

echo "🔧 Финальное исправление WebSocket v2 для 1337community.com"
echo "==========================================================="

# Подключаемся к серверу и выполняем исправления
ssh root@80.87.200.23 << 'ENDSSH'

echo "1️⃣ Добавляем map директиву в nginx.conf..."
# Проверяем, есть ли уже map директива
if ! grep -q "map.*http_upgrade" /etc/nginx/nginx.conf; then
    # Добавляем map директиву перед секцией http
    sed -i '/^http {/i\
map $http_upgrade $connection_upgrade {\
    default upgrade;\
    '\'''\'' close;\
}\
' /etc/nginx/nginx.conf
    echo "✅ Map директива добавлена"
else
    echo "✅ Map директива уже существует"
fi

echo -e "\n2️⃣ Создаем правильную конфигурацию сайта..."
cat > /etc/nginx/sites-available/1337community.com << 'EOF'
server {
    listen 80;
    server_name 1337community.com www.1337community.com;
    return 301 https://$server_name$request_uri;
}

server {
    # ВАЖНО: Без HTTP/2 для поддержки WebSocket
    listen 443 ssl;
    server_name 1337community.com www.1337community.com;

    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Socket.IO location ДОЛЖЕН быть первым
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # Standard headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Отключаем буферизацию для real-time
        proxy_buffering off;
        proxy_cache off;
        
        # Увеличиваем таймауты для WebSocket
        proxy_connect_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
        proxy_request_buffering off;
        
        # Дополнительные заголовки для WebSocket
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Server $host;
        proxy_set_header X-NginX-Proxy true;
    }

    # API запросы к backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Тестовый endpoint
    location /test-socketio {
        proxy_pass http://127.0.0.1:3000/test-socketio;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Основной сайт
    location / {
        root /var/www/1337community.com/frontend/build;
        try_files $uri $uri/ /index.html;
        index index.html;
    }
}
EOF

echo -e "\n3️⃣ Проверяем синтаксис nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo -e "\n4️⃣ Перезагружаем nginx..."
    systemctl reload nginx
    
    echo -e "\n5️⃣ Перезапускаем backend для применения изменений..."
    cd /var/www/1337community.com/backend
    pm2 restart 1337-backend
    
    echo -e "\n⏳ Ждем 5 секунд для инициализации..."
    sleep 5
    
    echo -e "\n6️⃣ Проверяем результаты..."
    echo "📍 Nginx слушает порты:"
    ss -tlnp | grep nginx
    
    echo -e "\n📍 Socket.IO polling:"
    curl -s https://1337community.com/socket.io/?EIO=4&transport=polling | head -c 100
    echo ""
    
    echo -e "\n📍 WebSocket handshake тест:"
    curl -I -H "Upgrade: websocket" \
         -H "Connection: Upgrade" \
         -H "Sec-WebSocket-Version: 13" \
         -H "Sec-WebSocket-Key: test==" \
         https://1337community.com/socket.io/?EIO=4&transport=websocket 2>&1 | grep -E "HTTP|101|400"
    
    echo -e "\n📍 Backend логи:"
    pm2 logs 1337-backend --lines 10 | grep -i "socket"
    
    echo -e "\n✅ Все исправления применены!"
    echo "🔍 Проверьте в браузере:"
    echo "   1. Откройте https://1337community.com"
    echo "   2. Откройте консоль разработчика (F12)"
    echo "   3. WebSocket ошибки должны исчезнуть"
else
    echo "❌ Ошибка в конфигурации nginx!"
fi

ENDSSH

echo -e "\n🎉 Скрипт завершен!" 