const InviteService = require('../../services/tournament/InviteService');
const { asyncHandler } = require('../../utils/asyncHandler');

/**
 * Контроллер для работы с инвайт-ссылками турниров
 */
class InviteController {
    /**
     * Создание новой инвайт-ссылки
     * POST /api/tournaments/:id/invites
     */
    static createInvite = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { max_uses, expires_in_days } = req.body;

        const invite = await InviteService.createInvite(
            parseInt(id),
            req.user.id,
            { max_uses, expires_in_days }
        );

        res.status(201).json({
            success: true,
            invite,
            invite_url: `${process.env.PUBLIC_WEB_URL || 'https://1337community.com'}/tournaments/invite/${invite.invite_code}`
        });
    });

    /**
     * Получение инвайта по коду
     * GET /api/tournaments/invites/:code
     */
    static getInviteByCode = asyncHandler(async (req, res) => {
        const { code } = req.params;

        const result = await InviteService.getInviteByCode(code);

        if (!result.valid) {
            const errorMessages = {
                'INVITE_NOT_FOUND': 'Приглашение не найдено',
                'INVITE_INACTIVE': 'Приглашение деактивировано',
                'INVITE_EXPIRED': 'Срок действия приглашения истек',
                'INVITE_MAX_USES_REACHED': 'Достигнуто максимальное количество использований',
                'TOURNAMENT_NOT_ACTIVE': 'Турнир неактивен'
            };

            return res.status(400).json({
                valid: false,
                error: errorMessages[result.reason] || 'Приглашение недействительно',
                reason: result.reason
            });
        }

        res.json({
            valid: true,
            tournament: {
                id: result.invite.tournament_id,
                name: result.invite.tournament_name,
                participant_type: result.invite.participant_type,
                access_type: result.invite.access_type
            }
        });
    });

    /**
     * Использование инвайта (только валидация)
     * POST /api/tournaments/invites/:code/use
     */
    static useInvite = asyncHandler(async (req, res) => {
        const { code } = req.params;

        const result = await InviteService.useInvite(
            code,
            req.user.id,
            req.user.username,
            req.ip
        );

        res.json({
            success: true,
            tournament: result.tournament
        });
    });

    /**
     * Подтверждение использования инвайта (после успешного вступления)
     * POST /api/tournaments/invites/:code/confirm
     */
    static confirmInviteUse = asyncHandler(async (req, res) => {
        const { code } = req.params;

        const result = await InviteService.confirmInviteUse(
            code,
            req.user.id,
            req.ip
        );

        res.json({
            success: result.success
        });
    });

    /**
     * Получение всех инвайтов турнира
     * GET /api/tournaments/:id/invites
     */
    static getTournamentInvites = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const invites = await InviteService.getTournamentInvites(
            parseInt(id),
            req.user.id
        );

        res.json({
            success: true,
            invites
        });
    });

    /**
     * Деактивация инвайта
     * PUT /api/tournaments/:tournamentId/invites/:inviteId/deactivate
     */
    static deactivateInvite = asyncHandler(async (req, res) => {
        const { inviteId } = req.params;

        const invite = await InviteService.deactivateInvite(
            parseInt(inviteId),
            req.user.id
        );

        res.json({
            success: true,
            invite
        });
    });

    /**
     * Удаление инвайта
     * DELETE /api/tournaments/:tournamentId/invites/:inviteId
     */
    static deleteInvite = asyncHandler(async (req, res) => {
        const { inviteId } = req.params;

        await InviteService.deleteInvite(
            parseInt(inviteId),
            req.user.id
        );

        res.json({
            success: true,
            message: 'Приглашение удалено'
        });
    });
}

module.exports = InviteController;
