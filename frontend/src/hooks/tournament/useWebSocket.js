import { useEffect, useRef, useState, useCallback } from 'react';
// 🔧 ИСПРАВЛЕНО: Используем наш новый Socket.IO клиент вместо прямого импорта
import { getSocketInstance, authenticateSocket, watchTournament, unwatchTournament } from '../../services/socketClient_final';

/**
 * Custom hook для управления WebSocket соединениями турнира
 * 🔧 ОБНОВЛЕНО: Использует новый socketClient_final.js для HTTP/1.1 совместимости
 */
export const useWebSocket = (tournamentId, user, onTournamentUpdate, onChatMessage) => {
    const wsRef = useRef(null);
    const [wsConnected, setWsConnected] = useState(false);

    // Функция для установки WebSocket соединения
    const setupWebSocket = useCallback(() => {
        // Только устанавливаем соединение, если у нас есть токен и ID турнира
        if (!user || !tournamentId) {
            console.log('🔧 [useWebSocket] Отложена инициализация: нет пользователя или ID турнира');
            return;
        }
        
        console.log('🔧 [useWebSocket] Инициализация соединения для турнира', tournamentId);
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('🔧 [useWebSocket] Отсутствует токен для подключения');
            return;
        }
        
        // Получаем singleton instance нашего Socket.IO клиента
        const socket = getSocketInstance();
        
        // Авторизуем сокет с токеном
        authenticateSocket(token);
        
        // События для турнира
        const handleConnect = () => {
            console.log('✅ [useWebSocket] Socket.IO турнир соединение установлено:', socket.id);
            console.log('🎉 [useWebSocket] Используется новый socketClient_final!');
            
            // Подключаемся к турниру через утилитные функции
            watchTournament(tournamentId);
            socket.emit('join_tournament_chat', tournamentId);
            setWsConnected(true);
        };
        
        const handleDisconnect = (reason) => {
            console.log('❌ [useWebSocket] Socket.IO турнир соединение закрыто:', reason);
            setWsConnected(false);
        };
        
        const handleError = (error) => {
            console.error('🔥 [useWebSocket] Ошибка Socket.IO турнир соединения:', error);
            setWsConnected(false);
        };
        
        const handleConnectError = (error) => {
            console.error('🔥 [useWebSocket] Ошибка подключения Socket.IO турнир:', error);
            setWsConnected(false);
        };
        
        const handleTournamentUpdate = (tournamentData) => {
            if (tournamentData.tournamentId === parseInt(tournamentId) || tournamentData.id === parseInt(tournamentId)) {
                console.log('🔄 [useWebSocket] Получено обновление турнира через WebSocket:', tournamentData);
                
                // Вызываем callback для обновления турнира
                if (onTournamentUpdate) {
                    onTournamentUpdate(tournamentData);
                }
            }
        };

        const handleTournamentMessage = (message) => {
            if (onChatMessage) {
                onChatMessage(message);
            }
        };
        
        // Подключаем события
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('error', handleError);
        socket.on('connect_error', handleConnectError);
        socket.on('tournament_update', handleTournamentUpdate);
        socket.on('tournament_message', handleTournamentMessage);

        wsRef.current = socket;
        
        // Если сокет уже подключен, сразу инициализируем
        if (socket.connected) {
            handleConnect();
        }
        
        // Возвращаем функцию очистки
        return () => {
            console.log('🧹 [useWebSocket] Отписываемся от событий турнира');
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('error', handleError);
            socket.off('connect_error', handleConnectError);
            socket.off('tournament_update', handleTournamentUpdate);
            socket.off('tournament_message', handleTournamentMessage);
            
            // Отключаемся от турнира
            unwatchTournament(tournamentId);
        };
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
        console.log('🔄 [useWebSocket] Ручное переподключение WebSocket');
        setupWebSocket();
    }, [setupWebSocket]);

    // Функция для отключения WebSocket
    const disconnectWebSocket = useCallback(() => {
        console.log('🔌 [useWebSocket] Отключение WebSocket соединения');
        if (wsRef.current) {
            // Отключаемся от турнира
            unwatchTournament(tournamentId);
            wsRef.current = null;
        }
        setWsConnected(false);
    }, [tournamentId]);

    // Устанавливаем WebSocket соединение
    useEffect(() => {
        const cleanup = setupWebSocket();
        
        // Очистка при размонтировании
        return () => {
            console.log('🧹 [useWebSocket] Закрываем соединение при размонтировании');
            if (cleanup) {
                cleanup();
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