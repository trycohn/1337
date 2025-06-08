#!/bin/bash

echo "🔍 Диагностика WebSocket проблемы..."

# 1. Проверяем конфигурацию nginx
echo "📋 Проверка конфигурации nginx..."
nginx -t

# 2. Проверяем текущую конфигурацию WebSocket в nginx
echo -e "\n📋 Текущая конфигурация WebSocket в nginx:"
grep -A 10 "location /socket.io/" /etc/nginx/sites-available/1337community.com

# 3. Проверяем, есть ли map директива
echo -e "\n📋 Проверка map директивы:"
grep -n "map \$http_upgrade" /etc/nginx/nginx.conf

# 4. Проверяем логи nginx
echo -e "\n📋 Последние ошибки nginx:"
tail -20 /var/log/nginx/error.log | grep -i "websocket\|upgrade"

# 5. Проверяем, слушает ли backend на правильном порту
echo -e "\n📋 Проверка портов backend:"
netstat -tlnp | grep :3000

# 6. Проверяем конфигурацию Socket.IO в backend
echo -e "\n📋 Конфигурация Socket.IO в server.js:"
grep -A 5 "const io = new Server" /var/www/1337community.com/backend/server.js

# 7. Тестируем Socket.IO endpoint
echo -e "\n📋 Тест Socket.IO endpoint:"
curl -s "https://1337community.com/socket.io/?EIO=4&transport=polling" | head -c 100

echo -e "\n✅ Диагностика завершена" 