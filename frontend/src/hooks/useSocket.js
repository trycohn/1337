import { useEffect, useRef, useCallback, useState } from 'react';
import {
  getSocket,
  connectWithAuth,
  disconnect,
  joinTournament,
  leaveTournament,
  joinChat,
  sendMessage,
  sendTournamentMessage,
  updateTournament,
  on,
  off,
  isConnected,
  getSocketId
} from '../services/socket';

/**
 * 🚀 React Hook для работы с Socket.IO
 * Обеспечивает простое и удобное использование Socket.IO в компонентах
 */
export const useSocket = () => {
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState(null);
  const socketRef = useRef(null);
  const listenersRef = useRef(new Map());

  // 🔐 Подключение с авторизацией (только один раз)
  const connect = useCallback((token) => {
    if (!token) {
      console.error('❌ [useSocket] Токен не предоставлен');
      return false;
    }

    // Если уже подключен, не подключаемся повторно
    if (socketRef.current && isConnected()) {
      console.log('ℹ️ [useSocket] Уже подключен, пропускаем');
      setConnected(true);
      setSocketId(getSocketId());
      return true;
    }

    console.log('🔐 [useSocket] Инициализация подключения...');
    
    // Получаем Socket.IO instance
    socketRef.current = getSocket();
    
    // Подключаемся с авторизацией только если еще не подключены
    const success = connectWithAuth(token);
    
    if (success) {
      // Устанавливаем базовые обработчики только один раз
      if (!socketRef.current.hasListeners('connect')) {
        socketRef.current.on('connect', () => {
          console.log('✅ [useSocket] Подключен!');
          setConnected(true);
          setSocketId(getSocketId());
        });
        
        socketRef.current.on('disconnect', () => {
          console.log('🔌 [useSocket] Отключен');
          setConnected(false);
          setSocketId(null);
        });
        
        socketRef.current.on('connect_error', (error) => {
          console.error('❌ [useSocket] Ошибка подключения:', error.message);
          setConnected(false);
          setSocketId(null);
        });
      }
    }
    
    return success;
  }, []);

  // 🚪 Отключение
  const disconnectSocket = useCallback(() => {
    console.log('🚪 [useSocket] Отключение...');
    
    // Очищаем все слушатели
    listenersRef.current.forEach((callback, event) => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    });
    listenersRef.current.clear();
    
    // Отключаемся
    disconnect();
    socketRef.current = null;
    setConnected(false);
    setSocketId(null);
  }, []);

  // 🎧 Подписка на события
  const addEventListener = useCallback((event, callback) => {
    if (!socketRef.current) {
      console.warn('⚠️ [useSocket] Socket не инициализирован для события:', event);
      return;
    }

    console.log('🎧 [useSocket] Добавляю слушатель для события:', event);
    
    // Сохраняем callback для последующей очистки
    listenersRef.current.set(event, callback);
    
    // Добавляем слушатель
    on(event, callback);
  }, []);

  // 🚫 Отписка от событий
  const removeEventListener = useCallback((event, callback) => {
    if (!socketRef.current) return;
    
    console.log('🚫 [useSocket] Удаляю слушатель для события:', event);
    
    // Удаляем из нашего списка
    listenersRef.current.delete(event);
    
    // Удаляем слушатель
    off(event, callback);
  }, []);

  // 🏆 Работа с турнирами
  const tournament = {
    join: useCallback((tournamentId) => {
      console.log('🏆 [useSocket] Присоединение к турниру:', tournamentId);
      joinTournament(tournamentId);
    }, []),
    
    leave: useCallback((tournamentId) => {
      console.log('🚪 [useSocket] Покидание турнира:', tournamentId);
      leaveTournament(tournamentId);
    }, []),
    
    sendMessage: useCallback((tournamentId, content) => {
      console.log('📨 [useSocket] Отправка сообщения турнира:', tournamentId);
      sendTournamentMessage(tournamentId, content);
    }, []),
    
    update: useCallback((tournamentId, data) => {
      console.log('🔄 [useSocket] Обновление турнира:', tournamentId);
      updateTournament(tournamentId, data);
    }, [])
  };

  // 💬 Работа с чатами
  const chat = {
    join: useCallback((chatId) => {
      console.log('💬 [useSocket] Присоединение к чату:', chatId);
      joinChat(chatId);
    }, []),
    
    sendMessage: useCallback((chatId, content, type = 'text') => {
      console.log('📨 [useSocket] Отправка сообщения в чат:', chatId);
      sendMessage(chatId, content, type);
    }, [])
  };

  // 🧹 Очистка при размонтировании
  useEffect(() => {
    return () => {
      console.log('🧹 [useSocket] Очистка hook...');
      disconnectSocket();
    };
  }, [disconnectSocket]);

  return {
    // 📊 Состояние
    connected,
    socketId,
    
    // 🔐 Подключение/отключение
    connect,
    disconnect: disconnectSocket,
    
    // 🎧 События
    on: addEventListener,
    off: removeEventListener,
    
    // 🏆 Турниры
    tournament,
    
    // 💬 Чаты
    chat,
    
    // 🛠️ Утилиты
    isConnected: useCallback(() => isConnected(), []),
    getSocket: useCallback(() => socketRef.current, [])
  };
}; 