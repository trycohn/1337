import { useEffect, useRef, useState } from 'react';

/**
 * useRealTimeStats — нативный WebSocket-клиент для /ws/stats
 * Совместим с backend/services/realTimeStatsService.js (ws, не socket.io)
 */
function useRealTimeStats(userId, onStatsUpdate) {
    const [connected, setConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectDelayRef = useRef(1000);
    const updateHandlerRef = useRef(onStatsUpdate);

    // Держим актуальный колбэк в ref, чтобы не пересоздавать соединение
    useEffect(() => {
        updateHandlerRef.current = onStatsUpdate;
    }, [onStatsUpdate]);

    useEffect(() => {
        if (!userId) return;

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = (process.env.REACT_APP_WS_HOST || window.location.host);
        const wsUrl = `${protocol}://${host}/ws/stats`;
        const token = localStorage.getItem('token');

        let closedByUser = false;

        const connect = () => {
            try {
                console.log('🔌 [Real-time] Подключение к', wsUrl);
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    setConnected(true);
                    reconnectDelayRef.current = 1000; // сброс backoff
                    // Аутентификация/подписка согласно backend API
                    ws.send(JSON.stringify({
                        type: 'subscribe_stats',
                        userId,
                        token
                    }));
                };

                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.type === 'stats_update' && updateHandlerRef.current) {
                            updateHandlerRef.current({ type: 'stats', data: msg.data });
                        } else if ((msg.type === 'achievement_unlocked' || msg.type === 'achievement') && updateHandlerRef.current) {
                            updateHandlerRef.current({ type: 'achievement', data: msg.data });
                        } else if ((msg.type === 'level_up' || msg.type === 'levelUp') && updateHandlerRef.current) {
                            updateHandlerRef.current({ type: 'levelUp', data: msg.data });
                        }
                    } catch (_) {}
                };

                ws.onerror = () => {
                    // Ошибку логируем, авто-reconnect сработает в onclose
                };

                ws.onclose = () => {
                    setConnected(false);
                    if (closedByUser) return;
                    // Экспоненциальный backoff до 30s
                    const delay = Math.min(reconnectDelayRef.current, 30000);
                    setTimeout(() => {
                        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
                        connect();
                    }, delay);
                };
            } catch (e) {
                // Попытка повторного подключения с backoff
                setTimeout(connect, reconnectDelayRef.current);
                reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
            }
        };

        connect();

        return () => {
            closedByUser = true;
            try { wsRef.current && wsRef.current.close(); } catch (_) {}
            wsRef.current = null;
        };
    }, [userId]);

    const send = (payload) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
        }
    };

    const subscribeToUser = (targetUserId) => send({ type: 'subscribe_stats', userId: targetUserId, token: localStorage.getItem('token') });
    const unsubscribeFromUser = (targetUserId) => send({ type: 'unsubscribe_stats', userId: targetUserId });

    return { connected, subscribeToUser, unsubscribeFromUser };
}

export default useRealTimeStats;

