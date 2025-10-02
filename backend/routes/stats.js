/**
 * 📊 STATS API
 * API для получения детальной статистики игроков
 * 
 * @version 2.0.0
 * @date 2025-10-02
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/stats/player/:userId
 * Получить агрегированную статистику игрока
 */
router.get('/player/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM player_aggregated_stats WHERE user_id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                stats: null,
                message: 'No stats available yet'
            });
        }
        
        res.json({
            success: true,
            stats: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ [Stats API] Ошибка получения статистики:', error);
        res.status(500).json({ success: false, error: 'Failed to get stats' });
    }
});

/**
 * GET /api/stats/player/:userId/recent
 * Получить статистику последних N матчей
 */
router.get('/player/:userId/recent', async (req, res) => {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    
    try {
        const result = await pool.query(`
            SELECT 
                pms.*,
                ms.map_name,
                m.created_at as match_date,
                m.winner_team_id,
                CASE WHEN m.winner_team_id = pms.team_id THEN true ELSE false END as won
            FROM player_match_stats pms
            JOIN matches m ON m.id = pms.match_id
            LEFT JOIN match_stats ms ON ms.match_id = pms.match_id
            WHERE pms.user_id = $1
            ORDER BY m.created_at DESC
            LIMIT $2
        `, [userId, limit]);
        
        res.json({
            success: true,
            matches: result.rows
        });
        
    } catch (error) {
        console.error('❌ [Stats API] Ошибка получения recent stats:', error);
        res.status(500).json({ success: false, error: 'Failed to get recent stats' });
    }
});

/**
 * GET /api/stats/player/:userId/maps
 * Получить статистику по картам
 */
router.get('/player/:userId/maps', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM player_map_stats WHERE user_id = $1 ORDER BY matches_played DESC',
            [userId]
        );
        
        res.json({
            success: true,
            maps: result.rows
        });
        
    } catch (error) {
        console.error('❌ [Stats API] Ошибка получения map stats:', error);
        res.status(500).json({ success: false, error: 'Failed to get map stats' });
    }
});

/**
 * GET /api/stats/leaderboard
 * Получить leaderboard по различным метрикам
 */
router.get('/leaderboard', async (req, res) => {
    const { metric = 'rating', limit = 100 } = req.query;
    
    try {
        let orderBy;
        
        switch (metric) {
            case 'rating':
                orderBy = 'avg_rating DESC';
                break;
            case 'kd':
                orderBy = 'kd_ratio DESC';
                break;
            case 'hs':
                orderBy = 'avg_hs_percentage DESC';
                break;
            case 'adr':
                orderBy = 'avg_adr DESC';
                break;
            case 'clutch':
                orderBy = 'clutch_success_rate DESC';
                break;
            default:
                orderBy = 'avg_rating DESC';
        }
        
        const result = await pool.query(`
            SELECT 
                pas.*,
                u.username,
                u.avatar_url
            FROM player_aggregated_stats pas
            JOIN users u ON u.id = pas.user_id
            WHERE pas.total_matches >= 5
            ORDER BY ${orderBy}
            LIMIT $1
        `, [limit]);
        
        res.json({
            success: true,
            leaderboard: result.rows,
            metric
        });
        
    } catch (error) {
        console.error('❌ [Stats API] Ошибка получения leaderboard:', error);
        res.status(500).json({ success: false, error: 'Failed to get leaderboard' });
    }
});

/**
 * GET /api/admin/stats-anomalies
 * Получить список аномалий (только для админов)
 */
router.get('/admin/stats-anomalies', authenticateToken, async (req, res) => {
    try {
        // Проверка прав
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const { severity = null, reviewed = false, limit = 50 } = req.query;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        
        if (severity) {
            params.push(severity);
            whereClause += ` AND severity = $${params.length}`;
        }
        
        if (reviewed === 'false') {
            whereClause += ' AND reviewed = false';
        }
        
        params.push(limit);
        
        const result = await pool.query(`
            SELECT 
                psa.*,
                u.username,
                u.email,
                m.id as match_id,
                t.name as tournament_name
            FROM player_stats_anomalies psa
            JOIN users u ON u.id = psa.user_id
            LEFT JOIN matches m ON m.id = psa.match_id
            LEFT JOIN tournaments t ON t.id = m.tournament_id
            ${whereClause}
            ORDER BY psa.detected_at DESC, psa.severity DESC
            LIMIT $${params.length}
        `, params);
        
        res.json({
            success: true,
            anomalies: result.rows
        });
        
    } catch (error) {
        console.error('❌ [Stats API] Ошибка получения аномалий:', error);
        res.status(500).json({ success: false, error: 'Failed to get anomalies' });
    }
});

module.exports = router;
