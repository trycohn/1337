#!/bin/bash

# 🔧 ИСПРАВЛЕНИЕ BACKEND SOCKET.IO КОНФИГУРАЦИИ
# Цель: Добавить fallback на polling если WebSocket не работает

echo "🔧 ИСПРАВЛЕНИЕ BACKEND SOCKET.IO КОНФИГУРАЦИИ"
echo "============================================="

echo ""
echo "🔍 1. ПРОВЕРКА ТЕКУЩЕЙ КОНФИГУРАЦИИ:"
echo "-----------------------------------"

# Переход в папку backend
cd /var/www/1337community.com/backend

# Проверка текущего файла server.js
echo "📄 Проверка server.js на Socket.IO конфигурацию:"
grep -n "socket.io" server.js || echo "❌ Socket.IO не найден в server.js"

echo ""
echo "🔧 2. СОЗДАНИЕ УЛУЧШЕННОЙ SOCKET.IO КОНФИГУРАЦИИ:"
echo "------------------------------------------------"

# Создаем backup текущего server.js
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup создан: server.js.backup.$(date +%Y%m%d_%H%M%S)"

# Создаем исправленный server.js с улучшенной Socket.IO конфигурацией
cat > socketio_config_patch.js << 'EOF'
// 🚀 УЛУЧШЕННАЯ SOCKET.IO КОНФИГУРАЦИЯ
// Добавить это в server.js после создания HTTP сервера

const { Server: SocketIOServer } = require('socket.io');

console.log('🔌 Инициализация Socket.IO сервера с расширенными настройками...');

const io = new SocketIOServer(server, {
    // ⚡ КРИТИЧНО: Поддержка всех транспортов
    transports: ['websocket', 'polling'],
    
    // 🔧 WebSocket fallback на polling
    upgrade: true,
    rememberUpgrade: false,
    
    // CORS настройки для WebSocket
    cors: {
        origin: [
            "https://1337community.com",
            "http://1337community.com",
            "https://www.1337community.com",
            "http://localhost:3000",
            "http://localhost:3001"
        ],
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Authorization", "Content-Type"]
    },
    
    // Настройки соединения
    pingTimeout: 60000,
    pingInterval: 25000,
    
    // Настройки для WebSocket
    allowEIO3: true,
    
    // Логирование (отключить в production)
    // allowRequest: (req, callback) => {
    //     console.log('🔍 Socket.IO: Incoming connection request');
    //     callback(null, true);
    // }
});

console.log('✅ Socket.IO сервер создан с транспортами:', ['websocket', 'polling']);

// 🔐 Middleware для авторизации
io.use(async (socket, next) => {
    try {
        console.log('🔍 Socket.IO: Авторизация соединения...');
        
        const token = socket.request._query?.token || socket.handshake.auth?.token;
        if (!token) {
            console.log('❌ Socket.IO: Токен не предоставлен');
            return next(new Error('Токен авторизации не предоставлен'));
        }

        console.log('🔍 Socket.IO: Проверка JWT токена...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        console.log('✅ Socket.IO: Пользователь авторизован:', decoded.username);
        socket.userId = decoded.id;
        socket.username = decoded.username;
        
        next();
    } catch (error) {
        console.log('❌ Socket.IO: Ошибка авторизации:', error.message);
        next(new Error('Ошибка авторизации'));
    }
});

// 📡 Обработка соединений
io.on('connection', (socket) => {
    console.log('✅ Socket.IO: Новое соединение установлено');
    console.log('🔍 Пользователь:', socket.username, 'ID:', socket.userId);
    console.log('🔍 Транспорт:', socket.conn.transport.name);
    
    // Подключение к комнате пользователя
    socket.join(`user_${socket.userId}`);
    console.log('🏠 Пользователь присоединился к комнате:', `user_${socket.userId}`);
    
    // Обработка смены транспорта
    socket.conn.on('upgrade', () => {
        console.log('⚡ Транспорт обновлен на:', socket.conn.transport.name);
    });
    
    // Обработка отключения
    socket.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO: Соединение закрыто:', reason);
        console.log('👤 Пользователь отключен:', socket.username);
    });
    
    // Присоединение к турниру
    socket.on('join-tournament', (tournamentId) => {
        try {
            const roomName = `tournament_${tournamentId}`;
            socket.join(roomName);
            console.log(`🏟️ Пользователь ${socket.username} присоединился к турниру ${tournamentId}`);
            
            // Подтверждение присоединения
            socket.emit('tournament-joined', { tournamentId, status: 'success' });
        } catch (error) {
            console.log('❌ Ошибка присоединения к турниру:', error.message);
            socket.emit('error', { message: 'Ошибка присоединения к турниру' });
        }
    });
    
    // Выход из турнира
    socket.on('leave-tournament', (tournamentId) => {
        try {
            const roomName = `tournament_${tournamentId}`;
            socket.leave(roomName);
            console.log(`🚪 Пользователь ${socket.username} покинул турнир ${tournamentId}`);
        } catch (error) {
            console.log('❌ Ошибка выхода из турнира:', error.message);
        }
    });
});

// 🌐 Глобальная обработка ошибок Socket.IO
io.engine.on('connection_error', (err) => {
    console.log('❌ Socket.IO connection_error:', err.req);
    console.log('❌ Код ошибки:', err.code);
    console.log('❌ Сообщение:', err.message);
    console.log('❌ Контекст:', err.context);
});

// Экспорт io для использования в других модулях
app.set('io', io);

console.log('✅ Socket.IO полностью инициализирован и готов к работе!');
console.log('🔌 Поддерживаемые транспорты: websocket, polling');
console.log('🌐 CORS настроен для 1337community.com');

EOF

echo "✅ Socket.IO конфигурация подготовлена"

echo ""
echo "🔧 3. ПРИМЕНЕНИЕ ИСПРАВЛЕНИЙ:"
echo "----------------------------"

echo "⚠️  ВНИМАНИЕ: Требуется ручное применение изменений"
echo ""
echo "📋 ИНСТРУКЦИИ:"
echo "1. Откройте файл server.js в редакторе"
echo "2. Найдите секцию Socket.IO (обычно после создания HTTP сервера)"
echo "3. Замените существующую конфигурацию Socket.IO на содержимое файла socketio_config_patch.js"
echo "4. Сохраните файл и перезапустите PM2"
echo ""
echo "📁 Файлы:"
echo "- Backup: server.js.backup.*"
echo "- Патч: socketio_config_patch.js"
echo ""
echo "🔄 После применения выполните:"
echo "pm2 restart 1337-backend"
echo "pm2 logs 1337-backend --follow"

echo ""
echo "🧪 4. ТЕСТОВЫЙ ENDPOINT ДЛЯ SOCKET.IO:"
echo "------------------------------------"

# Создаем дополнительный тестовый endpoint
cat > test_socketio_endpoint.js << 'EOF'
// 🧪 ДОПОЛНИТЕЛЬНЫЙ ТЕСТОВЫЙ ENDPOINT
// Добавить в routes секцию server.js

app.get('/test-socketio', (req, res) => {
    try {
        const io = req.app.get('io');
        
        if (!io) {
            return res.status(500).json({
                status: 'error',
                message: 'Socket.IO не инициализирован',
                timestamp: new Date().toISOString()
            });
        }
        
        const clientsCount = io.engine.clientsCount || 0;
        const transports = ['websocket', 'polling']; // поддерживаемые транспорты
        
        res.json({
            status: 'success',
            message: 'Socket.IO работает корректно',
            clientsCount: clientsCount,
            transports: transports,
            timestamp: new Date().toISOString(),
            version: require('socket.io/package.json').version
        });
        
    } catch (error) {
        console.log('❌ Ошибка тестового endpoint:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка Socket.IO сервера: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

console.log('✅ Тестовый endpoint /test-socketio зарегистрирован');
EOF

echo "✅ Тестовый endpoint подготовлен в файле test_socketio_endpoint.js"

echo ""
echo "🎯 СЛЕДУЮЩИЕ ШАГИ:"
echo "=================="
echo "1. Примените Socket.IO конфигурацию из socketio_config_patch.js в server.js"
echo "2. Добавьте тестовый endpoint из test_socketio_endpoint.js"
echo "3. Перезапустите backend: pm2 restart 1337-backend"
echo "4. Проверьте логи: pm2 logs 1337-backend --follow"
echo "5. Тестируйте: curl https://1337community.com/test-socketio"
echo ""
echo "🔍 ДИАГНОСТИКА:"
echo "- Если WebSocket не работает, Socket.IO автоматически переключится на polling"
echo "- Проверьте логи на сообщения о транспортах и соединениях"
echo "- В браузере DevTools должны появиться успешные socket.io запросы"

echo ""
echo "🎉 BACKEND ИСПРАВЛЕНИЯ ПОДГОТОВЛЕНЫ!"
echo "====================================" 