#!/bin/bash

# 🚨 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ WEBSOCKET СОЕДИНЕНИЙ
# Дата: 30.01.2025 
# Проблема: WebSocket connections failed, HTTP API работает

echo "🚨 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ WEBSOCKET СОЕДИНЕНИЙ"
echo "==============================================="

echo ""
echo "🔍 1. ДИАГНОСТИКА ТЕКУЩЕГО СОСТОЯНИЯ:"
echo "------------------------------------"

# Проверка backend
echo "📊 Статус backend:"
pm2 status | grep 1337-backend

# Проверка HTTP API
echo ""
echo "🌐 HTTP API тест:"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/users/me)
echo "HTTP API статус: $HTTP_STATUS"

# Проверка Socket.IO endpoint
echo ""
echo "🔌 Socket.IO endpoint тест:"
SOCKETIO_RESPONSE=$(curl -s https://1337community.com/test-socketio)
echo "Socket.IO endpoint: $SOCKETIO_RESPONSE"

echo ""
echo "🔧 2. СОЗДАНИЕ ИСПРАВЛЕННОЙ NGINX КОНФИГУРАЦИИ:"
echo "----------------------------------------------"

# Создаем исправленную конфигурацию с фокусом на WebSocket
cat > /etc/nginx/sites-available/1337community.com << 'EOF'
# Перенаправление HTTP на HTTPS
server {
    listen 80;
    server_name 1337community.com www.1337community.com;
    return 301 https://$server_name$request_uri;
}

# Основной HTTPS сервер
server {
    listen 443 ssl http2;
    server_name 1337community.com www.1337community.com;

    # SSL конфигурация
    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # SSL для WebSocket
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # ⚡ КРИТИЧНО: SOCKET.IO С WEBSOCKET ПОДДЕРЖКОЙ
    location /socket.io/ {
        # Проксирование на backend
        proxy_pass http://127.0.0.1:3000;
        
        # HTTP версия для WebSocket
        proxy_http_version 1.1;
        
        # 🔧 КЛЮЧЕВЫЕ ЗАГОЛОВКИ ДЛЯ WEBSOCKET
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Отключение кэширования для WebSocket
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache $http_upgrade;
        
        # 🚀 ВАЖНО: WebSocket специфичные настройки
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 60s;
        
        # CORS заголовки для WebSocket
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, Authorization, Accept" always;
        add_header Access-Control-Allow-Credentials true always;
    }

    # 🧪 Тестовый endpoint для Socket.IO
    location /test-socketio {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 🔗 API запросы
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

    # 📁 Загрузки
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 🏠 React приложение
    location / {
        root /var/www/1337community.com/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Кэширование статических файлов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # HTML без кэша
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
    
    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

echo "✅ Новая конфигурация создана с WebSocket поддержкой"

echo ""
echo "🔄 3. ПРИМЕНЕНИЕ ИЗМЕНЕНИЙ:"
echo "---------------------------"

# Тест конфигурации
echo "🧪 Тестирование конфигурации Nginx:"
if nginx -t; then
    echo "✅ Конфигурация валидна"
    
    # Перезагрузка Nginx
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
    nginx -t
    exit 1
fi

# Перезапуск backend для применения изменений
echo ""
echo "🔄 Перезапуск backend..."
pm2 restart 1337-backend
echo "✅ Backend перезапущен"

echo ""
echo "⏱️ Ожидание 5 секунд для стабилизации..."
sleep 5

echo ""
echo "🧪 4. ФИНАЛЬНОЕ ТЕСТИРОВАНИЕ:"
echo "----------------------------"

# Тест HTTP API
echo "🌐 HTTP API:"
HTTP_TEST=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/users/me)
echo "HTTP API код: $HTTP_TEST"

# Тест Socket.IO endpoint
echo ""
echo "🔌 Socket.IO endpoint:"
SOCKETIO_TEST=$(curl -s https://1337community.com/test-socketio)
echo "Socket.IO ответ: $SOCKETIO_TEST"

# Тест WebSocket соединения
echo ""
echo "🔗 WebSocket соединение:"
WEBSOCKET_TEST=$(curl -s -I "https://1337community.com/socket.io/?EIO=4&transport=polling" | head -1)
echo "WebSocket тест: $WEBSOCKET_TEST"

echo ""
echo "📊 5. ДИАГНОСТИКА ЛОГОВ:"
echo "-----------------------"

echo "🔍 Nginx error log (последние 3 строки):"
tail -3 /var/log/nginx/error.log || echo "Нет ошибок"

echo ""
echo "🔍 Backend логи (поиск Socket.IO):"
pm2 logs 1337-backend --lines 10 | grep -i socket || echo "Нет Socket.IO сообщений"

echo ""
echo "🎯 РЕЗУЛЬТАТ ИСПРАВЛЕНИЯ:"
echo "========================"

if [[ "$SOCKETIO_TEST" == *"success"* ]]; then
    echo "✅ Socket.IO endpoint работает!"
    echo ""
    echo "🔧 ДОПОЛНИТЕЛЬНЫЕ ШАГИ ДЛЯ WEBSOCKET:"
    echo "1. Проверьте firewall: ufw status"
    echo "2. Проверьте SSL сертификаты: certbot certificates"
    echo "3. Перезагрузите сервер если проблема остается: reboot"
    echo ""
    echo "💡 В браузере:"
    echo "- Очистите кэш браузера (Ctrl+Shift+Del)"
    echo "- Перезагрузите страницу турнира"
    echo "- Проверьте DevTools Network на socket.io запросы"
    
elif [[ "$SOCKETIO_TEST" == *"html"* ]]; then
    echo "⚠️ Socket.IO endpoint все еще возвращает HTML"
    echo "❌ Проблема НЕ решена. Требуется дополнительная диагностика."
    
else
    echo "❌ Socket.IO endpoint не отвечает"
    echo "❌ Критическая ошибка. Проверьте:"
    echo "1. Backend статус: pm2 status"
    echo "2. Nginx статус: systemctl status nginx"  
    echo "3. Порт 3000: lsof -i :3000"
fi

echo ""
echo "🎉 ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!"
echo "========================" 