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
        if (!tournament?.id) return;
        
        try {
            const response = await api.get(`/api/tournaments/${tournament.id}/teams`);
            if (response.data && Array.isArray(response.data)) {
                console.log('Загруженные команды турнира:', response.data);
                
                // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ
                const enrichedTeams = response.data.map(team => ({
                    ...team,
                    averageRating: calculateTeamAverageRating(team)
                }));
                
                setMixedTeams(enrichedTeams);
                
                // 🎯 ВЫЗЫВАЕМ onTeamsGenerated ТОЛЬКО если команды были ВПЕРВЫЕ загружены
                // Проверяем что текущие команды пустые (это первая загрузка)
                if (mixedTeams.length === 0 && onTeamsGenerated) {
                    console.log('fetchTeams: вызываем onTeamsGenerated с загруженными командами (первая загрузка)', enrichedTeams);
                    onTeamsGenerated(enrichedTeams);
                } else {
                    console.log('fetchTeams: команды обновлены без вызова onTeamsGenerated (предотвращение цикла)');
                }
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки команд:', error);
        }
    }, [tournament?.id, calculateTeamAverageRating, mixedTeams.length]); // Добавляем mixedTeams.length для проверки

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
        
        // 🎯 ИСПРАВЛЕНИЕ БЕСКОНЕЧНОГО ЦИКЛА: проверяем что команды еще не установлены
        if (tournament && tournament.teams && tournament.teams.length > 0 && mixedTeams.length === 0) {
            console.log('🔄 Устанавливаем существующие команды из турнира (один раз)');
            
            // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ
            const enrichedTeams = tournament.teams.map(team => ({
                ...team,
                averageRating: calculateTeamAverageRating(team)
            }));
            
            setMixedTeams(enrichedTeams);
            
            // 🎯 НЕ ВЫЗЫВАЕМ onTeamsGenerated для уже существующих команд
            // так как это приводит к бесконечному циклу перезагрузки
            console.log('✅ Команды установлены без вызова onTeamsGenerated (предотвращение цикла)');
        }

        // Загружаем оригинальных участников, если это микс турнир и участники не загружены
        if (tournament && tournament.id && tournament.participant_type === 'team' && tournament.format === 'mix' && originalParticipants.length === 0) {
            fetchOriginalParticipants();
        }

        // Отладочная информация по командам
        console.log('TeamGenerator useEffect:', {
            tournamentTeams: tournament?.teams,
            hasTeams: tournament?.teams && tournament.teams.length > 0,
            participantType: tournament?.participant_type,
            mixedTeamsLength: mixedTeams.length
        });
    }, [tournament?.id, tournament?.participant_type, tournament?.format, participants?.length]); // УБИРАЕМ calculateTeamAverageRating и onTeamsGenerated из зависимостей

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
        if (!tournament?.id || displayParticipants.length < 2) {
            console.warn('Недостаточно участников для формирования команд');
            return;
        }

        setLoading(true);
        
        try {
            const teamSizeNumber = parseInt(teamSize);
            const participantsData = displayParticipants;
            
            console.log('🚀 Формируем команды:', {
                teamSize: teamSizeNumber,
                participantsCount: participantsData.length,
                ratingType,
                tournamentId: tournament.id
            });

            const response = await api.post(`/api/tournaments/${tournament.id}/generate-teams`, {
                participants: participantsData,
                teamSize: teamSizeNumber,
                ratingType: ratingType
            });

            if (response.data && response.data.teams) {
                console.log('✅ Команды успешно сгенерированы:', response.data.teams);
                
                // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ
                const enrichedTeams = response.data.teams.map(team => ({
                    ...team,
                    averageRating: calculateTeamAverageRating(team)
                }));
                
                setMixedTeams(enrichedTeams);
                
                // 🎯 ВЫЗЫВАЕМ onTeamsGenerated ТОЛЬКО при успешном создании НОВЫХ команд
                if (onTeamsGenerated) {
                    console.log('✅ Уведомляем родительский компонент о новых командах');
                    onTeamsGenerated(enrichedTeams);
                }
                
                // Обновляем tournament.participant_type на 'team' после успешного создания команд
                if (onTeamsUpdated) {
                    onTeamsUpdated();
                }
                
                console.log('✅ Команды успешно созданы и установлены');
            } else {
                console.error('❌ Некорректный ответ сервера при генерации команд');
            }
        } catch (error) {
            console.error('❌ Ошибка при формировании команд:', error);
            
            // Показываем пользователю ошибку
            if (error.response?.data?.message) {
                console.error('Сообщение об ошибке:', error.response.data.message);
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

    // Функция рендеринга команд (для микс турниров)
    const renderTeamsList = () => {
        const teamsExist = mixedTeams && mixedTeams.length > 0;
        const tournamentTeams = tournament?.teams || [];
        
        console.log('TeamGenerator render:', {
            teamsExist,
            tournamentTeams,
            mixedTeamsLength: mixedTeams.length,
            teamsListLength: tournamentTeams.length,
            shouldShowTeams: teamsExist || tournamentTeams.length > 0,
            onTeamsGeneratedExists: !!onTeamsGenerated
        });

        // 🎯 УБИРАЕМ ДУБЛИРУЮЩИЙ ВЫЗОВ onTeamsGenerated ИЗ РЕНДЕРА
        // Вызовы onTeamsGenerated должны происходить только в useEffect и при генерации новых команд
        
        // Если команды есть, отображаем их
        if (teamsExist || tournamentTeams.length > 0) {
            const teamsToShow = teamsExist ? mixedTeams : tournamentTeams.map(team => ({
                ...team,
                averageRating: calculateTeamAverageRating(team)
            }));

            return (
                <div className="teams-display">
                    {/* Заголовок с информацией о командах */}
                    <div className="teams-header">
                        <h4>🏆 Сформированные команды ({teamsToShow.length})</h4>
                        <div className="teams-stats">
                            <span className="stat-item">
                                👥 {teamsToShow.reduce((total, team) => total + (team.members?.length || 0), 0)} игроков
                            </span>
                            <span className="stat-item">
                                ⭐ Средний рейтинг: {teamsToShow.length > 0 
                                    ? Math.round(teamsToShow.reduce((sum, team) => sum + (team.averageRating || 0), 0) / teamsToShow.length)
                                    : 0
                                }
                            </span>
                        </div>
                    </div>

                    {/* Сетка команд */}
                    <div className="teams-grid">
                        {teamsToShow.map((team, index) => (
                            <div key={team.id || index} className="team-card">
                                <div className="team-header">
                                    <h5>{team.name || `Команда ${index + 1}`}</h5>
                                    <div className="team-rating">
                                        <span className="rating-value">{team.averageRating || '—'}</span>
                                        <span className="rating-label">ELO</span>
                                    </div>
                                </div>
                                
                                <div className="team-members">
                                    {team.members && team.members.length > 0 ? (
                                        team.members.map((member, memberIndex) => (
                                            <div key={memberIndex} className="team-member">
                                                <div className="member-avatar">
                                                    <img 
                                                        src={member.avatar_url || '/default-avatar.png'} 
                                                        alt={member.name}
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = '/default-avatar.png';
                                                        }}
                                                    />
                                                </div>
                                                <div className="member-info">
                                                    <span className="member-name">
                                                        {member.user_id ? (
                                                            <a href={`/profile/${member.user_id}`}>
                                                                {member.name || member.username}
                                                            </a>
                                                        ) : (
                                                            member.name
                                                        )}
                                                    </span>
                                                    <span className="member-rating">
                                                        {member.faceit_elo || member.cs2_premier_rank || 'Н/Д'} ELO
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="no-members">Состав не определен</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Если команд нет, показываем интерфейс генерации (только для микс турниров)
        if (tournament?.format === 'mix') {
            return renderGenerationInterface();
        }

        // Для обычных турниров без команд
        return (
            <div className="no-teams-message">
                <p>🏆 Команды будут добавлены организатором турнира</p>
            </div>
        );
    };

    // Функция рендеринга списка участников
    const renderParticipantsList = () => {
        if (tournament?.format !== 'mix') return null;

        return (
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
                                    disabled={mixedTeams.length > 0 || loading}
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
                            {tournament.participant_type === 'solo' && mixedTeams.length === 0 && (
                                <button 
                                    onClick={handleFormTeams} 
                                    className="form-teams-button"
                                    disabled={loading || displayParticipants.length < 2}
                                >
                                    {loading ? '⏳ Создание команд...' : '⚡ Сформировать команды из участников'}
                                </button>
                            )}
                            {tournament.participant_type === 'solo' && mixedTeams.length > 0 && tournament.status === 'active' && (
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
            </div>
        );
    };

    // Функция рендеринга интерфейса генерации команд
    const renderGenerationInterface = () => {
        return (
            <div className="generation-interface">
                <div className="no-teams-message">
                    <div className="no-teams-icon">⚽</div>
                    <h4>Команды еще не сформированы</h4>
                    <p>Нажмите кнопку "Сформировать команды" чтобы создать сбалансированные команды на основе рейтинга игроков</p>
                </div>
            </div>
        );
    };

    return (
        <div className="team-generator">
            {/* 🎯 ВСЕГДА ПОКАЗЫВАЕМ УЧАСТНИКОВ */}
            {renderParticipantsList()}
            
            {/* 🎯 КОМАНДЫ ОТОБРАЖАЮТСЯ НИЖЕ УЧАСТНИКОВ */}
            {renderTeamsList()}
        </div>
    );
};

export default TeamGenerator; 