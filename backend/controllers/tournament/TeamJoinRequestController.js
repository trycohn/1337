const TeamJoinRequestService = require('../../services/tournament/TeamJoinRequestService');
const { asyncHandler } = require('../../utils/asyncHandler');

/**
 * Контроллер для работы с запросами на вступление в команды
 */
class TeamJoinRequestController {
    /**
     * Создание запроса на вступление в команду
     * POST /api/tournaments/:tournamentId/teams/:teamId/join-requests
     */
    static createJoinRequest = asyncHandler(async (req, res) => {
        const { tournamentId, teamId } = req.params;
        const { message } = req.body;

        const request = await TeamJoinRequestService.createJoinRequest(
            parseInt(teamId),
            parseInt(tournamentId),
            req.user.id,
            req.user.username,
            message
        );

        res.status(201).json({
            success: true,
            request,
            message: 'Запрос на вступление отправлен капитану команды'
        });
    });

    /**
     * Принятие запроса на вступление
     * POST /api/tournaments/:tournamentId/teams/:teamId/join-requests/:requestId/accept
     */
    static acceptJoinRequest = asyncHandler(async (req, res) => {
        const { requestId } = req.params;

        const request = await TeamJoinRequestService.acceptJoinRequest(
            parseInt(requestId),
            req.user.id,
            req.user.username
        );

        res.json({
            success: true,
            request,
            message: 'Игрок добавлен в команду'
        });
    });

    /**
     * Отклонение запроса на вступление
     * POST /api/tournaments/:tournamentId/teams/:teamId/join-requests/:requestId/reject
     */
    static rejectJoinRequest = asyncHandler(async (req, res) => {
        const { requestId } = req.params;

        const request = await TeamJoinRequestService.rejectJoinRequest(
            parseInt(requestId),
            req.user.id,
            req.user.username
        );

        res.json({
            success: true,
            request,
            message: 'Запрос отклонен'
        });
    });

    /**
     * Получение pending запросов для команды
     * GET /api/tournaments/:tournamentId/teams/:teamId/join-requests
     */
    static getTeamPendingRequests = asyncHandler(async (req, res) => {
        const { teamId } = req.params;

        const requests = await TeamJoinRequestService.getTeamPendingRequests(
            parseInt(teamId),
            req.user.id
        );

        res.json({
            success: true,
            requests
        });
    });

    /**
     * Получение запросов пользователя для турнира
     * GET /api/tournaments/:tournamentId/my-join-requests
     */
    static getUserRequests = asyncHandler(async (req, res) => {
        const { tournamentId } = req.params;

        const requests = await TeamJoinRequestService.getUserRequestsForTournament(
            req.user.id,
            parseInt(tournamentId)
        );

        res.json({
            success: true,
            requests
        });
    });

    /**
     * Отмена запроса пользователем
     * DELETE /api/tournaments/:tournamentId/teams/:teamId/join-requests/:requestId
     */
    static cancelJoinRequest = asyncHandler(async (req, res) => {
        const { requestId } = req.params;

        await TeamJoinRequestService.cancelJoinRequest(
            parseInt(requestId),
            req.user.id
        );

        res.json({
            success: true,
            message: 'Запрос отменен'
        });
    });
}

module.exports = TeamJoinRequestController;

