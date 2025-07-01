const BracketService = require('../../services/tournament/BracketService');
const MatchService = require('../../services/tournament/MatchService');
const { asyncHandler } = require('../../utils/asyncHandler');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { broadcastTournamentUpdate } = require('../../notifications');
const pool = require('../../db');
const { generateBracket } = require('../../bracketGenerator');

class MatchController {
    /**
     * 🔄 Генерация турнирной сетки (упрощенная версия)
     */
    static generateBracket = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const tournamentId = parseInt(req.params.id);
        const userId = req.user.id;
        const { thirdPlaceMatch = false } = req.body;
        
        console.log(`🔄 [MatchController v2.0] Генерация сетки турнира ${tournamentId}`);
        console.log(`👤 Пользователь: ${req.user.username} (ID: ${userId})`);
        console.log(`⚙️ Настройки: thirdPlaceMatch=${thirdPlaceMatch}`);
        
        try {
            const result = await BracketService.generateBracket(tournamentId, userId, thirdPlaceMatch);
            
            const duration = Date.now() - startTime;
            console.log(`✅ [MatchController v2.0] Сетка сгенерирована за ${duration}ms`);
            
            res.json({
                success: true,
                message: `Турнирная сетка сгенерирована: ${result.matchesCount} матчей`,
                data: result
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [MatchController v2.0] Ошибка генерации (${duration}ms):`, error.message);
            
            // Определяем тип ошибки для пользователя
            let userMessage = 'Произошла ошибка при генерации сетки';
            let statusCode = 500;
            
            if (error.message.includes('не найден')) {
                userMessage = 'Турнир не найден';
                statusCode = 404;
            } else if (error.message.includes('уже сгенерирована')) {
                userMessage = error.message;
                statusCode = 409; // Conflict
            } else if (error.message.includes('Недостаточно участников')) {
                userMessage = error.message;
                statusCode = 400; // Bad Request
            } else if (error.message.includes('права')) {
                userMessage = 'Недостаточно прав для генерации сетки';
                statusCode = 403; // Forbidden
            }
            
            res.status(statusCode).json({
                success: false,
                message: userMessage,
                error: error.message,
                duration
            });
        }
    });
    
    /**
     * 🔄 Регенерация турнирной сетки (упрощенная версия)
     */
    static regenerateBracket = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const tournamentId = parseInt(req.params.id);
        const userId = req.user.id;
        const { shuffle = false, thirdPlaceMatch = false } = req.body;
        
        console.log(`🔄 [MatchController v2.0] Регенерация сетки турнира ${tournamentId}`);
        console.log(`👤 Пользователь: ${req.user.username} (ID: ${userId})`);
        console.log(`⚙️ Настройки: shuffle=${shuffle}, thirdPlaceMatch=${thirdPlaceMatch}`);
        
        try {
            const result = await BracketService.regenerateBracket(tournamentId, userId, shuffle, thirdPlaceMatch);
            
            const duration = Date.now() - startTime;
            console.log(`✅ [MatchController v2.0] Сетка регенерирована за ${duration}ms`);
            
            res.json({
                success: true,
                message: `Турнирная сетка регенерирована: ${result.matchesCount} матчей${shuffle ? ' (с перемешиванием)' : ''}`,
                data: result
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [MatchController v2.0] Ошибка регенерации (${duration}ms):`, error.message);
            
            // Определяем тип ошибки для пользователя
            let userMessage = 'Произошла ошибка при регенерации сетки';
            let statusCode = 500;
            
            if (error.message.includes('не найден')) {
                userMessage = 'Турнир не найден';
                statusCode = 404;
            } else if (error.message.includes('Недостаточно участников')) {
                userMessage = error.message;
                statusCode = 400;
            } else if (error.message.includes('права')) {
                userMessage = 'Недостаточно прав для регенерации сетки';
                statusCode = 403;
            }
            
            res.status(statusCode).json({
                success: false,
                message: userMessage,
                error: error.message,
                duration
            });
        }
    });
    
    /**
     * 🗑️ Очистка результатов матчей
     */
    static clearMatchResults = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const tournamentId = parseInt(req.params.id);
        const userId = req.user.id;
        
        console.log(`🗑️ [MatchController v2.0] Очистка результатов турнира ${tournamentId}`);
        console.log(`👤 Пользователь: ${req.user.username} (ID: ${userId})`);
        
        try {
            const result = await BracketService.clearMatchResults(tournamentId, userId);
            
            const duration = Date.now() - startTime;
            console.log(`✅ [MatchController v2.0] Результаты очищены за ${duration}ms`);
            
            res.json({
                success: true,
                message: `Результаты очищены: ${result.clearedCount} матчей`,
                data: result
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [MatchController v2.0] Ошибка очистки результатов (${duration}ms):`, error.message);
            
            let userMessage = 'Произошла ошибка при очистке результатов';
            let statusCode = 500;
            
            if (error.message.includes('не найден')) {
                userMessage = 'Турнир не найден';
                statusCode = 404;
            } else if (error.message.includes('права')) {
                userMessage = 'Недостаточно прав для очистки результатов';
                statusCode = 403;
            }
            
            res.status(statusCode).json({
                success: false,
                message: userMessage,
                error: error.message,
                duration
            });
        }
    });
    
    /**
     * 📊 Сохранение результата матча (упрощенная версия)
     */
    static saveMatchResult = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const matchId = parseInt(req.params.matchId);
        const userId = req.user.id;
        
        console.log(`📊 [MatchController v2.0] Сохранение результата матча ${matchId}`);
        console.log(`👤 Пользователь: ${req.user.username} (ID: ${userId})`);
        
        try {
            const result = await MatchService.saveResult(matchId, req.body, userId);
            
            const duration = Date.now() - startTime;
            console.log(`✅ [MatchController v2.0] Результат сохранен за ${duration}ms`);
            
            res.json({
                success: true,
                message: 'Результат матча сохранен',
                data: result
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [MatchController v2.0] Ошибка сохранения результата (${duration}ms):`, error.message);
            
            let userMessage = 'Произошла ошибка при сохранении результата';
            let statusCode = 500;
            
            if (error.message.includes('не найден')) {
                userMessage = 'Матч не найден';
                statusCode = 404;
            } else if (error.message.includes('права')) {
                userMessage = 'Недостаточно прав для изменения результата';
                statusCode = 403;
            } else if (error.message.includes('завершен')) {
                userMessage = 'Матч уже завершен';
                statusCode = 409;
            }
            
            res.status(statusCode).json({
                success: false,
                message: userMessage,
                error: error.message,
                duration
            });
        }
    });
    
    /**
     * 📋 Получение матчей турнира
     */
    static getMatches = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        
        console.log(`📋 [MatchController v2.0] Получение матчей турнира ${tournamentId}`);
        
        try {
            const matches = await MatchService.getByTournamentId(tournamentId);
            
            res.json({
                success: true,
                data: matches
            });
            
        } catch (error) {
            console.error(`❌ [MatchController v2.0] Ошибка получения матчей:`, error.message);
            
            res.status(500).json({
                success: false,
                message: 'Ошибка при получении матчей',
                error: error.message
            });
        }
    });
    
    /**
     * 📋 Получение конкретного матча
     */
    static getMatch = asyncHandler(async (req, res) => {
        const matchId = parseInt(req.params.matchId);
        
        console.log(`📋 [MatchController v2.0] Получение матча ${matchId}`);
        
        try {
            const match = await MatchService.getById(matchId);
            
            if (!match) {
                return res.status(404).json({
                    success: false,
                    message: 'Матч не найден'
                });
            }
            
            res.json({
                success: true,
                data: match
            });
            
        } catch (error) {
            console.error(`❌ [MatchController v2.0] Ошибка получения матча:`, error.message);
            
            res.status(500).json({
                success: false,
                message: 'Ошибка при получении матча',
                error: error.message
            });
        }
    });

    /**
     * 🚨 QA FIX: Экстренная остановка зависших процессов генерации
     */
    async killGeneration(req, res) {
        try {
            const { id: tournamentId } = req.params;
            const user = req.user;
            
            console.log(`🚨 [MatchController] ЭКСТРЕННАЯ ОСТАНОВКА процессов для турнира ${tournamentId}`);
            console.log(`👤 Пользователь: ${user.username} (ID: ${user.id})`);
            
            // Проверяем права администратора
            if (user.role !== 'admin') {
                return res.status(403).json({
                    error: 'Только администраторы могут выполнять экстренную остановку'
                });
            }
            
            // 1. Восстанавливаем статус турнира
            await pool.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2 AND status = $3',
                ['active', tournamentId, 'generating']
            );
            
            // 2. Убиваем все длительные запросы в PostgreSQL
            await pool.query(`
                SELECT pg_cancel_backend(pid) 
                FROM pg_stat_activity 
                WHERE state != 'idle' 
                AND query LIKE '%matches%' 
                AND query LIKE '%${tournamentId}%'
                AND query_start < NOW() - INTERVAL '60 seconds'
            `);
            
            // 3. Проверяем текущее состояние
            const statusCheck = await pool.query(
                'SELECT status FROM tournaments WHERE id = $1',
                [tournamentId]
            );
            
            const matchesCheck = await pool.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            console.log(`✅ [MatchController] Экстренная остановка выполнена:`);
            console.log(`   • Статус турнира: ${statusCheck.rows[0]?.status}`);
            console.log(`   • Количество матчей: ${matchesCheck.rows[0]?.count}`);
            
            res.json({
                success: true,
                message: 'Зависшие процессы остановлены',
                tournamentStatus: statusCheck.rows[0]?.status,
                matchesCount: parseInt(matchesCheck.rows[0]?.count)
            });
            
        } catch (error) {
            console.error(`❌ [MatchController] Ошибка экстренной остановки:`, error.message);
            res.status(500).json({
                error: 'Ошибка при остановке процессов',
                details: error.message
            });
        }
    }
}

module.exports = MatchController; 