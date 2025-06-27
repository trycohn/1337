const pool = require('../db');

// ID системного пользователя 1337community
const SYSTEM_USER_ID = 1; // Предполагаем, что это первый пользователь в системе

/**
 * Создает или находит системного пользователя 1337community
 */
async function ensureSystemUser() {
    try {
        // Проверяем, существует ли системный пользователь
        const userCheck = await pool.query('SELECT id, avatar_url FROM users WHERE username = $1', ['1337community']);
        
        if (userCheck.rows.length === 0) {
            // Определяем URL аватара для системного пользователя
            const avatarUrl = process.env.NODE_ENV === 'production'
                ? 'https://1337community.com/uploads/avatars/1337-logo-chat.png'
                : 'http://localhost:3000/uploads/avatars/1337-logo-chat.png';
            
            // Создаем системного пользователя с аватаром
            const result = await pool.query(
                'INSERT INTO users (username, email, password_hash, is_verified, avatar_url, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
                ['1337community', 'system@1337community.com', 'system_user_no_login', true, avatarUrl]
            );
            console.log(`✅ Создан системный пользователь 1337community с аватаром: ${avatarUrl}`);
            return result.rows[0].id;
        } else {
            // Проверяем, установлен ли аватар у существующего пользователя
            const existingUser = userCheck.rows[0];
            if (!existingUser.avatar_url || !existingUser.avatar_url.includes('1337-logo-chat.png')) {
                // Обновляем аватар существующего системного пользователя
                const avatarUrl = process.env.NODE_ENV === 'production'
                    ? 'https://1337community.com/uploads/avatars/1337-logo-chat.png'
                    : 'http://localhost:3000/uploads/avatars/1337-logo-chat.png';
                
                await pool.query(
                    'UPDATE users SET avatar_url = $1 WHERE username = $2',
                    [avatarUrl, '1337community']
                );
                console.log(`✅ Обновлен аватар системного пользователя 1337community: ${avatarUrl}`);
            }
            return existingUser.id;
        }
    } catch (error) {
        console.error('Ошибка создания системного пользователя:', error);
        return SYSTEM_USER_ID; // Возвращаем дефолтный ID
    }
}

/**
 * Создает или находит чат между системным пользователем и получателем
 */
async function getOrCreateSystemChat(recipientId) {
    try {
        const systemUserId = await ensureSystemUser();
        
        // Ищем существующий индивидуальный чат
        const chatCheck = await pool.query(`
            SELECT c.id 
            FROM chats c
            JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = $1
            JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = $2
            WHERE c.type = 'private'
        `, [systemUserId, recipientId]);
        
        if (chatCheck.rows.length > 0) {
            return chatCheck.rows[0].id;
        }
        
        // Создаем новый индивидуальный чат
        const chatResult = await pool.query(
            'INSERT INTO chats (name, type, created_by, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
            [`Системные уведомления`, 'private', systemUserId]
        );
        
        const chatId = chatResult.rows[0].id;
        
        // Добавляем участников
        await pool.query(
            'INSERT INTO chat_participants (chat_id, user_id, joined_at) VALUES ($1, $2, NOW()), ($1, $3, NOW())',
            [chatId, systemUserId, recipientId]
        );
        
        return chatId;
    } catch (error) {
        console.error('Ошибка создания системного чата:', error);
        throw error;
    }
}

/**
 * Отправляет системное уведомление в чат
 */
async function sendSystemNotification(recipientId, message, type = 'system', metadata = null) {
    try {
        const systemUserId = await ensureSystemUser();
        const chatId = await getOrCreateSystemChat(recipientId);
        
        // Отправляем сообщение с метаданными
        const messageResult = await pool.query(
            'INSERT INTO messages (chat_id, sender_id, content, message_type, metadata, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
            [chatId, systemUserId, message, type, metadata ? JSON.stringify(metadata) : null]
        );
        
        // Помечаем сообщение как непрочитанное для получателя
        await pool.query(
            'INSERT INTO message_status (message_id, user_id, is_read, read_at) VALUES ($1, $2, $3, NULL)',
            [messageResult.rows[0].id, recipientId, false]
        );
        
        console.log(`Системное уведомление отправлено пользователю ${recipientId}: ${message}`);
        if (metadata) {
            console.log(`Метаданные сообщения:`, metadata);
        }
        
        return messageResult.rows[0];
    } catch (error) {
        console.error('Ошибка отправки системного уведомления:', error);
        throw error;
    }
}

/**
 * Отправляет уведомление о приглашении в турнир
 */
async function sendTournamentInviteNotification(recipientId, tournamentName, inviterUsername, tournamentId) {
    const tournamentUrl = process.env.NODE_ENV === 'production'
        ? `https://1337community.com/tournaments/${tournamentId}`
        : `http://localhost:3000/tournaments/${tournamentId}`;
        
    const message = `🏆 Вы приглашены в турнир **[${tournamentName}](${tournamentUrl})** пользователем ${inviterUsername}.\n\nПерейдите в турнир для принятия приглашения.`;
    
    const metadata = {
        type: 'tournament_invitation',
        tournament_id: tournamentId,
        tournament_name: tournamentName,
        inviter_username: inviterUsername,
        actions: [
            {
                type: 'view_tournament',
                label: '🏆 Перейти к турниру',
                action: 'open_tournament',
                style: 'primary',
                url: tournamentUrl,
                target: '_blank'
            }
        ]
    };
    
    return await sendSystemNotification(recipientId, message, 'tournament_invite', metadata);
}

/**
 * Отправляет уведомление о принятии приглашения в турнир
 */
async function sendTournamentInviteAcceptedNotification(recipientId, username, tournamentName) {
    const message = `✅ Пользователь ${username} принял приглашение в турнир "${tournamentName}".`;
    return await sendSystemNotification(recipientId, message, 'tournament_accepted');
}

/**
 * Отправляет уведомление об отклонении приглашения в турнир
 */
async function sendTournamentInviteRejectedNotification(recipientId, username, tournamentName) {
    const message = `❌ Пользователь ${username} отклонил приглашение в турнир "${tournamentName}".`;
    return await sendSystemNotification(recipientId, message, 'tournament_rejected');
}

/**
 * Отправляет уведомление о заявке в друзья
 */
async function sendFriendRequestNotification(recipientId, senderUsername) {
    const message = `👥 Пользователь ${senderUsername} отправил вам заявку в друзья.\n\nПерейдите в раздел "Друзья" для принятия заявки.`;
    return await sendSystemNotification(recipientId, message, 'friend_request');
}

/**
 * Отправляет уведомление о принятии заявки в друзья
 */
async function sendFriendRequestAcceptedNotification(recipientId, username) {
    const message = `✅ Пользователь ${username} принял вашу заявку в друзья.`;
    return await sendSystemNotification(recipientId, message, 'friend_accepted');
}

/**
 * Отправляет уведомление о запросе на администрирование турнира
 */
async function sendAdminRequestNotification(recipientId, requesterUsername, tournamentName, tournamentId) {
    const message = `🛡️ Пользователь ${requesterUsername} запросил права администратора для турнира "${tournamentName}".\n\nПерейдите в турнир для рассмотрения запроса: /tournaments/${tournamentId}`;
    return await sendSystemNotification(recipientId, message, 'admin_request');
}

/**
 * Отправляет уведомление о принятии запроса на администрирование
 */
async function sendAdminRequestAcceptedNotification(recipientId, tournamentName) {
    const message = `✅ Ваш запрос на администрирование турнира "${tournamentName}" принят.`;
    return await sendSystemNotification(recipientId, message, 'admin_accepted');
}

/**
 * Отправляет уведомление об отклонении запроса на администрирование
 */
async function sendAdminRequestRejectedNotification(recipientId, tournamentName) {
    const message = `❌ Ваш запрос на администрирование турнира "${tournamentName}" отклонён.`;
    return await sendSystemNotification(recipientId, message, 'admin_rejected');
}

/**
 * Отправляет приглашение стать администратором турнира с интерактивными кнопками
 */
async function sendAdminInviteNotification(recipientId, tournamentName, inviterUsername, tournamentId, invitationId) {
    // Формируем URL турнира
    const tournamentUrl = process.env.NODE_ENV === 'production'
        ? `https://1337community.com/tournaments/${tournamentId}`
        : `http://localhost:3000/tournaments/${tournamentId}`;
    
    // Создаем расширенное сообщение с интерактивными элементами
    const message = `🛡️ Вас пригласили стать администратором турнира!

🏆 **Турнир:** [${tournamentName}](${tournamentUrl})
👤 **Пригласил:** ${inviterUsername}

💼 **Как администратор вы сможете:**
• Управлять матчами и результатами
• Добавлять и удалять участников  
• Модерировать чат турнира
• Приглашать других администраторов

⏰ **Срок действия:** 7 дней

🎯 **Действия:**`;

    // Метаданные для интерактивных кнопок
    const messageMetadata = {
        type: 'admin_invitation',
        tournament_id: tournamentId,
        invitation_id: invitationId,
        inviter_username: inviterUsername,
        actions: [
            {
                type: 'accept',
                label: '✅ Принять',
                action: 'accept_admin_invitation',
                style: 'success',
                endpoint: `/api/tournaments/admin-invitations/${invitationId}/accept`
            },
            {
                type: 'decline', 
                label: '❌ Отклонить',
                action: 'decline_admin_invitation',
                style: 'danger',
                endpoint: `/api/tournaments/admin-invitations/${invitationId}/decline`
            },
            {
                type: 'view_tournament',
                label: '👁️ Просмотр турнира',
                action: 'open_tournament',
                style: 'info',
                url: tournamentUrl,
                target: '_blank'
            }
        ],
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 дней
    };

    return await sendSystemNotification(recipientId, message, 'admin_invitation_interactive', messageMetadata);
}

/**
 * Отправляет уведомление о принятии приглашения администратора
 */
async function sendAdminInviteAcceptedNotification(recipientId, username, tournamentName) {
    const message = `✅ Пользователь ${username} принял приглашение стать администратором турнира "${tournamentName}".`;
    
    const metadata = {
        type: 'admin_invite_accepted',
        admin_username: username,
        tournament_name: tournamentName
    };
    
    return await sendSystemNotification(recipientId, message, 'tournament_accepted', metadata);
}

/**
 * Отправляет уведомление об отклонении приглашения администратора
 */
async function sendAdminInviteRejectedNotification(recipientId, username, tournamentName) {
    const message = `❌ Пользователь ${username} отклонил приглашение стать администратором турнира "${tournamentName}".`;
    
    const metadata = {
        type: 'admin_invite_rejected',
        declined_username: username,
        tournament_name: tournamentName
    };
    
    return await sendSystemNotification(recipientId, message, 'tournament_rejected', metadata);
}

module.exports = {
    sendSystemNotification,
    sendTournamentInviteNotification,
    sendTournamentInviteAcceptedNotification,
    sendTournamentInviteRejectedNotification,
    sendFriendRequestNotification,
    sendFriendRequestAcceptedNotification,
    sendAdminRequestNotification,
    sendAdminRequestAcceptedNotification,
    sendAdminRequestRejectedNotification,
    sendAdminInviteNotification,
    sendAdminInviteAcceptedNotification,
    sendAdminInviteRejectedNotification,
    ensureSystemUser,
    getOrCreateSystemChat
}; 