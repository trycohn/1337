const express = require('express');
const router = express.Router();
const pool = require('../db'); // Подключение к базе данных
const jwt = require('jsonwebtoken'); // ✅ Убедились, что импорт единственный
const bcrypt = require('bcryptjs'); // Хэширование паролей
const authMiddleware = require('../middleware/authMiddleware');

require('dotenv').config(); // ✅ Загружаем переменные окружения

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("❌ Ошибка: JWT_SECRET не установлен в .env");
    process.exit(1); // Останавливаем сервер, если ключ не задан
}

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const userResult = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ status: 'error', message: 'Пользователь не найден' });
        }

        const user = userResult.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ status: 'error', message: 'Неверный пароль' });
        }

        // ✅ Теперь сервер использует переменную JWT_SECRET
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ status: 'success', token, userId: user.id });
    } catch (err) {
        console.error('Ошибка при входе:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});


// ✅ Эндпоинт для авторизации (логин пользователя)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
      const userResult = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);

      if (userResult.rows.length === 0) {
          return res.status(401).json({ status: 'error', message: 'Пользователь не найден' });
      }

      const user = userResult.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
          return res.status(401).json({ status: 'error', message: 'Неверный пароль' });
      }

      // ✅ Теперь сервер передаёт userId в ответе
      const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });

      res.json({ status: 'success', token, userId: user.id });
  } catch (err) {
      console.error('Ошибка при входе:', err);
      res.status(500).json({ status: 'error', message: err.message });
  }
});



router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
      // Проверяем, существует ли email
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
          return res.status(400).json({ status: 'error', message: 'Email уже зарегистрирован' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await pool.query(
          'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
          [username, email, hashedPassword]
      );

      const user = newUser.rows[0];
      const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });

      res.json({ status: 'success', token, userId: user.id });
  } catch (err) {
      console.error('Ошибка при регистрации:', err);
      res.status(500).json({ status: 'error', message: err.message });
  }
});



// ✅ Эндпоинт для проверки авторизации (получение данных о пользователе)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Пользователь не найден' });
    }

    res.json({ status: 'success', user: userResult.rows[0] });

  } catch (err) {
    console.error('Ошибка при получении данных пользователя:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
