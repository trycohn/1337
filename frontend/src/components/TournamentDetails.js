/**
 * TournamentDetails v4.1.0 - Full Feature Restoration
 * 
 * @version 4.1.0 (Полный функционал)
 * @created 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Восстановление всех функций турнирной системы
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
    
    // 🎯 ОСНОВНЫЕ СОСТОЯНИЯ
    const [tournament, setTournament] = useState(null);
    const [user, setUser] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('info');
    
    // 🎯 UI СОСТОЯНИЯ
    const [message, setMessage] = useState('');
    const [wsConnected, setWsConnected] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [mixedTeams, setMixedTeams] = useState([]);
    const [ratingType, setRatingType] = useState('faceit');
    const [dataLoadingStates, setDataLoadingStates] = useState({
        tournament: false,
        matches: false,
        user: false
    });
    
    // 🎯 ПРАВА ПОЛЬЗОВАТЕЛЯ
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

    // 🎯 ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ
    const loadUser = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            setDataLoadingStates(prev => ({ ...prev, user: true }));
            const response = await api.get('/api/users/me');
            setUser(response.data);
        } catch (error) {
            console.warn('⚠️ Пользователь не загружен:', error.message);
        } finally {
            setDataLoadingStates(prev => ({ ...prev, user: false }));
        }
    }, []);

    // 🎯 ЗАГРУЗКА ТУРНИРА И ДАННЫХ
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

            // Загружаем матчи
            let matchesData = [];
            
            if (tournamentData.matches && Array.isArray(tournamentData.matches)) {
                matchesData = tournamentData.matches;
                console.log('✅ Матчи загружены из основного ответа турнира');
            } else {
                try {
                    setDataLoadingStates(prev => ({ ...prev, matches: true }));
                    const matchesResponse = await api.get(`/api/tournaments/${id}/matches`);
                    matchesData = matchesResponse.data || [];
                    console.log('✅ Матчи загружены отдельным запросом');
                } catch (matchesError) {
                    console.warn('⚠️ Матчи не удалось загрузить:', matchesError.message);
                    matchesData = [];
                }
            }

            setMatches(matchesData);
            
            // Загружаем микс команды для mix турниров
            if (tournamentData.format === 'mix' && tournamentData.mixed_teams) {
                setMixedTeams(tournamentData.mixed_teams);
            }

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
    }, [id]);

    // 🎯 WEBSOCKET ПОДКЛЮЧЕНИЕ
    const setupWebSocket = useCallback(() => {
        if (!user?.id || !tournament?.id) return null;

        const token = localStorage.getItem('token');
        if (!token) return null;

        try {
            console.log('🔌 Подключение к WebSocket для турнира', tournament.id);
            
            const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', {
                query: { token },
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true
            });

            socket.on('connect', () => {
                console.log('✅ WebSocket подключен к турниру', tournament.id);
                setWsConnected(true);
                
                socket.emit('join-tournament', tournament.id);
                
                socket.emit('join_tournament_chat', tournament.id);
                
                console.log(`📡 Присоединился к турниру ${tournament.id} и чату`);
            });

            socket.on('disconnect', (reason) => {
                console.log('🔌 WebSocket отключен:', reason);
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

            socket.on('tournament_message', (data) => {
                console.log('💬 Сообщение чата турнира:', data);
            });

            socket.on('connect_error', (error) => {
                console.warn('⚠️ WebSocket ошибка подключения:', error.message);
                setWsConnected(false);
            });

            socket.on('error', (error) => {
                console.warn('⚠️ WebSocket ошибка:', error.message);
                setWsConnected(false);
            });

            return socket;
        } catch (error) {
            console.warn('⚠️ WebSocket не удалось создать:', error.message);
            return null;
        }
    }, [user?.id, tournament?.id]);

    // 🎯 ЭФФЕКТЫ
    useEffect(() => {
        loadUser();
    }, []);

    useEffect(() => {
        if (id) {
            loadTournamentData();
        }
    }, [id, loadTournamentData]);

    useEffect(() => {
        const socket = setupWebSocket();
        
        return () => {
            if (socket) {
                console.log('🔌 Отключение WebSocket');
                socket.disconnect();
            }
        };
    }, [setupWebSocket]);

    // 🎯 ОБРАБОТЧИКИ ДЕЙСТВИЙ
    const handleParticipate = useCallback(async () => {
        if (!user || !tournament) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/participate`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Вы успешно зарегистрировались в турнире!');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка участия:', error);
            setMessage(`❌ Ошибка регистрации: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [user, tournament, id, loadTournamentData]);

    // 🎯 ФУНКЦИЯ ТРАНСФОРМАЦИИ МАТЧЕЙ ДЛЯ BRACKETRENDERER
    const transformMatchesToGames = useCallback((matchesArray) => {
        if (!matchesArray || !Array.isArray(matchesArray)) {
            console.warn('transformMatchesToGames: некорректные данные матчей', matchesArray);
            return [];
        }

        console.log('🔄 Трансформация матчей для BracketRenderer:', matchesArray.length);

        return matchesArray.map(match => {
            // Создаем участников из данных матча
            const participants = [];
            
            // Участник 1
            if (match.team1_id || match.team1_name) {
                participants.push({
                    id: match.team1_id || `team1_${match.id}`,
                    name: match.team1_name || 'TBD',
                    score: match.team1_score || 0,
                    isWinner: match.winner_id === match.team1_id,
                    avatarUrl: match.team1_avatar_url || null
                });
            }

            // Участник 2
            if (match.team2_id || match.team2_name) {
                participants.push({
                    id: match.team2_id || `team2_${match.id}`,
                    name: match.team2_name || 'TBD', 
                    score: match.team2_score || 0,
                    isWinner: match.winner_id === match.team2_id,
                    avatarUrl: match.team2_avatar_url || null
                });
            }

            // Если нет участников, создаем пустых
            while (participants.length < 2) {
                participants.push({
                    id: `empty_${match.id}_${participants.length}`,
                    name: 'TBD',
                    score: 0,
                    isWinner: false,
                    avatarUrl: null
                });
            }

            // Возвращаем объект в формате, ожидаемом BracketRenderer
            return {
                id: match.id,
                round: match.round !== undefined ? match.round : 0,
                match_number: match.match_number || 0,
                bracket_type: match.bracket_type || 'winner',
                is_third_place_match: match.is_third_place_match || false,
                state: match.status === 'completed' ? 'DONE' : 'OPEN',
                name: match.name || `Матч ${match.match_number || match.id}`,
                participants: participants,
                winner_id: match.winner_id || null,
                status: match.status || 'pending'
            };
        });
    }, []);

    // 🎯 МЕМОИЗИРОВАННЫЕ ДАННЫЕ ДЛЯ BRACKETRENDERER
    const bracketGames = useMemo(() => {
        if (!matches || matches.length === 0) {
            console.log('🎯 Нет матчей для трансформации');
            return [];
        }

        const transformedGames = transformMatchesToGames(matches);
        console.log('🎯 Трансформированные игры для BracketRenderer:', transformedGames.length);
        return transformedGames;
    }, [matches, transformMatchesToGames]);

    const handleWithdraw = useCallback(async () => {
        if (!user || !tournament) return;

        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/tournaments/${id}/participate`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Вы покинули турнир');
            setTimeout(() => setMessage(''), 3000);
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
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка запуска турнира:', error);
            setMessage(`❌ Ошибка запуска: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    const handleEndTournament = useCallback(async () => {
        if (!userPermissions.canEdit || !window.confirm('Вы уверены, что хотите завершить турнир?')) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/end`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Турнир завершен!');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка завершения турнира:', error);
            setMessage(`❌ Ошибка завершения: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    const handleClearResults = useCallback(async () => {
        if (!userPermissions.canEdit || !window.confirm('Вы уверены? Все результаты будут удалены!')) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/clear-results`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Результаты очищены!');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка очистки результатов:', error);
            setMessage(`❌ Ошибка очистки: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    const handleTeamClick = useCallback((teamName) => {
        console.log('Клик по команде:', teamName);
        // Здесь может быть логика показа состава команды
    }, []);

    const handleMatchClick = useCallback((match) => {
        setSelectedMatch(match);
    }, []);

    const handleRemoveParticipant = useCallback(async (participantId) => {
        if (!userPermissions.canEdit || !window.confirm('Удалить участника?')) return;

        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/tournaments/${id}/participants/${participantId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Участник удален');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка удаления участника:', error);
            setMessage(`❌ Ошибка: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    const handleTeamsGenerated = useCallback((teams) => {
        console.log('✅ Команды сгенерированы:', teams);
        setMixedTeams(teams);
        loadTournamentData();
    }, [loadTournamentData]);

    const handleTeamsUpdated = useCallback(() => {
        console.log('✅ Команды обновлены');
        loadTournamentData();
    }, [loadTournamentData]);

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
            <div className="tournament-details-tournamentdetails tournament-loading">
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
            <div className="tournament-details-tournamentdetails tournament-error">
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
            <div className="tournament-details-tournamentdetails tournament-not-found">
                <h2>🔍 Турнир не найден</h2>
                <p>Турнир с ID {id} не существует или был удален.</p>
                <Link to="/tournaments">← Вернуться к списку турниров</Link>
            </div>
        );
    }

    return (
        <TournamentErrorBoundary>
            <section className="tournament-details-tournamentdetails">
                {/* 🎯 ЗАГОЛОВОК ТУРНИРА */}
                <div className="tournament-header-tournamentdetails">
                    <h2>{tournament.name}</h2>
                    <div className="tournament-meta">
                        <span className={`status-badge ${tournament.status?.toLowerCase()}`}>
                            {tournament.status === 'registration' && '📋 Регистрация'}
                            {tournament.status === 'active' && '🎮 Активный'}
                            {tournament.status === 'in_progress' && '⚔️ В процессе'}
                            {tournament.status === 'completed' && '🏆 Завершен'}
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

                {/* 🎯 НАВИГАЦИЯ ПО ВКЛАДКАМ */}
                <nav className="tabs-navigation-tournamentdetails">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-button-tournamentdetails ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="tab-icon">{tab.icon}</span>
                            <span className="tab-label-tournamentdetails">{tab.label}</span>
                        </button>
                    ))}
                </nav>

                {/* 🎯 СОДЕРЖИМОЕ ВКЛАДОК */}
                <div className="tournament-content-tournamentdetails">
                    {/* ВКЛАДКА: ИНФОРМАЦИЯ */}
                    {activeTab === 'info' && (
                        <div className="tab-content-tournamentdetails tab-info-tournamentdetails">
                            <div className="tournament-info-grid-tournamentdetails">
                                <div className="info-main-tournamentdetails">
                                    <div className="info-block-tournamentdetails">
                                        <h3>📋 Основная информация</h3>
                                        <div className="tournament-meta-info-tournamentdetails">
                                            <div className="meta-item-tournamentdetails">
                                                <strong>🎮 Игра:</strong> {tournament.game || 'Не указана'}
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>🏆 Формат:</strong> {tournament.format || 'Не указан'}
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>👥 Участников:</strong> {tournament.participants?.length || 0}
                                                {tournament.max_participants && ` из ${tournament.max_participants}`}
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>📅 Создан:</strong> {new Date(tournament.created_at).toLocaleString('ru-RU')}
                                            </div>
                                            {tournament.start_date && (
                                                <div className="meta-item-tournamentdetails">
                                                    <strong>🕐 Начало:</strong> {new Date(tournament.start_date).toLocaleString('ru-RU')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {tournament.description && (
                                        <div className="info-block-tournamentdetails">
                                            <h3>📝 Описание</h3>
                                            <p className="tournament-description">{tournament.description}</p>
                                        </div>
                                    )}

                                    {tournament.rules && (
                                        <div className="info-block-tournamentdetails">
                                            <h3>📜 Правила</h3>
                                            <p className="tournament-rules">{tournament.rules}</p>
                                        </div>
                                    )}

                                    {tournament.prize_pool && (
                                        <div className="info-block-tournamentdetails">
                                            <h3>💰 Призовой фонд</h3>
                                            <p className="tournament-prize">{tournament.prize_pool}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* КНОПКИ УЧАСТИЯ */}
                            {user && tournament.status === 'registration' && (
                                <div className="participation-controls">
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
                        <div className="tab-content-tournamentdetails">
                            <h3>👥 Участники турнира ({tournament.participants?.length || 0})</h3>
                            
                            {tournament.participants && tournament.participants.length > 0 ? (
                                <>
                                    <div className="original-participants-list-wrapper">
                                        <h3>📋 Список участников</h3>
                                        <div className="original-participants-grid">
                                            {tournament.participants.map((participant, index) => (
                                                <div key={participant.id || index} className="participant-card">
                                                    <div className="participant-avatar">
                                                        {participant.avatar_url ? (
                                                            <img 
                                                                src={ensureHttps(participant.avatar_url)} 
                                                                alt={participant.name || participant.username || 'Участник'}
                                                                onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                            />
                                                        ) : (
                                                            <div className="avatar-placeholder">
                                                                {(participant.name || participant.username || 'У').charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="participant-info">
                                                        <Link 
                                                            to={`/profile/${participant.user_id || participant.id}`}
                                                            className="participant-name"
                                                        >
                                                            {participant.name || participant.username || 'Участник'}
                                                        </Link>
                                                        {participant.faceit_elo && (
                                                            <div className="participant-elo">
                                                                FACEIT: {participant.faceit_elo}
                                                            </div>
                                                        )}
                                                        {participant.cs2_rank && (
                                                            <div className="participant-rank">
                                                                CS2: {participant.cs2_rank}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {userPermissions.isAdminOrCreator && (
                                                        <button
                                                            className="remove-participant"
                                                            onClick={() => handleRemoveParticipant(participant.id)}
                                                            title="Удалить участника"
                                                        >
                                                            ❌
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* MIX ТУРНИРЫ: ОТОБРАЖЕНИЕ КОМАНД */}
                                    {tournament.format === 'mix' && mixedTeams && mixedTeams.length > 0 && (
                                        <div className="mixed-teams">
                                            <h3>🎲 Сформированные команды</h3>
                                            <div className="mixed-teams-grid">
                                                {mixedTeams.map((team, index) => (
                                                    <div key={team.id || index} className="team-card">
                                                        <h4>
                                                            {team.name || `Команда ${index + 1}`}
                                                            <span className="team-rating">
                                                                Средний рейтинг: {team.averageRating || '—'}
                                                            </span>
                                                        </h4>
                                                        <table className="team-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Игрок</th>
                                                                    <th>{ratingType === 'faceit' ? 'FACEIT ELO' : 'CS2 Premier'}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {team.players?.map((player, playerIndex) => (
                                                                    <tr key={player.id || playerIndex}>
                                                                        <td>
                                                                            <Link to={`/profile/${player.id}`}>
                                                                                {player.name || player.username}
                                                                            </Link>
                                                                        </td>
                                                                        <td>
                                                                            {ratingType === 'faceit' 
                                                                                ? player.faceit_elo || '—'
                                                                                : player.cs2_rank || '—'
                                                                            }
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
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
                            {tournament.format === 'mix' && userPermissions.isAdminOrCreator && tournament.status === 'registration' && (
                                <div className="team-generator-section">
                                    <h3>⚡ Управление командами</h3>
                                    <div className="rating-type-selector">
                                        <label>Тип рейтинга для балансировки:</label>
                                        <select 
                                            value={ratingType} 
                                            onChange={(e) => setRatingType(e.target.value)}
                                        >
                                            <option value="faceit">FACEIT ELO</option>
                                            <option value="cs2">CS2 Premier</option>
                                        </select>
                                    </div>
                                    <TeamGenerator 
                                        tournament={tournament}
                                        participants={tournament.participants || []}
                                        onTeamsGenerated={handleTeamsGenerated}
                                        onTeamsUpdated={handleTeamsUpdated}
                                        onRemoveParticipant={handleRemoveParticipant}
                                        isAdminOrCreator={userPermissions.isAdminOrCreator}
                                        toast={(msg) => {
                                            setMessage(msg);
                                            setTimeout(() => setMessage(''), 3000);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: СЕТКА */}
                    {activeTab === 'bracket' && (
                        <div className="tab-content-tournamentdetails">
                            <h3>🏆 Турнирная сетка</h3>
                            
                            {matches && matches.length > 0 ? (
                                <div className="custom-tournament-bracket">
                                    <BracketRenderer 
                                        games={bracketGames}
                                        canEditMatches={userPermissions.canEdit}
                                        selectedMatch={selectedMatch}
                                        setSelectedMatch={setSelectedMatch}
                                        handleTeamClick={handleTeamClick}
                                        format={tournament.format}
                                        onMatchClick={handleMatchClick}
                                    />
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>🏆 Сетка турнира еще не создана</p>
                                    {userPermissions.isAdminOrCreator && tournament.status === 'registration' && (
                                        <button 
                                            className="btn btn-primary generate-bracket-button"
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
                        <div className="tab-content-tournamentdetails">
                            <h3>📊 Результаты матчей</h3>
                            
                            {matches && matches.filter(m => m.status === 'completed').length > 0 ? (
                                <div className="results-compact-list">
                                    {matches
                                        .filter(match => match.status === 'completed')
                                        .sort((a, b) => b.round - a.round || new Date(b.completed_at) - new Date(a.completed_at))
                                        .map(match => (
                                            <div key={match.id} className="result-compact-item">
                                                <div className="result-compact-content">
                                                    <div className="result-compact-round">
                                                        Раунд {match.round}
                                                        {match.is_third_place_match && (
                                                            <span className="third-place-indicator">🥉 Матч за 3-е место</span>
                                                        )}
                                                    </div>
                                                    <div className="result-compact-match">
                                                        <button 
                                                            className={`team-name-btn ${match.winner_id === match.team1_id ? 'winner' : ''}`}
                                                            onClick={() => handleTeamClick(match.team1_name)}
                                                        >
                                                            {match.team1_name || 'Команда 1'}
                                                        </button>
                                                        <span className="match-score">
                                                            {match.team1_score || 0} : {match.team2_score || 0}
                                                        </span>
                                                        <button 
                                                            className={`team-name-btn ${match.winner_id === match.team2_id ? 'winner' : ''}`}
                                                            onClick={() => handleTeamClick(match.team2_name)}
                                                        >
                                                            {match.team2_name || 'Команда 2'}
                                                        </button>
                                                    </div>
                                                    <button 
                                                        className="details-btn"
                                                        onClick={() => handleMatchClick(match)}
                                                    >
                                                        Подробнее
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>📊 Результатов пока нет</p>
                                    <p>Результаты появятся после завершения матчей</p>
                                </div>
                            )}

                            {/* ПОБЕДИТЕЛИ */}
                            {tournament.status === 'completed' && tournament.winner_id && (
                                <div className="winners-section">
                                    <h3>🏆 Призёры турнира</h3>
                                    <div className="winners-podium">
                                        {/* Первое место */}
                                        <div className="winner-card place-1">
                                            <div className="medal-icon gold-medal">🥇</div>
                                            <div className="winner-info">
                                                {tournament.format === 'mix' ? (
                                                    <div className="team-winner">
                                                        <h4>{tournament.winner_name || 'Команда победитель'}</h4>
                                                        {/* Здесь можно показать состав команды */}
                                                    </div>
                                                ) : (
                                                    <Link to={`/profile/${tournament.winner_id}`} className="winner-name">
                                                        {tournament.winner_name || 'Победитель'}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>

                                        {/* Второе место */}
                                        {tournament.second_place_id && (
                                            <div className="winner-card place-2">
                                                <div className="medal-icon silver-medal">🥈</div>
                                                <div className="winner-info">
                                                    {tournament.format === 'mix' ? (
                                                        <div className="team-winner">
                                                            <h4>{tournament.second_place_name || 'Второе место'}</h4>
                                                        </div>
                                                    ) : (
                                                        <Link to={`/profile/${tournament.second_place_id}`} className="winner-name">
                                                            {tournament.second_place_name || 'Второе место'}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Третье место */}
                                        {tournament.third_place_id && (
                                            <div className="winner-card place-3">
                                                <div className="medal-icon bronze-medal">🥉</div>
                                                <div className="winner-info">
                                                    {tournament.format === 'mix' ? (
                                                        <div className="team-winner">
                                                            <h4>{tournament.third_place_name || 'Третье место'}</h4>
                                                        </div>
                                                    ) : (
                                                        <Link to={`/profile/${tournament.third_place_id}`} className="winner-name">
                                                            {tournament.third_place_name || 'Третье место'}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: УПРАВЛЕНИЕ */}
                    {activeTab === 'admin' && userPermissions.isAdminOrCreator && (
                        <div className="tab-content-tournamentdetails">
                            <div className="tournament-management-panel">
                                <h3 className="management-title">⚙️ Панель управления турниром</h3>
                                
                                <div className="management-actions">
                                    {/* Управление турниром */}
                                    <div className="action-group">
                                        <h4 className="action-group-title">🎮 Управление турниром</h4>
                                        <div className="action-buttons">
                                            {tournament.status === 'registration' && (
                                                <>
                                                    {(!matches || matches.length === 0) && (
                                                        <button 
                                                            className="management-btn generate-bracket-button"
                                                            onClick={handleGenerateBracket}
                                                            title="Создать турнирную сетку"
                                                        >
                                                            <span className="btn-icon">⚡</span>
                                                            Создать сетку
                                                        </button>
                                                    )}
                                                    
                                                    {matches && matches.length > 0 && (
                                                        <button 
                                                            className="management-btn start-tournament"
                                                            onClick={handleStartTournament}
                                                            title="Запустить турнир"
                                                        >
                                                            <span className="btn-icon">🚀</span>
                                                            Запустить турнир
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            
                                            {(tournament.status === 'active' || tournament.status === 'in_progress') && (
                                                <button 
                                                    className="management-btn end-tournament"
                                                    onClick={handleEndTournament}
                                                    title="Завершить турнир"
                                                >
                                                    <span className="btn-icon">🏁</span>
                                                    Завершить турнир
                                                </button>
                                            )}
                                            
                                            {matches && matches.length > 0 && tournament.status !== 'completed' && (
                                                <button 
                                                    className="management-btn regenerate-bracket"
                                                    onClick={handleGenerateBracket}
                                                    title="Пересоздать сетку"
                                                >
                                                    <span className="btn-icon">🔄</span>
                                                    Пересоздать сетку
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Управление результатами */}
                                    <div className="action-group">
                                        <h4 className="action-group-title">📊 Управление результатами</h4>
                                        <div className="action-buttons">
                                            {matches && matches.some(m => m.status === 'completed') && (
                                                <button 
                                                    className="management-btn clear-results-button"
                                                    onClick={handleClearResults}
                                                    title="Очистить все результаты"
                                                >
                                                    <span className="btn-icon">🗑️</span>
                                                    Очистить результаты
                                                </button>
                                            )}
                                            
                                            <button 
                                                className="management-btn"
                                                onClick={loadTournamentData}
                                                title="Обновить данные турнира"
                                            >
                                                <span className="btn-icon">🔄</span>
                                                Обновить данные
                                            </button>
                                        </div>
                                    </div>

                                    {/* Статистика */}
                                    <div className="action-group">
                                        <h4 className="action-group-title">📈 Статистика турнира</h4>
                                        <div className="tournament-stats">
                                            <div className="stat-item">
                                                <span className="stat-label">Участников:</span>
                                                <span className="stat-value">{tournament.participants?.length || 0}</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">Матчей:</span>
                                                <span className="stat-value">{matches?.length || 0}</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">Завершено:</span>
                                                <span className="stat-value">
                                                    {matches?.filter(m => m.status === 'completed').length || 0}
                                                </span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">В процессе:</span>
                                                <span className="stat-value">
                                                    {matches?.filter(m => m.status === 'in_progress').length || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Информация о завершенном турнире */}
                                {tournament.status === 'completed' && (
                                    <div className="tournament-completed-info">
                                        <div className="completed-status">
                                            <span className="btn-icon">🏆</span>
                                            <div className="status-text">
                                                <p>Турнир завершен</p>
                                                {tournament.winner_name && (
                                                    <p>Победитель: <strong>{tournament.winner_name}</strong></p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
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