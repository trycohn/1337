#!/bin/bash

echo "🔍 РАСШИРЕННАЯ ДИАГНОСТИКА WEBSOCKET UPGRADE СОЕДИНЕНИЙ"
echo "======================================================="

echo -e "\n📋 1. Тестирование реального WebSocket upgrade:"

# Тест реального WebSocket upgrade через nginx
echo "🔌 Тест WebSocket upgrade через nginx:"
timeout 10 curl -i \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://1337community.com/socket.io/?EIO=4&transport=websocket" 2>&1 | head -20

echo -e "\n🔌 Тест WebSocket upgrade напрямую к backend:"
timeout 10 curl -i \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "http://localhost:3000/socket.io/?EIO=4&transport=websocket" 2>&1 | head -20

echo -e "\n📋 2. Проверка SSL конфигурации для WebSocket:"

# Проверка SSL сертификата
echo "🔐 SSL сертификат 1337community.com:"
echo | openssl s_client -connect 1337community.com:443 -servername 1337community.com 2>/dev/null | openssl x509 -noout -dates -subject -issuer

# Проверка поддержки TLS версий
echo -e "\n🔐 Поддержка TLS версий:"
for version in tls1 tls1_1 tls1_2 tls1_3; do
    result=$(echo | timeout 5 openssl s_client -connect 1337community.com:443 -$version -quiet 2>&1)
    if [[ $? -eq 0 ]]; then
        echo "✅ $version: поддерживается"
    else
        echo "❌ $version: НЕ поддерживается"
    fi
done

echo -e "\n📋 3. Анализ Nginx конфигурации WebSocket:"

echo "📄 Проверка актуальной конфигурации nginx:"
nginx -T 2>/dev/null | grep -A 15 -B 5 "location /socket.io/"

echo -e "\n📄 Проверка map директивы для WebSocket:"
nginx -T 2>/dev/null | grep -A 3 -B 3 "connection_upgrade"

echo -e "\n📋 4. Проверка портов и процессов:"

echo "🌐 Открытые порты HTTPS:"
ss -tlnp | grep ":443"

echo -e "\n🔧 Процессы nginx:"
ps aux | grep nginx | grep -v grep

echo -e "\n📋 5. Логи nginx в реальном времени:"
echo "📝 Последние ошибки nginx:"
tail -20 /var/log/nginx/error.log

echo -e "\n📝 Последние access логи nginx:"
tail -10 /var/log/nginx/access.log

echo -e "\n📋 6. Тестирование через различные методы:"

# Тест с netcat
echo "🔌 Тест низкого уровня с netcat (localhost):"
echo -e "GET /socket.io/?EIO=4&transport=websocket HTTP/1.1\r\nHost: localhost:3000\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n" | timeout 5 nc localhost 3000 | head -10

echo -e "\n🔌 Тест низкого уровня с netcat (через nginx):"
echo -e "GET /socket.io/?EIO=4&transport=websocket HTTP/1.1\r\nHost: 1337community.com\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n" | timeout 5 nc 1337community.com 443 | head -10

echo -e "\n📋 7. Backend Socket.IO статус:"

echo "🔧 Backend Socket.IO тест:"
curl -s "http://localhost:3000/test-socketio" | jq . 2>/dev/null || curl -s "http://localhost:3000/test-socketio"

echo -e "\n🔧 Проверка backend логов на WebSocket ошибки:"
pm2 logs 1337-backend --lines 50 --nostream | grep -i "websocket\|upgrade\|connection"

echo -e "\n📋 8. Системная информация:"

echo "🐧 Версия системы:"
cat /etc/os-release | head -3

echo -e "\n🌐 Версия nginx:"
nginx -v

echo -e "\n📋 9. Рекомендации по исправлению:"

echo "🔧 ВОЗМОЖНЫЕ РЕШЕНИЯ:"
echo "1. Проверьте HTTP/2 в nginx - он может блокировать WebSocket"
echo "2. Убедитесь что SSL сертификат валиден для WebSocket"
echo "3. Проверьте правильность map директивы в nginx.conf"
echo "4. Возможно нужно добавить proxy_buffering off для WebSocket"
echo "5. Проверьте firewall правила для WebSocket соединений"

echo -e "\n✅ Диагностика WebSocket upgrade завершена" 
