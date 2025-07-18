// frontend/src/components/BracketRenderer.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './BracketRenderer.css';
import { safeParseBracketId } from '../utils/safeParseInt';

const BracketRenderer = ({ games, tournament, onEditMatch, canEditMatches, selectedMatch, setSelectedMatch, format, onMatchClick }) => {
    // 🔧 ИСПРАВЛЕНО: Используем games вместо matches
    const matches = games || [];
    
    // Группировка матчей по типам bracket для double elimination
    const groupedMatches = useMemo(() => {
        if (!matches || matches.length === 0) return { single: [], winners: [], losers: [], grandFinal: [] };
        
        // 🔧 ИСПРАВЛЕНО: Добавляем проверки на undefined и bracket_type
        const safeTournament = tournament || {};
        const safeMatches = matches.filter(m => m && typeof m === 'object' && m.id);
        
        if (safeTournament.bracket_type === 'double_elimination') {
            return {
                winners: safeMatches.filter(m => (m.bracket_type || 'winner') === 'winner').sort((a, b) => a.round - b.round || a.match_number - b.match_number),
                losers: safeMatches.filter(m => (m.bracket_type || 'winner') === 'loser').sort((a, b) => a.round - b.round || a.match_number - b.match_number),
                grandFinal: safeMatches.filter(m => {
                    const bracketType = m.bracket_type || 'winner';
                    return bracketType === 'grand_final' || bracketType === 'grand_final_reset';
                }).sort((a, b) => a.match_number - b.match_number)
            };
        } else {
            // 🔧 ИСПРАВЛЕНО: Специальная сортировка для single elimination с учетом матча за 3-е место
            const sortedMatches = safeMatches.sort((a, b) => {
                // Сначала сортируем по раундам
                if (a.round !== b.round) {
                    return a.round - b.round;
                }
                
                // В одном раунде: матч за 3-е место (match_number=0) идет перед финалом (match_number=1)
                if (a.match_number !== undefined && b.match_number !== undefined) {
                    return a.match_number - b.match_number;
                }
                
                // Fallback: обычная сортировка
                return (a.id || 0) - (b.id || 0);
            });
            
            return {
                single: sortedMatches
            };
        }
    }, [matches, tournament?.bracket_type]);

    // 🔧 ИСПРАВЛЕНО: Добавляем проверку на пустые матчи
    if (!matches || matches.length === 0) {
        return (
            <div className="bracket-renderer">
                <div className="empty-bracket-message">
                    🎯 Турнирная сетка пока не создана
                </div>
            </div>
        );
    }

    // 🔧 УЛУЧШЕННАЯ ФУНКЦИЯ ДЛЯ ОПРЕДЕЛЕНИЯ НАЗВАНИЯ РАУНДА
    const getRoundName = (round, totalRounds, participantCount, isThirdPlaceMatch = false) => {
        console.log(`🔍 getRoundName: round=${round}, totalRounds=${totalRounds}, participantCount=${participantCount}, isThirdPlaceMatch=${isThirdPlaceMatch}`);
        
        // 🔧 ИСПРАВЛЕНО: Обрабатываем матч за 3-е место отдельно
        if (isThirdPlaceMatch) {
            console.log('🥉 Матч за 3-е место обнаружен');
            return 'Матч за 3-е место';
        }
        
        // Предварительный раунд всегда имеет приоритет
        if (round === -1) {
            console.log('✅ Предварительный раунд обнаружен');
            return 'Предварительный раунд';
        }
        
        // Простая логика: определяем по позиции относительно финала
        const roundsFromEnd = totalRounds - round;
        console.log(`🎯 roundsFromEnd=${roundsFromEnd} (totalRounds=${totalRounds} - round=${round})`);
        
        // Базовая логика для всех турниров
        if (roundsFromEnd === 0) {
            console.log('✅ Финальный раунд');
            return 'Финал';
        } else if (roundsFromEnd === 1) {
            console.log('✅ Полуфинал');
            return 'Полуфинал';
        } else if (roundsFromEnd === 2) {
            console.log('✅ Четвертьфинал');
            return 'Четвертьфинал';
        } else if (roundsFromEnd === 3) {
            console.log('✅ 1/8 финала');
            return '1/8 финала';
        } else if (roundsFromEnd === 4) {
            console.log('✅ 1/16 финала');
            return '1/16 финала';
        } else if (roundsFromEnd === 5) {
            console.log('✅ 1/32 финала');
            return '1/32 финала';
        } else if (roundsFromEnd === 6) {
            console.log('✅ 1/64 финала');
            return '1/64 финала';
        } else {
            // Для очень ранних раундов или нестандартных случаев
            const result = round === 1 ? 'Первый раунд' : `Раунд ${round}`;
            console.log(`✅ Дефолтный случай: ${result}`);
            return result;
        }
    };

    // Рендер single elimination
    const renderSingleElimination = () => {
        if (groupedMatches.single.length === 0) {
            return (
                <div className="empty-bracket-message">
                    🎯 Нет матчей для отображения
                </div>
            );
        }

        const rounds = groupedMatches.single.reduce((acc, match) => {
            if (!acc[match.round]) acc[match.round] = [];
            acc[match.round].push(match);
            return acc;
        }, {});

        // 🔧 ИСПРАВЛЕНО: Определяем общее количество раундов ИСКЛЮЧАЯ предварительный раунд
        const regularRounds = Object.keys(rounds).map(Number).filter(r => r >= 1);
        const totalRounds = regularRounds.length > 0 ? Math.max(...regularRounds) : 1;
        const participantCount = tournament?.participants_count || 0;

        // Отладочная информация
        console.log('🔍 Анализ раундов:', {
            allRounds: Object.keys(rounds).map(Number),
            regularRounds,
            totalRounds,
            participantCount,
            tournament: tournament?.name || 'Unknown'
        });

        // Сортируем раунды по порядку
        const sortedRounds = Object.entries(rounds).sort(([a], [b]) => parseInt(a) - parseInt(b));

        return (
            <div className="bracket-single-elimination">
                {/* 🔧 НОВОЕ: Заголовки раундов в одну линию сверху */}
                <div className="bracket-headers">
                    {sortedRounds.map(([round, roundMatches]) => {
                        // 🔧 ИСПРАВЛЕНО: Проверяем, есть ли матч за 3-е место в этом раунде
                        const hasThirdPlaceMatch = roundMatches.some(match => 
                            match.bracket_type === 'placement' || match.is_third_place_match
                        );
                        
                        return (
                            <div key={`header-${round}`} className="round-header-container">
                                <h3 className="round-header">
                                    {hasThirdPlaceMatch ? 
                                        'Матч за 3-е место / Финал' : 
                                        getRoundName(parseInt(round), totalRounds, participantCount, false)
                                    }
                                </h3>
                            </div>
                        );
                    })}
                </div>

                {/* 🔧 НОВОЕ: Контейнер для матчей без заголовков */}
                <div className="bracket-content">
                    {sortedRounds.map(([round, roundMatches]) => (
                        <div key={round} className="bracket-round">
                            <div className="round-matches">
                                {roundMatches.map(match => (
                                    <MatchCard
                                        key={match.id}
                                        match={match}
                                        tournament={tournament}
                                        onEditMatch={onEditMatch}
                                        canEditMatches={canEditMatches}
                                        onMatchClick={onMatchClick}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Рендер double elimination
    const renderDoubleElimination = () => {
        const winnersRounds = groupedMatches.winners.reduce((acc, match) => {
            if (!acc[match.round]) acc[match.round] = [];
            acc[match.round].push(match);
            return acc;
        }, {});

        const losersRounds = groupedMatches.losers.reduce((acc, match) => {
            if (!acc[match.round]) acc[match.round] = [];
            acc[match.round].push(match);
            return acc;
        }, {});

        // Определяем общее количество раундов для правильного наименования
        const winnersTotalRounds = Object.keys(winnersRounds).length;
        const losersTotalRounds = Object.keys(losersRounds).length;
        const participantCount = tournament?.participants_count || 0;
                                        
        return (
            <div className="bracket-double-elimination">
                {/* Winners Bracket */}
                <div className="winners-bracket">
                    <h2 className="bracket-title">🏆 Winners Bracket</h2>
                    <div className="bracket-rounds">
                        {Object.entries(winnersRounds).map(([round, roundMatches]) => (
                            <div key={`winner-${round}`} className="bracket-round">
                                <h3 className="round-header">
                                    WR {round}: {getRoundName(parseInt(round), winnersTotalRounds, participantCount)}
                                </h3>
                                <div className="round-matches">
                                    {roundMatches.map(match => (
                                        <MatchCard
                                            key={match.id}
                                            match={match}
                                            tournament={tournament}
                                            onEditMatch={onEditMatch}
                                            canEditMatches={canEditMatches}
                                            onMatchClick={onMatchClick}
                                            bracketType="winner"
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Losers Bracket */}
                <div className="losers-bracket">
                    <h2 className="bracket-title">💔 Losers Bracket</h2>
                    <div className="bracket-rounds">
                        {Object.entries(losersRounds).map(([round, roundMatches]) => (
                            <div key={`loser-${round}`} className="bracket-round">
                                <h3 className="round-header">
                                    LR {round}: {getRoundName(parseInt(round), losersTotalRounds, participantCount)}
                                </h3>
                                <div className="round-matches">
                                    {roundMatches.map(match => (
                                        <MatchCard
                                            key={match.id}
                                            match={match}
                                            tournament={tournament}
                                            onEditMatch={onEditMatch}
                                            canEditMatches={canEditMatches}
                                            onMatchClick={onMatchClick}
                                            bracketType="loser"
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Grand Final */}
                {groupedMatches.grandFinal.length > 0 && (
                    <div className="grand-final-bracket">
                        <h2 className="bracket-title">🏁 Grand Final</h2>
                        <div className="grand-final-matches">
                            {groupedMatches.grandFinal.map(match => (
                                <MatchCard
                                    key={match.id}
                                    match={match}
                                    tournament={tournament}
                                    onEditMatch={onEditMatch}
                                    canEditMatches={canEditMatches}
                                    onMatchClick={onMatchClick}
                                    bracketType="grand_final"
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Основной рендер
    return (
        <div className="bracket-renderer">
            {/* 🔧 ИСПРАВЛЕНО: Безопасное обращение к tournament.bracket_type */}
            {(tournament?.bracket_type || 'single_elimination') === 'double_elimination' ? renderDoubleElimination() : renderSingleElimination()}
        </div>
    );
};

// MatchCard компонент с поддержкой bracket_type
const MatchCard = ({ match, tournament, onEditMatch, canEditMatches, onMatchClick, bracketType = 'single' }) => {
    const getBracketTypeStyle = () => {
        // 🔧 ИСПРАВЛЕНО: Проверяем матч за 3-е место
        if (match.bracket_type === 'placement' || match.is_third_place_match) {
            return 'match-card-third-place';
        }
        
        switch (bracketType) {
            case 'winner':
                return 'match-card-winner';
            case 'loser':
                return 'match-card-loser';
            case 'grand_final':
                return 'match-card-grand-final';
            default:
                return 'match-card-single';
        }
    };

    // 🔧 ИСПРАВЛЕНО: Определяем название матча
    const getMatchTitle = () => {
        if (match.bracket_type === 'placement' || match.is_third_place_match) {
            return 'Матч за 3-е место';
        }
        
        // Для финального раунда, если это не матч за 3-е место
        if (match.round && tournament?.participants_count) {
            const totalRounds = Math.max(...(tournament.matches || []).map(m => m.round || 0));
            const roundsFromEnd = totalRounds - match.round;
            
            if (roundsFromEnd === 0 && match.match_number === 1) {
                return 'Финал';
            }
        }
        
        return `Матч #${match.match_number || match.id}`;
    };

    // 🔧 ИСПРАВЛЕНО: Обработка данных матча для нового формата
    const getParticipantData = (participantIndex) => {
        if (match.participants && match.participants[participantIndex]) {
            const participant = match.participants[participantIndex];
            // 🔧 ИСПРАВЛЕНО: TBD не может быть победителем
            const isTBD = !participant.name || participant.name === 'TBD';
            return {
                name: participant.name || 'TBD',
                score: participant.resultText || participant.score || 0,
                isWinner: !isTBD && (participant.isWinner || false)
            };
        }
        
        // Fallback для старого формата
        if (participantIndex === 0) {
            // 🔧 ИСПРАВЛЕНО: Проверяем, что команда существует и матч завершен
            const teamName = match.team1_name || match.team1_id;
            const isTBD = !teamName || teamName === 'TBD';
            const isWinner = !isTBD && 
                            match.winner_team_id && 
                            match.team1_id && 
                            match.winner_team_id === match.team1_id;
            
            return {
                name: teamName || 'TBD',
                score: match.score1 || 0,
                isWinner: isWinner || false
            };
        } else {
            // 🔧 ИСПРАВЛЕНО: Проверяем, что команда существует и матч завершен
            const teamName = match.team2_name || match.team2_id;
            const isTBD = !teamName || teamName === 'TBD';
            const isWinner = !isTBD && 
                            match.winner_team_id && 
                            match.team2_id && 
                            match.winner_team_id === match.team2_id;
            
            return {
                name: teamName || 'TBD',
                score: match.score2 || 0,
                isWinner: isWinner || false
            };
        }
    };

    const participant1 = getParticipantData(0);
    const participant2 = getParticipantData(1);

    // 🔧 ИСПРАВЛЕНО: Обработка статуса матча
    const getMatchStatus = () => {
        if (match.state === 'DONE') return 'completed';
        if (match.state === 'READY') return 'ready';
        if (match.state === 'SCHEDULED') return 'pending';
        
        // Fallback для старого формата
        if (match.status) return match.status;
        if (match.winner_team_id) return 'completed';
        if (match.team1_id && match.team2_id) return 'ready';
        return 'pending';
    };

    const matchStatus = getMatchStatus();

    return (
        <div 
            className={`match-card ${getBracketTypeStyle()}`}
            onClick={() => onMatchClick && onMatchClick(match)}
            style={{ cursor: onMatchClick ? 'pointer' : 'default' }}
        >
            <div className="match-info">
                <span className="match-title">{getMatchTitle()}</span>
                {(match.bracket_type === 'placement' || match.is_third_place_match) && (
                    <span className="bracket-type-indicator">🥉</span>
                )}
                {bracketType !== 'single' && (
                    <span className="bracket-type-indicator">
                        {bracketType === 'winner' && '🏆'}
                        {bracketType === 'loser' && '💔'}
                        {bracketType === 'grand_final' && '🏁'}
                    </span>
                )}
            </div>
            
            <div className="match-participants">
                <div className={`participant ${
                    participant1.isWinner ? 'winner' : 
                    (participant1.name === 'TBD' ? 'tbd' : '')
                }`}>
                    <span className="participant-name">
                        {participant1.name}
                    </span>
                    <span className="participant-score">{participant1.score}</span>
                </div>
                <div className="vs-separator">VS</div>
                <div className={`participant ${
                    participant2.isWinner ? 'winner' : 
                    (participant2.name === 'TBD' ? 'tbd' : '')
                }`}>
                    <span className="participant-name">
                        {participant2.name}
                    </span>
                    <span className="participant-score">{participant2.score}</span>
                </div>
            </div>
            
            <div className="match-status">
                <span className={`status-badge status-${matchStatus}`}>
                    {matchStatus === 'pending' && 'Ожидание'}
                    {matchStatus === 'ready' && 'Готов'}
                    {matchStatus === 'in_progress' && 'Идет'}
                    {matchStatus === 'completed' && 'Завершен'}
                </span>
            </div>
            
            {onEditMatch && canEditMatches && (
                <button 
                    className="edit-match-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEditMatch(match);
                    }}
                    title="Редактировать матч"
                >
                    ✏️
                </button>
            )}
        </div>
    );
};

export default BracketRenderer;