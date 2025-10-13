/**
 * 🏆 MVP CALCULATOR
 * Расчет MVP матча по формуле на основе данных MatchZy
 * 
 * Формула:
 * S_base = 1.8*K - 1.0*D + 0.6*A + DMG/25
 * S_impact = 1.5*EK + 1.0*TK + 3*C1 + 5*C2 + 0.5*MK2 + 1.2*MK3 + 2.5*MK4 + 4.0*MK5
 * S_obj = 2.0*MV
 * Score = (S_base + S_impact + S_obj) / max(1, R)
 * 
 * @version 1.0.0
 * @date 2025-10-13
 */

const pool = require('../db');

class MVPCalculator {
    /**
     * Рассчитать MVP для матча
     * @param {number} matchid - ID матча в MatchZy (matchzy_matches.matchid)
     * @returns {Promise<Object|null>} MVP данные или null
     */
    static async calculateMatchMVP(matchid) {
        console.log(`🏆 [MVP Calculator] Начинаем расчет MVP для matchid=${matchid}`);
        
        const client = await pool.connect();
        
        try {
            // 1. Проверяем что матч относится к турниру/кастомному лобби
            const matchCheck = await client.query(`
                SELECT 
                    mm.matchid,
                    mm.our_match_id,
                    m.source_type
                FROM matchzy_matches mm
                LEFT JOIN matches m ON m.id = mm.our_match_id
                WHERE mm.matchid = $1
            `, [matchid]);
            
            if (matchCheck.rows.length === 0) {
                console.log(`⚠️ [MVP Calculator] Матч ${matchid} не найден в matchzy_matches`);
                return null;
            }
            
            const matchData = matchCheck.rows[0];
            
            if (!matchData.our_match_id) {
                console.log(`ℹ️ [MVP Calculator] Матч ${matchid} не привязан к our_match_id (пропускаем)`);
                return null;
            }
            
            if (!['tournament', 'custom'].includes(matchData.source_type)) {
                console.log(`ℹ️ [MVP Calculator] Матч ${matchid} не турнирный/кастомный (source_type=${matchData.source_type}), пропускаем`);
                return null;
            }
            
            console.log(`✅ [MVP Calculator] Матч подходит для расчета (source_type=${matchData.source_type})`);
            
            // 2. Получаем данные карт для определения rounds_played
            const mapsData = await client.query(`
                SELECT 
                    mapnumber,
                    mapname,
                    team1_score + team2_score as rounds_played
                FROM matchzy_maps
                WHERE matchid = $1
                ORDER BY mapnumber
            `, [matchid]);
            
            if (mapsData.rows.length === 0) {
                console.log(`⚠️ [MVP Calculator] Нет данных карт для matchid=${matchid}`);
                return null;
            }
            
            console.log(`📊 [MVP Calculator] Найдено ${mapsData.rows.length} карт(ы)`);
            
            // 3. Получаем статистику игроков
            const playersData = await client.query(`
                SELECT 
                    mp.matchid,
                    mp.mapnumber,
                    mp.steamid64,
                    mp.name,
                    mp.team,
                    mp.kills,
                    mp.deaths,
                    mp.assists,
                    mp.damage,
                    mp.entry_wins,
                    mp.v1_wins,
                    mp.v2_wins,
                    mp.enemy2ks,
                    mp.enemy3ks,
                    mp.enemy4ks,
                    mp.enemy5ks
                FROM matchzy_players mp
                WHERE mp.matchid = $1
                ORDER BY mp.mapnumber, mp.steamid64
            `, [matchid]);
            
            if (playersData.rows.length === 0) {
                console.log(`⚠️ [MVP Calculator] Нет данных игроков для matchid=${matchid}`);
                return null;
            }
            
            console.log(`👥 [MVP Calculator] Найдено ${playersData.rows.length} игроков`);
            
            // 4. Создаем map: mapnumber -> rounds_played
            const roundsPerMap = new Map();
            mapsData.rows.forEach(map => {
                roundsPerMap.set(map.mapnumber, map.rounds_played || 1);
            });
            
            // 5. Рассчитываем MVP для каждого игрока
            await client.query('BEGIN');
            
            // Удаляем старые расчеты для этого матча
            await client.query(`
                DELETE FROM match_player_mvp 
                WHERE matchzy_matchid = $1
            `, [matchid]);
            
            const mvpResults = [];
            
            for (const player of playersData.rows) {
                const R = roundsPerMap.get(player.mapnumber) || 1;
                
                // Извлекаем данные
                const K = player.kills || 0;
                const D = player.deaths || 0;
                const A = player.assists || 0;
                const DMG = player.damage || 0;
                const EK = player.entry_wins || 0;
                const TK = 0; // Нет в MatchZy
                const C1 = player.v1_wins || 0;
                const C2 = player.v2_wins || 0;
                const MK2 = player.enemy2ks || 0;
                const MK3 = player.enemy3ks || 0;
                const MK4 = player.enemy4ks || 0;
                const MK5 = player.enemy5ks || 0;
                const MV = 0; // Нет в MatchZy
                
                // Формула
                const S_base = 1.8 * K - 1.0 * D + 0.6 * A + DMG / 25;
                const S_impact = 1.5 * EK + 1.0 * TK + 3 * C1 + 5 * C2 
                               + 0.5 * MK2 + 1.2 * MK3 + 2.5 * MK4 + 4.0 * MK5;
                const S_obj = 2.0 * MV;
                
                const mvp_score = (S_base + S_impact + S_obj) / Math.max(1, R);
                
                // Метрики для тай-брейков
                const impact_per_round = S_impact / Math.max(1, R);
                const clutch_score_per_round = (3 * C1 + 5 * C2) / Math.max(1, R);
                const adr = DMG / Math.max(1, R);
                const deaths_per_round = D / Math.max(1, R);
                
                // Получаем user_id по steamid64
                const userResult = await client.query(`
                    SELECT id FROM users WHERE steam_id = $1
                `, [player.steamid64.toString()]);
                
                const userId = userResult.rows[0]?.id || null;
                
                // Сохраняем в БД
                await client.query(`
                    INSERT INTO match_player_mvp (
                        matchzy_matchid, our_match_id, steamid64, user_id, mapnumber,
                        s_base, s_impact, s_obj, mvp_score,
                        rounds_played, impact_per_round, clutch_score_per_round, adr, deaths_per_round
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
                    )
                `, [
                    matchid,
                    matchData.our_match_id,
                    player.steamid64,
                    userId,
                    player.mapnumber,
                    S_base,
                    S_impact,
                    S_obj,
                    mvp_score,
                    R,
                    impact_per_round,
                    clutch_score_per_round,
                    adr,
                    deaths_per_round
                ]);
                
                mvpResults.push({
                    steamid64: player.steamid64,
                    name: player.name,
                    mapnumber: player.mapnumber,
                    mvp_score,
                    s_base: S_base,
                    s_impact: S_impact,
                    s_obj: S_obj
                });
            }
            
            await client.query('COMMIT');
            
            // 6. Определяем победителя (с тай-брейками)
            const winner = await this.getMVPWinner(matchid, client);
            
            if (winner) {
                console.log(`🏆 [MVP Calculator] MVP матча ${matchid}: ${winner.name} (${winner.mvp_score.toFixed(2)} очков)`);
            }
            
            return {
                matchid,
                our_match_id: matchData.our_match_id,
                mvp: winner,
                all_players: mvpResults
            };
            
        } catch (error) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            console.error(`❌ [MVP Calculator] Ошибка расчета MVP для matchid=${matchid}:`, error.message);
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Получить MVP победителя с учетом тай-брейков
     * @param {number} matchid - ID матча
     * @param {Object} client - DB client
     * @returns {Promise<Object|null>} MVP данные
     */
    static async getMVPWinner(matchid, client) {
        const result = await client.query(`
            SELECT 
                mvp.steamid64,
                mvp.mvp_score,
                mvp.impact_per_round,
                mvp.clutch_score_per_round,
                mvp.adr,
                mvp.deaths_per_round,
                mp.name
            FROM match_player_mvp mvp
            LEFT JOIN matchzy_players mp 
                ON mp.matchid = mvp.matchzy_matchid 
                AND mp.mapnumber = mvp.mapnumber 
                AND mp.steamid64 = mvp.steamid64
            WHERE mvp.matchzy_matchid = $1
            ORDER BY 
                mvp.mvp_score DESC,
                mvp.impact_per_round DESC,
                mvp.clutch_score_per_round DESC,
                mvp.adr DESC,
                mvp.deaths_per_round ASC
            LIMIT 1
        `, [matchid]);
        
        return result.rows[0] || null;
    }
    
    /**
     * Получить топ игроков по MVP скору
     * @param {number} ourMatchId - ID матча в matches
     * @param {number} limit - Количество игроков
     * @returns {Promise<Array>} Список игроков
     */
    static async getTopPlayers(ourMatchId, limit = 10) {
        const client = await pool.connect();
        
        try {
            const result = await client.query(`
                SELECT 
                    mvp.steamid64,
                    mvp.mvp_score,
                    mvp.s_base,
                    mvp.s_impact,
                    mvp.s_obj,
                    mvp.rounds_played,
                    mvp.mapnumber,
                    mp.name,
                    mp.team,
                    u.id as user_id,
                    u.username,
                    u.avatar_url
                FROM match_player_mvp mvp
                LEFT JOIN matchzy_players mp 
                    ON mp.matchid = mvp.matchzy_matchid 
                    AND mp.mapnumber = mvp.mapnumber 
                    AND mp.steamid64 = mvp.steamid64
                LEFT JOIN users u ON u.id = mvp.user_id
                WHERE mvp.our_match_id = $1
                ORDER BY 
                    mvp.mvp_score DESC,
                    mvp.impact_per_round DESC,
                    mvp.clutch_score_per_round DESC,
                    mvp.adr DESC,
                    mvp.deaths_per_round ASC
                LIMIT $2
            `, [ourMatchId, limit]);
            
            return result.rows;
        } finally {
            client.release();
        }
    }
}

module.exports = MVPCalculator;

