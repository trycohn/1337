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
                
                // Связываем matchid с нашими матчами/лобби
                const { materializePlayerStatsFromMatchzy, linkOurRefs } = require('../services/matchzyPollingService');
                await linkOurRefs(mid);
                
                // Обновляем счет турнирного матча
                await updateTournamentMatchScore(mid);
                
                // Материализуем player_match_stats из matchzy_* → для профилей
                await materializePlayerStatsFromMatchzy(mid);
                
                // Рассчитываем MVP для турнирных и кастомных матчей
                try {
                    const MVPCalculator = require('../services/mvpCalculator');
                    const mvpResult = await MVPCalculator.calculateMatchMVP(mid);
                    if (mvpResult?.mvp) {
                        console.log(`🏆 [MatchZy] MVP: ${mvpResult.mvp.name} (${mvpResult.mvp.mvp_score.toFixed(2)} очков)`);
                    }
                } catch (mvpError) {
                    console.error(`⚠️ [MatchZy] Ошибка расчета MVP:`, mvpError.message);
                }
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
 * Обновить счет турнирного матча после завершения
 */
async function updateTournamentMatchScore(matchid) {
    const pool = require('../db');
    
    try {
        // Получаем данные матча из matchzy_matches
        const matchzyResult = await pool.query(
            `SELECT our_match_id, tournament_lobby_id, team1_score, team2_score, winner
             FROM matchzy_matches 
             WHERE matchid = $1`,
            [matchid]
        );
        
        if (!matchzyResult.rows[0]) {
            console.log(`ℹ️ [updateScore] Матч ${matchid} не найден в matchzy_matches`);
            return;
        }
        
        const { our_match_id, tournament_lobby_id, team1_score, team2_score, winner } = matchzyResult.rows[0];
        
        // Если нет our_match_id или нет tournament_lobby_id - это не турнирный матч
        if (!our_match_id || !tournament_lobby_id) {
            console.log(`ℹ️ [updateScore] Матч ${matchid} не турнирный (our_match_id=${our_match_id}, tournament_lobby_id=${tournament_lobby_id})`);
            return;
        }
        
        // Получаем team1_id и team2_id из matches
        const matchResult = await pool.query(
            `SELECT team1_id, team2_id FROM matches WHERE id = $1`,
            [our_match_id]
        );
        
        if (!matchResult.rows[0]) {
            console.log(`⚠️ [updateScore] Матч ${our_match_id} не найден в таблице matches`);
            return;
        }
        
        const { team1_id, team2_id } = matchResult.rows[0];
        
        // Определяем winner_team_id на основе winner ('team1' или 'team2')
        let winner_team_id = null;
        if (winner === 'team1' && team1_id) {
            winner_team_id = team1_id;
        } else if (winner === 'team2' && team2_id) {
            winner_team_id = team2_id;
        }
        
        // Обновляем матч
        await pool.query(
            `UPDATE matches 
             SET score1 = $1, score2 = $2, winner_team_id = $3, status = 'completed'
             WHERE id = $4`,
            [team1_score || 0, team2_score || 0, winner_team_id, our_match_id]
        );
        
        console.log(`✅ [updateScore] Обновлен счет матча ${our_match_id}: ${team1_score}:${team2_score}, победитель: ${winner_team_id || 'нет'}`);
        
    } catch (error) {
        console.error(`❌ [updateScore] Ошибка обновления счета для matchid=${matchid}:`, error.message);
    }
}

/**
 * Импорт статистики матча из БД сервера
 */
async function importStatsForMatch(matchid) {
    const pool = require('../db');
    const { withMySql } = require('../services/matchzyPollingService');
    
    console.log(`🔍 [MatchZy] Начинаем импорт статистики для matchid=${matchid}`);
    
    try {
        // 1. Извлекаем ID из matchid (может быть matchId или lobbyId)
        const extractedId = deriveLobbyIdFromMatchId(matchid);
        
        if (!extractedId) {
            console.log(`⚠️ [MatchZy] Не удалось извлечь ID из matchid=${matchid}`);
            return;
        }
        
        console.log(`🔍 [MatchZy] Извлечен ID=${extractedId} из matchid=${matchid}`);
        
        // 2. Проверяем сначала турнирное лобби (match_lobbies)
        let lobbyType = null;
        let lobbyId = null;
        let matchId = null;
        
        // Проверяем турнирное лобби по match_id
        const tournamentMatchResult = await pool.query(
            `SELECT ml.id as lobby_id, ml.match_id 
             FROM match_lobbies ml 
             WHERE ml.match_id = $1`,
            [extractedId]
        );
        
        if (tournamentMatchResult.rows[0]) {
            lobbyType = 'tournament';
            lobbyId = tournamentMatchResult.rows[0].lobby_id;
            matchId = tournamentMatchResult.rows[0].match_id;
            console.log(`🏆 [MatchZy] Найдено турнирное лобби: lobby_id=${lobbyId}, match_id=${matchId}`);
        } else {
            // Проверяем кастомное лобби (admin_match_lobbies)
            const adminLobbyResult = await pool.query(
                'SELECT id, server_id FROM admin_match_lobbies WHERE id = $1',
                [extractedId]
            );
            
            if (adminLobbyResult.rows[0]) {
                lobbyType = 'admin';
                lobbyId = extractedId;
                console.log(`🎮 [MatchZy] Найдено кастомное лобби: lobby_id=${lobbyId}`);
            }
        }
        
        if (!lobbyId) {
            console.log(`⚠️ [MatchZy] Лобби не найдено для ID=${extractedId}`);
            return;
        }
        
        // 3. Получаем server_id для импорта из MySQL БД сервера
        let serverId = null;
        if (lobbyType === 'admin') {
            const lobbyResult = await pool.query(
                'SELECT server_id FROM admin_match_lobbies WHERE id = $1',
                [lobbyId]
            );
            
            if (!lobbyResult.rows[0]?.server_id) {
                console.log(`⚠️ [MatchZy] Не найден server_id для admin lobby_id=${lobbyId}`);
                return;
            }
            
            serverId = lobbyResult.rows[0].server_id;
            console.log(`🖥️ [MatchZy] Найден server_id=${serverId} для кастомного лобби`);
        } else if (lobbyType === 'tournament') {
            // Получаем server_id для турнирного лобби
            const lobbyResult = await pool.query(
                'SELECT server_id FROM match_lobbies WHERE id = $1',
                [lobbyId]
            );
            
            if (!lobbyResult.rows[0]?.server_id) {
                console.log(`⚠️ [MatchZy] Не найден server_id для tournament lobby_id=${lobbyId}`);
                return;
            }
            
            serverId = lobbyResult.rows[0].server_id;
            console.log(`🖥️ [MatchZy] Найден server_id=${serverId} для турнирного лобби`);
        }
        
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
 * Извлечь ID из matchid (новая формула: matchid = ID * 1000 + милисекунды)
 */
function deriveLobbyIdFromMatchId(matchid) {
    try {
        // Новая формула: matchid = (ID * 1000) + (timestamp % 1000)
        // Делим на 1000 и округляем вниз
        const id = Math.floor(matchid / 1000);
        return Number.isInteger(id) && id > 0 ? id : null;
    } catch (_) {
        return null;
    }
}

/**
 * POST /api/matchzy/import-match-stats/:matchId
 * Ручной импорт статистики для турнирного матча
 */
router.post('/import-match-stats/:matchId', async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId);
        
        if (!matchId || isNaN(matchId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Неверный ID матча' 
            });
        }
        
        console.log(`📥 [Manual Import] Запрос импорта статистики для match_id=${matchId}`);
        
        const pool = require('../db');
        
        // Проверяем существование матча и получаем lobby_id
        const matchResult = await pool.query(
            `SELECT ml.id as lobby_id, m.id as match_id, m.team1_name, m.team2_name
             FROM matches m
             LEFT JOIN match_lobbies ml ON ml.match_id = m.id
             WHERE m.id = $1`,
            [matchId]
        );
        
        if (!matchResult.rows[0]) {
            return res.status(404).json({ 
                success: false, 
                error: 'Матч не найден' 
            });
        }
        
        const matchData = matchResult.rows[0];
        console.log(`✅ [Manual Import] Найден матч: ${matchData.team1_name} vs ${matchData.team2_name}`);
        
        // Генерируем matchid на основе match_id (используя нашу формулу)
        // Ищем существующий matchid в matchzy_matches или создаем новый
        const existingResult = await pool.query(
            `SELECT matchid FROM matchzy_matches WHERE our_match_id = $1 ORDER BY matchid DESC LIMIT 1`,
            [matchId]
        );
        
        let matchid;
        if (existingResult.rows[0]) {
            matchid = existingResult.rows[0].matchid;
            console.log(`🔍 [Manual Import] Найден существующий matchid=${matchid}`);
        } else {
            // Генерируем matchid на основе формулы
            matchid = (matchId * 1000) + Math.floor(Math.random() * 1000);
            console.log(`🆕 [Manual Import] Сгенерирован новый matchid=${matchid}`);
        }
        
        // Запускаем импорт в фоне
        setTimeout(async () => {
            try {
                console.log(`⏳ [Manual Import] Начинаем импорт для matchid=${matchid}...`);
                
                await importStatsForMatch(matchid);
                
                const { materializePlayerStatsFromMatchzy, linkOurRefs } = require('../services/matchzyPollingService');
                await linkOurRefs(matchid);
                await updateTournamentMatchScore(matchid);
                await materializePlayerStatsFromMatchzy(matchid);
                
                // Рассчитываем MVP
                try {
                    const MVPCalculator = require('../services/mvpCalculator');
                    await MVPCalculator.calculateMatchMVP(matchid);
                } catch (mvpError) {
                    console.error(`⚠️ [Manual Import] Ошибка расчета MVP:`, mvpError.message);
                }
                
                console.log(`✅ [Manual Import] Импорт завершен для match_id=${matchId}`);
            } catch (error) {
                console.error(`❌ [Manual Import] Ошибка импорта:`, error.message);
            }
        }, 100);
        
        res.json({ 
            success: true, 
            message: 'Импорт статистики запущен',
            matchid 
        });
        
    } catch (error) {
        console.error('❌ [Manual Import] Ошибка:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

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

