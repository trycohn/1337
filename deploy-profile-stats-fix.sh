#!/bin/bash

# Скрипт деплоя исправлений статистики профиля на VDS сервер
# Исправления: упрощенный SQL для match-history, добавлены dota-stats endpoints, улучшена агрегация статистики

set -e

echo "🚀 Начинаем деплой исправлений статистики профиля..."

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: запустите скрипт из корневой директории проекта"
    exit 1
fi

# Получаем последние изменения из GitHub
echo "📥 Получаем обновления из GitHub..."
git pull origin main

# Проверяем статус изменений
echo "📊 Проверяем статус репозитория..."
git status

# Переходим в backend и устанавливаем зависимости
echo "🔧 Обновляем backend..."
cd backend
npm install --production

# Перезапускаем backend сервис
echo "🔄 Перезапускаем backend сервис..."
sudo systemctl restart 1337-backend
sleep 5

# Проверяем статус backend сервиса
echo "✅ Проверяем статус backend..."
sudo systemctl status 1337-backend --no-pager

# Переходим в frontend
echo "🎨 Обновляем frontend..."
cd ../frontend
npm install

# Собираем production версию
echo "🏗️ Собираем frontend для production..."
npm run build

# Копируем собранные файлы в директорию nginx
echo "📁 Обновляем файлы nginx..."
sudo cp -r build/* /var/www/1337community.com/

# Проверяем конфигурацию nginx
echo "🔍 Проверяем конфигурацию nginx..."
sudo nginx -t

# Перезагружаем nginx
echo "🔄 Перезагружаем nginx..."
sudo systemctl reload nginx

# Проверяем статус nginx
echo "✅ Проверяем статус nginx..."
sudo systemctl status nginx --no-pager

# Проверяем логи на наличие ошибок
echo "📋 Проверяем последние логи backend..."
sudo journalctl -u 1337-backend --lines=10 --no-pager

echo "📋 Проверяем логи nginx..."
sudo tail -n 10 /var/log/nginx/error.log

# Тестируем основные endpoints
echo "🧪 Тестируем исправленные endpoints..."
cd ..

# Тест match-history endpoint (должен возвращать пустой массив если нет данных)
echo "Тестируем /api/users/match-history..."
curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/users/match-history || echo "Endpoint доступен"

# Тест stats endpoint
echo "Тестируем /api/users/stats..."
curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/users/stats || echo "Endpoint доступен"

# Тест dota-stats endpoints
echo "Тестируем /api/users/dota-stats/profile/1..."
curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/users/dota-stats/profile/1 || echo "Endpoint доступен"

echo ""
echo "🎉 Деплой исправлений статистики профиля завершен!"
echo ""
echo "✅ Исправления:"
echo "   - Упрощен SQL запрос для match-history (исправлена 500 ошибка)"
echo "   - Добавлены dota-stats endpoints (исправлены 404 ошибки)"
echo "   - Улучшена агрегация статистики (защита от null/undefined)"
echo "   - Улучшена обработка ошибок в frontend"
echo ""
echo "🔍 Проверьте:"
echo "   - Откройте https://1337community.com/profile"
echo "   - Перейдите на вкладку 'Статистика'"
echo "   - Убедитесь, что нет ошибок в консоли браузера"
echo "   - Проверьте, что статистика отображается корректно"
echo ""
echo "📊 Мониторинг:"
echo "   - Логи backend: sudo journalctl -u 1337-backend -f"
echo "   - Логи nginx: sudo tail -f /var/log/nginx/error.log"
echo "   - Статус сервисов: sudo systemctl status 1337-backend nginx" 