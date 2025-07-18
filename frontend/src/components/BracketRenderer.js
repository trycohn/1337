// frontend/src/components/BracketRenderer.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './BracketRenderer.css';
import { safeParseBracketId } from '../utils/safeParseInt';
import { formatManager } from '../utils/tournament/bracketFormats';
import { SingleEliminationFormat } from '../utils/tournament/formats/SingleEliminationFormat';
import { DoubleEliminationFormat } from '../utils/tournament/formats/DoubleEliminationFormat';

// Регистрируем форматы
formatManager.register(new SingleEliminationFormat());
formatManager.register(new DoubleEliminationFormat());

const BracketRenderer = ({ games, tournament, onEditMatch, canEditMatches, selectedMatch, setSelectedMatch, format, onMatchClick }) => {
    // 🔧 ИСПРАВЛЕНО: Используем games вместо matches
    const matches = games || [];
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const lastPosRef = useRef({ x: 0, y: 0 });
    
    // Состояние для позиции и масштаба сетки
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    
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
    
    // Обработчики drag & drop
    const handleMouseDown = useCallback((e) => {
        // Игнорируем клики по матчам и кнопкам
        if (e.target.closest('.bracket-match-container') || 
            e.target.closest('.bracket-navigation-panel') ||
            e.target.closest('.bracket-nav-button')) {
            return;
        }
        
        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        lastPosRef.current = { ...position };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        e.preventDefault();
    }, [position]);
    
    const handleMouseMove = useCallback((e) => {
        if (!isDraggingRef.current) return;
        
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        setPosition({
            x: lastPosRef.current.x + deltaX,
            y: lastPosRef.current.y + deltaY
        });
    }, []);
    
    const handleMouseUp = useCallback(() => {
        isDraggingRef.current = false;
        setIsDragging(false);
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);
    
    // Обработчики кнопок навигации
    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev * 1.2, 3));
    }, []);
    
    const handleZoomOut = useCallback(() => {
        setZoom(prev => Math.max(prev / 1.2, 0.3));
    }, []);
    
    const handleZoomReset = useCallback(() => {
        setZoom(1);
    }, []);
    
    const handlePositionReset = useCallback(() => {
        setPosition({ x: 0, y: 0 });
    }, []);
    
    const handleCenterView = useCallback(() => {
        if (!containerRef.current || !rendererRef.current) return;
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const rendererRect = rendererRef.current.getBoundingClientRect();
        
        const centerX = (containerRect.width - rendererRect.width * zoom) / 2;
        const centerY = (containerRect.height - rendererRect.height * zoom) / 2;
        
        setPosition({ x: centerX, y: centerY });
    }, [zoom]);
    
    const handleFitToScreen = useCallback(() => {
        if (!containerRef.current || !rendererRef.current) return;
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const rendererRect = rendererRef.current.getBoundingClientRect();
        
        const scaleX = containerRect.width / rendererRect.width;
        const scaleY = containerRect.height / rendererRect.height;
        const newZoom = Math.min(scaleX, scaleY, 1) * 0.9; // 90% для отступов
        
        setZoom(newZoom);
        
        // Центрируем после масштабирования
        setTimeout(() => {
            const centerX = (containerRect.width - rendererRect.width * newZoom) / 2;
            const centerY = (containerRect.height - rendererRect.height * newZoom) / 2;
            setPosition({ x: centerX, y: centerY });
        }, 100);
    }, []);
    
    // Обработчик колесика мыши для zoom
    const handleWheel = useCallback((e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)));
        }
    }, []);
    
    // Эффект для добавления обработчиков событий
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('wheel', handleWheel, { passive: false });
        
        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('wheel', handleWheel);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseDown, handleWheel, handleMouseMove, handleMouseUp]);
    
    // 🔧 ИСПРАВЛЕНО: Добавляем проверку на пустые матчи
    if (!matches || matches.length === 0) {
        return (
            <div className="bracket-renderer-container" ref={containerRef}>
                <div className="bracket-empty-message">
                    🎯 Турнирная сетка пока не создана
                </div>
            </div>
        );
    }
    
    // Рассчитываем контекст для названий раундов
    const getRoundContext = (round, roundData, bracketType) => {
        if (tournament?.bracket_type === 'double_elimination') {
            // Для Double Elimination передаем дополнительный контекст
            const winnersRounds = Object.keys(groupedMatches.winners || {}).length;
            const losersRounds = Object.keys(groupedMatches.losers || {}).length;
            
            return {
                bracketType,
                totalRounds: bracketType === 'winner' ? winnersRounds : losersRounds,
                totalWinnersRounds: winnersRounds,
                totalLosersRounds: losersRounds,
                participantCount: tournament?.participants_count || 0
            };
        }
        
        // Для Single Elimination используем старую логику
        const regularRounds = Object.keys(groupedMatches)
            .map(Number)
            .filter(r => r >= 1);
        const totalRounds = regularRounds.length > 0 ? Math.max(...regularRounds) : 1;
        
        const hasThirdPlace = roundData.special && roundData.special.length > 0;
        const hasFinal = roundData.regular && roundData.regular.some(m => 
            m.match_number === 1 && !m.is_third_place_match
        );
        
        return {
            totalRounds,
            isFinalsRound: hasThirdPlace || (round === totalRounds && hasFinal),
            hasThirdPlace,
            participantCount: tournament?.participants_count || 0
        };
    };

    // Рендер раунда для Single Elimination
    const renderSingleEliminationRound = (round, roundData, roundName) => {
        const allMatches = [...(roundData.regular || []), ...(roundData.special || [])];
        const matchesCount = allMatches.length;
        
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
                    {allMatches.map(match => (
                        <div
                            key={match.id}
                            className="bracket-match-container"
                            data-match-type={match.bracket_type === 'placement' ? 'third-place' : 'regular'}
                        >
                            <MatchCard
                                match={match}
                                tournament={tournament}
                                onEditMatch={onEditMatch}
                                canEditMatches={canEditMatches}
                                onMatchClick={onMatchClick}
                                matchType={match.bracket_type === 'placement' ? 'third-place' : 'regular'}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Рендер раунда для Double Elimination
    const renderDoubleEliminationRound = (round, matches, bracketType, roundName) => {
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
        
        return (
            <div key={`${bracketType}-${round}`} className={`bracket-round-column ${columnClass}`}>
                <div className={`bracket-round-header bracket-${bracketType}s-bracket-header`}>
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
            <div className="bracket-navigation-title">
                🎯 Навигация
            </div>
            
            <div className="bracket-zoom-controls">
                <button 
                    className="bracket-nav-button"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.3}
                    title="Уменьшить масштаб"
                >
                    🔍−
                </button>
                <button 
                    className="bracket-nav-button"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                    title="Увеличить масштаб"
                >
                    🔍+
                </button>
            </div>
            
            <div className="bracket-zoom-level">
                {Math.round(zoom * 100)}%
            </div>
            
            <button 
                className="bracket-nav-button"
                onClick={handleZoomReset}
                title="Сбросить масштаб"
            >
                🔄 Сброс
            </button>
            
            <button 
                className="bracket-nav-button"
                onClick={handleCenterView}
                title="Центрировать сетку"
            >
                🎯 Центр
            </button>
            
            <button 
                className="bracket-nav-button"
                onClick={handleFitToScreen}
                title="Вписать в экран"
            >
                📐 Вписать
            </button>
            
            <button 
                className="bracket-nav-button"
                onClick={handlePositionReset}
                title="Сбросить позицию"
            >
                🏠 Домой
            </button>
            
            <div className="bracket-position-indicator">
                X: {Math.round(position.x)}
                <br />
                Y: {Math.round(position.y)}
            </div>
        </div>
    );

    // Основной рендер с поддержкой разных форматов
    if (tournament?.bracket_type === 'double_elimination') {
        // Рендер Double Elimination
        return (
            <div 
                className={`bracket-renderer-container bracket-double-elimination ${isDragging ? 'dragging' : ''}`} 
                ref={containerRef}
            >
                {renderNavigationPanel()}
                
                <div 
                    className="bracket-renderer"
                    ref={rendererRef}
                    style={{ 
                        transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                        transformOrigin: 'top left'
                    }}
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
                                        return renderDoubleEliminationRound(round, matches, 'winner', roundName);
                                    })}
                            </div>
                        </div>
                    )}
                    
                    {/* Losers Bracket */}
                    {groupedMatches.losers && Object.keys(groupedMatches.losers).length > 0 && (
                        <div className="bracket-losers-section">
                            <div className="bracket-section-title">🥈 Losers Bracket</div>
                            <div className="bracket-rounds-container">
                                {Object.entries(groupedMatches.losers)
                                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                    .map(([round, matches]) => {
                                        const context = getRoundContext(parseInt(round), matches, 'loser');
                                        const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                                        return renderDoubleEliminationRound(round, matches, 'loser', roundName);
                                    })}
                            </div>
                        </div>
                    )}
                    
                    {/* Grand Final */}
                    {groupedMatches.grandFinal && groupedMatches.grandFinal.length > 0 && (
                        <div className="bracket-grand-final-section">
                            <div className="bracket-section-title">🏁 Grand Final</div>
                            <div className="bracket-rounds-container">
                                <div className="bracket-round-column has-single-match">
                                    <div className="bracket-round-header bracket-grand-final-header">
                                        Grand Final
                                    </div>
                                    <div className="bracket-matches-list single-match">
                                        {groupedMatches.grandFinal.map(match => (
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
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
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
            ref={containerRef}
        >
            {renderNavigationPanel()}
            
            <div 
                className="bracket-renderer"
                ref={rendererRef}
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                    transformOrigin: 'top left'
                }}
            >
                <div className="bracket-rounds-container">
                    {Object.entries(groupedMatches)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([round, roundData]) => {
                            const context = getRoundContext(parseInt(round), roundData);
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
        
        if (matchType === 'final') {
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

    // 🔧 ИСПРАВЛЕНО: Определяем название матча
    const getMatchTitle = () => {
        // Используем кастомную метку если есть
        if (customLabel) {
            return customLabel;
        }
        
        // Матч за 3-е место
        if (match.bracket_type === 'placement' || match.is_third_place_match) {
            return 'Матч за 3-е место';
        }
        
        // Grand Final
        if (match.bracket_type === 'grand_final') {
            return 'Grand Final';
        }
        
        if (match.bracket_type === 'grand_final_reset') {
            return 'Grand Final Reset';
        }
        
        // Финальный матч: match_number === 1 и НЕ матч за 3-е место
        if (match.match_number === 1 && match.bracket_type !== 'placement' && !match.is_third_place_match) {
            return 'Финал';
        }
        
        // Обычные матчи
        return `Матч #${match.match_number || match.id}`;
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
                    {(match.bracket_type === 'grand_final' || match.bracket_type === 'grand_final_reset') && (
                        <span className="bracket-type-indicator">🏆</span>
                    )}
                    {matchType === 'final' && (
                        <span className="bracket-type-indicator">🏆</span>
                    )}
                    <span className="bracket-match-number">#{match.match_number || match.id}</span>
                </div>
            </div>
            
            <div className="bracket-match-participants">
                <div className={`bracket-participant ${
                    participant1.isWinner ? 'winner' : 
                    (participant1.name === 'TBD' ? 'tbd' : '')
                }`}>
                    <span className="bracket-participant-name">
                        {participant1.name}
                    </span>
                    <span className="bracket-participant-score">{participant1.score}</span>
                </div>
                <div className="bracket-vs-separator">VS</div>
                <div className={`bracket-participant ${
                    participant2.isWinner ? 'winner' : 
                    (participant2.name === 'TBD' ? 'tbd' : '')
                }`}>
                    <span className="bracket-participant-name">
                        {participant2.name}
                    </span>
                    <span className="bracket-participant-score">{participant2.score}</span>
                </div>
            </div>
            
            <div className="bracket-match-status">
                <span className={`bracket-status-badge bracket-status-${matchStatus}`}>
                    {matchStatus === 'completed' ? 'Завершен' : 
                     matchStatus === 'ready' ? 'Готов' : 'Ожидание'}
                </span>
            </div>
            
            {/* Индикатор готовности к редактированию */}
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