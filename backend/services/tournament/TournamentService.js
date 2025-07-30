const pool = require('../../db');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const MatchRepository = require('../../repositories/tournament/MatchRepository');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const ChatService = require('../tournament/ChatService');
const MatchLobbyService = require('../matchLobby/MatchLobbyService');
const { logTournamentEvent, logAdvancement } = require('./TournamentLogService');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');

class TournamentService {
    /**
     * Получение всех турниров с количеством участников
     */
    static async getAllTournaments() {
        console.log('🔍 TournamentService: Получение всех турниров');
        return await TournamentRepository.getAllWithParticipantCount();
    }

    /**
     * Получение турнира по ID с полной информацией
     */
    static async getTournamentById(tournamentId) {
        const startTime = Date.now();
        console.log(`🔍 [TournamentService] Получение турнира ${tournamentId}`);

        try {
            // Получаем основную информацию о турнире
            const tournament = await TournamentRepository.getByIdWithCreator(tournamentId);
            if (!tournament) {
                return null;
            }
            console.log(`🏆 [getTournamentById] Турнир ${tournamentId}: ${tournament.name}, формат: ${tournament.format}, статус: ${tournament.status}`);

            // Получаем администраторов
            const admins = await TournamentRepository.getAdmins(tournamentId);
            console.log(`👥 [getTournamentById] Турнир ${tournamentId}: найдено ${admins.length} администраторов`);

            // Получаем участников
            const participants = await ParticipantRepository.getByTournamentId(tournamentId);
            console.log(`🎯 [getTournamentById] Турнир ${tournamentId}: найдено ${participants.length} участников`);

            // Получаем матчи
            const matches = await MatchRepository.getByTournamentId(tournamentId);
            console.log(`⚔️ [getTournamentById] Турнир ${tournamentId}: найдено ${matches.length} матчей`);
            
            // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА ДЛЯ МИКС ТУРНИРОВ
            if (tournament.format === 'mix') {
                console.log(`🧩 [getTournamentById] МИКС ТУРНИР ${tournamentId} - детальная диагностика:`);
                console.log(`   📊 Участников: ${participants.length}`);
                console.log(`   ⚔️ Матчей в базе: ${matches.length}`);
                
                if (matches.length > 0) {
                    console.log(`   🎯 Первый матч:`, {
                        id: matches[0].id,
                        team1_id: matches[0].team1_id,
                        team2_id: matches[0].team2_id,
                        round: matches[0].round,
                        bracket_type: matches[0].bracket_type
                    });
                    console.log(`   🎯 Последний матч:`, {
                        id: matches[matches.length - 1].id,
                        team1_id: matches[matches.length - 1].team1_id,
                        team2_id: matches[matches.length - 1].team2_id,
                        round: matches[matches.length - 1].round,
                        bracket_type: matches[matches.length - 1].bracket_type
                    });
                }
            }

            // Получаем команды для командных турниров
            let teams = [];
            if (tournament.format === 'mix' || tournament.participant_type === 'team') {
                teams = await TournamentRepository.getTeamsWithMembers(tournamentId);
                console.log(`🏆 [getTournamentById] Турнир ${tournamentId}: найдено ${teams.length} команд`);
                
                // 🔍 ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА ДЛЯ КОМАНД
                if (tournament.format === 'mix' && teams.length > 0) {
                    console.log(`   🧩 Первая команда:`, {
                        id: teams[0].id,
                        name: teams[0].name,
                        members_count: teams[0].members ? teams[0].members.length : 0
                    });
                }
            }

            const result = {
                ...tournament,
                creator_name: tournament.creator_username,
                creator_avatar_url: tournament.creator_avatar_url,
                participants: participants,
                participant_count: participants.length,
                matches: matches,
                teams: teams,
                mixed_teams: teams,
                admins: admins
            };

            const endTime = Date.now();
            console.log(`✅ [TournamentService] Турнир ${tournamentId} получен за ${endTime - startTime}ms`);
            console.log(`📋 [getTournamentById] Итоговые данные турнира ${tournamentId}:`, {
                name: result.name,
                format: result.format,
                status: result.status,
                participants_count: result.participants.length,
                matches_count: result.matches.length,
                teams_count: result.teams.length,
                admins_count: result.admins.length
            });
            
            // 🔍 ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА ВОЗВРАЩАЕМЫХ МАТЧЕЙ
            console.log(`🔍 [getTournamentById] ДЕТАЛЬНАЯ ПРОВЕРКА МАТЧЕЙ для турнира ${tournamentId}:`);
            console.log(`   📊 result.matches is Array: ${Array.isArray(result.matches)}`);
            console.log(`   📊 result.matches length: ${result.matches ? result.matches.length : 'undefined'}`);
            if (result.matches && result.matches.length > 0) {
                console.log(`   🎯 Первый матч в result:`, {
                    id: result.matches[0].id,
                    tournament_id: result.matches[0].tournament_id,
                    team1_id: result.matches[0].team1_id,
                    team2_id: result.matches[0].team2_id,
                    round: result.matches[0].round
                });
            } else {
                console.log(`   ⚠️ result.matches пустой или undefined!`);
            }

            return result;

        } catch (error) {
            console.error(`❌ [TournamentService] Ошибка получения турнира ${tournamentId}:`, error);
            throw error;
        }
    }

    /**
     * Создание нового турнира
     */
    static async createTournament(tournamentData, userId) {
        console.log('➕ TournamentService: Создание турнира', tournamentData);

        const {
            name, game, format, participant_type, max_participants,
            start_date, description, bracket_type, team_size, mix_rating_type,
            lobby_enabled, lobby_match_format, selected_maps
        } = tournamentData;

        const tournament = await TournamentRepository.create({
            name,
            game,
            format,
            created_by: userId,
            status: 'active',
            participant_type,
            max_participants: max_participants || null,
            start_date: start_date || null,
            description: description || null,
            bracket_type: bracket_type || null,
            team_size: team_size || 1,
            mix_rating_type: (format === 'mix' && mix_rating_type) ? mix_rating_type : null,
            lobby_enabled: lobby_enabled || false
        });

        // Если включены настройки лобби, создаем их
        if (lobby_enabled && selected_maps && selected_maps.length === 7) {
            await MatchLobbyService.createLobbySettings(tournament.id, {
                enabled: true,
                matchFormat: lobby_match_format
            });
            
            await MatchLobbyService.setTournamentMaps(tournament.id, selected_maps);
        }

        // Логируем создание турнира
        await logTournamentEvent(tournament.id, userId, 'tournament_created', {
            name: tournament.name,
            game: tournament.game,
            format: tournament.format,
            mix_rating_type: tournament.mix_rating_type,
            lobby_enabled: tournament.lobby_enabled
        });

        console.log('✅ TournamentService: Турнир создан', tournament);
        return tournament;
    }

    /**
     * Обновление турнира
     */
    static async updateTournament(tournamentId, updateData, userId) {
        console.log(`✏️ TournamentService: Обновление турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (tournament.status !== 'active') {
            throw new Error('Турнир неактивен');
        }

        const updatedTournament = await TournamentRepository.update(tournamentId, updateData);

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для общих обновлений турнира
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateTournament');
        console.log(`📡 [updateTournament] WebSocket обновление отправлено`);

        console.log('✅ TournamentService: Турнир обновлен');
        return updatedTournament;
    }

    /**
     * Удаление турнира
     */
    static async deleteTournament(tournamentId, userId) {
        console.log(`🗑️ TournamentService: Удаление турнира ${tournamentId}`);

        // Проверка прав доступа - только создатель может удалить турнир
        await this._checkTournamentDeletionAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        // 🗑️ ИСПРАВЛЕНО: Убрана проверка статуса турнира
        // Создатель может удалить турнир в любом статусе
        console.log(`🗑️ [deleteTournament] Удаление турнира "${tournament.name}" (статус: ${tournament.status})`);

        await TournamentRepository.delete(tournamentId);

        console.log('✅ TournamentService: Турнир удален');
    }

    /**
     * Начало турнира
     */
    static async startTournament(tournamentId, userId) {
        console.log(`🚀 TournamentService: Начало турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        
        // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА СТАТУСА ТУРНИРА
        console.log(`🔍 [startTournament] Диагностика турнира ${tournamentId}:`, {
            id: tournament?.id,
            name: tournament?.name,
            status: tournament?.status,
            format: tournament?.format,
            created_by: tournament?.created_by,
            userId: userId,
            hasPermission: tournament?.created_by === userId
        });
        
        if (tournament.status !== 'active') {
            const errorMessage = `Можно начать только активный турнир. Текущий статус: "${tournament.status}"`;
            console.error(`❌ [startTournament] ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Проверка наличия сгенерированной сетки
        const matchesCount = await MatchRepository.getCountByTournamentId(tournamentId);
        console.log(`🔍 [startTournament] Количество матчей в турнире: ${matchesCount}`);
        
        if (matchesCount === 0) {
            const errorMessage = 'Перед началом турнира необходимо сгенерировать сетку';
            console.error(`❌ [startTournament] ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Изменение статуса турнира
        console.log(`🔄 [startTournament] Меняем статус турнира с "${tournament.status}" на "in_progress"`);
        await TournamentRepository.updateStatus(tournamentId, 'in_progress');

        // 🆕 ИСПРАВЛЕНИЕ: Получаем обновленные данные турнира и отправляем WebSocket событие
        const updatedTournament = await this.getTournamentById(tournamentId);
        console.log(`✅ [startTournament] Турнир обновлен, новый статус: "${updatedTournament.status}"`);

        // Отправляем обновление через WebSocket (аналогично endTournament)
        broadcastTournamentUpdate(tournamentId, updatedTournament, 'startTournament');
        console.log(`📡 [startTournament] WebSocket обновление отправлено`);

        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'tournament_started', {
            previous_status: tournament.status,
            new_status: 'in_progress'
        });

        // Отправляем уведомление в чат
        await sendTournamentChatAnnouncement(
            tournamentId,
            `🚀 Турнир начат! Удачи всем участникам!`
        );

        console.log('✅ TournamentService: Турнир начат');
        return { 
            success: true, 
            message: 'Турнир успешно начат' 
        };
    }

    /**
     * Завершение турнира
     */
    static async endTournament(tournamentId, userId) {
        console.log(`🏁 TournamentService: Завершение турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        
        // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА СТАТУСА ТУРНИРА
        console.log(`🔍 [endTournament] Диагностика турнира ${tournamentId}:`, {
            id: tournament?.id,
            name: tournament?.name,
            status: tournament?.status,
            format: tournament?.format,
            created_by: tournament?.created_by,
            userId: userId,
            hasPermission: tournament?.created_by === userId
        });
        
        if (tournament.status !== 'in_progress') {
            const errorMessage = `Можно завершить только турнир в процессе. Текущий статус: "${tournament.status}"`;
            console.error(`❌ [endTournament] ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Проверка наличия сгенерированной сетки
        const matchesCount = await MatchRepository.getCountByTournamentId(tournamentId);
        console.log(`🔍 [endTournament] Количество матчей в турнире: ${matchesCount}`);
        
        if (matchesCount === 0) {
            const errorMessage = 'Нельзя завершить турнир без сгенерированной сетки';
            console.error(`❌ [endTournament] ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Изменение статуса турнира на завершенный
        console.log(`🔄 [endTournament] Меняем статус турнира с "${tournament.status}" на "completed"`);
        await TournamentRepository.updateStatus(tournamentId, 'completed');

        // Получаем обновленные данные турнира
        const updatedTournament = await this.getTournamentById(tournamentId);
        console.log(`✅ [endTournament] Турнир обновлен, новый статус: "${updatedTournament.status}"`);

        // Отправляем обновление через WebSocket
        broadcastTournamentUpdate(tournamentId, updatedTournament, 'endTournament');

        // Логируем завершение турнира
        await logTournamentEvent(tournamentId, userId, 'tournament_ended', {
            participantCount: updatedTournament.participant_count,
            matchesCount: matchesCount,
            endedBy: userId
        });

        // Отправляем объявление в чат турнира
        await sendTournamentChatAnnouncement(
            tournamentId,
            `Турнир "${updatedTournament.name}" завершен`
        );

        console.log('✅ TournamentService: Турнир завершен');
        return updatedTournament;
    }

    /**
     * Получение списка игр
     */
    static async getGames() {
        console.log('🎮 TournamentService: Получение списка игр');
        try {
            const games = await TournamentRepository.getGames();
            console.log(`✅ TournamentService: Получено ${games.length} игр из репозитория`);
            return games;
        } catch (error) {
            console.error('❌ TournamentService: Ошибка получения списка игр:', error);
            throw error;
        }
    }

    /**
     * Сброс результатов матчей турнира
     */
    static async resetMatchResults(tournamentId, userId) {
        console.log(`🔄 TournamentService: Сброс результатов турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const result = await TournamentRepository.resetMatchResults(tournamentId, userId);

        // Отправляем уведомление в чат
        const tournament = await TournamentRepository.getById(tournamentId);
        await sendTournamentChatAnnouncement(
            tournamentId,
            `🔄 Администратор сбросил результаты матчей и восстановил изначальную структуру турнирной сетки. Статус турнира изменен на "Активный".`
        );

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для сброса результатов
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'resetMatchResults');
        console.log(`📡 [resetMatchResults] WebSocket обновление отправлено`);

        console.log('✅ TournamentService: Результаты матчей сброшены');
        return result;
    }

    /**
     * Получение команд турнира
     */
    static async getTeams(tournamentId) {
        console.log(`🏆 TournamentService: Получение команд турнира ${tournamentId}`);
        return await TournamentRepository.getTeamsWithMembers(tournamentId);
    }

    /**
     * Обновление описания турнира
     */
    static async updateDescription(tournamentId, description, userId) {
        console.log(`📝 TournamentService: Обновление описания турнира ${tournamentId}`);

        await this._checkTournamentAccess(tournamentId, userId);
        const updatedTournament = await TournamentRepository.updateDescription(tournamentId, description);

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления описания
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateDescription');
        console.log(`📡 [updateDescription] WebSocket обновление отправлено`);

        return updatedTournament;
    }

    /**
     * Обновление полного описания турнира
     */
    static async updateFullDescription(tournamentId, fullDescription, userId) {
        console.log(`📜 TournamentService: Обновление полного описания турнира ${tournamentId}`);

        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (tournament.status !== 'active') {
            throw new Error('Турнир неактивен');
        }

        const updatedTournament = await TournamentRepository.updateFullDescription(tournamentId, fullDescription);

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления полного описания
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateFullDescription');
        console.log(`📡 [updateFullDescription] WebSocket обновление отправлено`);

        return updatedTournament;
    }

    /**
     * Обновление регламента турнира
     */

    static async updateRules(tournamentId, rules, userId) {
        console.log(`⚖️ TournamentService: Обновление регламента турнира ${tournamentId}`);

        await this._checkTournamentAccess(tournamentId, userId);

    // 🔧 ИСПРАВЛЕНО: Убрана проверка статуса турнира
    // Регламент можно редактировать в любом статусе турнира (active, completed, in_progress)
    
        const updatedTournament = await TournamentRepository.updateRules(tournamentId, rules);

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления регламента
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateRules');
        console.log(`📡 [updateRules] WebSocket обновление отправлено`);

        return updatedTournament;
    }

    /**
     * Обновление призового фонда турнира
     */
    static async updatePrizePool(tournamentId, prizePool, userId) {
        console.log(`💰 TournamentService: Обновление призового фонда турнира ${tournamentId}`);

        await this._checkTournamentAccess(tournamentId, userId);
        const updatedTournament = await TournamentRepository.updatePrizePool(tournamentId, prizePool);

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления призового фонда
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updatePrizePool');
        console.log(`📡 [updatePrizePool] WebSocket обновление отправлено`);

        return updatedTournament;
    }

    /**
     * 🏆 Обновление типа турнирной сетки
     */
    static async updateBracketType(tournamentId, bracketType, userId) {
        console.log(`🏆 [TournamentService.updateBracketType] Обновление типа сетки турнира ${tournamentId} на "${bracketType}"`);
        
        // 🔧 ИСПРАВЛЕНО: Проверка прав доступа только для создателя турнира
        const tournament = await this._checkTournamentCreatorAccess(tournamentId, userId);
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.status !== 'active') {
            throw new Error('Изменение типа сетки доступно только для активных турниров');
        }
        
        // Проверка на наличие сгенерированной сетки
        const matchesCount = await TournamentRepository.getMatchesCount(tournamentId);
        if (matchesCount > 0) {
            throw new Error('Нельзя изменить тип сетки при наличии сгенерированных матчей');
        }
        
        // Валидация типа сетки
        const validBracketTypes = ['single_elimination', 'double_elimination'];
        if (!validBracketTypes.includes(bracketType)) {
            throw new Error(`Неподдерживаемый тип сетки: ${bracketType}`);
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateBracketType(tournamentId, bracketType);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'bracket_type_changed', {
            old_bracket_type: tournament.bracket_type,
            new_bracket_type: bracketType
        });
        
        // Уведомление в чат турнира
        const bracketTypeNames = {
            'single_elimination': 'Single Elimination',
            'double_elimination': 'Double Elimination'
        };
        
        const message = `Тип турнирной сетки изменен на: ${bracketTypeNames[bracketType]}`;
        await sendTournamentChatAnnouncement(tournamentId, message);
        
        // Broadcast обновления
        await broadcastTournamentUpdate(tournamentId, {
            type: 'bracket_type_updated',
            bracket_type: bracketType,
            message
        }, 'updateBracketType');
        
        console.log(`✅ [TournamentService.updateBracketType] Тип сетки успешно обновлен на "${bracketType}"`);
        return updatedTournament;
    }

    /**
     * 👥 Обновление размера команды для микс-турниров
     */
    static async updateTeamSize(tournamentId, teamSize, userId) {
        console.log(`👥 [TournamentService.updateTeamSize] Обновление размера команды турнира ${tournamentId} на ${teamSize}`);
        
        // 🔧 Проверка прав доступа - только создатель турнира
        const tournament = await this._checkTournamentCreatorAccess(tournamentId, userId);
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.format !== 'mix') {
            throw new Error('Изменение размера команды доступно только для микс-турниров');
        }
        
        if (tournament.status !== 'active') {
            throw new Error('Изменение размера команды доступно только для активных турниров');
        }
        
        // 🔧 НОВАЯ ЛОГИКА: Автоматическое удаление команд при изменении размера
        const teamsCount = await TournamentRepository.getTeamsCount(tournamentId);
        let teamsDeleted = false;
        let matchesDeleted = false;
        
        if (teamsCount > 0) {
            console.log(`🗑️ [TournamentService.updateTeamSize] Найдено ${teamsCount} команд, удаляем их при изменении размера`);
            
            // Сначала удаляем турнирную сетку если она есть
            const matchesCount = await TournamentRepository.getMatchesCount(tournamentId);
            if (matchesCount > 0) {
                console.log(`🗑️ [TournamentService.updateTeamSize] Удаляем ${matchesCount} матчей турнирной сетки`);
                await TournamentRepository.deleteMatches(tournamentId);
                matchesDeleted = true;
            }
            
            // Затем удаляем команды
            await TournamentRepository.deleteTeams(tournamentId);
            teamsDeleted = true;
            
            console.log(`✅ [TournamentService.updateTeamSize] Удалено ${teamsCount} команд и ${matchesCount} матчей`);
        }
        
        // Валидация размера команды
        const validTeamSizes = [2, 3, 4, 5];
        if (!validTeamSizes.includes(teamSize)) {
            throw new Error(`Неподдерживаемый размер команды: ${teamSize}. Доступные: ${validTeamSizes.join(', ')}`);
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateTeamSize(tournamentId, teamSize);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'team_size_changed', {
            old_team_size: tournament.team_size,
            new_team_size: teamSize,
            teams_deleted: teamsDeleted,
            matches_deleted: matchesDeleted,
            teams_count: teamsDeleted ? teamsCount : 0
        });
        
        // Уведомление в чат турнира
        const sizeNames = {
            2: '2 игрока',
            3: '3 игрока',
            4: '4 игрока',
            5: '5 игроков'
        };
        
        let message = `👥 Размер команды изменен на: ${sizeNames[teamSize]}`;
        
        if (teamsDeleted) {
            message += `\n🗑️ Удалено ${teamsCount} команд${matchesDeleted ? ' и турнирная сетка' : ''}`;
            message += `\n🔄 Участники снова доступны для формирования новых команд`;
        }
        
        await sendTournamentChatAnnouncement(tournamentId, message);
        
        // Broadcast обновления
        await broadcastTournamentUpdate(tournamentId, {
            type: 'team_size_updated',
            team_size: teamSize,
            message
        }, 'updateTeamSize');
        
        console.log(`✅ [TournamentService.updateTeamSize] Размер команды успешно обновлен на ${teamSize}`);
        
        // Добавляем информацию об удалении команд к турниру
        return {
            ...updatedTournament,
            teams_deleted: teamsDeleted,
            matches_deleted: matchesDeleted,
            deleted_teams_count: teamsDeleted ? teamsCount : 0
        };
    }

    /**
     * 🎯 Обновление типа рейтинга для микс-турниров
     */
    static async updateRatingType(tournamentId, mixRatingType, userId) {
        console.log(`🎯 [TournamentService.updateRatingType] Обновление типа рейтинга турнира ${tournamentId} на ${mixRatingType}`);
        
        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);
        
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.format !== 'mix') {
            throw new Error('Изменение типа рейтинга доступно только для микс-турниров');
        }
        
        if (tournament.status !== 'active') {
            throw new Error('Изменение типа рейтинга доступно только для активных турниров');
        }
        
        // Проверка на уже сформированные команды (можно менять только до формирования команд)
        const teamsCount = await TournamentRepository.getTeamsCount(tournamentId);
        if (teamsCount > 0) {
            throw new Error('Нельзя изменить тип рейтинга после формирования команд');
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateMixRatingType(tournamentId, mixRatingType);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'rating_type_changed', {
            old_rating_type: tournament.mix_rating_type,
            new_rating_type: mixRatingType
        });
        
        // Уведомление в чат турнира
        const typeNames = {
            'faceit': 'FACEIT ELO',
            'premier': 'CS2 Premier Rank',
            'mixed': 'Случайный микс'
        };
        
        await sendTournamentChatAnnouncement(
            tournamentId,
            `🎯 Тип рейтинга изменен на: ${typeNames[mixRatingType]}`
        );

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления типа рейтинга
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateRatingType');
        console.log(`📡 [updateRatingType] WebSocket обновление отправлено`);
        
        console.log(`✅ [updateRatingType] Тип рейтинга турнира ${tournamentId} обновлен на ${mixRatingType}`);
        return updatedTournament;
    }

    /**
     * 🎮 Обновление дисциплины турнира
     */
    static async updateGame(tournamentId, game, userId) {
        console.log(`🎮 [TournamentService.updateGame] Обновление дисциплины турнира ${tournamentId} на "${game}"`);
        
        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);
        
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.status !== 'active') {
            throw new Error('Изменение дисциплины доступно только для активных турниров');
        }
        
        // Проверка на уже созданную сетку (можно менять только до создания сетки)
        const hasMatches = await this.hasMatches(tournamentId);
        if (hasMatches) {
            throw new Error('Нельзя изменить дисциплину после создания турнирной сетки');
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateGame(tournamentId, game);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'game_changed', {
            old_game: tournament.game,
            new_game: game
        });
        
        // Уведомление в чат турнира
        await sendTournamentChatAnnouncement(
            tournamentId,
            `🎮 Дисциплина турнира изменена на: ${game}`
        );

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления дисциплины
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateGame');
        console.log(`📡 [updateGame] WebSocket обновление отправлено`);
        
        console.log(`✅ [updateGame] Дисциплина турнира ${tournamentId} обновлена на "${game}"`);
        return updatedTournament;
    }

    /**
     * 🏆 Обновление формата турнира
     */
    static async updateFormat(tournamentId, format, userId) {
        console.log(`🏆 [TournamentService.updateFormat] Обновление формата турнира ${tournamentId} на "${format}"`);
        
        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);
        
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.status !== 'active') {
            throw new Error('Изменение формата доступно только для активных турниров');
        }
        
        // Проверка на участников и команды
        const participantsCount = await TournamentRepository.getParticipantsCount(tournamentId);
        const teamsCount = await TournamentRepository.getTeamsCount(tournamentId);
        
        if (participantsCount > 0 || teamsCount > 0) {
            throw new Error('Нельзя изменить формат турнира при наличии участников или команд');
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateFormat(tournamentId, format);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'format_changed', {
            old_format: tournament.format,
            new_format: format
        });
        
        // Уведомление в чат турнира
        const formatNames = {
            'single_elimination': 'Single Elimination',
            'double_elimination': 'Double Elimination',
            'mix': 'Микс-турнир'
        };
        
        await sendTournamentChatAnnouncement(
            tournamentId,
            `🏆 Формат турнира изменен на: ${formatNames[format]}`
        );

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления формата
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateFormat');
        console.log(`📡 [updateFormat] WebSocket обновление отправлено`);
        
        console.log(`✅ [updateFormat] Формат турнира ${tournamentId} обновлен на "${format}"`);
        return updatedTournament;
    }

    /**
     * 📅 Обновление даты старта турнира
     */
    static async updateStartDate(tournamentId, startDate, userId) {
        console.log(`📅 [TournamentService.updateStartDate] Обновление даты старта турнира ${tournamentId} на "${startDate}"`);
        
        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);
        
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.status === 'completed') {
            throw new Error('Нельзя изменить дату старта завершенного турнира');
        }
        
        // Проверяем, что дата не в прошлом (с учетом разницы в 1 час для защиты от ошибок)
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        if (startDate < oneHourAgo) {
            throw new Error('Дата старта не может быть в прошлом');
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateStartDate(tournamentId, startDate);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'start_date_changed', {
            old_start_date: tournament.start_date,
            new_start_date: startDate
        });
        
        // Уведомление в чат турнира
        await sendTournamentChatAnnouncement(
            tournamentId,
            `📅 Дата старта турнира изменена на: ${startDate.toLocaleString('ru-RU')}`
        );

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления даты старта
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateStartDate');
        console.log(`📡 [updateStartDate] WebSocket обновление отправлено`);
        
        console.log(`✅ [updateStartDate] Дата старта турнира ${tournamentId} обновлена на "${startDate}"`);
        return updatedTournament;
    }

    /**
     * Обновление настроек лобби
     */
    static async updateLobbyEnabled(tournamentId, lobbyEnabled, userId) {
        console.log(`🎮 [TournamentService] Обновление настроек лобби турнира ${tournamentId} на ${lobbyEnabled}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        // Обновляем настройки лобби
        const updatedTournament = await TournamentRepository.update(tournamentId, {
            lobby_enabled: lobbyEnabled
        });

        // Обновляем настройки в таблице лобби
        if (lobbyEnabled) {
            await MatchLobbyService.createLobbySettings(tournamentId, {
                enabled: true,
                matchFormat: null
            });
        }

        await logTournamentEvent(tournamentId, userId, 'lobby_settings_updated', {
            lobby_enabled: lobbyEnabled
        });

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления настроек лобби
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateLobbyEnabled');
        console.log(`📡 [updateLobbyEnabled] WebSocket обновление отправлено`);

        console.log('✅ [TournamentService] Настройки лобби обновлены');
        return updatedTournament;
    }

    /**
     * Проверка прав доступа к турниру
     * @private
     */
    static async _checkTournamentAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (!isAdmin) {
                throw new Error('Только создатель или администратор может выполнить это действие');
            }
        }
    }

    /**
     * Проверка прав доступа к удалению турнира (только создатель)
     * @private
     */
    static async _checkTournamentDeletionAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            throw new Error('Только создатель может удалить турнир');
        }
    }

    /**
     * Проверка прав создателя турнира
     * @private
     */
    static async _checkTournamentCreatorAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            throw new Error('Только создатель турнира может выполнить это действие');
        }
        
        return tournament;
    }

    /**
     * Получение турнира по ID (простая версия без дополнительных данных)
     */
    static async getTournament(tournamentId) {
        console.log(`🔍 [TournamentService] Получение базовой информации о турнире ${tournamentId}`);
        return await TournamentRepository.getById(tournamentId);
    }

    /**
     * Получение детальной информации о турнире с дополнительными данными
     */
    static async getTournamentDetails(tournamentId) {
        try {
            const tournament = await TournamentRepository.getByIdWithCreator(tournamentId);
            
            if (!tournament) {
                throw new Error('Турнир не найден');
            }

            // Получаем участников или команды в зависимости от типа турнира
            let participants = [];
            let teams = [];

            // 🆕 ОБНОВЛЕННАЯ ЛОГИКА: поддержка CS2 типов участников
            const isTeamTournament = ['team', 'cs2_classic_5v5', 'cs2_wingman_2v2'].includes(tournament.participant_type);
            const isSoloTournament = tournament.participant_type === 'solo';

            if (tournament.format === 'mix' || isSoloTournament) {
                participants = await ParticipantRepository.getByTournamentId(tournamentId);
                teams = await TeamRepository.getByTournamentId(tournamentId);
            } else if (isTeamTournament) {
                teams = await TournamentRepository.getTeamsWithMembers(tournamentId);
            }

            // Получаем матчи
            const matches = await MatchRepository.getByTournamentId(tournamentId);

            // Добавляем CS2-специфичную информацию
            const enhancedTournament = this._enhanceWithCS2Info(tournament);

            return {
                ...enhancedTournament,
                participants,
                teams,
                matches
            };

        } catch (error) {
            console.error(`❌ Ошибка получения деталей турнира ${tournamentId}:`, error.message);
            throw error;
        }
    }

    /**
     * 🆕 Улучшение турнира с CS2-специфичной информацией
     */
    static _enhanceWithCS2Info(tournament) {
        if (tournament.game === 'Counter-Strike 2' && tournament.format !== 'mix') {
            return {
                ...tournament,
                display_participant_type: this._getCS2DisplayName(tournament.participant_type),
                min_team_size: this._getCS2MinTeamSize(tournament.participant_type),
                is_cs2_tournament: true
            };
        }

        return {
            ...tournament,
            display_participant_type: this._getStandardDisplayName(tournament.participant_type),
            is_cs2_tournament: false
        };
    }

    /**
     * 🆕 Получить отображаемое имя для CS2 типов
     */
    static _getCS2DisplayName(participantType) {
        const names = {
            'cs2_classic_5v5': 'Классический 5х5',
            'cs2_wingman_2v2': 'Wingman 2х2'
        };
        return names[participantType] || participantType;
    }

    /**
     * 🆕 Получить минимальный размер команды для CS2
     */
    static _getCS2MinTeamSize(participantType) {
        const sizes = {
            'cs2_classic_5v5': 5,
            'cs2_wingman_2v2': 2
        };
        return sizes[participantType] || 5;
    }

    /**
     * 🆕 Получить стандартное отображаемое имя
     */
    static _getStandardDisplayName(participantType) {
        const names = {
            'team': 'Командный',
            'solo': 'Одиночный'
        };
        return names[participantType] || participantType;
    }

    /**
     * Проверка прав пользователя на выполнение действий с турниром
     */
    static async checkUserPermission(tournamentId, userId, permission = 'general') {
        try {
            const tournament = await TournamentRepository.getById(tournamentId);
            if (!tournament) {
                return false;
            }

            // Создатель турнира имеет все права
            if (tournament.created_by === userId) {
                return true;
            }

            // Проверяем администраторов турнира
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (isAdmin) {
                return true;
            }

            // Для микс турниров и CS2 турниров проверяем специфичные права
            if (['mix', 'cs2_classic_5v5', 'cs2_wingman_2v2'].includes(tournament.format) || 
                ['cs2_classic_5v5', 'cs2_wingman_2v2'].includes(tournament.participant_type)) {
                
                // Права управления командами для микс и CS2 турниров
                if (permission === 'manage_teams') {
                    return tournament.created_by === userId || isAdmin;
                }
            }

            return false;

        } catch (error) {
            console.error(`❌ Ошибка проверки прав пользователя ${userId} для турнира ${tournamentId}:`, error.message);
            return false;
        }
    }

    /**
     * Проверка наличия матчей в турнире
     * @param {number} tournamentId - ID турнира
     * @returns {boolean} - есть ли матчи в турнире
     */
    static async hasMatches(tournamentId) {
        console.log(`🔍 [TournamentService] Проверка наличия матчей в турнире ${tournamentId}`);
        
        try {
            const matchesCount = await MatchRepository.getCountByTournamentId(tournamentId);
            const hasMatches = matchesCount > 0;
            
            console.log(`📊 [hasMatches] Турнир ${tournamentId}: ${matchesCount} матчей, hasMatches: ${hasMatches}`);
            return hasMatches;
            
        } catch (error) {
            console.error(`❌ [hasMatches] Ошибка проверки матчей турнира ${tournamentId}:`, error);
            return false;
        }
    }

    // Получение победителей последних турниров
    static async getWinners(limit = 5) {
        try {
            const result = await pool.query(`
                SELECT 
                    t.id,
                    t.name as tournament_name,
                    t.game,
                    t.completed_at as date,
                    CASE 
                        WHEN t.tournament_type = 'team' THEN tt.name
                        ELSE u.username
                    END as winner_name,
                    CASE 
                        WHEN t.tournament_type = 'team' THEN tt.id
                        ELSE tp.user_id
                    END as winner_id,
                    '$' || COALESCE(t.prize_pool, 50000) as prize
                FROM tournaments t
                LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id AND tp.placement = 1
                LEFT JOIN users u ON u.id = tp.user_id
                LEFT JOIN tournament_teams tt ON tt.tournament_id = t.id 
                    AND EXISTS (
                        SELECT 1 FROM tournament_team_members ttm 
                        WHERE ttm.team_id = tt.id AND ttm.participant_id = tp.id
                    )
                WHERE t.status = 'completed' 
                    AND t.completed_at IS NOT NULL
                ORDER BY t.completed_at DESC
                LIMIT $1
            `, [limit]);

            return result.rows;
        } catch (error) {
            console.error('Ошибка при получении победителей:', error);
            throw error;
        }
    }
}

module.exports = TournamentService; 