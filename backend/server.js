// backend/server.js
require('dotenv').config({ path: __dirname + '/.env' });

console.log("🔍 Загруженный JWT_SECRET:", process.env.JWT_SECRET); // Проверяем загрузку

const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');

// Инициализация Express
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Подключение статических файлов (Frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// Middleware для обработки JSON и URL-кодированных данных
app.use(express.urlencoded({ extended: true }));

// Проверка соединения с базой данных
app.get('/testdb', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'success', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
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

/* ==========================
   🚀 ЗАПУСК СЕРВЕРА
   ========================== */
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
