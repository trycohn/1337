require('dotenv').config({ path: __dirname + '/.env' });

console.log("🔍 Загруженный JWT_SECRET:", process.env.JWT_SECRET);

const express = require('express');
const cors = require('cors');
const pool = require('./db');
const http = require('http');
const { initializeSocket } = require('./notifications'); // Импорт из нового модуля
const tournamentsRouter = require('./routes/tournaments');

const app = express();
const server = http.createServer(app);

// Инициализация Socket.IO через модуль notifications
initializeSocket(server);

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3001', 'http://127.0.0.1:5500'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
}));

// Тест подключения к базе данных
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
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/teams', require('./routes/teams'));
app.use('/api/tournamentPlayers', require('./routes/tournamentPlayers'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/statistics', require('./routes/statistics'));
app.use('/api/notifications', require('./routes/notifications'));

// Общий обработчик 404 для /api (после всех маршрутов)
app.use('/api', (req, res) => {
  console.log(`404 для пути: ${req.path}`); // Отладка
  res.status(404).json({ error: 'API маршрут не найден' });
});

// Общий обработчик 404 для всех остальных путей
app.use((req, res) => {
  console.log(`404 для пути: ${req.path}`); // Отладка
  res.status(404).json({ error: 'Маршрут не найден' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Подключение к базе данных успешно');
  } catch (err) {
    console.error('❌ Ошибка подключения к базе данных:', err.message);
  }
});