/**
 * 📊 STATS PROCESSOR
 * Обработка данных от MatchZy webhook
 * 
 * @version 2.0.0
 * @date 2025-10-02
 */

const pool = require('../../db');

class StatsProcessor {
    /**
     * Обработка данных от MatchZy webhook
     * @param {Object} matchzyData - JSON от MatchZy
     * @returns {Promise<Object>} Результат обработки
     */
    static async processMatchZyData(matchzyData) {
        console.log('📊 [StatsProcessor] Начинаем обработку данных от MatchZy');
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. Найти матч по идентификатору
            const match = await this._findMatch(matchzyData, client);
            
            if (!match) {
                console.log('⚠️ [StatsProcessor] Матч не найден, сохраняем для последующей обработки');
                await this._savePendingStats(matchzyData, client);
                await client.query('COMMIT');
                return { success: true, status: 'pending', message: 'Match not found, saved for later' };
            }
            
            console.log(`✅ [StatsProcessor] Найден матч: ID ${match.id}`);
            
            // 2. Сохранить общую статистику матча
            await this._saveMatchStats(match.id, matchzyData, client);
            
            // 3. Сохранить статистику каждого игрока
            const savedPlayers = await this._savePlayerStats(match, matchzyData, client);
            
            // 4. Обновить агрегированную статистику
            for (const userId of savedPlayers) {
                await client.query('SELECT update_player_aggregated_stats_v2($1)', [userId]);
            }
            
            console.log(`✅ [StatsProcessor] Обновлена агрегация для ${savedPlayers.length} игроков`);
            
            await client.query('COMMIT');
            
            return {
                success: true,
                status: 'processed',
                match_id: match.id,
                players_updated: savedPlayers.length
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ [StatsProcessor] Ошибка обработки:', error);
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Найти матч в БД
     */
    static async _findMatch(data, client) {
        // Попытка 1: По matchId из MatchZy (если настроен)
        if (data.matchId) {
            const result = await client.query(
                'SELECT * FROM matches WHERE id = $1',
                [parseInt(data.matchId)]
            );
            if (result.rows.length > 0) return result.rows[0];
        }
        
        // Попытка 2: По названиям команд и времени
        if (data.team1?.name && data.team2?.name) {
            const result = await client.query(`
                SELECT m.* 
                FROM matches m
                JOIN tournament_teams t1 ON t1.id = m.team1_id
                JOIN tournament_teams t2 ON t2.id = m.team2_id
                WHERE t1.name = $1
                  AND t2.name = $2
                  AND m.state IN ('PENDING', 'DONE', 'SCORE_DONE')
                  AND m.created_at > (NOW() - INTERVAL '24 hours')
                ORDER BY m.created_at DESC
                LIMIT 1
            `, [data.team1.name, data.team2.name]);
            
            if (result.rows.length > 0) return result.rows[0];
        }
        
        return null;
    }
    
    /**
     * Сохранить общую статистику матча
     */
    static async _saveMatchStats(matchId, data, client) {
        await client.query(`
            INSERT INTO match_stats (
                match_id,
                map_name,
                rounds_played,
                team1_score,
                team2_score,
                team1_name,
                team2_name,
                demo_url,
                raw_matchzy_data,
                processed
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (match_id) DO UPDATE SET
                map_name = EXCLUDED.map_name,
                rounds_played = EXCLUDED.rounds_played,
                team1_score = EXCLUDED.team1_score,
                team2_score = EXCLUDED.team2_score,
                demo_url = EXCLUDED.demo_url,
                raw_matchzy_data = EXCLUDED.raw_matchzy_data,
                processed = true,
                processed_at = NOW()
        `, [
            matchId,
            data.mapName || data.map_name,
            data.rounds?.length || data.rounds_played || 0,
            data.team1?.score || 0,
            data.team2?.score || 0,
            data.team1?.name || 'Team 1',
            data.team2?.name || 'Team 2',
            data.demo_url || null,
            JSON.stringify(data),
            true
        ]);
        
        console.log(`✅ [StatsProcessor] Сохранена общая статистика матча ${matchId}`);
    }
    
    /**
     * Сохранить статистику игроков
     */
    static async _savePlayerStats(match, data, client) {
        const savedUserIds = [];
        
        for (const team of [data.team1, data.team2]) {
            if (!team?.players) continue;
            
            for (const player of team.players) {
                try {
                    // Найти пользователя по Steam ID
                    const userResult = await client.query(
                        'SELECT id FROM users WHERE steam_id = $1',
                        [player.steamId || player.steam_id]
                    );
                    
                    if (userResult.rows.length === 0) {
                        console.log(`⚠️ Пользователь не найден для Steam ID: ${player.steamId}`);
                        continue;
                    }
                    
                    const userId = userResult.rows[0].id;
                    const stats = player.stats || player;
                    
                    // Вычислить производные метрики
                    const hsPercentage = stats.kills > 0 
                        ? (stats.headshots / stats.kills * 100) 
                        : 0;
                    
                    // Сохранить статистику
                    await client.query(`
                        INSERT INTO player_match_stats (
                            match_id, user_id, steam_id, team_id,
                            kills, deaths, assists, headshots, damage_dealt, rounds_played,
                            adr, kast, rating, impact, hs_percentage,
                            clutch_1v1_won, clutch_1v1_total,
                            clutch_1v2_won, clutch_1v2_total,
                            clutch_1v3_won, clutch_1v3_total,
                            flash_assists, utility_damage, enemies_flashed,
                            entry_kills, entry_deaths,
                            opening_kills, opening_deaths,
                            trade_kills, mvp, score,
                            weapon_stats
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                            $11, $12, $13, $14, $15,
                            $16, $17, $18, $19, $20, $21,
                            $22, $23, $24,
                            $25, $26, $27, $28, $29, $30, $31, $32
                        )
                        ON CONFLICT (match_id, user_id) DO UPDATE SET
                            kills = EXCLUDED.kills,
                            deaths = EXCLUDED.deaths,
                            assists = EXCLUDED.assists,
                            headshots = EXCLUDED.headshots,
                            damage_dealt = EXCLUDED.damage_dealt,
                            adr = EXCLUDED.adr,
                            kast = EXCLUDED.kast,
                            rating = EXCLUDED.rating,
                            hs_percentage = EXCLUDED.hs_percentage,
                            weapon_stats = EXCLUDED.weapon_stats
                    `, [
                        match.id,
                        userId,
                        player.steamId || player.steam_id,
                        null,  // team_id заполним позже если нужно
                        stats.kills || 0,
                        stats.deaths || 0,
                        stats.assists || 0,
                        stats.headshots || 0,
                        stats.damage || stats.damage_dealt || 0,
                        stats.rounds_played || 0,
                        stats.adr || 0,
                        stats.kast || 0,
                        stats.rating || 0,
                        stats.impact || 0,
                        hsPercentage,
                        stats.clutch_1v1_won || 0,
                        stats.clutch_1v1_total || 0,
                        stats.clutch_1v2_won || 0,
                        stats.clutch_1v2_total || 0,
                        stats.clutch_1v3_won || 0,
                        stats.clutch_1v3_total || 0,
                        stats.flash_assists || 0,
                        stats.utility_damage || 0,
                        stats.enemies_flashed || 0,
                        stats.entry_kills || 0,
                        stats.entry_deaths || 0,
                        stats.opening_kills || 0,
                        stats.opening_deaths || 0,
                        stats.trade_kills || 0,
                        stats.mvp || 0,
                        stats.score || 0,
                        JSON.stringify(stats.weapons || {})
                    ]);
                    
                    savedUserIds.push(userId);
                    console.log(`✅ [StatsProcessor] Сохранена статистика для user_id: ${userId}`);
                    
                } catch (playerError) {
                    console.error(`❌ [StatsProcessor] Ошибка сохранения игрока:`, playerError);
                    // Продолжаем с другими игроками
                }
            }
        }
        
        return savedUserIds;
    }
    
    /**
     * Сохранить данные для последующей обработки (если матч не найден)
     */
    static async _savePendingStats(data, client) {
        // Можно создать таблицу pending_matchzy_stats
        // Или логировать в файл
        console.log('📝 [StatsProcessor] Saving to pending (not implemented yet)');
    }
}

module.exports = StatsProcessor;

