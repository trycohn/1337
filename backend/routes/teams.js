// backend/routes/teams.js
const express = require('express'); // [Строка 1]
const router = express.Router();    // [Строка 2]
const pool = require('../db');      // [Строка 3]
const authMiddleware = require('../middleware/authMiddleware'); // [Строка 4]

// Эндпоинт для регистрации команды в турнире
router.post('/:tournamentId/teams', authMiddleware, async (req, res) => { // [Строка 7]
  const tournamentId = req.params.tournamentId; // [Строка 8]
  const { name, city } = req.body;              // [Строка 9]
  if (!name || !city) {                         // [Строка 10]
    return res.status(400).json({ status: 'error', message: 'Name and city are required' });
  }
  try {
    // Проверяем, существует ли команда в глобальной таблице teams
    let teamResult = await pool.query('SELECT * FROM teams WHERE name = $1 AND city = $2', [name, city]); // [Строка 14]
    let team;
    if (teamResult.rows.length > 0) {
      team = teamResult.rows[0];                // [Строка 17]
    } else {
      // Если не существует – создаём новую запись
      const newTeamResult = await pool.query(
        'INSERT INTO teams (name, city) VALUES ($1, $2) RETURNING *', // [Строка 21]
        [name, city]
      );
      team = newTeamResult.rows[0];
    }
    // Проверяем, зарегистрирована ли команда уже в данном турнире
    const checkRegistration = await pool.query(
      'SELECT * FROM tournament_teams WHERE tournament_id = $1 AND team_id = $2',
      [tournamentId, team.id]
    );
    if (checkRegistration.rows.length > 0) {
      return res.status(400).json({ status: 'error', message: 'Team already registered in this tournament' });
    }
    // Регистрируем команду в турнире
    const registrationResult = await pool.query(
      'INSERT INTO tournament_teams (tournament_id, team_id) VALUES ($1, $2) RETURNING *',
      [tournamentId, team.id]
    );
    res.status(201).json({ status: 'success', tournamentTeam: registrationResult.rows[0], team });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router; // [Строка 36]
