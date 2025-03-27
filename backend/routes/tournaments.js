// backend/routes/tournaments.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../notifications');
const { generateBracket } = require('../bracketGenerator'); // Импорт функции генерации сетки

// Получение списка всех турниров с количеством участников
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, 
                   CASE 
                     WHEN t.participant_type = 'solo' THEN (
                       SELECT COUNT(*) FROM tournament_participants tp WHERE tp.tournament_id = t.id
                     )
                     WHEN t.participant_type = 'team' THEN (
                       SELECT COUNT(*) FROM tournament_teams tt WHERE tt.tournament_id = t.id
                     )
                     ELSE 0
                   END AS participant_count
            FROM tournaments t
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения турниров:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получение списка игр
router.get('/games', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name FROM games');
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения списка игр:', err);
        res.status(500).json({ error: err.message });
    }
});

// Создание нового турнира
router.post('/', authenticateToken, async (req, res) => {
    const { name, game, format, participant_type, max_participants, start_date, description } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO tournaments (name, game, format, created_by, status, participant_type, max_participants, start_date, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [name, game, format, req.user.id, 'active', participant_type, max_participants || null, start_date || null, description || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка создания турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получение деталей турнира
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        const participantsQuery =
            tournament.participant_type === 'solo'
                ? 'SELECT * FROM tournament_participants WHERE tournament_id = $1'
                : 'SELECT * FROM tournament_teams WHERE tournament_id = $1';
        const participantsResult = await pool.query(participantsQuery, [id]);

        const matchesResult = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [id]
        );

        res.json({
            ...tournament,
            participants: participantsResult.rows,
            participant_count: participantsResult.rows.length,
            matches: matchesResult.rows,
        });
    } catch (err) {
        console.error('Ошибка получения деталей турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// Участие в турнире
router.post('/:id/participate', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { teamId, newTeamName } = req.body;

    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        // Проверка, сгенерирована ли сетка
        const matchesCheck = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1',
            [id]
        );
        if (matchesCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Нельзя участвовать в турнире после генерации сетки' });
        }

        const participantCountQuery =
            tournament.participant_type === 'solo'
                ? 'SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = $1'
                : 'SELECT COUNT(*) FROM tournament_teams WHERE tournament_id = $1';
        const participantCountResult = await pool.query(participantCountQuery, [id]);
        const participantCount = parseInt(participantCountResult.rows[0].count);

        if (tournament.max_participants && participantCount >= tournament.max_participants) {
            return res.status(400).json({ error: 'Лимит участников достигнут' });
        }

        const checkParticipationQuery =
            tournament.participant_type === 'solo'
                ? 'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2'
                : 'SELECT tt.* FROM tournament_teams tt JOIN tournament_team_members ttm ON tt.id = ttm.team_id WHERE tt.tournament_id = $1 AND ttm.user_id = $2';
        const checkResult = await pool.query(checkParticipationQuery, [id, userId]);
        if (checkResult.rows.length > 0) {
            return res.status(400).json({ error: 'Вы уже участвуете в этом турнире' });
        }

        if (tournament.participant_type === 'solo') {
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name) VALUES ($1, $2, $3)',
                [id, userId, req.user.username]
            );
        } else {
            let selectedTeamId;
            if (teamId) {
                const teamCheck = await pool.query(
                    'SELECT * FROM tournament_teams WHERE id = $1 AND creator_id = $2',
                    [teamId, userId]
                );
                if (teamCheck.rows.length === 0) {
                    return res.status(400).json({ error: 'Выбранная команда не найдена или не принадлежит вам' });
                }
                selectedTeamId = teamId;
            } else if (newTeamName) {
                const teamResult = await pool.query(
                    'INSERT INTO tournament_teams (tournament_id, name, creator_id) VALUES ($1, $2, $3) RETURNING id',
                    [id, newTeamName, userId]
                );
                selectedTeamId = teamResult.rows[0].id;
            } else {
                return res.status(400).json({ error: 'Укажите ID команды или название новой команды' });
            }

            await pool.query(
                'INSERT INTO tournament_team_members (team_id, user_id) VALUES ($1, $2)',
                [selectedTeamId, userId]
            );
        }

        const notificationMessage = `Пользователь ${req.user.username} зарегистрировался в вашем турнире "${tournament.name}"`;
        const notificationResult = await pool.query(
            'INSERT INTO notifications (user_id, message, type, tournament_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [tournament.created_by, notificationMessage, 'participant_added', id]
        );
        const notification = notificationResult.rows[0];

        sendNotification(tournament.created_by, {
            id: notification.id,
            user_id: tournament.created_by,
            message: notificationMessage,
            type: 'participant_added',
            tournament_id: id,
            created_at: new Date().toISOString(),
        });

        res.status(200).json({ message: 'Вы успешно зарегистрированы в турнире' });
    } catch (err) {
        console.error('Ошибка регистрации в турнире:', err);
        res.status(500).json({ error: err.message });
    }
});

// Отказ от участия в турнире
router.post('/:id/withdraw', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        // Проверка, сгенерирована ли сетка
        const matchesCheck = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1',
            [id]
        );
        if (matchesCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Нельзя отказаться от участия после генерации сетки' });
        }

        let deleted = false;
        if (tournament.participant_type === 'solo') {
            const deleteResult = await pool.query(
                'DELETE FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2 RETURNING *',
                [id, userId]
            );
            deleted = deleteResult.rowCount > 0;
        } else {
            const teamCheck = await pool.query(
                'SELECT tt.id FROM tournament_teams tt JOIN tournament_team_members ttm ON tt.id = ttm.team_id WHERE tt.tournament_id = $1 AND ttm.user_id = $2',
                [id, userId]
            );
            if (teamCheck.rows.length > 0) {
                const teamId = teamCheck.rows[0].id;
                await pool.query(
                    'DELETE FROM tournament_team_members WHERE team_id = $1 AND user_id = $2',
                    [teamId, userId]
                );
                const memberCount = await pool.query(
                    'SELECT COUNT(*) FROM tournament_team_members WHERE team_id = $1',
                    [teamId]
                );
                if (parseInt(memberCount.rows[0].count) === 0) {
                    await pool.query(
                        'DELETE FROM tournament_teams WHERE id = $1',
                        [teamId]
                    );
                }
                deleted = true;
            }
        }

        if (!deleted) {
            return res.status(400).json({ error: 'Вы не участвуете в этом турнире' });
        }

        const notificationMessage = `Пользователь ${req.user.username || userId} отказался от участия в вашем турнире "${tournament.name}"`;
        await pool.query(
            'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
            [tournament.created_by, notificationMessage, 'participant_withdrawn']
        );
        sendNotification(tournament.created_by, {
            user_id: tournament.created_by,
            message: notificationMessage,
            type: 'participant_withdrawn',
            created_at: new Date().toISOString(),
        });

        res.status(200).json({ message: 'Вы отказались от участия в турнире' });
    } catch (err) {
        console.error('Ошибка отказа от участия:', err);
        res.status(500).json({ error: err.message });
    }
});

// Ручное добавление участника (для solo и team)
router.post('/:id/add-participant', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { participantName } = req.body; // Только имя для неавторизованных
    const userId = req.user.id;

    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        // Проверка прав: создатель или администратор
        if (tournament.created_by !== userId) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [id, userId]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может добавлять участников' });
            }
        }

        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        // Проверка, сгенерирована ли сетка
        const matchesCheck = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1',
            [id]
        );
        if (matchesCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Нельзя добавлять участников после генерации сетки' });
        }

        const participantCountQuery =
            tournament.participant_type === 'solo'
                ? 'SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = $1'
                : 'SELECT COUNT(*) FROM tournament_teams WHERE tournament_id = $1';
        const participantCountResult = await pool.query(participantCountQuery, [id]);
        const participantCount = parseInt(participantCountResult.rows[0].count);

        if (tournament.max_participants && participantCount >= tournament.max_participants) {
            return res.status(400).json({ error: 'Лимит участников достигнут' });
        }

        if (!participantName) {
            return res.status(400).json({ error: 'Укажите имя участника' });
        }

        if (tournament.participant_type === 'solo') {
            // Добавление неавторизованного участника в solo-турнир
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name) VALUES ($1, $2, $3)',
                [id, null, participantName]
            );
        } else {
            // Добавление неавторизованного участника в team-турнир
            await pool.query(
                'INSERT INTO tournament_teams (tournament_id, name) VALUES ($1, $2) RETURNING id',
                [id, participantName]
            );
        }

        res.status(200).json({ message: 'Участник успешно добавлен' });
    } catch (err) {
        console.error('Ошибка добавления участника:', err);
        res.status(500).json({ error: err.message });
    }
});

// Приглашение на турнир
router.post('/:id/invite', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { username, email } = req.body; // Никнейм или email
    const creatorId = req.user.id;

    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.created_by !== creatorId) {
            return res.status(403).json({ error: 'Только создатель турнира может отправлять приглашения' });
        }

        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        if (!username && !email) {
            return res.status(400).json({ error: 'Укажите никнейм или email' });
        }
        if (username && email) {
            return res.status(400).json({ error: 'Укажите только один метод поиска: никнейм или email' });
        }

        let user;
        if (username) {
            const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Пользователь с таким никнеймом не найден' });
            }
            user = result.rows[0];
        } else if (email) {
            const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Пользователь с таким email не найден' });
            }
            user = result.rows[0];
        }

        const checkParticipationQuery =
            tournament.participant_type === 'solo'
                ? 'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2'
                : 'SELECT tt.* FROM tournament_teams tt JOIN tournament_team_members ttm ON tt.id = ttm.team_id WHERE tt.tournament_id = $1 AND ttm.user_id = $2';
        const checkResult = await pool.query(checkParticipationQuery, [id, user.id]);
        if (checkResult.rows.length > 0) {
            return res.status(400).json({ error: 'Этот пользователь уже участвует в турнире' });
        }

        const notificationMessage = `Вы приглашены в турнир "${tournament.name}" создателем ${req.user.username || creatorId}`;
        await pool.query(
            'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
            [user.id, notificationMessage, 'tournament_invite']
        );
        sendNotification(user.id, {
            user_id: user.id,
            message: notificationMessage,
            type: 'tournament_invite',
            tournament_id: id,
            created_at: new Date().toISOString(),
        });

        res.status(200).json({ message: `Приглашение отправлено пользователю ${user.username}` });
    } catch (err) {
        console.error('Ошибка отправки приглашения:', err);
        res.status(500).json({ error: err.message });
    }
});

// Запрос на администрирование турнира
router.post('/:id/request-admin', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.created_by === userId) {
            return res.status(400).json({ error: 'Вы уже являетесь создателем турнира' });
        }

        const adminCheck = await pool.query(
            'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [id, userId]
        );
        if (adminCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Вы уже администратор этого турнира' });
        }

        const requestCheck = await pool.query(
            'SELECT * FROM admin_requests WHERE tournament_id = $1 AND user_id = $2 AND status = $3',
            [id, userId, 'pending']
        );
        if (requestCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Запрос на администрирование уже отправлен' });
        }

        await pool.query(
            'INSERT INTO admin_requests (tournament_id, user_id) VALUES ($1, $2)',
            [id, userId]
        );

        const notificationMessage = `Пользователь ${req.user.username} запросил права администратора для турнира "${tournament.name}"`;
        const notificationResult = await pool.query(
            'INSERT INTO notifications (user_id, message, type, tournament_id, requester_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [tournament.created_by, notificationMessage, 'admin_request', id, userId]
        );
        const notification = notificationResult.rows[0];

        sendNotification(tournament.created_by, {
            id: notification.id,
            user_id: tournament.created_by,
            message: notificationMessage,
            type: 'admin_request',
            tournament_id: id,
            requester_id: userId,
            created_at: new Date().toISOString(),
        });

        res.status(200).json({ message: 'Запрос на администрирование отправлен' });
    } catch (err) {
        console.error('Ошибка запроса на администрирование:', err);
        res.status(500).json({ error: err.message });
    }
});

// Ответ на запрос администрирования (принять/отклонить)
router.post('/:id/respond-admin-request', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { requesterId, action } = req.body; // action: 'accept' или 'reject'
    const creatorId = req.user.id;

    if (!['accept', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Недопустимое действие: укажите "accept" или "reject"' });
    }

    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.created_by !== creatorId) {
            return res.status(403).json({ error: 'Только создатель турнира может отвечать на запросы' });
        }

        const requestResult = await pool.query(
            'SELECT * FROM admin_requests WHERE tournament_id = $1 AND user_id = $2 AND status = $3',
            [id, requesterId, 'pending']
        );
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Запрос не найден или уже обработан' });
        }

        const requesterResult = await pool.query('SELECT username FROM users WHERE id = $1', [requesterId]);
        if (requesterResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        const requesterUsername = requesterResult.rows[0].username;

        if (action === 'accept') {
            await pool.query(
                'INSERT INTO tournament_admins (tournament_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [id, requesterId]
            );
            await pool.query(
                'UPDATE admin_requests SET status = $1 WHERE tournament_id = $2 AND user_id = $3',
                ['accepted', id, requesterId]
            );

            const notificationMessage = `Ваш запрос на администрирование турнира "${tournament.name}" принят создателем ${req.user.username}`;
            await pool.query(
                'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
                [requesterId, notificationMessage, 'admin_request_accepted']
            );
            sendNotification(requesterId, {
                user_id: requesterId,
                message: notificationMessage,
                type: 'admin_request_accepted',
                tournament_id: id,
                created_at: new Date().toISOString(),
            });
        } else {
            await pool.query(
                'UPDATE admin_requests SET status = $1 WHERE tournament_id = $2 AND user_id = $3',
                ['rejected', id, requesterId]
            );

            const notificationMessage = `Ваш запрос на администрирование турнира "${tournament.name}" отклонён создателем ${req.user.username}`;
            await pool.query(
                'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
                [requesterId, notificationMessage, 'admin_request_rejected']
            );
            sendNotification(requesterId, {
                user_id: requesterId,
                message: notificationMessage,
                type: 'admin_request_rejected',
                tournament_id: id,
                created_at: new Date().toISOString(),
            });
        }

        res.status(200).json({ message: `Запрос на администрирование ${action === 'accept' ? 'принят' : 'отклонён'}` });
    } catch (err) {
        console.error('Ошибка обработки запроса на администрирование:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получение статуса запроса на администрирование
router.get('/:id/admin-request-status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        const adminCheck = await pool.query(
            'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [id, userId]
        );
        if (adminCheck.rows.length > 0) {
            return res.json({ status: 'accepted' });
        }

        const requestCheck = await pool.query(
            'SELECT status FROM admin_requests WHERE tournament_id = $1 AND user_id = $2',
            [id, userId]
        );
        if (requestCheck.rows.length > 0) {
            return res.json({ status: requestCheck.rows[0].status });
        }

        return res.json({ status: null });
    } catch (err) {
        console.error('Ошибка получения статуса запроса:', err);
        res.status(500).json({ error: err.message });
    }
});

// Генерация турнирной сетки
router.post('/:id/generate-bracket', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { thirdPlaceMatch } = req.body;
    const userId = req.user.id;

    try {
        // Проверка турнира и прав доступа
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.created_by !== userId) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [id, userId]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может генерировать сетку' });
            }
        }

        // Проверка, что сетка ещё не сгенерирована
        const existingMatches = await pool.query('SELECT * FROM matches WHERE tournament_id = $1', [id]);
        if (existingMatches.rows.length > 0) {
            return res.status(400).json({ error: 'Сетка уже сгенерирована' });
        }

        // Получение участников в зависимости от типа турнира
        let participants;
        if (tournament.participant_type === 'solo') {
            const participantsResult = await pool.query(
                'SELECT id, name FROM tournament_participants WHERE tournament_id = $1',
                [id]
            );
            participants = participantsResult.rows;
        } else {
            const participantsResult = await pool.query(
                'SELECT id, name FROM tournament_teams WHERE tournament_id = $1',
                [id]
            );
            participants = participantsResult.rows;
        }

        if (participants.length < 2) {
            return res.status(400).json({ error: 'Недостаточно участников для генерации сетки' });
        }

        // Генерация сетки с использованием модуля bracketGenerator
        const matches = await generateBracket(tournament.format, id, participants, thirdPlaceMatch);

        // Получаем обновлённые данные турнира
        const updatedTournamentResult = await pool.query(
            'SELECT t.*, ' +
            'COALESCE((SELECT json_agg(tp.*) FROM tournament_participants tp WHERE tp.tournament_id = t.id), \'[]\') as participants, ' +
            'COALESCE((SELECT json_agg(m.*) FROM matches m WHERE m.tournament_id = t.id), \'[]\') as matches ' +
            'FROM tournaments t WHERE t.id = $1 GROUP BY t.id',
            [id]
        );

        const tournamentData = updatedTournamentResult.rows[0];
        tournamentData.matches = Array.isArray(tournamentData.matches) ? tournamentData.matches : [];
        tournamentData.participants = Array.isArray(tournamentData.participants) ? tournamentData.participants : [];

        res.status(200).json({ message: 'Сетка успешно сгенерирована', tournament: tournamentData });
    } catch (err) {
        console.error('Ошибка генерации сетки:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обновление результата матча
router.post('/:id/update-match', authenticateToken, async (req, res) => {
    const { id } = req.params;
    let { matchId, winner_team_id, score1, score2 } = req.body;
    const userId = req.user.id;

    try {
        // Преобразуем matchId и winner_team_id в числа
        matchId = Number(matchId);
        winner_team_id = winner_team_id ? Number(winner_team_id) : null;

        // Проверка турнира и прав доступа
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.created_by !== userId) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [id, userId]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может обновлять результаты' });
            }
        }

        // Получение данных текущего матча
        const matchResult = await pool.query('SELECT * FROM matches WHERE id = $1 AND tournament_id = $2', [matchId, id]);
        if (matchResult.rows.length === 0) {
            return res.status(400).json({ error: 'Матч не найден' });
        }
        const match = matchResult.rows[0];

        if (match.winner_team_id && match.winner_team_id === winner_team_id) {
            return res.status(400).json({ error: 'Этот победитель уже установлен' });
        }

        // Проверка, что winner_team_id является одним из участников матча
        if (winner_team_id && ![match.team1_id, match.team2_id].includes(winner_team_id)) {
            return res.status(400).json({ error: 'Победитель должен быть одним из участников матча' });
        }

        // Обновление результата текущего матча
        await pool.query(
            'UPDATE matches SET winner_team_id = $1, score1 = $2, score2 = $3 WHERE id = $4',
            [winner_team_id, score1, score2, matchId]
        );

        // Определяем проигравшего
        const loser_team_id = match.team1_id === winner_team_id ? match.team2_id : match.team1_id;

        // Логика для предварительного раунда (раунд -1)
        if (match.round === -1 && match.next_match_id) {
            const nextMatchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [match.next_match_id]);
            if (nextMatchResult.rows.length === 0) {
                return res.status(400).json({ error: 'Целевой матч не найден' });
            }

            const nextMatch = nextMatchResult.rows[0];

            if (!nextMatch.team1_id) {
                await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
            } else if (!nextMatch.team2_id && nextMatch.team1_id !== winner_team_id) {
                await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
            } else {
                const round0Matches = await pool.query(
                    'SELECT * FROM matches WHERE tournament_id = $1 AND round = 0 AND bracket_type = $2',
                    [id, 'winner']
                );
                const availableMatch = round0Matches.rows.find(m => !m.team2_id && m.team1_id !== winner_team_id);
                if (availableMatch) {
                    await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, availableMatch.id]);
                    await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [availableMatch.id, match.id]);
                } else {
                    return res.status(400).json({ error: 'Нет доступных мест в основном раунде' });
                }
            }

            // Корректируем next_match_id для оставшихся матчей предварительного раунда
            const remainingPrelimMatches = await pool.query(
                'SELECT * FROM matches WHERE tournament_id = $1 AND round = -1 AND winner_team_id IS NULL',
                [id]
            );
            const round0Matches = await pool.query(
                'SELECT * FROM matches WHERE tournament_id = $1 AND round = 0 AND bracket_type = $2',
                [id, 'winner']
            );

            for (const prelimMatch of remainingPrelimMatches.rows) {
                if (prelimMatch.id === match.id) continue;
                const availableMatch = round0Matches.rows.find(m => !m.team2_id);
                if (availableMatch) {
                    await pool.query(
                        'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                        [availableMatch.id, prelimMatch.id]
                    );
                    console.log(`Корректировка next_match_id для матча ${prelimMatch.match_number}: -> Match ${availableMatch.match_number}`);
                }
            }
        }

        // Логика для Double Elimination
        if (tournament.format === 'double_elimination') {
            if (match.round !== -1 && match.next_match_id) {
                const nextMatchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [match.next_match_id]);
                if (nextMatchResult.rows.length > 0) {
                    const nextMatch = nextMatchResult.rows[0];

                    // Проверяем, не добавлен ли победитель уже в следующий матч
                    if (nextMatch.team1_id === winner_team_id || nextMatch.team2_id === winner_team_id) {
                        console.log(`Победитель (team ${winner_team_id}) уже добавлен в матч ${nextMatch.id}`);
                    } else if (!nextMatch.team1_id) {
                        await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    } else if (!nextMatch.team2_id && nextMatch.team1_id !== winner_team_id) {
                        await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    } else if (nextMatch.team1_id === nextMatch.team2_id) {
                        await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    } else {
                        const roundMatches = await pool.query(
                            'SELECT * FROM matches WHERE tournament_id = $1 AND round = $2 AND bracket_type = $3',
                            [id, match.round + 1, 'winner']
                        );
                        const availableMatch = roundMatches.rows.find(m => !m.team2_id && m.team1_id !== winner_team_id);
                        if (availableMatch) {
                            await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, availableMatch.id]);
                            await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [availableMatch.id, match.id]);
                        } else {
                            return res.status(400).json({ error: 'Нет доступных мест в верхней сетке' });
                        }
                    }
                }
            }

            // Проигравший переходит в нижнюю сетку или выбывает
            if (loser_team_id) {
                if (match.bracket_type === 'winner') {
                    // Проигравший из верхней сетки переходит в нижнюю
                    let targetLoserRound;
                    const totalWinnerRounds = Math.ceil(Math.log2(6)); // Для 6 участников: 3 раунда (0, 1, 2)
                    const totalLoserRounds = totalWinnerRounds + 1; // 4 раунда (1, 2, 3, 4)

                    if (match.round === -1) {
                        targetLoserRound = 1;
                    } else if (match.round === totalWinnerRounds - 1) {
                        // Проигравший из финала верхней сетки (Round 2) должен попасть в финал нижней сетки (Round 4)
                        targetLoserRound = totalLoserRounds;
                    } else {
                        // Проигравшие из Round 0 верхней сетки -> Round 1 нижней, Round 1 верхней -> Round 2 нижней и т.д.
                        targetLoserRound = match.round + 1;
                    }

                    let loserMatches = await pool.query(
                        'SELECT * FROM matches WHERE tournament_id = $1 AND bracket_type = $2 AND round = $3 AND is_third_place_match = false',
                        [id, 'loser', targetLoserRound]
                    );

                    let availableLoserMatch = loserMatches.rows.find(m => (!m.team1_id || !m.team2_id) && m.team1_id !== loser_team_id && m.team2_id !== loser_team_id);

                    if (!availableLoserMatch) {
                        const maxMatchNumberResult = await pool.query(
                            'SELECT COALESCE(MAX(match_number), 0) as max_match_number FROM matches WHERE tournament_id = $1 AND bracket_type = $2 AND round = $3',
                            [id, 'loser', targetLoserRound]
                        );
                        const maxMatchNumber = maxMatchNumberResult.rows[0].max_match_number;

                        const newMatchResult = await pool.query(
                            'INSERT INTO matches (tournament_id, round, match_number, bracket_type, team1_id, team2_id, match_date) ' +
                            'VALUES ($1, $2, $3, $4, $5, NULL, NOW()) RETURNING *',
                            [id, targetLoserRound, maxMatchNumber + 1, 'loser', loser_team_id]
                        );
                        availableLoserMatch = newMatchResult.rows[0];
                        console.log(`Создан новый матч ${availableLoserMatch.id} в раунде ${targetLoserRound} сетки лузеров для проигравшего (team ${loser_team_id})`);
                    } else {
                        if (!availableLoserMatch.team1_id) {
                            await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [loser_team_id, availableLoserMatch.id]);
                        } else {
                            await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [loser_team_id, availableLoserMatch.id]);
                        }
                        console.log(`Проигравший (team ${loser_team_id}) из раунда ${match.round} верхней сетки добавлен в матч ${availableLoserMatch.id} раунда ${targetLoserRound} сетки лузеров`);
                    }
                } else if (match.bracket_type === 'loser') {
                    // Проигравший из нижней сетки выбывает из турнира
                    console.log(`Проигравший (team ${loser_team_id}) из матча ${match.id} нижней сетки выбывает из турнира`);
                }
            }
        }

        // Получаем обновлённые данные турнира
        const updatedTournament = await pool.query(
            'SELECT t.*, COALESCE(array_agg(p.*), \'{}\') as participants, COALESCE(array_agg(m.*), \'{}\') as matches ' +
            'FROM tournaments t ' +
            'LEFT JOIN tournament_participants p ON t.id = p.tournament_id ' +
            'LEFT JOIN matches m ON t.id = m.tournament_id ' +
            'WHERE t.id = $1 ' +
            'GROUP BY t.id',
            [id]
        );

        const tournamentData = updatedTournament.rows[0] || {};
        tournamentData.matches = Array.isArray(tournamentData.matches) && tournamentData.matches[0] !== null 
            ? tournamentData.matches 
            : [];
        tournamentData.participants = Array.isArray(tournamentData.participants) && tournamentData.participants[0] !== null 
            ? tournamentData.participants 
            : [];

        res.status(200).json({ message: 'Результат обновлён', tournament: tournamentData });
    } catch (err) {
        console.error('Ошибка обновления матча:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;