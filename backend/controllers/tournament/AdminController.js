const AdminService = require('../../services/tournament/AdminService');
const TournamentValidator = require('../../validators/tournament/TournamentValidator');
const { asyncHandler } = require('../../utils/asyncHandler');

class AdminController {
    // 🛡️ Запрос на администрирование турнира
    static requestAdmin = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        await AdminService.requestAdmin(parseInt(id), req.user.id, req.user.username);
        
        res.json({ message: 'Запрос на администрирование отправлен' });
    });

    // ✅ Ответ на запрос администрирования
    static respondToAdminRequest = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { requesterId, action } = req.body;
        
        const validationResult = TournamentValidator.validateAdminResponse({ requesterId, action });
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.errors });
        }
        
        await AdminService.respondToAdminRequest(
            parseInt(id),
            req.user.id,
            req.user.username,
            { requesterId, action }
        );
        
        res.json({ 
            message: `Запрос на администрирование ${action === 'accept' ? 'принят' : 'отклонён'}` 
        });
    });

    // 📊 Получение статуса запроса на администрирование
    static getAdminRequestStatus = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const status = await AdminService.getAdminRequestStatus(parseInt(id), req.user.id);
        
        res.json({ status });
    });

    // 📧 Приглашение администратора турнира
    static inviteAdmin = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { inviteeId } = req.body;
        
        const validationResult = TournamentValidator.validateAdminInvitation({ inviteeId });
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.errors });
        }
        
        const result = await AdminService.inviteAdmin(
            parseInt(id),
            req.user.id,
            inviteeId
        );
        
        res.status(201).json(result);
    });

    // 🗑️ Удаление администратора турнира
    static removeAdmin = asyncHandler(async (req, res) => {
        const { id, userId } = req.params;
        
        await AdminService.removeAdmin(
            parseInt(id),
            parseInt(userId),
            req.user.id
        );
        
        res.json({ message: 'Администратор успешно удален' });
    });

    // 🤝 Принятие приглашения администратора
    static acceptAdminInvitation = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const result = await AdminService.acceptAdminInvitation(
            parseInt(id),
            req.user.id
        );
        
        res.json(result);
    });

    // ❌ Отклонение приглашения администратора
    static declineAdminInvitation = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const result = await AdminService.declineAdminInvitation(
            parseInt(id),
            req.user.id
        );
        
        res.json(result);
    });

    // 🧹 Очистка истекших приглашений
    static cleanupExpiredInvitations = asyncHandler(async (req, res) => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                message: 'Доступ запрещен: требуются права администратора' 
            });
        }
        
        const result = await AdminService.cleanupExpiredInvitations();
        
        res.json(result);
    });

    // 📈 Статистика приглашений администраторов
    static getInvitationStats = asyncHandler(async (req, res) => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                message: 'Доступ запрещен: требуются права администратора' 
            });
        }
        
        const stats = await AdminService.getInvitationStats();
        
        res.json(stats);
    });
}

module.exports = AdminController; 