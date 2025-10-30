const { asyncHandler } = require('../../utils/asyncHandler');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { broadcastTournamentUpdate } = require('../../notifications');

/**
 * Контроллер для управления командами турнира
 */
class TeamManagementController {
    /**
     * Переименование команды в турнире (только для организатора)
     * PUT /api/tournaments/:tournamentId/teams/:teamId/rename
     */
    static renameTeam = asyncHandler(async (req, res) => {
        const { tournamentId, teamId } = req.params;
        const { newName } = req.body;

        if (!newName || !newName.trim()) {
            return res.status(400).json({ error: 'Укажите новое название команды' });
        }

        if (newName.trim().length > 50) {
            return res.status(400).json({ error: 'Название команды не должно превышать 50 символов' });
        }

        // Проверяем права доступа (создатель или админ турнира)
        const tournament = await TournamentRepository.getById(parseInt(tournamentId));
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        const isCreator = tournament.created_by === req.user.id;
        const admins = await TournamentRepository.getAdmins(parseInt(tournamentId));
        const isAdmin = admins.some(admin => admin.user_id === req.user.id);

        if (!isCreator && !isAdmin) {
            return res.status(403).json({ error: 'Только создатель или администратор турнира может переименовывать команды' });
        }

        // Проверяем, что команда принадлежит этому турниру
        const team = await TeamRepository.getById(parseInt(teamId));
        if (!team) {
            return res.status(404).json({ error: 'Команда не найдена' });
        }

        if (team.tournament_id !== parseInt(tournamentId)) {
            return res.status(400).json({ error: 'Команда не принадлежит этому турниру' });
        }

        // Переименовываем команду
        const pool = require('../../db');
        const result = await pool.query(
            'UPDATE tournament_teams SET name = $1 WHERE id = $2 RETURNING *',
            [newName.trim(), parseInt(teamId)]
        );

        // Логируем событие
        await logTournamentEvent(
            parseInt(tournamentId),
            req.user.id,
            'team_renamed',
            {
                team_id: parseInt(teamId),
                old_name: team.name,
                new_name: newName.trim(),
                renamed_by: req.user.username
            }
        );

        // Отправляем обновление через WebSocket
        const updatedTournament = await TournamentRepository.getByIdWithCreator(parseInt(tournamentId));
        broadcastTournamentUpdate(parseInt(tournamentId), updatedTournament, 'team_renamed');

        res.json({
            success: true,
            team: result.rows[0],
            message: 'Название команды обновлено'
        });
    });
}

module.exports = TeamManagementController;

