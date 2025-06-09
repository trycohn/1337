// 🚀 ВАРИАНТ 5: Socket.IO клиент для dual-server конфигурации
import { io } from 'socket.io-client';

// Конфигурация для production dual-server setup
const SOCKET_CONFIG = {
  // Основной домен для WebSocket соединения через порт 8443
  url: process.env.NODE_ENV === 'production' 
    ? 'https://1337community.com:8443'
    : 'http://localhost:3000',
    
  options: {
    path: '/socket.io/',
    
    // 🔥 КРИТИЧЕСКИ ВАЖНО: Приоритет WebSocket с fallback на polling
    transports: ['websocket', 'polling'],
    
    // Автоматический retry всех транспортов
    tryAllTransports: true,
    
    // Production настройки
    timeout: 20000,
    forceNew: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    maxReconnectionAttempts: 5,
    
    // CORS и авторизация
    withCredentials: true,
    
    // Дополнительные опции для стабильности
    upgrade: true,
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
    console.log('🚀 [Socket.IO V5] Инициализация dual-server клиента...');
    console.log(`🔗 [Socket.IO V5] Подключение к: ${SOCKET_CONFIG.url}`);
    
    socketInstance = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // Debug events
    socketInstance.on('connect', () => {
      console.log('✅ [Socket.IO V5] Подключено! Transport:', socketInstance.io.engine.transport.name);
      console.log('🔗 [Socket.IO V5] Socket ID:', socketInstance.id);
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('❌ [Socket.IO V5] Ошибка подключения:', error.message);
      console.log('🔄 [Socket.IO V5] Попытка fallback транспорта...');
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.IO V5] Отключение:', reason);
    });
    
    // Transport switch events
    socketInstance.io.on('ping', () => {
      console.log('🏓 [Socket.IO V5] Ping от сервера');
    });
    
    socketInstance.io.engine.on('upgrade', () => {
      console.log('⬆️ [Socket.IO V5] Upgrade на WebSocket успешен!');
    });
    
    socketInstance.io.engine.on('upgradeError', (error) => {
      console.warn('⚠️ [Socket.IO V5] Ошибка upgrade:', error.message);
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
