require('dotenv').config({ path: __dirname + '/.env' });

console.log("🔍 Загруженный JWT_SECRET:", process.env.JWT_SECRET); // Проверяем загрузку переменной окружения

const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');

const app = express();

// Middleware для разбора JSON
app.use(express.json());

// Настройка CORS для разработки и продакшена
app.use(cors({
    origin: [
        'http://80.87.200.23/',
        'http://127.0.0.1:5500',
        'https://1337community.com',
        'http://localhost:3000' // Для разработки React на порту 3000
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true
}));

// Обслуживание статических файлов из папки build (React)
app.use(express.static(path.join(__dirname, '../frontend/build'), { cacheControl: false }));

// Middleware для обработки URL-кодированных данных
app.use(express.urlencoded({ extended: true }));

// Проверка соединения с базой данных
app.get('/testdb', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'success', time: result.rows[0].now });
    } catch (err) {
        console.error('Ошибка подключения к базе:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API-маршруты
app.use('/api/users', require('./routes/users'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/tournamentPlayers', require('./routes/tournamentPlayers'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/statistics', require('./routes/statistics'));

// Обработка 404 для API-маршрутов
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API маршрут не найден' });
});

// Catch-all для SPA (React Router)
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Общая обработка 404 для остальных маршрутов
app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Запуск сервера на указанном порту
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    // При старте проверяем подключение к базе данных
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Подключение к базе данных успешно');
    } catch (err) {
        console.error('❌ Ошибка подключения к базе данных:', err.message);
    }
});
