#!/bin/bash

# 🔧 WEBSOCKET DEBUG COMMANDS для VDS сервера
echo "🔍 ГЛУБОКАЯ ДИАГНОСТИКА WEBSOCKET ПРОБЛЕМ"
echo "========================================"

echo ""
echo "1. 🔧 СТАТУС BACKEND:"
echo "--------------------"
pm2 status

echo ""
echo "2. 🌐 ТЕСТИРОВАНИЕ HTTP ENDPOINTS:"
echo "--------------------------------"
echo "API users/me:"
curl -s -o /dev/null -w "HTTP код: %{http_code}" https://1337community.com/api/users/me
echo ""

echo "test-socketio endpoint:"
curl -s https://1337community.com/test-socketio
echo ""

echo ""
echo "3. 🔌 ТЕСТИРОВАНИЕ SOCKET.IO НАПРЯМУЮ:"
echo "------------------------------------"
echo "Socket.IO базовый URL:"
curl -s -I https://1337community.com/socket.io/ | head -5
echo ""

echo "Socket.IO с EIO параметрами:"
curl -s -I "https://1337community.com/socket.io/?EIO=4&transport=polling" | head -5
echo ""

echo ""
echo "4. 📋 ПРОВЕРКА NGINX КОНФИГУРАЦИИ:"
echo "--------------------------------"
echo "Активная конфигурация сайта:"
if [ -f "/etc/nginx/sites-available/1337community.com" ]; then
    echo "✅ Файл конфигурации существует"
    echo "Проверка location /socket.io/:"
    grep -A 10 "location /socket.io/" /etc/nginx/sites-available/1337community.com || echo "❌ Секция /socket.io/ НЕ НАЙДЕНА"
else
    echo "❌ Файл конфигурации НЕ НАЙДЕН"
fi

echo ""
echo "Символическая ссылка:"
ls -la /etc/nginx/sites-enabled/ | grep 1337 || echo "❌ Символическая ссылка НЕ НАЙДЕНА"

echo ""
echo "5. 🚦 ПРОВЕРКА NGINX ПРОЦЕССА:"
echo "----------------------------"
systemctl is-active nginx && echo "✅ Nginx активен" || echo "❌ Nginx НЕ активен"
nginx -t && echo "✅ Конфигурация валидна" || echo "❌ Ошибка в конфигурации"

echo ""
echo "6. 🔍 ЛОГИ NGINX (последние ошибки):"
echo "-----------------------------------"
echo "Access log (последние 5 строк):"
tail -5 /var/log/nginx/access.log | grep socket || echo "Нет записей о socket.io"

echo ""
echo "Error log (последние 5 строк):"
tail -5 /var/log/nginx/error.log || echo "Логи ошибок пусты"

echo ""
echo "7. 🖥️ BACKEND ЛОГИ (Socket.IO):"
echo "------------------------------"
echo "Поиск Socket.IO сообщений в логах PM2:"
pm2 logs 1337-backend --lines 20 | grep -i socket || echo "❌ Нет сообщений о Socket.IO"

echo ""
echo "8. 🔗 ПРОВЕРКА ПОРТОВ:"
echo "--------------------"
echo "Процессы на порту 3000:"
lsof -i :3000 || echo "❌ Порт 3000 не используется"

echo ""
echo "Процессы на порту 80/443:"
lsof -i :80 && lsof -i :443 || echo "❌ Nginx порты не слушаются"

echo ""
echo "9. 🧪 ФИНАЛЬНЫЙ ТЕСТ WEBSOCKET:"
echo "-----------------------------"
echo "Попытка WebSocket соединения:"
timeout 5 websocat wss://1337community.com/socket.io/?EIO=4&transport=websocket 2>&1 || echo "❌ WebSocket соединение неудачно"

echo ""
echo "🎯 ДИАГНОСТИКА ЗАВЕРШЕНА"
echo "========================" 