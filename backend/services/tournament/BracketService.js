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
const { generateBracket: bracketGenerator } = require('../../bracketGenerator');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');

class BracketService {
    /**
     * 🔄 Генерация турнирной сетки (упрощенная версия v2.0)
     */
    static async generateBracket(tournamentId, userId, thirdPlaceMatch = false) {
        const startTime = Date.now();
        console.log(`🔄 [BracketService v2.0] Генерация сетки для турнира ${tournamentId} (thirdPlaceMatch: ${thirdPlaceMatch})`);
        
        const client = await pool.connect();
        try {
            console.log(`🔐 [generateBracket] Начинаем транзакцию...`);
            await client.query('BEGIN');
            
            // Устанавливаем таймаут для предотвращения зависания
            console.log(`⏰ [generateBracket] Устанавливаем таймаут 30 секунд...`);
            await client.query('SET statement_timeout = 30000'); // 30 секунд
            
            console.log(`🔍 [generateBracket] Ищем турнир ${tournamentId}...`);
            console.time(`find-tournament-${tournamentId}`);
            
            // 1. Получаем турнир БЕЗ блокировки (для диагностики)
            const tournamentResult = await client.query(
                'SELECT id, name, status, format, participant_type, created_by FROM tournaments WHERE id = $1',
                [tournamentId]
            );
            
            console.timeEnd(`find-tournament-${tournamentId}`);
            console.log(`✅ [generateBracket] Турнир найден: ${tournamentResult.rows.length} записей`);
            
            if (tournamentResult.rows.length === 0) {
                throw new Error(`Турнир ${tournamentId} не найден`);
            }
            
            const tournament = tournamentResult.rows[0];
            console.log(`📊 [generateBracket] Турнир: ${tournament.name}, статус: ${tournament.status}, формат: ${tournament.format}`);
            
            // 2. Проверяем права доступа
            console.log(`🔐 [generateBracket] Проверяем права пользователя ${userId}...`);
            if (tournament.created_by !== userId) {
                console.log(`🔍 [generateBracket] Пользователь не создатель, проверяем админские права...`);
                const adminCheck = await client.query(
                    'SELECT id FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                    [tournamentId, userId]
                );
                if (adminCheck.rows.length === 0) {
                    throw new Error('У вас нет прав для изменения этого турнира');
                }
                console.log(`✅ [generateBracket] Админские права подтверждены`);
            } else {
                console.log(`✅ [generateBracket] Пользователь является создателем турнира`);
            }
            
            // 3. Проверяем, есть ли уже матчи
            console.log(`🔍 [generateBracket] Проверяем существующие матчи...`);
            const existingMatches = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            const matchCount = parseInt(existingMatches.rows[0].count);
            console.log(`📊 [generateBracket] Найдено существующих матчей: ${matchCount}`);
            
            if (matchCount > 0) {
                throw new Error('Сетка уже сгенерирована. Используйте регенерацию для пересоздания.');
            }
            
            console.log(`👥 [generateBracket] Получаем участников турнира...`);
            console.time(`get-participants-${tournamentId}`);
            
            // 4. Получаем участников
            let participants = [];
            if (tournament.participant_type === 'team') {
                const teamsResult = await client.query(
                    'SELECT id, name FROM tournament_teams WHERE tournament_id = $1',
                    [tournamentId]
                );
                participants = teamsResult.rows;
                console.log(`👥 [generateBracket] Найдено ${participants.length} команд`);
            } else {
                const participantsResult = await client.query(
                    'SELECT id, name FROM tournament_participants WHERE tournament_id = $1',
                    [tournamentId]
                );
                participants = participantsResult.rows;
                console.log(`👥 [generateBracket] Найдено ${participants.length} участников`);
            }
            
            console.timeEnd(`get-participants-${tournamentId}`);
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для генерации сетки (минимум 2)');
            }
            
            console.log(`⚙️ [generateBracket] Вызываем генератор сетки...`);
            console.log(`⚙️ Параметры: format="${tournament.format}", tournamentId=${tournamentId}, participants=${participants.length}, thirdPlaceMatch=${thirdPlaceMatch}`);
            console.time(`generate-bracket-${tournamentId}`);
            
            // 5. Генерируем сетку
            const bracketResult = await bracketGenerator(
                tournament.format, 
                tournamentId, 
                participants, 
                thirdPlaceMatch
            );
            
            console.timeEnd(`generate-bracket-${tournamentId}`);
            console.log(`✅ [generateBracket] generateBracket завершен`);
            console.log(`🔍 Результат генерации:`, typeof bracketResult, bracketResult?.success);
            
            // Извлекаем массив матчей из результата
            const matches = bracketResult?.matches || bracketResult || [];
            console.log(`✅ Сгенерировано матчей: ${matches.length}`);
            
            if (!Array.isArray(matches) || matches.length === 0) {
                throw new Error('Генератор сетки не создал матчи');
            }
            
            console.log(`💾 [generateBracket] Сохраняем ${matches.length} матчей в БД...`);
            console.time(`save-matches-${tournamentId}`);
            
            // 6. Сохраняем матчи в базе данных
            for (const match of matches) {
                await client.query(
                    `INSERT INTO matches (
                        tournament_id, round, match_number, team1_id, team2_id,
                        next_match_id, is_third_place_match, position, parent_match1_id, parent_match2_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        tournamentId,
                        match.round,
                        match.match_number,
                        match.team1_id || null,
                        match.team2_id || null,
                        match.next_match_id || null,
                        match.is_third_place_match || false,
                        match.position || null,
                        match.parent_match1_id || null,
                        match.parent_match2_id || null
                    ]
                );
            }
            
            console.timeEnd(`save-matches-${tournamentId}`);
            console.log(`✅ [generateBracket] Все матчи сохранены`);
            
            console.log(`💾 [generateBracket] Коммитим транзакцию...`);
            await client.query('COMMIT');
            console.log(`✅ [generateBracket] Транзакция завершена успешно`);
            
            const duration = Date.now() - startTime;
            console.log(`🎉 [generateBracket] Генерация завершена за ${duration}ms`);
            
            return { success: true, matchesCount: matches.length, duration };
            
        } catch (error) {
            console.error(`❌ [generateBracket] Ошибка:`, error.message);
            console.error(`❌ Stack trace:`, error.stack);
            
            try {
                await client.query('ROLLBACK');
                console.log(`🔙 [generateBracket] Транзакция отменена`);
            } catch (rollbackError) {
                console.error(`❌ [generateBracket] Ошибка отката:`, rollbackError.message);
            }
            
            throw error;
        } finally {
            client.release();
            console.log(`🔓 [generateBracket] Соединение с БД освобождено`);
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
            console.log(`🔐 [regenerateBracket] Начинаем транзакцию...`);
            await client.query('BEGIN');
            
            // Устанавливаем таймаут для предотвращения зависания
            console.log(`⏰ [regenerateBracket] Устанавливаем таймаут 30 секунд...`);
            await client.query('SET statement_timeout = 30000'); // 30 секунд
            
            console.log(`🔍 [regenerateBracket] Ищем турнир ${tournamentId}...`);
            console.time(`find-tournament-${tournamentId}`);
            
            // 1. Получаем турнир БЕЗ блокировки (для диагностики)
            const tournamentResult = await client.query(
                'SELECT id, name, status, format, participant_type, created_by FROM tournaments WHERE id = $1',
                [tournamentId]
            );
            
            console.timeEnd(`find-tournament-${tournamentId}`);
            console.log(`✅ [regenerateBracket] Турнир найден: ${tournamentResult.rows.length} записей`);
            
            if (tournamentResult.rows.length === 0) {
                throw new Error(`Турнир ${tournamentId} не найден`);
            }
            
            const tournament = tournamentResult.rows[0];
            console.log(`📊 [regenerateBracket] Турнир: ${tournament.name}, статус: ${tournament.status}, формат: ${tournament.format}`);
            
            // 2. Проверяем права доступа
            console.log(`🔐 [regenerateBracket] Проверяем права пользователя ${userId}...`);
            if (tournament.created_by !== userId) {
                console.log(`🔍 [regenerateBracket] Пользователь не создатель, проверяем админские права...`);
                const adminCheck = await client.query(
                    'SELECT id FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                    [tournamentId, userId]
                );
                if (adminCheck.rows.length === 0) {
                    throw new Error('У вас нет прав для изменения этого турнира');
                }
                console.log(`✅ [regenerateBracket] Админские права подтверждены`);
            } else {
                console.log(`✅ [regenerateBracket] Пользователь является создателем турнира`);
            }
            
            console.log(`🗑️ [regenerateBracket] Удаляем существующие матчи...`);
            console.time(`delete-matches-${tournamentId}`);
            
            // 3. Удаляем существующие матчи
            const deleteResult = await client.query(
                'DELETE FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            console.timeEnd(`delete-matches-${tournamentId}`);
            console.log(`✅ [regenerateBracket] Удалено ${deleteResult.rowCount} матчей`);
            
            console.log(`👥 [regenerateBracket] Получаем участников турнира...`);
            console.time(`get-participants-${tournamentId}`);
            
            // 4. Получаем участников
            let participants = [];
            if (tournament.participant_type === 'team') {
                const teamsResult = await client.query(
                    'SELECT id, name FROM tournament_teams WHERE tournament_id = $1',
                    [tournamentId]
                );
                participants = teamsResult.rows;
                console.log(`👥 [regenerateBracket] Найдено ${participants.length} команд`);
            } else {
                const participantsResult = await client.query(
                    'SELECT id, name FROM tournament_participants WHERE tournament_id = $1',
                    [tournamentId]
                );
                participants = participantsResult.rows;
                console.log(`👥 [regenerateBracket] Найдено ${participants.length} участников`);
            }
            
            console.timeEnd(`get-participants-${tournamentId}`);
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для генерации сетки');
            }
            
            // 5. Перемешиваем участников если нужно
            if (shuffle) {
                console.log(`🔀 [regenerateBracket] Перемешиваем участников...`);
                for (let i = participants.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [participants[i], participants[j]] = [participants[j], participants[i]];
                }
            }
            
            console.log(`⚙️ [regenerateBracket] Вызываем generateBracket...`);
            console.log(`⚙️ Параметры: format="${tournament.format}", tournamentId=${tournamentId}, participants=${participants.length}, thirdPlaceMatch=${thirdPlaceMatch}`);
            console.time(`generate-bracket-${tournamentId}`);
            
            // 6. Генерируем новую сетку
            const bracketResult = await bracketGenerator(
                tournament.format, 
                tournamentId, 
                participants, 
                thirdPlaceMatch
            );
            
            console.timeEnd(`generate-bracket-${tournamentId}`);
            console.log(`✅ [regenerateBracket] generateBracket завершен`);
            console.log(`🔍 Результат генерации:`, typeof bracketResult, bracketResult?.success);
            
            // Извлекаем массив матчей из результата
            const matches = bracketResult?.matches || bracketResult || [];
            console.log(`✅ Сгенерировано матчей: ${matches.length}`);
            
            if (!Array.isArray(matches) || matches.length === 0) {
                throw new Error('Генератор сетки не создал матчи');
            }
            
            console.log(`💾 [regenerateBracket] Сохраняем ${matches.length} матчей в БД...`);
            console.time(`save-matches-${tournamentId}`);
            
            // 7. Сохраняем матчи в базе данных
            for (const match of matches) {
                await client.query(
                    `INSERT INTO matches (
                        tournament_id, round, match_number, team1_id, team2_id,
                        next_match_id, is_third_place_match, position, parent_match1_id, parent_match2_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        tournamentId,
                        match.round,
                        match.match_number,
                        match.team1_id || null,
                        match.team2_id || null,
                        match.next_match_id || null,
                        match.is_third_place_match || false,
                        match.position || null,
                        match.parent_match1_id || null,
                        match.parent_match2_id || null
                    ]
                );
            }
            
            console.timeEnd(`save-matches-${tournamentId}`);
            console.log(`✅ [regenerateBracket] Все матчи сохранены`);
            
            console.log(`💾 [regenerateBracket] Коммитим транзакцию...`);
            await client.query('COMMIT');
            console.log(`✅ [regenerateBracket] Транзакция завершена успешно`);
            
            const duration = Date.now() - startTime;
            console.log(`🎉 [regenerateBracket] Регенерация завершена за ${duration}ms`);
            
            return { success: true, matchesCount: matches.length, duration };
            
        } catch (error) {
            console.error(`❌ [regenerateBracket] Ошибка:`, error.message);
            console.error(`❌ Stack trace:`, error.stack);
            
            try {
                await client.query('ROLLBACK');
                console.log(`🔙 [regenerateBracket] Транзакция отменена`);
            } catch (rollbackError) {
                console.error(`❌ [regenerateBracket] Ошибка отката:`, rollbackError.message);
            }
            
            throw error;
        } finally {
            client.release();
            console.log(`🔓 [regenerateBracket] Соединение с БД освобождено`);
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