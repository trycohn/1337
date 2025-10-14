/**
 * 🏆 ACHIEVEMENTS CONTROLLER
 * API для достижений и глобального лидерборда MVP
 * @version 1.0.0
 */

const AchievementRewardsService = require('../services/tournament/AchievementRewardsService');

class AchievementsController {
    /**
     * 🌍 Получение глобального лидерборда MVP
     * GET /api/achievements/global-leaderboard?limit=50&sort=global_mvp_score
     */
    async getGlobalLeaderboard(req, res) {
        try {
            const { limit = 50, sort = 'global_mvp_score' } = req.query;

            console.log(`🌍 [AchievementsController] Запрос глобального лидерборда, лимит: ${limit}, сортировка: ${sort}`);

            const leaderboard = await AchievementRewardsService.getGlobalLeaderboard(
                parseInt(limit),
                sort
            );

            return res.json({
                success: true,
                leaderboard,
                total: leaderboard.length
            });

        } catch (error) {
            console.error(`❌ [AchievementsController] Ошибка получения глобального лидерборда:`, error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения глобального лидерборда',
                message: error.message
            });
        }
    }

    /**
     * 👤 Получение достижений конкретного пользователя
     * GET /api/achievements/user/:userId
     */
    async getUserAchievements(req, res) {
        try {
            const { userId } = req.params;

            console.log(`👤 [AchievementsController] Запрос достижений пользователя ${userId}`);

            const achievements = await AchievementRewardsService.getUserAchievements(parseInt(userId));

            // Подсчитываем медали
            const medals = {
                gold: achievements.filter(a => a.rank === 1).length,
                silver: achievements.filter(a => a.rank === 2).length,
                bronze: achievements.filter(a => a.rank === 3).length,
                mvp: achievements.filter(a => a.achievement_type === 'mvp').length
            };

            return res.json({
                success: true,
                achievements,
                medals,
                total: achievements.length
            });

        } catch (error) {
            console.error(`❌ [AchievementsController] Ошибка получения достижений:`, error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения достижений',
                message: error.message
            });
        }
    }

    /**
     * 📊 Получение глобального ранга пользователя
     * GET /api/achievements/user/:userId/rank
     */
    async getUserGlobalRank(req, res) {
        try {
            const { userId } = req.params;

            console.log(`📊 [AchievementsController] Запрос глобального ранга пользователя ${userId}`);

            const rank = await AchievementRewardsService.getUserGlobalRank(parseInt(userId));

            if (!rank) {
                return res.json({
                    success: true,
                    hasRank: false,
                    message: 'Пользователь еще не участвовал в турнирах'
                });
            }

            return res.json({
                success: true,
                hasRank: true,
                rank: parseInt(rank)
            });

        } catch (error) {
            console.error(`❌ [AchievementsController] Ошибка получения ранга:`, error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения глобального ранга',
                message: error.message
            });
        }
    }

    /**
     * 📋 Получение конфигурации наград
     * GET /api/achievements/rewards-config
     */
    async getRewardsConfig(req, res) {
        try {
            const pool = require('../db');
            
            const result = await pool.query(`
                SELECT * FROM achievement_rewards_config
                WHERE is_active = TRUE
                ORDER BY rank_1_reward DESC
            `);

            return res.json({
                success: true,
                config: result.rows
            });

        } catch (error) {
            console.error(`❌ [AchievementsController] Ошибка получения конфигурации:`, error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения конфигурации наград',
                message: error.message
            });
        }
    }
}

module.exports = new AchievementsController();

