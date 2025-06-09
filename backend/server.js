const dotenv = require('dotenv');
const result = dotenv.config({ path: __dirname + '/.env' });

if (result.error) {
  console.error('❌ Ошибка загрузки .env файла:', result.error);
} else {
  console.log('✅ Файл .env успешно загружен');
}

console.log("🔍 Загруженный JWT_SECRET:", process.env.JWT_SECRET ? '[Установлен]' : '[Отсутствует]');
console.log("🔍 NODE_ENV:", process.env.NODE_ENV || '[Не указано]');
console.log("🔍 FACEIT_CLIENT_ID:", process.env.FACEIT_CLIENT_ID ? '[Установлен]' : '[Отсутствует]');
console.log("🔍 FACEIT_CLIENT_SECRET:", process.env.FACEIT_CLIENT_SECRET ? '[Установлен]' : '[Отсутствует]');
console.log("🔍 FACEIT_REDIRECT_URI:", process.env.FACEIT_REDIRECT_URI ? '[Установлен]' : '[Отсутствует]');

// Библиотеки и модули
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { Server: SocketIOServer } = require('socket.io');
const pool = require('./db');
const { setupChatSocketIO } = require('./chat-socketio');
const nodemailer = require('nodemailer');
const rateLimiter = require('express-rate-limit');
const { authenticateToken } = require('./middleware/auth');
const { updateActivity } = require('./middleware/activity');
const { broadcastTournamentUpdate } = require('./notifications');
const multer = require('multer');
const fs = require('fs');

// Создаем Express приложение
const app = express();
// Установка глобальной переменной для доступа из других модулей
global.app = app;

// Настройка trust proxy для работы за прокси-сервером (Nginx)
// Доверяем только первому прокси (Nginx на том же сервере)
app.set('trust proxy', 1);

// Создаем HTTP сервер на основе Express-приложения
const server = http.createServer(app);

// 🔌 Инициализация WebSocket сервера для real-time статистики
let realTimeStatsService = null;
try {
    console.log('🔌 [WEBSOCKET] Инициализация WebSocket сервера для real-time статистики...');
    console.log('🔌 [WEBSOCKET] NODE_ENV:', process.env.NODE_ENV);
    console.log('🔌 [WEBSOCKET] Порт сервера:', process.env.PORT || 3000);
    
    realTimeStatsService = require('./services/realTimeStatsService');
    realTimeStatsService.initialize(server).then(() => {
        console.log('✅ [WEBSOCKET] WebSocket сервер для статистики успешно инициализирован');
        console.log('✅ [WEBSOCKET] WebSocket endpoint: /ws/stats');
    }).catch((initError) => {
        console.error('❌ [WEBSOCKET] Ошибка инициализации WebSocket:', initError.message);
        console.error('❌ [WEBSOCKET] Stack trace:', initError.stack);
    });
} catch (error) {
    console.error('❌ [WEBSOCKET] WebSocket сервер недоступен, продолжаем без real-time обновлений:', error.message);
    console.error('❌ [WEBSOCKET] Причины: отсутствует модуль realTimeStatsService или ошибка инициализации');
    console.error('❌ [WEBSOCKET] Stack trace:', error.stack);
    console.warn('⚠️ [WEBSOCKET] Приложение будет работать в обычном режиме без real-time функций');
}

// Настройка middleware в правильном порядке
app.use(helmet()); // Безопасность должна быть в начале
app.use(morgan('dev')); // Логгирование запросов
app.use(express.json()); // Парсинг JSON
app.use(express.urlencoded({ extended: true })); // Парсинг URL-encoded
app.use(cookieParser());

// Middleware для логирования запросов
app.use((req, res, next) => {
    console.log(`🔍 Входящий запрос: ${req.method} ${req.originalUrl}`);
    next();
});

// Middleware для обработки CORS вручную
app.use((req, res, next) => {
  // Определяем разрешенные origins на основе NODE_ENV и домена запроса
  const productionOrigins = ['https://1337community.com', 'https://www.1337community.com'];
  const developmentOrigins = ['http://localhost:3001', 'http://127.0.0.1:5500', 'http://localhost:3000'];
  
  // Всегда включаем production origins для безопасности
  const allowedOrigins = [...productionOrigins, ...developmentOrigins];
  
  const origin = req.headers.origin;
  console.log(`🔍 Обработка запроса: ${req.method} ${req.path} от ${origin}`);
  console.log(`🔍 NODE_ENV на сервере: ${process.env.NODE_ENV}`);
  console.log(`🔍 Разрешённые origins: ${allowedOrigins.join(',')}`);
  
  // Проверяем, разрешен ли origin
  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    console.log(`✅ Origin ${origin} разрешён`);
  } else {
    console.log(`❌ Origin ${origin} НЕ разрешён`);
    res.setHeader('Access-Control-Allow-Origin', 'https://1337community.com'); // fallback на основной домен
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
      console.log(`🔍 Обработка preflight-запроса (OPTIONS) для ${req.path}`);
      return res.status(200).end();
  }
  next();
});

// Публичные маршруты API, не требующие аутентификации
const publicRoutes = [
  /^\/api\/maps($|\/)/,  // Маршруты /api/maps и /api/maps/:id
  /^\/api\/games($|\/)/,  // Маршруты /api/games и /api/games/:id
  /^\/api\/tournaments($|\/\d+$)/,  // Маршруты /api/tournaments и /api/tournaments/:id
  /^\/api\/tournaments\/\d+\/teams$/,  // Команды турнира
  /^\/api\/tournaments\/\d+\/original-participants$/,  // Оригинальные участники турнира
  /^\/api\/users\/login$/,  // Авторизация пользователей
  /^\/api\/users\/register$/,  // Регистрация пользователей
  /^\/api\/users\/steam$/,  // Steam OAuth
  /^\/api\/users\/faceit-login$/,  // FACEIT OAuth
  /^\/api\/users\/steam\/callback$/,  // Steam callback
  /^\/api\/users\/faceit-callback$/,  // FACEIT callback
  /^\/api\/v4\/achievements($|\/)/,  // V4 API: Достижения
  /^\/api\/v4\/enhanced-stats($|\/)/,  // V4 API: Расширенная статистика
  /^\/api\/v4\/leaderboards($|\/)/,  // V4 API: Лидерборды
  /^\/api\/v4\/user-achievements($|\/)/,  // V4 API: Достижения пользователя
  /^\/testdb$/  // Тестовый маршрут
];

// Функция для проверки, является ли маршрут публичным
function isPublicRoute(path) {
  return publicRoutes.some(pattern => pattern.test(path));
}

// Маршруты, полностью исключенные из rate limiting
const excludedFromRateLimiting = [
  /^\/api\/tournaments($|\/)/  // Все маршруты /api/tournaments, включая подпути
];

// Функция для проверки, исключен ли маршрут из rate limiting
function isExcludedFromRateLimiting(path) {
  return excludedFromRateLimiting.some(pattern => pattern.test(path));
}

// Настройка лимита запросов - более строгий лимит для неавторизованных запросов
const strictLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 500, // максимум 500 запросов на IP
    validate: {
        trustProxy: true, // Разрешаем работу с доверенными прокси
        default: true, // Включаем остальные валидации
    },
    // Пропускаем публичные маршруты и исключенные из rate limiting
    skip: (req) => isPublicRoute(req.path) || isExcludedFromRateLimiting(req.path)
});
app.use(strictLimiter);

// Отдельный rate limiter для публичных маршрутов с более высоким лимитом
const publicRoutesLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 1000, // максимум 1000 запросов на IP для публичных маршрутов
    validate: {
        trustProxy: true, // Разрешаем работу с доверенными прокси
        default: true, // Включаем остальные валидации
    },
    // Пропускаем маршруты, исключенные из rate limiting
    skip: (req) => isExcludedFromRateLimiting(req.path)
});

// Применяем лимитер только к публичным маршрутам, но не к исключенным
app.use((req, res, next) => {
    if (isPublicRoute(req.path) && !isExcludedFromRateLimiting(req.path)) {
        return publicRoutesLimiter(req, res, next);
    }
    next();
});

// Обслуживание статических файлов из папки frontend/build
app.use(express.static(path.join(__dirname, '../frontend/build'), { cacheControl: false }));

// Обслуживание статических файлов из папки uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Добавляем middleware для обновления активности пользователя после аутентификации
app.use((req, res, next) => {
  // Если маршрут публичный или метод OPTIONS, пропускаем проверку аутентификации
  if (req.method === 'OPTIONS' || isPublicRoute(req.path)) {
    return next();
  }

  // Проверяем наличие токена в заголовке Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    // Если токен есть, вызываем middleware для аутентификации и обновления активности
    return authenticateToken(req, res, () => {
      if (req.user) {
        updateActivity(req, res, next);
      } else {
        next();
      }
    });
  }
  next();
});

// Маршрут для иконок
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// Тестовый маршрут
app.get('/testdb', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'success', time: result.rows[0].now });
    } catch (err) {
        console.error('❌ Ошибка подключения к базе:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 🔧 Тестовый маршрут для Socket.IO
app.get('/test-socketio', (req, res) => {
    try {
        const io = req.app.get('io');
        if (!io) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'Socket.IO не инициализирован' 
            });
        }
        
        const clientsCount = io.engine.clientsCount;
        const engineTransports = io.engine.opts.transports;
        
        res.json({ 
            status: 'success',
            message: 'Socket.IO работает',
            clientsCount: clientsCount,
            transports: engineTransports,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Ошибка тестирования Socket.IO:', err);
        res.status(500).json({ 
            status: 'error', 
            message: err.message 
        });
    }
});

// Главный роут для проверки работы API
app.get('/', (req, res) => {
    res.json({ message: 'Сервер 1337 Community API работает!' });
});

// Импорт маршрутов
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const teamsRouter = require('./routes/teams');
const gamesRouter = require('./routes/games');
const mapsRouter = require('./routes/maps');
const tournamentsRouter = require('./routes/tournaments');
const tournamentsFixRouter = require('./routes/tournaments-fix'); // Исправленный роутер для критических fix'ов
const tournamentPlayersRouter = require('./routes/tournamentPlayers');
const matchesRouter = require('./routes/matches');
const statisticsRouter = require('./routes/statistics');
const dotaStatsRouter = require('./routes/dotaStats');
const notificationsRouter = require('./routes/notifications');
const playerStatsRouter = require('./routes/playerStats');
const friendsRouter = require('./routes/friends');
const chatsRouter = require('./routes/chats');
const organizersRouter = require('./routes/organizers');
const adminRouter = require('./routes/admin');
const achievementsRouter = require('./routes/achievements'); // Роуты для системы достижений
// ✨ V4 ULTIMATE: Импорт революционных API
const v4EnhancedStatsRouter = require('./routes/v4-enhanced-stats');

// Маршруты API
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/tournaments', tournamentsFixRouter); // ПЕРВЫЙ приоритет: исправленные endpoint'ы
app.use('/api/tournaments', tournamentsRouter); // ВТОРОЙ приоритет: основные endpoint'ы
app.use('/api/tournamentPlayers', tournamentPlayersRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/dota-stats', dotaStatsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/playerStats', playerStatsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/maps', mapsRouter);
app.use('/api/organizers', organizersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/achievements', achievementsRouter); // Подключаем систему достижений
// ✨ V4 ULTIMATE: Революционные API endpoints
app.use('/api/v4', v4EnhancedStatsRouter);

// Catch-all для SPA (React Router) - перенаправление на index.html
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Устанавливаю Socket.IO сервер для чата
console.log('🔌 [SOCKETIO] Инициализация Socket.IO сервера...');
console.log('🔌 [SOCKETIO] NODE_ENV:', process.env.NODE_ENV);
console.log('🔌 [SOCKETIO] Разрешенные origins:', [
  "https://1337community.com",
  "https://www.1337community.com", 
  "http://localhost:3000",
  "http://localhost:3001"
]);

const io = new SocketIOServer(server, {
  cors: {
    origin: [
      "https://1337community.com",
      "https://www.1337community.com",
      "http://localhost:3000",
      "http://localhost:3001"
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: "/socket.io/",
  transports: ['polling', 'websocket'],
  pingTimeout: 20000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6,
  allowUpgrades: true,
  allowEIO3: true,
  rememberUpgrade: false,
  cookie: {
    name: "io",
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  serveClient: false,
  httpCompression: true,
  perMessageDeflate: true,
  connectTimeout: 45000,
  allowRequest: (req, callback) => {
    console.log('🔍 [SOCKETIO] Engine Headers:', {
      headers: req.headers,
      url: req.url,
      method: req.method,
      remoteAddress: req.connection?.remoteAddress
    });
    
    callback(null, true);
  }
});

console.log('✅ [SOCKETIO] Socket.IO сервер создан');
console.log('✅ [SOCKETIO] Endpoint: /socket.io/');
console.log('✅ [SOCKETIO] Транспорты: polling, websocket');
console.log('✅ [SOCKETIO] PingTimeout:', 20000);
console.log('✅ [SOCKETIO] PingInterval:', 25000);

// 🔐 Middleware для авторизации Socket.IO соединений
console.log('🔐 [SOCKETIO] Настройка middleware авторизации Socket.IO...');
io.use(async (socket, next) => {
  try {
    console.log('🔍 [SOCKETIO] Попытка авторизации соединения');
    console.log('🔍 [SOCKETIO] Socket ID:', socket.id);
    console.log('🔍 [SOCKETIO] Client IP:', socket.handshake.address);
    console.log('🔍 [SOCKETIO] Headers:', JSON.stringify(socket.handshake.headers, null, 2));
    
    // ✅ ИСПРАВЛЕНИЕ: Проверяем токен в разных местах по приоритету
    let token = null;
    
    // 1. Из заголовка Authorization (самый надежный)
    if (socket.handshake.headers.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
        console.log('🔍 [SOCKETIO] Токен найден в заголовке Authorization');
      }
    }
    
    // 2. Из socket.handshake.auth (стандартный способ Socket.IO)
    if (!token && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
      console.log('🔍 [SOCKETIO] Токен найден в handshake.auth');
    }
    
    // 3. Из query параметров (fallback)
    if (!token && socket.handshake.query.token) {
      token = socket.handshake.query.token;
      console.log('🔍 [SOCKETIO] Токен найден в query параметрах');
    }
    
    if (!token) {
      console.log('❌ [SOCKETIO] Токен не найден во всех возможных местах');
      console.log('❌ [SOCKETIO] Handshake auth:', socket.handshake.auth);
      console.log('❌ [SOCKETIO] Handshake query:', socket.handshake.query);
      console.log('❌ [SOCKETIO] Headers authorization:', socket.handshake.headers.authorization);
      return next(new Error('Токен не предоставлен'));
    }

    console.log('🔍 [SOCKETIO] Проверяем JWT токен...');
    console.log('🔍 [SOCKETIO] Токен длина:', token.length);
    
    // Проверяем JWT токен
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log('🔍 [SOCKETIO] JWT успешно декодирован для пользователя:', decoded.id);
    console.log('🔍 [SOCKETIO] Ищем пользователя в базе данных...');
    
    // Проверяем пользователя в базе данных
    const result = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [decoded.id]);
    
    if (result.rows.length === 0) {
      console.log('⚠️ [SOCKETIO] Пользователь не найден в базе данных с ID:', decoded.id);
      return next(new Error('Пользователь не найден'));
    }

    // Присваиваем данные пользователя к сокету
    socket.userId = decoded.id;
    socket.user = result.rows[0];
    
    console.log(`✅ [SOCKETIO] Пользователь авторизован:`, {
      userId: decoded.id,
      username: decoded.username || result.rows[0].username,
      role: result.rows[0].role,
      socketId: socket.id
    });
    next();
  } catch (error) {
    console.error('❌ [SOCKETIO] Ошибка авторизации:', {
      message: error.message,
      stack: error.stack,
      socketId: socket.id,
      handshake: socket.handshake
    });
    next(new Error('Ошибка авторизации'));
  }
});

console.log('✅ [SOCKETIO] Middleware авторизации Socket.IO настроен');

// Инициализация чата через Socket.IO
console.log('🔌 [SOCKETIO] Инициализация чата через Socket.IO...');
try {
  setupChatSocketIO(io);
  console.log('✅ [SOCKETIO] Чат Socket.IO инициализирован');
} catch (error) {
  console.error('❌ [SOCKETIO] Ошибка инициализации чата Socket.IO:', {
    message: error.message,
    stack: error.stack
  });
}

// Устанавливаю экземпляр io в app для использования в маршрутах
app.set('io', io);
console.log('✅ [SOCKETIO] Socket.IO экземпляр установлен в app');

// Я настраиваю соединение для уведомлений через Socket.IO, чтобы пользователи автоматически подключались к своим комнатам
console.log('🔔 [SOCKETIO] Настройка обработчиков уведомлений Socket.IO...');
io.on('connection', (socket) => {
  const connectTime = new Date().toISOString();
  console.log('🎉 [SOCKETIO] НОВОЕ ПОДКЛЮЧЕНИЕ!', {
    userId: socket.userId,
    socketId: socket.id,
    connectTime: connectTime,
    transport: socket.conn.transport.name,
    clientIP: socket.handshake.address
  });
  
  socket.join(`user_${socket.userId}`);
  console.log(`✅ [SOCKETIO] Пользователь присоединился к комнате:`, {
    userId: socket.userId,
    room: `user_${socket.userId}`,
    socketId: socket.id
  });

  // Обработка подписки на обновления турнира (старый формат)
  socket.on('watch_tournament', (tournamentId) => {
    socket.join(`tournament_${tournamentId}`);
    console.log(`🎯 [SOCKETIO] Подписка на турнир (watch_tournament):`, {
      userId: socket.userId,
      tournamentId: tournamentId,
      room: `tournament_${tournamentId}`,
      socketId: socket.id
    });
  });

  // Обработка отписки от обновлений турнира (старый формат)
  socket.on('unwatch_tournament', (tournamentId) => {
    socket.leave(`tournament_${tournamentId}`);
    console.log(`👋 [SOCKETIO] Отписка от турнира (unwatch_tournament):`, {
      userId: socket.userId,
      tournamentId: tournamentId,
      room: `tournament_${tournamentId}`,
      socketId: socket.id
    });
  });

  // ✅ НОВЫЕ обработчики для socketClient_final (join-tournament/leave-tournament)
  socket.on('join-tournament', (tournamentId) => {
    socket.join(`tournament_${tournamentId}`);
    console.log(`🎯 [SOCKETIO] Присоединение к турниру (join-tournament):`, {
      userId: socket.userId,
      tournamentId: tournamentId,
      room: `tournament_${tournamentId}`,
      socketId: socket.id
    });
  });

  socket.on('leave-tournament', (tournamentId) => {
    socket.leave(`tournament_${tournamentId}`);
    console.log(`👋 [SOCKETIO] Покидание турнира (leave-tournament):`, {
      userId: socket.userId,
      tournamentId: tournamentId,
      room: `tournament_${tournamentId}`,
      socketId: socket.id
    });
  });
  
  // Обработка отключения
  socket.on('disconnect', (reason) => {
    const disconnectTime = new Date().toISOString();
    const connectionDuration = new Date() - new Date(connectTime);
    
    console.log(`👋 [SOCKETIO] ОТКЛЮЧЕНИЕ:`, {
      userId: socket.userId,
      socketId: socket.id,
      reason: reason,
      disconnectTime: disconnectTime,
      connectionDuration: `${Math.round(connectionDuration / 1000)}s`
    });
  });
  
  // Обработка ошибок
  socket.on('error', (error) => {
    console.error(`❌ [SOCKETIO] Ошибка сокета:`, {
      userId: socket.userId,
      socketId: socket.id,
      error: error.message,
      stack: error.stack
    });
  });
});

console.log('✅ [SOCKETIO] Обработчики уведомлений Socket.IO настроены');

// Глобальная обработка ошибок Socket.IO
io.engine.on('connection_error', (err) => {
  console.error('❌ [SOCKETIO] Connection Error:', {
    code: err.code,
    message: err.message,
    context: err.context,
    req: {
      method: err.req?.method,
      url: err.req?.url,
      headers: err.req?.headers,
      remoteAddress: err.req?.connection?.remoteAddress
    },
    timestamp: new Date().toISOString()
  });
});

// Дополнительные обработчики для Socket.IO Engine
io.engine.on('headers', (headers, req) => {
  console.log('🔍 [SOCKETIO] Engine Headers:', {
    headers: headers,
    url: req.url,
    method: req.method,
    remoteAddress: req.connection?.remoteAddress
  });
});

io.engine.on('connection', (socket) => {
  console.log('🔌 [SOCKETIO] Engine Connection:', {
    id: socket.id,
    transport: socket.transport.name,
    upgraded: socket.upgraded,
    readyState: socket.readyState,
    remoteAddress: socket.request.connection?.remoteAddress
  });
});

io.engine.on('disconnect', (socket) => {
  console.log('💔 [SOCKETIO] Engine Disconnect:', {
    id: socket.id,
    transport: socket.transport.name,
    reason: socket.closeCode
  });
});

console.log('✅ [SOCKETIO] Socket.IO полностью инициализирован и готов к работе!');

// Инициализация транспорта электронной почты и проверка соединения
const mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Проверка соединения с SMTP-сервером
if (process.env.NODE_ENV !== 'test') {
    mailTransporter.verify((error, success) => {
        if (error) {
            console.warn('ПРЕДУПРЕЖДЕНИЕ: Не удалось подключиться к SMTP-серверу:', error);
        } else {
            console.log('SMTP-сервер готов к отправке сообщений');
        }
    });
}

// Обработка 404 для остальных маршрутов (должна идти после всех других маршрутов)
app.use((req, res) => {
    console.log(`404 для пути: ${req.path}`);
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Internal Server Error" });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
const serverInstance = server.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Успешное подключение к базе данных');
        
        // Инициализируем системного пользователя при запуске сервера
        try {
            const { ensureSystemUser } = require('./utils/systemNotifications');
            await ensureSystemUser();
            console.log('✅ Системный пользователь 1337community инициализирован');
        } catch (systemUserError) {
            console.error('⚠️ Предупреждение: Не удалось инициализировать системного пользователя:', systemUserError.message);
        }
        
    } catch (err) {
        console.error('❌ Ошибка подключения к базе данных:', err.message);
    }
});

// Обработка ошибок запуска сервера
serverInstance.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Порт ${PORT} уже занят!`);
        console.error(`🔍 Возможные причины:`);
        console.error(`   1. Другой экземпляр 1337-backend уже запущен`);
        console.error(`   2. Другое приложение занимает порт ${PORT}`);
        console.error(`   3. PM2 запустил несколько экземпляров сервера`);
        console.error(`🛠️ Решения:`);
        console.error(`   1. Остановите все PM2 процессы: pm2 stop all`);
        console.error(`   2. Проверьте занятые порты: netstat -tulpn | grep :${PORT}`);
        console.error(`   3. Убейте процессы на порту: sudo kill -9 $(sudo lsof -t -i:${PORT})`);
        console.error(`   4. Или измените PORT в .env файле`);
        process.exit(1);
    } else {
        console.error('❌ Ошибка запуска сервера:', err);
        process.exit(1);
    }
});