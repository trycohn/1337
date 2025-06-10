import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../useSocket';

/**
 * Custom hook для управления WebSocket соединениями турнира
 * 🚀 ОБНОВЛЕНО: Использует новый useSocket hook
 */
export const useWebSocket = (tournamentId, user, onTournamentUpdate, onChatMessage) => {
    const socket = useSocket();
    const [wsConnected, setWsConnected] = useState(false);

    // Подключение к Socket.IO при наличии пользователя (только один раз)
    useEffect(() => {
        if (!user || !tournamentId) {
            console.log('🔧 [useWebSocket] Отложена инициализация: нет пользователя или ID турнира');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            console.log('🔧 [useWebSocket] Отсутствует токен для подключения');
            return;
        }

        console.log('🚀 [useWebSocket] Подключение к турниру', tournamentId);
        
        // Подключаемся к Socket.IO
        const connected = socket.connect(token);
        
        if (connected) {
            // Присоединяемся к турниру
            socket.tournament.join(tournamentId);
            setWsConnected(socket.connected);
        }
    }, [tournamentId, user?.id]); // Убрали socket из зависимостей

    // Подписка на события турнира (стабильные зависимости)
    useEffect(() => {
        if (!tournamentId) return;

        // Обработчики событий
        const handleTournamentUpdate = (tournamentData) => {
            if (tournamentData.tournamentId === parseInt(tournamentId) || tournamentData.id === parseInt(tournamentId)) {
                console.log('🔄 [useWebSocket] Получено обновление турнира:', tournamentData);
                if (onTournamentUpdate) {
                    onTournamentUpdate(tournamentData);
                }
            }
        };

        const handleTournamentMessage = (message) => {
            console.log('💬 [useWebSocket] Получено сообщение турнира:', message);
            if (onChatMessage) {
                onChatMessage(message);
            }
        };

        // Подписываемся на события
        socket.on('tournament_updated', handleTournamentUpdate);
        socket.on('tournament_message', handleTournamentMessage);

        // Отслеживаем состояние подключения
        setWsConnected(socket.connected);

        // Cleanup
        return () => {
            console.log('🧹 [useWebSocket] Отписываемся от событий турнира');
            socket.off('tournament_updated', handleTournamentUpdate);
            socket.off('tournament_message', handleTournamentMessage);
            
            // Покидаем турнир
            if (socket.connected) {
                socket.tournament.leave(tournamentId);
            }
        };
    }, [tournamentId]); // Убрали все нестабильные зависимости

    // Функция для отправки сообщения чата турнира
    const sendChatMessage = useCallback((content) => {
        if (socket.connected && content.trim()) {
            socket.tournament.sendMessage(tournamentId, content.trim());
            console.log('📨 [useWebSocket] Отправлено сообщение турнира:', content);
            return true;
        }
        console.warn('⚠️ [useWebSocket] Не удалось отправить сообщение: нет подключения');
        return false;
    }, [tournamentId]); // Убрали socket из зависимостей

    // Функция для ручного переподключения
    const reconnectWebSocket = useCallback(() => {
        console.log('🔄 [useWebSocket] Ручное переподключение');
        const token = localStorage.getItem('token');
        if (token) {
            socket.connect(token);
        }
    }, []); // Убрали socket из зависимостей

    // Функция для отключения
    const disconnectWebSocket = useCallback(() => {
        console.log('🔌 [useWebSocket] Отключение');
        if (socket.connected && tournamentId) {
            socket.tournament.leave(tournamentId);
        }
        setWsConnected(false);
    }, [tournamentId]); // Убрали socket из зависимостей

    return {
        // Состояние
        wsConnected: socket.connected,
        
        // Функции
        sendChatMessage,
        reconnectWebSocket,
        disconnectWebSocket,
        
        // Объект сокета для совместимости
        wsRef: { current: socket.getSocket() }
    };
}; 