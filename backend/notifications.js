// notifications.js

const pool = require('./db');

// Функция для отправки уведомления конкретному пользователю
const sendNotification = async (userId, notification) => {
  try {
    const app = global.app || require('./server');
    const io = app.get('io');
    if (!io) {
      console.error('❌ socket.io instance not found');
      return;
    }
    io.to(`user_${userId}`).emit('notification', notification);
    console.log(`📩 Уведомление отправлено пользователю ${userId}:`, notification);

    // Добавляем уведомление в системный чат ТОЛЬКО того пользователя, которому адресовано уведомление
    const systemChatName = '1337community';
    try {
      // Сначала проверяем, что это уведомление предназначено именно этому пользователю
      if (notification.user_id !== userId) {
        console.log(`⚠️ Пропуск добавления сообщения: уведомление ${notification.id} не для пользователя ${userId}`);
        return;
      }

      // Найдем системный чат и проверим, участвует ли в нем пользователь
      const chatParticipant = await pool.query(`
        SELECT cp.chat_id FROM chat_participants cp
        JOIN chats c ON cp.chat_id = c.id
        WHERE c.name = $1 AND cp.user_id = $2
        LIMIT 1
      `, [systemChatName, userId]);
      
      if (chatParticipant.rows.length === 0) {
        console.log(`⚠️ Пользователь ${userId} не имеет доступа к системному чату`);
        return;
      }
      
      const systemChatId = chatParticipant.rows[0].chat_id;
      
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
      
      // Отправляем сообщение только в комнату этого пользователя
      io.to(`chat_${systemChatId}`).emit('message', newMsg);
      console.log(`📣 Уведомление добавлено в чат ${systemChatId} для пользователя ${userId}:`, newMsg);
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