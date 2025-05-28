#!/bin/bash

# Скрипт развертывания новой системы чатов
# Автор: AI Assistant
# Дата: $(date)

set -e  # Остановка при ошибке

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
    
    BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Копируем важные файлы
    if [ -d "frontend/src/components" ]; then
        cp -r frontend/src/components "$BACKUP_DIR/"
        success "Компоненты скопированы в резервную копию"
    fi
    
    if [ -f "frontend/src/App.js" ]; then
        cp frontend/src/App.js "$BACKUP_DIR/"
        success "App.js скопирован в резервную копию"
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
    
    # Проверка Git
    if ! command -v git &> /dev/null; then
        error "Git не установлен"
        exit 1
    fi
    
    success "Все зависимости установлены"
}

# Обновление кода из Git
update_from_git() {
    log "Обновление кода из Git..."
    
    # Проверяем статус Git
    if [ -d ".git" ]; then
        # Сохраняем локальные изменения
        git stash push -m "Auto-stash before deployment $(date)"
        
        # Получаем последние изменения
        git fetch origin
        git pull origin main
        
        success "Код обновлен из Git"
    else
        warning "Не найден Git репозиторий. Пропускаем обновление из Git."
    fi
}

# Установка зависимостей
install_dependencies() {
    log "Установка зависимостей..."
    
    cd frontend
    
    # Очистка кэша npm
    npm cache clean --force
    
    # Установка зависимостей
    npm install
    
    success "Зависимости установлены"
    cd ..
}

# Сборка проекта
build_project() {
    log "Сборка проекта..."
    
    cd frontend
    
    # Сборка production версии
    npm run build
    
    if [ $? -eq 0 ]; then
        success "Проект успешно собран"
    else
        error "Ошибка при сборке проекта"
        exit 1
    fi
    
    cd ..
}

# Развертывание на сервере
deploy_to_server() {
    log "Развертывание на сервере..."
    
    # Путь к директории веб-сервера (настройте под ваш сервер)
    WEB_DIR="/var/www/1337community.com"
    
    if [ -d "$WEB_DIR" ]; then
        # Создаем резервную копию текущей версии на сервере
        if [ -d "$WEB_DIR/frontend_backup" ]; then
            rm -rf "$WEB_DIR/frontend_backup"
        fi
        
        if [ -d "$WEB_DIR/frontend" ]; then
            mv "$WEB_DIR/frontend" "$WEB_DIR/frontend_backup"
        fi
        
        # Копируем новую версию
        cp -r frontend/build "$WEB_DIR/frontend"
        
        success "Фронтенд развернут на сервере"
    else
        warning "Директория веб-сервера $WEB_DIR не найдена. Пропускаем развертывание."
    fi
}

# Перезапуск сервисов
restart_services() {
    log "Перезапуск сервисов..."
    
    # Перезапуск Nginx
    if command -v nginx &> /dev/null; then
        if systemctl is-active --quiet nginx; then
            sudo systemctl reload nginx
            success "Nginx перезагружен"
        else
            warning "Nginx не запущен"
        fi
    fi
    
    # Перезапуск Node.js приложения (если используется PM2)
    if command -v pm2 &> /dev/null; then
        pm2 restart all
        success "PM2 приложения перезапущены"
    fi
}

# Проверка развертывания
verify_deployment() {
    log "Проверка развертывания..."
    
    # Проверка доступности файлов
    WEB_DIR="/var/www/1337community.com"
    
    if [ -f "$WEB_DIR/frontend/index.html" ]; then
        success "Файлы фронтенда доступны"
    else
        error "Файлы фронтенда не найдены"
        return 1
    fi
    
    # Проверка размера файлов
    BUILD_SIZE=$(du -sh "$WEB_DIR/frontend" | cut -f1)
    log "Размер собранного фронтенда: $BUILD_SIZE"
    
    success "Развертывание проверено"
}

# Очистка временных файлов
cleanup() {
    log "Очистка временных файлов..."
    
    # Очистка кэша npm
    cd frontend
    npm cache clean --force
    cd ..
    
    # Удаление старых логов (старше 7 дней)
    find . -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    success "Временные файлы очищены"
}

# Главная функция
main() {
    echo "=================================================="
    echo "   Развертывание новой системы чатов"
    echo "=================================================="
    echo ""
    
    check_permissions
    create_backup
    check_dependencies
    update_from_git
    install_dependencies
    build_project
    deploy_to_server
    restart_services
    verify_deployment
    cleanup
    
    echo ""
    echo "=================================================="
    success "Развертывание завершено успешно!"
    echo "=================================================="
    echo ""
    echo "Изменения:"
    echo "✅ Удалена система уведомлений"
    echo "✅ Удален значок уведомлений из навигации"
    echo "✅ Обновлен дизайн чата в черно-белом стиле"
    echo "✅ Создано руководство по дизайн-системе"
    echo ""
    echo "Все уведомления теперь приходят в чат от пользователя '1337community'"
    echo ""
}

# Обработка ошибок
trap 'error "Произошла ошибка на строке $LINENO. Развертывание прервано."; exit 1' ERR

# Запуск основной функции
main "$@" 