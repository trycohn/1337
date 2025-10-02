/**
 * 🎮 MATCHZY WEBHOOK API
 * Прием данных от MatchZy plugin
 * 
 * @version 1.0.0
 * @date 2025-10-02
 */

const express = require('express');
const router = express.Router();
const StatsProcessor = require('../services/stats/StatsProcessor');
const AnomalyDetector = require('../services/stats/AnomalyDetector');

/**
 * POST /api/matchzy/stats
 * Webhook для приема статистики от MatchZy
 */
router.post('/stats', async (req, res) => {
    console.log('📊 [MatchZy] Получены данные от MatchZy webhook');
    
    try {
        // 1. Валидация токена (безопасность)
        const token = req.headers['x-matchzy-token'] || 
                     req.headers['authorization']?.split(' ')[1];
        
        if (!token || token !== process.env.MATCHZY_SECRET_TOKEN) {
            console.log('❌ [MatchZy] Unauthorized webhook attempt');
            return res.status(401).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }
        
        const matchzyData = req.body;
        
        console.log('📝 [MatchZy] Данные матча:', {
            matchId: matchzyData.matchId,
            map: matchzyData.mapName,
            teams: `${matchzyData.team1?.name} vs ${matchzyData.team2?.name}`
        });
        
        // 2. Обработать данные
        const result = await StatsProcessor.processMatchZyData(matchzyData);
        
        // 3. Если матч обработан - проверить на аномалии
        if (result.status === 'processed' && result.match_id) {
            console.log('🔍 [MatchZy] Запуск детекции аномалий...');
            
            // Получить всех участников матча
            const participants = await pool.query(`
                SELECT DISTINCT user_id 
                FROM player_match_stats 
                WHERE match_id = $1
            `, [result.match_id]);
            
            // Проверить каждого на аномалии
            for (const participant of participants.rows) {
                const anomalyResult = await AnomalyDetector.detectAnomalies(
                    participant.user_id,
                    result.match_id
                );
                
                // Если критические аномалии - скорректировать Trust Score
                if (anomalyResult.risk_level === 'CRITICAL' || 
                    anomalyResult.risk_level === 'HIGH') {
                    await AnomalyDetector.adjustTrustScoreOnAnomalies(
                        participant.user_id,
                        anomalyResult.anomalies
                    );
                }
            }
        }
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('❌ [MatchZy] Ошибка обработки webhook:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process stats' 
        });
    }
});

/**
 * POST /api/matchzy/demo
 * Upload demo файла (опционально)
 */
router.post('/demo', async (req, res) => {
    console.log('📹 [MatchZy] Получен demo файл');
    
    try {
        // Пока просто логируем, хранение demo добавим в Варианте 3
        res.json({ 
            success: true, 
            message: 'Demo received (storage not implemented yet)' 
        });
    } catch (error) {
        console.error('❌ [MatchZy] Ошибка приема demo:', error);
        res.status(500).json({ success: false, error: 'Failed to upload demo' });
    }
});

module.exports = router;

