// frontend/src/components/BracketRenderer.js
import React, { useRef, useMemo } from 'react';
import './BracketRenderer.css';
import { formatManager } from '../utils/tournament/bracketFormats';
import { SingleEliminationFormat } from '../utils/tournament/formats/SingleEliminationFormat';
import { DoubleEliminationFormat } from '../utils/tournament/formats/DoubleEliminationFormat';
import useDragAndZoom from '../hooks/useDragAndZoom';

// Регистрируем форматы
formatManager.register(new SingleEliminationFormat());
formatManager.register(new DoubleEliminationFormat());

const BracketRenderer = ({ games, tournament, onEditMatch, canEditMatches, selectedMatch, setSelectedMatch, format, onMatchClick }) => {
    // 🔧 ИСПРАВЛЕНО: Используем games вместо matches
    const matches = useMemo(() => games || [], [games]);
    const rendererRef = useRef(null);
    
    // 🆕 СОВРЕМЕННАЯ СИСТЕМА ПЕРЕТАСКИВАНИЯ И МАСШТАБИРОВАНИЯ
    const {
        isDragging,
        zoomPercentage,
        zoomIn,
        zoomOut,
        resetAll,
        centerView,
        fitToScreen,
        canZoomIn,
        canZoomOut,
        handlers
    } = useDragAndZoom({
        initialPosition: { x: 0, y: 0 },
        initialZoom: 0.6,
        minZoom: 0.3,
        maxZoom: 3,
        zoomStep: 0.05,
        requireCtrl: true,
        excludeSelectors: [
            '.bracket-navigation-panel',
            '.bracket-nav-icon-button',
            '.bracket-match-card',
            '.bracket-edit-match-btn'
        ],
        onDragStart: (data) => {
            console.log('🎯 Начало перетаскивания:', data.position);
        },
        onDragMove: (data) => {
            // Логируем только каждое 10-е перемещение для избежания спама
            if (data.event.timeStamp % 10 < 1) {
                console.log('📍 Перетаскивание:', data.position);
            }
        },
        onDragEnd: (data) => {
            console.log('🎯 Конец перетаскивания:', data.position);
        },
        onZoomChange: (data) => {
            console.log('🔍 Изменение масштаба:', data.zoom);
        }
    });
    
    // Получаем формат турнира
    const tournamentFormat = useMemo(() => {
        const formatType = tournament?.bracket_type || 'single_elimination';
        return formatManager.getFormat(formatType);
    }, [tournament?.bracket_type]);
    
    // Группируем матчи используя систему плагинов
    const groupedMatches = useMemo(() => {
        if (!matches || matches.length === 0) return {};
        return tournamentFormat.groupMatches(matches);
    }, [matches, tournamentFormat]);
    
    // 🔧 ИСПРАВЛЕНО: Добавляем проверку на пустые матчи
    if (!matches || matches.length === 0) {
        return (
            <div className="bracket-renderer-container">
                <div className="bracket-empty-message">
                    🎯 Турнирная сетка пока не создана
                </div>
            </div>
        );
    }
    
    // Получение контекста раунда с расширенной информацией
    const getRoundContext = (round, roundData, bracketType) => {
        const groupedRounds = Object.keys(groupedMatches[bracketType] || {}).map(Number);
        const totalRounds = Math.max(...groupedRounds);
        const matchesInRound = Array.isArray(roundData) ? roundData.length : Object.keys(roundData).length;
        const isLastRound = round === totalRounds;
        
        return {
            bracketType,
            totalRounds,
            matchesInRound,
            isLastRound,
            currentRound: round,
            allRounds: groupedRounds
        };
    };

    // Рендер раунда для Single Elimination
    const renderSingleEliminationRound = (round, roundData, roundName) => {
        const matchesArray = Array.isArray(roundData) ? roundData : Object.values(roundData).flat();
        const matchesCount = matchesArray.length;
        
        // Определяем класс для количества матчей и вертикального выравнивания
        let matchesClass = 'few-matches';
        let columnClass = 'has-few-matches';
        
        if (matchesCount === 1) {
            matchesClass = 'single-match';
            columnClass = 'has-single-match';
        } else if (matchesCount >= 4) {
            matchesClass = 'many-matches';
            columnClass = 'has-many-matches';
        }
        
        return (
            <div key={round} className={`bracket-round-column ${columnClass}`}>
                <div className="bracket-round-header">
                    {roundName}
                </div>
                <div className={`bracket-matches-list ${matchesClass}`}>
                    {matchesArray.map(match => (
                        <div
                            key={match.id}
                            className="bracket-match-container"
                        >
                            <MatchCard
                                match={match}
                                tournament={tournament}
                                onEditMatch={onEditMatch}
                                canEditMatches={canEditMatches}
                                onMatchClick={onMatchClick}
                                customLabel={match.bracket_type === 'placement' ? '3rd Place' : null}
                                matchType={match.bracket_type}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Рендер раунда для Double Elimination с улучшенной поддержкой стилей
    const renderDoubleEliminationRound = (round, matches, bracketType, roundName, context) => {
        const matchesCount = matches.length;
        
        // Определяем класс для количества матчей и вертикального выравнивания
        let matchesClass = 'few-matches';
        let columnClass = 'has-few-matches';
        
        if (matchesCount === 1) {
            matchesClass = 'single-match';
            columnClass = 'has-single-match';
        } else if (matchesCount >= 4) {
            matchesClass = 'many-matches';
            columnClass = 'has-many-matches';
        }
        
        // Определяем тип раунда для специальной стилизации
        let roundType = 'regular';
        if (bracketType === 'loser' && context?.isLastRound) {
            roundType = 'losers-small-final';
        } else if (bracketType === 'grand_final') {
            roundType = 'grand-final';
        }
        
        // Определяем правильный CSS класс для заголовка раунда
        let headerClass = 'bracket-round-header';
        switch (bracketType) {
            case 'winner':
                headerClass += ' bracket-winners-bracket-header';
                break;
            case 'loser':
                headerClass += ' bracket-losers-bracket-header';
                break;
            case 'grand_final':
                headerClass += ' bracket-grand-final-bracket-header';
                break;
            default:
                headerClass += ' bracket-default-bracket-header';
        }
        
        return (
            <div key={`${bracketType}-${round}`} className={`bracket-round-column ${columnClass}`}>
                <div 
                    className={headerClass}
                    data-round-type={roundType}
                >
                    {roundName}
                </div>
                <div className={`bracket-matches-list ${matchesClass}`}>
                    {matches.map(match => (
                        <div
                            key={match.id}
                            className="bracket-match-container"
                            data-match-type={match.bracket_type}
                        >
                            <MatchCard
                                match={match}
                                tournament={tournament}
                                onEditMatch={onEditMatch}
                                canEditMatches={canEditMatches}
                                onMatchClick={onMatchClick}
                                matchType={match.bracket_type}
                                customLabel={roundType === 'losers-small-final' ? 'Small Final' : null}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Рендер панели навигации
    const renderNavigationPanel = () => (
        <div className="bracket-navigation-panel">
            <button 
                className="bracket-nav-icon-button"
                onClick={zoomOut}
                disabled={!canZoomOut}
                title="Уменьшить масштаб"
            >
                <span className="bracket-nav-icon">−</span>
            </button>
            
            <div className="bracket-zoom-display">
                {zoomPercentage}%
            </div>
            
            <button 
                className="bracket-nav-icon-button"
                onClick={zoomIn}
                disabled={!canZoomIn}
                title="Увеличить масштаб"
            >
                <span className="bracket-nav-icon">+</span>
            </button>
            
            <button 
                className="bracket-nav-icon-button"
                onClick={resetAll}
                title="Сбросить позицию и масштаб"
            >
                <span className="bracket-nav-icon">⌂</span>
            </button>
            
            <button 
                className="bracket-nav-icon-button"
                onClick={centerView}
                title="Центрировать сетку"
            >
                <span className="bracket-nav-icon">⊙</span>
            </button>
            
            <button 
                className="bracket-nav-icon-button"
                onClick={fitToScreen}
                title="Уместить сетку на экран"
            >
                <span className="bracket-nav-icon">⌑</span>
            </button>
        </div>
    );

    // Основной рендер с поддержкой разных форматов
    if (tournament?.bracket_type === 'double_elimination') {
        // Рендер Double Elimination
        return (
            <div 
                className={`bracket-renderer-container bracket-double-elimination ${isDragging ? 'dragging' : ''}`}
            >
                {renderNavigationPanel()}
                
                <div 
                    className="bracket-renderer"
                    ref={rendererRef}
                    {...handlers}
                >
                    {/* Winners Bracket */}
                    {groupedMatches.winners && Object.keys(groupedMatches.winners).length > 0 && (
                        <div className="bracket-winners-section">
                            <div className="bracket-section-title">🏆 Winners Bracket</div>
                            <div className="bracket-rounds-container">
                                {Object.entries(groupedMatches.winners)
                                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                    .map(([round, matches]) => {
                                        const context = getRoundContext(parseInt(round), matches, 'winner');
                                        const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                                        return renderDoubleEliminationRound(round, matches, 'winner', roundName, context);
                                    })}
                            </div>
                        </div>
                    )}
                    
                    {/* Losers Bracket */}
                    {groupedMatches.losers && Object.keys(groupedMatches.losers).length > 0 && (
                        <div className="bracket-losers-section">
                            <div className="bracket-section-title">💀 Losers Bracket</div>
                            <div className="bracket-rounds-container">
                                {Object.entries(groupedMatches.losers)
                                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                    .map(([round, matches]) => {
                                        const context = getRoundContext(parseInt(round), matches, 'loser');
                                        const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                                        return renderDoubleEliminationRound(round, matches, 'loser', roundName, context);
                                    })}
                            </div>
                        </div>
                    )}
                    
                    {/* Grand Final */}
                    {groupedMatches.grand_final && Object.keys(groupedMatches.grand_final).length > 0 && (
                        <div className="bracket-grand-final-section">
                            <div className="bracket-section-title">🏅 Grand Final</div>
                            <div className="bracket-rounds-container">
                                {Object.entries(groupedMatches.grand_final)
                                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                    .map(([round, matches]) => {
                                        const context = getRoundContext(parseInt(round), matches, 'grand_final');
                                        const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                                        return renderDoubleEliminationRound(round, matches, 'grand_final', roundName, context);
                                    })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    
    // Рендер Single Elimination
    return (
        <div 
            className={`bracket-renderer-container bracket-single-elimination ${isDragging ? 'dragging' : ''}`}
        >
            {renderNavigationPanel()}
            
            <div 
                className="bracket-renderer"
                ref={rendererRef}
                {...handlers}
            >
                <div className="bracket-rounds-container">
                    {Object.entries(groupedMatches)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([round, roundData]) => {
                            const context = getRoundContext(parseInt(round), roundData, 'regular');
                            const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                            return renderSingleEliminationRound(round, roundData, roundName);
                        })}
                </div>
            </div>
        </div>
    );
};

// MatchCard компонент с поддержкой bracket_type и кастомных меток
const MatchCard = ({ match, tournament, onEditMatch, canEditMatches, onMatchClick, customLabel, matchType = 'regular' }) => {
    const getBracketTypeStyle = () => {
        // 🔧 ИСПРАВЛЕНО: Проверяем матч за 3-е место
        if (match.bracket_type === 'placement' || match.is_third_place_match || matchType === 'third-place') {
            return 'bracket-match-card-third-place';
        }
        
        // 🆕 ФИНАЛЬНЫЙ МАТЧ (матч за 1-е место)
        if (match.bracket_type === 'final' || matchType === 'final') {
            return 'bracket-match-card-final';
        }
        
        switch (match.bracket_type) {
            case 'winner':
                return 'bracket-match-card-winner';
            case 'loser':
                return 'bracket-match-card-loser';
            case 'grand_final':
            case 'grand_final_reset':
                return 'bracket-match-card-grand-final';
            default:
                return 'bracket-match-card-single';
        }
    };

    const getMatchTitle = () => {
        // Используем кастомную метку если есть
        if (customLabel) {
            return customLabel;
        }
        
        // 🆕 ФИНАЛЬНЫЙ МАТЧ (матч за 1-е место)
        if (match.bracket_type === 'final' || matchType === 'final') {
            return 'Матч за 1-е место';
        }
        
        // 🔧 ИСПРАВЛЕНО: Проверяем матч за 3-е место
        if (match.bracket_type === 'placement' || match.is_third_place_match) {
            return 'Матч за 3-е место';
        }
        
        // Для grand final матчей (Double Elimination)
        if (match.bracket_type === 'grand_final') {
            return 'Матч за 1-е место'; // 🆕 Изменено с "Grand Final"
        }
        
        if (match.bracket_type === 'grand_final_reset') {
            return 'Grand Final Reset'; // Остается прежним для reset матча
        }
        
        // Стандартные матчи
        return `Матч ${match.match_number || match.id}`;
    };

    // 🔧 ИСПРАВЛЕНО: Определяем данные участников
    const getParticipantData = (participantIndex) => {
        const participants = match.participants || [];
        const participant = participants[participantIndex];
        
        if (!participant) {
            return {
                name: 'TBD',
                score: null,
                isWinner: false,
                status: 'NO_SHOW'
            };
        }
        
        // 🔧 УЛУЧШЕНО: Проверяем, является ли участник TBD
        const isTBD = !participant.id || participant.id === 'tbd' || participant.name === 'TBD';
        
        return {
            name: participant.name || 'TBD',
            score: participant.score !== null && participant.score !== undefined ? participant.score : participant.resultText,
            // 🔧 ИСПРАВЛЕНО: TBD не может быть победителем
            isWinner: !isTBD && participant.isWinner,
            status: participant.status || 'PLAYED'
        };
    };

    const participant1 = getParticipantData(0);
    const participant2 = getParticipantData(1);

    // 🔧 ИСПРАВЛЕНО: Функция определения статуса матча
    const getMatchStatus = () => {
        if (match.state === 'DONE' || match.state === 'SCORE_DONE') {
            return 'completed';
        }
        if (participant1.name !== 'TBD' && participant2.name !== 'TBD') {
            return 'ready';
        }
        return 'pending';
    };

    const matchStatus = getMatchStatus();
    
    // Предотвращаем перетаскивание при клике на матч
    const handleMatchClick = (e) => {
        e.stopPropagation();
        if (onMatchClick) {
            onMatchClick(match);
        }
    };

    return (
        <div 
            className={`bracket-match-card ${getBracketTypeStyle()}`}
            onClick={handleMatchClick}
            style={{ cursor: onMatchClick ? 'pointer' : 'default' }}
        >
            <div className="bracket-match-info">
                <span className="bracket-match-title">{getMatchTitle()}</span>
                <div className="bracket-match-indicators">
                    {(match.bracket_type === 'placement' || match.is_third_place_match) && (
                        <span className="bracket-type-indicator">🥉</span>
                    )}
                    {(match.bracket_type === 'final' || matchType === 'final') && (
                        <span className="bracket-type-indicator">🏆</span>
                    )}
                    {(match.bracket_type === 'grand_final' || match.bracket_type === 'grand_final_reset') && (
                        <span className="bracket-type-indicator">🏆</span>
                    )}
                    <span className="bracket-match-number">#{match.match_number || match.id}</span>
                </div>
            </div>
            
            <div className="bracket-match-participants">
                <div className={`bracket-participant ${participant1.name === 'TBD' ? 'tbd' : ''} ${participant1.isWinner ? 'winner' : ''}`}>
                    <span className="bracket-participant-name">{participant1.name}</span>
                    <span className="bracket-participant-score">{participant1.score || '-'}</span>
                </div>
                
                <div className="bracket-vs-separator">vs</div>
                
                <div className={`bracket-participant ${participant2.name === 'TBD' ? 'tbd' : ''} ${participant2.isWinner ? 'winner' : ''}`}>
                    <span className="bracket-participant-name">{participant2.name}</span>
                    <span className="bracket-participant-score">{participant2.score || '-'}</span>
                </div>
            </div>
            
            <div className="bracket-match-status">
                <span className={`bracket-status-badge bracket-status-${matchStatus}`}>
                    {matchStatus === 'completed' ? 'Завершен' : 
                     matchStatus === 'ready' ? 'Готов' : 'Ожидание'}
                </span>
            </div>
            
            {canEditMatches && matchStatus === 'ready' && (
                <div className="bracket-edit-match-indicator">
                    <button 
                        className="bracket-edit-match-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEditMatch && onEditMatch(match);
                        }}
                    >
                        ✏️
                    </button>
                </div>
            )}
        </div>
    );
};

export default BracketRenderer;