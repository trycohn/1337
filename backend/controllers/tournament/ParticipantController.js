const ParticipantService = require('../../services/tournament/ParticipantService');
const InvitationService = require('../../services/tournament/InvitationService');
const TournamentValidator = require('../../validators/tournament/TournamentValidator');
const { asyncHandler } = require('../../utils/asyncHandler');

class ParticipantController {
    // ➕ Участие в турнире
    static participateInTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { teamId, newTeamName } = req.body;
        
        try {
            await ParticipantService.participateInTournament(
                parseInt(id), 
                req.user.id, 
                req.user.username,
                { teamId, newTeamName }
            );
        } catch (err) {
            const code = err.code;
            if (code === 'FACEIT_LINK_REQUIRED' || code === 'STEAM_LINK_REQUIRED') {
                return res.status(400).json({ error: err.message, code });
            }
            throw err;
        }
        
        res.json({ message: 'Вы успешно зарегистрированы в турнире' });
    });

    // 🚪 Отказ от участия в турнире
    static withdrawFromTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const result = await ParticipantService.withdrawFromTournament(
            parseInt(id), 
            req.user.id,
            req.user.username
        );
        
        res.json({ message: result.message });
    });

    // 👤 Ручное добавление участника
    static addParticipant = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { participantName, userId, faceit_elo, cs2_premier_rank } = req.body;
        
        const validationResult = TournamentValidator.validateAddParticipant(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.errors });
        }
        
        await ParticipantService.addParticipant(
            parseInt(id),
            req.user.id,
            { participantName, userId, faceit_elo, cs2_premier_rank }
        );
        
        res.json({ message: 'Участник успешно добавлен' });
    });

    // 🗑️ Удаление участника
    static removeParticipant = asyncHandler(async (req, res) => {
        const { id, participantId } = req.params;
        
        const result = await ParticipantService.removeParticipant(
            parseInt(id),
            parseInt(participantId),
            req.user.id,
            req.user.username
        );
        
        res.json(result);
    });

    // 📧 Отправка приглашения в турнир
    static inviteToTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { username, email } = req.body;
        
        const validationResult = TournamentValidator.validateInvitation(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.errors });
        }
        
        await InvitationService.inviteToTournament(
            parseInt(id),
            req.user.id,
            req.user.username,
            { username, email }
        );
        
        res.json({ message: 'Приглашение отправлено' });
    });

    // 🤝 Обработка приглашения
    static handleInvitation = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { action, invitation_id } = req.body;
        
        const result = await InvitationService.handleInvitation(
            parseInt(id),
            req.user.id,
            req.user.username,
            { action, invitation_id }
        );
        
        res.json({ message: result.message });
    });

    // 🎲 Генерация команд для микс-турнира
    static generateMixTeams = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { ratingType = 'faceit' } = req.body;
        
        const result = await ParticipantService.generateMixTeams(
            parseInt(id),
            req.user.id,
            req.user.username,
            ratingType
        );
        
        res.json(result);
    });
}

module.exports = ParticipantController; 