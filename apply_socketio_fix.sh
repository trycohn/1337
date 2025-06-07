#!/bin/bash

# 🔧 АВТОМАТИЧЕСКОЕ ПРИМЕНЕНИЕ ИСПРАВЛЕНИЙ SOCKET.IO
# Дата: 30.01.2025
# Цель: Исправить конфигурацию Nginx для Socket.IO

echo "🚀 АВТОМАТИЧЕСКОЕ ПРИМЕНЕНИЕ ИСПРАВЛЕНИЙ SOCKET.IO"
echo "=================================================="

# 1. Обновление кода из GitHub
echo ""
echo "📥 1. ОБНОВЛЕНИЕ КОДА ИЗ GITHUB:"
echo "--------------------------------"
cd /var/www/1337community.com
git pull origin main
echo "✅ Код обновлен"

# 2. Создание правильной конфигурации Nginx
echo ""
echo "🔧 2. СОЗДАНИЕ ПРАВИЛЬНОЙ КОНФИГУРАЦИИ NGINX:"
echo "--------------------------------------------"

cat > /etc/nginx/sites-available/1337community.com << 'EOF'
server {
    listen 80;
    server_name 1337community.com www.1337community.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name 1337community.com www.1337community.com;

    # SSL конфигурация
    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # 🔌 SOCKET.IO КОНФИГУРАЦИЯ - КРИТИЧЕСКИ ВАЖНО!
    # Все Socket.IO запросы проксируем на backend
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket специфичные заголовки
        proxy_buffering off;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # 🧪 API тестовый endpoint для Socket.IO
    location /test-socketio {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 🔗 API запросы проксируем на backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 📁 Статические файлы загрузок (аватары и т.д.)
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 🏠 React SPA - все остальные запросы
    location / {
        root /var/www/1337community.com/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Кэширование статических файлов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # HTML файлы не кэшируем
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
        }
    }

    # Безопасность
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
EOF

echo "✅ Конфигурация Nginx создана"

# 3. Активация конфигурации
echo ""
echo "🔄 3. АКТИВАЦИЯ КОНФИГУРАЦИИ:"
echo "----------------------------"

# Удалить старую символическую ссылку если есть
if [ -L "/etc/nginx/sites-enabled/1337community.com" ]; then
    rm /etc/nginx/sites-enabled/1337community.com
    echo "✅ Старая символическая ссылка удалена"
fi

# Создать новую символическую ссылку
ln -s /etc/nginx/sites-available/1337community.com /etc/nginx/sites-enabled/
echo "✅ Новая символическая ссылка создана"

# 4. Тестирование и перезагрузка Nginx
echo ""
echo "🧪 4. ТЕСТИРОВАНИЕ И ПЕРЕЗАГРУЗКА NGINX:"
echo "---------------------------------------"

# Тестировать конфигурацию Nginx
echo "🔍 Тестирование синтаксиса конфигурации:"
if nginx -t; then
    echo "✅ Конфигурация Nginx корректна"
    
    echo ""
    echo "🔄 Перезагрузка Nginx..."
    systemctl reload nginx
    
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx успешно перезагружен"
    else
        echo "❌ Ошибка перезагрузки Nginx"
        systemctl status nginx
        exit 1
    fi
else
    echo "❌ Ошибка в конфигурации Nginx!"
    exit 1
fi

# 5. Проверка Backend
echo ""
echo "🔍 5. ПРОВЕРКА BACKEND:"
echo "----------------------"

# Проверить статус PM2
echo "📊 Статус PM2 процессов:"
pm2 status

# Перезапустить backend для применения всех изменений
echo ""
echo "🔄 Перезапуск backend..."
pm2 restart 1337-backend

echo "✅ Backend перезапущен"

# 6. Финальная проверка
echo ""
echo "🧪 6. ФИНАЛЬНАЯ ПРОВЕРКА:"
echo "------------------------"

sleep 3

echo "🌐 Тестирование HTTP API:"
HTTP_TEST=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/users/me 2>/dev/null || echo "ERROR")
echo "HTTP API статус: $HTTP_TEST"

echo ""
echo "🔌 Тестирование Socket.IO endpoint:"
SOCKETIO_TEST=$(curl -s https://1337community.com/test-socketio 2>/dev/null || echo "ERROR")
echo "Socket.IO endpoint ответ:"
echo "$SOCKETIO_TEST" | head -3

echo ""
echo "🔗 Тестирование Socket.IO соединения:"
SOCKETIO_CONN=$(curl -s -I https://1337community.com/socket.io/?transport=polling 2>/dev/null | head -1 || echo "ERROR")
echo "Socket.IO соединение: $SOCKETIO_CONN"

echo ""
echo "🎯 РЕЗУЛЬТАТ:"
echo "============"
if [[ "$SOCKETIO_TEST" == *"success"* ]]; then
    echo "✅ Socket.IO endpoint работает корректно!"
    echo "✅ WebSocket соединения должны работать"
    echo ""
    echo "🔗 Проверьте в браузере:"
    echo "- Откройте DevTools (F12)"
    echo "- Перейдите в любой турнир"
    echo "- В Network должны появиться успешные socket.io запросы"
    
elif [[ "$SOCKETIO_TEST" == *"html"* ]]; then
    echo "⚠️ Socket.IO endpoint все еще возвращает HTML"
    echo "🔄 Возможно нужно подождать несколько секунд для применения изменений"
    
else
    echo "❌ Socket.IO endpoint не отвечает"
    echo "🔍 Проверьте логи Nginx: tail -f /var/log/nginx/error.log"
fi

echo ""
echo "📋 ДЛЯ МОНИТОРИНГА ЛОГОВ:"
echo "------------------------"
echo "# Логи Nginx:"
echo "tail -f /var/log/nginx/access.log"
echo "tail -f /var/log/nginx/error.log"
echo ""
echo "# Логи Backend:"
echo "pm2 logs 1337-backend --follow"

echo ""
echo "🎉 АВТОМАТИЧЕСКОЕ ПРИМЕНЕНИЕ ИСПРАВЛЕНИЙ ЗАВЕРШЕНО!"
echo "==================================================" 