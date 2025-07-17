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
            return {
                single: safeMatches.sort((a, b) => a.round - b.round || a.match_number - b.match_number)
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
    const getRoundName = (round, totalRounds, participantCount) => {
        if (round === -1) return 'Предварительный раунд';
        
        // Специальная обработка для микс-турниров (обычно 4-8 команд)
        if (participantCount <= 8) {
            if (totalRounds === 1) return 'Финал';
            if (totalRounds === 2) {
                return round === 1 ? 'Полуфинал' : 'Финал';
            }
            if (totalRounds === 3) {
                switch (round) {
                    case 1: return 'Четвертьфинал';
                    case 2: return 'Полуфинал';
                    case 3: return 'Финал';
                }
            }
        }
        
        // Для больших турниров определяем по позиции относительно финала
        const roundsFromEnd = totalRounds - round;
        
        switch (roundsFromEnd) {
            case 0:
                return 'Финал';
            case 1:
                return 'Полуфинал';
            case 2:
                return 'Четвертьфинал';
            case 3:
                return '1/8 финала';
            case 4:
                return '1/16 финала';
            case 5:
                return '1/32 финала';
            case 6:
                return '1/64 финала';
            default:
                // Для очень ранних раундов или нестандартных случаев
                return round === 1 ? 'Первый раунд' : `Раунд ${round}`;
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

        // Определяем общее количество раундов и участников
        const totalRounds = Math.max(...Object.keys(rounds).map(Number));
        const participantCount = tournament?.participants_count || 0;

        return (
            <div className="bracket-single-elimination">
                {Object.entries(rounds).map(([round, roundMatches]) => (
                    <div key={round} className="bracket-round">
                        <h3 className="round-header">
                            {getRoundName(parseInt(round), totalRounds, participantCount)}
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
                                />
                            ))}
                        </div>
                    </div>
                ))}
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
                <span className="match-number">#{match.match_number || match.id}</span>
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