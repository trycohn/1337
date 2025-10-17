// 🎮 Routes для матчей
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// ВАЖНО: Специфичные роуты ПЕРЕД параметрическими!

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
                m.team1_id,
                m.team2_id,
                t1.name as team1_name,
                t2.name as team2_name,
                trn.name as tournament_name,
                trn.game,
                'tournament' as match_type,
                ml.id as lobby_id,
                ml.status as lobby_status,
                m.created_at
             FROM matches m
             JOIN tournaments trn ON trn.id = m.tournament_id
             LEFT JOIN tournament_teams t1 ON t1.id = m.team1_id
             LEFT JOIN tournament_teams t2 ON t2.id = m.team2_id
             LEFT JOIN tournament_team_members ttm1 ON ttm1.team_id = m.team1_id
             LEFT JOIN tournament_team_members ttm2 ON ttm2.team_id = m.team2_id
             LEFT JOIN match_lobbies ml ON ml.match_id = m.id
             WHERE (ttm1.user_id = $1 OR ttm2.user_id = $1)
               AND m.status IN ('pending', 'ready', 'in_progress')
             ORDER BY m.created_at DESC
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

// 🗑️ Выйти из кастомного лобби (удалить приглашение)
router.delete('/custom-lobby/:lobbyId/leave', authenticateToken, async (req, res) => {
    try {
        const { lobbyId } = req.params;
        const userId = req.user.id;
        
        // Удаляем приглашение пользователя
        await pool.query(
            `DELETE FROM admin_lobby_invitations 
             WHERE lobby_id = $1 AND user_id = $2`,
            [lobbyId, userId]
        );
        
        console.log(`✅ Пользователь ${userId} покинул кастомное лобби ${lobbyId}`);
        
        res.json({
            success: true,
            message: 'Вы покинули лобби'
        });
        
    } catch (error) {
        console.error('Ошибка выхода из лобби:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка при выходе из лобби' 
        });
    }
});

// 📊 Получить базовую информацию о кастомном матче (ПОСЛЕ специфичных роутов)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Ищем кастомное лобби с созданным матчем
        const result = await pool.query(
            `SELECT 
                aml.id as lobby_id,
                aml.status,
                aml.match_format,
                aml.team1_name,
                aml.team2_name,
                aml.connect_url,
                aml.gotv_url,
                aml.created_at,
                aml.created_by
             FROM admin_match_lobbies aml
             WHERE aml.id = $1`,
            [id]
        );
        
        if (!result.rows[0]) {
            return res.status(404).json({ 
                success: false,
                error: 'Матч не найден' 
            });
        }
        
        const lobby = result.rows[0];
        
        // Проверка доступа
        const accessCheck = await pool.query(
            `SELECT 1 FROM admin_lobby_invitations WHERE lobby_id = $1 AND user_id = $2`,
            [id, userId]
        );
        
        const isCreator = Number(lobby.created_by) === Number(userId);
        const isInvited = accessCheck.rows.length > 0;
        const isAdmin = req.user.role === 'admin';
        
        if (!isAdmin && !isCreator && !isInvited) {
            return res.status(403).json({ 
                success: false,
                error: 'Нет доступа к этому матчу' 
            });
        }
        
        // Получаем участников
        const participants = await pool.query(
            `SELECT 
                ali.user_id,
                ali.team,
                u.username,
                u.avatar_url,
                u.steam_id
             FROM admin_lobby_invitations ali
             JOIN users u ON u.id = ali.user_id
             WHERE ali.lobby_id = $1 AND ali.accepted = TRUE
             ORDER BY ali.team, ali.team_position ASC`,
            [id]
        );
        
        const team1Players = participants.rows.filter(p => p.team === 1);
        const team2Players = participants.rows.filter(p => p.team === 2);
        
        res.json({
            success: true,
            match: {
                id: lobby.lobby_id,
                status: lobby.status,
                match_format: lobby.match_format,
                team1_name: lobby.team1_name,
                team2_name: lobby.team2_name,
                team1_players: team1Players,
                team2_players: team2Players,
                connect_url: lobby.connect_url,
                gotv_url: lobby.gotv_url,
                created_at: lobby.created_at
            }
        });
        
    } catch (error) {
        console.error('Ошибка получения матча:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка при получении матча' 
        });
    }
});

module.exports = router;
