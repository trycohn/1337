const pool = require('../../db');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const MatchRepository = require('../../repositories/tournament/MatchRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
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
            start_date, description, bracket_type, team_size, mix_rating_type
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
            mix_rating_type: (format === 'mix' && mix_rating_type) ? mix_rating_type : null
        });

        // Логируем создание турнира
        await logTournamentEvent(tournament.id, userId, 'tournament_created', {
            name: tournament.name,
            game: tournament.game,
            format: tournament.format,
            mix_rating_type: tournament.mix_rating_type
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

        console.log('✅ TournamentService: Турнир обновлен');
        return updatedTournament;
    }

    /**
     * Удаление турнира
     */
    static async deleteTournament(tournamentId, userId) {
        console.log(`🗑️ TournamentService: Удаление турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (tournament.status !== 'active') {
            throw new Error('Турнир неактивен');
        }

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
        if (tournament.status !== 'active') {
            throw new Error('Можно начать только активный турнир');
        }

        // Проверка наличия сгенерированной сетки
        const matchesCount = await MatchRepository.getCountByTournamentId(tournamentId);
        if (matchesCount === 0) {
            throw new Error('Перед началом турнира необходимо сгенерировать сетку');
        }

        // Изменение статуса турнира
        await TournamentRepository.updateStatus(tournamentId, 'in_progress');

        // Получаем обновленные данные турнира
        const updatedTournament = await this.getTournamentById(tournamentId);

        // Отправляем обновление через WebSocket
        broadcastTournamentUpdate(tournamentId, updatedTournament);

        // Логируем старт турнира
        await logTournamentEvent(tournamentId, userId, 'tournament_started', {
            participantCount: updatedTournament.participant_count
        });

        // Отправляем объявление в чат турнира
        await sendTournamentChatAnnouncement(
            tournamentId,
            `Турнир "${updatedTournament.name}" начат`
        );

        console.log('✅ TournamentService: Турнир начат');
        return updatedTournament;
    }

    /**
     * Получение списка игр
     */
    static async getGames() {
        console.log('🎮 TournamentService: Получение списка игр');
        return await TournamentRepository.getGames();
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
        return await TournamentRepository.updateDescription(tournamentId, description);
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

        return await TournamentRepository.updateFullDescription(tournamentId, fullDescription);
    }

    /**
     * Обновление регламента турнира
     */
    static async updateRules(tournamentId, rules, userId) {
        console.log(`⚖️ TournamentService: Обновление регламента турнира ${tournamentId}`);

        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (tournament.status !== 'active') {
            throw new Error('Турнир неактивен');
        }

        return await TournamentRepository.updateRules(tournamentId, rules);
    }

    /**
     * Обновление призового фонда турнира
     */
    static async updatePrizePool(tournamentId, prizePool, userId) {
        console.log(`💰 TournamentService: Обновление призового фонда турнира ${tournamentId}`);

        await this._checkTournamentAccess(tournamentId, userId);
        return await TournamentRepository.updatePrizePool(tournamentId, prizePool);
    }

    /**
     * Обновление размера команды
     */
    static async updateTeamSize(tournamentId, teamSize, userId) {
        console.log(`📏 TournamentService: Обновление размера команды турнира ${tournamentId}`);

        if (!teamSize || ![2, 5].includes(parseInt(teamSize, 10))) {
            throw new Error('Неверный размер команды. Допустимые значения: 2 или 5');
        }

        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (tournament.format !== 'mix') {
            throw new Error('Изменение размера команды доступно только для mix-турниров');
        }

        if (!['active', 'pending'].includes(tournament.status)) {
            throw new Error('Изменение размера команды доступно только для турниров в статусе active или pending');
        }

        // Проверяем, не сгенерирована ли уже сетка
        const matchesCount = await MatchRepository.getCountByTournamentId(tournamentId);
        if (matchesCount > 0) {
            throw new Error('Нельзя изменить размер команды после генерации сетки турнира');
        }

        // Проверяем, не созданы ли уже команды
        const teamsCount = await TournamentRepository.getTeamsCount(tournamentId);
        if (teamsCount > 0) {
            // Удаляем существующие команды
            await TournamentRepository.deleteTeams(tournamentId);
        }

        return await TournamentRepository.updateTeamSize(tournamentId, teamSize);
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
     * Получение турнира по ID (простая версия без дополнительных данных)
     */
    static async getTournament(tournamentId) {
        console.log(`🔍 [TournamentService] Получение базовой информации о турнире ${tournamentId}`);
        return await TournamentRepository.getById(tournamentId);
    }

    /**
     * Проверка разрешений пользователя на действия с турниром
     */
    static async checkUserPermission(tournamentId, userId, permission = 'general') {
        console.log(`🔒 [TournamentService] Проверка разрешения "${permission}" для пользователя ${userId} в турнире ${tournamentId}`);
        
        try {
            const tournament = await TournamentRepository.getById(tournamentId);
            if (!tournament) {
                console.log(`❌ [checkUserPermission] Турнир ${tournamentId} не найден`);
                return false;
            }

            // Создатель турнира имеет все права
            if (tournament.created_by === userId) {
                console.log(`✅ [checkUserPermission] Пользователь ${userId} - создатель турнира`);
                return true;
            }

            // Проверяем администраторов турнира
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (isAdmin) {
                console.log(`✅ [checkUserPermission] Пользователь ${userId} - администратор турнира`);
                return true;
            }

            console.log(`❌ [checkUserPermission] Пользователь ${userId} не имеет прав на "${permission}" в турнире ${tournamentId}`);
            return false;

        } catch (error) {
            console.error(`❌ [checkUserPermission] Ошибка проверки разрешений:`, error);
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

    /**
     * Получение подробных данных турнира (алиас для getTournamentById)
     */
    static async getTournamentDetails(tournamentId) {
        return await this.getTournamentById(tournamentId);
    }
}

module.exports = TournamentService; 