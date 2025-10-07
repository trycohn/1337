const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { asyncHandler } = require('../../utils/asyncHandler');
const pool = require('../../db');

/**
 * Контроллер для управления составом команд турнира
 */
class TeamMemberController {
    /**
     * Добавить участника в команду
     */
    static addTeamMember = asyncHandler(async (req, res) => {
        const { id: tournamentId, teamId } = req.params;
        const { participantId, userId, nickname } = req.body;

        console.log('➕ [TeamMemberController] Добавление участника в команду:', {
            tournamentId,
            teamId,
            participantId,
            userId,
            nickname
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
                return res.status(403).json({ error: 'Только создатель или администратор может управлять составом команд' });
            }
        }

        // Проверка команды
        const team = await TeamRepository.getById(parseInt(teamId));
        if (!team || team.tournament_id !== parseInt(tournamentId)) {
            return res.status(404).json({ error: 'Команда не найдена в этом турнире' });
        }

        // Проверяем что турнир активен
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Нельзя изменять состав после начала турнира' });
        }

        // Проверяем лимит участников команды
        const currentMembers = await pool.query(
            'SELECT COUNT(*) as count FROM tournament_team_members WHERE team_id = $1',
            [teamId]
        );
        const membersCount = parseInt(currentMembers.rows[0].count);
        const maxTeamSize = tournament.team_size || 5;

        if (membersCount >= maxTeamSize) {
            return res.status(400).json({ error: `Команда заполнена (максимум ${maxTeamSize} участников)` });
        }

        let participant;

        // Вариант 1: Добавляем существующего участника турнира
        if (participantId) {
            participant = await ParticipantRepository.getById(parseInt(participantId));
            if (!participant || participant.tournament_id !== parseInt(tournamentId)) {
                return res.status(404).json({ error: 'Участник не найден в этом турнире' });
            }

            // Проверяем что участник не в другой команде
            if (participant.in_team) {
                return res.status(400).json({ error: 'Участник уже состоит в другой команде' });
            }

            // Добавляем в команду
            await pool.query(
                'INSERT INTO tournament_team_members (team_id, user_id, participant_id) VALUES ($1, $2, $3)',
                [teamId, participant.user_id, participantId]
            );

            // Обновляем флаг in_team
            await ParticipantRepository.updateInTeamStatus([participantId], true);
            
            // Если участник был в листе ожидания - убираем оттуда
            if (participant.in_waiting_list) {
                await pool.query(
                    'UPDATE tournament_participants SET in_waiting_list = FALSE WHERE id = $1',
                    [participantId]
                );
            }
        }
        // Вариант 2: Добавляем зарегистрированного пользователя
        else if (userId) {
            // Проверяем что пользователь существует
            const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            // Создаем участника турнира
            participant = await ParticipantRepository.create({
                tournament_id: parseInt(tournamentId),
                user_id: userId,
                name: userCheck.rows[0].username
            });

            // Добавляем в команду
            await pool.query(
                'INSERT INTO tournament_team_members (team_id, user_id, participant_id) VALUES ($1, $2, $3)',
                [teamId, userId, participant.id]
            );

            // Обновляем флаг in_team
            await ParticipantRepository.updateInTeamStatus([participant.id], true);
        }
        // Вариант 3: Добавляем незарегистрированного игрока
        else if (nickname && nickname.trim()) {
            // Создаем незарегистрированного участника
            participant = await ParticipantRepository.create({
                tournament_id: parseInt(tournamentId),
                user_id: null,
                name: nickname.trim()
            });

            // Добавляем в команду (без user_id для незарегистрированных)
            await pool.query(
                'INSERT INTO tournament_team_members (team_id, user_id, participant_id) VALUES ($1, $2, $3)',
                [teamId, null, participant.id]
            );

            // Обновляем флаг in_team
            await ParticipantRepository.updateInTeamStatus([participant.id], true);
        } else {
            return res.status(400).json({ error: 'Укажите участника для добавления' });
        }

        // Логируем событие
        await logTournamentEvent(parseInt(tournamentId), req.user.id, 'team_member_added', {
            teamId: parseInt(teamId),
            teamName: team.name,
            participantId: participant.id,
            participantName: participant.name
        });

        res.json({ 
            success: true,
            message: 'Участник добавлен в команду',
            participant
        });
    });

    /**
     * Удалить участника из команды
     */
    static removeTeamMember = asyncHandler(async (req, res) => {
        const { id: tournamentId, teamId, participantId } = req.params;

        console.log('🗑️ [TeamMemberController] Удаление участника из команды:', {
            tournamentId,
            teamId,
            participantId
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
                return res.status(403).json({ error: 'Только создатель или администратор может управлять составом команд' });
            }
        }

        // Проверяем что турнир активен
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Нельзя изменять состав после начала турнира' });
        }

        // Получаем участника
        const participant = await ParticipantRepository.getById(parseInt(participantId));
        if (!participant) {
            return res.status(404).json({ error: 'Участник не найден' });
        }

        // Удаляем из команды
        await pool.query(
            'DELETE FROM tournament_team_members WHERE team_id = $1 AND participant_id = $2',
            [teamId, participantId]
        );

        // Обновляем флаг in_team
        await ParticipantRepository.updateInTeamStatus([participantId], false);

        // Логируем событие
        await logTournamentEvent(parseInt(tournamentId), req.user.id, 'team_member_removed', {
            teamId: parseInt(teamId),
            participantId: parseInt(participantId),
            participantName: participant.name
        });

        res.json({ 
            success: true,
            message: 'Участник удален из команды'
        });
    });

    /**
     * Получить состав команды
     */
    static getTeamMembers = asyncHandler(async (req, res) => {
        const { id: tournamentId, teamId } = req.params;

        // Получаем участников команды
        const result = await pool.query(`
            SELECT 
                tp.id,
                tp.name,
                tp.user_id,
                tp.faceit_elo,
                tp.cs2_premier_rank,
                u.username,
                u.avatar_url,
                u.faceit_elo as user_faceit_elo,
                u.cs2_premier_rank as user_cs2_premier_rank,
                ttm.is_captain
            FROM tournament_team_members ttm
            JOIN tournament_participants tp ON ttm.participant_id = tp.id
            LEFT JOIN users u ON tp.user_id = u.id
            WHERE ttm.team_id = $1
            ORDER BY ttm.is_captain DESC, tp.name ASC
        `, [teamId]);

        res.json({ 
            success: true,
            members: result.rows
        });
    });
}

module.exports = TeamMemberController;
