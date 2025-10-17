// 🎮 MyActiveMatches - Страница активных матчей пользователя
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axios';
import './MyActiveMatches.css';

function MyActiveMatches() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tournamentMatches, setTournamentMatches] = useState([]);
    const [customMatches, setCustomMatches] = useState([]);

    useEffect(() => {
        loadMatches();
        
        // Обновление каждые 10 секунд
        const interval = setInterval(loadMatches, 10000);
        return () => clearInterval(interval);
    }, []);

    const loadMatches = async () => {
        try {
            const token = localStorage.getItem('token');
            const { data } = await api.get('/api/matches/my-active', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (data.success) {
                setTournamentMatches(data.tournamentMatches || []);
                setCustomMatches(data.customMatches || []);
            }
        } catch (error) {
            console.error('Ошибка загрузки матчей:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusText = (status, lobbyStatus) => {
        if (lobbyStatus) {
            const lobbyStatusMap = {
                'waiting': '⏳ Ожидание игроков',
                'ready': '✅ Готовы к выбору карт',
                'picking': '🗺️ Выбор карт',
                'ready_to_create': '🎮 Готово к игре',
                'match_created': '🚀 Матч создан'
            };
            return lobbyStatusMap[lobbyStatus] || lobbyStatus;
        }
        
        const statusMap = {
            'pending': '⏳ Ожидание',
            'ready': '✅ Готов к началу',
            'in_progress': '🎮 В процессе',
            'waiting': '⏳ Подготовка'
        };
        return statusMap[status] || status;
    };

    if (loading) {
        return (
            <div className="my-matches-container">
                <div className="matches-loading">
                    <span className="loading-icon">⏳</span>
                    <span>Загрузка матчей...</span>
                </div>
            </div>
        );
    }

    const totalMatches = tournamentMatches.length + customMatches.length;

    return (
        <div className="my-matches-container">
            <div className="matches-header">
                <h1>🎮 Мои активные матчи</h1>
                <p className="matches-count">
                    Всего активных: {totalMatches}
                </p>
            </div>

            {totalMatches === 0 && (
                <div className="no-matches">
                    <span className="empty-icon">📭</span>
                    <h2>Нет активных матчей</h2>
                    <p>У вас пока нет запланированных или текущих матчей</p>
                    <button 
                        className="btn-tournaments"
                        onClick={() => navigate('/tournaments')}
                    >
                        Перейти к турнирам
                    </button>
                </div>
            )}

            {/* Турнирные матчи */}
            {tournamentMatches.length > 0 && (
                <section className="matches-section">
                    <h2>🏆 Турнирные матчи ({tournamentMatches.length})</h2>
                    <div className="matches-grid">
                        {tournamentMatches.map(match => (
                            <div 
                                key={match.id} 
                                className="match-card"
                                onClick={() => navigate(`/tournaments/${match.tournament_id}/match/${match.id}`)}
                            >
                                <div className="match-card-header">
                                    <span className="tournament-badge">
                                        {match.tournament_name}
                                    </span>
                                    <span className="round-badge">
                                        {match.round}
                                    </span>
                                </div>
                                
                                <div className="match-teams">
                                    <div className="team">{match.team1_name}</div>
                                    <div className="vs">VS</div>
                                    <div className="team">{match.team2_name}</div>
                                </div>
                                
                                <div className="match-status">
                                    {getStatusText(match.status, match.lobby_status)}
                                </div>
                                
                                {match.lobby_id && (
                                    <button 
                                        className="btn-join-lobby"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/match-lobby/${match.lobby_id}`);
                                        }}
                                    >
                                        Войти в лобби
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Кастомные матчи */}
            {customMatches.length > 0 && (
                <section className="matches-section">
                    <h2>⚡ Кастомные матчи ({customMatches.length})</h2>
                    <div className="matches-grid">
                        {customMatches.map(match => (
                            <div 
                                key={match.lobby_id} 
                                className="match-card custom"
                                onClick={() => navigate('/lobby/custom')}
                            >
                                <div className="match-card-header">
                                    <span className="custom-badge">
                                        CUSTOM
                                    </span>
                                    <span className="format-badge">
                                        {match.match_format?.toUpperCase()}
                                    </span>
                                </div>
                                
                                <div className="match-teams">
                                    <div className="team">{match.team1_name}</div>
                                    <div className="vs">VS</div>
                                    <div className="team">{match.team2_name}</div>
                                </div>
                                
                                <div className="match-status">
                                    {getStatusText(match.lobby_status, null)}
                                </div>
                                
                                <button 
                                    className="btn-join-lobby"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/lobby/custom');
                                    }}
                                >
                                    Войти в лобби
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

export default MyActiveMatches;

