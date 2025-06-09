// Real-time Statistics Service для варианта 4
// Обеспечивает live обновления статистики через WebSocket

const WebSocket = require('ws');
const pool = require('../db');

// Опциональный импорт Redis с graceful fallback
let Redis = null;
try {
    Redis = require('redis');
} catch (error) {
    console.warn('⚠️ Redis модуль не найден, работаем без кэширования');
}

class RealTimeStatsService {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // userId -> WebSocket
        this.redis = null;
        this.isInitialized = false;
    }

    async initialize(server) {
        try {
            console.log('🔌 [WEBSOCKET] Инициализация WebSocket сервера для статистики...');
            console.log('🔌 [WEBSOCKET] NODE_ENV:', process.env.NODE_ENV);
            console.log('🔌 [WEBSOCKET] Порт сервера:', process.env.PORT || 3000);
            
            // Инициализация WebSocket сервера
            this.wss = new WebSocket.Server({ 
                server,
                path: '/ws/stats'
            });

            console.log('✅ [WEBSOCKET] WebSocket сервер создан');
            console.log('✅ [WEBSOCKET] Path: /ws/stats');

            // Инициализация Redis для кэширования (опционально)
            if (Redis) {
                try {
                    console.log('🔄 [WEBSOCKET] Подключение к Redis...');
                    this.redis = Redis.createClient({
                        host: process.env.REDIS_HOST || 'localhost',
                        port: process.env.REDIS_PORT || 6379,
                        password: process.env.REDIS_PASSWORD || undefined
                    });

                    await this.redis.connect();
                    console.log('✅ [WEBSOCKET] Redis подключен для Real-time статистики');
                } catch (redisError) {
                    console.warn('⚠️ [WEBSOCKET] Не удалось подключиться к Redis:', {
                        message: redisError.message,
                        stack: redisError.stack
                    });
                    console.warn('⚠️ [WEBSOCKET] Работаем без кэширования');
                    this.redis = null;
                }
            } else {
                console.log('ℹ️ [WEBSOCKET] Redis недоступен, работаем без кэширования');
            }

            this.setupWebSocketHandlers();
            this.isInitialized = true;
            
            console.log('🚀 [WEBSOCKET] Real-time Statistics Service успешно инициализирован');
        } catch (error) {
            console.error('❌ [WEBSOCKET] Ошибка инициализации Real-time Stats Service:', {
                message: error.message,
                stack: error.stack
            });
            // Graceful fallback - работаем без WebSocket
            this.isInitialized = false;
        }
    }

    setupWebSocketHandlers() {
        this.wss.on('connection', (ws, req) => {
            const connectTime = new Date().toISOString();
            console.log('🔌 [WEBSOCKET] Новое WebSocket подключение:', {
                timestamp: connectTime,
                url: req.url,
                origin: req.headers.origin,
                userAgent: req.headers['user-agent'],
                remoteAddress: req.connection?.remoteAddress || req.socket?.remoteAddress
            });

            ws.on('message', async (message) => {
                try {
                    console.log('📨 [WEBSOCKET] Получено сообщение:', {
                        messageLength: message.length,
                        timestamp: new Date().toISOString()
                    });
                    
                    const data = JSON.parse(message);
                    
                    console.log('🔍 [WEBSOCKET] Обработка сообщения:', {
                        type: data.type,
                        userId: data.userId,
                        hasToken: !!data.token,
                        timestamp: new Date().toISOString()
                    });
                    
                    await this.handleMessage(ws, data);
                } catch (error) {
                    console.error('❌ [WEBSOCKET] Ошибка обработки сообщения:', {
                        error: error.message,
                        stack: error.stack,
                        message: message.toString(),
                        timestamp: new Date().toISOString()
                    });
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Ошибка обработки сообщения'
                    }));
                }
            });

            ws.on('close', (code, reason) => {
                const disconnectTime = new Date().toISOString();
                let disconnectedUserId = null;
                
                // Удаляем клиента из Map при отключении
                for (const [userId, client] of this.clients.entries()) {
                    if (client === ws) {
                        this.clients.delete(userId);
                        disconnectedUserId = userId;
                        break;
                    }
                }
                
                console.log('💔 [WEBSOCKET] WebSocket отключение:', {
                    userId: disconnectedUserId,
                    code: code,
                    reason: reason?.toString(),
                    disconnectTime: disconnectTime,
                    activeClients: this.clients.size
                });
            });

            ws.on('error', (error) => {
                console.error('❌ [WEBSOCKET] WebSocket ошибка:', {
                    error: error.message,
                    stack: error.stack,
                    code: error.code,
                    timestamp: new Date().toISOString()
                });
            });
        });
        
        console.log('✅ [WEBSOCKET] WebSocket обработчики настроены');
    }

    async handleMessage(ws, data) {
        const { type, userId, token } = data;

        switch (type) {
            case 'authenticate':
            case 'subscribe_stats':
                console.log(`🔐 [WEBSOCKET] Попытка аутентификации пользователя: ${userId}`);
                
                if (await this.validateUserToken(userId, token)) {
                    this.clients.set(userId, ws);
                    console.log(`✅ [WEBSOCKET] Пользователь подписался на real-time статистику:`, {
                        userId: userId,
                        totalClients: this.clients.size,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Отправляем текущую статистику при подключении
                    const currentStats = await this.getCurrentStats(userId);
                    ws.send(JSON.stringify({
                        type: 'stats_update',
                        data: currentStats
                    }));
                    
                    console.log(`📊 [WEBSOCKET] Отправлена текущая статистика пользователю: ${userId}`);
                } else {
                    console.warn(`❌ [WEBSOCKET] Недействительный токен для пользователя: ${userId}`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Недействительный токен'
                    }));
                }
                break;

            case 'request_tournament_analysis':
                console.log(`📈 [WEBSOCKET] Запрос анализа турниров от пользователя: ${userId}`);
                
                if (await this.validateUserToken(userId, token)) {
                    const analysis = await this.generateTournamentAnalysis(userId);
                    ws.send(JSON.stringify({
                        type: 'tournament_analysis',
                        data: analysis
                    }));
                    
                    console.log(`📈 [WEBSOCKET] Отправлен анализ турниров пользователю: ${userId}`);
                } else {
                    console.warn(`❌ [WEBSOCKET] Недействительный токен для запроса анализа: ${userId}`);
                }
                break;

            case 'ping':
                console.log(`🏓 [WEBSOCKET] Ping от пользователя: ${userId}`);
                ws.send(JSON.stringify({ type: 'pong' }));
                break;

            default:
                console.warn(`❓ [WEBSOCKET] Неизвестный тип сообщения:`, {
                    type: type,
                    userId: userId,
                    timestamp: new Date().toISOString()
                });
        }
    }

    async validateUserToken(userId, token) {
        // Простая валидация токена (в реальности нужна более сложная)
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return decoded.id == userId;
        } catch (error) {
            return false;
        }
    }

    async getCurrentStats(userId) {
        const cacheKey = `user_stats_${userId}`;
        
        try {
            // Пробуем получить из кэша
            if (this.redis) {
                const cached = await this.redis.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
            }

            // Если нет в кэше, получаем из БД
            const stats = await this.fetchStatsFromDatabase(userId);
            
            // Кэшируем на 5 минут
            if (this.redis && stats) {
                await this.redis.setEx(cacheKey, 300, JSON.stringify(stats));
            }
            
            return stats;
        } catch (error) {
            console.error('❌ Ошибка получения статистики:', error);
            return null;
        }
    }

    async fetchStatsFromDatabase(userId) {
        try {
            // Получаем базовую статистику
            const statsResult = await pool.query(`
                SELECT t.name, t.game, uts.result, uts.wins, uts.losses, uts.is_team, uts.updated_at
                FROM user_tournament_stats uts 
                JOIN tournaments t ON uts.tournament_id = t.id 
                WHERE uts.user_id = $1
                ORDER BY uts.updated_at DESC
            `, [userId]);

            const tournaments = statsResult.rows;
            const soloStats = tournaments.filter(s => !s.is_team);
            const teamStats = tournaments.filter(s => s.is_team);

            const soloWins = soloStats.reduce((sum, s) => sum + (s.wins || 0), 0);
            const soloLosses = soloStats.reduce((sum, s) => sum + (s.losses || 0), 0);
            const teamWins = teamStats.reduce((sum, s) => sum + (s.wins || 0), 0);
            const teamLosses = teamStats.reduce((sum, s) => sum + (s.losses || 0), 0);

            // Статистика по играм
            const gameStats = {};
            tournaments.forEach(stat => {
                if (!gameStats[stat.game]) {
                    gameStats[stat.game] = {
                        solo: { wins: 0, losses: 0 },
                        team: { wins: 0, losses: 0 }
                    };
                }
                if (stat.is_team) {
                    gameStats[stat.game].team.wins += (stat.wins || 0);
                    gameStats[stat.game].team.losses += (stat.losses || 0);
                } else {
                    gameStats[stat.game].solo.wins += (stat.wins || 0);
                    gameStats[stat.game].solo.losses += (stat.losses || 0);
                }
            });

            // Расширенная статистика для варианта 4
            const extendedStats = {
                totalTournaments: tournaments.length,
                winningTournaments: tournaments.filter(t => t.result?.includes('Победитель')).length,
                topThreeFinishes: tournaments.filter(t => 
                    t.result?.includes('Победитель') || 
                    t.result?.includes('2 место') || 
                    t.result?.includes('3 место')
                ).length,
                recentForm: tournaments.slice(0, 5).map(t => ({
                    game: t.game,
                    result: t.result,
                    date: t.updated_at
                })),
                averageFinishPosition: this.calculateAveragePosition(tournaments),
                performanceByGame: gameStats,
                trends: await this.calculatePerformanceTrends(userId, tournaments)
            };

            return {
                tournaments,
                solo: { 
                    wins: soloWins, 
                    losses: soloLosses, 
                    winRate: soloWins + soloLosses > 0 ? ((soloWins / (soloWins + soloLosses)) * 100).toFixed(2) : 0 
                },
                team: { 
                    wins: teamWins, 
                    losses: teamLosses, 
                    winRate: teamWins + teamLosses > 0 ? ((teamWins / (teamWins + teamLosses)) * 100).toFixed(2) : 0 
                },
                byGame: gameStats,
                extended: extendedStats,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Ошибка получения статистики из БД:', error);
            return null;
        }
    }

    calculateAveragePosition(tournaments) {
        const positions = tournaments
            .map(t => {
                if (t.result?.includes('Победитель')) return 1;
                if (t.result?.includes('2 место')) return 2;
                if (t.result?.includes('3 место')) return 3;
                if (t.result?.includes('4 место')) return 4;
                if (t.result?.includes('Полуфинал')) return 4;
                if (t.result?.includes('1/4')) return 8;
                return 10; // Участник
            })
            .filter(p => p <= 10);

        return positions.length > 0 
            ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
            : null;
    }

    async calculatePerformanceTrends(userId, tournaments) {
        // Простой анализ трендов производительности
        const recentTournaments = tournaments.slice(0, 10);
        const olderTournaments = tournaments.slice(10, 20);

        if (recentTournaments.length === 0) return null;

        const recentWinRate = this.getWinRateFromTournaments(recentTournaments);
        const olderWinRate = olderTournaments.length > 0 ? this.getWinRateFromTournaments(olderTournaments) : recentWinRate;

        return {
            direction: recentWinRate > olderWinRate ? 'improving' : recentWinRate < olderWinRate ? 'declining' : 'stable',
            recentWinRate: recentWinRate.toFixed(1),
            change: Math.abs(recentWinRate - olderWinRate).toFixed(1)
        };
    }

    getWinRateFromTournaments(tournaments) {
        const totalWins = tournaments.reduce((sum, t) => sum + (t.wins || 0), 0);
        const totalLosses = tournaments.reduce((sum, t) => sum + (t.losses || 0), 0);
        return totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;
    }

    async generateTournamentAnalysis(userId) {
        try {
            const stats = await this.getCurrentStats(userId);
            if (!stats || !stats.tournaments.length) {
                return { message: 'Недостаточно данных для анализа' };
            }

            // AI-анализ (упрощенный для демонстрации)
            const analysis = {
                performanceRating: this.calculatePerformanceRating(stats),
                strengths: this.identifyStrengths(stats),
                improvements: this.suggestImprovements(stats),
                gameRecommendations: this.recommendGames(stats),
                prediction: this.predictNextTournamentResult(stats)
            };

            return analysis;
        } catch (error) {
            console.error('❌ Ошибка генерации анализа турниров:', error);
            return { error: 'Не удалось сгенерировать анализ' };
        }
    }

    calculatePerformanceRating(stats) {
        const { solo, team, extended } = stats;
        
        // Комплексная оценка производительности (0-100)
        let rating = 50; // Базовый рейтинг

        // Винрейт влияет на рейтинг
        const overallWinRate = (parseFloat(solo.winRate) + parseFloat(team.winRate)) / 2;
        rating += (overallWinRate - 50) * 0.8;

        // Топ-3 финиши дают бонус
        if (extended.topThreeFinishes > 0) {
            rating += Math.min(extended.topThreeFinishes * 5, 20);
        }

        // Победы в турнирах дают большой бонус
        if (extended.winningTournaments > 0) {
            rating += extended.winningTournaments * 10;
        }

        // Средняя позиция влияет на рейтинг
        if (extended.averageFinishPosition) {
            rating += (10 - parseFloat(extended.averageFinishPosition)) * 2;
        }

        return Math.max(0, Math.min(100, Math.round(rating)));
    }

    identifyStrengths(stats) {
        const strengths = [];
        
        if (parseFloat(stats.solo.winRate) > 60) {
            strengths.push('Отличная игра в соло-турнирах');
        }
        
        if (parseFloat(stats.team.winRate) > 60) {
            strengths.push('Сильная командная игра');
        }

        if (stats.extended.winningTournaments > 0) {
            strengths.push('Способность побеждать в турнирах');
        }

        if (stats.extended.trends?.direction === 'improving') {
            strengths.push('Растущая форма');
        }

        return strengths.length > 0 ? strengths : ['Стабильная игра'];
    }

    suggestImprovements(stats) {
        const improvements = [];

        if (parseFloat(stats.solo.winRate) < 40) {
            improvements.push('Работа над индивидуальными навыками');
        }

        if (parseFloat(stats.team.winRate) < 40) {
            improvements.push('Улучшение командного взаимодействия');
        }

        if (stats.extended.trends?.direction === 'declining') {
            improvements.push('Анализ последних поражений');
        }

        if (stats.extended.averageFinishPosition > 7) {
            improvements.push('Фокус на прохождении в топ-8');
        }

        return improvements.length > 0 ? improvements : ['Продолжать в том же духе!'];
    }

    recommendGames(stats) {
        const { byGame } = stats;
        const gamePerformance = [];

        Object.entries(byGame).forEach(([game, gameStats]) => {
            const totalWins = gameStats.solo.wins + gameStats.team.wins;
            const totalLosses = gameStats.solo.losses + gameStats.team.losses;
            const winRate = totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;
            
            gamePerformance.push({ game, winRate, total: totalWins + totalLosses });
        });

        gamePerformance.sort((a, b) => b.winRate - a.winRate);

        return gamePerformance.slice(0, 2).map(gp => ({
            game: gp.game,
            reason: `Высокий винрейт ${gp.winRate.toFixed(1)}%`
        }));
    }

    predictNextTournamentResult(stats) {
        const recentForm = stats.extended.recentForm.slice(0, 3);
        const recentWins = recentForm.filter(f => 
            f.result?.includes('Победитель') || f.result?.includes('место')
        ).length;

        if (recentWins >= 2) {
            return { prediction: 'Высокие шансы на топ-3', confidence: 75 };
        } else if (recentWins >= 1) {
            return { prediction: 'Хорошие шансы попасть в плей-офф', confidence: 60 };
        } else {
            return { prediction: 'Фокус на стабильной игре', confidence: 50 };
        }
    }

    // Метод для отправки real-time обновлений всем подключенным клиентам
    async broadcastStatsUpdate(userId, updateType = 'stats_update') {
        if (!this.isInitialized) {
            console.log(`⚠️ [WEBSOCKET] Broadcast пропущен - сервис не инициализирован для пользователя: ${userId}`);
            return;
        }
        
        const client = this.clients.get(userId);
        
        if (!client) {
            console.log(`⚠️ [WEBSOCKET] Broadcast пропущен - клиент не найден для пользователя: ${userId}`);
            return;
        }
        
        if (client.readyState !== WebSocket.OPEN) {
            console.log(`⚠️ [WEBSOCKET] Broadcast пропущен - соединение не активно для пользователя: ${userId}, состояние: ${client.readyState}`);
            this.clients.delete(userId); // Удаляем неактивного клиента
            return;
        }
        
        try {
            console.log(`📡 [WEBSOCKET] Отправка broadcast обновления:`, {
                userId: userId,
                updateType: updateType,
                totalClients: this.clients.size,
                timestamp: new Date().toISOString()
            });
            
            const currentStats = await this.getCurrentStats(userId);
            const message = JSON.stringify({
                type: updateType,
                data: currentStats,
                timestamp: new Date().toISOString()
            });
            
            client.send(message);
            
            // Очищаем кэш для форсированного обновления
            if (this.redis) {
                await this.redis.del(`user_stats_${userId}`);
                console.log(`🗑️ [WEBSOCKET] Кэш очищен для пользователя: ${userId}`);
            }
            
            console.log(`✅ [WEBSOCKET] Broadcast успешно отправлен:`, {
                userId: userId,
                updateType: updateType,
                messageLength: message.length,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ [WEBSOCKET] Ошибка отправки real-time обновления:', {
                userId: userId,
                updateType: updateType,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            
            // Удаляем проблемного клиента
            this.clients.delete(userId);
        }
    }

    // Метод для инвалидации кэша
    async invalidateStatsCache(userId) {
        if (this.redis) {
            await this.redis.del(`user_stats_${userId}`);
        }
    }

    // Метод для получения статистики подключений
    getConnectionStats() {
        return {
            totalConnections: this.clients.size,
            connectedUsers: Array.from(this.clients.keys())
        };
    }
}

module.exports = new RealTimeStatsService(); 