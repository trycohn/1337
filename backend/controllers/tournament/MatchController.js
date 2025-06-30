const MatchService = require('../../services/tournament/MatchService');
const BracketService = require('../../services/tournament/BracketService');
const TournamentValidator = require('../../validators/tournament/TournamentValidator');
const { asyncHandler } = require('../../utils/asyncHandler');

class MatchController {
    // 🥊 Генерация турнирной сетки
    static generateBracket = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const { id } = req.params;
        const { thirdPlaceMatch } = req.body;
        
        console.log('🚀 [MatchController.generateBracket] МОДУЛЬНЫЙ РОУТЕР ПОЛУЧИЛ ЗАПРОС!');
        console.log('🚀 [MatchController.generateBracket] Tournament ID:', id);
        console.log('🚀 [MatchController.generateBracket] User ID:', req.user.id);
        console.log('🚀 [MatchController.generateBracket] Username:', req.user.username);
        console.log('🚀 [MatchController.generateBracket] Request body:', req.body);
        console.log('🚀 [MatchController.generateBracket] thirdPlaceMatch:', thirdPlaceMatch);
        
        try {
            console.log('🚀 [MatchController.generateBracket] Вызываем BracketService.generateBracket...');
            
            const result = await BracketService.generateBracket(
                parseInt(id),
                req.user.id,
                thirdPlaceMatch
            );
            
            const duration = Date.now() - startTime;
            console.log(`✅ [MatchController.generateBracket] BracketService завершился успешно за ${duration}ms`);
            console.log(`✅ [MatchController.generateBracket] Результат:`, {
                success: result.success,
                totalMatches: result.totalMatches,
                existing: result.existing || false,
                concurrent: result.concurrent || false
            });
            
            res.json({
                success: true,
                message: result.message || 'Сетка успешно сгенерирована',
                tournament: result.tournament,
                matches: result.matches,
                totalMatches: result.totalMatches,
                existing: result.existing || false,
                duration: duration
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [MatchController.generateBracket] ОШИБКА после ${duration}ms:`, error.message);
            console.error(`❌ [MatchController.generateBracket] Тип ошибки: ${error.name}`);
            console.error(`❌ [MatchController.generateBracket] Код ошибки: ${error.code || 'не определен'}`);
            console.error(`❌ [MatchController.generateBracket] Stack trace:`, error.stack);
            
            // Определяем тип ошибки и возвращаем соответствующий HTTP статус
            let statusCode = 500;
            let userMessage = 'Произошла ошибка при генерации турнирной сетки';
            
            if (error.message.includes('таймаут')) {
                statusCode = 408; // Request Timeout
                userMessage = 'Генерация сетки заняла слишком много времени. Попробуйте еще раз через несколько секунд.';
            } else if (error.message.includes('не найден')) {
                statusCode = 404; // Not Found
                userMessage = error.message;
            } else if (error.message.includes('права') || error.message.includes('администратор')) {
                statusCode = 403; // Forbidden
                userMessage = error.message;
            } else if (error.message.includes('команды еще не сформированы') || 
                       error.message.includes('минимум') || 
                       error.message.includes('участников')) {
                statusCode = 400; // Bad Request
                userMessage = error.message;
            } else if (error.message.includes('заблокирован другим процессом')) {
                statusCode = 423; // Locked
                userMessage = 'Турнир временно заблокирован другой операцией. Попробуйте через несколько секунд.';
            }
            
            console.error(`❌ [MatchController.generateBracket] Возвращаем статус ${statusCode}: ${userMessage}`);
            
            return res.status(statusCode).json({
                success: false,
                error: userMessage,
                code: error.code || 'GENERATION_ERROR',
                duration: duration,
                timestamp: new Date().toISOString(),
                tournamentId: id,
                userId: req.user.id,
                // В development режиме добавляем техническую информацию
                ...(process.env.NODE_ENV === 'development' && {
                    technical: {
                        originalError: error.message,
                        errorType: error.name,
                        errorCode: error.code
                    }
                })
            });
        }
    });

    // 🔄 Перегенерация турнирной сетки
    static regenerateBracket = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const { id } = req.params;
        const { shuffleParticipants, thirdPlaceMatch } = req.body;
        
        console.log(`🔄 [MatchController.regenerateBracket] НАЧАЛО ОБРАБОТКИ ЗАПРОСА`);
        console.log(`🔄 [MatchController.regenerateBracket] Tournament ID: ${id}`);
        console.log(`🔄 [MatchController.regenerateBracket] User ID: ${req.user.id}`);
        console.log(`🔄 [MatchController.regenerateBracket] Username: ${req.user.username}`);
        console.log(`🔄 [MatchController.regenerateBracket] shuffleParticipants: ${shuffleParticipants}`);
        console.log(`🔄 [MatchController.regenerateBracket] thirdPlaceMatch: ${thirdPlaceMatch}`);
        console.log(`🔄 [MatchController.regenerateBracket] Request body:`, req.body);
        
        try {
            console.log(`🚀 [MatchController.regenerateBracket] Вызываем BracketService.regenerateBracket...`);
            
            const result = await BracketService.regenerateBracket(
                parseInt(id),
                req.user.id,
                shuffleParticipants || false,  // Правильный третий параметр - shuffle
                thirdPlaceMatch || false       // Правильный четвертый параметр - thirdPlaceMatch
            );
            
            const duration = Date.now() - startTime;
            console.log(`✅ [MatchController.regenerateBracket] BracketService завершился успешно за ${duration}ms`);
            console.log(`✅ [MatchController.regenerateBracket] Результат:`, {
                success: result.success,
                totalMatches: result.totalMatches,
                shuffled: shuffleParticipants || false
            });
            
            res.json({
                success: true,
                message: result.message || 'Турнирная сетка успешно перегенерирована',
                tournament: result.tournament,
                matches: result.matches,
                totalMatches: result.totalMatches,
                shuffled: shuffleParticipants || false,
                duration: duration
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [MatchController.regenerateBracket] ОШИБКА после ${duration}ms:`, error.message);
            console.error(`❌ [MatchController.regenerateBracket] Тип ошибки: ${error.name}`);
            console.error(`❌ [MatchController.regenerateBracket] Код ошибки: ${error.code || 'не определен'}`);
            console.error(`❌ [MatchController.regenerateBracket] Stack trace:`, error.stack);
            
            // Определяем тип ошибки и возвращаем соответствующий HTTP статус
            let statusCode = 500;
            let userMessage = 'Произошла ошибка при регенерации турнирной сетки';
            
            if (error.message.includes('таймаут')) {
                statusCode = 408; // Request Timeout
                userMessage = 'Регенерация сетки заняла слишком много времени. Попробуйте еще раз через несколько секунд.';
            } else if (error.message.includes('частая регенерация')) {
                statusCode = 429; // Too Many Requests
                userMessage = error.message;
            } else if (error.message.includes('не найден')) {
                statusCode = 404; // Not Found
                userMessage = error.message;
            } else if (error.message.includes('права') || error.message.includes('администратор')) {
                statusCode = 403; // Forbidden
                userMessage = error.message;
            } else if (error.message.includes('команды еще не сформированы') || 
                       error.message.includes('минимум') || 
                       error.message.includes('участников')) {
                statusCode = 400; // Bad Request
                userMessage = error.message;
            } else if (error.message.includes('заблокирован другим процессом')) {
                statusCode = 423; // Locked
                userMessage = 'Турнир временно заблокирован другой операцией. Попробуйте через несколько секунд.';
            }
            
            console.error(`❌ [MatchController.regenerateBracket] Возвращаем статус ${statusCode}: ${userMessage}`);
            
            return res.status(statusCode).json({
                success: false,
                error: userMessage,
                code: error.code || 'REGENERATION_ERROR',
                duration: duration,
                timestamp: new Date().toISOString(),
                tournamentId: id,
                userId: req.user.id,
                // В development режиме добавляем техническую информацию
                ...(process.env.NODE_ENV === 'development' && {
                    technical: {
                        originalError: error.message,
                        errorType: error.name,
                        errorCode: error.code
                    }
                })
            });
        }
    });

    // 🏆 Обновление результата матча в рамках турнира
    static updateMatchResult = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { matchId, winner_team_id, score1, score2, maps } = req.body;
        
        const validationResult = TournamentValidator.validateMatchResult(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.errors });
        }
        
        const result = await MatchService.updateMatchResult(
            parseInt(id), 
            { matchId, winner_team_id, score1, score2, maps }, 
            req.user.id
        );
        
        res.json(result);
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
        // Проверяем права администратора
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен: требуются права администратора'
            });
        }
        
        const { id } = req.params;
        console.log(`🔧 [MatchController.checkDatabaseLocks] Диагностика блокировок для турнира ${id}, админ: ${req.user.username}`);
        
        try {
            const pool = require('../../db');
            
            // Проверяем активные блокировки на турнире
            const locksQuery = `
                SELECT 
                    pg_locks.locktype,
                    pg_locks.mode,
                    pg_locks.granted,
                    pg_locks.pid,
                    pg_stat_activity.query,
                    pg_stat_activity.state,
                    pg_stat_activity.query_start,
                    EXTRACT(EPOCH FROM (now() - pg_stat_activity.query_start)) as duration_seconds
                FROM pg_locks
                LEFT JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
                WHERE pg_locks.relation = (
                    SELECT oid FROM pg_class WHERE relname = 'tournaments'
                )
                AND pg_stat_activity.query LIKE '%tournaments%'
                AND pg_stat_activity.state != 'idle'
                ORDER BY pg_stat_activity.query_start;
            `;
            
            const locksResult = await pool.query(locksQuery);
            
            // Проверяем общую статистику соединений
            const connectionsQuery = `
                SELECT 
                    COUNT(*) as total_connections,
                    COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
                    COUNT(CASE WHEN state = 'idle in transaction' THEN 1 END) as idle_in_transaction
                FROM pg_stat_activity
                WHERE datname = current_database();
            `;
            
            const connectionsResult = await pool.query(connectionsQuery);
            
            // Проверяем долго выполняющиеся запросы
            const longQueriesQuery = `
                SELECT 
                    pid,
                    state,
                    query,
                    query_start,
                    EXTRACT(EPOCH FROM (now() - query_start)) as duration_seconds
                FROM pg_stat_activity
                WHERE datname = current_database()
                AND state != 'idle'
                AND EXTRACT(EPOCH FROM (now() - query_start)) > 5
                ORDER BY query_start;
            `;
            
            const longQueriesResult = await pool.query(longQueriesQuery);
            
            console.log(`✅ [MatchController.checkDatabaseLocks] Диагностика завершена:`, {
                locks: locksResult.rows.length,
                longQueries: longQueriesResult.rows.length,
                totalConnections: connectionsResult.rows[0].total_connections
            });
            
            res.json({
                success: true,
                tournamentId: parseInt(id),
                timestamp: new Date().toISOString(),
                locks: {
                    count: locksResult.rows.length,
                    details: locksResult.rows
                },
                connections: connectionsResult.rows[0],
                longRunningQueries: {
                    count: longQueriesResult.rows.length,
                    queries: longQueriesResult.rows
                },
                recommendations: generateLockRecommendations(locksResult.rows, longQueriesResult.rows)
            });
            
        } catch (error) {
            console.error(`❌ [MatchController.checkDatabaseLocks] Ошибка диагностики:`, error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при диагностике блокировок базы данных',
                details: error.message
            });
        }
    });
}

// 🔧 Вспомогательная функция для генерации рекомендаций по блокировкам
function generateLockRecommendations(locks, longQueries) {
    const recommendations = [];
    
    if (locks.length > 0) {
        recommendations.push('Обнаружены активные блокировки на таблице tournaments');
        
        const unGrantedLocks = locks.filter(lock => !lock.granted);
        if (unGrantedLocks.length > 0) {
            recommendations.push(`${unGrantedLocks.length} блокировок ожидают освобождения - возможна проблема`);
        }
        
        const oldLocks = locks.filter(lock => lock.duration_seconds > 10);
        if (oldLocks.length > 0) {
            recommendations.push(`${oldLocks.length} блокировок существуют более 10 секунд - требуется вмешательство`);
        }
    }
    
    if (longQueries.length > 0) {
        recommendations.push(`Найдено ${longQueries.length} долго выполняющихся запросов`);
        
        const veryLongQueries = longQueries.filter(query => query.duration_seconds > 30);
        if (veryLongQueries.length > 0) {
            recommendations.push(`${veryLongQueries.length} запросов выполняются более 30 секунд - критично`);
        }
    }
    
    if (locks.length === 0 && longQueries.length === 0) {
        recommendations.push('Блокировки и долгие запросы не обнаружены - система работает нормально');
    }
    
    return recommendations;
}

module.exports = MatchController; 