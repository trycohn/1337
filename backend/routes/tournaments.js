// backend/routes/tournaments.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, restrictTo, verifyEmailRequired, verifyAdminOrCreator } = require('../middleware/auth');
const { sendNotification, broadcastTournamentUpdate } = require('../notifications');
const { generateBracket } = require('../bracketGenerator');

// 🔧 ВРЕМЕННАЯ ЗАГЛУШКА ДЛЯ ФУНКЦИЙ ЧАТА
const sendTournamentChatAnnouncement = async (tourName, message, tournamentId) => {
    console.log(`📢 [CHAT] Турнир "${tourName}": ${message}`);
    // TODO: Реализовать отправку в чат турнира
};

const addUserToTournamentChat = async (tourName, userId, isAdmin = false) => {
    console.log(`➕ [CHAT] Добавляем пользователя ${userId} в чат турнира "${tourName}"`);
    // TODO: Реализовать добавление в чат турнира
};

// Вспомогательная функция для записи событий в журнал турнира
async function logTournamentEvent(tournamentId, userId, eventType, eventData = {}) {
    try {
        console.log('📊 Записываем событие в tournament_logs:', {
            tournamentId,
            userId,
            eventType,
            eventData
        });
        
        // Проверяем, что tournament_logs таблица существует
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tournament_logs'
            );
        `);
        
        if (!tableExists.rows[0].exists) {
            console.error('❌ Таблица tournament_logs не существует!');
            return;
        }
        
        const result = await pool.query(
            `INSERT INTO tournament_logs (tournament_id, user_id, event_type, event_data)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [tournamentId, userId, eventType, eventData] // Передаем объект напрямую для jsonb
        );
        
        console.log('✅ Событие записано в tournament_logs, ID:', result.rows[0].id);
    } catch (error) {
        console.error('❌ Ошибка при записи в журнал турнира:', error);
        console.error('❌ Подробности ошибки logTournamentEvent:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            tournamentId,
            userId,
            eventType,
            eventData
        });
        // Не выбрасываем ошибку, чтобы не нарушить основной флоу
    }
}

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
        console.log('🔍 Tournaments fetched:', result.rows);
        res.json(result.rows); // Убедились, что возвращается массив
    } catch (err) {
        console.error('❌ Ошибка получения турниров:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получение списка игр
router.get('/games', async (req, res) => {
    console.log('🔍 Запрос к /api/tournaments/games получен');
    try {
        const result = await pool.query('SELECT id, name FROM games');
        console.log('🔍 Games fetched:', result.rows);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Ошибка получения списка игр:', err);
        res.status(500).json({ error: err.message });
    }
});

// Создание нового турнира
router.post('/', authenticateToken, verifyEmailRequired, async (req, res) => {
    const { name, game, format, participant_type, max_participants, start_date, description, bracket_type, team_size } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO tournaments
             (name, game, format, created_by, status, participant_type, max_participants, start_date, description, bracket_type, team_size)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [name, game, format, req.user.id, 'active', participant_type, max_participants || null, start_date || null, description || null, bracket_type || null, team_size || 1]
        );
        const tournament = result.rows[0];
        console.log('🔍 Tournament created:', result.rows[0]);
        
        // Логируем создание турнира
        await logTournamentEvent(tournament.id, req.user.id, 'tournament_created', {
            name: tournament.name,
            game: tournament.game,
            format: tournament.format
        });
        
        // Создаем групповой чат для турнира с названием турнира
        try {
            const chatRes = await pool.query(
                'INSERT INTO chats (name, type) VALUES ($1, $2) RETURNING id',
                [tournament.name, 'group']
            );
            const tournamentChatId = chatRes.rows[0].id;
            // Добавляем создателя турнира как администратора чата
            await pool.query(
                'INSERT INTO chat_participants (chat_id, user_id, is_admin) VALUES ($1, $2, $3)',
                [tournamentChatId, req.user.id, true]
            );
            console.log(`Создан групповой чат ${tournamentChatId} для турнира ${tournament.name}`);
        } catch (err) {
            console.error('❌ Ошибка при создании группового чата турнира:', err);
        }
        res.status(201).json(tournament);
    } catch (err) {
        console.error('❌ Ошибка создания турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получение деталей турнира
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 🔧 ИСПРАВЛЕННЫЙ ЗАПРОС: добавляем JOIN с таблицей users для получения данных создателя
        const tournamentResult = await pool.query(`
            SELECT t.*, 
                   u.username as creator_username, 
                   u.avatar_url as creator_avatar_url,
                   u.id as creator_user_id
            FROM tournaments t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.id = $1
        `, [id]);
        
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Турнир не найден' });
        }
        
        const tournament = tournamentResult.rows[0];

        // 🆕 ПОЛУЧАЕМ ДАННЫЕ АДМИНИСТРАТОРОВ ТУРНИРА
        const adminsResult = await pool.query(`
            SELECT ta.id, ta.user_id, ta.permissions, ta.created_at,
                   u.username, u.avatar_url
            FROM tournament_admins ta
            JOIN users u ON ta.user_id = u.id
            WHERE ta.tournament_id = $1
            ORDER BY ta.created_at ASC
        `, [id]);

        console.log('🔍 DEBUG: Данные турнира с создателем:', {
            tournament_id: tournament.id,
            tournament_name: tournament.name,
            created_by: tournament.created_by,
            creator_username: tournament.creator_username,
            creator_avatar_url: tournament.creator_avatar_url,
            admins_count: adminsResult.rows.length
        });

        // Получаем данные участников в зависимости от типа турнира, добавляя информацию о аватарке
        let participantsQuery;
        if (tournament.participant_type === 'solo') {
            participantsQuery = `
                SELECT tp.*, tp.faceit_elo, tp.cs2_premier_rank, tp.in_team,
                       u.avatar_url, u.username, 
                       COALESCE(tp.faceit_elo, u.faceit_elo) as faceit_elo_combined,
                       COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank) as cs2_premier_rank_combined
                FROM tournament_participants tp 
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tp.tournament_id = $1
                ORDER BY tp.created_at ASC
            `;
        } else {
            participantsQuery = `
                SELECT tt.*, u.avatar_url, u.username
                FROM tournament_teams tt
                LEFT JOIN users u ON tt.creator_id = u.id
                WHERE tt.tournament_id = $1
                ORDER BY tt.id ASC
            `;
        }
        
        const participantsResult = await pool.query(participantsQuery, [id]);

        const matchesResult = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [id]
        );

        // 🔍 Диагностика данных карт при загрузке турнира
        const matchesWithMaps = matchesResult.rows.filter(match => match.maps_data);
        if (matchesWithMaps.length > 0) {
            console.log(`🔍 DEBUG: Турнир ${id} - найдено ${matchesWithMaps.length} матчей с данными карт:`);
            matchesWithMaps.slice(0, 3).forEach(match => {
                console.log(`- Матч ${match.id}: maps_data = ${typeof match.maps_data === 'string' ? match.maps_data.substring(0, 100) + '...' : match.maps_data}`);
            });
        } else {
            console.log(`ℹ️ DEBUG: Турнир ${id} - матчей с данными карт не найдено`);
        }

        // Для командных турниров И микс турниров загружаем команды с участниками
        let teams = [];
        if (tournament.participant_type === 'team' || tournament.format === 'mix') {
            // Получаем все команды турнира
            const teamsRes = await pool.query(
                `SELECT tt.id, tt.tournament_id, tt.name, tt.creator_id
                 FROM tournament_teams tt
                 WHERE tt.tournament_id = $1`,
                [id]
            );

            // Для каждой команды получаем участников
            teams = await Promise.all(teamsRes.rows.map(async (team) => {
                const membersRes = await pool.query(
                    `SELECT tm.team_id, tm.user_id, tm.participant_id, 
                            tp.name, u.username, u.avatar_url, 
                            tp.faceit_elo as tp_faceit_elo, tp.cs2_premier_rank as tp_cs2_premier_rank,
                            u.faceit_elo as user_faceit_elo, u.cs2_premier_rank as user_cs2_premier_rank,
                            COALESCE(tp.faceit_elo, u.faceit_elo, 1000) as faceit_elo,
                            COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank, 5) as cs2_premier_rank
                     FROM tournament_team_members tm
                     LEFT JOIN tournament_participants tp ON tm.participant_id = tp.id
                     LEFT JOIN users u ON tm.user_id = u.id
                     WHERE tm.team_id = $1`,
                    [team.id]
                );

                return {
                    ...team,
                    members: membersRes.rows
                };
            }));
        }

        const responseData = {
            ...tournament,
            participants: participantsResult.rows,
            participant_count: participantsResult.rows.length,
            matches: matchesResult.rows,
            teams: teams, // Команды теперь загружаются и для микс турниров
            mixed_teams: teams, // Добавляем поле mixed_teams для обратной совместимости
            admins: adminsResult.rows // 🆕 Добавляем список администраторов
        };
        console.log('🔍 Tournament details fetched:', {
            name: responseData.name,
            format: responseData.format,
            participant_type: responseData.participant_type,
            participants: responseData.participants.length,
            matches: responseData.matches.length,
            teams: responseData.teams.length,
            creator: responseData.creator_username,
            admins: responseData.admins.length
        });
        res.json(responseData);
    } catch (err) {
        console.error('❌ Ошибка получения деталей турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// Начало турнира (изменение статуса на in_progress)
router.post('/:id/start', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    
    try {
        // Проверка существования турнира
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        const tournament = tournamentResult.rows[0];
        
        // Проверка текущего статуса
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Можно начать только активный турнир' });
        }
        
        // Проверка наличия сгенерированной сетки
        const matchesResult = await pool.query('SELECT COUNT(*) FROM matches WHERE tournament_id = $1', [id]);
        if (parseInt(matchesResult.rows[0].count) === 0) {
            return res.status(400).json({ error: 'Перед началом турнира необходимо сгенерировать сетку' });
        }
        
        // Изменение статуса турнира
        const updateResult = await pool.query(
            'UPDATE tournaments SET status = $1 WHERE id = $2 RETURNING *',
            ['in_progress', id]
        );
        
        // Получаем обновленные данные турнира
        const updatedTournament = updateResult.rows[0];
        
        // Получаем данные участников
        let participantsQuery;
        if (updatedTournament.participant_type === 'solo') {
            participantsQuery = `
                SELECT tp.*, tp.faceit_elo, tp.cs2_premier_rank, tp.in_team,
                       u.avatar_url, u.username, 
                       COALESCE(tp.faceit_elo, u.faceit_elo) as faceit_elo_combined,
                       COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank) as cs2_premier_rank_combined
                FROM tournament_participants tp 
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tp.tournament_id = $1
                ORDER BY tp.created_at ASC
            `;
        } else {
            participantsQuery = `
                SELECT tt.*, u.avatar_url, u.username
                FROM tournament_teams tt
                LEFT JOIN users u ON tt.creator_id = u.id
                WHERE tt.tournament_id = $1
                ORDER BY tt.id ASC
            `;
        }
        
        const participantsResult = await pool.query(participantsQuery, [id]);
        
        // Получаем матчи
        const matchesResult2 = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [id]
        );
        
        // Для командных турниров загружаем команды с участниками
        let teams = [];
        if (updatedTournament.participant_type === 'team') {
            // Получаем все команды турнира
            const teamsRes = await pool.query(
                `SELECT tt.id, tt.tournament_id, tt.name, tt.creator_id
                 FROM tournament_teams tt
                 WHERE tt.tournament_id = $1`,
                [id]
            );

            // Для каждой команды получаем участников
            teams = await Promise.all(teamsRes.rows.map(async (team) => {
                const membersRes = await pool.query(
                    `SELECT tm.team_id, tm.user_id, tm.participant_id, 
                            tp.name, u.username, u.avatar_url, 
                            tp.faceit_elo as tp_faceit_elo, tp.cs2_premier_rank as tp_cs2_premier_rank,
                            u.faceit_elo as user_faceit_elo, u.cs2_premier_rank as user_cs2_premier_rank,
                            COALESCE(tp.faceit_elo, u.faceit_elo, 1000) as faceit_elo,
                            COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank, 5) as cs2_premier_rank
                     FROM tournament_team_members tm
                     LEFT JOIN tournament_participants tp ON tm.participant_id = tp.id
                     LEFT JOIN users u ON tm.user_id = u.id
                     WHERE tm.team_id = $1`,
                    [team.id]
                );

                return {
                    ...team,
                    members: membersRes.rows
                };
            }));
        }
        
        const responseData = {
            ...updatedTournament,
            participants: participantsResult.rows,
            participant_count: participantsResult.rows.length,
            matches: matchesResult2.rows,
            teams: teams, // Добавляем команды в ответ
            mixed_teams: teams, // Добавляем поле mixed_teams для обратной совместимости
            admins: adminsResult.rows // 🆕 Добавляем список администраторов
        };
        
        // Отправляем обновление через WebSocket
        broadcastTournamentUpdate(id, responseData);
        
        // Логируем старт турнира
        await logTournamentEvent(id, req.user.id, 'tournament_started', {
            participantCount: participantsResult.rows.length
        });
        
        // Отправляем объявление в чат турнира о начале
        await sendTournamentChatAnnouncement(
            updatedTournament.name,
            `Турнир "${updatedTournament.name}" начат`,
            id
        );
        
        // Возвращаем успешный ответ
        res.status(200).json({
            message: 'Турнир успешно начат',
            tournament: responseData
        });
    } catch (err) {
        console.error('❌ Ошибка при начале турнира:', err);
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

        // 🆕 ИСПРАВЛЕННАЯ ЛОГИКА ДЛЯ МИКС ТУРНИРОВ
        // Для микс турниров ВСЕГДА добавляем в tournament_participants, даже если participant_type = 'team'
        if (tournament.format === 'mix') {
            console.log(`🎯 Пользователь ${req.user.username} (ID: ${userId}) участвует в микс турнире ${id}`);
            
            // 🆕 ПОЛУЧАЕМ РЕЙТИНГИ ПОЛЬЗОВАТЕЛЯ ИЗ ПРОФИЛЯ
            const userResult = await pool.query('SELECT faceit_elo, cs2_premier_rank FROM users WHERE id = $1', [userId]);
            const userRatings = userResult.rows[0] || {};
            
            // Добавляем участника в tournament_participants с флагом in_team = false и рейтингами
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name, in_team, faceit_elo, cs2_premier_rank) VALUES ($1, $2, $3, $4, $5, $6)',
                [id, userId, req.user.username, false, userRatings.faceit_elo || null, userRatings.cs2_premier_rank || null]
            );
            
            console.log(`✅ Участник ${req.user.username} добавлен в микс турнир как индивидуальный игрок (не в команде) с рейтингами`);
            
        } else if (tournament.participant_type === 'solo') {
            // 🆕 ПОЛУЧАЕМ РЕЙТИНГИ ПОЛЬЗОВАТЕЛЯ ИЗ ПРОФИЛЯ ДЛЯ SOLO ТУРНИРОВ
            const userResult = await pool.query('SELECT faceit_elo, cs2_premier_rank FROM users WHERE id = $1', [userId]);
            const userRatings = userResult.rows[0] || {};
            
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name, faceit_elo, cs2_premier_rank) VALUES ($1, $2, $3, $4, $5)',
                [id, userId, req.user.username, userRatings.faceit_elo || null, userRatings.cs2_premier_rank || null]
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

        // Логируем регистрацию участника
        await logTournamentEvent(id, req.user.id, 'participant_joined', {
            username: req.user.username,
            participationType: tournament.participant_type,
            teamName: newTeamName || null
        });

        // Добавляем пользователя в чат турнира и отправляем объявление
        await addUserToTournamentChat(tournament.name, req.user.id, false);
        await sendTournamentChatAnnouncement(
            tournament.name,
            `Пользователь ${req.user.username} зарегистрировался в турнире "${tournament.name}"`,
            id
        );

        res.status(200).json({ message: 'Вы успешно зарегистрированы в турнире' });
    } catch (err) {
        console.error('❌ Ошибка регистрации в турнире:', err);
        res.status(500).json({ error: err.message });
    }
});

// Отказ от участия в турнире
router.post('/:id/withdraw', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        console.log(`🚪 Запрос на отказ от участия в турнире ${id} от пользователя ${userId}`);
        
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        // Разрешаем отказ только для активных турниров и турниров в процессе
        if (!['active', 'in_progress'].includes(tournament.status)) {
            return res.status(400).json({ 
                error: 'Отказ от участия возможен только в активных турнирах или турнирах в процессе' 
            });
        }

        // Проверяем участие пользователя в турнире
        let participantInfo = null;
        if (tournament.participant_type === 'solo') {
            const participantResult = await pool.query(
                'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
                [id, userId]
            );
            if (participantResult.rows.length === 0) {
                return res.status(400).json({ error: 'Вы не участвуете в этом турнире' });
            }
            participantInfo = participantResult.rows[0];
        } else {
            const teamCheck = await pool.query(
                'SELECT tt.id, tt.name FROM tournament_teams tt JOIN tournament_team_members ttm ON tt.id = ttm.team_id WHERE tt.tournament_id = $1 AND ttm.user_id = $2',
                [id, userId]
            );
            if (teamCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Вы не участвуете в этом турнире' });
            }
            participantInfo = teamCheck.rows[0];
        }

        // Если турнир в процессе, назначаем поражения в несыгранных матчах
        if (tournament.status === 'in_progress') {
            console.log(`⚠️ Турнир в процессе: назначаем поражения в несыгранных матчах для участника ${userId}`);
            
            if (tournament.participant_type === 'solo') {
                // Найти все несыгранные матчи участника
                const unfinishedMatches = await pool.query(`
                    SELECT m.*, 
                           tp1.name as participant1_name, tp1.user_id as participant1_user_id,
                           tp2.name as participant2_name, tp2.user_id as participant2_user_id
                    FROM matches m
                    LEFT JOIN tournament_participants tp1 ON m.participant1_id = tp1.id
                    LEFT JOIN tournament_participants tp2 ON m.participant2_id = tp2.id
                    WHERE m.tournament_id = $1 
                    AND (tp1.user_id = $2 OR tp2.user_id = $2)
                    AND m.status = 'pending'
                `, [id, userId]);

                console.log(`🎯 Найдено ${unfinishedMatches.rows.length} несыгранных матчей`);

                // Назначаем поражения в каждом матче
                for (const match of unfinishedMatches.rows) {
                    const isParticipant1 = match.participant1_user_id === userId;
                    const winnerId = isParticipant1 ? match.participant2_id : match.participant1_id;
                    const loserId = isParticipant1 ? match.participant1_id : match.participant2_id;
                    
                    console.log(`⚔️ Назначаем техническое поражение в матче ${match.id}: участник ${userId} проигрывает`);
                    
                    // Обновляем результат матча
                    await pool.query(`
                        UPDATE matches 
                        SET winner_team_id = $1, 
                            status = 'completed',
                            updated_at = NOW(),
                            score = $2
                        WHERE id = $3
                    `, [winnerId, 'Техническое поражение (отказ от участия)', match.id]);

                    // Логируем событие
                    await logTournamentEvent(id, userId, 'technical_loss', {
                        match_id: match.id,
                        reason: 'participant_withdrawal'
                    });

                    // Уведомляем сопернику о технической победе
                    const opponentId = isParticipant1 ? match.participant2_user_id : match.participant1_user_id;
                    if (opponentId) {
                        const opponentNotificationMessage = `Вам засчитана техническая победа в турнире "${tournament.name}" из-за отказа соперника от участия`;
                        await pool.query(
                            'INSERT INTO notifications (user_id, message, type, tournament_id) VALUES ($1, $2, $3, $4)',
                            [opponentId, opponentNotificationMessage, 'technical_victory', id]
                        );
                        sendNotification(opponentId, {
                            user_id: opponentId,
                            message: opponentNotificationMessage,
                            type: 'technical_victory',
                            tournament_id: id,
                            created_at: new Date().toISOString(),
                        });
                    }
                }
            }
            // Для командных турниров в будущем можно добавить аналогичную логику
        }

        // Удаляем участника из турнира
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
            return res.status(400).json({ error: 'Ошибка при удалении участника' });
        }

        // Логируем событие отказа от участия
        await logTournamentEvent(id, userId, 'participant_withdrawn', {
            tournament_status: tournament.status,
            had_technical_losses: tournament.status === 'in_progress'
        });

        // Уведомление создателю турнира
        const statusText = tournament.status === 'in_progress' ? ' (с назначением поражений в несыгранных матчах)' : '';
        const notificationMessage = `Пользователь ${req.user.username || userId} отказался от участия в вашем турнире "${tournament.name}"${statusText}`;
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

        const responseMessage = tournament.status === 'in_progress' 
            ? 'Вы отказались от участия в турнире. Вам назначены поражения во всех несыгранных матчах.' 
            : 'Вы отказались от участия в турнире';

        console.log(`✅ Участник ${userId} успешно исключен из турнира ${id}`);
        res.status(200).json({ message: responseMessage });
    } catch (err) {
        console.error('❌ Ошибка отказа от участия:', err);
        res.status(500).json({ error: err.message });
    }
});

// Ручное добавление участника (для solo и team)
router.post('/:id/add-participant', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { participantName, userId, faceit_elo, cs2_premier_rank } = req.body;
    const currentUserId = req.user.id;

    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        // Проверка прав: создатель или администратор
        if (tournament.created_by !== currentUserId) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [id, currentUserId]
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

        // Если указан userId, проверяем существование пользователя
        if (userId) {
            const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            // Проверяем, не участвует ли уже пользователь в турнире
            const participationCheck = await pool.query(
                'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
                [id, userId]
            );
            if (participationCheck.rows.length > 0) {
                return res.status(400).json({ error: 'Этот пользователь уже участвует в турнире' });
            }
        }

        console.log(`🎯 Добавляем участника: ${participantName}, faceit_elo: ${faceit_elo}, cs2_premier_rank: ${cs2_premier_rank}`);

        // 🆕 ИСПРАВЛЕННАЯ ЛОГИКА ДЛЯ МИКС ТУРНИРОВ С СОХРАНЕНИЕМ РЕЙТИНГОВ
        // Для микс турниров ВСЕГДА добавляем в tournament_participants, даже если participant_type = 'team'
        if (tournament.format === 'mix') {
            console.log(`🎯 Добавляем участника в микс турнир: ${participantName} (user_id: ${userId || 'гость'})`);
            
            // Добавляем участника в tournament_participants с флагом in_team = false и рейтингами
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name, in_team, faceit_elo, cs2_premier_rank) VALUES ($1, $2, $3, $4, $5, $6)',
                [id, userId || null, participantName, false, faceit_elo || null, cs2_premier_rank || null]
            );
            
            console.log(`✅ Участник ${participantName} добавлен в микс турнир как индивидуальный игрок (не в команде) с рейтингами`);
            
        } else if (tournament.participant_type === 'solo') {
            // Обычные solo турниры с сохранением рейтингов
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name, faceit_elo, cs2_premier_rank) VALUES ($1, $2, $3, $4, $5)',
                [id, userId || null, participantName, faceit_elo || null, cs2_premier_rank || null]
            );
        } else {
            // Обычные командные турниры
            const teamResult = await pool.query(
                'INSERT INTO tournament_teams (tournament_id, name, creator_id) VALUES ($1, $2, $3) RETURNING id',
                [id, participantName, userId || null]
            );
            if (userId) {
                await pool.query(
                    'INSERT INTO tournament_team_members (team_id, user_id) VALUES ($1, $2)',
                    [teamResult.rows[0].id, userId]
                );
            }
        }

        res.status(200).json({ message: 'Участник успешно добавлен' });
    } catch (err) {
        console.error('❌ Ошибка добавления участника:', err);
        res.status(500).json({ error: err.message });
    }
});

// Приглашение на турнир
router.post('/:id/invite', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { username, email } = req.body;
    const creatorId = req.user.id;

    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.created_by !== creatorId) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [id, creatorId]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может отправлять приглашения' });
            }
        }

        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        if (!username && !email) {
            return res.status(400).json({ error: 'Укажите никнейм или email' });
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

        // Проверяем, не участвует ли уже пользователь в турнире
        const checkParticipationQuery =
            tournament.participant_type === 'solo'
                ? 'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2'
                : 'SELECT tt.* FROM tournament_teams tt JOIN tournament_team_members ttm ON tt.id = ttm.team_id WHERE tt.tournament_id = $1 AND ttm.user_id = $2';
        const checkResult = await pool.query(checkParticipationQuery, [id, user.id]);
        if (checkResult.rows.length > 0) {
            return res.status(400).json({ error: 'Этот пользователь уже участвует в турнире' });
        }

        // Проверяем, нет ли уже приглашения для этого пользователя
        const inviteCheck = await pool.query(
            'SELECT * FROM tournament_invitations WHERE tournament_id = $1 AND user_id = $2 AND status = $3',
            [id, user.id, 'pending']
        );
        if (inviteCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Этот пользователь уже приглашен в турнир' });
        }

        // Создаем приглашение
        const invitationResult = await pool.query(
            'INSERT INTO tournament_invitations (tournament_id, user_id, invited_by, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, user.id, creatorId, 'pending']
        );

        const notificationMessage = `Вы приглашены в турнир "${tournament.name}" создателем ${req.user.username}`;
        const notificationResult = await pool.query(
            'INSERT INTO notifications (user_id, message, type, tournament_id, invitation_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user.id, notificationMessage, 'tournament_invite', id, invitationResult.rows[0].id]
        );

        sendNotification(user.id, {
            id: notificationResult.rows[0].id,
            user_id: user.id,
            message: notificationMessage,
            type: 'tournament_invite',
            tournament_id: id,
            invitation_id: invitationResult.rows[0].id,
            created_at: new Date().toISOString(),
        });

        res.status(200).json({ message: 'Приглашение отправлено' });
    } catch (err) {
        console.error('❌ Ошибка отправки приглашения:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обработка приглашения
router.post('/:id/handle-invitation', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { action, invitation_id } = req.body;
    const userId = req.user.id;

    try {
        // Проверяем существование приглашения
        const invitationResult = await pool.query(
            'SELECT * FROM tournament_invitations WHERE id = $1 AND user_id = $2 AND tournament_id = $3 AND status = $4',
            [invitation_id, userId, id, 'pending']
        );
        
        if (invitationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Приглашение не найдено или уже обработано' });
        }

        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (action === 'accept') {
            // Проверяем, не участвует ли уже пользователь
            const checkParticipationQuery =
                tournament.participant_type === 'solo'
                    ? 'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2'
                    : 'SELECT tt.* FROM tournament_teams tt JOIN tournament_team_members ttm ON tt.id = ttm.team_id WHERE tt.tournament_id = $1 AND ttm.user_id = $2';
            const checkResult = await pool.query(checkParticipationQuery, [id, userId]);
            if (checkResult.rows.length > 0) {
                return res.status(400).json({ error: 'Вы уже участвуете в этом турнире' });
            }

            // Добавляем участника
            // 🆕 ИСПРАВЛЕННАЯ ЛОГИКА ДЛЯ МИКС ТУРНИРОВ
            if (tournament.format === 'mix') {
                console.log(`🎯 Пользователь ${req.user.username} (ID: ${userId}) принимает приглашение в микс турнир ${id}`);
                
                // 🆕 ПОЛУЧАЕМ РЕЙТИНГИ ПОЛЬЗОВАТЕЛЯ ИЗ ПРОФИЛЯ
                const userResult = await pool.query('SELECT faceit_elo, cs2_premier_rank FROM users WHERE id = $1', [userId]);
                const userRatings = userResult.rows[0] || {};
                
                // Добавляем участника в tournament_participants с флагом in_team = false и рейтингами
                await pool.query(
                    'INSERT INTO tournament_participants (tournament_id, user_id, name, in_team, faceit_elo, cs2_premier_rank) VALUES ($1, $2, $3, $4, $5, $6)',
                    [id, userId, req.user.username, false, userRatings.faceit_elo || null, userRatings.cs2_premier_rank || null]
                );
                
                console.log(`✅ Участник ${req.user.username} добавлен в микс турнир как индивидуальный игрок (не в команде) с рейтингами`);
                
            } else if (tournament.participant_type === 'solo') {
                // 🆕 ПОЛУЧАЕМ РЕЙТИНГИ ПОЛЬЗОВАТЕЛЯ ИЗ ПРОФИЛЯ ДЛЯ SOLO ТУРНИРОВ
                const userResult = await pool.query('SELECT faceit_elo, cs2_premier_rank FROM users WHERE id = $1', [userId]);
                const userRatings = userResult.rows[0] || {};
                
                await pool.query(
                    'INSERT INTO tournament_participants (tournament_id, user_id, name, faceit_elo, cs2_premier_rank) VALUES ($1, $2, $3, $4, $5)',
                    [id, userId, req.user.username, userRatings.faceit_elo || null, userRatings.cs2_premier_rank || null]
                );
            } else {
                const teamResult = await pool.query(
                    'INSERT INTO tournament_teams (tournament_id, name, creator_id) VALUES ($1, $2, $3) RETURNING id',
                    [id, `${req.user.username}'s Team`, userId]
                );
                await pool.query(
                    'INSERT INTO tournament_team_members (team_id, user_id) VALUES ($1, $2)',
                    [teamResult.rows[0].id, userId]
                );
            }

            // Обновляем статус приглашения
            await pool.query(
                'UPDATE tournament_invitations SET status = $1 WHERE id = $2',
                ['accepted', invitation_id]
            );

            // Отправляем уведомление создателю
            const creatorNotificationMessage = `Пользователь ${req.user.username} принял приглашение в турнир "${tournament.name}"`;
            await pool.query(
                'INSERT INTO notifications (user_id, message, type, tournament_id, invitation_id) VALUES ($1, $2, $3, $4, $5)',
                [tournament.created_by, creatorNotificationMessage, 'invitation_accepted', id, invitation_id]
            );
            sendNotification(tournament.created_by, {
                user_id: tournament.created_by,
                message: creatorNotificationMessage,
                type: 'invitation_accepted',
                tournament_id: id,
                invitation_id: invitation_id,
                created_at: new Date().toISOString(),
            });

            res.status(200).json({ message: 'Вы успешно присоединились к турниру' });
        } else if (action === 'reject') {
            // Обновляем статус приглашения
            await pool.query(
                'UPDATE tournament_invitations SET status = $1 WHERE id = $2',
                ['rejected', invitation_id]
            );

            // Отправляем уведомление создателю
            const creatorNotificationMessage = `Пользователь ${req.user.username} отклонил приглашение в турнир "${tournament.name}"`;
            await pool.query(
                'INSERT INTO notifications (user_id, message, type, tournament_id, invitation_id) VALUES ($1, $2, $3, $4, $5)',
                [tournament.created_by, creatorNotificationMessage, 'invitation_rejected', id, invitation_id]
            );
            sendNotification(tournament.created_by, {
                user_id: tournament.created_by,
                message: creatorNotificationMessage,
                type: 'invitation_rejected',
                tournament_id: id,
                invitation_id: invitation_id,
                created_at: new Date().toISOString(),
            });

            res.status(200).json({ message: 'Приглашение отклонено' });
        } else {
            res.status(400).json({ error: 'Неверное действие' });
        }
    } catch (err) {
        console.error('❌ Ошибка обработки приглашения:', err);
        res.status(500).json({ error: err.message });
    }
});

// Запрос на администрирование турнира
router.post('/:id/request-admin', authenticateToken, verifyEmailRequired, async (req, res) => {
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
        console.error('❌ Ошибка запроса на администрирование:', err);
        res.status(500).json({ error: err.message });
    }
});

// Ответ на запрос администрирования (принять/отклонить)
router.post('/:id/respond-admin-request', authenticateToken, verifyEmailRequired, async (req, res) => {
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
            // Если принимаем запрос
            await pool.query(
                'INSERT INTO tournament_admins (tournament_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [id, requesterId]
            );
            await pool.query(
                'UPDATE admin_requests SET status = $1 WHERE tournament_id = $2 AND user_id = $3',
                ['accepted', id, requesterId]
            );

            const notificationMessage = `Ваш запрос на администрирование турнира "${tournament.name}" принят создателем ${req.user.username}`;
            const notificationResult = await pool.query(
                'INSERT INTO notifications (user_id, message, type, tournament_id) VALUES ($1, $2, $3, $4) RETURNING *',
                [requesterId, notificationMessage, 'admin_request_accepted', id]
            );
            
            const notification = notificationResult.rows[0];
            sendNotification(requesterId, {
                id: notification.id,
                user_id: requesterId,
                message: notificationMessage,
                type: 'admin_request_accepted',
                tournament_id: id,
                created_at: new Date().toISOString(),
            });
        } else {
            // Если отклоняем запрос
            await pool.query(
                'UPDATE admin_requests SET status = $1 WHERE tournament_id = $2 AND user_id = $3',
                ['rejected', id, requesterId]
            );

            const notificationMessage = `Ваш запрос на администрирование турнира "${tournament.name}" отклонён создателем ${req.user.username}`;
            const notificationResult = await pool.query(
                'INSERT INTO notifications (user_id, message, type, tournament_id) VALUES ($1, $2, $3, $4) RETURNING *',
                [requesterId, notificationMessage, 'admin_request_rejected', id]
            );
            
            const notification = notificationResult.rows[0];
            sendNotification(requesterId, {
                id: notification.id,
                user_id: requesterId,
                message: notificationMessage,
                type: 'admin_request_rejected',
                tournament_id: id,
                created_at: new Date().toISOString(),
            });
        }

        res.status(200).json({ message: `Запрос на администрирование ${action === 'accept' ? 'принят' : 'отклонён'}` });
    } catch (err) {
        console.error('❌ Ошибка обработки запроса на администрирование:', err);
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
        console.error('❌ Ошибка получения статуса запроса:', err);
        res.status(500).json({ error: err.message });
    }
});

// Генерация турнирной сетки
router.post('/:id/generate-bracket', authenticateToken, verifyEmailRequired, async (req, res) => {
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
        
        // Если матчи существуют, удаляем их перед генерацией новой сетки
        if (existingMatches.rows.length > 0) {
            console.log(`Удаление ${existingMatches.rows.length} существующих матчей для турнира ${id} перед регенерацией сетки`);
            await pool.query('DELETE FROM matches WHERE tournament_id = $1', [id]);
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

        // Получаем обновлённые данные турнира вместе с аватарками участников
        const updatedTournamentResult = await pool.query(
            'SELECT t.*, ' +
            '(SELECT COALESCE(json_agg(to_jsonb(tp) || jsonb_build_object(\'avatar_url\', u.avatar_url)), \'[]\') FROM tournament_participants tp LEFT JOIN users u ON tp.user_id = u.id WHERE tp.tournament_id = t.id) as participants, ' +
            '(SELECT COALESCE(json_agg(m.*), \'[]\') FROM matches m WHERE m.tournament_id = t.id) as matches ' +
            'FROM tournaments t WHERE t.id = $1',
            [id]
        );

        const tournamentData = updatedTournamentResult.rows[0];
        tournamentData.matches = Array.isArray(tournamentData.matches) && tournamentData.matches[0] !== null 
            ? tournamentData.matches 
            : [];
        tournamentData.participants = Array.isArray(tournamentData.participants) && tournamentData.participants[0] !== null 
            ? tournamentData.participants 
            : [];

        // Отправляем обновления всем клиентам, просматривающим этот турнир
        broadcastTournamentUpdate(id, tournamentData);
        // Отправляем объявление в чат турнира о генерации сетки
        await sendTournamentChatAnnouncement(
            tournamentData.name,
            `Сетка турнира "${tournamentData.name}" сгенерирована`,
            id
        );
        console.log('🔍 Bracket generated for tournament:', tournamentData);
        res.status(200).json({ message: 'Сетка успешно сгенерирована', tournament: tournamentData });
    } catch (err) {
        console.error('❌ Ошибка генерации сетки:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обновление результата матча
router.post('/:id/update-match', authenticateToken, async (req, res) => {
    const { id } = req.params;
    let { matchId, winner_team_id, score1, score2, maps } = req.body;
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

        // Запрет изменения результата, если следующий матч уже сыгран (есть winner_team_id)
        for (const nextMatchId of [match.next_match_id, match.loser_next_match_id]) {
            if (nextMatchId) {
                const nextRes = await pool.query(
                    'SELECT winner_team_id FROM matches WHERE id = $1',
                    [nextMatchId]
                );
                if (nextRes.rows.length && nextRes.rows[0].winner_team_id) {
                    return res.status(400).json({ error: 'Нельзя изменить результат: следующий матч уже сыгран' });
                }
            }
        }
        
        if (match.winner_team_id && match.winner_team_id === winner_team_id) {
            return res.status(400).json({ error: 'Этот победитель уже установлен' });
        }

        // Проверка, что winner_team_id является одним из участников матча
        if (winner_team_id && ![match.team1_id, match.team2_id].includes(winner_team_id)) {
            return res.status(400).json({ error: 'Победитель должен быть одним из участников матча' });
        }

        // Проверяем, изменились ли данные матча (счет, карты)
        const scoreChanged = match.score1 !== score1 || match.score2 !== score2;
        const mapsChanged = maps && Array.isArray(maps) && maps.length > 0;
        
        // Разрешаем обновление, если:
        // 1. Победитель изменился
        // 2. Изменился счет
        // 3. Добавлены/изменены данные о картах
        if (match.winner_team_id === winner_team_id && !scoreChanged && !mapsChanged) {
            return res.status(400).json({ error: 'Результат матча не изменился' });
        }

        // Подготовка данных о картах (если они предоставлены)
        let mapsData = null;
        
        // Проверяем, является ли игра поддерживающей карты (расширенный список)
        const isGameSupportingMaps = tournament.game && (
            // Counter-Strike варианты
            tournament.game === 'Counter-Strike 2' ||
            tournament.game === 'Counter Strike 2' ||
            tournament.game === 'CS2' ||
            tournament.game === 'cs2' ||
            tournament.game.toLowerCase().includes('counter') ||
            tournament.game.toLowerCase().includes('cs') ||
            // Valorant
            tournament.game === 'Valorant' ||
            tournament.game === 'VALORANT' ||
            tournament.game.toLowerCase().includes('valorant') ||
            // Другие игры с картами
            tournament.game.toLowerCase().includes('overwatch') ||
            tournament.game.toLowerCase().includes('dota') ||
            tournament.game.toLowerCase().includes('league') ||
            // Общий подход - если есть массив карт, поддерживаем
            (Array.isArray(maps) && maps.length > 0)
        );
        
        console.log(`🔍 DEBUG: Проверка данных карт для матча ${matchId}:`);
        console.log(`- Получены карты:`, maps);
        console.log(`- Тип данных карт:`, typeof maps);
        console.log(`- Является ли массивом:`, Array.isArray(maps));
        console.log(`- Количество карт:`, maps ? maps.length : 0);
        console.log(`- Игра турнира:`, tournament.game);
        console.log(`- Поддерживает ли карты:`, isGameSupportingMaps);
        
        if (Array.isArray(maps) && maps.length > 0 && isGameSupportingMaps) {
            console.log(`✅ Сохраняем данные о картах для игры: ${tournament.game}`);
            console.log(`📋 Данные карт:`, JSON.stringify(maps, null, 2));
            mapsData = JSON.stringify(maps);
            
            // Пересчитываем общий счет на основе выигранных карт
            if (maps.length > 1) {
                let team1Wins = 0;
                let team2Wins = 0;
                
                maps.forEach(map => {
                    if (parseInt(map.score1) > parseInt(map.score2)) {
                        team1Wins++;
                    } else if (parseInt(map.score2) > parseInt(map.score1)) {
                        team2Wins++;
                    }
                });
                
                score1 = team1Wins;
                score2 = team2Wins;
                
                console.log(`Пересчитанный счет на основе карт: ${team1Wins}:${team2Wins}`);
                
                // Определяем победителя на основе количества выигранных карт
                if (team1Wins > team2Wins) {
                    winner_team_id = match.team1_id;
                } else if (team2Wins > team1Wins) {
                    winner_team_id = match.team2_id;
                }
                // В случае ничьей (равное количество выигранных карт) winner_team_id остается как был передан
            }
        } else {
            console.log(`Данные о картах НЕ сохраняются. Причины:`);
            console.log(`- Есть массив карт: ${Array.isArray(maps)}`);
            console.log(`- Количество карт: ${maps ? maps.length : 0}`);
            console.log(`- Игра: ${tournament.game}`);
            console.log(`- Является ли CS2: ${isGameSupportingMaps}`);
        }

        // Обновление результата текущего матча
        if (mapsData) {
            console.log(`Обновляем матч ${matchId} с данными о картах:`, mapsData);
            await pool.query(
                'UPDATE matches SET winner_team_id = $1, score1 = $2, score2 = $3, maps_data = $4 WHERE id = $5',
                [winner_team_id, score1, score2, mapsData, matchId]
            );
            console.log(`Матч ${matchId} успешно обновлен с данными о картах`);
        } else {
            console.log(`Обновляем матч ${matchId} БЕЗ данных о картах`);
            await pool.query(
                'UPDATE matches SET winner_team_id = $1, score1 = $2, score2 = $3 WHERE id = $4',
                [winner_team_id, score1, score2, matchId]
            );
            console.log(`Матч ${matchId} успешно обновлен без данных о картах`);
        }

        console.log(`Обновлен результат матча ${match.match_number}: победитель ${winner_team_id}, счет ${score1}:${score2}`);

        // Определяем проигравшего
        const loser_team_id = match.team1_id === winner_team_id ? match.team2_id : match.team1_id;

        // Перемещаем победителя в следующий матч, если он есть
        if (winner_team_id && match.next_match_id) {
            const nextMatchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [match.next_match_id]);
            if (nextMatchResult.rows.length > 0) {
                const nextMatch = nextMatchResult.rows[0];
                console.log(`Следующий матч для победителя: ${nextMatch.match_number}`);

                // Определяем, в какую позицию (team1 или team2) добавить победителя
                if (!nextMatch.team1_id) {
                    await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    console.log(`Победитель (${winner_team_id}) помещен в позицию team1 матча ${nextMatch.match_number}`);
                } else if (!nextMatch.team2_id) {
                    await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    console.log(`Победитель (${winner_team_id}) помещен в позицию team2 матча ${nextMatch.match_number}`);
                } else {
                    console.log(`Обе позиции в матче ${nextMatch.match_number} уже заняты`);
                }
            }
        }

        // Перемещаем проигравшего в матч за 3-е место, если это полуфинал и есть loser_next_match_id
        if (loser_team_id && match.loser_next_match_id) {
            const loserNextMatchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [match.loser_next_match_id]);
            if (loserNextMatchResult.rows.length > 0) {
                const loserNextMatch = loserNextMatchResult.rows[0];
                console.log(`Матч для проигравшего: ${loserNextMatch.match_number} (матч за 3-е место)`);

                // Определяем, в какую позицию (team1 или team2) добавить проигравшего
                if (!loserNextMatch.team1_id) {
                    await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [loser_team_id, loserNextMatch.id]);
                    console.log(`Проигравший (${loser_team_id}) помещен в позицию team1 матча ${loserNextMatch.match_number}`);
                } else if (!loserNextMatch.team2_id) {
                    await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [loser_team_id, loserNextMatch.id]);
                    console.log(`Проигравший (${loser_team_id}) помещен в позицию team2 матча ${loserNextMatch.match_number}`);
                } else {
                    console.log(`Обе позиции в матче ${loserNextMatch.match_number} уже заняты`);
                }
            }
        }

        // Логика для предварительного раунда (раунд -1)
        if (match.round === -1) {
            // Эта логика уже обработана выше при проверке match.next_match_id
            console.log('Обработан предварительный раунд');
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
                            await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [availableMatch.id, matchId]);
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

        // Динамически подгружаем текущее состояние турнира
        const tourInfoRes = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        const tourInfo = tourInfoRes.rows[0];
        // Загружаем участников в зависимости от типа
        let updatedParticipants;
        if (tourInfo.participant_type === 'solo') {
            const partsRes = await pool.query(
                `SELECT tp.*, u.avatar_url, u.username, u.faceit_elo 
                 FROM tournament_participants tp
                 LEFT JOIN users u ON tp.user_id = u.id
                 WHERE tp.tournament_id = $1`,
                [id]
            );
            updatedParticipants = partsRes.rows;
        } else {
            const teamsRes = await pool.query(
                `SELECT tt.*, u.avatar_url
                 FROM tournament_teams tt
                 LEFT JOIN users u ON tt.creator_id = u.id
                 WHERE tt.tournament_id = $1`,
                [id]
            );
            updatedParticipants = teamsRes.rows;
        }
        // Загружаем матчи
        const matchesRes = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [id]
        );
        const tournamentData = {
            ...tourInfo,
            participants: updatedParticipants,
            participant_count: updatedParticipants.length,
            matches: matchesRes.rows
        };
        // Отправляем обновления всем клиентам
        broadcastTournamentUpdate(id, tournamentData);
        // Отправляем объявление в групповой чат турнира при обновлении результата матча
        {
            // Получаем имена команд/участников
            const pType = tournament.participant_type;
            let team1Name, team2Name;
            if (pType === 'solo') {
                const p1 = await pool.query('SELECT name FROM tournament_participants WHERE id=$1', [match.team1_id]);
                team1Name = p1.rows[0]?.name;
                const p2 = await pool.query('SELECT name FROM tournament_participants WHERE id=$1', [match.team2_id]);
                team2Name = p2.rows[0]?.name;
            } else {
                const t1 = await pool.query('SELECT name FROM tournament_teams WHERE id=$1', [match.team1_id]);
                team1Name = t1.rows[0]?.name;
                const t2 = await pool.query('SELECT name FROM tournament_teams WHERE id=$1', [match.team2_id]);
                team2Name = t2.rows[0]?.name;
            }
            const winName = winner_team_id ? (winner_team_id === match.team1_id ? team1Name : team2Name) : '';
            const announcement = `Матч ${match.match_number} ${team1Name} vs ${team2Name} завершен со счетом ${score1}:${score2}${winName ? `, победил ${winName}` : ''}. Ссылка на сетку: /tournaments/${id}`;
            await sendTournamentChatAnnouncement(tournament.name, announcement, id);
        }
        console.log('🔍 Match updated for tournament:', tournamentData);
        res.status(200).json({ message: 'Результат обновлён', tournament: tournamentData });
    } catch (err) {
        console.error('❌ Ошибка обновления матча:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обновление информации о турнире
router.put('/:id', authenticateToken, verifyEmailRequired, async (req, res) => {
    const { id } = req.params;
    const { name, game, format, participant_type, max_participants, start_date, description } = req.body;
    const userId = req.user.id;

    try {
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
                return res.status(403).json({ error: 'Только создатель или администратор может обновлять информацию о турнире' });
            }
        }

        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        const updateResult = await pool.query(
            'UPDATE tournaments SET name = $1, game = $2, format = $3, participant_type = $4, max_participants = $5, start_date = $6, description = $7 WHERE id = $8 RETURNING *',
            [name, game, format, participant_type, max_participants, start_date, description, id]
        );
        if (updateResult.rows.length === 0) {
            return res.status(400).json({ error: 'Не удалось обновить информацию о турнире' });
        }
        const updatedTournament = updateResult.rows[0];

        res.status(200).json({ message: 'Информация о турнире успешно обновлена', tournament: updatedTournament });
    } catch (err) {
        console.error('❌ Ошибка обновления информации о турнире:', err);
        res.status(500).json({ error: err.message });
    }
});

// Удаление турнира
router.delete('/:id', authenticateToken, verifyEmailRequired, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
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
                return res.status(403).json({ error: 'Только создатель или администратор может удалять турнир' });
            }
        }

        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        const deleteResult = await pool.query('DELETE FROM tournaments WHERE id = $1 RETURNING *', [id]);
        if (deleteResult.rows.length === 0) {
            return res.status(400).json({ error: 'Не удалось удалить турнир' });
        }

        const deletedTournament = deleteResult.rows[0];
        res.status(200).json({ message: 'Турнир успешно удален', tournament: deletedTournament });
    } catch (err) {
        console.error('❌ Ошибка удаления турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обновление результатов матча
router.post('/matches/:matchId/result', authenticateToken, verifyEmailRequired, async (req, res) => {
    const { matchId } = req.params;
    const { winner_team_id, score1, score2 } = req.body;
    const userId = req.user.id;

    try {
        // Преобразуем matchId в число
        const matchIdNum = Number(matchId);

        // Проверка турнира и прав доступа
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [matchIdNum]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.created_by !== userId) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [matchIdNum, userId]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может обновлять результаты матча' });
            }
        }

        // Получение данных текущего матча
        const matchResult = await pool.query('SELECT * FROM matches WHERE id = $1 AND tournament_id = $2', [matchIdNum, matchIdNum]);
        if (matchResult.rows.length === 0) {
            return res.status(400).json({ error: 'Матч не найден' });
        }
        const match = matchResult.rows[0];

        // Запрет изменения результата, если следующий матч уже сыгран (есть winner_team_id)
        for (const nextMatchId of [match.next_match_id, match.loser_next_match_id]) {
            if (nextMatchId) {
                const nextRes = await pool.query(
                    'SELECT winner_team_id FROM matches WHERE id = $1',
                    [nextMatchId]
                );
                if (nextRes.rows.length && nextRes.rows[0].winner_team_id) {
                    return res.status(400).json({ error: 'Нельзя изменить результат: следующий матч уже сыгран' });
                }
            }
        }
        
        if (match.winner_team_id && match.winner_team_id === winner_team_id) {
            return res.status(400).json({ error: 'Этот победитель уже установлен' });
        }

        // Проверка, что winner_team_id является одним из участников матча
        if (winner_team_id && ![match.team1_id, match.team2_id].includes(winner_team_id)) {
            return res.status(400).json({ error: 'Победитель должен быть одним из участников матча' });
        }

        // Проверяем, изменились ли данные матча (счет, карты)
        const scoreChanged = match.score1 !== score1 || match.score2 !== score2;
        const mapsChanged = maps && Array.isArray(maps) && maps.length > 0;
        
        // Разрешаем обновление, если:
        // 1. Победитель изменился
        // 2. Изменился счет
        // 3. Добавлены/изменены данные о картах
        if (match.winner_team_id === winner_team_id && !scoreChanged && !mapsChanged) {
            return res.status(400).json({ error: 'Результат матча не изменился' });
        }

        // Обновление результата текущего матча
        await pool.query(
            'UPDATE matches SET winner_team_id = $1, score1 = $2, score2 = $3 WHERE id = $4',
            [winner_team_id, score1, score2, matchIdNum]
        );

        // Определяем проигравшего
        const loser_team_id = match.team1_id === winner_team_id ? match.team2_id : match.team1_id;

        // Перемещаем победителя в следующий матч, если он есть
        if (winner_team_id && match.next_match_id) {
            const nextMatchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [match.next_match_id]);
            if (nextMatchResult.rows.length > 0) {
                const nextMatch = nextMatchResult.rows[0];
                console.log(`Следующий матч для победителя: ${nextMatch.match_number}`);

                // Определяем, в какую позицию (team1 или team2) добавить победителя
                if (!nextMatch.team1_id) {
                    await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    console.log(`Победитель (${winner_team_id}) помещен в позицию team1 матча ${nextMatch.match_number}`);
                } else if (!nextMatch.team2_id) {
                    await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    console.log(`Победитель (${winner_team_id}) помещен в позицию team2 матча ${nextMatch.match_number}`);
                } else {
                    console.log(`Обе позиции в матче ${nextMatch.match_number} уже заняты`);
                }
            }
        }

        // Перемещаем проигравшего в матч за 3-е место, если это полуфинал и есть loser_next_match_id
        if (loser_team_id && match.loser_next_match_id) {
            const loserNextMatchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [match.loser_next_match_id]);
            if (loserNextMatchResult.rows.length > 0) {
                const loserNextMatch = loserNextMatchResult.rows[0];
                console.log(`Матч для проигравшего: ${loserNextMatch.match_number} (матч за 3-е место)`);

                // Определяем, в какую позицию (team1 или team2) добавить проигравшего
                if (!loserNextMatch.team1_id) {
                    await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [loser_team_id, loserNextMatch.id]);
                    console.log(`Проигравший (${loser_team_id}) помещен в позицию team1 матча ${loserNextMatch.match_number}`);
                } else if (!loserNextMatch.team2_id) {
                    await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [loser_team_id, loserNextMatch.id]);
                    console.log(`Проигравший (${loser_team_id}) помещен в позицию team2 матча ${loserNextMatch.match_number}`);
                } else {
                    console.log(`Обе позиции в матче ${loserNextMatch.match_number} уже заняты`);
                }
            }
        }

        // Логика для предварительного раунда (раунд -1)
        if (match.round === -1) {
            // Эта логика уже обработана выше при проверке match.next_match_id
            console.log('Обработан предварительный раунд');
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
                            await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [availableMatch.id, matchId]);
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
            'SELECT t.*, ' +
            '(SELECT COALESCE(json_agg(to_jsonb(tp) || jsonb_build_object(\'avatar_url\', u.avatar_url)), \'[]\') FROM tournament_participants tp LEFT JOIN users u ON tp.user_id = u.id WHERE tp.tournament_id = t.id) as participants, ' +
            '(SELECT COALESCE(json_agg(m.*), \'[]\') FROM matches m WHERE m.tournament_id = t.id) as matches ' +
            'FROM tournaments t WHERE t.id = $1',
            [matchIdNum]
        );

        const tournamentData = updatedTournament.rows[0] || {};
        tournamentData.matches = Array.isArray(tournamentData.matches) && tournamentData.matches[0] !== null 
            ? tournamentData.matches 
            : [];
        tournamentData.participants = Array.isArray(tournamentData.participants) && tournamentData.participants[0] !== null 
            ? tournamentData.participants 
            : [];

        // Отправляем обновления всем клиентам, просматривающим этот турнир
        broadcastTournamentUpdate(matchIdNum, tournamentData);

        console.log('🔍 Match updated for tournament:', tournamentData);
        res.status(200).json({ message: 'Результат обновлён', tournament: tournamentData });
    } catch (err) {
        console.error('❌ Ошибка обновления результатов матча:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обновление полного описания турнира
router.put('/:id/full-description', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const { full_description } = req.body;
    const userId = req.user.id;

    try {
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
                return res.status(403).json({ error: 'Только создатель или администратор может обновлять полное описание турнира' });
            }
        }

        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        const updateResult = await pool.query(
            'UPDATE tournaments SET full_description = $1 WHERE id = $2 RETURNING *',
            [full_description, id]
        );
        if (updateResult.rows.length === 0) {
            return res.status(400).json({ error: 'Не удалось обновить полное описание турнира' });
        }
        const updatedTournament = updateResult.rows[0];

        res.status(200).json({ message: 'Полное описание турнира успешно обновлено', tournament: updatedTournament });
    } catch (err) {
        console.error('❌ Ошибка обновления полного описания турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обновление регламента турнира
router.put('/:id/rules', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const { rules } = req.body;
    const userId = req.user.id;

    try {
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
                return res.status(403).json({ error: 'Только создатель или администратор может обновлять регламент турнира' });
            }
        }

        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        const updateResult = await pool.query(
            'UPDATE tournaments SET rules = $1 WHERE id = $2 RETURNING *',
            [rules, id]
        );
        if (updateResult.rows.length === 0) {
            return res.status(400).json({ error: 'Не удалось обновить регламент турнира' });
        }
        const updatedTournament = updateResult.rows[0];

        res.status(200).json({ message: 'Регламент успешно обновлен', tournament: updatedTournament });
    } catch (err) {
        console.error('❌ Ошибка при обновлении регламента турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обновление описания турнира
router.put('/:id/description', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const { description } = req.body;
    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const updateResult = await pool.query(
            'UPDATE tournaments SET description = $1 WHERE id = $2 RETURNING *',
            [description, id]
        );
        if (updateResult.rows.length === 0) {
            return res.status(400).json({ error: 'Не удалось обновить описание турнира' });
        }
        res.status(200).json({ message: 'Описание успешно обновлено', tournament: updateResult.rows[0] });
    } catch (err) {
        console.error('❌ Ошибка при обновлении описания турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обновление призового фонда турнира
router.put('/:id/prize-pool', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const { prize_pool } = req.body;
    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const updateResult = await pool.query(
            'UPDATE tournaments SET prize_pool = $1 WHERE id = $2 RETURNING *',
            [prize_pool, id]
        );
        if (updateResult.rows.length === 0) {
            return res.status(400).json({ error: 'Не удалось обновить призовой фонд турнира' });
        }
        res.status(200).json({ message: 'Призовой фонд успешно обновлен', tournament: updateResult.rows[0] });
    } catch (err) {
        console.error('❌ Ошибка при обновлении призового фонда турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// Генерация команд для микс-турнира и переключение в командный режим
router.post('/:id/mix-generate-teams', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const { ratingType = 'faceit' } = req.body; // 🔧 УБИРАЕМ teamSize: requestedTeamSize из запроса
    
    try {
        // Получаем параметры турнира
        const tourRes = await pool.query('SELECT team_size, created_by, name FROM tournaments WHERE id = $1', [id]);
        if (!tourRes.rows.length) return res.status(404).json({ error: 'Турнир не найден' });
        const { team_size: sizeFromDb, created_by, name: tournamentName } = tourRes.rows[0];
        
        // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: детальное получение teamSize с диагностикой
        console.log(`🔍 ДИАГНОСТИКА TEAM_SIZE:`);
        console.log(`   - Значение из БД (sizeFromDb):`, sizeFromDb);
        console.log(`   - Тип значения:`, typeof sizeFromDb);
        console.log(`   - parseInt результат:`, parseInt(sizeFromDb, 10));
        console.log(`   - isNaN проверка:`, isNaN(parseInt(sizeFromDb, 10)));
        
        // 🔧 УЛУЧШЕННАЯ ЛОГИКА: более точная обработка teamSize
        let teamSize;
        if (sizeFromDb !== null && sizeFromDb !== undefined) {
            const parsedSize = parseInt(sizeFromDb, 10);
            if (!isNaN(parsedSize) && parsedSize > 0) {
                teamSize = parsedSize;
                console.log(`✅ Используем размер команды из БД: ${teamSize}`);
            } else {
                teamSize = 5; // fallback
                console.log(`⚠️ Некорректное значение team_size в БД (${sizeFromDb}), используем fallback: ${teamSize}`);
            }
        } else {
            teamSize = 5; // fallback for null/undefined
            console.log(`⚠️ team_size в БД равно null/undefined, используем fallback: ${teamSize}`);
        }

        console.log(`🎯 Генерация команд для турнира "${tournamentName}" (ID: ${id})`);
        console.log(`📊 Параметры: размер команды = ${teamSize} (из настроек турнира), тип рейтинга = ${ratingType}`);

        // 🆕 ПОЛУЧАЕМ ВСЕХ УЧАСТНИКОВ СНАЧАЛА ПЕРЕД УДАЛЕНИЕМ КОМАНД
        const partRes = await pool.query(
            `SELECT tp.id AS participant_id, tp.user_id, tp.name, tp.in_team,
                    tp.faceit_elo, tp.cs2_premier_rank,
                    u.faceit_elo as user_faceit_elo, u.cs2_premier_rank as user_premier_rank,
                    COALESCE(tp.faceit_elo, u.faceit_elo, 1000) as faceit_rating,
                    COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank, 5) as premier_rating
             FROM tournament_participants tp
             LEFT JOIN users u ON tp.user_id = u.id
             WHERE tp.tournament_id = $1
             ORDER BY tp.in_team DESC, tp.created_at ASC`,
            [id]
        );
        
        const participants = partRes.rows;
        if (!participants.length) {
            return res.status(400).json({ error: 'Нет участников для формирования команд' });
        }
        
        console.log(`📊 Всего участников для формирования команд: ${participants.length}`);
        
        // 🆕 ПРОВЕРЯЕМ ДОСТАТОЧНОСТЬ УЧАСТНИКОВ ДО УДАЛЕНИЯ КОМАНД
        const totalPlayers = participants.length;
        const fullTeams = Math.floor(totalPlayers / teamSize);
        const playersInTeams = fullTeams * teamSize;
        const remainingPlayers = totalPlayers - playersInTeams;
        
        console.log(`📊 Статистика формирования команд:`);
        console.log(`   - Всего участников: ${totalPlayers}`);
        console.log(`   - Размер команды: ${teamSize}`);
        console.log(`   - Полных команд: ${fullTeams}`);
        console.log(`   - Участников в командах: ${playersInTeams}`);
        console.log(`   - Останется вне команд: ${remainingPlayers}`);
        
        if (fullTeams === 0) {
            console.log(`❌ Недостаточно участников: не хватает ${teamSize - totalPlayers} для формирования хотя бы одной команды`);
            return res.status(400).json({ 
                error: `Недостаточно участников для формирования хотя бы одной команды. Нужно минимум ${teamSize} участников, а есть только ${totalPlayers}` 
            });
        }

        // 🔧 ТЕПЕРЬ БЕЗОПАСНО УДАЛЯЕМ СУЩЕСТВУЮЩИЕ КОМАНДЫ
        console.log(`🗑️ Удаляем существующие команды для турнира ${id} перед переформированием`);
        
        // Удаляем участников команд
        await pool.query(
            'DELETE FROM tournament_team_members WHERE team_id IN (SELECT id FROM tournament_teams WHERE tournament_id = $1)',
            [id]
        );
        
        // Удаляем сами команды
        const deleteResult = await pool.query(
            'DELETE FROM tournament_teams WHERE tournament_id = $1',
            [id]
        );
        
        console.log(`✅ Удалено ${deleteResult.rowCount} существующих команд`);

        // 🆕 УЛУЧШЕННАЯ ДИАГНОСТИКА РЕЙТИНГОВ УЧАСТНИКОВ
        console.log(`🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА РЕЙТИНГОВ (тип: ${ratingType}):`);
        participants.forEach((p, index) => {
            const debugInfo = {
                index: index + 1,
                name: p.name,
                user_id: p.user_id,
                is_guest: !p.user_id,
                tp_faceit_elo: p.faceit_elo,
                tp_cs2_premier_rank: p.cs2_premier_rank,
                user_faceit_elo: p.user_faceit_elo,
                user_premier_rank: p.user_premier_rank,
                final_faceit_rating: p.faceit_rating,
                final_premier_rating: p.premier_rating,
                selected_rating: ratingType === 'faceit' ? p.faceit_rating : p.premier_rating,
                in_team: p.in_team
            };
            console.log(`  ${index + 1}. ${JSON.stringify(debugInfo)}`);
        });
        
        // 🆕 СТАТИСТИКА ПО ТИПАМ УЧАСТНИКОВ
        const guestParticipants = participants.filter(p => !p.user_id);
        const registeredParticipants = participants.filter(p => p.user_id);
        const participantsWithCustomRatings = participants.filter(p => p.faceit_elo || p.cs2_premier_rank);
        
        console.log(`📊 СТАТИСТИКА УЧАСТНИКОВ:`);
        console.log(`   - Зарегистрированных: ${registeredParticipants.length}`);
        console.log(`   - Гостей: ${guestParticipants.length}`);
        console.log(`   - С кастомными рейтингами: ${participantsWithCustomRatings.length}`);
        
        if (guestParticipants.length > 0) {
            console.log(`👥 ГОСТИ С РЕЙТИНГАМИ:`);
            guestParticipants.forEach(guest => {
                console.log(`   - ${guest.name}: faceit=${guest.faceit_elo}, premier=${guest.cs2_premier_rank}`);
            });
        }
        
        // 🆕 СОРТИРУЕМ ИГРОКОВ ПО РЕЙТИНГУ (в зависимости от выбранного типа)
        const sortedParticipants = [...participants].sort((a, b) => {
            let ratingA, ratingB;
            
            if (ratingType === 'faceit') {
                ratingA = a.faceit_rating;
                ratingB = b.faceit_rating;
            } else if (ratingType === 'premier') {
                ratingA = a.premier_rating;
                ratingB = b.premier_rating;
            } else {
                ratingA = a.faceit_rating;
                ratingB = b.faceit_rating;
            }
            
            // 🆕 УЛУЧШЕННАЯ СОРТИРОВКА: если рейтинги равны, добавляем случайность
            if (ratingB === ratingA) {
                return Math.random() - 0.5; // Случайное перемешивание равных рейтингов
            }
            
            return ratingB - ratingA; // По убыванию (лучшие первыми)
        });
        
        // 🆕 ДЕТАЛЬНАЯ ДИАГНОСТИКА СОРТИРОВКИ С ПРОВЕРКОЙ ELO НЕЗАРЕГИСТРИРОВАННЫХ
        console.log(`🔽 УЧАСТНИКИ ПОСЛЕ СОРТИРОВКИ ПО ${ratingType.toUpperCase()}:`);
        sortedParticipants.slice(0, Math.min(15, sortedParticipants.length)).forEach((p, index) => {
            const selectedRating = ratingType === 'faceit' ? p.faceit_rating : p.premier_rating;
            const isGuest = !p.user_id;
            const hasCustomRating = p.faceit_elo || p.cs2_premier_rank;
            
            // 🔍 СПЕЦИАЛЬНАЯ ДИАГНОСТИКА ДЛЯ НЕЗАРЕГИСТРИРОВАННЫХ УЧАСТНИКОВ
            if (isGuest && hasCustomRating) {
                console.log(`  ${index + 1}. 🔍 ГОСТЬ ${p.name}:`);
                console.log(`     - Кастомный FACEIT ELO: ${p.faceit_elo}`);
                console.log(`     - Кастомный Premier: ${p.cs2_premier_rank}`);
                console.log(`     - Итоговый FACEIT рейтинг: ${p.faceit_rating}`);
                console.log(`     - Итоговый Premier рейтинг: ${p.premier_rating}`);
                console.log(`     - ИСПОЛЬЗУЕМЫЙ рейтинг (${ratingType}): ${selectedRating}`);
            } else {
                console.log(`  ${index + 1}. ${p.name} - ${ratingType} рейтинг: ${selectedRating} ${isGuest ? '(гость)' : '(зарег.)'} ${hasCustomRating ? '(кастом)' : '(проф.)'}`);
            }
        });
        if (sortedParticipants.length > 15) {
            console.log(`  ... и еще ${sortedParticipants.length - 15} участников`);
        }
        
        // 🆕 СТАТИСТИКА РЕЙТИНГОВ
        const ratingsUsed = sortedParticipants.map(p => ratingType === 'faceit' ? p.faceit_rating : p.premier_rating);
        const minRating = Math.min(...ratingsUsed);
        const maxRating = Math.max(...ratingsUsed);
        const avgRating = ratingsUsed.reduce((sum, rating) => sum + rating, 0) / ratingsUsed.length;
        
        console.log(`📊 СТАТИСТИКА РЕЙТИНГОВ (${ratingType}):`);
        console.log(`   - Минимальный: ${minRating}`);
        console.log(`   - Максимальный: ${maxRating}`);
        console.log(`   - Средний: ${Math.round(avgRating)}`);
        console.log(`   - Разброс: ${maxRating - minRating}`);
        
        // 🔍 КРИТИЧЕСКАЯ ПРОВЕРКА НУЛЕВЫХ И БАЗОВЫХ РЕЙТИНГОВ
        const baseRatingValue = ratingType === 'faceit' ? 1000 : 5;
        const zeroRatings = ratingsUsed.filter(r => r === 0);
        const baseRatings = ratingsUsed.filter(r => r === baseRatingValue);
        
        if (zeroRatings.length > 0) {
            console.log(`🚨 КРИТИЧЕСКАЯ ОШИБКА: ${zeroRatings.length} участников с нулевым рейтингом!`);
            const participantsWithZeroRating = sortedParticipants.filter(p => 
                (ratingType === 'faceit' ? p.faceit_rating : p.premier_rating) === 0
            );
            participantsWithZeroRating.forEach(p => {
                console.log(`   - ❌ ${p.name}: tp.faceit_elo=${p.faceit_elo}, tp.cs2_premier_rank=${p.cs2_premier_rank}, user.faceit_elo=${p.user_faceit_elo}, user.cs2_premier_rank=${p.user_premier_rank}`);
                console.log(`     Final: faceit_rating=${p.faceit_rating}, premier_rating=${p.premier_rating}`);
            });
        }
        
        if (baseRatings.length > 0) {
            console.log(`📊 Участников с базовым рейтингом (${baseRatingValue}): ${baseRatings.length}`);
        }
        
        // 🆕 ПРОВЕРКА НЕЗАРЕГИСТРИРОВАННЫХ УЧАСТНИКОВ С КАСТОМНЫМИ РЕЙТИНГАМИ
        const guestsWithCustomRatings = sortedParticipants.filter(p => !p.user_id && (p.faceit_elo || p.cs2_premier_rank));
        if (guestsWithCustomRatings.length > 0) {
            console.log(`👤 ГОСТИ С КАСТОМНЫМИ РЕЙТИНГАМИ: ${guestsWithCustomRatings.length}`);
            guestsWithCustomRatings.forEach((p, idx) => {
                const currentRating = ratingType === 'faceit' ? p.faceit_rating : p.premier_rating;
                const customValue = ratingType === 'faceit' ? p.faceit_elo : p.cs2_premier_rank;
                console.log(`   ${idx + 1}. ${p.name}: кастом=${customValue}, итог=${currentRating}, позиция в топе=${sortedParticipants.indexOf(p) + 1}`);
            });
        }
        
        // 🆕 РАЗДЕЛЯЕМ УЧАСТНИКОВ: первые попадают в команды, остальные остаются вне команд
        const participantsForTeams = sortedParticipants.slice(0, playersInTeams);
        const participantsNotInTeams = sortedParticipants.slice(playersInTeams);
        
        console.log(`👥 Участников для команд: ${participantsForTeams.length}`);
        console.log(`🚫 Участников вне команд: ${participantsNotInTeams.length}`);
        
        // 🆕 УЛУЧШЕННЫЙ АЛГОРИТМ ФОРМИРОВАНИЯ КОМАНД С ДОПОЛНИТЕЛЬНОЙ СЛУЧАЙНОСТЬЮ
        const teams = [];
        
        // Создаем пустые команды
        for (let i = 0; i < fullTeams; i++) {
            teams.push({
                name: `Команда ${i + 1}`,
                members: []
            });
        }
        
        // 🔧 НОВАЯ ЛОГИКА: АДАПТИВНЫЙ АЛГОРИТМ В ЗАВИСИМОСТИ ОТ РАЗМЕРА КОМАНДЫ
        if (teamSize === 2) {
            console.log(`🎯 ИСПОЛЬЗУЕМ ОПТИМИЗИРОВАННЫЙ ПОПАРНЫЙ АЛГОРИТМ для команд из 2 игроков`);
            
            // 🎯 ВАРИАНТ 1: ОПТИМИЗИРОВАННЫЙ ПОПАРНЫЙ АЛГОРИТМ
            // Принцип: создаем все возможные пары, оцениваем по близости к общему среднему
            // Плюсы: простота, быстрота (O(n²)), предсказуемый результат
            // Минусы: жадный алгоритм, может попасть в локальный минимум
            // Ожидаемый баланс: 30-60% расхождения
            
            const averageRating = participantsForTeams.reduce((sum, p) => {
                return sum + (ratingType === 'faceit' ? p.faceit_rating : p.premier_rating);
            }, 0) / participantsForTeams.length;
            
            console.log(`📊 Общий средний рейтинг: ${Math.round(averageRating)}`);
            
            // ============================================
            // 🎯 ВАРИАНТ 2: АДАПТИВНЫЙ АЛГОРИТМ С ПРИНУДИТЕЛЬНОЙ БАЛАНСИРОВКОЙ (РЕКОМЕНДУЕМЫЙ)
            // 
            // Принцип работы:
            // 1. Выбор базового алгоритма по размеру команды:
            //    - teamSize = 2: Специальный алгоритм для пар (текущий)
            //    - teamSize = 3-5: Модифицированная "змейка"
            //    - teamSize > 5: Классическая "змейка"
            // 2. Принудительная балансировка до 100 попыток:
            //    - Цель: достичь ≤15% расхождения между командами
            //    - Умный поиск лучших обменов игроков между командами
            //    - Анализ влияния каждого обмена на общий баланс
            // 3. Детальная диагностика процесса
            //
            // Плюсы: универсальность, гарантированное улучшение, умная оптимизация
            // Минусы: более сложная реализация, дольше выполняется (100-500ms)
            // Ожидаемый баланс: 10-20% расхождения
            // 
            // Пример реализации:
            // ```javascript
            // let teams = createInitialTeams(participantsForTeams, teamSize, algorithm);
            // let attempts = 0;
            // while (!isBalanced(teams, 15) && attempts < 100) {
            //     const bestSwap = findBestPlayerSwap(teams, ratingType);
            //     if (bestSwap) executeSwap(teams, bestSwap);
            //     attempts++;
            // }
            // ```
            // ============================================
            
            // ============================================  
            // 🎯 ВАРИАНТ 3: ГИБРИДНЫЙ АЛГОРИТМ С ЭЛЕМЕНТАМИ ML
            //
            // Принцип работы:
            // 1. Генетический алгоритм:
            //    - 50 поколений эволюции популяций команд
            //    - Турнирная селекция по фитнесу (баланс команд)
            //    - Одноточечное скрещивание с мутацией 10%
            // 2. Симуляция отжига:
            //    - 1000 итераций градиентного спуска
            //    - Температурное охлаждение 99.5% за итерацию
            //    - Принятие худших решений с вероятностью exp(-delta/temperature)
            // 3. Жадная оптимизация как fallback
            // 4. Автоматический выбор лучшего результата из всех методов
            //
            // Плюсы: максимально возможный баланс, использует современные алгоритмы
            // Минусы: сложность, долгое выполнение (3-10s), непредсказуемость
            // Ожидаемый баланс: 5-15% расхождения
            //
            // Пример для команд из 2 игроков:
            // Входящие рейтинги: [3000, 2500, 2000, 1500, 1200, 1000, 900, 800]
            // Результат ML: К1:[1400,900]=1150, К2:[1200,950]=1075, К3:[1100,1000]=1050, К4:[800,1250]=1025
            // Баланс: (1150-1025)/1025 = 12% ← ОТЛИЧНЫЙ РЕЗУЛЬТАТ!
            // ============================================
            
            // 🚀 РЕАЛИЗАЦИЯ ВАРИАНТА 1: ОПТИМИЗИРОВАННЫЙ ПОПАРНЫЙ АЛГОРИТМ
            
            // Создаем все возможные пары и оцениваем их близость к среднему
            const allPairs = [];
            for (let i = 0; i < participantsForTeams.length; i++) {
                for (let j = i + 1; j < participantsForTeams.length; j++) {
                    const player1 = participantsForTeams[i];
                    const player2 = participantsForTeams[j];
                    
                    const rating1 = ratingType === 'faceit' ? player1.faceit_rating : player1.premier_rating;
                    const rating2 = ratingType === 'faceit' ? player2.faceit_rating : player2.premier_rating;
                    
                    const pairAverage = (rating1 + rating2) / 2;
                    const distanceFromAverage = Math.abs(pairAverage - averageRating);
                    
                    allPairs.push({
                        player1,
                        player2,
                        pairAverage,
                        distanceFromAverage,
                        used: false
                    });
                }
            }
            
            // Сортируем пары по близости к среднему (лучшие пары первыми)
            allPairs.sort((a, b) => a.distanceFromAverage - b.distanceFromAverage);
            
            console.log(`📊 Создано ${allPairs.length} возможных пар, ищем ${fullTeams} оптимальных`);
            
            // Жадно выбираем лучшие непересекающиеся пары
            const usedPlayers = new Set();
            let teamIndex = 0;
            
            for (const pair of allPairs) {
                if (teamIndex >= fullTeams) break;
                
                // Проверяем, что оба игрока не использованы
                if (!usedPlayers.has(pair.player1.participant_id) && 
                    !usedPlayers.has(pair.player2.participant_id)) {
                    
                    teams[teamIndex].members.push(pair.player1, pair.player2);
                    usedPlayers.add(pair.player1.participant_id);
                    usedPlayers.add(pair.player2.participant_id);
                    
                    console.log(`✅ Команда ${teamIndex + 1}: ${pair.player1.name} (${ratingType === 'faceit' ? pair.player1.faceit_rating : pair.player1.premier_rating}) + ${pair.player2.name} (${ratingType === 'faceit' ? pair.player2.faceit_rating : pair.player2.premier_rating}) = ${Math.round(pair.pairAverage)} avg (отклонение: ${Math.round(pair.distanceFromAverage)})`);
                    
                    teamIndex++;
                }
            }
            
            console.log(`🎯 ПОПАРНЫЙ АЛГОРИТМ ЗАВЕРШЕН: создано ${teamIndex} оптимальных команд`);
        } else {
            console.log(`❌ НЕ ИСПОЛЬЗУЕМ попарный алгоритм, потому что teamSize=${teamSize} НЕ равен 2`);
            console.log(`🔍 КРИТИЧЕСКАЯ ДИАГНОСТИКА teamSize:`);
            console.log(`   - Значение teamSize: ${teamSize}`);
            console.log(`   - Тип teamSize: ${typeof teamSize}`);
            console.log(`   - teamSize === 2: ${teamSize === 2}`);
            console.log(`   - teamSize == '2': ${teamSize == '2'}`);
            console.log(`   - teamSize == 2: ${teamSize == 2}`);
            console.log(`   - parseInt(teamSize) === 2: ${parseInt(teamSize) === 2}`);
        
            console.log(`🎯 ИСПОЛЬЗУЕМ КЛАССИЧЕСКИЙ АЛГОРИТМ "ЗМЕЙКА" для команд из ${teamSize} игроков`);
            
            // 🔄 ИСПРАВЛЕННЫЙ АЛГОРИТМ РАСПРЕДЕЛЕНИЯ: строго контролируем размер команд
            let participantIndex = 0;
            
            // 🎯 СБАЛАНСИРОВАННОЕ РАСПРЕДЕЛЕНИЕ "ЗМЕЙКА": обеспечивает баланс + строгий контроль размера
            for (let round = 0; round < teamSize; round++) {
                console.log(`🔄 Раунд ${round + 1}/${teamSize} распределения участников`);
                
                // В четных раундах идем слева направо (0 → 1 → 2 → 3)
                // В нечетных раундах идем справа налево (3 → 2 → 1 → 0)
                const isEvenRound = round % 2 === 0;
                
                for (let i = 0; i < fullTeams && participantIndex < participantsForTeams.length; i++) {
                    const teamIndex = isEvenRound ? i : (fullTeams - 1 - i);
                    const participant = participantsForTeams[participantIndex];
                    
                    teams[teamIndex].members.push(participant);
                    
                    const participantRating = ratingType === 'faceit' ? participant.faceit_rating : participant.premier_rating;
                    console.log(`👤 Раунд ${round + 1}, игрок ${participant.name} (рейтинг: ${participantRating}) → Команда ${teamIndex + 1} (позиция ${teams[teamIndex].members.length}/${teamSize})`);
                    
                    participantIndex++;
                }
            }
            
            console.log(`🎯 АЛГОРИТМ "ЗМЕЙКА" ЗАВЕРШЕН: все ${fullTeams} команд содержат ровно ${teamSize} участников`);
        }
        
        // 🔍 ФИНАЛЬНАЯ ПРОВЕРКА: убеждаемся что все команды имеют правильный размер
        let allTeamsValid = true;
        teams.forEach((team, index) => {
            console.log(`✅ Команда ${index + 1}: ${team.members.length}/${teamSize} участников`);
            
            if (team.members.length !== teamSize) {
                console.error(`❌ ОШИБКА: Команда ${index + 1} содержит ${team.members.length} участников вместо ${teamSize}!`);
                allTeamsValid = false;
            }
        });
        
        if (!allTeamsValid) {
            return res.status(500).json({ 
                error: `Критическая ошибка формирования команд: не все команды содержат ${teamSize} участников` 
            });
        }
        
        console.log(`🎯 АЛГОРИТМ "ЗМЕЙКА" ЗАВЕРШЕН: все ${fullTeams} команд содержат ровно ${teamSize} участников`);
        
        // 🔍 ДИАГНОСТИКА СФОРМИРОВАННЫХ КОМАНД
        console.log(`✅ Успешно сформировано ${teams.length} команд для турнира ${id}`);
        console.log(`📊 ПРИНЦИП РАБОТЫ АЛГОРИТМА "ЗМЕЙКА":`);
        console.log(`   - Участники отсортированы по рейтингу от сильнейших к слабейшим`);
        console.log(`   - Раунд 1: сильнейшие игроки распределяются 1→2→3→4 по командам`);
        console.log(`   - Раунд 2: следующие игроки распределяются 4→3→2→1 (в обратном порядке)`);
        console.log(`   - Раунд 3: снова 1→2→3→4, и так далее`);
        console.log(`   - Результат: в каждой команде игроки разного уровня = сбалансированные команды`);
        
        teams.forEach((team, index) => {
            const teamRatings = team.members.map(member => 
                ratingType === 'faceit' ? member.faceit_rating : member.premier_rating
            );
            const avgTeamRating = teamRatings.reduce((sum, rating) => sum + rating, 0) / teamRatings.length;
            const teamMembersList = team.members.map(m => `${m.name}(${ratingType === 'faceit' ? m.faceit_rating : m.premier_rating})`).join(', ');
            
            console.log(`🏆 Команда ${index + 1}: ${team.members.length} игроков, средний рейтинг ${Math.round(avgTeamRating)}`);
            console.log(`   Участники: ${teamMembersList}`);
        });

        // 🎯 СИСТЕМА КОНТРОЛЯ БАЛАНСА КОМАНД - ВАРИАНТ 2: АДАПТИВНЫЙ С ПРИНУДИТЕЛЬНОЙ БАЛАНСИРОВКОЙ (цель ≤15%)
        console.log(`⚖️ НАЧИНАЕМ ПРОВЕРКУ БАЛАНСА КОМАНД (макс. расхождение 15%)`);
        
        // Функция расчета среднего рейтинга команды
        const calculateTeamAverage = (team) => {
            const ratings = team.members.map(member => 
                ratingType === 'faceit' ? member.faceit_rating : member.premier_rating
            );
            return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        };
        
        // Функция проверки баланса команд
        const checkTeamBalance = (teamsToCheck) => {
            const teamAverages = teamsToCheck.map(team => calculateTeamAverage(team));
            const minAvg = Math.min(...teamAverages);
            const maxAvg = Math.max(...teamAverages);
            const percentageDiff = ((maxAvg - minAvg) / minAvg) * 100;
            
            return {
                teamAverages,
                minAvg,
                maxAvg,
                percentageDiff,
                isBalanced: percentageDiff <= 15
            };
        };
        
        // Первоначальная проверка баланса
        let balanceCheck = checkTeamBalance(teams);
        console.log(`📊 Изначальный баланс команд:`);
        console.log(`   - Минимальный средний рейтинг: ${Math.round(balanceCheck.minAvg)}`);
        console.log(`   - Максимальный средний рейтинг: ${Math.round(balanceCheck.maxAvg)}`);
        console.log(`   - Расхождение: ${Math.round(balanceCheck.percentageDiff)}%`);
        console.log(`   - Сбалансированы: ${balanceCheck.isBalanced ? '✅ ДА' : '❌ НЕТ'}`);
        
        // 🔄 АЛГОРИТМ ПЕРЕБАЛАНСИРОВКИ (если расхождение > 15%)
        let rebalanceAttempts = 0;
        const maxRebalanceAttempts = 100; // Увеличено с 50 до 100 для варианта 2
        
        while (!balanceCheck.isBalanced && rebalanceAttempts < maxRebalanceAttempts) {
            rebalanceAttempts++;
            console.log(`🔄 Попытка перебалансировки #${rebalanceAttempts}`);
            
            // Находим самую сильную и самую слабую команды
            const teamAverages = teams.map((team, index) => ({
                index,
                average: calculateTeamAverage(team),
                team
            }));
            
            teamAverages.sort((a, b) => b.average - a.average);
            const strongestTeam = teamAverages[0];
            const weakestTeam = teamAverages[teamAverages.length - 1];
            
            console.log(`   - Самая сильная команда: ${strongestTeam.team.name} (${Math.round(strongestTeam.average)})`);
            console.log(`   - Самая слабая команда: ${weakestTeam.team.name} (${Math.round(weakestTeam.average)})`);
            
            // Попытка найти оптимальный обмен игроками
            let swapMade = false;
            
            // Перебираем игроков сильной команды (начиная со слабейших в этой команде)
            const strongTeamMembers = [...strongestTeam.team.members].sort((a, b) => {
                const ratingA = ratingType === 'faceit' ? a.faceit_rating : a.premier_rating;
                const ratingB = ratingType === 'faceit' ? b.faceit_rating : b.premier_rating;
                return ratingA - ratingB; // По возрастанию (слабейшие первыми)
            });
            
            // Перебираем игроков слабой команды (начиная с сильнейших в этой команде)
            const weakTeamMembers = [...weakestTeam.team.members].sort((a, b) => {
                const ratingA = ratingType === 'faceit' ? a.faceit_rating : a.premier_rating;
                const ratingB = ratingType === 'faceit' ? b.faceit_rating : b.premier_rating;
                return ratingB - ratingA; // По убыванию (сильнейшие первыми)
            });
            
            // Ищем лучший обмен
            outerLoop: for (const strongMember of strongTeamMembers) {
                for (const weakMember of weakTeamMembers) {
                    const strongRating = ratingType === 'faceit' ? strongMember.faceit_rating : strongMember.premier_rating;
                    const weakRating = ratingType === 'faceit' ? weakMember.faceit_rating : weakMember.premier_rating;
                    
                    // Пропускаем если рейтинги слишком близки (обмен не даст эффекта)
                    if (Math.abs(strongRating - weakRating) < 50) continue;
                    
                    // Создаем временные команды для тестирования обмена
                    const testStrongTeam = {
                        ...strongestTeam.team,
                        members: strongestTeam.team.members.map(m => 
                            m.participant_id === strongMember.participant_id ? weakMember : m
                        )
                    };
                    
                    const testWeakTeam = {
                        ...weakestTeam.team,
                        members: weakestTeam.team.members.map(m => 
                            m.participant_id === weakMember.participant_id ? strongMember : m
                        )
                    };
                    
                    // Создаем тестовый массив команд
                    const testTeams = teams.map((team, index) => {
                        if (index === strongestTeam.index) return testStrongTeam;
                        if (index === weakestTeam.index) return testWeakTeam;
                        return team;
                    });
                    
                    // Проверяем баланс после обмена
                    const testBalance = checkTeamBalance(testTeams);
                    
                    // Если баланс улучшился, применяем обмен
                    if (testBalance.percentageDiff < balanceCheck.percentageDiff) {
                        console.log(`   ✅ Выгодный обмен найден: ${strongMember.name} (${strongRating}) ↔ ${weakMember.name} (${weakRating})`);
                        console.log(`   📊 Расхождение изменилось: ${Math.round(balanceCheck.percentageDiff)}% → ${Math.round(testBalance.percentageDiff)}%`);
                        
                        // Применяем обмен
                        teams[strongestTeam.index] = testStrongTeam;
                        teams[weakestTeam.index] = testWeakTeam;
                        
                        swapMade = true;
                        break outerLoop;
                    }
                }
            }
            
            // Если обмен не найден, пробуем случайную перестановку
            if (!swapMade && rebalanceAttempts % 10 === 0) {
                console.log(`   🎲 Случайная перестановка игроков (попытка ${rebalanceAttempts})`);
                
                // Случайно выбираем двух игроков из разных команд и меняем местами
                const team1Index = Math.floor(Math.random() * teams.length);
                let team2Index = Math.floor(Math.random() * teams.length);
                while (team2Index === team1Index) {
                    team2Index = Math.floor(Math.random() * teams.length);
                }
                
                const member1Index = Math.floor(Math.random() * teams[team1Index].members.length);
                const member2Index = Math.floor(Math.random() * teams[team2Index].members.length);
                
                const member1 = teams[team1Index].members[member1Index];
                const member2 = teams[team2Index].members[member2Index];
                
                teams[team1Index].members[member1Index] = member2;
                teams[team2Index].members[member2Index] = member1;
                
                console.log(`   🔄 Случайный обмен: ${member1.name} ↔ ${member2.name}`);
                swapMade = true;
            }
            
            if (!swapMade) {
                console.log(`   ⚠️ Не удалось найти выгодный обмен, прерываем перебалансировку`);
                break;
            }
            
            // Пересчитываем баланс
            balanceCheck = checkTeamBalance(teams);
            console.log(`   📊 Новое расхождение: ${Math.round(balanceCheck.percentageDiff)}%`);
        }
        
        // Финальная диагностика баланса
        const finalBalance = checkTeamBalance(teams);
        console.log(`⚖️ ФИНАЛЬНЫЙ БАЛАНС КОМАНД:`);
        console.log(`   - Попыток перебалансировки: ${rebalanceAttempts}`);
        console.log(`   - Минимальный средний рейтинг: ${Math.round(finalBalance.minAvg)}`);
        console.log(`   - Максимальный средний рейтинг: ${Math.round(finalBalance.maxAvg)}`);
        console.log(`   - Итоговое расхождение: ${Math.round(finalBalance.percentageDiff)}%`);
        console.log(`   - Цель достигнута (≤15%): ${finalBalance.isBalanced ? '✅ ДА' : '❌ НЕТ (крайний случай)'}`);
        
        if (!finalBalance.isBalanced) {
            console.log(`⚠️ ВНИМАНИЕ: Не удалось достичь 15% баланса. Возможные причины:`);
            console.log(`   - Слишком большой разброс рейтингов участников`);
            console.log(`   - Малое количество участников для перестановок`);
            console.log(`   - Особенности распределения рейтингов`);
        }
        
        // Обновляем команды с финальными составами и рейтингами
        teams.forEach((team, index) => {
            const avgRating = calculateTeamAverage(team);
            console.log(`🏆 ФИНАЛ - Команда ${index + 1} "${team.name}": средний рейтинг ${Math.round(avgRating)}`);
            team.members.forEach((member, memberIndex) => {
                const memberRating = ratingType === 'faceit' ? member.faceit_rating : member.premier_rating;
                console.log(`   ${memberIndex + 1}. ${member.name}: ${memberRating} ${ratingType === 'faceit' ? 'ELO' : 'Premier'}`);
            });
        });

        // Сохраняем новые команды в БД
        const createdTeams = [];
        const participantIdsInTeams = []; // Массив для хранения ID участников, которые попали в команды
        
        // Сохраняем новые команды в БД
        for (const team of teams) {
            // Создаем команду
            const teamResult = await pool.query(
                'INSERT INTO tournament_teams (tournament_id, name, creator_id) VALUES ($1, $2, $3) RETURNING *',
                [id, team.name, created_by]
            );
            
            const teamId = teamResult.rows[0].id;
            const members = [];
            
            // Добавляем участников команды
            for (const member of team.members) {
                await pool.query(
                    'INSERT INTO tournament_team_members (team_id, user_id, participant_id) VALUES ($1, $2, $3)',
                    [teamId, member.user_id, member.participant_id]
                );
                
                // Собираем ID участников для пакетного обновления флага
                participantIdsInTeams.push(member.participant_id);
                
                members.push({
                    participant_id: member.participant_id,
                    user_id: member.user_id,
                    name: member.name,
                    // 🔧 ИСПРАВЛЕНИЕ: сохраняем правильные рейтинги
                    faceit_elo: member.faceit_elo || member.user_faceit_elo || 1000,
                    cs2_premier_rank: member.cs2_premier_rank || member.user_premier_rank || 5,
                    // 🆕 ДОБАВЛЯЕМ ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ ДЛЯ ДИАГНОСТИКИ
                    faceit_rating_used: member.faceit_rating,
                    premier_rating_used: member.premier_rating
                });
                
                // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА СОХРАНЯЕМОГО УЧАСТНИКА
                if (!member.user_id && (member.faceit_elo || member.cs2_premier_rank)) {
                    console.log(`🔍 Сохраняем гостя ${member.name} в команду ${team.name}:`);
                    console.log(`   - Исходный tp.faceit_elo: ${member.faceit_elo}`);
                    console.log(`   - Исходный tp.cs2_premier_rank: ${member.cs2_premier_rank}`);
                    console.log(`   - Пользовательский u.faceit_elo: ${member.user_faceit_elo}`);
                    console.log(`   - Пользовательский u.cs2_premier_rank: ${member.user_premier_rank}`);
                    console.log(`   - Итоговый faceit_rating: ${member.faceit_rating}`);
                    console.log(`   - Итоговый premier_rating: ${member.premier_rating}`);
                    console.log(`   - Сохраняем faceit_elo: ${member.faceit_elo || member.user_faceit_elo || 1000}`);
                    console.log(`   - Сохраняем cs2_premier_rank: ${member.cs2_premier_rank || member.user_premier_rank || 5}`);
                }
            }
            
            createdTeams.push({
                id: teamId,
                name: team.name,
                members: members
            });
        }
        
        // 🆕 ПОМЕЧАЕМ УЧАСТНИКОВ В КОМАНДАХ КАК in_team = true
        if (participantIdsInTeams.length > 0) {
            await pool.query(
                `UPDATE tournament_participants 
                 SET in_team = TRUE 
                 WHERE id = ANY($1::int[])`,
                [participantIdsInTeams]
            );
            console.log(`✅ Помечено ${participantIdsInTeams.length} участников как находящихся в командах`);
        }

        // 🆕 ПОМЕЧАЕМ ОСТАВШИХСЯ УЧАСТНИКОВ КАК in_team = false
        const participantIdsNotInTeams = participantsNotInTeams.map(p => p.participant_id);
        if (participantIdsNotInTeams.length > 0) {
            await pool.query(
                `UPDATE tournament_participants 
                 SET in_team = FALSE 
                 WHERE id = ANY($1::int[])`,
                [participantIdsNotInTeams]
            );
            console.log(`✅ Помечено ${participantIdsNotInTeams.length} участников как НЕ находящихся в командах`);
        } else {
            // 🔧 ИСПРАВЛЕНИЕ: Если нет участников вне команд, убеждаемся что все участники помечены как в команде
            await pool.query(
                `UPDATE tournament_participants 
                 SET in_team = TRUE 
                 WHERE tournament_id = $1`,
                [id]
            );
            console.log(`✅ Все участники помечены как находящиеся в командах`);
        }
        
        // Обновляем тип участников в турнире на team
        await pool.query('UPDATE tournaments SET participant_type = $1 WHERE id = $2', ['team', id]);
        
        // Формируем сообщение с информацией о распределении
        let resultMessage = `Сформированы команды для турнира "${tournamentName}". `;
        resultMessage += `Создано ${createdTeams.length} команд из ${playersInTeams} участников`;
        if (remainingPlayers > 0) {
            resultMessage += `, ${remainingPlayers} участников остались вне команд`;
        }
        resultMessage += `. Использован рейтинг: ${ratingType === 'faceit' ? 'FACEIT ELO' : 'CS2 Premier Rank'}.`;
        
        // Отправляем объявление в чат турнира о формировании команд
        await sendTournamentChatAnnouncement(
            tournamentName,
            resultMessage,
            id
        );
        
        // 🆕 РАСШИРЕННАЯ СТАТИСТИКА ДЛЯ ОТВЕТА
        const teamAverageRatings = createdTeams.map(team => {
            const ratings = team.members.map(member => 
                ratingType === 'faceit' ? member.faceit_rating_used : member.premier_rating_used
            );
            return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        });
        
        const overallAverage = teamAverageRatings.reduce((sum, avg) => sum + avg, 0) / teamAverageRatings.length;
        const ratingStandardDeviation = Math.sqrt(
            teamAverageRatings.reduce((sum, avg) => sum + Math.pow(avg - overallAverage, 2), 0) / teamAverageRatings.length
        );
        
        const guestsInTeams = createdTeams.reduce((total, team) => 
            total + team.members.filter(member => !member.user_id).length, 0
        );
        
        const customRatingsInTeams = createdTeams.reduce((total, team) => 
            total + team.members.filter(member => member.faceit_elo || member.cs2_premier_rank).length, 0
        );
        
        // 🆕 ДОБАВЛЯЕМ СТАТИСТИКУ БАЛАНСА
        const finalBalanceForResponse = checkTeamBalance(teams);
        const balanceQuality = finalBalanceForResponse.percentageDiff <= 8 ? 'Отличный' : 
                               finalBalanceForResponse.percentageDiff <= 15 ? 'Хороший' : 
                               finalBalanceForResponse.percentageDiff <= 25 ? 'Удовлетворительный' : 'Плохой';
        
        // Возвращаем сформированные команды с детальной статистикой
        res.json({ 
            teams: createdTeams,
            summary: {
                totalParticipants: totalPlayers,
                teamsCreated: fullTeams,
                participantsInTeams: playersInTeams,
                participantsNotInTeams: remainingPlayers,
                ratingType: ratingType,
                teamSize: teamSize,
                message: resultMessage,
                // 🆕 РАСШИРЕННАЯ СТАТИСТИКА БАЛАНСА
                balanceStats: {
                    overallAverageRating: Math.round(overallAverage),
                    ratingStandardDeviation: Math.round(ratingStandardDeviation * 100) / 100,
                    teamAverageRatings: teamAverageRatings.map(avg => Math.round(avg)),
                    // 🎯 НОВАЯ СТАТИСТИКА БАЛАНСА
                    balancePercentage: Math.round(finalBalanceForResponse.percentageDiff * 100) / 100,
                    isBalanced: finalBalanceForResponse.isBalanced,
                    balanceQuality: balanceQuality,
                    rebalanceAttempts: rebalanceAttempts,
                    targetAchieved: finalBalanceForResponse.isBalanced,
                    minTeamRating: Math.round(finalBalanceForResponse.minAvg),
                    maxTeamRating: Math.round(finalBalanceForResponse.maxAvg)
                },
                participantStats: {
                    guestsInTeams: guestsInTeams,
                    registeredInTeams: playersInTeams - guestsInTeams,
                    customRatingsUsed: customRatingsInTeams
                }
            }
        });
    } catch (err) {
        console.error('❌ Ошибка формирования команд:', err);
        console.error('❌ Подробности ошибки:', {
            message: err.message,
            stack: err.stack,
            tournamentId: id,
            requestBody: req.body
        });
        res.status(500).json({ error: err.message });
    }
});

// Обновление размера команды для микс-турнира
router.patch('/:id/team-size', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const { teamSize } = req.body;
    
    if (!teamSize || ![2, 5].includes(parseInt(teamSize, 10))) {
        return res.status(400).json({ error: 'Неверный размер команды. Допустимые значения: 2 или 5' });
    }
    
    try {
        // Проверяем существование турнира
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        const tournament = tournamentResult.rows[0];
        
        // Проверяем формат турнира
        if (tournament.format !== 'mix') {
            return res.status(400).json({ error: 'Изменение размера команды доступно только для mix-турниров' });
        }
        
        // Проверяем, не начался ли уже турнир
        if (tournament.status !== 'active' && tournament.status !== 'pending') {
            return res.status(400).json({ error: 'Изменение размера команды доступно только для турниров в статусе active или pending' });
        }
        
        // Проверяем, не сгенерирована ли уже сетка
        const bracketCheck = await pool.query('SELECT COUNT(*) FROM matches WHERE tournament_id = $1', [id]);
        if (parseInt(bracketCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Нельзя изменить размер команды после генерации сетки турнира' });
        }
        
        // Проверяем, не созданы ли уже команды
        const teamsCheck = await pool.query('SELECT COUNT(*) FROM tournament_teams WHERE tournament_id = $1', [id]);
        if (parseInt(teamsCheck.rows[0].count) > 0) {
            // Удаляем существующие команды, так как размер изменился
            await pool.query('DELETE FROM tournament_team_members WHERE team_id IN (SELECT id FROM tournament_teams WHERE tournament_id = $1)', [id]);
            await pool.query('DELETE FROM tournament_teams WHERE tournament_id = $1', [id]);
        }
        
        // Обновляем размер команды
        const updateResult = await pool.query(
            'UPDATE tournaments SET team_size = $1 WHERE id = $2 RETURNING *',
            [teamSize, id]
        );
        
        res.status(200).json({
            message: `Размер команды успешно обновлен до ${teamSize}`,
            tournament: updateResult.rows[0]
        });
    } catch (err) {
        console.error('❌ Ошибка при обновлении размера команды:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получение оригинальных участников турнира, даже если он переключен в командный режим
router.get('/:id/original-participants', async (req, res) => {
    const { id } = req.params;
    try {
        // Проверяем существование турнира
        const tourCheck = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tourCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // 🆕 ПОЛУЧАЕМ ВСЕХ УЧАСТНИКОВ С ФЛАГОМ in_team ДЛЯ РАЗДЕЛЕНИЯ НА ГРУППЫ
        const participantsRes = await pool.query(
            `SELECT tp.id, tp.user_id, tp.name, tp.tournament_id, tp.in_team,
                    tp.faceit_elo, tp.cs2_premier_rank,
                    u.avatar_url, u.username, 
                    COALESCE(tp.faceit_elo, u.faceit_elo, 1000) as faceit_elo_combined,
                    COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank, 5) as cs2_premier_rank_combined
             FROM tournament_participants tp
             LEFT JOIN users u ON tp.user_id = u.id
             WHERE tp.tournament_id = $1
             ORDER BY tp.in_team DESC, tp.created_at ASC`,
            [id]
        );

        // 🆕 РАЗДЕЛЯЕМ УЧАСТНИКОВ НА ГРУППЫ
        const allParticipants = participantsRes.rows;
        const inTeam = allParticipants.filter(p => p.in_team);
        const notInTeam = allParticipants.filter(p => !p.in_team);

        console.log(`📊 Участники турнира ${id}: всего ${allParticipants.length}, в командах ${inTeam.length}, не в командах ${notInTeam.length}`);

        res.json({
            all: allParticipants,
            inTeam: inTeam,
            notInTeam: notInTeam,
            total: allParticipants.length,
            inTeamCount: inTeam.length,
            notInTeamCount: notInTeam.length
        });
    } catch (err) {
        console.error('❌ Ошибка получения оригинальных участников:', err);
        console.error('❌ Ошибка обновления турнира:', err);
        console.error('❌ Подробности ошибки:', {
            message: err.message,
            stack: err.stack,
            tournamentId: id,
            userId: req.user?.id,
            requestBody: req.body
        });
        res.status(500).json({ error: err.message });
    }
});

// Удаление участника из турнира (для администраторов и создателей)
router.delete('/:id/participants/:participantId', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id, participantId } = req.params;
    const userId = req.user.id;

    try {
        console.log(`🗑️ Запрос на удаление участника ${participantId} из турнира ${id} пользователем ${userId}`);
        
        // Проверка существования турнира
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        const tournament = tournamentResult.rows[0];
        
        // Проверка статуса турнира - разрешаем удаление только для активных турниров
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Удаление участников доступно только для активных турниров' });
        }
        
        // Проверка, не сгенерирована ли сетка
        const matchesCheck = await pool.query(
            'SELECT COUNT(*) FROM matches WHERE tournament_id = $1',
            [id]
        );
        if (parseInt(matchesCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Нельзя удалять участников после генерации сетки' });
        }
        
        // Проверяем существование участника и получаем его данные
        let participantInfo = null;
        let deleted = false;
        
        if (tournament.participant_type === 'solo') {
            // Для одиночных турниров
            const participantResult = await pool.query(
                'SELECT tp.*, u.username FROM tournament_participants tp LEFT JOIN users u ON tp.user_id = u.id WHERE tp.id = $1 AND tp.tournament_id = $2',
                [participantId, id]
            );
            
            if (participantResult.rows.length === 0) {
                return res.status(404).json({ error: 'Участник не найден' });
            }
            
            participantInfo = participantResult.rows[0];
            
            // Удаляем участника
            const deleteResult = await pool.query(
                'DELETE FROM tournament_participants WHERE id = $1 AND tournament_id = $2 RETURNING *',
                [participantId, id]
            );
            
            deleted = deleteResult.rowCount > 0;
            
        } else {
            // Для командных турниров
            const teamResult = await pool.query(
                'SELECT tt.*, u.username as creator_name FROM tournament_teams tt LEFT JOIN users u ON tt.creator_id = u.id WHERE tt.id = $1 AND tt.tournament_id = $2',
                [participantId, id]
            );
            
            if (teamResult.rows.length === 0) {
                return res.status(404).json({ error: 'Команда не найдена' });
            }
            
            participantInfo = teamResult.rows[0];
            
            // Удаляем всех участников команды
            await pool.query(
                'DELETE FROM tournament_team_members WHERE team_id = $1',
                [participantId]
            );
            
            // Удаляем саму команду
            const deleteResult = await pool.query(
                'DELETE FROM tournament_teams WHERE id = $1 AND tournament_id = $2 RETURNING *',
                [participantId, id]
            );
            
            deleted = deleteResult.rowCount > 0;
        }
        
        if (!deleted) {
            return res.status(400).json({ error: 'Не удалось удалить участника' });
        }
        
        // Логируем удаление
        await logTournamentEvent(id, userId, 'participant_removed', {
            removedParticipant: {
                id: participantId,
                name: participantInfo.name || participantInfo.username,
                type: tournament.participant_type
            },
            removedBy: req.user.username
        });
        
        // Отправляем уведомление создателю турнира (если удаляет админ)
        if (tournament.created_by !== userId) {
            const notificationMessage = `Администратор ${req.user.username} удалил участника "${participantInfo.name || participantInfo.username}" из турнира "${tournament.name}"`;
            await pool.query(
                'INSERT INTO notifications (user_id, message, type, tournament_id) VALUES ($1, $2, $3, $4)',
                [tournament.created_by, notificationMessage, 'participant_removed', id]
            );
        }
        
        // Отправляем уведомление удаленному участнику (если он зарегистрирован)
        if (participantInfo.user_id) {
            const notificationMessage = `Вы были удалены из турнира "${tournament.name}" администратором`;
            await pool.query(
                'INSERT INTO notifications (user_id, message, type, tournament_id) VALUES ($1, $2, $3, $4)',
                [participantInfo.user_id, notificationMessage, 'removed_from_tournament', id]
            );
        }
        
        // Отправляем объявление в чат турнира
        await sendTournamentChatAnnouncement(
            tournament.name,
            `Участник "${participantInfo.name || participantInfo.username}" был удален из турнира "${tournament.name}"`,
            id
        );
        
        console.log(`✅ Участник ${participantId} успешно удален из турнира ${id}`);
        
        res.status(200).json({ 
            message: 'Участник успешно удален из турнира',
            removedParticipant: {
                id: participantId,
                name: participantInfo.name || participantInfo.username
            }
        });
        
    } catch (err) {
        console.error('❌ Ошибка удаления участника:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===== УПРАВЛЕНИЕ АДМИНИСТРАТОРАМИ ТУРНИРОВ =====

// Приглашение администратора турнира
router.post('/:id/invite-admin', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    const inviterId = req.user.id;

    try {
        console.log('👑 Получен запрос на приглашение администратора:', {
            tournamentId: id,
            inviterId,
            targetUserId: user_id
        });

        // Проверяем существование турнира
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Турнир не найден' 
            });
        }

        const tournament = tournamentResult.rows[0];

        // Проверяем существование пользователя
        const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [user_id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Пользователь не найден' 
            });
        }

        const targetUser = userResult.rows[0];

        // Проверяем, не является ли пользователь уже администратором
        const adminCheckResult = await pool.query(
            'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [id, user_id]
        );

        if (adminCheckResult.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Пользователь уже является администратором этого турнира' 
            });
        }

        // Проверяем, не является ли пользователь создателем турнира
        if (tournament.created_by === user_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Создатель турнира уже имеет все права администратора' 
            });
        }

        // Проверяем, нет ли уже активного приглашения
        const existingInvitationResult = await pool.query(
            `SELECT * FROM admin_invitations 
             WHERE tournament_id = $1 AND invitee_id = $2 AND status = 'pending' 
             AND expires_at > NOW()`,
            [id, user_id]
        );

        if (existingInvitationResult.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Пользователю уже отправлено активное приглашение' 
            });
        }

        // Создаем приглашение (срок действия 7 дней)
        const invitationResult = await pool.query(
            `INSERT INTO admin_invitations (tournament_id, inviter_id, invitee_id, status, expires_at)
             VALUES ($1, $2, $3, 'pending', NOW() + INTERVAL '7 days')
             RETURNING *`,
            [id, inviterId, user_id]
        );

        const invitation = invitationResult.rows[0];

        // Получаем информацию о системном пользователе
        let systemUserId = null;
        try {
            const systemUserResult = await pool.query(
                "SELECT id FROM users WHERE username = '1337community' AND is_system_user = true"
            );
            if (systemUserResult.rows.length > 0) {
                systemUserId = systemUserResult.rows[0].id;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось найти системного пользователя для отправки сообщения:', error.message);
        }

        // Отправляем сообщение в чат турнира от системного пользователя
        if (systemUserId) {
            try {
                // Находим чат турнира
                const chatResult = await pool.query(
                    'SELECT id FROM chats WHERE name = $1 AND type = $2',
                    [tournament.name, 'group']
                );

                if (chatResult.rows.length > 0) {
                    const chatId = chatResult.rows[0].id;

                    // Создаем сообщение с кнопками для принятия/отклонения
                    const messageText = `🤝 ${req.user.username} приглашает вас стать администратором турнира "${tournament.name}"!\n\nВы получите права на:\n• Управление участниками\n• Редактирование результатов матчей\n• Приглашение других администраторов\n\nВыберите действие:`;

                    const messageResult = await pool.query(
                        `INSERT INTO messages (chat_id, sender_id, content, message_type, metadata)
                         VALUES ($1, $2, $3, 'admin_invitation', $4)
                         RETURNING *`,
                        [
                            chatId, 
                            systemUserId, 
                            messageText,
                            JSON.stringify({
                                invitation_id: invitation.id,
                                tournament_id: id,
                                inviter_id: inviterId,
                                invitee_id: user_id,
                                actions: [
                                    {
                                        type: 'accept_admin_invitation',
                                        label: '✅ Принять',
                                        invitation_id: invitation.id
                                    },
                                    {
                                        type: 'decline_admin_invitation', 
                                        label: '❌ Отклонить',
                                        invitation_id: invitation.id
                                    }
                                ]
                            })
                        ]
                    );

                    console.log('✅ Сообщение с приглашением отправлено в чат турнира');
                } else {
                    console.warn('⚠️ Чат турнира не найден, сообщение не отправлено');
                }
            } catch (error) {
                console.error('❌ Ошибка при отправке сообщения в чат:', error.message);
            }
        }

        // Логируем событие
        await logTournamentEvent(id, inviterId, 'admin_invited', {
            invitedUser: {
                id: user_id,
                username: targetUser.username
            },
            inviter: req.user.username
        });

        console.log('✅ Приглашение администратора создано успешно');

        res.status(200).json({
            success: true,
            message: `Приглашение отправлено пользователю ${targetUser.username}`,
            data: {
                invitation_id: invitation.id,
                expires_at: invitation.expires_at
            }
        });

    } catch (err) {
        console.error('❌ Ошибка при приглашении администратора:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Внутренняя ошибка сервера' 
        });
    }
});

// Удаление администратора турнира
router.delete('/:id/admins/:userId', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id, userId } = req.params;
    const removerId = req.user.id;

    try {
        console.log('🗑️ Получен запрос на удаление администратора:', {
            tournamentId: id,
            removerId,
            targetUserId: userId
        });

        // Проверяем существование турнира
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Турнир не найден' 
            });
        }

        const tournament = tournamentResult.rows[0];

        // Проверяем, что пользователь не пытается удалить создателя турнира
        if (tournament.created_by === parseInt(userId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Нельзя удалить создателя турнира' 
            });
        }

        // Проверяем, является ли пользователь администратором
        const adminResult = await pool.query(
            'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [id, userId]
        );

        if (adminResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Пользователь не является администратором этого турнира' 
            });
        }

        // Получаем информацию о удаляемом пользователе
        const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
        const targetUsername = userResult.rows[0]?.username || `User #${userId}`;

        // Удаляем администратора
        const deleteResult = await pool.query(
            'DELETE FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        if (deleteResult.rowCount === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Не удалось удалить администратора' 
            });
        }

        // Логируем событие
        await logTournamentEvent(id, removerId, 'admin_removed', {
            removedAdmin: {
                id: userId,
                username: targetUsername
            },
            remover: req.user.username
        });

        // Отправляем уведомление удаленному администратору
        try {
            await pool.query(
                'INSERT INTO notifications (user_id, message, type, tournament_id) VALUES ($1, $2, $3, $4)',
                [
                    userId, 
                    `Вы были исключены из администраторов турнира "${tournament.name}"`, 
                    'admin_removed', 
                    id
                ]
            );
        } catch (error) {
            console.warn('⚠️ Не удалось отправить уведомление удаленному администратору:', error.message);
        }

        console.log('✅ Администратор успешно удален');

        res.status(200).json({
            success: true,
            message: `Администратор ${targetUsername} успешно удален`,
            data: {
                removed_admin_id: userId
            }
        });

    } catch (err) {
        console.error('❌ Ошибка при удалении администратора:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Внутренняя ошибка сервера' 
        });
    }
});

// Принятие приглашения администратора
router.post('/admin-invitations/:invitationId/accept', authenticateToken, async (req, res) => {
    const { invitationId } = req.params;
    const userId = req.user.id;

    try {
        console.log('✅ Получен запрос на принятие приглашения:', {
            invitationId,
            userId
        });

        // Проверяем существование и валидность приглашения
        const invitationResult = await pool.query(
            `SELECT ai.*, t.name as tournament_name, u.username as inviter_username
             FROM admin_invitations ai
             JOIN tournaments t ON ai.tournament_id = t.id
             JOIN users u ON ai.inviter_id = u.id
             WHERE ai.id = $1 AND ai.invitee_id = $2 AND ai.status = 'pending' 
             AND ai.expires_at > NOW()`,
            [invitationId, userId]
        );

        if (invitationResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Приглашение не найдено или истекло' 
            });
        }

        const invitation = invitationResult.rows[0];

        // Проверяем, не является ли пользователь уже администратором
        const adminCheckResult = await pool.query(
            'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [invitation.tournament_id, userId]
        );

        if (adminCheckResult.rows.length > 0) {
            // Обновляем статус приглашения на accepted даже если уже администратор
            await pool.query(
                'UPDATE admin_invitations SET status = $1, responded_at = NOW() WHERE id = $2',
                ['accepted', invitationId]
            );

            return res.status(200).json({ 
                success: true, 
                message: 'Вы уже являетесь администратором этого турнира' 
            });
        }

        // Добавляем пользователя в администраторы
        await pool.query(
            `INSERT INTO tournament_admins (tournament_id, user_id, permissions)
             VALUES ($1, $2, $3)`,
            [
                invitation.tournament_id, 
                userId, 
                JSON.stringify({
                    can_edit_matches: true,
                    can_manage_participants: true,
                    can_invite_admins: true
                })
            ]
        );

        // Обновляем статус приглашения
        await pool.query(
            'UPDATE admin_invitations SET status = $1, responded_at = NOW() WHERE id = $2',
            ['accepted', invitationId]
        );

        // Логируем событие
        await logTournamentEvent(invitation.tournament_id, userId, 'admin_assigned', {
            newAdmin: {
                id: userId,
                username: req.user.username
            },
            inviter: invitation.inviter_username,
            via: 'invitation_accepted'
        });

        console.log('✅ Приглашение принято, пользователь добавлен в администраторы');

        res.status(200).json({
            success: true,
            message: `Вы успешно стали администратором турнира "${invitation.tournament_name}"`,
            data: {
                tournament_id: invitation.tournament_id,
                tournament_name: invitation.tournament_name
            }
        });

    } catch (err) {
        console.error('❌ Ошибка при принятии приглашения:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Внутренняя ошибка сервера' 
        });
    }
});

// Отклонение приглашения администратора
router.post('/admin-invitations/:invitationId/decline', authenticateToken, async (req, res) => {
    const { invitationId } = req.params;
    const userId = req.user.id;

    try {
        console.log('❌ Получен запрос на отклонение приглашения:', {
            invitationId,
            userId
        });

        // Проверяем существование и валидность приглашения
        const invitationResult = await pool.query(
            `SELECT ai.*, t.name as tournament_name, u.username as inviter_username
             FROM admin_invitations ai
             JOIN tournaments t ON ai.tournament_id = t.id
             JOIN users u ON ai.inviter_id = u.id
             WHERE ai.id = $1 AND ai.invitee_id = $2 AND ai.status = 'pending'`,
            [invitationId, userId]
        );

        if (invitationResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Приглашение не найдено' 
            });
        }

        const invitation = invitationResult.rows[0];

        // Обновляем статус приглашения
        await pool.query(
            'UPDATE admin_invitations SET status = $1, responded_at = NOW() WHERE id = $2',
            ['declined', invitationId]
        );

        // Логируем событие
        await logTournamentEvent(invitation.tournament_id, userId, 'admin_invitation_declined', {
            declinedBy: {
                id: userId,
                username: req.user.username
            },
            inviter: invitation.inviter_username
        });

        console.log('❌ Приглашение отклонено');

        res.status(200).json({
            success: true,
            message: `Приглашение в администраторы турнира "${invitation.tournament_name}" отклонено`,
            data: {
                tournament_id: invitation.tournament_id,
                tournament_name: invitation.tournament_name
            }
        });

    } catch (err) {
        console.error('❌ Ошибка при отклонении приглашения:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Внутренняя ошибка сервера' 
        });
    }
});

module.exports = router;