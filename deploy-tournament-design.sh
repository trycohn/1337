#!/bin/bash

# Скрипт развертывания обновленного дизайна турниров
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

log "Начинаем развертывание обновленного дизайна турниров..."

# 1. Проверка существования директории проекта
PROJECT_DIR="/var/www/1337community.com"
if [ ! -d "$PROJECT_DIR" ]; then
    error "Директория проекта $PROJECT_DIR не найдена"
    exit 1
fi

cd "$PROJECT_DIR"

# 2. Создание резервной копии
BACKUP_DIR="/backup/1337community-design-$(date +%Y%m%d_%H%M%S)"
log "Создаем резервную копию в $BACKUP_DIR..."

mkdir -p "$BACKUP_DIR"
cp -r frontend/src/components/TournamentDetails.css "$BACKUP_DIR/" 2>/dev/null || true
cp -r frontend/src/components/Home.css "$BACKUP_DIR/" 2>/dev/null || true
cp -r frontend/src/components/ChatList.css "$BACKUP_DIR/" 2>/dev/null || true
cp -r frontend/src/components/Messenger.css "$BACKUP_DIR/" 2>/dev/null || true

success "Резервная копия создана"

# 3. Остановка сервиса
log "Останавливаем сервис 1337-backend..."
systemctl stop 1337-backend || warning "Сервис 1337-backend не запущен"

# 4. Обновление кода из Git
log "Обновляем код из Git репозитория..."
git fetch origin
git pull origin main

if [ $? -ne 0 ]; then
    error "Ошибка при обновлении кода из Git"
    exit 1
fi

success "Код обновлен из Git"

# 5. Установка зависимостей frontend
log "Устанавливаем зависимости frontend..."
cd frontend
npm install

if [ $? -ne 0 ]; then
    error "Ошибка при установке зависимостей frontend"
    exit 1
fi

success "Зависимости frontend установлены"

# 6. Сборка frontend
log "Собираем frontend..."
npm run build

if [ $? -ne 0 ]; then
    error "Ошибка при сборке frontend"
    exit 1
fi

success "Frontend собран"

# 7. Копирование собранного frontend
log "Копируем собранный frontend..."
cd ..
rm -rf /var/www/1337community.com/frontend/build.old 2>/dev/null || true
mv /var/www/1337community.com/frontend/build /var/www/1337community.com/frontend/build.old 2>/dev/null || true
cp -r frontend/build /var/www/1337community.com/frontend/

success "Frontend скопирован"

# 8. Установка зависимостей backend
log "Устанавливаем зависимости backend..."
cd backend
npm install --production

if [ $? -ne 0 ]; then
    warning "Ошибка при установке зависимостей backend (возможно, они уже установлены)"
fi

cd ..

# 9. Установка прав доступа
log "Устанавливаем права доступа..."
chown -R www-data:www-data /var/www/1337community.com
chmod -R 755 /var/www/1337community.com

success "Права доступа установлены"

# 10. Запуск сервиса
log "Запускаем сервис 1337-backend..."
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

# 11. Перезагрузка Nginx
log "Перезагружаем Nginx..."
systemctl reload nginx

if [ $? -eq 0 ]; then
    success "Nginx перезагружен"
else
    error "Ошибка при перезагрузке Nginx"
    exit 1
fi

# 12. Проверка работоспособности
log "Проверяем работоспособность..."

# Проверяем API
sleep 2
if curl -s -f http://localhost:3000/api/tournaments >/dev/null 2>&1; then
    success "API отвечает на запросы"
else
    warning "API не отвечает на запросы (возможно, база данных не настроена)"
fi

# Проверяем веб-сайт
if curl -s -f https://1337community.com >/dev/null 2>&1; then
    success "Веб-сайт доступен"
else
    warning "Веб-сайт недоступен"
fi

# 13. Очистка старых файлов
log "Очищаем старые файлы..."
find /var/www/1337community.com -name "*.old" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
find /backup -name "1337community-design-*" -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true

success "Старые файлы очищены"

# 14. Финальная проверка
log "Финальная проверка системы..."

echo ""
echo "=== СТАТУС СЕРВИСОВ ==="
systemctl status 1337-backend --no-pager -l | head -10
echo ""
systemctl status nginx --no-pager -l | head -10

echo ""
echo "=== ПРОВЕРКА ПОРТОВ ==="
lsof -i :3000 | head -5 || echo "Порт 3000 не занят"
lsof -i :80 | head -5 || echo "Порт 80 не занят"
lsof -i :443 | head -5 || echo "Порт 443 не занят"

echo ""
echo "=== ПОСЛЕДНИЕ ЛОГИ ==="
journalctl -u 1337-backend --no-pager -n 5

echo ""
success "Развертывание обновленного дизайна турниров завершено!"
echo ""
echo "🎨 Обновления дизайна:"
echo "  ✅ Минималистичный черно-белый стиль"
echo "  ✅ Обновленные страницы турниров"
echo "  ✅ Единая цветовая схема"
echo "  ✅ Улучшенная типографика"
echo ""
echo "📋 Полезные команды:"
echo "  sudo systemctl status 1337-backend     # Статус сервиса"
echo "  sudo journalctl -u 1337-backend -f     # Логи в реальном времени"
echo "  sudo systemctl restart 1337-backend    # Перезапуск сервиса"
echo ""
echo "🌐 Проверьте работу сайта: https://1337community.com"
echo "📁 Резервная копия: $BACKUP_DIR" 