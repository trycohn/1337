import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

/**
 * useRealTimeStats - Хук для получения live обновлений статистики
 * Подключается к WebSocket и обновляет статистику в реальном времени
 */
function useRealTimeStats(userId, onStatsUpdate) {
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    useEffect(() => {
        if (!userId) return;

        const connectSocket = () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            console.log('🔌 [Real-time] Подключение к WebSocket для статистики...');

            const socket = io(process.env.REACT_APP_WS_URL || window.location.origin, {
                path: '/ws/stats',
                transports: ['websocket', 'polling'],
                auth: { token },
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5
            });

            socket.on('connect', () => {
                console.log('✅ [Real-time] Подключено к WebSocket');
                setConnected(true);
                
                // Подписываемся на обновления статистики
                socket.emit('subscribe:stats', { userId });
            });

            socket.on('disconnect', (reason) => {
                console.log('❌ [Real-time] Отключено от WebSocket:', reason);
                setConnected(false);
            });

            socket.on('connect_error', (error) => {
                console.error('❌ [Real-time] Ошибка подключения:', error.message);
                setConnected(false);
            });

            // Обновления статистики
            socket.on('stats:updated', (data) => {
                console.log('📊 [Real-time] Получено обновление статистики');
                if (onStatsUpdate) {
                    onStatsUpdate(data);
                }
            });

            // Уведомление о новом достижении
            socket.on('achievement:unlocked', (data) => {
                console.log('🏆 [Real-time] Разблокировано достижение:', data.achievement);
                if (onStatsUpdate) {
                    onStatsUpdate({ type: 'achievement', data });
                }
            });

            // Обновление уровня
            socket.on('level:up', (data) => {
                console.log('⭐ [Real-time] Повышение уровня:', data.newLevel);
                if (onStatsUpdate) {
                    onStatsUpdate({ type: 'levelUp', data });
                }
            });

            socketRef.current = socket;
        };

        connectSocket();

        return () => {
            if (socketRef.current) {
                console.log('🔌 [Real-time] Отключение от WebSocket');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [userId, onStatsUpdate]);

    const subscribeToUser = (targetUserId) => {
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('subscribe:stats', { userId: targetUserId });
        }
    };

    const unsubscribeFromUser = (targetUserId) => {
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('unsubscribe:stats', { userId: targetUserId });
        }
    };

    return {
        connected,
        subscribeToUser,
        unsubscribeFromUser
    };
}

export default useRealTimeStats;

