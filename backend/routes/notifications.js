const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendNotification } = require('../notifications');

// Получение уведомлений пользователя
router.get('/', async (req, res) => {
    const userId = req.query.userId;
    const includeProcessed = req.query.includeProcessed === 'true';
    
    try {
        // Отмечаем все уведомления как прочитанные, кроме admin_request
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1 AND type != $2 AND is_read = false',
            [userId, 'admin_request']
        );

        // Строим запрос в зависимости от параметра includeProcessed
        let query = `SELECT n.* FROM notifications n`;
        
        if (!includeProcessed) {
            // Если не нужны обработанные admin_request, добавляем join и условие
            query += `
            LEFT JOIN admin_requests ar ON n.requester_id = ar.user_id AND n.tournament_id = ar.tournament_id
            WHERE n.user_id = $1 
            AND (n.type != 'admin_request' OR (n.type = 'admin_request' AND ar.status = 'pending'))`;
        } else {
            // Если нужны все уведомления, включая обработанные
            query += ` WHERE n.user_id = $1`;
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
      'INSERT INTO notifications (user_id, message, type, tournament_id, requester_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, message, type, tournament_id || null, requester_id || null]
    );
    const notification = result.rows[0];
    
    // Отправка уведомления через WebSocket
    sendNotification(user_id, notification);
    
    res.status(201).json(notification);
  } catch (err) {
    console.error('Ошибка создания уведомления:', err);
    res.status(500).json({ error: err.message });
  }
});

// Пометка уведомления как прочитанного
router.post('/mark-read', async (req, res) => {
    const userId = req.query.userId;
    const notificationId = req.query.notificationId;
    
    try {
        if (notificationId) {
            // Если указан конкретный ID уведомления
            await pool.query(
                'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
                [notificationId, userId]
            );
        } else {
            // Обновляем все уведомления пользователя, включая admin_request
            await pool.query(
                'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
                [userId]
            );
        }
        res.status(200).json({ message: 'Уведомления отмечены как прочитанные' });
    } catch (err) {
        console.error('Ошибка отметки уведомлений:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;