#!/bin/bash

# =============================================================================
# СКРИПТ РАЗВЕРТЫВАНИЯ ОБНОВЛЕННОГО ДИЗАЙНА 1337 COMMUNITY
# Включает: турниры + профили в минималистичном черно-белом стиле
# =============================================================================

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Функция для цветного вывода
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${WHITE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

# Проверка прав root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_warning "Скрипт запущен от имени root. Рекомендуется запускать от имени обычного пользователя с sudo."
        read -p "Продолжить? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Проверка зависимостей
check_dependencies() {
    print_status "Проверка зависимостей..."
    
    local deps=("git" "node" "npm" "systemctl")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Отсутствуют зависимости: ${missing_deps[*]}"
        print_status "Установите недостающие зависимости и повторите попытку"
        exit 1
    fi
    
    print_success "Все зависимости установлены"
}

# Создание резервной копии
create_backup() {
    print_status "Создание резервной копии..."
    
    local backup_dir="/tmp/1337-backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Резервное копирование важных файлов
    if [ -f "frontend/src/components/TournamentDetails.css" ]; then
        cp "frontend/src/components/TournamentDetails.css" "$backup_dir/"
    fi
    
    if [ -f "frontend/src/components/Profile.css" ]; then
        cp "frontend/src/components/Profile.css" "$backup_dir/"
    fi
    
    if [ -f "frontend/src/components/Profile.js" ]; then
        cp "frontend/src/components/Profile.js" "$backup_dir/"
    fi
    
    if [ -f "frontend/src/components/ChatList.css" ]; then
        cp "frontend/src/components/ChatList.css" "$backup_dir/"
    fi
    
    if [ -f "frontend/src/components/Messenger.css" ]; then
        cp "frontend/src/components/Messenger.css" "$backup_dir/"
    fi
    
    print_success "Резервная копия создана: $backup_dir"
    echo "$backup_dir" > /tmp/1337-last-backup.txt
}

# Обновление кода из Git
update_code() {
    print_status "Обновление кода из Git репозитория..."
    
    # Сохраняем текущую ветку
    local current_branch=$(git branch --show-current 2>/dev/null || echo "main")
    
    # Проверяем статус репозитория
    if ! git status &>/dev/null; then
        print_error "Текущая директория не является Git репозиторием"
        return 1
    fi
    
    # Сохраняем локальные изменения
    if ! git diff --quiet; then
        print_warning "Обнаружены локальные изменения. Сохраняем их..."
        git stash push -m "Auto-stash before deployment $(date)"
    fi
    
    # Обновляем код
    git fetch origin
    git pull origin "$current_branch"
    
    if [ $? -eq 0 ]; then
        print_success "Код успешно обновлен"
    else
        print_error "Ошибка при обновлении кода"
        return 1
    fi
}

# Установка зависимостей
install_dependencies() {
    print_status "Установка зависимостей frontend..."
    
    cd frontend || {
        print_error "Директория frontend не найдена"
        return 1
    }
    
    # Очистка кеша npm
    npm cache clean --force
    
    # Установка зависимостей
    npm install
    
    if [ $? -eq 0 ]; then
        print_success "Зависимости frontend установлены"
    else
        print_error "Ошибка при установке зависимостей frontend"
        return 1
    fi
    
    cd ..
}

# Сборка frontend
build_frontend() {
    print_status "Сборка frontend приложения..."
    
    cd frontend || {
        print_error "Директория frontend не найдена"
        return 1
    }
    
    # Сборка проекта
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "Frontend успешно собран"
    else
        print_error "Ошибка при сборке frontend"
        return 1
    fi
    
    cd ..
}

# Перезапуск сервисов
restart_services() {
    print_status "Перезапуск сервисов..."
    
    # Перезапуск backend сервиса
    if systemctl is-active --quiet 1337-backend; then
        print_status "Перезапуск 1337-backend..."
        sudo systemctl restart 1337-backend
        
        # Ждем запуска сервиса
        sleep 5
        
        if systemctl is-active --quiet 1337-backend; then
            print_success "Сервис 1337-backend перезапущен"
        else
            print_error "Ошибка при перезапуске 1337-backend"
            sudo systemctl status 1337-backend
        fi
    else
        print_warning "Сервис 1337-backend не запущен"
    fi
    
    # Перезагрузка Nginx
    if systemctl is-active --quiet nginx; then
        print_status "Перезагрузка Nginx..."
        sudo systemctl reload nginx
        
        if [ $? -eq 0 ]; then
            print_success "Nginx перезагружен"
        else
            print_error "Ошибка при перезагрузке Nginx"
            sudo systemctl status nginx
        fi
    else
        print_warning "Nginx не запущен"
    fi
}

# Проверка работоспособности
health_check() {
    print_status "Проверка работоспособности..."
    
    # Проверка backend
    if systemctl is-active --quiet 1337-backend; then
        print_success "✓ Backend сервис работает"
    else
        print_error "✗ Backend сервис не работает"
    fi
    
    # Проверка Nginx
    if systemctl is-active --quiet nginx; then
        print_success "✓ Nginx работает"
    else
        print_error "✗ Nginx не работает"
    fi
    
    # Проверка доступности сайта
    if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|301\|302"; then
        print_success "✓ Сайт доступен"
    else
        print_warning "⚠ Сайт может быть недоступен"
    fi
}

# Вывод информации о изменениях
show_changes_info() {
    print_header "ИНФОРМАЦИЯ ОБ ОБНОВЛЕНИИ"
    
    echo -e "${CYAN}Обновленные компоненты:${NC}"
    echo "• Дизайн страницы турниров (минималистичный черно-белый стиль)"
    echo "• Дизайн страницы профиля (современный интерфейс + обновленная навигация)"
    echo "• Дизайн чата и списка чатов"
    echo "• Единая дизайн-система"
    echo ""
    
    echo -e "${CYAN}Основные изменения:${NC}"
    echo "• Черный фон (#000000) и белый текст (#ffffff)"
    echo "• Минималистичные элементы без скругленных углов"
    echo "• Улучшенная типографика с uppercase заголовками"
    echo "• Современная навигация в профиле с черно-белой стилистикой"
    echo "• Активные вкладки с белым фоном и черным текстом"
    echo "• Hover эффекты с плавными переходами"
    echo "• Обновленные карточки друзей и организаций"
    echo "• Новые стили модальных окон"
    echo ""
    
    echo -e "${CYAN}Файлы изменений:${NC}"
    echo "• frontend/src/components/TournamentDetails.css"
    echo "• frontend/src/components/Profile.css (полностью переписан + обновленная навигация)"
    echo "• frontend/src/components/Profile.js (обновлена структура)"
    echo "• frontend/src/components/ChatList.css"
    echo "• frontend/src/components/Messenger.css"
    echo ""
    
    if [ -f "/tmp/1337-last-backup.txt" ]; then
        local backup_dir=$(cat /tmp/1337-last-backup.txt)
        echo -e "${YELLOW}Резервная копия сохранена в: $backup_dir${NC}"
    fi
}

# Основная функция
main() {
    print_header "РАЗВЕРТЫВАНИЕ ОБНОВЛЕННОГО ДИЗАЙНА 1337 COMMUNITY"
    
    # Проверки
    check_root
    check_dependencies
    
    # Создание резервной копии
    create_backup
    
    # Обновление
    if update_code; then
        if install_dependencies; then
            if build_frontend; then
                restart_services
                health_check
                show_changes_info
                
                print_header "РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО УСПЕШНО"
                print_success "Обновленный дизайн применен!"
                print_status "Проверьте сайт в браузере для подтверждения изменений"
            else
                print_error "Ошибка при сборке frontend"
                exit 1
            fi
        else
            print_error "Ошибка при установке зависимостей"
            exit 1
        fi
    else
        print_error "Ошибка при обновлении кода"
        exit 1
    fi
}

# Обработка сигналов
trap 'print_error "Развертывание прервано пользователем"; exit 1' INT TERM

# Запуск основной функции
main "$@" 