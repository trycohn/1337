import React, { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// Custom Hooks
import { useTournamentData } from '../../../hooks/tournament/useTournamentData';
import { useWebSocket } from '../../../hooks/tournament/useWebSocket';
import { useTournamentAuth } from '../../../hooks/tournament/useTournamentAuth';
import { useMapsManagement } from '../../../hooks/tournament/useMapsManagement';

// UI Components  
import TournamentHeader from './TournamentHeader';
import InfoTab from '../tabs/InfoTab';
import ParticipantsTab from '../tabs/ParticipantsTab';
import BracketTab from '../tabs/BracketTab';
import ResultsTab from '../tabs/ResultsTab';
import LogsTab from '../tabs/LogsTab';
import StreamsTab from '../tabs/StreamsTab';
import AdminTab from '../tabs/AdminTab';

// Modals
import ConfirmWinnerModal from '../modals/ConfirmWinnerModal';
import MatchDetailsModal from '../modals/MatchDetailsModal';
import EditMatchModal from '../modals/EditMatchModal';
import TeamCompositionModal from '../modals/TeamCompositionModal';
import EndTournamentModal from '../modals/EndTournamentModal';
import ClearResultsModal from '../modals/ClearResultsModal';

// Styles
import './TournamentDetails.css';

/**
 * Главный компонент турнира - координатор всех модулей
 * Использует модульную архитектуру с custom hooks и компонентами
 */
function TournamentDetails() {
    const { id } = useParams();
    
    // Состояния для UI
    const [activeTab, setActiveTab] = useState('info');
    const [message, setMessage] = useState('');
    
    // Состояния для модальных окон
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [selectedWinnerId, setSelectedWinnerId] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [viewingMatchDetails, setViewingMatchDetails] = useState(false);
    const [matchDetails, setMatchDetails] = useState(null);
    const [isEditingMatch, setIsEditingMatch] = useState(false);
    const [editingMatchData, setEditingMatchData] = useState(null);
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [selectedTeamData, setSelectedTeamData] = useState(null);
    const [showEndTournamentModal, setShowEndTournamentModal] = useState(false);
    const [showClearResultsModal, setShowClearResultsModal] = useState(false);
    
    // Состояния для чата
    const [chatMessages, setChatMessages] = useState([]);
    const [newChatMessage, setNewChatMessage] = useState('');

    // Custom Hooks - основная логика
    const {
        tournament,
        matches,
        creator,
        loading,
        error,
        fetchTournamentData,
        fetchTournamentDataForcefully,
        updateTournament,
        updateMatches,
        setTournament,
        setMatches
    } = useTournamentData(id);

    const {
        user,
        teams,
        isCreator,
        isAdminOrCreator,
        isParticipating,
        adminRequestStatus,
        permissions,
        handleRequestAdmin,
        isUserParticipant,
        setIsParticipating
    } = useTournamentAuth(tournament, id);

    const {
        maps,
        showMapSelection,
        memoizedGameData,
        getGameMaps,
        getDefaultMap,
        addMap,
        removeMap,
        updateMapScore,
        updateMapSelection,
        setMaps,
        setShowMapSelection
    } = useMapsManagement(tournament);

    // Обработчики WebSocket событий
    const handleTournamentUpdate = useCallback((tournamentData) => {
        const data = tournamentData.data || tournamentData;
        
        // Если это обновление статуса, принудительно обновляем данные
        if (data.status && data.status !== tournament?.status) {
            console.log(`Статус турнира изменился с ${tournament?.status} на ${data.status}`);
            setTimeout(async () => {
                try {
                    await fetchTournamentDataForcefully(true);
                    console.log('Данные турнира обновлены после изменения статуса через WebSocket');
                } catch (error) {
                    console.error('Ошибка обновления данных после WebSocket события:', error);
                }
            }, 500);
        } else {
            // Обычное обновление данных турнира
            updateTournament(data);
            
            // Обновляем список матчей
            const matchesData = data.matches || tournamentData.matches || [];
            if (Array.isArray(matchesData)) {
                console.log(`Получено ${matchesData.length} матчей через WebSocket`);
                updateMatches(matchesData);
            }
        }
        
        // Устанавливаем сообщение для пользователя
        if (tournamentData.message) {
            setMessage(tournamentData.message);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [tournament?.status, fetchTournamentDataForcefully, updateTournament, updateMatches]);

    const handleChatMessage = useCallback((message) => {
        setChatMessages(prev => [...prev, message]);
    }, []);

    const {
        wsConnected,
        sendChatMessage
    } = useWebSocket(id, user, handleTournamentUpdate, handleChatMessage);

    // Определение вкладок
    const tabs = [
        { id: 'info', label: 'Информация' },
        { id: 'participants', label: 'Участники' },
        { id: 'bracket', label: 'Сетка' },
        { id: 'results', label: 'Результаты' },
        { id: 'logs', label: 'Журнал' },
        { id: 'streams', label: 'Стримы' },
        { id: 'admin', label: 'Управление', adminOnly: true }
    ];
    
    // Фильтруем вкладки в зависимости от прав пользователя
    const visibleTabs = tabs.filter(tab => !tab.adminOnly || permissions.canViewAdminTab);

    // Обработчики модальных окон
    const handleCloseModal = useCallback(() => {
        setShowConfirmModal(false);
        setSelectedMatch(null);
        setSelectedWinnerId(null);
    }, []);

    const closeMatchDetails = useCallback(() => {
        setViewingMatchDetails(false);
        setMatchDetails(null);
    }, []);

    const closeTeamModal = useCallback(() => {
        setShowTeamModal(false);
        setSelectedTeamData(null);
    }, []);

    // Функция для отправки чата
    const handleChatSubmit = useCallback((e) => {
        e.preventDefault();
        if (newChatMessage.trim() && sendChatMessage(newChatMessage)) {
            setNewChatMessage('');
        }
    }, [newChatMessage, sendChatMessage]);

    // Показываем загрузку
    if (loading) {
        return (
            <div className="tournament-loading">
                <p>Загрузка турнира...</p>
            </div>
        );
    }

    // Показываем ошибку
    if (error) {
        return (
            <div className="tournament-error">
                <p>Ошибка: {error}</p>
                <button onClick={() => fetchTournamentData()}>
                    Попробовать снова
                </button>
            </div>
        );
    }

    // Показываем, если турнир не найден
    if (!tournament) {
        return (
            <div className="tournament-not-found">
                <p>Турнир не найден</p>
            </div>
        );
    }

    return (
        <section className="tournament-details-tournamentdetails">
            {/* Заголовок с навигацией */}
            <TournamentHeader 
                tournament={tournament}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                visibleTabs={visibleTabs}
                wsConnected={wsConnected}
            />
            
            <div className="tournament-content-tournamentdetails">
                {/* Рендерим активную вкладку */}
                {activeTab === 'info' && (
                    <InfoTab 
                        tournament={tournament}
                        creator={creator}
                        matches={matches}
                        permissions={permissions}
                        memoizedGameData={memoizedGameData}
                        onUpdateTournament={updateTournament}
                    />
                )}
                
                {activeTab === 'participants' && (
                    <ParticipantsTab 
                        tournament={tournament}
                        user={user}
                        teams={teams}
                        isParticipating={isParticipating}
                        permissions={permissions}
                        isUserParticipant={isUserParticipant}
                        onParticipate={() => {/* TODO: implement */}}
                        onWithdraw={() => {/* TODO: implement */}}
                        onUpdateTournament={fetchTournamentData}
                        setIsParticipating={setIsParticipating}
                    />
                )}
                
                {activeTab === 'bracket' && (
                    <BracketTab 
                        tournament={tournament}
                        matches={matches}
                        permissions={permissions}
                        onTeamClick={(teamId, matchId) => {/* TODO: implement */}}
                        onMatchClick={(matchId) => {/* TODO: implement */}}
                    />
                )}
                
                {activeTab === 'results' && (
                    <ResultsTab 
                        tournament={tournament}
                        matches={matches}
                        onShowTeamComposition={(teamId, teamName) => {/* TODO: implement */}}
                        onViewMatchDetails={(matchId) => {/* TODO: implement */}}
                        canEditMatchResult={(matchId) => permissions.canEditMatches}
                        onStartEditingMatch={(matchId) => {/* TODO: implement */}}
                    />
                )}
                
                {activeTab === 'logs' && (
                    <LogsTab 
                        tournament={tournament}
                    />
                )}
                
                {activeTab === 'streams' && (
                    <StreamsTab 
                        tournament={tournament}
                    />
                )}
                
                {activeTab === 'admin' && permissions.canViewAdminTab && (
                    <AdminTab 
                        tournament={tournament}
                        matches={matches}
                        permissions={permissions}
                        onGenerateBracket={() => {/* TODO: implement */}}
                        onStartTournament={() => {/* TODO: implement */}}
                        onEndTournament={() => setShowEndTournamentModal(true)}
                        onClearResults={() => setShowClearResultsModal(true)}
                        onRegenerateBracket={() => {/* TODO: implement */}}
                    />
                )}
                
                {/* Сообщения */}
                {message && (
                    <p className={`message ${message.includes('успешно') ? 'success' : 'error'}`}>
                        {message}
                    </p>
                )}
            </div>
            
            {/* Модальные окна */}
            {showConfirmModal && selectedMatch && (
                <ConfirmWinnerModal 
                    isOpen={showConfirmModal}
                    onClose={handleCloseModal}
                    match={selectedMatch}
                    winnerId={selectedWinnerId}
                    tournament={tournament}
                    maps={maps}
                    showMapSelection={showMapSelection}
                    getGameMaps={getGameMaps}
                    addMap={addMap}
                    removeMap={removeMap}
                    updateMapScore={updateMapScore}
                    updateMapSelection={updateMapSelection}
                    onConfirm={(matchInfo) => {/* TODO: implement */}}
                />
            )}
            
            {viewingMatchDetails && matchDetails && (
                <MatchDetailsModal 
                    isOpen={viewingMatchDetails}
                    onClose={closeMatchDetails}
                    matchDetails={matchDetails}
                    canEdit={permissions.canEditMatches}
                    onStartEditing={(matchId) => {/* TODO: implement */}}
                />
            )}
            
            {isEditingMatch && editingMatchData && (
                <EditMatchModal 
                    isOpen={isEditingMatch}
                    onClose={() => setIsEditingMatch(false)}
                    matchData={editingMatchData}
                    tournament={tournament}
                    onSave={() => {/* TODO: implement */}}
                />
            )}
            
            {showTeamModal && selectedTeamData && (
                <TeamCompositionModal 
                    isOpen={showTeamModal}
                    onClose={closeTeamModal}
                    teamData={selectedTeamData}
                    user={user}
                />
            )}
            
            {showEndTournamentModal && (
                <EndTournamentModal 
                    isOpen={showEndTournamentModal}
                    onClose={() => setShowEndTournamentModal(false)}
                    onConfirm={() => {/* TODO: implement */}}
                />
            )}
            
            {showClearResultsModal && (
                <ClearResultsModal 
                    isOpen={showClearResultsModal}
                    onClose={() => setShowClearResultsModal(false)}
                    onConfirm={() => {/* TODO: implement */}}
                />
            )}
        </section>
    );
}

export default TournamentDetails; 