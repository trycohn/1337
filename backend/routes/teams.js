const express = require('express');
const router = express.Router();
const pool = require('../db'); // Подключение к базе данных
const { authenticateToken, restrictTo } = require('../middleware/auth'); // Middleware для аутентификации и авторизации

// Получение списка всех команд
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM teams');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получение команд пользователя
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.query.userId || req.user.id;
    try {
        const result = await pool.query(
            'SELECT * FROM tournament_teams WHERE creator_id = $1',
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения команд:', err);
        res.status(500).json({ error: err.message });
    }
});

// Создание новой команды (доступно авторизованным пользователям)
router.post('/', authenticateToken, async (req, res) => {
    const { name, tournament_id } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO teams (name, tournament_id, captain_id) VALUES ($1, $2, $3) RETURNING *',
            [name, tournament_id, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновление команды (доступно капитану команды или администратору)
router.put('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        // Проверяем, является ли пользователь капитаном команды или администратором
        const teamCheck = await pool.query('SELECT captain_id FROM teams WHERE id = $1', [id]);
        if (teamCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }
        if (teamCheck.rows[0].captain_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Недостаточно прав' });
        }

        const result = await pool.query(
            'UPDATE teams SET name = $1 WHERE id = $2 RETURNING *',
            [name, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удаление команды (доступно капитану команды или администратору)
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Проверяем, является ли пользователь капитаном команды или администратором
        const teamCheck = await pool.query('SELECT captain_id FROM teams WHERE id = $1', [id]);
        if (teamCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }
        if (teamCheck.rows[0].captain_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Недостаточно прав' });
        }

        const result = await pool.query('DELETE FROM teams WHERE id = $1 RETURNING *', [id]);
        res.json({ message: 'Команда удалена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;