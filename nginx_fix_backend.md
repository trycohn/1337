# Исправление конфигурации Nginx для backend сервера

## Проблема
Backend сервер запускается под именем `1337-backend`, но Nginx настроен на другой порт или имя сервиса.

## Решение

### 1. Проверка статуса backend сервера

```bash
# Проверяем, запущен ли backend сервер
sudo systemctl status 1337-backend

# Если сервис не найден, проверяем процессы Node.js
ps aux | grep node

# Проверяем какие порты слушает приложение
sudo netstat -tlnp | grep node
```

### 2. Проверка конфигурации Nginx

```bash
# Проверяем конфигурацию сайта
sudo nano /etc/nginx/sites-available/1337community.com

# Или если используется другое имя конфига
sudo nano /etc/nginx/sites-available/default
```

### 3. Правильная конфигурация Nginx

Файл `/etc/nginx/sites-available/1337community.com` должен содержать:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 1337community.com www.1337community.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name 1337community.com www.1337community.com;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;

    # Основная директория сайта
    root /var/www/1337community.com/frontend/build;
    index index.html index.htm;

    # Обслуживание статических файлов React
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Проксирование API запросов к backend серверу
    location /api/ {
        proxy_pass http://localhost:3000;  # Убедитесь, что порт правильный
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket поддержка для Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Обслуживание загруженных файлов
    location /uploads/ {
        alias /var/www/1337community.com/backend/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. Проверка порта backend сервера

```bash
# Проверяем на каком порту запущен backend
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :5000

# Проверяем логи backend сервера
sudo journalctl -u 1337-backend -f
```

### 5. Проверка systemd сервиса

```bash
# Проверяем конфигурацию сервиса
sudo systemctl cat 1337-backend

# Если сервис не существует, создаем его
sudo nano /etc/systemd/system/1337-backend.service
```

Содержимое файла `/etc/systemd/system/1337-backend.service`:

```ini
[Unit]
Description=1337 Community Backend Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/1337community.com/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### 6. Перезапуск сервисов

```bash
# Перезагружаем systemd
sudo systemctl daemon-reload

# Включаем автозапуск сервиса
sudo systemctl enable 1337-backend

# Запускаем backend сервер
sudo systemctl start 1337-backend

# Проверяем статус
sudo systemctl status 1337-backend

# Тестируем конфигурацию Nginx
sudo nginx -t

# Перезагружаем Nginx
sudo systemctl reload nginx
```

### 7. Проверка работоспособности

```bash
# Тестируем API напрямую
curl -X GET http://localhost:3000/api/tournaments

# Тестируем через Nginx
curl -X GET https://1337community.com/api/tournaments

# Проверяем логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### 8. Отладка проблем

Если проблемы продолжаются:

```bash
# Проверяем все запущенные Node.js процессы
ps aux | grep node

# Убиваем все Node.js процессы (осторожно!)
sudo pkill -f node

# Запускаем backend вручную для отладки
cd /var/www/1337community.com/backend
sudo -u www-data node server.js

# В другом терминале проверяем подключение
curl -X GET http://localhost:3000/api/tournaments
```

### 9. Альтернативное решение с PM2

Если systemd не работает, можно использовать PM2:

```bash
# Устанавливаем PM2 глобально
sudo npm install -g pm2

# Запускаем backend через PM2
cd /var/www/1337community.com/backend
pm2 start server.js --name "1337-backend"

# Сохраняем конфигурацию PM2
pm2 save
pm2 startup

# Проверяем статус
pm2 status
pm2 logs 1337-backend
```

## Быстрое решение

Выполните эти команды на сервере:

```bash
# 1. Проверяем backend
sudo systemctl status 1337-backend

# 2. Если не запущен, запускаем
sudo systemctl start 1337-backend

# 3. Проверяем порт
sudo lsof -i :3000

# 4. Тестируем Nginx конфигурацию
sudo nginx -t

# 5. Перезагружаем Nginx
sudo systemctl reload nginx

# 6. Проверяем логи
sudo tail -f /var/log/nginx/error.log
``` 