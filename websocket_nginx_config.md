# 🔧 ИСЧЕРПЫВАЮЩИЙ FIX NGINX ДЛЯ WEBSOCKET v2.0

## 🎯 ДИАГНОЗ ПРОБЛЕМЫ
WebSocket соединения к `wss://1337community.com/socket.io/` падают потому что **Nginx не настроен для проксирования WebSocket**. HTTP API работает, WebSocket - нет.

## 🚀 РЕШЕНИЕ: 3 СЦЕНАРИЯ

### СЦЕНАРИЙ A: SSH доступ восстановлен
```bash
# Используйте пароль: 01012006Fortnite!
ssh root@80.87.200.23
```

### СЦЕНАРИЙ B: Панель управления хостинга
Если есть веб-панель управления (cPanel, Plesk, etc.) - используйте её для редактирования конфигураций.

### СЦЕНАРИЙ C: SFTP доступ
```bash
# Подключение через FileZilla или другой SFTP клиент
Host: 80.87.200.23
User: root  
Password: 01012006Fortnite!
Port: 22
```

---

## 📋 ПОШАГОВАЯ ДИАГНОСТИКА

### ШАГ 1: Найти текущую конфигурацию Nginx
```bash
# Проверяем статус Nginx
systemctl status nginx

# Ищем конфигурацию для 1337community.com
find /etc/nginx -name "*1337*" -type f
find /etc/nginx -name "*community*" -type f

# Проверяем основные файлы конфигурации
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/
ls -la /etc/nginx/conf.d/

# Ищем упоминания домена
grep -r "1337community.com" /etc/nginx/
grep -r "server_name.*1337" /etc/nginx/
```

### ШАГ 2: Определить тип конфигурации
Nginx может быть настроен в одном из этих вариантов:

**A) Ubuntu/Debian стиль:**
```bash
/etc/nginx/sites-available/default
/etc/nginx/sites-available/1337community.com
```

**B) CentOS/RedHat стиль:**
```bash
/etc/nginx/conf.d/default.conf
/etc/nginx/nginx.conf
```

**C) Панель управления:**
```bash
/etc/nginx/vhosts/1337community.com.conf
/usr/local/nginx/conf/nginx.conf
```

---

## 🛠️ УНИВЕРСАЛЬНАЯ КОНФИГУРАЦИЯ NGINX

### Вариант 1: Полная замена конфигурации
**Файл:** `/etc/nginx/sites-available/default` ИЛИ `/etc/nginx/conf.d/default.conf`

```nginx
# 🔧 ПОЛНАЯ КОНФИГУРАЦИЯ NGINX ДЛЯ 1337 COMMUNITY + WEBSOCKET v2.0

# Upstream для Node.js backend
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

# ОСНОВНОЙ HTTPS СЕРВЕР с поддержкой WebSocket
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name 1337community.com www.1337community.com;
    
    # 🔐 SSL НАСТРОЙКИ - НАЙДИТЕ И ОБНОВИТЕ ПУТИ!
    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
    
    # Если Let's Encrypt сертификатов нет, используйте что найдете:
    # ssl_certificate /path/to/your/certificate.crt;
    # ssl_certificate_key /path/to/your/private.key;
    
    # Современные SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
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
    
    # ⚡ КРИТИЧЕСКИ ВАЖНО: WEBSOCKET для Socket.IO
    location /socket.io/ {
        proxy_pass http://nodejs_backend;
        
        # 🔥 ОБЯЗАТЕЛЬНЫЕ WEBSOCKET ЗАГОЛОВКИ
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 🔗 СТАНДАРТНЫЕ PROXY ЗАГОЛОВКИ
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # ⏱️ ТАЙМАУТЫ для WebSocket
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 86400s;  # 24 часа для long-polling
        
        # 🚫 ОТКЛЮЧАЕМ КЭШИРОВАНИЕ для WebSocket
        proxy_buffering off;
        proxy_cache off;
        
        # 📡 ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ
        proxy_redirect off;
    }
    
    # 🔌 API МАРШРУТЫ
    location /api/ {
        proxy_pass http://nodejs_backend;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    # 📁 UPLOADS
    location /uploads/ {
        proxy_pass http://nodejs_backend;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
    
    # 🎯 REACT SPA - все остальные запросы
    location / {
        try_files $uri $uri/ @react_fallback;
        
        # Кэширование статических ресурсов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            try_files $uri =404;
        }
    }
    
    # 🔄 FALLBACK для React Router
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

### Вариант 2: Только добавить WebSocket секцию
Если у вас уже есть рабочая конфигурация, добавьте только эту секцию ПЕРЕД location / { }:

```nginx
# ⚡ ДОБАВИТЬ ЭТУ СЕКЦИЮ ПЕРЕД location / {
location /socket.io/ {
    proxy_pass http://127.0.0.1:3000;
    
    # 🔥 КРИТИЧЕСКИ ВАЖНЫЕ WEBSOCKET ЗАГОЛОВКИ
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # СТАНДАРТНЫЕ ЗАГОЛОВКИ
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # ТАЙМАУТЫ
    proxy_read_timeout 86400s;
    proxy_send_timeout 30s;
    proxy_connect_timeout 30s;
    
    # ОТКЛЮЧАЕМ КЭШИРОВАНИЕ
    proxy_buffering off;
    proxy_cache off;
}
```

---

## 🔍 ПОИСК SSL СЕРТИФИКАТОВ

```bash
# Ищем Let's Encrypt сертификаты
find /etc/letsencrypt -name "*1337*" -type f

# Если Let's Encrypt установлен:
ls -la /etc/letsencrypt/live/1337community.com/

# Ищем другие SSL сертификаты
find /etc -name "*.crt" | grep -i 1337
find /etc -name "*.pem" | grep -i 1337
find /etc/ssl -name "*1337*" -type f

# Проверяем активные SSL в Nginx
grep -r "ssl_certificate" /etc/nginx/
```

**Обновите пути SSL в конфигурации:**
```nginx
# Примеры правильных путей:
ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;

# ИЛИ для других типов сертификатов:
ssl_certificate /etc/ssl/certs/1337community.com.crt;
ssl_certificate_key /etc/ssl/private/1337community.com.key;
```

---

## ✅ ПРИМЕНЕНИЕ ИЗМЕНЕНИЙ

### 1. Создайте BACKUP
```bash
# ОБЯЗАТЕЛЬНО сделайте backup
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup-$(date +%Y%m%d-%H%M%S)
# ИЛИ
cp /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.backup-$(date +%Y%m%d-%H%M%S)
```

### 2. Применить конфигурацию
```bash
# Тестируем конфигурацию
nginx -t

# Если ошибки - исправляем их
# Если OK - перезагружаем
systemctl reload nginx

# Проверяем статус
systemctl status nginx
```

### 3. Проверяем Node.js
```bash
# Убеждаемся что Node.js работает на порту 3000
ss -tulpn | grep :3000
pm2 status
pm2 logs 1337-backend --lines 20
```

---

## 🧪 ТЕСТИРОВАНИЕ

### 1. Проверяем WebSocket в браузере
Откройте https://1337community.com, войдите в турнир, откройте DevTools Console:

**Ожидаемый результат:**
```
✅ WebSocket подключен к турниру 59
```

**Если видите ошибки:**
```
WebSocket connection failed
```

### 2. Тестируем через curl
```bash
# Тестируем HTTP API (должно работать)
curl -I https://1337community.com/api/tournaments

# Тестируем Socket.IO endpoint
curl -I https://1337community.com/socket.io/
```

### 3. Проверяем логи
```bash
# Логи Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/1337community_error.log

# Логи Node.js
pm2 logs 1337-backend --lines 50
```

---

## 🚨 TROUBLESHOOTING

### Проблема: "404 Not Found" для /socket.io/
**Решение:** Добавьте location /socket.io/ ПЕРЕД location / в конфигурации

### Проблема: "SSL certificate error"
**Решение:** Найдите правильные пути к SSL сертификатам и обновите их

### Проблема: "Connection refused"
**Решение:** Проверьте что Node.js работает на порту 3000:
```bash
pm2 restart 1337-backend
ss -tulpn | grep :3000
```

### Проблема: "permission denied"
**Решение:** Проверьте права доступа:
```bash
# Права на SSL сертификаты
chmod 644 /etc/letsencrypt/live/1337community.com/fullchain.pem
chmod 600 /etc/letsencrypt/live/1337community.com/privkey.pem

# Перезапуск Nginx
systemctl restart nginx
```

---

## 📞 ЭКСТРЕННЫЕ КОМАНДЫ

Если что-то пошло не так:

```bash
# Восстановить backup
cp /etc/nginx/sites-available/default.backup-* /etc/nginx/sites-available/default
nginx -t && systemctl reload nginx

# Перезапустить все сервисы
systemctl restart nginx
pm2 restart all

# Проверить что работает
curl -I https://1337community.com
ss -tulpn | grep :3000
```

---

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После применения fix:

1. ✅ **HTTP API** продолжает работать: `/api/*`
2. ✅ **WebSocket соединения** успешны: `wss://1337community.com/socket.io/`
3. ✅ **В консоли браузера**: `✅ WebSocket подключен к турниру`
4. ✅ **Real-time обновления** работают в турнирах
5. ✅ **Чат уведомления** работают в реальном времени

**🚀 Главный критерий успеха:** В DevTools Console вместо ошибок WebSocket видим `✅ WebSocket подключен к турниру` 