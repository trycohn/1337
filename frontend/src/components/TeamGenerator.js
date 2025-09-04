import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { ensureHttps } from '../utils/userHelpers';
import './TeamGenerator.css';
import TeamCard from './TeamCard';
import { useLoaderAutomatic } from '../hooks/useLoaderAutomaticHook';
import { connectWithAuth, joinTournament, on as socketOn, off as socketOff } from '../services/socket';

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
    toast,
    hideMixSettings = false,
    renderOnlySettings = false
}) => {
    // Убираем старые состояния для селекторов
    const [isFormingTeams, setIsFormingTeams] = useState(false);
    const [teams, setTeams] = useState([]);
    const [isRegenerating, setIsRegenerating] = useState(false);

    // 🆕 Получаем настройки из данных турнира
    const teamSize = tournament?.team_size || 5;
    const ratingType = tournament?.mix_rating_type || 'faceit';

    const { runWithLoader } = useLoaderAutomatic();

    const [loading, setLoading] = useState(false);
    const [mixedTeams, setMixedTeams] = useState([]);
    const [originalParticipants, setOriginalParticipants] = useState([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);

    // 🆕 СОСТОЯНИЯ ДЛЯ МОДАЛЬНОГО ОКНА ПЕРЕФОРМИРОВАНИЯ
    const [showReformModal, setShowReformModal] = useState(false);
    const [reformLoading, setReformLoading] = useState(false);
    // 🆕 СОСТОЯНИЕ ДЛЯ РАСКРЫТИЯ СПИСКА УЧАСТНИКОВ В МОДАЛЬНОМ ОКНЕ
    const [showAllNewParticipants, setShowAllNewParticipants] = useState(false);

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

    // 🎯 ФУНКЦИЯ ДЛЯ ОБРАБОТКИ ИМЕН УЧАСТНИКОВ КОМАНД (простая функция без useCallback)
    const formatMemberName = (memberName) => {
        if (!memberName) return { displayName: 'Неизвестный игрок', originalName: '', isLongName: false, isTruncated: false };
        
        const maxLength = 12;
        const isLongName = memberName.length > maxLength;
        const isTruncated = isLongName;
        
        return {
            displayName: isLongName ? `${memberName.substring(0, maxLength)}...` : memberName,
            originalName: memberName,
            isLongName,
            isTruncated
        };
    };

    // 🎯 УЛУЧШЕННАЯ ФУНКЦИЯ ДЛЯ РАСЧЕТА СРЕДНЕГО РЕЙТИНГА КОМАНДЫ
    const calculateTeamAverageRating = useCallback((team) => {
        if (!team?.members || team.members.length === 0) return 0;
        
        const ratings = team.members.map(member => {
            let rating;
            let isManualRating = false; // 🆕 Флаг ручного рейтинга
            
            if (ratingType === 'faceit') {
                // 🔧 ИСПРАВЛЕНО: Приоритизируем ручные рейтинги участников (как в backend)
                // ПРИОРИТЕТ: faceit_elo (ручной) -> user_faceit_elo (профиль) -> faceit_rating (резерв) -> 1000 (дефолт)
                if (member.faceit_elo && !isNaN(parseInt(member.faceit_elo)) && parseInt(member.faceit_elo) > 0) {
                    rating = parseInt(member.faceit_elo);
                    isManualRating = true; // 🆕 Ручной рейтинг
                } else if (member.user_faceit_elo && !isNaN(parseInt(member.user_faceit_elo)) && parseInt(member.user_faceit_elo) > 0) {
                    rating = parseInt(member.user_faceit_elo);
                } else if (member.faceit_rating && !isNaN(parseInt(member.faceit_rating)) && parseInt(member.faceit_rating) > 0) {
                    rating = parseInt(member.faceit_rating);
                } else if (member.user_faceit_rating && !isNaN(parseInt(member.user_faceit_rating)) && parseInt(member.user_faceit_rating) > 0) {
                    rating = parseInt(member.user_faceit_rating);
                } else {
                    rating = 1000; // дефолт для FACEIT
                }
            } else {
                // 🔧 ИСПРАВЛЕНО: Приоритизируем ручные рейтинги участников (как в backend)
                // ПРИОРИТЕТ: cs2_premier_rank (ручной) -> user_premier_rank (профиль) -> premier_rank (резерв) -> 5 (дефолт)
                if (member.cs2_premier_rank && !isNaN(parseInt(member.cs2_premier_rank)) && parseInt(member.cs2_premier_rank) > 0) {
                    rating = parseInt(member.cs2_premier_rank);
                    isManualRating = true; // 🆕 Ручной рейтинг
                } else if (member.user_premier_rank && !isNaN(parseInt(member.user_premier_rank)) && parseInt(member.user_premier_rank) > 0) {
                    rating = parseInt(member.user_premier_rank);
                } else if (member.premier_rank && !isNaN(parseInt(member.premier_rank)) && parseInt(member.premier_rank) > 0) {
                    rating = parseInt(member.premier_rank);
                } else if (member.premier_rating && !isNaN(parseInt(member.premier_rating)) && parseInt(member.premier_rating) > 0) {
                    rating = parseInt(member.premier_rating);
                } else if (member.user_premier_rating && !isNaN(parseInt(member.user_premier_rating)) && parseInt(member.user_premier_rating) > 0) {
                    rating = parseInt(member.user_premier_rating);
                } else {
                    rating = 5; // 🔧 ИСПРАВЛЕНО: дефолт 5, как в MixTeamService
                }
            }
            
            console.log(`📊 [calculateTeamAverageRating] Участник ${member.name}: рейтинг ${rating} (тип: ${ratingType}, ручной: ${isManualRating})`);
            return { rating, isManualRating };
        }).filter(item => !isNaN(item.rating) && item.rating > 0);
        
        if (ratings.length === 0) return ratingType === 'faceit' ? 1000 : 5; // 🔧 ИСПРАВЛЕНО: дефолт для Premier = 5
        
        const average = ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length;
        const manualRatingsCount = ratings.filter(item => item.isManualRating).length;
        
        console.log(`📊 [calculateTeamAverageRating] Команда ${team.name}: рейтинги [${ratings.map(r => r.rating).join(', ')}], средний = ${Math.round(average)}, ручных: ${manualRatingsCount}/${ratings.length}`);
        return Math.round(average);
    }, [ratingType]);

    // 🆕 ФУНКЦИЯ ОПРЕДЕЛЕНИЯ РЕЙТИНГА УЧАСТНИКА С УКАЗАНИЕМ ИСТОЧНИКА
    const getParticipantRatingInfo = useCallback((participant) => {
        let rating;
        let isManualRating = false;
        let source = '';
        
        if (ratingType === 'faceit') {
            // 🔧 ИСПРАВЛЕНО: используем ту же логику что в backend
            if (participant.faceit_elo && !isNaN(parseInt(participant.faceit_elo)) && parseInt(participant.faceit_elo) > 0) {
                rating = parseInt(participant.faceit_elo);
                isManualRating = true;
                source = 'ручной';
            } else if (participant.user_faceit_elo && !isNaN(parseInt(participant.user_faceit_elo)) && parseInt(participant.user_faceit_elo) > 0) {
                rating = parseInt(participant.user_faceit_elo);
                source = 'профиль';
            } else if (participant.faceit_rating && !isNaN(parseInt(participant.faceit_rating)) && parseInt(participant.faceit_rating) > 0) {
                rating = parseInt(participant.faceit_rating);
                source = 'резерв';
            } else if (participant.user_faceit_rating && !isNaN(parseInt(participant.user_faceit_rating)) && parseInt(participant.user_faceit_rating) > 0) {
                rating = parseInt(participant.user_faceit_rating);
                source = 'резерв';
            } else {
                rating = 1000;
                source = 'дефолт';
            }
        } else {
            // 🔧 ИСПРАВЛЕНО: используем ту же логику что в backend
            if (participant.cs2_premier_rank && !isNaN(parseInt(participant.cs2_premier_rank)) && parseInt(participant.cs2_premier_rank) > 0) {
                rating = parseInt(participant.cs2_premier_rank);
                isManualRating = true;
                source = 'ручной';
            } else if (participant.user_premier_rank && !isNaN(parseInt(participant.user_premier_rank)) && parseInt(participant.user_premier_rank) > 0) {
                rating = parseInt(participant.user_premier_rank);
                source = 'профиль';
            } else if (participant.premier_rank && !isNaN(parseInt(participant.premier_rank)) && parseInt(participant.premier_rank) > 0) {
                rating = parseInt(participant.premier_rank);
                source = 'резерв';
            } else if (participant.premier_rating && !isNaN(parseInt(participant.premier_rating)) && parseInt(participant.premier_rating) > 0) {
                rating = parseInt(participant.premier_rating);
                source = 'резерв';
            } else if (participant.user_premier_rating && !isNaN(parseInt(participant.user_premier_rating)) && parseInt(participant.user_premier_rating) > 0) {
                rating = parseInt(participant.user_premier_rating);
                source = 'резерв';
            } else {
                rating = 5;
                source = 'дефолт';
            }
        }
        
        return { rating, isManualRating, source };
    }, [ratingType]);

    // 🆕 ФУНКЦИЯ ОПРЕДЕЛЕНИЯ УЧАСТНИКА С НАИЛУЧШИМ РЕЙТИНГОМ (ЛОГИКА КАПИТАНА)

    // 🆕 ЭФФЕКТ ДЛЯ СОХРАНЕНИЯ ratingType В localStorage
    useEffect(() => {
        if (tournament?.id && ratingType) {
            localStorage.setItem(`tournament_${tournament.id}_ratingType`, ratingType);
            console.log(`💾 Сохранен ratingType в localStorage: ${ratingType} для турнира ${tournament.id}`);
        }
    }, [tournament?.id, ratingType]);

    // 🎯 ОПРЕДЕЛЯЕМ displayParticipants ЗДЕСЬ, чтобы избежать "used before defined"
    const displayParticipants = originalParticipants.length > 0 ? originalParticipants : participants || [];

    // 🆕 ФУНКЦИЯ ПРОВЕРКИ ВОЗМОЖНОСТИ ПЕРЕФОРМИРОВАНИЯ
    const canReformTeams = useCallback(() => {
        // 🆕 Проверяем что пользователь админ или создатель
        if (!isAdminOrCreator) return false;
        
        // 🆕 Проверяем статус турнира - только active
        if (tournament?.status !== 'active') return false;
        
        // 🆕 Проверяем что есть команды для переформирования
        if (mixedTeams.length === 0) return false;
        
        // 🆕 Проверяем что есть достаточно участников
        if (displayParticipants.length < parseInt(teamSize)) return false;
        
        // 🆕 ИСПРАВЛЕНИЕ: разрешаем переформирование даже если есть сетка
        // Сетка будет автоматически удалена при переформировании
        // if (tournament?.matches && tournament.matches.length > 0) return false;
        
        return true;
    }, [isAdminOrCreator, tournament?.status, mixedTeams.length, displayParticipants.length, teamSize]);

    // 🆕 ФУНКЦИЯ ПОЛУЧЕНИЯ ТЕКСТА О СОСТОЯНИИ УЧАСТНИКОВ
    const getParticipantsStatusText = useCallback(() => {
        // 🎯 ЛОГИКА ОТОБРАЖЕНИЯ УЧАСТНИКОВ И КОМАНД
        // Участники ВСЕГДА отображаются если доступны
        const displayParticipants = originalParticipants.length > 0 ? originalParticipants : participants || [];
        
        if (!displayParticipants.length) return '';
        
        const inTeam = displayParticipants.filter(p => p.in_team);
        const notInTeam = displayParticipants.filter(p => !p.in_team);
        
        if (notInTeam.length > 0) {
            return ` (${inTeam.length} в командах, ${notInTeam.length} не в команде)`;
        }
        
        return ` (${inTeam.length} в командах)`;
    }, [originalParticipants, participants]);

    // 🆕 СОСТОЯНИЕ ДЛЯ ОТСЛЕЖИВАНИЯ ПРОЦЕССА ПЕРЕФОРМИРОВАНИЯ
    const [isReforming, setIsReforming] = useState(false);

    // 🎯 УЛУЧШЕННАЯ ЛОГИКА УСТАНОВКИ КОМАНД ИЗ ТУРНИРА
    useEffect(() => {
        // 🎯 Не нужно устанавливать teamSize и ratingType, они берутся из турнира
        
        // 🎯 ИСПРАВЛЕНИЕ: Устанавливаем команды из турнира ТОЛЬКО если:
        // 1. Команды есть в турнире
        // 2. Локальные команды пустые
        // 3. НЕ идет процесс переформирования (иначе перезатрем новые команды)
        if (tournament && 
            tournament.teams && 
            tournament.teams.length > 0 && 
            mixedTeams.length === 0 && 
            !isReforming) {
            
            console.log('🔄 Устанавливаем существующие команды из турнира (предотвращение перезаписи при переформировании)');
            
            // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ (простая функция без зависимостей)
            const enrichedTeams = tournament.teams.map(team => ({
                ...team,
                averageRating: team.averageRating || (() => {
                    if (!team.members || team.members.length === 0) return 0;
                    
                    const ratings = team.members.map(member => {
                        if (ratingType === 'faceit') {
                            return parseInt(member.faceit_elo) || 1000;
                        } else {
                            return parseInt(member.cs2_premier_rank || member.premier_rank) || 5;
                        }
                    }).filter(rating => rating > 0);
                    
                    if (ratings.length === 0) return 0;
                    
                    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
                    return Math.round(average);
                })()
            }));
            
            setMixedTeams(enrichedTeams);
            
            console.log('✅ Команды установлены без вызова onTeamsGenerated (предотвращение цикла)');
        }
    }, [tournament?.id, tournament?.teams, mixedTeams.length, ratingType, isReforming]); // 🔧 ДОБАВЛЯЕМ НЕДОСТАЮЩИЕ ЗАВИСИМОСТИ

    // Функция для загрузки команд турнира
    const fetchTeams = useCallback(async () => {
        if (!tournament?.id) return;
        
        try {
            const response = await api.get(`/api/tournaments/${tournament.id}/teams`);
            if (response.data && Array.isArray(response.data)) {
                console.log('Загруженные команды турнира:', response.data);
                
                // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ БЕЗ ЗАВИСИМОСТИ ОТ calculateTeamAverageRating
                const enrichedTeams = response.data.map(team => ({
                    ...team,
                    averageRating: team.averageRating || (() => {
                        if (!team.members || team.members.length === 0) return 0;
                        
                        const ratings = team.members.map(member => {
                            if (ratingType === 'faceit') {
                                // 🔧 ИСПРАВЛЕНО: используем ту же логику что в calculateTeamAverageRating
                                if (member.faceit_elo && !isNaN(parseInt(member.faceit_elo)) && parseInt(member.faceit_elo) > 0) {
                                    return parseInt(member.faceit_elo);
                                } else if (member.user_faceit_elo && !isNaN(parseInt(member.user_faceit_elo)) && parseInt(member.user_faceit_elo) > 0) {
                                    return parseInt(member.user_faceit_elo);
                                } else if (member.faceit_rating && !isNaN(parseInt(member.faceit_rating)) && parseInt(member.faceit_rating) > 0) {
                                    return parseInt(member.faceit_rating);
                                } else if (member.user_faceit_rating && !isNaN(parseInt(member.user_faceit_rating)) && parseInt(member.user_faceit_rating) > 0) {
                                    return parseInt(member.user_faceit_rating);
                                } else {
                                    return 1000;
                                }
                            } else {
                                // 🔧 ИСПРАВЛЕНО: используем ту же логику для Premier
                                if (member.cs2_premier_rank && !isNaN(parseInt(member.cs2_premier_rank)) && parseInt(member.cs2_premier_rank) > 0) {
                                    return parseInt(member.cs2_premier_rank);
                                } else if (member.user_premier_rank && !isNaN(parseInt(member.user_premier_rank)) && parseInt(member.user_premier_rank) > 0) {
                                    return parseInt(member.user_premier_rank);
                                } else if (member.premier_rank && !isNaN(parseInt(member.premier_rank)) && parseInt(member.premier_rank) > 0) {
                                    return parseInt(member.premier_rank);
                                } else if (member.premier_rating && !isNaN(parseInt(member.premier_rating)) && parseInt(member.premier_rating) > 0) {
                                    return parseInt(member.premier_rating);
                                } else if (member.user_premier_rating && !isNaN(parseInt(member.user_premier_rating)) && parseInt(member.user_premier_rating) > 0) {
                                    return parseInt(member.user_premier_rating);
                                } else {
                                    return 1;
                                }
                            }
                        }).filter(rating => rating > 0);
                        
                        if (ratings.length === 0) return 0;
                        
                        const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
                        console.log(`📊 [fetchTeams] Команда ${team.name}: рейтинги [${ratings.join(', ')}], средний = ${Math.round(average)}`);
                        return Math.round(average);
                    })()
                }));
                
                setMixedTeams(enrichedTeams);
                
                // 🎯 НЕ ВЫЗЫВАЕМ onTeamsGenerated для предотвращения циклов
                console.log('fetchTeams: команды обновлены без вызова onTeamsGenerated (предотвращение цикла)');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки команд:', error);
        }
    }, [tournament?.id, ratingType]); // 🔧 УБИРАЕМ calculateTeamAverageRating ИЗ ЗАВИСИМОСТЕЙ

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
        } finally {
            setLoadingParticipants(false);
        }
    }, [tournament?.id, shouldMakeRequest]);

    // 🔧 ОТДЕЛЬНЫЙ ЭФФЕКТ ДЛЯ ЗАГРУЗКИ КОМАНД
    useEffect(() => {
        if (tournament?.id && (!tournament?.teams || tournament.teams.length === 0)) {
            fetchTeams();
        }
    }, [fetchTeams, tournament?.id, tournament?.teams]); // 🔧 УПРОЩАЕМ ЗАВИСИМОСТИ

    // 🧩 РЕАЛТАЙМ-ОБНОВЛЕНИЕ СТАТУСОВ КОМАНД ПО СОБЫТИЯМ SOCKET.IO
    useEffect(() => {
        if (!tournament?.id) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        connectWithAuth(token);

        const handleConnect = () => {
            try {
                joinTournament(tournament.id);
            } catch (e) {
                console.warn('⚠️ joinTournament error:', e);
            }
        };

        const handleTournamentEvent = (payload) => {
            try {
                const tid = parseInt(tournament.id);
                const incomingId = parseInt(payload?.tournamentId || payload?.id);
                if (!incomingId || incomingId !== tid) return;

                const updateType = payload?._metadata?.updateType;
                if (updateType === 'matches_update' || updateType === 'teams_update' || payload?.matches || payload?.teams || payload?.mixed_teams) {
                    // Перезагружаем команды для актуализации статусов (вылет/победа)
                    fetchTeams();
                }
            } catch (e) {
                console.warn('⚠️ handleTournamentEvent error:', e);
            }
        };

        socketOn('connect', handleConnect);
        socketOn('tournament_update', handleTournamentEvent);
        socketOn('tournament_updated', handleTournamentEvent);

        return () => {
            socketOff('connect', handleConnect);
            socketOff('tournament_update', handleTournamentEvent);
            socketOff('tournament_updated', handleTournamentEvent);
        };
    }, [tournament?.id, fetchTeams]);

    // ⏱️ РЕЗЕРВНЫЙ ПОЛЛИНГ ДЛЯ АКТИВНЫХ ТУРНИРОВ
    useEffect(() => {
        const status = (tournament?.status || '').toString().trim().toLowerCase();
        if (!(status === 'in_progress' || status === 'active')) return;
        if (!tournament?.id) return;

        const intervalId = setInterval(() => {
            try {
                if (typeof document !== 'undefined' && document.hidden) return;
                fetchTeams();
            } catch (e) {
                console.warn('⚠️ polling fetchTeams error:', e);
            }
        }, 15000);

        return () => clearInterval(intervalId);
    }, [tournament?.id, tournament?.status, fetchTeams]);

    // 🔧 ОТДЕЛЬНЫЙ ЭФФЕКТ ДЛЯ ЗАГРУЗКИ УЧАСТНИКОВ
    useEffect(() => {
        if (tournament?.id && tournament.participant_type === 'team' && tournament.format === 'mix' && originalParticipants.length === 0) {
            fetchOriginalParticipants();
        }
    }, [fetchOriginalParticipants, tournament?.id, tournament?.participant_type, tournament?.format, originalParticipants.length]); // 🔧 УБИРАЕМ calculateTeamAverageRating ИЗ ЗАВИСИМОСТЕЙ

    // Функция для обновления размера команды на сервере
    const updateTeamSize = useCallback(async (newSize) => {
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
    }, [tournament, isAdminOrCreator, toast, onTeamsUpdated]); // 🔧 ДОБАВЛЯЕМ НЕДОСТАЮЩИЕ ЗАВИСИМОСТИ

    // Функция для формирования команд
    const handleFormTeams = async () => {
        // 🔧 ИСПРАВЛЕНО: проверяем минимум teamSize участников для создания 1 команды
        const minRequiredParticipants = parseInt(teamSize) || 5;
        if (!tournament?.id || displayParticipants.length < minRequiredParticipants) {
            console.warn(`Недостаточно участников для формирования команд. Нужно минимум ${minRequiredParticipants}, а есть ${displayParticipants.length}`);
            if (toast) {
                toast.warning(`Недостаточно участников для формирования команд. Нужно минимум ${minRequiredParticipants} для создания команды из ${teamSize} игроков.`);
            }
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

    // Команды из турнира или из локального состояния
    const teamsExist = tournament?.teams && tournament.teams.length > 0;
    const teamsList = teamsExist ? tournament.teams : mixedTeams;
    
    // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Мемоизируем обогащенные команды для предотвращения бесконечного рендера
    const teamsToShow = useMemo(() => {
        if (!teamsList || teamsList.length === 0) return [];
        
        return teamsList.map(team => ({
            ...team,
            averageRating: team.averageRating || calculateTeamAverageRating(team)
        }));
    }, [teamsList, calculateTeamAverageRating]);
    
    // Функция рендеринга команд (для микс турниров)
    const renderTeamsList = () => {
        // Если команды есть, отображаем их
        if (teamsToShow.length > 0) {
            const getTeamStatus = (team) => {
                const rawStatus = (team?.status || '').toString().trim().toLowerCase();
                const isWinner = team?.is_winner || team?.winner || rawStatus === 'winner';
                const isEliminated = team?.is_eliminated || team?.eliminated || rawStatus === 'eliminated' || rawStatus === 'out';
                if (isWinner) return { text: 'Победитель', cls: 'winner' };
                if (isEliminated) return { text: 'Выбыла', cls: 'eliminated' };
                return { text: 'Участвует', cls: 'active' };
            };

            return (
                <div className="teams-display-participants2.0">
                    <div className="teams-section-header-participants2.0">
                        <div className="teams-header-row-participants2.0">
                            <div className="teams-header-col-participants2.0 teams-header-col--left-participants2.0">
                                <strong>Сформированные команды: {teamsToShow.length}</strong>
                            </div>
                            <div className="teams-header-col-participants2.0 teams-header-col--right-participants2.0">
                                <strong>Статус</strong>
                            </div>
                        </div>
                    </div>

                    <div className="teams-list-participants2.0">
                        {teamsToShow.map((team, index) => {
                            const status = getTeamStatus(team);
                            return (
                                <div key={team.id || index} className={`team-row-participants2.0 ${status.cls}`}>
                                    <div className="team-row-left-participants2.0">
                                        <div className="team-avatar-participants2.0">
                                            <img
                                                src={ensureHttps(team.logo_url || team.avatar_url) || '/default-avatar.png'}
                                                alt={`${team.name || `Команда ${index + 1}`} logo`}
                                                onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.png'; }}
                                            />
                                        </div>
                                        <div className="team-main-participants2.0">
                                            <span className="team-name-participants2.0">{team.name || `Команда ${index + 1}`}</span>
                                            <span className="team-rating-participants2.0">
                                                {ratingType === 'faceit' ? 'FACEIT: ' : 'Premier: '}
                                                {team.averageRating || '—'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="team-row-right-participants2.0">
                                        <span className="team-status-participants2.0">{status.text}</span>
                                    </div>
                                </div>
                            );
                        })}
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

    // Выделяем отрисовку секции настроек микса в отдельную функцию
    function renderMixSettingsSection() {
        if (!isAdminOrCreator) return null;
        const statusNormalized = (tournament?.status || '').toString().trim().toLowerCase();
        if (statusNormalized !== 'active') return null;
        return (
            <div className="mix-settings-section">
                <h3>⚙️ Настройки микса</h3>
                {/* 🆕 ОТОБРАЖАЕМ НАСТРОЙКИ ТУРНИРА (только для информации) */}
                <div className="tournament-settings-info">
                    <div className="setting-info-item">
                        <label>Размер команды:</label>
                        <span className="setting-value">{teamSize} игрок{teamSize == 1 ? '' : teamSize > 4 ? 'ов' : 'а'}</span>
                    </div>
                    <div className="setting-info-item">
                        <label>Тип рейтинга:</label>
                        <span className="setting-value">
                            {ratingType === 'faceit' && 'FACEIT ELO'}
                            {ratingType === 'premier' && 'CS2 Premier Rank'}
                            {ratingType === 'mixed' && 'Полный микс (без учета рейтинга)'}
                        </span>
                    </div>

                    {/* 🆕 ИНФОРМАЦИЯ О ЛОГИКЕ СОЗДАНИЯ КОМАНД */}
                    <div className="setting-note" style={{ 
                        marginTop: '15px' 
                    }}>
                        <strong>ℹ️ Как формируются команды:</strong>
                        <ul style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '20px' }}>
                            <li>Создается максимальное количество полных команд из {teamSize} игроков</li>
                            <li>Участники, не попавшие в команды, остаются доступными</li>
                            <li>При добавлении новых участников можно переформировать команды</li>
                            <li>Минимум участников для создания команд: {teamSize}</li>
                        </ul>
                    </div>

                    <div className="setting-note">
                        💡 Настройки формирования команд были заданы при создании турнира
                    </div>
                </div>

                <div className="mix-buttons-row">
                    {/* 🔧 ИСПРАВЛЕНИЕ: Для микс турниров показываем кнопку формирования если нет команд, независимо от participant_type */}
                    {tournament?.format === 'mix' && mixedTeams.length === 0 && (
                        <button 
                            onClick={handleFormTeams} 
                            className="btn btn-primary"
                            disabled={loading || displayParticipants.length < parseInt(teamSize)}
                        >
                            {loading ? '⏳ Создание команд...' : 'Сформировать команды'}
                        </button>
                    )}

                    {/* 🆕 УЛУЧШЕННАЯ КНОПКА ПЕРЕФОРМИРОВАНИЯ */}
                    {canReformTeams() && (
                        <button 
                            onClick={() => setShowReformModal(true)} 
                            className="btn btn-secondary"
                            disabled={reformLoading || displayParticipants.length < parseInt(teamSize)}
                        >
                            Переформировать команды
                        </button>
                    )}
                </div>

                {/* Единое сообщение о минимуме участников — отдельный блок под кнопками */}
                {displayParticipants.length < parseInt(teamSize) && (
                    <div className="mix-info-row">
                        <p className="min-participants-notice">
                            ⚠️ Для создания команд из {teamSize} игроков нужно минимум {teamSize} участников
                        </p>
                    </div>
                )}

                {/* 🆕 ИНФОРМАЦИЯ О ВОЗМОЖНОСТИ ПЕРЕФОРМИРОВАНИЯ */}
                {mixedTeams.length > 0 && !canReformTeams() && (
                    <div className="reform-blocked-notice">
                        {tournament.status !== 'active' && (
                            <p>⚠️ Переформирование доступно только для активных турниров</p>
                        )}
                        {tournament.status === 'in_progress' && (
                            <p>🚫 Переформирование недоступно - турнир уже начался</p>
                        )}
                        {displayParticipants.length < parseInt(teamSize) && (
                            <p>⚠️ Недостаточно участников для переформирования (нужно минимум {teamSize})</p>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (renderOnlySettings) {
        return (
            <div className="team-generator">
                {renderMixSettingsSection()}
                {showReformModal && (
                    <div className="modal-overlay">
                        <div className="modal-content reform-modal">
                            {/* тело модалки оставляем без изменений */}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Функция рендеринга списка участников
    const renderParticipantsList = () => {
        if (tournament?.format !== 'mix') return null;

        // Единый список участников и сортировка: сначала без команды, затем в команде, далее по имени
        const participants = Array.isArray(displayParticipants) ? displayParticipants : [];
        const sortedParticipants = [...participants].sort((a, b) => {
            if (!!a.in_team === !!b.in_team) return (a.name || '').localeCompare(b.name || '');
            return a.in_team ? 1 : -1;
        });

        return (
            <div className="original-participants-section-participants2.0">
                <div className="original-participants-section-header-participants2.0">
                    <div className="participants-header-row-participants2.0">
                        <div className="participants-header-col-participants2.0 participants-header-col--left-participants2.0">
                            <strong>Участники: {participants.length}</strong>
                        </div>
                        <div className="participants-header-col-participants2.0 participants-header-col--right-participants2.0">
                            <strong>Статус</strong>
                        </div>
                    </div>
                </div>

                {loadingParticipants ? (
                    <p className="loading-participants-participants2.0">Загрузка участников...</p>
                ) : participants.length === 0 ? (
                    <p className="no-participants-participants2.0">Нет зарегистрированных игроков</p>
                ) : (
                    <div className="participants-list-participants2.0">
                        {sortedParticipants.map((participant) => {
                            const ratingInfo = getParticipantRatingInfo(participant);
                            const hasRating = ratingInfo && ratingInfo.rating !== undefined && ratingInfo.rating !== null && `${ratingInfo.rating}` !== '';
                            return (
                                <div key={participant?.id || `participant-${Math.random()}`} className={`participant-row-participants2.0${participant.in_team ? ' in-team' : ' not-in-team'}`}>
                                    <div className="participant-row-left-participants2.0">
                                        <div className="participant-avatar-participants2.0">
                                            <img
                                                src={ensureHttps(participant.avatar_url) || '/default-avatar.png'}
                                                alt={`${participant.name} avatar`}
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = '/default-avatar.png';
                                                }}
                                            />
                                        </div>
                                        <div className="participant-main-participants2.0">
                                            <span className="participant-name-participants2.0">{participant.name}</span>
                                            {hasRating && (
                                                <span className="participant-rating-participants2.0" title={`Источник: ${ratingInfo.source}${ratingInfo.isManualRating ? ' (добавлен вручную)' : ''}`}>
                                                    {ratingType === 'faceit' ? `FACEIT: ${ratingInfo.rating}` : `Premier: ${ratingInfo.rating}`}
                                                    {ratingInfo.isManualRating && (
                                                        <span className="manual-rating-indicator" title="Рейтинг добавлен вручную"> ✏️</span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="participant-row-right-participants2.0">
                                        <span className="participant-status-participants2.0">{participant.in_team ? 'В команде' : 'Не в команде'}</span>
                                    </div>
                                    {isAdminOrCreator && tournament.participant_type === 'solo' && (
                                        <button className="remove-participant-participants2.0" onClick={() => onRemoveParticipant(participant.id)}>✕</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Секция настроек микса рендерится только один раз снизу через renderMixSettingsSection() */}
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

    // 🔧 ФУНКЦИЯ ПЕРЕФОРМИРОВАНИЯ КОМАНД
    const handleReformTeams = async () => {
        // 🆕 ПРОВЕРКА СТАТУСА ТУРНИРА ПЕРЕД ПЕРЕФОРМИРОВАНИЕМ
        if (tournament.status !== 'active') {
            if (toast) {
                toast.error('Переформирование команд доступно только для активных турниров');
            }
            setShowReformModal(false);
            return;
        }

        if (tournament.status === 'in_progress') {
            if (toast) {
                toast.error('Переформирование команд недоступно - турнир уже начался');
            }
            setShowReformModal(false);
            return;
        }

        // Устанавливаем флаг переформирования для предотвращения перезаписи
        setIsReforming(true);
        setReformLoading(true);
        
        try {
            const teamSizeNumber = parseInt(teamSize);
            
            console.log('🔄 Переформируем команды:', {
                teamSize: teamSizeNumber,
                participantsCount: displayParticipants.length,
                ratingType,
                tournamentId: tournament.id
            });

            // 🆕 ИСПОЛЬЗУЕМ ПРАВИЛЬНЫЙ ENDPOINT ДЛЯ ПЕРЕФОРМИРОВАНИЯ
            const response = await api.post(`/api/tournaments/${tournament.id}/mix-regenerate-teams`, {
                ratingType: ratingType,
                shuffle: true  // 🆕 Всегда перемешиваем при переформировании
            });

            if (response.data && response.data.teams) {
                console.log('✅ Команды успешно переформированы:', response.data.teams);
                console.log('📊 Сводка переформирования:', response.data.summary);
                
                // 🎯 ОБОГАЩАЕМ КОМАНДЫ СРЕДНИМ РЕЙТИНГОМ
                const enrichedTeams = response.data.teams.map(team => ({
                    ...team,
                    averageRating: calculateTeamAverageRating(team)
                }));
                
                // 🎯 ОБНОВЛЯЕМ КОМАНДЫ В СОСТОЯНИИ
                setMixedTeams(enrichedTeams);
                
                // 🎯 УВЕДОМЛЯЕМ РОДИТЕЛЬСКИЙ КОМПОНЕНТ О ПЕРЕФОРМИРОВАННЫХ КОМАНДАХ
                if (onTeamsGenerated) {
                    console.log('✅ Уведомляем родительский компонент о переформированных командах');
                    onTeamsGenerated(enrichedTeams);
                }
                
                // 🆕 ПОКАЗЫВАЕМ СООБЩЕНИЕ О РЕЗУЛЬТАТЕ ПЕРЕФОРМИРОВАНИЯ
                if (toast) {
                    if (response.data.bracketDeleted) {
                        toast.success(`${response.data.message} Для продолжения турнира необходимо заново сгенерировать турнирную сетку.`);
                    } else {
                        toast.success(response.data.message || 'Команды успешно переформированы');
                    }
                }
                
                console.log('✅ Команды успешно переформированы с учетом рейтингов');
                setShowReformModal(false);
                setShowAllNewParticipants(false); // Сброс состояния раскрытия списка
            } else {
                console.error('❌ Некорректный ответ сервера при переформировании команд');
                if (toast) {
                    toast.error('Некорректный ответ сервера при переформировании команд');
                }
            }
        } catch (error) {
            console.error('❌ Ошибка при переформировании команд:', error);
            
            // При ошибке также показываем подробности
            const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Ошибка при переформировании команд';
            
            if (toast) {
                toast.error(errorMessage);
            }
            
            console.error('Сообщение об ошибке:', errorMessage);
            
            // Если произошла ошибка, не закрываем модальное окно
            // чтобы пользователь мог попробовать снова
        } finally {
            // Снимаем флаг переформирования в любом случае
            setIsReforming(false);
            setReformLoading(false);
        }
    };

    return (
        <div className="team-generator">
            {/* Новый общий грид: слева участники, справа команды */}
            <div className="mix-grid">
                <div className="mix-grid-left">
                    {renderParticipantsList()}
                </div>
                <div className="mix-grid-right">
                    {renderTeamsList()}
                </div>
            </div>

            {/* Блок настроек микса перемещен в самый низ */}
            {isAdminOrCreator && !hideMixSettings && renderMixSettingsSection()}

            {/* 🆕 МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ПЕРЕФОРМИРОВАНИЯ */}
            {showReformModal && (
                <div className="modal-overlay">
                    <div className="modal-content reform-modal">
                        <div className="modal-header">
                            <h3>🔄 Подтверждение переформирования</h3>
                            <button 
                                className="close-btn"
                                onClick={() => {
                                    setShowReformModal(false);
                                    setShowAllNewParticipants(false); // Сброс состояния раскрытия списка
                                }}
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
                                        {tournament?.matches && tournament.matches.length > 0 && (
                                            <li className="warning-remainder">⚠️ Турнирная сетка будет полностью удалена и потребует повторной генерации</li>
                                        )}
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
                                                    {(showAllNewParticipants 
                                                        ? displayParticipants.filter(p => !p.in_team)
                                                        : displayParticipants.filter(p => !p.in_team).slice(0, 5)
                                                    ).map(participant => (
                                                        <li key={participant.id}>
                                                            {participant.name} 
                                                            <span className="participant-rating-preview">
                                                                ({ratingType === 'faceit' 
                                                                    ? `${(() => {
                                                                        // 🔧 ИСПРАВЛЕНО: используем консистентную логику расчета рейтинга
                                                                        if (participant.faceit_elo && !isNaN(parseInt(participant.faceit_elo)) && parseInt(participant.faceit_elo) > 0) {
                                                                            return parseInt(participant.faceit_elo);
                                                                        } else if (participant.user_faceit_elo && !isNaN(parseInt(participant.user_faceit_elo)) && parseInt(participant.user_faceit_elo) > 0) {
                                                                            return parseInt(participant.user_faceit_elo);
                                                                        } else if (participant.faceit_rating && !isNaN(parseInt(participant.faceit_rating)) && parseInt(participant.faceit_rating) > 0) {
                                                                            return parseInt(participant.faceit_rating);
                                                                        } else if (participant.user_faceit_rating && !isNaN(parseInt(participant.user_faceit_rating)) && parseInt(participant.user_faceit_rating) > 0) {
                                                                            return parseInt(participant.user_faceit_rating);
                                                                        } else {
                                                                            return 1000;
                                                                        }
                                                                    })()} ELO`
                                                                    : `${(() => {
                                                                        // 🔧 ИСПРАВЛЕНО: используем консистентную логику расчета рейтинга
                                                                        if (participant.cs2_premier_rank && !isNaN(parseInt(participant.cs2_premier_rank)) && parseInt(participant.cs2_premier_rank) > 0) {
                                                                            return parseInt(participant.cs2_premier_rank);
                                                                        } else if (participant.user_premier_rank && !isNaN(parseInt(participant.user_premier_rank)) && parseInt(participant.user_premier_rank) > 0) {
                                                                            return parseInt(participant.user_premier_rank);
                                                                        } else if (participant.premier_rank && !isNaN(parseInt(participant.premier_rank)) && parseInt(participant.premier_rank) > 0) {
                                                                            return parseInt(participant.premier_rank);
                                                                        } else if (participant.premier_rating && !isNaN(parseInt(participant.premier_rating)) && parseInt(participant.premier_rating) > 0) {
                                                                            return parseInt(participant.premier_rating);
                                                                        } else if (participant.user_premier_rating && !isNaN(parseInt(participant.user_premier_rating)) && parseInt(participant.user_premier_rating) > 0) {
                                                                            return parseInt(participant.user_premier_rating);
                                                                        } else {
                                                                            return 1;
                                                                        }
                                                                    })()} Ранг`})
                                                            </span>
                                                        </li>
                                                    ))}
                                                    {displayParticipants.filter(p => !p.in_team).length > 5 && !showAllNewParticipants && (
                                                        <li 
                                                            className="show-more-participants"
                                                            onClick={() => setShowAllNewParticipants(true)}
                                                            style={{ 
                                                                cursor: 'pointer', 
                                                                color: '#007bff', 
                                                                textDecoration: 'underline',
                                                                fontWeight: 'bold'
                                                            }}
                                                            title="Нажмите чтобы показать всех участников"
                                                        >
                                                            ... и еще {displayParticipants.filter(p => !p.in_team).length - 5} участников (нажмите чтобы раскрыть)
                                                        </li>
                                                    )}
                                                    {showAllNewParticipants && displayParticipants.filter(p => !p.in_team).length > 5 && (
                                                        <li 
                                                            className="show-less-participants"
                                                            onClick={() => setShowAllNewParticipants(false)}
                                                            style={{ 
                                                                cursor: 'pointer', 
                                                                color: '#6c757d', 
                                                                textDecoration: 'underline',
                                                                fontWeight: 'bold',
                                                                marginTop: '5px'
                                                            }}
                                                            title="Нажмите чтобы свернуть список"
                                                        >
                                                            ↑ Свернуть список участников
                                                        </li>
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
                                onClick={() => {
                                    setShowReformModal(false);
                                    setShowAllNewParticipants(false); // Сброс состояния раскрытия списка
                                }}
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