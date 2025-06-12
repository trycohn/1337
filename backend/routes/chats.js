const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Конфигурация для загрузки файлов
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/chat');
        
        // Создаем директорию, если не существует
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        // Уникальное имя файла с сохранением расширения
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Ограничение размера файла (10 МБ)
});

// Получение списка чатов пользователя
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Создаем персональный системный чат для этого пользователя
        const systemChatName = '1337community'; // Убрали идентификатор пользователя из имени
        
        // Ищем персональный системный чат для этого пользователя
        let systemChatRes = await pool.query(`
            SELECT c.id 
            FROM chats c
            JOIN chat_participants cp ON c.id = cp.chat_id
            WHERE c.name = $1 AND cp.user_id = $2 AND c.type = 'system'
            LIMIT 1`, 
            [systemChatName, req.user.id]
        );
        
        let systemChatId;
        if (systemChatRes.rows.length === 0) {
            // Создаем новый персональный системный чат
            const createChatRes = await pool.query(
                "INSERT INTO chats (name, type) VALUES ($1, 'system') RETURNING id", 
                [systemChatName]
            );
            systemChatId = createChatRes.rows[0].id;
            
            // Добавляем пользователя как участника и закрепляем чат
            await pool.query(
                `INSERT INTO chat_participants (chat_id, user_id, is_pinned)
                 VALUES ($1, $2, true)`,
                [systemChatId, req.user.id]
            );
            
            console.log(`Создан новый системный чат ${systemChatId} для пользователя ${req.user.id}`);
        } else {
            systemChatId = systemChatRes.rows[0].id;
            
            // Обновляем закрепление чата
            await pool.query(
                `UPDATE chat_participants
                 SET is_pinned = true
                 WHERE chat_id = $1 AND user_id = $2`,
                [systemChatId, req.user.id]
            );
        }

        // Получаем список чатов с последним сообщением и информацией о собеседнике
        const result = await pool.query(`
            WITH last_messages AS (
                SELECT DISTINCT ON (chat_id) 
                    m.id,
                    m.chat_id,
                    m.sender_id,
                    m.content,
                    m.message_type,
                    m.content_meta,
                    m.created_at
                FROM messages m
                WHERE m.chat_id IN (
                    SELECT chat_id FROM chat_participants WHERE user_id = $1
                )
                ORDER BY m.chat_id, m.created_at DESC
            ),
            chat_with_participants AS (
                SELECT 
                    c.id,
                    c.name,
                    c.type,
                    c.created_at,
                    c.updated_at,
                    cp.is_pinned,
                    cp.is_muted,
                    CASE 
                        WHEN c.type = 'private' THEN (
                            SELECT json_build_object(
                                'id', u.id,
                                'username', u.username,
                                'avatar_url', u.avatar_url
                            )
                            FROM chat_participants cp2
                            JOIN users u ON cp2.user_id = u.id
                            WHERE cp2.chat_id = c.id AND cp2.user_id != $1
                            LIMIT 1
                        )
                        ELSE NULL
                    END AS interlocutor,
                    (
                        SELECT COUNT(*)
                        FROM messages m
                        LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = $1
                        WHERE m.chat_id = c.id AND (ms.is_read IS NULL OR ms.is_read = FALSE) AND m.sender_id != $1
                    ) AS unread_count,
                    CASE 
                        WHEN c.type = 'private' THEN (
                            SELECT u.id
                            FROM chat_participants cp2
                            JOIN users u ON cp2.user_id = u.id
                            WHERE cp2.chat_id = c.id AND cp2.user_id != $1
                            LIMIT 1
                        )
                        ELSE NULL
                    END AS user_id
                FROM chats c
                JOIN chat_participants cp ON c.id = cp.chat_id
                WHERE cp.user_id = $1
            )
            SELECT 
                cwp.*,
                lm.id AS last_message_id,
                lm.sender_id AS last_message_sender_id,
                lm.content AS last_message_content,
                lm.message_type AS last_message_type,
                lm.content_meta AS last_message_meta,
                lm.created_at AS last_message_created_at,
                CASE 
                    WHEN cwp.interlocutor IS NOT NULL THEN cwp.interlocutor ->> 'username'
                    ELSE cwp.name
                END AS name,
                CASE 
                    WHEN cwp.interlocutor IS NOT NULL THEN cwp.interlocutor ->> 'avatar_url'
                    WHEN cwp.type = 'system' AND cwp.name = '1337community' THEN (
                        SELECT avatar_url FROM users WHERE username = '1337community' LIMIT 1
                    )
                    ELSE NULL
                END AS avatar_url
            FROM chat_with_participants cwp
            LEFT JOIN last_messages lm ON cwp.id = lm.chat_id
            ORDER BY 
                cwp.is_pinned DESC,
                COALESCE(lm.created_at, cwp.updated_at) DESC
        `, [req.user.id]);

        // Форматируем ответ
        const chats = result.rows.map(row => {
            const lastMessage = row.last_message_id ? {
                id: row.last_message_id,
                sender_id: row.last_message_sender_id,
                content: row.last_message_content,
                message_type: row.last_message_type,
                content_meta: row.last_message_meta,
                created_at: row.last_message_created_at
            } : null;

            return {
                id: row.id,
                name: row.name,
                type: row.type,
                avatar_url: row.avatar_url,
                is_pinned: row.is_pinned,
                is_muted: row.is_muted,
                interlocutor: row.interlocutor,
                unread_count: parseInt(row.unread_count),
                last_message: lastMessage,
                created_at: row.created_at,
                updated_at: row.updated_at,
                user_id: row.user_id
            };
        });

        res.json(chats);
    } catch (err) {
        console.error('Ошибка получения списка чатов:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении списка чатов' });
    }
});

// Создание нового чата
router.post('/', authenticateToken, async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Не указан ID пользователя для создания чата' });
    }
    
    // Проверяем, существует ли уже чат между пользователями
    try {
        const existingChatCheck = await pool.query(`
            SELECT c.id
            FROM chats c
            JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = $1
            JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = $2
            WHERE c.type = 'private'
            LIMIT 1
        `, [req.user.id, userId]);
        
        if (existingChatCheck.rows.length > 0) {
            // Если чат уже существует, возвращаем его ID
            const chatId = existingChatCheck.rows[0].id;
            
            const chatInfo = await getChatInfo(chatId, req.user.id);
            return res.json(chatInfo);
        }
        
        // Проверяем существование пользователя
        const userCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Проверяем, являются ли пользователи друзьями
        const friendCheck = await pool.query(`
            SELECT *
            FROM friends
            WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
              AND status = 'accepted'
        `, [req.user.id, userId]);
        
        if (friendCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Вы не можете создать чат с пользователем, который не является вашим другом' });
        }
        
        // Начинаем транзакцию
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Создаем новый чат
            const chatResult = await client.query(`
                INSERT INTO chats (type)
                VALUES ('private')
                RETURNING *
            `);
            
            const chatId = chatResult.rows[0].id;
            
            // Добавляем участников чата
            await client.query(`
                INSERT INTO chat_participants (chat_id, user_id)
                VALUES ($1, $2), ($1, $3)
            `, [chatId, req.user.id, userId]);
            
            await client.query('COMMIT');
            
            // Получаем информацию о созданном чате
            const chatInfo = await getChatInfo(chatId, req.user.id);
            
            res.status(201).json(chatInfo);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Ошибка создания чата:', err);
        res.status(500).json({ error: 'Ошибка сервера при создании чата' });
    }
});

// Получение сообщений чата
router.get('/:chatId/messages', authenticateToken, async (req, res) => {
    const { chatId } = req.params;
    
    try {
        // Проверяем, является ли пользователь участником чата
        const participantCheck = await pool.query(`
            SELECT * FROM chat_participants 
            WHERE chat_id = $1 AND user_id = $2
        `, [chatId, req.user.id]);
        
        if (participantCheck.rows.length === 0) {
            return res.status(403).json({ error: 'У вас нет доступа к этому чату' });
        }
        
        // Получаем сообщения с информацией о статусе прочтения
        const messagesResult = await pool.query(`
            SELECT 
                m.id, 
                m.chat_id, 
                m.sender_id, 
                m.content, 
                m.message_type, 
                m.content_meta, 
                m.is_pinned, 
                m.created_at,
                u.username AS sender_username,
                u.avatar_url AS sender_avatar,
                ms.is_read,
                ms.read_at
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = $1
            WHERE m.chat_id = $2
            ORDER BY m.created_at ASC
        `, [req.user.id, chatId]);
        
        // Автоматически помечаем непрочитанные сообщения как прочитанные
        // (только для сообщений, отправленных другими пользователями)
        const unreadMessages = messagesResult.rows.filter(msg => 
            msg.sender_id !== req.user.id && (!msg.is_read || msg.is_read === false)
        );
        
        if (unreadMessages.length > 0) {
            // Обновляем каждое сообщение отдельно с использованием транзакции
            const uniqueIds = [...new Set(unreadMessages.map(m => m.id))];
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                for (const id of uniqueIds) {
                    // Пытаемся обновить существующую запись
                    const updateResult = await client.query(`
                        UPDATE message_status 
                        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
                        WHERE message_id = $1 AND user_id = $2
                        RETURNING id
                    `, [id, req.user.id]);
                    
                    // Если записи не существует, создаем новую
                    if (updateResult.rows.length === 0) {
                        await client.query(`
                            INSERT INTO message_status (message_id, user_id, is_read, read_at)
                            VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)
                        `, [id, req.user.id]);
                    }
                }
                
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Ошибка обновления статусов сообщений:', err);
            } finally {
                client.release();
            }
        }
        
        res.json(messagesResult.rows);
    } catch (err) {
        console.error('Ошибка получения сообщений:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении сообщений' });
    }
});

// Помечаем чат как прочитанный
router.post('/:chatId/read', authenticateToken, async (req, res) => {
    const { chatId } = req.params;
    
    try {
        // Проверяем, является ли пользователь участником чата
        const participantCheck = await pool.query(`
            SELECT * FROM chat_participants 
            WHERE chat_id = $1 AND user_id = $2
        `, [chatId, req.user.id]);
        
        if (participantCheck.rows.length === 0) {
            return res.status(403).json({ error: 'У вас нет доступа к этому чату' });
        }
        
        // Находим все непрочитанные сообщения в этом чате
        const unreadMessagesResult = await pool.query(`
            SELECT m.id 
            FROM messages m
            LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = $1
            WHERE m.chat_id = $2 
              AND m.sender_id != $1
              AND (ms.is_read IS NULL OR ms.is_read = FALSE)
        `, [req.user.id, chatId]);
        
        if (unreadMessagesResult.rows.length > 0) {
            const uniqueIds2 = [...new Set(unreadMessagesResult.rows.map(r => r.id))];
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                for (const id of uniqueIds2) {
                    // Пытаемся обновить существующую запись
                    const updateResult = await client.query(`
                        UPDATE message_status 
                        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
                        WHERE message_id = $1 AND user_id = $2
                        RETURNING id
                    `, [id, req.user.id]);
                    
                    // Если записи не существует, создаем новую
                    if (updateResult.rows.length === 0) {
                        await client.query(`
                            INSERT INTO message_status (message_id, user_id, is_read, read_at)
                            VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)
                        `, [id, req.user.id]);
                    }
                }
                
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Ошибка обновления статусов сообщений:', err);
                throw err;
            } finally {
                client.release();
            }
        }
        
        res.json({ success: true, message: 'Чат помечен как прочитанный' });
    } catch (err) {
        console.error('Ошибка при отметке чата как прочитанного:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Загрузка вложения в чат
router.post('/attachment', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { chat_id, type } = req.body;
        
        if (!chat_id) {
            // Удаляем загруженный файл, если он существует
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: 'Не указан ID чата' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }
        
        // Проверяем, является ли пользователь участником чата
        const participantCheck = await pool.query(`
            SELECT * FROM chat_participants 
            WHERE chat_id = $1 AND user_id = $2
        `, [chat_id, req.user.id]);
        
        if (participantCheck.rows.length === 0) {
            // Удаляем загруженный файл
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: 'У вас нет доступа к этому чату' });
        }
        
        // Определяем тип сообщения
        let messageType = 'file';
        if (type === 'image' || (req.file.mimetype && req.file.mimetype.startsWith('image/'))) {
            messageType = 'image';
        } else if (type === 'document') {
            messageType = 'document';
        }
        
        // Создаем путь к файлу относительно корня сервера
        const fileUrl = `/uploads/chat/${req.file.filename}`;
        
        // Создаем метаданные файла
        const contentMeta = {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        };
        
        // Сохраняем сообщение в базе данных
        const messageResult = await pool.query(`
            INSERT INTO messages (chat_id, sender_id, content, message_type, content_meta)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [chat_id, req.user.id, fileUrl, messageType, contentMeta]);
        
        // Оповещаем участников чата через Socket.IO о новом сообщении
        const io = req.app.get('io');
        const newMessage = messageResult.rows[0];
        io.to(`chat_${chat_id}`).emit('message', newMessage);
        
        res.status(201).json({ 
            message: 'Файл успешно загружен', 
            file_url: fileUrl,
            message: newMessage
        });
    } catch (err) {
        console.error('Ошибка загрузки файла:', err);
        
        // Удаляем загруженный файл в случае ошибки
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: 'Ошибка загрузки файла' });
    }
});

// Удаление сообщения
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
    const { messageId } = req.params;
    
    try {
        // Проверяем, существует ли сообщение и принадлежит ли оно текущему пользователю
        const messageCheck = await pool.query(`
            SELECT * FROM messages WHERE id = $1 AND sender_id = $2
        `, [messageId, req.user.id]);
        
        if (messageCheck.rows.length === 0) {
            return res.status(403).json({ error: 'У вас нет прав на удаление этого сообщения' });
        }
        
        // Удаляем сообщение
        await pool.query(`
            DELETE FROM messages WHERE id = $1
        `, [messageId]);
        
        res.json({ success: true, message: 'Сообщение успешно удалено' });
    } catch (err) {
        console.error('Ошибка удаления сообщения:', err);
        res.status(500).json({ error: 'Ошибка сервера при удалении сообщения' });
    }
});

// Получение общего количества непрочитанных сообщений пользователя
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        // Получаем информацию о пользователе включая last_notifications_seen
        const userResult = await pool.query(`
            SELECT last_notifications_seen FROM users WHERE id = $1
        `, [req.user.id]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        const lastNotificationsSeen = userResult.rows[0].last_notifications_seen;
        
        // Считаем сообщения после последнего просмотра уведомлений
        const result = await pool.query(`
            SELECT COUNT(*) as total_unread
            FROM messages m
            JOIN chat_participants cp ON m.chat_id = cp.chat_id
            WHERE cp.user_id = $1 
              AND m.sender_id != $1
              AND m.created_at > $2
        `, [req.user.id, lastNotificationsSeen]);
        
        const totalUnread = parseInt(result.rows[0].total_unread) || 0;
        
        res.json({ unread_count: totalUnread });
    } catch (err) {
        console.error('Ошибка получения количества непрочитанных сообщений:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении количества непрочитанных сообщений' });
    }
});

// Пометка времени последнего просмотра уведомлений (НЕ помечает сообщения как прочитанные)
router.post('/mark-all-seen', authenticateToken, async (req, res) => {
    try {
        console.log(`👁️ [API] Обновление времени последнего просмотра уведомлений для пользователя ${req.user.id}`);
        
        // Обновляем время последнего просмотра уведомлений
        const result = await pool.query(`
            UPDATE users 
            SET last_notifications_seen = CURRENT_TIMESTAMP 
            WHERE id = $1
            RETURNING last_notifications_seen
        `, [req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        console.log(`✅ [API] Время последнего просмотра уведомлений обновлено: ${result.rows[0].last_notifications_seen}`);
        
        res.json({ 
            success: true, 
            message: 'Время последнего просмотра уведомлений обновлено',
            last_notifications_seen: result.rows[0].last_notifications_seen
        });
    } catch (err) {
        console.error('Ошибка при обновлении времени просмотра уведомлений:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вспомогательная функция для получения информации о чате
async function getChatInfo(chatId, userId) {
    const result = await pool.query(`
        SELECT 
            c.id,
            c.type,
            c.created_at,
            c.updated_at,
            cp.is_pinned,
            cp.is_muted,
            CASE 
                WHEN c.type = 'private' THEN (
                    SELECT json_build_object(
                        'id', u.id,
                        'username', u.username,
                        'avatar_url', u.avatar_url
                    )
                    FROM chat_participants cp2
                    JOIN users u ON cp2.user_id = u.id
                    WHERE cp2.chat_id = c.id AND cp2.user_id != $2
                    LIMIT 1
                )
                ELSE NULL
            END AS interlocutor,
            CASE 
                WHEN c.type = 'private' THEN (
                    SELECT u.username
                    FROM chat_participants cp2
                    JOIN users u ON cp2.user_id = u.id
                    WHERE cp2.chat_id = c.id AND cp2.user_id != $2
                    LIMIT 1
                )
                ELSE c.name
            END AS name,
            CASE 
                WHEN c.type = 'private' THEN (
                    SELECT u.avatar_url
                    FROM chat_participants cp2
                    JOIN users u ON cp2.user_id = u.id
                    WHERE cp2.chat_id = c.id AND cp2.user_id != $2
                    LIMIT 1
                )
                WHEN c.type = 'system' AND c.name = '1337community' THEN (
                    SELECT avatar_url FROM users WHERE username = '1337community' LIMIT 1
                )
                ELSE NULL
            END AS avatar_url,
            CASE 
                WHEN c.type = 'private' THEN (
                    SELECT u.id
                    FROM chat_participants cp2
                    JOIN users u ON cp2.user_id = u.id
                    WHERE cp2.chat_id = c.id AND cp2.user_id != $2
                    LIMIT 1
                )
                ELSE NULL
            END AS user_id
        FROM chats c
        JOIN chat_participants cp ON c.id = cp.chat_id AND cp.user_id = $2
        WHERE c.id = $1
    `, [chatId, userId]);
    
    if (result.rows.length === 0) {
        return null;
    }
    
    return result.rows[0];
}

module.exports = router; 