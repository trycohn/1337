// backend/services/tournament/BracketService.js
//
// 🔄 УПРОЩЕННЫЙ И НАДЕЖНЫЙ BRACKET SERVICE V2.0
// ================================================
// 
// ✅ Принципы новой архитектуры:
// • Простота вместо сложности
// • Одна транзакция для всей операции 
// • Минимум блокировок и мьютексов
// • Понятная логика без overengineering
// • Атомарные операции (все или ничего)
// • Быстрая диагностика проблем
//

const pool = require('../../db');
const { generateBracket } = require('../../bracketGenerator');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');

class BracketService {
    /**
     * 🔄 Генерация турнирной сетки (упрощенная версия)
     */
    static async generateBracket(tournamentId, userId, thirdPlaceMatch = false) {
        const startTime = Date.now();
        console.log(`🔄 [BracketService v2.0] Генерация сетки для турнира ${tournamentId}`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Получаем турнир с простой блокировкой
            const tournamentResult = await client.query(
                'SELECT * FROM tournaments WHERE id = $1 FOR UPDATE',
                [tournamentId]
            );
            
            if (tournamentResult.rows.length === 0) {
                throw new Error('Турнир не найден');
            }
            
            const tournament = tournamentResult.rows[0];
            console.log(`✅ Турнир найден: "${tournament.name}" (${tournament.format})`);
            
            // 2. Проверяем, что сетка еще не сгенерирована
            const existingMatches = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            const matchCount = parseInt(existingMatches.rows[0].count);
            if (matchCount > 0) {
                throw new Error(`Сетка уже сгенерирована (${matchCount} матчей). Используйте регенерацию.`);
            }
            
            // 3. Получаем участников в зависимости от типа турнира
            let participants;
            if (tournament.format === 'mix') {
                participants = await this._getMixTeams(tournamentId, client);
            } else if (tournament.participant_type === 'solo') {
                participants = await this._getSoloParticipants(tournamentId, client);
            } else {
                participants = await this._getTeamParticipants(tournamentId, client);
            }
            
            console.log(`📊 Получено участников: ${participants.length}`);
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для генерации сетки (минимум 2)');
            }
            
            // 4. Генерируем сетку
            console.log(`⚙️ Вызываем генератор сетки...`);
            const matches = await generateBracket(
                tournament.format, 
                tournamentId, 
                participants, 
                thirdPlaceMatch
            );
            
            console.log(`✅ Сгенерировано матчей: ${matches.length}`);
            
            // 5. Обновляем статус турнира если нужно
            if (tournament.status === 'pending') {
                await client.query(
                    'UPDATE tournaments SET status = $1 WHERE id = $2',
                    ['active', tournamentId]
                );
                console.log(`📊 Статус турнира изменен на 'active'`);
            }
            
            await client.query('COMMIT');
            
            // 6. Отправляем уведомления
            await this._sendNotifications(tournamentId, tournament.name, 'generated');
            
            const duration = Date.now() - startTime;
            console.log(`✅ [BracketService v2.0] Сетка сгенерирована за ${duration}ms`);
            
            return {
                success: true,
                matchesCount: matches.length,
                participantsCount: participants.length,
                duration
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [BracketService v2.0] Ошибка генерации:`, error.message);
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * 🔄 Регенерация турнирной сетки (упрощенная версия)
     */
    static async regenerateBracket(tournamentId, userId, shuffle = false, thirdPlaceMatch = false) {
        const startTime = Date.now();
        console.log(`🔄 [BracketService v2.0] Регенерация сетки для турнира ${tournamentId} (shuffle: ${shuffle})`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Получаем турнир с блокировкой
            const tournamentResult = await client.query(
                'SELECT * FROM tournaments WHERE id = $1 FOR UPDATE',
                [tournamentId]
            );
            
            if (tournamentResult.rows.length === 0) {
                throw new Error('Турнир не найден');
            }
            
            const tournament = tournamentResult.rows[0];
            console.log(`✅ Турнир найден: "${tournament.name}"`);
            
            // 2. Удаляем все существующие матчи
            const deleteResult = await client.query(
                'DELETE FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            console.log(`🗑️ Удалено матчей: ${deleteResult.rowCount}`);
            
            // 3. Получаем участников
            let participants;
            if (tournament.format === 'mix') {
                participants = await this._getMixTeams(tournamentId, client);
            } else if (tournament.participant_type === 'solo') {
                participants = await this._getSoloParticipants(tournamentId, client);
            } else {
                participants = await this._getTeamParticipants(tournamentId, client);
            }
            
            // 4. Перемешиваем участников если нужно
            if (shuffle && participants.length > 1) {
                for (let i = participants.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [participants[i], participants[j]] = [participants[j], participants[i]];
                }
                console.log(`🔀 Участники перемешаны`);
            }
            
            console.log(`📊 Участников для регенерации: ${participants.length}`);
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для генерации сетки');
            }
            
            // 5. Генерируем новую сетку
            console.log(`⚙️ Генерируем новую сетку...`);
            const matches = await generateBracket(
                tournament.format, 
                tournamentId, 
                participants, 
                thirdPlaceMatch
            );
            
            console.log(`✅ Сгенерировано новых матчей: ${matches.length}`);
            
            await client.query('COMMIT');
            
            // 6. Отправляем уведомления
            await this._sendNotifications(tournamentId, tournament.name, 'regenerated');
            
            const duration = Date.now() - startTime;
            console.log(`✅ [BracketService v2.0] Сетка регенерирована за ${duration}ms`);
            
            return {
                success: true,
                matchesCount: matches.length,
                participantsCount: participants.length,
                shuffled: shuffle,
                duration
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [BracketService v2.0] Ошибка регенерации:`, error.message);
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * 🗑️ Очистка результатов матчей
     */
    static async clearMatchResults(tournamentId, userId) {
        const startTime = Date.now();
        console.log(`🗑️ [BracketService v2.0] Очистка результатов турнира ${tournamentId}`);
        
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
            console.log(`✅ [BracketService v2.0] Результаты очищены за ${duration}ms`);
            
            return {
                success: true,
                clearedCount: updateResult.rowCount,
                duration
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [BracketService v2.0] Ошибка очистки:`, error.message);
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