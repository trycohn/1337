#!/bin/bash

# Скрипт автоматического развертывания проекта 1337 Tournament Brackets
# Версия: 1.0.0
# Использование: ./deploy.sh

set -e  # Остановка при любой ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
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

# Проверка, что скрипт запущен из корня проекта
if [[ ! -f "package.json" ]] || [[ ! -d "frontend" ]] || [[ ! -d "backend" ]]; then
    error "Скрипт должен запускаться из корневой директории проекта!"
    exit 1
fi

log "🚀 Начинаем развертывание проекта 1337 Tournament Brackets"

# 1. Проверка Git статуса
info "📋 Проверка статуса Git..."
git status

# 2. Получение обновлений
log "📥 Получение обновлений из GitHub..."
git pull origin main

# 3. Проверка изменений
log "📝 Последние коммиты:"
git log --oneline -3

# 4. Обновление зависимостей Backend
if [[ -f "backend/package.json" ]]; then
    log "📦 Обновление зависимостей Backend..."
    cd backend
    if npm install; then
        log "✅ Backend зависимости обновлены"
    else
        error "❌ Ошибка обновления Backend зависимостей"
        exit 1
    fi
    cd ..
fi

# 5. Обновление зависимостей Frontend
log "📦 Обновление зависимостей Frontend..."
cd frontend
if npm install; then
    log "✅ Frontend зависимости обновлены"
else
    error "❌ Ошибка обновления Frontend зависимостей"
    exit 1
fi

# 6. Очистка предыдущей сборки
log "🧹 Очистка предыдущей сборки..."
rm -rf build node_modules/.cache

# 7. Сборка Frontend
log "🔨 Сборка Frontend приложения..."
if GENERATE_SOURCEMAP=false npm run build; then
    log "✅ Frontend собран успешно"
else
    error "❌ Ошибка сборки Frontend"
    exit 1
fi

# 8. Проверка результата сборки
log "🔍 Проверка результата сборки..."
if ls build/static/js/main.*.js 1> /dev/null 2>&1; then
    MAIN_JS_FILE=$(ls build/static/js/main.*.js)
    FILE_SIZE=$(du -h "$MAIN_JS_FILE" | cut -f1)
    log "✅ Файл собран: $MAIN_JS_FILE (размер: $FILE_SIZE)"
else
    error "❌ Основной JS файл не найден"
    exit 1
fi

cd ..

# 9. Перезапуск сервисов
log "🔄 Перезапуск сервисов..."

# Проверка наличия PM2
if command -v pm2 &> /dev/null; then
    log "🔄 Перезапуск через PM2..."
    if pm2 restart backend 2>/dev/null; then
        log "✅ Backend перезапущен через PM2"
    else
        warn "⚠️  PM2 процесс 'backend' не найден, пропускаем"
    fi
    
    # Показываем статус PM2
    log "📊 Статус PM2:"
    pm2 status
else
    warn "⚠️  PM2 не установлен, пропускаем перезапуск через PM2"
fi

# Проверка наличия systemctl и попытка перезапуска через systemd
if command -v systemctl &> /dev/null; then
    log "🔄 Проверка systemd сервисов..."
    
    # Попытка найти сервис приложения
    if systemctl is-active --quiet 1337-app; then
        log "🔄 Перезапуск 1337-app через systemctl..."
        sudo systemctl restart 1337-app
        log "✅ Сервис 1337-app перезапущен"
    else
        warn "⚠️  Сервис 1337-app не найден или не активен"
    fi
else
    warn "⚠️  systemctl не доступен"
fi

# 10. Перезагрузка Nginx
if command -v nginx &> /dev/null; then
    log "🔄 Перезагрузка Nginx..."
    
    # Проверка конфигурации
    if sudo nginx -t; then
        log "✅ Конфигурация Nginx корректна"
        
        # Перезагрузка
        if sudo systemctl reload nginx; then
            log "✅ Nginx перезагружен"
        else
            error "❌ Ошибка перезагрузки Nginx"
            exit 1
        fi
    else
        error "❌ Некорректная конфигурация Nginx"
        exit 1
    fi
else
    warn "⚠️  Nginx не установлен или не доступен"
fi

# 11. Проверка развертывания
log "🔍 Проверка развертывания..."

# Проверка файлов
info "📁 Проверка файлов Frontend:"
ls -la frontend/build/static/js/main.*.js

# Проверка сайта (если доступен localhost)
if curl -s -I http://localhost > /dev/null 2>&1; then
    log "✅ Сайт доступен на localhost"
else
    warn "⚠️  Сайт недоступен на localhost (может быть нормально для продакшена)"
fi

# 12. Финальная информация
log "🎉 Развертывание завершено!"
info "📋 Сводка:"
info "   • Версия Frontend: $(cd frontend && node -p "require('./package.json').version")"
info "   • Основной JS файл: $(basename $MAIN_JS_FILE)"
info "   • Размер файла: $FILE_SIZE"
info "   • Время развертывания: $(date)"

log "🔗 Следующие шаги:"
info "   1. Откройте сайт в браузере"
info "   2. Перейдите на страницу турнира"
info "   3. Проверьте консоль браузера (F12)"
info "   4. Убедитесь, что ошибка 'Cannot access jt before initialization' исчезла"

log "📝 Логи для проверки:"
info "   • PM2 логи: pm2 logs backend"
info "   • Nginx логи: sudo tail -f /var/log/nginx/error.log"
info "   • Системные логи: journalctl -u your-service-name -f"

log "✨ Развертывание версии 1.0.0 завершено успешно!" 