const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        console.warn('Токен не предоставлен в запросе');
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Ошибка верификации токена:', err.message);
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        console.log('Токен верифицирован, пользователь:', user);
        req.user = user;
        next();
    });
};

// Получение всех турниров
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tournaments');
        console.log('Все турниры успешно загружены:', result.rows);
        res.json(result.rows || []);
    } catch (error) {
        console.error('Ошибка в /api/tournaments:', error.stack);
        res.status(500).json({ error: 'Ошибка сервера при загрузке турниров' });
    }
});

// Получение "моих" турниров с проверкой авторизации
router.get('/myTournaments', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Запрос турниров для user_id:', userId);

        const result = await pool.query(
            'SELECT * FROM tournaments WHERE user_id = $1',
            [userId]
        );
        console.log('Мои турниры успешно загружены:', result.rows);
        res.json(result.rows || []);
    } catch (error) {
        console.error('Ошибка в /api/tournaments/myTournaments:', error.stack);
        res.status(500).json({ error: 'Ошибка сервера при загрузке моих турниров' });
    }
});

// Создание нового турнира
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, description, game, type } = req.body;
        const userId = req.user.id;

        // Проверка обязательных полей
        if (!name || !game) {
            return res.status(400).json({ error: 'Название и игра обязательны' });
        }

        const result = await pool.query(
            `INSERT INTO tournaments (name, description, game, type, user_id, status, format, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             RETURNING *`,
            [name, description || null, game, type || 'solo', userId, 'pending', 'single_elimination']
        );

        console.log('Турнир успешно создан:', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при создании турнира:', error.stack);
        res.status(500).json({ error: 'Ошибка сервера при создании турнира' });
    }
});

module.exports = router;