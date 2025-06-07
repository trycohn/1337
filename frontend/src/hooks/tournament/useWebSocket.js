import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// 🔧 Используем window.location.origin для правильной работы на production
const getSocketURL = () => {
    // В production используем текущий домен, в development - localhost:3000
    if (process.env.NODE_ENV === 'production') {
        return window.location.origin;
    }
    return process.env.REACT_APP_API_URL || 'http://localhost:3000';
};

/**
 * Custom hook для управления WebSocket соединениями турнира
 * Извлечен из TournamentDetails.js для модульности
 */
export const useWebSocket = (tournamentId, user, onTournamentUpdate, onChatMessage) => {
    const wsRef = useRef(null);
    const [wsConnected, setWsConnected] = useState(false);

    // Функция для установки WebSocket соединения
    const setupWebSocket = useCallback(() => {
        // Только устанавливаем соединение, если у нас есть токен и ID турнира
        if (!user || !tournamentId) {
            console.log('Отложена инициализация WebSocket: нет пользователя или ID турнира');
            return;
        }
        
        console.log('Инициализация WebSocket соединения для турнира', tournamentId);
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('Отсутствует токен для WebSocket подключения');
            return;
        }
        
        // Если уже есть соединение, закрываем его перед созданием нового
        if (wsRef.current) {
            console.log('Закрываем существующее WebSocket соединение');
            wsRef.current.disconnect();
            wsRef.current = null;
        }
        
        // 🔧 Создаем новое соединение с правильными настройками для production
        const socket = io(getSocketURL(), {
            query: { token },
            // 🔌 Правильные транспорты: сначала websocket, потом polling fallback
            transports: ['websocket', 'polling'],
            // 🍪 Важно для работы с cookies на HTTPS
            withCredentials: true,
            // ⚙️ Настройки переподключения
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000,
            // 🔄 Дополнительные настройки для стабильности
            forceNew: false,
            autoConnect: true,
            upgrade: true
        });
        
        socket.on('connect', () => {
            console.log('✅ Socket.IO турнир соединение установлено:', socket.id);
            socket.emit('watch_tournament', tournamentId);
            socket.emit('join_tournament_chat', tournamentId);
            setWsConnected(true);
        });
        
        socket.on('disconnect', (reason) => {
            console.log('❌ Socket.IO турнир соединение закрыто:', reason);
            setWsConnected(false);
        });
        
        socket.on('error', (error) => {
            console.error('🔥 Ошибка Socket.IO турнир соединения:', error);
            setWsConnected(false);
        });
        
        socket.on('connect_error', (error) => {
            console.error('🔥 Ошибка подключения Socket.IO турнир:', error);
            setWsConnected(false);
        });
        
        socket.on('tournament_update', (tournamentData) => {
            if (tournamentData.tournamentId === parseInt(tournamentId) || tournamentData.id === parseInt(tournamentId)) {
                console.log('🔄 Получено обновление турнира через WebSocket:', tournamentData);
                
                // Вызываем callback для обновления турнира
                if (onTournamentUpdate) {
                    onTournamentUpdate(tournamentData);
                }
            }
        });

        // Обработка новых сообщений чата турнира
        socket.on('tournament_message', (message) => {
            if (onChatMessage) {
                onChatMessage(message);
            }
        });

        wsRef.current = socket;
    }, [tournamentId, user, onTournamentUpdate, onChatMessage]);

    // Функция для отправки сообщения чата
    const sendChatMessage = useCallback((content) => {
        if (wsRef.current && wsRef.current.connected && content.trim()) {
            wsRef.current.emit('tournament_message', { 
                tournamentId, 
                content: content.trim() 
            });
            return true;
        }
        return false;
    }, [tournamentId]);

    // Функция для ручного переподключения
    const reconnectWebSocket = useCallback(() => {
        console.log('🔄 Ручное переподключение WebSocket');
        setupWebSocket();
    }, [setupWebSocket]);

    // Функция для отключения WebSocket
    const disconnectWebSocket = useCallback(() => {
        console.log('🔌 Отключение WebSocket соединения');
        if (wsRef.current) {
            wsRef.current.disconnect();
            wsRef.current = null;
        }
        setWsConnected(false);
    }, []);

    // Устанавливаем WebSocket соединение
    useEffect(() => {
        setupWebSocket();
        
        // Очистка при размонтировании
        return () => {
            console.log('🧹 Закрываем Socket.IO соединение при размонтировании');
            if (wsRef.current) {
                wsRef.current.disconnect();
            }
            setWsConnected(false);
        };
    }, [setupWebSocket]);

    return {
        // Состояние
        wsConnected,
        
        // Функции
        sendChatMessage,
        reconnectWebSocket,
        disconnectWebSocket,
        
        // Ref для прямого доступа к сокету
        wsRef
    };
}; 