const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('./db');

let io = null;

// 🔌 Инициализация Socket.IO сервера
function createSocketServer(httpServer) {
  console.log('🚀 [Socket.IO] Создаю новый сервер...');
  
  io = new Server(httpServer, {
    // 🎯 Простая и надежная конфигурация
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://1337community.com', 'https://www.1337community.com']
        : ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    
    // 🚀 Транспорты: временно только polling, чтобы убрать WS-ошибки без ребилда фронта
    transports: ['polling'],
    
    // ⚙️ Простые настройки
    pingTimeout: 30000,
    pingInterval: 20000,
    maxHttpBufferSize: 1e6,
    allowEIO3: false,
    // ❌ Запрещаем upgrade до WebSocket — клиент не будет пытаться перейти на WS
    allowUpgrades: false,
    
    // 🛡️ Безопасность
    serveClient: false,
    
    // 🔧 Путь (канонический без хвостового слэша)
    path: '/socket.io',

    // 🔽 Сжатие ответа на HTTP handshake (даёт меньший вес /socket.io/?)
    perMessageDeflate: {
      threshold: 1024,
      zlibDeflateOptions: { level: 6 },
      zlibInflateOptions: { chunkSize: 16 * 1024 }
    }
  });

  // Дополнительное логирование handshake / transport
  io.engine.on('connection', (rawSocket) => {
    try {
      const transport = rawSocket.transport && rawSocket.transport.name;
      const sid = rawSocket.id;
      const url = rawSocket.request && rawSocket.request.url;
      console.log(`[ENGINE.IO] connection sid=${sid} transport=${transport} url=${url}`);

      rawSocket.on('upgrade', (to) => {
        console.log(`[ENGINE.IO] upgrade sid=${sid} -> ${to && to.name}`);
      });
      rawSocket.on('close', (reason) => {
        console.log(`[ENGINE.IO] close sid=${sid} reason=${reason}`);
      });
    } catch (e) {
      console.log('[ENGINE.IO] connection log error:', e.message);
    }
  });

  io.engine.on('connection_error', (err) => {
    console.log('[ENGINE.IO] connection_error', err && err.code, err && err.message);
  });

  // 🔐 Middleware для авторизации
  io.use(async (socket, next) => {
    try {
      console.log('🔍 [Socket.IO] Авторизация подключения...');
      
      // Получаем токен из разных источников
      const token = socket.handshake.auth?.token || 
                   socket.handshake.query?.token ||
                   socket.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        console.log('❌ [Socket.IO] Токен не найден');
        return next(new Error('Токен авторизации не предоставлен'));
      }

      // Проверяем JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Проверяем пользователя в БД
      const result = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [decoded.id]);
      
      if (result.rows.length === 0) {
        console.log('❌ [Socket.IO] Пользователь не найден');
        return next(new Error('Пользователь не найден'));
      }

      // Сохраняем данные пользователя
      socket.userId = decoded.id;
      socket.user = result.rows[0];
      
      console.log(`✅ [Socket.IO] Пользователь авторизован: ${socket.user.username} (${socket.userId})`);
      next();
    } catch (error) {
      console.error('❌ [Socket.IO] Ошибка авторизации:', error.message);
      next(new Error('Ошибка авторизации'));
    }
  });

  // 🎯 События подключения
  io.on('connection', (socket) => {
    console.log(`🎉 [Socket.IO] Пользователь подключен: ${socket.user.username} (${socket.id})`);
    
    // 👤 Присоединение к персональной комнате для уведомлений
    const userRoomName = `user_${socket.userId}`;
    socket.join(userRoomName);
    io.in(userRoomName).allSockets().then((set) => {
      const size = set ? set.size : 0;
      console.log(`👤 [Socket.IO] ${socket.user.username} присоединился к персональной комнате ${userRoomName}; клиентов: ${size}`);
    }).catch(() => {
      console.log(`👤 [Socket.IO] ${socket.user.username} присоединился к персональной комнате ${userRoomName}`);
    });
    
    // 🏆 Присоединение к турниру
    socket.on('join_tournament', (tournamentId) => {
      const roomName = `tournament_${tournamentId}`;
      socket.join(roomName);
      console.log(`🏆 [Socket.IO] ${socket.user.username} присоединился к турниру ${tournamentId}`);
    });

    // 💬 Присоединение к чату
    socket.on('join_chat', async (chatId) => {
      const roomName = `chat_${chatId}`;
      socket.join(roomName);
      
      // Проверяем сколько клиентов в комнате
      const clientsInRoom = await io.in(roomName).allSockets();
      console.log(`💬 [Socket.IO] ${socket.user.username} присоединился к чату ${chatId}, в комнате ${roomName} теперь ${clientsInRoom.size} клиентов`);
    });

    // 📨 Сообщение чата
    socket.on('send_message', async (data) => {
      try {
        console.log(`📨 [Socket.IO] Получено сообщение от ${socket.user.username}:`, data);
        const { chatId, content, type = 'text' } = data;
        
        // Проверяем участие в чате
        const participantCheck = await pool.query(
          'SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
          [chatId, socket.userId]
        );
        
        console.log(`🔍 [Socket.IO] Проверка участия в чате ${chatId}: найдено ${participantCheck.rows.length} записей`);
        
        if (participantCheck.rows.length === 0) {
          console.log(`❌ [Socket.IO] Пользователь ${socket.user.username} не участник чата ${chatId}`);
          socket.emit('error', { message: 'Вы не участник этого чата' });
          return;
        }

        // Сохраняем сообщение
        const result = await pool.query(
          'INSERT INTO messages (chat_id, sender_id, content, message_type) VALUES ($1, $2, $3, $4) RETURNING *',
          [chatId, socket.userId, content, type]
        );
        
        const message = result.rows[0];
        
        // Загружаем актуальные данные пользователя из БД
        const userResult = await pool.query(
          'SELECT username, avatar_url FROM users WHERE id = $1',
          [socket.userId]
        );
        
        if (userResult.rows.length > 0) {
          message.sender_username = userResult.rows[0].username;
          message.sender_avatar = userResult.rows[0].avatar_url;
        } else {
          // Если пользователь не найден, используем данные из socket
          message.sender_username = socket.user.username;
          message.sender_avatar = socket.user.avatar_url;
        }

        console.log(`💾 [Socket.IO] Сообщение сохранено в БД:`, message);

        // Отправляем в комнату чата
        const roomName = `chat_${chatId}`;
        const clientsInRoom = await io.in(roomName).allSockets();
        console.log(`📡 [Socket.IO] Отправляем событие new_message в комнату ${roomName}, подключено клиентов: ${clientsInRoom.size}`);
        
        io.to(roomName).emit('new_message', message);

        // Дополнительно отправляем персональные уведомления всем участникам чата
        try {
          const participants = await pool.query(
            'SELECT user_id FROM chat_participants WHERE chat_id = $1',
            [chatId]
          );
          
          console.log(`🔔 [Socket.IO] Отправляем персональные уведомления ${participants.rows.length} участникам чата`);
          
          for (const participant of participants.rows) {
            const userSockets = await io.in(`user_${participant.user_id}`).allSockets();
            if (userSockets.size > 0) {
              io.to(`user_${participant.user_id}`).emit('new_message', message);
              console.log(`📱 [Socket.IO] Уведомление отправлено пользователю ${participant.user_id}`);
            }
          }
        } catch (error) {
          console.error('❌ [Socket.IO] Ошибка отправки персональных уведомлений:', error);
        }

        console.log(`✅ [Socket.IO] Сообщение успешно отправлено в чат ${chatId}`);
      } catch (error) {
        console.error('❌ [Socket.IO] Ошибка отправки сообщения:', error);
        socket.emit('error', { message: 'Ошибка отправки сообщения' });
      }
    });

    // 🏆 Сообщение турнира
    socket.on('tournament_message', async (data) => {
      try {
        const { tournamentId, content } = data;
        
        // Сохраняем сообщение
        const result = await pool.query(
          'INSERT INTO tournament_messages (tournament_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
          [tournamentId, socket.userId, content]
        );
        
        const message = result.rows[0];
        
        // Загружаем актуальные данные пользователя из БД
        const userResult = await pool.query(
          'SELECT username, avatar_url FROM users WHERE id = $1',
          [socket.userId]
        );
        
        if (userResult.rows.length > 0) {
          message.sender_username = userResult.rows[0].username;
          message.sender_avatar = userResult.rows[0].avatar_url;
        } else {
          // Если пользователь не найден, используем данные из socket
          message.sender_username = socket.user.username;
          message.sender_avatar = socket.user.avatar_url;
        }

        // Отправляем в комнату турнира
        io.to(`tournament_${tournamentId}`).emit('tournament_message', message);
        console.log(`🏆 [Socket.IO] Сообщение турнира отправлено в ${tournamentId}`);
      } catch (error) {
        console.error('❌ [Socket.IO] Ошибка сообщения турнира:', error);
        socket.emit('error', { message: 'Ошибка отправки сообщения' });
      }
    });

    // 🔄 Обновление турнира
    socket.on('update_tournament', (data) => {
      const { tournamentId, ...updateData } = data;
      io.to(`tournament_${tournamentId}`).emit('tournament_updated', updateData);
      console.log(`🔄 [Socket.IO] Обновление турнира ${tournamentId} отправлено`);
    });

    // 📖 Статус прочтения сообщений
    socket.on('messages_read', (data) => {
      console.log(`📖 [Socket.IO] Получено событие messages_read от ${socket.user.username}:`, data);
      
      // Отправляем обновление счетчика в персональную комнату пользователя
      const userRoomName = `user_${socket.userId}`;
      
      io.to(userRoomName).emit('messages_read', data);
      console.log(`📖 [Socket.IO] Событие messages_read переотправлено в комнату ${userRoomName}`);
    });

    // 🎮 Подключение к лобби матча
    socket.on('join_lobby', async (data) => {
      try {
        console.log(`🎮 [Socket.IO] Запрос на подключение к лобби от ${socket.user.username}:`, data);
        const { lobbyId } = data || {};
        if (!lobbyId) {
          socket.emit('error', { message: 'Необходимо указать lobbyId' });
          return;
        }

        const MatchLobbyService = require('./services/matchLobby/MatchLobbyService');
        // Проверим доступ и сразу присоединим к комнате + отправим состояние
        const lobby = await MatchLobbyService.getLobbyInfo(lobbyId, socket.userId);
        if (!lobby.user_invited) {
          socket.emit('error', { message: 'У вас нет доступа к этому лобби' });
          return;
        }
        const roomName = `lobby_${lobbyId}`;
        socket.join(roomName);
        console.log(`🎮 [Socket.IO] ${socket.user.username} присоединился к лобби ${roomName}`);
        socket.emit('lobby_state', lobby);
        // Heartbeat
        try {
          const pool = require('./db');
          await pool.query(
            `INSERT INTO admin_lobby_presence(lobby_id, user_id, last_seen)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (lobby_id, user_id)
             DO UPDATE SET last_seen = EXCLUDED.last_seen`,
            [lobbyId, socket.userId]
          );
        } catch (_) {}

        // Отдельная админ‑комната для админ‑лобби состояния присутствия
        const adminRoom = `admin_lobby_${lobbyId}`;
        socket.join(adminRoom);
        try {
          const io = socket.server;
          const sockets = await io.in(adminRoom).allSockets();
          io.to(adminRoom).emit('admin_lobby_presence', { lobbyId: Number(lobbyId), onlineCount: sockets.size });
        } catch (_) {}
      } catch (error) {
        console.error('❌ [Socket.IO] Ошибка подключения к лобби:', error);
        socket.emit('error', { message: error.message || 'Ошибка подключения к лобби' });
      }
    });

    // 🎮 Подключение к админ-лобби (кастомные матчи)
    socket.on('join_admin_lobby', async (data) => {
      try {
        console.log(`🎮 [Socket.IO] Запрос на подключение к админ-лобби от ${socket.user.username}:`, data);
        const { lobbyId } = data || {};
        if (!lobbyId) {
          socket.emit('error', { message: 'Необходимо указать lobbyId' });
          return;
        }

        const pool = require('./db');
        
        // Проверяем доступ: приглашен или админ
        const inviteCheck = await pool.query(
          `SELECT i.*, aml.status, aml.created_by
           FROM admin_lobby_invitations i
           JOIN admin_match_lobbies aml ON aml.id = i.lobby_id
           WHERE i.lobby_id = $1 AND i.user_id = $2
           LIMIT 1`,
          [lobbyId, socket.userId]
        );
        
        const isCreator = inviteCheck.rows[0]?.created_by === socket.userId;
        const isAdmin = socket.user.role === 'admin';
        
        if (!inviteCheck.rows[0] && !isAdmin && !isCreator) {
          socket.emit('error', { message: 'У вас нет доступа к этому лобби' });
          return;
        }

        // Присоединяемся к комнате
        const roomName = `admin_lobby_${lobbyId}`;
        socket.join(roomName);
        console.log(`🎮 [Socket.IO] ${socket.user.username} присоединился к админ-лобби ${roomName}`);
        
        // Отправляем текущее состояние лобби
        const lobbyRes = await pool.query('SELECT * FROM admin_match_lobbies WHERE id = $1', [lobbyId]);
        if (lobbyRes.rows[0]) {
          socket.emit('lobby_state', lobbyRes.rows[0]);
        }
        
        // Обновляем присутствие
        try {
          await pool.query(
            `INSERT INTO admin_lobby_presence(lobby_id, user_id, last_seen)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (lobby_id, user_id)
             DO UPDATE SET last_seen = EXCLUDED.last_seen`,
            [lobbyId, socket.userId]
          );
        } catch (_) {}
        
        // Уведомляем о количестве онлайн
        try {
          const io = socket.server;
          const sockets = await io.in(roomName).allSockets();
          io.to(roomName).emit('admin_lobby_presence', { lobbyId: Number(lobbyId), onlineCount: sockets.size });
        } catch (_) {}
        
      } catch (error) {
        console.error('❌ [Socket.IO] Ошибка подключения к админ-лобби:', error);
        socket.emit('error', { message: error.message || 'Ошибка подключения к лобби' });
      }
    });

    // 🎮 Отключение от лобби матча
    socket.on('leave_lobby', (data) => {
      const { lobbyId } = data;
      if (lobbyId) {
        socket.leave(`lobby_${lobbyId}`);
        console.log(`👋 [Socket.IO] ${socket.user.username} покинул лобби ${lobbyId}`);
        const adminRoom = `admin_lobby_${lobbyId}`;
        socket.leave(adminRoom);
        try {
          const io = socket.server;
          io.in(adminRoom).allSockets().then((s) => {
            io.to(adminRoom).emit('admin_lobby_presence', { lobbyId: Number(lobbyId), onlineCount: s.size });
          });
        } catch (_) {}
        // Heartbeat (фикс внешнего выхода)
        try {
          const pool = require('./db');
          pool.query(
            `UPDATE admin_lobby_presence SET last_seen = CURRENT_TIMESTAMP WHERE lobby_id = $1 AND user_id = $2`,
            [lobbyId, socket.userId]
          ).catch(() => {});
        } catch (_) {}
      }
    });

    // 🚪 Отключение
    socket.on('disconnect', (reason) => {
      console.log(`🚪 [Socket.IO] Пользователь отключен: ${socket.user.username} (${reason})`);
    });

    // ❌ Ошибка
    socket.on('error', (error) => {
      console.error(`❌ [Socket.IO] Ошибка у пользователя ${socket.user.username}:`, error);
    });
  });

  console.log('✅ [Socket.IO] Сервер инициализирован');
  return io;
}

// 🎯 Утилиты для использования в других модулях
function getIO() {
  if (!io) {
    throw new Error('Socket.IO сервер не инициализирован');
  }
  return io;
}

function broadcastToTournament(tournamentId, event, data) {
  if (io) {
    io.to(`tournament_${tournamentId}`).emit(event, data);
  }
}

function broadcastToChat(chatId, event, data) {
  if (io) {
    io.to(`chat_${chatId}`).emit(event, data);
  }
}

module.exports = {
  createSocketServer,
  getIO,
  broadcastToTournament,
  broadcastToChat
}; 