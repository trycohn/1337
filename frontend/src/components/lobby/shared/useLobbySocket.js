// 🔌 useLobbySocket - Переиспользуемый хук для WebSocket подключения к лобби
import { useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

/**
 * Хук для управления WebSocket подключением к лобби
 * @param {Object} params
 * @param {string|number} params.lobbyId - ID лобби
 * @param {Object} params.user - Объект пользователя
 * @param {Function} params.onLobbyState - Callback при получении состояния лобби
 * @param {Function} params.onLobbyUpdate - Callback при обновлении лобби
 * @param {Function} params.onError - Callback при ошибке
 * @param {string} params.lobbyType - Тип лобби ('tournament' | 'custom')
 * @returns {Object} { socket, isConnected, disconnect }
 */
function useLobbySocket({ 
    lobbyId, 
    user, 
    onLobbyState, 
    onLobbyUpdate, 
    onError,
    lobbyType = 'tournament'
}) {
    const socketRef = useRef(null);
    const isConnectedRef = useRef(false);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            console.log(`🔌 [useLobbySocket] Отключение от лобби ${lobbyId}`);
            socketRef.current.disconnect();
            socketRef.current = null;
            isConnectedRef.current = false;
        }
    }, [lobbyId]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        
        // Не создаем socket если нет критичных параметров
        if (!user || !lobbyId || !token) {
            if (lobbyId) {
                console.warn('⚠️ [useLobbySocket] Пропускаем подключение:', { 
                    hasUser: !!user, 
                    lobbyId,
                    hasToken: !!token
                });
            }
            return;
        }

        console.log(`🔌 [useLobbySocket] Инициализация подключения к ${lobbyType} лобби ${lobbyId}`);
        
        // ⚠️ Временно только polling пока не настроен WebSocket в Nginx
        const socket = io(API_URL, { 
            auth: { token }, 
            transports: ['polling', 'websocket'], // Сначала polling
            upgrade: true, // Позволит апгрейд когда WebSocket заработает
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });
        
        socketRef.current = socket;

        // Подключение
        socket.on('connect', () => {
            console.log(`✅ [useLobbySocket] Socket подключен`, { 
                socketId: socket.id,
                lobbyId, 
                userId: user?.id,
                lobbyType
            });
            
            isConnectedRef.current = true;
            
            // Присоединяемся к комнате лобби
            const roomEvent = lobbyType === 'tournament' ? 'join_lobby' : 'join_admin_lobby';
            socket.emit(roomEvent, { 
                lobbyId: Number(lobbyId),
                userId: user?.id 
            });
            
            console.log(`📡 [useLobbySocket] Отправлен ${roomEvent}`);
        });

        // Получение состояния лобби
        socket.on('lobby_state', (data) => {
            console.log(`[useLobbySocket ${lobbyType}] lobby_state received`, data);
            if (data && onLobbyState) {
                onLobbyState(data);
            }
        });

        // Обновление лобби
        socket.on('lobby_update', (data) => {
            console.log(`[useLobbySocket ${lobbyType}] lobby_update`, data);
            if (data && onLobbyUpdate) {
                onLobbyUpdate(data);
            }
        });

        // Ошибки
        socket.on('error', (error) => {
            console.error(`❌ [useLobbySocket ${lobbyType}] Socket error:`, error);
            if (onError) {
                onError(error);
            }
        });

        socket.on('connect_error', (error) => {
            console.error(`❌ [useLobbySocket ${lobbyType}] Connect error:`, error);
            isConnectedRef.current = false;
            if (onError) {
                onError(error);
            }
        });

        socket.on('disconnect', (reason) => {
            console.log(`🔌 [useLobbySocket ${lobbyType}] Отключено:`, reason);
            isConnectedRef.current = false;
        });

        // Очистка при размонтировании
        return () => {
            console.log(`🔌 [useLobbySocket] Очистка подключения для лобби ${lobbyId}`);
            socket.disconnect();
            socketRef.current = null;
            isConnectedRef.current = false;
        };
    }, [user, lobbyId, lobbyType, onLobbyState, onLobbyUpdate, onError]);

    return {
        socket: socketRef.current,
        isConnected: isConnectedRef.current,
        disconnect
    };
}

export default useLobbySocket;

