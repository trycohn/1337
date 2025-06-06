const express = require('express');
const router = express.Router();
const pool = require('../database');
const authenticateToken = require('../middleware/auth');

/**
 * GET /api/achievements
 * Получить все достижения с категориями
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { category, rarity, show_hidden = false } = req.query;
        
        let query = `
            SELECT 
                a.*,
                ac.name as category_name,
                ac.icon as category_icon,
                CASE 
                    WHEN ua.id IS NOT NULL THEN true 
                    ELSE false 
                END as is_unlocked,
                ua.unlocked_at,
                ua.progress as user_progress,
                ua.is_new
            FROM achievements a
            LEFT JOIN achievement_categories ac ON a.category_id = ac.id
            LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
            WHERE a.is_active = true
        `;
        
        const params = [req.user.id];
        let paramIndex = 2;
        
        // Фильтр по категории
        if (category && category !== 'all') {
            query += ` AND ac.name = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }
        
        // Фильтр по редкости
        if (rarity) {
            query += ` AND a.rarity = $${paramIndex}`;
            params.push(rarity);
            paramIndex++;
        }
        
        // Скрытые достижения
        if (!show_hidden) {
            query += ` AND (a.is_hidden = false OR ua.id IS NOT NULL)`;
        }
        
        query += ` ORDER BY ac.sort_order, a.rarity DESC, a.name`;
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            achievements: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении достижений'
        });
    }
});

/**
 * GET /api/achievements/categories
 * Получить все категории достижений
 */
router.get('/categories', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ac.*,
                COUNT(a.id) as total_achievements,
                COUNT(CASE WHEN ua.id IS NOT NULL THEN 1 END) as unlocked_achievements
            FROM achievement_categories ac
            LEFT JOIN achievements a ON ac.id = a.category_id AND a.is_active = true
            LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
            GROUP BY ac.id, ac.name, ac.icon, ac.description, ac.sort_order
            ORDER BY ac.sort_order
        `, [req.user?.id || 0]);
        
        res.json({
            success: true,
            categories: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching achievement categories:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении категорий достижений'
        });
    }
});

/**
 * GET /api/achievements/user/progress
 * Получить прогресс пользователя
 */
router.get('/user/progress', authenticateToken, async (req, res) => {
    try {
        // Получаем или создаем прогресс пользователя
        let progressResult = await pool.query(
            'SELECT * FROM user_progress WHERE user_id = $1',
            [req.user.id]
        );
        
        if (progressResult.rows.length === 0) {
            // Создаем запись прогресса для нового пользователя
            await pool.query('SELECT update_user_progress($1, $2)', 
                [req.user.id, 'profile_created']
            );
            
            progressResult = await pool.query(
                'SELECT * FROM user_progress WHERE user_id = $1',
                [req.user.id]
            );
        }
        
        const progress = progressResult.rows[0];
        
        // Получаем статистику достижений
        const achievementStats = await pool.query(`
            SELECT 
                COUNT(*) as total_achievements,
                COUNT(CASE WHEN ua.id IS NOT NULL THEN 1 END) as unlocked_achievements,
                COUNT(CASE WHEN a.rarity = 'common' AND ua.id IS NOT NULL THEN 1 END) as common_unlocked,
                COUNT(CASE WHEN a.rarity = 'rare' AND ua.id IS NOT NULL THEN 1 END) as rare_unlocked,
                COUNT(CASE WHEN a.rarity = 'epic' AND ua.id IS NOT NULL THEN 1 END) as epic_unlocked,
                COUNT(CASE WHEN a.rarity = 'legendary' AND ua.id IS NOT NULL THEN 1 END) as legendary_unlocked,
                SUM(CASE WHEN ua.id IS NOT NULL THEN a.xp_reward ELSE 0 END) as total_achievement_xp
            FROM achievements a
            LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
            WHERE a.is_active = true
        `, [req.user.id]);
        
        const stats = achievementStats.rows[0];
        
        // Получаем недавние достижения
        const recentAchievements = await pool.query(`
            SELECT 
                a.name,
                a.description,
                a.icon,
                a.rarity,
                a.xp_reward,
                ua.unlocked_at
            FROM user_achievements ua
            JOIN achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = $1
            ORDER BY ua.unlocked_at DESC
            LIMIT 5
        `, [req.user.id]);
        
        // Вычисляем XP до следующего уровня
        const currentLevelXP = progress.level * 1000;
        const nextLevelXP = (progress.level + 1) * 1000;
        const xpToNextLevel = Math.max(0, nextLevelXP - progress.total_xp);
        const currentLevelProgress = Math.max(0, progress.total_xp - currentLevelXP);
        const levelProgressPercentage = progress.level >= 100 ? 100 : 
            (currentLevelProgress / (nextLevelXP - currentLevelXP)) * 100;
        
        res.json({
            success: true,
            progress: {
                ...progress,
                xp_to_next_level: xpToNextLevel,
                level_progress_percentage: Math.round(levelProgressPercentage * 100) / 100,
                achievement_stats: {
                    total: parseInt(stats.total_achievements),
                    unlocked: parseInt(stats.unlocked_achievements),
                    completion_percentage: stats.total_achievements > 0 ? 
                        Math.round((stats.unlocked_achievements / stats.total_achievements) * 100) : 0,
                    by_rarity: {
                        common: parseInt(stats.common_unlocked || 0),
                        rare: parseInt(stats.rare_unlocked || 0),
                        epic: parseInt(stats.epic_unlocked || 0),
                        legendary: parseInt(stats.legendary_unlocked || 0)
                    },
                    total_achievement_xp: parseInt(stats.total_achievement_xp || 0)
                },
                recent_achievements: recentAchievements.rows
            }
        });
        
    } catch (error) {
        console.error('Error fetching user progress:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении прогресса пользователя'
        });
    }
});

/**
 * POST /api/achievements/user/action
 * Регистрация действия пользователя для отслеживания прогресса
 */
router.post('/user/action', authenticateToken, async (req, res) => {
    try {
        const { action_type, action_data = {} } = req.body;
        
        if (!action_type) {
            return res.status(400).json({
                success: false,
                message: 'Тип действия обязателен'
            });
        }
        
        // Обновляем прогресс пользователя
        await pool.query('SELECT update_user_progress($1, $2, $3)', 
            [req.user.id, action_type, JSON.stringify(action_data)]
        );
        
        // Проверяем новые достижения
        const newAchievements = await pool.query(
            'SELECT * FROM check_and_unlock_achievements($1)',
            [req.user.id]
        );
        
        // Получаем обновленный прогресс
        const progressResult = await pool.query(
            'SELECT * FROM user_progress WHERE user_id = $1',
            [req.user.id]
        );
        
        const response = {
            success: true,
            message: 'Действие зарегистрировано',
            progress: progressResult.rows[0]
        };
        
        // Если разблокированы новые достижения, добавляем их в ответ
        if (newAchievements.rows.length > 0) {
            const achievementDetails = await pool.query(`
                SELECT a.*, ac.name as category_name
                FROM achievements a
                LEFT JOIN achievement_categories ac ON a.category_id = ac.id
                WHERE a.id = ANY($1)
            `, [newAchievements.rows.map(row => row.achievement_id)]);
            
            response.new_achievements = achievementDetails.rows;
            response.message = `Действие зарегистрировано. Получено достижений: ${newAchievements.rows.length}`;
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('Error registering user action:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при регистрации действия'
        });
    }
});

/**
 * POST /api/achievements/user/mark-seen
 * Отметить достижения как просмотренные
 */
router.post('/user/mark-seen', authenticateToken, async (req, res) => {
    try {
        const { achievement_ids } = req.body;
        
        if (!achievement_ids || !Array.isArray(achievement_ids)) {
            return res.status(400).json({
                success: false,
                message: 'Список ID достижений обязателен'
            });
        }
        
        await pool.query(`
            UPDATE user_achievements 
            SET is_new = false, notified_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND achievement_id = ANY($2)
        `, [req.user.id, achievement_ids]);
        
        res.json({
            success: true,
            message: 'Достижения отмечены как просмотренные'
        });
        
    } catch (error) {
        console.error('Error marking achievements as seen:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при обновлении статуса достижений'
        });
    }
});

/**
 * GET /api/achievements/user/new-count
 * Получить количество новых достижений
 */
router.get('/user/new-count', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT COUNT(*) as new_count
            FROM user_achievements
            WHERE user_id = $1 AND is_new = true
        `, [req.user.id]);
        
        res.json({
            success: true,
            new_count: parseInt(result.rows[0].new_count)
        });
        
    } catch (error) {
        console.error('Error fetching new achievements count:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении количества новых достижений'
        });
    }
});

/**
 * GET /api/achievements/leaderboard
 * Получить таблицу лидеров по достижениям
 */
router.get('/leaderboard', async (req, res) => {
    try {
        const { type = 'xp', limit = 50 } = req.query;
        
        let orderBy = 'up.total_xp DESC';
        
        switch (type) {
            case 'level':
                orderBy = 'up.level DESC, up.total_xp DESC';
                break;
            case 'achievements':
                orderBy = 'achievement_count DESC, up.total_xp DESC';
                break;
            case 'streak':
                orderBy = 'up.daily_streak_longest DESC, up.daily_streak_current DESC';
                break;
            default:
                orderBy = 'up.total_xp DESC';
        }
        
        const result = await pool.query(`
            SELECT 
                u.id,
                u.username,
                u.avatar_url,
                up.level,
                up.total_xp,
                up.daily_streak_current,
                up.daily_streak_longest,
                COUNT(ua.id) as achievement_count,
                ROW_NUMBER() OVER (ORDER BY ${orderBy}) as rank
            FROM users u
            JOIN user_progress up ON u.id = up.user_id
            LEFT JOIN user_achievements ua ON u.id = ua.user_id
            GROUP BY u.id, u.username, u.avatar_url, up.level, up.total_xp, 
                     up.daily_streak_current, up.daily_streak_longest
            ORDER BY ${orderBy}
            LIMIT $1
        `, [limit]);
        
        res.json({
            success: true,
            leaderboard: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении таблицы лидеров'
        });
    }
});

/**
 * GET /api/achievements/stats
 * Получить общую статистику системы достижений
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(DISTINCT a.id) as total_achievements,
                COUNT(DISTINCT ac.id) as total_categories,
                COUNT(DISTINCT ua.user_id) as users_with_achievements,
                COUNT(ua.id) as total_unlocks,
                AVG(up.level) as average_level,
                MAX(up.level) as max_level,
                AVG(achievement_count.count) as avg_achievements_per_user
            FROM achievements a
            CROSS JOIN achievement_categories ac
            LEFT JOIN user_achievements ua ON a.id = ua.achievement_id
            LEFT JOIN user_progress up ON ua.user_id = up.user_id
            LEFT JOIN (
                SELECT user_id, COUNT(*) as count
                FROM user_achievements
                GROUP BY user_id
            ) achievement_count ON ua.user_id = achievement_count.user_id
        `);
        
        const rarityStats = await pool.query(`
            SELECT 
                a.rarity,
                COUNT(a.id) as total,
                COUNT(ua.id) as unlocked,
                ROUND(AVG(a.xp_reward)) as avg_xp
            FROM achievements a
            LEFT JOIN user_achievements ua ON a.id = ua.achievement_id
            WHERE a.is_active = true
            GROUP BY a.rarity
            ORDER BY 
                CASE a.rarity 
                    WHEN 'common' THEN 1
                    WHEN 'rare' THEN 2
                    WHEN 'epic' THEN 3
                    WHEN 'legendary' THEN 4
                END
        `);
        
        res.json({
            success: true,
            stats: {
                general: stats.rows[0],
                by_rarity: rarityStats.rows
            }
        });
        
    } catch (error) {
        console.error('Error fetching achievement stats:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении статистики достижений'
        });
    }
});

module.exports = router; 