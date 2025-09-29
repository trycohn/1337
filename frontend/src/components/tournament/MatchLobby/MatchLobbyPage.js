// 🎮 MatchLobbyPage - Страница лобби матча для CS2
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../../context/UserContext';
// Убираем прямое WS‑подключение; используем polling API для live
import MapSelectionBoard from './MapSelectionBoard';
import ParticipantStatus from './ParticipantStatus';
import './MatchLobby.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function MatchLobbyPage() {
    const { lobbyId } = useParams();
    const navigate = useNavigate();
    const { user } = useUser();
    
    const [lobby, setLobby] = useState(null);
    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ready, setReady] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(null);

    // 🔄 Polling вместо WS
    useEffect(() => {
        if (!user || !lobbyId) return;
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
                        setError(null);
                    }
                }
            } catch (e) {}
            timer = setTimeout(pull, 1500);
        };
        pull();
        return () => { if (timer) clearTimeout(timer); };
    }, [user, lobbyId, navigate]);

    // 🎯 Загрузка информации о лобби
    const fetchLobbyInfo = useCallback(async () => {
        if (!user || !lobbyId) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/lobby/${lobbyId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки лобби');
            }

            const data = await response.json();
            if (data.success) {
                setLobby(data.lobby);
                if (data.lobby.match_format) setSelectedFormat(data.lobby.match_format);
            } else {
                throw new Error(data.error || 'Ошибка загрузки');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки лобби:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [user, lobbyId]);

    useEffect(() => { fetchLobbyInfo(); }, [fetchLobbyInfo]);

    // ✅ Установка готовности
    const handleReadyToggle = useCallback(async () => {
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
        setSelectedFormat(format);
    }, [lobby]);

    // 🗺️ Обработка выбора карты
    const handleMapAction = useCallback(async (mapName, action) => {
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
    }, [lobbyId]);

    // 🔄 Определение моей команды
    const getMyTeamId = useCallback(() => {
        if (lobby && lobby.user_team_id) return lobby.user_team_id;
        return null;
    }, [lobby]);

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