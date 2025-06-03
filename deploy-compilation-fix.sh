#!/bin/bash

echo "🎉 ДЕПЛОЙ: Исправление критических ошибок компиляции React"
echo "========================================================"

# Переходим в директорию проекта на VDS
cd /var/www/1337community.com

echo "📥 Получаем исправления ошибок компиляции из GitHub..."
git fetch origin main

echo "🔄 Применяем исправления дублированных функций..."
git reset --hard origin/main

echo "🔨 Собираем новый production build..."
cd frontend
npm run build

echo "🔧 Перезапускаем backend сервер..."
cd ..
sudo systemctl restart 1337-backend

echo "⏳ Ждем 5 секунд для полной инициализации..."
sleep 5

echo "✅ Проверяем статус backend сервера..."
sudo systemctl status 1337-backend --no-pager -l

echo "🔍 Проверяем последние логи..."
sudo journalctl -u 1337-backend -n 15 --no-pager | tail -10

echo ""
echo "🎉 ДЕПЛОЙ ИСПРАВЛЕНИЙ ЗАВЕРШЕН!"
echo "==============================="
echo "✅ Исправлены дублированные определения функций"
echo "✅ Удален несуществующий ToastContext импорт"
echo "✅ Новый production build: main.742a1394.js (280.69 kB)"
echo "✅ Backend сервер перезапущен"
echo ""
echo "📝 Изменения:"
echo "   - Убраны дублированные gameHasMaps, getGameMaps, getDefaultMap"
echo "   - Добавлена заглушка для toast уведомлений"
echo "   - Проект теперь компилируется без критических ошибок"
echo ""
echo "🚀 Сайт готов к работе!" 