// 🎮 Routes для матчей
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// 🔔 Проверить наличие активных матчей (быстрая проверка для UI)
router.get('/has-active', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Проверяем турнирные матчи
        const tournamentCheck = await pool.query(
            `SELECT COUNT(*) as count
             FROM matches m
             LEFT JOIN tournament_team_members ttm1 ON ttm1.team_id = m.team1_id
             LEFT JOIN tournament_team_members ttm2 ON ttm2.team_id = m.team2_id
             WHERE (ttm1.user_id = $1 OR ttm2.user_id = $1)
               AND m.status IN ('pending', 'ready', 'in_progress')
             LIMIT 1`,
            [userId]
        );
        
        // Проверяем кастомные матчи
        const customCheck = await pool.query(
            `SELECT COUNT(*) as count
             FROM admin_match_lobbies aml
             JOIN admin_lobby_invitations ali ON ali.lobby_id = aml.id
             WHERE ali.user_id = $1
               AND aml.status IN ('waiting', 'ready', 'picking', 'ready_to_create', 'match_created')
             LIMIT 1`,
            [userId]
        );
        
        const tournamentCount = parseInt(tournamentCheck.rows[0]?.count) || 0;
        const customCount = parseInt(customCheck.rows[0]?.count) || 0;
        const totalCount = tournamentCount + customCount;
        
        res.json({
            success: true,
            hasActive: totalCount > 0,
            count: totalCount
        });
        
    } catch (error) {
        console.error('Ошибка проверки активных матчей:', error);
        res.status(500).json({ 
            success: false,
            hasActive: false,
            count: 0
        });
    }
});

// 📋 Получить активные матчи пользователя (турнирные + кастомные)
router.get('/my-active', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 🏆 Турнирные матчи (где пользователь участник команды)
        const tournamentMatches = await pool.query(
            `SELECT DISTINCT
                m.id,
                m.tournament_id,
                m.round,
                m.status,
                m.scheduled_time,
                m.team1_id,
                m.team2_id,
                t1.name as team1_name,
                t2.name as team2_name,
                trn.name as tournament_name,
                trn.game,
                'tournament' as match_type,
                ml.id as lobby_id,
                ml.status as lobby_status
             FROM matches m
             JOIN tournaments trn ON trn.id = m.tournament_id
             LEFT JOIN tournament_teams t1 ON t1.id = m.team1_id
             LEFT JOIN tournament_teams t2 ON t2.id = m.team2_id
             LEFT JOIN tournament_team_members ttm1 ON ttm1.team_id = m.team1_id
             LEFT JOIN tournament_team_members ttm2 ON ttm2.team_id = m.team2_id
             LEFT JOIN match_lobbies ml ON ml.match_id = m.id
             WHERE (ttm1.user_id = $1 OR ttm2.user_id = $1)
               AND m.status IN ('pending', 'ready', 'in_progress')
             ORDER BY m.scheduled_time ASC NULLS LAST, m.created_at DESC
             LIMIT 20`,
            [userId]
        );
        
        // 🎮 Кастомные матчи (где пользователь приглашен в лобби)
        const customMatches = await pool.query(
            `SELECT 
                aml.id as lobby_id,
                aml.status as lobby_status,
                aml.match_format,
                aml.team1_name,
                aml.team2_name,
                aml.created_at,
                aml.created_by,
                'custom' as match_type
             FROM admin_match_lobbies aml
             JOIN admin_lobby_invitations ali ON ali.lobby_id = aml.id
             WHERE ali.user_id = $1
               AND aml.status IN ('waiting', 'ready', 'picking', 'ready_to_create', 'match_created')
             ORDER BY aml.created_at DESC
             LIMIT 10`,
            [userId]
        );
        
        res.json({
            success: true,
            tournamentMatches: tournamentMatches.rows,
            customMatches: customMatches.rows
        });
        
    } catch (error) {
        console.error('Ошибка получения активных матчей:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка при получении матчей' 
        });
    }
});

module.exports = router;
