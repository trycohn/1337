const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

// Регистрация нового пользователя
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    // Проверка входных данных
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email и пароль обязательны' });
    }

    try {
        // Проверка уникальности username
        const usernameCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (usernameCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Имя пользователя уже занято' });
        }

        // Проверка уникальности email
        const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Email уже зарегистрирован' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, email, hashedPassword]
        );
        const newUser = result.rows[0];

        const token = jwt.sign(
            { id: newUser.id, role: newUser.role, username: newUser.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({ message: 'Пользователь создан', userId: newUser.id, token });
    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.status(500).json({ error: err.message });
    }
});

// Вход пользователя
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email и пароль обязательны' });
    }

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }
        const user = userResult.rows[0];

        if (!user.password_hash) {
            return res.status(500).json({ message: 'Хэш пароля пользователя не установлен. Обратитесь к администратору.' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token });
    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Получение данных текущего пользователя
router.get('/me', authenticateToken, async (req, res) => {
    try {
        console.log('Получение данных пользователя, req.user:', req.user);
        const result = await pool.query(
            'SELECT id, username, email, role FROM users WHERE id = $1',
            [req.user.id]
        );
        console.log('Результат запроса:', result.rows);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка в /me:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;