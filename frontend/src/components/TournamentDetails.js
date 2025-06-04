/**
 * TournamentDetails v4.0.0 - Graceful Degradation Architecture
 * 
 * @version 4.0.0 (Graceful Degradation & Error Resilient)
 * @created 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Устойчивая к сбоям архитектура с graceful degradation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';
import './TournamentDetails.css';
import TeamGenerator from './TeamGenerator';
import BracketRenderer from './BracketRenderer';
import { ensureHttps } from '../utils/userHelpers';

// Error Boundary для критических ошибок
class TournamentErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('🚨 TournamentDetails Critical Error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="tournament-critical-error">
                    <h2>Произошла критическая ошибка</h2>
                    <p>Пожалуйста, обновите страницу или попробуйте позже.</p>
                    <button onClick={() => window.location.reload()}>
                        Обновить страницу
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function TournamentDetails() {
    const { id } = useParams();
    
    // 🎯 ОСНОВНЫЕ СОСТОЯНИЯ (Simplified State Management)
    const [tournament, setTournament] = useState(null);
    const [user, setUser] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('info');
    
    // 🎯 UI СОСТОЯНИЯ
    const [message, setMessage] = useState('');
    const [wsConnected, setWsConnected] = useState(false);
    const [dataLoadingStates, setDataLoadingStates] = useState({
        tournament: false,
        matches: false,
        user: false
    });
    
    // 🎯 ПРАВА ПОЛЬЗОВАТЕЛЯ (Computed from data)
    const userPermissions = useMemo(() => {
        if (!user || !tournament) {
            return {
                isParticipating: false,
                isCreator: false,
                isAdminOrCreator: false,
                canEdit: false
            };
        }

        const isCreator = tournament.creator_id === user.id;
        const isParticipating = tournament.participants?.some(
            p => p.user_id === user.id || p.id === user.id
        ) || false;

        return {
            isParticipating,
            isCreator,
            isAdminOrCreator: isCreator,
            canEdit: isCreator
        };
    }, [user, tournament]);

    // 🎯 GRACEFUL ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ (Independent)
    const loadUser = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            setDataLoadingStates(prev => ({ ...prev, user: true }));
            const response = await api.get('/api/users/me');
            setUser(response.data);
        } catch (error) {
            console.warn('⚠️ Пользователь не загружен:', error.message);
            // Graceful: продолжаем работу без пользователя
        } finally {
            setDataLoadingStates(prev => ({ ...prev, user: false }));
        }
    }, []); // Нет зависимостей - выполняется один раз

    // 🎯 GRACEFUL ЗАГРУЗКА ТУРНИРА (Primary Data)
    const loadTournamentData = useCallback(async () => {
        if (!id) return;

        try {
            setLoading(true);
            setError(null);
            setDataLoadingStates(prev => ({ ...prev, tournament: true }));

            // Основной запрос турнира
            const tournamentResponse = await api.get(`/api/tournaments/${id}`);
            const tournamentData = tournamentResponse.data;
            
            setTournament(tournamentData);

            // GRACEFUL: Попытка загрузить матчи из разных источников
            let matchesData = [];
            
            // Источник 1: Матчи включены в ответ турнира (предпочтительно)
            if (tournamentData.matches && Array.isArray(tournamentData.matches)) {
                matchesData = tournamentData.matches;
                console.log('✅ Матчи загружены из основного ответа турнира');
            } 
            // Источник 2: Попытка загрузить матчи отдельно (graceful degradation)
            else {
                try {
                    console.log('🔄 Попытка загрузить матчи отдельным запросом...');
                    setDataLoadingStates(prev => ({ ...prev, matches: true }));
                    
                    const matchesResponse = await api.get(`/api/tournaments/${id}/matches`);
                    matchesData = matchesResponse.data || [];
                    console.log('✅ Матчи загружены отдельным запросом');
                } catch (matchesError) {
                    console.warn('⚠️ Матчи не удалось загрузить отдельно:', matchesError.message);
                    // Graceful: показываем турнир без матчей
                    matchesData = [];
                }
            }

            setMatches(matchesData);
            console.log(`🎯 Турнир загружен. Матчей: ${matchesData.length}`);

        } catch (tournamentError) {
            console.error('❌ Ошибка загрузки турнира:', tournamentError);
            setError(`Ошибка загрузки турнира: ${tournamentError.message}`);
        } finally {
            setLoading(false);
            setDataLoadingStates(prev => ({ 
                ...prev, 
                tournament: false, 
                matches: false 
            }));
        }
    }, [id]); // Только ID в зависимостях

    // 🎯 WEBSOCKET ПОДКЛЮЧЕНИЕ (Optional Enhancement)
    const setupWebSocket = useCallback(() => {
        if (!user?.id || !tournament?.id) return null;

        const token = localStorage.getItem('token');
        if (!token) return null;

        try {
            console.log('🔌 Подключение к WebSocket для турнира', tournament.id);
            
            const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', {
                auth: { token },
                transports: ['websocket', 'polling'],
                timeout: 10000
            });

            socket.on('connect', () => {
                console.log('✅ WebSocket подключен');
                setWsConnected(true);
                socket.emit('join-tournament', tournament.id);
            });

            socket.on('disconnect', () => {
                console.log('🔌 WebSocket отключен');
                setWsConnected(false);
            });

            socket.on('tournament-update', (data) => {
                console.log('📡 Обновление турнира через WebSocket:', data);
                setTournament(prev => ({ ...prev, ...data }));
                
                if (data.message) {
                    setMessage(data.message);
                    setTimeout(() => setMessage(''), 3000);
                }
            });

            socket.on('connect_error', (error) => {
                console.warn('⚠️ WebSocket ошибка:', error.message);
                setWsConnected(false);
            });

            return socket;
        } catch (error) {
            console.warn('⚠️ WebSocket не удалось создать:', error.message);
            return null;
        }
    }, [user?.id, tournament?.id]); // Только необходимые поля

    // 🎯 УПРАВЛЯЕМЫЕ ЭФФЕКТЫ (Controlled Side Effects)
    
    // Эффект 1: Загрузка пользователя (один раз)
    useEffect(() => {
        loadUser();
    }, []); // Выполняется один раз при монтировании

    // Эффект 2: Загрузка турнира (при изменении ID)
    useEffect(() => {
        if (id) {
            loadTournamentData();
        }
    }, [id, loadTournamentData]); // Только ID и функция загрузки

    // Эффект 3: WebSocket (опциональный, после загрузки данных)
    useEffect(() => {
        const socket = setupWebSocket();
        
        return () => {
            if (socket) {
                console.log('🔌 Отключение WebSocket');
                socket.disconnect();
            }
        };
    }, [setupWebSocket]);

    // 🎯 ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ (User Actions)
    
    const handleParticipate = useCallback(async () => {
        if (!user || !tournament) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/participate`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Вы успешно зарегистрировались в турнире!');
            setTimeout(() => setMessage(''), 3000);
            
            // Обновляем турнир
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка участия:', error);
            setMessage(`❌ Ошибка регистрации: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [user, tournament, id, loadTournamentData]);

    const handleWithdraw = useCallback(async () => {
        if (!user || !tournament) return;

        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/tournaments/${id}/participate`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Вы покинули турнир');
            setTimeout(() => setMessage(''), 3000);
            
            // Обновляем турнир
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            setMessage(`❌ Ошибка выхода: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [user, tournament, id, loadTournamentData]);

    const handleGenerateBracket = useCallback(async () => {
        if (!userPermissions.canEdit) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/generate-bracket`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Сетка турнира сгенерирована!');
            setTimeout(() => setMessage(''), 3000);
            
            // Обновляем турнир
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка генерации сетки:', error);
            setMessage(`❌ Ошибка генерации: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    const handleStartTournament = useCallback(async () => {
        if (!userPermissions.canEdit) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Турнир запущен!');
            setTimeout(() => setMessage(''), 3000);
            
            // Обновляем турнир
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка запуска турнира:', error);
            setMessage(`❌ Ошибка запуска: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    // 🎯 НАВИГАЦИЯ ПО ВКЛАДКАМ
    const tabs = useMemo(() => [
        { id: 'info', label: 'Информация', icon: 'ℹ️' },
        { id: 'participants', label: 'Участники', icon: '👥' },
        { id: 'bracket', label: 'Сетка', icon: '🏆' },
        { id: 'results', label: 'Результаты', icon: '📊' },
        { id: 'admin', label: 'Управление', icon: '⚙️', adminOnly: true }
    ], []);

    const visibleTabs = useMemo(() => 
        tabs.filter(tab => !tab.adminOnly || userPermissions.isAdminOrCreator),
        [tabs, userPermissions.isAdminOrCreator]
    );

    // 🎯 СОСТОЯНИЯ ЗАГРУЗКИ
    if (loading) {
        return (
            <div className="tournament-loading">
                <div className="loading-spinner"></div>
                <h2>Загружаем турнир...</h2>
                <div className="loading-details">
                    {dataLoadingStates.tournament && <p>📄 Загрузка данных турнира...</p>}
                    {dataLoadingStates.matches && <p>🏆 Загрузка матчей...</p>}
                    {dataLoadingStates.user && <p>👤 Загрузка профиля...</p>}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="tournament-error">
                <h2>❌ Ошибка</h2>
                <p>{error}</p>
                <div className="error-actions">
                    <button onClick={() => {
                        setError(null);
                        loadTournamentData();
                    }}>
                        🔄 Попробовать снова
                    </button>
                    <Link to="/tournaments">
                        ← Вернуться к турнирам
                    </Link>
                </div>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="tournament-not-found">
                <h2>🔍 Турнир не найден</h2>
                <p>Турнир с ID {id} не существует или был удален.</p>
                <Link to="/tournaments">← Вернуться к списку турниров</Link>
            </div>
        );
    }

    return (
        <TournamentErrorBoundary>
            <section className="tournament-details-v4">
                {/* 🎯 ЗАГОЛОВОК ТУРНИРА */}
                <div className="tournament-header">
                    <div className="tournament-title-section">
                        <h1>{tournament.name}</h1>
                        <div className="tournament-meta">
                            <span className={`status-badge ${tournament.status?.toLowerCase()}`}>
                                {tournament.status || 'Активный'}
                            </span>
                            {wsConnected && (
                                <span className="websocket-indicator connected" title="Обновления в реальном времени">
                                    🟢 Online
                                </span>
                            )}
                            <span className="participants-count">
                                👥 {tournament.participants?.length || 0}
                                {tournament.max_participants && ` / ${tournament.max_participants}`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 🎯 НАВИГАЦИЯ ПО ВКЛАДКАМ */}
                <nav className="tournament-navigation">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="tab-icon">{tab.icon}</span>
                            <span className="tab-label">{tab.label}</span>
                        </button>
                    ))}
                </nav>

                {/* 🎯 СОДЕРЖИМОЕ ВКЛАДОК */}
                <div className="tournament-content">
                    {/* ВКЛАДКА: ИНФОРМАЦИЯ */}
                    {activeTab === 'info' && (
                        <div className="tab-content">
                            <div className="tournament-info-grid">
                                <div className="info-section">
                                    <h3>📋 Основная информация</h3>
                                    <div className="info-list">
                                        <div className="info-item">
                                            <strong>🎮 Игра:</strong> {tournament.game || 'Не указана'}
                                        </div>
                                        <div className="info-item">
                                            <strong>🏆 Формат:</strong> {tournament.format || 'Не указан'}
                                        </div>
                                        <div className="info-item">
                                            <strong>👥 Участников:</strong> {tournament.participants?.length || 0}
                                            {tournament.max_participants && ` из ${tournament.max_participants}`}
                                        </div>
                                        <div className="info-item">
                                            <strong>📅 Создан:</strong> {new Date(tournament.created_at).toLocaleString('ru-RU')}
                                        </div>
                                        {tournament.start_date && (
                                            <div className="info-item">
                                                <strong>🕐 Начало:</strong> {new Date(tournament.start_date).toLocaleString('ru-RU')}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {tournament.description && (
                                    <div className="info-section">
                                        <h3>📝 Описание</h3>
                                        <p className="tournament-description">{tournament.description}</p>
                                    </div>
                                )}
                            </div>

                            {/* КНОПКИ УЧАСТИЯ */}
                            {user && tournament.status === 'registration' && (
                                <div className="participation-section">
                                    {!userPermissions.isParticipating ? (
                                        <button 
                                            className="btn btn-primary participate-btn"
                                            onClick={handleParticipate}
                                        >
                                            🎯 Участвовать в турнире
                                        </button>
                                    ) : (
                                        <button 
                                            className="btn btn-secondary withdraw-btn"
                                            onClick={handleWithdraw}
                                        >
                                            ❌ Покинуть турнир
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: УЧАСТНИКИ */}
                    {activeTab === 'participants' && (
                        <div className="tab-content">
                            <h3>👥 Участники турнира ({tournament.participants?.length || 0})</h3>
                            
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
                                <div className="empty-state">
                                    <p>👤 Пока нет участников</p>
                                    {user && tournament.status === 'registration' && !userPermissions.isParticipating && (
                                        <button 
                                            className="btn btn-primary"
                                            onClick={handleParticipate}
                                        >
                                            Стать первым участником
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* MIX ТУРНИРЫ: ГЕНЕРАЦИЯ КОМАНД */}
                            {tournament.format === 'mix' && userPermissions.isAdminOrCreator && (
                                <div className="team-generator-section">
                                    <h3>⚡ Генерация команд</h3>
                                    <TeamGenerator 
                                        tournament={tournament}
                                        participants={tournament.participants || []}
                                        onTeamsGenerated={() => {
                                            console.log('✅ Команды сгенерированы');
                                            loadTournamentData();
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: СЕТКА */}
                    {activeTab === 'bracket' && (
                        <div className="tab-content">
                            <h3>🏆 Турнирная сетка</h3>
                            
                            {matches && matches.length > 0 ? (
                                <div className="bracket-section">
                                    <BracketRenderer 
                                        tournament={tournament}
                                        matches={matches}
                                        canEdit={userPermissions.canEdit}
                                        onMatchUpdate={() => loadTournamentData()}
                                    />
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>🏆 Сетка турнира еще не создана</p>
                                    {userPermissions.isAdminOrCreator && (
                                        <button 
                                            className="btn btn-primary"
                                            onClick={handleGenerateBracket}
                                        >
                                            ⚡ Создать сетку
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: РЕЗУЛЬТАТЫ */}
                    {activeTab === 'results' && (
                        <div className="tab-content">
                            <h3>📊 Результаты матчей</h3>
                            
                            {matches && matches.length > 0 ? (
                                <div className="results-list">
                                    {matches.map(match => (
                                        <div key={match.id} className="match-result-card">
                                            <div className="match-info">
                                                <span className="match-round">Раунд {match.round || 1}</span>
                                                <span className={`match-status ${match.status?.toLowerCase()}`}>
                                                    {match.status || 'Ожидает'}
                                                </span>
                                            </div>
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
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>📊 Результатов пока нет</p>
                                    <p>Результаты появятся после начала турнира</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: УПРАВЛЕНИЕ */}
                    {activeTab === 'admin' && userPermissions.isAdminOrCreator && (
                        <div className="tab-content">
                            <h3>⚙️ Управление турниром</h3>
                            
                            <div className="admin-controls">
                                <div className="admin-section">
                                    <h4>🎯 Основные действия</h4>
                                    <div className="admin-buttons">
                                        {tournament.status === 'registration' && (
                                            <>
                                                <button 
                                                    className="btn btn-primary"
                                                    onClick={handleGenerateBracket}
                                                >
                                                    ⚡ Создать сетку
                                                </button>
                                                
                                                <button 
                                                    className="btn btn-success"
                                                    onClick={handleStartTournament}
                                                >
                                                    🚀 Запустить турнир
                                                </button>
                                            </>
                                        )}
                                        
                                        <button 
                                            className="btn btn-secondary"
                                            onClick={loadTournamentData}
                                        >
                                            🔄 Обновить данные
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-section">
                                    <h4>📊 Статистика</h4>
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
                                            <span className="stat-label">Завершенных:</span>
                                            <span className="stat-value">
                                                {matches?.filter(m => m.status === 'completed')?.length || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 🎯 СООБЩЕНИЯ */}
                {message && (
                    <div className={`message-notification ${message.includes('✅') ? 'success' : 'error'}`}>
                        {message}
                    </div>
                )}
            </section>
        </TournamentErrorBoundary>
    );
}

export default TournamentDetails;