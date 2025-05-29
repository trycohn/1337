#!/bin/bash

# Скрипт для развертывания изменений на VDS сервере
# Использование: ./deploy.sh

set -e  # Остановить выполнение при ошибке

echo "🚀 Начинаем развертывание на сервере..."

# Переходим в директорию проекта
cd /path/to/your/project

# Получаем последние изменения из GitHub
echo "📥 Получаем последние изменения из GitHub..."
git fetch origin
git pull origin main

# Устанавливаем зависимости для backend (если изменились)
echo "📦 Проверяем зависимости backend..."
cd backend
if [ package.json -nt node_modules/.package-lock.json ] || [ ! -d node_modules ]; then
    echo "🔧 Устанавливаем зависимости backend..."
    npm install
fi

# Устанавливаем зависимости для frontend (если изменились)
echo "📦 Проверяем зависимости frontend..."
cd ../frontend
if [ package.json -nt node_modules/.package-lock.json ] || [ ! -d node_modules ]; then
    echo "🔧 Устанавливаем зависимости frontend..."
    npm install
fi

# Собираем frontend
echo "🏗️ Собираем frontend..."
npm run build

# Перезапускаем backend сервис
echo "🔄 Перезапускаем backend сервис..."
cd ../backend
sudo systemctl restart your-app-name  # Замените на имя вашего сервиса

# Обновляем Nginx конфигурацию (если нужно)
echo "🌐 Проверяем конфигурацию Nginx..."
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx перезагружен успешно"
else
    echo "❌ Ошибка в конфигурации Nginx"
    exit 1
fi

# Проверяем статус сервисов
echo "🔍 Проверяем статус сервисов..."
sudo systemctl status your-app-name --no-pager -l
sudo systemctl status nginx --no-pager -l

echo "✅ Развертывание завершено успешно!"
echo "🌐 Сайт доступен по адресу: https://1337community.com"

# Показываем последние логи для проверки
echo "📋 Последние логи приложения:"
sudo journalctl -u your-app-name --no-pager -l -n 20 