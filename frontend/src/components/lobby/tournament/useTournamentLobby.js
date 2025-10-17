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
    const [ready, setReady] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(null);
    const [steamModalOpen, setSteamModalOpen] = useState(false);
    const redirectedRef = useRef(false);

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

    // Установка готовности
    const handleReadyToggle = useCallback(async () => {
        if (!user?.steam_id && !user?.steamId) { 
            setSteamModalOpen(true); 
            return; 
        }
        
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

            if (!response.ok) throw new Error('Ошибка установки готовности');

            const data = await response.json();
            
            if (data.success) {
                setReady(!ready);
            }
        } catch (error) {
            console.error('❌ [useTournamentLobby] Ошибка готовности:', error);
        }
    }, [user, lobbyId, ready]);

    // Действие с картой (pick/ban)
    const handleMapAction = useCallback(async (mapName, action) => {
        if (!user?.steam_id && !user?.steamId) {
            setSteamModalOpen(true);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/lobby/${lobbyId}/map-action`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ map_name: mapName, action })
            });

            if (!response.ok) throw new Error('Ошибка действия с картой');

            const data = await response.json();
            if (!data.success) throw new Error(data.error);
            
        } catch (error) {
            console.error('❌ [useTournamentLobby] Ошибка действия с картой:', error);
        }
    }, [user, lobbyId]);

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
        socket
    };
}

export default useTournamentLobby;

