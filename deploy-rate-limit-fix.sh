#!/bin/bash

echo "🚀 ЭКСТРЕННЫЙ ДЕПЛОЙ: Исправление Rate Limiting для авторизации"
echo "================================================="

# Переходим в директорию проекта на VDS
cd /var/www/1337community.com

echo "📥 Получаем последние изменения из GitHub..."
git fetch origin main

echo "🔄 Применяем изменения..."
git reset --hard origin/main

echo "🔧 Перезапускаем backend сервер..."
sudo systemctl restart 1337-backend

echo "⏳ Ждем 3 секунды для полной инициализации..."
sleep 3

echo "✅ Проверяем статус сервера..."
sudo systemctl status 1337-backend --no-pager -l

echo "🎯 Проверяем логи сервера..."
sudo journalctl -u 1337-backend -n 10 --no-pager

echo ""
echo "🎉 ДЕПЛОЙ ЗАВЕРШЕН!"
echo "✅ Маршруты авторизации теперь исключены из строгого rate limiting"
echo "✅ Лимит для /api/users/login увеличен с 500 до 1000 запросов за 15 минут"
echo ""
echo "🧪 Для тестирования выполните в браузере:"
echo "   F12 → Console → localStorage.clear() → обновите страницу"
echo "" 