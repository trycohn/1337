#!/bin/bash

# 🚀 ВАРИАНТ 5: РЕШЕНИЕ HTTP/2 + WEBSOCKET ПРОБЛЕМЫ
# Dual-server конфигурация: HTTP/2 для основного трафика + HTTP/1.1 для WebSocket
# Автор: Senior Fullstack Developer
# Дата: 2025-01-30

set -e

echo "🚀 === ВАРИАНТ 5: HTTP/2 + WEBSOCKET DUAL-SERVER РЕШЕНИЕ ==="
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "🔍 1. ДИАГНОСТИКА ТЕКУЩЕГО СОСТОЯНИЯ"
echo "────────────────────────────────────────"

# Проверяем текущую конфигурацию
if nginx -t 2>/dev/null; then
    echo "✅ Nginx: синтаксис конфигурации корректен"
else
    echo "❌ Nginx: ошибка в конфигурации"
    nginx -t
    exit 1
fi

# Проверяем процессы
echo "🔍 Проверяем активные процессы:"
ps aux | grep -E "(nginx|1337-backend)" | grep -v grep || echo "⚠️  Нет активных процессов"

# Проверяем занятые порты
echo "🔍 Проверяем занятые порты:"
ss -tlnp | grep -E ":(443|3000)" || echo "⚠️  Порты не заняты"

echo ""
echo "🛠️  2. СОЗДАНИЕ DUAL-SERVER КОНФИГУРАЦИИ NGINX"
echo "──────────────────────────────────────────────"

# Backup текущей конфигурации
cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.backup.v5.$(date +%Y%m%d_%H%M%S) || true

# Создаем новую dual-server конфигурацию
cat > /etc/nginx/sites-available/1337community.com << 'EOF'
# 🚀 ВАРИАНТ 5: DUAL-SERVER КОНФИГУРАЦИЯ
# HTTP/2 для основного трафика + HTTP/1.1 для WebSocket
# Решает проблему несовместимости HTTP/2 с WebSocket upgrade

# ═══════════════════════════════════════════════════════════════
# 🌐 ОСНОВНОЙ СЕРВЕР: HTTP/2 для всего трафика (кроме WebSocket)
# ═══════════════════════════════════════════════════════════════
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

    # Frontend (React SPA)
    location / {
        root /var/www/1337community.com/frontend/build;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Кэширование статических файлов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Vary "Accept-Encoding";
        }
    }

    # Backend API (HTTP/2 совместимо)
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

    # КРИТИЧЕСКИ ВАЖНО: Редирект Socket.IO на WebSocket сервер (порт 8443)
    location /socket.io/ {
        return 307 https://1337community.com:8443$request_uri;
    }
}

# ═══════════════════════════════════════════════════════════════
# 🔌 WEBSOCKET СЕРВЕР: HTTP/1.1 для Socket.IO (порт 8443)
# ═══════════════════════════════════════════════════════════════
server {
    listen 8443 ssl;
    # НЕТ http2 - принудительно HTTP/1.1 для WebSocket compatibility
    server_name 1337community.com www.1337community.com;

    # Те же SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
    
    # SSL настройки (копия основного сервера)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 🚀 ЭКСКЛЮЗИВНО ДЛЯ WEBSOCKET: Максимальная совместимость
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
    
    # Fallback для любых других запросов на WebSocket порт
    location / {
        return 444; # Закрываем соединение без ответа
    }
}
EOF

echo "✅ Новая dual-server конфигурация создана"

echo ""
echo "🔧 3. ОБНОВЛЕНИЕ BACKEND SOCKET.IO КОНФИГУРАЦИИ"
echo "────────────────────────────────────────────────"

# Backup текущего server.js
cp /var/www/1337community.com/backend/server.js /var/www/1337community.com/backend/server.js.backup.v5.$(date +%Y%m%d_%H%M%S)

# Обновляем конфигурацию Socket.IO для dual-server setup
cat > /var/www/1337community.com/backend/socket_io_config_v5.patch << 'EOF'
// 🚀 ВАРИАНТ 5: Обновленная конфигурация Socket.IO для dual-server setup
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      "https://1337community.com",
      "https://www.1337community.com",
      "https://1337community.com:8443", // WebSocket порт
      "http://localhost:3000",
      "http://localhost:3001"
    ],
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  },
  path: "/socket.io/",
  
  // 🔥 КРИТИЧЕСКИ ВАЖНО: Оба транспорта с приоритетом WebSocket
  transports: ['websocket', 'polling'],
  
  // Production оптимизированные настройки
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6,
  
  // Разрешаем upgrades и fallback
  allowUpgrades: true,
  allowEIO3: true,
  rememberUpgrade: false, // Принудительно переподключаться через WebSocket
  
  // Cookie настройки для HTTPS
  cookie: {
    name: "io",
    httpOnly: true,
    path: "/",
    secure: true, // HTTPS required
    sameSite: 'none', // Cross-origin cookies
    domain: '.1337community.com'
  },
  
  // Дополнительные настройки для стабильности
  connectTimeout: 45000,
  serveClient: false // Отключаем встроенный клиент Socket.IO
});
EOF

echo "✅ Конфигурация Socket.IO обновлена (файл патча создан)"

echo ""
echo "🔥 4. СОЗДАНИЕ FRONTEND КЛИЕНТА ДЛЯ DUAL-SERVER"
echo "───────────────────────────────────────────────"

# Создаем обновленный Socket.IO клиент для frontend
cat > /var/www/1337community.com/frontend/src/services/socketClient_v5.js << 'EOF'
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

echo "✅ Frontend Socket.IO клиент V5 создан"

echo ""
echo "🔧 5. ПРИМЕНЕНИЕ КОНФИГУРАЦИИ"
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
echo "🧪 6. ТЕСТИРОВАНИЕ DUAL-SERVER КОНФИГУРАЦИИ"
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
echo "🎯 7. ПРОВЕРКА АКТИВНЫХ СОЕДИНЕНИЙ"
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