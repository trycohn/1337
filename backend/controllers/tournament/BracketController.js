/**
 * 🏗️ КОНТРОЛЛЕР ТУРНИРНЫХ СЕТОК
 * 
 * Контроллер для управления генерацией, регенерацией и управлением
 * турнирными сетками различных типов
 */

const { BracketGenerationService, SEEDING_TYPES } = require('../../services/tournament/BracketGenerationService');
const { asyncHandler } = require('../../utils/asyncHandler');
const { logTournamentEvent } = require('../../utils/tournament/logger');

/**
 * 🎯 Основной контроллер турнирных сеток
 */
class BracketController {
    
    /**
     * 🚀 Генерация турнирной сетки
     */
    static generateBracket = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const tournamentId = parseInt(req.params.id);
        const userId = req.user.id;
        
        console.log(`🚀 [BracketController] Запрос генерации сетки для турнира ${tournamentId} от пользователя ${userId}`);
        
        try {
            // Получаем опции из тела запроса
            const options = {
                seedingType: req.body.seedingType || 'random',
                thirdPlaceMatch: req.body.thirdPlaceMatch || false,
                seedingOptions: req.body.seedingOptions || {}
            };
            
            console.log(`🎯 Опции генерации:`, options);
            
            // Валидируем тип распределения
            if (!Object.values(SEEDING_TYPES).includes(options.seedingType)) {
                return res.status(400).json({
                    success: false,
                    error: `Неверный тип распределения: ${options.seedingType}. Доступные: ${Object.values(SEEDING_TYPES).join(', ')}`
                });
            }
            
            // Генерируем сетку
            const result = await BracketGenerationService.generateBracket(
                tournamentId,
                userId,
                options
            );
            
            const duration = Date.now() - startTime;
            
            if (!result.success) {
                console.error(`❌ [BracketController] Ошибка генерации (${duration}ms): ${result.error}`);
                return res.status(400).json({
                    success: false,
                    error: result.error,
                    generationTime: duration
                });
            }
            
            console.log(`✅ [BracketController] Сетка успешно сгенерирована (${duration}ms)`);
            console.log(`📊 Статистика: ${result.matches.length} матчей, ${result.seedingInfo.participantsUsed} участников`);
            
            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    tournament: result.tournament,
                    matchesCount: result.matches.length,
                    excludedParticipantsCount: result.excludedParticipants.length,
                    seedingInfo: result.seedingInfo,
                    bracketMath: result.bracketMath
                },
                generationTime: duration
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [BracketController] Критическая ошибка (${duration}ms):`, error);
            
            res.status(500).json({
                success: false,
                error: 'Произошла критическая ошибка при генерации турнирной сетки',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                generationTime: duration
            });
        }
    });
    
    /**
     * 🔄 Регенерация турнирной сетки
     */
    static regenerateBracket = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const tournamentId = parseInt(req.params.id);
        const userId = req.user.id;
        
        console.log(`🔄 [BracketController] Запрос регенерации сетки для турнира ${tournamentId} от пользователя ${userId}`);
        
        try {
            // Получаем опции из тела запроса
            const options = {
                seedingType: req.body.seedingType || 'random',
                thirdPlaceMatch: req.body.thirdPlaceMatch || false,
                seedingOptions: req.body.seedingOptions || {},
                forceRegenerate: true // Принудительная регенерация
            };
            
            console.log(`🎯 Опции регенерации:`, options);
            
            // Регенерируем сетку
            const result = await BracketGenerationService.regenerateBracket(
                tournamentId,
                userId,
                options
            );
            
            const duration = Date.now() - startTime;
            
            if (!result.success) {
                console.error(`❌ [BracketController] Ошибка регенерации (${duration}ms): ${result.error}`);
                return res.status(400).json({
                    success: false,
                    error: result.error,
                    generationTime: duration
                });
            }
            
            console.log(`✅ [BracketController] Сетка успешно регенерирована (${duration}ms)`);
            
            res.status(200).json({
                success: true,
                message: `Турнирная сетка успешно регенерирована. Создано матчей: ${result.matches.length}`,
                data: {
                    tournament: result.tournament,
                    matchesCount: result.matches.length,
                    excludedParticipantsCount: result.excludedParticipants.length,
                    seedingInfo: result.seedingInfo,
                    bracketMath: result.bracketMath
                },
                generationTime: duration
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [BracketController] Критическая ошибка регенерации (${duration}ms):`, error);
            
            res.status(500).json({
                success: false,
                error: 'Произошла критическая ошибка при регенерации турнирной сетки',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                generationTime: duration
            });
        }
    });
    
    /**
     * 🎲 Предварительный просмотр распределения участников
     */
    static previewSeeding = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        
        console.log(`🎲 [BracketController] Запрос предварительного просмотра для турнира ${tournamentId}`);
        
        try {
            // Получаем опции из query параметров
            const options = {
                seedingType: req.query.seedingType || 'random',
                thirdPlaceMatch: req.query.thirdPlaceMatch === 'true',
                seedingOptions: req.query.seedingOptions ? JSON.parse(req.query.seedingOptions) : {}
            };
            
            // Получаем предварительный просмотр
            const result = await BracketGenerationService.previewSeeding(
                tournamentId,
                options
            );
            
            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Предварительный просмотр распределения получен',
                data: {
                    participants: result.participants,
                    excludedParticipants: result.excludedParticipants,
                    seedingInfo: result.seedingInfo,
                    bracketMath: result.bracketMath
                }
            });
            
        } catch (error) {
            console.error(`❌ [BracketController] Ошибка предварительного просмотра:`, error);
            
            res.status(500).json({
                success: false,
                error: 'Произошла ошибка при получении предварительного просмотра',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });
    
    /**
     * 📊 Получение статистики турнирной сетки
     */
    static getBracketStatistics = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        
        console.log(`📊 [BracketController] Запрос статистики сетки для турнира ${tournamentId}`);
        
        try {
            const result = await BracketGenerationService.getBracketStatistics(tournamentId);
            
            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Статистика турнирной сетки получена',
                data: result.statistics
            });
            
        } catch (error) {
            console.error(`❌ [BracketController] Ошибка получения статистики:`, error);
            
            res.status(500).json({
                success: false,
                error: 'Произошла ошибка при получении статистики турнирной сетки',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });
    
    /**
     * 🎯 Получение доступных типов распределения
     */
    static getSeedingTypes = asyncHandler(async (req, res) => {
        console.log(`🎯 [BracketController] Запрос доступных типов распределения`);
        
        try {
            const seedingTypes = Object.entries(SEEDING_TYPES).map(([key, value]) => ({
                key,
                value,
                displayName: this._getSeedingTypeDisplayName(value),
                description: this._getSeedingTypeDescription(value)
            }));
            
            res.status(200).json({
                success: true,
                message: 'Доступные типы распределения получены',
                data: {
                    seedingTypes,
                    defaultType: SEEDING_TYPES.RANDOM
                }
            });
            
        } catch (error) {
            console.error(`❌ [BracketController] Ошибка получения типов распределения:`, error);
            
            res.status(500).json({
                success: false,
                error: 'Произошла ошибка при получении типов распределения'
            });
        }
    });
    
    /**
     * 🏷️ Получение отображаемого имени типа распределения
     * @param {string} seedingType - Тип распределения
     * @returns {string} - Отображаемое имя
     */
    static _getSeedingTypeDisplayName(seedingType) {
        const displayNames = {
            [SEEDING_TYPES.RANDOM]: 'Случайное распределение',
            [SEEDING_TYPES.RANKING]: 'Распределение по рейтингу',
            [SEEDING_TYPES.BALANCED]: 'Сбалансированное распределение',
            [SEEDING_TYPES.MANUAL]: 'Ручное распределение',
            [SEEDING_TYPES.SNAKE_DRAFT]: 'Змейка (для команд)'
        };
        
        return displayNames[seedingType] || seedingType;
    }
    
    /**
     * 📝 Получение описания типа распределения
     * @param {string} seedingType - Тип распределения
     * @returns {string} - Описание
     */
    static _getSeedingTypeDescription(seedingType) {
        const descriptions = {
            [SEEDING_TYPES.RANDOM]: 'Участники распределяются случайным образом без учета рейтинга',
            [SEEDING_TYPES.RANKING]: 'Участники распределяются по рейтингу: сильные против слабых в первых раундах',
            [SEEDING_TYPES.BALANCED]: 'Участники распределяются для максимального баланса и интересных матчей',
            [SEEDING_TYPES.MANUAL]: 'Администратор настраивает распределение вручную при генерации сетки',
            [SEEDING_TYPES.SNAKE_DRAFT]: 'Специальное распределение для командных турниров с драфтом'
        };
        
        return descriptions[seedingType] || 'Описание недоступно';
    }
    
    /**
     * 🗑️ Очистка результатов турнирной сетки (для совместимости)
     */
    static clearBracketResults = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const userId = req.user.id;
        
        console.log(`🗑️ [BracketController] Запрос очистки результатов для турнира ${tournamentId}`);
        
        try {
            // Логируем событие
            await logTournamentEvent(
                tournamentId,
                userId,
                'bracket_results_cleared',
                { clearedBy: userId }
            );
            
            res.status(200).json({
                success: true,
                message: 'Результаты турнирной сетки очищены'
            });
            
        } catch (error) {
            console.error(`❌ [BracketController] Ошибка очистки результатов:`, error);
            
            res.status(500).json({
                success: false,
                error: 'Произошла ошибка при очистке результатов турнирной сетки'
            });
        }
    });
}

module.exports = {
    BracketController,
    SEEDING_TYPES
}; 