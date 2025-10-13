/**
 * 📊 TOURNAMENT STATS CONTROLLER
 * Контроллер для API статистики турниров
 * @version 1.0.0
 * @date 13 октября 2025
 */

const TournamentStatsService = require('../../services/tournament/TournamentStatsService');
const TournamentStatsRepository = require('../../repositories/tournament/TournamentStatsRepository');

class TournamentStatsController {
    /**
     * 📊 Получение полной статистики турнира
     * GET /api/tournaments/:id/stats
     */
    async getTournamentStats(req, res) {
        try {
            const { id } = req.params;

            console.log(`📊 [StatsController] Запрос статистики турнира ${id}`);

            const stats = await TournamentStatsService.getTournamentStats(parseInt(id));

            if (!stats.hasStats) {
                return res.json({
                    success: true,
                    hasStats: false,
                    message: 'Статистика пока недоступна. Завершите первые матчи турнира.'
                });
            }

            return res.json({
                success: true,
                hasStats: true,
                ...stats
            });

        } catch (error) {
            console.error(`❌ [StatsController] Ошибка получения статистики:`, error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения статистики турнира',
                message: error.message
            });
        }
    }

    /**
     * 🏆 Получение MVP турнира
     * GET /api/tournaments/:id/stats/mvp
     */
    async getMVP(req, res) {
        try {
            const { id } = req.params;

            console.log(`🏆 [StatsController] Запрос MVP турнира ${id}`);

            const allStats = await TournamentStatsRepository.getAllTournamentStats(parseInt(id));

            if (allStats.length === 0) {
                return res.json({
                    success: true,
                    hasMVP: false,
                    message: 'MVP еще не определен'
                });
            }

            const mvp = allStats.find(s => s.is_tournament_mvp) || allStats[0];

            return res.json({
                success: true,
                hasMVP: true,
                mvp
            });

        } catch (error) {
            console.error(`❌ [StatsController] Ошибка получения MVP:`, error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения MVP турнира',
                message: error.message
            });
        }
    }

    /**
     * 📈 Получение лидерборда по категории
     * GET /api/tournaments/:id/stats/leaderboard?category=most_kills&limit=10
     */
    async getLeaderboard(req, res) {
        try {
            const { id } = req.params;
            const { category = 'most_kills', limit = 10 } = req.query;

            console.log(`📈 [StatsController] Запрос лидерборда турнира ${id}, категория: ${category}`);

            const leaderboard = await TournamentStatsRepository.getLeaderboard(
                parseInt(id),
                category,
                parseInt(limit)
            );

            return res.json({
                success: true,
                category,
                leaderboard
            });

        } catch (error) {
            console.error(`❌ [StatsController] Ошибка получения лидерборда:`, error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения лидерборда',
                message: error.message
            });
        }
    }

    /**
     * 👤 Получение статистики конкретного игрока в турнире
     * GET /api/tournaments/:id/stats/player/:userId
     */
    async getPlayerStats(req, res) {
        try {
            const { id, userId } = req.params;

            console.log(`👤 [StatsController] Запрос статистики игрока ${userId} в турнире ${id}`);

            const stats = await TournamentStatsRepository.getPlayerStats(
                parseInt(id),
                parseInt(userId)
            );

            if (!stats) {
                return res.status(404).json({
                    success: false,
                    error: 'Статистика игрока не найдена'
                });
            }

            return res.json({
                success: true,
                stats
            });

        } catch (error) {
            console.error(`❌ [StatsController] Ошибка получения статистики игрока:`, error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения статистики игрока',
                message: error.message
            });
        }
    }

    /**
     * 🔄 Полный пересчет статистики турнира (только админ)
     * POST /api/tournaments/:id/stats/recalculate
     */
    async recalculateStats(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            console.log(`🔄 [StatsController] Пересчет статистики турнира ${id} пользователем ${userId}`);

            // Проверка прав (админ или создатель турнира)
            const tournament = await this._getTournament(id);
            
            if (!tournament) {
                return res.status(404).json({
                    success: false,
                    error: 'Турнир не найден'
                });
            }

            const isAdmin = req.user?.role === 'admin' || req.user?.roles?.includes('platform_admin');
            const isCreator = tournament.created_by === userId;

            if (!isAdmin && !isCreator) {
                return res.status(403).json({
                    success: false,
                    error: 'Недостаточно прав для пересчета статистики'
                });
            }

            // Выполняем пересчет
            const result = await TournamentStatsService.recalculateTournamentStats(parseInt(id));

            return res.json({
                success: true,
                ...result,
                message: 'Статистика турнира успешно пересчитана'
            });

        } catch (error) {
            console.error(`❌ [StatsController] Ошибка пересчета статистики:`, error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка пересчета статистики',
                message: error.message
            });
        }
    }

    /**
     * 🏆 Финализация турнира (определение MVP и достижений)
     * POST /api/tournaments/:id/stats/finalize
     */
    async finalizeTournament(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            console.log(`🏆 [StatsController] Финализация турнира ${id} пользователем ${userId}`);

            // Проверка прав
            const tournament = await this._getTournament(id);
            
            if (!tournament) {
                return res.status(404).json({
                    success: false,
                    error: 'Турнир не найден'
                });
            }

            const isAdmin = req.user?.role === 'admin' || req.user?.roles?.includes('platform_admin');
            const isCreator = tournament.created_by === userId;

            if (!isAdmin && !isCreator) {
                return res.status(403).json({
                    success: false,
                    error: 'Недостаточно прав для финализации турнира'
                });
            }

            // Выполняем финализацию
            const result = await TournamentStatsService.finalizeTournament(parseInt(id));

            return res.json({
                success: true,
                ...result,
                message: 'Турнир успешно финализирован'
            });

        } catch (error) {
            console.error(`❌ [StatsController] Ошибка финализации турнира:`, error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка финализации турнира',
                message: error.message
            });
        }
    }

    /**
     * 🔍 Вспомогательный метод: получение турнира
     * @private
     */
    async _getTournament(id) {
        const pool = require('../../db');
        
        try {
            const result = await pool.query(
                'SELECT id, created_by, status FROM tournaments WHERE id = $1',
                [id]
            );
            return result.rows[0];
        } catch (error) {
            console.error(`❌ [StatsController] Ошибка получения турнира:`, error);
            return null;
        }
    }
}

module.exports = new TournamentStatsController();

