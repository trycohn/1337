const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendNotification } = require('../notifications');

// Получение уведомлений пользователя
router.get('/', async (req, res) => {
    const userId = req.query.userId;
    const includeProcessed = req.query.includeProcessed === 'true';
    
    try {
        // Строим запрос в зависимости от параметра includeProcessed
        let query = `SELECT n.*, CASE 
            WHEN n.type = 'admin_request' THEN ar.status 
            WHEN n.type = 'admin_request_accepted' THEN 'accepted'
            WHEN n.type = 'admin_request_rejected' THEN 'rejected'
            ELSE NULL END AS request_status 
        FROM notifications n`;
        
        if (!includeProcessed) {
            // Если не нужны обработанные admin_request, добавляем join и условие
            query += `
            LEFT JOIN admin_requests ar ON n.requester_id = ar.user_id AND n.tournament_id = ar.tournament_id
            WHERE n.user_id = $1 
            AND (n.type != 'admin_request' OR (n.type = 'admin_request' AND ar.status = 'pending'))`;
        } else {
            // Если нужны все уведомления, включая обработанные
            query += `
            LEFT JOIN admin_requests ar ON n.requester_id = ar.user_id AND n.tournament_id = ar.tournament_id
            WHERE n.user_id = $1`;
        }
        
        query += ` ORDER BY n.created_at DESC`;
        
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения уведомлений:', err);
        res.status(500).json({ error: err.message });
    }   
});

// Создание уведомления
router.post('/', async (req, res) => {
  const { user_id, message, type, tournament_id, requester_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO notifications (user_id, message, type, tournament_id, requester_id, is_read) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [user_id, message, type, tournament_id || null, requester_id || null, false]
    );
    const notification = result.rows[0];
    
    // Отправка уведомления через WebSocket
    sendNotification(user_id, notification);

    // Добавляем уведомление как сообщение в системный чат
    const systemChatName = '1337community';
    const chatRes = await pool.query('SELECT id FROM chats WHERE name = $1', [systemChatName]);
    if (chatRes.rows.length > 0) {
        const systemChatId = chatRes.rows[0].id;
        const msgRes = await pool.query(
            'INSERT INTO messages (chat_id, sender_id, content, message_type, content_meta) VALUES ($1, NULL, $2, $3, $4) RETURNING *',
            [systemChatId, notification.message, 'announcement', { notification_id: notification.id, type: notification.type }]
        );
        const newMsg = msgRes.rows[0];
        const io = req.app.get('io');
        io.to(`chat_${systemChatId}`).emit('message', newMsg);
    }

    res.status(201).json(notification);
  } catch (err) {
    console.error('Ошибка создания уведомления:', err);
    res.status(500).json({ error: err.message });
  }
});

// Пометка уведомления как прочитанного
router.post('/mark-read', async (req, res) => {
    const userId = req.query.userId;
    const notificationIds = req.body.notificationIds;
    const notificationId = req.query.notificationId;
    
    try {
        if (notificationIds && Array.isArray(notificationIds)) {
            // Если указаны конкретные ID уведомлений
            await pool.query(
                'UPDATE notifications SET is_read = true WHERE id = ANY($1) AND user_id = $2',
                [notificationIds, userId]
            );
        } else if (notificationId) {
            // Если указан конкретный ID уведомления
            await pool.query(
                'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
                [notificationId, userId]
            );
        } else {
            // Обновляем все уведомления пользователя, которые не требуют действий
            await pool.query(
                `UPDATE notifications 
                SET is_read = true 
                WHERE user_id = $1 
                AND is_read = false 
                AND type NOT IN ('tournament_invite', 'admin_request', 'friend_request')`,
                [userId]
            );
        }
        res.status(200).json({ message: 'Уведомления отмечены как прочитанные' });
    } catch (err) {
        console.error('Ошибка отметки уведомлений:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обработка ответа на уведомление
router.post('/respond', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const notificationId = req.query.notificationId;
    const { action } = req.body;

    if (!notificationId || !action) {
        return res.status(400).json({ error: 'Не указан ID уведомления или действие' });
    }

    try {
        // Декодируем токен для получения ID пользователя
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Получаем уведомление
        const notification = await pool.query(
            'SELECT * FROM notifications WHERE id = $1',
            [notificationId]
        );

        if (notification.rows.length === 0) {
            return res.status(404).json({ error: 'Уведомление не найдено' });
        }

        const notificationData = notification.rows[0];

        // Проверяем, что уведомление принадлежит текущему пользователю
        if (notificationData.user_id !== userId) {
            return res.status(403).json({ error: 'У вас нет прав для обработки этого уведомления' });
        }

        // Обрабатываем по типу уведомления
        switch (notificationData.type) {
            case 'admin_request':
                // Вызываем API для ответа на запрос админа
                await pool.query(
                    `UPDATE admin_requests 
                     SET status = $1
                     WHERE tournament_id = $2 AND user_id = $3`,
                    [action === 'accept' ? 'accepted' : 'rejected', notificationData.tournament_id, notificationData.requester_id]
                );

                // Отправляем уведомление запрашивающему
                await pool.query(
                    `INSERT INTO notifications (user_id, message, type, tournament_id, is_read)
                     VALUES ($1, $2, $3, $4, false)`,
                    [
                        notificationData.requester_id,
                        `Ваш запрос на администрирование турнира "${
                            (await pool.query('SELECT name FROM tournaments WHERE id = $1', [notificationData.tournament_id])).rows[0]?.name || 'Турнир'
                        }" был ${action === 'accept' ? 'принят' : 'отклонен'}`,
                        action === 'accept' ? 'admin_request_accepted' : 'admin_request_rejected',
                        notificationData.tournament_id
                    ]
                );

                // Если принято, добавляем пользователя в админы турнира
                if (action === 'accept') {
                    await pool.query(
                        `INSERT INTO tournament_admins (tournament_id, user_id) 
                         VALUES ($1, $2)
                         ON CONFLICT DO NOTHING`,
                        [notificationData.tournament_id, notificationData.requester_id]
                    );
                }
                break;

            case 'friend_request':
                try {
                    // Проверяем существование заявки и то, что она адресована текущему пользователю
                    const requestCheck = await pool.query(
                        'SELECT f.*, u.username FROM friends f JOIN users u ON f.user_id = u.id WHERE f.id = $1 AND f.friend_id = $2 AND f.status = $3',
                        [notificationData.content_meta?.request_id || 0, userId, 'pending']
                    );
                    
                    if (requestCheck.rows.length === 0) {
                        // Если ID не указан или не найден, ищем по отправителю-получателю
                        const secondCheck = await pool.query(
                            'SELECT f.*, u.username FROM friends f JOIN users u ON f.user_id = u.id WHERE f.user_id = $1 AND f.friend_id = $2 AND f.status = $3',
                            [notificationData.requester_id, userId, 'pending']
                        );
                        
                        if (secondCheck.rows.length === 0) {
                            return res.status(404).json({ error: 'Заявка в друзья не найдена или уже обработана' });
                        }
                        
                        const friendRequest = secondCheck.rows[0];
                        
                        if (action === 'accept') {
                            // Принимаем заявку через тот же механизм, что и в friends.js
                            await pool.query(
                                'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                                ['accepted', friendRequest.id]
                            );
                            
                            // Создаем уведомление для отправителя заявки
                            const acceptNotification = {
                                user_id: friendRequest.user_id,
                                message: `Пользователь ${(await pool.query('SELECT username FROM users WHERE id = $1', [userId])).rows[0]?.username || 'Пользователь'} принял вашу заявку в друзья`,
                                type: 'friend_request_accepted',
                                requester_id: userId
                            };
                            
                            const notificationResult = await pool.query(
                                'INSERT INTO notifications (user_id, message, type, requester_id, is_read) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                                [acceptNotification.user_id, acceptNotification.message, acceptNotification.type, acceptNotification.requester_id, false]
                            );
                            
                            // Отправляем уведомление через WebSocket
                            sendNotification(friendRequest.user_id, notificationResult.rows[0]);
                        } else {
                            // Отклоняем заявку
                            await pool.query(
                                'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                                ['rejected', friendRequest.id]
                            );
                        }
                    } else {
                        const friendRequest = requestCheck.rows[0];
                        
                        if (action === 'accept') {
                            // Принимаем заявку
                            await pool.query(
                                'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                                ['accepted', friendRequest.id]
                            );
                            
                            // Создаем уведомление для отправителя заявки
                            const acceptNotification = {
                                user_id: friendRequest.user_id,
                                message: `Пользователь ${(await pool.query('SELECT username FROM users WHERE id = $1', [userId])).rows[0]?.username || 'Пользователь'} принял вашу заявку в друзья`,
                                type: 'friend_request_accepted',
                                requester_id: userId
                            };
                            
                            const notificationResult = await pool.query(
                                'INSERT INTO notifications (user_id, message, type, requester_id, is_read) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                                [acceptNotification.user_id, acceptNotification.message, acceptNotification.type, acceptNotification.requester_id, false]
                            );
                            
                            // Отправляем уведомление через WebSocket
                            sendNotification(friendRequest.user_id, notificationResult.rows[0]);
                        } else {
                            // Отклоняем заявку
                            await pool.query(
                                'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                                ['rejected', friendRequest.id]
                            );
                        }
                    }
                } catch (err) {
                    console.error('Ошибка обработки заявки в друзья:', err);
                    return res.status(500).json({ error: 'Ошибка обработки заявки в друзья' });
                }
                break;

            case 'tournament_invite':
                // Обрабатываем приглашение на турнир
                if (action === 'accept') {
                    // Добавляем пользователя в участники турнира
                    await pool.query(
                        `INSERT INTO tournament_participants (tournament_id, user_id, status)
                         VALUES ($1, $2, 'confirmed')
                         ON CONFLICT (tournament_id, user_id) DO UPDATE SET status = 'confirmed'`,
                        [notificationData.tournament_id, userId]
                    );
                }
                
                // Обновляем статус приглашения
                await pool.query(
                    `UPDATE tournament_invitations 
                     SET status = $1, responded_at = NOW()
                     WHERE tournament_id = $2 AND invited_user_id = $3`,
                    [action === 'accept' ? 'accepted' : 'rejected', notificationData.tournament_id, userId]
                );
                break;

            default:
                return res.status(400).json({ error: 'Неизвестный тип уведомления' });
        }

        // Отмечаем уведомление как прочитанное
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE id = $1',
            [notificationId]
        );

        // Отправляем уведомление через Socket.IO
        const io = req.app.get('io');
        if (io) {
            // Отправляем обновление статуса уведомления
            io.to(`user_${userId}`).emit('notification_update', {
                id: notificationId,
                action,
                type: notificationData.type,
                status: 'processed'
            });
            
            // Также отправляем уведомление пользователю, создавшему запрос
            if (notificationData.requester_id) {
                io.to(`user_${notificationData.requester_id}`).emit('notification_update', {
                    type: `${notificationData.type}_${action === 'accept' ? 'accepted' : 'rejected'}`,
                    from_user_id: userId,
                    status: action === 'accept' ? 'accepted' : 'rejected'
                });
            }
        }

        res.json({ success: true, message: 'Уведомление обработано' });
    } catch (err) {
        console.error('Ошибка обработки уведомления:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;