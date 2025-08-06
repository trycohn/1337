import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ensureHttps } from '../../utils/userHelpers';
import './TournamentResults.css';

/**
 * 🏆 КОМПОНЕНТ РЕЗУЛЬТАТОВ ТУРНИРА
 * Отображает итоговые места участников и историю матчей
 */
const TournamentResults = ({ tournament, matches = [], participants = [] }) => {
    // Вычисляем итоговые места участников/команд
    const finalStandings = useMemo(() => {
        if (!tournament || !matches) return [];

        // Получаем всех участников с их результатами
        const standingsMap = new Map();
        
        // Отладочная информация (только в development)
        if (process.env.NODE_ENV === 'development') {
            console.log('🏆 Подсчет статистики турнира:', {
                tournamentId: tournament.id,
                format: tournament.format,
                totalMatches: matches.length,
                completedMatches: matches.filter(m => m.status === 'completed').length,
                teamsCount: tournament.teams?.length || 0,
                participantsCount: participants?.length || 0
            });
        }
        
        // Для микс турниров работаем с командами, для остальных - с участниками
        if (tournament.format === 'mix' && tournament.teams && tournament.teams.length > 0) {
            // Инициализируем команды микс турнира
            tournament.teams.forEach(team => {
                standingsMap.set(team.id, {
                    id: team.id,
                    name: team.name,
                    avatar_url: team.avatar_url,
                    user_id: null, // У команды нет конкретного user_id
                    place: null,
                    status: 'участвовала',
                    elimination_round: null,
                    wins: 0,
                    losses: 0,
                    type: 'team',
                    members: team.members || []
                });
            });
        } else if (participants && participants.length > 0) {
            // Инициализируем индивидуальных участников
            participants.forEach(participant => {
                standingsMap.set(participant.id, {
                    id: participant.id,
                    name: participant.name || participant.username,
                    avatar_url: participant.avatar_url,
                    user_id: participant.user_id,
                    place: null,
                    status: 'участвовал',
                    elimination_round: null,
                    wins: 0,
                    losses: 0,
                    type: 'individual'
                });
            });
        }

        // Анализируем матчи для определения мест
        const completedMatches = matches.filter(m => m.status === 'completed' && m.winner_team_id);
        
        if (process.env.NODE_ENV === 'development') {
            console.log('🎯 Завершенные матчи для подсчета:', completedMatches.map(m => ({
                id: m.id,
                match_number: m.match_number,
                team1_id: m.team1_id,
                team2_id: m.team2_id,
                winner_team_id: m.winner_team_id,
                status: m.status
            })));
        }
        
        completedMatches.forEach(match => {
            const winnerId = match.winner_team_id;
            const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;
            
            // Обновляем статистику победителя
            const winner = standingsMap.get(winnerId);
            if (winner) {
                winner.wins++;
            }
            
            // Обновляем статистику проигравшего (только если это не BYE)
            if (loserId && loserId !== null) {
                const loser = standingsMap.get(loserId);
                if (loser) {
                    loser.losses++;
                    // Записываем раунд выбывания
                    if (!loser.elimination_round || match.round > loser.elimination_round) {
                        loser.elimination_round = match.round;
                    }
                }
            }
        });

        // Отладочная информация после подсчета статистики
        const standings = Array.from(standingsMap.values());
        if (process.env.NODE_ENV === 'development') {
            console.log('📊 Статистика после подсчета:', standings.map(s => ({
                name: s.name,
                wins: s.wins,
                losses: s.losses,
                elimination_round: s.elimination_round
            })));
        }

        // Определяем места на основе структуры турнира
        
        if (tournament.format === 'single_elimination') {
            return calculateSingleEliminationStandings(standings, completedMatches, tournament);
        } else if (tournament.format === 'double_elimination') {
            return calculateDoubleEliminationStandings(standings, completedMatches, tournament);
        }
        
        // Для других форматов сортируем по количеству побед
        return standings
            .sort((a, b) => b.wins - a.wins)
            .map((participant, index) => ({
                ...participant,
                place: index + 1
            }));
    }, [tournament, matches, participants]);

    // Получаем историю матчей в хронологическом порядке
    const matchHistory = useMemo(() => {
        if (!matches) return [];
        
        return matches
            .filter(match => match.status === 'completed' && match.winner_team_id)
            .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
            .map(match => {
                let team1, team2, winner, loser;
                
                // Для микс турниров ищем команды, для остальных - участников
                if (tournament.format === 'mix' && tournament.teams) {
                    team1 = tournament.teams.find(t => t.id === match.team1_id);
                    team2 = tournament.teams.find(t => t.id === match.team2_id);
                } else {
                    team1 = participants.find(p => p.id === match.team1_id);
                    team2 = participants.find(p => p.id === match.team2_id);
                }
                
                winner = match.winner_team_id === match.team1_id ? team1 : team2;
                loser = match.winner_team_id === match.team1_id ? team2 : team1;
                
                return {
                    id: match.id,
                    match_number: match.match_number,
                    round: match.round,
                    round_name: match.round_name || `Раунд ${match.round}`,
                    winner: {
                        id: winner?.id,
                        name: winner?.name || winner?.username || 'TBD',
                        avatar_url: winner?.avatar_url
                    },
                    loser: {
                        id: loser?.id,
                        name: loser?.name || loser?.username || 'TBD',
                        avatar_url: loser?.avatar_url
                    },
                    score: `${match.score1 || 0}:${match.score2 || 0}`,
                    maps_data: match.maps_data || [],
                    date: match.updated_at || match.created_at,
                    bracket_type: match.bracket_type
                };
            });
    }, [matches, participants]);

    // Отображаем только если турнир завершен или есть результаты
    const showResults = tournament?.status === 'completed' || matchHistory.length > 0;
    
    if (!showResults) {
        return (
            <div className="results-tournament-results-empty">
                <div className="results-empty-state">
                    <span className="results-empty-icon">📊</span>
                    <h3>Результаты пока недоступны</h3>
                    <p>Результаты появятся после завершения первых матчей</p>
                </div>
            </div>
        );
    }

    return (
        <div className="results-tournament-results">
            {/* Блок 1: Итоговые места (показываем только если турнир завершен) */}
            {tournament?.status === 'completed' && finalStandings.length > 0 && (
                <div className="results-final-standings-section">
                    <div className="results-section-header">
                        <h3>🏆 Итоговые результаты турнира</h3>
                        <div className="results-tournament-info">
                            <span className="results-format-badge">{getFormatDisplayName(tournament.format)}</span>
                            <span className="results-participants-count">{participants.length} участников</span>
                        </div>
                    </div>
                    
                    <div className="results-standings-list">
                        {renderStandings(finalStandings)}
                    </div>
                </div>
            )}

            {/* Блок 2: История матчей */}
            {matchHistory.length > 0 && (
                <div className="results-match-history-section">
                    <div className="results-section-header">
                        <h3>📋 История матчей</h3>
                        <div className="results-history-stats">
                            <span className="results-matches-count">{matchHistory.length} завершенных матчей</span>
                        </div>
                    </div>
                    
                    <div className="results-match-history-list">
                        {matchHistory.map(match => renderMatchHistoryItem(match))}
                    </div>
                </div>
            )}
        </div>
    );

    // Рендер итоговых мест
    function renderStandings(standings) {
        const groupedByPlace = groupStandingsByPlace(standings);
        
        return Object.entries(groupedByPlace)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([place, participants]) => (
                <div key={place} className="results-standings-group">
                    <div className="results-place-header">
                        <span className="results-place-number">
                            {getPlaceIcon(parseInt(place))} {place}-е место
                        </span>
                        {participants.length > 1 && (
                            <span className="results-shared-place">разделили {participants.length} участника</span>
                        )}
                    </div>
                    
                    <div className="results-participants-list">
                        {participants.map(participant => (
                            <div key={participant.id} className={`results-participant-card ${participant.type === 'team' ? 'results-team-card' : ''}`}>
                                <div className="results-participant-avatar">
                                    <img 
                                        src={ensureHttps(participant.avatar_url) || '/default-avatar.png'}
                                        alt={participant.name}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                
                                <div className="results-participant-info">
                                    <div className="results-participant-name">
                                        {participant.user_id ? (
                                            <Link 
                                                to={`/user/${participant.user_id}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                            >
                                                {participant.name}
                                            </Link>
                                        ) : (
                                            <span>{participant.name}</span>
                                        )}
                                        {participant.type === 'team' && (
                                            <span className="results-team-badge">👥</span>
                                        )}
                                    </div>
                                    
                                    {/* Показываем членов команды для микс турниров */}
                                    {participant.type === 'team' && participant.members && participant.members.length > 0 && (
                                        <div className="results-team-members">
                                            <span className="results-members-label">Состав:</span>
                                            <div className="results-members-list">
                                                {participant.members.map((member, index) => (
                                                    <span key={member.id || index} className="results-member-name">
                                                        {member.user_id ? (
                                                            <Link 
                                                                to={`/user/${member.user_id}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="results-member-link"
                                                            >
                                                                {member.username || member.name}
                                                            </Link>
                                                        ) : (
                                                            <span>{member.username || member.name}</span>
                                                        )}
                                                        {index < participant.members.length - 1 && ', '}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="results-participant-stats">
                                        {(participant.wins > 0 || participant.losses > 0) ? (
                                            <>
                                                <span className="results-wins">Побед: {participant.wins}</span>
                                                <span className="results-losses">Поражений: {participant.losses}</span>
                                            </>
                                        ) : (
                                            <span className="results-no-matches">Матчей не играл</span>
                                        )}
                                        {participant.elimination_round && (
                                            <span className="results-elimination">
                                                {participant.type === 'team' ? 'Выбыла' : 'Выбыл'} в раунде {participant.elimination_round}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ));
    }

    // Рендер элемента истории матчей
    function renderMatchHistoryItem(match) {
        return (
            <div key={match.id} className="results-match-history-item">
                <div className="results-match-info">
                    <div className="results-match-header">
                        <span className="results-match-number">#{match.match_number}</span>
                        <span className="results-round-name">{match.round_name}</span>
                        <span className="results-bracket-type">{getBracketTypeDisplayName(match.bracket_type)}</span>
                    </div>
                    
                    <div className="results-match-result">
                        <div className="results-participants">
                            <div className="results-participant results-winner">
                                <div className="results-participant-avatar">
                                    <img 
                                        src={ensureHttps(match.winner.avatar_url) || '/default-avatar.png'}
                                        alt={match.winner.name}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                <span className="results-participant-name">{match.winner.name}</span>
                                <span className="results-winner-badge">👑</span>
                            </div>
                            
                            <div className="results-score">
                                {getFormattedScore(match)}
                            </div>
                            
                            <div className="results-participant results-loser">
                                <div className="results-participant-avatar">
                                    <img 
                                        src={ensureHttps(match.loser.avatar_url) || '/default-avatar.png'}
                                        alt={match.loser.name}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                <span className="results-participant-name">{match.loser.name}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="results-match-actions">
                    <Link 
                        to={`/tournament/${tournament.id}/match/${match.id}`} 
                        className="results-match-details-link"
                        title="Подробности матча"
                    >
                        📋 Детали
                    </Link>
                    
                    <span className="results-match-date">
                        {formatMatchDate(match.date)}
                    </span>
                </div>
            </div>
        );
    }
};

// Вспомогательные функции
function calculateSingleEliminationStandings(standings, matches, tournament) {
    // Логика определения мест для Single Elimination
    const result = [...standings];
    
    // Победитель - тот, кто выиграл финал
    const finalMatch = matches.find(m => m.round_name?.includes('Финал') || m.bracket_type === 'grand_final');
    if (finalMatch) {
        const winner = result.find(p => p.id === finalMatch.winner_team_id);
        const finalist = result.find(p => p.id === (finalMatch.team1_id === finalMatch.winner_team_id ? finalMatch.team2_id : finalMatch.team1_id));
        
        if (winner) winner.place = 1;
        if (finalist) finalist.place = 2;
    }
    
    // Остальные места по раундам выбывания
    result.forEach(participant => {
        if (participant.place) return;
        
        if (participant.elimination_round) {
            // Примерное место по раунду выбывания
            const roundPlace = Math.pow(2, tournament.total_rounds - participant.elimination_round + 1);
            participant.place = Math.min(roundPlace, standings.length);
        } else {
            participant.place = standings.length; // Не участвовал в матчах
        }
    });
    
    return result.sort((a, b) => a.place - b.place);
}

function calculateDoubleEliminationStandings(standings, matches, tournament) {
    // Логика для Double Elimination аналогична, но учитывает лузерскую сетку
    return calculateSingleEliminationStandings(standings, matches, tournament);
}

function groupStandingsByPlace(standings) {
    return standings.reduce((groups, participant) => {
        const place = participant.place || 'Не определено';
        if (!groups[place]) groups[place] = [];
        groups[place].push(participant);
        return groups;
    }, {});
}

function getPlaceIcon(place) {
    switch (place) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return '🏅';
    }
}

function getFormatDisplayName(format) {
    switch (format) {
        case 'single_elimination': return 'Single Elimination';
        case 'double_elimination': return 'Double Elimination';
        case 'round_robin': return 'Round Robin';
        case 'swiss': return 'Swiss System';
        default: return format;
    }
}

function getBracketTypeDisplayName(bracketType) {
    switch (bracketType) {
        case 'winner': return 'Сетка победителей';
        case 'loser': return 'Сетка проигравших';
        case 'loser_semifinal': return 'Полуфинал проигравших';
        case 'loser_final': return 'Финал проигравших';
        case 'grand_final': return 'Гранд финал';
        case 'grand_final_reset': return 'Переигровка финала';
        default: return 'Основная сетка';
    }
}

function getFormattedScore(match) {
    // Если есть данные карт и только одна карта, показываем детальный счет
    if (match.maps_data && match.maps_data.length === 1) {
        const mapData = match.maps_data[0];
        if (mapData.score1 !== null && mapData.score2 !== null) {
            return `${mapData.score1}:${mapData.score2}`;
        }
    }
    
    return match.score;
}

function formatMatchDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Сегодня ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Вчера ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
        return `${diffDays} дн. назад`;
    } else {
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    }
}

export default TournamentResults;