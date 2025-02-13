// backend/server.js
require('dotenv').config();
const express = require('express'); // [Строка 1: Подключение express]
const cors = require('cors');       // [Строка 2: Подключение cors]

const app = express();
const pool = require('./db');
const port = process.env.PORT || 3000;

// Middleware для обработки JSON и URL-кодированных данных
app.use(express.json());                       // [Строка 7]
app.use(express.urlencoded({ extended: true })); // [Строка 8]

// Включение CORS для разрешения запросов с других доменов
app.use(cors()); // [Строка 11]

// Тестовый маршрут для проверки работы сервера
app.get('/', (req, res) => {      // [Строка 14]
  res.send('Сервер запущен!');     // [Строка 15]
});

app.get('/testdb', async (req, res) => {
    try {
      const result = await pool.query('SELECT NOW()');
      res.json({ status: 'success', time: result.rows[0].now });
    } catch (err) {
      console.error(err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  
// Запуск сервера
app.listen(port, () => {          // [Строка 19]
  console.log(`Server listening on port ${port}`); // [Строка 20]
});
