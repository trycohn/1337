// 🔧 ФИНАЛЬНЫЙ Socket.IO клиент без HTTP/2
import { io } from 'socket.io-client';

// Конфигурация для HTTP/1.1 setup
const SOCKET_CONFIG = {
  url: process.env.NODE_ENV === 'production' 
    ? 'https://1337community.com'
    : 'http://localhost:3000',
    
  options: {
    path: '/socket.io',  // ← БЕЗ trailing slash для nginx
    
    // 🔥 КРИТИЧЕСКИ ВАЖНО: Начинаем с polling для избежания Session ID unknown
    transports: ['polling', 'websocket'],
    
    // ✅ ИСПРАВЛЕНИЕ: Настройки для предотвращения Session ID unknown
    upgrade: true,
    tryAllTransports: true,
    forceNew: false,
    autoConnect: false, // ← КОНТРОЛИРУЕМОЕ подключение
    
    // 🛡️ STICKY SESSIONS: Критически важно для polling
    withCredentials: true,
    addTrailingSlash: false, // ← ИСПРАВЛЕНИЕ: без trailing slash
    
    // ✅ ИСПРАВЛЕНИЕ: Правильные заголовки для polling транспорта
    transportOptions: {
      polling: {
        extraHeaders: {}  // ← Будет заполнено в authenticateSocket
      }
    },
    
    // 🔄 ТАЙМАУТЫ: Синхронизированы с сервером
    pingTimeout: 20000,  // ← Должно совпадать с сервером
    pingInterval: 25000, // ← Должно совпадать с сервером
    
    // 📡 POLLING: Специальные настройки для предотвращения Session ID unknown
    rememberUpgrade: false, // ← КРИТИЧЕСКИ ВАЖНО: предотвращает session conflicts
    enablesXDR: false,      // ← Отключаем XDomainRequest для старых IE
    jsonp: false,           // ← Отключаем JSONP
    
    // 🔧 ОТЛАДКА
    timestampRequests: true,
    timestampParam: 't'
  }
};

let socket = null;
let isInitialized = false;
let lastToken = null;

// 🛡️ ЗАЩИЩЕННАЯ ФУНКЦИЯ создания Socket с валидацией
const createSocketSafely = () => {
  try {
    console.log('🔧 [Socket.IO Final] Создаем новый Socket с конфигурацией:', SOCKET_CONFIG);
    
    const newSocket = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    // Проверяем что Socket создался корректно
    if (!newSocket || typeof newSocket.on !== 'function') {
      console.error('❌ [Socket.IO Final] Создан некорректный Socket объект');
      return createFallbackSocket();
    }
    
    console.log('✅ [Socket.IO Final] Socket успешно создан с ID:', newSocket.id);
    return newSocket;
    
  } catch (error) {
    console.error('❌ [Socket.IO Final] Критическая ошибка создания Socket:', error);
    return createFallbackSocket();
  }
};

// 🔄 FALLBACK объект для предотвращения undefined ошибок
const createFallbackSocket = () => {
  console.warn('⚠️ [Socket.IO Final] Создаем fallback Socket объект');
  return {
    on: () => {},
    emit: () => {},
    connect: () => {},
    disconnect: () => {},
    id: 'fallback-socket',
    connected: false
  };
};

// 🔌 ГЛАВНАЯ функция получения экземпляра Socket
export const getSocketInstance = () => {
  if (!socket) {
    console.log('🔧 [Socket.IO Final] Первичная инициализация Socket...');
    socket = createSocketSafely();
    isInitialized = false;
  }
  
  return socket;
};

// 🔐 АУТЕНТИФИКАЦИЯ: Установка токена и подключение
export const authenticateSocket = (token) => {
  if (!token) {
    console.warn('⚠️ [Socket.IO Final] Токен не предоставлен для аутентификации');
    return;
  }
  
  console.log('🔐 [Socket.IO Final] Аутентификация Socket с токеном...');
  
  try {
    // Пересоздаем Socket если токен изменился
    if (lastToken !== token || !socket) {
      console.log('🔄 [Socket.IO Final] Пересоздаем Socket для нового токена');
      
      // Отключаем старый Socket
      if (socket && typeof socket.disconnect === 'function') {
        socket.disconnect();
      }
      
      // Создаем новый Socket с правильными заголовками
      const authConfig = {
        ...SOCKET_CONFIG.options,
        auth: { token }, // ← Стандартный способ передачи токена
        transportOptions: {
          polling: {
            extraHeaders: {
              'Authorization': `Bearer ${token}` // ← Заголовок для polling
            }
          }
        }
      };
      
      socket = io(SOCKET_CONFIG.url, authConfig);
      lastToken = token;
      isInitialized = false;
    }
    
    // Устанавливаем обработчики событий если они еще не установлены
    if (!isInitialized) {
      setupSocketEventHandlers();
      isInitialized = true;
    }
    
    // Подключаемся только если не подключены
    if (!socket.connected) {
      console.log('🔌 [Socket.IO Final] Подключение к серверу...');
      socket.connect();
    } else {
      console.log('✅ [Socket.IO Final] Socket уже подключен');
    }
    
  } catch (error) {
    console.error('❌ [Socket.IO Final] Ошибка аутентификации Socket:', error);
  }
};

// 🎧 НАСТРОЙКА обработчиков событий
const setupSocketEventHandlers = () => {
  if (!socket) return;
  
  console.log('🎧 [Socket.IO Final] Настройка обработчиков событий...');
  
  // 🎉 ПОДКЛЮЧЕНИЕ
  socket.on('connect', () => {
    console.log('🎉 [Socket.IO Final] Успешное подключение!', {
      socketId: socket.id,
      transport: socket.io?.engine?.transport?.name,
      upgraded: socket.io?.engine?.upgraded
    });
  });
  
  // 💔 ОТКЛЮЧЕНИЕ
  socket.on('disconnect', (reason, details) => {
    console.log('💔 [Socket.IO Final] Отключение:', {
      reason,
      details,
      socketId: socket.id
    });
  });
  
  // ❌ ОШИБКИ ПОДКЛЮЧЕНИЯ - Context7 best practice
  socket.on('connect_error', (error) => {
    console.error('❌ [Socket.IO Final] Ошибка подключения:', {
      message: error.message,
      type: error.type,
      description: error.description,
      context: error.context,
      data: error.data
    });
    
    // Fallback на polling если WebSocket не работает
    if (error.message?.includes('websocket')) {
      console.log('🔄 [Socket.IO Final] Попытка fallback на polling...');
      if (socket.io?.opts) {
        socket.io.opts.transports = ['polling'];
      }
    }
  });
  
  // 🔄 ПЕРЕПОДКЛЮЧЕНИЕ
  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 [Socket.IO Final] Переподключение успешно:', attemptNumber);
  });
  
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('🔄 [Socket.IO Final] Попытка переподключения:', attemptNumber);
  });
  
  socket.on('reconnecting', (attemptNumber) => {
    console.log('🔄 [Socket.IO Final] Переподключение...', attemptNumber);
  });
  
  socket.on('reconnect_error', (error) => {
    console.error('❌ [Socket.IO Final] Ошибка переподключения:', error);
  });
  
  socket.on('reconnect_failed', () => {
    console.error('❌ [Socket.IO Final] Переподключение не удалось');
  });
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

// 🎯 ТУРНИРЫ: Отписка от турнира
export const unwatchTournament = (tournamentId) => {
  const socket = getSocketInstance();
  
  if (!tournamentId) {
    console.warn('⚠️ [Socket.IO Final] Tournament ID не предоставлен для отписки');
    return;
  }
  
  console.log('👋 [Socket.IO Final] Отписываемся от турнира:', tournamentId);
  
  try {
    socket.emit('leave-tournament', tournamentId);
    console.log('✅ [Socket.IO Final] Отписались от турнира:', tournamentId);
  } catch (error) {
    console.error('❌ [Socket.IO Final] Ошибка отписки от турнира:', error);
  }
};

// 🔄 ПЕРЕСОЗДАНИЕ: Полный перезапуск соединения
export const recreateSocket = () => {
  console.log('🔄 [Socket.IO Final] Пересоздание Socket...');
  
  // Отключаем текущий Socket
  if (socket) {
    try {
      socket.disconnect();
    } catch (error) {
      console.warn('⚠️ [Socket.IO Final] Ошибка отключения старого Socket:', error);
    }
  }
  
  // Сбрасываем состояние
  socket = null;
  isInitialized = false;
  lastToken = null;
  
  // Создаем новый Socket
  socket = createSocketSafely();
  
  console.log('✅ [Socket.IO Final] Socket пересоздан');
  return socket;
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
