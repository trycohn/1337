import React, { useState, useEffect } from 'react';
import api from '../axios';
import { useNavigate } from 'react-router-dom';
import './TournamentHistory.css';

/**
 * TournamentHistory - История участия пользователя в турнирах
 * Отображает список турниров, в которых пользователь выступал в составе команд
 */
function TournamentHistory({ userId }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchTournamentHistory();
    }, [userId]);

    const fetchTournamentHistory = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/users/${userId}/tournament-history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Группируем турниры по командам
            const groupedHistory = groupByTeam(response.data || []);
            setHistory(groupedHistory);
        } catch (err) {
            console.error('Ошибка загрузки истории турниров:', err);
            setError('Не удалось загрузить историю турниров');
        } finally {
            setLoading(false);
        }
    };

    const groupByTeam = (tournaments) => {
        const grouped = {};
        
        tournaments.forEach(tournament => {
            const teamId = tournament.team_id;
            const teamName = tournament.team_name;
            
            if (!grouped[teamId]) {
                grouped[teamId] = {
                    teamId,
                    teamName,
                    teamAvatar: tournament.team_avatar,
                    tournaments: []
                };
            }
            
            grouped[teamId].tournaments.push({
                id: tournament.tournament_id,
                name: tournament.tournament_name,
                date: tournament.tournament_date,
                result: tournament.result,
                placement: tournament.placement,
                game: tournament.game
            });
        });

        // Сортируем турниры внутри каждой команды по дате
        Object.values(grouped).forEach(team => {
            team.tournaments.sort((a, b) => new Date(b.date) - new Date(a.date));
        });

        return Object.values(grouped);
    };

    const getResultBadge = (result, placement) => {
        if (result === 'Победитель' || placement === 1) {
            return <span className="result-badge winner">🥇 1 место</span>;
        }
        if (placement === 2) {
            return <span className="result-badge second">🥈 2 место</span>;
        }
        if (placement === 3) {
            return <span className="result-badge third">🥉 3 место</span>;
        }
        if (result) {
            return <span className="result-badge participant">{result}</span>;
        }
        return <span className="result-badge participant">Участник</span>;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    };

    const handleTournamentClick = (tournamentId) => {
        navigate(`/tournaments/${tournamentId}`);
    };

    if (loading) {
        return <div className="tournament-history-loading">Загрузка истории турниров...</div>;
    }

    if (error) {
        return <div className="tournament-history-error">{error}</div>;
    }

    if (history.length === 0) {
        return (
            <div className="tournament-history-empty">
                <div className="empty-icon">🏆</div>
                <p>Вы еще не участвовали в турнирах в составе команд</p>
                <p className="empty-hint">Создайте команду и зарегистрируйтесь на турнир</p>
            </div>
        );
    }

    return (
        <div className="tournament-history">
            {history.map(team => (
                <div key={team.teamId} className="team-history-block">
                    <div className="team-history-header">
                        {team.teamAvatar ? (
                            <img 
                                src={team.teamAvatar} 
                                alt={team.teamName}
                                className="team-history-avatar"
                            />
                        ) : (
                            <div className="team-history-avatar-placeholder">
                                {team.teamName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="team-history-info">
                            <h3 className="team-history-name">{team.teamName}</h3>
                            <span className="team-history-count">
                                {team.tournaments.length} {team.tournaments.length === 1 ? 'турнир' : 'турниров'}
                            </span>
                        </div>
                    </div>

                    <div className="tournaments-list">
                        {team.tournaments.map(tournament => (
                            <div 
                                key={tournament.id} 
                                className="tournament-history-item"
                                onClick={() => handleTournamentClick(tournament.id)}
                            >
                                <div className="tournament-history-main">
                                    <div className="tournament-history-icon">🎮</div>
                                    <div className="tournament-history-details">
                                        <div className="tournament-history-name">{tournament.name}</div>
                                        <div className="tournament-history-meta">
                                            <span className="tournament-history-game">{tournament.game}</span>
                                            <span className="tournament-history-separator">•</span>
                                            <span className="tournament-history-date">{formatDate(tournament.date)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="tournament-history-result">
                                    {getResultBadge(tournament.result, tournament.placement)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default TournamentHistory;

