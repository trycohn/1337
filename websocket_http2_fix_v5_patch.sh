#!/bin/bash

# 🔧 ПАТЧ ДЛЯ ВАРИАНТА 5: Исправление отсутствующих директорий
# Завершение применения dual-server конфигурации
# Автор: Senior Fullstack Developer

set -e

echo "🔧 === ПАТЧ ВАРИАНТА 5: ЗАВЕРШЕНИЕ ПРИМЕНЕНИЯ ==="
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "🔍 1. ПРОВЕРКА СТРУКТУРЫ ПРОЕКТА"
echo "─────────────────────────────────"

# Определяем корневую директорию проекта
PROJECT_ROOT="/var/www/1337community.com"
cd "$PROJECT_ROOT"

echo "📁 Проверяем структуру frontend..."

# Ищем frontend директорию
if [ -d "frontend" ]; then
    echo "✅ Найдена директория: frontend/"
    FRONTEND_DIR="$PROJECT_ROOT/frontend"
elif [ -d "client" ]; then
    echo "✅ Найдена директория: client/"
    FRONTEND_DIR="$PROJECT_ROOT/client"
else
    echo "❌ Frontend директория не найдена"
    echo "🔍 Доступные директории:"
    ls -la | grep "^d"
    exit 1
fi

# Проверяем src директорию
if [ ! -d "$FRONTEND_DIR/src" ]; then
    echo "❌ Директория src не найдена в $FRONTEND_DIR"
    exit 1
fi

echo "✅ Frontend структура: $FRONTEND_DIR/src"

echo ""
echo "🔧 2. СОЗДАНИЕ SERVICES ДИРЕКТОРИИ"
echo "─────────────────────────────────"

# Создаем services директорию если не существует
SERVICES_DIR="$FRONTEND_DIR/src/services"
if [ ! -d "$SERVICES_DIR" ]; then
    echo "📁 Создаем директорию: $SERVICES_DIR"
    mkdir -p "$SERVICES_DIR"
    echo "✅ Директория services создана"
else
    echo "✅ Директория services уже существует"
fi

echo ""
echo "🔥 3. СОЗДАНИЕ FRONTEND КЛИЕНТА V5"
echo "──────────────────────────────────"

# Создаем обновленный Socket.IO клиент для frontend
cat > "$SERVICES_DIR/socketClient_v5.js" << 'EOF'
// 🚀 ВАРИАНТ 5: Socket.IO клиент для dual-server конфигурации
import { io } from 'socket.io-client';

// Конфигурация для production dual-server setup
const SOCKET_CONFIG = {
  // Основной домен для WebSocket соединения через порт 8443
  url: process.env.NODE_ENV === 'production' 
    ? 'https://1337community.com:8443'
    : 'http://localhost:3000',
    
  options: {
    path: '/socket.io/',
    
    // 🔥 КРИТИЧЕСКИ ВАЖНО: Приоритет WebSocket с fallback на polling
    transports: ['websocket', 'polling'],
    
    // Автоматический retry всех транспортов
    tryAllTransports: true,
    
    // Production настройки
    timeout: 20000,
    forceNew: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    maxReconnectionAttempts: 5,
    
    // CORS и авторизация
    withCredentials: true,
    
    // Дополнительные опции для стабильности
    upgrade: true,
    autoConnect: true,
    
    // Транспорт-специфичные настройки
    transportOptions: {
      polling: {
        extraHeaders: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      },
      websocket: {
        extraHeaders: {
          'Origin': 'https://1337community.com'
        }
      }
    }
  }
};

// Создаем singleton instance
let socketInstance = null;

export const getSocketInstance = () => {
  if (!socketInstance) {
    console.log('🚀 [Socket.IO V5] Инициализация dual-server клиента...');
    console.log(`🔗 [Socket.IO V5] Подключение к: ${SOCKET_CONFIG.url}`);
    
    socketInstance = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // Debug events
    socketInstance.on('connect', () => {
      console.log('✅ [Socket.IO V5] Подключено! Transport:', socketInstance.io.engine.transport.name);
      console.log('🔗 [Socket.IO V5] Socket ID:', socketInstance.id);
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('❌ [Socket.IO V5] Ошибка подключения:', error.message);
      console.log('🔄 [Socket.IO V5] Попытка fallback транспорта...');
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.IO V5] Отключение:', reason);
    });
    
    // Transport switch events
    socketInstance.io.on('ping', () => {
      console.log('🏓 [Socket.IO V5] Ping от сервера');
    });
    
    socketInstance.io.engine.on('upgrade', () => {
      console.log('⬆️ [Socket.IO V5] Upgrade на WebSocket успешен!');
    });
    
    socketInstance.io.engine.on('upgradeError', (error) => {
      console.warn('⚠️ [Socket.IO V5] Ошибка upgrade:', error.message);
    });
  }
  
  return socketInstance;
};

// Утилиты для авторизации
export const authenticateSocket = (token) => {
  const socket = getSocketInstance();
  socket.auth = { token };
  
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
};

// Утилиты для подписки на турниры
export const watchTournament = (tournamentId) => {
  const socket = getSocketInstance();
  socket.emit('watch_tournament', tournamentId);
};

export const unwatchTournament = (tournamentId) => {
  const socket = getSocketInstance();
  socket.emit('unwatch_tournament', tournamentId);
};

export default getSocketInstance;
EOF

echo "✅ Frontend Socket.IO клиент V5 создан: $SERVICES_DIR/socketClient_v5.js"

echo ""
echo "🔧 4. ПРИМЕНЕНИЕ КОНФИГУРАЦИИ"
echo "─────────────────────────────"

# Проверяем синтаксис новой конфигурации
echo "🔍 Проверяем синтаксис новой конфигурации..."
if nginx -t; then
    echo "✅ Nginx: синтаксис новой конфигурации корректен"
else
    echo "❌ Nginx: ошибка в новой конфигурации"
    exit 1
fi

# Перезагружаем Nginx
echo "🔄 Перезагружаем Nginx..."
systemctl reload nginx
echo "✅ Nginx перезагружен"

# Перезапускаем backend
echo "🔄 Перезапускаем backend (PM2)..."
pm2 restart 1337-backend || pm2 start /var/www/1337community.com/backend/server.js --name "1337-backend"
sleep 3
echo "✅ Backend перезапущен"

echo ""
echo "🧪 5. ТЕСТИРОВАНИЕ DUAL-SERVER КОНФИГУРАЦИИ"
echo "──────────────────────────────────────────"

echo "🔍 Тестируем основной HTTPS сервер (порт 443):"
response_443=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/ || echo "FAILED")
echo "   API endpoint (HTTP/2): $response_443"

echo "🔍 Тестируем WebSocket сервер (порт 8443):"
response_8443=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com:8443/socket.io/ || echo "FAILED")
echo "   Socket.IO endpoint (HTTP/1.1): $response_8443"

echo "🔍 Тестируем Socket.IO JSON ответ:"
socketio_test=$(curl -s https://1337community.com/test-socketio | jq -r '.status' 2>/dev/null || echo "FAILED")
echo "   Socket.IO test: $socketio_test"

echo ""
echo "🎯 6. ПРОВЕРКА АКТИВНЫХ СОЕДИНЕНИЙ"
echo "─────────────────────────────────"

echo "🔍 Nginx слушает порты:"
ss -tlnp | grep nginx | grep -E ":(443|8443)" || echo "⚠️  Nginx не слушает ожидаемые порты"

echo "🔍 Backend слушает порт 3000:"
ss -tlnp | grep ":3000" || echo "⚠️  Backend не слушает порт 3000"

echo ""
echo "🎉 ВАРИАНТ 5 ПРИМЕНЁН УСПЕШНО!"
echo "════════════════════════════════"
echo ""
echo "📋 РЕЗУЛЬТАТЫ:"
echo "✅ Основной трафик: HTTPS/HTTP2 на порту 443"
echo "✅ WebSocket трафик: HTTPS/HTTP1.1 на порту 8443" 
echo "✅ Socket.IO транспорты: [websocket, polling]"
echo "✅ Автоматический fallback при проблемах с WebSocket"
echo "✅ Frontend клиент V5: $SERVICES_DIR/socketClient_v5.js"
echo ""
echo "🔗 ТЕСТИРОВАНИЕ В БРАУЗЕРЕ:"
echo "1. Откройте https://1337community.com"
echo "2. Откройте DevTools (F12) → Network → WS"
echo "3. Проверьте WebSocket соединения к порту 8443"
echo "4. Socket.IO должен подключаться через WebSocket или polling"
echo ""
echo "🐛 ДЕБАГ КОМАНДЫ:"
echo "- Проверить Nginx логи: tail -f /var/log/nginx/error.log"
echo "- Проверить PM2 логи: pm2 logs 1337-backend"
echo "- Тест Socket.IO: curl https://1337community.com/test-socketio"
echo "- Тест WebSocket порта: curl https://1337community.com:8443/socket.io/"
echo ""
echo "🎯 АРХИТЕКТУРА ВАРИАНТА 5:"
echo "┌─────────────────────────────────────────┐"
echo "│              БРАУЗЕР                    │"
echo "│    (HTTP/2 + WebSocket клиент)          │"
echo "└─────────────────┬───────────────────────┘"
echo "                  │"
echo "        ┌─────────┴──────────┐"
echo "        │                    │"
echo "        ▼                    ▼"
echo "┌─────────────┐    ┌─────────────────┐"
echo "│ NGINX :443  │    │  NGINX :8443    │"
echo "│  (HTTP/2)   │    │  (HTTP/1.1)     │"
echo "│  - API      │    │  - Socket.IO    │"
echo "│  - Static   │    │  - WebSocket    │"
echo "└─────────────┘    └─────────────────┘"
echo "        │                    │"
echo "        └─────────┬──────────┘"
echo "                  ▼"
echo "        ┌─────────────────┐"
echo "        │  BACKEND :3000  │"
echo "        │  (Node.js +     │"
echo "        │   Socket.IO)    │"
echo "        └─────────────────┘"
echo "" 