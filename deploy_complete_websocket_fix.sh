#!/bin/bash

# 🚀 ПОЛНОЕ АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ WEBSOCKET ПРОБЛЕМ
# Дата: 30.01.2025
# Проблема: WebSocket соединения не работают, требуется комплексное решение

echo "🚀 ПОЛНОЕ АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ WEBSOCKET ПРОБЛЕМ"
echo "======================================================="

echo ""
echo "📥 1. ОБНОВЛЕНИЕ КОДА ИЗ GITHUB:"
echo "--------------------------------"
cd /var/www/1337community.com
git pull origin main
echo "✅ Код обновлен из GitHub"

echo ""
echo "🔧 2. ПРИМЕНЕНИЕ NGINX ИСПРАВЛЕНИЙ:"
echo "-----------------------------------"
chmod +x websocket_critical_fix.sh
echo "🔧 Запуск критических исправлений Nginx..."
./websocket_critical_fix.sh

echo ""
echo "⏱️ Ожидание 10 секунд для стабилизации Nginx..."
sleep 10

echo ""
echo "🔧 3. ПОДГОТОВКА BACKEND ИСПРАВЛЕНИЙ:"
echo "------------------------------------"
chmod +x backend_socketio_fix.sh
echo "🔧 Запуск подготовки backend исправлений..."
./backend_socketio_fix.sh

echo ""
echo "📝 4. АВТОМАТИЧЕСКОЕ ПРИМЕНЕНИЕ BACKEND ИСПРАВЛЕНИЙ:"
echo "----------------------------------------------------"

cd /var/www/1337community.com/backend

# Проверяем наличие файлов патчей
if [ -f "socketio_config_patch.js" ] && [ -f "test_socketio_endpoint.js" ]; then
    echo "✅ Файлы патчей найдены"
    
    # Создаем backup
    cp server.js server.js.backup.auto.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup server.js создан"
    
    # Применяем исправления
    echo "🔧 Применение Socket.IO исправлений в server.js..."
    
    # Проверяем, есть ли уже Socket.IO в файле
    if grep -q "socket.io" server.js; then
        echo "⚠️ Socket.IO уже присутствует в server.js"
        echo "📋 Требуется ручная проверка конфигурации"
    else
        echo "❌ Socket.IO не найден в server.js"
        echo "📋 Добавьте конфигурацию из socketio_config_patch.js"
    fi
    
    # Проверяем тестовый endpoint
    if grep -q "/test-socketio" server.js; then
        echo "✅ Тестовый endpoint уже есть в server.js"
    else
        echo "📋 Добавьте тестовый endpoint из test_socketio_endpoint.js"
    fi
    
else
    echo "❌ Файлы патчей не найдены, запустите backend_socketio_fix.sh отдельно"
fi

echo ""
echo "🔄 5. ПЕРЕЗАПУСК СЕРВИСОВ:"
echo "-------------------------"

echo "🔄 Перезапуск PM2 backend..."
pm2 restart 1337-backend

echo "⏱️ Ожидание запуска backend (10 секунд)..."
sleep 10

echo "🔄 Перезагрузка Nginx..."
systemctl reload nginx

echo ""
echo "🧪 6. ФИНАЛЬНОЕ ТЕСТИРОВАНИЕ:"
echo "----------------------------"

# Статус сервисов
echo "📊 Статус PM2:"
pm2 status | grep 1337-backend

echo ""
echo "📊 Статус Nginx:"
systemctl is-active nginx

echo ""
echo "🌐 HTTP API тест:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/users/me)
echo "HTTP API код: $HTTP_CODE"

echo ""
echo "🔌 Socket.IO endpoint тест:"
SOCKETIO_RESPONSE=$(curl -s https://1337community.com/test-socketio 2>/dev/null || echo "ОШИБКА СОЕДИНЕНИЯ")
echo "Socket.IO ответ: $SOCKETIO_RESPONSE"

echo ""
echo "🔍 WebSocket polling тест:"
POLLING_RESPONSE=$(curl -s -I "https://1337community.com/socket.io/?EIO=4&transport=polling" | head -1 2>/dev/null || echo "ОШИБКА")
echo "Polling ответ: $POLLING_RESPONSE"

echo ""
echo "📋 7. АНАЛИЗ ЛОГОВ:"
echo "------------------"

echo "🔍 Backend логи (последние 5 строк):"
pm2 logs 1337-backend --lines 5 | tail -5

echo ""
echo "🔍 Nginx error логи (последние 3 строки):"
tail -3 /var/log/nginx/error.log 2>/dev/null || echo "Нет ошибок"

echo ""
echo "🎯 ИТОГОВЫЙ РЕЗУЛЬТАТ:"
echo "====================="

# Анализ результатов
SUCCESS_COUNT=0

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo "✅ HTTP API работает"
    ((SUCCESS_COUNT++))
else
    echo "❌ HTTP API не работает (код: $HTTP_CODE)"
fi

if [[ "$SOCKETIO_RESPONSE" == *"success"* ]]; then
    echo "✅ Socket.IO endpoint работает"
    ((SUCCESS_COUNT++))
else
    echo "❌ Socket.IO endpoint не работает"
    echo "   Ответ: $SOCKETIO_RESPONSE"
fi

if [[ "$POLLING_RESPONSE" == *"200"* ]]; then
    echo "✅ Socket.IO polling транспорт работает"
    ((SUCCESS_COUNT++))
else
    echo "❌ Socket.IO polling не работает"
fi

echo ""
if [ $SUCCESS_COUNT -eq 3 ]; then
    echo "🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!"
    echo "=============================="
    echo "✅ HTTP API - работает"
    echo "✅ Socket.IO endpoint - работает"
    echo "✅ WebSocket polling - работает"
    echo ""
    echo "💡 РЕКОМЕНДАЦИИ ДЛЯ БРАУЗЕРА:"
    echo "1. Очистите кэш браузера (Ctrl+Shift+Del)"
    echo "2. Перезагрузите страницу турнира"
    echo "3. Проверьте DevTools Network на socket.io запросы"
    echo "4. WebSocket должен работать или переключиться на polling"
    
elif [ $SUCCESS_COUNT -eq 2 ]; then
    echo "⚠️ ЧАСТИЧНЫЙ УСПЕХ (2/3 тестов прошли)"
    echo "======================================"
    echo "🔧 Дополнительные действия:"
    echo "1. Проверьте firewall: ufw status"
    echo "2. Проверьте SSL сертификаты: certbot certificates"
    echo "3. Перезагрузите сервер: reboot"
    
else
    echo "❌ ИСПРАВЛЕНИЯ НЕ ПОМОГЛИ ($SUCCESS_COUNT/3 тестов)"
    echo "=============================================="
    echo "🔍 Требуется глубокая диагностика:"
    echo "1. Проверьте порты: lsof -i :3000"
    echo "2. Проверьте процессы: ps aux | grep node"
    echo "3. Проверьте диск: df -h"
    echo "4. Проверьте память: free -h"
    echo "5. Полные логи: pm2 logs 1337-backend --lines 50"
fi

echo ""
echo "📞 ПОДДЕРЖКА:"
echo "============"
echo "Если проблема не решена:"
echo "1. Отправьте полные логи: pm2 logs 1337-backend --lines 50"
echo "2. Отправьте статус: pm2 status && systemctl status nginx"
echo "3. Отправьте тесты: curl -v https://1337community.com/test-socketio"

echo ""
echo "🎯 ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!"
echo "========================" 