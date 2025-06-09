// 🔧 ФИНАЛЬНЫЙ Socket.IO клиент без HTTP/2
import { io } from 'socket.io-client';

// Конфигурация для HTTP/1.1 setup
const SOCKET_CONFIG = {
  url: process.env.NODE_ENV === 'production' 
    ? 'https://1337community.com'
    : 'http://localhost:3000',
    
  options: {
    path: '/socket.io/',
    
    // 🔥 КРИТИЧЕСКИ ВАЖНО: WebSocket приоритет с надежным fallback
    transports: ['websocket', 'polling'],
    
    // Агрессивный retry для WebSocket
    tryAllTransports: true,
    forceNew: false,
    upgrade: true,
    
    // Продакшн настройки
    timeout: 20000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    maxReconnectionAttempts: 10,
    
    // CORS и авторизация
    withCredentials: true,
    autoConnect: true,
    
    // Транспорт-специфичные настройки
    transportOptions: {
      polling: {
        extraHeaders: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      },
      websocket: {
        extraHeaders: {
          'Origin': 'https://1337community.com'
        }
      }
    }
  }
};

// Создаем singleton instance
let socketInstance = null;

export const getSocketInstance = () => {
  if (!socketInstance) {
    console.log('🔧 [Socket.IO Final] Инициализация HTTP/1.1 клиента...');
    console.log(`🔗 [Socket.IO Final] Подключение к: ${SOCKET_CONFIG.url}`);
    
    socketInstance = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // Debug events
    socketInstance.on('connect', () => {
      console.log('✅ [Socket.IO Final] ПОДКЛЮЧЕНО! Transport:', socketInstance.io.engine.transport.name);
      console.log('🔗 [Socket.IO Final] Socket ID:', socketInstance.id);
      console.log('🎉 [Socket.IO Final] WebSocket работает без HTTP/2!');
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('❌ [Socket.IO Final] Ошибка подключения:', error.message);
      console.log('🔄 [Socket.IO Final] Попытка fallback на polling...');
      console.log('🔍 [Socket.IO Final] Детали ошибки:', {
        type: error.type,
        description: error.description,
        context: error.context,
        message: error.message
      });
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.IO Final] Отключение:', reason);
      if (reason === 'io server disconnect') {
        console.log('🔄 [Socket.IO Final] Сервер разорвал соединение, переподключаемся...');
        socketInstance.connect();
      }
    });
    
    // Transport events
    socketInstance.io.on('ping', () => {
      console.log('🏓 [Socket.IO Final] Ping от сервера');
    });
    
    socketInstance.io.engine.on('upgrade', () => {
      console.log('⬆️ [Socket.IO Final] Успешный upgrade на WebSocket!');
    });
    
    socketInstance.io.engine.on('upgradeError', (error) => {
      console.warn('⚠️ [Socket.IO Final] Ошибка upgrade, используем polling:', error.message);
    });
    
    // Обработка ошибок отправки событий
    socketInstance.on('error', (error) => {
      console.error('🚨 [Socket.IO Final] Ошибка Socket.IO:', error);
    });
    
    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`🔄 [Socket.IO Final] Переподключение успешно (попытка ${attemptNumber})`);
    });
    
    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 [Socket.IO Final] Попытка переподключения ${attemptNumber}...`);
    });
    
    socketInstance.on('reconnect_error', (error) => {
      console.error('❌ [Socket.IO Final] Ошибка переподключения:', error.message);
    });
    
    socketInstance.on('reconnect_failed', () => {
      console.error('❌ [Socket.IO Final] Не удалось переподключиться после всех попыток');
    });
  }
  
  return socketInstance;
};

// Утилиты для авторизации
export const authenticateSocket = (token) => {
  const socket = getSocketInstance();
  
  console.log('🔐 [Socket.IO Final] Устанавливаем авторизацию с токеном');
  
  // Устанавливаем авторизацию без разрыва соединения
  socket.auth = { token };
  
  // Если сокет еще не подключен, просто подключаемся
  if (!socket.connected) {
    console.log('🔌 [Socket.IO Final] Подключаемся с авторизацией...');
    socket.connect();
  } else {
    // Если уже подключен, отправляем токен через событие
    console.log('🔄 [Socket.IO Final] Обновляем авторизацию для активного соединения');
    socket.emit('authenticate', { token });
  }
};

// Утилиты для подписки на турниры
export const watchTournament = (tournamentId) => {
  const socket = getSocketInstance();
  socket.emit('watch_tournament', tournamentId);
};

export const unwatchTournament = (tournamentId) => {
  const socket = getSocketInstance();
  socket.emit('unwatch_tournament', tournamentId);
};

export default getSocketInstance;
