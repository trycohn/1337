#!/bin/bash

# Создаем новую конфигурацию nginx для 1337community.com
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

# Проверяем конфигурацию
nginx -t

# Если все ок, перезагружаем nginx
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "✅ Nginx конфигурация обновлена и перезагружена"
else
    echo "❌ Ошибка в конфигурации nginx"
fi 