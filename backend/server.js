require('dotenv').config({ path: __dirname + '/.env' });

console.log("🔍 Загруженный JWT_SECRET:", process.env.JWT_SECRET); // Проверяем загрузку переменной окружения

const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');

const app = express();

// Middleware для разбора JSON и настройки CORS
app.use(express.json());
app.use(cors({
    origin: ['http://80.87.200.23/', 'http://127.0.0.1:5500', 'https://1337community.com'], // Точный адрес фронтенда
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Активные методы
    credentials: true
}));

// Подключение статических файлов (Frontend)
// Все файлы из папки '../frontend' будут отдаваться как статика
app.use(express.static(path.join(__dirname, '../frontend'), { cacheControl: false }));

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

app.use('/api/users', require('./routes/users'));


/* ==========================
   🔗 ПОДКЛЮЧЕНИЕ API МАРШРУТОВ
   ========================== */
// Все API маршруты должны быть объявлены до catch-all маршрута для SPA

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
app.use('/api/tournaments', bracketRoutes);

// Статистика турниров
const statisticsRoutes = require('./routes/statistics');
app.use('/api/statistics', statisticsRoutes);

// Обработка 404 для API маршрутов, если ни один из них не сработал
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API маршрут не найден' });
});



/* ==========================
   🚀 Catch-all для SPA
   ========================== */
// Для всех GET-запросов, не начинающихся с "/api", отдаем index.html.
// Это позволяет SPA-роутеру обрабатывать маршруты на клиенте.
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

/* ==========================
   ⚠️ Общая обработка 404 для остальных маршрутов
   ========================== */
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


