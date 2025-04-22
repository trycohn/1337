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

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimiter = require('express-rate-limit');
const pool = require('./db');
const { authenticateSocket } = require('./notifications');
const { authenticateToken } = require('./middleware/auth');
const { updateActivity } = require('./middleware/activity');
const http = require('http');
const puppeteer = require('puppeteer');
const cookieParser = require('cookie-parser');
const WebSocket = require('ws');
const tournamentsRouter = require('./routes/tournaments');
const nodemailer = require('nodemailer');
const notifications = require('./notifications');
const { Server: SocketIOServer } = require('socket.io');
const { setupChatSocketIO } = require('./chat-socketio');

const app = express();
// Установка глобальной переменной для доступа из других модулей
global.app = app;

const server = http.createServer(app);

// Middleware для обработки CORS вручную
app.use((req, res, next) => {
  const allowedOrigins = process.env.NODE_ENV === 'production'
      ? ['https://1337community.com', 'https://www.1337community.com']
      : ['http://localhost:3001', 'http://127.0.0.1:5500', 'http://localhost:3000'];
  const origin = req.headers.origin || 'https://1337community.com';
  console.log(`🔍 Обработка запроса: ${req.method} ${req.path} от ${origin}`);
  console.log(`🔍 Все заголовки запроса:`, req.headers);
  console.log(`🔍 NODE_ENV на сервере: ${process.env.NODE_ENV}`);
  console.log(`🔍 Разрешённые origins: ${allowedOrigins}`);
  // Временно разрешаем любой origin для теста
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  console.log(`✅ Origin ${origin} разрешён (временная настройка)`);
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
      console.log(`🔍 Обработка preflight-запроса (OPTIONS) для ${req.path}`);
      return res.status(200).end();
  }
  next();
});

app.use((req, res, next) => {
    console.log(`🔍 Входящий запрос: ${req.method} ${req.originalUrl}`);
    next();
});

app.use(express.json());
app.use(cookieParser());

// Добавляем middleware для обновления активности пользователя после аутентификации
app.use((req, res, next) => {
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

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// API-маршруты
app.use('/api/users', require('./routes/users'));
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/teams', require('./routes/teams'));
app.use('/api/tournamentPlayers', require('./routes/tournamentPlayers'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/statistics', require('./routes/statistics'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/playerStats', require('./routes/playerStats'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/chats', require('./routes/chats'));

// Настройка WebSocket сервера уведомлений (используем режим noServer)
const wss = new WebSocket.Server({
  noServer: true
});

// Устанавливаю Socket.IO сервер для чата
const io = new SocketIOServer(server, {
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true }
});
setupChatSocketIO(io);

// Карта для хранения подключений пользователей
const connectedClients = new Map();
// Карта для хранения клиентов, просматривающих турниры (tournamentId -> [clients])
const tournamentClients = new Map();

wss.on('connection', (ws) => {
    console.log('🔌 Новый клиент подключился');

    // Обработка сообщений от клиента
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Обработка регистрации пользователя
            if (data.type === 'register' && data.userId) {
                connectedClients.set(data.userId, ws);
                console.log(`Клиент зарегистрирован для пользователя ${data.userId}`);
            }
            
            // Обработка регистрации просмотра турнира
            if (data.type === 'watch_tournament' && data.tournamentId) {
                ws.tournamentId = data.tournamentId;
                
                // Сохраняем клиента в списке наблюдателей за турниром
                if (!tournamentClients.has(data.tournamentId)) {
                    tournamentClients.set(data.tournamentId, new Set());
                }
                tournamentClients.get(data.tournamentId).add(ws);
                
                console.log(`Клиент начал просмотр турнира ${data.tournamentId}`);
            }
            
            // Обработка отписки от турнира
            if (data.type === 'unwatch_tournament' && data.tournamentId) {
                if (tournamentClients.has(data.tournamentId)) {
                    tournamentClients.get(data.tournamentId).delete(ws);
                    
                    // Удаляем пустые записи
                    if (tournamentClients.get(data.tournamentId).size === 0) {
                        tournamentClients.delete(data.tournamentId);
                    }
                }
                
                delete ws.tournamentId;
                console.log(`Клиент прекратил просмотр турнира ${data.tournamentId}`);
            }
        } catch (error) {
            console.error('Ошибка при обработке сообщения:', error);
        }
    });

    // Обработка отключения клиента
    ws.on('close', () => {
        console.log('🔌 Клиент отключился');
        // Удаляем отключившегося клиента из карты
        for (const [userId, client] of connectedClients.entries()) {
            if (client === ws) {
                connectedClients.delete(userId);
                console.log(`Пользователь ${userId} отключился`);
                break;
            }
        }
        
        // Удаляем клиента из списка наблюдателей за турниром
        if (ws.tournamentId && tournamentClients.has(ws.tournamentId)) {
            tournamentClients.get(ws.tournamentId).delete(ws);
            
            // Удаляем пустые записи
            if (tournamentClients.get(ws.tournamentId).size === 0) {
                tournamentClients.delete(ws.tournamentId);
            }
            
            console.log(`Клиент прекратил просмотр турнира ${ws.tournamentId} (отключение)`);
        }
    });
});

// Сохраняем WebSocket сервер в приложении для использования в других модулях
app.set('wss', wss);
app.set('connectedClients', connectedClients);
app.set('tournamentClients', tournamentClients);

// Настройка WebSocket для чата уже выполнена выше (chatWss)

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

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'https://1337community.com'], // Разрешенные источники для CORS
    credentials: true,
}));
app.use(express.json()); // Парсинг JSON в body
app.use(express.urlencoded({ extended: true })); // Парсинг URL-encoded в body

// Обслуживание статических файлов из папки uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Главный роут для проверки работы API
app.get('/', (req, res) => {
    res.json({ message: 'Сервер 1337 Community API работает!' });
});

// Настройка middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Настройка лимита запросов
const limiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100 // максимум 100 запросов на IP
});
app.use(limiter);

// Маршруты API
app.use('/api', (req, res) => {
    console.log(`404 для пути: ${req.path}`);
    res.status(404).json({ error: 'API маршрут не найден' });
});

// Обработка 404
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
server.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Успешное подключение к базе данных');
    } catch (err) {
        console.error('❌ Ошибка подключения к базе данных:', err.message);
    }
});

// Обработка WebSocket upgrade только для уведомлений
server.on('upgrade', (request, socket, head) => {
  try {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);

    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
      });
      return;
    }

    // Неизвестный путь для WebSocket
    socket.destroy();
  } catch (err) {
    socket.destroy();
  }
});