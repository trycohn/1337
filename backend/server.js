// server.js
require('dotenv').config({ path: __dirname + '/.env' });

console.log("🔍 Загруженный JWT_SECRET:", process.env.JWT_SECRET);

const express = require('express');
const pool = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const tournamentsRouter = require('./routes/tournaments'); // Убедись, что этот импорт есть

const app = express();
const server = http.createServer(app);

// Настройка CORS для socket.io
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? ['https://1337brackets-frontend-9xfz.vercel.app', 'https://1337brackets-frontend.vercel.app']
            : ['http://localhost:3001', 'http://127.0.0.1:5500'],
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
    },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    allowEIO3: true,
});

// Middleware для обработки CORS вручную
app.use((req, res, next) => {
    const allowedOrigins = process.env.NODE_ENV === 'production'
        ? ['https://1337brackets-frontend-9xfz.vercel.app', 'https://1337brackets-frontend.vercel.app']
        : ['http://localhost:3001', 'http://127.0.0.1:5500'];
    const origin = req.headers.origin;
    console.log(`🔍 Обработка запроса: ${req.method} ${req.path} от ${origin}`);
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        console.log(`🚫 Origin ${origin} не разрешён`);
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

// Middleware для Express
app.use(express.json());

// Тестовый маршрут для проверки подключения к базе данных
app.get('/testdb', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'success', time: result.rows[0].now });
    } catch (err) {
        console.error('❌ Ошибка подключения к базе:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Обработка favicon.ico и favicon.png
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

app.get('/favicon.png', (req, res) => {
    res.status(204).end();
});

// API-маршруты
app.use('/api/users', require('./routes/users'));
app.use('/api/tournaments', tournamentsRouter); // Убедись, что эта строка есть
app.use('/api/teams', require('./routes/teams'));
app.use('/api/tournamentPlayers', require('./routes/tournamentPlayers'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/statistics', require('./routes/statistics'));
app.use('/api/notifications', require('./routes/notifications'));

// Общий обработчик 404 для /api (после всех маршрутов)
app.use('/api', (req, res) => {
    console.log(`404 для пути: ${req.path}`);
    res.status(404).json({ error: 'API маршрут не найден' });
});

// Общий обработчик 404 для всех остальных путей
app.use((req, res) => {
    console.log(`404 для пути: ${req.path}`);
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Инициализация Socket.IO
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

// Экспортируем io для использования в других модулях
app.set('io', io);

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