# Настройка для работы с сервисом 1337-backend

## 🎯 Цель
Настроить систему для корректной работы с backend сервисом под именем `1337-backend`.

## 📋 Шаги настройки

### 1. Создание systemd сервиса 1337-backend

Создайте файл сервиса:

```bash
sudo nano /etc/systemd/system/1337-backend.service
```

Содержимое файла:

```ini
[Unit]
Description=1337 Community Backend Server
After=network.target
After=postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/1337community.com/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=1337-backend

# Переменные окружения
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DB_HOST=localhost
Environment=DB_PORT=5432
Environment=DB_NAME=tournament_db
Environment=DB_USER=tournament_user

# Безопасность
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/1337community.com/backend/uploads

[Install]
WantedBy=multi-user.target
```

### 2. Настройка прав доступа

```bash
# Устанавливаем права на директорию
sudo chown -R www-data:www-data /var/www/1337community.com/backend

# Устанавливаем права на файлы
sudo chmod -R 755 /var/www/1337community.com/backend

# Создаем директорию для логов
sudo mkdir -p /var/log/1337-backend
sudo chown www-data:www-data /var/log/1337-backend

# Создаем директорию для uploads
sudo mkdir -p /var/www/1337community.com/backend/uploads
sudo chown www-data:www-data /var/www/1337community.com/backend/uploads
```

### 3. Конфигурация Nginx для 1337-backend

Обновите файл `/etc/nginx/sites-available/1337community.com`:

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
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Основная директория сайта
    root /var/www/1337community.com/frontend/build;
    index index.html index.htm;

    # Логи
    access_log /var/log/nginx/1337community.access.log;
    error_log /var/log/nginx/1337community.error.log;

    # Обслуживание статических файлов React
    location / {
        try_files $uri $uri/ /index.html;
        
        # Кэширование статических файлов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Проксирование API запросов к 1337-backend серверу
    location /api/ {
        proxy_pass http://localhost:3000;
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
        proxy_send_timeout 300s;
        
        # Буферизация
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
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
        proxy_read_timeout 86400;
    }

    # Обслуживание загруженных файлов
    location /uploads/ {
        alias /var/www/1337community.com/backend/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        
        # Безопасность
        location ~* \.(php|php5|phtml|pl|py|jsp|asp|sh|cgi)$ {
            deny all;
        }
    }

    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Скрытие версии Nginx
    server_tokens off;
}
```

### 4. Управление сервисом 1337-backend

```bash
# Перезагружаем systemd
sudo systemctl daemon-reload

# Включаем автозапуск сервиса
sudo systemctl enable 1337-backend

# Запускаем сервис
sudo systemctl start 1337-backend

# Проверяем статус
sudo systemctl status 1337-backend

# Просмотр логов
sudo journalctl -u 1337-backend -f

# Перезапуск сервиса
sudo systemctl restart 1337-backend

# Остановка сервиса
sudo systemctl stop 1337-backend
```

### 5. Проверка работоспособности

```bash
# Проверяем, что сервис запущен
sudo systemctl is-active 1337-backend

# Проверяем порт
sudo lsof -i :3000

# Тестируем API напрямую
curl -X GET http://localhost:3000/api/tournaments

# Тестируем через Nginx
curl -X GET https://1337community.com/api/tournaments

# Проверяем WebSocket
curl -X GET https://1337community.com/socket.io/
```

### 6. Мониторинг и логи

```bash
# Просмотр логов в реальном времени
sudo journalctl -u 1337-backend -f

# Просмотр последних 100 строк логов
sudo journalctl -u 1337-backend -n 100

# Просмотр логов за последний час
sudo journalctl -u 1337-backend --since "1 hour ago"

# Просмотр логов Nginx
sudo tail -f /var/log/nginx/1337community.error.log
sudo tail -f /var/log/nginx/1337community.access.log
```

### 7. Обновление кода

```bash
# Скрипт для обновления
#!/bin/bash

# Переходим в директорию проекта
cd /var/www/1337community.com

# Останавливаем сервис
sudo systemctl stop 1337-backend

# Обновляем код
git pull origin main

# Обновляем зависимости backend
cd backend
npm install --production

# Собираем frontend
cd ../frontend
npm install
npm run build

# Копируем собранный frontend
sudo cp -r build/* /var/www/1337community.com/frontend/build/

# Устанавливаем права
sudo chown -R www-data:www-data /var/www/1337community.com

# Запускаем сервис
sudo systemctl start 1337-backend

# Перезагружаем Nginx
sudo systemctl reload nginx

# Проверяем статус
sudo systemctl status 1337-backend
```

### 8. Отладка проблем

Если сервис не запускается:

```bash
# Проверяем синтаксис конфигурации
sudo systemctl cat 1337-backend

# Проверяем права доступа
ls -la /var/www/1337community.com/backend/

# Запускаем вручную для отладки
cd /var/www/1337community.com/backend
sudo -u www-data node server.js

# Проверяем зависимости
cd /var/www/1337community.com/backend
npm list --depth=0

# Проверяем переменные окружения
sudo systemctl show 1337-backend --property=Environment
```

### 9. Резервное копирование

```bash
# Создание резервной копии
sudo tar -czf /backup/1337community-$(date +%Y%m%d_%H%M%S).tar.gz \
    /var/www/1337community.com \
    /etc/nginx/sites-available/1337community.com \
    /etc/systemd/system/1337-backend.service

# Восстановление из резервной копии
sudo tar -xzf /backup/1337community-YYYYMMDD_HHMMSS.tar.gz -C /
sudo systemctl daemon-reload
sudo systemctl restart 1337-backend
sudo systemctl reload nginx
```

## 🚀 Быстрый запуск

Выполните эти команды для быстрой настройки:

```bash
# 1. Создаем сервис
sudo tee /etc/systemd/system/1337-backend.service > /dev/null <<EOF
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
EOF

# 2. Настраиваем права
sudo chown -R www-data:www-data /var/www/1337community.com/backend

# 3. Запускаем сервис
sudo systemctl daemon-reload
sudo systemctl enable 1337-backend
sudo systemctl start 1337-backend

# 4. Проверяем
sudo systemctl status 1337-backend
curl -X GET http://localhost:3000/api/tournaments
```

## ✅ Проверочный список

- [ ] Сервис 1337-backend создан и настроен
- [ ] Права доступа установлены корректно
- [ ] Nginx настроен для проксирования на порт 3000
- [ ] Сервис запускается автоматически
- [ ] API отвечает на запросы
- [ ] WebSocket соединения работают
- [ ] Логи пишутся корректно
- [ ] SSL сертификаты настроены
- [ ] Статические файлы обслуживаются
- [ ] Загрузка файлов работает 