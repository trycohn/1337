import { io } from 'socket.io-client';

// 🔗 Конфигурация подключения
const SOCKET_CONFIG = {
  url: process.env.NODE_ENV === 'production' 
    ? 'https://1337community.com'
    : 'http://localhost:3000',
  
  options: {
    // 🚀 Временный стабильный режим: только polling (без апгрейда)
    transports: ['polling'],
    upgrade: false,
    
    // ⚙️ Таймауты
    timeout: 20000,
    
    // 🔄 Переподключение
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    maxReconnectionAttempts: 5,
    
    // 🔒 CORS
    withCredentials: true,
    
    // 📍 Путь без хвостового слэша
    path: '/socket.io',
    
    // 🎯 Автоподключение отключено - подключаемся вручную после авторизации
    autoConnect: false
  }
};

// 🎯 Singleton instance
let socket = null;

// 🚀 Создание и получение Socket.IO соединения
export const getSocket = () => {
  if (!socket) {
    console.log('🚀 [Socket.IO] Создаю новый клиент...');
    socket = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // 🎧 Базовые обработчики событий
    socket.on('connect', () => {
      console.log('✅ [Socket.IO] Подключен! ID:', socket.id);
      console.log('🚀 [Socket.IO] Транспорт:', socket.io.engine.transport.name);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket.IO] Отключен:', reason);
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ [Socket.IO] Ошибка подключения:', error.message);
    });
    
    socket.on('error', (error) => {
      console.error('❌ [Socket.IO] Ошибка:', error);
    });
    
    // 🔄 События переподключения
    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 [Socket.IO] Переподключен после', attemptNumber, 'попыток');
    });
    
    socket.on('reconnect_error', (error) => {
      console.warn('⚠️ [Socket.IO] Ошибка переподключения:', error.message);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('❌ [Socket.IO] Не удалось переподключиться');
    });
  }
  
  return socket;
};

// 🔐 Подключение с авторизацией
export const connectWithAuth = (token) => {
  const socketInstance = getSocket();
  
  if (!token) {
    console.error('❌ [Socket.IO] Токен не предоставлен');
    return false;
  }
  
  // Если уже подключен или в процессе подключения с тем же токеном — не трогаем
  if ((socketInstance.connected || socketInstance.connecting) && socketInstance.auth?.token === token) {
    console.log('ℹ️ [Socket.IO] Уже подключен с этим токеном');
    return true;
  }
  
  console.log('🔐 [Socket.IO] Подключение с авторизацией...');
  
  // Устанавливаем токен авторизации
  socketInstance.auth = { token };
  
  // Подключаемся только если не подключены
  if (!socketInstance.connected && !socketInstance.connecting) {
    socketInstance.connect();
  }
  
  return true;
};

// 🚪 Отключение
export const disconnect = () => {
  if (socket) {
    console.log('🚪 [Socket.IO] Отключение...');
    socket.disconnect();
    socket = null;
  }
};

// 🏆 Присоединение к турниру
export const joinTournament = (tournamentId) => {
  const socketInstance = getSocket();
  if (socketInstance.connected) {
    socketInstance.emit('join_tournament', tournamentId);
    console.log('🏆 [Socket.IO] Присоединился к турниру:', tournamentId);
  }
};

// 🚪 Покидание турнира
export const leaveTournament = (tournamentId) => {
  const socketInstance = getSocket();
  if (socketInstance.connected) {
    socketInstance.emit('leave_tournament', tournamentId);
    console.log('🚪 [Socket.IO] Покинул турнир:', tournamentId);
  }
};

// 💬 Присоединение к чату
export const joinChat = (chatId) => {
  const socketInstance = getSocket();
  if (socketInstance.connected) {
    socketInstance.emit('join_chat', chatId);
    console.log('💬 [Socket.IO] Присоединился к чату:', chatId);
  }
};

// 📨 Отправка сообщения в чат
export const sendMessage = (chatId, content, type = 'text') => {
  const socketInstance = getSocket();
  if (socketInstance.connected) {
    socketInstance.emit('send_message', { chatId, content, type });
    console.log('📨 [Socket.IO] Отправлено сообщение в чат:', chatId);
  }
};

// 🏆 Отправка сообщения турнира
export const sendTournamentMessage = (tournamentId, content) => {
  const socketInstance = getSocket();
  if (socketInstance.connected) {
    socketInstance.emit('tournament_message', { tournamentId, content });
    console.log('🏆 [Socket.IO] Отправлено сообщение турнира:', tournamentId);
  }
};

// 🔄 Обновление турнира
export const updateTournament = (tournamentId, data) => {
  const socketInstance = getSocket();
  if (socketInstance.connected) {
    socketInstance.emit('update_tournament', { tournamentId, ...data });
    console.log('🔄 [Socket.IO] Обновление турнира отправлено:', tournamentId);
  }
};

// 🎧 Подписка на события
export const on = (event, callback) => {
  const socketInstance = getSocket();
  socketInstance.on(event, callback);
};

// 🚫 Отписка от событий
export const off = (event, callback) => {
  const socketInstance = getSocket();
  socketInstance.off(event, callback);
};

// 📡 Проверка подключения
export const isConnected = () => {
  return socket && socket.connected;
};

// 🆔 Получение ID сокета
export const getSocketId = () => {
  return socket ? socket.id : null;
}; 