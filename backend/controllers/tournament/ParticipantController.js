const ParticipantService = require('../../services/tournament/ParticipantService');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
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

    // 👥 Ручное добавление незарегистрированной команды с игроками (для командных турниров)
    static addTeamWithPlayers = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { teamName, players } = req.body;
        
        // Валидация
        if (!teamName || !teamName.trim()) {
            return res.status(400).json({ error: 'Укажите название команды' });
        }

        const tournamentId = parseInt(id);
        if (isNaN(tournamentId)) {
            return res.status(400).json({ error: 'Неверный ID турнира' });
        }

        // Проверяем турнир
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Проверяем что турнир командный
        if (tournament.participant_type !== 'team') {
            return res.status(400).json({ error: 'Этот метод работает только для командных турниров' });
        }

        // Проверяем права доступа (создатель или администратор)
        const isCreator = tournament.created_by === req.user.id;
        if (!isCreator) {
            const pool = require('../../db');
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, req.user.id]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может добавлять команды' });
            }
        }

        // Проверяем, что турнир активен (не началась сетка)
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Турнир неактивен' });
        }

        // Проверяем, не сгенерирована ли уже сетка
        const pool = require('../../db');
        const matchesCheck = await pool.query(
            'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
            [tournamentId]
        );
        if (parseInt(matchesCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Нельзя добавлять команды после генерации сетки' });
        }

        // Создаем команду
        const teamResult = await pool.query(
            'INSERT INTO tournament_teams (tournament_id, name, creator_id) VALUES ($1, $2, $3) RETURNING id',
            [tournamentId, teamName.trim(), null] // creator_id = null для незарегистрированных команд
        );

        const teamId = teamResult.rows[0].id;

        // Добавляем игроков команды, если они указаны
        if (players && Array.isArray(players) && players.length > 0) {
            for (const playerNick of players) {
                if (playerNick && playerNick.trim()) {
                    // Создаем незарегистрированного участника для каждого игрока
                    await pool.query(
                        'INSERT INTO tournament_participants (tournament_id, user_id, name, team_id, in_team) VALUES ($1, $2, $3, $4, $5)',
                        [tournamentId, null, playerNick.trim(), teamId, true]
                    );
                }
            }
        }

        // Логируем событие
        await logTournamentEvent(tournamentId, req.user.id, 'team_added', {
            teamId,
            teamName: teamName.trim(),
            playersCount: players?.length || 0
        });

        res.json({ 
            success: true,
            message: 'Команда успешно добавлена',
            teamId,
            teamName: teamName.trim()
        });
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

    // ✏️ Обновление имени незарегистрированного участника (только для admin/creator)
    static updateParticipantName = asyncHandler(async (req, res) => {
        const { id, participantId } = req.params;
        const { name } = req.body || {};

        // Валидации
        const idCheck = TournamentValidator.validateTournamentId(id);
        if (!idCheck.isValid) return res.status(400).json({ error: idCheck.errors.join(', ') });

        const pId = parseInt(participantId);
        if (isNaN(pId) || pId <= 0) return res.status(400).json({ error: 'Неверный ID участника' });

        const nameCheck = TournamentValidator.validateString(name, 'Имя участника', true, 2, 50);
        if (!nameCheck.isValid) return res.status(400).json({ error: nameCheck.errors.join(', ') });

        // Проверяем турнир и участника
        const tournamentId = idCheck.value;
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) return res.status(404).json({ error: 'Турнир не найден' });

        const participant = await ParticipantRepository.getById(pId);
        if (!participant || participant.tournament_id !== tournamentId) {
            return res.status(404).json({ error: 'Участник не найден в данном турнире' });
        }

        // Разрешаем изменять только незарегистрированным (добавленным вручную) — без user_id
        if (participant.user_id) {
            return res.status(400).json({ error: 'Нельзя изменить имя у зарегистрированного пользователя' });
        }

        // Обновляем имя
        const updated = await ParticipantRepository.update(pId, { name: nameCheck.value });

        // Лог и WS-оповещение
        await logTournamentEvent(tournamentId, req.user.id, 'participant_name_updated', {
            participantId: pId,
            oldName: participant.name,
            newName: nameCheck.value
        });

        await ParticipantService._broadcastParticipantUpdate(tournamentId, 'updated', updated, req.user.id);

        return res.json({ success: true, participant: updated });
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