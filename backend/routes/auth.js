const express = require('express');              // [Строка 1]
const router = express.Router();                 // [Строка 2]
const pool = require('../db');                   // [Строка 3]
const bcrypt = require('bcrypt');                // [Строка 4]
const jwt = require('jsonwebtoken');             // [Строка 5]

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // [Строка 7]

// Эндпоинт регистрации пользователя
router.post('/register', async (req, res) => {      // [Строка 9]
  const { username, email, password } = req.body;    // [Строка 10]
  try {
    // Хэширование пароля
    const hashedPassword = await bcrypt.hash(password, 10); // [Строка 12]
    // Вставка нового пользователя в таблицу users
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at', // [Строка 15]
      [username, email, hashedPassword]
    );
    res.status(201).json({ status: 'success', user: result.rows[0] }); // [Строка 18]
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message }); // [Строка 22]
  }
});

// Эндпоинт для входа (login)
router.post('/login', async (req, res) => {         // [Строка 26]
  const { username, password } = req.body;           // [Строка 27]
  try {
    // Ищем пользователя по имени
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]); // [Строка 29]
    const user = result.rows[0];                     // [Строка 30]
    if (!user) {                                     // [Строка 31]
      return res.status(400).json({ status: 'error', message: 'Неверное имя пользователя или пароль' });
    }
    // Сравниваем введённый пароль с хэшированным паролем из БД
    const validPassword = await bcrypt.compare(password, user.password_hash); // [Строка 35]
    if (!validPassword) {                            // [Строка 36]
      return res.status(400).json({ status: 'error', message: 'Неверное имя пользователя или пароль' });
    }
    // Генерируем JWT токен (срок действия 1 час)
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' }); // [Строка 40]
    res.json({ status: 'success', token });          // [Строка 41]
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message }); // [Строка 45]
  }
});

module.exports = router;                           // [Строка 48]
