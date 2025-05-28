#!/bin/bash

# Автоматическая настройка сервиса 1337-backend
# Автор: AI Assistant

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для логирования
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка прав root
if [[ $EUID -ne 0 ]]; then
   error "Этот скрипт должен быть запущен с правами root (sudo)"
   exit 1
fi

log "Начинаем настройку сервиса 1337-backend..."

# 1. Создание systemd сервиса
log "Создаем systemd сервис 1337-backend..."

cat > /etc/systemd/system/1337-backend.service << 'EOF'
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
EOF

success "Сервис 1337-backend создан"

# 2. Настройка прав доступа
log "Настраиваем права доступа..."

# Проверяем существование директории
if [ ! -d "/var/www/1337community.com/backend" ]; then
    error "Директория /var/www/1337community.com/backend не найдена"
    exit 1
fi

# Устанавливаем права
chown -R www-data:www-data /var/www/1337community.com/backend
chmod -R 755 /var/www/1337community.com/backend

# Создаем директории
mkdir -p /var/log/1337-backend
chown www-data:www-data /var/log/1337-backend

mkdir -p /var/www/1337community.com/backend/uploads
chown www-data:www-data /var/www/1337community.com/backend/uploads

success "Права доступа настроены"

# 3. Обновление конфигурации Nginx
log "Обновляем конфигурацию Nginx..."

# Создаем резервную копию
if [ -f "/etc/nginx/sites-available/1337community.com" ]; then
    cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.backup.$(date +%Y%m%d_%H%M%S)
    warning "Создана резервная копия конфигурации Nginx"
fi

cat > /etc/nginx/sites-available/1337community.com << 'EOF'
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
EOF

# Проверяем конфигурацию Nginx
if nginx -t; then
    success "Конфигурация Nginx обновлена и проверена"
else
    error "Ошибка в конфигурации Nginx"
    exit 1
fi

# 4. Запуск и настройка сервиса
log "Запускаем и настраиваем сервис 1337-backend..."

# Перезагружаем systemd
systemctl daemon-reload

# Останавливаем старые процессы Node.js (если есть)
pkill -f "node.*server.js" || true

# Включаем автозапуск
systemctl enable 1337-backend

# Запускаем сервис
systemctl start 1337-backend

# Ждем запуска
sleep 5

# Проверяем статус
if systemctl is-active --quiet 1337-backend; then
    success "Сервис 1337-backend запущен успешно"
else
    error "Не удалось запустить сервис 1337-backend"
    journalctl -u 1337-backend --no-pager -n 20
    exit 1
fi

# 5. Перезагрузка Nginx
log "Перезагружаем Nginx..."
systemctl reload nginx
success "Nginx перезагружен"

# 6. Проверка работоспособности
log "Проверяем работоспособность..."

# Проверяем порт
if lsof -i :3000 >/dev/null 2>&1; then
    success "Порт 3000 занят сервисом"
else
    warning "Порт 3000 не занят"
fi

# Тестируем API
sleep 2
if curl -s -f http://localhost:3000/api/tournaments >/dev/null 2>&1; then
    success "API отвечает на запросы"
else
    warning "API не отвечает на запросы (возможно, база данных не настроена)"
fi

# 7. Создание скрипта обновления
log "Создаем скрипт обновления..."

cat > /usr/local/bin/update-1337community.sh << 'EOF'
#!/bin/bash

# Скрипт обновления 1337 Community
set -e

echo "Обновление 1337 Community..."

# Переходим в директорию проекта
cd /var/www/1337community.com

# Останавливаем сервис
systemctl stop 1337-backend

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
cp -r build/* /var/www/1337community.com/frontend/build/

# Устанавливаем права
chown -R www-data:www-data /var/www/1337community.com

# Запускаем сервис
systemctl start 1337-backend

# Перезагружаем Nginx
systemctl reload nginx

# Проверяем статус
systemctl status 1337-backend

echo "Обновление завершено!"
EOF

chmod +x /usr/local/bin/update-1337community.sh
success "Скрипт обновления создан: /usr/local/bin/update-1337community.sh"

# 8. Финальная проверка
log "Финальная проверка системы..."

echo ""
echo "=== СТАТУС СЕРВИСОВ ==="
systemctl status 1337-backend --no-pager -l
echo ""
systemctl status nginx --no-pager -l

echo ""
echo "=== ПОРТЫ ==="
lsof -i :3000 || echo "Порт 3000 не занят"

echo ""
echo "=== ПОСЛЕДНИЕ ЛОГИ 1337-BACKEND ==="
journalctl -u 1337-backend --no-pager -n 10

echo ""
success "Настройка завершена!"
echo ""
echo "Полезные команды:"
echo "  sudo systemctl status 1337-backend     # Статус сервиса"
echo "  sudo journalctl -u 1337-backend -f     # Логи в реальном времени"
echo "  sudo systemctl restart 1337-backend    # Перезапуск сервиса"
echo "  sudo /usr/local/bin/update-1337community.sh  # Обновление проекта"
echo ""
echo "Проверьте работу сайта: https://1337community.com" 