const pool = require('../../db');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');

/**
 * 🎯 BracketService v4.0 - ТОЛЬКО УТИЛИТЫ
 * 
 * Принципы V4.0:
 * - Убраны ВСЕ методы генерации и регенерации сетки
 * - Оставлены только вспомогательные методы и очистка результатов
 * - Простота и надежность
 */

class BracketService {
    
    /**
     * 🗑️ Очистка результатов матчей
     */
    static async clearMatchResults(tournamentId, userId) {
        const startTime = Date.now();
        console.log(`🗑️ [BracketService v4.0] Очистка результатов турнира ${tournamentId}`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Проверяем турнир
            const tournamentResult = await client.query(
                'SELECT * FROM tournaments WHERE id = $1 FOR UPDATE',
                [tournamentId]
            );
            
            if (tournamentResult.rows.length === 0) {
                throw new Error('Турнир не найден');
            }
            
            const tournament = tournamentResult.rows[0];
            
            // 2. Очищаем результаты всех матчей
            const updateResult = await client.query(`
                UPDATE matches 
                SET winner_team_id = NULL, 
                    score1 = NULL, 
                    score2 = NULL, 
                    maps_data = NULL,
                    status = 'pending'
                WHERE tournament_id = $1 
                AND (winner_team_id IS NOT NULL OR score1 IS NOT NULL OR score2 IS NOT NULL)
            `, [tournamentId]);
            
            console.log(`🗑️ Очищено результатов: ${updateResult.rowCount}`);
            
            // 3. Меняем статус турнира обратно на active
            await client.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2 AND status != $1',
                ['active', tournamentId]
            );
            
            await client.query('COMMIT');
            
            // 4. Логируем событие
            await logTournamentEvent(tournamentId, userId, 'match_results_cleared', {
                clearedCount: updateResult.rowCount
            });
            
            const duration = Date.now() - startTime;
            console.log(`✅ [BracketService v4.0] Результаты очищены за ${duration}ms`);
            
            return {
                success: true,
                message: `Результаты матчей очищены (${updateResult.rowCount} матчей)`,
                clearedMatches: updateResult.rowCount,
                duration: duration
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [BracketService v4.0] Ошибка очистки:`, error.message);
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * 🗑️ Полное удаление турнирной сетки (все матчи)
     */
    static async clearBracket(tournamentId, userId = null) {
        const startTime = Date.now();
        console.log(`🗑️ [BracketService v4.0] Полное удаление сетки турнира ${tournamentId}`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Проверяем турнир
            const tournamentResult = await client.query(
                'SELECT * FROM tournaments WHERE id = $1 FOR UPDATE',
                [tournamentId]
            );
            
            if (tournamentResult.rows.length === 0) {
                throw new Error('Турнир не найден');
            }
            
            const tournament = tournamentResult.rows[0];
            
            // 2. Получаем количество матчей для логирования
            const matchCountResult = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            const matchCount = parseInt(matchCountResult.rows[0].count);
            
            // 3. Полностью удаляем все матчи турнира
            const deleteResult = await client.query(
                'DELETE FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            console.log(`🗑️ Полностью удалено матчей: ${deleteResult.rowCount}`);
            
            // 4. Сбрасываем статус турнира на active
            await client.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2',
                ['active', tournamentId]
            );
            
            await client.query('COMMIT');
            
            // 5. Логируем событие если передан userId
            if (userId) {
                await logTournamentEvent(tournamentId, userId, 'bracket_cleared', {
                    deletedMatches: deleteResult.rowCount
                });
            }
            
            // 6. Отправляем уведомление в чат
            if (deleteResult.rowCount > 0) {
                await sendTournamentChatAnnouncement(
                    tournamentId,
                    `🗑️ Турнирная сетка полностью удалена (${deleteResult.rowCount} матчей). Необходимо создать новую сетку для продолжения турнира.`
                );
            }
            
            // 7. Отправляем WebSocket обновление
            const updatedTournament = await this._getTournamentData(tournamentId);
            broadcastTournamentUpdate(tournamentId, updatedTournament);
            
            const duration = Date.now() - startTime;
            console.log(`✅ [BracketService v4.0] Сетка полностью удалена за ${duration}ms`);
            
            return {
                success: true,
                message: `Турнирная сетка полностью удалена (${deleteResult.rowCount} матчей)`,
                deletedMatches: deleteResult.rowCount,
                duration: duration
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [BracketService v4.0] Ошибка удаления сетки:`, error.message);
            throw error;
        } finally {
            client.release();
        }
    }
    
    // ==========================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ==========================================
    
    /**
     * Получение команд для микс турнира
     */
    static async _getMixTeams(tournamentId, client) {
        const result = await client.query(`
            SELECT tt.id, tt.name, 
                   JSON_AGG(
                       CASE WHEN ttm.user_id IS NOT NULL THEN
                           JSON_BUILD_OBJECT(
                               'id', u.id,
                               'username', u.username,
                               'avatar_url', u.avatar_url
                           )
                       END
                   ) FILTER (WHERE ttm.user_id IS NOT NULL) as members
            FROM tournament_teams tt
            LEFT JOIN tournament_team_members ttm ON tt.id = ttm.team_id
            LEFT JOIN users u ON ttm.user_id = u.id
            WHERE tt.tournament_id = $1
            GROUP BY tt.id
            ORDER BY tt.id
        `, [tournamentId]);
        
        return result.rows.map(team => ({
            id: team.id,
            name: team.name,
            members: team.members || []
        }));
    }
    
    /**
     * Получение участников для solo турнира
     */
    static async _getSoloParticipants(tournamentId, client) {
        const result = await client.query(`
            SELECT tp.id, tp.name, u.avatar_url
            FROM tournament_participants tp
            LEFT JOIN users u ON tp.user_id = u.id
            WHERE tp.tournament_id = $1
            ORDER BY tp.created_at ASC
        `, [tournamentId]);
        
        return result.rows;
    }
    
    /**
     * Получение команд для team турнира
     */
    static async _getTeamParticipants(tournamentId, client) {
        const result = await client.query(`
            SELECT tt.id, tt.name
            FROM tournament_teams tt
            WHERE tt.tournament_id = $1
            ORDER BY tt.id
        `, [tournamentId]);
        
        return result.rows;
    }
    
    /**
     * Отправка уведомлений
     */
    static async _sendNotifications(tournamentId, tournamentName, action) {
        try {
            const actionText = action === 'generated' ? 'сгенерирована' : 'перегенерирована';
            const message = `Турнирная сетка ${actionText} для турнира "${tournamentName}"`;
            
            // Отправляем в чат турнира
            await sendTournamentChatAnnouncement(tournamentId, message);
            
            // Отправляем WebSocket обновление
            const tournament = await this._getTournamentData(tournamentId);
            broadcastTournamentUpdate(tournamentId, tournament);
            
            console.log(`📤 Уведомления отправлены`);
        } catch (error) {
            console.error(`❌ Ошибка отправки уведомлений:`, error.message);
        }
    }
    
    /**
     * Получение данных турнира для WebSocket
     */
    static async _getTournamentData(tournamentId) {
        const result = await pool.query(`
            SELECT t.*,
                   (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = t.id) as participant_count,
                   (SELECT JSON_AGG(m.*) FROM matches m WHERE m.tournament_id = t.id) as matches
            FROM tournaments t 
            WHERE t.id = $1
        `, [tournamentId]);
        
        return result.rows[0] || null;
    }
}

module.exports = BracketService; 