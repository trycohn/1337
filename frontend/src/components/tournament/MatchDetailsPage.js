import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ensureHttps } from '../../utils/userHelpers';
import './MatchDetailsPage.css';

/**
 * 📋 СТРАНИЦА ДЕТАЛЕЙ МАТЧА
 * Подробная информация о конкретном матче турнира
 */
const MatchDetailsPage = () => {
    const { tournamentId, matchId } = useParams();
    const navigate = useNavigate();
    const [match, setMatch] = useState(null);
    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchMatchDetails();
    }, [tournamentId, matchId]);

    const fetchMatchDetails = async () => {
        try {
            setLoading(true);
            
            // Получаем данные матча и турнира
            const [matchResponse, tournamentResponse] = await Promise.all([
                fetch(`/api/tournaments/${tournamentId}/matches/${matchId}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }),
                fetch(`/api/tournaments/${tournamentId}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                })
            ]);

            if (!matchResponse.ok || !tournamentResponse.ok) {
                throw new Error('Не удалось загрузить данные матча');
            }

            const matchData = await matchResponse.json();
            const tournamentData = await tournamentResponse.json();
            
            setMatch(matchData);
            setTournament(tournamentData);
        } catch (err) {
            console.error('Ошибка загрузки деталей матча:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="match-details-page">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Загрузка деталей матча...</p>
                </div>
            </div>
        );
    }

    if (error || !match) {
        return (
            <div className="match-details-page">
                <div className="error-state">
                    <span className="error-icon">❌</span>
                    <h3>Ошибка загрузки</h3>
                    <p>{error || 'Матч не найден'}</p>
                    <button 
                        className="back-btn"
                        onClick={() => navigate(`/tournaments/${tournamentId}`)}
                    >
                        ← Вернуться к турниру
                    </button>
                </div>
            </div>
        );
    }

    const team1 = match.team1 || { name: 'TBD' };
    const team2 = match.team2 || { name: 'TBD' };
    const winner = match.winner_team_id === match.team1_id ? team1 : team2;
    const loser = match.winner_team_id === match.team1_id ? team2 : team1;

    return (
        <div className="match-details-page">
            <div className="match-details-container">
                {/* Заголовок */}
                <div className="match-header">
                    <div className="breadcrumb">
                        <Link to={`/tournaments/${tournamentId}`} className="breadcrumb-link">
                            {tournament?.name || 'Турнир'}
                        </Link>
                        <span className="breadcrumb-separator">→</span>
                        <span className="breadcrumb-current">Матч #{match.match_number}</span>
                    </div>
                    
                    <div className="match-title">
                        <h1>Матч #{match.match_number}</h1>
                        <div className="match-meta">
                            <span className="round-name">{match.round_name || `Раунд ${match.round}`}</span>
                            <span className="bracket-type">{getBracketTypeDisplayName(match.bracket_type)}</span>
                            {match.status === 'completed' && (
                                <span className="status-badge completed">✅ Завершен</span>
                            )}
                            {match.status === 'in_progress' && (
                                <span className="status-badge in-progress">🎮 В процессе</span>
                            )}
                            {match.status === 'pending' && (
                                <span className="status-badge pending">⏳ Ожидание</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Основная информация о матче */}
                <div className="match-content">
                    <div className="match-participants">
                        <div className={`participant-card ${match.winner_team_id === match.team1_id ? 'winner' : 'loser'}`}>
                            <div className="participant-avatar">
                                <img 
                                    src={ensureHttps(team1.avatar_url) || '/default-avatar.png'}
                                    alt={team1.name}
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                            </div>
                            <div className="participant-info">
                                <div className="participant-name">
                                    {team1.user_id ? (
                                        <Link to={`/user/${team1.user_id}`} target="_blank">
                                            {team1.name}
                                        </Link>
                                    ) : (
                                        <span>{team1.name}</span>
                                    )}
                                </div>
                                {match.winner_team_id === match.team1_id && (
                                    <div className="winner-badge">👑 Победитель</div>
                                )}
                            </div>
                            <div className="participant-score">
                                {match.score1 || 0}
                            </div>
                        </div>

                        <div className="vs-separator">
                            <span className="vs-text">VS</span>
                        </div>

                        <div className={`participant-card ${match.winner_team_id === match.team2_id ? 'winner' : 'loser'}`}>
                            <div className="participant-score">
                                {match.score2 || 0}
                            </div>
                            <div className="participant-info">
                                <div className="participant-name">
                                    {team2.user_id ? (
                                        <Link to={`/user/${team2.user_id}`} target="_blank">
                                            {team2.name}
                                        </Link>
                                    ) : (
                                        <span>{team2.name}</span>
                                    )}
                                </div>
                                {match.winner_team_id === match.team2_id && (
                                    <div className="winner-badge">👑 Победитель</div>
                                )}
                            </div>
                            <div className="participant-avatar">
                                <img 
                                    src={ensureHttps(team2.avatar_url) || '/default-avatar.png'}
                                    alt={team2.name}
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Детали карт */}
                    {match.maps_data && match.maps_data.length > 0 && (
                        <div className="maps-section">
                            <h3>📋 Результаты по картам</h3>
                            <div className="maps-list">
                                {match.maps_data.map((mapData, index) => (
                                    <div key={index} className="map-result">
                                        <div className="map-info">
                                            <span className="map-name">
                                                {mapData.map_name || `Карта ${index + 1}`}
                                            </span>
                                        </div>
                                        <div className="map-score">
                                            <span className="score1">{mapData.score1 || 0}</span>
                                            <span className="separator">:</span>
                                            <span className="score2">{mapData.score2 || 0}</span>
                                        </div>
                                        <div className="map-winner">
                                            {mapData.winner_team_id === match.team1_id ? team1.name : 
                                             mapData.winner_team_id === match.team2_id ? team2.name : 'Ничья'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Дополнительная информация */}
                    <div className="match-info-section">
                        <h3>ℹ️ Информация о матче</h3>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">Дата создания:</span>
                                <span className="info-value">
                                    {formatDate(match.created_at)}
                                </span>
                            </div>
                            
                            {match.updated_at && match.status === 'completed' && (
                                <div className="info-item">
                                    <span className="info-label">Дата завершения:</span>
                                    <span className="info-value">
                                        {formatDate(match.updated_at)}
                                    </span>
                                </div>
                            )}
                            
                            <div className="info-item">
                                <span className="info-label">Тип сетки:</span>
                                <span className="info-value">
                                    {getBracketTypeDisplayName(match.bracket_type)}
                                </span>
                            </div>
                            
                            <div className="info-item">
                                <span className="info-label">Раунд:</span>
                                <span className="info-value">
                                    {match.round_name || `Раунд ${match.round}`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Кнопки действий */}
                <div className="match-actions">
                    <button 
                        className="back-btn"
                        onClick={() => navigate(`/tournaments/${tournamentId}?tab=results`)}
                    >
                        ← Вернуться к результатам
                    </button>
                    
                    <button 
                        className="tournament-btn"
                        onClick={() => navigate(`/tournaments/${tournamentId}`)}
                    >
                        🏆 К турниру
                    </button>
                </div>
            </div>
        </div>
    );
};

// Вспомогательные функции
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

function formatDate(dateString) {
    if (!dateString) return 'Не указано';
    
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default MatchDetailsPage;