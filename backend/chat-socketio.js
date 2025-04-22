const jwt = require('jsonwebtoken');
const pool = require('./db');

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
    const userId = socket.userId;

    // Присоединяю пользователя к его комнатам чатов
    pool.query('SELECT chat_id FROM chat_participants WHERE user_id = $1', [userId])
      .then(result => {
        result.rows.forEach(row => {
          socket.join(`chat_${row.chat_id}`);
        });
      })
      .catch(err => {
        console.error('Ошибка получения чатов пользователя:', err);
      });

    // Обработка входящих сообщений в чат
    socket.on('message', async payload => {
      console.log('Получен запрос на отправку сообщения:', payload);
      const { chat_id, content, message_type = 'text' } = payload;
      if (!chat_id || !content) return;

      try {
        // Проверяю, что пользователь участник чата
        const participantCheck = await pool.query(
          'SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
          [chat_id, userId]
        );
        if (participantCheck.rows.length === 0) return;

        // Сохраняю сообщение в БД
        const result = await pool.query(
          'INSERT INTO messages (chat_id, sender_id, content, message_type) VALUES ($1, $2, $3, $4) RETURNING *',
          [chat_id, userId, content, message_type]
        );
        const message = result.rows[0];

        // Получаю информацию об отправителе
        const userInfo = await pool.query(
          'SELECT username, avatar_url FROM users WHERE id = $1',
          [userId]
        );
        message.sender_username = userInfo.rows[0].username;
        message.sender_avatar = userInfo.rows[0].avatar_url;

        console.log(`Отправляю сообщение в комнату chat_${chat_id}:`, message);
        // Отправляю сообщение всем участникам комнаты чата
        io.to(`chat_${chat_id}`).emit('message', message);
      } catch (err) {
        console.error('Ошибка обработки сообщения чата:', err);
      }
    });

    // Обработка статуса прочтения сообщения
    socket.on('read_status', async payload => {
      console.log('Получен запрос на обновление статуса прочтения:', payload);
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