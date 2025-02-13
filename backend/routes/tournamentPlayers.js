// backend/routes/tournamentPlayers.js
const express = require('express');             // [Строка 1]
const router = express.Router();                // [Строка 2]
const pool = require('../db');                  // [Строка 3]
const authMiddleware = require('../middleware/authMiddleware'); // [Строка 4]

// Эндпоинт для добавления игрока в команду в турнире
router.post('/tournaments/:tournamentId/teams/:tournamentTeamId/players', authMiddleware, async (req, res) => { // [Строка 7]
  const { tournamentId, tournamentTeamId } = req.params; // [Строка 8]
  const { name, position, isCaptain } = req.body;         // [Строка 9]
  if (!name) {                                            // [Строка 10]
    return res.status(400).json({ status: 'error', message: 'Player name is required' });
  }
  try {
    // Проверяем, существует ли игрок в глобальной таблице players
    let playerResult = await pool.query('SELECT * FROM players WHERE name = $1', [name]); // [Строка 14]
    let player;
    if (playerResult.rows.length > 0) {
      player = playerResult.rows[0];
    } else {
      // Если игрок не найден – создаём новую запись
      const newPlayerResult = await pool.query(
        'INSERT INTO players (name, position) VALUES ($1, $2) RETURNING *', // [Строка 20]
        [name, position]
      );
      player = newPlayerResult.rows[0];
    }
    // Проверяем, зарегистрирован ли игрок уже в данной команде турнира
    const checkRegistration = await pool.query(
      'SELECT * FROM tournament_team_players WHERE tournament_team_id = $1 AND player_id = $2',
      [tournamentTeamId, player.id]
    );
    if (checkRegistration.rows.length > 0) {
      return res.status(400).json({ status: 'error', message: 'Player already registered in this tournament team' });
    }
    // Регистрируем игрока в команде турнира
    const registrationResult = await pool.query(
      'INSERT INTO tournament_team_players (tournament_team_id, player_id, is_captain) VALUES ($1, $2, $3) RETURNING *',
      [tournamentTeamId, player.id, isCaptain || false]
    );
    res.status(201).json({ status: 'success', tournamentTeamPlayer: registrationResult.rows[0], player });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Эндпоинт для удаления игрока из команды турнира
router.delete('/tournaments/:tournamentId/teams/:tournamentTeamId/players/:tournamentTeamPlayerId', authMiddleware, async (req, res) => {
    const { tournamentId, tournamentTeamId, tournamentTeamPlayerId } = req.params;
    try {
      // Здесь можно добавить проверку, что только капитан команды имеет право удалять игрока
      const deleteResult = await pool.query(
        'DELETE FROM tournament_team_players WHERE id = $1 RETURNING *',
        [tournamentTeamPlayerId]
      );
      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ status: 'error', message: 'Player not found in this tournament team' });
      }
      res.json({ status: 'success', removedPlayer: deleteResult.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  

module.exports = router; // [Строка 36]
