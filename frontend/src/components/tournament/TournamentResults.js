import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ensureHttps } from '../../utils/userHelpers';
import './TournamentResults.css';

/**
 * 🏆 КОМПОНЕНТ РЕЗУЛЬТАТОВ ТУРНИРА
 * Отображает итоговые места участников и историю матчей
 * Данные загружаются напрямую из БД через API
 */
const TournamentResults = ({ tournament }) => {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Загружаем результаты турнира из API
    useEffect(() => {
        if (!tournament?.id) return;

        const fetchResults = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const response = await fetch(`/api/tournaments/${tournament.id}/results`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                setResults(data);
                
                // Отладочная информация (только в development)
                if (process.env.NODE_ENV === 'development') {
                    console.log('🏆 Результаты турнира получены из API:', {
                        tournamentId: tournament.id,
                        format: data.tournament.format,
                        totalMatches: data.matches.length,
                        completedMatches: data.matches.filter(m => m.status === 'completed').length,
                        standingsCount: data.standings.length,
                        historyCount: data.matchHistory.length
                    });
                }
                
            } catch (error) {
                console.error('❌ Ошибка загрузки результатов турнира:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [tournament?.id]);

    // Состояния загрузки и ошибок
    if (loading) {
        return (
            <div className="results-tournament-results">
                <div className="results-loading">
                    <span>📊 Загрузка результатов...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="results-tournament-results">
                <div className="results-error">
                    <span>❌ Ошибка загрузки: {error}</span>
                </div>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="results-tournament-results-empty">
                <div className="results-empty-state">
                    <span className="results-empty-icon">📊</span>
                    <h3>Результаты недоступны</h3>
                    <p>Не удалось загрузить результаты турнира</p>
                </div>
            </div>
        );
    }

    // Проверяем есть ли данные для отображения
    const hasCompletedMatches = results.matches.filter(m => m.status === 'completed' && m.winner_team_id).length > 0;
    const showResults = tournament?.status === 'completed' || hasCompletedMatches;
    
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
            {tournament?.status === 'completed' && results.standings.length > 0 && (
                <div className="results-final-standings-section">
                    <div className="results-section-header">
                        <h3>🏆 Итоговые результаты турнира</h3>
                        <div className="results-tournament-info">
                            <span className="results-format-badge">{getFormatDisplayName(results.tournament.format)}</span>
                            <span className="results-participants-count">{results.standings.length} участников</span>
                        </div>
                    </div>
                    
                    <div className="results-standings-list">
                        {renderStandings(results.standings)}
                    </div>
                </div>
            )}

            {/* Блок 2: История матчей */}
            {results.matchHistory.length > 0 ? (
                <div className="results-match-history-section">
                    <div className="results-section-header">
                        <h3>📋 История матчей</h3>
                        <div className="results-history-stats">
                            <span className="results-matches-count">{results.matchHistory.length} завершенных матчей</span>
                        </div>
                    </div>
                    
                    <div className="results-match-history-list">
                        {results.matchHistory.map(match => renderMatchHistoryItem(match))}
                    </div>
                </div>
            ) : (
                // Временно показываем отладочную информацию
                <div className="results-match-history-section">
                    <div className="results-section-header">
                        <h3>🔍 Отладочная информация</h3>
                    </div>
                    <div style={{color: '#999', padding: '20px'}}>
                        <p>Турнир: {results.tournament.name}</p>
                        <p>Формат: {results.tournament.format}</p>
                        <p>Статус: {results.tournament.status}</p>
                        <p>Всего матчей: {results.matches.length}</p>
                        <p>Завершенных матчей: {results.matches.filter(m => m.status === 'completed').length}</p>
                        <p>Участников: {results.participants.length}</p>
                        <p>Команд: {results.tournament.teams ? results.tournament.teams.length : 0}</p>
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
                                        <span className="results-wins">Побед: {participant.wins}</span>
                                        <span className="results-losses">Поражений: {participant.losses}</span>
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
                                        src={ensureHttps(match.loser?.avatar_url) || '/default-avatar.png'}
                                        alt={match.loser?.name || 'BYE'}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                <span className="results-participant-name">{match.loser?.name || 'BYE'}</span>
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
                        {formatMatchDate(match.updated_at || match.created_at)}
                    </span>
                </div>
            </div>
        );
    }
};

// Вспомогательные функции
function groupStandingsByPlace(standings) {
    return standings.reduce((groups, participant) => {
        const place = participant.place || 999;
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
    const formats = {
        'single_elimination': 'Single Elimination',
        'double_elimination': 'Double Elimination',
        'round_robin': 'Round Robin',
        'swiss': 'Swiss',
        'mix': 'Mix'
    };
    return formats[format] || format;
}

function getBracketTypeDisplayName(bracketType) {
    const types = {
        'winner': 'Винеры',
        'loser': 'Лузеры',
        'loser_semifinal': 'Малый финал лузеров',
        'loser_final': 'Финал лузеров',
        'grand_final': 'Гранд финал',
        'grand_final_reset': 'Гранд финал (реванш)'
    };
    return types[bracketType] || bracketType;
}

function getFormattedScore(match) {
    // Если есть данные о картах и только одна карта - показываем счет карты
    if (match.maps_data && Array.isArray(match.maps_data) && match.maps_data.length === 1) {
        const mapData = match.maps_data[0];
        if (mapData.score1 !== null && mapData.score2 !== null) {
            return `${mapData.score1}:${mapData.score2}`;
        }
    }
    
    // Иначе показываем общий счет матча
    return `${match.score1 || 0}:${match.score2 || 0}`;
}

function formatMatchDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Только что';
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    
    return date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit',
        year: 'numeric'
    });
}

export default TournamentResults;