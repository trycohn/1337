// backend/routes/statistics.js
const express = require('express');              // [Строка 1]
const router = express.Router();                 // [Строка 2]
const pool = require('../db');                   // [Строка 3]

// Эндпоинт для получения статистики турнира
router.get('/tournaments/:id/statistics', async (req, res) => { // [Строка 6]
  const tournamentId = req.params.id;                         // [Строка 7]
  try {
    // Получаем данные турнира
    const tournamentResult = await pool.query(
      'SELECT * FROM tournaments WHERE id = $1', [tournamentId] // [Строка 10]
    );
    if (tournamentResult.rowCount === 0) {                     // [Строка 11]
      return res.status(404).json({ status: 'error', message: 'Tournament not found' });
    }
    const tournament = tournamentResult.rows[0];

    // Получаем агрегированное количество побед для каждой команды в турнире
    const teamWinsResult = await pool.query(
      `SELECT winner_team_id AS team_id, COUNT(*) AS wins 
       FROM matches 
       WHERE tournament_id = $1 AND winner_team_id IS NOT NULL 
       GROUP BY winner_team_id`,
       [tournamentId]                                       // [Строка 20]
    );

    // Получаем агрегированную статистику для игроков по матчам турнира
    const playerStatsResult = await pool.query(
      `SELECT ps.player_id, p.name AS player_name, 
              SUM(ps.points) AS total_points, 
              SUM(ps.assists) AS total_assists, 
              SUM(ps.rebounds) AS total_rebounds
       FROM player_stats ps
       JOIN matches m ON ps.match_id = m.id
       JOIN players p ON ps.player_id = p.id
       WHERE m.tournament_id = $1
       GROUP BY ps.player_id, p.name`,
       [tournamentId]                                       // [Строка 33]
    );

    res.json({
      status: 'success',
      tournament,                                            // данные турнира
      teamWins: teamWinsResult.rows,                         // массив объектов с team_id и количеством побед
      playerStats: playerStatsResult.rows                    // массив объектов с агрегированной статистикой игроков
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;                                       // [Строка 45]
