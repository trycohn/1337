# 🔧 Конфигурация Nginx для Socket.IO WebSocket

## 📋 Проблема
WebSocket соединения Socket.IO не работают на production сервере из-за неправильной конфигурации Nginx.

## 🛠️ Решение

### 1. Подключиться к серверу
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

### 2. Найти текущую конфигурацию Nginx
```bash
# Проверяем, где находится конфигурация сайта
nginx -t
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/

# Ищем конфигурационный файл для 1337community.com
find /etc/nginx -name "*1337*" -type f
find /etc/nginx -name "*community*" -type f

# Если не найден, проверяем основную конфигурацию
cat /etc/nginx/nginx.conf | grep -A 5 -B 5 "1337\|community"
```

### 3. Определить правильный файл конфигурации
```bash
# Обычно это один из этих файлов:
ls -la /etc/nginx/sites-available/default
ls -la /etc/nginx/sites-available/1337community.com
ls -la /etc/nginx/conf.d/default.conf

# Проверяем содержимое активных конфигураций
cat /etc/nginx/sites-enabled/* | grep -A 10 -B 10 "server_name.*1337"
```

### 4. Создать/обновить конфигурацию с поддержкой WebSocket

#### Вариант A: Если используется `/etc/nginx/sites-available/default`
```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
sudo nano /etc/nginx/sites-available/default
```

#### Вариант B: Если используется отдельный файл для домена
```bash
sudo nano /etc/nginx/sites-available/1337community.com
```

### 5. Добавить эту конфигурацию:

```nginx
# 🔧 ПОЛНАЯ КОНФИГУРАЦИЯ NGINX ДЛЯ 1337 COMMUNITY + WEBSOCKET

# Upstream для Node.js backend (1337-backend)
upstream nodejs_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP -> HTTPS редирект
server {
    listen 80;
    listen [::]:80;
    server_name 1337community.com www.1337community.com;
    
    # Перенаправляем все HTTP запросы на HTTPS
    return 301 https://$server_name$request_uri;
}

# ОСНОВНОЙ HTTPS СЕРВЕР
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name 1337community.com www.1337community.com;
    
    # 🔐 SSL НАСТРОЙКИ (ОБЯЗАТЕЛЬНО ОБНОВИТЬ ПУТИ К СЕРТИФИКАТАМ)
    ssl_certificate /path/to/your/fullchain.pem;  # ⚠️ ОБНОВИТЬ!
    ssl_certificate_key /path/to/your/privkey.pem;  # ⚠️ ОБНОВИТЬ!
    
    # Современные SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 📁 СТАТИЧЕСКИЕ ФАЙЛЫ (React build)
    root /var/www/1337community.com/frontend/build;
    index index.html;
    
    # 🔧 ОСНОВНЫЕ НАСТРОЙКИ
    client_max_body_size 50M;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
    
    # 🌐 СПЕЦИАЛЬНЫЙ LOCATION ДЛЯ SOCKET.IO WEBSOCKET
    location /socket.io/ {
        proxy_pass http://nodejs_backend;
        
        # ⚡ КРИТИЧЕСКИ ВАЖНЫЕ WEBSOCKET ЗАГОЛОВКИ
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 🔗 ПРОКСИРОВАНИЕ ЗАГОЛОВКОВ
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # ⏱️ ТАЙМАУТЫ ДЛЯ WEBSOCKET
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 86400s;  # 24 часа для long-polling
        
        # 🚫 ОТКЛЮЧАЕМ КЭШИРОВАНИЕ
        proxy_buffering off;
        proxy_cache off;
        
        # 📡 ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ ДЛЯ СТАБИЛЬНОСТИ
        proxy_redirect off;
        proxy_set_header Connection "upgrade";
    }
    
    # 🔌 API МАРШРУТЫ (проксируем на Node.js)
    location /api/ {
        proxy_pass http://nodejs_backend;
        
        # 📋 СТАНДАРТНЫЕ PROXY ЗАГОЛОВКИ
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # ⏱️ ТАЙМАУТЫ
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # 📤 БУФЕРИЗАЦИЯ
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    # 📁 UPLOADS (статические файлы через Node.js)
    location /uploads/ {
        proxy_pass http://nodejs_backend;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 🕐 Кэширование для статических файлов
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
    
    # 🎯 REACT SPA - ВСЕ ОСТАЛЬНЫЕ ЗАПРОСЫ
    location / {
        try_files $uri $uri/ @react_fallback;
        
        # 🕐 Кэширование статических ресурсов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            try_files $uri =404;
        }
    }
    
    # 🔄 FALLBACK ДЛЯ REACT ROUTER
    location @react_fallback {
        rewrite ^.*$ /index.html last;
    }
    
    # 🚫 БЕЗОПАСНОСТЬ
    location ~ /\. {
        deny all;
    }
    
    # 📊 ЛОГИ
    access_log /var/log/nginx/1337community_access.log;
    error_log /var/log/nginx/1337community_error.log;
}
```

### 6. Найти и обновить пути к SSL сертификатам

```bash
# Ищем SSL сертификаты
find /etc -name "*1337*" -type f | grep -E '\.(crt|pem|key)$'
find /etc -name "*community*" -type f | grep -E '\.(crt|pem|key)$'
find /etc/letsencrypt -name "*1337*" -type f 2>/dev/null
find /etc/ssl -name "*1337*" -type f 2>/dev/null

# Если используется Let's Encrypt:
ls -la /etc/letsencrypt/live/1337community.com/
ls -la /etc/letsencrypt/live/

# Обновляем пути в конфигурации:
# ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
```

### 7. Проверить и применить конфигурацию

```bash
# Проверяем синтаксис конфигурации
sudo nginx -t

# Если есть ошибки, исправляем их
# Если всё ОК, перезагружаем Nginx
sudo systemctl reload nginx

# Проверяем статус
sudo systemctl status nginx
```

### 8. Проверить работу Node.js backend

```bash
# Проверяем, что 1337-backend работает на порту 3000
sudo ss -tulpn | grep :3000
pm2 status

# Если не работает, запускаем:
cd /var/www/1337community.com
pm2 start ecosystem.config.js --only 1337-backend
# или
pm2 restart 1337-backend
```

### 9. Тестирование WebSocket соединения

```bash
# Проверяем логи Nginx
sudo tail -f /var/log/nginx/1337community_error.log

# Проверяем логи Node.js
pm2 logs 1337-backend --lines 50

# Тестируем WebSocket соединение из браузера:
# - Откройте https://1337community.com
# - Откройте DevTools -> Console
# - Должны увидеть: "✅ WebSocket подключен к турниру"
```

### 10. Debugging (если не работает)

```bash
# Проверяем, слушает ли Node.js на правильном порту
sudo netstat -tulpn | grep :3000

# Проверяем процессы PM2
pm2 list

# Проверяем логи backend'а
pm2 logs 1337-backend --lines 100

# Проверяем логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/1337community_error.log

# Перезапускаем всё
pm2 restart 1337-backend
sudo systemctl restart nginx
```

### 11. Проверка firewall (если используется)

```bash
# Проверяем правила firewall
sudo ufw status
sudo iptables -L

# Если нужно, разрешаем порты:
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000/tcp
```

## ✅ Ожидаемый результат

После применения конфигурации:
1. ✅ HTTP запросы должны перенаправляться на HTTPS
2. ✅ API маршруты `/api/*` должны работать через Node.js
3. ✅ WebSocket соединения `/socket.io/*` должны работать
4. ✅ Статические файлы React должны отдаваться из `/var/www/1337community.com/frontend/build`
5. ✅ В консоли браузера должно появиться: "✅ WebSocket подключен к турниру"

## 🚨 Критически важные моменты

1. **SSL сертификаты**: Обязательно проверьте и обновите пути к SSL сертификатам
2. **Backup**: Перед изменениями сделайте backup существующей конфигурации
3. **Тестирование**: После каждого изменения проверяйте `nginx -t`
4. **Логи**: Всегда проверяйте логи при проблемах 