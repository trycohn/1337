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
    onEditMatchResult,
    onGenerateBracket,
    onClearResults
}) => {
    if (!isCreatorOrAdmin) {
        return null;
    }

    const getStatusDisplay = () => {
        const statusMap = {
            'registration': { icon: '📋', text: 'Регистрация', class: 'status-registration' },
            'active': { icon: '🎮', text: 'Активный', class: 'status-active' },
            'in_progress': { icon: '⚔️', text: 'В процессе', class: 'status-in-progress' },
            'completed': { icon: '🏆', text: 'Завершен', class: 'status-completed' }
        };
        
        return statusMap[tournament?.status] || { icon: '❓', text: 'Неизвестно', class: 'status-unknown' };
    };

    const statusDisplay = getStatusDisplay();
    const hasMatches = matches && matches.length > 0;
    const hasBracket = hasMatches;

    return (
        <div className="tournament-admin-panel">
            <div className="admin-panel-header">
                <h3>⚙️ Панель управления турниром</h3>
                <div className={`tournament-status ${statusDisplay.class}`}>
                    <span className="status-icon">{statusDisplay.icon}</span>
                    <span className="status-text">{statusDisplay.text}</span>
                </div>
            </div>

            <div className="admin-panel-content">
                {/* Информация о турнире */}
                <div className="tournament-info-section">
                    <h4>📊 Информация</h4>
                    <div className="info-grid">
                        <div className="info-item">
                            <span className="info-label">Игра:</span>
                            <span className="info-value">{tournament?.game || 'Не указана'}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Формат:</span>
                            <span className="info-value">{tournament?.format || 'Не указан'}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Участников:</span>
                            <span className="info-value">{participants?.length || 0}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Матчей:</span>
                            <span className="info-value">{matches?.length || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Управление участниками */}
                {tournament?.status === 'active' && !hasBracket && (
                    <div className="participants-management">
                        <h4>👥 Управление участниками</h4>
                        <div className="management-actions">
                            <button 
                                className="action-btn add-user-btn"
                                onClick={onShowParticipantSearchModal}
                                disabled={isLoading}
                            >
                                🔍 Найти участника
                            </button>
                            <button 
                                className="action-btn add-user-btn"
                                onClick={onShowAddParticipantModal}
                                disabled={isLoading}
                            >
                                👤 Добавить незарегистрированного
                            </button>
                        </div>

                        {participants && participants.length > 0 && (
                            <div className="participants-list">
                                {participants.slice(0, 5).map((participant, index) => (
                                    <div key={participant.id || index} className="participant-item">
                                        <div className="participant-info">
                                            <span className="participant-name">
                                                {participant.name || participant.username || 'Участник'}
                                                {!participant.user_id && (
                                                    <span className="guest-badge">👤 Гость</span>
                                                )}
                                            </span>
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
                                {participants.length > 5 && (
                                    <div className="more-participants-info">
                                        И еще {participants.length - 5} участников...
                                    </div>
                                )}
                            </div>
                        )}

                        {participants?.length < 2 && (
                            <div className="warning-message">
                                ⚠️ Для создания сетки нужно минимум 2 участника
                            </div>
                        )}
                    </div>
                )}

                {/* Управление турнирной сеткой */}
                <div className="bracket-management">
                    <h4>🏆 Управление сеткой</h4>
                    <div className="management-actions">
                        {/* Генерация сетки */}
                        {tournament?.status === 'active' && !hasBracket && participants?.length >= 2 && (
                            <button 
                                className="action-btn regenerate-btn"
                                onClick={onGenerateBracket}
                                disabled={isLoading}
                                title="Создать турнирную сетку"
                            >
                                ⚡ Сгенерировать сетку
                            </button>
                        )}

                        {/* Перегенерация сетки */}
                        {tournament?.status === 'active' && hasBracket && (
                            <button 
                                className="action-btn regenerate-btn"
                                onClick={onRegenerateBracket}
                                disabled={isLoading}
                                title="Пересоздать турнирную сетку"
                            >
                                🔄 Перегенерировать сетку
                            </button>
                        )}
                    </div>
                </div>

                {/* Управление статусом турнира */}
                <div className="tournament-status-management">
                    <h4>🎮 Управление турниром</h4>
                    <div className="management-actions">
                        {/* Начать турнир */}
                        {tournament?.status === 'active' && hasBracket && (
                            <button 
                                className="action-btn start-btn"
                                onClick={onStartTournament}
                                disabled={isLoading}
                                title="Запустить турнир"
                            >
                                🚀 Начать турнир
                            </button>
                        )}

                        {/* Завершить турнир */}
                        {tournament?.status === 'in_progress' && (
                            <button 
                                className="action-btn end-btn"
                                onClick={onEndTournament}
                                disabled={isLoading}
                                title="Завершить турнир"
                            >
                                🏁 Завершить турнир
                            </button>
                        )}
                    </div>
                </div>

                {/* Управление результатами */}
                {tournament?.status === 'in_progress' && matches?.some(m => m.status === 'completed') && (
                    <div className="results-management">
                        <h4>📊 Управление результатами</h4>
                        <div className="management-actions">
                            <button 
                                className="action-btn end-btn"
                                onClick={onClearResults}
                                disabled={isLoading}
                                title="Очистить все результаты матчей"
                            >
                                🗑️ Очистить результаты
                            </button>
                        </div>
                    </div>
                )}

                {/* Управление матчами */}
                {tournament?.status === 'in_progress' && matches && matches.length > 0 && (
                    <div className="matches-management">
                        <h4>⚔️ Незавершенные матчи</h4>
                        <div className="matches-list">
                            {matches
                                .filter(match => match.status !== 'completed')
                                .slice(0, 3)
                                .map((match, index) => (
                                    <div key={match.id || index} className="match-item">
                                        <div className="match-info">
                                            <div className="match-teams">
                                                {match.team1_name || match.participant1_name || 'Команда 1'} vs{' '}
                                                {match.team2_name || match.participant2_name || 'Команда 2'}
                                            </div>
                                            <div className="match-round">
                                                Раунд {match.round || '?'}
                                            </div>
                                        </div>
                                        <button
                                            className="edit-match-btn"
                                            onClick={() => onEditMatchResult(match)}
                                            disabled={isLoading}
                                            title="Редактировать результат"
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Завершенный турнир */}
                {tournament?.status === 'completed' && (
                    <div className="tournament-completed-info">
                        <div className="completed-status">
                            <span className="status-icon">🏆</span>
                            <div className="status-text">
                                <p>Турнир завершен</p>
                                <p>Все результаты сохранены</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TournamentAdminPanel; 