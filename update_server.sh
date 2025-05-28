#!/bin/bash

# Скрипт для обновления проекта на сервере
# Использование: ./update_server.sh

set -e  # Остановить выполнение при ошибке

echo "🚀 Начинаем обновление проекта..."

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ] && [ ! -f "frontend/package.json" ]; then
    echo "❌ Ошибка: Не найден package.json. Убедитесь, что вы в корневой директории проекта."
    exit 1
fi

# Сохраняем текущие изменения (если есть)
echo "📦 Сохраняем локальные изменения..."
git stash push -m "Auto-stash before update $(date)"

# Получаем последние изменения
echo "⬇️ Получаем последние изменения из GitHub..."
git pull origin main

# Проверяем, есть ли изменения в frontend
if git diff --name-only HEAD~1 HEAD | grep -q "frontend/"; then
    echo "🔧 Обнаружены изменения в frontend, пересобираем..."
    
    # Если используется Docker
    if [ -f "docker-compose.yml" ]; then
        echo "🐳 Пересборка Docker контейнеров..."
        docker-compose down
        docker-compose build --no-cache frontend
        docker-compose up -d
        echo "✅ Docker контейнеры обновлены"
    
    # Если используется PM2
    elif command -v pm2 &> /dev/null; then
        echo "🔄 Обновление через PM2..."
        cd frontend
        npm install
        npm run build
        cd ..
        pm2 restart all
        echo "✅ PM2 процессы перезапущены"
    
    # Обычная сборка
    else
        echo "🔨 Обычная сборка frontend..."
        cd frontend
        npm install
        npm run build
        cd ..
        echo "✅ Frontend собран"
    fi
else
    echo "ℹ️ Изменений в frontend не обнаружено"
fi

# Проверяем, есть ли изменения в backend
if git diff --name-only HEAD~1 HEAD | grep -q "backend/"; then
    echo "🔧 Обнаружены изменения в backend..."
    
    if [ -f "docker-compose.yml" ]; then
        echo "🐳 Перезапуск backend контейнера..."
        docker-compose restart backend
    elif command -v pm2 &> /dev/null; then
        echo "🔄 Перезапуск backend через PM2..."
        cd backend
        npm install
        cd ..
        pm2 restart backend
    fi
    echo "✅ Backend обновлен"
fi

# Перезагружаем Nginx если он используется
if command -v nginx &> /dev/null; then
    echo "🌐 Проверяем конфигурацию Nginx..."
    sudo nginx -t && sudo systemctl reload nginx
    echo "✅ Nginx перезагружен"
fi

# Показываем статус сервисов
echo "📊 Статус сервисов:"
if [ -f "docker-compose.yml" ]; then
    docker-compose ps
elif command -v pm2 &> /dev/null; then
    pm2 status
fi

# Показываем последние коммиты
echo "📝 Последние изменения:"
git log --oneline -5

echo "🎉 Обновление завершено успешно!"
echo "🔍 Проверьте работу приложения в браузере"
echo "📋 Для просмотра логов используйте:"
if [ -f "docker-compose.yml" ]; then
    echo "   docker-compose logs -f"
elif command -v pm2 &> /dev/null; then
    echo "   pm2 logs"
fi 