// 🎮 CustomLobbyContainer - Контейнер кастомного лобби
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useCustomLobby from './useCustomLobby';
import useLobbySocket from '../shared/useLobbySocket';
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
    const [isInvited, setIsInvited] = useState(false);
    const [checkingAccess, setCheckingAccess] = useState(true);
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
        loadInvitedLobby,
        inviteUserToTeam,
        removeUserFromLobby,
        setMatchFormat,
        togglePlayerReady,
        handleMapAction,
        createMatch,
        clearLobby,
        updateLobbyState,
        makeCaptain
    } = useCustomLobby(user, isAdmin);

    // WebSocket подключение для получения обновлений
    const handleLobbyUpdate = useCallback((data) => {
        console.log('[CustomLobby] WebSocket обновление лобби:', data);
        if (data.lobby && updateLobbyState) {
            updateLobbyState(data);
        }
    }, [updateLobbyState]);

    useLobbySocket({
        lobbyId,
        user,
        onLobbyState: handleLobbyUpdate,
        onLobbyUpdate: handleLobbyUpdate,
        onError: (error) => console.error('[CustomLobby] WebSocket ошибка:', error),
        lobbyType: 'custom'
    });

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

    // Проверка доступа: админ или приглашен
    useEffect(() => {
        if (!user) return;
        
        const checkAccess = async () => {
            // Админы всегда имеют доступ
            if (isAdmin) {
                setIsInvited(true);
                setCheckingAccess(false);
                return;
            }
            
            // Для неадминов проверяем через попытку загрузить приглашения
            try {
                const token = localStorage.getItem('token');
                const { data } = await api.get('/api/admin/match-lobbies/my-invites', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                console.log('[CustomLobby] Мои приглашения:', data);
                
                // Если есть хотя бы одно приглашение (принятое или непринятое) - доступ разрешен
                if (data?.success && data.invites?.length > 0) {
                    setIsInvited(true);
                } else {
                    setIsInvited(false);
                }
            } catch (error) {
                console.error('Ошибка проверки приглашений:', error);
                setIsInvited(false);
            } finally {
                setCheckingAccess(false);
            }
        };
        
        checkAccess();
    }, [user, isAdmin]);

    // Создание лобби при монтировании (только для админов)
    useEffect(() => {
        if (isAdmin && !lobbyId) {
            ensureAdminLobby();
        }
    }, [isAdmin, lobbyId, ensureAdminLobby]);

    // Загрузка лобби для приглашенных пользователей
    useEffect(() => {
        if (!isAdmin && isInvited && !lobbyId) {
            loadInvitedLobby();
        }
    }, [isAdmin, isInvited, lobbyId, loadInvitedLobby]);

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

    const handleDrop = (targetTeam) => (e) => {
        e.preventDefault();
        const draggedUserId = Number(e.dataTransfer.getData('text/plain'));
        
        if (!draggedUserId) return;
        
        console.log('[CustomLobby] Drop:', { draggedUserId, targetTeam });
        
        // Определяем из какой команды пришел игрок
        const fromTeam1 = team1Users.find(u => u.id === draggedUserId);
        const fromTeam2 = team2Users.find(u => u.id === draggedUserId);
        const fromUnassigned = unassignedUsers.find(u => u.id === draggedUserId);
        
        const sourceTeam = fromTeam1 ? 1 : fromTeam2 ? 2 : null;
        
        // Если перемещаем в другую команду - просто назначаем
        if (sourceTeam !== targetTeam) {
            inviteUserToTeam(draggedUserId, targetTeam);
        }
        // Если перемещаем внутри той же команды - это изменение капитанства
        // (пока не реализовано визуально, но можно добавить)
    };

    // Проверка доступа
    if (checkingAccess) {
        return (
            <div className="custom-lobby-container">
                <div className="lobby-loading">
                    <span className="loading-icon">⏳</span>
                    <span>Проверка доступа...</span>
                </div>
            </div>
        );
    }

    // Если пользователь не админ и не приглашен - запрещаем доступ
    if (!isAdmin && !isInvited) {
        return (
            <div className="custom-lobby-container">
                <div className="lobby-access-denied">
                    <span className="error-icon">🚫</span>
                    <span>Доступ запрещен</span>
                    <p>У вас нет доступа к этому лобби</p>
                    <p className="access-hint">
                        Вы можете присоединиться только по приглашению администратора
                    </p>
                    <button onClick={() => navigate('/')} className="btn-back">
                        На главную
                    </button>
                </div>
            </div>
        );
    }

    if (loading && !lobbyId && isAdmin) {
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
            {/* Индикатор режима просмотра для неадминов */}
            {!isAdmin && (
                <div className="lobby-viewer-mode">
                    <span className="viewer-icon">👁️</span>
                    <span className="viewer-text">Режим просмотра</span>
                    <span className="viewer-hint">Вы приглашены в это лобби</span>
                </div>
            )}
            
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
                    disabled={!isAdmin}
                />
            )}

            {/* Составы команд */}
            <div className="custom-lobby-teams">
                {/* Команда 1 */}
                <div 
                    className="custom-team-section"
                    onDragOver={isAdmin ? (e) => e.preventDefault() : undefined}
                    onDrop={isAdmin ? handleDrop(1) : undefined}
                >
                    <div className="custom-team-header">
                        <h3>Команда 1</h3>
                        {isAdmin && (
                            <button 
                                className="btn-add-player"
                                onClick={() => openInvitePanel(1)}
                            >
                                + Добавить
                            </button>
                        )}
                    </div>
                    <div className="custom-team-players">
                        {team1Users.map((u, idx) => (
                            <div 
                                key={u.id} 
                                className="custom-player-card" 
                                draggable={isAdmin}
                                onDragStart={isAdmin ? (e) => handleDragStart(e, u) : undefined}
                            >
                                <div className="custom-player-card-content">
                                    <img src={u.avatar || '/default-avatar.png'} alt={u.username} onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                                <span className="custom-player-card-name">
                                    {u.username || u.display_name}
                                    {idx === 0 && <span className="captain-badge" title="Капитан">👑</span>}
                                </span>
                                </div>
                                <div className="custom-player-card-actions">
                                {/* Кнопка готовности: админ для всех, неадмин только для себя */}
                                {(isAdmin || u.id === user?.id) && (
                                    <button 
                                        className="btn-ready-toggle"
                                        onClick={() => togglePlayerReady(u.id, 1)}
                                        title={u.id === user?.id ? 'Изменить свою готовность' : 'Изменить готовность игрока'}
                                    >
                                        {playerReady[u.id] ? '✅' : '❌'}
                                    </button>
                                )}
                                {/* Кнопка назначения капитаном */}
                                {isAdmin && idx !== 0 && (
                                    <button 
                                        className="btn-make-captain"
                                        onClick={() => makeCaptain(u.id, 1)}
                                        title="Сделать капитаном"
                                    >
                                        👑
                                    </button>
                                )}
                                {/* Кнопка удаления только для админа */}
                                {isAdmin && (
                                    <button 
                                        className="btn-remove"
                                        onClick={() => removeUserFromLobby(u.id)}
                                    >
                                        ✕
                                    </button>
                                )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Команда 2 */}
                <div 
                    className="custom-team-section"
                    onDragOver={isAdmin ? (e) => e.preventDefault() : undefined}
                    onDrop={isAdmin ? handleDrop(2) : undefined}
                >
                    <div className="custom-team-header">
                        <h3>Команда 2</h3>
                        {isAdmin && (
                            <button 
                                className="btn-add-player"
                                onClick={() => openInvitePanel(2)}
                            >
                                + Добавить
                            </button>
                        )}
                    </div>
                    <div className="custom-team-players">
                        {team2Users.map((u, idx) => (
                            <div 
                                key={u.id} 
                                className="custom-player-card" 
                                draggable={isAdmin}
                                onDragStart={isAdmin ? (e) => handleDragStart(e, u) : undefined}
                            >
                                <img src={u.avatar || '/default-avatar.png'} alt={u.username} onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                                <span className="player-name-with-badge">
                                    {u.username || u.display_name}
                                    {idx === 0 && <span className="captain-badge" title="Капитан">👑</span>}
                                </span>
                                {/* Кнопка готовности: админ для всех, неадмин только для себя */}
                                {(isAdmin || u.id === user?.id) && (
                                    <button 
                                        className="btn-ready-toggle"
                                        onClick={() => togglePlayerReady(u.id, 2)}
                                        title={u.id === user?.id ? 'Изменить свою готовность' : 'Изменить готовность игрока'}
                                    >
                                        {playerReady[u.id] ? '✅' : '❌'}
                                    </button>
                                )}
                                {/* Кнопка назначения капитаном */}
                                {isAdmin && idx !== 0 && (
                                    <button 
                                        className="btn-make-captain"
                                        onClick={() => makeCaptain(u.id, 2)}
                                        title="Сделать капитаном"
                                    >
                                        👑
                                    </button>
                                )}
                                {/* Кнопка удаления только для админа */}
                                {isAdmin && (
                                    <button 
                                        className="btn-remove"
                                        onClick={() => removeUserFromLobby(u.id)}
                                    >
                                        ✕
                                    </button>
                                )}
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
                    onMapAction={isAdmin ? handleMapAction : () => {}} // Неадмины не могут делать действия
                    teamNames={{
                        1: lobby?.team1_name || 'Команда 1',
                        2: lobby?.team2_name || 'Команда 2'
                    }}
                    isCaptain={isAdmin} // Только админ может выбирать в кастомном лобби
                />
            )}

            {/* Подключение к серверу */}
            {lobby?.status === 'ready_to_create' && isAdmin && (
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
            {isAdmin && (
                <ObserverZone
                    observers={[]}
                    unassignedPlayers={unassignedUsers}
                    showUnassigned={true}
                    onDragStart={handleDragStart}
                />
            )}

            {/* Действия админа */}
            {isAdmin && (
                <div className="custom-lobby-admin-actions">
                    <button className="btn-clear-lobby" onClick={clearLobby}>
                        🔄 Очистить лобби
                    </button>
                </div>
            )}

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

