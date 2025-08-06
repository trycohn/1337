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
        
        completedMatches.forEach(match => {
            const winner = standingsMap.get(match.team1_id === match.winner_team_id ? match.team1_id : match.team2_id);
            const loser = standingsMap.get(match.team1_id === match.winner_team_id ? match.team2_id : match.team1_id);
            
            if (winner) winner.wins++;
            if (loser) {
                loser.losses++;
                // Записываем раунд выбывания
                if (!loser.elimination_round || match.round > loser.elimination_round) {
                    loser.elimination_round = match.round;
                }
            }
        });

        // Определяем места на основе структуры турнира
        const standings = Array.from(standingsMap.values());
        
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
            <div className="tournament-results-empty">
                <div className="empty-state">
                    <span className="empty-icon">📊</span>
                    <h3>Результаты пока недоступны</h3>
                    <p>Результаты появятся после завершения первых матчей</p>
                </div>
            </div>
        );
    }

    return (
        <div className="tournament-results">
            {/* Блок 1: Итоговые места (показываем только если турнир завершен) */}
            {tournament?.status === 'completed' && finalStandings.length > 0 && (
                <div className="final-standings-section">
                    <div className="section-header">
                        <h3>🏆 Итоговые результаты турнира</h3>
                        <div className="tournament-info">
                            <span className="format-badge">{getFormatDisplayName(tournament.format)}</span>
                            <span className="participants-count">{participants.length} участников</span>
                        </div>
                    </div>
                    
                    <div className="standings-list">
                        {renderStandings(finalStandings)}
                    </div>
                </div>
            )}

            {/* Блок 2: История матчей */}
            {matchHistory.length > 0 && (
                <div className="match-history-section">
                    <div className="section-header">
                        <h3>📋 История матчей</h3>
                        <div className="history-stats">
                            <span className="matches-count">{matchHistory.length} завершенных матчей</span>
                        </div>
                    </div>
                    
                    <div className="match-history-list">
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
                <div key={place} className="standings-group">
                    <div className="place-header">
                        <span className="place-number">
                            {getPlaceIcon(parseInt(place))} {place}-е место
                        </span>
                        {participants.length > 1 && (
                            <span className="shared-place">разделили {participants.length} участника</span>
                        )}
                    </div>
                    
                    <div className="participants-list">
                        {participants.map(participant => (
                            <div key={participant.id} className={`participant-card ${participant.type === 'team' ? 'team-card' : ''}`}>
                                <div className="participant-avatar">
                                    <img 
                                        src={ensureHttps(participant.avatar_url) || '/default-avatar.png'}
                                        alt={participant.name}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                
                                <div className="participant-info">
                                    <div className="participant-name">
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
                                            <span className="team-badge">👥 Команда</span>
                                        )}
                                    </div>
                                    
                                    {/* Показываем членов команды для микс турниров */}
                                    {participant.type === 'team' && participant.members && participant.members.length > 0 && (
                                        <div className="team-members">
                                            <span className="members-label">Состав:</span>
                                            <div className="members-list">
                                                {participant.members.map((member, index) => (
                                                    <span key={member.id || index} className="member-name">
                                                        {member.user_id ? (
                                                            <Link 
                                                                to={`/user/${member.user_id}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="member-link"
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
                                    
                                    <div className="participant-stats">
                                        <span className="wins">Побед: {participant.wins}</span>
                                        <span className="losses">Поражений: {participant.losses}</span>
                                        {participant.elimination_round && (
                                            <span className="elimination">
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
            <div key={match.id} className="match-history-item">
                <div className="match-info">
                    <div className="match-header">
                        <span className="match-number">Матч #{match.match_number}</span>
                        <span className="round-name">{match.round_name}</span>
                        <span className="bracket-type">{getBracketTypeDisplayName(match.bracket_type)}</span>
                    </div>
                    
                    <div className="match-result">
                        <div className="participants">
                            <div className="participant winner">
                                <div className="participant-avatar">
                                    <img 
                                        src={ensureHttps(match.winner.avatar_url) || '/default-avatar.png'}
                                        alt={match.winner.name}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                <span className="participant-name">{match.winner.name}</span>
                                <span className="winner-badge">👑</span>
                            </div>
                            
                            <div className="score">
                                {getFormattedScore(match)}
                            </div>
                            
                            <div className="participant loser">
                                <div className="participant-avatar">
                                    <img 
                                        src={ensureHttps(match.loser.avatar_url) || '/default-avatar.png'}
                                        alt={match.loser.name}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                <span className="participant-name">{match.loser.name}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="match-actions">
                    <Link 
                        to={`/tournament/${tournament.id}/match/${match.id}`} 
                        className="match-details-link"
                        title="Подробности матча"
                    >
                        📋 Детали
                    </Link>
                    
                    <span className="match-date">
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