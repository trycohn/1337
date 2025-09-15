// 🚀 ВАРИАНТ 5 УПРОЩЕННЫЙ: Socket.IO клиент для single-port конфигурации
import { io } from 'socket.io-client';

// Конфигурация для production single-port setup
const SOCKET_CONFIG = {
  // Стандартный домен на порту 443
  url: process.env.NODE_ENV === 'production' 
    ? 'https://1337community.com'
    : 'http://localhost:3000',
    
  options: {
    path: '/socket.io/',
    
    // 🔥 Прод: чистый WebSocket без polling; Dev: WS с fallback на polling
    transports: (process.env.NODE_ENV === 'production')
      ? ['websocket']
      : ['websocket', 'polling'],
    
    // В проде не пробуем все транспорты, чтобы исключить лавину polling
    tryAllTransports: (process.env.NODE_ENV !== 'production'),
    
    // Production настройки
    timeout: 20000,
    forceNew: false,
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
    console.log('🚀 [Socket.IO V5 Simplified] Инициализация single-port клиента...');
    console.log(`🔗 [Socket.IO V5 Simplified] Подключение к: ${SOCKET_CONFIG.url}`);
    
    socketInstance = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // Debug events
    socketInstance.on('connect', () => {
      console.log('✅ [Socket.IO V5 Simplified] Подключено! Transport:', socketInstance.io.engine.transport.name);
      console.log('🔗 [Socket.IO V5 Simplified] Socket ID:', socketInstance.id);
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('❌ [Socket.IO V5 Simplified] Ошибка подключения:', error.message);
      console.log('🔄 [Socket.IO V5 Simplified] Попытка fallback транспорта...');
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.IO V5 Simplified] Отключение:', reason);
    });
    
    // Transport switch events
    socketInstance.io.on('ping', () => {
      console.log('🏓 [Socket.IO V5 Simplified] Ping от сервера');
    });
    
    socketInstance.io.engine.on('upgrade', () => {
      console.log('⬆️ [Socket.IO V5 Simplified] Upgrade на WebSocket успешен!');
    });
    
    socketInstance.io.engine.on('upgradeError', (error) => {
      console.warn('⚠️ [Socket.IO V5 Simplified] Ошибка upgrade:', error.message);
    });
  }
  
  return socketInstance;
};

// Утилиты для авторизации
export const authenticateSocket = (token) => {
  const socket = getSocketInstance();
  // Избегаем лишних переподключений и каскада polling
  const currentToken = socket.auth && socket.auth.token;
  if (currentToken === token && (socket.connected || socket.connecting)) {
    return socket;
  }
  socket.auth = { token };
  if (!socket.connected) {
    try { socket.connect(); } catch (_) {}
  }
  return socket;
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
