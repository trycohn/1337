#!/bin/bash

echo "🔧 ИСПРАВЛЕНИЕ BACKEND SOCKET.IO"
echo "==============================="

echo "1. Проверка текущего статуса:"
pm2 list | grep 1337-backend

echo -e "\n2. Перезапуск backend с чистой загрузкой:"
pm2 restart 1337-backend

echo -e "\n3. Ожидание запуска..."
sleep 10

echo -e "\n4. Тест Socket.IO после перезапуска:"
curl -s "http://localhost:3000/socket.io/?EIO=4&transport=polling" | head -50

echo -e "\n5. Тест тестового endpoint:"
curl -s "http://localhost:3000/test-socketio"

echo -e "\n6. Логи backend (последние 10 строк):"
pm2 logs 1337-backend --lines 10 --nostream

echo -e "\n7. Тест через nginx:"
curl -s "https://1337community.com/socket.io/?EIO=4&transport=polling" | head -50

echo -e "\n✅ Диагностика Backend завершена" 
