#!/bin/bash

# Скрипт развертывания нового дизайна уведомлений
# Автор: AI Assistant
# Дата: $(date)

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
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

# Проверка прав доступа
check_permissions() {
    log "Проверка прав доступа..."
    
    if [ "$EUID" -eq 0 ]; then
        warning "Скрипт запущен от имени root. Рекомендуется запускать от обычного пользователя."
    fi
    
    # Проверка доступа к директории проекта
    if [ ! -w "." ]; then
        error "Нет прав на запись в текущую директорию"
        exit 1
    fi
    
    success "Права доступа проверены"
}

# Создание резервной копии
create_backup() {
    log "Создание резервной копии..."
    
    BACKUP_DIR="backup_$(date +'%Y%m%d_%H%M%S')"
    mkdir -p "$BACKUP_DIR"
    
    # Копируем важные файлы
    if [ -f "frontend/src/components/Notifications.css" ]; then
        cp "frontend/src/components/Notifications.css" "$BACKUP_DIR/"
    fi
    
    if [ -f "frontend/src/components/Notifications.js" ]; then
        cp "frontend/src/components/Notifications.js" "$BACKUP_DIR/"
    fi
    
    if [ -f "frontend/src/components/Notifications/Toast.css" ]; then
        cp "frontend/src/components/Notifications/Toast.css" "$BACKUP_DIR/"
    fi
    
    if [ -f "frontend/src/components/Home.css" ]; then
        cp "frontend/src/components/Home.css" "$BACKUP_DIR/"
    fi
    
    success "Резервная копия создана в $BACKUP_DIR"
}

# Проверка зависимостей
check_dependencies() {
    log "Проверка зависимостей..."
    
    # Проверка Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js не установлен"
        exit 1
    fi
    
    # Проверка npm
    if ! command -v npm &> /dev/null; then
        error "npm не установлен"
        exit 1
    fi
    
    # Проверка pm2 (опционально)
    if ! command -v pm2 &> /dev/null; then
        warning "pm2 не установлен. Автоматический перезапуск сервера будет пропущен."
    fi
    
    success "Зависимости проверены"
}

# Сборка frontend
build_frontend() {
    log "Сборка frontend..."
    
    cd frontend
    
    # Установка зависимостей
    log "Установка зависимостей..."
    npm install
    
    # Сборка проекта
    log "Сборка проекта..."
    npm run build
    
    if [ $? -eq 0 ]; then
        success "Frontend собран успешно"
    else
        error "Ошибка при сборке frontend"
        exit 1
    fi
    
    cd ..
}

# Развертывание на сервере
deploy_to_server() {
    log "Развертывание на сервере..."
    
    # Проверка существования директории build
    if [ ! -d "frontend/build" ]; then
        error "Директория build не найдена. Запустите сборку сначала."
        exit 1
    fi
    
    # Копирование файлов (требует sudo)
    if [ -d "/var/www/html" ]; then
        log "Копирование файлов в /var/www/html..."
        sudo cp -r frontend/build/* /var/www/html/
        success "Файлы скопированы"
    else
        warning "/var/www/html не найден. Пропускаем копирование."
    fi
}

# Перезапуск сервисов
restart_services() {
    log "Перезапуск сервисов..."
    
    # Перезапуск pm2 (если установлен)
    if command -v pm2 &> /dev/null; then
        log "Перезапуск pm2..."
        cd backend
        pm2 restart server.js || warning "Не удалось перезапустить pm2"
        cd ..
    fi
    
    # Перезапуск nginx (если установлен)
    if command -v nginx &> /dev/null; then
        log "Перезагрузка nginx..."
        sudo systemctl reload nginx || warning "Не удалось перезагрузить nginx"
    fi
    
    success "Сервисы перезапущены"
}

# Проверка развертывания
verify_deployment() {
    log "Проверка развертывания..."
    
    # Проверка статуса pm2
    if command -v pm2 &> /dev/null; then
        pm2 status
    fi
    
    # Проверка статуса nginx
    if command -v systemctl &> /dev/null; then
        sudo systemctl status nginx --no-pager -l
    fi
    
    success "Проверка завершена"
}

# Очистка временных файлов
cleanup() {
    log "Очистка временных файлов..."
    
    # Удаление node_modules/.cache если есть
    if [ -d "frontend/node_modules/.cache" ]; then
        rm -rf frontend/node_modules/.cache
    fi
    
    success "Очистка завершена"
}

# Главная функция
main() {
    echo "=================================================="
    echo "  Развертывание нового дизайна уведомлений"
    echo "=================================================="
    echo ""
    
    check_permissions
    check_dependencies
    create_backup
    build_frontend
    deploy_to_server
    restart_services
    verify_deployment
    cleanup
    
    echo ""
    echo "=================================================="
    success "Развертывание завершено успешно!"
    echo "=================================================="
    echo ""
    echo "Следующие шаги:"
    echo "1. Откройте https://yourdomain.com/notifications"
    echo "2. Проверьте всплывающие уведомления"
    echo "3. Протестируйте на мобильных устройствах"
    echo "4. Соберите обратную связь от пользователей"
    echo ""
}

# Обработка сигналов
trap 'error "Развертывание прервано"; exit 1' INT TERM

# Запуск основной функции
main "$@" 