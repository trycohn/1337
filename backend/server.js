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
const { authenticateToken, attachTournamentAccessChecker } = require('./middleware/auth');
const { updateActivity } = require('./middleware/activity');
const { broadcastTournamentUpdate } = require('./notifications');
const multer = require('multer');
const fs = require('fs');
const pool = require('./db');
const cron = require('node-cron');
const { cleanupOldDemos, getDemosStats } = require('./services/demoCleanupService');

// Создаем Express приложение
const app = express();
// Установка глобальной переменной для доступа из других модулей
global.app = app;

// Настройка trust proxy для работы за прокси-сервером (Nginx)
// Доверяем только первому прокси (Nginx на том же сервере)
app.set('trust proxy', 1);

// Создаем HTTP сервер на основе Express-приложения
const server = http.createServer(app);

// 🔎 Логирование всех HTTP-запросов к Socket.IO (handshake/polling/upgrade)
app.use((req, res, next) => {
  if (req.path && req.path.startsWith('/socket.io')) {
    const ua = req.headers['user-agent'] || '-';
    const up = req.headers['upgrade'] || '-';
    const conn = req.headers['connection'] || '-';
    const sid = (req.query && (req.query.sid || req.query.SID)) || '-';
    console.log(
      `[SOCKET.IO HTTP] ${req.method} ${req.originalUrl} status=? ua=${ua} upgrade=${up} connection=${conn} sid=${sid}`
    );
  }
  next();
});

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

// 🕒 Пуллинг внешней БД matchzy (только для матчей из лобби)
try {
  const matchzyPolling = require('./services/matchzyPollingService');
  matchzyPolling.start();
  // Однократная реконсиляция незаполненных матчей на старте (в т.ч. когда пуллинг выключен)
  setTimeout(() => {
    if (typeof matchzyPolling.reconcileUnmaterialized === 'function') {
      matchzyPolling.reconcileUnmaterialized(200).catch(() => {});
    }
  }, 5000);
} catch (e) {
  console.warn('⚠️ [matchzy-poll] Сервис пуллинга не запущен:', e.message);
}

// Настройка middleware в правильном порядке
app.use(helmet()); // Безопасность должна быть в начале
app.use(morgan('dev')); // Логгирование запросов
app.use(express.json()); // Парсинг JSON
app.use(express.urlencoded({ extended: true })); // Парсинг URL-encoded
app.use(cookieParser());
// Делаем доступным req.checkTournamentAccess для всех маршрутов
app.use(attachTournamentAccessChecker);

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
  /^\/api\/users\/profile\/\d+$/,  // Публичные профили пользователей
  /^\/api\/users\/steam$/,  // Steam OAuth
  /^\/api\/users\/faceit-login$/,  // FACEIT OAuth
  /^\/api\/users\/steam\/callback$/,  // Steam callback
  /^\/api\/users\/faceit-callback$/,  // FACEIT callback
  /^\/api\/matchzy\/match-end$/,  // MatchZy webhook (имеет свою проверку токена)
  /^\/testdb$/  // Тестовый маршрут
];

// Функция для проверки, является ли маршрут публичным
function isPublicRoute(path) {
  return publicRoutes.some(pattern => pattern.test(path));
}

// Маршруты, полностью исключенные из rate limiting
const excludedFromRateLimiting = [
  /^\/api\/tournaments($|\/)/,            // Все маршруты /api/tournaments, включая подпути
  /^\/api\/users\/me$/,                  // Профиль текущего пользователя (часто дергается фронтом)
  /^\/socket\.io(\/|$)/,                // Socket.IO (частые polling/websocket рукопожатия)
  /^\/uploads(\/|$)/,                    // Раздача загруженных файлов
  /^\/images\/maps(\/|$)/,              // Раздача карт
  /^\/static(\/|$)/,                     // CRA статика из build
  /^\/favicon\.(ico|png)$/               // Фавиконки
];

// Функция для проверки, исключен ли маршрут из rate limiting
function isExcludedFromRateLimiting(path) {
  return excludedFromRateLimiting.some(pattern => pattern.test(path));
}

// 🔒 Роут /lobby ЗАЩИЩЕН middleware serverAuth (только для CS2 серверов)
// Исключаем из rate limiting (серверы делают частые запросы)
excludedFromRateLimiting.push(/^\/lobby\//);

// Настройка лимита запросов - увеличенные значения под массовые подключения из одного IP (клуб/NAT)
const strictLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100000, // высокий лимит на IP
    validate: {
        trustProxy: true, // Разрешаем работу с доверенными прокси
        default: true, // Включаем остальные валидации
    },
    // Пропускаем публичные маршруты и исключенные из rate limiting
    skip: (req) => isPublicRoute(req.path) || isExcludedFromRateLimiting(req.path)
});
app.use(strictLimiter);

// Отдельный rate limiter для публичных маршрутов с повышенным лимитом
const publicRoutesLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100000, // высокий лимит для публичных маршрутов
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

// Прямая раздача изображений карт из исходной папки public (для загруженных в рантайме файлов)
app.use('/images/maps', express.static(path.join(__dirname, '../frontend/public/images/maps')));

// 🔒 Раздача сгенерированных JSON конфигов лобби (ТОЛЬКО для CS2 серверов)
const { protectMatchConfigs } = require('./middleware/serverAuth');
app.use('/lobby', protectMatchConfigs, express.static(path.join(__dirname, 'lobbies')));

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
const modularTournamentsRouter = require('./routes/tournament'); // 🎯 ЕДИНСТВЕННЫЙ АКТИВНЫЙ РОУТЕР (модульная архитектура v2.0)
const tournamentDraftsRouter = require('./routes/tournament-drafts'); // 🆕 API черновиков турниров (Wizard)
const tournamentTemplatesRouter = require('./routes/tournament-templates'); // 🆕 API шаблонов турниров (Wizard Step 1)
const tournamentPlayersRouter = require('./routes/tournamentPlayers');
const matchesRouter = require('./routes/matches');
const matchFeedbackRouter = require('./routes/matchFeedback'); // 🎮 Match Feedback система
const matchzyRouter = require('./routes/matchzy'); // 📊 MatchZy webhook
const detailedStatsRouter = require('./routes/stats'); // 📊 Детальная статистика API
const statisticsRouter = require('./routes/statistics');
const dotaStatsRouter = require('./routes/dotaStats');
const notificationsRouter = require('./routes/notifications');
const playerStatsRouter = require('./routes/playerStats');
const friendsRouter = require('./routes/friends');
const chatsRouter = require('./routes/chats');
const organizersRouter = require('./routes/organizers');
const adminRouter = require('./routes/admin');
const achievementsRouter = require('./routes/achievements'); // Роуты для системы достижений
// 🔗 СИСТЕМА РЕФЕРАЛЬНЫХ ПРИГЛАШЕНИЙ v1.0.0
const referralsRouter = require('./routes/referrals');
const statsRouter = require('./routes/stats'); // API для статистики платформы
const serversRouter = require('./routes/servers'); // 🖥️ Управление CS2 серверами и RCON
const demosRouter = require('./routes/demos'); // 🎬 Загрузка и раздача .dem файлов

// Маршруты API
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/tournaments', tournamentDraftsRouter); // 🆕 API черновиков турниров (ДОЛЖЕН БЫТЬ ПЕРЕД modularTournamentsRouter!)
app.use('/api/tournaments', modularTournamentsRouter); // 🎯 ЕДИНСТВЕННЫЙ АКТИВНЫЙ РОУТЕР (модульная архитектура v2.0)
app.use('/api/tournament-templates', tournamentTemplatesRouter); // 🆕 API шаблонов турниров (Wizard Step 1)
app.use('/api/tournamentPlayers', tournamentPlayersRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/matches', matchFeedbackRouter); // 🎮 Match Feedback endpoints
app.use('/api/matchzy', matchzyRouter); // 📊 MatchZy webhook
app.use('/api/demos', demosRouter); // 🎬 Demo files upload/download
app.use('/api/player-stats', detailedStatsRouter); // 📊 Детальная статистика игроков (новое)
app.use('/api/statistics', statisticsRouter);
app.use('/api/stats', statsRouter); // Маршрут для общей статистики платформы
app.use('/api/dota-stats', dotaStatsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/playerStats', playerStatsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/maps', mapsRouter);
app.use('/api/organizers', organizersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/achievements', achievementsRouter); // Подключаем систему достижений
// 🔗 РЕФЕРАЛЬНАЯ СИСТЕМА
app.use('/api/referrals', referralsRouter);
// 🖥️ CS2 СЕРВЕРЫ И RCON
app.use('/api/servers', serversRouter);

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
        
        // 🆕 Устанавливаем дефолтные аватары всем пользователям без аватара
        try {
            // Готовим папку и файл SVG (раздаётся через /uploads)
            const avatarsDir = path.join(__dirname, 'uploads/avatars/preloaded');
            fs.mkdirSync(avatarsDir, { recursive: true });
            const svgPath = path.join(avatarsDir, 'circle-user.svg');
            if (!fs.existsSync(svgPath)) {
                const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#9ca3af" d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm0 96c48.6 0 88 39.4 88 88s-39.4 88-88 88-88-39.4-88-88 39.4-88 88-88zm0 352c-59.6 0-112.7-26.3-149-67.5 18.5-37.3 55.7-62.5 99-62.5h100c43.3 0 80.5 25.2 99 62.5C368.7 429.7 315.6 456 256 456z"/></svg>';
                fs.writeFileSync(svgPath, svg, 'utf8');
            }
            // Значение по умолчанию в БД для новых пользователей
            await pool.query("ALTER TABLE users ALTER COLUMN avatar_url SET DEFAULT '/uploads/avatars/preloaded/circle-user.svg'");
            // Массово обновляем только пустые/некорректные значения
            await pool.query(
                "UPDATE users SET avatar_url = '/uploads/avatars/preloaded/circle-user.svg' " +
                "WHERE avatar_url IS NULL OR trim(avatar_url) = '' OR lower(avatar_url) IN ('null','undefined')"
            );
            console.log('✅ Дефолтные аватары назначены для пользователей без аватара');
        } catch (defaultAvatarErr) {
            console.error('⚠️ Не удалось назначить дефолтные аватары:', defaultAvatarErr.message);
        }
        
        // 🗑️ Запуск cron задачи для автоматической очистки демок
        console.log('⏰ [DemoCleanup] Настройка автоматической очистки демок (каждый день в 03:00)...');
        
        // Проверка статистики при запуске
        try {
            const stats = await getDemosStats();
            if (stats) {
                console.log('📊 [DemoCleanup] Текущая статистика демок:');
                console.log(`   Всего демок: ${stats.total_demos} (${stats.total_size_formatted})`);
                console.log(`   Старше 7 дней: ${stats.old_demos} (${stats.old_size_formatted})`);
            }
        } catch (statsError) {
            console.error('⚠️ [DemoCleanup] Ошибка получения статистики:', statsError.message);
        }
        
        // Запуск cron задачи: каждый день в 03:00
        cron.schedule('0 3 * * *', async () => {
            console.log('⏰ [DemoCleanup] Запуск по расписанию (03:00)');
            try {
                await cleanupOldDemos();
            } catch (cleanupError) {
                console.error('❌ [DemoCleanup] Ошибка при автоматической очистке:', cleanupError.message);
            }
        }, {
            timezone: "Europe/Moscow" // Московское время (UTC+3)
        });
        
        console.log('✅ [DemoCleanup] Автоматическая очистка настроена');
        
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
