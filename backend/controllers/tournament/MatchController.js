const MatchService = require('../../services/tournament/MatchService');
const BracketService = require('../../services/tournament/BracketService');
const TournamentValidator = require('../../validators/tournament/TournamentValidator');
const { asyncHandler } = require('../../utils/asyncHandler');

class MatchController {
    // 🥊 Генерация турнирной сетки
    static generateBracket = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        console.log('🚀 [MatchController.generateBracket] МОДУЛЬНЫЙ РОУТЕР ПОЛУЧИЛ ЗАПРОС!');
        console.log('🚀 [MatchController.generateBracket] Tournament ID:', req.params.id);
        console.log('🚀 [MatchController.generateBracket] User ID:', req.user.id);
        console.log('🚀 [MatchController.generateBracket] Username:', req.user.username);
        console.log('🚀 [MatchController.generateBracket] Request body:', req.body);
        
        const { id: tournamentId } = req.params;
        const { thirdPlaceMatch } = req.body;
        const userId = req.user.id;
        
        console.log('🚀 [MatchController.generateBracket] thirdPlaceMatch:', thirdPlaceMatch);
        console.log('🚀 [MatchController.generateBracket] Вызываем BracketService.generateBracket...');
        
        try {
            const result = await BracketService.generateBracket(
                parseInt(tournamentId), 
                userId, 
                thirdPlaceMatch || false
            );
            
            const endTime = Date.now();
            console.log(`✅ [MatchController.generateBracket] Успешно завершено за ${endTime - startTime}ms`);
            
            res.status(200).json({
                success: true,
                message: result.message,
                tournament: result.tournament,
                matches: result.matches,
                totalMatches: result.totalMatches,
                existing: result.existing || false
            });
            
        } catch (error) {
            const endTime = Date.now();
            console.error(`❌ [MatchController.generateBracket] ОШИБКА после ${endTime - startTime}ms: ${error.message}`);
            console.error(`❌ [MatchController.generateBracket] Тип ошибки: ${error.name}`);
            console.error(`❌ [MatchController.generateBracket] Код ошибки: ${error.code || 'не определен'}`);
            console.error(`❌ [MatchController.generateBracket] Stack trace: ${error.stack}`);
            
            // 🆕 СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ БЛОКИРОВОК
            if (error.message.includes('заблокирован другим процессом')) {
                console.log(`🔍 [MatchController.generateBracket] Обнаружена проблема с блокировками, запускаем диагностику`);
                
                // Асинхронно запускаем диагностику (не блокируем ответ)
                BracketService.checkDatabaseLocks(parseInt(tournamentId)).catch(diagError => {
                    console.warn('⚠️ Ошибка асинхронной диагностики:', diagError.message);
                });
                
                return res.status(423).json({
                    error: 'Турнир временно заблокирован',
                    message: 'Турнир обрабатывается другим процессом. Попробуйте через 10-15 секунд.',
                    details: 'Если проблема повторяется, обратитесь к администратору',
                    tournamentId: parseInt(tournamentId),
                    retryAfter: 15,
                    diagnosticAvailable: true
                });
            }
            
            // 🆕 ОБРАБОТКА ДРУГИХ ОШИБОК БЛОКИРОВОК И ТАЙМАУТОВ
            if (error.code === '57014' || error.message.includes('timeout') || error.message.includes('таймаут')) {
                return res.status(408).json({
                    error: 'Операция прервана по таймауту',
                    message: 'Генерация сетки заняла слишком много времени. Попробуйте еще раз.',
                    tournamentId: parseInt(tournamentId),
                    retryAfter: 10
                });
            }
            
            if (error.code === '25P02') {
                return res.status(409).json({
                    error: 'Конфликт транзакций',
                    message: 'Произошел конфликт при обработке запроса. Попробуйте еще раз.',
                    tournamentId: parseInt(tournamentId),
                    retryAfter: 5
                });
            }
            
            console.error(`❌ [MatchController.generateBracket] Возвращаем статус 500: Произошла ошибка при генерации турнирной сетки`);
            res.status(500).json({
                error: 'Произошла ошибка при генерации турнирной сетки',
                message: error.message,
                tournamentId: parseInt(tournamentId),
                timestamp: new Date().toISOString()
            });
        }
    });

    // 🔄 Перегенерация турнирной сетки
    static regenerateBracket = asyncHandler(async (req, res) => {
        const { id: tournamentId } = req.params;
        const { shuffle, thirdPlaceMatch } = req.body;
        const userId = req.user.id;
        
        console.log(`🔄 [MatchController.regenerateBracket] Регенерация для турнира ${tournamentId}, shuffle: ${shuffle}`);
        
        const result = await BracketService.regenerateBracket(
            parseInt(tournamentId), 
            userId, 
            shuffle || false, 
            thirdPlaceMatch || false
        );
        
        res.status(200).json({
            success: true,
            message: result.message,
            tournament: result.tournament,
            matches: result.matches,
            deletedMatches: result.deleted_matches
        });
    });

    // 🏆 Обновление результата матча в рамках турнира
    static updateMatchResult = asyncHandler(async (req, res) => {
        const { id: tournamentId, matchId } = req.params;
        const { winner_team_id, score1, score2, maps } = req.body;
        const userId = req.user.id;
        
        console.log(`⚔️ [MatchController.updateMatchResult] Обновление матча ${matchId} в турнире ${tournamentId}`);
        
        const result = await MatchService.updateMatchResult(
            parseInt(tournamentId),
            {
                matchId: parseInt(matchId),
                winner_team_id: parseInt(winner_team_id),
                score1,
                score2,
                maps
            },
            userId
        );
        
        res.status(200).json({
            success: true,
            message: 'Результат матча обновлен',
            tournament: result.tournament,
            advancementResult: result.advancementResult
        });
    });

    // 🎯 Обновление результата конкретного матча (альтернативный endpoint)
    static updateSpecificMatchResult = asyncHandler(async (req, res) => {
        const { matchId } = req.params;
        const { winner_team_id, score1, score2, maps_data } = req.body;
        
        // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        console.log(`🎯 [updateSpecificMatchResult] НАЧАЛО ОБРАБОТКИ ЗАПРОСА:`);
        console.log(`   - Match ID (params): ${matchId}`);
        console.log(`   - User ID: ${req.user.id}`);
        console.log(`   - Username: ${req.user.username}`);
        console.log(`   - Request Body:`, JSON.stringify(req.body, null, 2));
        console.log(`   - Winner Team ID: ${winner_team_id}`);
        console.log(`   - Score1: ${score1}`);
        console.log(`   - Score2: ${score2}`);
        console.log(`   - Maps data:`, maps_data);
        
        // 🔍 ВАЛИДАЦИЯ С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ
        console.log(`📝 [updateSpecificMatchResult] Запускаем валидацию с данными:`, {
            winner_team_id,
            score1, 
            score2,
            maps_data,
            matchId
        });
        
        const validationResult = TournamentValidator.validateMatchResult(req.body);
        
        console.log(`📝 [updateSpecificMatchResult] Результат валидации:`, {
            isValid: validationResult.isValid,
            errors: validationResult.errors
        });
        
        if (!validationResult.isValid) {
            console.log(`❌ [updateSpecificMatchResult] ВАЛИДАЦИЯ НЕ ПРОШЛА:`);
            validationResult.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
            return res.status(400).json({ 
                error: 'Ошибка валидации данных',
                message: validationResult.errors 
            });
        }
        
        console.log(`✅ [updateSpecificMatchResult] Валидация прошла успешно, вызываем MatchService...`);
        
        try {
            const result = await MatchService.updateSpecificMatchResult(
                parseInt(matchId),
                { winner_team_id, score1, score2, maps_data },
                req.user.id
            );
            
            console.log(`🎉 [updateSpecificMatchResult] УСПЕШНОЕ ЗАВЕРШЕНИЕ`);
            res.json(result);
        } catch (serviceError) {
            console.error(`❌ [updateSpecificMatchResult] ОШИБКА В СЕРВИСЕ:`, serviceError.message);
            console.error(`❌ [updateSpecificMatchResult] Stack trace:`, serviceError.stack);
            throw serviceError; // Re-throw для asyncHandler
        }
    });

    // 📋 Получение матчей турнира
    static getMatches = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const matches = await MatchService.getMatches(parseInt(id));
        
        res.json(matches);
    });

    // 🔍 Получение конкретного матча
    static getMatchById = asyncHandler(async (req, res) => {
        const { matchId } = req.params;
        
        const match = await MatchService.getMatchById(parseInt(matchId));
        
        if (!match) {
            return res.status(404).json({ error: 'Матч не найден' });
        }
        
        res.json(match);
    });

    // 🧹 Очистка дублирующихся матчей
    static cleanupDuplicateMatches = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        console.log(`🧹 [MatchController.cleanupDuplicateMatches] Tournament ID: ${id}`);
        console.log(`🧹 [MatchController.cleanupDuplicateMatches] User ID: ${req.user.id}`);
        
        const result = await BracketService.cleanupDuplicateMatches(
            parseInt(id),
            req.user.id
        );
        
        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                removed: result.removed,
                duplicateGroups: result.duplicateGroups
            }
        });
    });

    // 🔍 Проверка дублирующихся матчей
    static checkDuplicateMatches = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        console.log(`🔍 [MatchController.checkDuplicateMatches] Tournament ID: ${id}`);
        
        const result = await BracketService.checkForDuplicateMatches(parseInt(id));
        
        res.status(200).json({
            success: true,
            data: result
        });
    });

    // 🔧 Диагностика статуса блокировок PostgreSQL (только для администраторов)
    static checkDatabaseLocks = asyncHandler(async (req, res) => {
        console.log('🔍 [MatchController.checkDatabaseLocks] Запрос диагностики блокировок');
        
        const { id: tournamentId } = req.params;
        const userId = req.user.id;
        
        try {
            const diagnostic = await BracketService.checkDatabaseLocks(
                tournamentId ? parseInt(tournamentId) : null
            );
            
            console.log(`✅ [MatchController.checkDatabaseLocks] Диагностика завершена`);
            
            res.status(200).json({
                success: true,
                message: 'Диагностика блокировок завершена',
                tournamentId: tournamentId ? parseInt(tournamentId) : null,
                diagnostic: diagnostic,
                timestamp: new Date().toISOString(),
                recommendations: {
                    hasBlocks: diagnostic.tournamentLocks > 0,
                    suggestion: diagnostic.tournamentLocks > 0 
                        ? 'Обнаружены активные блокировки. Попробуйте очистить их или подождите завершения операций.'
                        : 'Блокировки не обнаружены. Проблема может быть на уровне приложения.'
                }
            });
            
        } catch (error) {
            console.error(`❌ [MatchController.checkDatabaseLocks] Ошибка диагностики: ${error.message}`);
            
            res.status(500).json({
                error: 'Ошибка диагностики блокировок',
                message: error.message,
                tournamentId: tournamentId ? parseInt(tournamentId) : null,
                timestamp: new Date().toISOString()
            });
        }
    });

    /**
     * 🆕 Экстренная очистка зависших блокировок
     */
    static clearStuckLocks = asyncHandler(async (req, res) => {
        console.log('🧹 [MatchController.clearStuckLocks] Запрос очистки блокировок');
        
        const { id: tournamentId } = req.params;
        const userId = req.user.id;
        
        try {
            // Проверяем права (только создатель или админ турнира)
            // Это делается внутри BracketService.clearStuckLocks
            
            const result = await BracketService.clearStuckLocks(
                parseInt(tournamentId), 
                userId
            );
            
            console.log(`✅ [MatchController.clearStuckLocks] Очистка завершена`);
            
            res.status(200).json({
                success: true,
                message: result.message,
                tournamentId: parseInt(tournamentId),
                result: result,
                timestamp: new Date().toISOString(),
                nextSteps: result.oldDatabaseLocks > 0 
                    ? ['Обратитесь к администратору для завершения старых процессов БД']
                    : ['Попробуйте снова сгенерировать турнирную сетку']
            });
            
        } catch (error) {
            console.error(`❌ [MatchController.clearStuckLocks] Ошибка очистки: ${error.message}`);
            
            res.status(500).json({
                error: 'Ошибка очистки блокировок',
                message: error.message,
                tournamentId: parseInt(tournamentId),
                timestamp: new Date().toISOString()
            });
        }
    });

    /**
     * Очистка результатов матчей
     */
    static clearMatchResults = asyncHandler(async (req, res) => {
        const { id: tournamentId } = req.params;
        const userId = req.user.id;
        
        console.log(`🧹 [MatchController.clearMatchResults] Очистка результатов для турнира ${tournamentId}`);
        
        const result = await BracketService.clearMatchResults(
            parseInt(tournamentId), 
            userId
        );
        
        res.status(200).json({
            success: true,
            message: result.message,
            matchesReset: result.matches_reset
        });
    });
}

module.exports = MatchController; 