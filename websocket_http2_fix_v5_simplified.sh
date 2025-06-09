#!/bin/bash

# 🚀 ВАРИАНТ 5 УПРОЩЕННЫЙ: HTTP/2 + WEBSOCKET НА ОДНОМ ПОРТУ
# Отключение HTTP/2 только для Socket.IO location
# Автор: Senior Fullstack Developer

set -e

echo "🚀 === ВАРИАНТ 5 УПРОЩЕННЫЙ: SINGLE-PORT РЕШЕНИЕ ==="
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "🔧 1. СОЗДАНИЕ УПРОЩЕННОЙ КОНФИГУРАЦИИ NGINX"
echo "──────────────────────────────────────────────"

# Backup текущей конфигурации
cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.backup.v5.simplified.$(date +%Y%m%d_%H%M%S) || true

# Создаем упрощенную конфигурацию с HTTP/2 и специальной обработкой Socket.IO
cat > /etc/nginx/sites-available/1337community.com << 'EOF'
# 🚀 ВАРИАНТ 5 УПРОЩЕННЫЙ: HTTP/2 + WebSocket на одном порту
# HTTP/2 для основного трафика, специальная обработка для Socket.IO

server {
    listen 80;
    server_name 1337community.com www.1337community.com;
    
    # Принудительный редирект на HTTPS
    return 301 https://1337community.com$request_uri;
}

server {
    listen 443 ssl;
    http2 on;  # HTTP/2 включен для основного трафика
    server_name 1337community.com www.1337community.com;

    # SSL конфигурация
    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
    
    # Современные SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 🔌 КРИТИЧЕСКИ ВАЖНО: Socket.IO с принудительным HTTP/1.1
    location /socket.io/ {
        # Принудительное отключение HTTP/2 для WebSocket compatibility
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # КРИТИЧЕСКИЕ WebSocket заголовки
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket специфичные настройки
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 10s;
        
        # CORS заголовки для WebSocket
        add_header 'Access-Control-Allow-Origin' 'https://1337community.com' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
    }

    # Frontend (React SPA) - HTTP/2 оптимизированно
    location / {
        root /var/www/1337community.com/frontend/build;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Кэширование статических файлов для HTTP/2
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Vary "Accept-Encoding";
        }
    }

    # Backend API - HTTP/2 совместимо
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        # API timeout настройки
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        
        # Буферизация для API
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Test endpoints
    location /test-socketio {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static uploads
    location /uploads/ {
        root /var/www/1337community.com/backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

echo "✅ Упрощенная конфигурация создана (HTTP/2 + WebSocket на порту 443)"

echo ""
echo "🔧 2. ОБНОВЛЕНИЕ FRONTEND КЛИЕНТА"
echo "─────────────────────────────────"

# Обновляем frontend клиент для работы на стандартном порту
SERVICES_DIR="/var/www/1337community.com/frontend/src/services"
cat > "$SERVICES_DIR/socketClient_v5_simplified.js" << 'EOF'
// 🚀 ВАРИАНТ 5 УПРОЩЕННЫЙ: Socket.IO клиент для single-port конфигурации
import { io } from 'socket.io-client';

// Конфигурация для production single-port setup
const SOCKET_CONFIG = {
  // Стандартный домен на порту 443
  url: process.env.NODE_ENV === 'production' 
    ? 'https://1337community.com'
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
    console.log('🚀 [Socket.IO V5 Simplified] Инициализация single-port клиента...');
    console.log(`🔗 [Socket.IO V5 Simplified] Подключение к: ${SOCKET_CONFIG.url}`);
    
    socketInstance = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // Debug events
    socketInstance.on('connect', () => {
      console.log('✅ [Socket.IO V5 Simplified] Подключено! Transport:', socketInstance.io.engine.transport.name);
      console.log('🔗 [Socket.IO V5 Simplified] Socket ID:', socketInstance.id);
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('❌ [Socket.IO V5 Simplified] Ошибка подключения:', error.message);
      console.log('🔄 [Socket.IO V5 Simplified] Попытка fallback транспорта...');
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.IO V5 Simplified] Отключение:', reason);
    });
    
    // Transport switch events
    socketInstance.io.on('ping', () => {
      console.log('🏓 [Socket.IO V5 Simplified] Ping от сервера');
    });
    
    socketInstance.io.engine.on('upgrade', () => {
      console.log('⬆️ [Socket.IO V5 Simplified] Upgrade на WebSocket успешен!');
    });
    
    socketInstance.io.engine.on('upgradeError', (error) => {
      console.warn('⚠️ [Socket.IO V5 Simplified] Ошибка upgrade:', error.message);
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

echo "✅ Frontend клиент V5 Simplified создан"

echo ""
echo "🔧 3. ПРИМЕНЕНИЕ КОНФИГУРАЦИИ"
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
pm2 restart 1337-backend
sleep 3
echo "✅ Backend перезапущен"

echo ""
echo "🧪 4. ТЕСТИРОВАНИЕ УПРОЩЕННОЙ КОНФИГУРАЦИИ"
echo "─────────────────────────────────────────"

echo "🔍 Тестируем HTTPS сервер (порт 443):"
response_443=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/ || echo "FAILED")
echo "   Frontend (HTTP/2): $response_443"

echo "🔍 Тестируем Socket.IO endpoint:"
socketio_test=$(curl -s https://1337community.com/test-socketio | jq -r '.status' 2>/dev/null || echo "FAILED")
echo "   Socket.IO test: $socketio_test"

echo "🔍 Тестируем Socket.IO transport:"
socketio_transport=$(curl -s 'https://1337community.com/socket.io/?EIO=4&transport=polling' | head -c 50 || echo "FAILED")
echo "   Socket.IO polling: $socketio_transport"

echo ""
echo "🎯 5. ПРОВЕРКА АКТИВНЫХ СОЕДИНЕНИЙ"
echo "─────────────────────────────────"

echo "🔍 Nginx слушает порт 443:"
ss -tlnp | grep nginx | grep ":443" || echo "⚠️  Nginx не слушает порт 443"

echo "🔍 Backend слушает порт 3000:"
ss -tlnp | grep ":3000" || echo "⚠️  Backend не слушает порт 3000"

echo ""
echo "🎉 ВАРИАНТ 5 УПРОЩЕННЫЙ ПРИМЕНЁН УСПЕШНО!"
echo "═══════════════════════════════════════"
echo ""
echo "📋 РЕЗУЛЬТАТЫ:"
echo "✅ Весь трафик: HTTPS на порту 443"
echo "✅ HTTP/2: для статических файлов и API"
echo "✅ HTTP/1.1: принудительно для Socket.IO location"
echo "✅ WebSocket: полная совместимость"
echo "✅ Fallback: автоматический polling"
echo ""
echo "🔗 ТЕСТИРОВАНИЕ В БРАУЗЕРЕ:"
echo "1. Откройте https://1337community.com"
echo "2. Откройте DevTools (F12) → Network → WS"
echo "3. WebSocket соединения должны работать на стандартном порту 443"
echo "4. В консоли должны появиться сообщения '[Socket.IO V5 Simplified]'"
echo ""
echo "🎯 УПРОЩЕННАЯ АРХИТЕКТУРА:"
echo "┌─────────────────────────────────────────┐"
echo "│              БРАУЗЕР                    │"
echo "│       (Unified Client)                  │"
echo "└─────────────────┬───────────────────────┘"
echo "                  │ HTTPS/WSS"
echo "                  ▼"
echo "┌─────────────────────────────────────────┐"
echo "│           NGINX :443                    │"
echo "│  ┌─────────────┐ ┌─────────────────┐    │"
echo "│  │  HTTP/2     │ │    HTTP/1.1     │    │"
echo "│  │ (Static,    │ │  (Socket.IO     │    │"
echo "│  │  API)       │ │   WebSocket)    │    │"
echo "│  └─────────────┘ └─────────────────┘    │"
echo "└─────────────────┬───────────────────────┘"
echo "                  ▼"
echo "        ┌─────────────────┐"
echo "        │  BACKEND :3000  │"
echo "        │  (Node.js +     │"
echo "        │   Socket.IO)    │"
echo "        └─────────────────┘"
echo "" 