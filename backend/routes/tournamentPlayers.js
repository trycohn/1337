const express = require('express');
const router = express.Router();
const pool = require('../db'); // Подключение к базе данных
const { authenticateToken, restrictTo } = require('../middleware/auth'); // Middleware для аутентификации и авторизации

// Получение списка всех игроков турнира
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM players');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Добавление нового игрока в турнир (доступно организаторам и администраторам)
router.post('/', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { user_id, team_id, name, tournament_id } = req.body;
    try {
        // Проверка на обязательные поля
        if (!tournament_id) {
            return res.status(400).json({ message: 'Турнир не указан' });
        }

        // Если указан user_id, проверяем, существует ли пользователь
        if (user_id) {
            const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Пользователь не найден' });
            }
        }

        // Если указан team_id, проверяем, существует ли команда
        if (team_id) {
            const teamCheck = await pool.query('SELECT * FROM teams WHERE id = $1 AND tournament_id = $2', [team_id, tournament_id]);
            if (teamCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Команда не найдена или не принадлежит турниру' });
            }
        }

        // Добавляем игрока
        const result = await pool.query(
            'INSERT INTO players (user_id, team_id, name, tournament_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [user_id || null, team_id || null, name || null, tournament_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновление игрока турнира (доступно организаторам и администраторам)
router.put('/:id', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { team_id, name } = req.body;
    try {
        // Проверяем, существует ли игрок
        const playerCheck = await pool.query('SELECT * FROM players WHERE id = $1', [id]);
        if (playerCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Игрок не найден' });
        }

        // Обновляем игрока
        const result = await pool.query(
            'UPDATE players SET team_id = $1, name = $2 WHERE id = $3 RETURNING *',
            [team_id || null, name || null, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удаление игрока из турнира (доступно организаторам и администраторам)
router.delete('/:id', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM players WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Игрок не найден' });
        }
        res.json({ message: 'Игрок удален' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;