require('dotenv').config({ path: __dirname + '/.env' });

console.log("🔍 Загруженный JWT_SECRET:", process.env.JWT_SECRET);
console.log("🔍 NODE_ENV:", process.env.NODE_ENV);

const express = require('express');
const pool = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const session = require('express-session');
const tournamentsRouter = require('./routes/tournaments');

const app = express();
const server = http.createServer(app);

// Настройка сессий
app.use(session({
    secret: process.env.JWT_SECRET || 'your_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Инициализация Passport
app.use(passport.initialize());
app.use(passport.session());

// Настройка Steam Strategy
passport.use(new SteamStrategy({
  returnURL: process.env.NODE_ENV === 'production'
      ? 'https://1337community.com/api/users/steam-callback'
      : 'http://localhost:3000/api/users/steam-callback',
  realm: process.env.NODE_ENV === 'production'
      ? 'https://1337community.com/'
      : 'http://localhost:3000/',
  apiKey: process.env.STEAM_API_KEY || 'YOUR_STEAM_API_KEY'
}, async (identifier, profile, done) => {
  console.log('SteamStrategy identifier:', identifier);
  console.log('SteamStrategy profile:', profile);
  const steamId = profile.id;
  try {
      const user = await pool.query('SELECT * FROM users WHERE steam_id = $1', [steamId]);
      console.log('SteamStrategy user check:', user.rows);
      if (user.rows.length > 0) {
          return done(null, user.rows[0]);
      }
      return done(null, { steamId });
  } catch (err) {
      console.error('SteamStrategy error:', err);
      return done(err);
  }
}));

passport.serializeUser((user, done) => {
    done(null, user.id || user.steamId);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await pool.query('SELECT * FROM users WHERE id = $1 OR steam_id = $2', [id, id]);
        done(null, user.rows[0] || { steamId: id });
    } catch (err) {
        done(err);
    }
});

// Настройка CORS для socket.io
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? ['https://1337community.com', 'https://www.1337community.com'] // Добавлен www
            : ['http://localhost:3001', 'http://127.0.0.1:5500', 'http://localhost:3000'],
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
        ? ['https://1337community.com', 'https://www.1337community.com'] // Добавлен www
        : ['http://localhost:3001', 'http://127.0.0.1:5500', 'http://localhost:3000'];
    const origin = req.headers.origin || 'https://1337community.com'; // Запасной вариант для продакшена
    console.log(`🔍 Обработка запроса: ${req.method} ${req.path} от ${origin}`);
    console.log(`🔍 Все заголовки запроса:`, req.headers); // Отладка заголовков
    console.log(`🔍 NODE_ENV на сервере: ${process.env.NODE_ENV}`); // Проверка окружения
    console.log(`🔍 Разрешённые origins: ${allowedOrigins}`); // Отладка списка origins
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        console.log(`✅ Origin ${origin} разрешён`);
    } else {
        console.log(`🚫 Origin ${origin} не разрешён`);
        return res.status(403).json({ error: 'Origin not allowed' });
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

app.use((req, res, next) => {
    console.log(`🔍 Входящий запрос: ${req.method} ${req.originalUrl}`);
    next();
});

app.use(express.json());

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

app.use('/api', (req, res) => {
    console.log(`404 для пути: ${req.path}`);
    res.status(404).json({ error: 'API маршрут не найден' });
});

app.use((req, res) => {
    console.log(`404 для пути: ${req.path}`);
    res.status(404).json({ error: 'Маршрут не найден' });
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