const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const url = require('url');

// Карта для хранения WebSocket-соединений по ID пользователя
const clients = new Map();

function setupChatWebSocket(server) {
    // Создаем WebSocket-сервер
    const wss = new WebSocket.Server({ 
        server,
        path: '/chat'
    });
    
    // Обработка установления соединения
    wss.on('connection', async function connection(ws, request) {
        console.log('🔌 Новый клиент подключился к чату');
        
        // Получаем токен из URL
        const query = url.parse(request.url, true).query;
        const token = query.token;
        
        if (!token) {
            console.log('❌ Токен не предоставлен, закрываем соединение');
            ws.close(1008, 'Токен не предоставлен');
            return;
        }
        
        let userId;
        
        try {
            // Проверяем токен и получаем ID пользователя
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
            
            // Проверяем существование пользователя в базе данных
            const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
            
            if (userCheck.rows.length === 0) {
                console.log(`❌ Пользователь с ID ${userId} не найден, закрываем соединение`);
                ws.close(1008, 'Пользователь не найден');
                return;
            }
            
            console.log(`✅ Пользователь с ID ${userId} успешно подключился к чату`);
            
            // Сохраняем соединение
            clients.set(userId, ws);
            
            // Устанавливаем свойство userId для WebSocket-соединения
            ws.userId = userId;
            
            // Устанавливаем обработчик закрытия соединения
            ws.on('close', function() {
                console.log(`🔌 Пользователь ${userId} отключился от чата`);
                clients.delete(userId);
            });
            
            // Обработка входящих сообщений
            ws.on('message', async function(message) {
                try {
                    const data = JSON.parse(message);
                    console.log(`📨 Получено сообщение от пользователя ${userId}:`, data.type);
                    
                    switch (data.type) {
                        case 'message':
                            await handleChatMessage(userId, data.payload);
                            break;
                            
                        case 'read_status':
                            await handleReadStatus(userId, data.payload);
                            break;
                            
                        default:
                            console.log('❓ Неизвестный тип сообщения:', data.type);
                    }
                } catch (err) {
                    console.error('❌ Ошибка обработки сообщения WebSocket:', err);
                }
            });
            
            // Отправляем подтверждение успешной аутентификации
            ws.send(JSON.stringify({
                type: 'connection',
                payload: {
                    status: 'connected',
                    userId: userId
                }
            }));
            
        } catch (err) {
            console.error('❌ Ошибка аутентификации WebSocket:', err);
            ws.close(1008, 'Ошибка аутентификации');
        }
    });
    
    return wss;
}

// Обработка сообщений чата
async function handleChatMessage(userId, payload) {
    const { chat_id, content, message_type = 'text' } = payload;
    
    if (!chat_id || !content) {
        return;
    }
    
    try {
        // Проверяем, является ли пользователь участником чата
        const participantCheck = await pool.query(`
            SELECT * FROM chat_participants 
            WHERE chat_id = $1 AND user_id = $2
        `, [chat_id, userId]);
        
        if (participantCheck.rows.length === 0) {
            return;
        }
        
        // Сохраняем сообщение в базе данных
        const result = await pool.query(`
            INSERT INTO messages (chat_id, sender_id, content, message_type)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [chat_id, userId, content, message_type]);
        
        const message = result.rows[0];
        
        // Добавляем информацию об отправителе
        const userInfo = await pool.query(`
            SELECT username, avatar_url FROM users WHERE id = $1
        `, [userId]);
        
        message.sender_username = userInfo.rows[0].username;
        message.sender_avatar = userInfo.rows[0].avatar_url;
        
        // Получаем список участников чата
        const chatParticipants = await pool.query(`
            SELECT user_id FROM chat_participants WHERE chat_id = $1 AND user_id != $2
        `, [chat_id, userId]);
        
        // Отправляем сообщение всем участникам чата
        for (const participant of chatParticipants.rows) {
            const recipientId = participant.user_id;
            const clientWs = clients.get(recipientId);
            
            if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                    type: 'message',
                    payload: message
                }));
            }
        }
        
        // Отправляем подтверждение отправителю
        const senderWs = clients.get(userId);
        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
            senderWs.send(JSON.stringify({
                type: 'message_sent',
                payload: message
            }));
        }
        
    } catch (err) {
        console.error('Ошибка обработки сообщения чата:', err);
    }
}

// Обработка статуса прочтения сообщений
async function handleReadStatus(userId, payload) {
    const { message_id } = payload;
    
    if (!message_id) {
        return;
    }
    
    try {
        // Получаем информацию о сообщении
        const messageInfo = await pool.query(`
            SELECT chat_id, sender_id FROM messages WHERE id = $1
        `, [message_id]);
        
        if (messageInfo.rows.length === 0) {
            return;
        }
        
        const { chat_id, sender_id } = messageInfo.rows[0];
        
        // Проверяем, является ли пользователь участником чата
        const participantCheck = await pool.query(`
            SELECT * FROM chat_participants 
            WHERE chat_id = $1 AND user_id = $2
        `, [chat_id, userId]);
        
        if (participantCheck.rows.length === 0) {
            return;
        }
        
        // Обновляем или создаем запись о прочтении
        const result = await pool.query(`
            INSERT INTO message_status (message_id, user_id, is_read, read_at)
            VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)
            ON CONFLICT (message_id, user_id) 
            DO UPDATE SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            RETURNING read_at
        `, [message_id, userId]);
        
        const read_at = result.rows[0].read_at;
        
        // Отправляем уведомление о прочтении отправителю сообщения
        const senderWs = clients.get(sender_id);
        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
            senderWs.send(JSON.stringify({
                type: 'read_status',
                payload: {
                    message_id,
                    chat_id,
                    user_id: userId,
                    is_read: true,
                    read_at
                }
            }));
        }
        
    } catch (err) {
        console.error('Ошибка обработки статуса прочтения:', err);
    }
}

module.exports = { setupChatWebSocket, clients }; 