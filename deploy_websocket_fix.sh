#!/bin/bash

# 🔧 Скрипт развертывания и диагностики WebSocket Socket.IO v3.0
# Автор: 1337 Community Development Team
# Дата: 2025-01-22
# Назначение: Полная диагностика и исправление WebSocket проблем

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️ WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ ERROR:${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ SUCCESS:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️ INFO:${NC} $1"
}

echo "🚀 Начинаю полную диагностику и развертывание WebSocket Socket.IO..."

# Проверяем, что мы в правильной директории
if [ ! -f "backend/server.js" ]; then
    error "Запустите скрипт из корневой директории проекта"
    exit 1
fi

# 1. ДИАГНОСТИКА СИСТЕМЫ
log "📊 Этап 1: Системная диагностика"

info "Проверяем операционную систему..."
uname -a

info "Проверяем доступную память..."
free -h

info "Проверяем загрузку CPU..."
uptime

info "Проверяем дисковое пространство..."
df -h

# 2. ДИАГНОСТИКА NODE.JS И PM2
log "📊 Этап 2: Диагностика Node.js и PM2"

info "Проверяем версию Node.js..."
node --version || error "Node.js не установлен!"

info "Проверяем версию npm..."
npm --version || error "npm не установлен!"

info "Проверяем PM2..."
if command -v pm2 &> /dev/null; then
    pm2 --version
    info "Список процессов PM2:"
    pm2 list
    
    info "Статус 1337-backend:"
    pm2 describe 1337-backend 2>/dev/null || warn "Процесс 1337-backend не найден в PM2"
else
    error "PM2 не установлен!"
fi

# 3. ДИАГНОСТИКА ПОРТОВ
log "📊 Этап 3: Диагностика портов"

info "Проверяем, кто слушает порт 3000 (Node.js)..."
sudo ss -tulpn | grep :3000 || warn "Порт 3000 не занят - Node.js не работает!"

info "Проверяем, кто слушает порт 80 (HTTP)..."
sudo ss -tulpn | grep :80

info "Проверяем, кто слушает порт 443 (HTTPS)..."
sudo ss -tulpn | grep :443

# 4. ДИАГНОСТИКА NGINX
log "📊 Этап 4: Диагностика Nginx"

info "Проверяем статус Nginx..."
if systemctl is-active --quiet nginx; then
    success "Nginx активен"
    nginx -v
else
    error "Nginx не активен!"
    systemctl status nginx
fi

info "Проверяем конфигурацию Nginx..."
if nginx -t; then
    success "Конфигурация Nginx корректна"
else
    error "Ошибки в конфигурации Nginx!"
fi

info "Ищем конфигурационные файлы для 1337community.com..."
find /etc/nginx -name "*1337*" -type f 2>/dev/null
find /etc/nginx -name "*community*" -type f 2>/dev/null

info "Проверяем активные конфигурации..."
grep -r "1337\|community" /etc/nginx/sites-enabled/ 2>/dev/null || warn "Конфигурация для 1337community.com не найдена в sites-enabled"

# 5. ДИАГНОСТИКА SSL
log "📊 Этап 5: Диагностика SSL"

info "Ищем SSL сертификаты..."
find /etc -name "*1337*" -type f | grep -E '\.(crt|pem|key)$' 2>/dev/null
find /etc/letsencrypt -name "*1337*" -type f 2>/dev/null

info "Проверяем Let's Encrypt сертификаты..."
if [ -d "/etc/letsencrypt/live/1337community.com" ]; then
    ls -la /etc/letsencrypt/live/1337community.com/
    success "Let's Encrypt сертификаты найдены"
else
    warn "Let's Encrypt сертификаты для 1337community.com не найдены"
fi

# 6. ОСТАНОВКА И ОБНОВЛЕНИЕ
log "📊 Этап 6: Остановка приложения"

info "Остановка 1337-backend..."
pm2 stop 1337-backend 2>/dev/null || warn "Приложение не было запущено через PM2"

# 7. ОБНОВЛЕНИЕ КОДА
log "📊 Этап 7: Обновление кода из GitHub"

info "Сохраняем локальные изменения..."
git stash push -m "Автосохранение перед обновлением $(date)"

info "Обновляем код..."
if git pull origin main; then
    success "Код успешно обновлен"
else
    error "Ошибка при обновлении кода из GitHub"
    exit 1
fi

# 8. УСТАНОВКА ЗАВИСИМОСТЕЙ
log "📊 Этап 8: Проверка зависимостей"

info "Проверяем package.json на изменения..."
if git diff HEAD~1 HEAD --name-only | grep -E "(package\.json|package-lock\.json)"; then
    warn "Обнаружены изменения в зависимостях, устанавливаем..."
    
    info "Устанавливаем backend зависимости..."
    cd backend && npm install && cd ..
    
    info "Устанавливаем frontend зависимости..."
    cd frontend && npm install && cd ..
else
    info "Зависимости не изменились"
fi

# 9. СБОРКА FRONTEND
log "📊 Этап 9: Сборка frontend"

info "Собираем production build..."
cd frontend
if npm run build; then
    success "Frontend собран успешно"
    cd ..
else
    error "Ошибка сборки frontend"
    cd ..
    exit 1
fi

# 10. ЗАПУСК ПРИЛОЖЕНИЯ
log "📊 Этап 10: Запуск приложения"

info "Запускаем 1337-backend..."
if pm2 start ecosystem.config.js --only 1337-backend; then
    success "1337-backend запущен"
else
    warn "Ошибка запуска через ecosystem.config.js, пробуем альтернативные способы..."
    
    if pm2 start backend/server.js --name "1337-backend"; then
        success "1337-backend запущен альтернативным способом"
    else
        error "Не удалось запустить 1337-backend"
        exit 1
    fi
fi

# 11. ПРОВЕРКА ЗАПУСКА
log "📊 Этап 11: Проверка запуска"

info "Ждем запуска приложения..."
sleep 10

info "Проверяем процессы PM2..."
pm2 list

info "Проверяем логи..."
pm2 logs 1337-backend --lines 20

info "Проверяем, слушает ли порт 3000..."
if sudo ss -tulpn | grep :3000; then
    success "Приложение слушает порт 3000"
else
    error "Приложение не слушает порт 3000!"
fi

# 12. ПЕРЕЗАГРУЗКА NGINX
log "📊 Этап 12: Перезагрузка Nginx"

info "Проверяем конфигурацию Nginx перед перезагрузкой..."
if nginx -t; then
    info "Перезагружаем Nginx..."
    if systemctl reload nginx; then
        success "Nginx перезагружен"
    else
        error "Ошибка перезагрузки Nginx"
    fi
else
    error "Конфигурация Nginx содержит ошибки!"
fi

# 13. ТЕСТИРОВАНИЕ СОЕДИНЕНИЙ
log "📊 Этап 13: Тестирование соединений"

info "Тестируем HTTP соединение..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost/ | grep -E "2[0-9]{2}|3[0-9]{2}"; then
    success "HTTP соединение работает"
else
    warn "Проблемы с HTTP соединением"
fi

info "Тестируем HTTPS соединение..."
if curl -k -s -o /dev/null -w "%{http_code}" https://localhost/ | grep -E "2[0-9]{2}|3[0-9]{2}"; then
    success "HTTPS соединение работает"
else
    warn "Проблемы с HTTPS соединением"
fi

info "Тестируем API endpoint..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/tournaments | grep -E "2[0-9]{2}"; then
    success "API endpoint /api/tournaments работает"
else
    warn "Проблемы с API endpoint"
fi

# 14. WEBSOCKET ДИАГНОСТИКА
log "📊 Этап 14: WebSocket диагностика"

info "Проверяем, запущен ли Socket.IO сервер..."
if curl -s http://localhost:3000/socket.io/ | grep -q "socket.io"; then
    success "Socket.IO сервер отвечает"
else
    warn "Socket.IO сервер не отвечает"
fi

info "Проверяем логи на наличие ошибок WebSocket..."
pm2 logs 1337-backend --lines 50 | grep -i -E "(websocket|socket\.io|upgrade|connection)" || info "Логи WebSocket чистые"

info "Проверяем Nginx логи на ошибки..."
sudo tail -50 /var/log/nginx/error.log | grep -i -E "(websocket|socket\.io|upgrade)" || info "Nginx логи чистые"

# 15. ПРОВЕРКА КОНФИГУРАЦИИ WEBSOCKET В NGINX
log "📊 Этап 15: Проверка WebSocket конфигурации в Nginx"

info "Проверяем наличие WebSocket настроек в Nginx..."
if grep -r "proxy_set_header.*Upgrade" /etc/nginx/sites-enabled/ 2>/dev/null; then
    success "WebSocket заголовки найдены в Nginx конфигурации"
else
    error "WebSocket заголовки НЕ найдены в Nginx конфигурации!"
    warn "Необходимо обновить конфигурацию Nginx согласно websocket_nginx_config.md"
fi

if grep -r "/socket.io/" /etc/nginx/sites-enabled/ 2>/dev/null; then
    success "Маршрут /socket.io/ найден в Nginx конфигурации"
else
    error "Маршрут /socket.io/ НЕ найден в Nginx конфигурации!"
    warn "Необходимо добавить специальный location для /socket.io/"
fi

# 16. ИТОГОВЫЙ ОТЧЕТ
log "📊 Этап 16: Итоговый отчет"

echo ""
echo "🎯 ИТОГОВЫЙ ОТЧЕТ РАЗВЕРТЫВАНИЯ WebSocket Socket.IO:"
echo "================================================================"

if sudo ss -tulpn | grep :3000 >/dev/null; then
    success "✅ Node.js приложение запущено на порту 3000"
else
    error "❌ Node.js приложение НЕ запущено"
fi

if systemctl is-active --quiet nginx; then
    success "✅ Nginx активен"
else
    error "❌ Nginx НЕ активен"
fi

if nginx -t &>/dev/null; then
    success "✅ Конфигурация Nginx корректна"
else
    error "❌ Конфигурация Nginx содержит ошибки"
fi

if grep -r "proxy_set_header.*Upgrade" /etc/nginx/sites-enabled/ &>/dev/null; then
    success "✅ WebSocket настройки в Nginx присутствуют"
else
    error "❌ WebSocket настройки в Nginx ОТСУТСТВУЮТ"
fi

if pm2 describe 1337-backend &>/dev/null && pm2 describe 1337-backend | grep -q "online"; then
    success "✅ PM2 процесс 1337-backend работает"
else
    error "❌ PM2 процесс 1337-backend НЕ работает"
fi

echo ""
echo "🔍 СЛЕДУЮЩИЕ ШАГИ ДЛЯ ИСПРАВЛЕНИЯ WEBSOCKET:"
echo "================================================================"
echo "1. Если WebSocket не работает, выполните:"
echo "   📖 Смотрите файл websocket_nginx_config.md"
echo "   🔧 Обновите конфигурацию Nginx"
echo "   🔑 Проверьте SSL сертификаты"
echo ""
echo "2. Для диагностики ошибок:"
echo "   📋 pm2 logs 1337-backend --lines 100"
echo "   🔍 sudo tail -f /var/log/nginx/error.log"
echo "   🌐 Откройте https://1337community.com и проверьте DevTools"
echo ""
echo "3. Тестирование WebSocket в браузере:"
echo "   🔗 Откройте https://1337community.com"
echo "   🛠️ Откройте DevTools → Console"
echo "   ✅ Должно появиться: '✅ WebSocket подключен к турниру'"
echo ""

# Финальная проверка логов
info "Показываем последние логи приложения..."
pm2 logs 1337-backend --lines 30

echo ""
success "🎉 Развертывание завершено! Проверьте WebSocket соединения в браузере."
echo "📚 Для настройки Nginx смотрите файл: websocket_nginx_config.md" 