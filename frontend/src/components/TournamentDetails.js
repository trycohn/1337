/**
 * TournamentDetails - Простая рабочая версия
 * 
 * @version 2.1.0 (Temporary Working Version)
 * @created 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Временная рабочая версия для тестирования сборки
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';
import './TournamentDetails.css';
import TeamGenerator from './TeamGenerator';
import BracketRenderer from './BracketRenderer';
import { ensureHttps } from '../utils/userHelpers';

// Компонент для случаев ошибок при рендеринге сетки
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Ошибка в BracketRenderer:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="bracket-error">
                    Произошла ошибка при отображении турнирной сетки. 
                    Пожалуйста, обновите страницу или попробуйте позже.
                </div>
            );
        }

        return this.props.children;
    }
}

function TournamentDetails() {
    const { id } = useParams();
    
    // Основные состояния
    const [tournament, setTournament] = useState(null);
    const [user, setUser] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('info');
    const [message, setMessage] = useState('');
    
    // Состояния участия
    const [isParticipating, setIsParticipating] = useState(false);
    const [isCreator, setIsCreator] = useState(false);
    const [isAdminOrCreator, setIsAdminOrCreator] = useState(false);
    
    // Состояния для модальных окон
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [matchScores, setMatchScores] = useState({ team1: 0, team2: 0 });
    
    // WebSocket
    const wsRef = useRef(null);
    const [wsConnected, setWsConnected] = useState(false);
    
    // Загрузка данных пользователя
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api
                .get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
                .then((userResponse) => {
                    setUser(userResponse.data);
                })
                .catch((error) => console.error('Ошибка загрузки пользователя:', error));
        }
    }, []);
    
    // Функция загрузки данных турнира
    const fetchTournamentData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null); // Сбрасываем предыдущие ошибки
            
            const response = await api.get(`/api/tournaments/${id}`);
            const tournamentData = response.data;
            
            setTournament(tournamentData);
            
            // Матчи уже включены в ответ турнира - используем их
            if (tournamentData.matches) {
                setMatches(Array.isArray(tournamentData.matches) ? tournamentData.matches : []);
            } else {
                setMatches([]);
            }
            
        } catch (error) {
            console.error('Ошибка загрузки турнира:', error);
            setError('Ошибка загрузки турнира');
        } finally {
            setLoading(false);
        }
    }, [id]); // Убираем user из зависимостей чтобы избежать бесконечных циклов
    
    // Загрузка турнира при изменении ID
    useEffect(() => {
        if (id) {
            fetchTournamentData();
        }
    }, [id, fetchTournamentData]);
    
    // Обработка изменений пользователя отдельно
    useEffect(() => {
        if (user && tournament) {
            // Проверяем участие пользователя
            if (tournament.participants) {
                const participating = tournament.participants.some(
                    p => p.user_id === user.id || p.id === user.id
                );
                setIsParticipating(participating);
            }
            
            // Проверяем права создателя
            if (tournament.creator_id === user.id) {
                setIsCreator(true);
                setIsAdminOrCreator(true);
            } else {
                setIsCreator(false);
                setIsAdminOrCreator(false);
            }
        }
    }, [user, tournament]);
    
    // WebSocket подключение
    useEffect(() => {
        if (!user || !tournament?.id) return;
        
        const token = localStorage.getItem('token');
        if (!token) return;
        
        console.log('Подключение к WebSocket для турнира', tournament.id);
        
        const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', {
            auth: { token },
            forceNew: true,
            transports: ['websocket', 'polling']
        });
        
        socket.on('connect', () => {
            console.log('WebSocket подключен');
            setWsConnected(true);
            socket.emit('join-tournament', tournament.id);
        });
        
        socket.on('disconnect', () => {
            console.log('WebSocket отключен');
            setWsConnected(false);
        });
        
        socket.on('tournament-update', (data) => {
            console.log('Получено обновление турнира:', data);
            setTournament(prev => ({ ...prev, ...data }));
            if (data.message) {
                setMessage(data.message);
                setTimeout(() => setMessage(''), 3000);
            }
        });
        
        wsRef.current = socket;
        
        return () => {
            if (wsRef.current) {
                wsRef.current.disconnect();
                wsRef.current = null;
            }
        };
    }, [user, tournament?.id]);
    
    // Функция участия в турнире
    const handleParticipate = async () => {
        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/participate`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('Вы успешно зарегистрировались в турнире!');
            setTimeout(() => setMessage(''), 3000);
            fetchTournamentData(); // Обновляем данные
            
        } catch (error) {
            console.error('Ошибка участия:', error);
            setMessage('Ошибка регистрации в турнире');
            setTimeout(() => setMessage(''), 3000);
        }
    };
    
    // Функция выхода из турнира
    const handleWithdraw = async () => {
        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/tournaments/${id}/participate`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('Вы покинули турнир');
            setTimeout(() => setMessage(''), 3000);
            fetchTournamentData(); // Обновляем данные
            
        } catch (error) {
            console.error('Ошибка выхода:', error);
            setMessage('Ошибка выхода из турнира');
            setTimeout(() => setMessage(''), 3000);
        }
    };
    
    // Функция генерации сетки
    const handleGenerateBracket = async () => {
        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/generate-bracket`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('Сетка турнира сгенерирована!');
            setTimeout(() => setMessage(''), 3000);
            fetchTournamentData(); // Обновляем данные
            
        } catch (error) {
            console.error('Ошибка генерации сетки:', error);
            setMessage('Ошибка генерации сетки турнира');
            setTimeout(() => setMessage(''), 3000);
        }
    };
    
    // Функция старта турнира
    const handleStartTournament = async () => {
        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('Турнир запущен!');
            setTimeout(() => setMessage(''), 3000);
            fetchTournamentData(); // Обновляем данные
            
        } catch (error) {
            console.error('Ошибка запуска турнира:', error);
            setMessage('Ошибка запуска турнира');
            setTimeout(() => setMessage(''), 3000);
        }
    };
    
    // Определение вкладок
    const tabs = [
        { id: 'info', label: 'Информация' },
        { id: 'participants', label: 'Участники' },
        { id: 'bracket', label: 'Сетка' },
        { id: 'results', label: 'Результаты' },
        { id: 'admin', label: 'Управление', adminOnly: true }
    ];
    
    const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdminOrCreator);
    
    // Функция клика по команде в сетке
    const handleTeamClick = (teamId, matchId) => {
        if (!isAdminOrCreator) return;
        
        setSelectedMatch(matchId);
        setShowConfirmModal(true);
    };
    
    // Функция обновления результата матча
    const handleUpdateMatch = async () => {
        try {
            const token = localStorage.getItem('token');
            await api.put(`/api/tournaments/${tournament.id}/matches/${selectedMatch}`, {
                score1: matchScores.team1,
                score2: matchScores.team2,
                winner_id: matchScores.team1 > matchScores.team2 ? 'team1' : 'team2'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('Результат матча обновлен!');
            setTimeout(() => setMessage(''), 3000);
            setShowConfirmModal(false);
            setSelectedMatch(null);
            fetchTournamentData(); // Обновляем данные
            
        } catch (error) {
            console.error('Ошибка обновления матча:', error);
            setMessage('Ошибка обновления результата матча');
            setTimeout(() => setMessage(''), 3000);
        }
    };
    
    // Показываем загрузку
    if (loading) {
        return (
            <div className="tournament-loading">
                <h2>Загрузка турнира...</h2>
                <p>Пожалуйста, подождите</p>
            </div>
        );
    }
    
    // Показываем ошибку
    if (error) {
        return (
            <div className="tournament-error">
                <h2>Ошибка: {error}</h2>
                <button onClick={() => fetchTournamentData()}>
                    Попробовать снова
                </button>
            </div>
        );
    }
    
    // Показываем, если турнир не найден
    if (!tournament) {
        return (
            <div className="tournament-not-found">
                <h2>Турнир не найден</h2>
                <Link to="/tournaments">Вернуться к списку турниров</Link>
            </div>
        );
    }
    
    return (
        <section className="tournament-details-tournamentdetails">
            {/* Заголовок турнира */}
            <div className="tournament-header">
                <div className="tournament-title-section">
                    <h1>{tournament.name}</h1>
                    <div className="tournament-status">
                        <span className={`status-badge ${tournament.status?.toLowerCase()}`}>
                            {tournament.status || 'Не определен'}
                        </span>
                        {wsConnected && (
                            <span className="websocket-indicator connected" title="Подключен к обновлениям в реальном времени">
                                🟢 Online
                            </span>
                        )}
                    </div>
                </div>
                
                {/* Навигация по вкладкам */}
                <nav className="tournament-nav">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            
            <div className="tournament-content">
                {/* Вкладка "Информация" */}
                {activeTab === 'info' && (
                    <div className="tournament-info">
                        <div className="info-grid">
                            <div className="info-section">
                                <h3>Основная информация</h3>
                                <div className="info-item">
                                    <strong>Игра:</strong> {tournament.game || 'Не указана'}
                                </div>
                                <div className="info-item">
                                    <strong>Формат:</strong> {tournament.format || 'Не указан'}
                                </div>
                                <div className="info-item">
                                    <strong>Макс. участников:</strong> {tournament.max_participants || 'Не ограничено'}
                                </div>
                                <div className="info-item">
                                    <strong>Текущих участников:</strong> {tournament.participants?.length || 0}
                                </div>
                                {tournament.description && (
                                    <div className="info-item">
                                        <strong>Описание:</strong>
                                        <p>{tournament.description}</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="info-section">
                                <h3>Даты и время</h3>
                                <div className="info-item">
                                    <strong>Создан:</strong> {new Date(tournament.created_at).toLocaleString('ru-RU')}
                                </div>
                                {tournament.start_date && (
                                    <div className="info-item">
                                        <strong>Начало:</strong> {new Date(tournament.start_date).toLocaleString('ru-RU')}
                                    </div>
                                )}
                                {tournament.registration_deadline && (
                                    <div className="info-item">
                                        <strong>Регистрация до:</strong> {new Date(tournament.registration_deadline).toLocaleString('ru-RU')}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Кнопки участия */}
                        {user && tournament.status === 'registration' && (
                            <div className="participation-controls">
                                {!isParticipating ? (
                                    <button 
                                        className="participate-btn"
                                        onClick={handleParticipate}
                                    >
                                        Участвовать в турнире
                                    </button>
                                ) : (
                                    <button 
                                        className="withdraw-btn"
                                        onClick={handleWithdraw}
                                    >
                                        Покинуть турнир
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Вкладка "Участники" */}
                {activeTab === 'participants' && (
                    <div className="tournament-participants">
                        <h3>Участники турнира ({tournament.participants?.length || 0})</h3>
                        
                        {tournament.participants && tournament.participants.length > 0 ? (
                            <div className="participants-grid">
                                {tournament.participants.map((participant, index) => (
                                    <div key={participant.id || index} className="participant-card">
                                        <div className="participant-avatar">
                                            {participant.avatar_url ? (
                                                <img 
                                                    src={ensureHttps(participant.avatar_url)} 
                                                    alt={participant.name || 'Участник'}
                                                    onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {(participant.name || 'У').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="participant-info">
                                            <div className="participant-name">
                                                {participant.name || 'Участник'}
                                            </div>
                                            {participant.faceit_elo && (
                                                <div className="participant-elo">
                                                    FACEIT: {participant.faceit_elo}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-participants">Пока нет участников</p>
                        )}
                        
                        {/* Генератор команд для mix турниров */}
                        {tournament.format === 'mix' && isAdminOrCreator && (
                            <div className="team-generator-section">
                                <h3>Генерация команд</h3>
                                <TeamGenerator 
                                    tournament={tournament}
                                    participants={tournament.participants || []}
                                    onTeamsGenerated={(teams) => {
                                        console.log('Команды сгенерированы:', teams);
                                        fetchTournamentData();
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
                
                {/* Вкладка "Сетка" */}
                {activeTab === 'bracket' && (
                    <div className="tournament-bracket">
                        <h3>Турнирная сетка</h3>
                        
                        {matches && matches.length > 0 ? (
                            <ErrorBoundary>
                                <BracketRenderer 
                                    tournament={tournament}
                                    matches={matches}
                                    onTeamClick={handleTeamClick}
                                    canEdit={isAdminOrCreator}
                                />
                            </ErrorBoundary>
                        ) : (
                            <div className="no-bracket">
                                <p>Сетка турнира еще не создана</p>
                                {isAdminOrCreator && tournament.status === 'registration' && (
                                    <button 
                                        className="generate-bracket-btn"
                                        onClick={handleGenerateBracket}
                                    >
                                        Создать сетку
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Вкладка "Результаты" */}
                {activeTab === 'results' && (
                    <div className="tournament-results">
                        <h3>Результаты матчей</h3>
                        
                        {matches && matches.length > 0 ? (
                            <div className="matches-list">
                                {matches.map(match => (
                                    <div key={match.id} className="match-card">
                                        <div className="match-teams">
                                            <div className={`team ${match.winner_id === match.team1_id ? 'winner' : ''}`}>
                                                <span className="team-name">{match.team1_name || 'Команда 1'}</span>
                                                <span className="team-score">{match.team1_score || 0}</span>
                                            </div>
                                            <div className="vs">VS</div>
                                            <div className={`team ${match.winner_id === match.team2_id ? 'winner' : ''}`}>
                                                <span className="team-name">{match.team2_name || 'Команда 2'}</span>
                                                <span className="team-score">{match.team2_score || 0}</span>
                                            </div>
                                        </div>
                                        <div className="match-info">
                                            <span className="match-round">Раунд {match.round || 1}</span>
                                            <span className={`match-status ${match.status?.toLowerCase()}`}>
                                                {match.status || 'Не проведен'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-results">Результатов пока нет</p>
                        )}
                    </div>
                )}
                
                {/* Вкладка "Управление" */}
                {activeTab === 'admin' && isAdminOrCreator && (
                    <div className="tournament-admin">
                        <h3>Управление турниром</h3>
                        
                        <div className="admin-controls">
                            {tournament.status === 'registration' && (
                                <>
                                    <button 
                                        className="admin-btn"
                                        onClick={handleGenerateBracket}
                                    >
                                        Создать сетку
                                    </button>
                                    
                                    <button 
                                        className="admin-btn start-btn"
                                        onClick={handleStartTournament}
                                    >
                                        Запустить турнир
                                    </button>
                                </>
                            )}
                            
                            <button 
                                className="admin-btn refresh-btn"
                                onClick={fetchTournamentData}
                            >
                                Обновить данные
                            </button>
                        </div>
                        
                        <div className="admin-info">
                            <h4>Статистика</h4>
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span className="stat-label">Участников:</span>
                                    <span className="stat-value">{tournament.participants?.length || 0}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Матчей:</span>
                                    <span className="stat-value">{matches?.length || 0}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Завершенных матчей:</span>
                                    <span className="stat-value">
                                        {matches?.filter(m => m.status === 'completed')?.length || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Сообщения */}
                {message && (
                    <div className={`message ${message.includes('успешно') ? 'success' : 'error'}`}>
                        {message}
                    </div>
                )}
            </div>
            
            {/* Модальное окно обновления результата матча */}
            {showConfirmModal && selectedMatch && (
                <div className="modal" onClick={() => setShowConfirmModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Обновить результат матча</h3>
                        
                        <div className="score-inputs">
                            <div className="score-container">
                                <span>Команда 1:</span>
                                <input
                                    type="number"
                                    value={matchScores.team1}
                                    onChange={(e) => setMatchScores({ ...matchScores, team1: Number(e.target.value) })}
                                    min="0"
                                />
                            </div>
                            <div className="score-container">
                                <span>Команда 2:</span>
                                <input
                                    type="number"
                                    value={matchScores.team2}
                                    onChange={(e) => setMatchScores({ ...matchScores, team2: Number(e.target.value) })}
                                    min="0"
                                />
                            </div>
                        </div>
                        
                        <div className="modal-actions">
                            <button 
                                className="cancel-btn" 
                                onClick={() => setShowConfirmModal(false)}
                            >
                                Отмена
                            </button>
                            <button 
                                className="confirm-btn"
                                onClick={handleUpdateMatch}
                            >
                                Сохранить результат
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default TournamentDetails;