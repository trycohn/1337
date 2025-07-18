// frontend/src/components/BracketRenderer.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './BracketRenderer.css';
import { safeParseBracketId } from '../utils/safeParseInt';
import { formatManager } from '../utils/tournament/bracketFormats';
import { SingleEliminationFormat } from '../utils/tournament/formats/SingleEliminationFormat';
import { DoubleEliminationFormat } from '../utils/tournament/formats/DoubleEliminationFormat';
import BracketConnections from './tournament/BracketConnections';

// Регистрируем форматы
formatManager.register(new SingleEliminationFormat());
formatManager.register(new DoubleEliminationFormat());

const BracketRenderer = ({ games, tournament, onEditMatch, canEditMatches, selectedMatch, setSelectedMatch, format, onMatchClick }) => {
    // 🔧 ИСПРАВЛЕНО: Используем games вместо matches
    const matches = games || [];
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
    
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
    
    // Рассчитываем позиции матчей
    const matchPositions = useMemo(() => {
        return tournamentFormat.calculatePositions(groupedMatches);
    }, [groupedMatches, tournamentFormat]);
    
    // Рассчитываем соединения
    const connections = useMemo(() => {
        return tournamentFormat.calculateConnections(matches, matchPositions);
    }, [matches, matchPositions, tournamentFormat]);
    
    // Обновляем размеры контейнера
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                // Увеличиваем размеры для Double Elimination
                const minWidth = tournament?.bracket_type === 'double_elimination' ? 1600 : 1200;
                const minHeight = tournament?.bracket_type === 'double_elimination' ? 1200 : 800;
                
                setDimensions({
                    width: Math.max(rect.width, minWidth),
                    height: Math.max(rect.height, minHeight)
                });
            }
        };
        
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [tournament?.bracket_type]);
    
    // 🔧 ИСПРАВЛЕНО: Добавляем проверку на пустые матчи
    if (!matches || matches.length === 0) {
        return (
            <div className="bracket-renderer">
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
    
    // Рендер матча с новой системой позиционирования
    const renderMatch = (match, position) => {
        if (!position) return null;
        
        const matchLabel = tournamentFormat.getMatchLabel(match, tournament);
        const config = tournamentFormat.getVisualizationConfig();
        
        return (
            <div
                key={match.id}
                className="bracket-match-container"
                data-match-type={position.matchType}
                style={{
                    position: 'absolute',
                    left: position.x,
                    top: position.y,
                    width: position.width,
                    height: position.height,
                    zIndex: position.zIndex || 20
                }}
            >
                <MatchCard
                    match={match}
                    tournament={tournament}
                    onEditMatch={onEditMatch}
                    canEditMatches={canEditMatches}
                    onMatchClick={onMatchClick}
                    customLabel={matchLabel}
                    matchType={position.matchType}
                />
            </div>
        );
    };
    
    // Рендер заголовков раундов для Double Elimination
    const renderDoubleEliminationHeaders = () => {
        if (tournament?.bracket_type !== 'double_elimination') return null;
        
        const headers = [];
        
        // Заголовки Winners Bracket
        if (groupedMatches.winners) {
            Object.entries(groupedMatches.winners).forEach(([round, matches]) => {
                const firstMatch = matches[0];
                const position = firstMatch ? matchPositions.get(firstMatch.id) : null;
                if (position) {
                    const context = getRoundContext(parseInt(round), matches, 'winner');
                    const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                    headers.push(
                        <div
                            key={`winner-header-${round}`}
                            className="bracket-round-header-absolute bracket-winners-bracket-header"
                            style={{
                                position: 'absolute',
                                left: position.x,
                                top: position.y - 40,
                                zIndex: 10
                            }}
                        >
                            <h3 className="bracket-round-header">{roundName}</h3>
                        </div>
                    );
                }
            });
        }
        
        // Заголовки Losers Bracket
        if (groupedMatches.losers) {
            Object.entries(groupedMatches.losers).forEach(([round, matches]) => {
                const firstMatch = matches[0];
                const position = firstMatch ? matchPositions.get(firstMatch.id) : null;
                if (position) {
                    const context = getRoundContext(parseInt(round), matches, 'loser');
                    const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                    headers.push(
                        <div
                            key={`loser-header-${round}`}
                            className="bracket-round-header-absolute bracket-losers-bracket-header"
                            style={{
                                position: 'absolute',
                                left: position.x,
                                top: position.y - 40,
                                zIndex: 10
                            }}
                        >
                            <h3 className="bracket-round-header">{roundName}</h3>
                        </div>
                    );
                }
            });
        }
        
        // Заголовок Grand Final
        if (groupedMatches.grandFinal && groupedMatches.grandFinal.length > 0) {
            const firstMatch = groupedMatches.grandFinal[0];
            const position = firstMatch ? matchPositions.get(firstMatch.id) : null;
            if (position) {
                headers.push(
                    <div
                        key="grand-final-header"
                        className="bracket-round-header-absolute bracket-grand-final-header"
                        style={{
                            position: 'absolute',
                            left: position.x,
                            top: position.y - 40,
                            zIndex: 10
                        }}
                    >
                        <h3 className="bracket-round-header">🏁 Grand Final</h3>
                    </div>
                );
            }
        }
        
        return headers;
    };
    
    // Основной рендер с поддержкой разных форматов
    if (tournament?.bracket_type === 'double_elimination') {
        // Рендер Double Elimination
        return (
            <div className="bracket-renderer-container bracket-double-elimination" ref={containerRef}>
                <div className="bracket-renderer" style={{ position: 'relative', minHeight: dimensions.height }}>
                    {/* SVG слой для соединений */}
                    <BracketConnections
                        connections={connections}
                        dimensions={dimensions}
                    />
                    
                    {/* Заголовки раундов */}
                    {renderDoubleEliminationHeaders()}
                    
                    {/* Все матчи */}
                    {matches.map(match => {
                        const position = matchPositions.get(match.id);
                        return renderMatch(match, position);
                    })}
                </div>
            </div>
        );
    }
    
    // Рендер Single Elimination (существующая логика)
    return (
        <div className="bracket-renderer-container bracket-single-elimination" ref={containerRef}>
            <div className="bracket-renderer" style={{ position: 'relative', minHeight: dimensions.height }}>
                {/* SVG слой для соединений */}
                <BracketConnections
                    connections={connections}
                    dimensions={dimensions}
                />
                
                {/* Заголовки раундов */}
                <div className="bracket-headers">
                    {Object.entries(groupedMatches)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([round, roundData]) => {
                            const context = getRoundContext(parseInt(round), roundData);
                            const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                            
                            // Находим позицию первого матча раунда для размещения заголовка
                            const firstMatch = [...(roundData.special || []), ...(roundData.regular || [])][0];
                            const firstPosition = firstMatch ? matchPositions.get(firstMatch.id) : null;
                            
                            if (!firstPosition) return null;
                            
                            return (
                                <div
                                    key={`header-${round}`}
                                    className="bracket-round-header-absolute"
                                    style={{
                                        position: 'absolute',
                                        left: firstPosition.x,
                                        top: 10,
                                        zIndex: 10
                                    }}
                                >
                                    <h3 className="bracket-round-header">{roundName}</h3>
                                </div>
                            );
                        })}
                </div>
                
                {/* Все матчи */}
                {matches.map(match => {
                    const position = matchPositions.get(match.id);
                    return renderMatch(match, position);
                })}
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

    return (
        <div 
            className={`bracket-match-card ${getBracketTypeStyle()}`}
            onClick={() => onMatchClick && onMatchClick(match)}
            style={{ cursor: onMatchClick ? 'pointer' : 'default' }}
        >
            <div className="bracket-match-info">
                <span className="bracket-match-title">{getMatchTitle()}</span>
                <div className="bracket-match-indicators">
                    {(match.bracket_type === 'placement' || match.is_third_place_match) && (
                        <span className="bracket-type-indicator">🥉</span>
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