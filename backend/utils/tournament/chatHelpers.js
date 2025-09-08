const pool = require('../../db');

/**
 * Отправка системного сообщения в чат турнира
 * @param {number} tournamentId - ID турнира
 * @param {string} message - Текст сообщения
 * @param {string} messageType - Тип сообщения ('announcement', 'system', 'warning')
 * @param {number} senderId - ID отправителя (опционально, по умолчанию создатель турнира)
 */
async function sendTournamentChatAnnouncement(tournamentId, message, messageType = 'announcement', senderId = null) {
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

        // Если senderId не указан, используем создателя турнира
        let finalSenderId = senderId;
        if (!finalSenderId) {
            const tournamentQuery = await pool.query(
                'SELECT created_by FROM tournaments WHERE id = $1',
                [tournamentId]
            );
            
            if (tournamentQuery.rows.length > 0) {
                finalSenderId = tournamentQuery.rows[0].created_by;
            } else {
                console.error('⚠️ Турнир не найден для отправки сообщения:', tournamentId);
                return null;
            }
        }

        console.log(`📨 Отправляем системное сообщение в турнир ${tournamentId} от пользователя ${finalSenderId}: "${message}"`);

        // Отправляем сообщение
        const result = await pool.query(
            `INSERT INTO tournament_messages (tournament_id, sender_id, content, created_at) 
             VALUES ($1, $2, $3, NOW()) RETURNING *`,
            [tournamentId, finalSenderId, message]
        );

        if (result.rows.length > 0) {
            const newMessage = result.rows[0];
            console.log(`✅ Системное сообщение отправлено в турнир ${tournamentId}:`, newMessage.content);
            
            return newMessage;
        }

        return null;

    } catch (error) {
        console.error('⚠️ Ошибка отправки системного сообщения в чат турнира:', error.message);
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
 * @param {number} limit - Лимит сообщений
 * @param {number} offset - Смещение
 */
async function getTournamentChatMessages(tournamentId, limit = 50, offset = 0) {
    try {
        const result = await pool.query(`
            SELECT 
                tm.id,
                tm.tournament_id,
                tm.sender_id,
                tm.content,
                tm.created_at,
                u.username as sender_username,
                u.avatar_url as sender_avatar
            FROM tournament_messages tm
            LEFT JOIN users u ON tm.sender_id = u.id
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
            'tournament_started': `Турнир "${eventData.tournamentName}" начался!`,
            'bracket_generated': `Турнирная сетка сгенерирована! Проверьте своих соперников.`,
            'match_result_updated': `Результат матча обновлен: ${eventData.team1} vs ${eventData.team2}`,
            'participant_joined': `К турниру присоединился новый участник: ${eventData.participantName}`,
            'participant_left': `Участник покинул турнир: ${eventData.participantName}`,
            'admin_assigned': `Новый администратор назначен: ${eventData.adminName}`,
            'tournament_completed': `Турнир завершен! Поздравляем победителей!`
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