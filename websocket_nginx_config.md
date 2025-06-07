# 🔧 Конфигурация Nginx для Socket.IO WebSocket

## 📋 Проблема
WebSocket соединения Socket.IO не работают на production сервере из-за неправильной конфигурации Nginx.

## 🛠️ Решение

### 1. Обновить конфигурацию Nginx

Подключиться к серверу:
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

Отредактировать конфигурацию Nginx:
```bash
sudo nano /etc/nginx/sites-available/1337community.com
```

### 2. Добавить/обновить конфигурацию для Socket.IO

```nginx
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name 1337community.com www.1337community.com;
    
    # SSL сертификаты (если используются)
    ssl_certificate /path/to/your/certificate.pem;
    ssl_certificate_key /path/to/your/private.key;
    
    # Редирект HTTP на HTTPS
    if ($scheme != "https") {
        return 301 https://$server_name$request_uri;
    }
    
    # Основная проксификация на Node.js приложение
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Важные настройки для WebSocket
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 86400;
    }
    
    # 🔌 Специальная конфигурация для Socket.IO WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Критически важные заголовки для WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Расширенные таймауты для WebSocket соединений
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
        proxy_connect_timeout 3600;
        
        # Отключаем кеширование для WebSocket
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
        
        # Дополнительные настройки для стабильности
        proxy_redirect off;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Server $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }
    
    # Статические файлы (опционально)
    location /static/ {
        alias /var/www/1337community.com/frontend/build/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. Проверить и перезагрузить Nginx

```bash
# Проверить синтаксис конфигурации
sudo nginx -t

# Если все OK, перезагрузить Nginx
sudo systemctl reload nginx

# Проверить статус
sudo systemctl status nginx
```

### 4. Перезапустить Node.js приложение

```bash
# Перейти в директорию проекта
cd /var/www/1337community.com

# Остановить текущий процесс (если запущен через PM2)
pm2 stop 1337-backend

# Обновить код с GitHub
git pull origin main

# Установить зависимости (если нужно)
npm install

# Собрать frontend (если нужно)
cd frontend && npm run build && cd ..

# Запустить приложение
pm2 start 1337-backend

# Проверить логи
pm2 logs 1337-backend
```

### 5. Альтернативная простая конфигурация (если выше не работает)

Если WebSocket все еще не работает, попробуйте эту упрощенную конфигурацию:

```nginx
server {
    listen 443 ssl http2;
    server_name 1337community.com www.1337community.com;
    
    # SSL настройки...
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Добавить в nginx.conf в секцию http:
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

### 6. Проверить работу WebSocket

После применения конфигурации:

1. Откройте браузер и перейдите на https://1337community.com
2. Откройте Developer Tools (F12)
3. Проверьте консоль на наличие ошибок WebSocket
4. Проверьте вкладку Network для Socket.IO соединений

### 7. Отладка (если проблемы остаются)

```bash
# Проверить, слушает ли Node.js на порту 3000
sudo netstat -tulpn | grep :3000

# Проверить логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Проверить логи приложения
pm2 logs 1337-backend --lines 50
```

### 8. Тестирование локального подключения

```bash
# Тест подключения к WebSocket напрямую
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Host: localhost:3000" \
     -H "Origin: http://localhost:3000" \
     http://localhost:3000/socket.io/?EIO=4&transport=websocket
```

## 🔍 Дополнительные проверки

1. **Firewall**: Убедитесь, что порты 80 и 443 открыты
2. **SSL сертификат**: Проверьте, что SSL сертификат валиден
3. **Node.js процесс**: Убедитесь, что приложение запущено и слушает на порту 3000
4. **Память**: Проверьте, что сервер не перегружен

Эта конфигурация должна решить проблему с WebSocket соединениями Socket.IO! 