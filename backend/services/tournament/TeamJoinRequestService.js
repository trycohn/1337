const TeamJoinRequestRepository = require('../../repositories/tournament/TeamJoinRequestRepository');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendSystemNotification } = require('../../utils/systemNotifications');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');

/**
 * Сервис для работы с запросами на вступление в команды
 */
class TeamJoinRequestService {
    /**
     * Создание запроса на вступление в команду
     */
    static async createJoinRequest(teamId, tournamentId, userId, username, message = null) {
        // Проверяем существование команды
        const team = await TeamRepository.getById(teamId);
        if (!team) {
            throw new Error('Команда не найдена');
        }

        if (team.tournament_id !== tournamentId) {
            throw new Error('Команда не принадлежит этому турниру');
        }

        // Проверяем, что турнир активен
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.status !== 'active') {
            throw new Error('Турнир неактивен');
        }

        // Проверяем, не является ли пользователь уже участником команды
        const isMember = await this._isTeamMember(teamId, userId);
        if (isMember) {
            throw new Error('Вы уже являетесь членом этой команды');
        }

        // Проверяем, нет ли уже pending запроса
        const hasPending = await TeamJoinRequestRepository.hasPendingRequest(teamId, userId);
        if (hasPending) {
            throw new Error('У вас уже есть активный запрос на вступление в эту команду');
        }

        // Создаем запрос
        const request = await TeamJoinRequestRepository.create({
            team_id: teamId,
            tournament_id: tournamentId,
            user_id: userId,
            message
        });

        // Отправляем уведомление капитану команды
        await this._notifyCaptain(team, userId, username, request.id, message);

        // Логируем событие
        await logTournamentEvent(tournamentId, userId, 'team_join_request_created', {
            team_id: teamId,
            team_name: team.name,
            request_id: request.id
        });

        return request;
    }

    /**
     * Принятие запроса на вступление
     */
    static async acceptJoinRequest(requestId, captainId, captainUsername) {
        const request = await TeamJoinRequestRepository.getById(requestId);
        
        if (!request) {
            throw new Error('Запрос не найден');
        }

        if (request.status !== 'pending') {
            throw new Error('Запрос уже обработан');
        }

        // Проверяем права капитана
        const hasAccess = await this._checkCaptainAccess(request.team_id, captainId);
        if (!hasAccess) {
            throw new Error('У вас нет прав для управления этой командой');
        }

        // Проверяем, что пользователь еще не в команде
        const isMember = await this._isTeamMember(request.team_id, request.user_id);
        if (isMember) {
            throw new Error('Пользователь уже является членом команды');
        }

        // Проверяем лимит команды
        const canJoin = await this._checkTeamLimit(request.team_id, request.tournament_id);
        if (!canJoin) {
            throw new Error('Команда достигла максимального количества участников');
        }

        // Принимаем запрос
        const accepted = await TeamJoinRequestRepository.accept(requestId, captainId);

        if (!accepted) {
            throw new Error('Не удалось принять запрос');
        }

        // Добавляем пользователя в команду
        await this._addUserToTeam(
            request.team_id, 
            request.tournament_id, 
            request.user_id, 
            request.user_username
        );

        // Уведомляем пользователя о принятии
        await sendSystemNotification(
            request.user_id,
            `✅ Ваш запрос на вступление в команду "${request.team_name}" был принят капитаном!`,
            'team_join_accepted',
            {
                team_id: request.team_id,
                team_name: request.team_name,
                tournament_id: request.tournament_id,
                tournament_name: request.tournament_name,
                accepted_by: captainUsername
            }
        );

        // Анонс в чат турнира
        await sendTournamentChatAnnouncement(
            request.tournament_id,
            `👥 ${request.user_username} присоединился к команде "${request.team_name}"!`
        );

        // Логируем событие
        await logTournamentEvent(request.tournament_id, captainId, 'team_join_request_accepted', {
            request_id: requestId,
            team_id: request.team_id,
            user_id: request.user_id,
            user_username: request.user_username
        });

        return accepted;
    }

    /**
     * Отклонение запроса на вступление
     */
    static async rejectJoinRequest(requestId, captainId, captainUsername) {
        const request = await TeamJoinRequestRepository.getById(requestId);
        
        if (!request) {
            throw new Error('Запрос не найден');
        }

        if (request.status !== 'pending') {
            throw new Error('Запрос уже обработан');
        }

        // Проверяем права капитана
        const hasAccess = await this._checkCaptainAccess(request.team_id, captainId);
        if (!hasAccess) {
            throw new Error('У вас нет прав для управления этой командой');
        }

        // Отклоняем запрос
        const rejected = await TeamJoinRequestRepository.reject(requestId, captainId);

        if (!rejected) {
            throw new Error('Не удалось отклонить запрос');
        }

        // Уведомляем пользователя об отклонении
        await sendSystemNotification(
            request.user_id,
            `❌ Ваш запрос на вступление в команду "${request.team_name}" был отклонен.`,
            'team_join_rejected',
            {
                team_id: request.team_id,
                team_name: request.team_name,
                tournament_id: request.tournament_id,
                rejected_by: captainUsername
            }
        );

        // Логируем событие
        await logTournamentEvent(request.tournament_id, captainId, 'team_join_request_rejected', {
            request_id: requestId,
            team_id: request.team_id,
            user_id: request.user_id
        });

        return rejected;
    }

    /**
     * Получение pending запросов для команды
     */
    static async getTeamPendingRequests(teamId, captainId) {
        // Проверяем права капитана
        const hasAccess = await this._checkCaptainAccess(teamId, captainId);
        if (!hasAccess) {
            throw new Error('У вас нет прав для просмотра запросов этой команды');
        }

        return await TeamJoinRequestRepository.getPendingByTeam(teamId);
    }

    /**
     * Получение запросов пользователя для турнира
     */
    static async getUserRequestsForTournament(userId, tournamentId) {
        return await TeamJoinRequestRepository.getByUserAndTournament(userId, tournamentId);
    }

    /**
     * Отмена запроса пользователем
     */
    static async cancelJoinRequest(requestId, userId) {
        const cancelled = await TeamJoinRequestRepository.cancel(requestId, userId);

        if (!cancelled) {
            throw new Error('Не удалось отменить запрос');
        }

        // Логируем событие
        await logTournamentEvent(cancelled.tournament_id, userId, 'team_join_request_cancelled', {
            request_id: requestId,
            team_id: cancelled.team_id
        });

        return cancelled;
    }

    /**
     * Проверка, является ли пользователь капитаном команды
     */
    static async _checkCaptainAccess(teamId, userId) {
        const team = await TeamRepository.getById(teamId);
        if (!team) return false;

        // Создатель команды всегда имеет доступ
        if (team.creator_id === userId) return true;

        // Проверяем, является ли администратором турнира
        const tournament = await TournamentRepository.getById(team.tournament_id);
        if (tournament.created_by === userId) return true;

        const admins = await TournamentRepository.getAdmins(team.tournament_id);
        return admins.some(admin => admin.user_id === userId);
    }

    /**
     * Проверка, является ли пользователь членом команды
     */
    static async _isTeamMember(teamId, userId) {
        const pool = require('../../db');
        const result = await pool.query(
            'SELECT id FROM tournament_team_members WHERE team_id = $1 AND user_id = $2',
            [teamId, userId]
        );
        return result.rows.length > 0;
    }

    /**
     * Проверка лимита команды
     */
    static async _checkTeamLimit(teamId, tournamentId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        const pool = require('../../db');
        
        const result = await pool.query(
            'SELECT COUNT(*) as count FROM tournament_team_members WHERE team_id = $1',
            [teamId]
        );

        const currentCount = parseInt(result.rows[0].count);
        const maxSize = this._getMaxTeamSize(tournament.participant_type);

        return currentCount < maxSize;
    }

    /**
     * Получение максимального размера команды
     */
    static _getMaxTeamSize(participantType) {
        const maxSizes = {
            'solo': 1,
            '2x2': 2,
            '3x3': 3,
            '5x5': 5
        };
        return maxSizes[participantType] || 10;
    }

    /**
     * Добавление пользователя в команду
     */
    static async _addUserToTeam(teamId, tournamentId, userId, username) {
        // Получаем или создаем участника турнира
        let participant = await ParticipantRepository.getUserParticipation(tournamentId, userId);
        
        if (!participant) {
            participant = await ParticipantRepository.create({
                tournament_id: tournamentId,
                user_id: userId,
                name: username
            });
        }

        // Добавляем в команду
        await TeamRepository.addMember(teamId, userId, participant.id);
    }

    /**
     * Отправка уведомления капитану команды
     */
    static async _notifyCaptain(team, requesterId, requesterUsername, requestId, message) {
        if (!team.creator_id) return;

        const baseUrl = process.env.PUBLIC_WEB_URL || process.env.SERVER_URL || 'https://1337community.com';
        
        let notificationMessage = `👥 Новый запрос на вступление в вашу команду "${team.name}"!\n\n`;
        notificationMessage += `**Игрок:** ${requesterUsername}\n`;
        
        if (message) {
            notificationMessage += `**Сообщение:** ${message}\n`;
        }

        const metadata = {
            type: 'team_join_request',
            team_id: team.id,
            team_name: team.name,
            tournament_id: team.tournament_id,
            requester_id: requesterId,
            requester_username: requesterUsername,
            request_id: requestId,
            actions: [
                {
                    type: 'accept',
                    label: '✅ Принять',
                    action: 'accept_team_join_request',
                    style: 'success',
                    endpoint: `/api/tournaments/${team.tournament_id}/teams/${team.id}/join-requests/${requestId}/accept`
                },
                {
                    type: 'reject',
                    label: '❌ Отклонить',
                    action: 'reject_team_join_request',
                    style: 'danger',
                    endpoint: `/api/tournaments/${team.tournament_id}/teams/${team.id}/join-requests/${requestId}/reject`
                }
            ]
        };

        await sendSystemNotification(
            team.creator_id,
            notificationMessage,
            'team_join_request',
            metadata
        );
    }
}

module.exports = TeamJoinRequestService;

