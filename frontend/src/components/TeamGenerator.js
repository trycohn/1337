import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { ensureHttps } from '../utils/userHelpers';
import TeamCard from './TeamCard';
import './TeamGenerator.css';

/**
 * Компонент для генерации команд в турнире
 * 
 * @param {Object} props - Свойства компонента
 * @param {Object} props.tournament - Объект турнира
 * @param {Array} props.participants - Список участников для формирования команд
 * @param {Function} props.onTeamsGenerated - Функция обратного вызова при формировании команд
 * @param {Function} props.onTeamsUpdated - Функция обратного вызова для обновления данных турнира
 * @param {Function} props.onRemoveParticipant - Функция для удаления участника
 * @param {boolean} props.isAdminOrCreator - Имеет ли пользователь права администратора
 * @param {Function} props.toast - Функция для отображения уведомлений
 */
const TeamGenerator = ({ 
    tournament, 
    participants, 
    onTeamsGenerated, 
    onTeamsUpdated,
    onRemoveParticipant,
    isAdminOrCreator = false,
    toast
}) => {
    const [ratingType, setRatingType] = useState('faceit');
    const [teamSize, setTeamSize] = useState('5');
    const [loading, setLoading] = useState(false);
    const [mixedTeams, setMixedTeams] = useState([]);
    const [originalParticipants, setOriginalParticipants] = useState([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);
    const [loadingTeams, setLoadingTeams] = useState(false);

    // ⏱️ Debounce механизм для предотвращения частых запросов
    const [lastRequestTime, setLastRequestTime] = useState({});
    const REQUEST_DEBOUNCE_MS = 3000; // 3 секунды между запросами одного типа
    
    const shouldMakeRequest = (requestType) => {
        const now = Date.now();
        const lastTime = lastRequestTime[requestType] || 0;
        
        if (now - lastTime < REQUEST_DEBOUNCE_MS) {
            console.log(`⏱️ TeamGenerator Debounce: пропускаем ${requestType}, последний запрос ${now - lastTime}ms назад`);
            return false;
        }
        
        setLastRequestTime(prev => ({ ...prev, [requestType]: now }));
        return true;
    };

    // 🎯 ФУНКЦИЯ РАСЧЕТА СРЕДНЕГО РЕЙТИНГА КОМАНДЫ
    const calculateTeamAverageRating = useCallback((team) => {
        if (!team.members || team.members.length === 0) return 0;
        
        const ratings = team.members.map(member => {
            if (ratingType === 'faceit') {
                return parseInt(member.faceit_elo) || 1000; // Базовый рейтинг FACEIT
            } else {
                return parseInt(member.cs2_premier_rank || member.premier_rank) || 5; // Базовый ранг CS2
            }
        }).filter(rating => rating > 0);
        
        if (ratings.length === 0) return 0;
        
        const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        return Math.round(average);
    }, [ratingType]);

    // Функция для загрузки команд турнира
    const fetchTeams = useCallback(async () => {
        if (!tournament || !tournament.id || !shouldMakeRequest('teams')) return;
        
        setLoadingTeams(true);
        try {
            console.log('🔍 Sending request to: /api/tournaments/' + tournament.id + '/teams');
            const response = await api.get(`/api/tournaments/${tournament.id}/teams`);
            if (response.data && Array.isArray(response.data)) {
                console.log('Загруженные команды турнира:', response.data);
                
                // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ
                const enrichedTeams = response.data.map(team => ({
                    ...team,
                    averageRating: calculateTeamAverageRating(team)
                }));
                
                setMixedTeams(enrichedTeams);
                
                // Уведомляем родительский компонент о загруженных командах
                if (onTeamsGenerated && enrichedTeams.length > 0) {
                    console.log('fetchTeams: вызываем onTeamsGenerated с загруженными командами', enrichedTeams);
                    onTeamsGenerated(enrichedTeams);
                }
            }
        } catch (error) {
            console.error('Ошибка при загрузке команд турнира:', error);
            if (toast) {
                toast.error('Не удалось загрузить команды');
            }
        } finally {
            setLoadingTeams(false);
        }
    }, [tournament?.id, calculateTeamAverageRating]); // ИСПРАВЛЕНО: добавлен calculateTeamAverageRating

    // Функция для загрузки оригинальных участников
    const fetchOriginalParticipants = useCallback(async () => {
        if (!tournament || !tournament.id || !shouldMakeRequest('original-participants')) return;
        
        setLoadingParticipants(true);
        try {
            console.log('🔍 Sending request to: /api/tournaments/' + tournament.id + '/original-participants');
            const response = await api.get(`/api/tournaments/${tournament.id}/original-participants`);
            if (response.data && Array.isArray(response.data)) {
                setOriginalParticipants(response.data);
            }
        } catch (error) {
            console.error('Ошибка при загрузке оригинальных участников:', error);
            if (toast) {
                toast.error('Не удалось загрузить список участников');
            }
        } finally {
            setLoadingParticipants(false);
        }
    }, [tournament?.id]); // ИСПРАВЛЕНО: убран toast из зависимостей

    // При инициализации устанавливаем размер команды из турнира и загружаем команды
    useEffect(() => {
        if (tournament && tournament.team_size) {
            setTeamSize(tournament.team_size.toString());
        }
        
        // 🎯 ВСЕГДА СОХРАНЯЕМ УЧАСТНИКОВ
        if (participants && participants.length > 0) {
            setOriginalParticipants(participants);
        }
        
        // Загружаем оригинальных участников, если это турнир с командами
        if (tournament && tournament.id && tournament.participant_type === 'team' && tournament.format === 'mix') {
            fetchOriginalParticipants();
            
            // Загружаем команды турнира, если они есть
            if (tournament.participant_type === 'team') {
                fetchTeams();
            }
        }

        // Если у турнира есть команды, устанавливаем их в состояние
        if (tournament && tournament.teams && tournament.teams.length > 0) {
            // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ
            const enrichedTeams = tournament.teams.map(team => ({
                ...team,
                averageRating: calculateTeamAverageRating(team)
            }));
            
            setMixedTeams(enrichedTeams);
            
            // Уведомляем родительский компонент о наличии команд
            if (onTeamsGenerated) {
                console.log('TeamGenerator: вызываем onTeamsGenerated с существующими командами', enrichedTeams);
                onTeamsGenerated(enrichedTeams);
            }
        }

        // Отладочная информация по командам
        console.log('TeamGenerator useEffect:', {
            tournamentTeams: tournament?.teams,
            hasTeams: tournament?.teams && tournament.teams.length > 0,
            participantType: tournament?.participant_type
        });
    }, [tournament?.id, tournament?.participant_type, tournament?.format, participants?.length, calculateTeamAverageRating]); // ИСПРАВЛЕНО: добавлен calculateTeamAverageRating

    // Функция для обновления размера команды на сервере
    const updateTeamSize = async (newSize) => {
        if (!tournament || !tournament.id || !isAdminOrCreator) return;
        
        try {
            const token = localStorage.getItem('token');
            await api.patch(`/api/tournaments/${tournament.id}/team-size`, {
                teamSize: parseInt(newSize, 10)
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (toast) {
                toast.success(`Размер команды изменен на ${newSize}`);
            }
            
            if (onTeamsUpdated) {
                onTeamsUpdated();
            }
        } catch (error) {
            console.error('Ошибка при обновлении размера команды:', error);
            if (toast) {
                toast.error(error.response?.data?.error || 'Не удалось обновить размер команды');
            }
        }
    };

    // Функция для формирования команд
    const handleFormTeams = async () => {
        if (!tournament || !tournament.id) return;
        
        if (participants && participants.length > 0) {
            setOriginalParticipants([...participants]);
        }
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.post(`/api/tournaments/${tournament.id}/form-teams`, {
                ratingType: ratingType,
                teamSize: parseInt(teamSize, 10)
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.data) {
                if (response.data.teams) {
                    console.log('Получены команды от сервера:', response.data.teams);
                    
                    // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ
                    const enrichedTeams = response.data.teams.map(team => ({
                        ...team,
                        averageRating: calculateTeamAverageRating(team)
                    }));
                    
                    setMixedTeams(enrichedTeams);
                    
                    if (onTeamsGenerated) {
                        onTeamsGenerated(enrichedTeams);
                    }
                }
                
                if (onTeamsUpdated) {
                    onTeamsUpdated();
                }
                
                // После формирования команд загружаем оригинальных участников для отображения
                // Принудительно обходим debounce для пользовательских действий
                setLastRequestTime(prev => ({ ...prev, 'original-participants': 0 }));
                fetchOriginalParticipants();
                
                if (toast) {
                    toast.success('Команды успешно сформированы');
                }
            }
        } catch (error) {
            console.error('Ошибка при формировании команд:', error);
            if (toast) {
                toast.error(error.response?.data?.error || 'Не удалось сформировать команды');
            }
        } finally {
            setLoading(false);
        }
    };

    // 🎯 ЛОГИКА ОТОБРАЖЕНИЯ УЧАСТНИКОВ И КОМАНД
    // Участники ВСЕГДА отображаются если доступны
    const displayParticipants = originalParticipants.length > 0 ? originalParticipants : participants || [];
    
    // Команды из турнира или из локального состояния
    const teamsExist = tournament?.teams && tournament.teams.length > 0;
    const teamsList = teamsExist ? tournament.teams : mixedTeams;
    
    // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ ДЛЯ ОТОБРАЖЕНИЯ
    const enrichedTeamsList = teamsList.map(team => ({
        ...team,
        averageRating: team.averageRating || calculateTeamAverageRating(team)
    }));
    
    // Отладочная информация для проверки команд
    console.log('TeamGenerator render:', {
        teamsExist,
        tournamentTeams: tournament?.teams,
        mixedTeamsLength: mixedTeams.length,
        teamsListLength: teamsList.length,
        shouldShowTeams: teamsExist || teamsList.length > 0,
        participantsCount: displayParticipants.length
    });

    return (
        <div className="team-generator">
            {tournament?.format === 'mix' && (
                <>
                    {/* 🎯 СЕКЦИЯ УЧАСТНИКОВ - ВСЕГДА ВИДИМАЯ */}
                    <div className="original-participants-section">
                        <h3>🎮 Зарегистрированные игроки ({displayParticipants?.length || 0})</h3>
                        <div className="mix-players-list">
                            {loadingParticipants ? (
                                <p className="loading-participants">Загрузка участников...</p>
                            ) : displayParticipants && displayParticipants.length > 0 ? (
                                <div className="participants-grid">
                                    {displayParticipants.map((participant) => (
                                        <div key={participant?.id || `participant-${Math.random()}`} className="participant-card">
                                            <div className="participant-avatar">
                                                <img 
                                                    src={ensureHttps(participant.avatar_url) || '/default-avatar.png'} 
                                                    alt={`${participant.name} avatar`}
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = '/default-avatar.png';
                                                    }}
                                                />
                                            </div>
                                            <div className="participant-info">
                                                <span className="participant-name">{participant.name}</span>
                                                <span className="participant-rating">
                                                    {ratingType === 'faceit' 
                                                        ? `FACEIT: ${participant.faceit_elo || 1000}`
                                                        : `Premier: ${participant.premier_rank || participant.cs2_premier_rank || 5}`
                                                    }
                                                </span>
                                            </div>
                                            {isAdminOrCreator && tournament.participant_type === 'solo' && (
                                                <button 
                                                    className="remove-participant"
                                                    onClick={() => onRemoveParticipant(participant.id)}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-participants">Нет зарегистрированных игроков</p>
                            )}
                        </div>
                    </div>

                    {/* 🎯 СЕКЦИЯ КОМАНД - ПОЯВЛЯЕТСЯ НИЖЕ УЧАСТНИКОВ */}
                    <div className="mixed-teams-section">
                        <h3>⚡ Сформированные команды {enrichedTeamsList.length > 0 ? `(${enrichedTeamsList.length})` : '(нет команд)'}</h3>
                        
                        {/* 🎯 СТАТИСТИКА КОМАНД */}
                        {enrichedTeamsList.length > 0 && (
                            <div className="teams-stats">
                                <div className="team-stat">
                                    <span className="stat-label">Всего команд:</span>
                                    <span className="stat-value">{enrichedTeamsList.length}</span>
                                </div>
                                <div className="team-stat">
                                    <span className="stat-label">Игроков в командах:</span>
                                    <span className="stat-value">
                                        {enrichedTeamsList.reduce((total, team) => total + (team.members?.length || 0), 0)}
                                    </span>
                                </div>
                                <div className="team-stat">
                                    <span className="stat-label">Средний рейтинг:</span>
                                    <span className="stat-value">
                                        {enrichedTeamsList.length > 0 
                                            ? Math.round(enrichedTeamsList.reduce((sum, team) => sum + (team.averageRating || 0), 0) / enrichedTeamsList.length)
                                            : 0
                                        }
                                    </span>
                                </div>
                            </div>
                        )}
                        
                        <div className="mixed-teams-grid">
                            {loadingTeams ? (
                                <p className="loading-teams">Загрузка команд...</p>
                            ) : enrichedTeamsList.length > 0 ? (
                                enrichedTeamsList.map((team, index) => (
                                    <div key={team.id || index} className="enhanced-team-card">
                                        <div className="team-card-header">
                                            <div className="team-title">
                                                <h4>{team.name || `Команда ${index + 1}`}</h4>
                                                <span className="team-members-count">
                                                    👥 {team.members?.length || 0} участников
                                                </span>
                                            </div>
                                            <div className="team-rating-display">
                                                <span className="rating-label">
                                                    {ratingType === 'faceit' ? 'FACEIT' : 'Premier'}:
                                                </span>
                                                <span className="rating-value">
                                                    {team.averageRating || calculateTeamAverageRating(team)}
                                                </span>
                                                <span className="rating-suffix">ELO</span>
                                            </div>
                                        </div>
                                        
                                        {/* 🎯 СОСТАВ КОМАНДЫ */}
                                        <div className="team-composition">
                                            <h5>👥 Состав команды:</h5>
                                            {team.members && team.members.length > 0 ? (
                                                <div className="team-members-list">
                                                    {team.members.map((member, memberIndex) => (
                                                        <div key={memberIndex} className="team-member-row">
                                                            <div className="member-avatar">
                                                                <img 
                                                                    src={ensureHttps(member.avatar_url) || '/default-avatar.png'} 
                                                                    alt={`${member.name} avatar`}
                                                                    onError={(e) => {
                                                                        e.target.onerror = null;
                                                                        e.target.src = '/default-avatar.png';
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="member-info">
                                                                <span className="member-name">
                                                                    {member.name || member.username || 'Игрок'}
                                                                </span>
                                                                <span className="member-rating">
                                                                    {ratingType === 'faceit' 
                                                                        ? `${member.faceit_elo || 1000} ELO`
                                                                        : `Ранг ${member.premier_rank || member.cs2_premier_rank || 5}`
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="no-members">Состав команды не определен</p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-teams-message">
                                    <div className="no-teams-icon">⚽</div>
                                    <h4>Команды еще не сформированы</h4>
                                    <p>Нажмите кнопку "Сформировать команды" чтобы создать сбалансированные команды на основе рейтинга игроков</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 🎯 СЕКЦИЯ УПРАВЛЕНИЯ МИКСОМ */}
                    {isAdminOrCreator && (
                        <div className="mix-settings-section">
                            <h3>⚙️ Настройки микса</h3>
                            <div className="mix-controls-row">
                                <div className="mix-form-group">
                                    <label>Размер команды:</label>
                                    <select
                                        value={teamSize}
                                        onChange={(e) => {
                                            const newSize = e.target.value;
                                            setTeamSize(newSize);
                                            updateTeamSize(newSize);
                                        }}
                                        disabled={enrichedTeamsList.length > 0 || loading}
                                    >
                                        <option value="2">2 игрока</option>
                                        <option value="5">5 игроков</option>
                                    </select>
                                </div>
                            
                                <div className="mix-form-group rating-group">
                                    <label>Миксовать по рейтингу:</label>
                                    <select
                                        value={ratingType}
                                        onChange={(e) => setRatingType(e.target.value)}
                                    >
                                        <option value="faceit">FACEit</option>
                                        <option value="premier">Steam Premier</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mix-buttons-row">
                                {tournament.participant_type === 'solo' && enrichedTeamsList.length === 0 && (
                                    <button 
                                        onClick={handleFormTeams} 
                                        className="form-teams-button"
                                        disabled={loading || displayParticipants.length < 2}
                                    >
                                        {loading ? '⏳ Создание команд...' : '⚡ Сформировать команды из участников'}
                                    </button>
                                )}
                                {tournament.participant_type === 'solo' && enrichedTeamsList.length > 0 && tournament.status === 'active' && (
                                    <button 
                                        onClick={handleFormTeams} 
                                        className="reformate-teams-button"
                                        disabled={loading}
                                    >
                                        {loading ? '⏳ Пересоздание команд...' : '🔄 Переформировать команды'}
                                    </button>
                                )}
                                
                                {displayParticipants.length < 2 && (
                                    <p className="min-participants-notice">
                                        ⚠️ Для создания команд нужно минимум 2 участника
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TeamGenerator; 