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
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.IO Final] Отключение:', reason);
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
  }
  
  return socketInstance;
};

// Утилиты для авторизации
export const authenticateSocket = (token) => {
  const socket = getSocketInstance();
  socket.auth = { token };
  
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
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
