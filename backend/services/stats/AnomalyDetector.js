/**
 * 🔍 ANOMALY DETECTOR
 * Детекция читеров через статистические аномалии
 * Интеграция с Trust Score и Reputation системами
 * 
 * @version 2.0.0
 * @date 2025-10-02
 */

const pool = require('../../db');

class AnomalyDetector {
    /**
     * Проверка игрока на аномалии после матча
     * @param {number} userId - ID пользователя
     * @param {number} matchId - ID матча
     */
    static async detectAnomalies(userId, matchId) {
        console.log(`🔍 [AnomalyDetector] Проверка аномалий для user ${userId} в матче ${matchId}`);
        
        try {
            // Получить статистику текущего матча
            const currentMatch = await pool.query(
                'SELECT * FROM player_match_stats WHERE match_id = $1 AND user_id = $2',
                [matchId, userId]
            );
            
            if (currentMatch.rows.length === 0) {
                return { anomalies: [], risk_level: 'UNKNOWN' };
            }
            
            const stats = currentMatch.rows[0];
            
            // Получить историческую статистику
            const historical = await pool.query(
                'SELECT * FROM player_aggregated_stats WHERE user_id = $1',
                [userId]
            );
            
            const historicalStats = historical.rows[0] || null;
            
            // Детекция аномалий
            const anomalies = [];
            let riskScore = 0;
            
            // ================================================================
            // 1. HEADSHOT PERCENTAGE
            // ================================================================
            if (stats.hs_percentage > 85 && stats.kills >= 10) {
                anomalies.push({
                    type: 'high_hs_percentage',
                    severity: 'CRITICAL',
                    value: stats.hs_percentage,
                    expected: 55,
                    description: `Критически высокий HS%: ${stats.hs_percentage.toFixed(1)}% (ожидается ~55%)`,
                    evidence: {
                        kills: stats.kills,
                        headshots: stats.headshots,
                        match_id: matchId
                    }
                });
                riskScore += 35;
            } else if (stats.hs_percentage > 75 && stats.kills >= 15) {
                anomalies.push({
                    type: 'high_hs_percentage',
                    severity: 'HIGH',
                    value: stats.hs_percentage,
                    expected: 55,
                    description: `Высокий HS%: ${stats.hs_percentage.toFixed(1)}%`
                });
                riskScore += 20;
            }
            
            // ================================================================
            // 2. ВНЕЗАПНОЕ УЛУЧШЕНИЕ
            // ================================================================
            if (historicalStats && historicalStats.total_matches >= 10) {
                const currentKD = stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills;
                const historicalKD = historicalStats.kd_ratio;
                
                if (currentKD > historicalKD * 2 && currentKD > 2.0) {
                    anomalies.push({
                        type: 'sudden_improvement',
                        severity: 'HIGH',
                        value: currentKD,
                        expected: historicalKD,
                        deviation_percentage: ((currentKD - historicalKD) / historicalKD * 100),
                        description: `Резкое улучшение K/D: ${currentKD.toFixed(2)} (обычно ${historicalKD.toFixed(2)})`
                    });
                    riskScore += 25;
                }
                
                // Проверка HS%
                if (stats.hs_percentage > historicalStats.avg_hs_percentage * 1.3 && 
                    historicalStats.avg_hs_percentage > 0) {
                    anomalies.push({
                        type: 'sudden_improvement',
                        severity: 'MEDIUM',
                        value: stats.hs_percentage,
                        expected: historicalStats.avg_hs_percentage,
                        description: `Резкое улучшение HS%: ${stats.hs_percentage.toFixed(1)}% (обычно ${historicalStats.avg_hs_percentage.toFixed(1)}%)`
                    });
                    riskScore += 15;
                }
            }
            
            // ================================================================
            // 3. НИЗКОЕ ИСПОЛЬЗОВАНИЕ UTILITY + ВЫСОКИЙ K/D
            // ================================================================
            const utilityPerRound = stats.rounds_played > 0 
                ? stats.utility_damage / stats.rounds_played 
                : 0;
            
            if (utilityPerRound < 10 && stats.kills > stats.deaths * 1.5) {
                // Много киллов, мало utility = возможно wallhack
                anomalies.push({
                    type: 'low_utility_high_kills',
                    severity: 'MEDIUM',
                    value: utilityPerRound,
                    expected: 20,
                    description: `Низкое использование utility (${utilityPerRound.toFixed(1)} урона/раунд) при высоком K/D`,
                    evidence: {
                        kills: stats.kills,
                        deaths: stats.deaths,
                        utility_damage: stats.utility_damage
                    }
                });
                riskScore += 20;
            }
            
            // ================================================================
            // 4. ИДЕАЛЬНЫЕ CLUTCHES
            // ================================================================
            const totalClutches = stats.clutch_1v1_total + stats.clutch_1v2_total + 
                                 stats.clutch_1v3_total + stats.clutch_1v4_total;
            const wonClutches = stats.clutch_1v1_won + stats.clutch_1v2_won + 
                               stats.clutch_1v3_won + stats.clutch_1v4_won;
            
            if (totalClutches >= 3 && wonClutches === totalClutches) {
                // Выиграл ВСЕ clutches = подозрительно
                anomalies.push({
                    type: 'perfect_clutches',
                    severity: 'MEDIUM',
                    value: 100,
                    description: `Идеальный clutch success: ${wonClutches}/${totalClutches} (100%)`,
                    evidence: {
                        clutches: { won: wonClutches, total: totalClutches }
                    }
                });
                riskScore += 15;
            }
            
            // ================================================================
            // 5. OPENING DUELS (префайры)
            // ================================================================
            const openingTotal = stats.opening_kills + stats.opening_deaths;
            const openingSuccessRate = openingTotal > 0 
                ? (stats.opening_kills / openingTotal * 100) 
                : 0;
            
            if (openingSuccessRate > 80 && openingTotal >= 8) {
                anomalies.push({
                    type: 'prefiring_pattern',
                    severity: 'MEDIUM',
                    value: openingSuccessRate,
                    expected: 55,
                    description: `Очень высокий success rate в opening duels: ${openingSuccessRate.toFixed(0)}%`
                });
                riskScore += 18;
            }
            
            // ================================================================
            // ОПРЕДЕЛЕНИЕ УРОВНЯ РИСКА
            // ================================================================
            let riskLevel, action;
            
            if (riskScore >= 80) {
                riskLevel = 'CRITICAL';
                action = 'IMMEDIATE_REVIEW';
            } else if (riskScore >= 60) {
                riskLevel = 'HIGH';
                action = 'FLAG_FOR_REVIEW';
            } else if (riskScore >= 40) {
                riskLevel = 'MEDIUM';
                action = 'WATCH_LIST';
            } else {
                riskLevel = 'LOW';
                action = 'NONE';
            }
            
            // Сохранить аномалии в БД
            if (anomalies.length > 0) {
                await this._saveAnomalies(userId, matchId, anomalies, riskLevel);
            }
            
            console.log(`📊 [AnomalyDetector] Обнаружено ${anomalies.length} аномалий, риск: ${riskLevel}`);
            
            return {
                anomalies,
                risk_level: riskLevel,
                risk_score: riskScore,
                action
            };
            
        } catch (error) {
            console.error('❌ [AnomalyDetector] Ошибка детекции:', error);
            return { anomalies: [], risk_level: 'ERROR' };
        }
    }
    
    /**
     * Сохранить обнаруженные аномалии в БД
     */
    static async _saveAnomalies(userId, matchId, anomalies, riskLevel) {
        const client = await pool.connect();
        
        try {
            for (const anomaly of anomalies) {
                await client.query(`
                    INSERT INTO player_stats_anomalies (
                        user_id,
                        match_id,
                        anomaly_type,
                        severity,
                        value,
                        expected_value,
                        deviation_percentage,
                        description,
                        evidence
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    userId,
                    matchId,
                    anomaly_type,
                    anomaly.severity,
                    anomaly.value || null,
                    anomaly.expected || null,
                    anomaly.deviation_percentage || null,
                    anomaly.description,
                    JSON.stringify(anomaly.evidence || {})
                ]);
            }
            
            console.log(`✅ [AnomalyDetector] Сохранено ${anomalies.length} аномалий для user ${userId}`);
            
        } catch (error) {
            console.error('❌ [AnomalyDetector] Ошибка сохранения аномалий:', error);
        } finally {
            client.release();
        }
    }
    
    /**
     * Интеграция с Trust Score
     * Если обнаружены критические аномалии - снизить Trust Score
     */
    static async adjustTrustScoreOnAnomalies(userId, anomalies) {
        try {
            const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL');
            
            if (criticalAnomalies.length > 0) {
                // Получить текущий Trust Score
                const trustResult = await pool.query(
                    'SELECT trust_score FROM user_trust_scores WHERE user_id = $1',
                    [userId]
                );
                
                if (trustResult.rows.length > 0) {
                    const currentScore = trustResult.rows[0].trust_score;
                    const penalty = criticalAnomalies.length * 10;  // -10 за каждую критическую аномалию
                    const newScore = Math.max(0, currentScore - penalty);
                    
                    await pool.query(`
                        UPDATE user_trust_scores 
                        SET trust_score = $1 
                        WHERE user_id = $2
                    `, [newScore, userId]);
                    
                    // Записать в историю
                    await pool.query(`
                        INSERT INTO user_trust_history (
                            user_id, old_score, new_score, old_action, new_action, reason
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        userId,
                        currentScore,
                        newScore,
                        'NORMAL',
                        newScore < 40 ? 'WATCH_LIST' : 'NORMAL',
                        `Stats anomalies detected: ${criticalAnomalies.map(a => a.type).join(', ')}`
                    ]);
                    
                    console.log(`⚠️ [AnomalyDetector] Trust Score снижен: ${currentScore} → ${newScore} для user ${userId}`);
                }
            }
        } catch (error) {
            console.error('❌ [AnomalyDetector] Ошибка корректировки Trust Score:', error);
        }
    }
}

module.exports = AnomalyDetector;

