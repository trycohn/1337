// notifications.js

const pool = require('./db');
const websocketMonitor = require('./utils/tournament/websocketMonitor');

// Функция для отправки уведомления конкретному пользователю
const sendNotification = async (userId, notification) => {
  try {
    console.log(`🔍 Начинаю обработку уведомления для пользователя ${userId}:`, JSON.stringify(notification, null, 2));
    
    // 🔧 ИСПРАВЛЕНИЕ: Убираем проблематичный импорт
    const app = global.app;
    if (!app) {
      console.log(`⚠️ [sendNotification] Global app не найден, пропускаем Socket.IO уведомление для пользователя ${userId}`);
      // Продолжаем выполнение для добавления в системный чат
    } else {
      const io = app.get('io');
      if (!io) {
        console.log(`⚠️ [sendNotification] Socket.IO instance не найден для пользователя ${userId}`);
      } else {
        try {
          io.to(`user_${userId}`).emit('notification', notification);
          console.log(`📩 Уведомление отправлено пользователю ${userId} через WebSocket`);
        } catch (socketError) {
          console.warn(`⚠️ [sendNotification] Ошибка Socket.IO для пользователя ${userId}:`, socketError.message);
        }
      }
    }

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
        
        // 🔧 БЕЗОПАСНАЯ ОТПРАВКА В ЧАТ
        if (app && app.get('io')) {
          try {
            app.get('io').to(`chat_${systemChatId}`).emit('message', newMsg);
          } catch (chatSocketError) {
            console.warn(`⚠️ [sendNotification] Ошибка отправки в чат ${systemChatId}:`, chatSocketError.message);
          }
        }
        
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
      
      // 🔧 БЕЗОПАСНАЯ ОТПРАВКА В КОМНАТУ ЧАТА
      if (app && app.get('io')) {
        try {
          app.get('io').to(`chat_${systemChatId}`).emit('message', newMsg);
        } catch (chatSocketError) {
          console.warn(`⚠️ [sendNotification] Ошибка отправки в чат ${systemChatId}:`, chatSocketError.message);
        }
      }
      
      console.log(`📣 Уведомление добавлено в персональный системный чат ${systemChatId} пользователя ${userId}`);
    } catch (e) {
      console.error('❌ Ошибка добавления уведомления в системный чат:', e);
    }

  } catch (error) {
    console.error('❌ Ошибка при отправке уведомления:', error);
    // НЕ выбрасываем ошибку, чтобы не блокировать основной процесс
  }
};

// Функция для отправки уведомления всем подключенным клиентам
const broadcastNotification = (notification) => {
  try {
    // 🔧 ИСПРАВЛЕНИЕ: Убираем проблематичный импорт
    const app = global.app;
    if (!app) {
      console.log(`⚠️ [broadcastNotification] Global app не найден, пропускаем широковещательное уведомление`);
      return;
    }
    
    const io = app.get('io');
    if (!io) {
      console.log(`⚠️ [broadcastNotification] Socket.IO instance не найден`);
      return;
    }
    
    try {
      io.emit('broadcast', notification);
      console.log(`📢 Широковещательное уведомление отправлено:`, notification);
    } catch (socketError) {
      console.warn(`⚠️ [broadcastNotification] Ошибка Socket.IO:`, socketError.message);
    }
    
  } catch (error) {
    console.warn(`⚠️ [broadcastNotification] Ошибка при отправке широковещательного уведомления:`, error.message);
    // НЕ выбрасываем ошибку, чтобы не блокировать основной процесс
  }
};

// Функция для отправки обновлений турнира всем клиентам на странице турнира
const broadcastTournamentUpdate = (tournamentId, tournamentData, sourceFunction = 'unknown') => {
  try {
    // 🔧 ИСПРАВЛЕНИЕ: Делаем функцию более безопасной
    const app = global.app;
    if (!app) {
      console.log(`⚠️ [broadcastTournamentUpdate] Global app не найден, пропускаем Socket.IO уведомление для турнира ${tournamentId}`);
      return false;
    }
    
    const io = app.get('io');
    if (!io) {
      console.log(`⚠️ [broadcastTournamentUpdate] Socket.IO instance не найден, пропускаем уведомление для турнира ${tournamentId}`);
      return false;
    }

    // 🆕 ЛОГИРОВАНИЕ ЧЕРЕЗ МОНИТОР
    const eventId = websocketMonitor.logBroadcast(tournamentId, 'tournament_update', tournamentData, sourceFunction);
    
    // 🔧 ДОБАВЛЯЕМ ТАЙМАУТ для предотвращения зависания
    const broadcastPromise = new Promise((resolve, reject) => {
      try {
        // 🎯 ДОБАВЛЯЕМ МЕТАДАННЫЕ К СОБЫТИЮ
        const enhancedData = {
          ...tournamentData,
          _metadata: {
            eventId,
            timestamp: new Date().toISOString(),
            source: sourceFunction,
            updateType: determineUpdateType(tournamentData)
          }
        };

        io.to(`tournament_${tournamentId}`).emit('tournament_update', enhancedData);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    // Устанавливаем таймаут в 3 секунды
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Broadcast timeout')), 3000);
    });
    
    Promise.race([broadcastPromise, timeoutPromise])
      .then(() => {
        console.log(`✅ [broadcastTournamentUpdate] Обновление турнира ${tournamentId} отправлено через Socket.IO (eventId: ${eventId})`);
        
        // 🔄 АВТОМАТИЧЕСКАЯ ПРОВЕРКА ДОСТАВКИ (в фоне)
        setTimeout(async () => {
          const roomSize = io.sockets.adapter.rooms.get(`tournament_${tournamentId}`)?.size || 0;
          if (roomSize > 0) {
            const deliveryResult = await websocketMonitor.verifyEventDelivery(eventId, roomSize, 2000);
            if (!deliveryResult.success) {
              console.warn(`⚠️ [broadcastTournamentUpdate] Не все клиенты получили событие ${eventId}:`, deliveryResult);
            }
          }
        }, 500);
      })
      .catch((error) => {
        console.warn(`⚠️ [broadcastTournamentUpdate] Не удалось отправить обновление турнира ${tournamentId}:`, error.message);
      });

    return true;
      
  } catch (error) {
    console.warn(`⚠️ [broadcastTournamentUpdate] Ошибка при отправке обновления турнира ${tournamentId}:`, error.message);
    // НЕ выбрасываем ошибку, чтобы не блокировать основной процесс
    return false;
  }
};

// 🆕 ОПРЕДЕЛЕНИЕ ТИПА ОБНОВЛЕНИЯ ДЛЯ БОЛЕЕ ЭФФЕКТИВНОЙ ОБРАБОТКИ НА ФРОНТЕНДЕ
const determineUpdateType = (tournamentData) => {
  if (tournamentData.status) {
    return 'status_change';
  } else if (tournamentData.participants) {
    return 'participants_update';
  } else if (tournamentData.matches) {
    return 'matches_update';
  } else if (tournamentData.teams || tournamentData.mixed_teams) {
    return 'teams_update';
  } else {
    return 'general_update';
  }
};

module.exports = { sendNotification, broadcastNotification, broadcastTournamentUpdate };