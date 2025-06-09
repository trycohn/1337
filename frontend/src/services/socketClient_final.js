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
    autoConnect: false, // 🔧 ИСПРАВЛЕНО: Отключаем автоподключение для контроля авторизации
    
    // 🔐 ИСПРАВЛЕНО: Токен авторизации будет добавлен динамически
    auth: {
      token: null // Будет установлен перед подключением
    },
    
    // Транспорт-специфичные настройки
    transportOptions: {
      polling: {
        extraHeaders: {
          'X-Requested-With': 'XMLHttpRequest'
          // Authorization будет добавлен динамически
        }
      },
      websocket: {
        extraHeaders: {
          'Origin': process.env.NODE_ENV === 'production' ? 'https://1337community.com' : 'http://localhost:3000'
          // Authorization будет добавлен динамически
        }
      }
    }
  }
};

// 🛡️ КРИТИЧЕСКИ ВАЖНО: Fallback Socket объект для предотвращения undefined ошибок
const createFallbackSocket = () => {
  console.warn('⚠️ [Socket.IO Final] Создаем fallback Socket объект');
  return {
    connected: false,
    id: null,
    auth: {},
    io: {
      opts: {
        transportOptions: { polling: { extraHeaders: {} }, websocket: { extraHeaders: {} } },
        extraHeaders: {}
      },
      engine: { transport: { name: 'fallback' } },
      on: () => {},
      off: () => {}
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
    off: () => {
      console.warn('⚠️ [Socket.IO Final] Fallback: игнорируем off()');
      return this;
    }
  };
};

// 🛡️ Защищенная функция создания Socket.IO инстанса
const createSocketInstance = () => {
  try {
    console.log('🔧 [Socket.IO Final] Инициализация HTTP/1.1 клиента...');
    console.log(`🔗 [Socket.IO Final] Подключение к: ${SOCKET_CONFIG.url}`);
    
    const socket = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // 🛡️ КРИТИЧЕСКИ ВАЖНО: Проверяем что инициализация прошла успешно
    if (!socket) {
      throw new Error('Socket.IO client initialization failed - socket is null/undefined');
    }
    
    if (typeof socket.on !== 'function') {
      throw new Error('Socket.IO client initialization failed - missing "on" method');
    }
    
    if (typeof socket.emit !== 'function') {
      throw new Error('Socket.IO client initialization failed - missing "emit" method');
    }
    
    // Debug events
    socket.on('connect', () => {
      console.log('✅ [Socket.IO Final] ПОДКЛЮЧЕНО! Transport:', socket.io?.engine?.transport?.name || 'unknown');
      console.log('🔗 [Socket.IO Final] Socket ID:', socket.id);
      console.log('🎉 [Socket.IO Final] WebSocket работает без HTTP/2!');
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ [Socket.IO Final] Ошибка подключения:', error.message);
      console.log('🔄 [Socket.IO Final] Попытка fallback на polling...');
      console.log('🔍 [Socket.IO Final] Детали ошибки:', {
        type: error.type,
        description: error.description,
        context: error.context,
        message: error.message
      });
    });
    
    socket.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.IO Final] Отключение:', reason);
      if (reason === 'io server disconnect') {
        console.log('🔄 [Socket.IO Final] Сервер разорвал соединение, переподключаемся...');
        socket.connect();
      }
    });
    
    // Transport events с защитой
    if (socket.io && socket.io.on) {
      socket.io.on('ping', () => {
        console.log('🏓 [Socket.IO Final] Ping от сервера');
      });
    }
    
    if (socket.io && socket.io.engine && socket.io.engine.on) {
      socket.io.engine.on('upgrade', () => {
        console.log('⬆️ [Socket.IO Final] Успешный upgrade на WebSocket!');
      });
      
      socket.io.engine.on('upgradeError', (error) => {
        console.warn('⚠️ [Socket.IO Final] Ошибка upgrade, используем polling:', error.message);
      });
    }
    
    // Обработка ошибок отправки событий
    socket.on('error', (error) => {
      console.error('🚨 [Socket.IO Final] Ошибка Socket.IO:', error);
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 [Socket.IO Final] Переподключение успешно (попытка ${attemptNumber})`);
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 [Socket.IO Final] Попытка переподключения ${attemptNumber}...`);
    });
    
    socket.on('reconnect_error', (error) => {
      console.error('❌ [Socket.IO Final] Ошибка переподключения:', error.message);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('❌ [Socket.IO Final] Не удалось переподключиться после всех попыток');
    });
    
    console.log('✅ [Socket.IO Final] Socket инициализирован успешно');
    return socket;
    
  } catch (error) {
    console.error('❌ [Socket.IO Final] КРИТИЧЕСКАЯ ОШИБКА инициализации:', error);
    console.error('❌ [Socket.IO Final] Stack trace:', error.stack);
    console.warn('⚠️ [Socket.IO Final] Используем fallback Socket объект для предотвращения краха');
    
    // Возвращаем fallback объект для предотвращения undefined ошибок
    return createFallbackSocket();
  }
};

// Создаем singleton instance
let socketInstance = null;

export const getSocketInstance = () => {
  if (!socketInstance) {
    socketInstance = createSocketInstance();
  }
  
  // 🛡️ Дополнительная проверка что объект валидный
  if (!socketInstance || typeof socketInstance.on !== 'function') {
    console.error('❌ [Socket.IO Final] КРИТИЧЕСКАЯ ОШИБКА: socketInstance некорректен');
    console.warn('⚠️ [Socket.IO Final] Пересоздаем fallback Socket объект');
    socketInstance = createFallbackSocket();
  }
  
  return socketInstance; // ← ВСЕГДА возвращает валидный объект!
};

// 🔐 ИСПРАВЛЕНО: Утилиты для авторизации с правильной передачей токена
export const authenticateSocket = (token) => {
  const socket = getSocketInstance();
  
  console.log('🔐 [Socket.IO Final] Устанавливаем авторизацию с токеном');
  
  if (!token) {
    console.error('❌ [Socket.IO Final] Токен не предоставлен!');
    return;
  }
  
  // Проверяем что у нас валидный Socket объект
  if (!socket || typeof socket.emit !== 'function') {
    console.error('❌ [Socket.IO Final] Невалидный Socket объект для авторизации');
    return;
  }
  
  // 🔧 КРИТИЧЕСКИ ВАЖНО: Устанавливаем токен в auth объект
  if (socket.auth) {
    socket.auth.token = token;
  } else {
    socket.auth = { token };
  }
  
  // 🔧 ИСПРАВЛЕНО: Добавляем токен в extraHeaders для всех транспортов (с защитой)
  const authHeader = `Bearer ${token}`;
  
  try {
    // Устанавливаем заголовки авторизации для polling
    if (socket.io && socket.io.opts && socket.io.opts.transportOptions && socket.io.opts.transportOptions.polling) {
      socket.io.opts.transportOptions.polling.extraHeaders.Authorization = authHeader;
    }
    
    // Устанавливаем заголовки авторизации для websocket
    if (socket.io && socket.io.opts && socket.io.opts.transportOptions && socket.io.opts.transportOptions.websocket) {
      socket.io.opts.transportOptions.websocket.extraHeaders.Authorization = authHeader;
    }
    
    // Устанавливаем в общие extraHeaders (для Node.js окружения)
    if (socket.io && socket.io.opts) {
      if (!socket.io.opts.extraHeaders) {
        socket.io.opts.extraHeaders = {};
      }
      socket.io.opts.extraHeaders.Authorization = authHeader;
    }
  } catch (error) {
    console.warn('⚠️ [Socket.IO Final] Ошибка установки заголовков авторизации:', error.message);
  }
  
  // Если сокет еще не подключен, подключаемся с авторизацией
  if (!socket.connected) {
    console.log('🔌 [Socket.IO Final] Подключаемся с авторизацией...');
    if (typeof socket.connect === 'function') {
      socket.connect();
    }
  } else {
    // 🔧 ИСПРАВЛЕНО: НЕ разрываем соединение, а отправляем событие аутентификации
    console.log('🔄 [Socket.IO Final] Отправляем событие аутентификации для активного соединения');
    if (typeof socket.emit === 'function') {
      socket.emit('authenticate', { token });
    }
  }
};

// Утилиты для подписки на турниры
export const watchTournament = (tournamentId) => {
  const socket = getSocketInstance();
  if (socket && typeof socket.emit === 'function') {
    socket.emit('watch_tournament', tournamentId);
  }
};

export const unwatchTournament = (tournamentId) => {
  const socket = getSocketInstance();
  if (socket && typeof socket.emit === 'function') {
    socket.emit('unwatch_tournament', tournamentId);
  }
};

export default getSocketInstance;
