const pool = require('../../db');
const { generateBracket: bracketGenerator } = require('../../bracketGenerator');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');

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
     * 🎯 Генерация турнирной сетки (упрощенная версия без таймаутов)
     */
    static async generateBracket(tournamentId, userId, thirdPlaceMatch = false) {
        const startTime = Date.now();
        console.log(`🎯 [BracketService v3.0] Генерация сетки для турнира ${tournamentId}`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 🔧 АТОМАРНАЯ БЛОКИРОВКА: проверяем и блокируем в одном запросе
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
            
            if (tournament.status !== 'generating') {
                throw new Error(`Генерация невозможна. Статус турнира: ${tournament.status}`);
            }
            
            console.log(`✅ Турнир заблокирован: ${tournament.name}`);
            
            // 🔐 Проверяем права доступа
            if (tournament.created_by !== userId) {
                const adminCheck = await client.query(
                    'SELECT 1 FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                    [tournamentId, userId]
                );
                if (adminCheck.rows.length === 0) {
                    throw new Error('У вас нет прав для изменения этого турнира');
                }
            }
            
            // 🔍 Проверяем существующие матчи
            const existingMatches = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            
            if (parseInt(existingMatches.rows[0].count) > 0) {
                throw new Error('Сетка уже сгенерирована. Используйте регенерацию.');
            }
            
            // 👥 Получаем участников
            let participants = [];
            if (tournament.participant_type === 'team') {
                const result = await client.query(
                    'SELECT id, name FROM tournament_teams WHERE tournament_id = $1 ORDER BY id',
                    [tournamentId]
                );
                participants = result.rows;
            } else {
                const result = await client.query(
                    'SELECT id, name FROM tournament_participants WHERE tournament_id = $1 ORDER BY id',
                    [tournamentId]
                );
                participants = result.rows;
            }
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников (минимум 2)');
            }
            
            console.log(`👥 Найдено ${participants.length} участников`);
            
            // ⚙️ Генерируем сетку (bracketGenerator создает матчи в БД)
            const bracketResult = await bracketGenerator(
                tournament.format, 
                tournamentId, 
                participants, 
                thirdPlaceMatch
            );
            
            const matches = bracketResult?.matches || bracketResult || [];
            
            if (!Array.isArray(matches) || matches.length === 0) {
                throw new Error('Генератор не создал матчи');
            }
            
            console.log(`✅ Создано ${matches.length} матчей`);
            
            // 🔄 Восстанавливаем статус турнира
            await client.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2',
                ['active', tournamentId]
            );
            
            await client.query('COMMIT');
            
            const duration = Date.now() - startTime;
            console.log(`🎉 Генерация завершена за ${duration}ms`);
            
            return { 
                success: true, 
                matchesCount: matches.length, 
                duration,
                tournament: await this._getTournamentData(tournamentId)
            };
            
        } catch (error) {
            console.error(`❌ Ошибка генерации:`, error.message);
            await client.query('ROLLBACK');
            
            // 🔄 Восстанавливаем статус при ошибке
            try {
                await pool.query(
                    'UPDATE tournaments SET status = $1 WHERE id = $2 AND status = $3',
                    ['active', tournamentId, 'generating']
                );
            } catch (statusError) {
                console.error(`❌ Ошибка восстановления статуса:`, statusError);
            }
            
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
        console.log(`🔄 [BracketService v3.0] Регенерация сетки для турнира ${tournamentId}`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 🔧 АТОМАРНАЯ БЛОКИРОВКА
            const lockResult = await client.query(`
                UPDATE tournaments 
                SET status = 'generating'
                WHERE id = $1 AND status IN ('active', 'in_progress')
                RETURNING status, name, format, participant_type, created_by
            `, [tournamentId]);
            
            if (lockResult.rows.length === 0) {
                throw new Error('Турнир не найден или недоступен для регенерации');
            }
            
            const tournament = lockResult.rows[0];
            console.log(`✅ Турнир заблокирован: ${tournament.name}`);
            
            // 🔐 Проверяем права
            if (tournament.created_by !== userId) {
                const adminCheck = await client.query(
                    'SELECT 1 FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                    [tournamentId, userId]
                );
                if (adminCheck.rows.length === 0) {
                    throw new Error('У вас нет прав для изменения этого турнира');
                }
            }
            
            // 🗑️ БЫСТРО удаляем существующие матчи (как в PgAdmin)
            const deleteResult = await client.query(
                'DELETE FROM matches WHERE tournament_id = $1',
                [tournamentId]
            );
            console.log(`🗑️ Удалено ${deleteResult.rowCount} матчей`);
            
            // 👥 Получаем участников
            let participants = [];
            if (tournament.participant_type === 'team') {
                const result = await client.query(
                    'SELECT id, name FROM tournament_teams WHERE tournament_id = $1 ORDER BY id',
                    [tournamentId]
                );
                participants = result.rows;
            } else {
                const result = await client.query(
                    'SELECT id, name FROM tournament_participants WHERE tournament_id = $1 ORDER BY id',
                    [tournamentId]
                );
                participants = result.rows;
            }
            
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для регенерации');
            }
            
            // 🔀 Перемешиваем если нужно
            if (shuffle) {
                console.log(`🔀 Перемешиваем участников`);
                for (let i = participants.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [participants[i], participants[j]] = [participants[j], participants[i]];
                }
            }
            
            // ⚙️ Генерируем новую сетку
            const bracketResult = await bracketGenerator(
                tournament.format, 
                tournamentId, 
                participants, 
                thirdPlaceMatch
            );
            
            const matches = bracketResult?.matches || bracketResult || [];
            
            if (!Array.isArray(matches) || matches.length === 0) {
                throw new Error('Генератор не создал матчи');
            }
            
            console.log(`✅ Создано ${matches.length} новых матчей`);
            
            // 🔄 Восстанавливаем статус
            await client.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2',
                ['active', tournamentId]
            );
            
            await client.query('COMMIT');
            
            const duration = Date.now() - startTime;
            console.log(`🎉 Регенерация завершена за ${duration}ms`);
            
            return { 
                success: true, 
                matchesCount: matches.length, 
                duration,
                tournament: await this._getTournamentData(tournamentId)
            };
            
        } catch (error) {
            console.error(`❌ Ошибка регенерации:`, error.message);
            await client.query('ROLLBACK');
            
            // 🔄 Восстанавливаем статус при ошибке
            try {
                await pool.query(
                    'UPDATE tournaments SET status = $1 WHERE id = $2 AND status = $3',
                    ['active', tournamentId, 'generating']
                );
            } catch (statusError) {
                console.error(`❌ Ошибка восстановления статуса:`, statusError);
            }
            
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