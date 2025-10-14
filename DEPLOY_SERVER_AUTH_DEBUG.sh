#!/bin/bash
# Скрипт для деплоя и проверки защиты /lobby

echo "🚀 Деплой защиты /lobby на VDS"
echo "================================"

# Подключаемся и выполняем команды
ssh root@80.87.200.23 << 'ENDSSH'
cd /var/www/1337community.com

echo "📥 Получаем изменения из GitHub..."
git pull origin main

echo ""
echo "📝 Проверяем .env файл..."
cd backend
if grep -q "CS2_SERVER_IPS" .env; then
    echo "✅ CS2_SERVER_IPS найдена в .env:"
    grep "CS2_SERVER_IPS" .env
else
    echo "❌ CS2_SERVER_IPS НЕ НАЙДЕНА в .env!"
    echo ""
    echo "Добавляем сейчас..."
    echo "CS2_SERVER_IPS=80.87.200.23" >> .env
    echo "✅ Добавлено: CS2_SERVER_IPS=80.87.200.23"
fi

echo ""
echo "🔄 Перезапускаем backend..."
pm2 restart 1337-backend

echo ""
echo "⏳ Ждем 3 секунды..."
sleep 3

echo ""
echo "📊 Последние 30 строк логов:"
pm2 logs 1337-backend --lines 30 --nostream

echo ""
echo "================================"
echo "✅ Деплой завершен!"
echo ""
echo "🧪 Тестируй сейчас:"
echo "   curl https://1337community.com/lobby/18/bo1-lobby18-1760444739296.json"
echo ""
echo "📊 Смотреть логи в реальном времени:"
echo "   ssh root@80.87.200.23"
echo "   pm2 logs 1337-backend"
ENDSSH

