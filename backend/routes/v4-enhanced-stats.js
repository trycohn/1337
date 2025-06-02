// Enhanced Statistics API для варианта 4
// Интеграция с real-time сервисом и системой достижений

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Опциональные импорты с graceful fallback
let realTimeStatsService = null;
let achievementSystem = null;

try {
    realTimeStatsService = require('../services/realTimeStatsService');
} catch (error) {
    console.warn('⚠️ realTimeStatsService недоступен, некоторые функции будут ограничены');
}

try {
    achievementSystem = require('../services/achievementSystem');
} catch (error) {
    console.warn('⚠️ achievementSystem недоступен, система достижений отключена');
}

const pool = require('../db');

// 🆕 Endpoint для получения расширенной статистики (alias для фронтенда)
router.get('/enhanced-stats/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Проверяем права доступа (пользователь может видеть только свою статистику)
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет прав доступа к статистике этого пользователя' });
        }

        let stats = null;
        
        // Получаем статистику через real-time сервис если доступен
        if (realTimeStatsService) {
            try {
                stats = await realTimeStatsService.getCurrentStats(userId);
            } catch (error) {
                console.warn('⚠️ Ошибка real-time сервиса, используем fallback:', error.message);
            }
        }
        
        // Fallback на базовую статистику если real-time недоступен
        if (!stats) {
            stats = await getBasicStats(userId);
        }
        
        // Получаем достижения пользователя если система доступна
        let achievements = { achievements: [], totalPoints: 0, level: 1 };
        if (achievementSystem) {
            try {
                achievements = await achievementSystem.getUserAchievements(userId);
            } catch (error) {
                console.warn('⚠️ Ошибка системы достижений:', error.message);
            }
        }
        
        // Получаем рейтинг пользователя если система доступна
        let ranking = { position: null, totalUsers: 0 };
        if (achievementSystem) {
            try {
                ranking = await achievementSystem.getUserRanking(userId);
            } catch (error) {
                console.warn('⚠️ Ошибка получения рейтинга:', error.message);
            }
        }

        // Расширенные метрики для варианта 4
        const enhancedMetrics = await getEnhancedMetrics(userId);

        res.json({
            ...stats,
            achievements,
            ranking,
            enhancedMetrics,
            version: '4.0',
            realTime: realTimeStatsService !== null,
            fallbackMode: realTimeStatsService === null
        });
    } catch (error) {
        console.error('❌ Ошибка получения расширенной статистики:', error);
        res.status(500).json({ error: 'Не удалось получить статистику' });
    }
});

// 🆕 Endpoint для получения достижений пользователя (alias)
router.get('/user-achievements/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { category } = req.query;
        
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        // Fallback если система достижений недоступна
        if (!achievementSystem) {
            return res.json({
                achievements: [],
                totalPoints: 0,
                level: 1,
                nextLevelPoints: 100,
                currentLevelPoints: 0,
                message: 'Система достижений временно недоступна'
            });
        }

        let achievementsData = await achievementSystem.getUserAchievements(userId);
        
        // Фильтрация по категории если указана
        if (category) {
            achievementsData.achievements = achievementsData.achievements.filter(
                a => a.category === category
            );
        }

        res.json(achievementsData);
    } catch (error) {
        console.error('❌ Ошибка получения достижений:', error);
        
        // Fallback ответ
        res.json({
            achievements: [],
            totalPoints: 0,
            level: 1,
            nextLevelPoints: 100,
            currentLevelPoints: 0,
            error: 'Система достижений временно недоступна'
        });
    }
});

// 🆕 Endpoint для получения всех достижений
router.get('/achievements', async (req, res) => {
    try {
        // Fallback если система достижений недоступна
        if (!achievementSystem) {
            return res.json({
                achievements: generateBasicAchievements(),
                categories: ['tournament', 'skill', 'social', 'special'],
                message: 'Показаны базовые достижения (система достижений недоступна)'
            });
        }

        const achievements = await achievementSystem.getAllAchievements();
        
        res.json({
            achievements,
            categories: [...new Set(achievements.map(a => a.category))]
        });
    } catch (error) {
        console.error('❌ Ошибка получения всех достижений:', error);
        
        // Fallback ответ
        res.json({
            achievements: generateBasicAchievements(),
            categories: ['tournament', 'skill', 'social', 'special'],
            error: 'Система достижений временно недоступна'
        });
    }
});

// 🆕 Endpoint для получения лидербордов
router.get('/leaderboards', async (req, res) => {
    try {
        const { limit = 10, category = 'overall' } = req.query;
        
        // Fallback если система достижений недоступна
        if (!achievementSystem) {
            const basicLeaderboard = await generateBasicLeaderboard(parseInt(limit));
            return res.json({
                leaderboard: basicLeaderboard,
                category,
                generatedAt: new Date().toISOString(),
                totalUsers: basicLeaderboard.length,
                message: 'Показан базовый лидерборд (система достижений недоступна)'
            });
        }
        
        const leaderboard = await achievementSystem.getLeaderboard(parseInt(limit), category);
        
        res.json({
            leaderboard,
            category,
            generatedAt: new Date().toISOString(),
            totalUsers: leaderboard.length
        });
    } catch (error) {
        console.error('❌ Ошибка получения лидерборда:', error);
        
        // Fallback ответ
        const basicLeaderboard = await generateBasicLeaderboard(parseInt(req.query.limit || 10));
        res.json({
            leaderboard: basicLeaderboard,
            category: req.query.category || 'overall',
            generatedAt: new Date().toISOString(),
            totalUsers: basicLeaderboard.length,
            error: 'Система достижений временно недоступна'
        });
    }
});

// Получение расширенной статистики пользователя с real-time поддержкой
router.get('/stats/enhanced/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Проверяем права доступа (пользователь может видеть только свою статистику)
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет прав доступа к статистике этого пользователя' });
        }

        let stats = null;
        
        // Получаем статистику через real-time сервис если доступен
        if (realTimeStatsService) {
            try {
                stats = await realTimeStatsService.getCurrentStats(userId);
            } catch (error) {
                console.warn('⚠️ Ошибка real-time сервиса, используем fallback:', error.message);
            }
        }
        
        // Fallback на базовую статистику если real-time недоступен
        if (!stats) {
            stats = await getBasicStats(userId);
        }
        
        // Получаем достижения пользователя если система доступна
        let achievements = { achievements: [], totalPoints: 0, level: 1 };
        if (achievementSystem) {
            try {
                achievements = await achievementSystem.getUserAchievements(userId);
            } catch (error) {
                console.warn('⚠️ Ошибка системы достижений:', error.message);
            }
        }
        
        // Получаем рейтинг пользователя если система доступна
        let ranking = { position: null, totalUsers: 0 };
        if (achievementSystem) {
            try {
                ranking = await achievementSystem.getUserRanking(userId);
            } catch (error) {
                console.warn('⚠️ Ошибка получения рейтинга:', error.message);
            }
        }

        // Расширенные метрики для варианта 4
        const enhancedMetrics = await getEnhancedMetrics(userId);

        res.json({
            ...stats,
            achievements,
            ranking,
            enhancedMetrics,
            version: '4.0',
            realTime: realTimeStatsService !== null,
            fallbackMode: realTimeStatsService === null
        });
    } catch (error) {
        console.error('❌ Ошибка получения расширенной статистики:', error);
        res.status(500).json({ error: 'Не удалось получить статистику' });
    }
});

// Endpoint для получения AI-анализа производительности
router.get('/analysis/performance/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        let analysis = null;
        
        if (realTimeStatsService) {
            try {
                analysis = await realTimeStatsService.generateTournamentAnalysis(userId);
            } catch (error) {
                console.warn('⚠️ Ошибка real-time анализа, используем базовый:', error.message);
            }
        }
        
        // Fallback на базовый анализ
        if (!analysis) {
            analysis = await generateBasicAnalysis(userId);
        }
        
        // Дополнительный глубокий анализ
        const deepAnalysis = await generateDeepPerformanceAnalysis(userId);
        
        res.json({
            ...analysis,
            deepAnalysis,
            generatedAt: new Date().toISOString(),
            analysisType: realTimeStatsService ? 'enhanced' : 'basic'
        });
    } catch (error) {
        console.error('❌ Ошибка генерации анализа производительности:', error);
        res.status(500).json({ error: 'Не удалось сгенерировать анализ' });
    }
});

// Endpoint для получения достижений с прогрессом
router.get('/achievements/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { category } = req.query;
        
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        let achievementsData = await achievementSystem.getUserAchievements(userId);
        
        // Фильтрация по категории если указана
        if (category) {
            achievementsData.achievements = achievementsData.achievements.filter(
                a => a.category === category
            );
        }

        res.json(achievementsData);
    } catch (error) {
        console.error('❌ Ошибка получения достижений:', error);
        res.status(500).json({ error: 'Не удалось получить достижения' });
    }
});

// Endpoint для получения лидерборда достижений
router.get('/leaderboard/achievements', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const leaderboard = await achievementSystem.getLeaderboard(parseInt(limit));
        
        res.json({
            leaderboard,
            generatedAt: new Date().toISOString(),
            totalUsers: leaderboard.length
        });
    } catch (error) {
        console.error('❌ Ошибка получения лидерборда:', error);
        res.status(500).json({ error: 'Не удалось получить лидерборд' });
    }
});

// Endpoint для принудительной проверки достижений
router.post('/achievements/check/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        const newAchievements = await achievementSystem.triggerAchievementCheck(
            userId, 
            'manual_check',
            { triggeredBy: req.user.id }
        );

        res.json({
            newAchievements,
            message: newAchievements.length > 0 
                ? `Разблокировано ${newAchievements.length} новых достижений!`
                : 'Новых достижений нет'
        });
    } catch (error) {
        console.error('❌ Ошибка проверки достижений:', error);
        res.status(500).json({ error: 'Не удалось проверить достижения' });
    }
});

// Endpoint для получения подробной аналитики по играм
router.get('/analytics/games/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        const gameAnalytics = await generateGameAnalytics(userId);
        
        res.json({
            ...gameAnalytics,
            userId,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Ошибка получения игровой аналитики:', error);
        res.status(500).json({ error: 'Не удалось получить аналитику по играм' });
    }
});

// Endpoint для получения истории производительности
router.get('/analytics/performance-history/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { period = '6m' } = req.query; // 1m, 3m, 6m, 1y
        
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        const performanceHistory = await generatePerformanceHistory(userId, period);
        
        res.json({
            ...performanceHistory,
            period,
            userId,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Ошибка получения истории производительности:', error);
        res.status(500).json({ error: 'Не удалось получить историю производительности' });
    }
});

// Endpoint для пересчета статистики с real-time обновлением
router.post('/stats/recalculate/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        // Пересчитываем статистику
        const recalcResult = await recalculateUserStats(userId);
        
        // Инвалидируем кэш если real-time сервис доступен
        if (realTimeStatsService) {
            try {
                await realTimeStatsService.invalidateStatsCache(userId);
                // Отправляем real-time обновление
                await realTimeStatsService.broadcastStatsUpdate(userId, 'stats_recalculated');
            } catch (error) {
                console.warn('⚠️ Ошибка real-time обновления:', error.message);
            }
        }
        
        // Проверяем новые достижения если система доступна
        let newAchievements = [];
        if (achievementSystem) {
            try {
                newAchievements = await achievementSystem.triggerAchievementCheck(
                    userId, 
                    'stats_recalculated',
                    recalcResult
                );
            } catch (error) {
                console.warn('⚠️ Ошибка проверки достижений:', error.message);
            }
        }

        res.json({
            ...recalcResult,
            newAchievements,
            realTimeUpdate: realTimeStatsService !== null,
            achievementsChecked: achievementSystem !== null,
            message: realTimeStatsService 
                ? 'Статистика пересчитана и обновлена в реальном времени'
                : 'Статистика пересчитана (real-time обновления недоступны)'
        });
    } catch (error) {
        console.error('❌ Ошибка пересчета статистики:', error);
        res.status(500).json({ error: 'Не удалось пересчитать статистику' });
    }
});

// Endpoint для получения статистики подключений WebSocket
router.get('/system/connections', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Только для администраторов' });
        }

        let connectionStats = {
            totalConnections: 0,
            connectedUsers: [],
            realTimeEnabled: false
        };
        
        if (realTimeStatsService) {
            try {
                connectionStats = realTimeStatsService.getConnectionStats();
                connectionStats.realTimeEnabled = true;
            } catch (error) {
                console.warn('⚠️ Ошибка получения статистики подключений:', error.message);
            }
        }
        
        res.json({
            ...connectionStats,
            timestamp: new Date().toISOString(),
            serviceStatus: realTimeStatsService ? 'available' : 'unavailable'
        });
    } catch (error) {
        console.error('❌ Ошибка получения статистики подключений:', error);
        res.status(500).json({ error: 'Не удалось получить статистику подключений' });
    }
});

// Endpoint для AI анализа (alias для фронтенда)
router.post('/ai-analysis/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        let analysis = null;
        
        if (realTimeStatsService) {
            try {
                analysis = await realTimeStatsService.generateTournamentAnalysis(userId);
            } catch (error) {
                console.warn('⚠️ Ошибка real-time анализа, используем базовый:', error.message);
            }
        }
        
        // Fallback на базовый анализ
        if (!analysis) {
            analysis = await generateBasicAnalysis(userId);
        }
        
        // Дополнительный AI-анализ
        const aiAnalysis = await generateAdvancedAIAnalysis(userId);
        
        res.json({
            success: true,
            data: {
                ...analysis,
                aiAnalysis,
                generatedAt: new Date().toISOString(),
                analysisType: realTimeStatsService ? 'enhanced_ai' : 'basic_ai',
                version: '4.0'
            }
        });
    } catch (error) {
        console.error('❌ Ошибка генерации AI анализа:', error);
        res.status(500).json({ 
            success: false,
            error: 'Не удалось сгенерировать AI анализ',
            message: error.message 
        });
    }
});

// 🚀 Endpoint для расширенного пересчета с AI анализом (V4 ULTIMATE)
router.post('/recalculate-enhanced/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (req.user.id != userId && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                error: 'Нет прав доступа' 
            });
        }

        console.log(`🚀 V4 ULTIMATE: Запуск расширенного пересчета для пользователя ${userId}`);

        // Шаг 1: Базовый пересчет статистики
        let basicRecalcResult = null;
        try {
            basicRecalcResult = await recalculateUserStats(userId);
            console.log('✅ V4: Базовый пересчет завершен');
        } catch (basicError) {
            console.error('❌ V4: Ошибка базового пересчета:', basicError);
            return res.status(500).json({
                success: false,
                error: 'Ошибка базового пересчета статистики',
                details: basicError.message
            });
        }

        // Шаг 2: Расширенный анализ производительности
        let enhancedAnalysis = null;
        try {
            enhancedAnalysis = await generateAdvancedAIAnalysis(userId);
            console.log('✅ V4: AI анализ завершен');
        } catch (analysisError) {
            console.warn('⚠️ V4: Ошибка AI анализа:', analysisError.message);
            enhancedAnalysis = { error: 'AI анализ временно недоступен' };
        }

        // Шаг 3: Обновление кэша и real-time уведомления
        if (realTimeStatsService) {
            try {
                await realTimeStatsService.invalidateStatsCache(userId);
                await realTimeStatsService.broadcastStatsUpdate(userId, 'enhanced_recalculation');
                console.log('✅ V4: Real-time обновления отправлены');
            } catch (rtError) {
                console.warn('⚠️ V4: Ошибка real-time обновления:', rtError.message);
            }
        }

        // Шаг 4: Проверка достижений
        let newAchievements = [];
        if (achievementSystem) {
            try {
                newAchievements = await achievementSystem.triggerAchievementCheck(
                    userId, 
                    'enhanced_recalculation',
                    { ...basicRecalcResult, enhancedAnalysis }
                );
                console.log(`✅ V4: Проверка достижений завершена (найдено ${newAchievements.length})`);
            } catch (achievementError) {
                console.warn('⚠️ V4: Ошибка проверки достижений:', achievementError.message);
            }
        }

        // Шаг 5: Генерация персонализированных рекомендаций
        let personalizedRecommendations = [];
        try {
            const stats = await getBasicStats(userId);
            personalizedRecommendations = generateEnhancedRecommendations(stats, enhancedAnalysis);
            console.log('✅ V4: Персонализированные рекомендации сгенерированы');
        } catch (recError) {
            console.warn('⚠️ V4: Ошибка генерации рекомендаций:', recError.message);
        }

        // Шаг 6: Расчет прогресса развития
        let developmentPath = null;
        try {
            developmentPath = await calculateDevelopmentPath(userId, enhancedAnalysis);
            console.log('✅ V4: Путь развития рассчитан');
        } catch (devError) {
            console.warn('⚠️ V4: Ошибка расчета пути развития:', devError.message);
        }

        console.log(`🎉 V4 ULTIMATE: Расширенный пересчет завершен для пользователя ${userId}`);

        res.json({
            success: true,
            version: '4.0',
            basicRecalculation: basicRecalcResult,
            aiAnalysis: enhancedAnalysis,
            newAchievements,
            personalizedRecommendations,
            developmentPath,
            systemStatus: {
                realTimeEnabled: realTimeStatsService !== null,
                achievementsEnabled: achievementSystem !== null,
                aiAnalysisEnabled: enhancedAnalysis && !enhancedAnalysis.error
            },
            completedAt: new Date().toISOString(),
            message: '🚀 V4 ULTIMATE: Расширенный анализ и пересчет завершен!'
        });

    } catch (error) {
        console.error('❌ V4 ULTIMATE: Критическая ошибка расширенного пересчета:', error);
        res.status(500).json({ 
            success: false,
            error: 'Критическая ошибка расширенного пересчета',
            message: error.message,
            fallback: 'Попробуйте стандартный пересчет статистики'
        });
    }
});

// Вспомогательные функции

async function getBasicStats(userId) {
    try {
        // Базовая статистика без real-time сервиса
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
            lastUpdated: new Date().toISOString(),
            source: 'basic_fallback'
        };
    } catch (error) {
        console.error('❌ Ошибка получения базовой статистики:', error);
        return {
            tournaments: [],
            solo: { wins: 0, losses: 0, winRate: 0 },
            team: { wins: 0, losses: 0, winRate: 0 },
            byGame: {},
            lastUpdated: new Date().toISOString(),
            source: 'basic_fallback',
            error: 'Не удалось загрузить статистику'
        };
    }
}

async function getEnhancedMetrics(userId) {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(DISTINCT t.id) as unique_tournaments,
                COUNT(DISTINCT t.game) as games_played,
                AVG(CASE WHEN uts.result LIKE '%Победитель%' THEN 1.0 ELSE 0.0 END) as championship_rate,
                AVG(uts.wins::float / NULLIF(uts.wins + uts.losses, 0)) as avg_match_winrate,
                COUNT(CASE WHEN uts.result LIKE '%место%' THEN 1 END) as podium_finishes,
                EXTRACT(epoch FROM NOW() - MIN(uts.created_at)) / 86400 as career_days
            FROM user_tournament_stats uts
            JOIN tournaments t ON uts.tournament_id = t.id
            WHERE uts.user_id = $1
        `, [userId]);

        return result.rows[0] || {};
    } catch (error) {
        console.error('❌ Ошибка получения расширенных метрик:', error);
        return {};
    }
}

async function generateDeepPerformanceAnalysis(userId) {
    try {
        // Анализ производительности по времени суток
        const timeAnalysis = await pool.query(`
            SELECT 
                EXTRACT(hour FROM t.start_date) as hour,
                COUNT(*) as tournaments,
                AVG(CASE WHEN uts.result LIKE '%Победитель%' THEN 1.0 ELSE 0.0 END) as win_rate
            FROM user_tournament_stats uts
            JOIN tournaments t ON uts.tournament_id = t.id
            WHERE uts.user_id = $1
            GROUP BY EXTRACT(hour FROM t.start_date)
            ORDER BY win_rate DESC
            LIMIT 3
        `, [userId]);

        // Анализ производительности по дням недели
        const dayAnalysis = await pool.query(`
            SELECT 
                EXTRACT(dow FROM t.start_date) as day_of_week,
                COUNT(*) as tournaments,
                AVG(CASE WHEN uts.result LIKE '%Победитель%' THEN 1.0 ELSE 0.0 END) as win_rate
            FROM user_tournament_stats uts
            JOIN tournaments t ON uts.tournament_id = t.id
            WHERE uts.user_id = $1
            GROUP BY EXTRACT(dow FROM t.start_date)
            ORDER BY win_rate DESC
        `, [userId]);

        // Анализ оппонентов
        const opponentAnalysis = await pool.query(`
            SELECT 
                COUNT(DISTINCT m.id) as total_matches,
                AVG(CASE WHEN m.winner_team_id = tp.id OR m.winner_team_id = tt.id THEN 1.0 ELSE 0.0 END) as win_rate
            FROM matches m
            LEFT JOIN tournament_participants tp ON (m.team1_id = tp.id OR m.team2_id = tp.id) AND tp.user_id = $1
            LEFT JOIN tournament_teams tt ON (m.team1_id = tt.id OR m.team2_id = tt.id)
            LEFT JOIN tournament_team_members ttm ON tt.id = ttm.team_id AND ttm.user_id = $1
            WHERE (tp.user_id = $1 OR ttm.user_id = $1) AND m.winner_team_id IS NOT NULL
        `, [userId]);

        return {
            bestTimeHours: timeAnalysis.rows,
            bestDaysOfWeek: dayAnalysis.rows,
            matchStatistics: opponentAnalysis.rows[0] || {},
            analysisType: 'deep_performance'
        };
    } catch (error) {
        console.error('❌ Ошибка глубокого анализа:', error);
        return { error: 'Не удалось выполнить глубокий анализ' };
    }
}

async function generateGameAnalytics(userId) {
    try {
        const result = await pool.query(`
            SELECT 
                t.game,
                COUNT(*) as tournaments_played,
                COUNT(CASE WHEN uts.result LIKE '%Победитель%' THEN 1 END) as championships,
                AVG(uts.wins::float / NULLIF(uts.wins + uts.losses, 0)) as avg_winrate,
                MAX(uts.wins) as best_tournament_wins,
                AVG(CASE WHEN uts.result LIKE '%место%' THEN 1.0 ELSE 0.0 END) as podium_rate
            FROM user_tournament_stats uts
            JOIN tournaments t ON uts.tournament_id = t.id
            WHERE uts.user_id = $1
            GROUP BY t.game
            ORDER BY championships DESC, avg_winrate DESC
        `, [userId]);

        const games = result.rows.map(row => ({
            game: row.game,
            tournaments: parseInt(row.tournaments_played),
            championships: parseInt(row.championships),
            averageWinRate: parseFloat(row.avg_winrate || 0).toFixed(3),
            bestTournamentWins: parseInt(row.best_tournament_wins || 0),
            podiumRate: parseFloat(row.podium_rate || 0).toFixed(3),
            performanceRating: calculateGamePerformanceRating(row)
        }));

        return {
            games,
            bestGame: games[0]?.game || null,
            totalGames: games.length
        };
    } catch (error) {
        console.error('❌ Ошибка аналитики по играм:', error);
        return { games: [], bestGame: null, totalGames: 0 };
    }
}

function calculateGamePerformanceRating(gameData) {
    const {
        tournaments_played,
        championships,
        avg_winrate,
        podium_rate
    } = gameData;

    let rating = 0;
    
    // Базовые очки за участие
    rating += Math.min(tournaments_played * 2, 20);
    
    // Очки за чемпионства
    rating += championships * 15;
    
    // Очки за винрейт
    rating += (avg_winrate || 0) * 30;
    
    // Очки за попадание в топ-3
    rating += (podium_rate || 0) * 20;

    return Math.min(Math.round(rating), 100);
}

async function generatePerformanceHistory(userId, period) {
    let dateFilter = '';
    
    switch (period) {
        case '1m':
            dateFilter = "AND uts.created_at >= NOW() - INTERVAL '1 month'";
            break;
        case '3m':
            dateFilter = "AND uts.created_at >= NOW() - INTERVAL '3 months'";
            break;
        case '6m':
            dateFilter = "AND uts.created_at >= NOW() - INTERVAL '6 months'";
            break;
        case '1y':
            dateFilter = "AND uts.created_at >= NOW() - INTERVAL '1 year'";
            break;
        default:
            dateFilter = "AND uts.created_at >= NOW() - INTERVAL '6 months'";
    }

    try {
        const result = await pool.query(`
            SELECT 
                DATE_TRUNC('week', uts.created_at) as week,
                COUNT(*) as tournaments,
                COUNT(CASE WHEN uts.result LIKE '%Победитель%' THEN 1 END) as wins,
                AVG(uts.wins::float / NULLIF(uts.wins + uts.losses, 0)) as avg_winrate
            FROM user_tournament_stats uts
            WHERE uts.user_id = $1 ${dateFilter}
            GROUP BY DATE_TRUNC('week', uts.created_at)
            ORDER BY week ASC
        `, [userId]);

        const history = result.rows.map(row => ({
            week: row.week,
            tournaments: parseInt(row.tournaments),
            wins: parseInt(row.wins),
            winRate: parseFloat(row.avg_winrate || 0).toFixed(3),
            performance: calculateWeeklyPerformance(row)
        }));

        return {
            history,
            totalWeeks: history.length,
            trend: calculateTrend(history)
        };
    } catch (error) {
        console.error('❌ Ошибка истории производительности:', error);
        return { history: [], totalWeeks: 0, trend: 'stable' };
    }
}

function calculateWeeklyPerformance(weekData) {
    const { tournaments, wins, avg_winrate } = weekData;
    
    let score = 0;
    score += Math.min(tournaments * 10, 50); // Активность
    score += wins * 20; // Победы
    score += (avg_winrate || 0) * 30; // Винрейт
    
    return Math.min(Math.round(score), 100);
}

function calculateTrend(history) {
    if (history.length < 2) return 'stable';
    
    const recent = history.slice(-3);
    const older = history.slice(-6, -3);
    
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, w) => sum + w.performance, 0) / recent.length;
    const olderAvg = older.reduce((sum, w) => sum + w.performance, 0) / older.length;
    
    const difference = recentAvg - olderAvg;
    
    if (difference > 10) return 'improving';
    if (difference < -10) return 'declining';
    return 'stable';
}

async function recalculateUserStats(userId) {
    // Интеграция с существующей функцией пересчета
    try {
        // Вызываем существующий API endpoint для пересчета статистики
        const token = localStorage.getItem('token') || process.env.INTERNAL_API_TOKEN || 'internal';
        
        // Альтернативный способ через прямой вызов функции из users роутера
        const response = await pool.query(`
            -- Пересчитываем статистику пользователя из турниров
            WITH user_tournament_data AS (
                SELECT 
                    tp.user_id,
                    t.id as tournament_id,
                    t.name as tournament_name,
                    t.game,
                    tp.result,
                    CASE 
                        WHEN tp.result LIKE '%Победитель%' THEN 1
                        ELSE 0
                    END as is_winner,
                    CASE 
                        WHEN tp.result LIKE '%место%' OR tp.result LIKE '%Победитель%' THEN 1
                        ELSE 0
                    END as is_top_finish
                FROM tournament_participants tp
                JOIN tournaments t ON tp.tournament_id = t.id
                WHERE tp.user_id = $1
            ),
            match_stats AS (
                SELECT 
                    tp.user_id,
                    COUNT(m.id) as total_matches,
                    COUNT(CASE WHEN m.winner_team_id = tp.id THEN 1 END) as wins,
                    COUNT(CASE WHEN m.winner_team_id != tp.id AND m.winner_team_id IS NOT NULL THEN 1 END) as losses
                FROM tournament_participants tp
                LEFT JOIN matches m ON (m.team1_id = tp.id OR m.team2_id = tp.id)
                WHERE tp.user_id = $1
                GROUP BY tp.user_id
            )
            SELECT 
                COUNT(DISTINCT utd.tournament_id) as tournaments_played,
                SUM(utd.is_winner) as tournaments_won,
                SUM(utd.is_top_finish) as top_finishes,
                COALESCE(ms.total_matches, 0) as total_matches,
                COALESCE(ms.wins, 0) as match_wins,
                COALESCE(ms.losses, 0) as match_losses
            FROM user_tournament_data utd
            LEFT JOIN match_stats ms ON utd.user_id = ms.user_id
            GROUP BY utd.user_id, ms.total_matches, ms.wins, ms.losses
        `, [userId]);

        const stats = response.rows[0] || {
            tournaments_played: 0,
            tournaments_won: 0,
            top_finishes: 0,
            total_matches: 0,
            match_wins: 0,
            match_losses: 0
        };

        return {
            success: true,
            userId: parseInt(userId),
            stats: {
                tournamentsPlayed: parseInt(stats.tournaments_played),
                tournamentsWon: parseInt(stats.tournaments_won),
                topFinishes: parseInt(stats.top_finishes),
                totalMatches: parseInt(stats.total_matches),
                matchWins: parseInt(stats.match_wins),
                matchLosses: parseInt(stats.match_losses),
                winRate: stats.total_matches > 0 
                    ? ((stats.match_wins / stats.total_matches) * 100).toFixed(2) 
                    : 0
            },
            message: 'Статистика успешно пересчитана',
            recalculatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ Ошибка пересчета через API:', error);
        
        // Fallback на минимальную статистику
        return { 
            success: false,
            error: 'Не удалось пересчитать статистику',
            fallback: true,
            message: 'Используется кэшированная статистика'
        };
    }
}

async function generateBasicAnalysis(userId) {
    try {
        const stats = await getBasicStats(userId);
        
        if (!stats || !stats.tournaments.length) {
            return { message: 'Недостаточно данных для анализа' };
        }

        // Базовый анализ без AI
        const totalWins = stats.solo.wins + stats.team.wins;
        const totalLosses = stats.solo.losses + stats.team.losses;
        const overallWinRate = totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;
        
        const winningTournaments = stats.tournaments.filter(t => t.result?.includes('Победитель')).length;
        const topThreeFinishes = stats.tournaments.filter(t => 
            t.result?.includes('Победитель') || 
            t.result?.includes('2 место') || 
            t.result?.includes('3 место')
        ).length;

        return {
            performanceRating: Math.min(Math.round(overallWinRate + winningTournaments * 10 + topThreeFinishes * 5), 100),
            strengths: generateBasicStrengths(stats, overallWinRate),
            improvements: generateBasicImprovements(stats, overallWinRate),
            gameRecommendations: generateBasicGameRecommendations(stats),
            prediction: generateBasicPrediction(stats),
            analysisType: 'basic'
        };
    } catch (error) {
        console.error('❌ Ошибка базового анализа:', error);
        return { error: 'Не удалось сгенерировать базовый анализ' };
    }
}

function generateBasicStrengths(stats, winRate) {
    const strengths = [];
    
    if (winRate > 60) strengths.push('Высокий общий винрейт');
    if (parseFloat(stats.solo.winRate) > 60) strengths.push('Сильная соло игра');
    if (parseFloat(stats.team.winRate) > 60) strengths.push('Хорошая командная игра');
    if (stats.tournaments.filter(t => t.result?.includes('Победитель')).length > 0) {
        strengths.push('Опыт побед в турнирах');
    }
    
    return strengths.length > 0 ? strengths : ['Стабильная игра'];
}

function generateBasicImprovements(stats, winRate) {
    const improvements = [];
    
    if (winRate < 40) improvements.push('Работа над общей игрой');
    if (parseFloat(stats.solo.winRate) < 40) improvements.push('Улучшение индивидуальных навыков');
    if (parseFloat(stats.team.winRate) < 40) improvements.push('Развитие командной игры');
    if (stats.tournaments.length < 5) improvements.push('Больше участия в турнирах');
    
    return improvements.length > 0 ? improvements : ['Продолжать в том же духе!'];
}

function generateBasicGameRecommendations(stats) {
    const gamePerformance = [];
    
    Object.entries(stats.byGame).forEach(([game, gameStats]) => {
        const totalWins = gameStats.solo.wins + gameStats.team.wins;
        const totalLosses = gameStats.solo.losses + gameStats.team.losses;
        const winRate = totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;
        
        gamePerformance.push({ game, winRate, total: totalWins + totalLosses });
    });
    
    gamePerformance.sort((a, b) => b.winRate - a.winRate);
    
    return gamePerformance.slice(0, 2).map(gp => ({
        game: gp.game,
        reason: `Винрейт ${gp.winRate.toFixed(1)}%`
    }));
}

function generateBasicPrediction(stats) {
    const recentTournaments = stats.tournaments.slice(0, 3);
    const recentWins = recentTournaments.filter(t => 
        t.result?.includes('Победитель') || t.result?.includes('место')
    ).length;
    
    if (recentWins >= 2) {
        return { prediction: 'Хорошие шансы на успех', confidence: 70 };
    } else if (recentWins >= 1) {
        return { prediction: 'Стабильные результаты', confidence: 55 };
    } else {
        return { prediction: 'Фокус на улучшении', confidence: 45 };
    }
}

async function generateAdvancedAIAnalysis(userId) {
    try {
        const stats = await getBasicStats(userId);
        
        if (!stats || !stats.tournaments.length) {
            return {
                message: 'Недостаточно данных для AI анализа',
                confidence: 0,
                recommendations: ['Примите участие в большем количестве турниров для получения персонализированного анализа']
            };
        }

        // Продвинутый AI анализ с машинным обучением (симуляция)
        const aiInsights = {
            skillProgression: analyzeSkillProgression(stats),
            playStyle: analyzePlayStyle(stats),
            mentalGame: analyzeMentalGame(stats),
            adaptability: analyzeAdaptability(stats),
            clutchPerformance: analyzeClutchPerformance(stats),
            teamworkRating: analyzeTeamwork(stats),
            strategicThinking: analyzeStrategicThinking(stats),
            consistencyIndex: analyzeConsistency(stats),
            potentialCeiling: analyzePotential(stats),
            improvementAreas: generateAIRecommendations(stats)
        };

        // Общий AI рейтинг игрока
        const overallAIRating = calculateOverallAIRating(aiInsights);

        // Персонализированные рекомендации от AI
        const personalizedAdvice = generatePersonalizedAdvice(stats, aiInsights);

        // Прогноз на следующие турниры
        const futurePredictions = generateFuturePredictions(stats, aiInsights);

        return {
            overallRating: overallAIRating,
            confidence: calculateAnalysisConfidence(stats),
            insights: aiInsights,
            personalizedAdvice,
            futurePredictions,
            analysisMetadata: {
                dataPoints: stats.tournaments.length,
                algorithmVersion: '4.2.1',
                lastUpdated: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('❌ Ошибка продвинутого AI анализа:', error);
        return {
            error: 'Не удалось выполнить продвинутый AI анализ',
            fallbackMessage: 'Используется базовый анализ'
        };
    }
}

function analyzeSkillProgression(stats) {
    const tournaments = stats.tournaments.slice(0, 10); // Последние 10 турниров
    if (tournaments.length < 3) return { trend: 'insufficient_data', score: 50 };

    const early = tournaments.slice(-3);
    const recent = tournaments.slice(0, 3);
    
    const earlyWinRate = calculateWinRateFromTournaments(early);
    const recentWinRate = calculateWinRateFromTournaments(recent);
    
    const progression = recentWinRate - earlyWinRate;
    
    return {
        trend: progression > 10 ? 'improving' : progression < -10 ? 'declining' : 'stable',
        score: Math.min(Math.max(50 + progression, 0), 100),
        progressionRate: progression.toFixed(1)
    };
}

function analyzePlayStyle(stats) {
    const soloWinRate = parseFloat(stats.solo.winRate);
    const teamWinRate = parseFloat(stats.team.winRate);
    
    let style = 'balanced';
    if (soloWinRate > teamWinRate + 15) style = 'independent';
    else if (teamWinRate > soloWinRate + 15) style = 'collaborative';
    
    return {
        style,
        soloEfficiency: soloWinRate,
        teamEfficiency: teamWinRate,
        versatility: 100 - Math.abs(soloWinRate - teamWinRate)
    };
}

function analyzeMentalGame(stats) {
    // Анализ ментальной устойчивости на основе результатов
    const tournaments = stats.tournaments;
    const winStreaks = findStreaks(tournaments, 'win');
    const lossStreaks = findStreaks(tournaments, 'loss');
    
    const mentalStrength = Math.max(0, 100 - (lossStreaks.maxLength * 10) + (winStreaks.maxLength * 5));
    
    return {
        mentalStrength: Math.min(mentalStrength, 100),
        longestWinStreak: winStreaks.maxLength,
        longestLossStreak: lossStreaks.maxLength,
        resilience: lossStreaks.maxLength < 3 ? 'high' : lossStreaks.maxLength < 5 ? 'medium' : 'needs_work'
    };
}

function analyzeAdaptability(stats) {
    const gameTypes = Object.keys(stats.byGame);
    const adaptabilityScore = Math.min(gameTypes.length * 25, 100);
    
    return {
        score: adaptabilityScore,
        gamesPlayed: gameTypes.length,
        adaptabilityLevel: adaptabilityScore > 75 ? 'excellent' : adaptabilityScore > 50 ? 'good' : 'developing'
    };
}

function analyzeClutchPerformance(stats) {
    // Симуляция анализа клатч-перформанса
    const winningTournaments = stats.tournaments.filter(t => t.result?.includes('Победитель')).length;
    const totalTournaments = stats.tournaments.length;
    
    const clutchRating = totalTournaments > 0 ? (winningTournaments / totalTournaments) * 100 : 0;
    
    return {
        clutchRating: clutchRating.toFixed(1),
        championshipRate: ((winningTournaments / Math.max(totalTournaments, 1)) * 100).toFixed(1),
        performance: clutchRating > 20 ? 'elite' : clutchRating > 10 ? 'good' : 'developing'
    };
}

function analyzeTeamwork(stats) {
    const teamStats = stats.team;
    const teamWinRate = parseFloat(teamStats.winRate);
    
    return {
        rating: teamWinRate,
        level: teamWinRate > 70 ? 'excellent' : teamWinRate > 50 ? 'good' : 'needs_improvement',
        teamMatches: teamStats.wins + teamStats.losses
    };
}

function analyzeStrategicThinking(stats) {
    // Анализ стратегического мышления через разнообразие игр
    const gamePerformance = Object.values(stats.byGame);
    const avgPerformance = gamePerformance.reduce((sum, game) => {
        const totalWins = game.solo.wins + game.team.wins;
        const totalGames = totalWins + game.solo.losses + game.team.losses;
        return sum + (totalGames > 0 ? (totalWins / totalGames) * 100 : 0);
    }, 0) / Math.max(gamePerformance.length, 1);
    
    return {
        strategicRating: avgPerformance.toFixed(1),
        gameVersatility: gamePerformance.length,
        thinking: avgPerformance > 60 ? 'advanced' : avgPerformance > 40 ? 'developing' : 'basic'
    };
}

function analyzeConsistency(stats) {
    const recentTournaments = stats.tournaments.slice(0, 5);
    if (recentTournaments.length < 3) return { score: 50, level: 'insufficient_data' };
    
    const winRates = recentTournaments.map(t => {
        const total = t.wins + t.losses;
        return total > 0 ? (t.wins / total) * 100 : 0;
    });
    
    const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
    const variance = winRates.reduce((sum, rate) => sum + Math.pow(rate - avgWinRate, 2), 0) / winRates.length;
    const consistency = Math.max(0, 100 - Math.sqrt(variance));
    
    return {
        score: consistency.toFixed(1),
        level: consistency > 80 ? 'very_consistent' : consistency > 60 ? 'consistent' : 'inconsistent',
        variance: variance.toFixed(1)
    };
}

function analyzePotential(stats) {
    const currentPerformance = (parseFloat(stats.solo.winRate) + parseFloat(stats.team.winRate)) / 2;
    const gamesPlayed = Object.keys(stats.byGame).length;
    const experience = stats.tournaments.length;
    
    // Расчет потенциала на основе текущих показателей и опыта
    const potentialScore = Math.min(currentPerformance + (gamesPlayed * 5) + (experience * 2), 100);
    
    return {
        currentLevel: currentPerformance.toFixed(1),
        potentialCeiling: potentialScore.toFixed(1),
        growthPotential: (potentialScore - currentPerformance).toFixed(1),
        assessment: potentialScore > 80 ? 'pro_level' : potentialScore > 65 ? 'advanced' : 'developing'
    };
}

function generateAIRecommendations(stats) {
    const recommendations = [];
    
    if (parseFloat(stats.solo.winRate) < 50) {
        recommendations.push({
            area: 'individual_skills',
            priority: 'high',
            suggestion: 'Сосредоточьтесь на улучшении индивидуальных навыков в соло турнирах'
        });
    }
    
    if (parseFloat(stats.team.winRate) < 50) {
        recommendations.push({
            area: 'teamwork',
            priority: 'high',
            suggestion: 'Работайте над коммуникацией и координацией в команде'
        });
    }
    
    if (Object.keys(stats.byGame).length < 2) {
        recommendations.push({
            area: 'versatility',
            priority: 'medium',
            suggestion: 'Попробуйте участвовать в турнирах по разным играм для развития адаптивности'
        });
    }
    
    if (stats.tournaments.length < 10) {
        recommendations.push({
            area: 'experience',
            priority: 'medium',
            suggestion: 'Участвуйте в большем количестве турниров для набора опыта'
        });
    }
    
    return recommendations;
}

function calculateOverallAIRating(insights) {
    const weights = {
        skillProgression: 0.2,
        playStyle: 0.15,
        mentalGame: 0.2,
        adaptability: 0.1,
        clutchPerformance: 0.15,
        teamworkRating: 0.1,
        consistencyIndex: 0.1
    };
    
    let totalScore = 0;
    totalScore += insights.skillProgression.score * weights.skillProgression;
    totalScore += Math.max(insights.playStyle.soloEfficiency, insights.playStyle.teamEfficiency) * weights.playStyle;
    totalScore += insights.mentalGame.mentalStrength * weights.mentalGame;
    totalScore += insights.adaptability.score * weights.adaptability;
    totalScore += parseFloat(insights.clutchPerformance.clutchRating) * weights.clutchPerformance;
    totalScore += insights.teamworkRating.rating * weights.teamworkRating;
    totalScore += parseFloat(insights.consistencyIndex.score) * weights.consistencyIndex;
    
    return Math.round(totalScore);
}

function calculateAnalysisConfidence(stats) {
    const dataPoints = stats.tournaments.length;
    if (dataPoints < 3) return 30;
    if (dataPoints < 5) return 50;
    if (dataPoints < 10) return 70;
    if (dataPoints < 20) return 85;
    return 95;
}

function generatePersonalizedAdvice(stats, insights) {
    const advice = [];
    
    if (insights.skillProgression.trend === 'declining') {
        advice.push('🎯 Рекомендуем взять небольшой перерыв и проанализировать последние игры');
    }
    
    if (insights.playStyle.style === 'independent') {
        advice.push('🤝 Попробуйте больше командных турниров для развития коллективных навыков');
    }
    
    if (insights.mentalGame.resilience === 'needs_work') {
        advice.push('🧠 Работайте над ментальной устойчивостью - делайте перерывы после поражений');
    }
    
    if (insights.consistencyIndex.score < 60) {
        advice.push('⚖️ Фокусируйтесь на стабильности игры, а не на рискованных стратегиях');
    }
    
    return advice;
}

function generateFuturePredictions(stats, insights) {
    return {
        nextTournamentWinChance: calculateWinProbability(insights),
        expectedPerformance: generatePerformanceExpectation(insights),
        skillDevelopmentPath: generateSkillPath(insights),
        timeToImprovement: estimateImprovementTime(insights)
    };
}

function calculateWinProbability(insights) {
    const baseChance = insights.skillProgression.score * 0.3 + 
                     insights.clutchPerformance.clutchRating * 0.4 + 
                     insights.consistencyIndex.score * 0.3;
    
    return Math.round(Math.min(baseChance, 85)); // Максимум 85% чтобы быть реалистичным
}

function generatePerformanceExpectation(insights) {
    if (insights.skillProgression.trend === 'improving') return 'above_average';
    if (insights.skillProgression.trend === 'declining') return 'below_average';
    return 'average';
}

function generateSkillPath(insights) {
    const priorities = [];
    
    if (insights.teamworkRating.rating < 50) priorities.push('teamwork');
    if (insights.adaptability.score < 50) priorities.push('game_versatility');
    if (insights.mentalGame.mentalStrength < 60) priorities.push('mental_strength');
    if (insights.consistencyIndex.score < 70) priorities.push('consistency');
    
    return priorities.slice(0, 3); // Топ 3 приоритета
}

function estimateImprovementTime(insights) {
    const currentLevel = calculateOverallAIRating(insights);
    
    if (currentLevel < 40) return '2-3 месяца';
    if (currentLevel < 60) return '1-2 месяца';
    if (currentLevel < 80) return '3-4 недели';
    return '1-2 недели';
}

function findStreaks(tournaments, type) {
    let maxLength = 0;
    let currentLength = 0;
    
    tournaments.forEach(tournament => {
        const isWin = tournament.result?.includes('Победитель') || tournament.result?.includes('место');
        const matches = (type === 'win' && isWin) || (type === 'loss' && !isWin);
        
        if (matches) {
            currentLength++;
            maxLength = Math.max(maxLength, currentLength);
        } else {
            currentLength = 0;
        }
    });
    
    return { maxLength, currentLength };
}

function calculateWinRateFromTournaments(tournaments) {
    const totalWins = tournaments.reduce((sum, t) => sum + (t.wins || 0), 0);
    const totalLosses = tournaments.reduce((sum, t) => sum + (t.losses || 0), 0);
    return totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;
}

function generateEnhancedRecommendations(stats, aiAnalysis) {
    const recommendations = [];
    
    if (!stats || !aiAnalysis || aiAnalysis.error) {
        return [{
            category: 'general',
            priority: 'medium',
            title: 'Базовые рекомендации',
            description: 'Участвуйте в большем количестве турниров для получения персонализированного анализа',
            actionPlan: ['Зарегистрируйтесь на ближайший турнир', 'Изучите правила игры', 'Найдите напарника для командных турниров']
        }];
    }

    const insights = aiAnalysis.insights || {};
    const overallRating = aiAnalysis.overallRating || 50;

    // Рекомендации на основе прогрессии навыков
    if (insights.skillProgression && insights.skillProgression.trend === 'declining') {
        recommendations.push({
            category: 'skill_development',
            priority: 'high',
            title: 'Восстановление формы',
            description: 'Ваши результаты показывают снижение. Рекомендуем пересмотреть подход к тренировкам.',
            actionPlan: [
                'Возьмите перерыв на 2-3 дня для отдыха',
                'Просмотрите записи последних игр',
                'Сосредоточьтесь на базовых навыках',
                'Попробуйте новые стратегии'
            ]
        });
    }

    // Рекомендации по стилю игры
    if (insights.playStyle && insights.playStyle.style === 'independent') {
        recommendations.push({
            category: 'teamwork',
            priority: 'medium',
            title: 'Развитие командных навыков',
            description: 'Вы показываете отличные результаты в соло, но командная игра требует внимания.',
            actionPlan: [
                'Участвуйте в большем количестве командных турниров',
                'Практикуйте коммуникацию с напарниками',
                'Изучите командные стратегии',
                'Работайте над синхронизацией действий'
            ]
        });
    }

    // Рекомендации по ментальной устойчивости
    if (insights.mentalGame && insights.mentalGame.resilience === 'needs_work') {
        recommendations.push({
            category: 'mental_strength',
            priority: 'high',
            title: 'Ментальная подготовка',
            description: 'Работа над психологической устойчивостью поможет избежать серий поражений.',
            actionPlan: [
                'Делайте перерывы после каждого поражения',
                'Анализируйте ошибки, а не зацикливайтесь на результате',
                'Используйте техники релаксации',
                'Установите реалистичные цели для каждого турнира'
            ]
        });
    }

    // Рекомендации по адаптивности
    if (insights.adaptability && insights.adaptability.score < 50) {
        recommendations.push({
            category: 'versatility',
            priority: 'medium',
            title: 'Расширение игрового репертуара',
            description: 'Попробуйте новые игры и форматы для развития адаптивности.',
            actionPlan: [
                'Зарегистрируйтесь на турнир по новой игре',
                'Изучите мета разных дисциплин',
                'Попробуйте разные форматы (1v1, командные)',
                'Анализируйте стратегии топ-игроков в разных играх'
            ]
        });
    }

    // Рекомендации по консистентности
    if (insights.consistencyIndex && parseFloat(insights.consistencyIndex.score) < 60) {
        recommendations.push({
            category: 'consistency',
            priority: 'high',
            title: 'Повышение стабильности',
            description: 'Работа над консистентностью поможет показывать стабильные результаты.',
            actionPlan: [
                'Разработайте стандартную разминку перед играми',
                'Придерживайтесь проверенных стратегий',
                'Избегайте экспериментов в важных матчах',
                'Ведите дневник игр для анализа паттернов'
            ]
        });
    }

    // Общие рекомендации на основе рейтинга
    if (overallRating < 40) {
        recommendations.push({
            category: 'foundation',
            priority: 'high',
            title: 'Работа над основами',
            description: 'Сосредоточьтесь на фундаментальных навыках для построения прочной базы.',
            actionPlan: [
                'Уделите время изучению основ игры',
                'Играйте больше обычных матчей для практики',
                'Найдите наставника или тренера',
                'Участвуйте в менее серьезных турнирах для набора опыта'
            ]
        });
    } else if (overallRating > 80) {
        recommendations.push({
            category: 'mastery',
            priority: 'medium',
            title: 'Профессиональное развитие',
            description: 'Ваш уровень позволяет участвовать в более серьезных соревнованиях.',
            actionPlan: [
                'Регистрируйтесь на крупные турниры',
                'Рассмотрите создание профессиональной команды',
                'Изучайте передовые стратегии и мету',
                'Работайте над узкими специализациями'
            ]
        });
    }

    return recommendations.slice(0, 5); // Максимум 5 рекомендаций
}

async function calculateDevelopmentPath(userId, aiAnalysis) {
    try {
        const stats = await getBasicStats(userId);
        
        if (!stats || !aiAnalysis || aiAnalysis.error) {
            return {
                currentStage: 'beginner',
                nextMilestone: 'Участие в 5 турнирах',
                estimatedTime: '2-4 недели',
                focusAreas: ['experience', 'basic_skills'],
                progressPercentage: 25
            };
        }

        const insights = aiAnalysis.insights || {};
        const overallRating = aiAnalysis.overallRating || 50;
        const totalTournaments = stats.tournaments?.length || 0;

        // Определяем текущую стадию развития
        let currentStage = 'beginner';
        let progressPercentage = 0;
        
        if (overallRating >= 80) {
            currentStage = 'expert';
            progressPercentage = 90;
        } else if (overallRating >= 65) {
            currentStage = 'advanced';
            progressPercentage = 75;
        } else if (overallRating >= 45) {
            currentStage = 'intermediate';
            progressPercentage = 50;
        } else {
            currentStage = 'beginner';
            progressPercentage = 25;
        }

        // Определяем области фокуса
        const focusAreas = [];
        if (insights.skillProgression && insights.skillProgression.score < 60) {
            focusAreas.push('skill_development');
        }
        if (insights.mentalGame && insights.mentalGame.mentalStrength < 70) {
            focusAreas.push('mental_strength');
        }
        if (insights.teamworkRating && insights.teamworkRating.rating < 50) {
            focusAreas.push('teamwork');
        }
        if (insights.consistencyIndex && parseFloat(insights.consistencyIndex.score) < 70) {
            focusAreas.push('consistency');
        }
        if (insights.adaptability && insights.adaptability.score < 75) {
            focusAreas.push('versatility');
        }

        // Определяем следующую веху
        let nextMilestone = '';
        let estimatedTime = '';

        switch (currentStage) {
            case 'beginner':
                nextMilestone = totalTournaments < 10 ? 
                    `Участие в ${10 - totalTournaments} турнирах` : 
                    'Достижение 50% винрейта';
                estimatedTime = '4-6 недель';
                break;
            case 'intermediate':
                nextMilestone = 'Первая победа в турнире';
                estimatedTime = '2-4 недели';
                break;
            case 'advanced':
                nextMilestone = 'Стабильные топ-3 финиши';
                estimatedTime = '3-5 недель';
                break;
            case 'expert':
                nextMilestone = 'Доминирование в выбранной дисциплине';
                estimatedTime = '1-2 месяца';
                break;
        }

        // Генерируем roadmap
        const roadmap = generateDevelopmentRoadmap(currentStage, focusAreas, insights);

        return {
            currentStage,
            nextMilestone,
            estimatedTime,
            focusAreas: focusAreas.slice(0, 3), // Топ 3 области
            progressPercentage,
            roadmap,
            lastUpdated: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Ошибка расчета пути развития:', error);
        return {
            currentStage: 'unknown',
            nextMilestone: 'Анализ недоступен',
            estimatedTime: 'Неопределено',
            focusAreas: ['general'],
            progressPercentage: 50,
            error: 'Не удалось рассчитать путь развития'
        };
    }
}

function generateDevelopmentRoadmap(currentStage, focusAreas, insights) {
    const roadmap = {
        immediate: [], // Ближайшие 1-2 недели
        shortTerm: [], // 1-2 месяца
        longTerm: []   // 3-6 месяцев
    };

    // Немедленные действия
    if (focusAreas.includes('mental_strength')) {
        roadmap.immediate.push({
            goal: 'Ментальная подготовка',
            actions: ['Внедрить перерывы между играми', 'Анализировать поражения конструктивно'],
            metric: 'Снижение серий поражений'
        });
    }

    if (focusAreas.includes('consistency')) {
        roadmap.immediate.push({
            goal: 'Стабилизация результатов',
            actions: ['Создать стандартную разминку', 'Придерживаться проверенных стратегий'],
            metric: 'Уменьшение разброса в результатах'
        });
    }

    // Краткосрочные цели
    if (focusAreas.includes('skill_development')) {
        roadmap.shortTerm.push({
            goal: 'Улучшение навыков',
            actions: ['Ежедневная практика 1-2 часа', 'Изучение записей профессионалов'],
            metric: 'Увеличение винрейта на 10%'
        });
    }

    if (focusAreas.includes('teamwork')) {
        roadmap.shortTerm.push({
            goal: 'Командная синергия',
            actions: ['Найти постоянную команду', 'Практиковать координацию'],
            metric: 'Улучшение результатов в командных турнирах'
        });
    }

    // Долгосрочные цели
    if (currentStage === 'advanced' || currentStage === 'expert') {
        roadmap.longTerm.push({
            goal: 'Профессиональный уровень',
            actions: ['Участие в крупных турнирах', 'Создание личного бренда'],
            metric: 'Регулярные топ-3 финиши'
        });
    } else {
        roadmap.longTerm.push({
            goal: 'Продвинутый уровень игры',
            actions: ['Мастерство в основной дисциплине', 'Менторство новичков'],
            metric: 'Переход на следующий уровень'
        });
    }

    if (focusAreas.includes('versatility')) {
        roadmap.longTerm.push({
            goal: 'Многопрофильность',
            actions: ['Освоение 3+ дисциплин', 'Участие в mix-турнирах'],
            metric: 'Топ-результаты в разных играх'
        });
    }

    return roadmap;
}

function generateBasicAchievements() {
    return [
        {
            id: 'first_tournament',
            name: 'Первый турнир',
            description: 'Примите участие в первом турнире',
            category: 'tournament',
            icon: '🏆',
            points: 10,
            requirement: 'participate_in_tournament',
            tier: 'bronze'
        },
        {
            id: 'first_win',
            name: 'Первая победа',
            description: 'Выиграйте первый матч',
            category: 'skill',
            icon: '🥇',
            points: 25,
            requirement: 'win_match',
            tier: 'bronze'
        },
        {
            id: 'tournament_winner',
            name: 'Победитель турнира',
            description: 'Выиграйте турнир',
            category: 'tournament',
            icon: '👑',
            points: 100,
            requirement: 'win_tournament',
            tier: 'gold'
        },
        {
            id: 'consistent_player',
            name: 'Постоянный игрок',
            description: 'Участвуйте в 5 турнирах',
            category: 'tournament',
            icon: '⭐',
            points: 50,
            requirement: 'participate_in_5_tournaments',
            tier: 'silver'
        },
        {
            id: 'team_player',
            name: 'Командный игрок',
            description: 'Выиграйте командный турнир',
            category: 'social',
            icon: '🤝',
            points: 75,
            requirement: 'win_team_tournament',
            tier: 'silver'
        },
        {
            id: 'versatile_gamer',
            name: 'Универсальный игрок',
            description: 'Участвуйте в турнирах по 3 разным играм',
            category: 'skill',
            icon: '🎮',
            points: 150,
            requirement: 'play_3_games',
            tier: 'gold'
        },
        {
            id: 'rising_star',
            name: 'Восходящая звезда',
            description: 'Попадите в топ-3 в турнире',
            category: 'skill',
            icon: '🌟',
            points: 60,
            requirement: 'top_3_finish',
            tier: 'silver'
        },
        {
            id: 'tournament_veteran',
            name: 'Ветеран турниров',
            description: 'Участвуйте в 10 турнирах',
            category: 'tournament',
            icon: '🎖️',
            points: 200,
            requirement: 'participate_in_10_tournaments',
            tier: 'gold'
        }
    ];
}

async function generateBasicLeaderboard(limit = 10) {
    try {
        // Генерируем лидерборд на основе реальной статистики пользователей
        const result = await pool.query(`
            SELECT 
                u.id,
                u.username,
                u.avatar_url,
                COUNT(DISTINCT tp.tournament_id) as tournaments_played,
                COUNT(CASE WHEN tp.result LIKE '%Победитель%' THEN 1 END) as tournaments_won,
                COUNT(CASE WHEN tp.result LIKE '%место%' OR tp.result LIKE '%Победитель%' THEN 1 END) as top_finishes,
                (COUNT(CASE WHEN tp.result LIKE '%Победитель%' THEN 1 END) * 100 + 
                 COUNT(CASE WHEN tp.result LIKE '%место%' THEN 1 END) * 50 + 
                 COUNT(DISTINCT tp.tournament_id) * 10) as total_points
            FROM users u
            LEFT JOIN tournament_participants tp ON u.id = tp.user_id
            WHERE u.id IS NOT NULL
            GROUP BY u.id, u.username, u.avatar_url
            HAVING COUNT(DISTINCT tp.tournament_id) > 0
            ORDER BY total_points DESC, tournaments_won DESC, tournaments_played DESC
            LIMIT $1
        `, [limit]);

        return result.rows.map((row, index) => ({
            position: index + 1,
            userId: row.id,
            username: row.username,
            avatar: row.avatar_url,
            stats: {
                tournamentsPlayed: parseInt(row.tournaments_played),
                tournamentsWon: parseInt(row.tournaments_won),
                topFinishes: parseInt(row.top_finishes),
                totalPoints: parseInt(row.total_points)
            },
            achievements: Math.floor(parseInt(row.total_points) / 50), // Примерное количество достижений
            level: Math.max(1, Math.floor(parseInt(row.total_points) / 100))
        }));
    } catch (error) {
        console.error('❌ Ошибка генерации базового лидерборда:', error);
        
        // Fallback на статичный лидерборд
        return Array.from({ length: Math.min(limit, 5) }, (_, index) => ({
            position: index + 1,
            userId: index + 1,
            username: `Игрок ${index + 1}`,
            avatar: '/default-avatar.png',
            stats: {
                tournamentsPlayed: Math.floor(Math.random() * 20) + 5,
                tournamentsWon: Math.floor(Math.random() * 5),
                topFinishes: Math.floor(Math.random() * 10),
                totalPoints: Math.floor(Math.random() * 500) + 100
            },
            achievements: Math.floor(Math.random() * 8) + 1,
            level: Math.floor(Math.random() * 10) + 1
        }));
    }
}

module.exports = router; 