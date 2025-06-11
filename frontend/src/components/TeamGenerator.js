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

    // 🆕 СОСТОЯНИЯ ДЛЯ МОДАЛЬНОГО ОКНА ПЕРЕФОРМИРОВАНИЯ
    const [showReformModal, setShowReformModal] = useState(false);
    const [reformLoading, setReformLoading] = useState(false);

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

    // 🆕 ФУНКЦИЯ ПРОВЕРКИ ВОЗМОЖНОСТИ ПЕРЕФОРМИРОВАНИЯ
    const canReformTeams = useCallback(() => {
        // Базовые проверки
        if (!tournament || !isAdminOrCreator) return false;
        
        // Проверка статуса турнира - должен быть 'active', но НЕ 'in_progress'
        if (tournament.status !== 'active') return false;
        
        // Проверка наличия команд для переформирования
        const hasTeams = (mixedTeams && mixedTeams.length > 0) || 
                         (tournament.teams && tournament.teams.length > 0);
        if (!hasTeams) return false;
        
        // Проверка что турнир микс-формата
        if (tournament.format !== 'mix') return false;
        
        // Проверка что нет созданных матчей (турнир еще не начался)
        // Это важно - если матчи созданы, переформирование может нарушить сетку
        if (tournament.matches && tournament.matches.length > 0) return false;
        
        return true;
    }, [tournament, isAdminOrCreator, mixedTeams]);

    // 🆕 ФУНКЦИЯ ПЕРЕФОРМИРОВАНИЯ КОМАНД
    const handleReformTeams = async () => {
        if (!canReformTeams() || displayParticipants.length < 2) {
            console.warn('Переформирование команд недоступно');
            return;
        }

        setReformLoading(true);
        
        try {
            const teamSizeNumber = parseInt(teamSize);
            
            console.log('🔄 Переформируем команды:', {
                teamSize: teamSizeNumber,
                participantsCount: displayParticipants.length,
                ratingType,
                tournamentId: tournament.id
            });

            // Используем эндпоинт для микс-генерации команд (поддерживает переформирование)
            const response = await api.post(`/api/tournaments/${tournament.id}/mix-generate-teams`, {});

            if (response.data && response.data.teams) {
                console.log('✅ Команды успешно переформированы:', response.data.teams);
                
                // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ
                const enrichedTeams = response.data.teams.map(team => ({
                    ...team,
                    averageRating: calculateTeamAverageRating(team)
                }));
                
                setMixedTeams(enrichedTeams);
                
                // 🎯 УВЕДОМЛЯЕМ О ПЕРЕФОРМИРОВАНИИ
                if (onTeamsGenerated) {
                    console.log('✅ Уведомляем родительский компонент о переформированных командах');
                    onTeamsGenerated(enrichedTeams);
                }
                
                if (onTeamsUpdated) {
                    onTeamsUpdated();
                }
                
                // Закрываем модальное окно
                setShowReformModal(false);
                
                console.log('✅ Команды успешно переформированы');
                
                if (toast) {
                    toast.success('🔄 Команды успешно переформированы!');
                }
            } else {
                console.error('❌ Некорректный ответ сервера при переформировании команд');
                if (toast) {
                    toast.error('Ошибка переформирования команд');
                }
            }
        } catch (error) {
            console.error('❌ Ошибка при переформировании команд:', error);
            
            if (toast) {
                const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Не удалось переформировать команды';
                toast.error(errorMessage);
            }
        } finally {
            setReformLoading(false);
        }
    };

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
            
            if (response.data) {
                // 🆕 НОВАЯ ЛОГИКА: используем группированные данные от сервера
                console.log('📊 Получены группированные участники:', {
                    total: response.data.total,
                    inTeam: response.data.inTeamCount,
                    notInTeam: response.data.notInTeamCount
                });
                
                // Устанавливаем всех участников (для совместимости)
                setOriginalParticipants(response.data.all || []);
                
                // 🆕 ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ для UI
                // Сохраняем информацию о группах для использования в компоненте
                if (response.data.notInTeam && response.data.notInTeam.length > 0) {
                    console.log(`⚠️ Найдено ${response.data.notInTeam.length} участников не в командах`);
                }
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

    // 🆕 ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ТЕКСТА О СОСТОЯНИИ УЧАСТНИКОВ
    const getParticipantsStatusText = useCallback(() => {
        if (!displayParticipants.length) return '';
        
        const inTeam = displayParticipants.filter(p => p.in_team);
        const notInTeam = displayParticipants.filter(p => !p.in_team);
        
        if (notInTeam.length > 0) {
            return ` (${inTeam.length} в командах, ${notInTeam.length} не в команде)`;
        }
        
        return ` (${inTeam.length} в командах)`;
    }, [displayParticipants]);

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
            
            console.log('🚀 Формируем команды:', {
                teamSize: teamSizeNumber,
                participantsCount: displayParticipants.length,
                ratingType,
                tournamentId: tournament.id
            });

            const response = await api.post(`/api/tournaments/${tournament.id}/form-teams`, {
                ratingType: ratingType,
                teamSize: teamSizeNumber
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
                    {/* 🎯 ЗАГОЛОВОК С УЛУЧШЕННОЙ СТАТИСТИКОЙ */}
                    <div className="teams-header">
                        <h4>🏆 Сформированные команды ({teamsToShow.length})</h4>
                        
                        {/* ПАНЕЛЬ СТАТИСТИКИ */}
                        <div className="teams-stats">
                            <div className="team-stat">
                                <div className="stat-value">{teamsToShow.length}</div>
                                <div className="stat-label">👥 Команд</div>
                            </div>
                            <div className="team-stat">
                                <div className="stat-value">
                                    {teamsToShow.reduce((total, team) => total + (team.members?.length || 0), 0)}
                                </div>
                                <div className="stat-label">🎮 Игроков</div>
                            </div>
                            <div className="team-stat">
                                <div className="stat-value">
                                    {teamsToShow.length > 0 
                                        ? Math.round(teamsToShow.reduce((sum, team) => sum + (team.averageRating || 0), 0) / teamsToShow.length)
                                        : 0
                                    }
                                </div>
                                <div className="stat-label">⭐ Средний рейтинг</div>
                            </div>
                            <div className="team-stat">
                                <div className="stat-value">
                                    {ratingType === 'faceit' ? 'FACEIT' : 'Premier'}
                                </div>
                                <div className="stat-label">🎯 Тип рейтинга</div>
                            </div>
                        </div>
                    </div>

                    {/* 🎯 УЛУЧШЕННАЯ СЕТКА КОМАНД */}
                    <div className="mixed-teams-grid">
                        {teamsToShow.map((team, index) => (
                            <div key={team.id || index} className="enhanced-team-card">
                                {/* ЗАГОЛОВОК КОМАНДЫ */}
                                <div className="team-card-header">
                                    <div className="team-title">
                                        <h4>{team.name || `Команда ${index + 1}`}</h4>
                                        <div className="team-members-count">
                                            👥 {team.members?.length || 0} игрок{team.members?.length === 1 ? '' : team.members?.length > 4 ? 'ов' : 'а'}
                                        </div>
                                    </div>
                                    
                                    <div className="team-rating-display">
                                        <div className="rating-label">
                                            {ratingType === 'faceit' ? 'FACEIT' : 'Premier'}
                                        </div>
                                        <div className="rating-value">
                                            {team.averageRating || '—'}
                                            <span className="rating-suffix">
                                                {ratingType === 'faceit' ? ' ELO' : ' Ранг'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* СОСТАВ КОМАНДЫ */}
                                <div className="team-composition">
                                    <h5>👥 Состав</h5>
                                    {team.members && team.members.length > 0 ? (
                                        <div className="team-members-list">
                                            {team.members.map((member, memberIndex) => {
                                                const memberName = member.name || member.username;
                                                const formattedName = formatMemberName(memberName);
                                                
                                                return (
                                                    <div key={memberIndex} className="team-member-row">
                                                        <div className="member-avatar">
                                                            <img 
                                                                src={member.avatar_url || '/default-avatar.png'} 
                                                                alt={memberName}
                                                                onError={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = '/default-avatar.png';
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="member-info">
                                                            <div 
                                                                className={`member-name ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                            >
                                                                {member.user_id ? (
                                                                    <a href={`/profile/${member.user_id}`} className="member-profile-link">
                                                                        {formattedName.displayName}
                                                                    </a>
                                                                ) : (
                                                                    formattedName.displayName
                                                                )}
                                                            </div>
                                                            <div className="member-rating">
                                                                🎯 {ratingType === 'faceit' 
                                                                    ? `${member.faceit_elo || 1000} ELO`
                                                                    : `${member.cs2_premier_rank || member.premier_rank || 5} Premier`
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="no-members">
                                            🚫 Состав команды не определен
                                        </div>
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

        // 🆕 РАЗДЕЛЯЕМ УЧАСТНИКОВ НА ГРУППЫ
        const inTeamParticipants = displayParticipants.filter(p => p.in_team);
        const notInTeamParticipants = displayParticipants.filter(p => !p.in_team);

        return (
            <div className="original-participants-section">
                <h3>
                    🎮 Зарегистрированные игроки ({displayParticipants?.length || 0})
                    {getParticipantsStatusText()}
                </h3>
                
                {/* 🆕 УЧАСТНИКИ НЕ В КОМАНДЕ (если есть команды) */}
                {(mixedTeams.length > 0 || tournament.participant_type === 'team') && notInTeamParticipants.length > 0 && (
                    <div className="participants-group">
                        <h4 className="participants-group-title">
                            ⚠️ Не в команде ({notInTeamParticipants.length})
                        </h4>
                        <div className="participants-grid">
                            {notInTeamParticipants.map((participant) => (
                                <div key={participant?.id || `participant-${Math.random()}`} className="participant-card not-in-team">
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
                                        <span className="participant-status">Не в команде</span>
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
                    </div>
                )}

                {/* 🆕 УЧАСТНИКИ В КОМАНДАХ (если есть команды) */}
                {(mixedTeams.length > 0 || tournament.participant_type === 'team') && inTeamParticipants.length > 0 && (
                    <div className="participants-group">
                        <h4 className="participants-group-title">
                            ✅ В командах ({inTeamParticipants.length})
                        </h4>
                        <div className="participants-grid">
                            {inTeamParticipants.map((participant) => (
                                <div key={participant?.id || `participant-${Math.random()}`} className="participant-card in-team">
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
                                        <span className="participant-status">В команде</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 🆕 ВСЕ УЧАСТНИКИ ЕСЛИ НЕТ КОМАНД (изначальный режим) */}
                {mixedTeams.length === 0 && tournament.participant_type !== 'team' && (
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
                )}

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
                        
                            {/* 🆕 УЛУЧШЕННАЯ КНОПКА ПЕРЕФОРМИРОВАНИЯ */}
                            {canReformTeams() && (
                                <button 
                                    onClick={() => setShowReformModal(true)} 
                                    className="reform-teams-button"
                                    disabled={reformLoading || displayParticipants.length < 2}
                                >
                                    🔄 Переформировать команды
                                    {notInTeamParticipants.length > 0 && ` (включая ${notInTeamParticipants.length} новых)`}
                                </button>
                            )}
                        
                            {displayParticipants.length < 2 && (
                                <p className="min-participants-notice">
                                    ⚠️ Для создания команд нужно минимум 2 участника
                                </p>
                            )}
                        
                            {/* 🆕 ИНФОРМАЦИЯ О ВОЗМОЖНОСТИ ПЕРЕФОРМИРОВАНИЯ */}
                            {mixedTeams.length > 0 && !canReformTeams() && (
                                <div className="reform-blocked-notice">
                                    {tournament.status !== 'active' && (
                                        <p>⚠️ Переформирование доступно только для активных турниров</p>
                                    )}
                                    {tournament.matches && tournament.matches.length > 0 && (
                                        <p>🚫 Переформирование недоступно - турнирная сетка уже создана</p>
                                    )}
                                    {tournament.status === 'in_progress' && (
                                        <p>🚫 Переформирование недоступно - турнир уже начался</p>
                                    )}
                                </div>
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
            
            {/* 🆕 МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ПЕРЕФОРМИРОВАНИЯ */}
            {showReformModal && (
                <div className="modal-overlay">
                    <div className="modal-content reform-modal">
                        <div className="modal-header">
                            <h3>🔄 Подтверждение переформирования</h3>
                            <button 
                                className="close-btn"
                                onClick={() => setShowReformModal(false)}
                                disabled={reformLoading}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="warning-content">
                                <div className="warning-icon">⚠️</div>
                                <div className="warning-text">
                                    <h4>Вы уверены что хотите переформировать команды?</h4>
                                    <p className="warning-message">
                                        <strong>Это действие полностью пересоздаст все команды на основе текущих участников и их рейтинга.</strong>
                                    </p>
                                    <p className="warning-details">
                                        Что произойдет:
                                    </p>
                                    <ul className="warning-list">
                                        <li>Все существующие команды будут удалены</li>
                                        <li>Создадутся новые сбалансированные команды на основе рейтинга {ratingType === 'faceit' ? 'FACEIT' : 'CS2 Premier'}</li>
                                        <li>Участники могут попасть в совершенно другие команды</li>
                                        <li>Размер команд: {teamSize} игрок{teamSize === '1' ? '' : teamSize > '4' ? 'ов' : 'а'}</li>
                                        <li>Действие нельзя будет отменить</li>
                                    </ul>
                                    
                                    <div className="current-teams-info">
                                        <p><strong>Текущее состояние:</strong></p>
                                        <ul>
                                            <li>Всего участников: {displayParticipants.length}</li>
                                            <li>В командах: {displayParticipants.filter(p => p.in_team).length}</li>
                                            {displayParticipants.filter(p => !p.in_team).length > 0 && (
                                                <li className="new-participants-highlight">
                                                    🆕 Новых участников (не в команде): {displayParticipants.filter(p => !p.in_team).length}
                                                </li>
                                            )}
                                            <li>Существующих команд: {mixedTeams.length}</li>
                                            <li>Игроков в существующих командах: {mixedTeams.reduce((total, team) => total + (team.members?.length || 0), 0)}</li>
                                        </ul>
                                        
                                        {/* 🆕 ПОКАЗЫВАЕМ НОВЫХ УЧАСТНИКОВ ЕСЛИ ОНИ ЕСТЬ */}
                                        {displayParticipants.filter(p => !p.in_team).length > 0 && (
                                            <div className="new-participants-preview">
                                                <p><strong>🆕 Новые участники будут включены в команды:</strong></p>
                                                <ul className="new-participants-list">
                                                    {displayParticipants.filter(p => !p.in_team).slice(0, 5).map(participant => (
                                                        <li key={participant.id}>
                                                            {participant.name} 
                                                            <span className="participant-rating-preview">
                                                                ({ratingType === 'faceit' 
                                                                    ? `${participant.faceit_elo || 1000} ELO`
                                                                    : `${participant.cs2_premier_rank || participant.premier_rank || 5} Ранг`
                                                                })
                                                            </span>
                                                        </li>
                                                    ))}
                                                    {displayParticipants.filter(p => !p.in_team).length > 5 && (
                                                        <li>... и еще {displayParticipants.filter(p => !p.in_team).length - 5} участников</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                        
                                        {/* 🆕 ПРЕДВАРИТЕЛЬНАЯ ОЦЕНКА */}
                                        <div className="reform-preview">
                                            <p><strong>📊 После переформирования будет:</strong></p>
                                            <ul>
                                                <li>Команд: {Math.floor(displayParticipants.length / parseInt(teamSize))}</li>
                                                <li>Игроков в каждой команде: {teamSize}</li>
                                                <li>Общий охват: {Math.floor(displayParticipants.length / parseInt(teamSize)) * parseInt(teamSize)} из {displayParticipants.length} участников</li>
                                                {displayParticipants.length % parseInt(teamSize) !== 0 && (
                                                    <li className="warning-remainder">
                                                        ⚠️ Останется вне команд: {displayParticipants.length % parseInt(teamSize)} участников
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="modal-footer">
                            <button 
                                className="btn-cancel"
                                onClick={() => setShowReformModal(false)}
                                disabled={reformLoading}
                            >
                                ❌ Отмена
                            </button>
                            <button 
                                className="btn-confirm-reform"
                                onClick={handleReformTeams}
                                disabled={reformLoading}
                            >
                                {reformLoading ? '⏳ Переформирование...' : '🔄 Да, переформировать команды'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamGenerator; 