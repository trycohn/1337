// backend/routes/tournaments.js
const express = require('express');            // [Строка 1]
const router = express.Router();               // [Строка 2]
const pool = require('../db');                 // [Строка 3]
const authMiddleware = require('../middleware/authMiddleware'); // [Строка 4]

// Эндпоинт для создания турнира (только для авторизованных пользователей)
router.post('/', authMiddleware, async (req, res) => { // [Строка 7]
  const { name, description, game } = req.body;         // [Строка 8]
  const createdBy = req.user.id;                        // [Строка 9]
  if (!name || !game) {                                // [Строка 10]
    return res.status(400).json({ status: 'error', message: 'Name and game are required' });
  }
  // Дополнительная проверка: игра должна быть одной из допустимых
  const allowedGames = ['Quake', 'Counter Strike 2', 'Dota 2', 'Valorant']; // [Строка 13]
  if (!allowedGames.includes(game)) {                 // [Строка 14]
    return res.status(400).json({ status: 'error', message: 'Invalid game selected' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO tournaments (name, description, created_by, game) VALUES ($1, $2, $3, $4) RETURNING *', // [Строка 18]
      [name, description, createdBy, game]
    );
    res.status(201).json({ status: 'success', tournament: result.rows[0] }); // [Строка 21]
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Эндпоинт для получения списка всех турниров
router.get('/', async (req, res) => { // [Строка 28]
  try {
    const result = await pool.query('SELECT * FROM tournaments ORDER BY created_at DESC'); // [Строка 29]
    res.json({ status: 'success', tournaments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

 // Эндпоинт для получения турниров, где пользователь является создателем или администратором
 router.get('/myTournaments', authMiddleware, async (req, res) => {
    try {
      // Получаем идентификатор текущего пользователя, который был установлен authMiddleware
      const userId = req.user.id;
      // Формируем SQL-запрос, где параметр $1 - это userId
      const query = `
        SELECT * FROM tournaments t
        WHERE t.created_by = $1
           OR EXISTS (
             SELECT 1 FROM tournament_admins ta
             WHERE ta.tournament_id = t.id AND ta.admin_id = $1
           )
        ORDER BY created_at DESC;
      `;
      // Выполняем запрос к базе данных
      const result = await pool.query(query, [userId]);
      // Возвращаем успешный ответ с массивом турниров
      res.json({ status: 'success', tournaments: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

// Эндпоинт для получения подробной информации о конкретном турнире
router.get('/:id', async (req, res) => { // [Строка 36]
  const tournamentId = req.params.id;   // [Строка 37]
  try {
    // Получаем данные турнира
    const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]); // [Строка 39]
    const tournament = tournamentResult.rows[0];
    if (!tournament) {
      return res.status(404).json({ status: 'error', message: 'Tournament not found' });
    }
    // Получаем команды, зарегистрированные в данном турнире
    const teamsResult = await pool.query(
      'SELECT tt.id as tournament_team_id, t.* FROM tournament_teams tt JOIN teams t ON tt.team_id = t.id WHERE tt.tournament_id = $1',
      [tournamentId]
    );
    // Получаем матчи турнира
    const matchesResult = await pool.query('SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round', [tournamentId]);
    
    res.json({ status: 'success', tournament, teams: teamsResult.rows, matches: matchesResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Эндпоинт для назначения администратора турнира
router.post('/:id/admins', authMiddleware, async (req, res) => {       // [Новая строка]
    const tournamentId = req.params.id;                                   // [Новая строка]
    const { admin_id } = req.body;                                          // [Новая строка]
    if (!admin_id) {                                                       // [Новая строка]
      return res.status(400).json({ status: 'error', message: 'admin_id is required' });
    }
    try {
      // Получаем данные турнира
      const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]); // [Новая строка]
      const tournament = tournamentResult.rows[0];                       // [Новая строка]
      if (!tournament) {                                                   // [Новая строка]
        return res.status(404).json({ status: 'error', message: 'Tournament not found' });
      }
      // Проверяем, что текущий пользователь является создателем турнира
      if (tournament.created_by !== req.user.id) {                         // [Новая строка]
        return res.status(403).json({ status: 'error', message: 'Only tournament creator can appoint admins' });
      }
      // Вставляем новую запись в tournament_admins
      const insertResult = await pool.query(
        'INSERT INTO tournament_admins (tournament_id, admin_id) VALUES ($1, $2) RETURNING *',
        [tournamentId, admin_id]
      );
      res.status(201).json({ status: 'success', admin: insertResult.rows[0] }); // [Новая строка]
    } catch (err) {
      console.error(err);                                                  // [Новая строка]
      res.status(500).json({ status: 'error', message: err.message });      // [Новая строка]
    }
  });

  // Эндпоинт для завершения турнира (обновление статуса на 'completed')
router.put('/:id/complete', authMiddleware, async (req, res) => {
    const tournamentId = req.params.id;
    try {
      // Получаем данные турнира
      const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
      const tournament = tournamentResult.rows[0];
      if (!tournament) {
        return res.status(404).json({ status: 'error', message: 'Tournament not found' });
      }
      // Проверяем, что текущий пользователь является создателем турнира либо назначенным администратором
      const adminResult = await pool.query(
        'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND admin_id = $2',
        [tournamentId, req.user.id]
      );
      if (tournament.created_by !== req.user.id && adminResult.rowCount === 0) {
        return res.status(403).json({ status: 'error', message: 'Not authorized to complete this tournament' });
      }
      // Обновляем статус турнира на 'completed'
      const updateResult = await pool.query(
        "UPDATE tournaments SET status = 'completed' WHERE id = $1 RETURNING *",
        [tournamentId]
      );
      res.json({ status: 'success', tournament: updateResult.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  
  // Эндпоинт для обновления деталей турнира (например, имени и описания)
// Разрешено изменять только для турниров со статусом 'active'
router.put('/:id', authMiddleware, async (req, res) => {
    const tournamentId = req.params.id;
    const { name, description } = req.body; // Допустим, изменять можно имя и описание
    try {
      // Получаем данные турнира
      const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
      const tournament = tournamentResult.rows[0];
      if (!tournament) {
        return res.status(404).json({ status: 'error', message: 'Tournament not found' });
      }
      // Проверяем, что турнир ещё активен
      if (tournament.status !== 'active') {
        return res.status(400).json({ status: 'error', message: 'Cannot update tournament details after completion' });
      }
      // Проверяем, что текущий пользователь является создателем турнира или назначенным администратором
      const adminResult = await pool.query(
        'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND admin_id = $2',
        [tournamentId, req.user.id]
      );
      if (tournament.created_by !== req.user.id && adminResult.rowCount === 0) {
        return res.status(403).json({ status: 'error', message: 'Not authorized to update tournament details' });
      }
      // Обновляем данные турнира, оставляя старые значения, если новые не переданы
      const updateResult = await pool.query(
        'UPDATE tournaments SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
        [name, description, tournamentId]
      );
      res.json({ status: 'success', tournament: updateResult.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  
 
  
module.exports = router; // [Строка 53]
