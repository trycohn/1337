// 🎮 TournamentLobbyContainer - Контейнер турнирного лобби
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../../context/UserContext';
import useTournamentLobby from './useTournamentLobby';
import LobbyHeader from '../shared/LobbyHeader';
import MapSelectionBoard from '../shared/MapSelectionBoard';
import ParticipantStatus from '../shared/ParticipantStatus';
import ConnectionBlock from '../shared/ConnectionBlock';
import ObserverZone from '../shared/ObserverZone';
import TeamRosterBase from '../shared/TeamRosterBase';
import './TournamentLobby.css';

function TournamentLobbyContainer() {
    const { lobbyId } = useParams();
    const navigate = useNavigate();
    const { user } = useUser();
    
    const {
        lobby,
        loading,
        error,
        ready,
        steamModalOpen,
        setSteamModalOpen,
        handleReadyToggle,
        handleMapAction,
        startPickBan
    } = useTournamentLobby(lobbyId, user);

    // Определение команды пользователя
    const myTeamId = lobby?.team1_participants?.some(p => p.user_id === user?.id)
        ? lobby?.team1_id
        : lobby?.team2_participants?.some(p => p.user_id === user?.id)
        ? lobby?.team2_id
        : null;

    // Капитан ли пользователь
    const isCaptain = lobby?.team1_participants?.find(p => p.user_id === user?.id)?.is_captain ||
                     lobby?.team2_participants?.find(p => p.user_id === user?.id)?.is_captain;

    // Логирование для диагностики
    console.log('[TournamentLobby] Данные лобби:', {
        lobbyId,
        status: lobby?.status,
        team1_name: lobby?.team1_name,
        team2_name: lobby?.team2_name,
        team1_participants_count: lobby?.team1_participants?.length,
        team2_participants_count: lobby?.team2_participants?.length,
        team1_participants: lobby?.team1_participants,
        team2_participants: lobby?.team2_participants,
        myTeamId,
        isCaptain
    });

    if (loading) {
        return (
            <div className="tournament-lobby-container">
                <div className="lobby-loading">
                    <span className="loading-icon">⏳</span>
                    <span>Загрузка лобби...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="tournament-lobby-container">
                <div className="lobby-error">
                    <span className="error-icon">❌</span>
                    <span>{error}</span>
                    <button onClick={() => navigate(-1)} className="btn-back">
                        Вернуться назад
                    </button>
                </div>
            </div>
        );
    }

    if (!lobby) {
        return (
            <div className="tournament-lobby-container">
                <div className="lobby-not-found">
                    <span>Лобби не найдено</span>
                </div>
            </div>
        );
    }

    // Модалка Steam ID
    if (steamModalOpen) {
        return (
            <div className="tournament-lobby-container">
                <div className="steam-modal">
                    <h2>⚠️ Требуется Steam ID</h2>
                    <p>Для участия в матчах необходимо привязать Steam аккаунт</p>
                    <button onClick={() => navigate('/profile')} className="btn-profile">
                        Перейти в профиль
                    </button>
                    <button onClick={() => setSteamModalOpen(false)} className="btn-cancel">
                        Отмена
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="tournament-lobby-container">
            {/* Заголовок */}
            <LobbyHeader
                team1Name={lobby.team1_name}
                team2Name={lobby.team2_name}
                matchFormat={lobby.match_format}
                tournamentName={lobby.tournament_name}
                matchNumber={lobby.match_number}
                lobbyType="tournament"
            />

            {/* Блок подключения */}
            {(lobby.status === 'ready_to_create' || lobby.status === 'completed') && (
                <ConnectionBlock
                    connectUrl={lobby.connect_url}
                    gotvUrl={lobby.gotv_url}
                    serverLocation={lobby.server_location}
                    status={lobby.status === 'completed' ? 'active' : 'ready'}
                    matchPageUrl={lobby.match_id ? `/tournaments/${lobby.tournament_id}/matches/${lobby.match_id}` : null}
                />
            )}

            {/* Кнопка запуска процедуры (капитаны) */}
            {(() => {
                // Кнопка НЕ показывается если уже идет picking или завершено
                const notStarted = lobby.status !== 'picking' && lobby.status !== 'completed';
                const readyToStart = lobby.match_format && lobby.team1_ready && lobby.team2_ready;
                const canStart = notStarted && readyToStart && isCaptain;
                
                console.log('[TournamentLobby] Условия кнопки Start:', {
                    status: lobby?.status,
                    notStarted,
                    format: lobby?.match_format,
                    team1Ready: lobby?.team1_ready,
                    team2Ready: lobby?.team2_ready,
                    isCaptain,
                    readyToStart,
                    canStart
                });
                
                if (!canStart) return null;
                
                return (
                    <div className="start-pickban-section">
                        <button 
                            className="btn-start-pickban"
                            onClick={() => {
                                console.log('[TournamentLobby] Нажата кнопка Start BAN/PICK');
                                startPickBan();
                            }}
                        >
                            🚀 Начать BAN/PICK
                        </button>
                        <p className="start-hint">
                            💡 Вы капитан команды и можете начать процедуру выбора карт
                        </p>
                    </div>
                );
            })()}

            {/* Составы команд */}
            <div className="tournament-teams-rosters">
                <TeamRosterBase
                    teamName={lobby.team1_name}
                    players={(lobby.team1_participants || []).map(p => ({
                        id: p.user_id,
                        username: p.username,
                        display_name: p.username,
                        avatar: p.avatar_url || '/default-avatar.png',
                        is_captain: p.is_captain,
                        is_ready: p.is_ready
                    }))}
                    teamNumber={1}
                    showReady={lobby.status !== 'completed' && lobby.status !== 'ready_to_create'}
                    isReady={lobby.team1_ready}
                    canToggleReady={myTeamId === lobby.team1_id && lobby.status === 'waiting'}
                    onToggleReady={handleReadyToggle}
                />
                
                <TeamRosterBase
                    teamName={lobby.team2_name}
                    players={(lobby.team2_participants || []).map(p => ({
                        id: p.user_id,
                        username: p.username,
                        display_name: p.username,
                        avatar: p.avatar_url || '/default-avatar.png',
                        is_captain: p.is_captain,
                        is_ready: p.is_ready
                    }))}
                    teamNumber={2}
                    showReady={lobby.status !== 'completed' && lobby.status !== 'ready_to_create'}
                    isReady={lobby.team2_ready}
                    canToggleReady={myTeamId === lobby.team2_id && lobby.status === 'waiting'}
                    onToggleReady={handleReadyToggle}
                />
            </div>

            {/* Зона наблюдателей */}
            <ObserverZone
                observers={lobby.observers || []}
                showUnassigned={false}
            />

            {/* Блок пик/бан карт */}
            {(lobby.status === 'ready' || lobby.status === 'picking') && (
                <MapSelectionBoard
                    maps={lobby.available_maps || []}
                    selections={lobby.selections || []}
                    currentTurn={lobby.current_turn_team_id}
                    myTeamId={myTeamId}
                    format={lobby.match_format}
                    status={lobby.status}
                    onMapAction={handleMapAction}
                    teamNames={{
                        [lobby.team1_id]: lobby.team1_name,
                        [lobby.team2_id]: lobby.team2_name
                    }}
                    isCaptain={isCaptain}
                />
            )}
        </div>
    );
}

export default TournamentLobbyContainer;

