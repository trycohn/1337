const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { asyncHandler } = require('../../utils/asyncHandler');
const pool = require('../../db');

/**
 * Контроллер для управления листом ожидания командных турниров
 */
class WaitingListController {
    /**
     * Присоединиться к листу ожидания
     */
    static joinWaitingList = asyncHandler(async (req, res) => {
        const { id: tournamentId } = req.params;
        const userId = req.user.id;
        const username = req.user.username;

        console.log('📋 [WaitingListController] Игрок присоединяется к листу ожидания:', {
            tournamentId,
            userId,
            username
        });

        // Проверка турнира
        const tournament = await TournamentRepository.getById(parseInt(tournamentId));
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Проверяем что турнир командный
        if (tournament.participant_type !== 'team') {
            return res.status(400).json({ error: 'Лист ожидания доступен только для командных турниров' });
        }

        // Проверяем что лист ожидания включен
        if (!tournament.waiting_list_enabled) {
            return res.status(400).json({ error: 'Лист ожидания отключен для этого турнира' });
        }

        // Проверяем что турнир активен
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        // Проверяем требования привязок
        const userCheck = await pool.query(
            'SELECT id, steam_id, faceit_id FROM users WHERE id = $1',
            [userId]
        );
        const user = userCheck.rows[0];

        if (tournament.waiting_list_require_faceit && !user.faceit_id) {
            return res.status(400).json({ 
                error: 'Для участия в листе ожидания требуется привязать FACEIT аккаунт',
                code: 'FACEIT_LINK_REQUIRED'
            });
        }

        if (tournament.waiting_list_require_steam && !user.steam_id) {
            return res.status(400).json({ 
                error: 'Для участия в листе ожидания требуется привязать Steam аккаунт',
                code: 'STEAM_LINK_REQUIRED'
            });
        }

        // Проверяем что игрок еще не участвует
        const existingParticipant = await ParticipantRepository.getUserParticipation(
            parseInt(tournamentId),
            userId
        );

        if (existingParticipant) {
            if (existingParticipant.in_waiting_list) {
                return res.status(400).json({ error: 'Вы уже в листе ожидания' });
            }
            if (existingParticipant.in_team) {
                return res.status(400).json({ error: 'Вы уже состоите в команде этого турнира' });
            }
            return res.status(400).json({ error: 'Вы уже участвуете в турнире' });
        }

        // Создаем участника в листе ожидания
        const participant = await ParticipantRepository.create({
            tournament_id: parseInt(tournamentId),
            user_id: userId,
            name: username
        });

        // Устанавливаем флаг листа ожидания
        await pool.query(
            'UPDATE tournament_participants SET in_waiting_list = TRUE WHERE id = $1',
            [participant.id]
        );

        // Логируем событие
        await logTournamentEvent(parseInt(tournamentId), userId, 'joined_waiting_list', {
            participantId: participant.id,
            participantName: username
        });

        res.json({ 
            success: true,
            message: 'Вы добавлены в лист ожидания',
            participant
        });
    });

    /**
     * Получить список ожидающих
     */
    static getWaitingList = asyncHandler(async (req, res) => {
        const { id: tournamentId } = req.params;

        // Получаем участников в листе ожидания
        const result = await pool.query(`
            SELECT 
                tp.id,
                tp.name,
                tp.user_id,
                tp.faceit_elo,
                tp.cs2_premier_rank,
                tp.created_at,
                u.username,
                u.avatar_url,
                u.faceit_elo as user_faceit_elo,
                u.cs2_premier_rank as user_cs2_premier_rank
            FROM tournament_participants tp
            LEFT JOIN users u ON tp.user_id = u.id
            WHERE tp.tournament_id = $1 
                AND tp.in_waiting_list = TRUE
                AND tp.in_team = FALSE
            ORDER BY tp.created_at ASC
        `, [tournamentId]);

        res.json({ 
            success: true,
            waitingList: result.rows,
            count: result.rows.length
        });
    });

    /**
     * Назначить игрока из листа ожидания в команду
     */
    static assignToTeam = asyncHandler(async (req, res) => {
        const { id: tournamentId, participantId } = req.params;
        const { teamId } = req.body;

        if (!teamId) {
            return res.status(400).json({ error: 'Укажите команду' });
        }

        console.log('🎯 [WaitingListController] Назначение игрока из листа в команду:', {
            tournamentId,
            participantId,
            teamId
        });

        // Проверка турнира
        const tournament = await TournamentRepository.getById(parseInt(tournamentId));
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Проверка прав доступа
        const isCreator = tournament.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        if (!isCreator && !isAdmin) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, req.user.id]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может назначать игроков' });
            }
        }

        // Проверка участника
        const participant = await ParticipantRepository.getById(parseInt(participantId));
        if (!participant || participant.tournament_id !== parseInt(tournamentId)) {
            return res.status(404).json({ error: 'Участник не найден в этом турнире' });
        }

        if (!participant.in_waiting_list) {
            return res.status(400).json({ error: 'Участник не находится в листе ожидания' });
        }

        // Проверка команды
        const team = await TeamRepository.getById(parseInt(teamId));
        if (!team || team.tournament_id !== parseInt(tournamentId)) {
            return res.status(404).json({ error: 'Команда не найдена в этом турнире' });
        }

        // Добавляем в команду
        await pool.query(
            'INSERT INTO tournament_team_members (team_id, user_id, participant_id) VALUES ($1, $2, $3)',
            [teamId, participant.user_id, participantId]
        );

        // Обновляем флаги
        await pool.query(
            'UPDATE tournament_participants SET in_waiting_list = FALSE, in_team = TRUE WHERE id = $1',
            [participantId]
        );

        // Логируем событие
        await logTournamentEvent(parseInt(tournamentId), req.user.id, 'assigned_from_waiting_list', {
            participantId: parseInt(participantId),
            participantName: participant.name,
            teamId: parseInt(teamId),
            teamName: team.name
        });

        res.json({ 
            success: true,
            message: `${participant.name} назначен в команду ${team.name}`
        });
    });
}

module.exports = WaitingListController;
