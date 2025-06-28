const pool = require('../../db');

/**
 * Отправка системного сообщения в чат турнира
 * @param {number} tournamentId - ID турнира
 * @param {string} message - Текст сообщения
 * @param {string} messageType - Тип сообщения ('announcement', 'system', 'warning')
 */
async function sendTournamentChatAnnouncement(tournamentId, message, messageType = 'announcement') {
    try {
        // Проверяем, существует ли таблица tournament_messages
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tournament_messages'
            );
        `);

        if (!tableExists.rows[0].exists) {
            console.warn('⚠️ Таблица tournament_messages не существует, пропускаем отправку сообщения');
            return null;
        }

        // Получаем ID системного пользователя (если существует)
        let systemUserId = null;
        try {
            const systemUserResult = await pool.query(
                "SELECT id FROM users WHERE username = 'system' OR username = '1337' LIMIT 1"
            );
            if (systemUserResult.rows.length > 0) {
                systemUserId = systemUserResult.rows[0].id;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось найти системного пользователя:', error.message);
        }

        // Отправляем сообщение
        const result = await pool.query(
            `INSERT INTO tournament_messages (tournament_id, sender_id, message, message_type, created_at) 
             VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
            [tournamentId, systemUserId, message, messageType]
        );

        console.log(`💬 Системное сообщение отправлено в чат турнира ${tournamentId}: ${message}`);
        return result.rows[0];

    } catch (error) {
        // Отправка сообщений не должна прерывать основной процесс
        console.warn('⚠️ Ошибка отправки системного сообщения в чат турнира:', error.message);
        return null;
    }
}

/**
 * Получение участников чата турнира
 * @param {number} tournamentId - ID турнира
 * @param {number} requestingUserId - ID пользователя, запрашивающего список
 */
async function getTournamentChatParticipants(tournamentId, requestingUserId) {
    try {
        // Проверяем, участвует ли пользователь в турнире
        const isParticipant = await checkTournamentParticipation(tournamentId, requestingUserId);
        
        if (!isParticipant) {
            throw new Error('Доступ к чату только для участников турнира');
        }

        // Получаем всех участников турнира
        const result = await pool.query(`
            SELECT DISTINCT
                u.id,
                u.username,
                u.avatar_url,
                tp.name as participant_name,
                CASE 
                    WHEN t.created_by = u.id THEN 'creator'
                    WHEN ta.user_id IS NOT NULL THEN 'admin'
                    ELSE 'participant'
                END as role
            FROM tournament_participants tp
            LEFT JOIN users u ON tp.user_id = u.id
            LEFT JOIN tournaments t ON tp.tournament_id = t.id
            LEFT JOIN tournament_admins ta ON ta.tournament_id = tp.tournament_id AND ta.user_id = u.id
            WHERE tp.tournament_id = $1
            ORDER BY 
                CASE 
                    WHEN t.created_by = u.id THEN 1
                    WHEN ta.user_id IS NOT NULL THEN 2
                    ELSE 3
                END,
                u.username
        `, [tournamentId]);

        return result.rows;

    } catch (error) {
        console.error('❌ Ошибка получения участников чата турнира:', error);
        throw error;
    }
}

/**
 * Получение сообщений чата турнира
 * @param {number} tournamentId - ID турнира
 * @param {number} requestingUserId - ID пользователя, запрашивающего сообщения
 * @param {object} options - Опции запроса
 */
async function getTournamentChatMessages(tournamentId, requestingUserId, options = {}) {
    try {
        // Проверяем, участвует ли пользователь в турнире
        const isParticipant = await checkTournamentParticipation(tournamentId, requestingUserId);
        
        if (!isParticipant) {
            throw new Error('Доступ к чату только для участников турнира');
        }

        const { limit = 50, offset = 0 } = options;

        const result = await pool.query(`
            SELECT 
                tm.id,
                tm.tournament_id,
                tm.sender_id,
                tm.message,
                tm.message_type,
                tm.created_at,
                u.username,
                u.avatar_url,
                tp.name as participant_name
            FROM tournament_messages tm
            LEFT JOIN users u ON tm.sender_id = u.id
            LEFT JOIN tournament_participants tp ON tp.tournament_id = tm.tournament_id AND tp.user_id = tm.sender_id
            WHERE tm.tournament_id = $1
            ORDER BY tm.created_at DESC
            LIMIT $2 OFFSET $3
        `, [tournamentId, limit, offset]);

        return result.rows.reverse(); // Возвращаем в хронологическом порядке

    } catch (error) {
        console.error('❌ Ошибка получения сообщений чата турнира:', error);
        throw error;
    }
}

/**
 * Проверка участия пользователя в турнире
 * @param {number} tournamentId - ID турнира
 * @param {number} userId - ID пользователя
 */
async function checkTournamentParticipation(tournamentId, userId) {
    try {
        // Проверяем, является ли пользователь создателем турнира
        const creatorResult = await pool.query(
            'SELECT id FROM tournaments WHERE id = $1 AND created_by = $2',
            [tournamentId, userId]
        );

        if (creatorResult.rows.length > 0) {
            return true;
        }

        // Проверяем, является ли пользователь администратором турнира
        const adminResult = await pool.query(
            'SELECT id FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [tournamentId, userId]
        );

        if (adminResult.rows.length > 0) {
            return true;
        }

        // Проверяем, является ли пользователь участником турнира
        const participantResult = await pool.query(
            'SELECT id FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
            [tournamentId, userId]
        );

        return participantResult.rows.length > 0;

    } catch (error) {
        console.error('❌ Ошибка проверки участия в турнире:', error);
        return false;
    }
}

/**
 * Отправка уведомления о важных событиях турнира
 * @param {number} tournamentId - ID турнира
 * @param {string} eventType - Тип события
 * @param {object} eventData - Данные события
 */
async function sendTournamentEventNotification(tournamentId, eventType, eventData = {}) {
    try {
        const messages = {
            'tournament_started': `🚀 Турнир "${eventData.tournamentName}" начался!`,
            'bracket_generated': `🥊 Турнирная сетка сгенерирована! Проверьте своих соперников.`,
            'match_result_updated': `⚽ Результат матча обновлен: ${eventData.team1} vs ${eventData.team2}`,
            'participant_joined': `👋 К турниру присоединился новый участник: ${eventData.participantName}`,
            'participant_left': `👋 Участник покинул турнир: ${eventData.participantName}`,
            'admin_assigned': `🛡️ Новый администратор назначен: ${eventData.adminName}`,
            'tournament_completed': `🏆 Турнир завершен! Поздравляем победителей!`
        };

        const message = messages[eventType] || `📢 Событие в турнире: ${eventType}`;

        return await sendTournamentChatAnnouncement(tournamentId, message, 'system');

    } catch (error) {
        console.warn('⚠️ Ошибка отправки уведомления о событии турнира:', error.message);
        return null;
    }
}

module.exports = {
    sendTournamentChatAnnouncement,
    getTournamentChatParticipants,
    getTournamentChatMessages,
    checkTournamentParticipation,
    sendTournamentEventNotification
}; 