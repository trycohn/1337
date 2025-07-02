const MixTeamService = require('../../services/tournament/MixTeamService');
const TournamentService = require('../../services/tournament/TournamentService');
const BracketService = require('../../services/tournament/BracketService');
const { asyncHandler } = require('../../utils/tournament/asyncHandler');
const { broadcastTournamentUpdate } = require('../../notifications');
const { TournamentValidator } = require('../../utils/tournament/TournamentValidator');
const MatchService = require('../../services/tournament/MatchService');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');

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
     * Переформирование микс команд с удалением сетки если она есть
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

        // Проверяем турнир
        const tournament = await TournamentService.getTournament(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        if (tournament.format !== 'mix') {
            return res.status(400).json({ 
                error: 'Переформирование команд доступно только для микс турниров' 
            });
        }

        // 🆕 ОБНОВЛЕННАЯ ЛОГИКА: разрешаем переформирование только для активных турниров
        if (tournament.status !== 'active') {
            return res.status(400).json({ 
                error: 'Переформирование команд доступно только для активных турниров' 
            });
        }

        try {
            // 🆕 ПРОВЕРЯЕМ ЕСТЬ ЛИ СЕТКА И УДАЛЯЕМ ЕЁ ПЕРЕД ПЕРЕФОРМИРОВАНИЕМ
            const hasMatches = await TournamentService.hasMatches(tournamentId);
            if (hasMatches) {
                console.log(`🗑️ [MixTeamController] Удаляем существующую сетку перед переформированием команд`);
                
                // Удаляем все матчи турнира
                await BracketService.clearBracket(tournamentId, userId);
                
                console.log(`✅ [MixTeamController] Сетка удалена, продолжаем переформирование команд`);
            }

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
                message: hasMatches ? 
                    `Команды успешно переформированы. Турнирная сетка была удалена и должна быть создана заново.` :
                    `Команды успешно переформированы`,
                teams: result.teams,
                summary: result.summary,
                tournament: updatedTournament,
                isRegeneration: true,
                bracketDeleted: hasMatches
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка переформирования команд:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при переформировании команд' 
            });
        }
    });

    /**
     * 🎯 ГЕНЕРАЦИЯ КОМАНД (обновлено для нового алгоритма)
     */
    static formTeams = asyncHandler(async (req, res) => {
        console.log(`🚀 [MixTeamController.formTeams] Начинаем формирование команд для турнира ${req.params.id}`);
        console.log(`📊 Параметры запроса:`, req.body);
        
        const tournamentId = parseInt(req.params.id);
        const userId = req.user.id;
        const { ratingType = 'faceit', teamSize } = req.body;
        
        // Валидация входных данных (передаем все необходимые параметры)
        const validationResult = TournamentValidator.validateFormTeamsRequest({
            tournamentId,
            userId,
            ratingType,
            teamSize
        });
        
        if (!validationResult.isValid) {
            console.log(`❌ Валидация не пройдена:`, validationResult.errors);
            return res.status(400).json({ 
                error: 'Ошибка валидации',
                details: validationResult.errors 
            });
        }
        
        try {
            // Проверяем права доступа
            const hasPermission = await TournamentService.checkUserPermission(tournamentId, userId, 'manage_teams');
            if (!hasPermission) {
                return res.status(403).json({ 
                    error: 'Недостаточно прав для формирования команд' 
                });
            }
            
            // Получаем турнир и проверяем что это микс турнир
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
            
            // Проверяем что сетка еще не сгенерирована
            const matches = await MatchService.getMatchesByTournament(tournamentId);
            if (matches && matches.length > 0) {
                return res.status(400).json({ 
                    error: 'Нельзя формировать команды после генерации турнирной сетки' 
                });
            }
            
            console.log(`✅ Все проверки пройдены, запускаем новый алгоритм формирования команд`);
            
            // 🆕 ИСПОЛЬЗУЕМ НОВЫЙ УЛУЧШЕННЫЙ АЛГОРИТМ (без передачи ratingType)
            const result = await MixTeamService.generateTeams(tournamentId);
            
            // Логируем событие
            await logTournamentEvent(tournamentId, userId, 'mix_teams_generated', {
                teamsCount: result.teams.length,
                participantsCount: result.summary.participantsInTeams,
                ratingType: result.summary.ratingType,
                algorithm: result.summary.algorithm,
                balance: result.summary.balance,
                duration: result.summary.duration
            });
            
            // Отправляем объявление в чат
            await sendTournamentChatAnnouncement(
                tournamentId,
                `🏆 Сформированы микс команды с новым алгоритмом! Создано ${result.teams.length} команд из ${result.summary.participantsInTeams} участников. Баланс команд: ${result.summary.balance.percentage}% (${result.summary.balance.isGood ? 'отличный' : 'требует улучшения'})`
            );
            
            console.log(`🎉 [MixTeamController.formTeams] Команды успешно сформированы за ${result.summary.duration}ms`);
            
            res.status(200).json({
                success: true,
                message: `Команды успешно сформированы с использованием ${result.summary.algorithm === 'optimal_pairs' ? 'оптимального попарного' : 'умной змейки'} алгоритма`,
                teams: result.teams,
                summary: result.summary
            });
            
        } catch (error) {
            console.error(`❌ [MixTeamController.formTeams] Ошибка:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при формировании команд',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });

    /**
     * 🔄 ПЕРЕФОРМИРОВАНИЕ КОМАНД (обновлено для нового алгоритма)
     */
    static regenerateTeams = asyncHandler(async (req, res) => {
        console.log(`🔄 [MixTeamController.regenerateTeams] Переформирование команд для турнира ${req.params.id}`);
        
        const tournamentId = parseInt(req.params.id);
        const { shuffle = true } = req.body;
        const userId = req.user.id;
        
        try {
            // Проверяем права доступа
            const hasPermission = await TournamentService.checkUserPermission(tournamentId, userId, 'manage_teams');
            if (!hasPermission) {
                return res.status(403).json({ 
                    error: 'Недостаточно прав для переформирования команд' 
                });
            }
            
            // Получаем турнир
            const tournament = await TournamentService.getTournament(tournamentId);
            if (!tournament) {
                return res.status(404).json({ error: 'Турнир не найден' });
            }
            
            if (tournament.format !== 'mix') {
                return res.status(400).json({ 
                    error: 'Переформирование доступно только для микс турниров' 
                });
            }
            
            if (tournament.status !== 'active') {
                return res.status(400).json({ 
                    error: 'Переформирование доступно только для активных турниров' 
                });
            }
            
            // Проверяем наличие существующих команд
            const existingTeams = await TeamRepository.getByTournamentId(tournamentId);
            if (!existingTeams || existingTeams.length === 0) {
                return res.status(400).json({ 
                    error: 'Нет команд для переформирования. Сначала сформируйте команды.' 
                });
            }
            
            console.log(`📊 Найдено ${existingTeams.length} существующих команд для переформирования`);
            
            // Проверяем и удаляем турнирную сетку если она есть
            let bracketDeleted = false;
            const matches = await MatchService.getMatchesByTournament(tournamentId);
            if (matches && matches.length > 0) {
                console.log(`🗑️ Удаляем существующую турнирную сетку (${matches.length} матчей)`);
                await BracketService.clearBracket(tournamentId);
                bracketDeleted = true;
            }
            
            // 🆕 ИСПОЛЬЗУЕМ НОВЫЙ УЛУЧШЕННЫЙ АЛГОРИТМ ДЛЯ ПЕРЕФОРМИРОВАНИЯ (без ratingType)
            console.log(`🎯 Запускаем переформирование с новым алгоритмом (shuffle: ${shuffle})`);
            const result = await MixTeamService.generateTeams(tournamentId);
            
            // Логируем событие переформирования
            await logTournamentEvent(tournamentId, userId, 'mix_teams_regenerated', {
                previousTeamsCount: existingTeams.length,
                newTeamsCount: result.teams.length,
                participantsCount: result.summary.participantsInTeams,
                ratingType: result.summary.ratingType,
                algorithm: result.summary.algorithm,
                balance: result.summary.balance,
                bracketDeleted: bracketDeleted,
                shuffle: shuffle,
                duration: result.summary.duration
            });
            
            // Отправляем объявление в чат
            let chatMessage = `🔄 Команды переформированы с новым алгоритмом! Создано ${result.teams.length} команд из ${result.summary.participantsInTeams} участников. Баланс: ${result.summary.balance.percentage}%`;
            if (bracketDeleted) {
                chatMessage += '. ⚠️ Турнирная сетка была удалена - требуется повторная генерация.';
            }
            
            await sendTournamentChatAnnouncement(tournamentId, chatMessage);
            
            console.log(`🎉 [MixTeamController.regenerateTeams] Команды успешно переформированы за ${result.summary.duration}ms`);
            
            res.status(200).json({
                success: true,
                message: bracketDeleted 
                    ? 'Команды переформированы, турнирная сетка удалена. Необходимо заново сгенерировать сетку.'
                    : 'Команды успешно переформированы',
                teams: result.teams,
                summary: result.summary,
                bracketDeleted: bracketDeleted
            });
            
        } catch (error) {
            console.error(`❌ [MixTeamController.regenerateTeams] Ошибка:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при переформировании команд',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

            // Используем специальный метод для обновления размера команды
            const updatedTournament = await TournamentService.updateTeamSize(tournamentId, teamSize, userId);

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
            const teams = await TournamentService.getTeams(tournamentId);

            console.log(`✅ [MixTeamController] Получено команд: ${teams.length}`);

            res.json(teams);

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка получения команд:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при получении команд турнира' 
            });
        }
    });

    /**
     * Проверка баланса команд
     * POST /api/tournaments/:id/mix-balance-check
     */
    static checkTeamBalance = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const { ratingType = 'faceit' } = req.body;

        console.log(`⚖️ [MixTeamController] Проверка баланса команд турнира ${tournamentId}`);

        try {
            const teams = await TournamentService.getTeams(tournamentId);
            
            if (teams.length === 0) {
                return res.status(400).json({ 
                    error: 'В турнире нет команд для проверки баланса' 
                });
            }

            // Используем метод из MixTeamService для проверки баланса
            const balanceCheck = MixTeamService.checkTeamBalance(teams, ratingType);

            console.log(`✅ [MixTeamController] Баланс проверен: ${Math.round(balanceCheck.percentageDiff)}%`);

            res.json({
                success: true,
                balanceCheck,
                teams: teams.length,
                message: balanceCheck.isBalanced ? 
                    `Команды сбалансированы (расхождение: ${Math.round(balanceCheck.percentageDiff)}%)` :
                    `Команды не сбалансированы (расхождение: ${Math.round(balanceCheck.percentageDiff)}%)`
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка проверки баланса:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при проверке баланса команд' 
            });
        }
    });

    /**
     * Очистка всех команд турнира
     * POST /api/tournaments/:id/mix-clear-teams
     */
    static clearMixTeams = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const userId = req.user.id;

        console.log(`🗑️ [MixTeamController] Очистка команд турнира ${tournamentId}`);

        // Проверяем права доступа
        const hasPermission = await TournamentService.checkUserPermission(tournamentId, userId, 'manage_teams');
        if (!hasPermission) {
            return res.status(403).json({ 
                error: 'Недостаточно прав для очистки команд' 
            });
        }

        try {
            const tournament = await TournamentService.getTournament(tournamentId);
            if (!tournament) {
                return res.status(404).json({ error: 'Турнир не найден' });
            }

            if (tournament.format !== 'mix') {
                return res.status(400).json({ 
                    error: 'Очистка команд доступна только для микс турниров' 
                });
            }

            if (tournament.status !== 'active') {
                return res.status(400).json({ 
                    error: 'Очистка команд доступна только для активных турниров' 
                });
            }

            // Проверяем, не создана ли уже сетка
            const hasMatches = await TournamentService.hasMatches(tournamentId);
            if (hasMatches) {
                return res.status(400).json({ 
                    error: 'Нельзя очищать команды после создания турнирной сетки' 
                });
            }

            // Очищаем команды через специальный метод
            await MixTeamService.clearTeams(tournamentId, userId);

            console.log(`✅ [MixTeamController] Команды очищены для турнира ${tournamentId}`);

            res.status(200).json({
                success: true,
                message: 'Команды успешно очищены'
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка очистки команд:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при очистке команд' 
            });
        }
    });

    /**
     * 📊 Статистика микс команд
     * GET /api/tournaments/:id/mix-stats
     */
    static getMixStats = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        
        try {
            const stats = await MixTeamService.getMixStats(tournamentId);
            res.json(stats);
        } catch (error) {
            console.error(`❌ [getMixStats] Ошибка получения статистики:`, error);
            res.status(500).json({ 
                error: 'Ошибка получения статистики микс команд',
                details: error.message 
            });
        }
    });

    /**
     * 🔄 АЛИАС МЕТОДЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ С ФРОНТЕНДОМ
     */
    
    /**
     * 🆕 Алиас для formTeams (обратная совместимость с фронтендом)
     * POST /api/tournaments/:id/form-teams
     */
    static formTeamsAlias = asyncHandler(async (req, res) => {
        console.log(`🔄 [MixTeamController] Алиас form-teams перенаправляет на новый formTeams`);
        return MixTeamController.formTeams(req, res);
    });

    /**
     * Алиас для generateMixTeams (старое название)
     */
    static generateMixTeams = asyncHandler(async (req, res) => {
        console.log(`🔄 [MixTeamController] Алиас generateMixTeams перенаправляет на новый formTeams`);
        return MixTeamController.formTeams(req, res);
    });

    /**
     * Алиас для getOriginalParticipants
     */
    static getOriginalParticipantsAlias = asyncHandler(async (req, res) => {
        console.log(`🔄 [MixTeamController] Алиас getOriginalParticipantsAlias перенаправляет на getOriginalParticipants`);
        return MixTeamController.getOriginalParticipants(req, res);
    });
}

module.exports = MixTeamController; 