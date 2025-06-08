#!/bin/bash

echo "🔧 Финальное исправление WebSocket для 1337community.com"
echo "=================================================="

# 1. Копируем обновленный backend на сервер
echo "📦 Копируем обновленный server.js..."
scp backend/server.js root@80.87.200.23:/var/www/1337community.com/backend/

# 2. Подключаемся к серверу и выполняем исправления
ssh root@80.87.200.23 << 'ENDSSH'

echo "🔍 Проверяем текущую конфигурацию nginx..."
cat /etc/nginx/sites-available/1337community.com | grep -A 5 "listen 443"

echo "🛠️ Создаем исправленную конфигурацию nginx..."
cat > /etc/nginx/sites-available/1337community.com << 'EOF'
server {
    listen 80;
    server_name 1337community.com www.1337community.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name 1337community.com www.1337community.com;

    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;

    # Socket.IO с WebSocket поддержкой
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
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
        
        # Для WebSocket важно отключить HTTP/2
        proxy_set_header X-Forwarded-Proto https;
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

echo "✅ Конфигурация nginx создана"

echo "🔍 Проверяем синтаксис nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Синтаксис nginx корректен"
    
    echo "🔄 Перезагружаем nginx..."
    systemctl reload nginx
    
    echo "🔄 Перезапускаем backend..."
    cd /var/www/1337community.com/backend
    pm2 restart 1337-backend
    
    echo "⏳ Ждем 5 секунд для инициализации..."
    sleep 5
    
    echo "🧪 Тестируем Socket.IO endpoints..."
    echo "1. Polling транспорт:"
    curl -s 'https://1337community.com/socket.io/?EIO=4&transport=polling' | head -c 100
    echo ""
    
    echo "2. WebSocket handshake:"
    curl -I -H "Upgrade: websocket" \
         -H "Connection: Upgrade" \
         -H "Sec-WebSocket-Version: 13" \
         -H "Sec-WebSocket-Key: test==" \
         https://1337community.com/socket.io/?EIO=4&transport=websocket 2>&1 | grep -E "HTTP|101"
    
    echo "3. Проверяем логи backend:"
    pm2 logs 1337-backend --lines 10 | grep -i "socket"
    
    echo "✅ Все исправления применены!"
else
    echo "❌ Ошибка в конфигурации nginx!"
fi

ENDSSH

echo "🎉 Скрипт завершен!" 