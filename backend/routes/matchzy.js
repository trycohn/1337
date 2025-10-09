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
 * POST /api/matchzy/match-end
 * Webhook от MatchZy когда матч завершен (триггер для получения статистики из БД)
 */
router.post('/match-end', async (req, res) => {
    console.log('🎯 [MatchZy] Получен webhook');
    
    try {
        // Проверка токена (если настроен в .env)
        if (process.env.MATCHZY_SECRET_TOKEN) {
            const token = req.headers['x-matchzy-token'] || 
                         req.headers['authorization']?.replace('Bearer ', '');
            
            console.log('🔑 [MatchZy] Проверка токена:');
            console.log('   Получен токен:', token ? token.substring(0, 20) + '...' : 'ОТСУТСТВУЕТ');
            console.log('   Ожидаемый токен:', process.env.MATCHZY_SECRET_TOKEN ? process.env.MATCHZY_SECRET_TOKEN.substring(0, 20) + '...' : 'НЕ УСТАНОВЛЕН');
            console.log('   Headers:', JSON.stringify(req.headers));
            
            if (token !== process.env.MATCHZY_SECRET_TOKEN) {
                console.log('❌ [MatchZy] Токены не совпадают!');
                return res.status(401).json({ 
                    success: false, 
                    error: 'Unauthorized' 
                });
            }
            
            console.log('✅ [MatchZy] Токен валиден');
        } else {
            console.log('⚠️ [MatchZy] MATCHZY_SECRET_TOKEN не установлен в .env - пропускаем проверку');
        }
        
        const eventData = req.body;
        const { matchid, event, winner, team1_series_score, team2_series_score } = eventData;
        
        // ФИЛЬТРУЕМ: обрабатываем только series_end
        if (event !== 'series_end') {
            console.log(`ℹ️ [MatchZy] Событие "${event}" игнорируется (ждем series_end)`);
            return res.status(200).send('OK'); // Всё равно возвращаем 200!
        }
        
        if (!matchid) {
            console.log('⚠️ [MatchZy] matchid не указан в webhook');
            return res.status(200).send('OK'); // Всё равно 200
        }
        
        console.log(`📊 [MatchZy] series_end получен:`, {
            matchid,
            score: `${team1_series_score || 0}:${team2_series_score || 0}`,
            winner: winner?.team || 'N/A'
        });
        
        // Быстро отвечаем серверу что webhook получен
        res.status(200).send('OK');
        
        // Запускаем импорт статистики в фоне (с задержкой 2 сек чтобы MatchZy успел записать в БД)
        setTimeout(async () => {
            try {
                console.log(`⏳ [MatchZy] Начинаем импорт статистики для matchid=${matchid}...`);
                const mid = parseInt(matchid);
                await importStatsForMatch(mid);
                // Материализуем player_match_stats из matchzy_* → для профилей
                const { materializePlayerStatsFromMatchzy } = require('../services/matchzyPollingService');
                await materializePlayerStatsFromMatchzy(mid);
            } catch (error) {
                console.error(`❌ [MatchZy] Ошибка импорта статистики для matchid=${matchid}:`, error.message);
            }
        }, 2000); // 2 секунды задержка
        
    } catch (error) {
        console.error('❌ [MatchZy] Ошибка webhook:', error);
        res.status(200).send('OK'); // Даже при ошибке возвращаем 200
    }
});

/**
 * Импорт статистики матча из БД сервера
 */
async function importStatsForMatch(matchid) {
    const pool = require('../db');
    const { withMySql } = require('../services/matchzyPollingService');
    
    console.log(`🔍 [MatchZy] Начинаем импорт статистики для matchid=${matchid}`);
    
    try {
        // 1. Извлекаем lobby_id из matchid
        const lobbyId = deriveLobbyIdFromMatchId(matchid);
        
        if (!lobbyId) {
            console.log(`⚠️ [MatchZy] Не удалось извлечь lobby_id из matchid=${matchid}`);
            return;
        }
        
        console.log(`🔍 [MatchZy] Извлечен lobby_id=${lobbyId} из matchid=${matchid}`);
        
        // 2. Находим server_id по lobby_id
        const lobbyResult = await pool.query(
            'SELECT server_id FROM admin_match_lobbies WHERE id = $1',
            [lobbyId]
        );
        
        if (!lobbyResult.rows[0]?.server_id) {
            console.log(`⚠️ [MatchZy] Не найден server_id для lobby_id=${lobbyId}`);
            return;
        }
        
        const serverId = lobbyResult.rows[0].server_id;
        console.log(`🖥️ [MatchZy] Найден server_id=${serverId}`);
        
        // 3. Подключаемся к БД этого сервера и импортируем статистику
        await withMySql(async (conn) => {
            console.log(`📥 [MatchZy] Запрашиваем данные из БД сервера...`);
            
            // Получаем данные матча
            const [matches] = await conn.execute(
                'SELECT * FROM matchzy_stats_matches WHERE matchid = ?',
                [matchid]
            );
            
            if (matches.length === 0) {
                console.log(`⚠️ [MatchZy] Матч ${matchid} не найден в БД сервера (еще не записан?)`);
                return;
            }
            
            const matchRow = matches[0];
            console.log(`✅ [MatchZy] Найден матч: ${matchRow.team1_name} ${matchRow.team1_score}:${matchRow.team2_score} ${matchRow.team2_name}`);
            
            // Импортируем матч
            const { importMatchFromMySql } = require('../services/matchzyPollingService');
            await importMatchFromMySql(matchRow, conn);
            
            console.log(`✅ [MatchZy] Статистика матча ${matchid} успешно импортирована!`);
            
        }, serverId);
        
    } catch (error) {
        console.error(`❌ [MatchZy] Ошибка импорта:`, error.message);
        throw error;
    }
}

/**
 * Извлечь lobby_id из matchid
 */
function deriveLobbyIdFromMatchId(matchid) {
    try {
        const s = String(matchid);
        if (s.length <= 8) return null;
        const lobbyId = Number(s.slice(0, -8));
        return Number.isInteger(lobbyId) && lobbyId > 0 ? lobbyId : null;
    } catch (_) {
        return null;
    }
}

/**
 * POST /api/matchzy/stats
 * Webhook для приема статистики от MatchZy (legacy, для совместимости)
 */
router.post('/stats', async (req, res) => {
    console.log('📊 [MatchZy] Получены данные от MatchZy webhook (legacy)');
    
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

