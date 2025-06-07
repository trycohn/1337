import React from 'react';
import './TournamentContextualControls.css';

const TournamentContextualControls = ({
    tournament,
    matches,
    isCreatorOrAdmin,
    context, // 'participants', 'bracket', 'results'
    isLoading = false,
    // Обработчики
    onStartTournament,
    onEndTournament,
    onGenerateBracket,
    onRegenerateBracket,
    onClearResults,
    onShowAddParticipantModal,
    onShowParticipantSearchModal
}) => {
    if (!isCreatorOrAdmin) {
        return null;
    }

    const hasMatches = matches && matches.length > 0;
    const participantsCount = tournament?.participants?.length || 0;

    const renderParticipantsControls = () => {
        if (tournament?.status !== 'active' || hasMatches) return null;

        return (
            <div className="contextual-controls participants-context">
                <div className="controls-header">
                    <h4>⚙️ Управление участниками</h4>
                    <span className="context-badge">👥 {participantsCount} участников</span>
                </div>
                
                <div className="controls-actions">
                    <button 
                        className="control-btn add-participant-btn"
                        onClick={onShowParticipantSearchModal}
                        disabled={isLoading}
                        title="Найти зарегистрированного участника"
                    >
                        <span className="btn-icon">🔍</span>
                        Найти участника
                    </button>
                    
                    <button 
                        className="control-btn add-guest-btn"
                        onClick={onShowAddParticipantModal}
                        disabled={isLoading}
                        title="Добавить незарегистрированного участника"
                    >
                        <span className="btn-icon">👤</span>
                        Добавить гостя
                    </button>
                    
                    {participantsCount >= 2 && (
                        <button 
                            className="control-btn generate-btn"
                            onClick={onGenerateBracket}
                            disabled={isLoading}
                            title="Создать турнирную сетку"
                        >
                            <span className="btn-icon">⚡</span>
                            Создать сетку
                        </button>
                    )}
                </div>
                
                {participantsCount < 2 && (
                    <div className="context-warning">
                        ⚠️ Добавьте минимум 2 участника для создания турнирной сетки
                    </div>
                )}
            </div>
        );
    };

    const renderBracketControls = () => {
        return (
            <div className="contextual-controls bracket-context">
                <div className="controls-header">
                    <h4>🏆 Управление сеткой</h4>
                    <div className="context-badges">
                        <span className="context-badge">📊 {matches?.length || 0} матчей</span>
                        <span className={`status-badge status-${tournament?.status}`}>
                            {tournament?.status === 'active' && '🎮 Активный'}
                            {tournament?.status === 'in_progress' && '⚔️ В процессе'}
                            {tournament?.status === 'completed' && '🏆 Завершен'}
                        </span>
                    </div>
                </div>
                
                <div className="controls-actions">
                    {/* Генерация сетки */}
                    {tournament?.status === 'active' && !hasMatches && participantsCount >= 2 && (
                        <button 
                            className="control-btn generate-btn"
                            onClick={onGenerateBracket}
                            disabled={isLoading}
                            title="Создать турнирную сетку"
                        >
                            <span className="btn-icon">⚡</span>
                            Сгенерировать сетку
                        </button>
                    )}
                    
                    {/* Перегенерация сетки */}
                    {tournament?.status === 'active' && hasMatches && (
                        <button 
                            className="control-btn regenerate-btn"
                            onClick={onRegenerateBracket}
                            disabled={isLoading}
                            title="Пересоздать турнирную сетку"
                        >
                            <span className="btn-icon">🔄</span>
                            Перегенерировать сетку
                        </button>
                    )}
                    
                    {/* Начать турнир */}
                    {tournament?.status === 'active' && hasMatches && (
                        <button 
                            className="control-btn start-btn"
                            onClick={onStartTournament}
                            disabled={isLoading}
                            title="Запустить турнир"
                        >
                            <span className="btn-icon">🚀</span>
                            Начать турнир
                        </button>
                    )}
                    
                    {/* Завершить турнир */}
                    {tournament?.status === 'in_progress' && (
                        <button 
                            className="control-btn end-btn"
                            onClick={onEndTournament}
                            disabled={isLoading}
                            title="Завершить турнир"
                        >
                            <span className="btn-icon">🏁</span>
                            Завершить турнир
                        </button>
                    )}
                </div>
                
                {/* Информационные сообщения */}
                {tournament?.status === 'active' && !hasMatches && participantsCount < 2 && (
                    <div className="context-warning">
                        ⚠️ Добавьте участников во вкладке "Участники" для создания сетки
                    </div>
                )}
                
                {tournament?.status === 'completed' && (
                    <div className="context-success">
                        ✅ Турнир завершен. Сетка заблокирована для изменений.
                    </div>
                )}
            </div>
        );
    };

    const renderResultsControls = () => {
        if (tournament?.status !== 'in_progress') return null;

        const completedMatches = matches?.filter(m => m.status === 'completed') || [];
        
        return (
            <div className="contextual-controls results-context">
                <div className="controls-header">
                    <h4>📊 Управление результатами</h4>
                    <div className="context-badges">
                        <span className="context-badge">✅ {completedMatches.length} завершено</span>
                        <span className="context-badge">⏳ {(matches?.length || 0) - completedMatches.length} в процессе</span>
                    </div>
                </div>
                
                <div className="controls-actions">
                    {completedMatches.length > 0 && (
                        <button 
                            className="control-btn clear-btn"
                            onClick={onClearResults}
                            disabled={isLoading}
                            title="Очистить все результаты матчей"
                        >
                            <span className="btn-icon">🗑️</span>
                            Очистить результаты
                        </button>
                    )}
                    
                    <button 
                        className="control-btn end-btn"
                        onClick={onEndTournament}
                        disabled={isLoading}
                        title="Завершить турнир"
                    >
                        <span className="btn-icon">🏁</span>
                        Завершить турнир
                    </button>
                </div>
                
                {completedMatches.length === 0 && (
                    <div className="context-info">
                        ℹ️ Результаты матчей появятся после их завершения
                    </div>
                )}
            </div>
        );
    };

    // Рендер в зависимости от контекста
    switch (context) {
        case 'participants':
            return renderParticipantsControls();
        case 'bracket':
            return renderBracketControls();
        case 'results':
            return renderResultsControls();
        default:
            return null;
    }
};

export default TournamentContextualControls; 