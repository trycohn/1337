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
const pool = require('./db');
const http = require('http');
const puppeteer = require('puppeteer');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const tournamentsRouter = require('./routes/tournaments');
const nodemailer = require('nodemailer');

const app = express();
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

app.use('/api', (req, res) => {
    console.log(`404 для пути: ${req.path}`);
    res.status(404).json({ error: 'API маршрут не найден' });
});

app.use((req, res) => {
    console.log(`404 для пути: ${req.path}`);
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Настройка Socket.IO
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? ['https://1337community.com', 'https://www.1337community.com']
            : ['http://localhost:3001', 'http://127.0.0.1:5500', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
    },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    allowEIO3: true,
});

io.on('connection', (socket) => {
    console.log('🔌 Новый клиент подключился:', socket.id);
    socket.on('register', (userId) => {
        socket.join(userId);
        console.log(`Клиент ${socket.id} зарегистрирован для пользователя ${userId}`);
    });
    socket.on('disconnect', () => {
        console.log('🔌 Клиент отключился:', socket.id);
    });
});

app.set('io', io);

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