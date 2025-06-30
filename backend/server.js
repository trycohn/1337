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
const { serialize } = require('cookie');
const { createSocketServer } = require('./socketio-server');
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

// 🆕 Временный endpoint для изменения статуса турнира 59
app.get('/update-tournament-59-status', async (req, res) => {
    try {
        const pool = require('./db');
        
        // Проверяем текущий статус
        const current = await pool.query('SELECT id, name, status FROM tournaments WHERE id = 59');
        console.log('📊 Текущий статус турнира 59:', current.rows[0]);
        
        if (current.rows.length === 0) {
            return res.json({ status: 'error', message: 'Турнир 59 не найден' });
        }
        
        // Обновляем статус на 'active'
        const updated = await pool.query(
            'UPDATE tournaments SET status = $1 WHERE id = $2 RETURNING id, name, status', 
            ['active', 59]
        );
        
        console.log('✅ Статус турнира 59 изменен:', updated.rows[0]);
        res.json({ 
            status: 'success', 
            before: current.rows[0], 
            after: updated.rows[0] 
        });
        
    } catch (err) {
        console.error('❌ Ошибка изменения статуса:', err);
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
const modularTournamentsRouter = require('./routes/tournament'); // ✨ МОДУЛЬНЫЙ РОУТЕР V4.4.0
const tournamentsFixRouter = require('./routes/tournaments-fix'); // Исправленный роутер для критических fix'ов
const tournamentsLegacyRouter = require('./routes/tournaments'); // 💾 ЛЕГАСИ РОУТЕР (backup)
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
app.use('/api/games', gamesRouter);
app.use('/api/tournaments', modularTournamentsRouter); // 🥇 ПЕРВЫЙ приоритет: МОДУЛЬНАЯ АРХИТЕКТУРА V4.4.0
app.use('/api/tournaments', tournamentsFixRouter); // 🥈 ВТОРОЙ приоритет: исправленные endpoint'ы
app.use('/api/tournaments', tournamentsLegacyRouter); // 🥉 ТРЕТИЙ приоритет: легаси endpoint'ы (backup)
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

// 🚀 Инициализация нового Socket.IO сервера
console.log('🚀 [Socket.IO] Инициализация нового Socket.IO сервера...');
const io = createSocketServer(server);
app.set('io', io);
console.log('✅ [Socket.IO] Новый Socket.IO сервер запущен');

// Старые обработчики удалены - все в новом socketio-server.js

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
