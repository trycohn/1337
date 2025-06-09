#!/bin/bash

echo "🔍 ПОЛНАЯ ДИАГНОСТИКА WEBSOCKET ПРОБЛЕМ"
echo "======================================="

# 1. Проверка статуса nginx
echo -e "\n1️⃣ СТАТУС NGINX:"
systemctl status nginx --no-pager | head -10

# 2. Проверка портов и процессов
echo -e "\n2️⃣ ПОРТЫ И ПРОЦЕССЫ:"
echo "Nginx порты:"
ss -tlnp | grep nginx
echo -e "\nBackend (порт 3000):"
ss -tlnp | grep :3000
echo -e "\nPM2 процессы:"
pm2 list

# 3. Проверка nginx конфигурации
echo -e "\n3️⃣ КОНФИГУРАЦИЯ NGINX:"
echo "Основная конфигурация nginx.conf:"
grep -A 5 -B 5 "map.*http_upgrade" /etc/nginx/nginx.conf

echo -e "\nКонфигурация сайта:"
grep -A 20 "location /socket.io/" /etc/nginx/sites-available/1337community.com

echo -e "\nПроверка синтаксиса nginx:"
nginx -t

# 4. Тест Socket.IO endpoint напрямую
echo -e "\n4️⃣ ТЕСТ SOCKET.IO ENDPOINT:"
echo "Тест localhost:3000/socket.io/:"
curl -s http://localhost:3000/socket.io/?EIO=4&transport=polling | head -100

echo -e "\nТест через nginx (HTTP):"
curl -s http://1337community.com/socket.io/?EIO=4&transport=polling | head -100

echo -e "\nТест через nginx (HTTPS):"
curl -s https://1337community.com/socket.io/?EIO=4&transport=polling | head -100

# 5. Проверка SSL и HTTPS
echo -e "\n5️⃣ SSL И HTTPS:"
echo "SSL сертификаты:"
ls -la /etc/letsencrypt/live/1337community.com/
echo -e "\nТест HTTPS подключения:"
curl -I https://1337community.com/ 2>&1 | head -5

# 6. Логи nginx
echo -e "\n6️⃣ ЛОГИ NGINX (последние 20 строк):"
echo "Error log:"
tail -20 /var/log/nginx/error.log
echo -e "\nAccess log (последние попытки к /socket.io/):"
grep socket.io /var/log/nginx/access.log | tail -10

# 7. Проверка backend логов
echo -e "\n7️⃣ BACKEND ЛОГИ:"
pm2 logs 1337-backend --lines 20 --nostream

# 8. Проверка WebSocket заголовков
echo -e "\n8️⃣ ТЕСТ WEBSOCKET ЗАГОЛОВКОВ:"
echo "Тест WebSocket upgrade запроса:"
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" https://1337community.com/socket.io/?EIO=4&transport=websocket 2>&1 | head -10

# 9. Проверка активных включений
echo -e "\n9️⃣ АКТИВНЫЕ ВКЛЮЧЕНИЯ NGINX:"
echo "sites-enabled:"
ls -la /etc/nginx/sites-enabled/
echo -e "\nВключена ли конфигурация сайта в nginx.conf:"
grep -n "include.*sites-enabled" /etc/nginx/nginx.conf

# 10. Диагностика конфигурации nginx
echo -e "\n🔟 ДИАГНОСТИКА КОНФИГУРАЦИИ:"
echo "Все server блоки:"
grep -n "server {" /etc/nginx/sites-available/1337community.com
echo -e "\nListen директивы:"
grep -n "listen" /etc/nginx/sites-available/1337community.com
echo -e "\nHTTP/2 настройки:"
grep -n "http2" /etc/nginx/sites-available/1337community.com

# 11. Проверка firewall
echo -e "\n1️⃣1️⃣ FIREWALL:"
ufw status

# 12. Проверка системных ресурсов
echo -e "\n1️⃣2️⃣ СИСТЕМНЫЕ РЕСУРСЫ:"
free -h
df -h /

echo -e "\n✅ ДИАГНОСТИКА ЗАВЕРШЕНА"
echo "=======================================" 