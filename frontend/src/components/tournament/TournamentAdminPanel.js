import React from 'react';
import './TournamentAdminPanel.css';

const TournamentAdminPanel = ({
    tournament,
    participants,
    matches,
    isCreatorOrAdmin,
    isLoading,
    onStartTournament,
    onEndTournament,
    onRegenerateBracket,
    onShowAddParticipantModal,
    onShowParticipantSearchModal,
    onRemoveParticipant,
    onEditMatchResult
}) => {
    if (!isCreatorOrAdmin) return null;

    const canStart = tournament?.status === 'upcoming' && participants?.length >= 2;
    const canEnd = tournament?.status === 'active';
    const canRegenerate = tournament?.status === 'upcoming' && participants?.length >= 2;
    const canModifyParticipants = tournament?.status === 'upcoming';

    const getStatusDisplay = () => {
        const statusMap = {
            'upcoming': { text: 'Не начат', color: '#ffa500', icon: '⏳' },
            'active': { text: 'Активен', color: '#4caf50', icon: '🎮' },
            'completed': { text: 'Завершен', color: '#888888', icon: '🏆' }
        };
        
        const status = statusMap[tournament?.status] || statusMap['upcoming'];
        return { ...status };
    };

    const statusInfo = getStatusDisplay();

    return (
        <div className="tournament-admin-panel">
            <div className="admin-panel-header">
                <h3>🛠️ Панель управления турниром</h3>
                <div className="tournament-status">
                    <span className="status-icon">{statusInfo.icon}</span>
                    <span 
                        className="status-text" 
                        style={{ color: statusInfo.color }}
                    >
                        {statusInfo.text}
                    </span>
                </div>
            </div>

            <div className="admin-panel-content">
                {/* Информация о турнире */}
                <div className="tournament-info-section">
                    <div className="info-grid">
                        <div className="info-item">
                            <span className="info-label">Участников:</span>
                            <span className="info-value">{participants?.length || 0}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Матчей:</span>
                            <span className="info-value">{matches?.length || 0}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Игра:</span>
                            <span className="info-value">{tournament?.game || 'Не указана'}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Тип:</span>
                            <span className="info-value">
                                {tournament?.tournament_type === 'single_elimination' ? 'На выбывание' : 
                                 tournament?.tournament_type === 'double_elimination' ? 'Двойное выбывание' :
                                 'Неизвестно'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Управление участниками */}
                {canModifyParticipants && (
                    <div className="participants-management">
                        <h4>👥 Управление участниками</h4>
                        <div className="management-actions">
                            <button
                                className="action-btn add-user-btn"
                                onClick={onShowParticipantSearchModal}
                                disabled={isLoading}
                            >
                                🔍 Найти пользователя
                            </button>
                            <button
                                className="action-btn add-guest-btn"
                                onClick={onShowAddParticipantModal}
                                disabled={isLoading}
                            >
                                ➕ Добавить гостя
                            </button>
                        </div>
                        
                        {participants?.length > 0 && (
                            <div className="participants-list">
                                {participants.map((participant, index) => (
                                    <div key={participant.id || index} className="participant-item">
                                        <div className="participant-info">
                                            <span className="participant-name">
                                                {participant.display_name || participant.username || 'Участник'}
                                            </span>
                                            {participant.is_guest && (
                                                <span className="guest-badge">Гость</span>
                                            )}
                                        </div>
                                        <button
                                            className="remove-participant-btn"
                                            onClick={() => onRemoveParticipant(participant.id)}
                                            disabled={isLoading}
                                            title="Удалить участника"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Управление турниром */}
                <div className="tournament-controls">
                    <h4>🎮 Управление турниром</h4>
                    <div className="control-actions">
                        {canRegenerate && (
                            <button
                                className="action-btn regenerate-btn"
                                onClick={onRegenerateBracket}
                                disabled={isLoading}
                            >
                                🔄 Перегенерировать сетку
                            </button>
                        )}
                        
                        {canStart && (
                            <button
                                className="action-btn start-btn"
                                onClick={onStartTournament}
                                disabled={isLoading || participants?.length < 2}
                            >
                                ▶️ Запустить турнир
                            </button>
                        )}
                        
                        {canEnd && (
                            <button
                                className="action-btn end-btn"
                                onClick={onEndTournament}
                                disabled={isLoading}
                            >
                                ⏹️ Завершить турнир
                            </button>
                        )}
                    </div>

                    {!canStart && tournament?.status === 'upcoming' && participants?.length < 2 && (
                        <div className="warning-message">
                            ⚠️ Для запуска турнира необходимо минимум 2 участника
                        </div>
                    )}
                </div>

                {/* Управление матчами */}
                {tournament?.status === 'active' && matches?.length > 0 && (
                    <div className="matches-management">
                        <h4>⚔️ Управление матчами</h4>
                        <div className="matches-list">
                            {matches
                                .filter(match => match.status !== 'completed')
                                .slice(0, 5) // Показываем только первые 5 незавершенных матчей
                                .map((match, index) => (
                                <div key={match.id || index} className="match-item">
                                    <div className="match-info">
                                        <span className="match-teams">
                                            {match.team1_name || 'TBD'} vs {match.team2_name || 'TBD'}
                                        </span>
                                        <span className="match-round">
                                            {match.round_name || `Раунд ${match.round || 1}`}
                                        </span>
                                    </div>
                                    <button
                                        className="edit-match-btn"
                                        onClick={() => onEditMatchResult(match)}
                                        disabled={isLoading || !match.team1_name || !match.team2_name}
                                        title="Редактировать результат"
                                    >
                                        ✏️
                                    </button>
                                </div>
                            ))}
                            
                            {matches.filter(match => match.status !== 'completed').length > 5 && (
                                <div className="more-matches-info">
                                    И еще {matches.filter(match => match.status !== 'completed').length - 5} матчей...
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TournamentAdminPanel; 