/**
 * routes/tournaments.js
 *
 * Этот модуль определяет маршруты для работы с турнирами.
 * Реализованы:
 * 1. GET /api/tournaments                - Получение списка всех турниров.
 * 2. GET /api/tournaments/:id            - Получение деталей турнира по ID.
 * 3. POST /api/tournaments               - Создание нового турнира.
 * 4. GET /api/tournaments/:id/participants - Получение списка участников турнира.
 * 5. POST /api/tournaments/:id/participants- Добавление участника к турниру.
 */

const express = require('express');
const router = express.Router();
const pool = require('../db'); // Подключение к базе данных

// 1) Получение списка всех турниров
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tournaments ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка при получении турниров:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// 2) Получение деталей турнира по ID
router.get('/:id', async (req, res) => {
    const tournamentId = parseInt(req.params.id, 10);
    try {
        const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Турнир не найден' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при получении турнира:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// 3) Создание нового турнира
router.post('/', async (req, res) => {
    const { name, description, game, type, created_by } = req.body;
    if (!name || !game || !type) {
        return res.status(400).json({ message: 'Не все необходимые поля заполнены' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO tournaments (name, description, game, type, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, description, game, type, created_by]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при создании турнира:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// GET /api/tournaments/:id/participants — получение списка участников для выбранного турнира
router.get('/:id/participants', async (req, res) => {
    const tournamentId = parseInt(req.params.id, 10);
    try {
        const result = await pool.query(
            'SELECT * FROM participants WHERE tournament_id = $1 ORDER BY id ASC',
            [tournamentId]
        );
        res.json({ participants: result.rows });
    } catch (error) {
        console.error('Ошибка при получении участников:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});


// 5) Добавление участника к турниру
router.post('/:id/participants', async (req, res) => {
    const tournamentId = parseInt(req.params.id, 10);
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Имя участника обязательно' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO participants (tournament_id, name) VALUES ($1, $2) RETURNING *',
            [tournamentId, name]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при добавлении участника:', error);
        res.status(500).json({ message: 'Ошибка сервера', error: error.message });
    }
});

// GET /api/tournaments/:id/matches — Получение списка матчей для турнира
router.get('/:id/matches', async (req, res) => {
    const tournamentId = parseInt(req.params.id, 10);
    try {
        // Предположим, что в таблице matches хранится информация о матчах турнира,
        // и что есть столбец tournament_id, по которому фильтруются матчи
        const result = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY id ASC',
            [tournamentId]
        );
        res.json({ matches: result.rows });
    } catch (error) {
        console.error('Ошибка при получении матчей:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

module.exports = router;
