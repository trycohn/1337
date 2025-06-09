#!/bin/bash

echo "🔍 БЫСТРАЯ ДИАГНОСТИКА WEBSOCKET"
echo "================================"

# 1. Nginx статус и порты
echo "1. Nginx статус:"
systemctl status nginx --no-pager -l | head -5

echo -e "\n2. Порты nginx:"
ss -tlnp | grep nginx

echo -e "\n3. Backend порт 3000:"
ss -tlnp | grep :3000

# 4. Конфигурация /socket.io/
echo -e "\n4. Конфигурация Socket.IO в nginx:"
grep -A 10 "location /socket.io/" /etc/nginx/sites-available/1337community.com

# 5. Map директива
echo -e "\n5. Map директива:"
grep -A 3 -B 3 "map.*http_upgrade" /etc/nginx/nginx.conf

# 6. Тест локального backend
echo -e "\n6. Тест backend напрямую:"
curl -s http://localhost:3000/socket.io/?EIO=4&transport=polling | head -50

# 7. Тест через nginx
echo -e "\n7. Тест через nginx:"
curl -s https://1337community.com/socket.io/?EIO=4&transport=polling | head -50

# 8. Логи ошибок nginx
echo -e "\n8. Ошибки nginx (последние 10 строк):"
tail -10 /var/log/nginx/error.log

echo -e "\n✅ Диагностика завершена" 