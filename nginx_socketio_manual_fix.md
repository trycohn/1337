# 🔧 ИСПРАВЛЕНИЕ NGINX ДЛЯ SOCKET.IO - РУЧНЫЕ КОМАНДЫ

## 🎯 **ПРОБЛЕМА НАЙДЕНА:**
Socket.IO запросы не проксируются на backend (порт 3000), а перенаправляются на frontend HTML.

## 🛠️ **РЕШЕНИЕ:**

### 1. Подключитесь к серверу:
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

### 2. Перейдите в папку проекта:
```bash
cd /var/www/1337community.com
```

### 3. Создайте правильную Nginx конфигурацию:
```bash
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

    # 🔌 SOCKET.IO КОНФИГУРАЦИЯ - КРИТИЧЕСКИ ВАЖНО!
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
        proxy_buffering off;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # 🧪 API тестовый endpoint
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

    # 🏠 React SPA
    location / {
        root /var/www/1337community.com/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

### 4. Активируйте конфигурацию:
```bash
# Удалить старую ссылку
rm -f /etc/nginx/sites-enabled/1337community.com

# Создать новую ссылку
ln -s /etc/nginx/sites-available/1337community.com /etc/nginx/sites-enabled/

# Тестировать конфигурацию
nginx -t
```

### 5. Перезагрузите Nginx:
```bash
systemctl reload nginx
systemctl status nginx
```

### 6. Проверьте исправление:
```bash
# Тестируем Socket.IO endpoint
curl https://1337community.com/test-socketio

# Должен вернуть JSON со статусом success, а не HTML
```

### 7. Проверьте в браузере:
1. Откройте https://1337community.com
2. Перейдите в любой турнир  
3. Откройте DevTools (F12)
4. В Network должны появиться успешные socket.io запросы

## ✅ **ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:**
- Socket.IO endpoint возвращает JSON вместо HTML
- WebSocket соединения работают в браузере
- Чат и уведомления функционируют

## 🔍 **МОНИТОРИНГ:**
```bash
# Логи Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Логи Backend
pm2 logs 1337-backend --follow
```

**🎯 Эта конфигурация должна решить проблему с Socket.IO полностью!** 