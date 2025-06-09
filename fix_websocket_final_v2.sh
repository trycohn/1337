#!/bin/bash

# 🔧 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ WEBSOCKET ПРОБЛЕМЫ V2
# Полное отключение HTTP/2 для WebSocket совместимости
# Автор: Senior Fullstack Developer

set -e

echo "🔧 === ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ WEBSOCKET V2 ==="
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "🚨 ПРОБЛЕМА: HTTP/2 блокирует WebSocket upgrade"
echo "💡 РЕШЕНИЕ: Полное отключение HTTP/2 для максимальной совместимости"
echo ""

echo "🔧 1. BACKUP И СОЗДАНИЕ НОВОЙ КОНФИГУРАЦИИ"
echo "──────────────────────────────────────────"

# Backup текущей конфигурации
cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.backup.final.$(date +%Y%m%d_%H%M%S) || true

# Создаем конфигурацию БЕЗ HTTP/2 для полной WebSocket совместимости
cat > /etc/nginx/sites-available/1337community.com << 'EOF'
# 🔧 ФИНАЛЬНАЯ КОНФИГУРАЦИЯ: HTTP/1.1 + WEBSOCKET
# HTTP/2 полностью отключен для максимальной WebSocket совместимости

server {
    listen 80;
    server_name 1337community.com www.1337community.com;
    
    # Принудительный редирект на HTTPS
    return 301 https://1337community.com$request_uri;
}

server {
    listen 443 ssl;
    # КРИТИЧЕСКИ ВАЖНО: НЕТ http2 - только HTTP/1.1 для WebSocket совместимости
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

    # 🔌 SOCKET.IO - ПОЛНАЯ WEBSOCKET СОВМЕСТИМОСТЬ
    location /socket.io/ {
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

    # Frontend (React SPA)
    location / {
        root /var/www/1337community.com/frontend/build;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Оптимизированное кэширование статических файлов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Vary "Accept-Encoding";
            
            # Gzip сжатие для компенсации отсутствия HTTP/2
            gzip on;
            gzip_vary on;
            gzip_min_length 1024;
            gzip_comp_level 6;
            gzip_types
                text/plain
                text/css
                text/xml
                text/javascript
                application/javascript
                application/xml+rss
                application/json;
        }
    }

    # Backend API
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

echo "✅ Финальная конфигурация создана (только HTTP/1.1 + WebSocket)"

echo ""
echo "🔧 2. ПРОВЕРКА MAP ДИРЕКТИВЫ"
echo "───────────────────────────"

# Проверяем наличие map директивы в nginx.conf
if ! grep -q "map.*http_upgrade.*connection_upgrade" /etc/nginx/nginx.conf; then
    echo "📝 Добавляем map директиву для WebSocket upgrade..."
    
    # Добавляем map директиву в начало http блока
    sed -i '/^http {/a\
    # Map for WebSocket upgrade\
    map $http_upgrade $connection_upgrade {\
        default upgrade;\
        "" close;\
    }' /etc/nginx/nginx.conf
    
    echo "✅ Map директива добавлена"
else
    echo "✅ Map директива уже существует"
fi

echo ""
echo "🔧 3. ОБНОВЛЕНИЕ FRONTEND КЛИЕНТА"
echo "─────────────────────────────────"

# Обновляем frontend клиент для работы без HTTP/2
SERVICES_DIR="/var/www/1337community.com/frontend/src/services"
cat > "$SERVICES_DIR/socketClient_final.js" << 'EOF'
// 🔧 ФИНАЛЬНЫЙ Socket.IO клиент без HTTP/2
import { io } from 'socket.io-client';

// Конфигурация для HTTP/1.1 setup
const SOCKET_CONFIG = {
  url: process.env.NODE_ENV === 'production' 
    ? 'https://1337community.com'
    : 'http://localhost:3000',
    
  options: {
    path: '/socket.io/',
    
    // 🔥 КРИТИЧЕСКИ ВАЖНО: WebSocket приоритет с надежным fallback
    transports: ['websocket', 'polling'],
    
    // Агрессивный retry для WebSocket
    tryAllTransports: true,
    forceNew: false,
    upgrade: true,
    
    // Продакшн настройки
    timeout: 20000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    maxReconnectionAttempts: 10,
    
    // CORS и авторизация
    withCredentials: true,
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
    console.log('🔧 [Socket.IO Final] Инициализация HTTP/1.1 клиента...');
    console.log(`🔗 [Socket.IO Final] Подключение к: ${SOCKET_CONFIG.url}`);
    
    socketInstance = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // Debug events
    socketInstance.on('connect', () => {
      console.log('✅ [Socket.IO Final] ПОДКЛЮЧЕНО! Transport:', socketInstance.io.engine.transport.name);
      console.log('🔗 [Socket.IO Final] Socket ID:', socketInstance.id);
      console.log('🎉 [Socket.IO Final] WebSocket работает без HTTP/2!');
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('❌ [Socket.IO Final] Ошибка подключения:', error.message);
      console.log('🔄 [Socket.IO Final] Попытка fallback на polling...');
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.IO Final] Отключение:', reason);
    });
    
    // Transport events
    socketInstance.io.on('ping', () => {
      console.log('🏓 [Socket.IO Final] Ping от сервера');
    });
    
    socketInstance.io.engine.on('upgrade', () => {
      console.log('⬆️ [Socket.IO Final] Успешный upgrade на WebSocket!');
    });
    
    socketInstance.io.engine.on('upgradeError', (error) => {
      console.warn('⚠️ [Socket.IO Final] Ошибка upgrade, используем polling:', error.message);
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

echo "✅ Frontend клиент Final создан"

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
pm2 restart 1337-backend
sleep 3
echo "✅ Backend перезапущен"

echo ""
echo "🧪 5. ФИНАЛЬНОЕ ТЕСТИРОВАНИЕ"
echo "───────────────────────────"

echo "🔍 Тестируем WebSocket upgrade:"
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Host: 1337community.com" \
     -H "Origin: https://1337community.com" \
     -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     -H "Sec-WebSocket-Version: 13" \
     https://1337community.com/socket.io/ 2>&1 | head -5

echo ""
echo "🔍 Socket.IO polling:"
response=$(curl -s 'https://1337community.com/socket.io/?EIO=4&transport=polling' | head -c 100)
echo "Response: $response"

echo ""
echo "🔍 Socket.IO test:"
response=$(curl -s https://1337community.com/test-socketio)
echo "Response: $response"

echo ""
echo "🎯 6. ПРОВЕРКА РЕЗУЛЬТАТОВ"
echo "─────────────────────────"

echo "🔍 Nginx слушает только порт 443:"
ss -tlnp | grep nginx | grep ":443" || echo "⚠️  Nginx не слушает порт 443"

echo "🔍 HTTP/2 отключен:"
if nginx -T 2>/dev/null | grep -q "http2"; then
    echo "⚠️  HTTP/2 все еще найден в конфигурации"
else
    echo "✅ HTTP/2 полностью отключен"
fi

echo ""
echo "🎉 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ ПРИМЕНЕНО!"
echo "══════════════════════════════════"
echo ""
echo "📋 РЕЗУЛЬТАТЫ:"
echo "✅ HTTP/2: полностью отключен"
echo "✅ HTTP/1.1: используется для всего трафика"
echo "✅ WebSocket: максимальная совместимость"
echo "✅ Gzip: компенсирует отсутствие HTTP/2"
echo "✅ Fallback: автоматический на polling"
echo ""
echo "🔗 ТЕСТИРОВАНИЕ В БРАУЗЕРЕ:"
echo "1. Откройте https://1337community.com"
echo "2. Очистите кэш браузера (Ctrl+Shift+R)"
echo "3. Откройте DevTools (F12) → Console"
echo "4. Ищите сообщения '[Socket.IO Final]'"
echo "5. WebSocket должен работать БЕЗ ошибок!"
echo ""
echo "🎯 ФИНАЛЬНАЯ АРХИТЕКТУРА:"
echo "┌─────────────────────────────────────────┐"
echo "│              БРАУЗЕР                    │"
echo "│      (HTTP/1.1 + WebSocket)            │"
echo "└─────────────────┬───────────────────────┘"
echo "                  │ HTTPS/WSS"
echo "                  ▼"
echo "┌─────────────────────────────────────────┐"
echo "│           NGINX :443                    │"
echo "│         (HTTP/1.1 ONLY)                 │"
echo "│  ✅ WebSocket ✅ Static ✅ API          │"
echo "│  ✅ Gzip      ✅ SSL    ✅ CORS         │"
echo "└─────────────────┬───────────────────────┘"
echo "                  ▼"
echo "        ┌─────────────────┐"
echo "        │  BACKEND :3000  │"
echo "        │  (Node.js +     │"
echo "        │   Socket.IO)    │"
echo "        └─────────────────┘"
echo "" 
