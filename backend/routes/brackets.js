// backend/routes/brackets.js
const express = require('express');                              // [Строка 1]
const router = express.Router();                                 // [Строка 2]
const pool = require('../db');                                   // [Строка 3]
const authMiddleware = require('../middleware/authMiddleware');  // [Строка 4]

// Функция перемешивания массива (алгоритм Фишера-Йетса)
function shuffleArray(array) {                                   // [Строка 7]
  for (let i = array.length - 1; i > 0; i--) {                  
    const j = Math.floor(Math.random() * (i + 1));              
    [array[i], array[j]] = [array[j], array[i]];                
  }                                                            
  return array;                                                
}

// Эндпоинт генерации турнирной сетки для турнира
router.post('/tournaments/:tournamentId/generateBracket', authMiddleware, async (req, res) => { // [Строка 14]
  const { tournamentId } = req.params;                           // [Строка 15]
  try {
    // Получаем турнир и проверяем, что его создатель совпадает с текущим пользователем
    const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]); // [Строка 18]
    const tournament = tournamentResult.rows[0];
    if (!tournament) {                                           // [Строка 20]
      return res.status(404).json({ status: 'error', message: 'Tournament not found' });
    }
    if (tournament.created_by !== req.user.id) {                 // [Строка 23]
      return res.status(403).json({ status: 'error', message: 'Not authorized to generate bracket for this tournament' });
    }
    // Получаем список зарегистрированных команд для турнира (из таблицы tournament_teams)
    const teamsResult = await pool.query('SELECT * FROM tournament_teams WHERE tournament_id = $1', [tournamentId]); // [Строка 27]
    const tournamentTeams = teamsResult.rows;
    if (tournamentTeams.length < 2) {                            // [Строка 29]
      return res.status(400).json({ status: 'error', message: 'Not enough teams to generate bracket' });
    }
    // Перемешиваем команды для случайного распределения
    const shuffledTeams = shuffleArray(tournamentTeams.slice()); // [Строка 32]
    const n = shuffledTeams.length;
    // Вычисляем ближайшую степень двойки, не превышающую n (для простоты алгоритма)
    const p = Math.pow(2, Math.floor(Math.log2(n)));             // [Строка 34]
    let matches = [];
    let round = 1;
    
    if (n === p) {
      // Если количество команд ровно степень двойки, формируем пары подряд
      for (let i = 0; i < n; i += 2) {                           // [Строка 39]
        matches.push({
          tournament_id: tournamentId,
          round: round,
          team1_id: shuffledTeams[i].id,
          team2_id: shuffledTeams[i + 1] ? shuffledTeams[i + 1].id : null
        });
      }
    } else {
      // Если команд больше, чем p, создаём предварительный раунд для отбора лишних команд.
      // Количество предварительных матчей:
      const numPrelimMatches = n - p;                            // [Строка 46]
      // Первые 2*numPrelimMatches команд играют в предварительном раунде.
      for (let i = 0; i < numPrelimMatches * 2; i += 2) {          // [Строка 48]
        matches.push({
          tournament_id: tournamentId,
          round: 0, // Предварительный раунд обозначаем как 0
          team1_id: shuffledTeams[i].id,
          team2_id: shuffledTeams[i + 1] ? shuffledTeams[i + 1].id : null
        });
      }
      // В дальнейшем (на основе результатов предварительного раунда)
      // победители попадут в основной тур, где количество команд будет равно p.
      // Здесь можно добавить дополнительную логику для связывания предварительного раунда с основным.
    }
    
    // Вставляем сгенерированные матчи в базу данных
    const insertedMatches = [];
    for (let match of matches) {                                 // [Строка 59]
      const result = await pool.query(
        'INSERT INTO matches (tournament_id, round, team1_id, team2_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [match.tournament_id, match.round, match.team1_id, match.team2_id]
      );
      insertedMatches.push(result.rows[0]);
    }
    
    res.status(201).json({ status: 'success', bracket: insertedMatches }); // [Строка 66]
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;                                      // [Строка 71]
