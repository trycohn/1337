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
const { migrateExistingTeamsCaptainsSafe } = require('../../migrate_existing_teams_captains_safe');
const poolModule = require('../../db');
const pool = poolModule.pool || poolModule;

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
            const result = await MixTeamService.generateTeams(
                tournamentId
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
            const result = await MixTeamService.generateTeams(
                tournamentId
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
     * 🆕 Получение карты составов команд турнира (team_id -> roster)
     * GET /api/tournaments/:id/team-rosters
     */
    static getTeamRosters = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);

        console.log(`🔍 [MixTeamController] Получение карты составов команд турнира ${tournamentId}`);

        try {
            const baseTournament = await TournamentService.getTournament(tournamentId);
            const fmt = (baseTournament?.format || '').toString().trim().toLowerCase();
            const mixType = (baseTournament?.mix_type || '').toString().trim().toLowerCase();
            const isFullMix = fmt === 'full_mix' || (fmt === 'mix' && mixType === 'full');
            const isSEorDE = baseTournament?.bracket_type === 'single_elimination' || 
                            baseTournament?.bracket_type === 'double_elimination';
            
            // 🆕 ДЛЯ FULL MIX SE/DE: Возвращаем ИСТОРИЧЕСКИЕ составы из metadata матчей
            if (isFullMix && isSEorDE) {
                console.log(`📜 [MixTeamController] Full Mix SE/DE - возвращаем исторические составы из матчей`);
                
                try {
                    const matchesResult = await pool.query(
                        `SELECT id, round, team1_id, team2_id, metadata 
                         FROM matches 
                         WHERE tournament_id = $1 
                         ORDER BY round`,
                        [tournamentId]
                    );
                    
                    const rosters = {};
                    
                    // Собираем исторические составы из metadata матчей
                    // Используем последний подтвержденный состав каждой команды
                    for (const match of matchesResult.rows) {
                        try {
                            // metadata может быть JSON строкой или объектом
                            const metadata = typeof match.metadata === 'string' 
                                ? JSON.parse(match.metadata) 
                                : match.metadata;
                            
                            const roundRosters = metadata?.round_rosters;
                            
                            if (roundRosters && roundRosters.confirmed_at) {
                                // Для team1 - используем team_id как ключ (последний состав)
                                if (match.team1_id && roundRosters.team1_roster) {
                                    rosters[match.team1_id] = {
                                        team_id: match.team1_id,
                                        match_id: match.id,
                                        round: match.round,
                                        members: roundRosters.team1_roster,
                                        historical: true,
                                        confirmed_at: roundRosters.confirmed_at
                                    };
                                }
                                
                                // Для team2
                                if (match.team2_id && roundRosters.team2_roster) {
                                    rosters[match.team2_id] = {
                                        team_id: match.team2_id,
                                        match_id: match.id,
                                        round: match.round,
                                        members: roundRosters.team2_roster,
                                        historical: true,
                                        confirmed_at: roundRosters.confirmed_at
                                    };
                                }
                            }
                        } catch (metaError) {
                            console.warn(`⚠️ Ошибка парсинга metadata матча ${match.id}:`, metaError.message);
                        }
                    }
                    
                    console.log(`✅ Найдено ${Object.keys(rosters).length} исторических составов`);
                    
                    return res.status(200).json({ rosters, historical: true });
                } catch (error) {
                    console.error(`❌ Ошибка при получении исторических составов:`, error);
                    // В случае ошибки возвращаем пустые составы
                    return res.status(200).json({ rosters: {}, historical: true, error: error.message });
                }
            }
            
            // 🔒 Для Full Mix Swiss: скрываем команды до approve
            if (isFullMix) {
                const snapRes = await pool.query(
                    `SELECT approved_teams
                     FROM full_mix_snapshots
                     WHERE tournament_id = $1
                     ORDER BY round_number DESC
                     LIMIT 1`,
                    [tournamentId]
                );
                const lastApproved = snapRes.rows.length > 0 ? (snapRes.rows[0].approved_teams === true) : false;
                if (!lastApproved) {
                    console.log(`🛡️ [MixTeamController] Full Mix not approved → скрываем составы`);
                    return res.status(200).json({ rosters: {} });
                }
            }

            // ОБЫЧНАЯ ЛОГИКА: Получаем текущие составы команд
            const teams = await TeamRepository.getByTournamentId(tournamentId);
            const rosters = {};
            for (const team of teams) {
                const teamId = team.id;
                const captainUserId = team.captain_user_id || null;
                const captainParticipantId = team.captain_participant_id || null;
                const members = Array.isArray(team.members) ? team.members.map(m => ({
                    id: m.id,
                    user_id: m.user_id,
                    participant_id: m.participant_id,
                    is_captain: m.is_captain === true,
                    username: m.username || null,
                    name: m.name || m.username || null,
                    avatar_url: m.avatar_url || null
                })) : [];
                rosters[teamId] = {
                    team_id: teamId,
                    team_name: team.name,
                    captain_user_id: captainUserId,
                    captain_participant_id: captainParticipantId,
                    members
                };
            }

            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            res.set('Vary', 'Authorization');
            res.status(200).json({ rosters });
        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка получения карты составов:`, error);
            res.status(500).json({
                error: error.message || 'Ошибка при получении составов команд'
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

            // 🔧 УДАЛЕНА БЛОКИРОВКА: Теперь сетка автоматически удаляется при изменении размера команды
            // Ранее: проверка на hasMatches блокировала изменение размера
            // Теперь: TournamentService.updateTeamSize автоматически удаляет команды и сетку

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
            // 🔒 Backend‑gate для Full Mix: скрываем команды до approve
            // 1) Определяем, что турнир Full Mix
            const baseTournament = await TournamentService.getTournament(tournamentId);
            const fmt = (baseTournament?.format || '').toString().trim().toLowerCase();
            const mixType = (baseTournament?.mix_type || '').toString().trim().toLowerCase();
            const isFullMix = fmt === 'full_mix' || (fmt === 'mix' && mixType === 'full');

            if (isFullMix) {
                // 2) Берём последний снапшот; если его нет — считаем не подтвержденным
                const snapRes = await pool.query(
                    `SELECT approved_teams
                     FROM full_mix_snapshots
                     WHERE tournament_id = $1
                     ORDER BY round_number DESC
                     LIMIT 1`,
                    [tournamentId]
                );
                const lastApproved = snapRes.rows.length > 0 ? (snapRes.rows[0].approved_teams === true) : false;
                if (!lastApproved) {
                    console.log(`🛡️ [MixTeamController] Full Mix not approved → скрываем команды`);
                    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                    res.set('Pragma', 'no-cache');
                    res.set('Expires', '0');
                    res.set('Vary', 'Authorization');
                    res.set('ETag', `W/"tm-${tournamentId}-${req.user?.id || 'anon'}-${Date.now()}"`);
                    return res.status(200).json([]);
                }
            }

            const teams = await TournamentService.getTeams(tournamentId);

            console.log(`✅ [MixTeamController] Получено команд: ${teams.length}`);

            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            res.set('Vary', 'Authorization');
            res.set('ETag', `W/"tm-${tournamentId}-${req.user?.id || 'anon'}-${Date.now()}"`);
            res.status(200).json(teams);

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
     * 🆕 НАЗНАЧЕНИЕ КАПИТАНА КОМАНДЫ
     * POST /api/tournaments/:id/teams/:teamId/set-captain
     */
    static setCaptain = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const teamId = parseInt(req.params.teamId);
        const { userId: targetUserId } = req.body;
        const currentUserId = req.user.id;

        console.log(`👑 [MixTeamController] Назначение капитана команды ${teamId} для турнира ${tournamentId}`);

        // Проверяем права доступа
        const hasPermission = await TournamentService.checkUserPermission(tournamentId, currentUserId, 'manage_teams');
        if (!hasPermission) {
            return res.status(403).json({ 
                error: 'Недостаточно прав для управления капитанами' 
            });
        }

        try {
            // Получаем турнир для определения типа рейтинга
            const tournament = await TournamentService.getTournament(tournamentId);
            if (!tournament) {
                return res.status(404).json({ error: 'Турнир не найден' });
            }

            if (tournament.format !== 'mix') {
                return res.status(400).json({ 
                    error: 'Управление капитанами доступно только для микс турниров' 
                });
            }

            // Проверяем существование команды
            const team = await TeamRepository.getById(teamId);
            if (!team || team.tournament_id !== tournamentId) {
                return res.status(404).json({ error: 'Команда не найдена' });
            }

            // Получаем рейтинг нового капитана
            const members = await TeamRepository.getMembers(teamId);
            const targetMember = members.find(m => m.user_id === targetUserId);
            
            if (!targetMember) {
                return res.status(400).json({ 
                    error: 'Пользователь не является участником команды' 
                });
            }

            // Определяем рейтинг для капитана
            const ratingType = tournament.mix_rating_type || 'faceit';
            const captainRating = MixTeamService.normalizeParticipantRating(targetMember, ratingType);

            // Назначаем капитана
            const captain = await TeamRepository.setCaptain(teamId, targetUserId, captainRating);

            // Логируем событие
            await logTournamentEvent(tournamentId, currentUserId, 'captain_assigned', {
                team_id: teamId,
                captain_user_id: targetUserId,
                captain_rating: captainRating,
                rating_type: ratingType
            });

            // Отправляем уведомление в чат
            await sendTournamentChatAnnouncement(
                tournamentId,
                `👑 Назначен новый капитан команды "${team.name}": ${targetMember.username || targetMember.participant_name} (рейтинг: ${captainRating})`
            );

            // Получаем обновленную информацию о капитане
            const captainInfo = await TeamRepository.getTeamCaptain(teamId);

            console.log(`✅ [MixTeamController] Капитан назначен: ${targetMember.username} (рейтинг: ${captainRating})`);

            res.status(200).json({
                success: true,
                message: `Капитан команды успешно назначен`,
                captain: captainInfo,
                team_id: teamId,
                captain_rating: captainRating
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка назначения капитана:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при назначении капитана' 
            });
        }
    });

    /**
     * 🆕 ПОЛУЧЕНИЕ ИНФОРМАЦИИ О КАПИТАНЕ КОМАНДЫ
     * GET /api/tournaments/:id/teams/:teamId/captain
     */
    static getTeamCaptain = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const teamId = parseInt(req.params.teamId);

        console.log(`🔍 [MixTeamController] Получение информации о капитане команды ${teamId}`);

        try {
            // Проверяем существование команды
            const team = await TeamRepository.getById(teamId);
            if (!team || team.tournament_id !== tournamentId) {
                return res.status(404).json({ error: 'Команда не найдена' });
            }

            // Получаем информацию о капитане
            const captain = await TeamRepository.getTeamCaptain(teamId);

            if (!captain) {
                return res.status(404).json({ 
                    error: 'У команды нет назначенного капитана' 
                });
            }

            console.log(`✅ [MixTeamController] Капитан найден: ${captain.username}`);

            res.status(200).json({
                success: true,
                captain: captain,
                team_id: teamId
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка получения капитана:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при получении информации о капитане' 
            });
        }
    });

    /**
     * 🆕 АВТОМАТИЧЕСКОЕ НАЗНАЧЕНИЕ КАПИТАНА ПО РЕЙТИНГУ
     * POST /api/tournaments/:id/teams/:teamId/auto-assign-captain
     */
    static autoAssignCaptain = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const teamId = parseInt(req.params.teamId);
        const { ratingType } = req.body;
        const currentUserId = req.user.id;

        console.log(`🎯 [MixTeamController] Автоназначение капитана команды ${teamId} для турнира ${tournamentId}`);

        // Проверяем права доступа
        const hasPermission = await TournamentService.checkUserPermission(tournamentId, currentUserId, 'manage_teams');
        if (!hasPermission) {
            return res.status(403).json({ 
                error: 'Недостаточно прав для управления капитанами' 
            });
        }

        try {
            // Получаем турнир для определения типа рейтинга
            const tournament = await TournamentService.getTournament(tournamentId);
            if (!tournament) {
                return res.status(404).json({ error: 'Турнир не найден' });
            }

            if (tournament.format !== 'mix') {
                return res.status(400).json({ 
                    error: 'Управление капитанами доступно только для микс турниров' 
                });
            }

            // Проверяем существование команды
            const team = await TeamRepository.getById(teamId);
            if (!team || team.tournament_id !== tournamentId) {
                return res.status(404).json({ error: 'Команда не найдена' });
            }

            // Определяем тип рейтинга
            const finalRatingType = ratingType || tournament.mix_rating_type || 'faceit';

            // Автоматически назначаем капитана
            const captain = await TeamRepository.autoAssignCaptain(teamId, finalRatingType);

            // Логируем событие
            await logTournamentEvent(tournamentId, currentUserId, 'captain_auto_assigned', {
                team_id: teamId,
                captain_user_id: captain.user_id,
                captain_rating: captain.captain_rating,
                rating_type: finalRatingType
            });

            // Отправляем уведомление в чат
            await sendTournamentChatAnnouncement(
                tournamentId,
                `🎯 Автоназначен капитан команды "${team.name}": ${captain.username || captain.participant_name} (рейтинг: ${captain.captain_rating})`
            );

            console.log(`✅ [MixTeamController] Капитан автоназначен: ${captain.username} (рейтинг: ${captain.captain_rating})`);

            res.status(200).json({
                success: true,
                message: `Капитан команды автоматически назначен`,
                captain: captain,
                team_id: teamId,
                rating_type: finalRatingType
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка автоназначения капитана:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при автоназначении капитана' 
            });
        }
    });

    /**
     * 🆕 МАССОВОЕ НАЗНАЧЕНИЕ КАПИТАНОВ ДЛЯ ВСЕХ КОМАНД ТУРНИРА
     * POST /api/tournaments/:id/assign-all-captains
     */
    static assignAllCaptains = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const { ratingType } = req.body;
        const currentUserId = req.user.id;

        console.log(`👑 [MixTeamController] Массовое назначение капитанов для турнира ${tournamentId}`);

        // Проверяем права доступа
        const hasPermission = await TournamentService.checkUserPermission(tournamentId, currentUserId, 'manage_teams');
        if (!hasPermission) {
            return res.status(403).json({ 
                error: 'Недостаточно прав для управления капитанами' 
            });
        }

        try {
            // Получаем турнир
            const tournament = await TournamentService.getTournament(tournamentId);
            if (!tournament) {
                return res.status(404).json({ error: 'Турнир не найден' });
            }

            if (tournament.format !== 'mix') {
                return res.status(400).json({ 
                    error: 'Управление капитанами доступно только для микс турниров' 
                });
            }

            // Определяем тип рейтинга
            const finalRatingType = ratingType || tournament.mix_rating_type || 'faceit';

            // Массовое назначение капитанов
            const result = await TeamRepository.assignCaptainsForExistingTeams(tournamentId, finalRatingType);

            // Логируем событие
            await logTournamentEvent(tournamentId, currentUserId, 'captains_mass_assigned', {
                total_teams: result.total_teams,
                assigned_captains: result.assigned_captains,
                rating_type: finalRatingType
            });

            // Отправляем уведомление в чат
            await sendTournamentChatAnnouncement(
                tournamentId,
                `👑 Массовое назначение капитанов завершено: ${result.assigned_captains} из ${result.total_teams} команд получили капитанов`
            );

            console.log(`✅ [MixTeamController] Массовое назначение завершено: ${result.assigned_captains}/${result.total_teams}`);

            res.status(200).json({
                success: true,
                message: `Назначено ${result.assigned_captains} капитанов из ${result.total_teams} команд`,
                result: result,
                rating_type: finalRatingType
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка массового назначения капитанов:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при массовом назначении капитанов' 
            });
        }
    });

    /**
     * 🆕 ПОЛУЧЕНИЕ СТАТИСТИКИ ПО КАПИТАНАМ ТУРНИРА
     * GET /api/tournaments/:id/captains-stats
     */
    static getCaptainsStats = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);

        console.log(`📊 [MixTeamController] Получение статистики капитанов для турнира ${tournamentId}`);

        try {
            // Получаем статистику
            const stats = await TeamRepository.getCaptainStats(tournamentId);

            // Получаем команды с капитанами для дополнительной информации
            const teams = await TeamRepository.getByTournamentId(tournamentId);
            const teamsWithCaptains = teams.filter(team => team.captain_user_id);

            const enhancedStats = {
                ...stats,
                total_teams: teams.length,
                teams_with_captains: teamsWithCaptains.length,
                teams_without_captains: teams.length - teamsWithCaptains.length,
                captains_coverage: teams.length > 0 ? Math.round((teamsWithCaptains.length / teams.length) * 100) : 0
            };

            console.log(`✅ [MixTeamController] Статистика получена: ${enhancedStats.teams_with_captains}/${enhancedStats.total_teams} команд имеют капитанов`);

            res.status(200).json({
                success: true,
                stats: enhancedStats,
                tournament_id: tournamentId
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка получения статистики капитанов:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при получении статистики капитанов' 
            });
        }
    });

    /**
     * 🆕 ПРОВЕРКА ЯВЛЯЕТСЯ ЛИ ПОЛЬЗОВАТЕЛЬ КАПИТАНОМ КОМАНДЫ
     * GET /api/tournaments/:id/teams/:teamId/is-captain/:userId
     */
    static isUserCaptain = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const teamId = parseInt(req.params.teamId);
        const userId = parseInt(req.params.userId);

        console.log(`🔍 [MixTeamController] Проверка капитанства пользователя ${userId} в команде ${teamId}`);

        try {
            // Проверяем существование команды
            const team = await TeamRepository.getById(teamId);
            if (!team || team.tournament_id !== tournamentId) {
                return res.status(404).json({ error: 'Команда не найдена' });
            }

            // Проверяем является ли пользователь капитаном
            const isCaptain = await TeamRepository.isUserCaptain(teamId, userId);

            console.log(`✅ [MixTeamController] Пользователь ${userId} ${isCaptain ? 'является' : 'не является'} капитаном команды ${teamId}`);

            res.status(200).json({
                success: true,
                is_captain: isCaptain,
                user_id: userId,
                team_id: teamId
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка проверки капитанства:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при проверке капитанства' 
            });
        }
    });

    /**
     * 🆕 МИГРАЦИЯ СУЩЕСТВУЮЩИХ КОМАНД (НАЗНАЧЕНИЕ КАПИТАНОВ)
     * POST /api/tournaments/:id/migrate-captains
     */
    static migrateCaptains = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const { ratingType } = req.body;
        const currentUserId = req.user.id;

        console.log(`🔄 [MixTeamController] Миграция капитанов для турнира ${tournamentId}`);

        // Проверяем права доступа
        const hasPermission = await TournamentService.checkUserPermission(tournamentId, currentUserId, 'manage_teams');
        if (!hasPermission) {
            return res.status(403).json({ 
                error: 'Недостаточно прав для миграции капитанов' 
            });
        }

        try {
            // Получаем турнир
            const tournament = await TournamentService.getTournament(tournamentId);
            if (!tournament) {
                return res.status(404).json({ error: 'Турнир не найден' });
            }

            if (tournament.format !== 'mix') {
                return res.status(400).json({ 
                    error: 'Миграция капитанов доступна только для микс турниров' 
                });
            }

            // Определяем тип рейтинга
            const finalRatingType = ratingType || tournament.mix_rating_type || 'faceit';

            // Выполняем миграцию
            await migrateExistingTeamsCaptainsSafe();

            // Получаем актуальную статистику после миграции
            const stats = await TeamRepository.getCaptainStats(tournamentId);

            // Логируем событие
            await logTournamentEvent(tournamentId, currentUserId, 'captains_migrated', {
                rating_type: finalRatingType,
                migration_completed: true
            });

            // Отправляем уведомление в чат
            await sendTournamentChatAnnouncement(
                tournamentId,
                `🔄 Миграция капитанов завершена! Проверьте статистику команд для получения детальной информации.`
            );

            console.log(`✅ [MixTeamController] Миграция завершена для турнира ${tournamentId}`);

            res.status(200).json({
                success: true,
                message: `Миграция капитанов завершена успешно`,
                stats: stats,
                rating_type: finalRatingType
            });

        } catch (error) {
            console.error(`❌ [MixTeamController] Ошибка миграции капитанов:`, error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при миграции капитанов' 
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