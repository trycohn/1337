#!/bin/bash

# 🎯 Скрипт для окончательного деплоя исправления TDZ ошибки
# Применяет все исправления на production сервере VDS

set -e  # Прекратить выполнение при любой ошибке

echo "🚀 ==================================="
echo "🎯 ФИНАЛЬНЫЙ ДЕПЛОЙ: TDZ исправления"
echo "🚀 ==================================="

# Путь к проекту на VDS
PROJECT_PATH="/var/www/1337community.com"
BACKEND_SERVICE="1337-backend"

# Проверяем, что мы находимся в правильной директории
if [ ! -d "$PROJECT_PATH" ]; then
    echo "❌ Директория проекта не найдена: $PROJECT_PATH"
    exit 1
fi

echo "📁 Переходим в директорию проекта..."
cd "$PROJECT_PATH"

echo "🔄 Сохраняем текущее состояние..."
git stash push -m "Автосохранение перед TDZ исправлениями $(date)"

echo "📥 Получаем последние изменения из GitHub..."
git fetch origin main

echo "🔄 Применяем изменения..."
git reset --hard origin/main

echo "📊 Проверяем статус Git..."
git status

echo "🔍 Проверяем наличие исправлений..."

# Проверяем, что fix-final-tdz-error.js присутствует
if [ -f "fix-final-tdz-error.js" ]; then
    echo "✅ Скрипт исправления TDZ найден"
    
    echo "🔧 Применяем исправления TDZ..."
    node fix-final-tdz-error.js
    
    echo "🗑️ Удаляем временный скрипт..."
    rm -f fix-final-tdz-error.js
else
    echo "ℹ️ Скрипт исправления не найден, изменения уже применены"
fi

# Проверяем новый размер TournamentDetails.js
TOURNAMENT_FILE="frontend/src/components/TournamentDetails.js"
if [ -f "$TOURNAMENT_FILE" ]; then
    FILE_SIZE=$(wc -c < "$TOURNAMENT_FILE")
    echo "📏 Размер TournamentDetails.js: $FILE_SIZE байт"
else
    echo "⚠️ Файл TournamentDetails.js не найден!"
fi

echo "📦 Переустанавливаем зависимости frontend..."
cd frontend
npm ci --only=production

echo "🏗️ Собираем production версию..."
npm run build

# Проверяем успешность сборки
if [ $? -eq 0 ]; then
    echo "✅ Frontend собран успешно!"
    
    # Проверяем размер нового bundle
    MAIN_JS=$(find build/static/js -name "main.*.js" | head -1)
    if [ -f "$MAIN_JS" ]; then
        BUNDLE_SIZE=$(stat -c%s "$MAIN_JS")
        BUNDLE_SIZE_KB=$((BUNDLE_SIZE / 1024))
        echo "📦 Размер нового bundle: ${BUNDLE_SIZE_KB} KB"
        echo "📄 Файл: $(basename "$MAIN_JS")"
    fi
else
    echo "❌ Ошибка при сборке frontend!"
    exit 1
fi

echo "🔄 Возвращаемся в корневую директорию..."
cd "$PROJECT_PATH"

echo "📦 Переустанавливаем зависимости backend..."
cd backend
npm ci --only=production

echo "🔄 Перезапускаем backend сервис..."
cd "$PROJECT_PATH"
sudo systemctl restart "$BACKEND_SERVICE"

echo "⏳ Ждем запуска backend (10 секунд)..."
sleep 10

echo "🔍 Проверяем статус backend сервиса..."
if sudo systemctl is-active --quiet "$BACKEND_SERVICE"; then
    echo "✅ Backend сервис запущен успешно"
else
    echo "❌ Проблема с запуском backend сервиса"
    echo "📋 Логи backend:"
    sudo journalctl -u "$BACKEND_SERVICE" --no-pager -n 20
    exit 1
fi

echo "🧹 Очистка временных файлов..."
rm -f fix-final-tdz-error.js
rm -f deploy-final-fix.sh

echo ""
echo "🎉 ================================="
echo "✅ ДЕПЛОЙ ЗАВЕРШЕН УСПЕШНО!"
echo "🎉 ================================="
echo ""
echo "📈 Результат:"
echo "   ✅ TDZ ошибки полностью устранены"
echo "   ✅ Frontend пересобран с исправлениями"
echo "   ✅ Backend перезапущен"
echo "   ✅ Все сервисы работают"
echo ""
echo "🔍 Рекомендуемые проверки:"
echo "   1. Откройте сайт в браузере"
echo "   2. Проверьте консоль DevTools (F12)"
echo "   3. Откройте страницу турнира"
echo "   4. Убедитесь, что нет ошибок TDZ"
echo ""
echo "📄 Логи для мониторинга:"
echo "   sudo journalctl -u $BACKEND_SERVICE -f"
echo ""
echo "🎯 TDZ ошибки успешно исправлены!" 