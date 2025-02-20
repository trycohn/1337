const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// ---------------------
// 1. Создание турнира (POST /api/tournaments)
// ---------------------
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, game, type } = req.body;
  const createdBy = req.user.id;

  // Проверки полей
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

// ---------------------
// 2. Список всех турниров (GET /api/tournaments)
// ---------------------
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tournaments ORDER BY created_at DESC');
    res.json({ status: 'success', tournaments: result.rows });
  } catch (err) {
    console.error('Ошибка получения турниров:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ---------------------
// 3. Мои турниры (GET /api/tournaments/myTournaments)
// ---------------------

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

// ---------------------
// 4. Получить турнир по id (GET /api/tournaments/:id)
// ---------------------
router.get('/:id', async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Турнир не найден' });
    }

    // Список администраторов
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

// ---------------------
// 5. Список участников (solo) — GET /:id/participants
// ---------------------
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

// ---------------------
// 6. Генерация сетки (POST /:id/generateBracket)
//    и получение матчей (GET /:id/matches)
// ---------------------
router.post('/:id/generateBracket', async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const { withThirdPlace } = req.body; // чекбокс "Матч за 3 место"

    // Узнаем, solo или teams
    const typeResult = await pool.query('SELECT type FROM tournaments WHERE id = $1', [tournamentId]);
    if (typeResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Турнир не найден' });
    }
    const { type } = typeResult.rows[0];

    // Получаем список (участники или команды)
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

    // Генерируем матчи (предварительный раунд + основной + матч за 3 место)
    const matches = generateSingleEliminationBracketAdvanced(participants, tournamentId, !!withThirdPlace);

    // Удаляем старые матчи
    await pool.query('DELETE FROM matches WHERE tournament_id = $1', [tournamentId]);

    // Сохраняем матчи в таблицу matches
    const insertSql = `
      INSERT INTO matches (tournament_id, round, team1_id, team2_id, status)
      VALUES ($1, $2, $3, $4, $5)
    `;
    let matchCount = 0;
    for (const m of matches) {
      await pool.query(insertSql, [
        m.tournament_id,
        m.round,
        m.team1_id,
        m.team2_id,
        m.status
      ]);
      matchCount++;
    }

    console.log(`[Generator] Inserted ${matchCount} matches for tournament #${tournamentId}`);
    res.json({ status: 'success', matches });
  } catch (err) {
    console.error('Ошибка генерации сетки:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Возвращаем список матчей
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

/** 
 * Расширенная логика single-elimination:
 * 1) Предварительный раунд, если n не степень двойки
 * 2) Основная сетка
 * 3) Матч за 3-е место, если withThird
*/
function generateSingleEliminationBracketAdvanced(participants, tournamentId, withThird) {
  const n = participants.length;
  if (n < 2) return [];

  // На случай перемешивания:
  // participants = shuffle(participants);

  const p = 2 ** Math.floor(Math.log2(n)); // ближайшая нижняя 2^k
  const matches = [];
  let matchId = 1;
  let round = 0;

  // Предварительный раунд
  const numPrelimMatches = n - p;
  const preliminaryParticipantsCount = 2 * numPrelimMatches;
  if (numPrelimMatches > 0) {
    round++;
    for (let i = 0; i < preliminaryParticipantsCount; i += 2) {
      matches.push({
        id: matchId++,
        round,
        tournament_id: tournamentId,
        team1_id: participants[i].id,
        team2_id: participants[i + 1].id,
        status: 'scheduled'
      });
    }
  }

  // Основная сетка
  const mainParticipants = [];
  // Те, кто не попал в preliminary
  for (let i = preliminaryParticipantsCount; i < n; i++) {
    mainParticipants.push(participants[i].id);
  }
  // Виртуальные победители preliminary
  for (let i = 0; i < numPrelimMatches; i++) {
    const virtualId = - (i + 1);
    mainParticipants.push(virtualId);
  }
  round = (round === 0) ? 1 : round + 1;

  let currentParticipants = mainParticipants;
  while (currentParticipants.length > 1) {
    const nextRound = [];
    for (let i = 0; i < currentParticipants.length; i += 2) {
      if (i + 1 < currentParticipants.length) {
        matches.push({
          id: matchId++,
          round,
          tournament_id: tournamentId,
          team1_id: currentParticipants[i],
          team2_id: currentParticipants[i + 1],
          status: 'scheduled'
        });
        // виртуальный победитель
        const virtId = -(matchId - 1);
        nextRound.push(virtId);
      } else {
        // Бай
        nextRound.push(currentParticipants[i]);
      }
    }
    round++;
    currentParticipants = nextRound;
  }

  // Матч за 3 место (упрощённо)
  if (withThird) {
    matches.push({
      id: matchId++,
      round: round,
      tournament_id: tournamentId,
      team1_id: -9999,
      team2_id: -9998,
      status: 'scheduled'
    });
  }

  return matches;
}

// ---------------------
// 7. Завершение турнира (PUT /:id/complete)
// ---------------------
router.put('/:id/complete', authMiddleware, async (req, res) => {
  // ...
});

// ---------------------
// 8. Редактирование турнира (PUT /:id)
// ---------------------
router.put('/:id', authMiddleware, async (req, res) => {
  // ...
});

module.exports = router;
