/**
 * 🏗️ ОСНОВНОЙ СЕРВИС ГЕНЕРАЦИИ ТУРНИРНОЙ СЕТКИ
 * 
 * Центральный сервис для генерации турнирных сеток различных типов
 * с интеграцией в существующую модульную архитектуру
 */

const { SingleEliminationEngine } = require('./SingleEliminationEngine');
const { DoubleEliminationEngine } = require('./DoubleEliminationEngine');
const { SeedingFactory, SEEDING_TYPES } = require('../../utils/tournament/seedingAlgorithms');
const { BracketMath } = require('../../utils/tournament/bracketMath');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { broadcastTournamentUpdate } = require('../../notifications');
const pool = require('../../db');

/**
 * 🎯 Основной сервис генерации турнирной сетки
 */
class BracketGenerationService {
    
    /**
     * 🚀 Генерация турнирной сетки для турнира
     * @param {number} tournamentId - ID турнира
     * @param {number} userId - ID пользователя, инициирующего генерацию
     * @param {Object} options - Опции генерации
     * @returns {Object} - Результат генерации
     */
    static async generateBracket(tournamentId, userId, options = {}) {
        const startTime = Date.now();
        console.log(`🚀 [BracketGenerationService] Начало генерации сетки для турнира ${tournamentId}`);
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. Получаем данные турнира и проверяем права
            const tournament = await this._getTournamentWithValidation(tournamentId, userId, client);
            
            // 2. Получаем участников турнира
            const participants = await this._getParticipantsForBracket(tournament, client);
            
            // 3. Применяем настройки распределения
            const seedingOptions = this._prepareSeedingOptions(tournament, options);
            
            // 4. Очищаем существующую сетку (если есть)
            await this._clearExistingBracket(tournamentId, client);
            
            // 5. Генерируем новую сетку
            const generationResult = await this._generateBracketByType(
                tournament,
                participants,
                seedingOptions
            );
            
            if (!generationResult.success) {
                throw new Error(generationResult.error);
            }
            
            // 6. Обновляем данные турнира
            await this._updateTournamentAfterGeneration(tournament, generationResult, client);
            
            // 7. Логируем событие
            await logTournamentEvent(
                tournamentId,
                userId,
                'bracket_generated',
                {
                    bracketType: tournament.bracket_type,
                    seedingType: seedingOptions.seedingType,
                    participantsUsed: generationResult.seedingInfo.participantsUsed,
                    participantsExcluded: generationResult.seedingInfo.participantsExcluded,
                    totalMatches: generationResult.matches.length,
                    generationTime: generationResult.generationTime
                }
            );
            
            await client.query('COMMIT');
            
            // 8. Отправляем обновления через WebSocket
            broadcastTournamentUpdate(tournamentId, {
                type: 'bracket_generated',
                data: {
                    matchesCount: generationResult.matches.length,
                    participantsUsed: generationResult.seedingInfo.participantsUsed
                }
            });
            
            const totalDuration = Date.now() - startTime;
            console.log(`✅ [BracketGenerationService] Сетка успешно сгенерирована за ${totalDuration}ms`);
            
            return {
                success: true,
                tournament,
                matches: generationResult.matches,
                excludedParticipants: generationResult.excludedParticipants,
                seedingInfo: generationResult.seedingInfo,
                bracketMath: generationResult.bracketMath,
                generationTime: totalDuration,
                message: `Турнирная сетка успешно сгенерирована. Создано матчей: ${generationResult.matches.length}`
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            
            const totalDuration = Date.now() - startTime;
            console.error(`❌ [BracketGenerationService] Ошибка генерации (${totalDuration}ms):`, error.message);
            
            // Логируем ошибку
            try {
                await logTournamentEvent(
                    tournamentId,
                    userId,
                    'bracket_generation_failed',
                    { error: error.message, duration: totalDuration }
                );
            } catch (logError) {
                console.error('Ошибка логирования:', logError);
            }
            
            return {
                success: false,
                error: error.message,
                generationTime: totalDuration
            };
            
        } finally {
            client.release();
        }
    }
    
    /**
     * 🔄 Регенерация турнирной сетки
     * @param {number} tournamentId - ID турнира
     * @param {number} userId - ID пользователя
     * @param {Object} options - Опции регенерации
     * @returns {Object} - Результат регенерации
     */
    static async regenerateBracket(tournamentId, userId, options = {}) {
        console.log(`🔄 [BracketGenerationService] Регенерация сетки для турнира ${tournamentId}`);
        
        // Регенерация - это просто генерация с принудительной очисткой
        return await this.generateBracket(tournamentId, userId, {
            ...options,
            forceRegenerate: true
        });
    }
    
    /**
     * 🎲 Предварительный просмотр распределения участников
     * @param {number} tournamentId - ID турнира
     * @param {Object} options - Опции распределения
     * @returns {Object} - Предварительный результат распределения
     */
    static async previewSeeding(tournamentId, options = {}) {
        console.log(`🎲 [BracketGenerationService] Предварительный просмотр распределения для турнира ${tournamentId}`);
        
        try {
            // Получаем данные турнира
            const tournament = await TournamentRepository.getById(tournamentId);
            if (!tournament) {
                throw new Error('Турнир не найден');
            }
            
            // Получаем участников
            const participants = await this._getParticipantsForBracket(tournament);
            
            // Рассчитываем математические параметры
            const bracketMath = BracketMath.calculateSingleEliminationParams(
                participants.length,
                { thirdPlaceMatch: options.thirdPlaceMatch || false }
            );
            
            // Применяем распределение
            const seedingOptions = this._prepareSeedingOptions(tournament, options);
            const seededParticipants = SeedingFactory.createSeeding(
                seedingOptions.seedingType,
                participants,
                bracketMath.actualParticipants,
                seedingOptions.seedingOptions
            );
            
            return {
                success: true,
                participants: seededParticipants,
                excludedParticipants: participants.slice(bracketMath.actualParticipants),
                bracketMath,
                seedingInfo: {
                    type: seedingOptions.seedingType,
                    participantsUsed: seededParticipants.length,
                    participantsExcluded: bracketMath.excludedParticipants
                }
            };
            
        } catch (error) {
            console.error(`❌ Ошибка предварительного просмотра:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 🏆 Получение турнира с валидацией прав доступа
     * @param {number} tournamentId - ID турнира
     * @param {number} userId - ID пользователя
     * @param {Object} client - Клиент БД
     * @returns {Object} - Данные турнира
     */
    static async _getTournamentWithValidation(tournamentId, userId, client) {
        const tournament = await TournamentRepository.getById(tournamentId, client);
        
        if (!tournament) {
            throw new Error('Турнир не найден');
        }
        
        // Проверяем права на генерацию сетки
        const hasPermission = await this._checkBracketGenerationPermission(tournamentId, userId, client);
        if (!hasPermission) {
            throw new Error('У вас нет прав на генерацию турнирной сетки для этого турнира');
        }
        
        // Проверяем статус турнира
        if (tournament.status !== 'active') {
            throw new Error(`Нельзя генерировать сетку для турнира со статусом: ${tournament.status}`);
        }
        
        // Проверяем поддерживаемый тип сетки
        if (!tournament.bracket_type || tournament.bracket_type !== 'single_elimination') {
            throw new Error(`Неподдерживаемый тип турнирной сетки: ${tournament.bracket_type}`);
        }
        
        return tournament;
    }
    
    /**
     * 🔐 Проверка прав на генерацию сетки
     * @param {number} tournamentId - ID турнира
     * @param {number} userId - ID пользователя
     * @param {Object} client - Клиент БД
     * @returns {boolean} - Есть ли права
     */
    static async _checkBracketGenerationPermission(tournamentId, userId, client) {
        try {
            // Проверяем, является ли пользователь создателем турнира
            const tournament = await TournamentRepository.getById(tournamentId, client);
            if (tournament && tournament.created_by === userId) {
                return true;
            }
            
            // Проверяем, является ли пользователь администратором турнира
            const adminCheck = await client.query(
                'SELECT id FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, userId]
            );
            
            if (adminCheck.rows.length > 0) {
                return true;
            }
            
            // Проверяем роль пользователя (администраторы системы)
            const userCheck = await client.query(
                'SELECT role FROM users WHERE id = $1',
                [userId]
            );
            
            if (userCheck.rows.length > 0 && userCheck.rows[0].role === 'admin') {
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('Ошибка проверки прав:', error);
            return false;
        }
    }
    
    /**
     * 👥 Получение участников для генерации сетки
     * @param {Object} tournament - Данные турнира
     * @param {Object} client - Клиент БД
     * @returns {Array} - Массив участников
     */
    static async _getParticipantsForBracket(tournament, client) {
        if (tournament.format === 'mix') {
            // Для микс турниров получаем команды
            return await this._getMixTeams(tournament.id, client);
        } else {
            // Для обычных турниров получаем участников
            return await ParticipantRepository.getByTournamentId(tournament.id, client);
        }
    }
    
    /**
     * 🎮 Получение команд для микс турнира
     * @param {number} tournamentId - ID турнира
     * @param {Object} client - Клиент БД
     * @returns {Array} - Массив команд
     */
    static async _getMixTeams(tournamentId, client) {
        try {
            const query = `
                SELECT 
                    tt.id,
                    tt.name,
                    tt.creator_id,
                    COALESCE(
                        JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'id', tp.id,
                                'user_id', tp.user_id,
                                'name', tp.name,
                                'faceit_elo', tp.faceit_elo,
                                'cs2_premier_rank', tp.cs2_premier_rank
                            )
                        ) FILTER (WHERE tp.id IS NOT NULL), 
                        '[]'::json
                    ) as members
                FROM tournament_teams tt
                LEFT JOIN tournament_team_members ttm ON tt.id = ttm.team_id
                LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                WHERE tt.tournament_id = $1
                GROUP BY tt.id, tt.name, tt.creator_id
                ORDER BY tt.id
            `;
            
            const result = await (client || pool).query(query, [tournamentId]);
            
            return result.rows.map(team => ({
                id: team.id,
                name: team.name,
                type: 'team',
                members: team.members || [],
                captain_id: team.creator_id
            }));
            
        } catch (error) {
            console.error('Ошибка получения микс команд:', error);
            throw new Error('Не удалось получить команды для микс турнира');
        }
    }
    
    /**
     * ⚙️ Подготовка опций распределения участников
     * @param {Object} tournament - Данные турнира
     * @param {Object} options - Переданные опции
     * @returns {Object} - Подготовленные опции
     */
    static _prepareSeedingOptions(tournament, options) {
        // Получаем тип распределения
        let seedingType = options.seedingType || tournament.seeding_type || SEEDING_TYPES.RANDOM;
        
        // Валидируем тип распределения
        if (!Object.values(SEEDING_TYPES).includes(seedingType)) {
            console.warn(`Неверный тип распределения: ${seedingType}, используем случайное`);
            seedingType = SEEDING_TYPES.RANDOM;
        }
        
        // Подготавливаем опции для алгоритма распределения
        const seedingOptions = {
            ratingType: options.ratingType || 'faceit_elo',
            direction: options.direction || 'desc',
            customOrder: options.customOrder || [],
            balanceTeams: options.balanceTeams !== false // по умолчанию true
        };
        
        // Добавляем специфичные настройки из конфигурации турнира
        if (tournament.seeding_config) {
            Object.assign(seedingOptions, tournament.seeding_config);
        }
        
        return {
            seedingType,
            seedingOptions,
            thirdPlaceMatch: options.thirdPlaceMatch || false
        };
    }
    
    /**
     * 🗑️ Очистка существующей турнирной сетки
     * @param {number} tournamentId - ID турнира
     * @param {Object} client - Клиент БД
     */
    static async _clearExistingBracket(tournamentId, client) {
        console.log(`🗑️ Очистка существующей сетки турнира ${tournamentId}`);
        
        try {
            // Сначала очищаем все foreign key ссылки
            await client.query(`
                UPDATE matches 
                SET 
                    next_match_id = NULL,
                    loser_next_match_id = NULL,
                    source_match1_id = NULL,
                    source_match2_id = NULL
                WHERE tournament_id = $1
            `, [tournamentId]);
            
            // Затем удаляем все матчи
            const deleteResult = await client.query(
                'DELETE FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            console.log(`✅ Удалено матчей: ${deleteResult.rowCount}`);
            
        } catch (error) {
            console.error('Ошибка очистки сетки:', error);
            throw new Error('Не удалось очистить существующую турнирную сетку');
        }
    }
    
    /**
     * 🏗️ Генерация сетки в зависимости от типа турнира
     * @param {Object} tournament - Данные турнира
     * @param {Array} participants - Участники
     * @param {Object} seedingOptions - Опции распределения
     * @returns {Object} - Результат генерации
     */
    static async _generateBracketByType(tournament, participants, seedingOptions) {
        // 🆕 Используем тип сетки из опций если он задан, иначе из турнира
        const bracketType = seedingOptions.bracketType || tournament.bracket_type;
        
        console.log(`🏗️ Генерация сетки типа: ${bracketType}`);
        
        let result;
        switch (bracketType) {
            case 'single_elimination':
                result = await SingleEliminationEngine.generateBracket(
                    tournament.id,
                    participants,
                    seedingOptions
                );
                break;
                
            case 'double_elimination':
                result = await DoubleEliminationEngine.generateBracket(
                    tournament.id,
                    participants,
                    seedingOptions
                );
                break;
            
            default:
                throw new Error(`Неподдерживаемый тип турнирной сетки: ${bracketType}`);
        }
        
        // 🆕 Добавляем тип сетки в результат для последующего обновления
        if (result && result.success) {
            result.bracketType = bracketType;
        }
        
        return result;
    }
    
    /**
     * 📊 Обновление данных турнира после генерации
     * @private
     */
    static async _updateTournamentAfterGeneration(tournament, generationResult, client) {
        // Обновляем количество исключенных участников
        await client.query(
            'UPDATE tournaments SET excluded_participants_count = $1 WHERE id = $2',
            [generationResult.seedingInfo.participantsExcluded, tournament.id]
        );
        
        console.log(`📊 Обновлены данные турнира: исключено ${generationResult.seedingInfo.participantsExcluded} участников`);
        
        // 🆕 Обновляем тип сетки если он изменился
        if (generationResult.bracketType && generationResult.bracketType !== tournament.bracket_type) {
            await client.query(
                'UPDATE tournaments SET bracket_type = $1 WHERE id = $2',
                [generationResult.bracketType, tournament.id]
            );
            console.log(`🏆 Тип сетки обновлён на: ${generationResult.bracketType}`);
        }
    }
    
    /**
     * 📈 Получение статистики турнирной сетки
     * @param {number} tournamentId - ID турнира
     * @returns {Object} - Статистика сетки
     */
    static async getBracketStatistics(tournamentId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_matches,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed_matches,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_matches,
                    COUNT(*) FILTER (WHERE status = 'ongoing') as ongoing_matches,
                    COUNT(DISTINCT round) as total_rounds,
                    MAX(round) as final_round,
                    COUNT(*) FILTER (WHERE is_third_place_match = true) as third_place_matches
                FROM matches 
                WHERE tournament_id = $1
            `;
            
            const result = await pool.query(query, [tournamentId]);
            const stats = result.rows[0];
            
            // Рассчитываем прогресс турнира
            const progress = stats.total_matches > 0 
                ? Math.round((stats.completed_matches / stats.total_matches) * 100)
                : 0;
            
            return {
                success: true,
                statistics: {
                    totalMatches: parseInt(stats.total_matches),
                    completedMatches: parseInt(stats.completed_matches),
                    pendingMatches: parseInt(stats.pending_matches),
                    ongoingMatches: parseInt(stats.ongoing_matches),
                    totalRounds: parseInt(stats.total_rounds),
                    finalRound: parseInt(stats.final_round),
                    hasThirdPlaceMatch: parseInt(stats.third_place_matches) > 0,
                    progressPercentage: progress
                }
            };
            
        } catch (error) {
            console.error('Ошибка получения статистики сетки:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = {
    BracketGenerationService,
    SEEDING_TYPES
}; 