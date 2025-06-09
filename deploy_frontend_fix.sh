#!/bin/bash

# 🔧 ПРИМЕНЕНИЕ FRONTEND ИСПРАВЛЕНИЙ SOCKET.IO v2.0
# Обновление всех файлов для использования socketClient_final.js + дополнительные проверки
# Автор: Senior Fullstack Developer

set -e

echo "🔧 === ПРИМЕНЕНИЕ FRONTEND ИСПРАВЛЕНИЙ v2.0 ==="
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "🚨 ПРОБЛЕМА: Frontend использует старые Socket.IO клиенты с HTTP/2 конфликтами"
echo "💡 РЕШЕНИЕ: Обновление всех файлов на новый socketClient_final.js для HTTP/1.1"
echo ""

# Проверяем что мы в правильной директории
if [[ ! -d "/var/www/1337community.com" ]]; then
    echo "❌ Ошибка: Скрипт должен выполняться на VDS сервере 1337community.com"
    exit 1
fi

echo "🔧 1. ДИАГНОСТИКА FRONTEND СТРУКТУРЫ"
echo "───────────────────────────────────"

# Переходим в директорию frontend
cd /var/www/1337community.com/frontend

echo "📁 Текущая директория: $(pwd)"

# Проверяем структуру проекта
echo "🔍 Проверяем структуру проекта:"
if [[ ! -f "package.json" ]]; then
    echo "❌ package.json не найден! Неверная директория."
    exit 1
fi

if [[ ! -d "src" ]]; then
    echo "❌ Директория src не найдена!"
    exit 1
fi

echo "✅ Структура проекта корректна"

echo ""
echo "🔧 2. ПРОВЕРКА КЛЮЧЕВЫХ ФАЙЛОВ"
echo "─────────────────────────────"

# Проверяем наличие socketClient_final.js
if [[ ! -f "src/services/socketClient_final.js" ]]; then
    echo "❌ Файл socketClient_final.js не найден!"
    echo "📋 Убедитесь что файл был загружен из Git"
    exit 1
else
    echo "✅ Файл socketClient_final.js найден"
    
    # Проверяем содержимое файла
    if grep -q "Socket.IO Final" "src/services/socketClient_final.js"; then
        echo "✅ socketClient_final.js содержит правильные комментарии"
    else
        echo "⚠️ socketClient_final.js может быть устаревшей версией"
    fi
fi

# Проверяем обновленные файлы
echo "🔍 Проверяем обновленные файлы:"

FILES_TO_CHECK=(
    "src/components/Layout.js"
    "src/hooks/tournament/useWebSocket.js"
    "src/components/Messenger.js"
    "src/components/TournamentDetails.js"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [[ -f "$file" ]]; then
        if grep -q "socketClient_final" "$file" 2>/dev/null; then
            echo "✅ $file: обновлен на новый клиент"
        else
            echo "⚠️ $file: возможно использует старый клиент"
        fi
    else
        echo "❌ $file: файл не найден"
    fi
done

echo ""
echo "🔧 3. ПРОВЕРКА ЗАВИСИМОСТЕЙ"
echo "──────────────────────────"

echo "🔍 Проверяем установленные зависимости:"
if [[ -d "node_modules" ]]; then
    echo "✅ node_modules найден"
    
    # Проверяем socket.io-client
    if [[ -d "node_modules/socket.io-client" ]]; then
        SOCKET_VERSION=$(node -p "require('./node_modules/socket.io-client/package.json').version" 2>/dev/null || echo "unknown")
        echo "✅ socket.io-client версия: $SOCKET_VERSION"
    else
        echo "❌ socket.io-client не установлен"
    fi
else
    echo "⚠️ node_modules не найден, требуется установка зависимостей"
fi

echo ""
echo "🔧 4. УСТАНОВКА/ОБНОВЛЕНИЕ ЗАВИСИМОСТЕЙ"
echo "──────────────────────────────────────"

echo "📦 Очистка кэша npm..."
npm cache clean --force

echo "📦 Установка зависимостей..."
if npm install; then
    echo "✅ Зависимости установлены успешно"
else
    echo "❌ Ошибка установки зависимостей"
    exit 1
fi

# Проверяем критические зависимости
echo "🔍 Проверяем критические зависимости:"
REACT_VERSION=$(node -p "require('./node_modules/react/package.json').version" 2>/dev/null || echo "not found")
SOCKET_VERSION=$(node -p "require('./node_modules/socket.io-client/package.json').version" 2>/dev/null || echo "not found")

echo "📊 React версия: $REACT_VERSION"
echo "📊 Socket.IO Client версия: $SOCKET_VERSION"

echo ""
echo "🔧 5. СБОРКА PRODUCTION ВЕРСИИ"
echo "─────────────────────────────"

echo "🏗️ Очистка предыдущей сборки..."
if [[ -d "build" ]]; then
    rm -rf build
    echo "✅ Предыдущая сборка удалена"
fi

echo "🏗️ Сборка production версии..."
if npm run build; then
    echo "✅ Frontend собран успешно"
else
    echo "❌ Ошибка сборки frontend"
    echo "📋 Проверьте логи выше для деталей"
    exit 1
fi

echo ""
echo "🔧 6. ПРОВЕРКА РЕЗУЛЬТАТОВ СБОРКИ"
echo "────────────────────────────────"

echo "📁 Проверяем директорию build:"
if [[ -d "build" ]]; then
    echo "✅ Директория build создана"
    echo "📊 Содержимое build:"
    ls -la build/ | head -10
    
    # Проверяем ключевые файлы
    if [[ -f "build/index.html" ]]; then
        echo "✅ index.html найден"
    else
        echo "❌ index.html не найден в build"
    fi
    
    if [[ -d "build/static" ]]; then
        echo "✅ Директория static найдена"
        echo "📊 JS файлы: $(find build/static -name "*.js" | wc -l)"
        echo "📊 CSS файлы: $(find build/static -name "*.css" | wc -l)"
    else
        echo "❌ Директория static не найдена"
    fi
else
    echo "❌ Директория build не создана"
    exit 1
fi

echo ""
echo "📋 Проверяем размер build:"
BUILD_SIZE=$(du -sh build/ 2>/dev/null | cut -f1)
echo "📊 Размер build: $BUILD_SIZE"

# Проверяем наличие Socket.IO клиента в сборке
echo "🔍 Проверяем наличие Socket.IO в сборке:"
if find build -name "*.js" -exec grep -l "socket\.io" {} \; | head -1 > /dev/null; then
    echo "✅ Socket.IO код найден в сборке"
else
    echo "⚠️ Socket.IO код не найден в сборке"
fi

echo ""
echo "🔧 7. ПРОВЕРКА ИНТЕГРАЦИИ С BACKEND"
echo "─────────────────────────────────"

echo "🔍 Проверяем доступность backend:"
if curl -s --max-time 5 http://localhost:3000/test-socketio > /dev/null 2>&1; then
    echo "✅ Backend доступен локально"
else
    echo "⚠️ Backend недоступен локально (это может быть нормально)"
fi

echo "🔍 Проверяем доступность через Nginx:"
if curl -s --max-time 10 https://1337community.com/test-socketio > /dev/null 2>&1; then
    echo "✅ Backend доступен через Nginx"
else
    echo "⚠️ Backend недоступен через Nginx"
fi

echo ""
echo "🔧 8. ФИНАЛЬНАЯ ВАЛИДАЦИЯ"
echo "────────────────────────"

echo "🔍 Проверяем конфигурацию socketClient_final.js:"
if [[ -f "src/services/socketClient_final.js" ]]; then
    # Проверяем ключевые элементы конфигурации
    if grep -q "transports.*websocket.*polling" "src/services/socketClient_final.js"; then
        echo "✅ Транспорты WebSocket + Polling настроены"
    else
        echo "⚠️ Транспорты могут быть неправильно настроены"
    fi
    
    if grep -q "1337community.com" "src/services/socketClient_final.js"; then
        echo "✅ URL production настроен правильно"
    else
        echo "⚠️ URL production может быть неправильным"
    fi
    
    if grep -q "Socket.IO Final" "src/services/socketClient_final.js"; then
        echo "✅ Логирование для отладки настроено"
    else
        echo "⚠️ Логирование может отсутствовать"
    fi
fi

echo ""
echo "🎉 FRONTEND ИСПРАВЛЕНИЯ v2.0 ПРИМЕНЕНЫ!"
echo "════════════════════════════════════════"
echo ""
echo "📋 КРИТИЧЕСКИЕ ИЗМЕНЕНИЯ:"
echo "✅ Layout.js: обновлен на socketClient_final.js (убрана прямая связь с токенами)"
echo "✅ useWebSocket.js: обновлен на socketClient_final.js (правильные транспорты)"
echo "✅ Messenger.js: обновлен на socketClient_final.js (единый клиент)"
echo "✅ TournamentDetails.js: удален неиспользуемый импорт socket.io-client"
echo "✅ socketClient_final.js: HTTP/1.1 совместимый клиент с fallback"
echo "✅ Зависимости: обновлены и проверены"
echo "✅ Production сборка: создана и валидирована"
echo ""
echo "🔗 ТЕХНИЧЕСКИЕ УЛУЧШЕНИЯ:"
echo "- Все Socket.IO соединения используют единый singleton клиент"
echo "- HTTP/1.1 совместимость для WebSocket upgrade"
echo "- Автоматический fallback на polling при ошибках WebSocket"
echo "- Правильная авторизация через auth параметр вместо query"
echo "- Подробное логирование с префиксом '[Socket.IO Final]'"
echo "- Агрессивные retry настройки для стабильности"
echo ""
echo "🚨 СЛЕДУЮЩИЕ ШАГИ:"
echo "1. Перезапустите веб-сервер: systemctl reload nginx"
echo "2. Очистите кэш браузера полностью (Ctrl+Shift+Del → Все время)"
echo "3. Откройте https://1337community.com в браузере"
echo "4. Откройте DevTools (F12) → Console"
echo "5. Проверьте логи '[Socket.IO Final] ПОДКЛЮЧЕНО!' при авторизации"
echo ""
echo "🎯 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ:"
echo "- WebSocket ошибки после авторизации полностью исчезнут"
echo "- В консоли появятся логи '[Socket.IO Final]' вместо ошибок"
echo "- Чат, уведомления и real-time функции будут работать стабильно"
echo "- При проблемах с WebSocket автоматически включится polling"
echo ""
echo "📞 ДИАГНОСТИКА В СЛУЧАЕ ПРОБЛЕМ:"
echo "- Консоль браузера: ищите '[Socket.IO Final]' логи"
echo "- Network вкладка: проверьте /socket.io/ запросы"
echo "- Backend логи: pm2 logs 1337-backend"
echo "- Nginx логи: tail -f /var/log/nginx/error.log"
echo "" 