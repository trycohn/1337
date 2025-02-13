// backend/routes/matches.js
const express = require('express');             // [Строка 1]
const router = express.Router();                // [Строка 2]
const pool = require('../db');                  // [Строка 3]
const authMiddleware = require('../middleware/authMiddleware'); // [Строка 4]

// Эндпоинт для обновления результатов матча
router.post('/matches/:matchId/results', authMiddleware, async (req, res) => { // [Строка 7]
  const { matchId } = req.params;             // [Строка 8]
  const { score1, score2, winner_team_id } = req.body; // [Строка 9]
  if (score1 === undefined || score2 === undefined || !winner_team_id) { // [Строка 10]
    return res.status(400).json({ status: 'error', message: 'score1, score2 and winner_team_id are required' });
  }
  try {
    // Обновляем запись матча новыми данными
    const result = await pool.query(
      'UPDATE matches SET score1 = $1, score2 = $2, winner_team_id = $3 WHERE id = $4 RETURNING *', // [Строка 14]
      [score1, score2, winner_team_id, matchId]
    );
    res.json({ status: 'success', match: result.rows[0] }); // [Строка 17]
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router; // [Строка 23]
