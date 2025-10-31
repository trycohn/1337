const pool = require('../../db');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { asyncHandler } = require('../../utils/asyncHandler');

/**
 * Контроллер для управления приглашениями в турнирные команды
 */
class TeamInvitationController {
    /**
     * Отправить приглашение игроку от капитана команды
     */
    static sendInvitation = asyncHandler(async (req, res) => {
        const { tournamentId, teamId } = req.params;
        const { userId: invitedUserId, message } = req.body;
        const inviterId = req.user.id;

        console.log('📧 [TeamInvitation] Отправка приглашения:', {
            tournamentId,
            teamId,
            inviterId,
            invitedUserId
        });

        // Проверка турнира
        const tournament = await TournamentRepository.getById(parseInt(tournamentId));
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Проверка что турнир активен
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Приглашения доступны только для активных турниров' });
        }

        // Проверка что пользователь - капитан команды
        const captainCheck = await pool.query(
            'SELECT * FROM tournament_team_members WHERE team_id = $1 AND user_id = $2 AND is_captain = true',
            [teamId, inviterId]
        );

        if (captainCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Только капитан может приглашать игроков в команду' });
        }

        // Проверка что приглашаемый пользователь существует
        const invitedUser = await pool.query(
            'SELECT id, username, email FROM users WHERE id = $1',
            [invitedUserId]
        );

        if (invitedUser.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Проверка что пользователь еще не участник турнира или не в команде
        const participantCheck = await pool.query(`
            SELECT tp.id, tp.in_team
            FROM tournament_participants tp
            WHERE tp.tournament_id = $1 AND tp.user_id = $2
        `, [tournamentId, invitedUserId]);

        if (participantCheck.rows.length > 0 && participantCheck.rows[0].in_team) {
            return res.status(400).json({ error: 'Пользователь уже состоит в команде этого турнира' });
        }

        // Проверка что нет активного приглашения
        const existingInvitation = await pool.query(
            'SELECT * FROM tournament_team_invitations WHERE team_id = $1 AND invited_user_id = $2 AND status = $3',
            [teamId, invitedUserId, 'pending']
        );

        if (existingInvitation.rows.length > 0) {
            return res.status(400).json({ error: 'Приглашение уже отправлено этому игроку' });
        }

        // Получаем информацию о команде
        const teamInfo = await pool.query(
            'SELECT name FROM tournament_teams WHERE id = $1',
            [teamId]
        );

        const teamName = teamInfo.rows[0]?.name || 'Команда';

        // Создаем приглашение
        const invitation = await pool.query(`
            INSERT INTO tournament_team_invitations 
                (tournament_id, team_id, inviter_id, invited_user_id, message, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING *
        `, [tournamentId, teamId, inviterId, invitedUserId, message]);

        // Создаем уведомление
        await pool.query(`
            INSERT INTO notifications (user_id, message, type, created_at)
            VALUES ($1, $2, $3, NOW())
        `, [
            invitedUserId,
            `Вас пригласили в команду "${teamName}" турнира "${tournament.name}"`,
            'tournament_team_invitation'
        ]);

        // Логируем событие
        await logTournamentEvent(parseInt(tournamentId), inviterId, 'team_invitation_sent', {
            teamId: parseInt(teamId),
            invitedUserId: invitedUserId,
            teamName: teamName
        });

        res.status(201).json({ 
            success: true,
            message: 'Приглашение отправлено',
            invitation: invitation.rows[0]
        });
    });

    /**
     * Получить входящие приглашения пользователя
     */
    static getMyInvitations = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const invitations = await pool.query(`
            SELECT 
                tti.*,
                t.name as tournament_name,
                t.game,
                t.start_date,
                tt.name as team_name,
                u.username as inviter_username,
                u.avatar_url as inviter_avatar
            FROM tournament_team_invitations tti
            JOIN tournaments t ON t.id = tti.tournament_id
            JOIN tournament_teams tt ON tt.id = tti.team_id
            JOIN users u ON u.id = tti.inviter_id
            WHERE tti.invited_user_id = $1 AND tti.status = 'pending'
            ORDER BY tti.created_at DESC
        `, [userId]);

        res.json({ 
            success: true,
            invitations: invitations.rows
        });
    });

    /**
     * Получить отправленные приглашения команды
     */
    static getTeamInvitations = asyncHandler(async (req, res) => {
        const { tournamentId, teamId } = req.params;
        const userId = req.user.id;

        // Проверка что пользователь - капитан команды
        const captainCheck = await pool.query(
            'SELECT * FROM tournament_team_members WHERE team_id = $1 AND user_id = $2 AND is_captain = true',
            [teamId, userId]
        );

        if (captainCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Только капитан может просматривать приглашения' });
        }

        const invitations = await pool.query(`
            SELECT 
                tti.*,
                u.username as invited_username,
                u.avatar_url as invited_avatar,
                u.faceit_elo,
                u.cs2_premier_rank
            FROM tournament_team_invitations tti
            JOIN users u ON u.id = tti.invited_user_id
            WHERE tti.team_id = $1
            ORDER BY 
                CASE tti.status 
                    WHEN 'pending' THEN 1
                    WHEN 'accepted' THEN 2
                    WHEN 'rejected' THEN 3
                    WHEN 'cancelled' THEN 4
                END,
                tti.created_at DESC
        `, [teamId]);

        res.json({ 
            success: true,
            invitations: invitations.rows
        });
    });

    /**
     * Принять приглашение в команду
     */
    static acceptInvitation = asyncHandler(async (req, res) => {
        const { invitationId } = req.params;
        const userId = req.user.id;

        // Получаем приглашение
        const invitation = await pool.query(
            'SELECT * FROM tournament_team_invitations WHERE id = $1 AND invited_user_id = $2',
            [invitationId, userId]
        );

        if (invitation.rows.length === 0) {
            return res.status(404).json({ error: 'Приглашение не найдено' });
        }

        const inv = invitation.rows[0];

        if (inv.status !== 'pending') {
            return res.status(400).json({ error: 'Приглашение уже обработано' });
        }

        // Проверка турнира
        const tournament = await TournamentRepository.getById(inv.tournament_id);
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир уже не активен' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Проверяем, не состоит ли уже в команде
            const memberCheck = await client.query(
                'SELECT * FROM tournament_team_members ttm JOIN tournament_participants tp ON ttm.participant_id = tp.id WHERE ttm.team_id = $1 AND tp.user_id = $2',
                [inv.team_id, userId]
            );

            if (memberCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Вы уже состоите в этой команде' });
            }

            // Проверяем лимит команды
            const teamSize = await client.query(
                'SELECT COUNT(*) as count FROM tournament_team_members WHERE team_id = $1',
                [inv.team_id]
            );

            const maxSize = tournament.team_size || 5;
            if (parseInt(teamSize.rows[0].count) >= maxSize) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Команда уже заполнена' });
            }

            // Создаем или получаем участника турнира
            let participant = await client.query(
                'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
                [inv.tournament_id, userId]
            );

            let participantId;

            if (participant.rows.length > 0) {
                participantId = participant.rows[0].id;
                
                // Проверяем что не в другой команде
                if (participant.rows[0].in_team) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Вы уже состоите в другой команде этого турнира' });
                }
            } else {
                // Создаем участника
                const newParticipant = await client.query(
                    'INSERT INTO tournament_participants (tournament_id, user_id, name) VALUES ($1, $2, $3) RETURNING id',
                    [inv.tournament_id, userId, req.user.username]
                );
                participantId = newParticipant.rows[0].id;
            }

            // Добавляем в команду
            await client.query(
                'INSERT INTO tournament_team_members (team_id, user_id, participant_id, is_captain) VALUES ($1, $2, $3, false)',
                [inv.team_id, userId, participantId]
            );

            // Обновляем флаг in_team
            await client.query(
                'UPDATE tournament_participants SET in_team = true WHERE id = $1',
                [participantId]
            );

            // Обновляем статус приглашения
            await client.query(
                'UPDATE tournament_team_invitations SET status = $1, responded_at = NOW(), updated_at = NOW() WHERE id = $2',
                ['accepted', invitationId]
            );

            await client.query('COMMIT');

            // Логируем событие
            await logTournamentEvent(inv.tournament_id, userId, 'team_invitation_accepted', {
                teamId: inv.team_id,
                invitationId: invitationId
            });

            res.json({ 
                success: true,
                message: 'Вы успешно вступили в команду!'
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Ошибка принятия приглашения:', error);
            throw error;
        } finally {
            client.release();
        }
    });

    /**
     * Отклонить приглашение
     */
    static rejectInvitation = asyncHandler(async (req, res) => {
        const { invitationId } = req.params;
        const userId = req.user.id;

        const invitation = await pool.query(
            'SELECT * FROM tournament_team_invitations WHERE id = $1 AND invited_user_id = $2',
            [invitationId, userId]
        );

        if (invitation.rows.length === 0) {
            return res.status(404).json({ error: 'Приглашение не найдено' });
        }

        if (invitation.rows[0].status !== 'pending') {
            return res.status(400).json({ error: 'Приглашение уже обработано' });
        }

        await pool.query(
            'UPDATE tournament_team_invitations SET status = $1, responded_at = NOW(), updated_at = NOW() WHERE id = $2',
            ['rejected', invitationId]
        );

        res.json({ 
            success: true,
            message: 'Приглашение отклонено'
        });
    });

    /**
     * Отменить приглашение (капитан)
     */
    static cancelInvitation = asyncHandler(async (req, res) => {
        const { invitationId } = req.params;
        const userId = req.user.id;

        const invitation = await pool.query(
            'SELECT * FROM tournament_team_invitations WHERE id = $1 AND inviter_id = $2',
            [invitationId, userId]
        );

        if (invitation.rows.length === 0) {
            return res.status(404).json({ error: 'Приглашение не найдено' });
        }

        if (invitation.rows[0].status !== 'pending') {
            return res.status(400).json({ error: 'Приглашение уже обработано' });
        }

        await pool.query(
            'UPDATE tournament_team_invitations SET status = $1, updated_at = NOW() WHERE id = $2',
            ['cancelled', invitationId]
        );

        res.json({ 
            success: true,
            message: 'Приглашение отменено'
        });
    });
}

module.exports = TeamInvitationController;

