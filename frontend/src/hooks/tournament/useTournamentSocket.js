import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'https://1337community.com';

/**
 * Хук для подключения к WebSocket событиям турнира
 * Обеспечивает live обновления участников, матчей и статуса турнира
 */
function useTournamentSocket({ 
    tournamentId, 
    user, 
    onTournamentUpdate,
    onParticipantUpdate,
    onError 
}) {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            console.log(`🔌 [useTournamentSocket] Отключение от турнира ${tournamentId}`);
            socketRef.current.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        }
    }, [tournamentId]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        
        // Не создаем socket если нет критичных параметров
        if (!tournamentId || !token) {
            if (tournamentId) {
                console.warn('⚠️ [useTournamentSocket] Пропускаем подключение:', { 
                    tournamentId,
                    hasToken: !!token
                });
            }
            return;
        }

        console.log(`🔌 [useTournamentSocket] Инициализация подключения к турниру ${tournamentId}`);
        
        // Создаем socket соединение
        const socket = io(API_URL, { 
            auth: { token }, 
            transports: ['polling', 'websocket'],
            upgrade: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: maxReconnectAttempts,
            timeout: 10000
        });
        
        socketRef.current = socket;

        // Обработчик подключения
        socket.on('connect', () => {
            console.log(`✅ [useTournamentSocket] Socket подключен`, { 
                socketId: socket.id,
                tournamentId
            });
            
            setIsConnected(true);
            reconnectAttemptsRef.current = 0;
            
            // Присоединяемся к комнате турнира
            socket.emit('join_tournament', { 
                tournamentId: Number(tournamentId),
                userId: user?.id 
            });
            
            console.log(`📡 [useTournamentSocket] Присоединились к комнате tournament_${tournamentId}`);
        });

        // Получение обновлений турнира
        socket.on('tournament_update', (data) => {
            console.log(`🔄 [useTournamentSocket] tournament_update получено:`, data);
            if (data && onTournamentUpdate) {
                onTournamentUpdate(data);
            }
        });

        // Специальное событие для обновлений участников
        socket.on('participant_update', (data) => {
            console.log(`👥 [useTournamentSocket] participant_update получено:`, data);
            if (data && onParticipantUpdate) {
                onParticipantUpdate(data);
            }
        });

        // Обработчики ошибок
        socket.on('error', (error) => {
            console.error(`❌ [useTournamentSocket] Socket error:`, error);
            if (onError) {
                onError(error);
            }
        });

        socket.on('connect_error', (error) => {
            console.error(`❌ [useTournamentSocket] Connect error:`, error);
            setIsConnected(false);
            reconnectAttemptsRef.current++;
            
            if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
                console.error(`❌ [useTournamentSocket] Превышено максимальное количество попыток переподключения`);
                if (onError) {
                    onError(new Error('Не удалось подключиться к серверу'));
                }
            }
        });

        socket.on('disconnect', (reason) => {
            console.log(`🔌 [useTournamentSocket] Отключено:`, reason);
            setIsConnected(false);
            
            // Автоматически переподключаемся если отключение не было инициировано клиентом
            if (reason === 'io server disconnect') {
                console.log(`🔄 [useTournamentSocket] Сервер отключил соединение, переподключаемся...`);
                socket.connect();
            }
        });

        // Очистка при размонтировании
        return () => {
            console.log(`🔌 [useTournamentSocket] Очистка подключения для турнира ${tournamentId}`);
            if (socket.connected) {
                socket.emit('leave_tournament', { tournamentId: Number(tournamentId) });
            }
            socket.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        };
    }, [tournamentId, user?.id, onTournamentUpdate, onParticipantUpdate, onError]);

    return {
        socket: socketRef.current,
        isConnected,
        disconnect
    };
}

export default useTournamentSocket;

