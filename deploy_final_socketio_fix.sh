#!/bin/bash

# 🚨 ФИНАЛЬНЫЙ СКРИПТ ИСПРАВЛЕНИЯ Socket.IO - Connection Refused
# 
# Выявление точной причины падения Socket.IO через детальную диагностику
# После выполнения скрипта логи покажут точное место сбоя

echo "🚨 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ Socket.IO - Connection Refused"
echo "========================================================="

echo ""
echo "🔍 1. ДИАГНОСТИКА ТЕКУЩЕГО СОСТОЯНИЯ:"
echo "-------------------------------------"

echo "📊 Статус PM2 процессов:"
pm2 status

echo ""
echo "🌐 Тестирование HTTP API:"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/users/me || echo "ERROR")
echo "HTTP API статус: $HTTP_STATUS"

echo ""
echo "🔌 Тестирование Socket.IO endpoint:"
SOCKETIO_TEST=$(curl -s https://1337community.com/test-socketio 2>/dev/null || echo '{"status":"error","message":"endpoint not found"}')
echo "Socket.IO тест: $SOCKETIO_TEST"

echo ""
echo "📋 Последние 20 строк логов backend:"
pm2 logs 1337-backend --lines 20 --nostream

echo ""
echo "🔧 2. ПРИМЕНЕНИЕ ОБНОВЛЕНИЙ:"
echo "----------------------------"

echo "📥 Получение последних изменений с GitHub..."
if git pull origin main; then
    echo "✅ Git pull успешно выполнен"
else
    echo "❌ Ошибка Git pull"
    exit 1
fi

echo ""
echo "🔄 Перезапуск backend с полными логами..."
pm2 restart 1337-backend

echo ""
echo "⏳ Ожидание 5 секунд для инициализации..."
sleep 5

echo ""
echo "🔍 3. ДИАГНОСТИКА ПОСЛЕ ОБНОВЛЕНИЯ:"
echo "-----------------------------------"

echo "📋 Логи инициализации (последние 30 строк):"
pm2 logs 1337-backend --lines 30 --nostream

echo ""
echo "🧪 Повторное тестирование Socket.IO:"
SOCKETIO_TEST_AFTER=$(curl -s https://1337community.com/test-socketio 2>/dev/null || echo '{"status":"error","message":"endpoint still not available"}')
echo "Socket.IO тест после обновления: $SOCKETIO_TEST_AFTER"

echo ""
echo "🔌 Попытка WebSocket подключения (через curl):"
echo "Тестируем Socket.IO endpoint..."
curl -I https://1337community.com/socket.io/ 2>/dev/null || echo "Socket.IO endpoint недоступен"

echo ""
echo "📊 4. ФИНАЛЬНАЯ ДИАГНОСТИКА:"
echo "----------------------------"

echo "🔍 Поиск Socket.IO логов в последних 50 строках:"
pm2 logs 1337-backend --lines 50 --nostream | grep -i "socket"

echo ""
echo "❌ Поиск ошибок в логах:"
pm2 logs 1337-backend --lines 50 --nostream | grep -i "error"

echo ""
echo "🎯 ОЖИДАЕМЫЕ ЛОГИ ПРИ УСПЕШНОЙ ИНИЦИАЛИЗАЦИИ:"
echo "---------------------------------------------"
echo "✅ Должны быть видны:"
echo "  🔌 Инициализация Socket.IO сервера..."
echo "  ✅ Socket.IO сервер создан"
echo "  🔐 Настройка middleware авторизации Socket.IO..."
echo "  ✅ Middleware авторизации Socket.IO настроен"
echo "  🔌 Инициализация чата через Socket.IO..."
echo "  ✅ Чат Socket.IO инициализирован"
echo "  ✅ Socket.IO экземпляр установлен в app"
echo "  ✅ Socket.IO полностью инициализирован и готов к работе!"

echo ""
echo "🎯 ДЕЙСТВИЯ ЕСЛИ ЛОГИ НЕ ПОЯВИЛИСЬ:"
echo "-----------------------------------"
echo "1. Socket.IO падает при инициализации - смотреть error логи"
echo "2. Проблема с зависимостями - проверить package.json"
echo "3. Конфликт портов - проверить ss -tulpn | grep :3000"
echo "4. Проблема с chat-socketio.js - временно закомментировать setupChatSocketIO(io)"

echo ""
echo "🚀 МОНИТОРИНГ В РЕАЛЬНОМ ВРЕМЕНИ:"
echo "---------------------------------"
echo "Для мониторинга логов в реальном времени выполните:"
echo "pm2 logs 1337-backend --follow"

echo ""
echo "✅ СКРИПТ ЗАВЕРШЕН! Проанализируйте логи выше для выявления проблемы." 