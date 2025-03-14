const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendNotification } = require('../notifications');

// Получение уведомлений пользователя
router.get('/', async (req, res) => {
    const userId = req.query.userId;
    try {
        // Отмечаем все уведомления как прочитанные, кроме admin_request
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1 AND type != $2 AND is_read = false',
            [userId, 'admin_request']
        );

        // Получаем все уведомления пользователя
        const result = await pool.query(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения уведомлений:', err);
        res.status(500).json({ error: err.message });
    }   
});

// Создание уведомления
router.post('/', async (req, res) => {
  const { user_id, message, type } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3) RETURNING *',
      [user_id, message, type]
    );
    const notification = result.rows[0];
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
    try {
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1 AND type != $2 AND is_read = false',
            [userId, 'admin_request']
        );
        res.status(200).json({ message: 'Уведомления отмечены как прочитанные' });
    } catch (err) {
        console.error('Ошибка отметки уведомлений:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;