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
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        // Получаем данные участников в зависимости от типа турнира, добавляя информацию о аватарке
        let participantsQuery;
        if (tournament.participant_type === 'solo') {
            participantsQuery = `
                SELECT tp.*, u.avatar_url, u.username, u.faceit_elo 
                FROM tournament_participants tp 
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tp.tournament_id = $1
            `;
        } else {
            participantsQuery = `
                SELECT tt.*, u.avatar_url, u.username
                FROM tournament_teams tt
                LEFT JOIN users u ON tt.creator_id = u.id
                WHERE tt.tournament_id = $1
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
                            tp.name, u.username, u.avatar_url, u.faceit_elo, u.cs2_premier_rank
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
            mixed_teams: teams // Добавляем поле mixed_teams для обратной совместимости
        };
        console.log('🔍 Tournament details fetched:', {
            name: responseData.name,
            format: responseData.format,
            participant_type: responseData.participant_type,
            participants: responseData.participants.length,
            matches: responseData.matches.length,
            teams: responseData.teams.length
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
                SELECT tp.*, u.avatar_url, u.username, u.faceit_elo 
                FROM tournament_participants tp 
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tp.tournament_id = $1
            `;
        } else {
            participantsQuery = `
                SELECT tt.*, u.avatar_url, u.username
                FROM tournament_teams tt
                LEFT JOIN users u ON tt.creator_id = u.id
                WHERE tt.tournament_id = $1
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
                            tp.name, u.username, u.avatar_url, u.faceit_elo, u.cs2_premier_rank
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
            mixed_teams: teams // Добавляем поле mixed_teams для обратной совместимости
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
            
            // Добавляем участника в tournament_participants с флагом in_team = false
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name, in_team) VALUES ($1, $2, $3, $4)',
                [id, userId, req.user.username, false]
            );
            
            console.log(`✅ Участник ${req.user.username} добавлен в микс турнир как индивидуальный игрок (не в команде)`);
            
        } else if (tournament.participant_type === 'solo') {
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
                        SET winner_id = $1, 
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
    const { participantName, userId } = req.body;
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

        // 🆕 ИСПРАВЛЕННАЯ ЛОГИКА ДЛЯ МИКС ТУРНИРОВ
        // Для микс турниров ВСЕГДА добавляем в tournament_participants, даже если participant_type = 'team'
        if (tournament.format === 'mix') {
            console.log(`🎯 Добавляем участника в микс турнир: ${participantName} (user_id: ${userId || 'гость'})`);
            
            // Добавляем участника в tournament_participants с флагом in_team = false
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name, in_team) VALUES ($1, $2, $3, $4)',
                [id, userId || null, participantName, false]
            );
            
            console.log(`✅ Участник ${participantName} добавлен в микс турнир как индивидуальный игрок (не в команде)`);
            
        } else if (tournament.participant_type === 'solo') {
            // Обычные solo турниры
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name) VALUES ($1, $2, $3)',
                [id, userId || null, participantName]
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
                
                // Добавляем участника в tournament_participants с флагом in_team = false
                await pool.query(
                    'INSERT INTO tournament_participants (tournament_id, user_id, name, in_team) VALUES ($1, $2, $3, $4)',
                    [id, userId, req.user.username, false]
                );
                
                console.log(`✅ Участник ${req.user.username} добавлен в микс турнир как индивидуальный игрок (не в команде)`);
                
            } else if (tournament.participant_type === 'solo') {
                await pool.query(
                    'INSERT INTO tournament_participants (tournament_id, user_id, name) VALUES ($1, $2, $3)',
                    [id, userId, req.user.username]
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
    try {
        // Получаем параметры турнира
        const tourRes = await pool.query('SELECT team_size, created_by FROM tournaments WHERE id = $1', [id]);
        if (!tourRes.rows.length) return res.status(404).json({ error: 'Турнир не найден' });
        const { team_size: sizeFromDb, created_by } = tourRes.rows[0];
        const teamSize = parseInt(sizeFromDb, 10) || 1;

        // 🔧 УДАЛЯЕМ СУЩЕСТВУЮЩИЕ КОМАНДЫ ПЕРЕД СОЗДАНИЕМ НОВЫХ
        console.log(`🗑️ Удаляем существующие команды для турнира ${id} перед переформированием`);
        
        // Сначала помечаем всех участников как не в команде
        await pool.query(
            'UPDATE tournament_participants SET in_team = FALSE WHERE tournament_id = $1',
            [id]
        );
        
        // Затем удаляем участников команд
        await pool.query(
            'DELETE FROM tournament_team_members WHERE team_id IN (SELECT id FROM tournament_teams WHERE tournament_id = $1)',
            [id]
        );
        
        // Затем удаляем сами команды
        const deleteResult = await pool.query(
            'DELETE FROM tournament_teams WHERE tournament_id = $1',
            [id]
        );
        
        console.log(`✅ Удалено ${deleteResult.rowCount} существующих команд, все участники помечены как не в команде`);

        // 🆕 ПОЛУЧАЕМ ВСЕХ УЧАСТНИКОВ (включая тех, кто был добавлен после формирования команд)
        const partRes = await pool.query(
            `SELECT tp.id AS participant_id, tp.user_id, tp.name,
                    COALESCE(u.faceit_elo, 0) as faceit_rating,
                    COALESCE(u.cs2_premier_rank, 0) as premier_rating,
                    tp.in_team
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
        console.log(`📊 Из них было в командах: ${participants.filter(p => p.in_team).length}`);
        console.log(`📊 Новых участников (не в команде): ${participants.filter(p => !p.in_team).length}`);
        
        // 🆕 НОВАЯ ЛОГИКА: Формируем максимальное количество полных команд
        const totalPlayers = participants.length;
        const fullTeams = Math.floor(totalPlayers / teamSize); // Количество полных команд
        const playersInTeams = fullTeams * teamSize; // Участников в командах
        const remainingPlayers = totalPlayers - playersInTeams; // Лишние участники
        
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
        
        // Сортируем игроков по рейтингу (в зависимости от выбранного типа)
        const sortedParticipants = [...participants].sort((a, b) => {
            if (ratingType === 'faceit') {
                return b.faceit_rating - a.faceit_rating;
            } else if (ratingType === 'premier') {
                return b.premier_rating - a.premier_rating;
            } else {
                return b.faceit_rating - a.faceit_rating;
            }
        });
        
        // 🆕 РАЗДЕЛЯЕМ УЧАСТНИКОВ: первые попадают в команды, остальные остаются вне команд
        const participantsForTeams = sortedParticipants.slice(0, playersInTeams);
        const participantsNotInTeams = sortedParticipants.slice(playersInTeams);
        
        console.log(`👥 Участников для команд: ${participantsForTeams.length}`);
        console.log(`🚫 Участников вне команд: ${participantsNotInTeams.length}`);
        
        // Формируем команды с равномерным распределением по рейтингу
        const teams = [];
        
        // Создаем пустые команды
        for (let i = 0; i < fullTeams; i++) {
            teams.push({
                name: `Команда ${i + 1}`,
                members: []
            });
        }
        
        // Распределяем игроков змейкой для баланса команд
        // Сначала лучшие игроки, затем послабее
        for (let i = 0; i < teamSize; i++) {
            // Прямой порядок для четных итераций, обратный для нечетных
            const teamOrder = i % 2 === 0 
                ? Array.from({ length: fullTeams }, (_, idx) => idx) 
                : Array.from({ length: fullTeams }, (_, idx) => fullTeams - 1 - idx);
            
            for (let teamIndex of teamOrder) {
                const playerIndex = i * fullTeams + (i % 2 === 0 ? teamIndex : fullTeams - 1 - teamIndex);
                if (playerIndex < participantsForTeams.length) {
                    teams[teamIndex].members.push(participantsForTeams[playerIndex]);
                }
            }
        }

        console.log(`✅ Успешно создано ${teams.length} новых команд для турнира ${id}`);
        
        // Удаляем старые команды, если они есть
        await pool.query('DELETE FROM tournament_team_members WHERE team_id IN (SELECT id FROM tournament_teams WHERE tournament_id = $1)', [id]);
        await pool.query('DELETE FROM tournament_teams WHERE tournament_id = $1', [id]);
        
        // Сохраняем новые команды в БД
        const createdTeams = [];
        const participantIdsInTeams = []; // Массив для хранения ID участников, которые попали в команды
        
        // Сохраняем новые команды в БД
        for (const team of teams) {
            // Создаем команду
            const teamResult = await pool.query(
                'INSERT INTO tournament_teams (tournament_id, name, creator_id) VALUES ($1, $2, $3) RETURNING *',
                [id, team.name, tournament.created_by]
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
                    faceit_elo: member.faceit_rating || 0,
                    cs2_premier_rank: member.premier_rating || 0
                });
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
        }
        
        // Обновляем тип участников в турнире на team
        await pool.query('UPDATE tournaments SET participant_type = $1 WHERE id = $2', ['team', id]);
        
        // Формируем сообщение с информацией о распределении
        let resultMessage = `Сформированы команды для турнира "${tournament.name}". `;
        resultMessage += `Создано ${createdTeams.length} команд из ${playersInTeams} участников`;
        if (remainingPlayers > 0) {
            resultMessage += `, ${remainingPlayers} участников остались вне команд`;
        }
        resultMessage += `.`;
        
        // Отправляем объявление в чат турнира о формировании команд
        await sendTournamentChatAnnouncement(
            tournament.name,
            resultMessage,
            id
        );
        
        // Возвращаем сформированные команды
        res.json({ 
            teams: createdTeams,
            summary: {
                totalParticipants: totalPlayers,
                teamsCreated: fullTeams,
                participantsInTeams: playersInTeams,
                participantsNotInTeams: remainingPlayers,
                message: resultMessage
            }
        });
    } catch (err) {
        console.error('❌ Ошибка генерации mix-команд:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получение команд и их участников для командных турниров
router.get('/:id/teams', async (req, res) => {
    const { id } = req.params;
    try {
        // Проверяем существование турнира
        const tourCheck = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tourCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Получаем все команды турнира
        const teamsRes = await pool.query(
            `SELECT tt.id, tt.tournament_id, tt.name, tt.creator_id
             FROM tournament_teams tt
             WHERE tt.tournament_id = $1`,
            [id]
        );

        // Для каждой команды получаем участников
        const teams = await Promise.all(teamsRes.rows.map(async (team) => {
            const membersRes = await pool.query(
                `SELECT tm.team_id, tm.user_id, tm.participant_id, 
                        tp.name, u.username, u.avatar_url, u.faceit_elo, u.cs2_premier_rank
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

        res.json(teams);
    } catch (err) {
        console.error('❌ Ошибка получения команд турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// Маршрут для очистки результатов всех матчей в турнире
router.post('/:id/clear-match-results', authenticateToken, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        // Получаем информацию о турнире
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        const tournament = tournamentResult.rows[0];
        
        // Проверяем, является ли пользователь создателем турнира
        if (tournament.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Только создатель турнира может очищать результаты матчей' });
        }
        
        // Сбрасываем результаты всех матчей в турнире
        await pool.query(`
            UPDATE matches 
            SET winner_team_id = NULL, 
                score1 = 0, 
                score2 = 0
            WHERE tournament_id = $1
        `, [tournamentId]);
        
        // Получаем обновленные данные о турнире для отправки на клиент
        const tournamentData = await getTournamentWithDetails(tournamentId);
        
        // Отправляем обновление через Socket.IO
        if (io) {
            io.to(`tournament_${tournamentId}`).emit('tournament_update', {
                tournamentId: tournamentId,
                data: tournamentData
            });
        }
        
        res.json({ 
            message: 'Результаты матчей успешно очищены',
            tournament: tournamentData
        });
    } catch (error) {
        console.error('Ошибка при очистке результатов матчей:', error);
        res.status(500).json({ error: 'Ошибка очистки результатов матчей' });
    }
});

// Удаление всех матчей турнира
router.post('/:id/delete-all-matches', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Проверка турнира и прав доступа
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        // Проверка, что пользователь имеет права (использует verifyAdminOrCreator middleware)
        console.log(`Удаление всех матчей для турнира ${id} пользователем ${userId}`);

        // Выполняем SQL-запрос для удаления всех матчей этого турнира
        const deleteResult = await pool.query(
            'DELETE FROM matches WHERE tournament_id = $1 RETURNING *',
            [id]
        );

        console.log(`Удалено ${deleteResult.rowCount} матчей для турнира ${id}`);

        // Отправляем оповещение о обновлении турнира
        const updatedTournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        const tournamentData = updatedTournamentResult.rows[0];
        tournamentData.matches = []; // Пустой массив, так как все матчи удалены
        
        // Получаем участников
        let participantsQuery;
        if (tournament.participant_type === 'solo') {
            participantsQuery = `
                SELECT tp.*, u.avatar_url, u.username, u.faceit_elo 
                FROM tournament_participants tp 
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tp.tournament_id = $1
            `;
        } else {
            participantsQuery = `
                SELECT tt.*, u.avatar_url, u.username
                FROM tournament_teams tt
                LEFT JOIN users u ON tt.creator_id = u.id
                WHERE tt.tournament_id = $1
            `;
        }
        
        const participantsResult = await pool.query(participantsQuery, [id]);
        tournamentData.participants = participantsResult.rows;
        tournamentData.participant_count = participantsResult.rowCount;

        // Уведомляем всех клиентов, просматривающих этот турнир
        broadcastTournamentUpdate(id, tournamentData);

        res.status(200).json({ 
            message: `Успешно удалено ${deleteResult.rowCount} матчей`,
            tournament: tournamentData
        });
    } catch (err) {
        console.error('❌ Ошибка удаления матчей турнира:', err);
        res.status(500).json({ error: 'Ошибка очистки результатов матчей: ' + err.message });
    }
});

// Очистка результатов матчей (без удаления самих матчей)
router.post('/:id/clear-match-results', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Проверка турнира и прав доступа
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        // Проверка, что пользователь имеет права (использует verifyAdminOrCreator middleware)
        console.log(`Очистка результатов матчей для турнира ${id} пользователем ${userId}`);

        // Выполняем SQL-запрос для сброса результатов матчей
        const updateResult = await pool.query(
            'UPDATE matches SET winner_team_id = NULL, score1 = 0, score2 = 0 WHERE tournament_id = $1 RETURNING *',
            [id]
        );

        console.log(`Очищены результаты ${updateResult.rowCount} матчей для турнира ${id}`);

        // Получаем обновленные данные турнира
        const updatedTournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        const tournamentData = updatedTournamentResult.rows[0];
        
        // Получаем матчи
        const matchesResult = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [id]
        );
        tournamentData.matches = matchesResult.rows;
        
        // Получаем участников
        let participantsQuery;
        if (tournament.participant_type === 'solo') {
            participantsQuery = `
                SELECT tp.*, u.avatar_url, u.username, u.faceit_elo 
                FROM tournament_participants tp 
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tp.tournament_id = $1
            `;
        } else {
            participantsQuery = `
                SELECT tt.*, u.avatar_url, u.username
                FROM tournament_teams tt
                LEFT JOIN users u ON tt.creator_id = u.id
                WHERE tt.tournament_id = $1
            `;
        }
        
        const participantsResult = await pool.query(participantsQuery, [id]);
        tournamentData.participants = participantsResult.rows;
        tournamentData.participant_count = participantsResult.rowCount;

        // Уведомляем всех клиентов, просматривающих этот турнир
        broadcastTournamentUpdate(id, tournamentData);

        res.status(200).json({ 
            message: `Успешно очищены результаты ${updateResult.rowCount} матчей`,
            tournament: tournamentData
        });
    } catch (err) {
        console.error('❌ Ошибка очистки результатов матчей турнира:', err);
        res.status(500).json({ error: 'Ошибка очистки результатов матчей: ' + err.message });
    }
});

// Завершение турнира
router.post('/:id/end', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    
    try {
        // Проверка существования турнира
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        const tournament = tournamentResult.rows[0];
        
        // Проверка текущего статуса (можно завершить только активный или идущий турнир)
        if (tournament.status !== 'active' && tournament.status !== 'in_progress') {
            return res.status(400).json({ error: 'Можно завершить только активный или идущий турнир' });
        }
        
        // 🎯 ОПРЕДЕЛЯЕМ ПРИЗЕРОВ АВТОМАТИЧЕСКИ
        const winnersData = await determineTournamentWinners(id);
        console.log('🏆 Определенные призеры:', winnersData);
        
        // Создаем строку для обновления с информацией о призерах
        let updateQuery = 'UPDATE tournaments SET status = $1, end_date = NOW()';
        let updateParams = ['completed', id];
        let paramIndex = 3;
        
        if (winnersData.winner) {
            updateQuery += `, winner_id = $${paramIndex}, winner_name = $${paramIndex + 1}`;
            updateParams.splice(-1, 0, winnersData.winner.id, winnersData.winner.name);
            paramIndex += 2;
        }
        
        if (winnersData.secondPlace) {
            updateQuery += `, second_place_id = $${paramIndex}, second_place_name = $${paramIndex + 1}`;
            updateParams.splice(-1, 0, winnersData.secondPlace.id, winnersData.secondPlace.name);
            paramIndex += 2;
        }
        
        if (winnersData.thirdPlace) {
            updateQuery += `, third_place_id = $${paramIndex}, third_place_name = $${paramIndex + 1}`;
            updateParams.splice(-1, 0, winnersData.thirdPlace.id, winnersData.thirdPlace.name);
            paramIndex += 2;
        }
        
        updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
        
        // Устанавливаем дату окончания, меняем статус на 'completed' и сохраняем информацию о призерах
        const updateResult = await pool.query(updateQuery, updateParams);
        
        // Получаем обновленные данные турнира
        const updatedTournament = updateResult.rows[0];
        
        // 🔄 АВТОМАТИЧЕСКИ ПЕРЕСЧИТЫВАЕМ СТАТИСТИКУ для всех участников
        console.log(`🎯 Турнир завершен, пересчитываем статистику для всех участников...`);
        try {
            await recalculateAllParticipantsStats(id, tournament.participant_type);
            console.log(`✅ Статистика успешно пересчитана для турнира ${tournament.name}`);
        } catch (statsError) {
            console.error(`⚠️ Ошибка пересчета статистики для турнира ${tournament.name}:`, statsError.message);
            // Не прерываем завершение турнира из-за ошибки статистики
        }
        
        // Получаем данные участников
        let participantsQuery;
        if (updatedTournament.participant_type === 'solo') {
            participantsQuery = `
                SELECT tp.*, u.avatar_url, u.username, u.faceit_elo 
                FROM tournament_participants tp 
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tp.tournament_id = $1
            `;
        } else {
            participantsQuery = `
                SELECT tt.*, u.avatar_url, u.username
                FROM tournament_teams tt
                LEFT JOIN users u ON tt.creator_id = u.id
                WHERE tt.tournament_id = $1
            `;
        }
        
        const participantsResult = await pool.query(participantsQuery, [id]);
        
        // Получаем матчи
        const matchesResult = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [id]
        );
        
        const responseData = {
            ...updatedTournament,
            participants: participantsResult.rows,
            participant_count: participantsResult.rows.length,
            matches: matchesResult.rows,
        };
        
        // Отправляем обновление через WebSocket
        broadcastTournamentUpdate(id, responseData);
        // Отправляем объявление в чат турнира о завершении
        await sendTournamentChatAnnouncement(
            updatedTournament.name,
            `Турнир "${updatedTournament.name}" завершён${winnersData.winner ? `. Победитель: ${winnersData.winner.name}` : ''}`,
            id
        );
        
        // Возвращаем успешный ответ
        res.status(200).json({
            message: 'Турнир успешно завершен, статистика обновлена для всех участников',
            tournament: responseData
        });
    } catch (err) {
        console.error('❌ Ошибка при завершении турнира:', err);
        res.status(500).json({ error: err.message });
    }
});

// 🎯 ФУНКЦИЯ ОПРЕДЕЛЕНИЯ ПРИЗЕРОВ ТУРНИРА
async function determineTournamentWinners(tournamentId) {
    try {
        console.log('🏆 Начинаем определение призеров для турнира:', tournamentId);
        
        // Получаем все матчи турнира
        const matchesResult = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round DESC, match_number',
            [tournamentId]
        );
        
        const matches = matchesResult.rows;
        if (matches.length === 0) {
            console.log('⚠️ Нет матчей для определения призеров');
            return { winner: null, secondPlace: null, thirdPlace: null };
        }
        
        console.log(`🔍 Найдено ${matches.length} матчей для анализа`);
        
        // Получаем информацию о турнире
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        const tournament = tournamentResult.rows[0];
        
        // Находим матч за третье место
        const thirdPlaceMatch = matches.find(match => 
            match.is_third_place_match === true || match.is_third_place === true
        );
        
        // Находим финальный матч (самый высокий раунд, не является матчем за 3-е место, завершен)
        const completedMatches = matches.filter(match => 
            (match.winner_team_id || match.winner_id) && 
            !match.is_third_place_match && 
            !match.is_third_place
        );
        
        const finalMatch = completedMatches
            .sort((a, b) => (b.round || 0) - (a.round || 0))[0];
        
        console.log('🎯 Финальный матч:', finalMatch?.id);
        console.log('🎯 Матч за 3-е место:', thirdPlaceMatch?.id);
        
        let winner = null;
        let secondPlace = null;
        let thirdPlace = null;
        
        // Определяем победителя и второе место из финального матча
        if (finalMatch) {
            const winnerId = finalMatch.winner_team_id || finalMatch.winner_id;
            const loserId = winnerId === finalMatch.team1_id ? finalMatch.team2_id : finalMatch.team1_id;
            
            console.log(`🏆 Победитель ID: ${winnerId}, Проигравший в финале ID: ${loserId}`);
            
            // Получаем информацию об участниках
            winner = await getParticipantInfo(winnerId, tournament);
            secondPlace = await getParticipantInfo(loserId, tournament);
        }
        
        // Определяем третье место из матча за 3-е место
        if (thirdPlaceMatch && (thirdPlaceMatch.winner_team_id || thirdPlaceMatch.winner_id)) {
            const thirdWinnerId = thirdPlaceMatch.winner_team_id || thirdPlaceMatch.winner_id;
            console.log(`🥉 Третье место ID: ${thirdWinnerId}`);
            
            thirdPlace = await getParticipantInfo(thirdWinnerId, tournament);
        }

        // 🎯 НОВАЯ ФУНКЦИЯ: Сохраняем всех участников команд как призеров
        await saveTeamMembersAsWinners(tournamentId, tournament, winner, secondPlace, thirdPlace);
        
        const result = { winner, secondPlace, thirdPlace };
        console.log('🏆 Итоговые призеры:', result);
        return result;
        
    } catch (error) {
        console.error('❌ Ошибка определения призеров:', error);
        return { winner: null, secondPlace: null, thirdPlace: null };
    }
}

// 🎯 НОВАЯ ФУНКЦИЯ: Сохранение всех участников команд как призеров
async function saveTeamMembersAsWinners(tournamentId, tournament, winner, secondPlace, thirdPlace) {
    try {
        console.log('👥 Сохраняем участников команд как призеров...');
        
        // Функция для обработки призеров определенного места
        const processPrizePlace = async (prizeData, place, position) => {
            if (!prizeData) return;
            
            console.log(`🏆 Обрабатываем ${place} место:`, prizeData.name);
            
            if (tournament.participant_type === 'team' || tournament.format === 'mix') {
                // Для командных турниров - получаем всех участников команды
                const teamMembersResult = await pool.query(
                    `SELECT ttm.user_id, ttm.participant_id, tp.name as participant_name, u.username
                     FROM tournament_team_members ttm
                     LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                     LEFT JOIN users u ON ttm.user_id = u.id
                     WHERE ttm.team_id = $1`,
                    [prizeData.id]
                );
                
                const teamMembers = teamMembersResult.rows;
                console.log(`👥 Найдено ${teamMembers.length} участников в команде ${prizeData.name}`);
                
                // Сохраняем каждого участника команды как призера
                for (const member of teamMembers) {
                    if (member.user_id) {
                        await saveIndividualWinner(tournamentId, member.user_id, place, position, prizeData.name, true);
                        console.log(`✅ Участник ${member.username} записан как ${place} (команда: ${prizeData.name})`);
                    } else if (member.participant_id) {
                        // Для незарегистрированных участников (гостей)
                        await saveGuestWinner(tournamentId, member.participant_id, place, position, prizeData.name);
                        console.log(`✅ Гость ${member.participant_name} записан как ${place} (команда: ${prizeData.name})`);
                    }
                }
            } else {
                // Для одиночных турниров - сохраняем одного участника
                if (prizeData.user_id) {
                    await saveIndividualWinner(tournamentId, prizeData.user_id, place, position, prizeData.name, false);
                    console.log(`✅ Игрок ${prizeData.name} записан как ${place}`);
                }
            }
        };
        
        // Обрабатываем всех призеров
        await processPrizePlace(winner, 'Победитель', 1);
        await processPrizePlace(secondPlace, 'Второе место', 2);
        await processPrizePlace(thirdPlace, 'Третье место', 3);
        
        console.log('✅ Все участники команд успешно записаны как призеры');
        
    } catch (error) {
        console.error('❌ Ошибка сохранения участников команд как призеров:', error);
    }
}

// 🎯 ФУНКЦИЯ СОХРАНЕНИЯ ИНДИВИДУАЛЬНОГО ПРИЗЕРА
async function saveIndividualWinner(tournamentId, userId, place, position, teamName, isTeamMember) {
    try {
        // Проверяем, есть ли уже запись для этого пользователя в этом турнире
        const existingRecord = await pool.query(
            'SELECT * FROM user_tournament_stats WHERE user_id = $1 AND tournament_id = $2',
            [userId, tournamentId]
        );
        
        if (existingRecord.rows.length > 0) {
            // Обновляем существующую запись
            await pool.query(
                `UPDATE user_tournament_stats 
                 SET result = $1, final_position = $2, is_winner = $3, 
                     team_name = $4, is_team_member = $5, updated_at = NOW()
                 WHERE user_id = $6 AND tournament_id = $7`,
                [place, position, position === 1, teamName, isTeamMember, userId, tournamentId]
            );
        } else {
            // Создаем новую запись
            await pool.query(
                `INSERT INTO user_tournament_stats 
                 (user_id, tournament_id, result, final_position, is_winner, team_name, is_team_member, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                [userId, tournamentId, place, position, position === 1, teamName, isTeamMember]
            );
        }
        
    } catch (error) {
        console.error('❌ Ошибка сохранения индивидуального призера:', error);
    }
}

// 🎯 ФУНКЦИЯ СОХРАНЕНИЯ ПРИЗЕРА-ГОСТЯ
async function saveGuestWinner(tournamentId, participantId, place, position, teamName) {
    try {
        // Для гостей можем создать отдельную таблицу или расширить существующую
        // Пока логируем информацию
        console.log(`📝 Гость (participant_id: ${participantId}) - ${place} в турнире ${tournamentId} (команда: ${teamName})`);
        
        // Можно добавить в tournament_logs для истории
        await pool.query(
            `INSERT INTO tournament_logs (tournament_id, user_id, event_type, event_data, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [
                tournamentId, 
                1, // системный пользователь
                'guest_winner',
                JSON.stringify({
                    participant_id: participantId,
                    place: place,
                    position: position,
                    team_name: teamName,
                    tournament_completed: true
                })
            ]
        );
        
    } catch (error) {
        console.error('❌ Ошибка сохранения призера-гостя:', error);
    }
}

// 🎯 ФУНКЦИЯ ПОЛУЧЕНИЯ ИНФОРМАЦИИ ОБ УЧАСТНИКЕ
async function getParticipantInfo(participantId, tournament) {
    if (!participantId) return null;
    
    try {
        if (tournament.participant_type === 'team' || tournament.format === 'mix') {
            // Для командных турниров
            const teamResult = await pool.query(
                'SELECT * FROM tournament_teams WHERE id = $1',
                [participantId]
            );
            
            if (teamResult.rows.length > 0) {
                const team = teamResult.rows[0];
                return {
                    id: team.id,
                    name: team.name,
                    type: 'team'
                };
            }
        } else {
            // Для одиночных турниров
            const participantResult = await pool.query(
                `SELECT tp.*, u.username, u.avatar_url 
                 FROM tournament_participants tp 
                 LEFT JOIN users u ON tp.user_id = u.id 
                 WHERE tp.id = $1`,
                [participantId]
            );
            
            if (participantResult.rows.length > 0) {
                const participant = participantResult.rows[0];
                return {
                    id: participant.id,
                    name: participant.name || participant.username,
                    type: 'solo',
                    user_id: participant.user_id
                };
            }
        }
        
        return null;
    } catch (error) {
        console.error('❌ Ошибка получения информации об участнике:', error);
        return null;
    }
}

// Получение сообщений чата турнира
router.get('/:tournamentId/chat/messages', authenticateToken, async (req, res) => {
    const { tournamentId } = req.params;
    try {
        const result = await pool.query(
            'SELECT tm.id, tm.tournament_id, tm.sender_id, u.username AS sender_username, u.avatar_url AS sender_avatar, tm.content, tm.created_at FROM tournament_messages tm JOIN users u ON tm.sender_id = u.id WHERE tm.tournament_id = $1 ORDER BY tm.created_at ASC',
            [tournamentId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения сообщений чата турнира:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении сообщений чата турнира' });
    }
});

// Отправка сообщения в чат турнира
router.post('/:tournamentId/chat/messages', authenticateToken, async (req, res) => {
    const { tournamentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    if (!content) return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    try {
        const insertRes = await pool.query(
            'INSERT INTO tournament_messages (tournament_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, tournament_id, sender_id, content, created_at',
            [tournamentId, userId, content]
        );
        const message = insertRes.rows[0];
        // Добавляем данные пользователя
        message.sender_username = req.user.username;
        message.sender_avatar = req.user.avatar_url;
        // Эмитим через сокеты
        const io = req.app.get('io');
        io.to(`chat_tournament_${tournamentId}`).emit('tournament_message', message);
        res.status(201).json(message);
    } catch (err) {
        console.error('Ошибка отправки сообщения в чат турнира:', err);
        res.status(500).json({ error: 'Ошибка сервера при отправке сообщения в чат турнира' });
    }
});

// Формирование команд из участников для микс-турнира
router.post('/:id/form-teams', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const { ratingType, teamSize: requestedTeamSize } = req.body;
    
    console.log(`🔍 Получен запрос на формирование команд для турнира ${id} с рейтингом ${ratingType}`);
    
    try {
        // Получаем параметры турнира
        const tourRes = await pool.query('SELECT team_size, format, status, participant_type, created_by FROM tournaments WHERE id = $1', [id]);
        if (!tourRes.rows.length) {
            console.log(`❌ Турнир с ID ${id} не найден`);
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        const tournament = tourRes.rows[0];
        console.log(`🔍 Данные турнира: ${JSON.stringify(tournament)}`);
        
        if (tournament.format !== 'mix') {
            console.log(`❌ Формат турнира ${tournament.format} не является 'mix'`);
            return res.status(400).json({ error: 'Формирование команд доступно только для микс-турниров' });
        }
        
        if (tournament.participant_type !== 'solo') {
            console.log(`❌ Тип участников турнира ${tournament.participant_type} не является 'solo'`);
            return res.status(400).json({ error: 'Формирование команд доступно только для соло-участников' });
        }
        
        // Используем размер команды из запроса, если передан, иначе берем из турнира
        const teamSize = requestedTeamSize ? parseInt(requestedTeamSize, 10) : parseInt(tournament.team_size, 10) || 5;
        
        if (![2, 5].includes(teamSize)) {
            return res.status(400).json({ error: 'Неверный размер команды. Допустимые значения: 2 или 5' });
        }
        
        // Получаем всех участников-игроков с рейтингами
        const partRes = await pool.query(
            `SELECT tp.id AS participant_id, tp.user_id, tp.name,
                    COALESCE(u.faceit_elo, 0) as faceit_rating,
                    COALESCE(u.cs2_premier_rank, 0) as premier_rating
             FROM tournament_participants tp
             LEFT JOIN users u ON tp.user_id = u.id
             WHERE tp.tournament_id = $1`,
            [id]
        );
        
        const participants = partRes.rows;
        console.log(`🔍 Найдено ${participants.length} участников для турнира ${id}`);
        
        if (!participants.length) {
            console.log(`❌ Нет участников для формирования команд в турнире ${id}`);
            return res.status(400).json({ error: 'Нет участников для формирования команд' });
        }
        
        // 🆕 НОВАЯ ЛОГИКА: Формируем максимальное количество полных команд
        const totalPlayers = participants.length;
        const fullTeams = Math.floor(totalPlayers / teamSize); // Количество полных команд
        const playersInTeams = fullTeams * teamSize; // Участников в командах  
        const remainingPlayers = totalPlayers - playersInTeams; // Лишние участники
        
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
        
        // Сортируем игроков по рейтингу (в зависимости от выбранного типа)
        const sortedParticipants = [...participants].sort((a, b) => {
            if (ratingType === 'faceit') {
                return b.faceit_rating - a.faceit_rating;
            } else if (ratingType === 'premier') {
                return b.premier_rating - a.premier_rating;
            } else {
                return b.faceit_rating - a.faceit_rating;
            }
        });
        
        // 🆕 РАЗДЕЛЯЕМ УЧАСТНИКОВ: первые попадают в команды, остальные остаются вне команд
        const participantsForTeams = sortedParticipants.slice(0, playersInTeams);
        const participantsNotInTeams = sortedParticipants.slice(playersInTeams);
        
        console.log(`👥 Участников для команд: ${participantsForTeams.length}`);
        console.log(`🚫 Участников вне команд: ${participantsNotInTeams.length}`);
        
        // Формируем команды с равномерным распределением по рейтингу
        const teams = [];
        
        // Создаем пустые команды
        for (let i = 0; i < fullTeams; i++) {
            teams.push({
                name: `Команда ${i + 1}`,
                members: []
            });
        }
        
        // Распределяем игроков змейкой для баланса команд
        // Сначала лучшие игроки, затем послабее
        for (let i = 0; i < teamSize; i++) {
            // Прямой порядок для четных итераций, обратный для нечетных
            const teamOrder = i % 2 === 0 
                ? Array.from({ length: fullTeams }, (_, idx) => idx) 
                : Array.from({ length: fullTeams }, (_, idx) => fullTeams - 1 - idx);
            
            for (let teamIndex of teamOrder) {
                const playerIndex = i * fullTeams + (i % 2 === 0 ? teamIndex : fullTeams - 1 - teamIndex);
                if (playerIndex < participantsForTeams.length) {
                    teams[teamIndex].members.push(participantsForTeams[playerIndex]);
                }
            }
        }

        console.log(`✅ Успешно сформировано ${teams.length} команд для турнира ${id}`);
        
        // Удаляем старые команды, если они есть
        await pool.query('DELETE FROM tournament_team_members WHERE team_id IN (SELECT id FROM tournament_teams WHERE tournament_id = $1)', [id]);
        await pool.query('DELETE FROM tournament_teams WHERE tournament_id = $1', [id]);
        
        // Сохраняем новые команды в БД
        const createdTeams = [];
        const participantIdsInTeams = []; // Массив для хранения ID участников, которые попали в команды
        
        // Сохраняем новые команды в БД
        for (const team of teams) {
            // Создаем команду
            const teamResult = await pool.query(
                'INSERT INTO tournament_teams (tournament_id, name, creator_id) VALUES ($1, $2, $3) RETURNING *',
                [id, team.name, tournament.created_by]
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
                    faceit_elo: member.faceit_rating || 0,
                    cs2_premier_rank: member.premier_rating || 0
                });
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
        }
        
        // Обновляем тип участников в турнире на team
        await pool.query('UPDATE tournaments SET participant_type = $1 WHERE id = $2', ['team', id]);
        
        // Отправляем объявление в чат турнира о формировании команд
        const tourNameRes = await pool.query('SELECT name FROM tournaments WHERE id = $1', [id]);
        const tourName = tourNameRes.rows[0]?.name;
        await sendTournamentChatAnnouncement(
            tourName,
            `Сформированы команды для турнира "${tourName}". Создано ${createdTeams.length} команд из ${totalPlayers} участников`,
            id
        );
        
        // Возвращаем сформированные команды
        res.json({ teams: createdTeams });
    } catch (err) {
        console.error('❌ Ошибка формирования команд:', err);
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
                    u.avatar_url, u.username, u.faceit_elo, u.cs2_premier_rank
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

module.exports = router;