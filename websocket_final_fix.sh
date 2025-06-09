#!/bin/bash

echo "🔍 Финальная диагностика и исправление WebSocket..."

# 1. Проверяем текущую конфигурацию nginx
echo -e "\n📋 Проверка текущей конфигурации nginx..."
grep -A 15 "location /socket.io/" /etc/nginx/sites-available/1337community.com

# 2. Проверяем наличие map директивы
echo -e "\n📋 Проверка map директивы в nginx.conf..."
grep -n "map \$http_upgrade" /etc/nginx/nginx.conf

# 3. Проверяем, слушает ли nginx на 443 порту
echo -e "\n📋 Проверка портов nginx..."
ss -tlnp | grep nginx

# 4. Проверяем HTTP/2 в конфигурации
echo -e "\n📋 Проверка HTTP/2 настроек..."
grep -n "http2" /etc/nginx/sites-available/1337community.com

# 5. Создаем исправленную конфигурацию
echo -e "\n🔧 Создание исправленной конфигурации..."

# Backup текущей конфигурации
cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.backup-$(date +%Y%m%d-%H%M%S)

# Создаем новую конфигурацию БЕЗ HTTP/2
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

    # Socket.IO WebSocket location
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        
        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # Standard headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Disable buffering
        proxy_buffering off;
        proxy_cache off;
        
        # Timeouts
        proxy_connect_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
        
        # WebSocket specific
        proxy_set_header Origin "";
    }

    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# 6. Проверяем и добавляем map директиву если её нет
echo -e "\n🔧 Проверка и добавление map директивы..."
if ! grep -q "map \$http_upgrade \$connection_upgrade" /etc/nginx/nginx.conf; then
    # Добавляем map директиву в начало http блока
    sed -i '/^http {/a\
    map $http_upgrade $connection_upgrade {\
        default upgrade;\
        '\'''\'' close;\
    }' /etc/nginx/nginx.conf
    echo "✅ Map директива добавлена"
else
    echo "✅ Map директива уже существует"
fi

# 7. Проверяем конфигурацию
echo -e "\n📋 Проверка конфигурации nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo -e "\n✅ Конфигурация корректна, перезагружаем nginx..."
    systemctl reload nginx
    
    # 8. Проверяем статус
    echo -e "\n📊 Проверка статуса после перезагрузки..."
    systemctl status nginx --no-pager | head -10
    
    # 9. Проверяем порты
    echo -e "\n📊 Проверка портов..."
    ss -tlnp | grep -E "nginx|3000"
    
    # 10. Тестируем Socket.IO
    echo -e "\n🧪 Тест Socket.IO endpoint..."
    curl -s http://localhost:3000/socket.io/?EIO=4&transport=polling | head -100
    
    echo -e "\n✅ Исправления применены!"
    echo -e "\n📋 Рекомендации:"
    echo "1. Очистите кэш браузера (Ctrl+F5)"
    echo "2. Откройте https://1337community.com"
    echo "3. Проверьте консоль браузера"
    echo "4. WebSocket должны работать без ошибок"
else
    echo -e "\n❌ Ошибка в конфигурации nginx!"
fi 