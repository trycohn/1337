#!/bin/bash

echo "🔧 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ WEBSOCKET UPGRADE ЧЕРЕЗ SSL"
echo "===================================================="

echo "✅ Socket.IO polling работает"
echo "❌ WebSocket upgrade через SSL падает с 400 Bad Request"
echo "🎯 Исправляем SSL WebSocket конфигурацию"

echo -e "\n📋 1. Создание резервной копии:"
cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.websocket-backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup создан"

echo -e "\n📋 2. Анализ текущей проблемы:"
echo "🔍 Проверка WebSocket upgrade headers в конфигурации:"
nginx -T 2>/dev/null | grep -A 20 "location /socket.io/"

echo -e "\n📋 3. Применение улучшенной конфигурации для WebSocket SSL:"

# Создание улучшенной конфигурации
cat > /tmp/socketio_location.conf << 'EOF'
    # Socket.IO WebSocket location with SSL support
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific settings
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        
        # SSL WebSocket settings
        proxy_set_header X-Forwarded-Ssl on;
        proxy_redirect off;
        
        # Additional WebSocket headers for better compatibility
        proxy_set_header Sec-WebSocket-Protocol $http_sec_websocket_protocol;
        proxy_set_header Sec-WebSocket-Extensions $http_sec_websocket_extensions;
        proxy_set_header Sec-WebSocket-Key $http_sec_websocket_key;
        proxy_set_header Sec-WebSocket-Version $http_sec_websocket_version;
    }
EOF

echo "✅ Создана улучшенная конфигурация для WebSocket SSL"

echo -e "\n📋 4. Замена конфигурации Socket.IO location:"

# Удаление старой location /socket.io/ и вставка новой
sed -i '/# Socket\.IO WebSocket location/,/}/d' /etc/nginx/sites-available/1337community.com

# Найти место для вставки (после location / блока)
sed -i '/try_files \$uri \$uri\/ \/index\.html;/r /tmp/socketio_location.conf' /etc/nginx/sites-available/1337community.com

echo "✅ Конфигурация Socket.IO заменена"

echo -e "\n📋 5. Проверка и дополнение map директивы:"

# Проверяем наличие map директивы
if ! nginx -T 2>/dev/null | grep -q "map.*http_upgrade.*connection_upgrade"; then
    echo "⚠️ Map директива отсутствует, добавляем..."
    
    # Добавление map директивы в начало http блока
    sed -i '/^http {/a\\n    # WebSocket upgrade mapping\n    map $http_upgrade $connection_upgrade {\n        default upgrade;\n        '"'"''"'"' close;\n    }\n' /etc/nginx/nginx.conf
    
    echo "✅ Map директива добавлена"
else
    echo "✅ Map директива уже существует"
fi

echo -e "\n📋 6. Проверка syntax и применение:"

nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация nginx синтаксически корректна"
    
    systemctl reload nginx
    echo "✅ Nginx перезагружен с новой конфигурацией"
    
    echo -e "\n📋 7. Проверка новой конфигурации:"
    echo "📄 Обновленная конфигурация /socket.io/:"
    nginx -T 2>/dev/null | grep -A 25 "location /socket.io/"
    
    echo -e "\n📋 8. Тестирование WebSocket upgrade после исправления:"
    
    sleep 2
    
    echo "🔌 Тест 1: Socket.IO polling (должен работать):"
    curl -s "https://1337community.com/socket.io/?EIO=4&transport=polling" | head -10
    
    echo -e "\n🔌 Тест 2: WebSocket upgrade (должен улучшиться):"
    timeout 10 curl -i \
      -H "Connection: Upgrade" \
      -H "Upgrade: websocket" \
      -H "Sec-WebSocket-Version: 13" \
      -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
      -H "Sec-WebSocket-Protocol: socket.io" \
      "https://1337community.com/socket.io/?EIO=4&transport=websocket" 2>&1 | head -15
    
    echo -e "\n🔌 Тест 3: Прямое WebSocket соединение к backend:"
    timeout 10 curl -i \
      -H "Connection: Upgrade" \
      -H "Upgrade: websocket" \
      -H "Sec-WebSocket-Version: 13" \
      -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
      "http://localhost:3000/socket.io/?EIO=4&transport=websocket" 2>&1 | head -15
    
    echo -e "\n📋 9. Проверка логов после обновления:"
    echo "📝 Последние access логи:"
    tail -5 /var/log/nginx/access.log
    
    echo -e "\n📝 Последние error логи:"
    tail -5 /var/log/nginx/error.log
    
    echo -e "\n🎯 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ ПРИМЕНЕНО!"
    echo "✅ SSL WebSocket конфигурация обновлена"
    echo "✅ Дополнительные WebSocket headers добавлены"
    echo "✅ Таймауты увеличены для стабильности"
    echo "✅ Map директива проверена/добавлена"
    
else
    echo "❌ ОШИБКА в конфигурации nginx!"
    echo "🔄 Восстанавливаем backup..."
    cp /etc/nginx/sites-available/1337community.com.websocket-backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/1337community.com
    systemctl reload nginx
    echo "⚠️ Конфигурация восстановлена из backup"
fi

echo -e "\n📋 10. Инструкции для финальной проверки:"
echo "1. Очистите кэш браузера полностью (Ctrl+Shift+Delete)"
echo "2. Перезапустите браузер"
echo "3. Откройте https://1337community.com"
echo "4. Откройте DevTools (F12) → Console"
echo "5. WebSocket ошибки должны ИСЧЕЗНУТЬ"
echo "6. Socket.IO должен подключиться через WebSocket"

echo -e "\n💡 Если проблема persist:"
echo "- Проверьте firewall правила для WebSocket"
echo "- Убедитесь что backend Socket.IO настроен для WebSocket upgrade"
echo "- Рассмотрите использование только polling транспорта как workaround"

rm -f /tmp/socketio_location.conf

echo -e "\n✅ Финальное исправление WebSocket SSL завершено" 
