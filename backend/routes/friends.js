const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../notifications');
const { 
    sendFriendRequestNotification,
    sendFriendRequestAcceptedNotification
} = require('../utils/systemNotifications');

// Получение списка друзей пользователя
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Получаем список друзей, включая и ожидающие подтверждения заявки
        const result = await pool.query(`
            SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
                  u.username, u.avatar_url, u.steam_id, u.faceit_id, u.steam_url, u.cs2_premier_rank
            FROM friends f
            JOIN users u ON (
                CASE
                    WHEN f.user_id = $1 THEN f.friend_id
                    WHEN f.friend_id = $1 THEN f.user_id
                END
            ) = u.id
            WHERE (f.user_id = $1 OR f.friend_id = $1)
              AND (f.status = 'accepted' OR (f.status = 'pending' AND f.user_id = $1))
            ORDER BY f.updated_at DESC
        `, [req.user.id]);

        // Форматируем ответ
        const friends = result.rows.map(row => {
            return {
                id: row.id,
                userId: row.user_id,
                friendId: row.friend_id,
                status: row.status,
                isSentByMe: row.user_id === req.user.id,
                friend: {
                    id: row.user_id === req.user.id ? row.friend_id : row.user_id,
                    username: row.username,
                    avatar_url: row.avatar_url,
                    steam_id: row.steam_id,
                    faceit_id: row.faceit_id,
                    steam_url: row.steam_url,
                    cs2_premier_rank: row.cs2_premier_rank
                },
                created_at: row.created_at,
                updated_at: row.updated_at
            };
        });

        res.json(friends);
    } catch (err) {
        console.error('Ошибка получения списка друзей:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении списка друзей' });
    }
});

// Отправка заявки в друзья
router.post('/request', authenticateToken, async (req, res) => {
    const { friendId } = req.body;
    
    if (!friendId) {
        return res.status(400).json({ error: 'Не указан ID пользователя для добавления в друзья' });
    }
    
    if (friendId == req.user.id) {
        return res.status(400).json({ error: 'Нельзя добавить себя в друзья' });
    }
    
    try {
        // Проверяем существование пользователя
        const userCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [friendId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Проверяем, не существует ли уже заявка в друзья
        const existingRequest = await pool.query(
            'SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [req.user.id, friendId]
        );
        
        if (existingRequest.rows.length > 0) {
            const friendship = existingRequest.rows[0];
            
            // Если заявка уже принята
            if (friendship.status === 'accepted') {
                return res.status(400).json({ error: 'Этот пользователь уже у вас в друзьях' });
            }
            
            // Если заявка отправлена другим пользователем и ожидает подтверждения
            if (friendship.status === 'pending' && friendship.user_id == friendId) {
                // Принимаем встречную заявку
                await pool.query(
                    'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    ['accepted', friendship.id]
                );
                
                // Отправляем системное уведомление о принятии заявки
                await sendFriendRequestAcceptedNotification(friendId, req.user.username);
                
                return res.json({ message: 'Заявка в друзья принята' });
            }
            
            // Если заявка уже отправлена текущим пользователем
            if (friendship.status === 'pending' && friendship.user_id == req.user.id) {
                return res.status(400).json({ error: 'Вы уже отправили заявку в друзья этому пользователю' });
            }
            
            // Если заявка была отклонена ранее, обновляем её
            if (friendship.status === 'rejected') {
                await pool.query(
                    'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP, user_id = $2, friend_id = $3 WHERE id = $4',
                    ['pending', req.user.id, friendId, friendship.id]
                );
            }
        } else {
            // Создаем новую заявку в друзья
            await pool.query(
                'INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, $3)',
                [req.user.id, friendId, 'pending']
            );
        }
        
        // Отправляем системное уведомление о заявке в друзья
        await sendFriendRequestNotification(friendId, req.user.username);
        
        res.json({ message: 'Заявка в друзья отправлена' });
    } catch (err) {
        console.error('Ошибка отправки заявки в друзья:', err);
        res.status(500).json({ error: 'Ошибка сервера при отправке заявки в друзья' });
    }
});

// Принятие заявки в друзья
router.post('/accept', authenticateToken, async (req, res) => {
    const { requestId } = req.body;
    
    if (!requestId) {
        return res.status(400).json({ error: 'Не указан ID заявки' });
    }
    
    try {
        // Проверяем существование заявки и что она адресована текущему пользователю
        const requestCheck = await pool.query(
            'SELECT f.*, u.username FROM friends f JOIN users u ON f.user_id = u.id WHERE f.id = $1 AND f.friend_id = $2 AND f.status = $3',
            [requestId, req.user.id, 'pending']
        );
        
        if (requestCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
        }
        
        // Принимаем заявку
        await pool.query(
            'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['accepted', requestId]
        );
        
        const friendRequest = requestCheck.rows[0];
        
        // Отправляем системное уведомление отправителю заявки
        await sendFriendRequestAcceptedNotification(friendRequest.user_id, req.user.username);
        
        res.json({ message: 'Заявка в друзья принята' });
    } catch (err) {
        console.error('Ошибка принятия заявки в друзья:', err);
        res.status(500).json({ error: 'Ошибка сервера при принятии заявки в друзья' });
    }
});

// Отклонение заявки в друзья
router.post('/reject', authenticateToken, async (req, res) => {
    const { requestId } = req.body;
    
    if (!requestId) {
        return res.status(400).json({ error: 'Не указан ID заявки' });
    }
    
    try {
        // Проверяем существование заявки и что она адресована текущему пользователю
        const requestCheck = await pool.query(
            'SELECT * FROM friends WHERE id = $1 AND friend_id = $2 AND status = $3',
            [requestId, req.user.id, 'pending']
        );
        
        if (requestCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
        }
        
        // Отклоняем заявку
        await pool.query(
            'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['rejected', requestId]
        );
        
        res.json({ message: 'Заявка в друзья отклонена' });
    } catch (err) {
        console.error('Ошибка отклонения заявки в друзья:', err);
        res.status(500).json({ error: 'Ошибка сервера при отклонении заявки в друзья' });
    }
});

// Удаление из друзей
router.delete('/:friendId', authenticateToken, async (req, res) => {
    const { friendId } = req.params;
    
    if (!friendId) {
        return res.status(400).json({ error: 'Не указан ID друга' });
    }
    
    try {
        // Проверяем существование дружбы
        const friendshipCheck = await pool.query(
            'SELECT * FROM friends WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = $3',
            [req.user.id, friendId, 'accepted']
        );
        
        if (friendshipCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден в списке друзей' });
        }
        
        // Удаляем дружбу
        await pool.query(
            'DELETE FROM friends WHERE id = $1',
            [friendshipCheck.rows[0].id]
        );
        
        res.json({ message: 'Пользователь удален из друзей' });
    } catch (err) {
        console.error('Ошибка удаления из друзей:', err);
        res.status(500).json({ error: 'Ошибка сервера при удалении из друзей' });
    }
});

// Получение списка входящих заявок в друзья
router.get('/requests/incoming', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
                  u.username, u.avatar_url, u.steam_id, u.faceit_id, u.steam_url, u.cs2_premier_rank
            FROM friends f
            JOIN users u ON f.user_id = u.id
            WHERE f.friend_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `, [req.user.id]);

        const requests = result.rows.map(row => {
            return {
                id: row.id,
                userId: row.user_id,
                friendId: row.friend_id,
                status: row.status,
                user: {
                    id: row.user_id,
                    username: row.username,
                    avatar_url: row.avatar_url,
                    steam_id: row.steam_id,
                    faceit_id: row.faceit_id,
                    steam_url: row.steam_url,
                    cs2_premier_rank: row.cs2_premier_rank
                },
                created_at: row.created_at
            };
        });

        res.json(requests);
    } catch (err) {
        console.error('Ошибка получения входящих заявок в друзья:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении входящих заявок в друзья' });
    }
});

// Получение списка исходящих заявок в друзья
router.get('/requests/outgoing', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
                  u.username, u.avatar_url, u.steam_id, u.faceit_id, u.steam_url, u.cs2_premier_rank
            FROM friends f
            JOIN users u ON f.friend_id = u.id
            WHERE f.user_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `, [req.user.id]);

        const requests = result.rows.map(row => {
            return {
                id: row.id,
                userId: row.user_id,
                friendId: row.friend_id,
                status: row.status,
                user: {
                    id: row.friend_id,
                    username: row.username,
                    avatar_url: row.avatar_url,
                    steam_id: row.steam_id,
                    faceit_id: row.faceit_id,
                    steam_url: row.steam_url,
                    cs2_premier_rank: row.cs2_premier_rank
                },
                created_at: row.created_at
            };
        });

        res.json(requests);
    } catch (err) {
        console.error('Ошибка получения исходящих заявок в друзья:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении исходящих заявок в друзья' });
    }
});

// Добавляю маршрут отмены исходящих заявок в друзья
router.delete('/requests/outgoing/:requestId', authenticateToken, async (req, res) => {
    const { requestId } = req.params;
    if (!requestId) {
        return res.status(400).json({ error: 'Не указан ID заявки' });
    }
    try {
        const checkResult = await pool.query(
            'SELECT * FROM friends WHERE id = $1 AND user_id = $2 AND status = $3',
            [requestId, req.user.id, 'pending']
        );
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
        }
        await pool.query('DELETE FROM friends WHERE id = $1', [requestId]);
        res.json({ message: 'Заявка на дружбу отменена' });
    } catch (err) {
        console.error('Ошибка отмены исходящей заявки в друзья:', err);
        res.status(500).json({ error: 'Ошибка сервера при отмене заявки' });
    }
});

// Получение статуса дружбы с конкретным пользователем
router.get('/status/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [req.user.id, userId]
        );
        
        if (result.rows.length === 0) {
            return res.json({ status: 'none' });
        }
        
        const friendship = result.rows[0];
        
        // Определяем направление заявки (если статус pending)
        let status = friendship.status;
        let direction = null;
        
        if (status === 'pending') {
            direction = friendship.user_id == req.user.id ? 'outgoing' : 'incoming';
        }
        
        res.json({
            id: friendship.id,
            status: status,
            direction: direction,
            created_at: friendship.created_at,
            updated_at: friendship.updated_at
        });
    } catch (err) {
        console.error('Ошибка получения статуса дружбы:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении статуса дружбы' });
    }
});

module.exports = router; 