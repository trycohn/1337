// 🎮 useTournamentLobby - Хук для турнирного лобби
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useLobbySocket from '../shared/useLobbySocket';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function useTournamentLobby(lobbyId, user) {
    const navigate = useNavigate();
    const [lobby, setLobby] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ready, setReady] = useState(false); // По умолчанию НЕ готов
    const [selectedFormat, setSelectedFormat] = useState(null);
    const [steamModalOpen, setSteamModalOpen] = useState(false);
    const redirectedRef = useRef(false);

    // Сброс готовности при смене лобби
    useEffect(() => {
        setReady(false);
        console.log('[useTournamentLobby] Сброс готовности для лобби:', lobbyId);
    }, [lobbyId]);

    // Автоматический редирект на матч после завершения
    useEffect(() => {
        if (!lobby || redirectedRef.current) return;
        
        if (lobby.status === 'completed' && lobby.match_id) {
            console.log('🎉 [useTournamentLobby] Лобби завершено, редирект на матч:', lobby.match_id);
            redirectedRef.current = true;
            
            const timer = setTimeout(() => {
                navigate(`/tournaments/${lobby.tournament_id}/matches/${lobby.match_id}`);
            }, 2000);
            
            return () => clearTimeout(timer);
        }
    }, [lobby, navigate]);

    // Загрузка информации о лобби
    const fetchLobbyInfo = useCallback(async () => {
        if (!user || !lobbyId) {
            console.warn('⚠️ [useTournamentLobby] Нет пользователя или lobbyId');
            return;
        }
        
        if (!user.steam_id && !user.steamId) { 
            setSteamModalOpen(true); 
            setLoading(false); 
            return; 
        }
        
        try {
            const token = localStorage.getItem('token');
            const url = `${API_URL}/api/tournaments/lobby/${lobbyId}`;
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                // ⏰ Лобби устарело (410 Gone)
                if (response.status === 410) {
                    const errorData = await response.json();
                    setError(errorData.message || 'Это лобби больше недоступно');
                    setLoading(false);
                    return;
                }
                
                // Если лобби не найдено, пробуем найти активное
                if (response.status === 404 || response.status === 500) {
                    const activeLobbiesResponse = await fetch(`${API_URL}/api/tournaments/lobbies/active`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (activeLobbiesResponse.ok) {
                        const activeData = await activeLobbiesResponse.json();
                        
                        if (activeData.success && activeData.lobbies?.length > 0) {
                            const activeLobby = activeData.lobbies[0];
                            navigate(`/match-lobby/${activeLobby.id}`, { replace: true });
                            return;
                        }
                    }
                }
                
                throw new Error(`Ошибка загрузки лобби (${response.status})`);
            }

            const data = await response.json();
            
            if (data.success) {
                setLobby(data.lobby);
                if (data.lobby.match_format) setSelectedFormat(data.lobby.match_format);
            } else {
                throw new Error(data.error || 'Ошибка загрузки');
            }
        } catch (error) {
            console.error('❌ [useTournamentLobby] Ошибка загрузки лобби:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [user, lobbyId, navigate]);

    useEffect(() => { 
        fetchLobbyInfo(); 
    }, [fetchLobbyInfo]);

    // 🔄 Live обновление состояния лобби каждые 3 секунды
    useEffect(() => {
        if (!lobbyId || !user) return;
        
        let isActive = true;
        
        const poll = async () => {
            if (!isActive || !lobbyId || !user) return;
            
            const token = localStorage.getItem('token');
            const url = `${API_URL}/api/tournaments/lobby/${lobbyId}`;
            
            try {
                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok && isActive) {
                    const data = await response.json();
                    if (data.success && data.lobby) {
                        setLobby(data.lobby);
                        if (data.lobby.match_format) setSelectedFormat(data.lobby.match_format);
                    }
                }
            } catch (err) {
                // Игнорируем ошибки polling
            }
        };
        
        const interval = setInterval(poll, 3000);
        
        return () => {
            isActive = false;
            clearInterval(interval);
        };
    }, [lobbyId, user]);

    // Установка готовности
    const handleReadyToggle = useCallback(async () => {
        if (!user?.steam_id && !user?.steamId) { 
            setSteamModalOpen(true); 
            return; 
        }
        
        // Оптимистичное обновление
        setReady(!ready);
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/lobby/${lobbyId}/ready`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ready: !ready })
            });

            if (!response.ok) {
                // Откат при ошибке
                setReady(ready);
                throw new Error('Ошибка установки готовности');
            }

            const data = await response.json();
            
            if (!data.success) {
                setReady(ready);
            }
        } catch (error) {
            console.error('❌ [useTournamentLobby] Ошибка готовности:', error);
        }
    }, [user, lobbyId, ready, setSteamModalOpen]);

    // Действие с картой (pick/ban)
    const handleMapAction = useCallback(async (mapName, action) => {
        if (!user?.steam_id && !user?.steamId) {
            setSteamModalOpen(true);
            return;
        }

        console.log('[useTournamentLobby] Действие с картой:', { mapName, action });

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/lobby/${lobbyId}/select-map`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mapName, action })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[useTournamentLobby] Ошибка от сервера:', errorData);
                throw new Error(errorData.error || 'Ошибка действия с картой');
            }

            const data = await response.json();
            console.log('[useTournamentLobby] Ответ сервера:', data);
            
            if (!data.success) throw new Error(data.error);
            
            console.log('✅ [useTournamentLobby] Действие успешно выполнено');
            
        } catch (error) {
            console.error('❌ [useTournamentLobby] Ошибка действия с картой:', error);
        }
    }, [user, lobbyId, setSteamModalOpen]);

    // Ручной запуск процедуры пик/бан
    const startPickBan = useCallback(async () => {
        if (!user?.steam_id && !user?.steamId) {
            setSteamModalOpen(true);
            return;
        }

        console.log('[useTournamentLobby] Запуск процедуры пик/бан для лобби:', lobbyId);

        try {
            const token = localStorage.getItem('token');
            console.log('[useTournamentLobby] Отправка запроса POST /api/tournaments/lobby/' + lobbyId + '/start-pickban');
            
            const response = await fetch(`${API_URL}/api/tournaments/lobby/${lobbyId}/start-pickban`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('[useTournamentLobby] Ответ сервера:', {
                ok: response.ok,
                status: response.status
            });

            if (!response.ok) {
                const data = await response.json();
                console.error('[useTournamentLobby] Ошибка от сервера:', data);
                throw new Error(data.error || 'Ошибка запуска процедуры');
            }

            const data = await response.json();
            console.log('[useTournamentLobby] Данные ответа:', data);
            
            if (!data.success) {
                console.error('[useTournamentLobby] success = false');
                throw new Error(data.error);
            }
            
            console.log('✅ [useTournamentLobby] Процедура успешно запущена');
            
        } catch (error) {
            console.error('❌ [useTournamentLobby] Ошибка запуска процедуры:', error);
            alert(error.message);
        }
    }, [user, lobbyId, setSteamModalOpen]);

    // WebSocket подключение
    const handleLobbyState = useCallback((data) => {
        if (data) {
            setLobby(data);
            if (data.match_format) setSelectedFormat(data.match_format);
            setLoading(false);
        }
    }, []);

    const handleLobbyUpdate = useCallback((data) => {
        if (data) {
            setLobby(data);
            if (data.match_format) setSelectedFormat(data.match_format);
        }
    }, []);

    const handlePlayerReadyUpdate = useCallback((data) => {
        console.log('[useTournamentLobby] WebSocket: готовность игрока:', data);
        // Обновление готовности приходит через общий update
    }, []);

    const handleSocketError = useCallback((error) => {
        console.error('❌ [useTournamentLobby] Socket error:', error);
        setError(error.message || 'Ошибка подключения');
    }, []);

    const { socket } = useLobbySocket({
        lobbyId,
        user,
        onLobbyState: handleLobbyState,
        onLobbyUpdate: handleLobbyUpdate,
        onError: handleSocketError,
        lobbyType: 'tournament'
    });

    // Слушаем обновления готовности игроков
    useEffect(() => {
        if (!socket) return;
        
        const handlePlayerReadyEvent = (data) => {
            console.log('[useTournamentLobby] WebSocket: готовность игрока обновлена:', data);
            if (data.userId === user?.id && typeof data.ready === 'boolean') {
                setReady(data.ready);
            }
        };
        
        socket.on('lobby_update_player_ready', handlePlayerReadyEvent);
        
        return () => {
            socket.off('lobby_update_player_ready', handlePlayerReadyEvent);
        };
    }, [socket, user]);

    return {
        lobby,
        loading,
        error,
        ready,
        selectedFormat,
        steamModalOpen,
        setSteamModalOpen,
        handleReadyToggle,
        handleMapAction,
        startPickBan,
        socket
    };
}

export default useTournamentLobby;

