const pool = require('../../db');
const { generateBracket: bracketGenerator } = require('../../bracketGenerator');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');

/**
 * 🎯 BracketService v2.0 - Упрощенная и надежная система генерации сеток
 * 
 * Принципы:
 * - Простота: одна транзакция для всей операции
 * - Надежность: минимум внешних зависимостей  
 * - Атомарность: все или ничего
 * - Понятность: простая логика без лишних абстракций
 * 
 * Изменения v2.0:
 * - Убрана сложная система блокировок
 * - Убраны race condition проверки
 * - Убрана повторная вставка матчей (исправление критической ошибки)
 * - Простая и понятная обработка ошибок
 * - Детальное логирование каждого этапа
 */

class BracketService {
    
    /**
     * 🎯 Генерация турнирной сетки (исправленная версия без дублирования лейблов)
     */
    static async generateBracket(tournamentId, userId, thirdPlaceMatch = false) {
        const startTime = Date.now();
        const sessionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9); // Уникальный ID сессии
        console.log(`🎯 [BracketService v3.0] Генерация сетки для турнира ${tournamentId} [${sessionId}]`);
        
        // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Уникальные лейблы для каждой операции
        const labels = {
            findTournament: `find-tournament-${tournamentId}-${sessionId}`,
            getParticipants: `get-participants-${tournamentId}-${sessionId}`,
            generateBracket: `generate-bracket-${tournamentId}-${sessionId}`
        };
        
        const client = await pool.connect();
        try {
            console.log(`🔐 [generateBracket] Начинаем транзакцию... [${sessionId}]`);
            await client.query('BEGIN');
            
            // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Увеличиваем таймаут до 2 минут для операций с матчами
            console.log(`⏰ [generateBracket] Устанавливаем таймаут 120 секунд... [${sessionId}]`);
            await client.query('SET statement_timeout = 120000'); // 2 минуты
            
            console.log(`🔍 [generateBracket] Ищем турнир ${tournamentId}... [${sessionId}]`);
            console.time(labels.findTournament);
            
            // 1. Получаем турнир
            const tournamentResult = await client.query(
                'SELECT * FROM tournaments WHERE id = $1 FOR UPDATE',
                [tournamentId]
            );
            
            console.timeEnd(labels.findTournament);
            console.log(`✅ [generateBracket] Турнир найден: ${tournamentResult.rows.length} записей [${sessionId}]`);
            
            if (tournamentResult.rows.length === 0) {
                throw new Error('Турнир не найден');
            }
            
            const tournament = tournamentResult.rows[0];
            console.log(`📊 [generateBracket] Турнир: ${tournament.name}, статус: ${tournament.status}, формат: ${tournament.format} [${sessionId}]`);
            
            // 2. Проверяем права доступа
            console.log(`🔐 [generateBracket] Проверяем права пользователя ${userId}... [${sessionId}]`);
            if (tournament.created_by !== userId) {
                console.log(`🔍 [generateBracket] Пользователь не создатель, проверяем админские права... [${sessionId}]`);
                const adminCheck = await client.query(
                    'SELECT id FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                    [tournamentId, userId]
                );
                if (adminCheck.rows.length === 0) {
                    throw new Error('У вас нет прав для изменения этого турнира');
                }
                console.log(`✅ [generateBracket] Админские права подтверждены [${sessionId}]`);
            } else {
                console.log(`✅ [generateBracket] Пользователь является создателем турнира [${sessionId}]`);
            }
            
            // 3. Проверяем, есть ли уже матчи
            console.log(`🔍 [generateBracket] Проверяем существующие матчи... [${sessionId}]`);
            const existingMatches = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            const matchCount = parseInt(existingMatches.rows[0].count);
            console.log(`📊 [generateBracket] Найдено существующих матчей: ${matchCount} [${sessionId}]`);
            
            if (matchCount > 0) {
                throw new Error('Сетка уже сгенерирована. Используйте регенерацию для пересоздания.');
            }
            
            console.log(`👥 [generateBracket] Получаем участников турнира... [${sessionId}]`);
            console.time(labels.getParticipants);
            
            // 4. Получаем участников
            let participants = [];
            if (tournament.participant_type === 'team') {
                const teamsResult = await client.query(
                    'SELECT id, name FROM tournament_teams WHERE tournament_id = $1',
                    [tournamentId]
                );
                participants = teamsResult.rows;
                console.log(`👥 [generateBracket] Найдено ${participants.length} команд [${sessionId}]`);
            } else {
                const participantsResult = await client.query(
                    'SELECT id, name FROM tournament_participants WHERE tournament_id = $1',
                    [tournamentId]
                );
                participants = participantsResult.rows;
                console.log(`👥 [generateBracket] Найдено ${participants.length} участников [${sessionId}]`);
            }
            
            console.timeEnd(labels.getParticipants);
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для генерации сетки (минимум 2)');
            }
            
            console.log(`⚙️ [generateBracket] Вызываем генератор сетки... [${sessionId}]`);
            console.log(`⚙️ Параметры: format="${tournament.format}", tournamentId=${tournamentId}, participants=${participants.length}, thirdPlaceMatch=${thirdPlaceMatch}`);
            console.time(labels.generateBracket);
            
            // 5. Генерируем сетку
            const bracketResult = await bracketGenerator(
                tournament.format, 
                tournamentId, 
                participants, 
                thirdPlaceMatch
            );
            
            console.timeEnd(labels.generateBracket);
            console.log(`✅ [generateBracket] generateBracket завершен [${sessionId}]`);
            console.log(`🔍 Результат генерации:`, typeof bracketResult, bracketResult?.success);
            
            // Извлекаем массив матчей из результата
            const matches = bracketResult?.matches || bracketResult || [];
            console.log(`✅ Сгенерировано матчей: ${matches.length} [${sessionId}]`);
            
            if (!Array.isArray(matches) || matches.length === 0) {
                throw new Error('Генератор сетки не создал матчи');
            }
            
            // 🔧 ИСПРАВЛЕНИЕ: bracketGenerator УЖЕ создал матчи в БД!
            // Убираем повторную вставку которая приводила к дублированию
            console.log(`✅ [generateBracket] Матчи уже созданы генератором сетки в БД [${sessionId}]`);
            console.log(`ℹ️ [generateBracket] Пропускаем повторную вставку для избежания дублирования`);
            
            // Проверяем что матчи действительно созданы
            const createdMatchesCheck = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            const actualMatchCount = parseInt(createdMatchesCheck.rows[0].count);
            console.log(`📊 [generateBracket] Проверка: в БД создано ${actualMatchCount} матчей [${sessionId}]`);
            
            if (actualMatchCount === 0) {
                throw new Error('Генератор сетки не создал записи в БД');
            }
            
            console.log(`💾 [generateBracket] Коммитим транзакцию... [${sessionId}]`);
            await client.query('COMMIT');
            console.log(`✅ [generateBracket] Транзакция завершена успешно [${sessionId}]`);
            
            const duration = Date.now() - startTime;
            console.log(`🎉 [generateBracket] Генерация завершена за ${duration}ms [${sessionId}]`);
            
            return { success: true, matchesCount: actualMatchCount, duration };
            
        } catch (error) {
            console.error(`❌ [generateBracket] Ошибка:`, error.message);
            console.error(`❌ Stack trace:`, error.stack);
            
            try {
                await client.query('ROLLBACK');
                console.log(`🔙 [generateBracket] Транзакция отменена [${sessionId}]`);
            } catch (rollbackError) {
                console.error(`❌ [generateBracket] Ошибка отката:`, rollbackError.message);
            }
            
            throw error;
        } finally {
            client.release();
            console.log(`🔓 [generateBracket] Соединение с БД освобождено [${sessionId}]`);
        }
    }
    
    /**
     * 🔄 Регенерация турнирной сетки (исправленная версия без дублирования лейблов)
     */
    static async regenerateBracket(tournamentId, userId, shuffle = false, thirdPlaceMatch = false) {
        const startTime = Date.now();
        const sessionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9); // Уникальный ID сессии
        console.log(`🔄 [BracketService v3.0] Регенерация сетки для турнира ${tournamentId} (shuffle: ${shuffle}) [${sessionId}]`);
        
        // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Уникальные лейблы для каждой операции
        const labels = {
            findTournament: `find-tournament-${tournamentId}-${sessionId}`,
            deleteMatches: `delete-matches-${tournamentId}-${sessionId}`,
            getParticipants: `get-participants-${tournamentId}-${sessionId}`,
            generateBracket: `generate-bracket-${tournamentId}-${sessionId}`
        };
        
        const client = await pool.connect();
        try {
            console.log(`🔐 [regenerateBracket] Начинаем транзакцию... [${sessionId}]`);
            await client.query('BEGIN');
            
            // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Увеличиваем таймаут до 2 минут для операций с матчами
            console.log(`⏰ [regenerateBracket] Устанавливаем таймаут 120 секунд... [${sessionId}]`);
            await client.query('SET statement_timeout = 120000'); // 2 минуты
            
            console.log(`🔍 [regenerateBracket] Ищем турнир ${tournamentId}... [${sessionId}]`);
            console.time(labels.findTournament);
            
            // 1. Получаем турнир БЕЗ блокировки (для диагностики)
            const tournamentResult = await client.query(
                'SELECT id, name, status, format, participant_type, created_by FROM tournaments WHERE id = $1',
                [tournamentId]
            );
            
            console.timeEnd(labels.findTournament);
            console.log(`✅ [regenerateBracket] Турнир найден: ${tournamentResult.rows.length} записей [${sessionId}]`);
            
            if (tournamentResult.rows.length === 0) {
                throw new Error(`Турнир ${tournamentId} не найден`);
            }
            
            const tournament = tournamentResult.rows[0];
            console.log(`📊 [regenerateBracket] Турнир: ${tournament.name}, статус: ${tournament.status}, формат: ${tournament.format} [${sessionId}]`);
            
            // 2. Проверяем права доступа
            console.log(`🔐 [regenerateBracket] Проверяем права пользователя ${userId}... [${sessionId}]`);
            if (tournament.created_by !== userId) {
                console.log(`🔍 [regenerateBracket] Пользователь не создатель, проверяем админские права... [${sessionId}]`);
                const adminCheck = await client.query(
                    'SELECT id FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                    [tournamentId, userId]
                );
                if (adminCheck.rows.length === 0) {
                    throw new Error('У вас нет прав для изменения этого турнира');
                }
                console.log(`✅ [regenerateBracket] Админские права подтверждены [${sessionId}]`);
            } else {
                console.log(`✅ [regenerateBracket] Пользователь является создателем турнира [${sessionId}]`);
            }
            
            console.log(`🗑️ [regenerateBracket] Удаляем существующие матчи... [${sessionId}]`);
            console.time(labels.deleteMatches);
            
            try {
                // 🔧 ОПТИМИЗИРОВАННОЕ УДАЛЕНИЕ МАТЧЕЙ: сначала проверяем количество
                const countResult = await client.query(
                    'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                    [tournamentId]
                );
                const matchCount = parseInt(countResult.rows[0].count);
                console.log(`📊 [regenerateBracket] Найдено ${matchCount} существующих матчей [${sessionId}]`);
                
                if (matchCount === 0) {
                    console.log(`ℹ️ [regenerateBracket] Матчей для удаления нет, пропускаем операцию DELETE [${sessionId}]`);
                } else if (matchCount > 1000) {
                    // 🔧 Для больших турниров используем батченое удаление
                    console.log(`⚠️ [regenerateBracket] Большой турнир (${matchCount} матчей), используем батченое удаление [${sessionId}]`);
                    let deletedTotal = 0;
                    let batchNumber = 1;
                    
                    while (deletedTotal < matchCount) {
                        console.log(`🗑️ Батч ${batchNumber}: удаляем до 500 матчей... [${sessionId}]`);
                        const batchResult = await client.query(`
                            DELETE FROM matches 
                            WHERE id IN (
                                SELECT id FROM matches 
                                WHERE tournament_id = $1 
                                LIMIT 500
                            )
                        `, [tournamentId]);
                        
                        deletedTotal += batchResult.rowCount;
                        console.log(`   ✅ Батч ${batchNumber}: удалено ${batchResult.rowCount} матчей (всего: ${deletedTotal}/${matchCount}) [${sessionId}]`);
                        
                        if (batchResult.rowCount === 0) {
                            break; // Больше нечего удалять
                        }
                        batchNumber++;
                    }
                    console.log(`🗑️ [regenerateBracket] Батченое удаление завершено: ${deletedTotal} матчей [${sessionId}]`);
                } else {
                    // 🔧 Для обычных турниров используем стандартное удаление
                    const deleteResult = await client.query(
                        'DELETE FROM matches WHERE tournament_id = $1',
                        [tournamentId]
                    );
                    console.log(`🗑️ [regenerateBracket] Стандартное удаление: ${deleteResult.rowCount} матчей [${sessionId}]`);
                }
                
                console.timeEnd(labels.deleteMatches);
                console.log(`✅ [regenerateBracket] Все матчи удалены успешно [${sessionId}]`);
            } catch (deleteError) {
                console.timeEnd(labels.deleteMatches);
                throw deleteError;
            }
            
            console.log(`👥 [regenerateBracket] Получаем участников турнира... [${sessionId}]`);
            console.time(labels.getParticipants);
            
            // 4. Получаем участников
            let participants = [];
            if (tournament.participant_type === 'team') {
                const teamsResult = await client.query(
                    'SELECT id, name FROM tournament_teams WHERE tournament_id = $1',
                    [tournamentId]
                );
                participants = teamsResult.rows;
                console.log(`👥 [regenerateBracket] Найдено ${participants.length} команд [${sessionId}]`);
            } else {
                const participantsResult = await client.query(
                    'SELECT id, name FROM tournament_participants WHERE tournament_id = $1',
                    [tournamentId]
                );
                participants = participantsResult.rows;
                console.log(`👥 [regenerateBracket] Найдено ${participants.length} участников [${sessionId}]`);
            }
            
            console.timeEnd(labels.getParticipants);
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для генерации сетки');
            }
            
            // 5. Перемешиваем участников если нужно
            if (shuffle) {
                console.log(`🔀 [regenerateBracket] Перемешиваем участников... [${sessionId}]`);
                for (let i = participants.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [participants[i], participants[j]] = [participants[j], participants[i]];
                }
            }
            
            console.log(`⚙️ [regenerateBracket] Вызываем generateBracket... [${sessionId}]`);
            console.log(`⚙️ Параметры: format="${tournament.format}", tournamentId=${tournamentId}, participants=${participants.length}, thirdPlaceMatch=${thirdPlaceMatch}`);
            console.time(labels.generateBracket);
            
            // 6. Генерируем новую сетку
            const bracketResult = await bracketGenerator(
                tournament.format, 
                tournamentId, 
                participants, 
                thirdPlaceMatch
            );
            
            console.timeEnd(labels.generateBracket);
            console.log(`✅ [regenerateBracket] generateBracket завершен [${sessionId}]`);
            console.log(`🔍 Результат генерации:`, typeof bracketResult, bracketResult?.success);
            
            // Извлекаем массив матчей из результата
            const matches = bracketResult?.matches || bracketResult || [];
            console.log(`✅ Сгенерировано матчей: ${matches.length} [${sessionId}]`);
            
            if (!Array.isArray(matches) || matches.length === 0) {
                throw new Error('Генератор сетки не создал матчи');
            }
            
            // 🔧 ИСПРАВЛЕНИЕ: bracketGenerator УЖЕ создал матчи в БД!
            // Убираем повторную вставку которая приводила к дублированию
            console.log(`✅ [regenerateBracket] Матчи уже созданы генератором сетки в БД [${sessionId}]`);
            console.log(`ℹ️ [regenerateBracket] Пропускаем повторную вставку для избежания дублирования`);
            
            // Проверяем что матчи действительно созданы
            const createdMatchesCheck = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            const actualMatchCount = parseInt(createdMatchesCheck.rows[0].count);
            console.log(`📊 [regenerateBracket] Проверка: в БД создано ${actualMatchCount} матчей [${sessionId}]`);
            
            if (actualMatchCount === 0) {
                throw new Error('Генератор сетки не создал записи в БД');
            }
            
            console.log(`💾 [regenerateBracket] Коммитим транзакцию... [${sessionId}]`);
            await client.query('COMMIT');
            console.log(`✅ [regenerateBracket] Транзакция завершена успешно [${sessionId}]`);
            
            const duration = Date.now() - startTime;
            console.log(`🎉 [regenerateBracket] Регенерация завершена за ${duration}ms [${sessionId}]`);
            
            return { success: true, matchesCount: actualMatchCount, duration };
            
        } catch (error) {
            console.error(`❌ [regenerateBracket] Ошибка:`, error.message);
            console.error(`❌ Stack trace:`, error.stack);
            
            try {
                await client.query('ROLLBACK');
                console.log(`🔙 [regenerateBracket] Транзакция отменена [${sessionId}]`);
            } catch (rollbackError) {
                console.error(`❌ [regenerateBracket] Ошибка отката:`, rollbackError.message);
            }
            
            throw error;
        } finally {
            client.release();
            console.log(`🔓 [regenerateBracket] Соединение с БД освобождено [${sessionId}]`);
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