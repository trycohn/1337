require('dotenv').config({ path: __dirname + '/.env' });

console.log("🔍 Загруженный JWT_SECRET:", process.env.JWT_SECRET); // Проверяем загрузку

const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');

// Инициализация Express
const app = express();

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000', // Укажи точный адрес frontend
    credentials: true
}));

// Подключение статических файлов (Frontend)
app.use(express.static(path.join(__dirname, '../frontend'), { cacheControl: false })); // Отключаем кэш

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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

/* ==========================
   🔗 ПОДКЛЮЧЕНИЕ МАРШРУТОВ
   ========================== */

// Авторизация
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Турниры
const tournamentRoutes = require('./routes/tournaments');
app.use('/api/tournaments', tournamentRoutes);

// Команды
const teamRoutes = require('./routes/teams');
app.use('/api/teams', teamRoutes);

// Игроки в турнирах
const tournamentPlayersRoutes = require('./routes/tournamentPlayers');
app.use('/api/tournamentPlayers', tournamentPlayersRoutes);

// Матчи
const matchRoutes = require('./routes/matches');
app.use('/api/matches', matchRoutes);

// Генерация турнирной сетки
const bracketRoutes = require('./routes/brackets');
app.use('/api/brackets', bracketRoutes);

// Статистика турниров
const statisticsRoutes = require('./routes/statistics');
app.use('/api/statistics', statisticsRoutes);

// Обработка 404 для неизвестных маршрутов
app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

/* ==========================
   🚀 ЗАПУСК СЕРВЕРА
   ========================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    // Проверяем подключение к базе при старте
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Подключение к базе данных успешно');
    } catch (err) {
        console.error('❌ Ошибка подключения к базе данных:', err.message);
    }
});