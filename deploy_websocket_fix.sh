#!/bin/bash

# 🔧 АВТОМАТИЧЕСКИЙ FIX WEBSOCKET для 1337 Community v3.0
# Автор: 1337 Community Development Team
# Дата: 2025-01-22
# Назначение: Полная диагностика и автоматическое исправление WebSocket проблем

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Функции логирования
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] ℹ️${NC} $1"
}

critical() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] 🔥 КРИТИЧНО:${NC} $1"
}

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          🚀 WEBSOCKET EMERGENCY FIX v3.0             ║${NC}"
echo -e "${CYAN}║          Автоматическое исправление проблем          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ЭТАП 1: ГЛОБАЛЬНАЯ ДИАГНОСТИКА СИСТЕМЫ
log "🔍 ЭТАП 1: Глобальная диагностика системы"

info "Проверяем операционную систему и ресурсы..."
echo "OS: $(uname -s) $(uname -r)"
echo "Архитектура: $(uname -m)"
echo "Память: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "Диск: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 " использовано)"}')"
echo "Загрузка: $(uptime | awk -F'load average:' '{ print $2 }')"

# ЭТАП 2: ДИАГНОСТИКА NGINX
log "🔍 ЭТАП 2: Диагностика Nginx"

if ! command -v nginx &> /dev/null; then
    error "Nginx не установлен!"
    exit 1
fi

info "Версия Nginx: $(nginx -v 2>&1)"

if systemctl is-active --quiet nginx; then
    success "Nginx работает"
else
    error "Nginx не работает!"
    info "Пытаемся запустить Nginx..."
    systemctl start nginx
    if systemctl is-active --quiet nginx; then
        success "Nginx успешно запущен"
    else
        error "Не удалось запустить Nginx"
        exit 1
    fi
fi

info "Тестируем конфигурацию Nginx..."
if nginx -t 2>/dev/null; then
    success "Конфигурация Nginx корректна"
else
    warn "Конфигурация Nginx содержит ошибки:"
    nginx -t
fi

# ЭТАП 3: ПОИСК КОНФИГУРАЦИОННЫХ ФАЙЛОВ
log "🔍 ЭТАП 3: Поиск конфигурационных файлов"

NGINX_CONFIG=""
CONFIG_TYPE=""

# Ищем конфигурацию в разных местах
info "Поиск конфигурации для 1337community.com..."

if [ -f "/etc/nginx/sites-available/1337community.com" ]; then
    NGINX_CONFIG="/etc/nginx/sites-available/1337community.com"
    CONFIG_TYPE="sites-available"
    success "Найден специальный конфигурационный файл: $NGINX_CONFIG"
elif [ -f "/etc/nginx/sites-available/default" ]; then
    # Проверяем, содержит ли default файл наш домен
    if grep -q "1337community.com" /etc/nginx/sites-available/default 2>/dev/null; then
        NGINX_CONFIG="/etc/nginx/sites-available/default"
        CONFIG_TYPE="sites-available"
        success "Найдена конфигурация в default файле: $NGINX_CONFIG"
    fi
elif [ -f "/etc/nginx/conf.d/default.conf" ]; then
    if grep -q "1337community.com" /etc/nginx/conf.d/default.conf 2>/dev/null; then
        NGINX_CONFIG="/etc/nginx/conf.d/default.conf"
        CONFIG_TYPE="conf.d"
        success "Найдена конфигурация в conf.d: $NGINX_CONFIG"
    fi
fi

# Если не нашли, ищем любые упоминания домена
if [ -z "$NGINX_CONFIG" ]; then
    info "Поиск упоминаний домена в конфигурации..."
    FOUND_FILES=$(grep -r "1337community.com" /etc/nginx/ 2>/dev/null | head -1 | cut -d: -f1)
    if [ ! -z "$FOUND_FILES" ]; then
        NGINX_CONFIG="$FOUND_FILES"
        CONFIG_TYPE="custom"
        success "Найдено упоминание домена в: $NGINX_CONFIG"
    fi
fi

if [ -z "$NGINX_CONFIG" ]; then
    warn "Конфигурация для 1337community.com не найдена"
    warn "Будем использовать /etc/nginx/sites-available/default"
    NGINX_CONFIG="/etc/nginx/sites-available/default"
    CONFIG_TYPE="sites-available"
fi

# ЭТАП 4: АНАЛИЗ ТЕКУЩЕЙ КОНФИГУРАЦИИ
log "🔍 ЭТАП 4: Анализ текущей конфигурации"

HAS_WEBSOCKET=false
HAS_SSL=false
SSL_CERT_PATH=""
SSL_KEY_PATH=""

if [ -f "$NGINX_CONFIG" ]; then
    info "Анализируем файл: $NGINX_CONFIG"
    
    # Проверяем наличие WebSocket настроек
    if grep -q "socket.io" "$NGINX_CONFIG" && grep -q "proxy_set_header.*Upgrade" "$NGINX_CONFIG"; then
        HAS_WEBSOCKET=true
        success "WebSocket настройки найдены"
    else
        warn "WebSocket настройки НЕ найдены"
    fi
    
    # Проверяем SSL настройки
    if grep -q "ssl_certificate" "$NGINX_CONFIG"; then
        HAS_SSL=true
        SSL_CERT_PATH=$(grep "ssl_certificate " "$NGINX_CONFIG" | head -1 | awk '{print $2}' | sed 's/;//')
        SSL_KEY_PATH=$(grep "ssl_certificate_key" "$NGINX_CONFIG" | head -1 | awk '{print $2}' | sed 's/;//')
        success "SSL настройки найдены"
        info "SSL сертификат: $SSL_CERT_PATH"
        info "SSL ключ: $SSL_KEY_PATH"
        
        # Проверяем существование SSL файлов
        if [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
            success "SSL файлы существуют"
        else
            warn "SSL файлы не найдены по указанным путям"
        fi
    else
        warn "SSL настройки НЕ найдены"
    fi
else
    warn "Конфигурационный файл не существует: $NGINX_CONFIG"
fi

# ЭТАП 5: ПОИСК SSL СЕРТИФИКАТОВ
log "🔍 ЭТАП 5: Поиск SSL сертификатов"

FOUND_SSL_CERT=""
FOUND_SSL_KEY=""

# Ищем Let's Encrypt сертификаты
if [ -d "/etc/letsencrypt/live/1337community.com" ]; then
    LETSENCRYPT_CERT="/etc/letsencrypt/live/1337community.com/fullchain.pem"
    LETSENCRYPT_KEY="/etc/letsencrypt/live/1337community.com/privkey.pem"
    
    if [ -f "$LETSENCRYPT_CERT" ] && [ -f "$LETSENCRYPT_KEY" ]; then
        FOUND_SSL_CERT="$LETSENCRYPT_CERT"
        FOUND_SSL_KEY="$LETSENCRYPT_KEY"
        success "Найдены Let's Encrypt сертификаты"
    fi
fi

# Если Let's Encrypt не найден, ищем другие
if [ -z "$FOUND_SSL_CERT" ]; then
    info "Поиск других SSL сертификатов..."
    
    # Ищем по разным путям
    for cert_path in "/etc/ssl/certs" "/etc/pki/tls/certs" "/usr/local/etc/nginx/ssl"; do
        if [ -d "$cert_path" ]; then
            CERT_FILE=$(find "$cert_path" -name "*1337*" -o -name "*community*" | head -1)
            if [ ! -z "$CERT_FILE" ]; then
                FOUND_SSL_CERT="$CERT_FILE"
                break
            fi
        fi
    done
    
    for key_path in "/etc/ssl/private" "/etc/pki/tls/private" "/usr/local/etc/nginx/ssl"; do
        if [ -d "$key_path" ]; then
            KEY_FILE=$(find "$key_path" -name "*1337*" -o -name "*community*" | head -1)
            if [ ! -z "$KEY_FILE" ]; then
                FOUND_SSL_KEY="$KEY_FILE"
                break
            fi
        fi
    done
fi

if [ ! -z "$FOUND_SSL_CERT" ] && [ ! -z "$FOUND_SSL_KEY" ]; then
    success "SSL сертификаты найдены:"
    info "Сертификат: $FOUND_SSL_CERT"
    info "Ключ: $FOUND_SSL_KEY"
else
    warn "SSL сертификаты не найдены автоматически"
    warn "Потребуется ручная настройка SSL"
fi

# ЭТАП 6: ПРОВЕРКА NODE.JS
log "🔍 ЭТАП 6: Проверка Node.js backend"

if command -v node &> /dev/null; then
    success "Node.js установлен: $(node --version)"
else
    error "Node.js не установлен!"
    exit 1
fi

if command -v pm2 &> /dev/null; then
    success "PM2 установлен: $(pm2 --version)"
    
    info "Статус PM2 процессов:"
    pm2 list
    
    if pm2 describe 1337-backend &>/dev/null; then
        if pm2 describe 1337-backend | grep -q "online"; then
            success "Процесс 1337-backend работает"
        else
            warn "Процесс 1337-backend не в статусе online"
        fi
    else
        warn "Процесс 1337-backend не найден в PM2"
    fi
else
    warn "PM2 не установлен"
fi

# Проверяем порт 3000
if ss -tulpn | grep -q ":3000"; then
    success "Порт 3000 слушается (Node.js работает)"
else
    error "Порт 3000 не слушается (Node.js не работает)"
    info "Пытаемся запустить backend..."
    
    if [ -f "/var/www/1337community.com/ecosystem.config.js" ]; then
        cd /var/www/1337community.com
        pm2 start ecosystem.config.js --only 1337-backend
    elif [ -f "/var/www/1337community.com/backend/server.js" ]; then
        cd /var/www/1337community.com
        pm2 start backend/server.js --name "1337-backend"
    else
        error "Не найден файл для запуска backend"
    fi
    
    sleep 3
    if ss -tulpn | grep -q ":3000"; then
        success "Backend успешно запущен"
    else
        error "Не удалось запустить backend"
    fi
fi

# ЭТАП 7: СОЗДАНИЕ BACKUP И ПРИМЕНЕНИЕ FIX
log "🔧 ЭТАП 7: Создание backup и применение WebSocket fix"

if [ "$HAS_WEBSOCKET" = true ]; then
    warn "WebSocket настройки уже присутствуют в конфигурации"
    info "Возможно, проблема в другом месте. Проверьте логи:"
    echo "  tail -f /var/log/nginx/error.log"
    echo "  pm2 logs 1337-backend"
else
    # Создаем backup
    BACKUP_FILE="${NGINX_CONFIG}.backup-$(date +%Y%m%d-%H%M%S)"
    cp "$NGINX_CONFIG" "$BACKUP_FILE"
    success "Создан backup: $BACKUP_FILE"
    
    # Определяем SSL пути для конфигурации
    CERT_PATH_CONFIG="/etc/letsencrypt/live/1337community.com/fullchain.pem"
    KEY_PATH_CONFIG="/etc/letsencrypt/live/1337community.com/privkey.pem"
    
    if [ ! -z "$FOUND_SSL_CERT" ]; then
        CERT_PATH_CONFIG="$FOUND_SSL_CERT"
    fi
    if [ ! -z "$FOUND_SSL_KEY" ]; then
        KEY_PATH_CONFIG="$FOUND_SSL_KEY"
    fi
    
    info "Создаем новую конфигурацию с WebSocket поддержкой..."
    
    # Создаем полную конфигурацию
    cat > "$NGINX_CONFIG" << EOF
# 🔧 NGINX КОНФИГУРАЦИЯ ДЛЯ 1337 COMMUNITY + WEBSOCKET
# Автоматически создано $(date)

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
    return 301 https://\$server_name\$request_uri;
}

# ОСНОВНОЙ HTTPS СЕРВЕР с WebSocket поддержкой
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name 1337community.com www.1337community.com;
    
    # SSL настройки
    ssl_certificate $CERT_PATH_CONFIG;
    ssl_certificate_key $KEY_PATH_CONFIG;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Основные настройки
    root /var/www/1337community.com/frontend/build;
    index index.html;
    client_max_body_size 50M;
    
    # 🔥 КРИТИЧЕСКИ ВАЖНО: WebSocket для Socket.IO
    location /socket.io/ {
        proxy_pass http://nodejs_backend;
        
        # WebSocket заголовки
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Proxy заголовки
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Таймауты
        proxy_read_timeout 86400s;
        proxy_send_timeout 30s;
        proxy_connect_timeout 30s;
        
        # Отключаем кэширование
        proxy_buffering off;
        proxy_cache off;
        proxy_redirect off;
    }
    
    # API маршруты
    location /api/ {
        proxy_pass http://nodejs_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Uploads
    location /uploads/ {
        proxy_pass http://nodejs_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
    
    # React SPA
    location / {
        try_files \$uri \$uri/ @react_fallback;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            try_files \$uri =404;
        }
    }
    
    location @react_fallback {
        rewrite ^.*$ /index.html last;
    }
    
    location ~ /\. {
        deny all;
    }
    
    # Логи
    access_log /var/log/nginx/1337community_access.log;
    error_log /var/log/nginx/1337community_error.log;
}
EOF
    
    success "Новая конфигурация создана"
fi

# ЭТАП 8: ТЕСТИРОВАНИЕ И ПРИМЕНЕНИЕ
log "🧪 ЭТАП 8: Тестирование и применение конфигурации"

info "Тестируем новую конфигурацию..."
if nginx -t; then
    success "Конфигурация корректна"
    
    info "Применяем конфигурацию..."
    systemctl reload nginx
    
    if systemctl is-active --quiet nginx; then
        success "Nginx успешно перезагружен"
    else
        error "Ошибка перезагрузки Nginx"
        error "Восстанавливаем backup..."
        if [ -f "$BACKUP_FILE" ]; then
            cp "$BACKUP_FILE" "$NGINX_CONFIG"
            nginx -t && systemctl reload nginx
            error "Конфигурация восстановлена из backup"
        fi
        exit 1
    fi
else
    error "Конфигурация содержит ошибки:"
    nginx -t
    error "Восстанавливаем backup..."
    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" "$NGINX_CONFIG"
        error "Конфигурация восстановлена из backup"
    fi
    exit 1
fi

# ЭТАП 9: ФИНАЛЬНОЕ ТЕСТИРОВАНИЕ
log "🎯 ЭТАП 9: Финальное тестирование"

sleep 2

info "Тестируем HTTP соединения..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "301" || "$HTTP_CODE" == "200" ]]; then
    success "HTTP соединение работает (код: $HTTP_CODE)"
else
    warn "Проблемы с HTTP соединением (код: $HTTP_CODE)"
fi

info "Тестируем HTTPS соединения..."
HTTPS_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/ 2>/dev/null || echo "000")
if [[ "$HTTPS_CODE" == "200" ]]; then
    success "HTTPS соединение работает (код: $HTTPS_CODE)"
else
    warn "Проблемы с HTTPS соединением (код: $HTTPS_CODE)"
fi

info "Тестируем API endpoint..."
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/tournaments 2>/dev/null || echo "000")
if [[ "$API_CODE" == "200" ]]; then
    success "API endpoint работает (код: $API_CODE)"
else
    warn "Проблемы с API endpoint (код: $API_CODE)"
fi

info "Тестируем Socket.IO endpoint..."
SOCKETIO_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/socket.io/ 2>/dev/null || echo "000")
if [[ "$SOCKETIO_CODE" == "200" ]]; then
    success "Socket.IO endpoint работает (код: $SOCKETIO_CODE)"
else
    warn "Проблемы с Socket.IO endpoint (код: $SOCKETIO_CODE)"
fi

# ФИНАЛЬНЫЙ ОТЧЕТ
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                 📊 ИТОГОВЫЙ ОТЧЕТ                    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

if systemctl is-active --quiet nginx; then
    success "✅ Nginx работает"
else
    error "❌ Nginx НЕ работает"
fi

if ss -tulpn | grep -q ":3000"; then
    success "✅ Node.js backend работает на порту 3000"
else
    error "❌ Node.js backend НЕ работает"
fi

if nginx -t &>/dev/null; then
    success "✅ Конфигурация Nginx корректна"
else
    error "❌ Конфигурация Nginx содержит ошибки"
fi

# Проверяем наличие WebSocket настроек
if grep -q "socket.io" "$NGINX_CONFIG" && grep -q "proxy_set_header.*Upgrade" "$NGINX_CONFIG"; then
    success "✅ WebSocket настройки применены"
else
    error "❌ WebSocket настройки НЕ найдены"
fi

if pm2 describe 1337-backend &>/dev/null && pm2 describe 1337-backend | grep -q "online"; then
    success "✅ PM2 процесс 1337-backend работает"
else
    warn "⚠️ Проблемы с PM2 процессом 1337-backend"
fi

echo ""
echo -e "${CYAN}🎯 СЛЕДУЮЩИЕ ШАГИ:${NC}"
echo ""
echo "1. Откройте https://1337community.com в браузере"
echo "2. Войдите в любой турнир"
echo "3. Откройте DevTools → Console (F12)"
echo "4. Ищите сообщение: ${GREEN}✅ WebSocket подключен к турниру${NC}"
echo ""
echo "Если WebSocket всё ещё не работает:"
echo "• Проверьте логи: ${YELLOW}tail -f /var/log/nginx/error.log${NC}"
echo "• Проверьте backend: ${YELLOW}pm2 logs 1337-backend${NC}"
echo "• Обратитесь за поддержкой: ${BLUE}websocket_nginx_config.md${NC}"
echo ""

if [ ! -z "$BACKUP_FILE" ]; then
    info "💾 Backup конфигурации сохранён: $BACKUP_FILE"
fi

echo ""
success "🎉 WebSocket Emergency Fix завершён!"
echo "" 