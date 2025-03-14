/**
 * routes/tournaments.js
 *
 * Этот модуль определяет маршруты для работы с турнирами.
 * Реализованы:
 * 1. GET /api/tournaments                - Получение списка всех турниров.
 * 2. GET /api/tournaments/:id            - Получение деталей турнира по ID.
 * 3. POST /api/tournaments               - Создание нового турнира.
 * 4. GET /api/tournaments/:id/participants - Получение списка участников турнира.
 * 5. POST /api/tournaments/:id/participants - Добавление участника к турниру.
 */

const express = require('express');
const router = express.Router();
const pool = require('../db'); // Подключение к базе данных
const authenticateToken = require('../middleware/authMiddleware');
const checkTournamentAdmin = require('../middleware/authAdmin');

// Получение турниров пользователя
router.get('/myTournaments', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Получение турниров для пользователя:', userId);
        const result = await pool.query('SELECT * FROM tournaments WHERE created_by = $1', [userId]);
        res.json({ tournaments: result.rows });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// 1) Получение списка всех турниров
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tournaments ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка при получении турниров:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// 2) Получение деталей турнира по ID
router.get('/:id', async (req, res) => {
    const tournamentId = parseInt(req.params.id, 10); // Преобразуем ID в число
    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Некорректный ID турнира' });
    }

    try {
        const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при получении турнира:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// 3) Создание нового турнира
router.post('/', async (req, res) => {
    const { name, description, game, type, created_by } = req.body;
    if (!name || !game || !type) {
        return res.status(400).json({ message: 'Не все необходимые поля заполнены' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO tournaments (name, description, game, type, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, description, game, type, created_by]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при создании турнира:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// 4) Получение списка участников турнира
router.get('/:id/participants', async (req, res) => {
    const tournamentId = parseInt(req.params.id, 10); // Преобразуем строку в число
    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Некорректный ID турнира' });
    }
    try {
        const result = await pool.query(
            'SELECT * FROM tournament_participants WHERE tournament_id = $1 ORDER BY user_id ASC',
            [tournamentId]
        );
        res.json({ participants: result.rows });
    } catch (error) {
        console.error('Ошибка при получении участников:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// 5) Добавление участника к турниру
// routes/tournaments.js
router.post('/:id/participants', checkTournamentAdmin, async (req, res) => {
    const tournamentId = parseInt(req.params.id, 10);
    const { userId, name, teamId } = req.body; // Получаем userId, name и teamId из тела запроса

    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Некорректный ID турнира' });
    }
    if (!name && !userId && !teamId) {
        return res.status(400).json({ error: 'Необходимо указать хотя бы имя, userId или teamId' });
    }

    try {
        // Проверка существования турнира
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Если указан userId, проверяем существование пользователя
        if (userId) {
            const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
        }

        // Если указан teamId, проверяем существование команды
        if (teamId) {
            const teamResult = await pool.query('SELECT * FROM tournament_teams WHERE id = $1', [teamId]);
            if (teamResult.rows.length === 0) {
                return res.status(404).json({ error: 'Команда не найдена' });
            }
        }

        // Добавление участника
        const result = await pool.query(
            'INSERT INTO tournament_participants (tournament_id, user_id, name, team_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [tournamentId, userId || null, name || (userId ? `User_${userId}` : `Team_${teamId}`), teamId || null]
        );

        res.status(201).json({ message: 'Участник добавлен', participant: result.rows[0] });
    } catch (error) {
        console.error('Ошибка при добавлении участника:', error);
        res.status(500).json({ error: 'Ошибка сервера при добавлении участника' });
    }
});

// Получение списка матчей для турнира
router.get('/:id/matches', async (req, res) => {
    const tournamentId = parseInt(req.params.id, 10);
    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Некорректный ID турнира' });
    }
    try {
        const result = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY id ASC',
            [tournamentId]
        );
        res.json({ matches: result.rows });
    } catch (error) {
        console.error('Ошибка при получении матчей:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

module.exports = router;