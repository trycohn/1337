// 🎮 MatchLobbyPage - Страница лобби матча для CS2
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../../context/UserContext';
import io from 'socket.io-client';
import MapSelectionBoard from './MapSelectionBoard';
import ParticipantStatus from './ParticipantStatus';
import './MatchLobby.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// 🔍 КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ - ДО РЕНДЕРА
console.log('🚨 [MatchLobbyPage] МОДУЛЬ ЗАГРУЖЕН');

function MatchLobbyPage() {
    console.log('🚨 [MatchLobbyPage] ФУНКЦИЯ ВЫЗВАНА - НАЧАЛО РЕНДЕРА');
    
    const { lobbyId } = useParams();
    console.log('🚨 [MatchLobbyPage] lobbyId из useParams:', lobbyId);
    
    const navigate = useNavigate();
    console.log('🚨 [MatchLobbyPage] navigate получен');
    
    const { user } = useUser();
    console.log('🚨 [MatchLobbyPage] user из context:', user);
    
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
        console.log('🔌 [MatchLobbyPage] Инициализация WebSocket:', { 
            hasUser: !!user, 
            lobbyId,
            hasSteamId: !!(user?.steam_id || user?.steamId)
        });
        
        if (!user || !lobbyId) {
            console.warn('⚠️ [MatchLobbyPage] Нет user или lobbyId, WebSocket не подключается');
            return;
        }
        
        if (!user.steam_id && !user.steamId) {
            console.warn('⚠️ [MatchLobbyPage] Нет Steam ID');
            setSteamModalOpen(true);
            setLoading(false);
            return;
        }
        
        const token = localStorage.getItem('token');
        console.log('🔌 [MatchLobbyPage] Создаем Socket.IO клиент к:', API_URL);
        const socket = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
        socketRef.current = socket;
        
        socket.on('connect', () => {
            console.log('✅ [TOURNAMENT_LOBBY] Socket connected', { 
                socketId: socket.id,
                lobbyId, 
                userId: user?.id 
            });
            socket.emit('join_lobby', { 
                lobbyId: Number(lobbyId),
                userId: user?.id 
            });
            console.log('📡 [TOURNAMENT_LOBBY] Отправлен join_lobby');
        });
        
        socket.on('lobby_state', (data) => {
            console.log('[TOURNAMENT_LOBBY] lobby_state received', data);
            if (data) {
                console.log('📊 [WebSocket] Статус лобби из lobby_state:', data.status);
                if (data.status === 'picking') {
                    console.log('🎮 [WebSocket] PICKING режим активирован через lobby_state!');
                }
                setLobby(data);
                if (data.match_format) setSelectedFormat(data.match_format);
                setLoading(false);
            }
        });
        
        socket.on('lobby_update', (data) => {
            console.log('[TOURNAMENT_LOBBY] lobby_update', data);
            if (data) {
                console.log('📊 [WebSocket] Статус лобби из lobby_update:', data.status);
                if (data.status === 'picking') {
                    console.log('🎮 [WebSocket] PICKING режим активирован через lobby_update!');
                }
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
                
                // 🔧 ЕСЛИ ЛОББИ НЕ НАЙДЕНО (404/500) - ПРОБУЕМ НАЙТИ АКТУАЛЬНОЕ ЛОББИ ДЛЯ МАТЧА
                if (response.status === 404 || response.status === 500) {
                    console.log('🔍 [fetchLobbyInfo] Лобби не найдено, ищем активное лобби для этого матча...');
                    try {
                        // Получаем информацию о лобби через API активных лобби
                        const activeLobbiesResponse = await fetch(`${API_URL}/api/tournaments/lobbies/active`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        
                        if (activeLobbiesResponse.ok) {
                            const activeData = await activeLobbiesResponse.json();
                            console.log('📊 [fetchLobbyInfo] Активные лобби:', activeData);
                            
                            // Если есть активные лобби, редиректим на первое
                            if (activeData.success && activeData.lobbies && activeData.lobbies.length > 0) {
                                const activeLobby = activeData.lobbies[0];
                                console.log('🔄 [fetchLobbyInfo] Редирект на актуальное лобби:', activeLobby.id);
                                navigate(`/match-lobby/${activeLobby.id}`, { replace: true });
                                return;
                            }
                        }
                    } catch (redirectError) {
                        console.error('❌ [fetchLobbyInfo] Ошибка при поиске активного лобби:', redirectError);
                    }
                }
                
                throw new Error(`Ошибка загрузки лобби (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            console.log('📊 [fetchLobbyInfo] Данные получены:', data);
            
            if (data.success) {
                console.log('📊 [fetchLobbyInfo] Детали лобби:', {
                    id: data.lobby.id,
                    status: data.lobby.status,
                    team1_ready: data.lobby.team1_ready,
                    team2_ready: data.lobby.team2_ready,
                    first_picker_team_id: data.lobby.first_picker_team_id,
                    current_turn_team_id: data.lobby.current_turn_team_id,
                    match_format: data.lobby.match_format
                });
                
                if (data.lobby.status === 'picking') {
                    console.log('🎮 [fetchLobbyInfo] СТАТУС = PICKING! Процедура бан/пик должна начаться');
                    console.log('🎯 [fetchLobbyInfo] Первым выбирает команда:', data.lobby.first_picker_team_id);
                    console.log('🎯 [fetchLobbyInfo] Текущий ход команды:', data.lobby.current_turn_team_id);
                }
                
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
        console.log('🔘 [handleReadyToggle] Нажата кнопка готовности:', { 
            currentReady: ready, 
            willBe: !ready,
            lobbyId,
            userId: user?.id
        });
        
        try {
            if (!user?.steam_id && !user?.steamId) { 
                console.warn('⚠️ [handleReadyToggle] У пользователя нет Steam ID');
                setSteamModalOpen(true); 
                return; 
            }
            
            const token = localStorage.getItem('token');
            const url = `${API_URL}/api/tournaments/lobby/${lobbyId}/ready`;
            console.log('📡 [handleReadyToggle] Отправка запроса к:', url);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ready: !ready })
            });

            console.log('📡 [handleReadyToggle] Ответ получен:', { 
                ok: response.ok, 
                status: response.status 
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [handleReadyToggle] Ошибка ответа:', errorText);
                throw new Error('Ошибка установки готовности');
            }

            const data = await response.json();
            console.log('📊 [handleReadyToggle] Данные ответа:', data);
            
            if (data.success) {
                setReady(!ready);
                console.log('✅ [handleReadyToggle] Готовность установлена, обновляем данные лобби');
                // Принудительно обновим состояние лобби, т.к. WS может быть недоступен
                await fetchLobbyInfo();
            }
        } catch (error) {
            console.error('❌ [handleReadyToggle] Ошибка установки готовности:', error);
        }
    }, [lobbyId, ready, fetchLobbyInfo, user]);

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