/**
 * 🎮 MATCH FEEDBACK API
 * Система обратной связи после матчей
 * 
 * @version 1.0.0
 * @date 2025-10-02
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/matches/:matchId/feedback
 * Отправить feedback по матчу
 */
router.post('/:matchId/feedback', authenticateToken, async (req, res) => {
    const { matchId } = req.params;
    const { feedbacks } = req.body; // Array of {reviewed_id, fairness, behavior, teamplay, communication}
    const reviewerId = req.user.id;
    
    console.log(`📝 [Match Feedback] User ${reviewerId} submitting feedback for match ${matchId}`);
    
    if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Feedbacks array required' 
        });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Проверка что матч завершен
        const matchResult = await client.query(
            `SELECT m.id, m.tournament_id, m.state, m.winner_team_id,
                    m.team1_id, m.team2_id
             FROM matches m
             WHERE m.id = $1`,
            [matchId]
        );
        
        if (matchResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                success: false, 
                error: 'Match not found' 
            });
        }
        
        const match = matchResult.rows[0];
        
        // Проверка что матч завершен
        if (match.state !== 'DONE' && match.state !== 'SCORE_DONE') {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false, 
                error: 'Match not completed yet' 
            });
        }
        
        // 2. Проверка что reviewer участвовал в матче
        const participationCheck = await client.query(
            `SELECT ttm.user_id, ttm.team_id
             FROM tournament_team_members ttm
             WHERE ttm.user_id = $1
               AND ttm.team_id IN ($2, $3)`,
            [reviewerId, match.team1_id, match.team2_id]
        );
        
        if (participationCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ 
                success: false, 
                error: 'You did not participate in this match' 
            });
        }
        
        const reviewerTeamId = participationCheck.rows[0].team_id;
        
        // 3. Сохранить feedbacks
        let totalCoins = 0;
        let savedFeedbacks = 0;
        
        for (const feedback of feedbacks) {
            const reviewedId = feedback.reviewed_id;
            
            // Проверка что reviewed участвовал в матче
            const reviewedCheck = await client.query(
                `SELECT ttm.team_id
                 FROM tournament_team_members ttm
                 WHERE ttm.user_id = $1
                   AND ttm.team_id IN ($2, $3)`,
                [reviewedId, match.team1_id, match.team2_id]
            );
            
            if (reviewedCheck.rows.length === 0) {
                console.log(`⚠️ User ${reviewedId} did not participate, skipping`);
                continue;
            }
            
            const reviewedTeamId = reviewedCheck.rows[0].team_id;
            
            // Определить тип feedback (opponent или teammate)
            const feedbackType = reviewerTeamId === reviewedTeamId ? 'teammate' : 'opponent';
            
            // Проверка дубликата
            const existingCheck = await client.query(
                'SELECT id FROM match_feedback WHERE match_id = $1 AND reviewer_id = $2 AND reviewed_id = $3',
                [matchId, reviewerId, reviewedId]
            );
            
            if (existingCheck.rows.length > 0) {
                console.log(`⚠️ Duplicate feedback for user ${reviewedId}, skipping`);
                continue;
            }
            
            // Валидация ratings
            const fairness = feedback.fairness_rating || null;
            const behavior = feedback.behavior_rating || null;
            const teamplay = feedback.teamplay_rating || null;
            const communication = feedback.communication_rating || null;
            
            // Хотя бы одна оценка должна быть
            if (!fairness && !behavior && !teamplay && !communication) {
                continue;
            }
            
            // Сохранить feedback
            await client.query(`
                INSERT INTO match_feedback (
                    match_id,
                    tournament_id,
                    reviewer_id,
                    reviewed_id,
                    feedback_type,
                    fairness_rating,
                    behavior_rating,
                    teamplay_rating,
                    communication_rating,
                    comment
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                matchId,
                match.tournament_id,
                reviewerId,
                reviewedId,
                feedbackType,
                fairness,
                behavior,
                teamplay,
                communication,
                feedback.comment || null
            ]);
            
            savedFeedbacks++;
            totalCoins += 10; // 10 coins за каждую оценку
        }
        
        // 4. Начислить coins reviewer
        if (totalCoins > 0) {
            // Создать запись в user_coins если не существует
            await client.query(`
                INSERT INTO user_coins (user_id, balance, lifetime_earned)
                VALUES ($1, 0, 0)
                ON CONFLICT (user_id) DO NOTHING
            `, [reviewerId]);
            
            // Начислить coins
            await client.query(`
                UPDATE user_coins 
                SET balance = balance + $1,
                    lifetime_earned = lifetime_earned + $1,
                    updated_at = NOW()
                WHERE user_id = $2
            `, [totalCoins, reviewerId]);
            
            // Записать транзакцию
            await client.query(`
                INSERT INTO coin_transactions (
                    user_id, amount, transaction_type, source, reference_id, description
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                reviewerId,
                totalCoins,
                'earn',
                'match_feedback',
                matchId,
                `Feedback за матч #${matchId}`
            ]);
            
            console.log(`💰 [Match Feedback] Начислено ${totalCoins} coins пользователю ${reviewerId}`);
        }
        
        // 5. Обновить репутацию всех оцененных игроков
        const reviewedIds = [...new Set(feedbacks.map(f => f.reviewed_id))];
        for (const reviewedId of reviewedIds) {
            await client.query('SELECT update_player_reputation($1)', [reviewedId]);
            console.log(`📊 [Match Feedback] Обновлена репутация пользователя ${reviewedId}`);
        }
        
        // 6. Отметить что feedback дан
        await client.query(`
            UPDATE match_feedback_pending
            SET feedback_given = true,
                feedback_given_at = NOW()
            WHERE match_id = $1 AND user_id = $2
        `, [matchId, reviewerId]);
        
        await client.query('COMMIT');
        
        console.log(`✅ [Match Feedback] Сохранено ${savedFeedbacks} feedbacks, начислено ${totalCoins} coins`);
        
        res.json({
            success: true,
            feedbacks_saved: savedFeedbacks,
            coins_earned: totalCoins,
            message: `Спасибо за feedback! Вам начислено ${totalCoins} coins 🪙`
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ [Match Feedback] Ошибка сохранения feedback:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save feedback' 
        });
    } finally {
        client.release();
    }
});

/**
 * GET /api/matches/:matchId/feedback/participants
 * Получить список участников матча для оценки
 */
router.get('/:matchId/feedback/participants', authenticateToken, async (req, res) => {
    const { matchId } = req.params;
    const userId = req.user.id;
    
    try {
        // Получить матч и команды
        const matchResult = await pool.query(`
            SELECT m.id, m.team1_id, m.team2_id
            FROM matches m
            WHERE m.id = $1
        `, [matchId]);
        
        if (matchResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }
        
        const match = matchResult.rows[0];
        
        // Проверить участие пользователя
        const userTeamResult = await pool.query(`
            SELECT ttm.team_id
            FROM tournament_team_members ttm
            WHERE ttm.user_id = $1
              AND ttm.team_id IN ($2, $3)
        `, [userId, match.team1_id, match.team2_id]);
        
        if (userTeamResult.rows.length === 0) {
            return res.status(403).json({ 
                success: false, 
                error: 'You did not participate in this match' 
            });
        }
        
        const userTeamId = userTeamResult.rows[0].team_id;
        const opponentTeamId = userTeamId === match.team1_id ? match.team2_id : match.team1_id;
        
        // Получить тиммейтов (исключая самого пользователя)
        const teammatesResult = await pool.query(`
            SELECT DISTINCT
                u.id,
                u.username,
                u.avatar_url
            FROM tournament_team_members ttm
            JOIN users u ON u.id = ttm.user_id
            WHERE ttm.team_id = $1
              AND ttm.user_id != $2
        `, [userTeamId, userId]);
        
        // Получить соперников
        const opponentsResult = await pool.query(`
            SELECT DISTINCT
                u.id,
                u.username,
                u.avatar_url
            FROM tournament_team_members ttm
            JOIN users u ON u.id = ttm.user_id
            WHERE ttm.team_id = $1
        `, [opponentTeamId]);
        
        res.json({
            success: true,
            teammates: teammatesResult.rows,
            opponents: opponentsResult.rows
        });
        
    } catch (error) {
        console.error('❌ [Match Feedback] Ошибка получения участников:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get participants' 
        });
    }
});

/**
 * GET /api/users/:userId/reputation
 * Получить репутацию игрока
 */
router.get('/users/:userId/reputation', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM player_reputation WHERE user_id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            // Если нет данных, вернуть дефолт
            return res.json({
                success: true,
                reputation: {
                    user_id: userId,
                    total_feedbacks: 0,
                    reputation_index: 50,
                    fairness_score: 50,
                    behavior_score: 50,
                    teamplay_score: 50
                }
            });
        }
        
        res.json({
            success: true,
            reputation: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ [Match Feedback] Ошибка получения репутации:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get reputation' 
        });
    }
});

/**
 * GET /api/matches/:matchId/feedback/check
 * Проверить, дал ли пользователь feedback по матчу
 */
router.get('/:matchId/feedback/check', authenticateToken, async (req, res) => {
    const { matchId } = req.params;
    const userId = req.user.id;
    
    try {
        const result = await pool.query(
            'SELECT feedback_given FROM match_feedback_pending WHERE match_id = $1 AND user_id = $2',
            [matchId, userId]
        );
        
        const feedbackGiven = result.rows.length > 0 && result.rows[0].feedback_given;
        
        res.json({
            success: true,
            feedback_given: feedbackGiven
        });
        
    } catch (error) {
        console.error('❌ [Match Feedback] Ошибка проверки feedback:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to check feedback status' 
        });
    }
});

module.exports = router;

