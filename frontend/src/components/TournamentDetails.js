/**
 * TournamentDetails v4.2.0 - Синергия вариантов 1+3
 * 
 * @version 4.2.0 (Синергия AdminPanel + FloatingPanel)
 * @created 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Комбинация детального управления и быстрого доступа
 * @features AdminPanel (вкладка) + FloatingActionPanel (всегда видимая)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import './TournamentDetails.css';
import TeamGenerator from './TeamGenerator';
import BracketRenderer from './BracketRenderer';
import { ensureHttps } from '../utils/userHelpers';
import { useAuth } from '../context/AuthContext';

// 🔧 ИСПРАВЛЕНО: Используем наш новый Socket.IO клиент вместо прямого импорта
import { useSocket } from '../hooks/useSocket';

// Новые компоненты и хуки
import TournamentAdminPanel from './tournament/TournamentAdminPanel';
import TournamentFloatingActionPanel from './tournament/TournamentFloatingActionPanel';
import UnifiedParticipantsPanel from './tournament/UnifiedParticipantsPanel';
import AddParticipantModal from './tournament/modals/AddParticipantModal';
import ParticipantSearchModal from './tournament/modals/ParticipantSearchModal';
import MatchResultModal from './tournament/modals/MatchResultModal';
import MatchDetailsModal from './tournament/modals/MatchDetailsModal';  // 🔧 ДОБАВЛЕНО: Новое модальное окно просмотра
import TournamentChat from './TournamentChat';  // 🔧 ДОБАВЛЕНО: Чат турнира
import useTournamentManagement from '../hooks/tournament/useTournamentManagement';
import useTournamentModals from '../hooks/tournament/useTournamentModals';

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
    const { user } = useAuth(); // Получаем пользователя из AuthContext
    
    // 🎯 ОСНОВНЫЕ СОСТОЯНИЯ
    const [tournament, setTournament] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('info');
    
    // 🎯 UI СОСТОЯНИЯ
    const [message, setMessage] = useState('');
    const [wsConnected, setWsConnected] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [activeMatchTab, setActiveMatchTab] = useState('overview'); // 🚀 НОВОЕ ДЛЯ ВАРИАНТА 3
    const [mixedTeams, setMixedTeams] = useState([]);
    const [ratingType, setRatingType] = useState('faceit');
    const [dataLoadingStates, setDataLoadingStates] = useState({
        tournament: false,
        matches: false
    });
    
    // 🎯 НОВЫЕ СОСТОЯНИЯ ДЛЯ РЕДАКТИРОВАНИЯ ПРАВИЛ И ОПИСАНИЯ
    const [isEditingRules, setIsEditingRules] = useState(false);
    const [editedRules, setEditedRules] = useState('');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);
    
    // 🎯 НОВЫЕ ХУКИ ДЛЯ УПРАВЛЕНИЯ
    const tournamentManagement = useTournamentManagement(id);
    const modals = useTournamentModals();
    
    // 🎯 LEGACY СОСТОЯНИЯ ДЛЯ СОВМЕСТИМОСТИ
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState({
        type: '',
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null,
        data: null
    });
    
    // 🎯 НОВОЕ СОСТОЯНИЕ ДЛЯ МОДАЛЬНОГО ОКНА ОТКАЗА ОТ УЧАСТИЯ
    const [showWithdrawConfirmModal, setShowWithdrawConfirmModal] = useState(false);
    
    // 🆕 СОСТОЯНИЕ ВИДА ОТОБРАЖЕНИЯ УЧАСТНИКОВ
    const [displayMode, setDisplayMode] = useState('smart-cards');
    
    // 🎯 УПРАВЛЕНИЕ УЧАСТНИКАМИ
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [newParticipantData, setNewParticipantData] = useState({
        name: '',
        email: '',
        faceit_elo: '',
        cs2_premier_rank: ''
    });
    
    // 🎯 УПРАВЛЕНИЕ МАТЧАМИ
    const [editingMatchResult, setEditingMatchResult] = useState(null);
    const [matchResultData, setMatchResultData] = useState({
        score1: 0,
        score2: 0,
        maps_data: []
    });
    
    // 🎯 ФУНКЦИЯ РАСЧЕТА СРЕДНЕГО РЕЙТИНГА КОМАНДЫ
    const calculateTeamAverageRating = useCallback((team) => {
        if (!team.members || team.members.length === 0) return '—';
        
        const ratings = team.members.map(member => {
            if (ratingType === 'faceit') {
                return parseInt(member.faceit_elo) || 1000; // Базовый рейтинг FACEIT
            } else {
                return parseInt(member.cs2_premier_rank) || 0; // Базовый ранг CS2
            }
        }).filter(rating => rating > 0);
        
        if (ratings.length === 0) return '—';
        
        const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        return Math.round(average);
    }, [ratingType]);

    // 🎯 ФУНКЦИЯ ДИНАМИЧЕСКОГО ОПРЕДЕЛЕНИЯ ПРИЗЕРОВ ТУРНИРА
    const calculateTournamentWinners = useCallback(() => {
        if (!tournament || tournament?.status !== 'completed') {
            return { winner: null, secondPlace: null, thirdPlace: null };
        }

        console.log('🏆 Рассчитываем призеров для турнира:', tournament.name);

        // 🎯 ПРИОРИТЕТ 1: Используем данные из базы данных, если они есть
        if (tournament.winner_id || tournament.winner_name) {
            console.log('✅ Используем данные о призерах из базы данных');
            
            let winner = null;
            let secondPlace = null;
            let thirdPlace = null;
            
            // Первое место
            if (tournament.winner_id || tournament.winner_name) {
                winner = {
                    id: tournament.winner_id,
                    name: tournament.winner_name || 'Победитель',
                    type: tournament.format === 'mix' || tournament.participant_type === 'team' ? 'team' : 'solo'
                };
                
                // Пытаемся найти дополнительную информацию о команде
                if (winner.type === 'team' && mixedTeams && tournament.winner_id) {
                    const winnerTeam = mixedTeams.find(team => team.id === tournament.winner_id) || 
                                      tournament.teams?.find(team => team.id === tournament.winner_id);
                    if (winnerTeam) {
                        winner.members = winnerTeam.members;
                        winner.avatar = winnerTeam.avatar_url;
                    }
                } else if (winner.type === 'solo' && tournament.participants && tournament.winner_id) {
                    const winnerParticipant = tournament.participants.find(p => p.id === tournament.winner_id);
                    if (winnerParticipant) {
                        winner.user_id = winnerParticipant.user_id;
                        winner.avatar = winnerParticipant.avatar_url;
                    }
                }
            }
            
            // Второе место
            if (tournament.second_place_id || tournament.second_place_name) {
                secondPlace = {
                    id: tournament.second_place_id,
                    name: tournament.second_place_name || 'Второе место',
                    type: tournament.format === 'mix' || tournament.participant_type === 'team' ? 'team' : 'solo'
                };
                
                // Пытаемся найти дополнительную информацию
                if (secondPlace.type === 'team' && mixedTeams && tournament.second_place_id) {
                    const secondTeam = mixedTeams.find(team => team.id === tournament.second_place_id) || 
                                      tournament.teams?.find(team => team.id === tournament.second_place_id);
                    if (secondTeam) {
                        secondPlace.members = secondTeam.members;
                        secondPlace.avatar = secondTeam.avatar_url;
                    }
                } else if (secondPlace.type === 'solo' && tournament.participants && tournament.second_place_id) {
                    const secondParticipant = tournament.participants.find(p => p.id === tournament.second_place_id);
                    if (secondParticipant) {
                        secondPlace.user_id = secondParticipant.user_id;
                        secondPlace.avatar = secondParticipant.avatar_url;
                    }
                }
            }
            
            // Третье место
            if (tournament.third_place_id || tournament.third_place_name) {
                thirdPlace = {
                    id: tournament.third_place_id,
                    name: tournament.third_place_name || 'Третье место',
                    type: tournament.format === 'mix' || tournament.participant_type === 'team' ? 'team' : 'solo'
                };
                
                // Пытаемся найти дополнительную информацию
                if (thirdPlace.type === 'team' && mixedTeams && tournament.third_place_id) {
                    const thirdTeam = mixedTeams.find(team => team.id === tournament.third_place_id) || 
                                     tournament.teams?.find(team => team.id === tournament.third_place_id);
                    if (thirdTeam) {
                        thirdPlace.members = thirdTeam.members;
                        thirdPlace.avatar = thirdTeam.avatar_url;
                    }
                } else if (thirdPlace.type === 'solo' && tournament.participants && tournament.third_place_id) {
                    const thirdParticipant = tournament.participants.find(p => p.id === tournament.third_place_id);
                    if (thirdParticipant) {
                        thirdPlace.user_id = thirdParticipant.user_id;
                        thirdPlace.avatar = thirdParticipant.avatar_url;
                    }
                }
            }
            
            return { winner, secondPlace, thirdPlace };
        }

        // 🎯 ПРИОРИТЕТ 2: Динамическое вычисление на основе матчей (fallback)
        if (!matches || matches.length === 0) {
            console.log('⚠️ Нет данных о призерах в БД и нет матчей для динамического вычисления');
            return { winner: null, secondPlace: null, thirdPlace: null };
        }

        console.log('🔄 Используем динамическое вычисление призеров на основе матчей');
        console.log('🏆 Всего матчей:', matches.length);

        // Находим матч за третье место
        const thirdPlaceMatch = matches.find(match => 
            match.is_third_place_match === true || match.is_third_place === true
        );

        // Находим финальный матч (самый высокий раунд, не является матчем за 3-е место)
        const completedMatches = matches.filter(match => 
            match.winner_team_id || match.winner_id || 
            match.status === 'completed' || match.status === 'DONE'
        );

        // Сортируем по раунду (по убыванию) и находим финал
        const sortedMatches = completedMatches
            .filter(match => !match.is_third_place_match && !match.is_third_place)
            .sort((a, b) => (b.round || 0) - (a.round || 0));

        const finalMatch = sortedMatches.find(match => match.winner_team_id || match.winner_id);

        console.log('🏆 Финальный матч:', finalMatch);
        console.log('🏆 Матч за 3-е место:', thirdPlaceMatch);

        let winner = null;
        let secondPlace = null;
        let thirdPlace = null;

        // Определяем победителя и второе место из финального матча
        if (finalMatch) {
            const winnerId = finalMatch.winner_team_id || finalMatch.winner_id;
            const loserId = winnerId === finalMatch.team1_id ? finalMatch.team2_id : finalMatch.team1_id;

            // Получаем информацию о победителе
            if (tournament.format === 'mix' || tournament.participant_type === 'team') {
                const winnerTeam = mixedTeams?.find(team => team.id === winnerId) || 
                                tournament.teams?.find(team => team.id === winnerId);
                if (winnerTeam) {
                    winner = {
                        id: winnerId,
                        name: winnerTeam.name,
                        type: 'team',
                        members: winnerTeam.members,
                        avatar: winnerTeam.avatar_url
                    };
                } else {
                    // Fallback: ищем по именам в матче
                    winner = {
                        id: winnerId,
                        name: winnerId === finalMatch.team1_id ? 
                              finalMatch.team1_name || finalMatch.participant1_name || 'Победитель' :
                              finalMatch.team2_name || finalMatch.participant2_name || 'Победитель',
                        type: 'team',
                        members: null
                    };
                }

                // Получаем информацию о втором месте
                const secondTeam = mixedTeams?.find(team => team.id === loserId) || 
                                 tournament.teams?.find(team => team.id === loserId);
                if (secondTeam) {
                    secondPlace = {
                        id: loserId,
                        name: secondTeam.name,
                        type: 'team',
                        members: secondTeam.members,
                        avatar: secondTeam.avatar_url
                    };
                } else {
                    secondPlace = {
                        id: loserId,
                        name: loserId === finalMatch.team1_id ? 
                              finalMatch.team1_name || finalMatch.participant1_name || 'Второе место' :
                              finalMatch.team2_name || finalMatch.participant2_name || 'Второе место',
                        type: 'team',
                        members: null
                    };
                }
            } else {
                // Для одиночных турниров
                const winnerParticipant = tournament.participants?.find(p => p.id === winnerId);
                const loserParticipant = tournament.participants?.find(p => p.id === loserId);

                winner = {
                    id: winnerId,
                    name: winnerParticipant?.name || winnerParticipant?.username || 'Победитель',
                    type: 'solo',
                    user_id: winnerParticipant?.user_id,
                    avatar: winnerParticipant?.avatar_url
                };

                secondPlace = {
                    id: loserId,
                    name: loserParticipant?.name || loserParticipant?.username || 'Второе место',
                    type: 'solo',
                    user_id: loserParticipant?.user_id,
                    avatar: loserParticipant?.avatar_url
                };
            }
        }

        // Определяем третье место из матча за 3-е место
        if (thirdPlaceMatch && (thirdPlaceMatch.winner_team_id || thirdPlaceMatch.winner_id)) {
            const thirdWinnerId = thirdPlaceMatch.winner_team_id || thirdPlaceMatch.winner_id;

            if (tournament.format === 'mix' || tournament.participant_type === 'team') {
                const thirdTeam = mixedTeams?.find(team => team.id === thirdWinnerId) || 
                                tournament.teams?.find(team => team.id === thirdWinnerId);
                if (thirdTeam) {
                    thirdPlace = {
                        id: thirdWinnerId,
                        name: thirdTeam.name,
                        type: 'team',
                        members: thirdTeam.members,
                        avatar: thirdTeam.avatar_url
                    };
                } else {
                    thirdPlace = {
                        id: thirdWinnerId,
                        name: thirdWinnerId === thirdPlaceMatch.team1_id ? 
                              thirdPlaceMatch.team1_name || thirdPlaceMatch.participant1_name || 'Третье место' :
                              thirdPlaceMatch.team2_name || thirdPlaceMatch.participant2_name || 'Третье место',
                        type: 'team',
                        members: null
                    };
                }
            } else {
                const thirdParticipant = tournament.participants?.find(p => p.id === thirdWinnerId);
                thirdPlace = {
                    id: thirdWinnerId,
                    name: thirdParticipant?.name || thirdParticipant?.username || 'Третье место',
                    type: 'solo',
                    user_id: thirdParticipant?.user_id,
                    avatar: thirdParticipant?.avatar_url
                };
            }
        }

        const result = { winner, secondPlace, thirdPlace };
        console.log('🏆 Результат динамического расчета призеров:', result);
        return result;
    }, [matches, tournament, mixedTeams]);

    // 🎯 ФУНКЦИЯ ДЛЯ ОБРАБОТКИ ИМЕН УЧАСТНИКОВ КОМАНД (аналогично TeamGenerator)
    const formatMemberName = useCallback((memberName) => {
        if (!memberName) return { displayName: 'Неизвестно', isLongName: false, isTruncated: false };
        
        const name = String(memberName);
        const nameLength = name.length;
        
        // Если имя длиннее 13 символов - обрезаем до 13
        const displayName = nameLength > 13 ? name.substring(0, 13) + '...' : name;
        
        // Если имя длиннее 9 символов - применяем уменьшенный шрифт
        const isLongName = nameLength > 9;
        const isTruncated = nameLength > 13;
        
        return {
            displayName,
            isLongName,
            isTruncated,
            originalName: name
        };
    }, []);

    // 🎯 МЕМОИЗИРОВАННЫЕ ПРИЗЕРЫ ТУРНИРА
    const tournamentWinners = useMemo(() => {
        return calculateTournamentWinners();
    }, [calculateTournamentWinners]);

    // 🎯 СОСТОЯНИЯ ДЛЯ ПЛАВАЮЩЕЙ ПАНЕЛИ (ВАРИАНТ 3)
    const hasBracket = useMemo(() => {
        // Проверяем наличие матчей или команд с турнирной сеткой
        return matches && matches.length > 0;
    }, [matches]);

    const hasMatches = useMemo(() => {
        // Проверяем наличие матчей с результатами
        return matches && matches.some(match => 
            match.winner_id || match.winner_team_id || 
            match.status === 'completed' || match.status === 'DONE'
        );
    }, [matches]);

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

        const isCreator = tournament.creator_id === user.id || tournament.created_by === user.id;
        const isParticipating = tournament.participants?.some(
            p => p.user_id === user.id || p.id === user.id
        ) || false;
        
        // Используем новый хук для проверки прав доступа
        const hasAccess = tournamentManagement.checkAccess(tournament);

        return {
            isParticipating,
            isCreator,
            isAdminOrCreator: hasAccess,
            canEdit: hasAccess
        };
    }, [user, tournament, tournamentManagement]);

    // 🎯 ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ - убрана, получаем из AuthContext

    // 🎯 УПРОЩЕННАЯ ФУНКЦИЯ ПЕРЕЗАГРУЗКИ БЕЗ ЦИКЛИЧЕСКИХ ЗАВИСИМОСТЕЙ
    // ОПРЕДЕЛЕНА ВЫШЕ ВСЕХ ФУНКЦИЙ КОТОРЫЕ ЕЕ ИСПОЛЬЗУЮТ
    const reloadTournamentData = useCallback(() => {
        if (!id) return;
        
        // Загружаем данные турнира напрямую через API
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const tournamentResponse = await api.get(`/api/tournaments/${id}`);
                const tournamentData = tournamentResponse.data;
                
                setTournament(tournamentData);
                setMatches(tournamentData.matches || []);
                
                if (tournamentData.format === 'mix' || tournamentData.participant_type === 'team') {
                    setMixedTeams(tournamentData.teams || tournamentData.mixed_teams || []);
                }
            } catch (error) {
                console.error('❌ Ошибка перезагрузки турнира:', error);
                setError(`Ошибка загрузки: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [id]); // Только id для предотвращения циклических зависимостей

    // 🎯 ПОИСК ПОЛЬЗОВАТЕЛЕЙ ДЛЯ ДОБАВЛЕНИЯ В ТУРНИР
    const searchUsers = useCallback(async (query) => {
        console.log('🔍 НАЧАЛО ПОИСКА ПОЛЬЗОВАТЕЛЕЙ');
        console.log('🔍 Параметры поиска:', {
            query,
            queryType: typeof query,
            queryLength: query?.length,
            tournamentId: tournament?.id,
            userLoggedIn: !!user
        });

        // Безопасная проверка query на undefined/null/пустую строку
        if (!query || typeof query !== 'string' || query.trim().length < 2) {
            console.log('🔍 Запрос слишком короткий или некорректный, очищаем результаты');
            modals.updateSearchResults([]);
            return;
        }

        try {
            console.log('🔍 Устанавливаем состояние загрузки...');
            modals.setSearchLoading(true);
            
            console.log('🔍 Вызываем tournamentManagement.searchUsers с запросом:', query);
            const result = await tournamentManagement.searchUsers(query);
            console.log('🔍 Результат от tournamentManagement.searchUsers:', result);
            
            if (result.success) {
                console.log('🔍 Поиск успешен, полученные данные:', result.data);
                
                // Фильтруем пользователей, которые уже участвуют в турнире
                const existingParticipantIds = tournament?.participants?.map(p => p.user_id || p.id) || [];
                console.log('🔍 ID существующих участников:', existingParticipantIds);
                
                const filteredResults = result.data.filter(user => 
                    !existingParticipantIds.includes(user.id)
                );
                console.log('🔍 Отфильтрованные результаты:', filteredResults);
                
                modals.updateSearchResults(filteredResults);
                console.log('🔍 Найдено пользователей после фильтрации:', filteredResults.length);
                
                if (filteredResults.length === 0 && result.data.length > 0) {
                    setMessage('ℹ️ Найденные пользователи уже участвуют в турнире');
                    setTimeout(() => setMessage(''), 3000);
                }
            } else {
                console.error('🔍 Ошибка поиска:', result.error);
                modals.updateSearchResults([]);
                setMessage(`❌ ${result.error}`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('🔍 Исключение при поиске пользователей:', error);
            console.error('🔍 Детали ошибки:', {
                message: error.message,
                stack: error.stack,
                response: error.response?.data
            });
            modals.updateSearchResults([]);
            setMessage(`❌ Ошибка поиска: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        } finally {
            console.log('🔍 Снимаем состояние загрузки...');
            modals.setSearchLoading(false);
            console.log('🔍 КОНЕЦ ПОИСКА ПОЛЬЗОВАТЕЛЕЙ');
        }
    }, [tournament, tournamentManagement, modals]);

    // 🎯 ДОБАВЛЕНИЕ ЗАРЕГИСТРИРОВАННОГО УЧАСТНИКА
    const addRegisteredParticipant = useCallback(async (userId) => {
        // Находим пользователя в результатах поиска для получения имени
        const selectedUser = modals.searchResults.find(user => user.id === userId);
        const userName = selectedUser?.username || `User ${userId}`;
        
        try {
            const result = await tournamentManagement.addRegisteredParticipant(userId, userName);
            
            if (result.success) {
                setMessage('✅ Участник добавлен в турнир!');
                setTimeout(() => setMessage(''), 3000);
                modals.closeParticipantSearchModal();
                reloadTournamentData();
            } else {
                setMessage(`❌ ${result.error}`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('❌ Ошибка добавления участника:', error);
            setMessage(`❌ Ошибка: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [tournamentManagement, modals, reloadTournamentData]);

    // 🎯 ДОБАВЛЕНИЕ НЕЗАРЕГИСТРИРОВАННОГО УЧАСТНИКА
    const addUnregisteredParticipant = useCallback(async () => {
        console.log('🔍 Начинается добавление незарегистрированного участника');
        console.log('🔍 Данные участника:', modals.newParticipantData);
        
        if (!modals.newParticipantData.display_name?.trim()) {
            console.warn('❌ Отсутствует имя участника');
            setMessage('❌ Имя участника обязательно');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        try {
            console.log('🔍 Вызываем tournamentManagement.addGuestParticipant...');
            const result = await tournamentManagement.addGuestParticipant(modals.newParticipantData);
            console.log('🔍 Результат добавления:', result);
            
            if (result.success) {
                console.log('✅ Участник успешно добавлен');
                setMessage('✅ Незарегистрированный участник добавлен!');
                setTimeout(() => setMessage(''), 3000);
                modals.closeAddParticipantModal();
                reloadTournamentData();
            } else {
                console.error('❌ Ошибка при добавлении:', result.error);
                setMessage(`❌ ${result.error}`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('❌ Исключение при добавлении незарегистрированного участника:', error);
            setMessage(`❌ Ошибка: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [tournamentManagement, modals, reloadTournamentData]);

    // 🎯 СОХРАНЕНИЕ РЕЗУЛЬТАТА МАТЧА
    const saveMatchResult = useCallback(async (resultData) => {
        // 🔧 УЛУЧШЕННАЯ ОБРАБОТКА ID МАТЧА
        let matchId = null;
        
        if (typeof modals.selectedMatch === 'number') {
            // Если selectedMatch является числом, то это и есть ID матча
            matchId = modals.selectedMatch;
            console.log('✅ [saveMatchResult] selectedMatch является числом (ID матча):', matchId);
        } else if (modals.selectedMatch && typeof modals.selectedMatch === 'object') {
            // Если selectedMatch является объектом, извлекаем ID
            matchId = modals.selectedMatch.id;
            console.log('✅ [saveMatchResult] selectedMatch является объектом, извлекаем ID:', matchId);
        } else {
            console.error('❌ [saveMatchResult] КРИТИЧЕСКАЯ ОШИБКА: selectedMatch имеет неподдерживаемый тип!', {
                selectedMatch: modals.selectedMatch,
                type: typeof modals.selectedMatch
            });
        }

        if (!matchId && matchId !== 0) {
            console.error('❌ [saveMatchResult] Не найден ID матча для сохранения:', {
                selectedMatch: modals.selectedMatch,
                matchId: matchId,
                selectedMatchType: typeof modals.selectedMatch
            });
            setMessage('❌ Ошибка: ID матча не найден');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        try {
            console.log('💾 Сохраняем результат матча:', {
                matchId: matchId,
                resultData: resultData
            });

            const result = await tournamentManagement.saveMatchResult(
                matchId,
                resultData
            );
            
            if (result.success) {
                setMessage('✅ Результат матча сохранен!');
                setTimeout(() => setMessage(''), 3000);
                modals.closeMatchResultModal();
                reloadTournamentData();
            } else {
                setMessage(`❌ ${result.error}`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения результата:', error);
            setMessage(`❌ Ошибка: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [tournamentManagement, modals, reloadTournamentData]);

    // 🎯 ОТКРЫТИЕ МОДАЛЬНОГО ОКНА РЕЗУЛЬТАТА МАТЧА
    const openMatchResultModal = useCallback((match) => {
        modals.openMatchResultModal(match);
    }, [modals]);

    // 🎯 ФУНКЦИЯ ПОДТВЕРЖДЕНИЯ ДЕЙСТВИЙ
    const showConfirmation = useCallback((type, title, message, onConfirm, data = null) => {
        setConfirmAction({
            type,
            title,
            message,
            onConfirm,
            onCancel: () => setShowConfirmModal(false),
            data
        });
        setShowConfirmModal(true);
    }, []);

    // 🎯 ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ УЧАСТНИКА
    const confirmRemoveParticipant = useCallback((participantId, participantName) => {
        showConfirmation(
            'remove_participant',
            'Удалить участника?',
            `Вы уверены, что хотите удалить "${participantName}" из турнира? Это действие нельзя отменить.`,
            async () => {
                try {
                    const token = localStorage.getItem('token');
                    await api.delete(`/api/tournaments/${id}/participants/${participantId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    setMessage('✅ Участник удален из турнира');
                    setTimeout(() => setMessage(''), 3000);
                    setShowConfirmModal(false);
                    reloadTournamentData();
                } catch (error) {
                    console.error('❌ Ошибка удаления участника:', error);
                    setMessage(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
                    setTimeout(() => setMessage(''), 3000);
                }
            },
            { participantId, participantName }
        );
    }, [id, showConfirmation, reloadTournamentData]);

    // 🎯 ПОДТВЕРЖДЕНИЕ ЗАПУСКА ТУРНИРА
    const confirmStartTournament = useCallback(() => {
        showConfirmation(
            'start_tournament',
            'Запустить турнир?',
            'После запуска турнира нельзя будет добавлять или удалять участников. Убедитесь, что сетка создана и все готово.',
            async () => {
                try {
                    const token = localStorage.getItem('token');
                    await api.post(`/api/tournaments/${id}/start`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    setMessage('✅ Турнир запущен!');
                    setTimeout(() => setMessage(''), 3000);
                    setShowConfirmModal(false);
                    reloadTournamentData();
                } catch (error) {
                    console.error('❌ Ошибка запуска турнира:', error);
                    setMessage(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
                    setTimeout(() => setMessage(''), 3000);
                }
            }
        );
    }, [id, showConfirmation, reloadTournamentData]);

    // 🎯 ПОДТВЕРЖДЕНИЕ ЗАВЕРШЕНИЯ ТУРНИРА
    const confirmEndTournament = useCallback(() => {
        showConfirmation(
            'end_tournament',
            'Завершить турнир?',
            'Вы уверены, что хотите завершить турнир? После завершения нельзя будет изменять результаты матчей.',
            async () => {
                try {
                    const token = localStorage.getItem('token');
                    await api.post(`/api/tournaments/${id}/end`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    setMessage('✅ Турнир завершен!');
                    setTimeout(() => setMessage(''), 3000);
                    setShowConfirmModal(false);
                    reloadTournamentData();
                } catch (error) {
                    console.error('❌ Ошибка завершения турнира:', error);
                    setMessage(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
                    setTimeout(() => setMessage(''), 3000);
                }
            }
        );
    }, [id, showConfirmation, reloadTournamentData]);

    // 🎯 ПОДТВЕРЖДЕНИЕ ГЕНЕРАЦИИ СЕТКИ
    const confirmGenerateBracket = useCallback(() => {
        const participantsCount = tournament?.participants?.length || 0;
        if (participantsCount < 2) {
            setMessage('❌ Для создания сетки нужно минимум 2 участника');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        showConfirmation(
            'generate_bracket',
            'Создать турнирную сетку?',
            `Будет создана сетка для ${participantsCount} участников. Если сетка уже существует, она будет пересоздана.`,
            async () => {
                try {
                    const token = localStorage.getItem('token');
                    await api.post(`/api/tournaments/${id}/generate-bracket`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    setMessage('✅ Турнирная сетка создана!');
                    setTimeout(() => setMessage(''), 3000);
                    setShowConfirmModal(false);
                    reloadTournamentData();
                } catch (error) {
                    console.error('❌ Ошибка генерации сетки:', error);
                    setMessage(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
                    setTimeout(() => setMessage(''), 3000);
                }
            }
        );
    }, [tournament, id, showConfirmation, reloadTournamentData]);

    // 🎯 ФУНКЦИЯ ТРАНСФОРМАЦИИ МАТЧЕЙ ДЛЯ BRACKETRENDERER (УЛУЧШЕНА ДЛЯ МИКС ТУРНИРОВ)
    const transformMatchesToGames = useCallback((matchesArray, teamsArray = null) => {
        if (!matchesArray || !Array.isArray(matchesArray)) {
            console.warn('transformMatchesToGames: некорректные данные матчей', matchesArray);
            return [];
        }

        console.log('🔄 Трансформация матчей для BracketRenderer:', {
            matchesCount: matchesArray.length,
            teamsCount: teamsArray?.length || 0,
            hasTournamentData: !!tournament
        });
        
        // Получаем команды из переданного параметра или из состояния
        const teams = teamsArray || mixedTeams || tournament?.teams || [];
        console.log('🔄 Используем команды:', teams.length);

        return matchesArray.map((match, index) => {
            // Создаем участников из данных матча
            const participants = [];
            
            // Функция поиска команды по ID
            const findTeamById = (teamId) => {
                if (!teamId || !teams.length) return null;
                return teams.find(team => team.id === teamId);
            };
            
            // Участник 1
            let team1Name = match.team1_name || match.participant1_name;
            let team1Avatar = match.team1_avatar_url;
            
            // Если есть team1_id, ищем команду в списке
            if (match.team1_id && teams.length > 0) {
                const team1 = findTeamById(match.team1_id);
                if (team1) {
                    team1Name = team1.name;
                    team1Avatar = team1.avatar_url || team1Avatar;
                    console.log(`🔍 Найдена команда 1: ${team1.name} (ID: ${match.team1_id})`);
                }
            }
            
            if (match.team1_id || team1Name) {
                participants.push({
                    id: match.team1_id || `team1_${match.id}`,
                    name: team1Name || 'TBD',
                    score: match.score1 !== undefined ? Number(match.score1) : 
                           (match.team1_score !== undefined ? Number(match.team1_score) : 0),
                    isWinner: match.winner_team_id && (match.winner_team_id === match.team1_id),
                    avatarUrl: team1Avatar || null
                });
            }

            // Участник 2
            let team2Name = match.team2_name || match.participant2_name;
            let team2Avatar = match.team2_avatar_url;
            
            // Если есть team2_id, ищем команду в списке
            if (match.team2_id && teams.length > 0) {
                const team2 = findTeamById(match.team2_id);
                if (team2) {
                    team2Name = team2.name;
                    team2Avatar = team2.avatar_url || team2Avatar;
                    console.log(`🔍 Найдена команда 2: ${team2.name} (ID: ${match.team2_id})`);
                }
            }
            
            if (match.team2_id || team2Name) {
                participants.push({
                    id: match.team2_id || `team2_${match.id}`,
                    name: team2Name || 'TBD',
                    score: match.score2 !== undefined ? Number(match.score2) : 
                           (match.team2_score !== undefined ? Number(match.team2_score) : 0),
                    isWinner: match.winner_team_id && (match.winner_team_id === match.team2_id),
                    avatarUrl: team2Avatar || null
                });
            }

            // Если участников меньше 2, создаем пустых (для будущих матчей)
            while (participants.length < 2) {
                participants.push({
                    id: `empty_${match.id}_${participants.length}`,
                    name: 'TBD',
                    score: 0,
                    isWinner: false,
                    avatarUrl: null
                });
            }

            // Определяем раунд
            let round = 0;
            if (match.round !== undefined && match.round !== null) {
                round = Number(match.round);
            } else if (match.round_number !== undefined && match.round_number !== null) {
                round = Number(match.round_number);
            }

            // Определяем тип матча
            let bracket_type = 'winner';
            if (match.bracket_type) {
                bracket_type = match.bracket_type;
            } else if (match.match_type) {
                bracket_type = match.match_type;
            }

            // Определяем статус матча
            let state = 'OPEN';
            if (match.status === 'completed' || match.status === 'DONE' || match.state === 'DONE' || match.winner_team_id) {
                state = 'DONE';
            } else if (match.status === 'in_progress' || match.status === 'PENDING') {
                state = 'PENDING';
            }

            // Возвращаем объект в формате, ожидаемом BracketRenderer
            const transformedGame = {
                id: match.id,
                round: round,
                match_number: match.match_number || match.number || index + 1,
                bracket_type: bracket_type,
                is_third_place_match: Boolean(match.is_third_place_match || match.is_third_place),
                state: state,
                name: match.name || `Матч ${match.match_number || match.number || index + 1}`,
                participants: participants,
                winner_id: match.winner_team_id || match.winner_id || null,
                status: match.status || 'pending',
                // Дополнительные поля для совместимости
                completed_at: match.completed_at || match.updated_at,
                maps_data: match.maps_data || null
            };

            console.log(`🔄 Матч ${match.id} трансформирован:`, {
                round: transformedGame.round,
                bracket_type: transformedGame.bracket_type,
                state: transformedGame.state,
                participants: transformedGame.participants.map(p => p.name),
                hasWinner: !!transformedGame.winner_id,
                scores: transformedGame.participants.map(p => p.score)
            });

            return transformedGame;
        });
    }, [mixedTeams, tournament?.format]);

    // 🎯 УЛУЧШЕННАЯ ЗАГРУЗКА ТУРНИРА И ДАННЫХ
    const loadTournamentData = useCallback(async () => {
        if (!id) return;

        try {
            setLoading(true);
            setError(null);
            setDataLoadingStates(prev => ({ ...prev, tournament: true }));

            console.log('🔍 Загружаем данные турнира:', id);

            // Основной запрос турнира
            const tournamentResponse = await api.get(`/api/tournaments/${id}`);
            const tournamentData = tournamentResponse.data;
            
            console.log('✅ Турнир загружен:', {
                name: tournamentData.name,
                status: tournamentData.status,
                participantsCount: tournamentData.participants?.length,
                hasMatches: !!tournamentData.matches,
                // 🔧 ОТЛАДКА: Информация о создателе
                creatorId: tournamentData.creator_id,
                creatorName: tournamentData.creator_name,
                creatorAvatar: tournamentData.creator_avatar_url,
                createdBy: tournamentData.created_by,
                // 🔧 ОТЛАДКА: Администраторы
                admins: tournamentData.admins?.length || 0,
                adminsList: tournamentData.admins
            });
            
            setTournament(tournamentData);

            // 🔧 ДОБАВЛЕНО: Кэшируем турнир в localStorage для использования в модальных окнах
            try {
                localStorage.setItem('currentTournament', JSON.stringify(tournamentData));
            } catch (error) {
                console.warn('Не удалось сохранить турнир в localStorage:', error);
            }

            // Загружаем матчи с несколькими источниками
            let matchesData = [];
            
            // Источник 1: Матчи из основного ответа турнира
            if (tournamentData.matches && Array.isArray(tournamentData.matches) && tournamentData.matches.length > 0) {
                matchesData = tournamentData.matches;
                console.log('✅ Матчи загружены из основного ответа турнира:', matchesData.length);
            } 
            // Источник 2: Проверяем альтернативные поля в турнире
            else {
                console.log('ℹ️ Матчи не найдены в основном ответе, проверяем альтернативные поля...');
                
                if (tournamentData.bracket_matches) {
                    matchesData = tournamentData.bracket_matches;
                    console.log('✅ Матчи найдены в bracket_matches:', matchesData.length);
                } else if (tournamentData.tournament_matches) {
                    matchesData = tournamentData.tournament_matches;
                    console.log('✅ Матчи найдены в tournament_matches:', matchesData.length);
                } else {
                    console.log('ℹ️ Матчи не найдены ни в одном источнике');
                    matchesData = [];
                }
            }

            // Логируем структуру данных матчей для диагностики
            if (matchesData.length > 0) {
                console.log('🔍 Структура первого матча:', matchesData[0]);
                console.log('🔍 Все ключи первого матча:', Object.keys(matchesData[0]));
                
                // Проверяем наличие результатов
                const completedMatches = matchesData.filter(m => 
                    m.status === 'completed' || m.state === 'DONE' || m.status === 'DONE'
                );
                console.log(`📊 Завершенных матчей: ${completedMatches.length} из ${matchesData.length}`);
            }

            setMatches(matchesData);
            
            // Загружаем команды для mix турниров И командных турниров
            if (tournamentData.format === 'mix' || tournamentData.participant_type === 'team') {
                let teamsData = [];
                
                // Источник 1: Команды из основного ответа (новое поле)
                if (tournamentData.teams && Array.isArray(tournamentData.teams)) {
                    teamsData = tournamentData.teams;
                    console.log('✅ Команды загружены из teams:', teamsData.length);
                }
                // Источник 2: Команды из mixed_teams (обратная совместимость)
                else if (tournamentData.mixed_teams && Array.isArray(tournamentData.mixed_teams)) {
                    teamsData = tournamentData.mixed_teams;
                    console.log('✅ Команды загружены из mixed_teams:', teamsData.length);
                }
                // Источник 3: Отдельный запрос команд (fallback)
                else {
                    try {
                        const teamsResponse = await api.get(`/api/tournaments/${id}/teams`);
                        if (teamsResponse.data && Array.isArray(teamsResponse.data)) {
                            teamsData = teamsResponse.data;
                            console.log('✅ Команды загружены отдельным запросом:', teamsData.length);
                        }
                    } catch (teamsError) {
                        console.warn('⚠️ Ошибка загрузки команд:', teamsError.message);
                        teamsData = [];
                    }
                }
                
                setMixedTeams(teamsData);
                
                // Логируем структуру команд для диагностики
                if (teamsData.length > 0) {
                    console.log('🔍 Структура первой команды:', teamsData[0]);
                    console.log('🔍 Составы команд:', teamsData.map(team => ({
                        name: team.name,
                        membersCount: team.members?.length || 0,
                        members: team.members?.map(m => m.name || m.username || 'Неизвестно')
                    })));
                }
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
    }, [id]); // ТОЛЬКО id в зависимостях

    // 🚀 Socket.IO подключение с новым hook
    const socketHook = useSocket();

    // 🎯 ЭФФЕКТЫ - убрали loadUser(), получаем пользователя из AuthContext

    useEffect(() => {
        if (id) {
            loadTournamentData();
        }
    }, [id]); // УБИРАЕМ loadTournamentData из зависимостей для предотвращения цикла

    // 🔧 ДОБАВЛЕНО: Очистка кэша турнира при размонтировании компонента
    useEffect(() => {
        return () => {
            try {
                localStorage.removeItem('currentTournament');
            } catch (error) {
                console.warn('Не удалось очистить кэш турнира:', error);
            }
        };
    }, []);

    // Socket.IO подключение к турниру (только один раз)
    useEffect(() => {
        if (!user?.id || !tournament?.id) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        console.log('🚀 [TournamentDetails] Подключение к турниру:', tournament.id);
        
        // Подключаемся к Socket.IO
        const connected = socketHook.connect(token);
        
        if (connected) {
            // Присоединяемся к турниру
            socketHook.tournament.join(tournament.id);
            setWsConnected(socketHook.connected);
            
            // Обработчик обновлений турнира
            const handleTournamentUpdate = (data) => {
                console.log('🔄 [TournamentDetails] Обновление турнира:', data);
                setTournament(prev => ({ ...prev, ...data }));
                
                if (data.message) {
                    setMessage(data.message);
                    setTimeout(() => setMessage(''), 3000);
                }
            };
            
            // Подписываемся на обновления турнира
            socketHook.on('tournament_updated', handleTournamentUpdate);
            
            console.log('✅ [TournamentDetails] Socket.IO подключен к турниру');
            
            // Cleanup
            return () => {
                console.log('🧹 [TournamentDetails] Покидаем турнир при размонтировании');
                if (socketHook.connected) {
                    socketHook.tournament.leave(tournament.id);
                }
                socketHook.off('tournament_updated', handleTournamentUpdate);
            };
        }
    }, [user?.id, tournament?.id]); // Убрали socketHook из зависимостей

    // 🎯 ОБРАБОТЧИКИ ДЕЙСТВИЙ (БЕЗ ЦИКЛИЧЕСКИХ ЗАВИСИМОСТЕЙ)
    const handleParticipate = useCallback(async () => {
        if (!user || !tournament) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/participate`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Вы успешно зарегистрировались в турнире!');
            setTimeout(() => setMessage(''), 3000);
            reloadTournamentData(); // Используем стабильную функцию
        } catch (error) {
            console.error('❌ Ошибка участия:', error);
            setMessage(`❌ Ошибка регистрации: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [user, tournament, id, reloadTournamentData]);

    // 🎯 МЕМОИЗИРОВАННЫЕ ДАННЫЕ ДЛЯ BRACKETRENDERER
    const bracketGames = useMemo(() => {
        if (!matches || matches.length === 0) {
            console.log('🎯 Нет матчей для трансформации');
            return [];
        }

        console.log('🎯 Начинаем трансформацию матчей:', {
            totalMatches: matches.length,
            teamsAvailable: mixedTeams?.length || 0,
            tournamentFormat: tournament?.format,
            sampleMatch: matches[0] ? {
                id: matches[0].id,
                status: matches[0].status,
                hasTeam1: !!matches[0].team1_id,
                hasTeam2: !!matches[0].team2_id,
                hasScore: matches[0].score1 !== undefined || matches[0].team1_score !== undefined,
                winner: matches[0].winner_team_id || matches[0].winner_id
            } : 'нет матчей'
        });

        // Передаем команды в функцию трансформации
        const transformedGames = transformMatchesToGames(matches, mixedTeams);
        
        console.log('🎯 Трансформированные игры для BracketRenderer:', {
            totalGames: transformedGames.length,
            validGames: transformedGames.filter(g => g.participants.length >= 2).length,
            completedGames: transformedGames.filter(g => g.state === 'DONE').length,
            gamesWithResults: transformedGames.filter(g => g.participants.some(p => p.score > 0)).length
        });
        
        return transformedGames;
    }, [matches, mixedTeams, tournament?.format]);

    const handleWithdraw = useCallback(async () => {
        if (!user || !tournament) return;

        // Проверяем статус турнира и тип участников
        if (tournament.status === 'in_progress' && tournament.participant_type === 'solo') {
            // Показываем модальное окно с предупреждением для идущих турниров
            setShowWithdrawConfirmModal(true);
            return;
        }

        // Для турниров в статусе 'active' выходим сразу без предупреждения
        await performWithdraw();
    }, [user, tournament]);

    // Функция выполнения отказа от участия
    const performWithdraw = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${tournament.id}/withdraw`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage('✅ Вы отказались от участия в турнире');
            await reloadTournamentData();
        } catch (error) {
            console.error('Ошибка отказа от участия:', error);
            setMessage(`❌ Ошибка: ${error.response?.data?.error || error.message}`);
        }
    }, [tournament?.id, reloadTournamentData]);

    // Отмена отказа от участия
    const cancelWithdraw = useCallback(() => {
        setShowWithdrawConfirmModal(false);
    }, []);

    // Подтверждение отказа от участия в турнире в процессе
    const confirmWithdrawFromInProgressTournament = useCallback(async () => {
        setShowWithdrawConfirmModal(false);
        await performWithdraw();
    }, [performWithdraw]);

    const handleGenerateBracket = useCallback(async () => {
        confirmGenerateBracket();
    }, [confirmGenerateBracket]);

    const handleStartTournament = useCallback(async () => {
        confirmStartTournament();
    }, [confirmStartTournament]);

    const handleEndTournament = useCallback(async () => {
        confirmEndTournament();
    }, [confirmEndTournament]);

    const handleClearResults = useCallback(async () => {
        if (!userPermissions.canEdit || !window.confirm('Вы уверены? Все результаты будут удалены!')) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/clear-results`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Результаты очищены!');
            setTimeout(() => setMessage(''), 3000);
            reloadTournamentData(); // Используем стабильную функцию
        } catch (error) {
            console.error('❌ Ошибка очистки результатов:', error);
            setMessage(`❌ Ошибка очистки: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, reloadTournamentData]);

    const handleTeamClick = useCallback((teamName) => {
        console.log('Клик по команде:', teamName);
        // Здесь может быть логика показа состава команды
    }, []);

    // 🎨 Обработчик изменения вида отображения участников
    const handleDisplayModeChange = useCallback((newMode) => {
        console.log('🎨 Смена вида отображения участников:', newMode);
        setDisplayMode(newMode);
    }, []);

    // 🎯 ФУНКЦИЯ ПРОВЕРКИ ВОЗМОЖНОСТИ РЕДАКТИРОВАНИЯ МАТЧА
    const canEditMatch = useCallback((match) => {
        // Проверяем права пользователя
        if (!userPermissions.canEdit || tournament.status === 'completed') {
            return false;
        }
        
        // Проверяем, есть ли уже следующие матчи с участниками этого матча
        if (!matches || matches.length === 0) {
            return true; // Если нет других матчей, можно редактировать
        }
        
        const winnerId = match.winner_team_id || match.winner_id;
        if (!winnerId) {
            return true; // Если матч не завершен, можно редактировать
        }
        
        // Ищем матчи, где победитель текущего матча уже участвует
        const hasSubsequentMatches = matches.some(m => {
            if (m.id === match.id) return false; // Исключаем сам матч
            
            // Проверяем, участвует ли победитель в других матчах
            return (m.team1_id === winnerId || m.team2_id === winnerId) &&
                   (m.winner_team_id || m.winner_id || m.status === 'completed' || m.status === 'DONE');
        });
        
        return !hasSubsequentMatches;
    }, [userPermissions.canEdit, tournament?.status, matches]);

    // 🎯 ФУНКЦИЯ ПОЛУЧЕНИЯ СОСТАВА КОМАНДЫ ДЛЯ ТУЛТИПА
    const getTeamComposition = useCallback((teamId, teamName) => {
        if (!teamId) return null;
        
        // Ищем команду в mixedTeams или в участниках турнира
        let team = null;
        
        if (mixedTeams && mixedTeams.length > 0) {
            team = mixedTeams.find(t => t.id === teamId);
        }
        
        if (!team && tournament?.teams) {
            team = tournament.teams.find(t => t.id === teamId);
        }
        
        if (!team || !team.members || team.members.length === 0) {
            return null;
        }
        
        return {
            name: team.name || teamName,
            members: team.members.map(member => ({
                name: member.name || member.username || 'Неизвестно',
                rating: member.faceit_elo || member.cs2_premier_rank || null,
                user_id: member.user_id
            }))
        };
    }, [mixedTeams, tournament?.teams]);

    const handleMatchClick = useCallback((matchParam) => {
        const matchId = typeof matchParam === 'object' ? matchParam.id : matchParam;
        
        console.log('🔍 Клик по матчу (Улучшенная логика):', {
            matchParam,
            extractedMatchId: matchId,
            matchParamType: typeof matchParam,
            allMatches: matches.length
        });
        
        // 🔧 КРИТИЧЕСКАЯ ПРОВЕРКА: убеждаемся что matchId не undefined
        if (!matchId && matchId !== 0) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: ID матча undefined или null!', {
                matchParam,
                matchParamType: typeof matchParam,
                objectKeys: typeof matchParam === 'object' ? Object.keys(matchParam) : 'не объект'
            });
            setMessage('❌ Ошибка: не удалось определить ID матча');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        
        // Ищем полные данные матча
        let fullMatchData = matches.find(m => 
            m.id === matchId || String(m.id) === String(matchId) || Number(m.id) === Number(matchId)
        );
        
        // Fallback поиск по альтернативным полям
        if (!fullMatchData && typeof matchParam === 'object') {
            fullMatchData = matches.find(m => 
                m.match_number === matchParam.match_number ||
                (m.round === matchParam.round && m.match_number === matchParam.match_number)
            );
        }
        
        // 🔧 ОБОГАЩАЕМ ДАННЫЕ МАТЧА, ГАРАНТИРУЯ НАЛИЧИЕ ID
        const enrichedMatch = fullMatchData ? {
            ...fullMatchData,
            // 🔧 КРИТИЧЕСКИ ВАЖНО: Убеждаемся что ID всегда присутствует
            id: fullMatchData.id || matchId,
            team1_name: fullMatchData.team1_name || 
                       (typeof matchParam === 'object' && matchParam.participants?.[0]?.name) || 'Команда 1',
            team2_name: fullMatchData.team2_name || 
                       (typeof matchParam === 'object' && matchParam.participants?.[1]?.name) || 'Команда 2'
        } : {
            // 🔧 КРИТИЧЕСКИ ВАЖНО: Fallback с обязательным ID
            id: matchId,
            team1_name: (typeof matchParam === 'object' && matchParam.participants?.[0]?.name) || 'Команда 1',
            team2_name: (typeof matchParam === 'object' && matchParam.participants?.[1]?.name) || 'Команда 2',
            score1: (typeof matchParam === 'object' && matchParam.participants?.[0]?.score) || 0,
            score2: (typeof matchParam === 'object' && matchParam.participants?.[1]?.score) || 0,
            winner_team_id: typeof matchParam === 'object' ? matchParam.winner_id : null,
            maps_data: null,
            // 🔧 ДОБАВЛЯЕМ ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ ДЛЯ СОВМЕСТИМОСТИ
            team1_id: typeof matchParam === 'object' ? matchParam.participants?.[0]?.id : null,
            team2_id: typeof matchParam === 'object' ? matchParam.participants?.[1]?.id : null
        };
        
        // 🔧 ФИНАЛЬНАЯ ПРОВЕРКА ID
        if (!enrichedMatch.id && enrichedMatch.id !== 0) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: enrichedMatch.id по-прежнему undefined!', {
                enrichedMatch,
                originalMatchId: matchId,
                fullMatchData
            });
            setMessage('❌ Критическая ошибка: не удалось определить ID матча для обработки');
            setTimeout(() => setMessage(''), 5000);
            return;
        }
        
        console.log('✅ Данные матча подготовлены для обработки:', {
            id: enrichedMatch.id,
            team1_name: enrichedMatch.team1_name,
            team2_name: enrichedMatch.team2_name,
            hasResults: !!(enrichedMatch.winner_team_id || enrichedMatch.score1 > 0 || enrichedMatch.score2 > 0)
        });
        
        // 🚀 РАСШИРЕННАЯ ЛОГИКА АНАЛИЗА МАТЧА
        const hasResults = enrichedMatch.winner_team_id || 
                          enrichedMatch.winner_id ||
                          (enrichedMatch.score1 > 0 || enrichedMatch.score2 > 0) ||
                          (enrichedMatch.maps_data && enrichedMatch.maps_data.length > 0) ||
                          enrichedMatch.status === 'completed' || 
                          enrichedMatch.status === 'DONE';
        
        const canEdit = canEditMatch(enrichedMatch);
        const hasMapData = enrichedMatch.maps_data && Array.isArray(enrichedMatch.maps_data) && enrichedMatch.maps_data.length > 0;
        const isAdmin = userPermissions.canEdit;
        
        // Получаем составы команд для тултипов
        const team1Composition = getTeamComposition(enrichedMatch.team1_id, enrichedMatch.team1_name);
        const team2Composition = getTeamComposition(enrichedMatch.team2_id, enrichedMatch.team2_name);
        
        console.log('🎯 Детальный анализ матча:', {
            hasResults,
            canEdit,
            hasMapData,
            isAdmin,
            gameSupportsCards: tournament.game === 'Counter-Strike 2' || tournament.game === 'CS2',
            team1Composition: team1Composition?.members?.length || 0,
            team2Composition: team2Composition?.members?.length || 0
        });
        
        // 🎯 СЦЕНАРИЙ 1: Администратор + матч без результата = окно редактирования
        if (isAdmin && !hasResults) {
            console.log('🔧 Сценарий: Администратор открывает окно редактирования для нового матча');
            
            // Добавляем составы команд к данным матча
            const matchWithCompositions = {
                ...enrichedMatch,
                team1_composition: team1Composition,
                team2_composition: team2Composition
            };
            
            console.log('🔧 Передаем в модальное окно матч с ID:', matchWithCompositions.id);
            modals.openMatchResultModal(matchWithCompositions);
            return;
        }
        
        // 🎯 СЦЕНАРИЙ 2: Администратор + матч с результатом = проверяем возможность редактирования
        if (isAdmin && hasResults) {
            if (canEdit) {
                console.log('🔧 Сценарий: Администратор открывает окно редактирования для завершенного матча');
                
                const matchWithCompositions = {
                    ...enrichedMatch,
                    team1_composition: team1Composition,
                    team2_composition: team2Composition
                };
                
                console.log('🔧 Передаем в модальное окно матч с ID:', matchWithCompositions.id);
                modals.openMatchResultModal(matchWithCompositions);
        } else {
                console.log('👁️ Сценарий: Администратор просматривает матч (редактирование недоступно)');
                
                setMessage('ℹ️ Редактирование недоступно - победитель уже участвует в следующих матчах');
                setTimeout(() => setMessage(''), 4000);
                
                // Показываем окно просмотра с кнопкой "Редактировать" (заблокированной)
                const matchWithCompositions = {
                    ...enrichedMatch,
                    team1_composition: team1Composition,
                    team2_composition: team2Composition,
                    editBlocked: true,
                    editBlockReason: 'Победитель уже участвует в следующих матчах'
                };
                
                setSelectedMatch(matchWithCompositions);
            }
            return;
        }
        
        // 🎯 СЦЕНАРИЙ 3: Обычный пользователь + матч без результата = тултип
        if (!isAdmin && !hasResults) {
            console.log('ℹ️ Сценарий: Обычный пользователь пытается посмотреть несыгранный матч');
            
            // Показываем красивое уведомление
            setMessage('⏳ Матч еще не сыгран. Результаты появятся после завершения игры.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        
        // 🎯 СЦЕНАРИЙ 4: Обычный пользователь + матч с результатом = окно просмотра
        if (!isAdmin && hasResults) {
            console.log('👁️ Сценарий: Обычный пользователь просматривает завершенный матч');
            
            const matchWithCompositions = {
                ...enrichedMatch,
                team1_composition: team1Composition,
                team2_composition: team2Composition
            };
            
            setSelectedMatch(matchWithCompositions);
            return;
        }
        
        // 🎯 FALLBACK: Неопределенная ситуация
        console.warn('⚠️ Неопределенная ситуация при клике на матч:', {
            isAdmin, hasResults, canEdit
        });
        
        setMessage('❌ Информация о матче временно недоступна');
        setTimeout(() => setMessage(''), 3000);
        
    }, [matches, modals, userPermissions, tournament, canEditMatch, getTeamComposition]);

    const handleRemoveParticipant = useCallback(async (participantId) => {
        const participant = tournament.participants?.find(p => p.id === participantId);
        const participantName = participant?.name || participant?.username || 'Участник';
        confirmRemoveParticipant(participantId, participantName);
    }, [tournament, confirmRemoveParticipant]);

    const handleTeamsGenerated = useCallback((teams) => {
        console.log('✅ Команды сгенерированы в TournamentDetails:', teams);
        
        // 🎯 ПРЯМО ОБНОВЛЯЕМ СОСТОЯНИЕ КОМАНД БЕЗ ПОЛНОЙ ПЕРЕЗАГРУЗКИ
        setMixedTeams(teams);
        
        // 🎯 НЕ ВЫЗЫВАЕМ reloadTournamentData() чтобы избежать циклических обновлений
        // Команды уже обновлены в состоянии выше
        
        console.log('✅ Состояние команд обновлено без полной перезагрузки турнира');
    }, []); // Убираем reloadTournamentData из зависимостей

    const handleTeamsUpdated = useCallback(() => {
        console.log('✅ Команды обновлены');
        reloadTournamentData(); // Используем стабильную функцию
    }, [reloadTournamentData]);

    // 🎯 ФУНКЦИИ РЕДАКТИРОВАНИЯ ПРАВИЛ И ОПИСАНИЯ ТУРНИРА
    const startEditingRules = useCallback(() => {
        setEditedRules(tournament?.rules || '');
        setIsEditingRules(true);
    }, [tournament?.rules]);

    const cancelEditingRules = useCallback(() => {
        setIsEditingRules(false);
        setEditedRules('');
    }, []);

    const saveRules = useCallback(async () => {
        if (!userPermissions.isAdminOrCreator) {
            setMessage('❌ Недостаточно прав для редактирования правил');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        try {
            setSaveLoading(true);
            const token = localStorage.getItem('token');
            
            await api.patch(`/api/tournaments/${id}`, {
                rules: editedRules
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Правила турнира обновлены!');
            setTimeout(() => setMessage(''), 3000);
            setIsEditingRules(false);
            reloadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка сохранения правил:', error);
            setMessage(`❌ Ошибка сохранения: ${error.response?.data?.message || error.message}`);
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setSaveLoading(false);
        }
    }, [editedRules, userPermissions.isAdminOrCreator, id, reloadTournamentData]);

    const startEditingDescription = useCallback(() => {
        setEditedDescription(tournament?.description || '');
        setIsEditingDescription(true);
    }, [tournament?.description]);

    const cancelEditingDescription = useCallback(() => {
        setIsEditingDescription(false);
        setEditedDescription('');
    }, []);

    const saveDescription = useCallback(async () => {
        if (!userPermissions.isAdminOrCreator) {
            setMessage('❌ Недостаточно прав для редактирования описания');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        try {
            setSaveLoading(true);
            const token = localStorage.getItem('token');
            
            await api.patch(`/api/tournaments/${id}`, {
                description: editedDescription
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Описание турнира обновлено!');
            setTimeout(() => setMessage(''), 3000);
            setIsEditingDescription(false);
            reloadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка сохранения описания:', error);
            setMessage(`❌ Ошибка сохранения: ${error.response?.data?.message || error.message}`);
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setSaveLoading(false);
        }
    }, [editedDescription, userPermissions.isAdminOrCreator, id, reloadTournamentData]);

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

    // 🎯 ЛОГИКА ОТОБРАЖЕНИЯ ПЛАВАЮЩЕЙ ПАНЕЛИ (СИНЕРГИЯ 1+3)
    const shouldShowFloatingPanel = useMemo(() => {
        // Показываем плавающую панель если:
        // 1. Пользователь - админ или создатель турнира
        // 2. НЕ находимся во вкладке "Управление" (чтобы не дублировать AdminPanel)
        // 3. Турнир существует
        return (
            userPermissions.isAdminOrCreator && 
            activeTab !== 'admin' && 
            tournament
        );
    }, [userPermissions.isAdminOrCreator, activeTab, tournament]);

    // 🎯 СОСТОЯНИЯ ЗАГРУЗКИ
    if (loading) {
        return (
            <div className="tournament-details-tournamentdetails tournament-loading">
                <div className="loading-spinner"></div>
                <h2>Загружаем турнир...</h2>
                <div className="loading-details">
                    {dataLoadingStates.tournament && <p>📄 Загрузка данных турнира...</p>}
                    {dataLoadingStates.matches && <p>🏆 Загрузка матчей...</p>}
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

    // 🆕 ФУНКЦИЯ ПЕРЕФОРМИРОВАНИЯ КОМАНД ДЛЯ ПЛАВАЮЩЕЙ ПАНЕЛИ
    const handleReformTeamsFromPanel = async () => {
        // Проверим базовые условия
        if (!tournament || tournament.format !== 'mix' || tournament.status !== 'active') {
            setMessage('❌ Переформирование команд недоступно для данного турнира');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        
        if (matches && matches.length > 0) {
            setMessage('❌ Переформирование недоступно - турнирная сетка уже создана');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        
        if (!mixedTeams || mixedTeams.length === 0) {
            setMessage('❌ Нет команд для переформирования');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        // 🔧 ИСПРАВЛЕНИЕ: Получаем актуальный teamSize из турнира
        const teamSizeFromTournament = parseInt(tournament.team_size) || 5;
        
        // 🔧 ИСПРАВЛЕНИЕ: Для получения актуального ratingType можно использовать localStorage или значение по умолчанию
        const currentRatingType = localStorage.getItem(`tournament_${tournament.id}_ratingType`) || ratingType || 'faceit';

        // Показываем подтверждение
        const confirmed = window.confirm(
            `🔄 Переформировать команды?\n\n` +
            `Это действие полностью пересоздаст все команды на основе текущих участников.\n\n` +
            `Текущее состояние:\n` +
            `• Участников: ${tournament.participants?.length || 0}\n` +
            `• Команд: ${mixedTeams.length}\n` +
            `• Игроков в командах: ${mixedTeams.reduce((total, team) => total + (team.members?.length || 0), 0)}\n` +
            `• Размер команды: ${teamSizeFromTournament} игроков\n` +
            `• Тип рейтинга: ${currentRatingType === 'faceit' ? 'FACEIT ELO' : 'CS2 Premier Rank'}\n\n` +
            `Продолжить?`
        );

        if (!confirmed) return;

        try {
            setMessage('🔄 Переформирование команд...');
            
            console.log('🔄 [FloatingPanel] Переформируем команды:', {
                teamSize: teamSizeFromTournament,
                ratingType: currentRatingType,
                tournamentId: tournament.id,
                participantsCount: tournament.participants?.length,
                currentTeamsCount: mixedTeams.length
            });
            
            const token = localStorage.getItem('token');
            const response = await api.post(`/api/tournaments/${tournament.id}/mix-generate-teams`, {
                ratingType: currentRatingType, // 🔧 ИСПРАВЛЕНИЕ: Передаем актуальный тип рейтинга
                teamSize: teamSizeFromTournament // 🔧 ИСПРАВЛЕНИЕ: Передаем размер команды
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('✅ [FloatingPanel] Ответ сервера:', response.data);

            if (response.data && response.data.teams) {
                console.log('✅ [FloatingPanel] Команды успешно переформированы:', response.data.teams);
                console.log('📊 [FloatingPanel] Сводка:', response.data.summary);
                
                // 🔧 ИСПРАВЛЕНИЕ: Обновляем состояние команд напрямую
                setMixedTeams(response.data.teams);
                
                // Показываем детальную информацию о переформировании
                const summary = response.data.summary;
                let successMessage = '✅ Команды успешно переформированы!';
                if (summary) {
                    successMessage += `\n📊 Создано ${summary.teamsCreated} команд из ${summary.participantsInTeams} участников`;
                    if (summary.participantsNotInTeams > 0) {
                        successMessage += `\n🔍 ${summary.participantsNotInTeams} участников остались вне команд`;
                    }
                    successMessage += `\n🎯 Использован рейтинг: ${summary.ratingType === 'faceit' ? 'FACEIT ELO' : 'CS2 Premier Rank'}`;
                    successMessage += `\n👥 Размер команд: ${teamSizeFromTournament} игроков`;
                }
                
                setMessage(successMessage);
                setTimeout(() => setMessage(''), 5000);
                
                // 🔧 ИСПРАВЛЕНИЕ: НЕ перезагружаем данные турнира чтобы избежать возврата к старым командам
                // setTimeout(() => {
                //     console.log('🔄 [FloatingPanel] Перезагружаем данные турнира...');
                //     reloadTournamentData();
                // }, 500);
                
            } else {
                console.error('❌ [FloatingPanel] Некорректный ответ сервера:', response.data);
                throw new Error('Некорректный ответ сервера - отсутствуют данные команд');
            }
        } catch (error) {
            console.error('❌ [FloatingPanel] Ошибка переформирования команд:', error);
            console.error('❌ [FloatingPanel] Детали ошибки:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseData: error.response?.data,
                stack: error.stack
            });
            
            // 🔧 УЛУЧШЕННАЯ ОБРАБОТКА ОШИБОК
            let errorMessage = 'Не удалось переформировать команды';
            
            if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = `Ошибка: ${error.message}`;
            }
            
            // Если это ошибка недостатка участников, показываем специальное сообщение
            if (errorMessage.includes('Недостаточно участников')) {
                errorMessage += '\n\n💡 Попробуйте добавить больше участников или изменить размер команды.';
            }
            
            setMessage(`❌ ${errorMessage}`);
            setTimeout(() => setMessage(''), 5000);
            
            // 🔧 ИСПРАВЛЕНИЕ: НЕ перезагружаем данные при ошибке, так как это может вернуть старые команды
            // setTimeout(() => {
            //     console.log('🔄 [FloatingPanel] Перезагружаем данные после ошибки для восстановления состояния...');
            //     reloadTournamentData();
            // }, 1000);
        }
    };

    // 🆕 НОВЫЕ ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ АДМИНИСТРАТОРАМИ (переиспользуют хуки)
    const searchUsersForAdmin = async (query) => {
        console.log('🔍 НАЧАЛО ПОИСКА ПОЛЬЗОВАТЕЛЕЙ ДЛЯ АДМИНИСТРИРОВАНИЯ');
        
        if (!query || query.length < 2) {
            console.log('🔍 Запрос слишком короткий, сброс результатов');
            modals.updateAdminSearchResults([]);
            return;
        }

        try {
            console.log('🔍 Устанавливаем состояние загрузки...');
            modals.setAdminSearchLoading(true);
            
            console.log('🔍 Вызываем tournamentManagement.searchUsers с запросом:', query);
            const result = await tournamentManagement.searchUsers(query);
            console.log('🔍 Результат от tournamentManagement.searchUsers:', result);
            
            if (result.success) {
                console.log('🔍 Поиск успешен, полученные данные:', result.data);
                
                // Фильтруем пользователей, которые уже являются администраторами
                const existingAdminIds = tournament?.admins?.map(admin => admin.user_id || admin.id) || [];
                const creatorId = tournament?.creator_id || tournament?.created_by;
                const allAdminIds = [...existingAdminIds, creatorId].filter(Boolean);
                
                console.log('🔍 ID существующих администраторов:', allAdminIds);
                
                const filteredResults = result.data.filter(user => 
                    !allAdminIds.includes(user.id)
                );
                console.log('🔍 Отфильтрованные результаты:', filteredResults);
                
                modals.updateAdminSearchResults(filteredResults);
                console.log('🔍 Найдено пользователей после фильтрации:', filteredResults.length);
                
                if (filteredResults.length === 0 && result.data.length > 0) {
                    setMessage('ℹ️ Найденные пользователи уже являются администраторами');
                    setTimeout(() => setMessage(''), 3000);
                }
            } else {
                console.warn('🔍 Поиск неуспешен:', result.message);
                modals.updateAdminSearchResults([]);
                setMessage(result.message || 'Ошибка при поиске пользователей');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('🔍 Ошибка при поиске пользователей для администрирования:', error);
            modals.updateAdminSearchResults([]);
            setMessage('Ошибка при поиске пользователей');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            modals.setAdminSearchLoading(false);
        }
    };

    const inviteAdmin = async (userId) => {
        try {
            console.log('👑 Отправка приглашения администратора пользователю:', userId);
            
            // Вызываем API для отправки приглашения
            const result = await tournamentManagement.inviteAdmin(userId);
            
            if (result.success) {
                setMessage('✅ Приглашение отправлено! Пользователь получит сообщение в чате.');
                setTimeout(() => setMessage(''), 5000);
                
                // Закрываем модальное окно поиска
                modals.closeAdminSearchModal();
                
                // Обновляем список администраторов если необходимо
                // loadTournamentData(); // При необходимости
            } else {
                setMessage(result.message || 'Ошибка при отправке приглашения');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('Ошибка при приглашении администратора:', error);
            setMessage('Ошибка при отправке приглашения');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    // 🆕 УДАЛЕНИЕ АДМИНИСТРАТОРА
    const removeAdmin = async (userId) => {
        // Подтверждение удаления
        const confirmDelete = window.confirm(
            '⚠️ Вы уверены, что хотите удалить этого администратора?\\n\\n' +
            'Пользователь потеряет все админские права в этом турнире.'
        );
        
        if (!confirmDelete) {
            return;
        }

        try {
            console.log('🗑️ Удаление администратора:', userId);
            
            // Вызываем API для удаления администратора
            const result = await tournamentManagement.removeAdmin(userId);
            
            if (result.success) {
                setMessage('✅ Администратор успешно удален');
                setTimeout(() => setMessage(''), 3000);
                
                // Обновляем данные турнира
                reloadTournamentData();
            } else {
                setMessage(result.message || 'Ошибка при удалении администратора');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('Ошибка при удалении администратора:', error);
            setMessage('Ошибка при удалении администратора');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    // 🎯 РЕНДЕРИНГ КОМПОНЕНТА
    return (
        <TournamentErrorBoundary>
            <section className="tournament-details-tournamentdetails">
                {/* 🎯 ЗАГОЛОВОК ТУРНИРА */}
                <div className="tournament-header-tournamentdetails">
                    <h2>{tournament.name}</h2>
                    
                    {/* Навигация по вкладкам */}
                <nav className="tabs-navigation-tournamentdetails">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-button-tournamentdetails ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                                <span className="tab-label-tournamentdetails">
                                    {tab.icon} {tab.label}
                                </span>
                        </button>
                    ))}
                </nav>
                </div>

                {/* 🎯 КОНТЕНТ ВКЛАДОК */}
                <div className="tournament-content-tournamentdetails">
                    {/* ВКЛАДКА: ИНФОРМАЦИЯ */}
                    {activeTab === 'info' && (
                        <div className="tab-content-tournamentdetails tab-info-tournamentdetails">
                            <div className="tournament-info-horizontal-grid">
                                {/* Основная информация */}
                                <div className="info-main-tournamentdetails">
                                    <div className="info-block-tournamentdetails main-info-block">
                                        <h3>📋 Основная информация</h3>
                                        <div className="tournament-meta-info-tournamentdetails">
                                            <div className="meta-item-tournamentdetails">
                                                <strong>📊 Статус</strong>
                                                <span>{tournament.status === 'active' ? 'Открыт для регистрации' : 
                                                      tournament.status === 'in_progress' ? 'В процессе' :
                                                      tournament.status === 'completed' ? 'Завершен' : 'Создан'}</span>
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>🎮 Игра</strong>
                                                <span>{tournament.game || 'Не указана'}</span>
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>📅 Дата создания</strong>
                                                <span>{new Date(tournament.created_at).toLocaleDateString('ru-RU')}</span>
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>🏆 Формат</strong>
                                                <span>{tournament.format === 'single_elimination' ? 'На выбывание' : 
                                                      tournament.format === 'double_elimination' ? 'Двойное выбывание' : 
                                                      tournament.format === 'mix' ? 'Микс турнир' : tournament.format}</span>
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>👥 Участники</strong>
                                                <span>{tournament.participants?.length || 0} человек</span>
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>🕘 Обновлен</strong>
                                                <span>{new Date(tournament.updated_at).toLocaleDateString('ru-RU')}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Информация о создателе */}
                                        <div className="creator-info-tournamentdetails">
                                            <strong>👤 Создатель турнира</strong>
                                            <div className="creator-display">
                                                <div className="creator-avatar">
                                                    {tournament.creator_avatar_url ? (
                                                        <img 
                                                            src={ensureHttps(tournament.creator_avatar_url)} 
                                                            alt={tournament.creator_name || tournament.creator_username || 'Создатель'}
                                                            onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                        />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {(tournament.creator_name || tournament.creator_username || 'У').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                {tournament.creator_id ? (
                                                    <Link to={`/profile/${tournament.creator_id}`} className="creator-link">
                                                        <span className="creator-name">
                                                            {tournament.creator_name || tournament.creator_username || `ID: ${tournament.creator_id}`}
                                                        </span>
                                                    </Link>
                                                ) : (
                                                    <span className="creator-name">
                                                        {tournament.creator_name || tournament.creator_username || 'Неизвестный создатель'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Описание турнира */}
                                        <div className="tournament-description-section description-block">
                                        <div className="block-header">
                                                <h4>📝 Описание турнира</h4>
                                                {userPermissions.isAdminOrCreator && !isEditingDescription && (
                                                <div className="edit-controls">
                                                        <button 
                                                            className="edit-btn"
                                                            onClick={startEditingDescription}
                                                            disabled={saveLoading}
                                                        >
                                                            ✏️ Редактировать
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {isEditingDescription ? (
                                                <div className="edit-field">
                                                    <textarea
                                                        className="description-editor"
                                                        value={editedDescription}
                                                        onChange={(e) => setEditedDescription(e.target.value)}
                                                        placeholder="Введите описание турнира..."
                                                        rows={5}
                                                        disabled={saveLoading}
                                                    />
                                                        <div className="edit-actions">
                                                            <button 
                                                                className="save-btn"
                                                                onClick={saveDescription}
                                                                disabled={saveLoading}
                                                            >
                                                            {saveLoading ? '⏳ Сохранение...' : '💾 Сохранить'}
                                                            </button>
                                                            <button 
                                                                className="cancel-btn"
                                                                onClick={cancelEditingDescription}
                                                                disabled={saveLoading}
                                                            >
                                                                ❌ Отмена
                                                            </button>
                                                        </div>
                                                </div>
                                            ) : (
                                                <div className="tournament-description-content">
                                                    {tournament.description && tournament.description.trim() ? (
                                                        <div className="tournament-description">
                                                            {tournament.description.split('\n').map((line, index) => (
                                                                <p key={index}>{line}</p>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className={userPermissions.isAdminOrCreator ? "no-description" : "no-description-readonly"}>
                                                            {userPermissions.isAdminOrCreator ? 
                                                                "📝 Нажмите 'Редактировать' чтобы добавить описание турнира" :
                                                                "📝 Описание не добавлено"
                                                            }
                                                </div>
                                            )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Правила турнира */}
                                <div className="info-rules-tournamentdetails">
                                    <div className="info-block-tournamentdetails rules-block">
                                        <div className="block-header">
                                            <h3>📜 Правила турнира</h3>
                                            {userPermissions.isAdminOrCreator && !isEditingRules && (
                                                <div className="edit-controls">
                                                        <button 
                                                            className="edit-btn"
                                                            onClick={startEditingRules}
                                                        disabled={saveLoading}
                                                        >
                                                            ✏️ Редактировать
                                                        </button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="tournament-rules-content">
                                            {isEditingRules ? (
                                                <div className="edit-field">
                                                    <textarea
                                                        className="rules-editor"
                                                        value={editedRules}
                                                        onChange={(e) => setEditedRules(e.target.value)}
                                                        placeholder="Введите правила турнира..."
                                                        rows={10}
                                                        disabled={saveLoading}
                                                    />
                                                        <div className="edit-actions">
                                                            <button 
                                                                className="save-btn"
                                                                onClick={saveRules}
                                                                disabled={saveLoading}
                                                            >
                                                            {saveLoading ? '⏳ Сохранение...' : '💾 Сохранить'}
                                                            </button>
                                                            <button 
                                                                className="cancel-btn"
                                                                onClick={cancelEditingRules}
                                                                disabled={saveLoading}
                                                            >
                                                                ❌ Отмена
                                                            </button>
                                                        </div>
                                                </div>
                                            ) : (
                                                        <div className="rules-text">
                                                    {tournament.rules && tournament.rules.trim() ? (
                                                        tournament.rules.split('\n').map((rule, index) => (
                                                            <div key={index} className="rule-item">
                                                                {rule}
                                                        </div>
                                                        ))
                                                    ) : (
                                                        userPermissions.isAdminOrCreator ? (
                                                            <div 
                                                                className="no-rules-admin"
                                                                onClick={startEditingRules}
                                                            >
                                                                📜 Нажмите здесь чтобы добавить правила турнира
                                                            </div>
                                                        ) : (
                                                            <div className="default-rules">
                                                                    <div className="rule-section">
                                                                    <h4>🎮 Общие правила</h4>
                                                                    <ul>
                                                                        <li>Участники должны соблюдать честную игру</li>
                                                                        <li>Запрещено использование читов и сторонних программ</li>
                                                                        <li>Уважительное отношение к соперникам обязательно</li>
                                                                        </ul>
                                                                    </div>
                                                                    <div className="rule-section">
                                                                    <h4>⏰ Расписание</h4>
                                                                        <ul>
                                                                        <li>Матчи проводятся согласно турнирной сетке</li>
                                                                        <li>В случае неявки засчитывается техническое поражение</li>
                                                                        <li>Время ожидания соперника - 15 минут</li>
                                                                        </ul>
                                                                    </div>
                                                                    <div className="rule-section">
                                                                    <h4>🏆 Результаты</h4>
                                                                    <ul>
                                                                        <li>Результаты матчей вводят администраторы</li>
                                                                        <li>Спорные ситуации решаются администрацией</li>
                                                                        <li>Финальные результаты не подлежат изменению</li>
                                                                        </ul>
                                                                    </div>
                                                            </div>
                                                        )
                                                            )}
                                                        </div>
                                                    )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Секция с турнирной сеткой */}
                            <div className="info-bracket-section">
                                <div className="info-bracket-header">
                                    <h3>🏆 Турнирная сетка</h3>
                                    <div className="bracket-stats">
                                        <span className={`bracket-stat ${tournament.status === 'in_progress' ? 'status-active' : 
                                                        tournament.status === 'completed' ? 'status-completed' : 'status-pending'}`}>
                                            {tournament.status === 'active' && '⏳ Ожидание старта'}
                                            {tournament.status === 'in_progress' && '🔥 В процессе'}
                                            {tournament.status === 'completed' && '✅ Завершен'}
                                        </span>
                                        {matches && matches.length > 0 && (
                                            <span className="bracket-stat">
                                                📊 {matches.length} матчей
                                            </span>
                                        )}
                                        {tournament.participants && tournament.participants.length > 0 && (
                                            <span className="bracket-stat">
                                                👥 {tournament.participants.length} участников
                                            </span>
                                            )}
                                        </div>
                                    </div>
                                
                                {/* Турнирная сетка или пустое состояние */}
                                {bracketGames && bracketGames.length > 0 ? (
                                    <BracketRenderer
                                        games={bracketGames}
                                        canEditMatches={userPermissions.canEdit && tournament.status !== 'completed'}
                                        selectedMatch={selectedMatch}
                                        setSelectedMatch={setSelectedMatch}
                                        handleTeamClick={handleTeamClick}
                                        format={tournament.format}
                                        onMatchClick={handleMatchClick}
                                    />
                                ) : (
                                    <div className="empty-bracket-content">
                                        <div className="empty-bracket-icon">🏆</div>
                                        <h4>Турнирная сетка не создана</h4>
                                        <p>Сетка появится после регистрации участников и её генерации</p>
                                        {userPermissions.isAdminOrCreator && tournament.participants?.length >= 2 && (
                                            <button 
                                                className="generate-bracket-button"
                                                onClick={handleGenerateBracket}
                                            >
                                                🎯 Создать турнирную сетку
                                            </button>
                                        )}
                                </div>
                                )}
                            </div>

                            {/* Секция с победителями на вкладке информации */}
                            {tournament.status === 'completed' && tournamentWinners.winner && (
                                <div className="info-winners-section">
                                    {/* Тот же код что и в результатах, но в другом стиле */}
                                    <div className="winners-section">
                                        <h3>🏆 Призёры турнира</h3>
                                        <div className="winners-podium">
                                            {/* Первое место */}
                                            <div className="winner-card place-1">
                                                <div className="medal-icon gold-medal">🥇</div>
                                                <div className="winner-info">
                                                    {tournamentWinners.winner.type === 'team' ? (
                                                        <div className="team-winner">
                                                            <h4>{tournamentWinners.winner.name}</h4>
                                                            {tournamentWinners.winner.members && Array.isArray(tournamentWinners.winner.members) && tournamentWinners.winner.members.length > 0 && (
                                                                <div className="team-members">
                                                                    <h5>🏆 Участники команды-победителя:</h5>
                                                                    <ul>
                                                                        {tournamentWinners.winner.members.map((member, idx) => {
                                                                            const memberName = member.name || member.username;
                                                                            const formattedName = formatMemberName(memberName);
                                                                            
                                                                            return (
                                                                                <li key={idx} className="team-member winner-member">
                                                                                    <span className="member-medal">🥇</span>
                                                                                    {member.user_id ? (
                                                                                        <Link 
                                                                                            to={`/profile/${member.user_id}`} 
                                                                                            className={`member-name winner-name-link ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                                            title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                                                        >
                                                                                            {formattedName.displayName}
                                                                                        </Link>
                                                                                    ) : (
                                                                                        <span 
                                                                                            className={`member-name winner-name-text ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                                            title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                                                        >
                                                                                            {formattedName.displayName}
                                                                                        </span>
                                                                                    )}
                                                                                    {member.faceit_elo && (
                                                                                        <span className="member-elo">({member.faceit_elo} ELO)</span>
                                                                                    )}
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="solo-winner">
                                                            <Link to={`/profile/${tournamentWinners.winner.user_id}`} className="winner-name">
                                                                <span className="winner-medal">🥇</span>
                                                                {tournamentWinners.winner.name}
                                                            </Link>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Второе и третье место аналогично */}
                                            {tournamentWinners.secondPlace && (
                                                <div className="winner-card place-2">
                                                    <div className="medal-icon silver-medal">🥈</div>
                                                    <div className="winner-info">
                                                        {tournamentWinners.secondPlace.type === 'team' ? (
                                                            <div className="team-winner">
                                                                <h4>{tournamentWinners.secondPlace.name}</h4>
                                                            </div>
                                                        ) : (
                                                            <div className="solo-winner">
                                                                <Link to={`/profile/${tournamentWinners.secondPlace.user_id}`} className="winner-name">
                                                                    <span className="winner-medal">🥈</span>
                                                                    {tournamentWinners.secondPlace.name}
                                                                </Link>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {tournamentWinners.thirdPlace && (
                                                <div className="winner-card place-3">
                                                    <div className="medal-icon bronze-medal">🥉</div>
                                                    <div className="winner-info">
                                                        {tournamentWinners.thirdPlace.type === 'team' ? (
                                                            <div className="team-winner">
                                                                <h4>{tournamentWinners.thirdPlace.name}</h4>
                                                            </div>
                                                        ) : (
                                                            <div className="solo-winner">
                                                                <Link to={`/profile/${tournamentWinners.thirdPlace.user_id}`} className="winner-name">
                                                                    <span className="winner-medal">🥉</span>
                                                                    {tournamentWinners.thirdPlace.name}
                                                                </Link>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                            )}
                                        </div>
                                    )}

                    {/* ВКЛАДКА: УЧАСТНИКИ */}
                    {activeTab === 'participants' && (
                        <div className="tab-content-tournamentdetails">
                            {/* УЧАСТИЕ В ТУРНИРЕ */}
                            {!userPermissions.isParticipating && tournament.status === 'active' && user && (
                                <div className="participation-controls">
                                    <button onClick={handleParticipate} className="participate-btn">
                                        ➕ Участвовать в турнире
                                                </button>
                                    </div>
                                )}

                            {userPermissions.isParticipating && tournament.status === 'active' && (
                                <div className="participation-controls">
                                    <button onClick={handleWithdraw} className="withdraw-btn">
                                        ❌ Отказаться от участия
                                                </button>
                                </div>
                            )}

                            {tournament.status === 'in_progress' && (
                                <div className="bracket-generated-notice">
                                    <p className="info-message">
                                        ℹ️ Турнир уже начался - регистрация и изменение участников недоступны
                                            </p>
                                        </div>
                                    )}

                            {tournament.status === 'completed' && (
                                <div className="bracket-generated-notice">
                                    <p className="info-message">
                                        ✅ Турнир завершен
                                    </p>
                        </div>
                    )}

                            {/* УНИФИЦИРОВАННАЯ ПАНЕЛЬ УЧАСТНИКОВ */}
                            <UnifiedParticipantsPanel
                                tournament={tournament}
                                participants={tournament.participants || []}
                                mixedTeams={mixedTeams}
                                isCreatorOrAdmin={userPermissions.isAdminOrCreator}
                                onAddParticipant={() => modals.openParticipantSearchModal()}
                                onAddUnregistered={() => modals.openAddParticipantModal()}
                                onRemoveParticipant={handleRemoveParticipant}
                                onGenerateTeams={handleTeamsGenerated}
                                onUpdateTeams={handleTeamsUpdated}
                                ratingType={ratingType}
                                setRatingType={setRatingType}
                                displayMode={displayMode}
                                showDisplayModeSelector={true}
                                onDisplayModeChange={handleDisplayModeChange}
                            />
                        </div>
                    )}

                    {/* ВКЛАДКА: СЕТКА */}
                    {activeTab === 'bracket' && (
                        <div className="tab-content-tournamentdetails">
                            <div className="bracket-tab-header">
                                <h3>🏆 Турнирная сетка</h3>
                                {userPermissions.isAdminOrCreator && (
                                    <div className="bracket-controls">
                                        {(!matches || matches.length === 0) && tournament.participants?.length >= 2 && (
                                            <button 
                                                className="generate-bracket-button"
                                                onClick={handleGenerateBracket}
                                            >
                                                🎯 Создать турнирную сетку
                                            </button>
                                        )}
                                        {matches && matches.length > 0 && tournament.status === 'active' && (
                                            <button 
                                                className="regenerate-bracket-button"
                                                onClick={confirmGenerateBracket}
                                            >
                                                🔄 Перегенерировать сетку
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {bracketGames && bracketGames.length > 0 ? (
                                    <BracketRenderer 
                                        games={bracketGames}
                                    canEditMatches={userPermissions.canEdit && tournament.status !== 'completed'}
                                        selectedMatch={selectedMatch}
                                        setSelectedMatch={setSelectedMatch}
                                        handleTeamClick={handleTeamClick}
                                        format={tournament.format}
                                        onMatchClick={handleMatchClick}
                                    />
                            ) : (
                                <div className="empty-state">
                                    <p>🏆 Турнирная сетка еще не создана</p>
                                    {userPermissions.isAdminOrCreator ? (
                                        tournament.participants?.length >= 2 ? (
                                            <>
                                                <p className="text-muted">Нажмите кнопку выше для создания сетки</p>
                                        <button 
                                                    className="generate-bracket-button"
                                            onClick={handleGenerateBracket}
                                        >
                                                    🎯 Создать турнирную сетку
                                        </button>
                                            </>
                                        ) : (
                                        <p className="text-muted">Для создания сетки нужно минимум 2 участника</p>
                                        )
                                    ) : (
                                        <p className="text-muted">Сетка будет создана администраторами</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: РЕЗУЛЬТАТЫ */}
                    {activeTab === 'results' && (
                        <div className="tab-content-tournamentdetails">
                            {(() => {
                                // Фильтруем завершенные матчи с результатами
                                if (!matches || !Array.isArray(matches) || matches.length === 0) {
                                    return (
                                        <div className="empty-state">
                                            <p>🏆 Турнир еще не завершен</p>
                                            <p>Результаты появятся после завершения всех матчей</p>
                                        </div>
                                    );
                                }
                                
                                const completedMatches = matches.filter(match => 
                                    match && (
                                        match.status === 'completed' || match.status === 'DONE' || match.state === 'DONE' ||
                                        match.winner_team_id || match.winner_id ||
                                        (match.score1 !== undefined && match.score2 !== undefined && (match.score1 > 0 || match.score2 > 0))
                                    )
                                );

                                if (completedMatches.length === 0) {
                                    return (
                                        <div className="empty-state">
                                            <p>🏆 Турнир еще не завершен</p>
                                            <p>Результаты появятся после завершения всех матчей</p>
                                        </div>
                                    );
                                }
                                                                        
                                return (
                                    <div className="matches-list">
                                        {completedMatches.map(match => (
                                            <div key={match.id} className="match-item">
                                                <div className="match-info">
                                                    <div className="team-info">
                                                        <div className="team-name">{match.team1_name || 'Команда 1'}</div>
                                                        <div className="team-name">{match.team2_name || 'Команда 2'}</div>
                                                    </div>
                                                    <div className="score-info">
                                                        <div className="score">{match.score1 || 0}</div>
                                                        <div className="score">{match.score2 || 0}</div>
                                                    </div>
                                                </div>
                                                <div className="match-actions">
                                                    <button onClick={() => handleMatchClick(match)}>Подробнее</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* ВКЛАДКА: УПРАВЛЕНИЕ */}
                    {activeTab === 'admin' && userPermissions.isAdminOrCreator && (
                        <div className="tab-content-tournamentdetails">
                            <TournamentAdminPanel
                                tournament={tournament}
                                participants={tournament.participants || []}
                                matches={matches}
                                isCreatorOrAdmin={userPermissions.isAdminOrCreator}
                                isLoading={false}
                                onStartTournament={handleStartTournament}
                                onEndTournament={handleEndTournament}
                                onRegenerateBracket={confirmGenerateBracket}
                                onShowAddParticipantModal={() => modals.openAddParticipantModal()}
                                onShowParticipantSearchModal={() => modals.openParticipantSearchModal()}
                                onRemoveParticipant={handleRemoveParticipant}
                                onEditMatchResult={openMatchResultModal}
                                onGenerateBracket={confirmGenerateBracket}
                                onClearResults={handleClearResults}
                                // 🆕 НОВЫЕ ПРОПСЫ ДЛЯ УПРАВЛЕНИЯ АДМИНИСТРАТОРАМИ
                                onInviteAdmin={inviteAdmin}
                                onRemoveAdmin={removeAdmin}
                                onShowAdminSearchModal={() => modals.openAdminSearchModal()}
                            />
                        </div>
                    )}
                </div>

                {/* 🎯 ЧАТ ТУРНИРА */}
                {user && userPermissions.isParticipating && (
                    <TournamentChat
                        tournamentId={id}
                        user={user}
                        isVisible={true}
                    />
                )}

                {/* 🎯 СООБЩЕНИЯ */}
                {message && (
                    <div className={`message-notification ${message.includes('✅') ? 'success' : 'error'}`}>
                        {message}
                    </div>
                )}

                {/* 🎯 МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ОТКАЗА ОТ УЧАСТИЯ */}
                {showWithdrawConfirmModal && (
                    <div className="modal">
                        <div className="modal-content withdraw-confirm-modal">
                            <div className="modal-header">
                                <h3>⚠️ Предупреждение об отказе от участия</h3>
                                <button 
                                    className="close-btn"
                                    onClick={cancelWithdraw}
                                    title="Закрыть"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            <div className="modal-body">
                                <div className="warning-content">
                                    <div className="warning-icon">⚠️</div>
                                    <div className="warning-text">
                                        <h4>Турнир уже начался!</h4>
                                        <p className="warning-message">
                                            <strong>При отказе от участия вам будет засчитано поражение во всех оставшихся матчах.</strong>
                                        </p>
                                        <p className="warning-details">
                                            Это означает, что:
                                        </p>
                                        <ul className="warning-list">
                                            <li>Все ваши несыгранные матчи будут автоматически проиграны</li>
                                            <li>Соперники получат технические победы</li>
                                            <li>Это повлияет на турнирную сетку и может изменить ход турнира</li>
                                            <li>Действие нельзя будет отменить</li>
                                        </ul>
                                        <p className="confirmation-question">
                                            Вы уверены, что хотите покинуть турнир?
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="modal-footer">
                                <button 
                                    className="btn-cancel"
                                    onClick={cancelWithdraw}
                                >
                                    ❌ Остаться
                                </button>
                                <button 
                                    className="btn-confirm-withdraw"
                                    onClick={confirmWithdrawFromInProgressTournament}
                                >
                                    ⚠️ Покинуть турнир
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🎯 МОДАЛЬНОЕ ОКНО ПОИСКА УЧАСТНИКОВ */}
                <ParticipantSearchModal
                    isOpen={modals.showParticipantSearchModal}
                    onClose={modals.closeParticipantSearchModal}
                    searchQuery={modals.searchQuery}
                    setSearchQuery={modals.setSearchQuery}
                    searchResults={modals.searchResults}
                    isSearching={modals.isSearching}
                    onSearchUsers={searchUsers}
                    onAddParticipant={addRegisteredParticipant}
                    existingParticipants={tournament.participants || []}
                />

                {/* 🎯 МОДАЛЬНОЕ ОКНО ДОБАВЛЕНИЯ НЕЗАРЕГИСТРИРОВАННОГО УЧАСТНИКА */}
                <AddParticipantModal
                    isOpen={modals.showAddParticipantModal}
                    onClose={modals.closeAddParticipantModal}
                    newParticipantData={modals.newParticipantData}
                    setNewParticipantData={modals.setNewParticipantData}
                    onSubmit={addUnregisteredParticipant}
                    isLoading={tournamentManagement.isLoading}
                />

                {/* 🎯 МОДАЛЬНОЕ ОКНО РЕЗУЛЬТАТОВ МАТЧА */}
                <MatchResultModal
                    isOpen={modals.showMatchResultModal}
                    onClose={modals.closeMatchResultModal}
                    selectedMatch={modals.selectedMatch}  // 🔧 ИСПРАВЛЕНО: было match, теперь selectedMatch
                    tournament={tournament}              // 🔧 ДОБАВЛЕНО: передаем турнир для определения игры
                    matchResultData={modals.matchResultData}
                    setMatchResultData={modals.setMatchResultData}
                    onSave={saveMatchResult}
                    isLoading={tournamentManagement.isLoading}
                />

                {/* 🎯 LEGACY МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ */}
                {showConfirmModal && (
                    <div className="modal">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3>{confirmAction.title}</h3>
                                <button 
                                    className="close-btn"
                                    onClick={confirmAction.onCancel}
                                    title="Закрыть"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            <div className="modal-body">
                                <p>{confirmAction.message}</p>
                            </div>
                            
                            <div className="modal-footer">
                                <button 
                                    className="btn-cancel"
                                    onClick={confirmAction.onCancel}
                                >
                                    Отмена
                                </button>
                                <button 
                                    className="btn-confirm"
                                    onClick={confirmAction.onConfirm}
                                >
                                    ✓ Да
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🎯 МОДАЛЬНОЕ ОКНО ПРОСМОТРА ДЕТАЛЕЙ МАТЧА */}
                <MatchDetailsModal
                    isOpen={!!selectedMatch}
                    onClose={() => setSelectedMatch(null)}
                    selectedMatch={selectedMatch}
                    canEdit={userPermissions.canEdit && tournament?.status !== 'completed'}
                    onEdit={(match) => {
                        setSelectedMatch(null);
                        modals.openMatchResultModal(match);
                    }}
                    tournament={tournament}
                />

                {/* 🎯 ПЛАВАЮЩАЯ ПАНЕЛЬ ДЕЙСТВИЙ (СИНЕРГИЯ 1+3) */}
                {shouldShowFloatingPanel && (
                    <TournamentFloatingActionPanel
                        tournament={tournament}
                        user={user}
                        hasAccess={userPermissions.isAdminOrCreator}
                        onStartTournament={handleStartTournament}
                        onEndTournament={handleEndTournament}
                        onGenerateBracket={handleGenerateBracket}
                        onRegenerateBracket={confirmGenerateBracket}
                        onClearResults={handleClearResults}
                        hasMatches={hasMatches}
                        hasBracket={hasBracket}
                        // 🆕 Пропсы для селектора вида отображения участников
                        displayMode={displayMode}
                        onDisplayModeChange={handleDisplayModeChange}
                        showDisplayModeSelector={activeTab === 'participants'}
                        // 🆕 Пропсы для переформирования команд
                        mixedTeams={mixedTeams}
                        onReformTeams={handleReformTeamsFromPanel}
                    />
                )}

                {/* 🆕 МОДАЛЬНОЕ ОКНО ПОИСКА АДМИНИСТРАТОРОВ */}
                <ParticipantSearchModal
                    isOpen={modals.showAdminSearchModal}
                    onClose={modals.closeAdminSearchModal}
                    searchQuery={modals.adminSearchQuery}
                    setSearchQuery={modals.setAdminSearchQuery}
                    searchResults={modals.adminSearchResults}
                    isSearching={modals.isAdminSearching}
                    onSearchUsers={searchUsersForAdmin}
                    onInviteAdmin={inviteAdmin}
                    existingAdmins={tournament?.admins || []}
                    mode="admin"
                />
            </section>
        </TournamentErrorBoundary>
    );
}

export default TournamentDetails;