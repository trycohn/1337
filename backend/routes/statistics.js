const express = require('express');
const router = express.Router();
const pool = require('../db');

// Статистика всех игроков
router.get('/players', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id, p.name, COUNT(m.id) as matches_played,
                   SUM(CASE WHEN m.winner_id = p.id THEN 1 ELSE 0 END) as wins,
                   SUM(CASE WHEN m.winner_id != p.id AND m.winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses
            FROM players p
            LEFT JOIN matches m ON p.id = m.participant1_id OR p.id = m.participant2_id
            GROUP BY p.id, p.name
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Статистика конкретного игрока
router.get('/players/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT p.id, p.name, COUNT(m.id) as matches_played,
                   SUM(CASE WHEN m.winner_id = p.id THEN 1 ELSE 0 END) as wins,
                   SUM(CASE WHEN m.winner_id != p.id AND m.winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses
            FROM players p
            LEFT JOIN matches m ON p.id = m.participant1_id OR p.id = m.participant2_id
            WHERE p.id = $1
            GROUP BY p.id, p.name
        `, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Игрок не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Статистика всех команд
router.get('/teams', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.id, t.name, COUNT(m.id) as matches_played,
                   SUM(CASE WHEN m.winner_id = t.id THEN 1 ELSE 0 END) as wins,
                   SUM(CASE WHEN m.winner_id != t.id AND m.winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses
            FROM teams t
            LEFT JOIN matches m ON t.id = m.participant1_id OR t.id = m.participant2_id
            GROUP BY t.id, t.name
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Статистика конкретной команды
router.get('/teams/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT t.id, t.name, COUNT(m.id) as matches_played,
                   SUM(CASE WHEN m.winner_id = t.id THEN 1 ELSE 0 END) as wins,
                   SUM(CASE WHEN m.winner_id != t.id AND m.winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses
            FROM teams t
            LEFT JOIN matches m ON t.id = m.participant1_id OR t.id = m.participant2_id
            WHERE t.id = $1
            GROUP BY t.id, t.name
        `, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Статистика по турниру
router.get('/tournaments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT p.id, p.name, COUNT(m.id) as matches_played,
                   SUM(CASE WHEN m.winner_id = p.id THEN 1 ELSE 0 END) as wins,
                   SUM(CASE WHEN m.winner_id != p.id AND m.winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses
            FROM players p
            JOIN matches m ON p.id = m.participant1_id OR p.id = m.participant2_id
            WHERE m.tournament_id = $1
            GROUP BY p.id, p.name
            ORDER BY wins DESC
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;