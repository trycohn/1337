// backend/routes/brackets.js

const express = require('express');                              // [Строка 1]
const router = express.Router();                                 // [Строка 2]
const pool = require('../db');                                   // [Строка 3]
const authMiddleware = require('../middleware/authMiddleware');  // [Строка 4]
const bracketController = require('../controllers/bracketController'); // [Строка 5]
const checkTournamentAdmin = require('../middleware/authAdmin');

// Функция перемешивания массива (алгоритм Фишера-Йетса)
function shuffleArray(array) {                                   // [Строка 8]
  for (let i = array.length - 1; i > 0; i--) {                   
    const j = Math.floor(Math.random() * (i + 1));              
    [array[i], array[j]] = [array[j], array[i]];                
  }                                                             
  return array;                                                  
}                                                               

// Эндпоинт генерации турнирной сетки для турнира
// Изменено: удалили из пути префикс "/tournaments", чтобы конечный URL был /api/tournaments/:tournamentId/generateBracket
router.post('/:tournamentId/generateBracket', authMiddleware, async (req, res) => { // [Строка 15]
  const { tournamentId } = req.params;                           
  try {
    // Получаем турнир и проверяем, что его создатель совпадает с текущим пользователем
    const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]); // [Строка 19]
    const tournament = tournamentResult.rows[0];
    if (!tournament) {                                            // [Строка 21]
      return res.status(404).json({ status: 'error', message: 'Tournament not found' });
    }
    if (tournament.created_by !== req.user.id) {                  // [Строка 24]
      return res.status(403).json({ status: 'error', message: 'Not authorized to generate bracket for this tournament' });
    }
    // Получаем список зарегистрированных команд для турнира (из таблицы tournament_teams)
    const teamsResult = await pool.query('SELECT * FROM tournament_teams WHERE tournament_id = $1', [tournamentId]); // [Строка 28]
    const tournamentTeams = teamsResult.rows;
    if (tournamentTeams.length < 2) {                             // [Строка 30]
      return res.status(400).json({ status: 'error', message: 'Not enough teams to generate bracket' });
    }
    // Перемешиваем команды для случайного распределения
    const shuffledTeams = shuffleArray(tournamentTeams.slice()); // [Строка 33]
    const n = shuffledTeams.length;
    const p = Math.pow(2, Math.floor(Math.log2(n)));              // [Строка 35]
    let matches = [];
    let round = 1;
    
    if (n === p) {
      // Если количество команд равно степени двойки, формируем пары подряд
      for (let i = 0; i < n; i += 2) {                            // [Строка 41]
        matches.push({
          tournament_id: tournamentId,
          round: round,
          team1_id: shuffledTeams[i].teams_id,
          team2_id: shuffledTeams[i + 1] ? shuffledTeams[i + 1].teams_id : null
        });
      }
    } else {
      // Если команд больше, чем степень двойки, создаем предварительный раунд
      const numPrelimMatches = n - p;                             // [Строка 48]
      for (let i = 0; i < numPrelimMatches * 2; i += 2) {           // [Строка 50]
        matches.push({
          tournament_id: tournamentId,
          round: 0, // Предварительный раунд обозначаем как 0
          team1_id: shuffledTeams[i].teams_id,
          team2_id: shuffledTeams[i + 1] ? shuffledTeams[i + 1].teams_id : null
        });
      }
      // Дополнительная логика для связи предварительного раунда с основным может быть добавлена здесь.
    }
    
    // Вставляем сгенерированные матчи в базу данных
    const insertedMatches = [];
    for (let match of matches) {                                  // [Строка 58]
      const result = await pool.query(
        'INSERT INTO matches (tournament_id, round, team1_id, team2_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [match.tournament_id, match.round, match.team1_id, match.team2_id]
      );
      insertedMatches.push(result.rows[0]);
    }
    
    res.status(201).json({ status: 'success', bracket: insertedMatches }); // [Строка 65]
  } catch (err) {
    console.error('Error generating bracket:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;                                      // [Строка 70]
