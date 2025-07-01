const pool = require('../../db');
const { generateBracket } = require('../../bracketGenerator');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');
const ParticipantService = require('./ParticipantService');

/**
 * 🎯 BracketService v3.0 - УПРОЩЕННАЯ архитектура без таймаутов
 * 
 * Принципы V3.0:
 * - Атомарные операции: используем PostgreSQL для блокировок  
 * - Простота: убираем таймауты и сложную логику
 * - Производительность: прямые SQL запросы без оверхеда
 * - Отладка: детальное логирование каждого шага
 */

class BracketService {
    
    /**
     * 🎯 ИСПРАВЛЕННАЯ Генерация турнирной сетки V3.1
     * @param {number} tournamentId - ID турнира
     * @param {boolean} thirdPlaceMatch - Добавить ли матч за 3-е место
     * @returns {Object} - Результат генерации
     */
    static async generateBracket(tournamentId, thirdPlaceMatch = false) {
        console.log(`🎯 [BracketService v3.1] Генерация сетки для турнира ${tournamentId}`);
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. Атомарная блокировка турнира
            const lockResult = await client.query(`
                UPDATE tournaments 
                SET status = CASE 
                    WHEN status = 'active' THEN 'generating'
                    ELSE status 
                END
                WHERE id = $1 
                RETURNING status, name, format, participant_type, created_by
            `, [tournamentId]);
            
            if (lockResult.rows.length === 0) {
                throw new Error('Турнир не найден');
            }
            
            const tournament = lockResult.rows[0];
            console.log(`✅ Турнир заблокирован: ${tournament.name}`);
            
            if (tournament.status !== 'generating') {
                throw new Error(`Турнир уже обрабатывается (статус: ${tournament.status})`);
            }
            
            // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем существующие матчи
            const existingMatches = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            if (parseInt(existingMatches.rows[0].count) > 0) {
                console.log(`🔧 Найдено ${existingMatches.rows[0].count} существующих матчей, начинаем очистку...`);
                
                // Если есть матчи, сначала очищаем foreign keys
                console.log('🔧 Очистка foreign key ссылок между матчами...');
                
                await client.query(`
                    UPDATE matches 
                    SET 
                        next_match_id = NULL,
                        loser_next_match_id = NULL,
                        source_match1_id = NULL,
                        source_match2_id = NULL
                    WHERE tournament_id = $1
                `, [tournamentId]);
                
                console.log('✅ Foreign key ссылки очищены');
                
                // Теперь безопасно удаляем матчи
                const deleteResult = await client.query(
                    'DELETE FROM matches WHERE tournament_id = $1',
                    [tournamentId]
                );
                console.log(`🗑️ Удалено ${deleteResult.rowCount} существующих матчей`);
                
                // 🔧 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Убеждаемся, что все матчи удалены
                const checkResult = await client.query(
                    'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                    [tournamentId]
                );
                
                const remainingMatches = parseInt(checkResult.rows[0].count);
                if (remainingMatches > 0) {
                    console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: После удаления осталось ${remainingMatches} матчей!`);
                    
                    // 🔧 ЭКСТРЕННАЯ ОЧИСТКА: Пробуем удалить еще раз без транзакции
                    console.log('🚨 Пробуем экстренную очистку без транзакции...');
                    await pool.query('DELETE FROM matches WHERE tournament_id = $1', [tournamentId]);
                    
                    const finalCheck = await pool.query(
                        'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                        [tournamentId]
                    );
                    
                    if (parseInt(finalCheck.rows[0].count) > 0) {
                        throw new Error(`Не удалось полностью очистить матчи турнира ${tournamentId}`);
                    }
                } else {
                    console.log('✅ Все матчи успешно удалены');
                }
            }
            
            // 2. Получаем участников
            let participants;
            
            // 🔧 ИСПРАВЛЕНИЕ: Для микс турниров используем команды, а не участников
            if (tournament.format === 'mix') {
                console.log('🎯 Турнир формата MIX - получаем команды');
                participants = await this._getMixTeams(tournamentId, client);
                console.log(`👥 Найдено ${participants.length} команд`);
            } else {
                participants = await ParticipantService.getByTournamentId(tournamentId);
                console.log(`👥 Найдено ${participants.length} участников`);
            }
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для генерации сетки');
            }
            
            // 3. Генерируем сетку
            const bracketResult = await generateBracket(
                tournament.format,
                tournamentId,
                participants,
                thirdPlaceMatch
            );
            
            // 4. Сохраняем настройку матча за 3-е место
            await client.query(
                `UPDATE tournaments 
                 SET third_place_match = $1 
                 WHERE id = $2`,
                [thirdPlaceMatch, tournamentId]
            );
            
            // 5. Восстанавливаем статус турнира
            await client.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2',
                ['active', tournamentId]
            );
            
            await client.query('COMMIT');
            
            console.log(`✅ Сетка успешно сгенерирована для турнира ${tournamentId}`);
            return bracketResult;
            
        } catch (error) {
            await client.query('ROLLBACK');
            
            // Восстанавливаем статус турнира при ошибке
            await pool.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2',
                ['active', tournamentId]
            );
            
            console.error('❌ Ошибка при генерации сетки:', error);
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * 🔄 ИСПРАВЛЕННАЯ Регенерация турнирной сетки V3.1
     * @param {number} tournamentId - ID турнира
     * @param {boolean} shuffle - Перемешивать ли участников
     * @param {boolean} thirdPlaceMatch - Добавить ли матч за 3-е место
     * @returns {Object} - Результат регенерации
     */
    static async regenerateBracket(tournamentId, shuffle = true, thirdPlaceMatch = false) {
        console.log(`🔄 [BracketService v3.1] Регенерация сетки для турнира ${tournamentId}`);
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. Атомарная блокировка турнира
            const lockResult = await client.query(`
                UPDATE tournaments 
                SET status = CASE 
                    WHEN status = 'active' THEN 'generating'
                    ELSE status 
                END
                WHERE id = $1 
                RETURNING status, name, format, participant_type, created_by
            `, [tournamentId]);
            
            if (lockResult.rows.length === 0) {
                throw new Error('Турнир не найден');
            }
            
            const tournament = lockResult.rows[0];
            console.log(`✅ Турнир заблокирован: ${tournament.name}`);
            
            if (tournament.status !== 'generating') {
                throw new Error(`Турнир уже обрабатывается (статус: ${tournament.status})`);
            }
            
            // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сначала очищаем foreign key ссылки
            console.log('🔧 Очистка foreign key ссылок между матчами...');
            
            // Очищаем все self-referencing foreign keys
            await client.query(`
                UPDATE matches 
                SET 
                    next_match_id = NULL,
                    loser_next_match_id = NULL,
                    source_match1_id = NULL,
                    source_match2_id = NULL
                WHERE tournament_id = $1
            `, [tournamentId]);
            
            console.log('✅ Foreign key ссылки очищены');
            
            // Теперь безопасно удаляем матчи
            const deleteResult = await client.query(
                'DELETE FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            console.log(`🗑️ Удалено ${deleteResult.rowCount} матчей`);
            
            // 🔧 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Убеждаемся, что все матчи удалены
            const checkResult = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            const remainingMatches = parseInt(checkResult.rows[0].count);
            if (remainingMatches > 0) {
                console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: После удаления осталось ${remainingMatches} матчей!`);
                
                // 🔧 ЭКСТРЕННАЯ ОЧИСТКА: Пробуем удалить еще раз без транзакции
                console.log('🚨 Пробуем экстренную очистку без транзакции...');
                await pool.query('DELETE FROM matches WHERE tournament_id = $1', [tournamentId]);
                
                const finalCheck = await pool.query(
                    'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                    [tournamentId]
                );
                
                if (parseInt(finalCheck.rows[0].count) > 0) {
                    throw new Error(`Не удалось полностью очистить матчи турнира ${tournamentId}`);
                }
            } else {
                console.log('✅ Все матчи успешно удалены');
            }
            
            // 2. Получаем участников
            let participants;
            
            // 🔧 ИСПРАВЛЕНИЕ: Для микс турниров используем команды, а не участников
            if (tournament.format === 'mix') {
                console.log('🎯 Турнир формата MIX - получаем команды');
                participants = await this._getMixTeams(tournamentId, client);
                console.log(`👥 Найдено ${participants.length} команд`);
            } else {
                participants = await ParticipantService.getByTournamentId(tournamentId);
                console.log(`👥 Найдено ${participants.length} участников`);
            }
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для генерации сетки');
            }
            
            // 3. Перемешиваем участников
            if (shuffle) {
                console.log('🔀 Перемешиваем участников');
                for (let i = participants.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [participants[i], participants[j]] = [participants[j], participants[i]];
                }
            }
            
            // 4. Генерируем новую сетку
            const bracketResult = await generateBracket(
                tournament.format,
                tournamentId,
                participants,
                thirdPlaceMatch
            );
            
            // 5. Сохраняем настройку матча за 3-е место
            await client.query(
                `UPDATE tournaments 
                 SET third_place_match = $1 
                 WHERE id = $2`,
                [thirdPlaceMatch, tournamentId]
            );
            
            // 6. Восстанавливаем статус турнира
            await client.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2',
                ['active', tournamentId]
            );
            
            await client.query('COMMIT');
            
            console.log(`✅ Сетка успешно регенерирована для турнира ${tournamentId}`);
            return bracketResult;
            
        } catch (error) {
            await client.query('ROLLBACK');
            
            // Восстанавливаем статус турнира при ошибке
            await pool.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2',
                ['active', tournamentId]
            );
            
            console.error('❌ Ошибка при регенерации сетки:', error);
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