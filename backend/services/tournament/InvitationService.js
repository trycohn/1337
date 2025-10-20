const pool = require('../../db');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendNotification } = require('../../notifications');
const { sendTournamentInviteNotification } = require('../../utils/systemNotifications');

class InvitationService {
    /**
     * Приглашение пользователя в турнир
     */
    static async inviteToTournament(tournamentId, inviterId, inviterUsername, { username, email }) {
        console.log(`📧 InvitationService: Приглашение в турнир ${tournamentId} от ${inviterUsername}`);

        // Получаем турнир
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        // Проверяем права на отправку приглашений
        await this._checkInviteAccess(tournamentId, inviterId);

        if (tournament.status !== 'active') {
            throw new Error('Турнир неактивен');
        }

        if (!username && !email) {
            throw new Error('Укажите никнейм или email');
        }

        // Находим пользователя
        let user;
        if (username) {
            const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            if (result.rows.length === 0) {
                throw new Error('Пользователь с таким никнеймом не найден');
            }
            user = result.rows[0];
        } else if (email) {
            const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            if (result.rows.length === 0) {
                throw new Error('Пользователь с таким email не найден');
            }
            user = result.rows[0];
        }

        // Проверяем, не участвует ли уже пользователь в турнире
        const existingParticipant = await ParticipantRepository.getUserParticipation(tournamentId, user.id);
        if (existingParticipant) {
            throw new Error('Этот пользователь уже участвует в турнире');
        }

        // Проверяем, нет ли уже приглашения для этого пользователя
        const inviteCheck = await pool.query(
            'SELECT * FROM tournament_invitations WHERE tournament_id = $1 AND user_id = $2 AND status = $3',
            [tournamentId, user.id, 'pending']
        );
        if (inviteCheck.rows.length > 0) {
            throw new Error('Этот пользователь уже приглашен в турнир');
        }

        // Создаем приглашение
        const invitationResult = await pool.query(
            'INSERT INTO tournament_invitations (tournament_id, user_id, invited_by, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [tournamentId, user.id, inviterId, 'pending']
        );

        // 📧 ОТПРАВЛЯЕМ СООБЩЕНИЕ В ЧАТ ОТ СИСТЕМНОГО ПОЛЬЗОВАТЕЛЯ 1337community
        try {
            await sendTournamentInviteNotification(
                user.id, 
                tournament.name, 
                inviterUsername, 
                tournamentId
            );
            console.log(`✅ Сообщение-приглашение отправлено в чат пользователю ${user.username}`);
        } catch (chatError) {
            // Логируем ошибку, но не блокируем создание приглашения
            console.error(`⚠️ Ошибка при отправке сообщения в чат:`, chatError);
            console.error(`⚠️ Приглашение будет создано, но без сообщения в чате`);
        }

        // Отправляем уведомление приглашенному пользователю (в колокольчик)
        const isTeamTournament = tournament.participant_type === 'team';
        const notificationMessage = isTeamTournament 
            ? `Вы приглашены в командный турнир "${tournament.name}" пользователем ${inviterUsername}. Перейдите на страницу турнира и зарегистрируйте свою команду для участия.`
            : `Вы приглашены в турнир "${tournament.name}" пользователем ${inviterUsername}`;
        const notificationResult = await pool.query(
            'INSERT INTO notifications (user_id, message, type, tournament_id, invitation_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user.id, notificationMessage, 'tournament_invite', tournamentId, invitationResult.rows[0].id]
        );

        sendNotification(user.id, {
            id: notificationResult.rows[0].id,
            user_id: user.id,
            message: notificationMessage,
            type: 'tournament_invite',
            tournament_id: tournamentId,
            invitation_id: invitationResult.rows[0].id,
            created_at: new Date().toISOString(),
        });

        // Логируем событие
        await logTournamentEvent(tournamentId, inviterId, 'invitation_sent', {
            invitedUserId: user.id,
            invitedUsername: user.username,
            invitationId: invitationResult.rows[0].id
        });

        console.log('✅ InvitationService: Приглашение отправлено');
        return invitationResult.rows[0];
    }

    /**
     * Обработка приглашения (принятие/отклонение)
     */
    static async handleInvitation(tournamentId, userId, username, { action, invitation_id }) {
        console.log(`🤝 InvitationService: Обработка приглашения ${invitation_id} пользователем ${username}`);

        if (!['accept', 'reject'].includes(action)) {
            throw new Error('Неверное действие');
        }

        // Проверяем существование приглашения
        const invitationResult = await pool.query(
            'SELECT * FROM tournament_invitations WHERE id = $1 AND user_id = $2 AND tournament_id = $3 AND status = $4',
            [invitation_id, userId, tournamentId, 'pending']
        );
        
        if (invitationResult.rows.length === 0) {
            throw new Error('Приглашение не найдено или уже обработано');
        }

        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (action === 'accept') {
            // Принятие приглашения
            return await this._acceptInvitation(tournament, userId, username, invitation_id);
        } else {
            // Отклонение приглашения
            return await this._rejectInvitation(tournament, userId, username, invitation_id);
        }
    }

    /**
     * Принятие приглашения
     * @private
     */
    static async _acceptInvitation(tournament, userId, username, invitation_id) {
        console.log(`✅ InvitationService: Принятие приглашения ${invitation_id}`);

        // Проверяем, не участвует ли уже пользователь
        const existingParticipant = await ParticipantRepository.getUserParticipation(tournament.id, userId);
        if (existingParticipant) {
            throw new Error('Вы уже участвуете в этом турнире');
        }

        // Получаем рейтинги пользователя
        const userResult = await pool.query('SELECT faceit_elo, cs2_premier_rank FROM users WHERE id = $1', [userId]);
        const userRatings = userResult.rows[0] || {};

        // Добавляем участника в зависимости от типа турнира
        if (tournament.format === 'mix') {
            // Микс-турнир: добавляем как индивидуального игрока
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name, in_team, faceit_elo, cs2_premier_rank) VALUES ($1, $2, $3, $4, $5, $6)',
                [tournament.id, userId, username, false, userRatings.faceit_elo || null, userRatings.cs2_premier_rank || null]
            );
        } else if (tournament.participant_type === 'solo') {
            // Соло-турнир
            await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name, faceit_elo, cs2_premier_rank) VALUES ($1, $2, $3, $4, $5)',
                [tournament.id, userId, username, userRatings.faceit_elo || null, userRatings.cs2_premier_rank || null]
            );
        } else {
            // Командный турнир: создаем команду
            const teamResult = await pool.query(
                'INSERT INTO tournament_teams (tournament_id, name, creator_id) VALUES ($1, $2, $3) RETURNING id',
                [tournament.id, `${username}'s Team`, userId]
            );
            
            const participantResult = await pool.query(
                'INSERT INTO tournament_participants (tournament_id, user_id, name) VALUES ($1, $2, $3) RETURNING id',
                [tournament.id, userId, username]
            );
            
            await pool.query(
                'INSERT INTO tournament_team_members (team_id, user_id, participant_id) VALUES ($1, $2, $3)',
                [teamResult.rows[0].id, userId, participantResult.rows[0].id]
            );
        }

        // Обновляем статус приглашения
        await pool.query(
            'UPDATE tournament_invitations SET status = $1 WHERE id = $2',
            ['accepted', invitation_id]
        );

        // Отправляем уведомление создателю турнира
        const creatorNotificationMessage = `Пользователь ${username} принял приглашение в турнир "${tournament.name}"`;
        await pool.query(
            'INSERT INTO notifications (user_id, message, type, tournament_id, invitation_id) VALUES ($1, $2, $3, $4, $5)',
            [tournament.created_by, creatorNotificationMessage, 'invitation_accepted', tournament.id, invitation_id]
        );
        
        sendNotification(tournament.created_by, {
            user_id: tournament.created_by,
            message: creatorNotificationMessage,
            type: 'invitation_accepted',
            tournament_id: tournament.id,
            invitation_id: invitation_id,
            created_at: new Date().toISOString(),
        });

        // Логируем событие
        await logTournamentEvent(tournament.id, userId, 'invitation_accepted', {
            invitationId: invitation_id,
            participantType: tournament.participant_type
        });

        console.log('✅ InvitationService: Приглашение принято');
        return { message: 'Вы успешно присоединились к турниру' };
    }

    /**
     * Отклонение приглашения
     * @private
     */
    static async _rejectInvitation(tournament, userId, username, invitation_id) {
        console.log(`❌ InvitationService: Отклонение приглашения ${invitation_id}`);

        // Обновляем статус приглашения
        await pool.query(
            'UPDATE tournament_invitations SET status = $1 WHERE id = $2',
            ['rejected', invitation_id]
        );

        // Отправляем уведомление создателю турнира
        const creatorNotificationMessage = `Пользователь ${username} отклонил приглашение в турнир "${tournament.name}"`;
        await pool.query(
            'INSERT INTO notifications (user_id, message, type, tournament_id, invitation_id) VALUES ($1, $2, $3, $4, $5)',
            [tournament.created_by, creatorNotificationMessage, 'invitation_rejected', tournament.id, invitation_id]
        );
        
        sendNotification(tournament.created_by, {
            user_id: tournament.created_by,
            message: creatorNotificationMessage,
            type: 'invitation_rejected',
            tournament_id: tournament.id,
            invitation_id: invitation_id,
            created_at: new Date().toISOString(),
        });

        // Логируем событие
        await logTournamentEvent(tournament.id, userId, 'invitation_rejected', {
            invitationId: invitation_id
        });

        console.log('✅ InvitationService: Приглашение отклонено');
        return { message: 'Приглашение отклонено' };
    }

    /**
     * Проверка прав на отправку приглашений
     * @private
     */
    static async _checkInviteAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (!isAdmin) {
                throw new Error('Только создатель или администратор может отправлять приглашения');
            }
        }
    }
}

module.exports = InvitationService; 