/**
 * 🏗️ СЕРВИС ГЕНЕРАЦИИ ТУРНИРНЫХ СЕТОК V2.0
 * 
 * Универсальный сервис для генерации турнирных сеток различных типов:
 * - Single Elimination
 * - Double Elimination
 * - Round Robin (планируется)
 * - Swiss System (планируется)
 */

const { SingleEliminationEngine } = require('./SingleEliminationEngine');
const { DoubleEliminationEngine } = require('./DoubleEliminationEngine');
const { SeedingFactory, SEEDING_TYPES } = require('../../utils/tournament/seedingAlgorithms');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { broadcastTournamentUpdate } = require('../../notifications');
const pool = require('../../db');

/**
 * 🏗️ Основной класс сервиса генерации турнирных сеток
 */
class BracketGenerationService {
    
    /**
     * 🚀 Генерация турнирной сетки (универсальный метод)
     * @param {number} tournamentId - ID турнира
     * @param {number} userId - ID пользователя
     * @param {Object} options - Опции генерации
     * @returns {Object} - Результат генерации
     */
    static async generateBracket(tournamentId, userId, options = {}) {
        const startTime = Date.now();
        console.log(`🚀 [BracketGenerationService] Генерация сетки для турнира ${tournamentId}`);
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. Получаем турнир с валидацией
            const tournament = await this._getTournamentWithValidation(tournamentId, userId, client);
            
            // 2. Проверяем права доступа
            await this._checkBracketGenerationPermission(tournamentId, userId, client);
            
            // 3. Получаем участников
            const participants = await this._getParticipantsForBracket(tournament, client);
            
            // 4. Проверяем минимальное количество участников
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для генерации турнирной сетки (минимум 2)');
            }
            
            // 5. Очищаем существующую сетку
            await this._clearExistingBracket(tournamentId, client);
            
            // 🆕 6. Обновляем тип турнирной сетки если передан новый тип
            if (options.bracketType && options.bracketType !== tournament.bracket_type) {
                console.log(`🏆 [BracketGenerationService] Обновление типа сетки: ${tournament.bracket_type} → ${options.bracketType}`);
                
                // Валидация типа сетки
                const validBracketTypes = ['single_elimination', 'double_elimination'];
                if (!validBracketTypes.includes(options.bracketType)) {
                    throw new Error(`Неподдерживаемый тип сетки: ${options.bracketType}`);
                }
                
                // Сохраняем старое значение для логирования
                const oldBracketType = tournament.bracket_type;
                
                // Обновляем в базе данных
                await client.query(
                    'UPDATE tournaments SET bracket_type = $1 WHERE id = $2',
                    [options.bracketType, tournamentId]
                );
                
                // Обновляем объект tournament для дальнейшего использования
                tournament.bracket_type = options.bracketType;
                
                // 🆕 Логируем событие изменения типа сетки
                await logTournamentEvent(tournamentId, userId, 'bracket_type_changed', {
                    old_bracket_type: oldBracketType,
                    new_bracket_type: options.bracketType,
                    during_regeneration: true
                });
                
                console.log(`✅ [BracketGenerationService] Тип сетки обновлен на "${options.bracketType}"`);
            }
            
            // 7. Подготавливаем опции распределения
            const seedingOptions = this._prepareSeedingOptions(tournament, options);
            
            // 8. Генерируем сетку в зависимости от типа
            const generationResult = await this._generateBracketByType(tournament, participants, seedingOptions);
            
            if (!generationResult.success) {
                throw new Error(generationResult.error);
            }
            
            // 9. Обновляем статус турнира
            await this._updateTournamentAfterGeneration(tournament, generationResult, client);
            
            // 10. Логируем событие
            await logTournamentEvent(tournamentId, userId, 'bracket_generated', {
                bracketType: tournament.bracket_type,
                participants: participants.length,
                matches: generationResult.matches.length,
                seedingType: seedingOptions.seedingType,
                generationTime: Date.now() - startTime
            });
            
            await client.query('COMMIT');
            
            const duration = Date.now() - startTime;
            console.log(`✅ [BracketGenerationService] Сетка успешно сгенерирована за ${duration}ms`);
            
            // 11. Отправляем WebSocket обновления
            const updatedTournament = await TournamentRepository.getByIdWithCreator(tournamentId);
            broadcastTournamentUpdate(tournamentId, updatedTournament);
            
            return {
                success: true,
                message: `Турнирная сетка ${tournament.bracket_type} успешно сгенерирована`,
                tournament: updatedTournament,
                matches: generationResult.matches,
                excludedParticipants: generationResult.excludedParticipants || [],
                bracketMath: generationResult.bracketMath,
                seedingInfo: generationResult.seedingInfo,
                generationTime: duration
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            
            const duration = Date.now() - startTime;
            console.error(`❌ [BracketGenerationService] Ошибка генерации (${duration}ms):`, error.message);
            
            return {
                success: false,
                error: error.message,
                generationTime: duration
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
        
        // Регенерация это по сути генерация с флагом принудительной очистки
        return await this.generateBracket(tournamentId, userId, {
            ...options,
            forceRegenerate: true
        });
    }
    
    /**
     * 🎲 Предварительный просмотр распределения
     * @param {number} tournamentId - ID турнира
     * @param {Object} options - Опции предпросмотра
     * @returns {Object} - Результат предпросмотра
     */
    static async previewSeeding(tournamentId, options = {}) {
        console.log(`🎲 [BracketGenerationService] Предпросмотр распределения для турнира ${tournamentId}`);
        
        try {
            // Получаем турнир
            const tournament = await TournamentRepository.getById(tournamentId);
            if (!tournament) {
                throw new Error('Турнир не найден');
            }
            
            // Получаем участников
            const participants = await this._getParticipantsForBracket(tournament, pool);
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для предпросмотра (минимум 2)');
            }
            
            // Подготавливаем опции распределения
            const seedingOptions = this._prepareSeedingOptions(tournament, options);
            
            // Применяем алгоритм распределения
            const seededParticipants = SeedingFactory.createSeeding(
                seedingOptions.seedingType,
                participants,
                participants.length,
                seedingOptions.seedingOptions
            );
            
            return {
                success: true,
                participants: seededParticipants,
                excludedParticipants: [],
                seedingInfo: {
                    type: seedingOptions.seedingType,
                    participantsUsed: seededParticipants.length,
                    participantsExcluded: 0
                }
            };
            
        } catch (error) {
            console.error(`❌ [BracketGenerationService] Ошибка предпросмотра:`, error.message);
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 🏗️ Получение турнира с валидацией
     * @private
     */
    static async _getTournamentWithValidation(tournamentId, userId, client) {
        const tournament = await TournamentRepository.getById(tournamentId);
        
        if (!tournament) {
            throw new Error('Турнир не найден');
        }
        
        // 🔧 УПРОЩЕННАЯ ЛОГИКА: Разрешаем генерацию только для активных турниров
        // Поскольку статус больше не меняется автоматически после генерации сетки
        if (tournament.status === 'active') {
            return tournament;
        }
        
        // Для турниров в других статусах предоставляем информативные сообщения
        if (tournament.status === 'in_progress') {
            throw new Error('Турнир уже запущен. Для изменения сетки сначала сбросьте результаты матчей и вернитесь к активному статусу.');
        }
        
        if (tournament.status === 'completed') {
            throw new Error('Турнир завершен. Для изменения сетки сначала сбросьте результаты матчей.');
        }
        
        throw new Error(`Турнирная сетка может быть сгенерирована только для активных турниров. Текущий статус: "${tournament.status}"`);
    }
    
    /**
     * 🛡️ Проверка прав доступа для генерации сетки
     * @private
     */
    static async _checkBracketGenerationPermission(tournamentId, userId, client) {
        const tournament = await TournamentRepository.getById(tournamentId);
        
        // Проверяем, является ли пользователь создателем турнира
        if (tournament.created_by !== userId) {
            // Проверяем, является ли пользователь администратором турнира
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (!isAdmin) {
                throw new Error('Только создатель турнира или администратор может генерировать турнирную сетку');
            }
        }
    }
    
    /**
     * 👥 Получение участников для турнирной сетки
     * @private
     */
    static async _getParticipantsForBracket(tournament, client) {
        if (tournament.format === 'mix') {
            // Для микс-турниров используем сгенерированные команды
            return await this._getMixTeams(tournament.id, client);
        } else if (tournament.participant_type === 'team') {
            // Для командных турниров используем команды
            return await TournamentRepository.getTeamsWithMembers(tournament.id);
        } else {
            // Для одиночных турниров используем участников
            return await ParticipantRepository.getByTournamentId(tournament.id);
        }
    }
    
    /**
     * 🏆 Получение микс-команд
     * @private
     */
    static async _getMixTeams(tournamentId, client) {
        const teams = await TeamRepository.getByTournamentId(tournamentId);
        
        if (teams.length === 0) {
            throw new Error('Для генерации турнирной сетки микс-турнира необходимо сначала сформировать команды');
        }
        
        // Возвращаем команды в формате, подходящем для генерации сетки
        return teams.map(team => ({
            id: team.id,
            name: team.name,
            type: 'team',
            members: team.members || []
        }));
    }
    
    /**
     * ⚙️ Подготовка опций распределения
     * @private
     */
    static _prepareSeedingOptions(tournament, options) {
        const seedingType = options.seedingType || SEEDING_TYPES.RANDOM;
        
        const seedingOptions = {
            seedingType,
            seedingOptions: {
                ratingField: tournament.format === 'mix' ? 'team_rating' : 'faceit_elo',
                ...options.seedingOptions
            },
            thirdPlaceMatch: options.thirdPlaceMatch || false,
            bracketType: tournament.bracket_type || 'single_elimination'
        };
        
        // Дополнительные опции для микс-турниров
        if (tournament.format === 'mix') {
            seedingOptions.seedingOptions.mixRatingType = tournament.mix_rating_type || 'faceit';
        }
        
        return seedingOptions;
    }
    
    /**
     * 🗑️ Очистка существующей турнирной сетки
     * @private
     */
    static async _clearExistingBracket(tournamentId, client) {
        console.log(`🗑️ [BracketGenerationService] Очистка существующей сетки турнира ${tournamentId}`);
        
        // Удаляем все матчи турнира
        const result = await client.query(
            'DELETE FROM matches WHERE tournament_id = $1',
            [tournamentId]
        );
        
        if (result.rowCount > 0) {
            console.log(`   Удалено ${result.rowCount} матчей`);
        }
        
        // Сбрасываем статус турнира
        await client.query(
            'UPDATE tournaments SET status = $1 WHERE id = $2',
            ['active', tournamentId]
        );
    }
    
    /**
     * 🎯 Генерация сетки в зависимости от типа
     * @private
     */
    static async _generateBracketByType(tournament, participants, seedingOptions) {
        const bracketType = tournament.bracket_type || 'single_elimination';
        
        console.log(`🎯 [BracketGenerationService] Генерация сетки типа: ${bracketType}`);
        
        switch (bracketType) {
            case 'single_elimination':
                return await SingleEliminationEngine.generateBracket(
                    tournament.id,
                    participants,
                    seedingOptions
                );
                
            case 'double_elimination':
                return await DoubleEliminationEngine.generateBracket(
                    tournament.id,
                    participants,
                    seedingOptions
                );
                
            default:
                throw new Error(`Неподдерживаемый тип турнирной сетки: ${bracketType}`);
        }
    }
    
    /**
     * 📊 Обновление турнира после генерации
     * @private
     */
    static async _updateTournamentAfterGeneration(tournament, generationResult, client) {
        // 🔧 ИСПРАВЛЕНО: НЕ меняем статус турнира автоматически
        // Турнир должен оставаться в статусе 'active' после генерации сетки
        // и переходить в 'in_progress' только при ручном запуске через startTournament()
        
        console.log(`📊 [BracketGenerationService] Турнир ${tournament.id} готов после генерации сетки (статус: ${tournament.status})`);
        console.log(`💡 [BracketGenerationService] Для запуска турнира используйте кнопку "Начать турнир"`);
        
        // Здесь можно добавить другую логику обновления турнира при необходимости
        // Например, обновление времени последней генерации сетки
        // await client.query(
        //     'UPDATE tournaments SET bracket_generated_at = CURRENT_TIMESTAMP WHERE id = $1',
        //     [tournament.id]
        // );
    }
    
    /**
     * 📊 Получение статистики турнирной сетки
     * @param {number} tournamentId - ID турнира
     * @returns {Object} - Статистика сетки
     */
    static async getBracketStatistics(tournamentId) {
        console.log(`📊 [BracketGenerationService] Получение статистики сетки для турнира ${tournamentId}`);
        
        try {
            const tournament = await TournamentRepository.getById(tournamentId);
            if (!tournament) {
                throw new Error('Турнир не найден');
            }
            
            // Получаем матчи турнира
            const matches = await pool.query(
                'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
                [tournamentId]
            );
            
            // Группируем матчи по типам
            const matchesByType = {};
            matches.rows.forEach(match => {
                if (!matchesByType[match.bracket_type]) {
                    matchesByType[match.bracket_type] = [];
                }
                matchesByType[match.bracket_type].push(match);
            });
            
            // Подсчитываем статистику
            const statistics = {
                tournamentId,
                bracketType: tournament.bracket_type,
                totalMatches: matches.rows.length,
                matchesByType: Object.keys(matchesByType).reduce((acc, type) => {
                    acc[type] = matchesByType[type].length;
                    return acc;
                }, {}),
                completedMatches: matches.rows.filter(m => m.status === 'completed').length,
                pendingMatches: matches.rows.filter(m => m.status === 'pending').length,
                rounds: Math.max(...matches.rows.map(m => m.round), 0),
                generatedAt: tournament.updated_at
            };
            
            return {
                success: true,
                statistics
            };
            
        } catch (error) {
            console.error(`❌ [BracketGenerationService] Ошибка получения статистики:`, error.message);
            
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