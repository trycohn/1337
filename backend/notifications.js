// notifications.js

const pool = require('./db');

// Функция для отправки уведомления конкретному пользователю
const sendNotification = async (userId, notification) => {
  try {
    console.log(`🔍 Начинаю обработку уведомления для пользователя ${userId}:`, JSON.stringify(notification, null, 2));
    
    const app = global.app || require('./server');
    const io = app.get('io');
    if (!io) {
      console.error('❌ socket.io instance not found');
      return;
    }
    io.to(`user_${userId}`).emit('notification', notification);
    console.log(`📩 Уведомление отправлено пользователю ${userId} через WebSocket`);

    // Добавляем уведомление в персональный системный чат получателя
    try {
      // Сначала проверяем, что это уведомление предназначено именно этому пользователю
      if (notification.user_id !== userId) {
        console.error(`❌ ОШИБКА: Идентификатор пользователя (${userId}) не совпадает с получателем уведомления (${notification.user_id})`);
        return;
      }

      // Ищем персональный системный чат пользователя
      const systemChatName = '1337community';
      const chatRes = await pool.query(`
        SELECT c.id FROM chats c
        JOIN chat_participants cp ON c.id = cp.chat_id
        WHERE c.name = $1 AND cp.user_id = $2 AND c.type = 'system'
        LIMIT 1
      `, [systemChatName, userId]);
      
      if (chatRes.rows.length === 0) {
        console.log(`⚠️ Не найден персональный системный чат для пользователя ${userId}. Создаем новый.`);
        
        // Создаем новый персональный системный чат для пользователя
        const createChatRes = await pool.query(
          "INSERT INTO chats (name, type) VALUES ($1, 'system') RETURNING id",
          [systemChatName]
        );
        
        const systemChatId = createChatRes.rows[0].id;
        
        // Добавляем пользователя как участника
        await pool.query(
          `INSERT INTO chat_participants (chat_id, user_id, is_pinned)
           VALUES ($1, $2, true)`,
          [systemChatId, userId]
        );
        
        // Сразу используем новый ID чата
        const contentMeta = {
          notification_id: notification.id,
          type: notification.type,
          timestamp: new Date()
        };
        
        // Если есть дополнительные данные, добавляем их
        if (notification.tournament_id) {
          contentMeta.tournament_id = notification.tournament_id;
        }
        if (notification.requester_id) {
          contentMeta.requester_id = notification.requester_id;
        }
        
        // Если это заявка в друзья, пытаемся найти ID запроса
        if (notification.type === 'friend_request') {
          try {
            const friendReqResult = await pool.query(
              `SELECT id FROM friends 
               WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
              [notification.requester_id, notification.user_id]
            );
            if (friendReqResult.rows.length > 0) {
              contentMeta.request_id = friendReqResult.rows[0].id;
            }
          } catch (err) {
            console.error('Не удалось получить ID заявки дружбы:', err);
          }
        }
        
        const msgRes = await pool.query(
          'INSERT INTO messages (chat_id, sender_id, content, message_type, content_meta) VALUES ($1, NULL, $2, $3, $4) RETURNING *',
          [systemChatId, notification.message, 'announcement', contentMeta]
        );
        
        const newMsg = msgRes.rows[0];
        io.to(`chat_${systemChatId}`).emit('message', newMsg);
        console.log(`📣 Уведомление добавлено в новый персональный системный чат ${systemChatId} пользователя ${userId}`);
        return;
      }
      
      const systemChatId = chatRes.rows[0].id;
      
      // Добавляем notification_id и type в content_meta для обработки действий
      const contentMeta = {
        notification_id: notification.id,
        type: notification.type,
        timestamp: new Date()
      };
      
      // Если есть дополнительные данные, добавляем их
      if (notification.tournament_id) {
        contentMeta.tournament_id = notification.tournament_id;
      }
      if (notification.requester_id) {
        contentMeta.requester_id = notification.requester_id;
      }
      
      // Если это заявка в друзья, пытаемся найти ID запроса
      if (notification.type === 'friend_request') {
        try {
          const friendReqResult = await pool.query(
            `SELECT id FROM friends 
             WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
            [notification.requester_id, notification.user_id]
          );
          if (friendReqResult.rows.length > 0) {
            contentMeta.request_id = friendReqResult.rows[0].id;
          }
        } catch (err) {
          console.error('Не удалось получить ID заявки дружбы:', err);
        }
      }
      
      const msgRes = await pool.query(
        'INSERT INTO messages (chat_id, sender_id, content, message_type, content_meta) VALUES ($1, NULL, $2, $3, $4) RETURNING *',
        [systemChatId, notification.message, 'announcement', contentMeta]
      );
      const newMsg = msgRes.rows[0];
      
      // Отправляем сообщение в комнату чата
      io.to(`chat_${systemChatId}`).emit('message', newMsg);
      console.log(`📣 Уведомление добавлено в персональный системный чат ${systemChatId} пользователя ${userId}`);
    } catch (e) {
      console.error('❌ Ошибка добавления уведомления в системный чат:', e);
    }

  } catch (error) {
    console.error('❌ Ошибка при отправке уведомления через Socket.IO:', error);
  }
};

// Функция для отправки уведомления всем подключенным клиентам
const broadcastNotification = (notification) => {
  try {
    const app = global.app || require('./server');
    const io = app.get('io');
    if (!io) {
      console.error('❌ socket.io instance not found');
      return;
    }
    io.emit('broadcast', notification);
    console.log(`📢 Широковещательное уведомление отправлено:`, notification);
  } catch (error) {
    console.error('❌ Ошибка при отправке широковещательного уведомления через Socket.IO:', error);
  }
};

// Функция для отправки обновлений турнира всем клиентам на странице турнира
const broadcastTournamentUpdate = (tournamentId, tournamentData) => {
  try {
    const app = global.app || require('./server');
    const io = app.get('io');
    if (!io) {
      console.error('❌ socket.io instance not found');
      return;
    }
    io.to(`tournament_${tournamentId}`).emit('tournament_update', tournamentData);
    console.log(`📢 Обновление турнира ${tournamentId} отправлено через Socket.IO`);
  } catch (error) {
    console.error(`❌ Ошибка при отправке обновления турнира ${tournamentId} через Socket.IO:`, error);
  }
};

module.exports = { sendNotification, broadcastNotification, broadcastTournamentUpdate };