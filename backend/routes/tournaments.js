const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

/* =========================================
   1. Создание турнира (POST /api/tournaments)
   ========================================= */
router.post('/', authMiddleware, async (req, res) => {
    const { name, description, game, type } = req.body;
    const createdBy = req.user.id;

    if (!name || !game || !type) {
      return res.status(400).json({ status: 'error', message: 'Название, игра и тип обязательны' });
    }

    const allowedGames = ['Quake', 'Counter Strike 2', 'Dota 2', 'Valorant'];
    if (!allowedGames.includes(game)) {
      return res.status(400).json({ status: 'error', message: 'Некорректная игра' });
    }

    const allowedTypes = ['solo', 'teams'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Некорректный тип турнира (solo/teams)' });
    }

    try {
      const result = await pool.query(
        'INSERT INTO tournaments (name, description, created_by, game, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, description, createdBy, game, type]
      );
      res.status(201).json({ status: 'success', tournament: result.rows[0] });
    } catch (err) {
      console.error('Ошибка создания турнира:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
});

/* =========================================
   2. Список всех турниров (GET /api/tournaments)
   ========================================= */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tournaments ORDER BY created_at DESC');
    res.json({ status: 'success', tournaments: result.rows });
  } catch (err) {
    console.error('Ошибка получения турниров:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/* =========================================
   3. Мои турниры (GET /api/tournaments/myTournaments)
   ========================================= */
router.get('/myTournaments', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const tournamentsResult = await pool.query(`
          SELECT t.*
          FROM tournaments t
          WHERE t.created_by = $1
             OR EXISTS (
               SELECT 1 FROM tournament_admins ta
               WHERE ta.tournament_id = t.id AND ta.admin_id = $1
             )
          ORDER BY created_at DESC
        `, [userId]);

        res.json({ status: 'success', tournaments: tournamentsResult.rows });
    } catch (err) {
        console.error('Ошибка получения "моих" турниров:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/* =========================================
   4. Получение одного турнира (GET /api/tournaments/:id)
   ========================================= */
router.get('/:id', async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);

      if (tournamentResult.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Турнир не найден' });
      }

      // Получаем администраторов
      const adminsResult = await pool.query(`
        SELECT u.id, u.username,
               CASE WHEN t.created_by = u.id THEN 'creator' ELSE 'admin' END AS role
        FROM users u
        LEFT JOIN tournament_admins ta ON u.id = ta.admin_id
        LEFT JOIN tournaments t ON t.created_by = u.id OR ta.tournament_id = t.id
        WHERE t.id = $1
      `, [tournamentId]);

      const admins = adminsResult.rows || [];

      res.json({
        status: 'success',
        tournament: tournamentResult.rows[0],
        admins
      });
    } catch (err) {
      console.error('Ошибка при загрузке турнира:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
});

/* =========================================
   5. Работа с участниками (solo)
   ========================================= */
router.get('/:id/participants', async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const participantsResult = await pool.query(`
          SELECT * FROM tournament_participants
          WHERE tournament_id = $1
        `, [tournamentId]);

        res.json({ status: 'success', participants: participantsResult.rows });
    } catch (err) {
        console.error('Ошибка загрузки участников:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

router.post('/:id/participants', async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const { name } = req.body;

        await pool.query(`
          INSERT INTO tournament_participants (tournament_id, name)
          VALUES ($1, $2)
        `, [tournamentId, name]);

        res.json({ status: 'success', message: 'Участник добавлен' });
    } catch (err) {
        console.error('Ошибка добавления участника:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/* =========================================
   6. Генерация сетки (POST /api/tournaments/:id/generateBracket)
   и получение матчей (GET /api/tournaments/:id/matches)
   ========================================= */

// ✅ Сгенерировать сетку
router.post('/:id/generateBracket', async (req, res) => {
    try {
        const tournamentId = req.params.id;

        // Узнаём type (solo/teams)
        const typeResult = await pool.query('SELECT type FROM tournaments WHERE id = $1', [tournamentId]);
        if (typeResult.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Турнир не найден' });
        }
        const { type } = typeResult.rows[0];

        // Определяем, откуда брать участников
        let participants = [];
        if (type === 'solo') {
            const partRes = await pool.query(`
              SELECT id, name FROM tournament_participants
              WHERE tournament_id = $1
            `, [tournamentId]);
            participants = partRes.rows;
        } else if (type === 'teams') {
            const teamsRes = await pool.query(`
              SELECT id, name FROM teams
              WHERE tournament_id = $1
            `, [tournamentId]);
            participants = teamsRes.rows;
        }

        if (participants.length < 2) {
            return res.status(400).json({
              status: 'error',
              message: 'Недостаточно участников/команд для генерации сетки'
            });
        }

        // Генерируем матчи (в памяти)
        const matches = generateSingleEliminationBracket(participants, tournamentId);

        // 🆕 Очищаем старые матчи (если нужно пересоздать)
        await pool.query('DELETE FROM matches WHERE tournament_id = $1', [tournamentId]);

        // 🆕 Сохраняем матчи в таблицу matches
        const insertSql = `
          INSERT INTO matches (tournament_id, round, team1_id, team2_id, status)
          VALUES ($1, $2, $3, $4, $5)
        `;
        for (const match of matches) {
            await pool.query(insertSql, [
                match.tournament_id,
                match.round,
                match.team1_id,
                match.team2_id,
                match.status
            ]);
        }

        // Возвращаем сгенерированные матчи в ответ
        res.json({ status: 'success', matches });
    } catch (err) {
        console.error('Ошибка генерации сетки:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ✅ Получить матчи турнира
router.get('/:id/matches', async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const matchesResult = await pool.query(`
          SELECT * FROM matches
          WHERE tournament_id = $1
          ORDER BY round
        `, [tournamentId]);

        res.json({ status: 'success', matches: matchesResult.rows });
    } catch (err) {
        console.error('Ошибка загрузки матчей:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Генерация "одиночного вылета"
function generateSingleEliminationBracket(participants, tournamentId) {
    let matches = [];
    let round = 1;
    let matchId = 1;

    for (let i = 0; i < participants.length; i += 2) {
        if (i + 1 < participants.length) {
            matches.push({
                id: matchId++,
                round,
                tournament_id: tournamentId,
                team1_id: participants[i].id,
                team2_id: participants[i + 1].id,
                status: 'scheduled'
            });
        } else {
            // Если нечётное кол-во участников => проход
            matches.push({
                id: matchId++,
                round,
                tournament_id: tournamentId,
                team1_id: participants[i].id,
                team2_id: null,
                status: 'won_by_default'
            });
        }
    }
    return matches;
}

// Генерация Round Robin (если нужно)
function generateRoundRobinBracket(participants, tournamentId) {
    let matches = [];
    let matchId = 1;
    for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
            matches.push({
                id: matchId++,
                round: i + 1,
                tournament_id: tournamentId,
                team1_id: participants[i].id,
                team2_id: participants[j].id,
                status: 'scheduled'
            });
        }
    }
    return matches;
}

/* =========================================
   7. Завершение турнира (PUT /api/tournaments/:id/complete)
   ========================================= */
router.put('/:id/complete', authMiddleware, async (req, res) => {
  const tournamentId = req.params.id;
  try {
    const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    const tournament = tournamentResult.rows[0];
    if (!tournament) {
      return res.status(404).json({ status: 'error', message: 'Tournament not found' });
    }
    const adminResult = await pool.query(
      'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND admin_id = $2',
      [tournamentId, req.user.id]
    );
    if (tournament.created_by !== req.user.id && adminResult.rowCount === 0) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to complete this tournament' });
    }
    const updateResult = await pool.query(
      "UPDATE tournaments SET status = 'completed' WHERE id = $1 RETURNING *",
      [tournamentId]
    );
    res.json({ status: 'success', tournament: updateResult.rows[0] });
  } catch (err) {
    console.error('Ошибка завершения турнира:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/* =========================================
   8. Редактирование турнира (PUT /api/tournaments/:id)
   ========================================= */
router.put('/:id', authMiddleware, async (req, res) => {
  const tournamentId = req.params.id;
  const { name, description } = req.body;
  try {
    const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    const tournament = tournamentResult.rows[0];
    if (!tournament) {
      return res.status(404).json({ status: 'error', message: 'Tournament not found' });
    }
    if (tournament.status !== 'active') {
      return res.status(400).json({ status: 'error', message: 'Cannot update tournament details after completion' });
    }
    const adminResult = await pool.query(
      'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND admin_id = $2',
      [tournamentId, req.user.id]
    );
    if (tournament.created_by !== req.user.id && adminResult.rowCount === 0) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to update tournament details' });
    }
    const updateResult = await pool.query(
      'UPDATE tournaments SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
      [name, description, tournamentId]
    );
    res.json({ status: 'success', tournament: updateResult.rows[0] });
  } catch (err) {
    console.error('Ошибка обновления турнира:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
