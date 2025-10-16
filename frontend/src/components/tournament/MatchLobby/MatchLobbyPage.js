// 🎮 MatchLobbyPage - Страница лобби матча для CS2
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../../context/UserContext';
import io from 'socket.io-client';
import MapSelectionBoard from './MapSelectionBoard';
import ParticipantStatus from './ParticipantStatus';
import './MatchLobby.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function MatchLobbyPage() {
    const { lobbyId } = useParams();
    const navigate = useNavigate();
    const { user } = useUser();
    
    // 🔍 ДИАГНОСТИКА
    console.log('🎮 [MatchLobbyPage] Компонент инициализирован:', {
        lobbyId,
        userId: user?.id,
        hasSteamId: !!(user?.steam_id || user?.steamId)
    });
    
    const [lobby, setLobby] = useState(null);
    const socketRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ready, setReady] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(null);
    const redirectedRef = useRef(false);
    const [steamModalOpen, setSteamModalOpen] = useState(false);

    // Socket.IO подключение для мгновенных обновлений
    useEffect(() => {
        if (!user || !lobbyId) return;
        if (!user.steam_id && !user.steamId) {
            setSteamModalOpen(true);
            setLoading(false);
            return;
        }
        const token = localStorage.getItem('token');
        const socket = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
        socketRef.current = socket;
        
        socket.on('connect', () => {
            console.log('[TOURNAMENT_LOBBY] Socket connected');
            socket.emit('join_lobby', { lobbyId: Number(lobbyId) });
        });
        
        socket.on('lobby_state', (data) => {
            console.log('[TOURNAMENT_LOBBY] lobby_state received', data);
            if (data) {
                setLobby(data);
                if (data.match_format) setSelectedFormat(data.match_format);
                setLoading(false);
            }
        });
        
        socket.on('lobby_update', (data) => {
            console.log('[TOURNAMENT_LOBBY] lobby_update', data);
            if (data) {
                setLobby(data);
                if (data.match_format) setSelectedFormat(data.match_format);
            }
        });
        
        socket.on('lobby_completed', (data) => {
            console.log('[TOURNAMENT_LOBBY] lobby_completed', data);
            if (data?.matchId && !redirectedRef.current) {
                redirectedRef.current = true;
                const tId = data.tournamentId;
                const target = tId ? `/tournaments/${tId}/match/${data.matchId}` : `/matches/custom/${data.matchId}`;
                try { navigate(target); } catch(_) {}
            }
        });
        
        return () => { socket.disconnect(); socketRef.current = null; };
    }, [user, lobbyId]);

    // Фолбек polling (на случай если Socket.IO недоступен)
    useEffect(() => {
        if (!user || !lobbyId) return;
        if (!user.steam_id && !user.steamId) return;
        const token = localStorage.getItem('token');
        let timer = null;
        const pull = async () => {
            try {
                const response = await fetch(`${API_URL}/api/tournaments/lobby/${lobbyId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        setLobby(data.lobby);
                        if (data.lobby.match_format) setSelectedFormat(data.lobby.match_format);
                        // 🧭 Авто-редирект на страницу матча ПОСЛЕ завершения матча на сервере
                        if (!redirectedRef.current && data.lobby.status === 'completed' && data.lobby.match_id) {
                            redirectedRef.current = true;
                            const tId = data.lobby.tournament_id;
                            const target = tId ? `/tournaments/${tId}/match/${data.lobby.match_id}` : `/matches/custom/${data.lobby.match_id}`;
                            try { navigate(target); } catch(_) {}
                            return;
                        }
                        setError(null);
                    }
                }
            } catch (e) {}
            timer = setTimeout(pull, 5000);
        };
        timer = setTimeout(pull, 5000);
        return () => { if (timer) clearTimeout(timer); };
    }, [user, lobbyId, navigate]);

    // 🎯 Загрузка информации о лобби
    const fetchLobbyInfo = useCallback(async () => {
        console.log('🔍 [fetchLobbyInfo] Начало загрузки:', { user: !!user, lobbyId });
        
        if (!user || !lobbyId) {
            console.warn('⚠️ [fetchLobbyInfo] Нет пользователя или lobbyId');
            return;
        }
        
        if (!user.steam_id && !user.steamId) { 
            console.warn('⚠️ [fetchLobbyInfo] У пользователя нет Steam ID');
            setSteamModalOpen(true); 
            setLoading(false); 
            return; 
        }
        
        try {
            const token = localStorage.getItem('token');
            const url = `${API_URL}/api/tournaments/lobby/${lobbyId}`;
            console.log('📡 [fetchLobbyInfo] Запрос к:', url);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('📡 [fetchLobbyInfo] Ответ получен:', { 
                ok: response.ok, 
                status: response.status,
                statusText: response.statusText
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [fetchLobbyInfo] Ошибка ответа:', errorText);
                throw new Error(`Ошибка загрузки лобби (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            console.log('📊 [fetchLobbyInfo] Данные получены:', data);
            
            if (data.success) {
                setLobby(data.lobby);
                if (data.lobby.match_format) setSelectedFormat(data.lobby.match_format);
                console.log('✅ [fetchLobbyInfo] Лобби загружено успешно');
            } else {
                throw new Error(data.error || 'Ошибка загрузки');
            }
        } catch (error) {
            console.error('❌ [fetchLobbyInfo] Ошибка загрузки лобби:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [user, lobbyId]);

    useEffect(() => { fetchLobbyInfo(); }, [fetchLobbyInfo]);

    // ✅ Установка готовности
    const handleReadyToggle = useCallback(async () => {
        try {
            if (!user?.steam_id && !user?.steamId) { setSteamModalOpen(true); return; }
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
                throw new Error('Ошибка установки готовности');
            }

            const data = await response.json();
            if (data.success) {
                setReady(!ready);
                // Принудительно обновим состояние лобби, т.к. WS может быть недоступен
                await fetchLobbyInfo();
            }
        } catch (error) {
            console.error('❌ Ошибка установки готовности:', error);
        }
    }, [lobbyId, ready, fetchLobbyInfo]);

    // 🎲 Выбор формата матча
    const handleFormatSelect = useCallback((format) => {
        if (lobby?.match_format) {
            // Формат уже установлен в настройках турнира
            return;
        }
        if (!user?.steam_id && !user?.steamId) { setSteamModalOpen(true); return; }
        setSelectedFormat(format);
    }, [lobby, user]);

    // 🗺️ Обработка выбора карты
    const handleMapAction = useCallback(async (mapName, action) => {
        try {
            if (!user?.steam_id && !user?.steamId) { setSteamModalOpen(true); return; }
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
                throw new Error('Ошибка выбора карты');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Ошибка');
            }
        } catch (error) {
            console.error('❌ Ошибка выбора карты:', error);
            alert(error.message);
        }
    }, [lobbyId, user]);

    // 🔄 Определение моей команды
    const getMyTeamId = useCallback(() => {
        if (lobby && lobby.user_team_id) return lobby.user_team_id;
        return null;
    }, [lobby]);

    const onSteamModalClose = useCallback(() => {
        setSteamModalOpen(false);
        // Возврат назад, чтобы не попадать в лобби
        try { navigate(-1); } catch (_) {}
    }, [navigate]);

    const onSteamLink = useCallback(() => {
        // Редиректим на backend steam login (OpenID) или страницу привязки
        const base = process.env.REACT_APP_API_URL || '';
        window.location.href = `${base}/api/users/steam-login`;
    }, []);

    if (loading) {
        return (
            <div className="lobby-match-lobby-page">
                <div className="lobby-loading">
                    <h2>🔄 Загрузка лобби...</h2>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="lobby-match-lobby-page">
                <div className="lobby-error">
                    <h2>❌ Ошибка</h2>
                    <p>{error}</p>
                    <button onClick={() => navigate(-1)}>Назад</button>
                </div>
            </div>
        );
    }

    if (steamModalOpen) {
        return (
            <div className="lobby-match-lobby-page">
                <div className="steam-modal-backdrop" onClick={onSteamModalClose} />
                <div className="steam-modal" role="dialog" aria-modal="true">
                    <h3>Привяжите Steam</h3>
                    <p>Вы не можете участвовать в лобби без привязки Steam аккаунта.</p>
                    <div className="steam-modal-actions">
                        <button className="btn btn-primary" onClick={onSteamLink}>Привязать Steam</button>
                        <button className="btn btn-secondary" onClick={onSteamModalClose}>Закрыть</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!lobby) {
        return (
            <div className="lobby-match-lobby-page">
                <div className="lobby-error">
                    <h2>❌ Лобби не найдено</h2>
                    <button onClick={() => navigate(-1)}>Назад</button>
                </div>
            </div>
        );
    }

    return (
        <div className="lobby-match-lobby-page">
            {/* Хедер */}
            <div className="lobby-header">
                <div className="lobby-tournament-info">
                    <h1>{lobby.tournament_name}</h1>
                </div>
                <div className="lobby-match-info">
                    <h2>{lobby.team1_name} vs {lobby.team2_name}</h2>
                    <p>Раунд {lobby.round || '?'}</p>
                </div>
            </div>

            {/* Выбор формата матча */}
            {!selectedFormat && lobby.status === 'waiting' && (
                <div className="lobby-format-selection">
                    <h3>Выберите формат матча:</h3>
                    <div className="lobby-format-buttons">
                        <button 
                            className="lobby-format-button"
                            onClick={() => handleFormatSelect('bo1')}
                        >
                            Best of 1
                        </button>
                        <button 
                            className="lobby-format-button"
                            onClick={() => handleFormatSelect('bo3')}
                        >
                            Best of 3
                        </button>
                        <button 
                            className="lobby-format-button"
                            onClick={() => handleFormatSelect('bo5')}
                        >
                            Best of 5
                        </button>
                    </div>
                </div>
            )}

            {/* Статусы участников */}
            <ParticipantStatus
                team1={{
                    id: lobby.team1_id,
                    name: lobby.team1_name,
                    ready: lobby.team1_ready
                }}
                team2={{
                    id: lobby.team2_id,
                    name: lobby.team2_name,
                    ready: lobby.team2_ready
                }}
                myTeamId={getMyTeamId()}
                onReadyToggle={handleReadyToggle}
                ready={ready}
                canToggle={lobby.status === 'waiting' && !!getMyTeamId()}
            />

            {/* Доска выбора карт */}
            {selectedFormat && lobby.available_maps && (
                <MapSelectionBoard
                    maps={lobby.available_maps}
                    selections={lobby.selections || []}
                    currentTurn={lobby.current_turn_team_id}
                    myTeamId={getMyTeamId()}
                    format={selectedFormat}
                    status={lobby.status}
                    onMapAction={handleMapAction}
                    teamNames={{
                        [lobby.team1_id]: lobby.team1_name,
                        [lobby.team2_id]: lobby.team2_name
                    }}
                />
            )}

            {/* Статус лобби */}
            <div className="lobby-status">
                {lobby.status === 'waiting' && (
                    <p>⏳ Ожидание готовности всех участников...</p>
                )}
                {lobby.status === 'ready' && (
                    <p>⏳ Ожидание назначения первого выбирающего администратором...</p>
                )}
                {lobby.status === 'picking' && (
                    <p>🎯 Идет выбор карт...</p>
                )}
                {lobby.status === 'completed' && (
                    <p>✅ Выбор карт завершен! Перенаправление...</p>
                )}
            </div>
        </div>
    );
}

export default MatchLobbyPage; 