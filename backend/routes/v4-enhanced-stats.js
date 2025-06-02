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
        // Здесь можно вызвать существующую функцию recalculate-tournament-stats
        const response = await fetch(`http://localhost:3000/api/users/recalculate-tournament-stats`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN || 'internal'}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        if (response.ok) {
            return await response.json();
        } else {
            throw new Error('Ошибка пересчета статистики');
        }
    } catch (error) {
        console.error('❌ Ошибка пересчета через API:', error);
        return { error: 'Не удалось пересчитать статистику' };
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

module.exports = router; 