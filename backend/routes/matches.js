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

// Обновление матча через PUT (например, запись результата)
router.put('/:id', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { winner_id, score1, score2 } = req.body; // Заменили score на score1 и score2
    try {
        const result = await pool.query(
            'UPDATE matches SET winner_id = $1, score1 = $2, score2 = $3 WHERE id = $4 RETURNING *',
            [winner_id, score1, score2, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Матч не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Новый маршрут для обновления матча (соответствует фронтенду)
router.post('/:tournamentId/update-match', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { tournamentId } = req.params;
    const { matchId, winner_team_id, score1, score2 } = req.body;
    const userId = req.user.id;

    try {
        // Проверяем права администратора или создателя
        const adminCheck = await pool.query(
            `SELECT * FROM tournament_admins WHERE tournament_id = $1 AND admin_id = $2`,
            [tournamentId, userId]
        );
        const creatorCheck = await pool.query(
            `SELECT created_by FROM tournaments WHERE id = $1`,
            [tournamentId]
        );

        if (adminCheck.rows.length === 0 && creatorCheck.rows[0]?.created_by !== userId) {
            return res.status(403).json({ error: 'У вас нет прав для редактирования матча' });
        }

        // Проверяем существование матча
        const matchCheck = await pool.query(
            `SELECT * FROM matches WHERE id = $1 AND tournament_id = $2`,
            [matchId, tournamentId]
        );
        if (matchCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Матч не найден' });
        }

        // Обновляем матч
        const result = await pool.query(
            'UPDATE matches SET winner_id = $1, score1 = $2, score2 = $3 WHERE id = $4 AND tournament_id = $5 RETURNING *',
            [winner_team_id, score1, score2, matchId, tournamentId]
        );

        res.json({ message: 'Матч успешно обновлён', match: result.rows[0] });
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
        res.json({ message: 'Матч удалён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;