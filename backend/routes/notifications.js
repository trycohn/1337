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

// Добавляем маршрут для ответа на уведомления через системный чат
router.post('/respond', async (req, res) => {
    const { action, notificationId } = req.body;
    const notificationId2 = req.query.notificationId || notificationId;
    
    if (!notificationId2 || !action) {
        return res.status(400).json({ error: 'Не указаны необходимые параметры' });
    }
    
    try {
        // Получаем информацию о уведомлении
        const notificationResult = await pool.query(
            'SELECT * FROM notifications WHERE id = $1',
            [notificationId2]
        );
        
        if (notificationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Уведомление не найдено' });
        }
        
        const notification = notificationResult.rows[0];
        
        // Отмечаем уведомление как прочитанное
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE id = $1',
            [notificationId2]
        );
        
        // В зависимости от типа уведомления выполняем соответствующие действия
        let result = { success: true, message: 'Уведомление обработано' };
        
        // Пример обработки для friend_request
        if (notification.type === 'friend_request' && notification.requester_id) {
            // Находим соответствующую заявку в друзья
            const friendRequestResult = await pool.query(
                'SELECT id FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = $3',
                [notification.requester_id, notification.user_id, 'pending']
            );
            
            if (friendRequestResult.rows.length > 0) {
                const friendRequestId = friendRequestResult.rows[0].id;
                
                if (action === 'accept') {
                    // Принимаем заявку
                    await pool.query(
                        'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        ['accepted', friendRequestId]
                    );
                    
                    // Отправляем уведомление о принятии заявки
                    if (notification.requester_id !== notification.user_id) {
                        const acceptMessage = `Пользователь принял вашу заявку в друзья`;
                        const acceptNotifResult = await pool.query(
                            'INSERT INTO notifications (user_id, message, type, requester_id, is_read) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                            [notification.requester_id, acceptMessage, 'friend_request_accepted', notification.user_id, false]
                        );
                        
                        sendNotification(notification.requester_id, acceptNotifResult.rows[0]);
                    }
                    
                    result.message = 'Заявка в друзья принята';
                } else if (action === 'reject') {
                    // Отклоняем заявку
                    await pool.query(
                        'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        ['rejected', friendRequestId]
                    );
                    
                    result.message = 'Заявка в друзья отклонена';
                }
            } else {
                result = { success: false, message: 'Заявка в друзья не найдена или уже обработана' };
            }
        }
        // Другие типы уведомлений можно обработать аналогично
        
        res.status(200).json(result);
    } catch (err) {
        console.error('Ошибка обработки ответа на уведомление:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;