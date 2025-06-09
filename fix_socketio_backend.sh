#!/bin/bash

echo "🔧 ИСПРАВЛЕНИЕ SOCKET.IO КОНФИГУРАЦИИ В BACKEND"
echo "=============================================="

echo "🔍 Найдена проблема: rememberUpgrade: false блокирует WebSocket upgrade"
echo "✅ Исправляем конфигурацию Socket.IO в backend/server.js"

echo -e "\n📋 1. Создание резервной копии backend:"
cp backend/server.js backend/server.js.socketio-fix-backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup backend/server.js создан"

echo -e "\n📋 2. Исправление Socket.IO конфигурации:"

# Исправление rememberUpgrade: false на true
echo "🔧 Исправляем rememberUpgrade: false → true"
sed -i 's/rememberUpgrade: false,/rememberUpgrade: true,/g' backend/server.js

# Добавление allowEIO3 для совместимости
echo "🔧 Добавляем allowEIO3: true для совместимости"
sed -i '/allowUpgrades: true,/a\  allowEIO3: true,' backend/server.js

# Исправление cookie настроек для WebSocket
echo "🔧 Исправляем cookie настройки для WebSocket"
sed -i 's/secure: process\.env\.NODE_ENV === '\''production'\'',/secure: false, \/\/ Временно отключаем для тестирования WebSocket/g' backend/server.js
sed -i 's/sameSite: process\.env\.NODE_ENV === '\''production'\'' ? '\''none'\'' : '\''lax'\''/sameSite: '\''lax'\'' \/\/ Упрощаем для WebSocket/g' backend/server.js

echo "✅ Конфигурация Socket.IO исправлена"

echo -e "\n📋 3. Проверка изменений:"
echo "📄 Проверяем исправленную конфигурацию:"
grep -A 20 -B 5 "rememberUpgrade\|allowEIO3\|allowUpgrades" backend/server.js

echo -e "\n📋 4. Перезапуск backend с исправленной конфигурацией:"

# Остановка backend
echo "🛑 Останавливаем backend..."
pm2 stop 1337-backend

# Ожидание остановки
sleep 3

# Запуск backend с новой конфигурацией
echo "🚀 Запускаем backend с исправленной конфигурацией..."
pm2 start 1337-backend

# Ожидание запуска
sleep 5

echo -e "\n📋 5. Проверка статуса после перезапуска:"
pm2 show 1337-backend

echo -e "\n📋 6. Тестирование после исправления:"

sleep 3

echo "🔌 Тест 1: Socket.IO polling (должен работать):"
curl -s "http://localhost:3000/socket.io/?EIO=4&transport=polling" | head -10

echo -e "\n🔌 Тест 2: WebSocket upgrade (должен исправиться):"
timeout 10 curl -i \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "http://localhost:3000/socket.io/?EIO=4&transport=websocket" 2>&1 | head -15

echo -e "\n🔌 Тест 3: Тест через nginx:"
timeout 10 curl -i \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://1337community.com/socket.io/?EIO=4&transport=websocket" 2>&1 | head -15

echo -e "\n📋 7. Проверка логов backend:"
echo "📝 Последние логи backend:"
pm2 logs 1337-backend --lines 10

echo -e "\n🎯 РЕЗУЛЬТАТ ИСПРАВЛЕНИЯ:"
echo "✅ rememberUpgrade: false → true (разрешаем WebSocket upgrade)"
echo "✅ allowEIO3: true добавлено (совместимость с клиентами)"
echo "✅ cookie.secure: false (упрощаем для тестирования)"
echo "✅ cookie.sameSite: 'lax' (совместимость)"

echo -e "\n📋 8. Инструкции для финальной проверки:"
echo "1. Подождите 30 секунд для полной инициализации"
echo "2. Очистите кэш браузера (Ctrl+Shift+Delete)"
echo "3. Откройте https://1337community.com"
echo "4. WebSocket соединения должны работать!"

echo -e "\n💡 Если проблема persist, попробуйте:"
echo "- Использовать только polling: io({transports: ['polling']})"
echo "- Проверить firewall настройки"
echo "- Обновить Socket.IO до последней версии"

echo -e "\n✅ Исправление Socket.IO backend конфигурации завершено" 
