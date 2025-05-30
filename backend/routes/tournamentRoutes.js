const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

// Получение журнала событий турнира
router.get('/:id/logs', authenticateToken, async (req, res) => {
    try {
        const tournamentId = req.params.id;
        
        // Проверяем существование турнира
        const tournament = await db.query(
            'SELECT * FROM tournaments WHERE id = $1',
            [tournamentId]
        );
        
        if (tournament.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        // Получаем журнал событий с информацией о пользователях
        const logs = await db.query(`
            SELECT 
                tl.*,
                u.username,
                u.avatar_url
            FROM tournament_logs tl
            LEFT JOIN users u ON tl.user_id = u.id
            WHERE tl.tournament_id = $1
            ORDER BY tl.created_at DESC
            LIMIT 100
        `, [tournamentId]);
        
        res.json(logs.rows);
    } catch (error) {
        console.error('Ошибка при получении журнала событий:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вспомогательная функция для записи событий в журнал
async function logTournamentEvent(tournamentId, userId, eventType, eventData = {}) {
    try {
        await db.query(
            `INSERT INTO tournament_logs (tournament_id, user_id, event_type, event_data)
             VALUES ($1, $2, $3, $4)`,
            [tournamentId, userId, eventType, JSON.stringify(eventData)]
        );
    } catch (error) {
        console.error('Ошибка при записи в журнал турнира:', error);
    }
}

module.exports = router; 