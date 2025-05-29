#!/bin/bash

# Скрипт развертывания для VDS сервера 1337community.com
# Исправляет проблему с приглашением участников в турнир

set -e

# Конфигурация
PROJECT_DIR="/var/www/1337community"
SERVICE_NAME="1337-backend"
NGINX_CONFIG="/etc/nginx/sites-available/1337community.com"
BACKUP_DIR="/var/backups/1337community"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Проверка прав root
if [[ $EUID -ne 0 ]]; then
   error "Этот скрипт должен запускаться с правами root"
   exit 1
fi

log "🚀 Начинаем развертывание исправления приглашений на турнир"

# Создание резервной копии
log "💾 Создание резервной копии..."
mkdir -p $BACKUP_DIR/$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"

if [ -d "$PROJECT_DIR" ]; then
    cp -r $PROJECT_DIR $BACKUP_PATH/
    log "✅ Резервная копия создана: $BACKUP_PATH"
fi

# Переход в директорию проекта
cd $PROJECT_DIR

# Проверка Git статуса
log "📋 Проверка Git статуса..."
git status --porcelain

# Сохранение локальных изменений (если есть)
if [ -n "$(git status --porcelain)" ]; then
    warn "⚠️ Обнаружены локальные изменения, создаем stash..."
    git stash push -m "Auto-stash before deploy $(date)"
fi

# Получение обновлений
log "📥 Получение обновлений из GitHub..."
git fetch origin
git pull origin main

# Показать последние изменения
log "📝 Последние изменения:"
git log --oneline -5

# Обновление Backend зависимостей
log "📦 Проверка Backend зависимостей..."
cd backend
if [ package.json -nt node_modules/.package-lock.json ] || [ ! -d node_modules ]; then
    log "🔧 Установка Backend зависимостей..."
    npm install --production
    log "✅ Backend зависимости обновлены"
fi

# Обновление Frontend зависимостей
log "📦 Проверка Frontend зависимостей..."
cd ../frontend
if [ package.json -nt node_modules/.package-lock.json ] || [ ! -d node_modules ]; then
    log "🔧 Установка Frontend зависимостей..."
    npm install
    log "✅ Frontend зависимости обновлены"
fi

# Сборка Frontend
log "🏗️ Сборка Frontend..."
rm -rf build
GENERATE_SOURCEMAP=false npm run build

# Проверка результата сборки
if [ -d "build" ] && [ "$(ls -A build)" ]; then
    BUILD_SIZE=$(du -sh build | cut -f1)
    log "✅ Frontend собран успешно (размер: $BUILD_SIZE)"
else
    error "❌ Ошибка сборки Frontend"
    exit 1
fi

# Установка правильных прав доступа
log "🔐 Установка прав доступа..."
chown -R www-data:www-data $PROJECT_DIR/frontend/build
chmod -R 755 $PROJECT_DIR/frontend/build

# Перезапуск Backend сервиса
log "🔄 Перезапуск Backend сервиса..."
if systemctl is-active --quiet $SERVICE_NAME; then
    systemctl restart $SERVICE_NAME
    log "✅ Сервис $SERVICE_NAME перезапущен"
else
    warn "⚠️ Сервис $SERVICE_NAME не активен, запускаем..."
    systemctl start $SERVICE_NAME
fi

# Проверка статуса сервиса
sleep 3
if systemctl is-active --quiet $SERVICE_NAME; then
    log "✅ Сервис $SERVICE_NAME работает"
else
    error "❌ Сервис $SERVICE_NAME не запустился"
    journalctl -u $SERVICE_NAME --no-pager -l -n 20
    exit 1
fi

# Проверка и перезагрузка Nginx
log "🌐 Проверка конфигурации Nginx..."
if nginx -t; then
    log "✅ Конфигурация Nginx корректна"
    systemctl reload nginx
    log "✅ Nginx перезагружен"
else
    error "❌ Ошибка в конфигурации Nginx"
    exit 1
fi

# Проверка доступности сайта
log "🔍 Проверка доступности сайта..."
sleep 5

# Проверка локального подключения
if curl -s -I http://localhost > /dev/null; then
    log "✅ Сайт доступен локально"
else
    warn "⚠️ Сайт недоступен локально"
fi

# Проверка HTTPS
if curl -s -I https://1337community.com > /dev/null; then
    log "✅ Сайт доступен по HTTPS"
else
    warn "⚠️ Проблемы с HTTPS доступом"
fi

# Проверка API
log "🔍 Проверка API..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/health || echo "000")
if [ "$API_RESPONSE" = "200" ]; then
    log "✅ API работает корректно"
else
    warn "⚠️ API возвращает код: $API_RESPONSE"
fi

# Показать статус сервисов
log "📊 Статус сервисов:"
systemctl status $SERVICE_NAME --no-pager -l | head -10
systemctl status nginx --no-pager -l | head -5

# Показать последние логи
log "📋 Последние логи Backend:"
journalctl -u $SERVICE_NAME --no-pager -l -n 10

log "📋 Последние логи Nginx:"
tail -n 5 /var/log/nginx/error.log

# Очистка старых резервных копий (оставляем последние 5)
log "🧹 Очистка старых резервных копий..."
cd $BACKUP_DIR
ls -t | tail -n +6 | xargs -r rm -rf
log "✅ Старые резервные копии очищены"

# Финальная информация
log "🎉 Развертывание завершено успешно!"
info "🔧 Исправления:"
info "   • Исправлена проблема с приглашением участников"
info "   • API теперь корректно обрабатывает параметр 'username'"
info "   • Функция handleInviteUser обновлена"

info "🌐 Проверьте функциональность:"
info "   1. Откройте https://1337community.com"
info "   2. Перейдите к любому турниру"
info "   3. Попробуйте найти пользователя через поиск"
info "   4. Нажмите 'пригласить' - ошибка должна исчезнуть"

info "📝 Мониторинг:"
info "   • Логи Backend: journalctl -u $SERVICE_NAME -f"
info "   • Логи Nginx: tail -f /var/log/nginx/error.log"
info "   • Статус: systemctl status $SERVICE_NAME"

log "✨ Развертывание завершено! Время: $(date)" 