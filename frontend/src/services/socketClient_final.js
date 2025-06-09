// 🔧 ФИНАЛЬНЫЙ Socket.IO клиент без HTTP/2 с защитой от ошибок
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
    autoConnect: false,
    
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

// Создаем singleton instance
let socketInstance = null;

// 🛡️ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Защищенная инициализация Socket.IO
const createSocketInstance = () => {
  try {
    console.log('🔧 [Socket.IO Final] Инициализация HTTP/1.1 клиента...');
    console.log(`🔗 [Socket.IO Final] Подключение к: ${SOCKET_CONFIG.url}`);
    
    // Создаем Socket.IO клиент с защитой от ошибок
    const socket = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // 🛡️ КРИТИЧЕСКИ ВАЖНО: Проверяем что инициализация прошла успешно
    if (!socket) {
      throw new Error('Socket.IO client initialization failed - returned null/undefined');
    }
    
    // Проверяем что у объекта есть необходимые методы
    if (typeof socket.on !== 'function') {
      throw new Error('Socket.IO client initialization failed - missing "on" method');
    }
    
    console.log('✅ [Socket.IO Final] Socket.IO клиент создан успешно');
    
    // Настраиваем обработчики событий
    setupSocketEvents(socket);
    
    return socket;
    
  } catch (error) {
    console.error('🚨 [Socket.IO Final] КРИТИЧЕСКАЯ ОШИБКА при инициализации:', error.message);
    console.error('🚨 [Socket.IO Final] Stack trace:', error.stack);
    
    // Возвращаем mock объект для предотвращения undefined ошибок
    return createFallbackSocket();
  }
};

// 🛡️ Fallback объект на случай ошибки инициализации
const createFallbackSocket = () => {
  console.log('🔧 [Socket.IO Final] Создаем fallback socket объект...');
  
  const fallbackSocket = {
    connected: false,
    id: null,
    auth: {},
    io: {
      engine: { transport: { name: 'fallback' } },
      opts: {
        transportOptions: {
          polling: { extraHeaders: {} },
          websocket: { extraHeaders: {} }
        },
        extraHeaders: {}
      }
    },
    
    // Mock методы для предотвращения ошибок
    on: (event, callback) => {
      console.warn(`⚠️ [Socket.IO Final] Fallback socket - event "${event}" ignored`);
      return fallbackSocket;
    },
    emit: (event, ...args) => {
      console.warn(`⚠️ [Socket.IO Final] Fallback socket - emit "${event}" ignored`);
      return fallbackSocket;
    },
    connect: () => {
      console.warn('⚠️ [Socket.IO Final] Fallback socket - connect ignored');
      return fallbackSocket;
    },
    disconnect: () => {
      console.warn('⚠️ [Socket.IO Final] Fallback socket - disconnect ignored');
      return fallbackSocket;
    }
  };
  
  return fallbackSocket;
};

// 🔧 Настройка событий Socket.IO
const setupSocketEvents = (socket) => {
  // Debug events
  socket.on('connect', () => {
    console.log('✅ [Socket.IO Final] ПОДКЛЮЧЕНО! Transport:', socket.io.engine.transport.name);
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
  
  // Transport events
  socket.io.on('ping', () => {
    console.log('🏓 [Socket.IO Final] Ping от сервера');
  });
  
  if (socket.io.engine) {
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
};

// 🛡️ ИСПРАВЛЕННАЯ функция получения экземпляра Socket.IO
export const getSocketInstance = () => {
  if (!socketInstance) {
    socketInstance = createSocketInstance();
  }
  
  // Дополнительная проверка что объект валидный
  if (!socketInstance || typeof socketInstance.on !== 'function') {
    console.error('🚨 [Socket.IO Final] КРИТИЧЕСКАЯ ОШИБКА: Socket instance невалидный');
    socketInstance = createFallbackSocket();
  }
  
  return socketInstance;
};

// 🔐 ИСПРАВЛЕНО: Утилиты для авторизации без разрыва соединений
export const authenticateSocket = (token) => {
  const socket = getSocketInstance();
  
  console.log('🔐 [Socket.IO Final] Устанавливаем авторизацию с токеном');
  
  if (!token) {
    console.error('❌ [Socket.IO Final] Токен не предоставлен!');
    return;
  }
  
  // 🔧 КРИТИЧЕСКИ ВАЖНО: Устанавливаем токен в auth объект
  socket.auth = { token };
  
  // 🔧 ИСПРАВЛЕНО: Добавляем токен в extraHeaders для всех транспортов
  const authHeader = `Bearer ${token}`;
  
  try {
    // Устанавливаем заголовки авторизации для polling
    if (socket.io.opts.transportOptions.polling) {
      socket.io.opts.transportOptions.polling.extraHeaders.Authorization = authHeader;
    }
    
    // Устанавливаем заголовки авторизации для websocket
    if (socket.io.opts.transportOptions.websocket) {
      socket.io.opts.transportOptions.websocket.extraHeaders.Authorization = authHeader;
    }
    
    // Устанавливаем в общие extraHeaders (для Node.js окружения)
    if (!socket.io.opts.extraHeaders) {
      socket.io.opts.extraHeaders = {};
    }
    socket.io.opts.extraHeaders.Authorization = authHeader;
  } catch (error) {
    console.warn('⚠️ [Socket.IO Final] Не удалось установить заголовки авторизации:', error.message);
  }
  
  // 🔧 ИСПРАВЛЕНО: НЕ разрываем активные соединения
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
