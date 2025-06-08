#!/bin/bash

echo "🔧 Применение исправлений WebSocket..."

# 1. Обновляем конфигурацию nginx для WebSocket
echo "📝 Обновление конфигурации nginx..."

# Создаем резервную копию
cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.backup

# Обновляем конфигурацию сайта
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
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/1337community.com/frontend/build;
    index index.html;

    # API routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO с правильным путем
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Важные настройки для WebSocket
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        keepalive_timeout 86400s;
        
        # Заголовки CORS
        proxy_set_header Origin $http_origin;
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials true always;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://localhost:3000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    client_max_body_size 10M;
}
EOF

# 2. Проверяем и добавляем map директиву в nginx.conf если её нет
echo -e "\n📝 Проверка map директивы..."
if ! grep -q "map \$http_upgrade \$connection_upgrade" /etc/nginx/nginx.conf; then
    echo "Добавляем map директиву..."
    sed -i '/^http {/a\
    # WebSocket upgrade map\
    map $http_upgrade $connection_upgrade {\
        default upgrade;\
        '\'''\'' close;\
    }\
' /etc/nginx/nginx.conf
fi

# 3. Проверяем конфигурацию
echo -e "\n🔍 Проверка конфигурации nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo -e "\n✅ Конфигурация корректна, перезагружаем nginx..."
    systemctl reload nginx
    echo "✅ Nginx перезагружен"
else
    echo -e "\n❌ Ошибка в конфигурации nginx!"
    exit 1
fi

# 4. Перезапускаем backend
echo -e "\n🔄 Перезапуск backend..."
cd /var/www/1337community.com/backend
pm2 restart 1337-backend

echo -e "\n✅ Все исправления применены!"
echo -e "\n📋 Проверка статуса:"
echo "- Nginx: $(systemctl is-active nginx)"
echo "- Backend: $(pm2 status 1337-backend --no-color | grep online || echo 'не запущен')"

# 5. Тестируем WebSocket
echo -e "\n🧪 Тест WebSocket соединения..."
sleep 3
SID=$(curl -s "https://1337community.com/socket.io/?EIO=4&transport=polling" | grep -o '"sid":"[^"]*"' | cut -d'"' -f4)
echo "Session ID: $SID"

if [ -n "$SID" ]; then
    echo "✅ Socket.IO polling работает"
else
    echo "❌ Socket.IO polling не работает"
fi 