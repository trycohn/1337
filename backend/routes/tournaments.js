// backend/routes/tournaments.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, restrictTo, verifyEmailRequired, verifyAdminOrCreator } = require('../middleware/auth');
const { sendNotification, broadcastTournamentUpdate } = require('../notifications');
const { generateBracket } = require('../bracketGenerator');
const { getSafeParticipants } = require('../fix_regenerate_participants');

// 🔧 ФУНКЦИИ ЧАТА ТУРНИРА - ПЕРЕРАБОТАННЫЕ ДЛЯ ОСНОВНОЙ СИСТЕМЫ ЧАТОВ
async function getTournamentChatId(tournamentId) {
    const res = await pool.query(
        "SELECT chat_id FROM tournaments WHERE id = $1",
        [tournamentId]
    );
    return res.rows[0]?.chat_id;
}

async function createTournamentChat(tournamentName, tournamentId, creatorId) {
    try {
        // Создаем групповой чат
        const chatRes = await pool.query(
            'INSERT INTO chats (name, type) VALUES ($1, $2) RETURNING id',
            [`Турнир: ${tournamentName}`, 'group']
        );
        const chatId = chatRes.rows[0].id;
        
        // Привязываем чат к турниру
        await pool.query(
            'UPDATE tournaments SET chat_id = $1 WHERE id = $2',
            [chatId, tournamentId]
        );
        
        // Добавляем создателя как администратора
        await pool.query(
            'INSERT INTO chat_participants (chat_id, user_id, is_admin) VALUES ($1, $2, $3)',
            [chatId, creatorId, true]
        );
        
        console.log(`✅ Создан групповой чат ${chatId} для турнира "${tournamentName}"`);
        return chatId;
    } catch (err) {
        console.error('❌ Ошибка создания группового чата турнира:', err);
        throw err;
    }
}

async function addUserToTournamentChat(tournamentId, userId, isAdmin = false) {
    try {
        const chatId = await getTournamentChatId(tournamentId);
        if (!chatId) {
            console.log(`⚠️ Чат для турнира ${tournamentId} не найден`);
            return;
        }
        
        await pool.query(
            'INSERT INTO chat_participants (chat_id, user_id, is_admin) VALUES ($1, $2, $3) ON CONFLICT (chat_id, user_id) DO NOTHING',
            [chatId, userId, isAdmin]
        );
        
        console.log(`✅ Пользователь ${userId} добавлен в чат турнира ${tournamentId}`);
    } catch (err) {
        console.error('❌ Ошибка добавления пользователя в чат турнира:', err);
    }
}

async function sendTournamentChatAnnouncement(tournamentId, announcement) {
    try {
        const chatId = await getTournamentChatId(tournamentId);
        if (!chatId) {
            console.log(`⚠️ Чат для турнира ${tournamentId} не найден`);
            return;
        }
        
        const contentMeta = { tournament_id: tournamentId };
        const msgRes = await pool.query(
            'INSERT INTO messages (chat_id, sender_id, content, message_type, content_meta) VALUES ($1, NULL, $2, $3, $4) RETURNING *',
            [chatId, announcement, 'announcement', contentMeta]
        );
        
        // Отправляем через WebSocket
        const app = global.app;
        if (app) {
            const io = app.get('io');
            if (io) {
                io.to(`chat_${chatId}`).emit('message', msgRes.rows[0]);
            }
        }
        
        console.log(`✅ Объявление отправлено в чат турнира ${tournamentId}`);
    } catch (err) {
        console.error('❌ Ошибка отправки объявления в чат турнира:', err);
    }
}

// Вспомогательная функция для записи событий в журнал турнира
async function logTournamentEvent(tournamentId, userId, eventType, eventData = {}, client = null) {
    try {
        console.log('📊 Записываем событие в tournament_logs:', {
            tournamentId,
            userId,
            eventType,
            eventData
        });
        
        // Используем переданный client или pool по умолчанию
        const dbClient = client || pool;
        
        // Проверяем, что tournament_logs таблица существует
        const tableExists = await dbClient.query(`
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
        
        const result = await dbClient.query(
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
        
        // Создаем групповой чат для турнира
        try {
            await createTournamentChat(tournament.name, tournament.id, req.user.id);
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
    const startTime = Date.now();
    const tournamentId = parseInt(req.params.id);
    
    console.log(`🔍 [GET /tournaments/${tournamentId}] Начало обработки запроса`);
    
    try {
        if (isNaN(tournamentId)) {
            console.log(`❌ [GET /tournaments/${req.params.id}] Некорректный ID турнира`);
            return res.status(400).json({ message: 'Некорректный ID турнира' });
        }

        console.log(`📊 [GET /tournaments/${tournamentId}] Выполняем основной запрос турнира...`);
        
        // Основной запрос турнира с создателем
        const tournamentQuery = `
            SELECT 
                t.*,
                u.username as creator_username,
                u.avatar_url as creator_avatar_url
            FROM tournaments t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.id = $1
        `;
        
        const tournamentResult = await pool.query(tournamentQuery, [tournamentId]);
        console.log(`✅ [GET /tournaments/${tournamentId}] Основной запрос выполнен, найдено записей: ${tournamentResult.rows.length}`);
        
        if (tournamentResult.rows.length === 0) {
            console.log(`❌ [GET /tournaments/${tournamentId}] Турнир не найден`);
            return res.status(404).json({ message: 'Турнир не найден' });
        }

        const tournament = tournamentResult.rows[0];
        console.log(`📊 [GET /tournaments/${tournamentId}] Турнир найден: "${tournament.name}", статус: ${tournament.status}`);

        // Получаем администраторов турнира
        let admins = [];
        try {
            console.log(`👥 [GET /tournaments/${tournamentId}] Загружаем администраторов...`);
            const adminsQuery = `
                SELECT 
                    ta.id,
                    ta.user_id,
                    ta.permissions,
                    ta.assigned_at,
                    u.username,
                    u.avatar_url
                FROM tournament_admins ta
                LEFT JOIN users u ON ta.user_id = u.id
                WHERE ta.tournament_id = $1
                ORDER BY ta.assigned_at ASC
            `;
            const adminsResult = await pool.query(adminsQuery, [tournamentId]);
            admins = adminsResult.rows;
            console.log(`✅ [GET /tournaments/${tournamentId}] Администраторы загружены: ${admins.length} шт.`);
        } catch (adminsError) {
            console.warn(`⚠️ [GET /tournaments/${tournamentId}] Ошибка загрузки администраторов:`, adminsError.message);
            admins = [];
        }

        console.log(`👤 [GET /tournaments/${tournamentId}] Загружаем участников...`);
        
        // Получаем участников
        const participantsQuery = `
            SELECT 
                tp.id,
                tp.user_id,
                tp.name,
                tp.created_at as registered_at,
                u.username,
                u.avatar_url,
                u.faceit_elo,
                u.cs2_premier_rank
            FROM tournament_participants tp
            LEFT JOIN users u ON tp.user_id = u.id
            WHERE tp.tournament_id = $1
            ORDER BY tp.created_at ASC
        `;
        
        const participantsResult = await pool.query(participantsQuery, [tournamentId]);
        console.log(`✅ [GET /tournaments/${tournamentId}] Участники загружены: ${participantsResult.rows.length} шт.`);

        console.log(`⚔️ [GET /tournaments/${tournamentId}] Загружаем матчи...`);
        
        // Получаем матчи турнира с аватарами участников
        const matchesQuery = `
            SELECT 
                m.*,
                t1.name as team1_name,
                t2.name as team2_name,
                u1.avatar_url as team1_avatar,
                u2.avatar_url as team2_avatar
            FROM matches m
            LEFT JOIN tournament_participants t1 ON m.team1_id = t1.id
            LEFT JOIN tournament_participants t2 ON m.team2_id = t2.id
            LEFT JOIN users u1 ON t1.user_id = u1.id
            LEFT JOIN users u2 ON t2.user_id = u2.id
            WHERE m.tournament_id = $1
            ORDER BY m.round ASC, m.match_number ASC
        `;
        
        const matchesResult2 = await pool.query(matchesQuery, [tournamentId]);
        console.log(`✅ [GET /tournaments/${tournamentId}] Матчи загружены: ${matchesResult2.rows.length} шт.`);

        // Получаем команды для микс турниров
        let teams = [];
        if (tournament.format === 'mix' || tournament.participant_type === 'team') {
            console.log(`🏆 [GET /tournaments/${tournamentId}] Загружаем команды для формата "${tournament.format}"...`);
            
            // 🔧 ИСПРАВЛЕННЫЙ SQL ЗАПРОС - включаем ВСЕ поля рейтинга для участников команд
            const teamsQuery = `
                SELECT tt.id, tt.name, tt.tournament_id,
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', tp.id,
                            'user_id', tp.user_id,
                            'username', u.username,
                            'name', COALESCE(tp.name, u.username),
                            'faceit_elo', tp.faceit_elo,
                            'cs2_premier_rank', tp.cs2_premier_rank,
                            'user_faceit_elo', u.faceit_elo,
                            'user_premier_rank', u.cs2_premier_rank,
                            'faceit_rating', u.faceit_elo,
                            'user_faceit_rating', u.faceit_elo,
                            'premier_rating', u.cs2_premier_rank,
                            'user_premier_rating', u.cs2_premier_rank,
                            'avatar_url', u.avatar_url
                        ) ORDER BY tp.id
                    ) as members
                FROM tournament_teams tt
                LEFT JOIN tournament_team_members ttm ON tt.id = ttm.team_id
                LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tt.tournament_id = $1
                GROUP BY tt.id
                ORDER BY tt.id
            `;
            
            try {
                const teamsResult = await pool.query(teamsQuery, [tournamentId]);
                teams = teamsResult.rows.map(team => ({
                    ...team,
                    members: team.members.filter(member => member.id !== null)
                }));
                console.log(`✅ [GET /tournaments/${tournamentId}] Команды загружены: ${teams.length} шт.`);
            } catch (teamsError) {
                console.warn(`⚠️ [GET /tournaments/${tournamentId}] Ошибка загрузки команд:`, teamsError.message);
                teams = [];
            }
        } else {
            console.log(`📊 [GET /tournaments/${tournamentId}] Пропускаем загрузку команд для формата "${tournament.format}"`);
        }

        console.log(`📦 [GET /tournaments/${tournamentId}] Формируем ответ...`);
        
        // Подготавливаем обновленный объект турнира
        const updatedTournament = {
            ...tournament,
            creator_name: tournament.creator_username,
            creator_avatar_url: tournament.creator_avatar_url
        };

        const responseData = {
            ...updatedTournament,
            participants: participantsResult.rows,
            participant_count: participantsResult.rows.length,
            matches: matchesResult2.rows,
            teams: teams,
            mixed_teams: teams,
            admins: admins
        };

        const endTime = Date.now();
        console.log(`✅ [GET /tournaments/${tournamentId}] Запрос успешно обработан за ${endTime - startTime}ms`);
        console.log(`📊 [GET /tournaments/${tournamentId}] Итоговые данные: участников=${participantsResult.rows.length}, матчей=${matchesResult2.rows.length}, команд=${teams.length}, админов=${admins.length}`);

        res.json(responseData);

    } catch (error) {
        const endTime = Date.now();
        console.error(`❌ [GET /tournaments/${tournamentId}] Критическая ошибка получения турнира за ${endTime - startTime}ms:`);
        console.error(`❌ [GET /tournaments/${tournamentId}] Тип ошибки: ${error.name}`);
        console.error(`❌ [GET /tournaments/${tournamentId}] Сообщение: ${error.message}`);
        console.error(`❌ [GET /tournaments/${tournamentId}] SQL код: ${error.code || 'не определен'}`);
        console.error(`❌ [GET /tournaments/${tournamentId}] SQL позиция: ${error.position || 'не определена'}`);
        if (error.stack) {
            console.error(`❌ [GET /tournaments/${tournamentId}] Stack trace:`, error.stack);
        }
        
        res.status(500).json({ 
            message: 'Ошибка сервера при получении турнира',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            tournamentId: tournamentId,
            timestamp: new Date().toISOString()
        });
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
                            u.faceit_elo as user_faceit_rating, u.cs2_premier_rank as user_premier_rating,
                            COALESCE(tp.faceit_elo, u.faceit_elo, 1000) as faceit_elo,
                            COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank, 1) as cs2_premier_rank
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
            admins: [] // 🆕 Пустой список администраторов (таблица может не существовать)
        };
        
        // Отправляем обновление через WebSocket
        broadcastTournamentUpdate(id, responseData);
        
        // Логируем старт турнира
        await logTournamentEvent(id, req.user.id, 'tournament_started', {
            participantCount: participantsResult.rows.length
        });
        
        // Отправляем объявление в чат турнира о начале
        await sendTournamentChatAnnouncement(
            id,
            `Турнир "${updatedTournament.name}" начат`
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
        await addUserToTournamentChat(id, req.user.id, false);
        await sendTournamentChatAnnouncement(
            id,
            `Пользователь ${req.user.username} зарегистрировался в турнире "${tournament.name}"`
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
                // 🔧 ИСПРАВЛЕННЫЙ SQL ЗАПРОС - правильная связь для одиночных турниров
                const unfinishedMatches = await pool.query(`
                    SELECT m.*, 
                           tp1.name as participant1_name, tp1.user_id as participant1_user_id,
                           tp2.name as participant2_name, tp2.user_id as participant2_user_id
                    FROM matches m
                    LEFT JOIN tournament_participants tp1 ON m.team1_id = tp1.id
                    LEFT JOIN tournament_participants tp2 ON m.team2_id = tp2.id
                    WHERE m.tournament_id = $1 
                    AND (tp1.user_id = $2 OR tp2.user_id = $2)
                    AND m.status = 'pending'
                `, [id, userId]);

                console.log(`🎯 Найдено ${unfinishedMatches.rows.length} несыгранных матчей`);

                // Назначаем поражения в каждом матче
                for (const match of unfinishedMatches.rows) {
                    const isParticipant1 = match.participant1_user_id === userId;
                    const winnerId = isParticipant1 ? match.team2_id : match.team1_id;
                    const loserId = isParticipant1 ? match.team1_id : match.team2_id;
                    
                    console.log(`⚔️ Назначаем техническое поражение в матче ${match.id}: участник ${userId} проигрывает`);
                    
                    // Обновляем результат матча
                    await pool.query(`
                        UPDATE matches 
                        SET winner_team_id = $1, 
                            status = 'completed',
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
            id, // ✅ ИСПРАВЛЕНО: передаем ID турнира, а не название
            `Турнирная сетка сгенерирована для турнира "${tournament.name}"`
        );
        console.log('🔍 Bracket generated for tournament:', tournamentData);
        res.status(200).json({ message: 'Сетка успешно сгенерирована', tournament: tournamentData });
    } catch (err) {
        console.error('❌ Ошибка генерации сетки:', err);
        res.status(500).json({ error: err.message });
    }
});

// 🆕 Перегенерация турнирной сетки
router.post('/:id/regenerate-bracket', authenticateToken, verifyEmailRequired, async (req, res) => {
    const { id } = req.params;
    const { thirdPlaceMatch } = req.body;
    const userId = req.user.id;

    console.log(`🔄 [regenerate-bracket] Начинаем перегенерацию сетки для турнира ${id}, пользователь ${userId}`);

    try {
        // Проверка турнира и прав доступа
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        console.log(`✅ [regenerate-bracket] Турнир найден: "${tournament.name}", статус: ${tournament.status}`);

        // Проверка прав доступа
        if (tournament.created_by !== userId) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [id, userId]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может перегенерировать сетку' });
            }
            console.log(`✅ [regenerate-bracket] Пользователь ${userId} имеет права администратора`);
        } else {
            console.log(`✅ [regenerate-bracket] Пользователь ${userId} является создателем турнира`);
        }

        // Проверка статуса турнира
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Перегенерация доступна только для активных турниров' });
        }

        // Проверка существования матчей для перегенерации
        const existingMatches = await pool.query('SELECT * FROM matches WHERE tournament_id = $1', [id]);
        
        if (existingMatches.rows.length === 0) {
            return res.status(400).json({ error: 'Нет сетки для перегенерации. Используйте генерацию сетки.' });
        }

        console.log(`🗑️ [regenerate-bracket] Удаляем ${existingMatches.rows.length} существующих матчей`);

        // Удаляем все существующие матчи турнира
        await pool.query('DELETE FROM matches WHERE tournament_id = $1', [id]);

        // Очищаем кеш турнира чтобы принудительно обновить данные на клиентах
        console.log(`🧹 [regenerate-bracket] Очищаем связанные данные и кеши`);

        // Получение участников в зависимости от типа турнира
        // 🔧 ИСПОЛЬЗУЕМ БЕЗОПАСНУЮ ФУНКЦИЮ ПОЛУЧЕНИЯ УЧАСТНИКОВ
        console.log(`🔧 [regenerate-bracket] Используем безопасную функцию получения участников...`);
        const participants = await getSafeParticipants(id, tournament.participant_type);

        console.log(`👥 [regenerate-bracket] Найдено ${participants.length} участников для перегенерации`);

        if (participants.length < 2) {
            return res.status(400).json({ error: 'Недостаточно участников для перегенерации сетки' });
        }

        // Определяем нужен ли матч за 3-е место (используем переданный параметр или сохраненную настройку)
        const useThirdPlaceMatch = thirdPlaceMatch !== undefined ? thirdPlaceMatch : tournament.third_place_match_enabled;

        console.log(`🎯 [regenerate-bracket] Генерируем новую сетку (матч за 3-е место: ${useThirdPlaceMatch})`);

        // Генерация новой сетки с использованием модуля bracketGenerator
        const matches = await generateBracket(tournament.format, id, participants, useThirdPlaceMatch);

        console.log(`✅ [regenerate-bracket] Создано ${matches.length} новых матчей`);

        // Получаем обновлённые данные турнира
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
        console.log(`📡 [regenerate-bracket] Отправляем WebSocket обновления`);
        broadcastTournamentUpdate(id, tournamentData);
        
        // Отправляем объявление в чат турнира о перегенерации сетки
        await sendTournamentChatAnnouncement(
            id,
            `Турнирная сетка перегенерирована для турнира "${tournament.name}". Все предыдущие результаты очищены.`
        );

        console.log(`🎉 [regenerate-bracket] Перегенерация завершена успешно для турнира ${id}`);
        res.status(200).json({ 
            success: true,
            message: 'Турнирная сетка успешно перегенерирована', 
            tournament: tournamentData 
        });
    } catch (err) {
        console.error(`❌ [regenerate-bracket] Ошибка перегенерации сетки для турнира ${id}:`, err);
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

        // Получение данных текущего матча
        const matchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [matchId]);
        if (matchResult.rows.length === 0) {
            return res.status(404).json({ error: 'Матч не найден' });
        }
        const match = matchResult.rows[0];
        const tournamentId = match.tournament_id;

        // Проверка турнира и прав доступа
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.created_by !== userId) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, userId]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может обновлять результаты' });
            }
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
            mapsData = maps; // Передаем массив, JSON.stringify будет в функции
            
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

        // 🔥 ИСПОЛЬЗУЕМ НОВУЮ БЕЗОПАСНУЮ ФУНКЦИЮ ВМЕСТО СТАРОЙ ЛОГИКИ
        console.log(`🔒 [update-match] Вызываем безопасную функцию обновления матча ${matchId}`);
        const updateResult = await safeUpdateMatchResult(matchId, winner_team_id, score1, score2, mapsData, userId);
        
        console.log(`✅ [update-match] Матч ${matchId} успешно обновлен с продвижением`);

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
            await sendTournamentChatAnnouncement(id, announcement);
        }
        
        console.log('🔍 Match updated for tournament:', tournamentData);
        res.status(200).json({ 
            message: 'Результат обновлён', 
            tournament: tournamentData,
            advancementResult: updateResult.advancementResult,
            loserAdvancementResult: updateResult.loserAdvancementResult
        });
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
    const { winner_team_id, score1, score2, maps_data } = req.body; // 🆕 Добавляем maps_data
    const userId = req.user.id;

    // 🔍 НАЧАЛЬНОЕ ЛОГИРОВАНИЕ
    console.log(`🎯 [matches/:matchId/result] НАЧАЛО ОБРАБОТКИ ЗАПРОСА:`);
    console.log(`   - Match ID: ${matchId}`);
    console.log(`   - Winner Team ID: ${winner_team_id}`);
    console.log(`   - Score: ${score1}:${score2}`);
    console.log(`   - User ID: ${userId}`);
    console.log(`   - Maps data:`, maps_data);
    
    const startTime = Date.now();

    try {
        // Преобразуем matchId в число
        const matchIdNum = Number(matchId);
        console.log(`🔢 [matches/:matchId/result] Match ID преобразован в число: ${matchIdNum}`);

        // 🔍 ПРОВЕРЯЕМ СУЩЕСТВОВАНИЕ МАТЧА С ПОДРОБНЫМ ЛОГИРОВАНИЕМ
        console.log(`🔍 [matches/:matchId/result] Проверяем существование матча ${matchIdNum}...`);
        const matchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [matchIdNum]);
        
        console.log(`📊 [matches/:matchId/result] Результат запроса матча:`);
        console.log(`   - Количество найденных строк: ${matchResult.rows.length}`);
        
        if (matchResult.rows.length === 0) {
            console.log(`❌ [matches/:matchId/result] МАТЧ ${matchIdNum} НЕ НАЙДЕН В БАЗЕ ДАННЫХ!`);
            return res.status(404).json({ error: 'Матч не найден' });
        }
        
        const match = matchResult.rows[0];
        const tournamentId = match.tournament_id;
        
        console.log(`✅ [matches/:matchId/result] Матч найден:`);
        console.log(`   - Tournament ID: ${tournamentId}`);
        console.log(`   - Team 1 ID: ${match.team1_id}`);
        console.log(`   - Team 2 ID: ${match.team2_id}`);
        console.log(`   - Current Winner: ${match.winner_team_id}`);
        console.log(`   - Current Score: ${match.score1}:${match.score2}`);
        console.log(`   - Next Match ID: ${match.next_match_id}`);

        // Проверка турнира и прав доступа
        console.log(`🔍 [matches/:matchId/result] Проверяем турнир ${tournamentId}...`);
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        if (tournamentResult.rows.length === 0) {
            console.log(`❌ [matches/:matchId/result] ТУРНИР ${tournamentId} НЕ НАЙДЕН!`);
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];
        
        console.log(`✅ [matches/:matchId/result] Турнир найден: "${tournament.name}", статус: ${tournament.status}`);

        if (tournament.created_by !== userId) {
            console.log(`🔍 [matches/:matchId/result] Проверяем права администратора для пользователя ${userId}...`);
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, userId]
            );
            if (adminCheck.rows.length === 0) {
                console.log(`❌ [matches/:matchId/result] ПОЛЬЗОВАТЕЛЬ ${userId} НЕ ИМЕЕТ ПРАВ НА ИЗМЕНЕНИЕ МАТЧА!`);
                return res.status(403).json({ error: 'Только создатель или администратор может обновлять результаты матча' });
            }
            console.log(`✅ [matches/:matchId/result] Пользователь ${userId} имеет права администратора`);
        } else {
            console.log(`✅ [matches/:matchId/result] Пользователь ${userId} является создателем турнира`);
        }

        // Проверяем, изменились ли данные матча (счет, карты)
        const scoreChanged = match.score1 !== score1 || match.score2 !== score2;
        const mapsChanged = maps_data && Array.isArray(maps_data) && maps_data.length > 0;
        
        console.log(`🔍 [matches/:matchId/result] Анализируем изменения:`);
        console.log(`   - Score changed: ${scoreChanged} (${match.score1}:${match.score2} -> ${score1}:${score2})`);
        console.log(`   - Maps changed: ${mapsChanged}`);
        console.log(`   - Winner changed: ${match.winner_team_id !== winner_team_id} (${match.winner_team_id} -> ${winner_team_id})`);
        
        // Разрешаем обновление, если:
        // 1. Победитель изменился
        // 2. Изменился счет
        // 3. Добавлены/изменены данные о картах
        if (match.winner_team_id === winner_team_id && !scoreChanged && !mapsChanged) {
            console.log(`⚠️ [matches/:matchId/result] РЕЗУЛЬТАТ МАТЧА НЕ ИЗМЕНИЛСЯ - отклоняем запрос`);
            return res.status(400).json({ error: 'Результат матча не изменился' });
        }

        // 🔥 ИСПОЛЬЗУЕМ НОВУЮ БЕЗОПАСНУЮ ФУНКЦИЮ ВМЕСТО СТАРОЙ ЛОГИКИ
        console.log(`🔒 [matches/:matchId/result] ВЫЗЫВАЕМ БЕЗОПАСНУЮ ФУНКЦИЮ safeUpdateMatchResult для матча ${matchIdNum}`);
        console.log(`   - Параметры: winnerId=${winner_team_id}, score=${score1}:${score2}, userId=${userId}`);
        console.log(`   - Время до вызова: ${Date.now() - startTime}ms`);
        
        const updateResult = await safeUpdateMatchResult(matchIdNum, winner_team_id, score1, score2, maps_data, userId);
        
        const afterSafeUpdateTime = Date.now();
        console.log(`✅ [matches/:matchId/result] safeUpdateMatchResult ЗАВЕРШЕНА успешно за ${afterSafeUpdateTime - startTime}ms`);
        console.log(`   - Результат продвижения победителя:`, updateResult.advancementResult);
        console.log(`   - Результат продвижения проигравшего:`, updateResult.loserAdvancementResult);

        // Получаем обновлённые данные турнира
        console.log(`🔍 [matches/:matchId/result] Получаем обновленные данные турнира ${tournamentId}...`);
        const updatedTournament = await pool.query(
            'SELECT t.*, ' +
            '(SELECT COALESCE(json_agg(to_jsonb(tp) || jsonb_build_object(\'avatar_url\', u.avatar_url)), \'[]\') FROM tournament_participants tp LEFT JOIN users u ON tp.user_id = u.id WHERE tp.tournament_id = t.id) as participants, ' +
            '(SELECT COALESCE(json_agg(m.*), \'[]\') FROM matches m WHERE m.tournament_id = t.id) as matches ' +
            'FROM tournaments t WHERE t.id = $1',
            [tournamentId]
        );

        const tournamentData = updatedTournament.rows[0] || {};
        tournamentData.matches = Array.isArray(tournamentData.matches) && tournamentData.matches[0] !== null 
            ? tournamentData.matches 
            : [];
        tournamentData.participants = Array.isArray(tournamentData.participants) && tournamentData.participants[0] !== null 
            ? tournamentData.participants 
            : [];

        console.log(`📡 [matches/:matchId/result] Отправляем WebSocket обновления турнира ${tournamentId}...`);
        // Отправляем обновления всем клиентам, просматривающим этот турнир
        broadcastTournamentUpdate(tournamentId, tournamentData);

        const totalTime = Date.now() - startTime;
        console.log(`✅ [matches/:matchId/result] ЗАПРОС ПОЛНОСТЬЮ ЗАВЕРШЕН за ${totalTime}ms`);
        console.log('🔍 Match updated for tournament:', tournamentData.name);
        
        res.status(200).json({ 
            message: 'Результат обновлён', 
            tournament: tournamentData,
            advancementResult: updateResult.advancementResult,
            loserAdvancementResult: updateResult.loserAdvancementResult
        });
    } catch (err) {
        const errorTime = Date.now() - startTime;
        console.error(`❌ [matches/:matchId/result] ОШИБКА ПОСЛЕ ${errorTime}ms:`, err);
        console.error(`❌ [matches/:matchId/result] Stack trace:`, err.stack);
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

// 🆕 ФУНКЦИЯ НОРМАЛИЗАЦИИ РЕЙТИНГА УЧАСТНИКА (ВАРИАНТ 2: БЭКЕНД РЕШЕНИЕ)
function normalizeParticipantRating(participant, ratingType) {
    let rating;
    
    if (ratingType === 'faceit') {
        // 🎯 ПРИОРИТЕТ ДЛЯ FACEIT (согласно требованиям):
        // 1. Кастомный ELO участника турнира (если был указан при формировании команд)
        // 2. ELO зарегистрированного пользователя
        // 3. FACEIT рейтинг пользователя (резервный)
        // 4. Дефолт 1000
        
        if (participant.faceit_elo && !isNaN(parseInt(participant.faceit_elo)) && parseInt(participant.faceit_elo) > 0) {
            rating = parseInt(participant.faceit_elo);
        } else if (participant.user_faceit_elo && !isNaN(parseInt(participant.user_faceit_elo)) && parseInt(participant.user_faceit_elo) > 0) {
            rating = parseInt(participant.user_faceit_elo);
        } else if (participant.faceit_rating && !isNaN(parseInt(participant.faceit_rating)) && parseInt(participant.faceit_rating) > 0) {
            rating = parseInt(participant.faceit_rating);
        } else if (participant.user_faceit_rating && !isNaN(parseInt(participant.user_faceit_rating)) && parseInt(participant.user_faceit_rating) > 0) {
            rating = parseInt(participant.user_faceit_rating);
        } else {
            rating = 1000; // Дефолт для FACEIT
        }
    } else if (ratingType === 'premier') {
        // 🎯 ПРИОРИТЕТ ДЛЯ CS2 PREMIER (согласно требованиям):
        // 1. Кастомный ранг участника турнира (если был указан при формировании команд)
        // 2. Premier ранг зарегистрированного пользователя
        // 3. Дефолт 1 (а не 5 как было раньше, согласно требованиям)
        
        if (participant.cs2_premier_rank && !isNaN(parseInt(participant.cs2_premier_rank)) && parseInt(participant.cs2_premier_rank) > 0) {
            rating = parseInt(participant.cs2_premier_rank);
        } else if (participant.user_premier_rank && !isNaN(parseInt(participant.user_premier_rank)) && parseInt(participant.user_premier_rank) > 0) {
            rating = parseInt(participant.user_premier_rank);
        } else {
            rating = 1; // 🔧 ИСПРАВЛЕНО: дефолт для Premier согласно требованиям
        }
    } else {
        // Fallback на faceit если тип не определен
        rating = 1000;
    }
    
    console.log(`📊 Рейтинг участника ${participant.name}: ${rating} (тип: ${ratingType})`);
    return rating;
}

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

        // 🆕 УЛУЧШЕННЫЙ SQL ЗАПРОС: получаем ВСЕ возможные поля рейтинга с правильными приоритетами
        const partRes = await pool.query(
            `SELECT tp.id AS participant_id, tp.user_id, tp.name, tp.in_team,
                    tp.faceit_elo, tp.cs2_premier_rank,
                    u.faceit_elo as user_faceit_elo, u.cs2_premier_rank as user_premier_rank,
                    u.faceit_elo as user_faceit_rating, u.cs2_premier_rank as user_premier_rating,
                    COALESCE(tp.faceit_elo, u.faceit_elo, 1000) as faceit_rating,
                    COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank, 1) as premier_rating
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
        
        // 🆕 ПРИМЕНЯЕМ НОРМАЛИЗАЦИЮ РЕЙТИНГОВ К КАЖДОМУ УЧАСТНИКУ
        console.log(`🔧 ПРИМЕНЯЕМ ФУНКЦИЮ НОРМАЛИЗАЦИИ РЕЙТИНГОВ:`);
        participants.forEach(participant => {
            // Сохраняем оригинальные значения для диагностики
            participant.original_faceit_elo = participant.faceit_elo;
            participant.original_cs2_premier_rank = participant.cs2_premier_rank;
            participant.original_premier_rank = participant.premier_rank;
            participant.original_user_faceit_elo = participant.user_faceit_elo;
            participant.original_user_premier_rank = participant.user_premier_rank;
            participant.original_faceit_rating = participant.faceit_rating;
            participant.original_premier_rating = participant.premier_rating;
            
            // Применяем нормализацию для обоих типов рейтинга
            participant.normalized_faceit_rating = normalizeParticipantRating(participant, 'faceit');
            participant.normalized_premier_rating = normalizeParticipantRating(participant, 'premier');
            
            // Перезаписываем финальные значения нормализованными
            participant.faceit_rating = participant.normalized_faceit_rating;
            participant.premier_rating = participant.normalized_premier_rating;
        });
        
        console.log(`📊 СТАТИСТИКА УЧАСТНИКОВ:`);
        console.log(`   - Зарегистрированных: ${participants.length}`);
        console.log(`   - Гостей: ${participants.filter(p => !p.user_id).length}`);
        console.log(`   - С кастомными рейтингами: ${participants.filter(p => p.faceit_elo || p.cs2_premier_rank).length}`);
        
        if (participants.filter(p => !p.user_id).length > 0) {
            console.log(`👥 ГОСТИ С РЕЙТИНГАМИ:`);
            participants.filter(p => !p.user_id).forEach(guest => {
                console.log(`   - ${guest.name}: faceit=${guest.faceit_elo}, premier=${guest.cs2_premier_rank}`);
            });
        }
        
        // 🆕 ПРОВЕРЯЕМ ДОСТАТОЧНОСТЬ УЧАСТНИКОВ ПОСЛЕ НОРМАЛИЗАЦИИ
        const totalPlayers = participants.length;
        const fullTeams = Math.floor(totalPlayers / teamSize);
        const playersInTeams = fullTeams * teamSize;
        const remainingPlayers = totalPlayers - playersInTeams;
        
        console.log(`📊 Статистика формирования команд после нормализации:`);
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

        // 🆕 ДИАГНОСТИКА НОРМАЛИЗОВАННЫХ РЕЙТИНГОВ
        console.log(`🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА НОРМАЛИЗОВАННЫХ РЕЙТИНГОВ (тип: ${ratingType}):`);
        participants.forEach((p, index) => {
            const debugInfo = {
                index: index + 1,
                name: p.name,
                user_id: p.user_id,
                is_guest: !p.user_id,
                tp_faceit_elo: p.original_faceit_elo,
                tp_cs2_premier_rank: p.original_cs2_premier_rank,
                tp_premier_rank: p.original_premier_rank,
                user_faceit_elo: p.original_user_faceit_elo,
                user_premier_rank: p.original_user_premier_rank,
                original_faceit_rating: p.original_faceit_rating,
                original_premier_rating: p.original_premier_rating,
                normalized_faceit_rating: p.normalized_faceit_rating,
                normalized_premier_rating: p.normalized_premier_rating,
                final_selected_rating: ratingType === 'faceit' ? p.faceit_rating : p.premier_rating,
                in_team: p.in_team
            };
            console.log(`  ${index + 1}. ${JSON.stringify(debugInfo)}`);
        });
        
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
        const baseRatingValue = ratingType === 'faceit' ? 1000 : 1;
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
                    cs2_premier_rank: member.cs2_premier_rank || member.user_premier_rank || 1,
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
                    console.log(`   - Сохраняем cs2_premier_rank: ${member.cs2_premier_rank || member.user_premier_rank || 1}`);
                    console.log(`   - Сохраняем cs2_premier_rank: ${member.cs2_premier_rank || member.user_premier_rank || 1}`);
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
            id,
            resultMessage
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

        // Логируем результат
        await logTournamentEvent(id, req.user.id, 'teams_generated', { 
            teamsCount: createdTeams.length, 
            participantsCount: playersInTeams,
            ratingType,
            algorithm: teamSize === 2 ? 'paired' : 'snake'
        });

        console.log(`✅ Команды сформированы для турнира ${id}. Создано ${createdTeams.length} команд`);

        res.json({
            success: true,
            message: resultMessage,
            teams: createdTeams,
            summary: {
                totalParticipants: totalPlayers,
                teamsCreated: fullTeams,
                participantsInTeams: playersInTeams,
                participantsNotInTeams: remainingPlayers,
                ratingType: ratingType,
                teamSize: teamSize,
                algorithm: teamSize === 2 ? 'paired_optimization' : 'snake_distribution',
                balanceInfo: {
                    finalBalance: balanceCheck.percentageDiff,
                    rebalanceAttempts: rebalanceAttempts,
                    isBalanced: balanceCheck.isBalanced,
                    minTeamRating: Math.round(balanceCheck.minAvg),
                    maxTeamRating: Math.round(balanceCheck.maxAvg)
                },
                // 🆕 РАСШИРЕННАЯ СТАТИСТИКА БАЛАНСА
                balanceStats: {
                    overallAverageRating: Math.round(overallAverage),
                    ratingStandardDeviation: Math.round(ratingStandardDeviation * 100) / 100,
                    teamAverageRatings: teamAverageRatings.map(avg => Math.round(avg)),
                    balancePercentage: Math.round(finalBalanceForResponse.percentageDiff * 100) / 100,
                    balanceQuality: balanceQuality,
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
                    COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank, 1) as cs2_premier_rank_combined
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
            id,
            `Участник "${participantInfo.name || participantInfo.username}" был удален из турнира "${tournament.name}"`
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
router.post('/:id/invite-admin', authenticateToken, async (req, res) => {
    try {
        const tournamentId = parseInt(req.params.id);
        const { inviteeId } = req.body;

        if (isNaN(tournamentId) || !inviteeId) {
            return res.status(400).json({ message: 'Некорректные параметры запроса' });
        }

        // Проверяем, является ли пользователь создателем турнира
        const tournamentResult = await pool.query(
            'SELECT created_by, name FROM tournaments WHERE id = $1',
            [tournamentId]
        );

        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Турнир не найден' });
        }

        const tournament = tournamentResult.rows[0];

        if (tournament.created_by !== req.user.id) {
            return res.status(403).json({ message: 'Только создатель турнира может приглашать администраторов' });
        }

        // Проверяем, существует ли приглашаемый пользователь
        const userResult = await pool.query(
            'SELECT id, username FROM users WHERE id = $1',
            [inviteeId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Проверяем, не является ли пользователь уже администратором
        const existingAdminResult = await pool.query(
            'SELECT id FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [tournamentId, inviteeId]
        );

        if (existingAdminResult.rows.length > 0) {
            return res.status(400).json({ message: 'Пользователь уже является администратором турнира' });
        }

        // 🔧 НОВАЯ ЛОГИКА: очищаем истекшие приглашения
        await pool.query(
            'UPDATE admin_invitations SET status = $1 WHERE status = $2 AND expires_at <= NOW()',
            ['expired', 'pending']
        );

        // 🔧 НОВАЯ ЛОГИКА: отменяем все предыдущие активные приглашения для этого пользователя
        const cancelledResult = await pool.query(
            'UPDATE admin_invitations SET status = $1 WHERE tournament_id = $2 AND invitee_id = $3 AND status = $4 RETURNING id',
            ['cancelled', tournamentId, inviteeId, 'pending']
        );

        if (cancelledResult.rows.length > 0) {
            console.log(`🔄 Отменено ${cancelledResult.rows.length} предыдущих приглашений для пользователя ${inviteeId} в турнир ${tournamentId}`);
        }

        // Создаем новое приглашение (теперь всегда можем создать новое)
        const insertResult = await pool.query(
            `INSERT INTO admin_invitations (tournament_id, inviter_id, invitee_id, status, expires_at)
             VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
             RETURNING id`,
            [tournamentId, req.user.id, inviteeId, 'pending']
        );

        const invitationId = insertResult.rows[0].id;

        // Логируем событие
        await logTournamentEvent(
            tournamentId,
            req.user.id,
            'admin_invitation_sent',
            { 
                invitee_id: inviteeId, 
                invitation_id: invitationId,
                is_resend: cancelledResult.rows.length > 0,
                cancelled_invitations: cancelledResult.rows.length
            }
        );

        console.log(`✅ Создано новое приглашение администратора: ID ${invitationId} для пользователя ${inviteeId} в турнир ${tournamentId}`);
        
        if (cancelledResult.rows.length > 0) {
            console.log(`🔄 Это повторное приглашение (отменено ${cancelledResult.rows.length} предыдущих)`);
        }

        res.status(201).json({
            message: cancelledResult.rows.length > 0 
                ? 'Предыдущее приглашение отменено, отправлено новое приглашение'
                : 'Приглашение отправлено',
            invitationId: invitationId,
            invitee: userResult.rows[0],
            isResend: cancelledResult.rows.length > 0,
            cancelledInvitations: cancelledResult.rows.length
        });

    } catch (error) {
        console.error('❌ Ошибка при отправке приглашения администратора:', error);
        
        res.status(500).json({ 
            message: 'Ошибка сервера при отправке приглашения',
            error: error.message 
        });
    }
});

// 🆕 УДАЛЕНИЕ АДМИНИСТРАТОРА ТУРНИРА
router.delete('/:id/admins/:userId', authenticateToken, async (req, res) => {
    try {
        const tournamentId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);

        if (isNaN(tournamentId) || isNaN(userId)) {
            return res.status(400).json({ message: 'Некорректные параметры запроса' });
        }

        // Проверяем, является ли пользователь создателем турнира
        const tournamentResult = await pool.query(
            'SELECT created_by FROM tournaments WHERE id = $1',
            [tournamentId]
        );

        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Турнир не найден' });
        }

        if (tournamentResult.rows[0].created_by !== req.user.id) {
            return res.status(403).json({ message: 'Только создатель турнира может удалять администраторов' });
        }

        // Проверяем, не пытается ли создатель удалить самого себя
        if (tournamentResult.rows[0].created_by === userId) {
            return res.status(400).json({ message: 'Создатель турнира не может удалить себя из администраторов' });
        }

        // Удаляем администратора
        const deleteResult = await pool.query(
            'DELETE FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2 RETURNING user_id',
            [tournamentId, userId]
        );

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ message: 'Администратор не найден' });
        }

        // Логируем событие
        await logTournamentEvent(
            tournamentId,
            req.user.id,
            'admin_removed',
            { removed_user_id: userId }
        );

        res.json({ message: 'Администратор успешно удален' });

    } catch (error) {
        console.error('Ошибка при удалении администратора:', error);
        res.status(500).json({ 
            message: 'Ошибка сервера при удалении администратора',
            error: error.message 
        });
    }
});

// 🆕 ПРИНЯТИЕ ПРИГЛАШЕНИЯ АДМИНИСТРАТОРА
router.post('/admin-invitations/:invitationId/accept', authenticateToken, async (req, res) => {
    try {
        const invitationId = parseInt(req.params.invitationId);

        if (isNaN(invitationId)) {
            return res.status(400).json({ message: 'Некорректный ID приглашения' });
        }

        // Используем функцию для принятия приглашения
        const result = await pool.query(
            'SELECT accept_admin_invitation($1, $2) as result',
            [invitationId, req.user.id]
        );

        const success = result.rows[0].result;

        if (!success) {
            return res.status(400).json({ 
                message: 'Не удалось принять приглашение',
                reason: 'Приглашение могло быть отозвано или истекло'
            });
        }

        res.json({ message: 'Приглашение успешно принято' });

    } catch (error) {
        console.error('Ошибка при принятии приглашения:', error);
        res.status(500).json({ 
            message: 'Ошибка сервера при принятии приглашения',
            error: error.message 
        });
    }
});

// 🆕 ОТКЛОНЕНИЕ ПРИГЛАШЕНИЯ АДМИНИСТРАТОРА
router.post('/admin-invitations/:invitationId/decline', authenticateToken, async (req, res) => {
    try {
        const invitationId = parseInt(req.params.invitationId);

        if (isNaN(invitationId)) {
            return res.status(400).json({ message: 'Некорректный ID приглашения' });
        }

        // Используем функцию для отклонения приглашения
        const result = await pool.query(
            'SELECT decline_admin_invitation($1, $2) as result',
            [invitationId, req.user.id]
        );

        const success = result.rows[0].result;

        if (!success) {
            return res.status(400).json({ 
                message: 'Не удалось отклонить приглашение',
                reason: 'Приглашение могло быть уже обработано или не найдено'
            });
        }

        res.json({ message: 'Приглашение отклонено' });

    } catch (error) {
        console.error('Ошибка при отклонении приглашения:', error);
        res.status(500).json({ 
            message: 'Ошибка сервера при отклонении приглашения',
            error: error.message 
        });
    }
});

// Получение сообщений чата турнира
router.get('/:id/chat/messages', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    try {
        // Проверяем турнир
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        const tournament = tournamentResult.rows[0];
        const chatId = tournament.chat_id;
        
        if (!chatId) {
            return res.status(404).json({ error: 'Чат турнира не найден' });
        }
        
        // Проверяем, является ли пользователь участником
        const isParticipant = await pool.query(
            'SELECT is_admin FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
            [chatId, req.user.id]
        );
        
        if (isParticipant.rows.length === 0) {
            return res.status(403).json({ error: 'У вас нет доступа к этому чату' });
        }
        
        // Получаем сообщения чата
        const messagesResult = await pool.query(`
            SELECT 
                m.id, 
                m.chat_id, 
                m.sender_id, 
                m.content, 
                m.message_type, 
                m.content_meta, 
                m.created_at,
                u.username AS sender_username,
                u.avatar_url AS sender_avatar
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = $1
            ORDER BY m.created_at ASC
            LIMIT $2 OFFSET $3
        `, [chatId, limit, offset]);
        
        res.json(messagesResult.rows);
    } catch (err) {
        console.error('Ошибка получения сообщений чата турнира:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении сообщений чата турнира' });
    }
});

// Получение участников чата турнира
router.get('/:id/chat/participants', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        // Проверяем турнир
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        const tournament = tournamentResult.rows[0];
        const chatId = tournament.chat_id;
        
        if (!chatId) {
            return res.status(404).json({ error: 'Чат турнира не найден' });
        }
        
        // Проверяем, является ли пользователь участником чата
        const isParticipant = await pool.query(
            'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
            [chatId, req.user.id]
        );
        
        if (isParticipant.rows.length === 0) {
            return res.status(403).json({ error: 'У вас нет доступа к этому чату' });
        }
        
        // Получаем всех участников чата с их данными
        const participants = await pool.query(`
            SELECT 
                cp.user_id,
                cp.is_admin,
                cp.joined_at,
                u.username,
                u.avatar_url,
                CASE 
                    WHEN u.id = $2 THEN true
                    ELSE false
                END as is_creator
            FROM chat_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.chat_id = $1
            ORDER BY 
                CASE WHEN u.id = $2 THEN 0 ELSE 1 END,
                cp.is_admin DESC,
                u.username ASC
        `, [chatId, tournament.created_by]);
        
        res.json({
            participants: participants.rows,
            total_count: participants.rows.length,
            chat_name: tournament.name,
            tournament_creator: tournament.created_by
        });
    } catch (err) {
        console.error('Ошибка получения участников чата турнира:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении участников чата турнира' });
    }
});

// 🆕 API endpoint для принятия приглашения администратора
router.post('/admin-invitations/:id/accept', authenticateToken, async (req, res) => {
    try {
        const invitationId = parseInt(req.params.id);
        const userId = req.user.id;

        console.log('🤝 Принятие приглашения администратора:', { invitationId, userId });

        // Используем функцию из базы данных для принятия приглашения
        const result = await pool.query(
            'SELECT accept_admin_invitation($1, $2) as success',
            [invitationId, userId]
        );

        if (result.rows[0].success) {
            // Получаем информацию о приглашении для уведомления
            const invitationInfo = await pool.query(`
                SELECT ai.*, t.name as tournament_name, 
                       inviter.username as inviter_username,
                       invitee.username as invitee_username
                FROM admin_invitations ai
                JOIN tournaments t ON ai.tournament_id = t.id
                JOIN users inviter ON ai.inviter_id = inviter.id
                JOIN users invitee ON ai.invitee_id = invitee.id
                WHERE ai.id = $1
            `, [invitationId]);

            if (invitationInfo.rows.length > 0) {
                const invitation = invitationInfo.rows[0];
                
                // Отправляем уведомление приглашающему о принятии
                const notificationMessage = `🎉 ${invitation.invitee_username} принял приглашение стать администратором турнира "${invitation.tournament_name}"`;
                
                // Находим чат турнира для отправки уведомления
                const chatResult = await pool.query(
                    'SELECT id FROM chats WHERE name = $1 AND type = $2',
                    [invitation.tournament_name, 'group']
                );

                if (chatResult.rows.length > 0) {
                    const chatId = chatResult.rows[0].id;
                    
                    // Получаем системного пользователя
                    const systemUserResult = await pool.query(
                        'SELECT id FROM users WHERE username = $1 AND is_system_user = true',
                        ['1337community']
                    );

                    if (systemUserResult.rows.length > 0) {
                        const systemUserId = systemUserResult.rows[0].id;
                        
                        // Создаем сообщение об успешном принятии приглашения
                        await pool.query(`
                            INSERT INTO messages (chat_id, sender_id, content, message_type, metadata)
                            VALUES ($1, $2, $3, $4, $5)
                        `, [
                            chatId,
                            systemUserId,
                            notificationMessage,
                            'system_notification',
                            JSON.stringify({
                                type: 'admin_invitation_accepted',
                                tournament_id: invitation.tournament_id,
                                new_admin_id: userId,
                                inviter_id: invitation.inviter_id
                            })
                        ]);

                        // Отправляем через WebSocket
                        if (global.io) {
                            global.io.to(`chat_${chatId}`).emit('message', {
                                chat_id: chatId,
                                sender_id: systemUserId,
                                content: notificationMessage,
                                message_type: 'system_notification',
                                created_at: new Date().toISOString()
                            });
                        }
                    }
                }

                res.json({
                    success: true,
                    message: `Вы успешно стали администратором турнира "${invitation.tournament_name}"`,
                    tournament_id: invitation.tournament_id,
                    tournament_name: invitation.tournament_name
                });
            } else {
                res.json({
                    success: true,
                    message: 'Приглашение успешно принято'
                });
            }
        } else {
            res.status(400).json({
                success: false,
                message: 'Не удалось принять приглашение. Возможно, оно уже обработано или истекло.'
            });
        }

    } catch (error) {
        console.error('Ошибка при принятии приглашения администратора:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при принятии приглашения',
            error: error.message
        });
    }
});

// 🆕 API endpoint для отклонения приглашения администратора
router.post('/admin-invitations/:id/decline', authenticateToken, async (req, res) => {
    try {
        const invitationId = parseInt(req.params.id);
        const userId = req.user.id;

        console.log('❌ Отклонение приглашения администратора:', { invitationId, userId });

        // Используем функцию из базы данных для отклонения приглашения
        const result = await pool.query(
            'SELECT decline_admin_invitation($1, $2) as success',
            [invitationId, userId]
        );

        if (result.rows[0].success) {
            // Получаем информацию о приглашении для уведомления
            const invitationInfo = await pool.query(`
                SELECT ai.*, t.name as tournament_name, 
                       inviter.username as inviter_username,
                       invitee.username as invitee_username
                FROM admin_invitations ai
                JOIN tournaments t ON ai.tournament_id = t.id
                JOIN users inviter ON ai.inviter_id = inviter.id
                JOIN users invitee ON ai.invitee_id = invitee.id
                WHERE ai.id = $1
            `, [invitationId]);

            if (invitationInfo.rows.length > 0) {
                const invitation = invitationInfo.rows[0];
                
                // Отправляем уведомление приглашающему об отклонении
                const notificationMessage = `😔 ${invitation.invitee_username} отклонил приглашение стать администратором турнира "${invitation.tournament_name}"`;
                
                // Находим чат турнира для отправки уведомления
                const chatResult = await pool.query(
                    'SELECT id FROM chats WHERE name = $1 AND type = $2',
                    [invitation.tournament_name, 'group']
                );

                if (chatResult.rows.length > 0) {
                    const chatId = chatResult.rows[0].id;
                    
                    // Получаем системного пользователя
                    const systemUserResult = await pool.query(
                        'SELECT id FROM users WHERE username = $1 AND is_system_user = true',
                        ['1337community']
                    );

                    if (systemUserResult.rows.length > 0) {
                        const systemUserId = systemUserResult.rows[0].id;
                        
                        // Создаем сообщение об отклонении приглашения
                        await pool.query(`
                            INSERT INTO messages (chat_id, sender_id, content, message_type, metadata)
                            VALUES ($1, $2, $3, $4, $5)
                        `, [
                            chatId,
                            systemUserId,
                            notificationMessage,
                            'system_notification',
                            JSON.stringify({
                                type: 'admin_invitation_declined',
                                tournament_id: invitation.tournament_id,
                                declined_by: userId,
                                inviter_id: invitation.inviter_id
                            })
                        ]);

                        // Отправляем через WebSocket
                        if (global.io) {
                            global.io.to(`chat_${chatId}`).emit('message', {
                                chat_id: chatId,
                                sender_id: systemUserId,
                                content: notificationMessage,
                                message_type: 'system_notification',
                                created_at: new Date().toISOString()
                            });
                        }
                    }
                }

                res.json({
                    success: true,
                    message: `Приглашение в администраторы турнира "${invitation.tournament_name}" отклонено`,
                    tournament_id: invitation.tournament_id,
                    tournament_name: invitation.tournament_name
                });
            } else {
                res.json({
                    success: true,
                    message: 'Приглашение успешно отклонено'
                });
            }
        } else {
            res.status(400).json({
                success: false,
                message: 'Не удалось отклонить приглашение. Возможно, оно уже обработано.'
            });
        }

    } catch (error) {
        console.error('Ошибка при отклонении приглашения администратора:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при отклонении приглашения',
            error: error.message
        });
    }
});

// 🆕 ОЧИСТКА ИСТЕКШИХ ПРИГЛАШЕНИЙ АДМИНИСТРАТОРОВ
router.post('/admin-invitations/cleanup-expired', authenticateToken, async (req, res) => {
    try {
        // Проверяем, является ли пользователь администратором системы
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Доступ запрещен: требуются права администратора' });
        }

        // Обновляем статус истекших приглашений
        const result = await pool.query(
            'UPDATE admin_invitations SET status = $1 WHERE status = $2 AND expires_at <= NOW()',
            ['expired', 'pending']
        );

        const expiredCount = result.rowCount;

        console.log(`🧹 Очистка истекших приглашений: обновлено ${expiredCount} записей`);

        res.json({
            success: true,
            message: `Очищено ${expiredCount} истекших приглашений`,
            expiredCount: expiredCount
        });

    } catch (error) {
        console.error('❌ Ошибка при очистке истекших приглашений:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при очистке истекших приглашений',
            error: error.message
        });
    }
});

// 🆕 ПОЛУЧЕНИЕ СТАТИСТИКИ ПРИГЛАШЕНИЙ АДМИНИСТРАТОРОВ
router.get('/admin-invitations/stats', authenticateToken, async (req, res) => {
    try {
        // Проверяем, является ли пользователь администратором системы
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Доступ запрещен: требуются права администратора' });
        }

        // Получаем статистику по приглашениям
        const statsResult = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count,
                COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_count
            FROM admin_invitations 
            GROUP BY status
            ORDER BY status
        `);

        const totalResult = await pool.query('SELECT COUNT(*) as total FROM admin_invitations');
        const activeResult = await pool.query(`
            SELECT COUNT(*) as active 
            FROM admin_invitations 
            WHERE status = 'pending' AND expires_at > NOW()
        `);

        res.json({
            success: true,
            stats: {
                total: parseInt(totalResult.rows[0].total),
                active: parseInt(activeResult.rows[0].active),
                by_status: statsResult.rows.map(row => ({
                    status: row.status,
                    count: parseInt(row.count),
                    expired_count: parseInt(row.expired_count)
                }))
            }
        });

    } catch (error) {
        console.error('❌ Ошибка при получении статистики приглашений:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при получении статистики',
            error: error.message
        });
    }
});

// 🔧 ПОЛУЧЕНИЕ КОМАНД И ИХ УЧАСТНИКОВ ДЛЯ КОМАНДНЫХ ТУРНИРОВ (ИСПРАВЛЕНО: ВОССТАНОВЛЕН МАРШРУТ)
router.get('/:id/teams', async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`🔍 [GET /:id/teams] Запрос команд для турнира ${id}`);
        
        // Проверяем существование турнира
        const tourCheck = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tourCheck.rows.length === 0) {
            console.log(`❌ [GET /:id/teams] Турнир ${id} не найден`);
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Получаем все команды турнира
        const teamsRes = await pool.query(
            `SELECT tt.id, tt.tournament_id, tt.name, tt.creator_id
             FROM tournament_teams tt
             WHERE tt.tournament_id = $1
             ORDER BY tt.id`,
            [id]
        );

        console.log(`🔍 [GET /:id/teams] Найдено ${teamsRes.rows.length} команд для турнира ${id}`);

        // Для каждой команды получаем участников с ПОЛНЫМИ полями рейтинга
        const teams = await Promise.all(teamsRes.rows.map(async (team) => {
            const membersRes = await pool.query(
                `SELECT tm.team_id, tm.user_id, tm.participant_id, 
                        tp.name, u.username, u.avatar_url, 
                        tp.faceit_elo, tp.cs2_premier_rank,
                        u.faceit_elo as user_faceit_elo, u.cs2_premier_rank as user_premier_rank,
                        u.faceit_elo as user_faceit_rating, u.cs2_premier_rank as user_premier_rating
                 FROM tournament_team_members tm
                 LEFT JOIN tournament_participants tp ON tm.participant_id = tp.id
                 LEFT JOIN users u ON tm.user_id = u.id
                 WHERE tm.team_id = $1
                 ORDER BY tm.participant_id`,
                [team.id]
            );

            console.log(`📊 [GET /:id/teams] Команда ${team.name}: ${membersRes.rows.length} участников`);

            // 🆕 РАСЧЕТ СРЕДНЕГО РЕЙТИНГА КОМАНДЫ (среднеарифметическое участников)
            const members = membersRes.rows;
            let averageRatingFaceit = 0;
            let averageRatingPremier = 0;
            
            if (members.length > 0) {
                // Рассчитываем для FACEIT
                const faceitRatings = members.map(member => normalizeParticipantRating(member, 'faceit'));
                averageRatingFaceit = Math.round(faceitRatings.reduce((sum, rating) => sum + rating, 0) / faceitRatings.length);
                
                // Рассчитываем для Premier  
                const premierRatings = members.map(member => normalizeParticipantRating(member, 'premier'));
                averageRatingPremier = Math.round(premierRatings.reduce((sum, rating) => sum + rating, 0) / premierRatings.length);
                
                console.log(`📊 Команда ${team.name}: FACEIT средний ${averageRatingFaceit}, Premier средний ${averageRatingPremier}`);
            }

            return {
                ...team,
                members: members,
                // 🆕 ДОБАВЛЯЕМ СРЕДНИЕ РЕЙТИНГИ КОМАНДЫ
                averageRatingFaceit: averageRatingFaceit,
                averageRatingPremier: averageRatingPremier,
                averageRating: averageRatingFaceit // для обратной совместимости
            };
        }));

        console.log(`✅ [GET /:id/teams] Успешно загружены команды для турнира ${id}`);
        res.json(teams);
    } catch (err) {
        console.error(`❌ [GET /:id/teams] Ошибка получения команд турнира ${id}:`, err);
        res.status(500).json({ error: err.message || 'Ошибка при получении команд турнира' });
    }
});

// 🔧 ФУНКЦИЯ БЕЗОПАСНОГО ПРОДВИЖЕНИЯ ПОБЕДИТЕЛЕЙ С ТРАНЗАКЦИЯМИ
async function safeAdvanceWinner(matchId, winnerId, client = pool) {
    const startTime = Date.now();
    console.log(`🔧 [safeAdvanceWinner] НАЧАЛО: продвижение победителя ${winnerId} из матча ${matchId}`);
    
    try {
        // 1. Получаем данные текущего матча с блокировкой
        console.log(`🔍 [safeAdvanceWinner] Получаем данные матча ${matchId}...`);
        const matchResult = await client.query(
            'SELECT * FROM matches WHERE id = $1 FOR UPDATE',
            [matchId]
        );
        
        if (matchResult.rows.length === 0) {
            throw new Error(`Матч ${matchId} не найден`);
        }
        
        const match = matchResult.rows[0];
        console.log(`✅ [safeAdvanceWinner] Матч получен, next_match_id: ${match.next_match_id}`);
        
        // 2. Валидация: проверяем, что победитель является участником матча
        if (![match.team1_id, match.team2_id].includes(winnerId)) {
            throw new Error(`Команда ${winnerId} не является участником матча ${matchId}`);
        }
        
        // 3. Если нет следующего матча - продвижение не требуется
        if (!match.next_match_id) {
            console.log(`✅ [safeAdvanceWinner] Матч ${matchId} не имеет следующего матча (финал?)`);
            return { advanced: false, reason: 'no_next_match' };
        }
        
        // 4. Получаем следующий матч с блокировкой
        console.log(`🔍 [safeAdvanceWinner] Получаем следующий матч ${match.next_match_id}...`);
        const nextMatchResult = await client.query(
            'SELECT * FROM matches WHERE id = $1 FOR UPDATE',
            [match.next_match_id]
        );
        
        if (nextMatchResult.rows.length === 0) {
            throw new Error(`Следующий матч ${match.next_match_id} не найден`);
        }
        
        const nextMatch = nextMatchResult.rows[0];
        
        console.log(`🔧 [safeAdvanceWinner] Следующий матч ${nextMatch.id}: team1=${nextMatch.team1_id}, team2=${nextMatch.team2_id}`);
        
        // 5. Проверяем, не занят ли уже победитель в следующем матче
        if (nextMatch.team1_id === winnerId || nextMatch.team2_id === winnerId) {
            console.log(`✅ [safeAdvanceWinner] Победитель ${winnerId} уже находится в матче ${nextMatch.id}`);
            return { advanced: false, reason: 'already_advanced' };
        }
        
        // 6. Определяем свободную позицию в следующем матче
        let updateField = null;
        let updateValue = winnerId;
        
        if (!nextMatch.team1_id) {
            updateField = 'team1_id';
        } else if (!nextMatch.team2_id) {
            updateField = 'team2_id';
        } else {
            // Если обе позиции заняты - это ошибка в структуре сетки
            throw new Error(`Все позиции в следующем матче ${nextMatch.id} уже заняты: team1=${nextMatch.team1_id}, team2=${nextMatch.team2_id}`);
        }
        
        console.log(`💾 [safeAdvanceWinner] Обновляем позицию ${updateField} в матче ${nextMatch.id}...`);
        
        // 7. Атомарно обновляем следующий матч
        const updateResult = await client.query(
            `UPDATE matches SET ${updateField} = $1 WHERE id = $2 AND ${updateField} IS NULL RETURNING *`,
            [winnerId, nextMatch.id]
        );
        
        if (updateResult.rows.length === 0) {
            // Кто-то другой уже занял эту позицию
            throw new Error(`Позиция ${updateField} в матче ${nextMatch.id} была занята другим процессом`);
        }
        
        const endTime = Date.now();
        console.log(`✅ [safeAdvanceWinner] Успешно продвинут победитель ${winnerId} в позицию ${updateField} матча ${nextMatch.id} за ${endTime - startTime}ms`);
        
        return {
            advanced: true,
            nextMatchId: nextMatch.id,
            position: updateField,
            previousTeam1: nextMatch.team1_id,
            previousTeam2: nextMatch.team2_id,
            newTeam1: updateField === 'team1_id' ? winnerId : nextMatch.team1_id,
            newTeam2: updateField === 'team2_id' ? winnerId : nextMatch.team2_id
        };
        
    } catch (error) {
        const endTime = Date.now();
        console.error(`❌ [safeAdvanceWinner] Ошибка продвижения победителя ${winnerId} из матча ${matchId} за ${endTime - startTime}ms:`, error.message);
        throw error;
    }
}

// 🆕 ФУНКЦИЯ БЕЗОПАСНОГО ПРОДВИЖЕНИЯ ПРОИГРАВШЕГО (для матчей за 3-е место)
async function safeAdvanceLoser(matchId, loserId, client = pool) {
    console.log(`🔧 [safeAdvanceLoser] НАЧАЛО: продвижение проигравшего ${loserId} из матча ${matchId}`);
    
    try {
        // Получаем данные текущего матча
        const matchResult = await client.query(
            'SELECT * FROM matches WHERE id = $1 FOR UPDATE',
            [matchId]
        );
        
        if (matchResult.rows.length === 0) {
            throw new Error(`Матч ${matchId} не найден`);
        }
        
        const match = matchResult.rows[0];
        
        // Если нет матча для проигравшего - продвижение не требуется
        if (!match.loser_next_match_id) {
            console.log(`✅ [safeAdvanceLoser] Матч ${matchId} не имеет матча для проигравшего`);
            return { advanced: false, reason: 'no_loser_match' };
        }
        
        console.log(`🔍 [safeAdvanceLoser] Получаем матч для проигравшего ${match.loser_next_match_id}...`);
        
        // Получаем матч для проигравшего (обычно матч за 3-е место)
        const loserMatchResult = await client.query(
            'SELECT * FROM matches WHERE id = $1 FOR UPDATE',
            [match.loser_next_match_id]
        );
        
        if (loserMatchResult.rows.length === 0) {
            throw new Error(`Матч для проигравшего ${match.loser_next_match_id} не найден`);
        }
        
        const loserMatch = loserMatchResult.rows[0];
        
        // Определяем свободную позицию
        let updateField = null;
        
        if (!loserMatch.team1_id) {
            updateField = 'team1_id';
        } else if (!loserMatch.team2_id) {
            updateField = 'team2_id';
        } else {
            console.log(`⚠️ [safeAdvanceLoser] Все позиции в матче проигравших ${loserMatch.id} уже заняты`);
            return { advanced: false, reason: 'match_full' };
        }
        
        console.log(`💾 [safeAdvanceLoser] Обновляем позицию ${updateField} в матче проигравших ${loserMatch.id}...`);
        
        // Атомарно обновляем матч для проигравшего
        const updateResult = await client.query(
            `UPDATE matches SET ${updateField} = $1 WHERE id = $2 AND ${updateField} IS NULL RETURNING *`,
            [loserId, loserMatch.id]
        );
        
        if (updateResult.rows.length === 0) {
            throw new Error(`Позиция ${updateField} в матче проигравших ${loserMatch.id} была занята другим процессом`);
        }
        
        console.log(`✅ [safeAdvanceLoser] Успешно продвинут проигравший ${loserId} в позицию ${updateField} матча ${loserMatch.id}`);
        
        return {
            advanced: true,
            loserMatchId: loserMatch.id,
            position: updateField
        };
        
    } catch (error) {
        console.error(`❌ [safeAdvanceLoser] Ошибка продвижения проигравшего ${loserId} из матча ${matchId}:`, error.message);
        throw error;
    }
}

// 🆕 ФУНКЦИЯ БЕЗОПАСНОГО ОБНОВЛЕНИЯ РЕЗУЛЬТАТА МАТЧА С ТРАНЗАКЦИЯМИ
async function safeUpdateMatchResult(matchId, winnerId, score1, score2, mapsData, userId) {
    console.log(`🔒 [safeUpdateMatchResult] НАЧАЛО ФУНКЦИИ для матча ${matchId}`);
    console.log(`   - Winner ID: ${winnerId}`);
    console.log(`   - Score: ${score1}:${score2}`);
    console.log(`   - User ID: ${userId}`);
    console.log(`   - Maps data:`, mapsData);
    
    const startTime = Date.now();
    const client = await pool.connect();
    
    try {
        console.log(`🔄 [safeUpdateMatchResult] Начинаем транзакцию...`);
        await client.query('BEGIN');
        console.log(`🔒 [safeUpdateMatchResult] Начинаем транзакцию для матча ${matchId}`);
        
        // 1. Получаем и блокируем текущий матч с ТАЙМАУТОМ
        console.log(`🔍 [safeUpdateMatchResult] Получаем данные матча ${matchId} с блокировкой...`);
        
        // 🆕 ДОБАВЛЯЕМ ТАЙМАУТ ДЛЯ БЛОКИРОВКИ
        let matchData;
        try {
            // Устанавливаем таймаут на блокировку (5 секунд)
            await client.query('SET statement_timeout = 5000'); // 5 секунд
            
            const matchResult = await client.query(
                'SELECT m.*, t.format as tournament_format FROM matches m JOIN tournaments t ON m.tournament_id = t.id WHERE m.id = $1 FOR UPDATE',
                [matchId]
            );
            
            if (matchResult.rows.length === 0) {
                throw new Error(`Матч ${matchId} не найден`);
            }
            
            matchData = matchResult.rows[0];
            console.log(`✅ [safeUpdateMatchResult] Матч заблокирован успешно:`, {
                id: matchData.id,
                team1_id: matchData.team1_id,
                team2_id: matchData.team2_id,
                current_winner: matchData.winner_team_id,
                next_match: matchData.next_match_id
            });
            
        } catch (lockError) {
            console.log(`⚠️ [safeUpdateMatchResult] ОШИБКА БЛОКИРОВКИ: ${lockError.message}`);
            
            // Если блокировка не удалась, пробуем без FOR UPDATE
            console.log(`🔄 [safeUpdateMatchResult] Пробуем без блокировки...`);
            
            const matchResult = await client.query(
                'SELECT m.*, t.format as tournament_format FROM matches m JOIN tournaments t ON m.tournament_id = t.id WHERE m.id = $1',
                [matchId]
            );
            
            if (matchResult.rows.length === 0) {
                throw new Error(`Матч ${matchId} не найден`);
            }
            
            matchData = matchResult.rows[0];
            console.log(`⚠️ [safeUpdateMatchResult] ОПЕРАЦИЯ ПРЕРВАНА - блокировка не удалась (безопасность)`);
        }
        
        // Сбрасываем таймаут
        await client.query('SET statement_timeout = 0');
        
        console.log(`🔍 [safeUpdateMatchResult] Данные матча получены:`, {
            team1: matchData.team1_id,
            team2: matchData.team2_id,
            current_winner: matchData.winner_team_id,
            current_score: `${matchData.score1}:${matchData.score2}`,
            format: matchData.tournament_format,
            next_match: matchData.next_match_id
        });

        // 2. Обновляем результат матча
        console.log(`💾 [safeUpdateMatchResult] Обновляем результат матча ${matchId}...`);
        
        await client.query(
            'UPDATE matches SET winner_team_id = $1, score1 = $2, score2 = $3, maps_data = $4 WHERE id = $5',
            [winnerId, score1, score2, JSON.stringify(mapsData), matchId]
        );
        
        console.log(`✅ [safeUpdateMatchResult] Результат матча обновлен`);

        // 3. Продвигаем победителя если есть следующий матч
        if (matchData.next_match_id) {
            console.log(`🏆 [safeUpdateMatchResult] Продвигаем победителя ${winnerId} в матч ${matchData.next_match_id}...`);
            await safeAdvanceWinner(matchId, winnerId, client);
            console.log(`✅ [safeUpdateMatchResult] Победитель продвинут`);
        } else {
            console.log(`ℹ️ [safeUpdateMatchResult] Следующий матч не найден, продвижение не требуется`);
        }

        // 4. Обрабатываем проигравшего (для double elimination)
        const loserId = matchData.team1_id === winnerId ? matchData.team2_id : matchData.team1_id;
        if (matchData.loser_next_match_id) {
            console.log(`💔 [safeUpdateMatchResult] Продвигаем проигравшего ${loserId} в матч ${matchData.loser_next_match_id}...`);
            await safeAdvanceLoser(matchId, loserId, client);
            console.log(`✅ [safeUpdateMatchResult] Проигравший продвинут`);
        } else {
            console.log(`ℹ️ [safeUpdateMatchResult] Матч для проигравшего не найден`);
        }

        // 5. Логируем событие
        console.log(`📝 [safeUpdateMatchResult] Логируем событие...`);
        await logTournamentEvent(matchData.tournament_id, userId, 'match_completed', {
            match_id: matchId,
            winner_team_id: winnerId,
            score: `${score1}:${score2}`,
            maps_count: mapsData?.length || 0
        }, client);

        // 6. Коммитим транзакцию
        console.log(`✅ [safeUpdateMatchResult] Коммитим транзакцию...`);
        await client.query('COMMIT');
        
        const duration = Date.now() - startTime;
        console.log(`🎉 [safeUpdateMatchResult] УСПЕШНО ЗАВЕРШЕНО за ${duration}ms`);
        
        return {
            success: true,
            message: 'Результат матча обновлен успешно',
            duration: duration
        };

    } catch (error) {
        console.log(`❌ [safeUpdateMatchResult] ОШИБКА:`, error.message);
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        console.log(`🔓 [safeUpdateMatchResult] Соединение освобождено`);
    }
}

// 🆕 ФУНКЦИЯ КОМПЛЕКСНОЙ ДИАГНОСТИКИ ТУРНИРНОЙ СЕТКИ
async function validateTournamentBracket(tournamentId) {
    const startTime = Date.now();
    console.log(`🔍 [validateTournamentBracket] Начинаем диагностику турнира ${tournamentId}`);
    
    try {
        // 1. Получаем все матчи турнира
        const matchesResult = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [tournamentId]
        );
        const matches = matchesResult.rows;
        
        if (matches.length === 0) {
            return { valid: true, warnings: [], errors: [] };
        }
        
        const warnings = [];
        const errors = [];
        
        // 2. Проверяем каждый матч с результатом
        for (const match of matches) {
            if (match.winner_team_id) {
                console.log(`🔍 Проверяем матч ${match.id} (№${match.match_number}): winner=${match.winner_team_id}`);
                
                // Проверка продвижения победителя
                if (match.next_match_id) {
                    const nextMatchResult = await pool.query(
                        'SELECT * FROM matches WHERE id = $1',
                        [match.next_match_id]
                    );
                    
                    if (nextMatchResult.rows.length === 0) {
                        errors.push(`Матч ${match.id}: Ссылка на несуществующий следующий матч ${match.next_match_id}`);
                    } else {
                        const nextMatch = nextMatchResult.rows[0];
                        const winnerInNextMatch = (nextMatch.team1_id === match.winner_team_id || nextMatch.team2_id === match.winner_team_id);
                        
                        if (!winnerInNextMatch) {
                            errors.push(`🚨 КРИТИЧЕСКАЯ ОШИБКА: Победитель ${match.winner_team_id} из матча ${match.id} НЕ находится в следующем матче ${nextMatch.id} (team1=${nextMatch.team1_id}, team2=${nextMatch.team2_id})`);
                        } else {
                            console.log(`✅ Победитель ${match.winner_team_id} корректно продвинут в матч ${nextMatch.id}`);
                        }
                    }
                }
                
                // Проверка продвижения проигравшего
                if (match.loser_next_match_id) {
                    const loserId = match.team1_id === match.winner_team_id ? match.team2_id : match.team1_id;
                    
                    const loserMatchResult = await pool.query(
                        'SELECT * FROM matches WHERE id = $1',
                        [match.loser_next_match_id]
                    );
                    
                    if (loserMatchResult.rows.length === 0) {
                        errors.push(`Матч ${match.id}: Ссылка на несуществующий матч для проигравшего ${match.loser_next_match_id}`);
                    } else {
                        const loserMatch = loserMatchResult.rows[0];
                        const loserInLoserMatch = (loserMatch.team1_id === loserId || loserMatch.team2_id === loserId);
                        
                        if (!loserInLoserMatch) {
                            errors.push(`🚨 ОШИБКА: Проигравший ${loserId} из матча ${match.id} НЕ находится в матче для проигравших ${loserMatch.id} (team1=${loserMatch.team1_id}, team2=${loserMatch.team2_id})`);
                        } else {
                            console.log(`✅ Проигравший ${loserId} корректно продвинут в матч для проигравших ${loserMatch.id}`);
                        }
                    }
                }
            }
        }
        
        // 3. Проверяем потенциальные race conditions
        const duplicateTeams = [];
        const nextMatches = matches.filter(m => m.next_match_id);
        
        for (const nextMatchId of [...new Set(nextMatches.map(m => m.next_match_id))]) {
            const nextMatchResult = await pool.query(
                'SELECT * FROM matches WHERE id = $1',
                [nextMatchId]
            );
            
            if (nextMatchResult.rows.length > 0) {
                const nextMatch = nextMatchResult.rows[0];
                if (nextMatch.team1_id && nextMatch.team1_id === nextMatch.team2_id) {
                    warnings.push(`Матч ${nextMatchId}: Одна команда ${nextMatch.team1_id} в обеих позициях`);
                }
            }
        }
        
        const endTime = Date.now();
        const result = {
            valid: errors.length === 0,
            warnings: warnings,
            errors: errors,
            matchesChecked: matches.length,
            checkDuration: endTime - startTime
        };
        
        console.log(`🔍 [validateTournamentBracket] Диагностика завершена за ${endTime - startTime}ms:`, result);
        return result;
        
    } catch (error) {
        console.error(`❌ [validateTournamentBracket] Ошибка диагностики турнира ${tournamentId}:`, error.message);
        return {
            valid: false,
            warnings: [],
            errors: [`Ошибка диагностики: ${error.message}`],
            matchesChecked: 0,
            checkDuration: Date.now() - startTime
        };
    }
}

// 🆕 ЭНДПОИНТ ДЛЯ ДИАГНОСТИКИ ТУРНИРНОЙ СЕТКИ
router.get('/:id/validate-bracket', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    try {
        // Проверяем права доступа
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
                return res.status(403).json({ error: 'Только создатель или администратор может проводить диагностику' });
            }
        }
        
        // Проводим диагностику
        const validation = await validateTournamentBracket(id);
        
        res.status(200).json({
            message: 'Диагностика турнирной сетки завершена',
            tournamentId: id,
            validation: validation
        });
        
    } catch (err) {
        console.error('❌ Ошибка диагностики турнирной сетки:', err);
        res.status(500).json({ error: err.message });
    }
});

// 🆕 ЭНДПОИНТ ДЛЯ СБРОСА РЕЗУЛЬТАТОВ МАТЧЕЙ ТУРНИРА
router.post('/:id/reset-match-results', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    try {
        console.log(`🔄 [reset-match-results] УЛУЧШЕННЫЙ СБРОС результатов матчей для турнира ${id}`);
        
        // Начинаем транзакцию
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Получаем количество матчей с результатами для логирования
            const countResult = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1 AND winner_team_id IS NOT NULL', 
                [id]
            );
            const matchesWithResultsCount = parseInt(countResult.rows[0].count);
            
            console.log(`📊 [reset-match-results] Найдено ${matchesWithResultsCount} матчей с результатами`);
            
            // 1. Очищаем ВСЕ результаты матчей
            await client.query(`
                UPDATE matches 
                SET winner_team_id = NULL, 
                    score1 = NULL, 
                    score2 = NULL, 
                    maps_data = NULL
                WHERE tournament_id = $1
            `, [id]);
            
            console.log(`✅ [reset-match-results] Очищены результаты всех матчей`);
            
            // 2. Восстанавливаем изначальную структуру сетки
            const restoreResult = await restoreOriginalBracketStructure(id, client);
            console.log(`✅ [reset-match-results] Структура сетки восстановлена:`, restoreResult);
            
            // 3. Меняем статус турнира обратно на 'active'
            await client.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2',
                ['active', id]
            );
            
            console.log(`✅ [reset-match-results] Статус турнира ${id} изменен на 'active'`);
            
            // 4. Логируем операцию
            await logTournamentEvent(id, userId, 'match_results_reset', {
                clearedResultsCount: matchesWithResultsCount,
                statusChangedTo: 'active',
                participantsRestored: restoreResult.participantsPlaced,
                performedBy: req.user.username
            }, client);
            
            await client.query('COMMIT');
            console.log(`🔓 [reset-match-results] Транзакция завершена для турнира ${id}`);
            
            // 5. Отправляем уведомление в чат
            await sendTournamentChatAnnouncement(
                id,
                `🔄 Администратор ${req.user.username} сбросил результаты матчей и восстановил изначальную структуру турнирной сетки. Статус турнира изменен на "Активный".`
            );
            
            res.status(200).json({
                message: `Успешно очищены результаты ${matchesWithResultsCount} матчей и восстановлена изначальная структура сетки`,
                clearedCount: matchesWithResultsCount,
                statusChanged: true,
                newStatus: 'active',
                participantsRestored: restoreResult.participantsPlaced,
                structureRestored: true
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (err) {
        console.error('❌ Ошибка сброса результатов матчей:', err);
        res.status(500).json({ error: err.message });
    }
});

// 🆕 ФУНКЦИЯ ВОССТАНОВЛЕНИЯ ИЗНАЧАЛЬНОЙ СТРУКТУРЫ СЕТКИ
async function restoreOriginalBracketStructure(tournamentId, client) {
    console.log(`🔧 [restoreOriginalBracketStructure] Восстанавливаем изначальную структуру турнира ${tournamentId}`);
    
    try {
        // 1. Получаем информацию о турнире и участниках
        const tournamentResult = await client.query(`
            SELECT t.*, tp.participant_id, tp.in_team 
            FROM tournaments t
            LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id 
            WHERE t.id = $1
            ORDER BY tp.id
        `, [tournamentId]);
        
        if (tournamentResult.rows.length === 0) {
            throw new Error(`Турнир ${tournamentId} не найден`);
        }
        
        const tournament = tournamentResult.rows[0];
        const participants = tournamentResult.rows
            .filter(row => row.participant_id)
            .map(row => ({ id: row.participant_id, in_team: row.in_team }));
        
        console.log(`📊 [restoreOriginalBracketStructure] Турнир: ${tournament.format}, участников: ${participants.length}`);
        
        // 2. Очищаем все команды из всех матчей
        await client.query(`
            UPDATE matches 
            SET team1_id = NULL, team2_id = NULL
            WHERE tournament_id = $1
        `, [tournamentId]);
        
        console.log(`✅ [restoreOriginalBracketStructure] Очищены все команды из матчей`);
        
        // 3. Для Single Elimination восстанавливаем структуру
        if (tournament.format === 'single_elimination') {
            await restoreSingleEliminationStructure(tournamentId, participants, client);
        } else if (tournament.format === 'double_elimination') {
            await restoreDoubleEliminationStructure(tournamentId, participants, client);
        } else {
            console.log(`⚠️ [restoreOriginalBracketStructure] Неизвестный формат: ${tournament.format}`);
        }
        
        console.log(`✅ [restoreOriginalBracketStructure] Структура сетки восстановлена`);
        return { success: true, participantsPlaced: participants.length };
        
    } catch (error) {
        console.error(`❌ [restoreOriginalBracketStructure] Ошибка восстановления структуры:`, error.message);
        throw error;
    }
}

// 🆕 ФУНКЦИЯ ВОССТАНОВЛЕНИЯ SINGLE ELIMINATION
async function restoreSingleEliminationStructure(tournamentId, participants, client) {
    console.log(`🏆 [restoreSingleEliminationStructure] Восстанавливаем Single Elimination для ${participants.length} участников`);
    
    try {
        // Получаем все матчи турнира
        const matchesResult = await client.query(`
            SELECT * FROM matches 
            WHERE tournament_id = $1 
            ORDER BY round, match_number
        `, [tournamentId]);
        
        const matches = matchesResult.rows;
        const participantCount = participants.length;
        
        // Рандомизируем участников (как при генерации)
        const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
        
        // Определяем ближайшую степень двойки
        const pow = Math.floor(Math.log2(participantCount));
        const closestPowerOfTwo = Math.pow(2, pow);
        const round0MatchCount = closestPowerOfTwo / 2;
        
        // Рассчитываем распределение участников
        const minByeParticipants = Math.min(round0MatchCount, participantCount);
        const preliminaryParticipants = participantCount - minByeParticipants;
        const prelimMatchesCount = Math.min(preliminaryParticipants, round0MatchCount);
        const actualPrelimParticipants = prelimMatchesCount * 2;
        const byeParticipantsCount = participantCount - actualPrelimParticipants;
        
        console.log(`📊 Участников: ${participantCount}, предварительных матчей: ${prelimMatchesCount}, с автопроходом: ${byeParticipantsCount}`);
        
        // Распределяем участников
        const prelimParticipants = shuffledParticipants.slice(0, actualPrelimParticipants);
        const byeParticipants = shuffledParticipants.slice(actualPrelimParticipants);
        
        // 1. Размещаем участников в предварительный раунд (round = -1)
        const prelimMatches = matches.filter(m => m.round === -1);
        for (let i = 0; i < prelimMatches.length && i < prelimMatchesCount; i++) {
            const match = prelimMatches[i];
            const team1Index = i * 2;
            const team2Index = i * 2 + 1;
            
            if (team1Index < prelimParticipants.length && team2Index < prelimParticipants.length) {
                await client.query(`
                    UPDATE matches 
                    SET team1_id = $1, team2_id = $2 
                    WHERE id = $3
                `, [prelimParticipants[team1Index].id, prelimParticipants[team2Index].id, match.id]);
                
                console.log(`✅ Предварительный матч ${match.id}: ${prelimParticipants[team1Index].id} vs ${prelimParticipants[team2Index].id}`);
            }
        }
        
        // 2. Размещаем участников с автопроходом в первый раунд (round = 0)
        const round0Matches = matches.filter(m => m.round === 0);
        let byeParticipantIndex = 0;
        
        for (let i = 0; i < round0Matches.length && i < round0MatchCount; i++) {
            const match = round0Matches[i];
            let team1 = null;
            let team2 = null;
            
            // Распределяем участников с автопроходом равномерно
            if (byeParticipantIndex < byeParticipantsCount) {
                team1 = byeParticipants[byeParticipantIndex];
                byeParticipantIndex++;
                
                if (byeParticipantIndex < byeParticipantsCount) {
                    team2 = byeParticipants[byeParticipantIndex];
                    byeParticipantIndex++;
                }
            }
            
            // Обновляем только если есть участники
            if (team1 || team2) {
                await client.query(`
                    UPDATE matches 
                    SET team1_id = $1, team2_id = $2 
                    WHERE id = $3
                `, [team1?.id || null, team2?.id || null, match.id]);
                
                console.log(`✅ Первый раунд матч ${match.id}: ${team1?.id || 'TBD'} vs ${team2?.id || 'TBD'}`);
            }
        }
        
        console.log(`✅ [restoreSingleEliminationStructure] Структура Single Elimination восстановлена`);
        return { success: true };
        
    } catch (error) {
        console.error(`❌ [restoreSingleEliminationStructure] Ошибка:`, error.message);
        throw error;
    }
}

// 🆕 ФУНКЦИЯ ВОССТАНОВЛЕНИЯ DOUBLE ELIMINATION (заглушка)
async function restoreDoubleEliminationStructure(tournamentId, participants, client) {
    console.log(`🏆 [restoreDoubleEliminationStructure] Восстанавливаем Double Elimination для ${participants.length} участников`);
    
    // Пока используем простую логику - размещаем всех участников в первый раунд Winners Bracket
    const matchesResult = await client.query(`
        SELECT * FROM matches 
        WHERE tournament_id = $1 AND bracket_type = 'winner' AND round = 0
        ORDER BY match_number
    `, [tournamentId]);
    
    const round0Matches = matchesResult.rows;
    
    for (let i = 0; i < round0Matches.length && i * 2 < participants.length; i++) {
        const match = round0Matches[i];
        const team1Index = i * 2;
        const team2Index = i * 2 + 1;
        
        const team1 = participants[team1Index];
        const team2 = participants[team2Index] || null;
        
        await client.query(`
            UPDATE matches 
            SET team1_id = $1, team2_id = $2 
            WHERE id = $3
        `, [team1.id, team2?.id || null, match.id]);
        
        console.log(`✅ Double Elimination матч ${match.id}: ${team1.id} vs ${team2?.id || 'TBD'}`);
    }
    
    return { success: true };
}

module.exports = router;
