#!/bin/bash

echo "🔧 ИСПРАВЛЕНИЕ NGINX PROXY_PASS ДЛЯ SOCKET.IO"
echo "=============================================="

echo "🔍 Проблема найдена: proxy_pass дублирует путь /socket.io/"
echo "❌ Сейчас: proxy_pass http://127.0.0.1:3000/socket.io/"
echo "✅ Должно быть: proxy_pass http://127.0.0.1:3000;"

echo -e "\n📋 1. Создание резервной копии:"
cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup создан"

echo -e "\n📋 2. Исправление конфигурации nginx:"

# Исправление proxy_pass для Socket.IO
sed -i 's|proxy_pass http://127.0.0.1:3000/socket.io/;|proxy_pass http://127.0.0.1:3000;|g' /etc/nginx/sites-available/1337community.com

echo "✅ proxy_pass исправлен с http://127.0.0.1:3000/socket.io/ на http://127.0.0.1:3000"

echo -e "\n📋 3. Проверка новой конфигурации:"
echo "📄 Проверка синтаксиса nginx:"
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация nginx синтаксически корректна"
    
    echo -e "\n📋 4. Применение изменений:"
    systemctl reload nginx
    echo "✅ Nginx перезагружен"
    
    echo -e "\n📋 5. Проверка исправленной конфигурации:"
    echo "📄 Новая конфигурация /socket.io/:"
    nginx -T 2>/dev/null | grep -A 10 -B 2 "location /socket.io/"
    
    echo -e "\n📋 6. Тестирование после исправления:"
    
    echo "🔌 Тест WebSocket upgrade через nginx (исправленный):"
    timeout 10 curl -i \
      -H "Connection: Upgrade" \
      -H "Upgrade: websocket" \
      -H "Sec-WebSocket-Version: 13" \
      -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
      "https://1337community.com/socket.io/?EIO=4&transport=websocket" 2>&1 | head -10
    
    echo -e "\n🔌 Тест Socket.IO polling (должен работать):"
    curl -s "https://1337community.com/socket.io/?EIO=4&transport=polling" | head -10
    
    echo -e "\n📋 7. Проверка логов после исправления:"
    echo "📝 Последние access логи nginx:"
    tail -5 /var/log/nginx/access.log
    
    echo -e "\n🎯 ИСПРАВЛЕНИЕ ПРИМЕНЕНО!"
    echo "✅ proxy_pass изменен с /socket.io/ на корень backend"
    echo "✅ Nginx перезагружен"
    echo "✅ Готово к тестированию в браузере"
    
else
    echo "❌ ОШИБКА в конфигурации nginx!"
    echo "🔄 Восстанавливаем backup..."
    cp /etc/nginx/sites-available/1337community.com.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/1337community.com
    echo "⚠️ Конфигурация восстановлена из backup"
fi

echo -e "\n📋 8. Инструкции для проверки в браузере:"
echo "1. Откройте https://1337community.com"
echo "2. Очистите кэш браузера (Ctrl+Shift+R)"
echo "3. Откройте DevTools (F12) → Console"
echo "4. WebSocket ошибки должны ИСЧЕЗНУТЬ"
echo "5. Должны появиться сообщения об успешном подключении Socket.IO"

echo -e "\n✅ Исправление nginx proxy_pass завершено" 
