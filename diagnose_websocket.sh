#!/bin/bash

echo "🔍 Диагностика WebSocket проблемы для 1337community.com"
echo "=================================================="

# Подключаемся к серверу
ssh root@80.87.200.23 << 'ENDSSH'

echo "1️⃣ Проверяем конфигурацию nginx..."
nginx -t

echo -e "\n2️⃣ Проверяем наличие map директивы в nginx.conf..."
grep -n "map.*http_upgrade" /etc/nginx/nginx.conf || echo "❌ Map директива не найдена!"

echo -e "\n3️⃣ Проверяем конфигурацию сайта..."
cat /etc/nginx/sites-available/1337community.com | grep -A 10 "location /socket.io"

echo -e "\n4️⃣ Проверяем, слушает ли nginx порт 443..."
ss -tlnp | grep nginx

echo -e "\n5️⃣ Проверяем backend Socket.IO..."
cd /var/www/1337community.com/backend
grep -A 5 -B 5 "path:" server.js | grep -E "path:|transports:"

echo -e "\n6️⃣ Проверяем статус backend..."
pm2 status 1337-backend

echo -e "\n7️⃣ Проверяем последние логи backend..."
pm2 logs 1337-backend --lines 20 | grep -i "socket"

echo -e "\n8️⃣ Тестируем Socket.IO endpoint..."
curl -s https://1337community.com/socket.io/?EIO=4&transport=polling | head -c 100

echo -e "\n9️⃣ Проверяем HTTP/2 статус..."
grep -n "listen 443" /etc/nginx/sites-available/1337community.com

echo -e "\n🔟 Проверяем последние ошибки nginx..."
tail -n 30 /var/log/nginx/error.log | grep -E "websocket|socket.io|upgrade" || echo "Нет ошибок WebSocket в логах"

ENDSSH 