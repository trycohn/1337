const MixTeamService = require('../../services/tournament/MixTeamService');
const TournamentService = require('../../services/tournament/TournamentService');
const { asyncHandler } = require('../../utils/tournament/asyncHandler');
const { broadcastTournamentUpdate } = require('../../notifications');

class MixTeamController {
    /**
     * Генерация микс команд
     * POST /api/tournaments/:id/mix-generate-teams
     */
    static generateMixTeams = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const { ratingType = 'faceit', shuffle = false } = req.body;
        const userId = req.user.id;

        console.log(`🎯 [MixTeamController] Генерация микс команд для турнира ${tournamentId}`);

        // Проверяем права доступа
        const hasPermission = await TournamentService.checkUserPermission(tournamentId, userId, 'manage_teams');
        if (!hasPermission) {
            return res.status(403).json({ 
                error: 'Недостаточно прав для формирования команд' 
            });
        }

        // Проверяем, что турнир подходит для микс команд
        const tournament = await TournamentService.getTournament(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        if (tournament.format !== 'mix') {
            return res.status(400).json({ 
                error: 'Формирование команд доступно только для микс турниров' 
            });
        }

        if (tournament.status !== 'active') {
            return res.status(400).json({ 
                error: 'Формирование команд доступно только для активных турниров' 
            });
        }

        // Проверяем, не создана ли уже сетка
        const hasMatches = await TournamentService.hasMatches(tournamentId);
        if (hasMatches) {
            return res.status(400).json({ 
                error: 'Нельзя формировать команды после создания турнирной сетки' 
            });
        }

        try {
            // Генерируем команды
            const result = await MixTeamService.generateMixTeams(
                tournamentId, 
                userId, 
                ratingType, 
                shuffle
            );

            // Получаем обновленные данные турнира
            const updatedTournament = await TournamentService.getTournamentDetails(tournamentId);

            // Отправляем WebSocket обновления
            broadcastTournamentUpdate(tournamentId, updatedTournament);

            console.log(`✅ [MixTeamController] Успешно создано ${result.teams.length} команд`);

            res.status(200).json({
                success: true,
                message: `Успешно сформированы команды`,
                teams: result.teams,
                summary: result.summary,
                tournament: updatedTournament
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка генерации команд:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при формировании команд' 
            });
        }
    });

    /**
     * Переформирование микс команд (регенерация с теми же участниками)
     * POST /api/tournaments/:id/mix-regenerate-teams
     */
    static regenerateMixTeams = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const { ratingType = 'faceit', shuffle = true } = req.body;
        const userId = req.user.id;

        console.log(`🔄 [MixTeamController] Переформирование команд для турнира ${tournamentId}`);

        // Проверяем права доступа
        const hasPermission = await TournamentService.checkUserPermission(tournamentId, userId, 'manage_teams');
        if (!hasPermission) {
            return res.status(403).json({ 
                error: 'Недостаточно прав для переформирования команд' 
            });
        }

        try {
            // Переформировываем команды с перемешиванием
            const result = await MixTeamService.generateMixTeams(
                tournamentId, 
                userId, 
                ratingType, 
                shuffle
            );

            // Получаем обновленные данные турнира
            const updatedTournament = await TournamentService.getTournamentDetails(tournamentId);

            // Отправляем WebSocket обновления
            broadcastTournamentUpdate(tournamentId, updatedTournament);

            console.log(`✅ [MixTeamController] Команды переформированы: ${result.teams.length} команд`);

            res.status(200).json({
                success: true,
                message: `Команды успешно переформированы`,
                teams: result.teams,
                summary: result.summary,
                tournament: updatedTournament,
                isRegeneration: true
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка переформирования команд:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при переформировании команд' 
            });
        }
    });

    /**
     * Получение оригинальных участников турнира (разделенных на группы)
     * GET /api/tournaments/:id/original-participants
     */
    static getOriginalParticipants = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);

        console.log(`🔍 [MixTeamController] Получение оригинальных участников турнира ${tournamentId}`);

        try {
            const participantsData = await MixTeamService.getOriginalParticipants(tournamentId);

            console.log(`✅ [MixTeamController] Получено участников: ${participantsData.total} (в командах: ${participantsData.inTeamCount}, не в командах: ${participantsData.notInTeamCount})`);

            res.json(participantsData);

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка получения участников:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при получении участников' 
            });
        }
    });

    /**
     * Обновление размера команды для микс турнира
     * PATCH /api/tournaments/:id/team-size
     */
    static updateTeamSize = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const { teamSize } = req.body;
        const userId = req.user.id;

        console.log(`⚙️ [MixTeamController] Обновление размера команды для турнира ${tournamentId} на ${teamSize}`);

        if (!teamSize || ![2, 3, 4, 5].includes(parseInt(teamSize, 10))) {
            return res.status(400).json({ 
                error: 'Неверный размер команды. Допустимые значения: 2, 3, 4, 5' 
            });
        }

        // Проверяем права доступа
        const hasPermission = await TournamentService.checkUserPermission(tournamentId, userId, 'manage_settings');
        if (!hasPermission) {
            return res.status(403).json({ 
                error: 'Недостаточно прав для изменения настроек турнира' 
            });
        }

        try {
            // Получаем турнир и проверяем его статус
            const tournament = await TournamentService.getTournament(tournamentId);
            if (!tournament) {
                return res.status(404).json({ error: 'Турнир не найден' });
            }

            if (tournament.format !== 'mix') {
                return res.status(400).json({ 
                    error: 'Изменение размера команды доступно только для микс турниров' 
                });
            }

            if (!['active', 'pending'].includes(tournament.status)) {
                return res.status(400).json({ 
                    error: 'Изменение размера команды доступно только для турниров в статусе active или pending' 
                });
            }

            // Проверяем, не создана ли уже сетка
            const hasMatches = await TournamentService.hasMatches(tournamentId);
            if (hasMatches) {
                return res.status(400).json({ 
                    error: 'Нельзя изменить размер команды после создания турнирной сетки' 
                });
            }

            // Обновляем размер команды
            const updatedTournament = await TournamentService.updateTournament(tournamentId, {
                team_size: parseInt(teamSize, 10)
            }, userId);

            // Если есть команды, удаляем их (так как размер изменился)
            const hasTeams = await TournamentService.hasTeams(tournamentId);
            if (hasTeams) {
                console.log(`🗑️ [MixTeamController] Удаляем существующие команды из-за изменения размера`);
                // TODO: Добавить метод в TeamService для удаления команд
            }

            console.log(`✅ [MixTeamController] Размер команды обновлен на ${teamSize}`);

            res.status(200).json({
                success: true,
                message: `Размер команды успешно обновлен до ${teamSize}`,
                tournament: updatedTournament
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка обновления размера команды:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при обновлении размера команды' 
            });
        }
    });

    /**
     * Получение команд турнира с участниками
     * GET /api/tournaments/:id/teams
     */
    static getTeams = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);

        console.log(`🏆 [MixTeamController] Получение команд турнира ${tournamentId}`);

        try {
            const teams = await TournamentService.getTeamsWithMembers(tournamentId);

            console.log(`✅ [MixTeamController] Получено команд: ${teams.length}`);

            res.json(teams);

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка получения команд:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при получении команд турнира' 
            });
        }
    });
}

module.exports = MixTeamController; 