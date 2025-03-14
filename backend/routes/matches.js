const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, restrictTo } = require('../middleware/auth');

// Получение списка всех матчей
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM matches');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создание нового матча (доступно организаторам и администраторам)
router.post('/', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { tournament_id, round, participant1_id, participant2_id } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO matches (tournament_id, round, participant1_id, participant2_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [tournament_id, round, participant1_id, participant2_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновление матча (например, запись результата)
router.put('/:id', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { winner_id, score } = req.body;
    try {
        const result = await pool.query(
            'UPDATE matches SET winner_id = $1, score = $2 WHERE id = $3 RETURNING *',
            [winner_id, score, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Матч не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удаление матча
router.delete('/:id', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM matches WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Матч не найден' });
        }
        res.json({ message: 'Матч удален' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;