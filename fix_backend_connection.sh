#!/bin/bash

# Скрипт для исправления проблемы с подключением к backend серверу
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

log "Начинаем диагностику и исправление проблемы с backend сервером..."

# 1. Проверяем статус backend сервера
log "Проверяем статус сервиса 1337-backend..."
if systemctl is-active --quiet 1337-backend; then
    success "Сервис 1337-backend запущен"
else
    warning "Сервис 1337-backend не запущен"
    
    # Пытаемся запустить сервис
    log "Пытаемся запустить сервис 1337-backend..."
    if sudo systemctl start 1337-backend; then
        success "Сервис 1337-backend успешно запущен"
    else
        error "Не удалось запустить сервис 1337-backend"
        
        # Проверяем, существует ли сервис
        if ! systemctl list-unit-files | grep -q 1337-backend; then
            warning "Сервис 1337-backend не найден. Проверяем процессы Node.js..."
            
            # Ищем процессы Node.js
            NODE_PROCESSES=$(ps aux | grep node | grep -v grep)
            if [ -n "$NODE_PROCESSES" ]; then
                log "Найдены процессы Node.js:"
                echo "$NODE_PROCESSES"
            else
                error "Процессы Node.js не найдены"
            fi
        fi
    fi
fi

# 2. Проверяем порты
log "Проверяем какие порты слушает приложение..."
PORTS_3000=$(sudo lsof -i :3000 2>/dev/null || true)
PORTS_3001=$(sudo lsof -i :3001 2>/dev/null || true)
PORTS_5000=$(sudo lsof -i :5000 2>/dev/null || true)

if [ -n "$PORTS_3000" ]; then
    success "Порт 3000 занят:"
    echo "$PORTS_3000"
elif [ -n "$PORTS_3001" ]; then
    warning "Backend запущен на порту 3001 вместо 3000:"
    echo "$PORTS_3001"
elif [ -n "$PORTS_5000" ]; then
    warning "Backend запущен на порту 5000 вместо 3000:"
    echo "$PORTS_5000"
else
    error "Backend не слушает ни один из стандартных портов (3000, 3001, 5000)"
fi

# 3. Тестируем API напрямую
log "Тестируем API напрямую..."
if curl -s -f http://localhost:3000/api/tournaments >/dev/null 2>&1; then
    success "API на порту 3000 отвечает"
elif curl -s -f http://localhost:3001/api/tournaments >/dev/null 2>&1; then
    warning "API отвечает на порту 3001, но Nginx настроен на 3000"
elif curl -s -f http://localhost:5000/api/tournaments >/dev/null 2>&1; then
    warning "API отвечает на порту 5000, но Nginx настроен на 3000"
else
    error "API не отвечает ни на одном порту"
fi

# 4. Проверяем конфигурацию Nginx
log "Проверяем конфигурацию Nginx..."
if sudo nginx -t >/dev/null 2>&1; then
    success "Конфигурация Nginx корректна"
else
    error "Ошибка в конфигурации Nginx:"
    sudo nginx -t
fi

# 5. Проверяем логи
log "Проверяем последние ошибки в логах..."

# Логи Nginx
if [ -f /var/log/nginx/error.log ]; then
    NGINX_ERRORS=$(sudo tail -n 10 /var/log/nginx/error.log | grep -i "502\|503\|connect" || true)
    if [ -n "$NGINX_ERRORS" ]; then
        warning "Найдены ошибки в логах Nginx:"
        echo "$NGINX_ERRORS"
    fi
fi

# Логи backend сервиса
if systemctl list-unit-files | grep -q 1337-backend; then
    BACKEND_ERRORS=$(sudo journalctl -u 1337-backend --since "10 minutes ago" --no-pager | grep -i "error\|failed" || true)
    if [ -n "$BACKEND_ERRORS" ]; then
        warning "Найдены ошибки в логах backend:"
        echo "$BACKEND_ERRORS"
    fi
fi

# 6. Предлагаем решения
log "Предлагаемые решения:"

if ! systemctl is-active --quiet 1337-backend; then
    echo "1. Запустить backend сервер:"
    echo "   sudo systemctl start 1337-backend"
    echo "   sudo systemctl enable 1337-backend"
fi

if [ -n "$PORTS_3001" ] || [ -n "$PORTS_5000" ]; then
    echo "2. Обновить конфигурацию Nginx для правильного порта"
    echo "3. Или изменить порт в backend сервере на 3000"
fi

echo "4. Перезагрузить Nginx:"
echo "   sudo systemctl reload nginx"

echo "5. Проверить логи для дополнительной информации:"
echo "   sudo tail -f /var/log/nginx/error.log"
echo "   sudo journalctl -u 1337-backend -f"

# 7. Автоматическое исправление (опционально)
read -p "Хотите попытаться автоматически исправить проблему? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Пытаемся автоматически исправить проблему..."
    
    # Перезапускаем backend
    if systemctl list-unit-files | grep -q 1337-backend; then
        sudo systemctl restart 1337-backend
        sleep 5
    fi
    
    # Перезагружаем Nginx
    sudo systemctl reload nginx
    
    # Проверяем результат
    sleep 2
    if curl -s -f http://localhost:3000/api/tournaments >/dev/null 2>&1; then
        success "Проблема исправлена! API теперь отвечает"
    else
        error "Проблема не исправлена. Требуется ручное вмешательство"
    fi
fi

log "Диагностика завершена" 