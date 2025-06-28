const pool = require('../../db');

/**
 * Логирование событий турнира
 * @param {number} tournamentId - ID турнира
 * @param {number} userId - ID пользователя
 * @param {string} event_type - Тип события
 * @param {object} event_data - Дополнительные данные
 */
async function logTournamentEvent(tournamentId, userId, event_type, event_data = {}) {
    try {
        // Проверяем, существует ли таблица tournament_logs
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tournament_logs'
            );
        `);

        if (!tableExists.rows[0].exists) {
            console.warn('⚠️ Таблица tournament_logs не существует, пропускаем логирование');
            return;
        }

        await pool.query(
            `INSERT INTO tournament_logs (tournament_id, user_id, event_type, event_data, created_at) 
             VALUES ($1, $2, $3, $4, NOW())`,
            [tournamentId, userId, event_type, JSON.stringify(event_data)]
        );

        console.log(`📝 Событие турнира зарегистрировано: ${event_type} для турнира ${tournamentId} пользователем ${userId}`);
    } catch (error) {
        // Логирование не должно прерывать основной процесс
        console.warn('⚠️ Ошибка логирования события турнира:', error.message);
    }
}

/**
 * Получение логов турнира
 * @param {number} tournamentId - ID турнира
 * @param {object} options - Опции запроса
 */
async function getTournamentLogs(tournamentId, options = {}) {
    try {
        const { limit = 50, offset = 0 } = options;
        
        const result = await pool.query(`
            SELECT 
                tl.id,
                tl.tournament_id,
                tl.user_id,
                tl.event_type,
                tl.event_data,
                tl.created_at,
                u.username
            FROM tournament_logs tl
            LEFT JOIN users u ON tl.user_id = u.id
            WHERE tl.tournament_id = $1
            ORDER BY tl.created_at DESC
            LIMIT $2 OFFSET $3
        `, [tournamentId, limit, offset]);

        return result.rows.map(log => ({
            ...log,
            event_data: typeof log.event_data === 'string' ? JSON.parse(log.event_data) : log.event_data
        }));
    } catch (error) {
        console.error('❌ Ошибка получения логов турнира:', error);
        return [];
    }
}

/**
 * Очистка старых логов (опционально, для оптимизации)
 * @param {number} daysToKeep - Количество дней для хранения логов
 */
async function cleanupOldLogs(daysToKeep = 90) {
    try {
        const result = await pool.query(
            `DELETE FROM tournament_logs 
             WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`
        );

        console.log(`🧹 Очищено ${result.rowCount} старых записей логов турниров`);
        return result.rowCount;
    } catch (error) {
        console.error('❌ Ошибка очистки старых логов:', error);
        return 0;
    }
}

module.exports = {
    logTournamentEvent,
    getTournamentLogs,
    cleanupOldLogs
}; 