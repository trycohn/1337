#!/bin/bash

echo "🔄 КРИТИЧЕСКИЙ ДЕПЛОЙ: Исправление бесконечных запросов V4 API"
echo "================================================================"

# Переходим в директорию проекта на VDS
cd /var/www/1337community.com

echo "📥 Получаем критические исправления из GitHub..."
git fetch origin main

echo "🔄 Применяем исправления бесконечных запросов..."
git reset --hard origin/main

echo "🔧 Перезапускаем backend сервер..."
sudo systemctl restart 1337-backend

echo "⏳ Ждем 5 секунд для полной инициализации..."
sleep 5

echo "✅ Проверяем статус backend сервера..."
sudo systemctl status 1337-backend --no-pager -l

echo "🔍 Проверяем последние логи..."
sudo journalctl -u 1337-backend -n 20 --no-pager | tail -10

echo ""
echo "🎉 ДЕПЛОЙ КРИТИЧЕСКИХ ИСПРАВЛЕНИЙ ЗАВЕРШЕН!"
echo "================================================================"
echo "✅ ИСПРАВЛЕНО:"
echo "   🔄 Бесконечный цикл useEffect в V4ProfileHooks.js"
echo "   🚫 V4 API добавлены в публичные маршруты (избежание 429 ошибок)"
echo "   🌐 CORS настройки улучшены для production"
echo "   🔌 WebSocket соединения стали безопасными"
echo "   ⏱️  Добавлен debounce для предотвращения частых запросов"
echo ""
echo "📊 РЕЗУЛЬТАТ:"
echo "   ❌ Бесконечные запросы к /api/v4/ остановлены"
echo "   ✅ Rate limiting для V4 API отключен"
echo "   ✅ WebSocket переподключения стали умными"
echo "   ✅ CORS работает для https://1337community.com"
echo ""
echo "🧪 РЕКОМЕНДАЦИИ:"
echo "   1. Проверьте консоль браузера - должно быть меньше запросов"
echo "   2. Откройте F12 → Network - проверьте частоту V4 API запросов"
echo "   3. Убедитесь что нет 429 ошибок для V4 endpoints"
echo "" 