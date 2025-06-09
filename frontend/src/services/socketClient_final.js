// 🔧 ФИНАЛЬНЫЙ Socket.IO клиент без HTTP/2
import { io } from 'socket.io-client';

// Конфигурация для HTTP/1.1 setup
const SOCKET_CONFIG = {
  url: process.env.NODE_ENV === 'production' 
    ? 'https://1337community.com'
    : 'http://localhost:3000',
    
  options: {
    path: '/socket.io/',
    
    // 🔥 КРИТИЧЕСКИ ВАЖНО: Начинаем с polling для избежания Session ID unknown
    transports: ['polling', 'websocket'],
    
    // ✅ ИСПРАВЛЕНИЕ: Настройки для предотвращения Session ID unknown
    upgrade: true,
    tryAllTransports: true,
    forceNew: false,
    autoConnect: false, // ← КОНТРОЛИРУЕМОЕ подключение
    
    // 🛡️ STICKY SESSIONS: Критически важно для polling
    withCredentials: true,
    addTrailingSlash: false, // ← /socket.io вместо /socket.io/
    
    // Продакшн настройки
    timeout: 30000, // ← Увеличено для медленных соединений
    reconnection: true,
    reconnectionDelay: 2000, // ← Увеличена задержка
    reconnectionDelayMax: 10000, // ← Больше максимум
    maxReconnectionAttempts: 5, // ← Меньше попыток, но дольше интервалы
    
    // 📋 TRANSPORT OPTIONS: Специальные настройки для polling
    transportOptions: {
      polling: {
        extraHeaders: {},
        // ✅ ВАЖНО: Увеличиваем таймауты для polling
        requestTimeout: 20000,
        responseTimeout: 20000,
      },
      websocket: {
        extraHeaders: {},
      }
    },
    
    // 🔧 Engine.IO настройки для исправления Session ID unknown
    pingInterval: 25000, // ← Стандартное значение
    pingTimeout: 20000,  // ← Стандартное значение
    
    // CORS и авторизация
    extraHeaders: {},
    
    // ✅ ИСПРАВЛЕНИЕ: Правильные query параметры
    query: {},
    
    // 🛡️ КРИТИЧЕСКИ ВАЖНО: Поддержка сессий
    enablesXDR: false,
    timestampRequests: true,
    timestampParam: 't',
    
    // Дополнительные опции для стабильности
    jsonp: false,
    forceJSONP: false,
    forceBase64: false,
  }
};

// 🛡️ FALLBACK SOCKET: Безопасный объект для предотвращения undefined ошибок
const createFallbackSocket = () => ({
  connected: false,
  id: null,
  auth: {},
  io: { 
    opts: { 
      transportOptions: { 
        polling: { extraHeaders: {} }, 
        websocket: { extraHeaders: {} } 
      }, 
      extraHeaders: {} 
    } 
  },
  on: (event, callback) => { 
    console.warn(`⚠️ [Socket.IO Final] Fallback: игнорируем событие "${event}"`); 
    return this; 
  },
  emit: (event, ...args) => { 
    console.warn(`⚠️ [Socket.IO Final] Fallback: игнорируем emit "${event}"`); 
    return this; 
  },
  connect: () => { 
    console.warn('⚠️ [Socket.IO Final] Fallback: игнорируем connect()'); 
    return this; 
  },
  disconnect: () => { 
    console.warn('⚠️ [Socket.IO Final] Fallback: игнорируем disconnect()'); 
    return this; 
  },
  off: (event, callback) => {
    console.warn(`⚠️ [Socket.IO Final] Fallback: игнорируем off "${event}"`);
    return this;
  },
  removeAllListeners: (event) => {
    console.warn(`⚠️ [Socket.IO Final] Fallback: игнорируем removeAllListeners "${event}"`);
    return this;
  }
});

// Глобальный инстанс Socket
let socketInstance = null;

// ✅ ИСПРАВЛЕНИЕ: Защищенная функция создания Socket с обработкой Session ID unknown
const createSocketInstance = () => {
  try {
    console.log('🔧 [Socket.IO Final] Создаем новый Socket инстанс...');
    console.log('🔗 [Socket.IO Final] URL:', SOCKET_CONFIG.url);
    console.log('⚙️ [Socket.IO Final] Транспорты:', SOCKET_CONFIG.options.transports);
    
    const socket = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // 🛡️ КРИТИЧЕСКИ ВАЖНО: Проверяем что инициализация прошла успешно
    if (!socket) {
      throw new Error('Socket.IO client initialization failed');
    }
    
    if (typeof socket.on !== 'function') {
      throw new Error('Socket.IO client missing "on" method');
    }
    
    // ✅ ОБРАБОТКА Session ID unknown и других ошибок
    socket.on('connect_error', (error) => {
      console.error('❌ [Socket.IO Final] ОШИБКА ПОДКЛЮЧЕНИЯ:', error);
      
      if (error.message && error.message.includes('Session ID unknown')) {
        console.warn('🔄 [Socket.IO Final] Session ID unknown - пересоздаем соединение...');
        
        // Сбрасываем соединение и пытаемся заново через некоторое время
        setTimeout(() => {
          if (socket && socket.connected === false) {
            console.log('🔄 [Socket.IO Final] Повторная попытка подключения...');
            socket.connect();
          }
        }, 3000);
      }
      
      if (error.message && error.message.includes('xhr poll error')) {
        console.warn('🔄 [Socket.IO Final] XHR polling error - переключаемся на websocket...');
        
        // Принудительно переключаемся на websocket при ошибках polling
        if (socket.io && socket.io.opts) {
          socket.io.opts.transports = ['websocket'];
        }
      }
    });
    
    // ✅ POLLING EVENTS: Логируем для диагностики Session ID unknown
    socket.on('disconnect', (reason, details) => {
      console.warn('💔 [Socket.IO Final] ОТКЛЮЧЕНО:', { reason, details });
      
      if (reason === 'transport error' && details && details.message) {
        console.error('🚨 [Socket.IO Final] Transport error:', details.message);
        
        if (details.message.includes('Session ID unknown')) {
          console.warn('🔄 [Socket.IO Final] Session lost - будет переподключение...');
        }
      }
    });
    
    // ✅ УСПЕШНОЕ ПОДКЛЮЧЕНИЕ
    socket.on('connect', () => {
      console.log('✅ [Socket.IO Final] ПОДКЛЮЧЕНО!');
      console.log('🔗 [Socket.IO Final] Socket ID:', socket.id);
      console.log('🚀 [Socket.IO Final] Transport:', socket.io.engine.transport.name);
      console.log('🔌 [Socket.IO Final] Connected:', socket.connected);
    });
    
    // ✅ TRANSPORT UPGRADE LOGS
    socket.io.on('upgrade', () => {
      console.log('⬆️ [Socket.IO Final] Transport upgraded to:', socket.io.engine.transport.name);
    });
    
    console.log('✅ [Socket.IO Final] Socket инициализирован успешно');
    return socket;
    
  } catch (error) {
    console.error('❌ [Socket.IO Final] КРИТИЧЕСКАЯ ОШИБКА при создании Socket:', error);
    console.error('📍 [Socket.IO Final] Stack trace:', error.stack);
    return createFallbackSocket();
  }
};

// 🔧 ОСНОВНАЯ ФУНКЦИЯ: Получение Socket инстанса
export const getSocketInstance = () => {
  if (!socketInstance) {
    socketInstance = createSocketInstance();
  }
  
  // 🛡️ Дополнительная проверка что объект валидный
  if (!socketInstance || typeof socketInstance.on !== 'function') {
    console.warn('⚠️ [Socket.IO Final] Инстанс невалидный, создаем fallback...');
    socketInstance = createFallbackSocket();
  }
  
  return socketInstance;
};

// 🔐 АВТОРИЗАЦИЯ: Исправленная функция без разрыва соединения
export const authenticateSocket = (token) => {
  const socket = getSocketInstance();
  
  if (!token) {
    console.warn('⚠️ [Socket.IO Final] Токен не предоставлен для авторизации');
    return;
  }
  
  console.log('🔐 [Socket.IO Final] Устанавливаем авторизацию...');
  
  try {
    // ✅ ИСПРАВЛЕНИЕ: Устанавливаем токен через auth объект
    socket.auth = { token };
    
    // ✅ ИСПРАВЛЕНИЕ: Добавляем токен в заголовки для всех транспортов
    const authHeader = `Bearer ${token}`;
    
    // Для polling транспорта
    if (socket.io.opts.transportOptions && socket.io.opts.transportOptions.polling) {
      socket.io.opts.transportOptions.polling.extraHeaders.authorization = authHeader;
    }
    
    // Для websocket транспорта  
    if (socket.io.opts.transportOptions && socket.io.opts.transportOptions.websocket) {
      socket.io.opts.transportOptions.websocket.extraHeaders.authorization = authHeader;
    }
    
    // Для общих заголовков
    if (socket.io.opts.extraHeaders) {
      socket.io.opts.extraHeaders.authorization = authHeader;
    }
    
    // ✅ ПОДКЛЮЧАЕМСЯ если еще не подключены
    if (!socket.connected) {
      console.log('🔌 [Socket.IO Final] Подключаемся с авторизацией...');
      socket.connect();
    } else {
      console.log('✅ [Socket.IO Final] Авторизация обновлена для активного соединения');
    }
    
  } catch (error) {
    console.error('❌ [Socket.IO Final] Ошибка авторизации:', error);
  }
};

// 🎯 ТУРНИРЫ: Отслеживание турнира
export const watchTournament = (tournamentId) => {
  const socket = getSocketInstance();
  
  if (!tournamentId) {
    console.warn('⚠️ [Socket.IO Final] Tournament ID не предоставлен');
    return;
  }
  
  console.log('🎯 [Socket.IO Final] Отслеживаем турнир:', tournamentId);
  
  try {
    socket.emit('join-tournament', tournamentId);
    console.log('✅ [Socket.IO Final] Присоединились к турниру:', tournamentId);
  } catch (error) {
    console.error('❌ [Socket.IO Final] Ошибка присоединения к турниру:', error);
  }
};

// 🔄 ПЕРЕСОЗДАНИЕ: Полный перезапуск соединения
export const recreateSocket = () => {
  console.log('🔄 [Socket.IO Final] Пересоздаем Socket соединение...');
  
  try {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
    
    socketInstance = createSocketInstance();
    console.log('✅ [Socket.IO Final] Socket успешно пересоздан');
    return socketInstance;
    
  } catch (error) {
    console.error('❌ [Socket.IO Final] Ошибка пересоздания Socket:', error);
    return createFallbackSocket();
  }
};

// 📊 СТАТУС: Информация о соединении
export const getConnectionStatus = () => {
  const socket = getSocketInstance();
  
  return {
    connected: socket.connected || false,
    id: socket.id || null,
    transport: socket.io?.engine?.transport?.name || 'unknown',
    url: SOCKET_CONFIG.url,
    hasAuth: !!socket.auth?.token,
    timestamp: new Date().toISOString()
  };
};

console.log('🔧 [Socket.IO Final] Модуль инициализирован');
console.log('🌐 [Socket.IO Final] Режим:', process.env.NODE_ENV);
console.log('🔗 [Socket.IO Final] URL:', SOCKET_CONFIG.url);
