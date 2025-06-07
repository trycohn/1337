#!/bin/bash

# 🔧 WEBSOCKET DEBUG COMMANDS для VDS сервера
echo "🔍 ДИАГНОСТИКА WEBSOCKET ПРОБЛЕМ"
echo "================================="

echo ""
echo "1. 📋 ПРОВЕРЯЕМ КОНФИГУРАЦИЮ NGINX:"
echo "-----------------------------------"
cat /etc/nginx/sites-available/default | grep -A 20 -B 5 "socket.io"

echo ""
echo "2. 🔍 ПРОВЕРЯЕМ ЛОГИ NGINX:"
echo "---------------------------"
echo "Последние 20 строк error.log:"
tail -20 /var/log/nginx/error.log

echo ""
echo "Последние 10 строк access.log (поиск socket.io):"
tail -50 /var/log/nginx/access.log | grep socket.io

echo ""
echo "3. 📊 ПРОВЕРЯЕМ СТАТУС BACKEND:"
echo "-------------------------------"
pm2 logs 1337-backend --lines 10

echo ""
echo "4. 🌐 ТЕСТИРУЕМ ПРЯМОЕ ПОДКЛЮЧЕНИЕ К BACKEND:"
echo "---------------------------------------------"
curl -I http://localhost:3000/socket.io/
echo ""
curl -I https://localhost/socket.io/

echo ""
echo "5. 🔌 ПРОВЕРЯЕМ ОТКРЫТЫЕ ПОРТЫ:"
echo "-------------------------------"
ss -tulpn | grep :3000
ss -tulpn | grep :80
ss -tulpn | grep :443

echo ""
echo "6. 📝 ПРОВЕРЯЕМ PROCESSES:"
echo "-------------------------"
ps aux | grep nginx
ps aux | grep node

echo ""
echo "7. ⚡ ЖИВОЙ ТЕСТ WEBSOCKET:"
echo "--------------------------"
echo "Тестируем с curl через Nginx proxy:"
curl -v --http1.1 \
     --header "Connection: Upgrade" \
     --header "Upgrade: websocket" \
     --header "Sec-WebSocket-Key: test" \
     --header "Sec-WebSocket-Version: 13" \
     https://1337community.com/socket.io/ 2>&1 | head -20

echo ""
echo "8. 🔧 ПРОВЕРЯЕМ NGINX WORKER PROCESSES:"
echo "--------------------------------------"
nginx -T | grep -A 5 -B 5 socket.io 