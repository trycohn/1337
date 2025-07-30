const express = require('express');
const router = express.Router();
const pool = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');

// Получение общей статистики платформы
router.get('/platform', asyncHandler(async (req, res) => {
    try {
        // Получаем количество турниров
        const tournamentsResult = await pool.query('SELECT COUNT(*) as count FROM tournaments');
        const totalTournaments = parseInt(tournamentsResult.rows[0].count || 0);

        // Получаем количество уникальных игроков
        const playersResult = await pool.query(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM tournament_participants
        `);
        const totalPlayers = parseInt(playersResult.rows[0].count || 0);

        // Получаем количество матчей
        const matchesResult = await pool.query('SELECT COUNT(*) as count FROM matches');
        const totalMatches = parseInt(matchesResult.rows[0].count || 0);

        // Получаем общий призовой фонд (пока заглушка)
        const totalPrizePool = 100000; // TODO: добавить поле prize_pool в таблицу tournaments

        res.json({
            total_tournaments: totalTournaments,
            total_players: totalPlayers,
            total_matches: totalMatches,
            total_prize_pool: totalPrizePool
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
}));

module.exports = router; 