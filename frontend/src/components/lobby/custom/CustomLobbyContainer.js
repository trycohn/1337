// 🎮 CustomLobbyContainer - Контейнер кастомного лобби
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useCustomLobby from './useCustomLobby';
import LobbyHeader from '../shared/LobbyHeader';
import MapSelectionBoard from '../shared/MapSelectionBoard';
import ConnectionBlock from '../shared/ConnectionBlock';
import ObserverZone from '../shared/ObserverZone';
import FormatSelector from './FormatSelector';
import InvitePanel from './InvitePanel';
import api from '../../../axios';
import './CustomLobby.css';

function CustomLobbyContainer() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [invitePanelOpen, setInvitePanelOpen] = useState(false);
    const [invitePanelTeam, setInvitePanelTeam] = useState(null);

    const {
        lobbyId,
        lobby,
        availableMaps,
        selections,
        team1Users,
        team2Users,
        unassignedUsers,
        playerReady,
        loading,
        canInvite,
        ensureAdminLobby,
        inviteUserToTeam,
        removeUserFromLobby,
        setMatchFormat,
        togglePlayerReady,
        handleMapAction,
        createMatch,
        clearLobby
    } = useCustomLobby(user, isAdmin);

    // Загрузка пользователя
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        
        api.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => {
                setUser(r.data);
                setIsAdmin(r.data?.role === 'admin');
            })
            .catch(() => navigate('/login'));
    }, [navigate]);

    // Создание лобби при монтировании
    useEffect(() => {
        if (isAdmin && !lobbyId) {
            ensureAdminLobby();
        }
    }, [isAdmin, lobbyId, ensureAdminLobby]);

    const openInvitePanel = useCallback((team) => {
        setInvitePanelTeam(team);
        setInvitePanelOpen(true);
    }, []);

    const closeInvitePanel = useCallback(() => {
        setInvitePanelOpen(false);
        setInvitePanelTeam(null);
    }, []);

    const handleDragStart = (e, user) => {
        e.dataTransfer.setData('text/plain', String(user.id));
    };

    const handleDrop = (team) => (e) => {
        e.preventDefault();
        const userId = e.dataTransfer.getData('text/plain');
        if (userId) {
            inviteUserToTeam(Number(userId), team);
        }
    };

    if (!isAdmin) {
        return (
            <div className="custom-lobby-container">
                <div className="lobby-access-denied">
                    <span className="error-icon">🚫</span>
                    <span>Доступ запрещен</span>
                    <p>Только администраторы могут создавать кастомные матчи</p>
                    <button onClick={() => navigate('/')} className="btn-back">
                        На главную
                    </button>
                </div>
            </div>
        );
    }

    if (loading && !lobbyId) {
        return (
            <div className="custom-lobby-container">
                <div className="lobby-loading">
                    <span className="loading-icon">⏳</span>
                    <span>Создание лобби...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="custom-lobby-container">
            {/* Заголовок */}
            <LobbyHeader
                team1Name={lobby?.team1_name || 'Команда 1'}
                team2Name={lobby?.team2_name || 'Команда 2'}
                matchFormat={lobby?.match_format}
                lobbyType="custom"
            />

            {/* Выбор формата */}
            {lobby?.status === 'waiting' && (
                <FormatSelector
                    currentFormat={lobby?.match_format}
                    onFormatChange={setMatchFormat}
                    disabled={false}
                />
            )}

            {/* Составы команд */}
            <div className="custom-lobby-teams">
                {/* Команда 1 */}
                <div 
                    className="custom-team-section"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop(1)}
                >
                    <div className="custom-team-header">
                        <h3>Команда 1</h3>
                        <button 
                            className="btn-add-player"
                            onClick={() => openInvitePanel(1)}
                        >
                            + Добавить
                        </button>
                    </div>
                    <div className="custom-team-players">
                        {team1Users.map(u => (
                            <div key={u.id} className="custom-player-card" draggable onDragStart={(e) => handleDragStart(e, u)}>
                                <img src={u.avatar || '/default-avatar.png'} alt={u.username} onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                                <span>{u.username || u.display_name}</span>
                                <button 
                                    className="btn-ready-toggle"
                                    onClick={() => togglePlayerReady(u.id, 1)}
                                >
                                    {playerReady[u.id] ? '✅' : '❌'}
                                </button>
                                <button 
                                    className="btn-remove"
                                    onClick={() => removeUserFromLobby(u.id)}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Команда 2 */}
                <div 
                    className="custom-team-section"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop(2)}
                >
                    <div className="custom-team-header">
                        <h3>Команда 2</h3>
                        <button 
                            className="btn-add-player"
                            onClick={() => openInvitePanel(2)}
                        >
                            + Добавить
                        </button>
                    </div>
                    <div className="custom-team-players">
                        {team2Users.map(u => (
                            <div key={u.id} className="custom-player-card" draggable onDragStart={(e) => handleDragStart(e, u)}>
                                <img src={u.avatar || '/default-avatar.png'} alt={u.username} onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                                <span>{u.username || u.display_name}</span>
                                <button 
                                    className="btn-ready-toggle"
                                    onClick={() => togglePlayerReady(u.id, 2)}
                                >
                                    {playerReady[u.id] ? '✅' : '❌'}
                                </button>
                                <button 
                                    className="btn-remove"
                                    onClick={() => removeUserFromLobby(u.id)}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Пик/бан карт */}
            {(lobby?.status === 'ready' || lobby?.status === 'picking') && (
                <MapSelectionBoard
                    maps={availableMaps}
                    selections={selections}
                    currentTurn={lobby?.current_turn_team_id}
                    myTeamId={null} // В custom админ управляет всем
                    format={lobby?.match_format}
                    status={lobby?.status}
                    onMapAction={handleMapAction}
                    teamNames={{
                        1: lobby?.team1_name || 'Команда 1',
                        2: lobby?.team2_name || 'Команда 2'
                    }}
                    isCaptain={true} // Админ всегда может выбирать
                />
            )}

            {/* Подключение к серверу */}
            {lobby?.status === 'ready_to_create' && (
                <div className="custom-match-actions">
                    <button className="btn-create-match" onClick={createMatch}>
                        🎮 Создать матч
                    </button>
                </div>
            )}

            {lobby?.status === 'match_created' && (
                <ConnectionBlock
                    connectUrl={lobby?.connect_url}
                    gotvUrl={lobby?.gotv_url}
                    status="active"
                    matchPageUrl={lobby?.match_id ? `/matches/custom/${lobby.match_id}` : null}
                />
            )}

            {/* Зона наблюдателей с неназначенными игроками */}
            <ObserverZone
                observers={[]}
                unassignedPlayers={unassignedUsers}
                showUnassigned={true}
                onDragStart={handleDragStart}
            />

            {/* Действия админа */}
            <div className="custom-lobby-admin-actions">
                <button className="btn-clear-lobby" onClick={clearLobby}>
                    🔄 Очистить лобби
                </button>
            </div>

            {/* Панель приглашений */}
            <InvitePanel
                isOpen={invitePanelOpen}
                onClose={closeInvitePanel}
                targetTeam={invitePanelTeam}
                onInvite={inviteUserToTeam}
                lobbyId={lobbyId}
            />
        </div>
    );
}

export default CustomLobbyContainer;

