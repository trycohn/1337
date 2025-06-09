const jwt = require('jsonwebtoken');
const pool = require('./db');

// Максимальное количество попыток переподключения
const MAX_RECONNECT_ATTEMPTS = 3;
// Задержка между попытками в миллисекундах
const RECONNECT_DELAY = 2000;

// Функция для повторения запроса к БД с заданным числом попыток
async function retryQuery(queryFn, maxAttempts = MAX_RECONNECT_ATTEMPTS, delay = RECONNECT_DELAY) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await queryFn();
    } catch (err) {
      lastError = err;
      console.error(`Попытка ${attempt}/${maxAttempts} не удалась:`, err.message);
      if (attempt < maxAttempts) {
        console.log(`Повторная попытка через ${delay/1000} сек...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError; // если все попытки не удались, выбрасываем последнюю ошибку
}

// Устанавливаю обработку событий Socket.IO для чата
function setupChatSocketIO(io) {
  // Аутентификация по токену JWT при подключении
  io.use((socket, next) => {
    const token = socket.handshake.query.token;
    if (!token) {
      return next(new Error('Токен не предоставлен'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error('Ошибка аутентификации'));
    }
  });

  io.on('connection', socket => {
    console.log('🎉 [SOCKETIO-CHAT] Пользователь подключился к чату:', {
      userId: socket.userId,
      socketId: socket.id,
      connectTime: new Date().toISOString(),
      transport: socket.conn?.transport?.name,
      clientIP: socket.handshake?.address
    });

    // Флаг для отслеживания статуса подключения к комнатам
    let roomsJoined = false;

    // Присоединение к чату турнира
    socket.on('join_tournament_chat', (tournamentId) => {
      socket.join(`chat_tournament_${tournamentId}`);
      console.log(`🏆 [SOCKETIO-CHAT] Присоединение к турниру:`, {
        userId: socket.userId,
        socketId: socket.id,
        tournamentId: tournamentId,
        room: `chat_tournament_${tournamentId}`,
        timestamp: new Date().toISOString()
      });
    });

    // Обработка запроса на присоединение к дополнительной комнате чата
    socket.on('join_chat', (chatId) => {
      socket.join(`chat_${chatId}`);
      console.log(`💬 [SOCKETIO-CHAT] Присоединение к чату:`, {
        userId: socket.userId,
        socketId: socket.id,
        chatId: chatId,
        room: `chat_${chatId}`,
        timestamp: new Date().toISOString()
      });
    });

    const userId = socket.userId;

    // Функция для присоединения пользователя к комнатам чатов с повторными попытками
    const joinUserChatRooms = async () => {
      try {
        // Используем функцию повторных попыток для запроса чатов
        const result = await retryQuery(() => 
          pool.query('SELECT chat_id FROM chat_participants WHERE user_id = $1', [userId])
        );
        
        // Присоединяем к каждой комнате
        result.rows.forEach(row => {
          socket.join(`chat_${row.chat_id}`);
        });
        
        // Проверяем наличие персонального системного чата с повторными попытками
        const systemChatResult = await retryQuery(() => 
          pool.query(`
            SELECT c.id 
            FROM chats c
            JOIN chat_participants cp ON c.id = cp.chat_id
            WHERE c.name = $1 AND cp.user_id = $2 AND c.type = 'system'
            LIMIT 1`, 
            ['1337community', userId]
          )
        );
        
        // Если персональный системный чат существует, присоединяемся к нему
        if (systemChatResult.rows.length > 0) {
          const systemChatId = systemChatResult.rows[0].id;
          socket.join(`chat_${systemChatId}`);
          console.log(`💬 [SOCKETIO-CHAT] Присоединение к системному чату:`, {
            userId: userId,
            socketId: socket.id,
            systemChatId: systemChatId,
            room: `chat_${systemChatId}`,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log(`⚠️ [SOCKETIO-CHAT] Системный чат не найден:`, {
            userId: userId,
            socketId: socket.id,
            timestamp: new Date().toISOString()
          });
        }
        
        roomsJoined = true;
        return true;
      } catch (err) {
        console.error('❌ [SOCKETIO-CHAT] Ошибка подключения к комнатам чатов:', {
          userId: userId,
          socketId: socket.id,
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString()
        });
        socket.emit('chat_connection_error', {
          message: 'Не удалось подключиться к чатам. Пожалуйста, попробуйте позже.'
        });
        return false;
      }
    };
    
    // Функция для проверки соединения и переподключения к комнатам при необходимости
    const ensureRoomsJoined = async () => {
      if (!roomsJoined) {
        return await joinUserChatRooms();
      }
      return true;
    };

    // Запускаем первичное присоединение к комнатам
    joinUserChatRooms().catch(err => {
      console.error('Критическая ошибка при подключении к комнатам чатов:', err);
    });

    // Событие для ручного запроса переподключения от клиента
    socket.on('reconnect_chat_rooms', async () => {
      console.log(`🔄 [SOCKETIO-CHAT] Запрос переподключения:`, {
        userId: userId,
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
      try {
        await joinUserChatRooms();
        socket.emit('rooms_reconnected', { success: true });
        console.log(`✅ [SOCKETIO-CHAT] Переподключение успешно:`, {
          userId: userId,
          socketId: socket.id,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('❌ [SOCKETIO-CHAT] Ошибка переподключения:', {
          userId: userId,
          socketId: socket.id,
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString()
        });
        socket.emit('rooms_reconnected', { 
          success: false,
          error: 'Не удалось переподключиться к комнатам чатов'
        });
      }
    });

    // Обработка входящих сообщений в чат
    socket.on('message', async payload => {
      console.log('📝 [SOCKETIO-CHAT] Получено сообщение:', {
        userId: socket.userId,
        socketId: socket.id,
        payload: payload,
        timestamp: new Date().toISOString()
      });
      const { chat_id } = payload;
      
      // Проверяем соединение с комнатами перед обработкой сообщения
      if (!(await ensureRoomsJoined())) {
        socket.emit('message_error', { 
          error: 'Потеряно соединение с чатами. Пожалуйста, обновите страницу.' 
        });
        return;
      }
      
      // Убедимся, что отправитель присоединён к комнате данного чата
      socket.join(`chat_${chat_id}`);
      const { chat_id: id, content, message_type = 'text' } = payload;
      if (!id || !content) return;
      
      try {
        // Проверяю, что пользователь участник чата с повторными попытками
        const participantCheck = await retryQuery(() => 
          pool.query(
            'SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
            [chat_id, socket.userId]
          )
        );
        
        if (participantCheck.rows.length === 0) {
          socket.emit('message_error', { error: 'Вы не являетесь участником этого чата' });
          return;
        }

        // Сохраняю сообщение в БД с повторными попытками
        const result = await retryQuery(() => 
          pool.query(
            'INSERT INTO messages (chat_id, sender_id, content, message_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [chat_id, socket.userId, content, message_type]
          )
        );
        
        const message = result.rows[0];

        // Получаю информацию об отправителе с повторными попытками
        const userInfo = await retryQuery(() => 
          pool.query(
            'SELECT username, avatar_url FROM users WHERE id = $1',
            [socket.userId]
          )
        );
        
        message.sender_username = userInfo.rows[0].username;
        message.sender_avatar = userInfo.rows[0].avatar_url;

        // Отправляю сообщение всем участникам комнаты чата
        io.to(`chat_${chat_id}`).emit('message', message);
        console.log('📤 [SOCKETIO-CHAT] Сообщение отправлено:', {
          userId: socket.userId,
          socketId: socket.id,
          chatId: chat_id,
          room: `chat_${chat_id}`,
          messageId: message.id,
          messageType: message.message_type,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('❌ [SOCKETIO-CHAT] Ошибка обработки сообщения:', {
          userId: socket.userId,
          socketId: socket.id,
          chatId: payload.chat_id,
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString()
        });
        socket.emit('message_error', { 
          error: 'Не удалось отправить сообщение. Пожалуйста, попробуйте еще раз.' 
        });
      }
    });

    // Обработка сообщений чата турнира
    socket.on('tournament_message', async payload => {
      console.log('Socket.IO: получено событие tournament_message от userId =', socket.userId, 'payload =', payload);
      const { tournamentId, content } = payload;
      if (!tournamentId || !content) return;
      try {
        // Сохраняем сообщение в БД
        const result = await pool.query(
          'INSERT INTO tournament_messages (tournament_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
          [tournamentId, socket.userId, content]
        );
        const message = result.rows[0];
        // Получаем информацию об отправителе
        const userInfo = await pool.query(
          'SELECT username, avatar_url FROM users WHERE id = $1',
          [socket.userId]
        );
        message.sender_username = userInfo.rows[0].username;
        message.sender_avatar = userInfo.rows[0].avatar_url;
        // Отправляем сообщение всем участникам комнаты чата турнира
        io.to(`chat_tournament_${tournamentId}`).emit('tournament_message', message);
        console.log('Socket.IO: событие tournament_message отправлено в room', `chat_tournament_${tournamentId}`, message);
      } catch (err) {
        console.error('Ошибка обработки сообщения чата турнира:', err);
      }
    });

    // Обработка статуса прочтения сообщения
    socket.on('read_status', async payload => {
      const { message_id } = payload;
      if (!message_id) return;
      try {
        // Получаю информацию о сообщении
        const msgRes = await pool.query(
          'SELECT chat_id, sender_id FROM messages WHERE id = $1',
          [message_id]
        );
        if (msgRes.rows.length === 0) return;

        const { chat_id, sender_id } = msgRes.rows[0];

        // Проверяю, что пользователь участник чата
        const participantCheck = await pool.query(
          'SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
          [chat_id, userId]
        );
        if (participantCheck.rows.length === 0) return;

        // Обновляю или создаю запись о прочтении сообщения
        let readAt;
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const updateRes = await client.query(
            'UPDATE message_status SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE message_id = $1 AND user_id = $2 RETURNING read_at',
            [message_id, userId]
          );
          if (updateRes.rows.length > 0) {
            readAt = updateRes.rows[0].read_at;
          } else {
            const insertRes = await client.query(
              'INSERT INTO message_status (message_id, user_id, is_read, read_at) VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP) RETURNING read_at',
              [message_id, userId]
            );
            readAt = insertRes.rows[0].read_at;
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          console.error('Ошибка обновления статуса прочтения:', error);
        } finally {
          client.release();
        }

        // Отправляю обновленный статус прочтения в комнату чата
        io.to(`chat_${chat_id}`).emit('read_status', {
          message_id,
          chat_id,
          user_id: userId,
          is_read: true,
          read_at: readAt
        });
      } catch (err) {
        console.error('Ошибка обработки статуса прочтения:', err);
      }
    });
  });
}

module.exports = { setupChatSocketIO }; 