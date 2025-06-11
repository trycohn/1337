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
    const saveMatchResult = useCallback(async () => {
        if (!modals.selectedMatch) return;

        try {
            const result = await tournamentManagement.saveMatchResult(
                modals.selectedMatch.id,
                modals.matchResultData
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
                hasMatches: !!tournamentData.matches
            });
            
            setTournament(tournamentData);

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

    const handleMatchClick = useCallback((matchParam) => {
        // Определяем ID матча - может прийти как число или как объект с полем id
        const matchId = typeof matchParam === 'object' ? matchParam.id : matchParam;
        
        console.log('🔍 Клик по матчу для просмотра деталей:', matchId);
        console.log('🔍 Тип параметра:', typeof matchParam, ', значение:', matchParam);
        
        // Специальная диагностика для турнира 54
        if (tournament?.id === 54 || tournament?.id === '54') {
            console.log('🎯 СПЕЦИАЛЬНАЯ ДИАГНОСТИКА ТУРНИРА 54:');
            console.log('- ID турнира:', tournament.id);
            console.log('- Игра турнира:', tournament.game);
            console.log('- Все матчи:', matches.length, 'шт.');
            console.log('- Матчи с maps_data:', matches.filter(m => m.maps_data).length, 'шт.');
            matches.filter(m => m.maps_data).forEach((m, i) => {
                console.log(`  Матч ${i + 1} (ID ${m.id}): maps_data =`, m.maps_data);
            });
            
            // Дополнительная диагностика поиска матча
            console.log('🔍 ДИАГНОСТИКА ПОИСКА МАТЧА:');
            console.log('- Ищем матч с ID:', matchId);
            console.log('- Все ID матчей в массиве:', matches.map(m => m.id));
            console.log('- Типы ID в массиве:', matches.map(m => typeof m.id));
            console.log('- Тип искомого ID:', typeof matchId);
        }
        
        // Ищем полные данные матча в исходном массиве matches
        // Пробуем найти как по числовому, так и по строковому ID
        let fullMatchData = matches.find(m => m.id === matchId);
        
        // Если не найден, пробуем преобразовать типы
        if (!fullMatchData) {
            fullMatchData = matches.find(m => 
                String(m.id) === String(matchId) || 
                Number(m.id) === Number(matchId)
            );
        }
        
        // Если все еще не найден и у нас есть объект матча, пробуем по другим полям
        if (!fullMatchData && typeof matchParam === 'object') {
            fullMatchData = matches.find(m => 
                m.match_number === matchParam.match_number ||
                m.number === matchParam.match_number ||
                (m.round === matchParam.round && m.match_number === matchParam.match_number)
            );
        }
        
        if (fullMatchData) {
            console.log('✅ НАЙДЕН МАТЧ В МАССИВЕ!');
            console.log('- Найденный матч ID:', fullMatchData.id);
            console.log('- maps_data найденного матча:', fullMatchData.maps_data);
            
            // Дополнительная диагностика для любого матча
            console.log('📊 ДИАГНОСТИКА ДАННЫХ МАТЧА:');
            console.log('- ID матча:', fullMatchData.id);
            console.log('- maps_data:', fullMatchData.maps_data);
            console.log('- Тип maps_data:', typeof fullMatchData.maps_data);
            console.log('- Длина (если массив):', Array.isArray(fullMatchData.maps_data) ? fullMatchData.maps_data.length : 'N/A');
            console.log('- Содержимое maps_data:', fullMatchData.maps_data);
            
            // ДОПОЛНИТЕЛЬНАЯ ДЕТАЛЬНАЯ ДИАГНОСТИКА СТРУКТУРЫ КАРТ
            if (Array.isArray(fullMatchData.maps_data)) {
                console.log('🗺️ ДЕТАЛЬНАЯ ДИАГНОСТИКА КАРТ:');
                fullMatchData.maps_data.forEach((mapData, index) => {
                    console.log(`Карта ${index + 1}:`, mapData);
                    console.log(`- Все ключи:`, Object.keys(mapData));
                    console.log(`- Название (map):`, mapData.map);
                    console.log(`- Название (name):`, mapData.name);
                    console.log(`- Счет 1 (score1):`, mapData.score1);
                    console.log(`- Счет 2 (score2):`, mapData.score2);
                    console.log(`- Счет команды 1 (team1_score):`, mapData.team1_score);
                    console.log(`- Счет команды 2 (team2_score):`, mapData.team2_score);
                    console.log(`- Объект карты (если есть):`, mapData.map && typeof mapData.map === 'object' ? mapData.map : 'N/A');
                });
            }
            
            // Обогащаем данные матча информацией из game объекта (если был передан объект)
            const enrichedMatch = {
                ...fullMatchData,
                // Добавляем имена команд из переданного объекта, если их нет в полных данных
                team1_name: fullMatchData.team1_name || 
                           (typeof matchParam === 'object' && matchParam.participants?.[0] 
                            ? matchParam.participants[0].name : 'Команда 1'),
                team2_name: fullMatchData.team2_name || 
                           (typeof matchParam === 'object' && matchParam.participants?.[1] 
                            ? matchParam.participants[1].name : 'Команда 2')
            };
            
            console.log('🎯 Устанавливаем selectedMatch:', enrichedMatch);
            setSelectedMatch(enrichedMatch);
        } else {
            console.warn('⚠️ Полные данные матча не найдены в массиве matches');
            console.log('- Параметр матча:', matchParam);
            console.log('- Искомый ID:', matchId);
            console.log('- Доступные ID в matches:', matches.map(m => m.id));
            
            // Все равно показываем модальное окно с доступными данными
            const fallbackMatch = {
                id: matchId,
                team1_name: typeof matchParam === 'object' && matchParam.participants?.[0]?.name || 'Команда 1',
                team2_name: typeof matchParam === 'object' && matchParam.participants?.[1]?.name || 'Команда 2',
                score1: typeof matchParam === 'object' && matchParam.participants?.[0]?.score || 0,
                score2: typeof matchParam === 'object' && matchParam.participants?.[1]?.score || 0,
                winner_team_id: typeof matchParam === 'object' ? matchParam.winner_id : null,
                maps_data: null // Нет данных карт
            };
            
            console.log('🎯 Используем fallback данные:', fallbackMatch);
            setSelectedMatch(fallbackMatch);
        }
    }, [matches, tournament]);

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
                
                // 🔧 ИСПРАВЛЕНИЕ: Перезагружаем данные турнира с задержкой для обновления всех компонентов
                setTimeout(() => {
                    console.log('🔄 [FloatingPanel] Перезагружаем данные турнира...');
                    reloadTournamentData();
                }, 500);
                
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
            
            // 🔧 ИСПРАВЛЕНИЕ: При ошибке все равно перезагружаем данные для восстановления корректного состояния
            setTimeout(() => {
                console.log('🔄 [FloatingPanel] Перезагружаем данные после ошибки для восстановления состояния...');
                reloadTournamentData();
            }, 1000);
        }
    };

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
                            {/* НОВАЯ СТРУКТУРА: Левый столбец (описание + основная информация) + Правый столбец (правила) */}
                            <div className="tournament-info-horizontal-grid">
                                {/* ЛЕВЫЙ СТОЛБЕЦ: Описание + Основная информация */}
                                <div className="info-main-tournamentdetails">
                                    {/* БЛОК ОПИСАНИЯ ТУРНИРА */}
                                    <div className="info-block-tournamentdetails description-block">
                                        <div className="block-header">
                                            <h3>📝 Описание турнира</h3>
                                            {userPermissions.isAdminOrCreator && (
                                                <div className="edit-controls">
                                                    {!isEditingDescription ? (
                                                        <button 
                                                            className="edit-btn"
                                                            onClick={startEditingDescription}
                                                            title="Редактировать описание"
                                                        >
                                                            ✏️ Редактировать
                                                        </button>
                                                    ) : (
                                                        <div className="edit-actions">
                                                            <button 
                                                                className="save-btn"
                                                                onClick={saveDescription}
                                                                disabled={saveLoading}
                                                                title="Сохранить описание"
                                                            >
                                                                {saveLoading ? '⏳' : '💾'} Сохранить
                                                            </button>
                                                            <button 
                                                                className="cancel-btn"
                                                                onClick={cancelEditingDescription}
                                                                disabled={saveLoading}
                                                                title="Отменить редактирование"
                                                            >
                                                                ❌ Отмена
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="tournament-description-content">
                                            {isEditingDescription ? (
                                                <textarea
                                                    className="description-editor"
                                                    value={editedDescription}
                                                    onChange={(e) => setEditedDescription(e.target.value)}
                                                    placeholder="Введите описание турнира..."
                                                    rows={4}
                                                    disabled={saveLoading}
                                                />
                                            ) : (
                                                <>
                                                    {tournament.description ? (
                                                        <p className="tournament-description">{tournament.description}</p>
                                                    ) : (
                                                        <p className="no-description">
                                                            {userPermissions.isAdminOrCreator 
                                                                ? "Нажмите 'Редактировать', чтобы добавить описание турнира" 
                                                                : "Описание не указано"
                                                            }
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* БЛОК ОСНОВНОЙ ИНФОРМАЦИИ */}
                                    <div className="info-block-tournamentdetails main-info-block">
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
                                            {tournament.prize_pool && (
                                                <div className="meta-item-tournamentdetails">
                                                    <strong>💰 Призовой фонд:</strong> {tournament.prize_pool}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ПРАВЫЙ СТОЛБЕЦ: Правила турнира */}
                                <div className="info-rules-tournamentdetails">
                                    <div className="info-block-tournamentdetails rules-block">
                                        <div className="block-header">
                                            <h3>📜 Правила турнира</h3>
                                            {userPermissions.isAdminOrCreator && (
                                                <div className="edit-controls">
                                                    {!isEditingRules ? (
                                                        <button 
                                                            className="edit-btn"
                                                            onClick={startEditingRules}
                                                            title="Редактировать правила"
                                                        >
                                                            ✏️ Редактировать
                                                        </button>
                                                    ) : (
                                                        <div className="edit-actions">
                                                            <button 
                                                                className="save-btn"
                                                                onClick={saveRules}
                                                                disabled={saveLoading}
                                                                title="Сохранить правила"
                                                            >
                                                                {saveLoading ? '⏳' : '💾'} Сохранить
                                                            </button>
                                                            <button 
                                                                className="cancel-btn"
                                                                onClick={cancelEditingRules}
                                                                disabled={saveLoading}
                                                                title="Отменить редактирование"
                                                            >
                                                                ❌ Отмена
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="tournament-rules-content">
                                            {isEditingRules ? (
                                                <textarea
                                                    className="rules-editor"
                                                    value={editedRules}
                                                    onChange={(e) => setEditedRules(e.target.value)}
                                                    placeholder="Введите правила турнира... (каждое правило с новой строки)"
                                                    rows={12}
                                                    disabled={saveLoading}
                                                />
                                            ) : (
                                                <>
                                                    {tournament.rules ? (
                                                        <div className="rules-text">
                                                            {tournament.rules.split('\n').map((rule, index) => (
                                                                rule.trim() && <p key={index} className="rule-item">{rule}</p>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="default-rules">
                                                            {userPermissions.isAdminOrCreator ? (
                                                                <p className="no-rules-admin">
                                                                    Нажмите "Редактировать", чтобы добавить правила турнира
                                                                </p>
                                                            ) : (
                                                                <>
                                                                    <div className="rule-section">
                                                                        <h4>🎯 Общие правила</h4>
                                                                        <ul>
                                                                            <li>Запрещены читы и любые нарушения правил игры</li>
                                                                            <li>Обязательна взаимная вежливость участников</li>
                                                                            <li>Решения администраторов являются окончательными</li>
                                                                        </ul>
                                                                    </div>
                                                                    
                                                                    <div className="rule-section">
                                                                        <h4>⏱️ Временные рамки</h4>
                                                                        <ul>
                                                                            <li>Опоздание на матч более 15 минут = техническое поражение</li>
                                                                            <li>Перерыв между картами не более 5 минут</li>
                                                                        </ul>
                                                                    </div>

                                                                    <div className="rule-section">
                                                                        <h4>🏆 Формат турнира</h4>
                                                                        <ul>
                                                                            <li>Тип: {tournament.format || 'Одиночная элиминация'}</li>
                                                                            <li>Игра: {tournament.game || 'Не указана'}</li>
                                                                            {tournament.max_participants && (
                                                                                <li>Максимум участников: {tournament.max_participants}</li>
                                                                            )}
                                                                        </ul>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Блок с подиумом победителей (только для завершенных турниров) */}
                            {tournament.status === 'completed' && tournamentWinners.winner && (
                                <div className="info-winners-section">
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
                                                            {tournamentWinners.winner.members && (
                                                                <div className="team-members">
                                                                    <h5>🏆 Победители (участники команды):</h5>
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
                                                                                    <span className="member-achievement">- Чемпион турнира</span>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                    <div className="team-achievement">
                                                                        <strong>Каждый участник команды получает статус "Победитель турнира"</strong>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="solo-winner">
                                                            <Link to={`/profile/${tournamentWinners.winner.user_id}`} className="winner-name">
                                                                <span className="winner-medal">🥇</span>
                                                                {tournamentWinners.winner.name}
                                                            </Link>
                                                            <div className="winner-achievement">Чемпион турнира</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Второе место */}
                                            {tournamentWinners.secondPlace && (
                                                <div className="winner-card place-2">
                                                    <div className="medal-icon silver-medal">🥈</div>
                                                    <div className="winner-info">
                                                        {tournamentWinners.secondPlace.type === 'team' ? (
                                                            <div className="team-winner">
                                                                <h4>{tournamentWinners.secondPlace.name}</h4>
                                                                {tournamentWinners.secondPlace.members && (
                                                                    <div className="team-members">
                                                                        <h5>🥈 Серебряные призеры (участники команды):</h5>
                                                                        <ul>
                                                                            {tournamentWinners.secondPlace.members.map((member, idx) => {
                                                                                const memberName = member.name || member.username;
                                                                                const formattedName = formatMemberName(memberName);
                                                                                
                                                                                return (
                                                                                    <li key={idx} className="team-member second-place-member">
                                                                                        <span className="member-medal">🥈</span>
                                                                                        {member.user_id ? (
                                                                                            <Link 
                                                                                                to={`/profile/${member.user_id}`} 
                                                                                                className={`member-name second-place-name-link ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                                                title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                                                            >
                                                                                                {formattedName.displayName}
                                                                                            </Link>
                                                                                        ) : (
                                                                                            <span 
                                                                                                className={`member-name second-place-name-text ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                                                title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                                                            >
                                                                                                {formattedName.displayName}
                                                                                            </span>
                                                                                        )}
                                                                                        <span className="member-achievement">- Серебряный призер</span>
                                                                                    </li>
                                                                                );
                                                                            })}
                                                                        </ul>
                                                                        <div className="team-achievement">
                                                                            <strong>Каждый участник команды получает статус "Серебряный призер"</strong>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="solo-winner">
                                                                <Link to={`/profile/${tournamentWinners.secondPlace.user_id}`} className="winner-name">
                                                                    <span className="winner-medal">🥈</span>
                                                                    {tournamentWinners.secondPlace.name}
                                                                </Link>
                                                                <div className="winner-achievement">Серебряный призер</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Третье место */}
                                            {tournamentWinners.thirdPlace && (
                                                <div className="winner-card place-3">
                                                    <div className="medal-icon bronze-medal">🥉</div>
                                                    <div className="winner-info">
                                                        {tournamentWinners.thirdPlace.type === 'team' ? (
                                                            <div className="team-winner">
                                                                <h4>{tournamentWinners.thirdPlace.name}</h4>
                                                                {tournamentWinners.thirdPlace.members && (
                                                                    <div className="team-members">
                                                                        <h5>🥉 Бронзовые призеры (участники команды):</h5>
                                                                        <ul>
                                                                            {tournamentWinners.thirdPlace.members.map((member, idx) => {
                                                                                const memberName = member.name || member.username;
                                                                                const formattedName = formatMemberName(memberName);
                                                                                
                                                                                return (
                                                                                    <li key={idx} className="team-member third-place-member">
                                                                                        <span className="member-medal">🥉</span>
                                                                                        {member.user_id ? (
                                                                                            <Link 
                                                                                                to={`/profile/${member.user_id}`} 
                                                                                                className={`member-name third-place-name-link ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                                                title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                                                            >
                                                                                                {formattedName.displayName}
                                                                                            </Link>
                                                                                        ) : (
                                                                                            <span 
                                                                                                className={`member-name third-place-name-text ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                                                title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                                                            >
                                                                                                {formattedName.displayName}
                                                                                            </span>
                                                                                        )}
                                                                                        <span className="member-achievement">- Бронзовый призер</span>
                                                                                    </li>
                                                                                );
                                                                            })}
                                                                        </ul>
                                                                        <div className="team-achievement">
                                                                            <strong>Каждый участник команды получает статус "Бронзовый призер"</strong>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="solo-winner">
                                                                <Link to={`/profile/${tournamentWinners.thirdPlace.user_id}`} className="winner-name">
                                                                    <span className="winner-medal">🥉</span>
                                                                    {tournamentWinners.thirdPlace.name}
                                                                </Link>
                                                                <div className="winner-achievement">Бронзовый призер</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Большой блок с турнирной сеткой */}
                            <div className="info-bracket-section">
                                <div className="info-bracket-header">
                                    <h3>🏆 Турнирная сетка</h3>
                                    {matches && matches.length > 0 && (
                                        <div className="bracket-stats">
                                            <span className="bracket-stat">
                                                📊 Матчей: {matches.length}
                                            </span>
                                            <span className="bracket-stat">
                                                ✅ Завершено: {matches.filter(m => 
                                                    m.status === 'completed' || 
                                                    m.status === 'DONE' || 
                                                    m.state === 'DONE' || 
                                                    m.winner_team_id
                                                ).length}
                                            </span>
                                            {tournament.status === 'active' || tournament.status === 'in_progress' ? (
                                                <span className="bracket-stat status-active">
                                                    ⚔️ В процессе
                                                </span>
                                            ) : tournament.status === 'completed' ? (
                                                <span className="bracket-stat status-completed">
                                                    🏁 Завершен
                                                </span>
                                            ) : (
                                                <span className="bracket-stat status-pending">
                                                    ⏳ Ожидание
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

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
                                    <div className="empty-bracket-message">
                                        <div className="empty-bracket-content">
                                            <div className="empty-bracket-icon">🏆</div>
                                            <h4>Сетка турнира еще не создана</h4>
                                            <p>Турнирная сетка будет доступна после создания администратором</p>
                                            {userPermissions.isAdminOrCreator && tournament.status === 'registration' && (
                                                <button 
                                                    className="btn btn-primary generate-bracket-button"
                                                    onClick={handleGenerateBracket}
                                                >
                                                    ⚡ Создать сетку
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Кнопки участия */}
                            {user && tournament.status === 'active' && (
                                <div className="participation-controls">
                                    {(!matches || matches.length === 0) ? (
                                        <>
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
                                        </>
                                    ) : (
                                        <div className="participation-blocked">
                                            <p className="blocked-message">
                                                🚫 Участие заблокировано - сетка уже сгенерирована
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: УЧАСТНИКИ */}
                    {activeTab === 'participants' && (
                        <div className="tab-content-tournamentdetails">
                            <UnifiedParticipantsPanel
                                tournament={tournament}
                                participants={tournament.participants || []}
                                matches={matches}
                                mixedTeams={mixedTeams}
                                isCreatorOrAdmin={userPermissions.isAdminOrCreator}
                                ratingType={ratingType}
                                onRemoveParticipant={handleRemoveParticipant}
                                onShowAddParticipantModal={() => modals.openAddParticipantModal()}
                                onShowParticipantSearchModal={() => modals.openParticipantSearchModal()}
                                onTeamsGenerated={handleTeamsGenerated}
                                onTeamsUpdated={handleTeamsUpdated}
                                calculateTeamAverageRating={calculateTeamAverageRating}
                                // Дополнительные пропсы для полной совместимости
                                setRatingType={setRatingType}
                                user={user}
                                userPermissions={userPermissions}
                                handleParticipate={handleParticipate}
                                setMessage={setMessage}
                                // 🆕 Пропсы для мультивидового отображения
                                displayMode={displayMode}
                                onViewChange={handleDisplayModeChange}
                            />
                        </div>
                    )}

                    {/* ВКЛАДКА: СЕТКА */}
                    {activeTab === 'bracket' && (
                        <div className="tab-content-tournamentdetails">
                            <div className="bracket-tab-header">
                                <h3>🏆 Турнирная сетка</h3>
                                
                                {/* Кнопки управления сеткой */}
                                {userPermissions.isAdminOrCreator && (
                                    <div className="bracket-controls">
                                        {/* Генерация сетки */}
                                        {tournament.status === 'active' && (!matches || matches.length === 0) && tournament.participants?.length >= 2 && (
                                            <button 
                                                className="btn btn-primary generate-bracket-button"
                                                onClick={handleGenerateBracket}
                                                title="Создать турнирную сетку"
                                            >
                                                ⚡ Сгенерировать сетку
                                            </button>
                                        )}

                                        {/* Перегенерация сетки */}
                                        {tournament.status === 'active' && matches && matches.length > 0 && (
                                            <button 
                                                className="btn btn-secondary regenerate-bracket-button"
                                                onClick={handleGenerateBracket}
                                                title="Пересоздать турнирную сетку"
                                            >
                                                🔄 Перегенерировать сетку
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            
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
                                    {userPermissions.isAdminOrCreator && tournament.status === 'active' && tournament.participants?.length >= 2 && (
                                        <button 
                                            className="btn btn-primary generate-bracket-button"
                                            onClick={handleGenerateBracket}
                                        >
                                            ⚡ Создать сетку
                                        </button>
                                    )}
                                    {tournament.participants?.length < 2 && (
                                        <p className="text-muted">Для создания сетки нужно минимум 2 участника</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: РЕЗУЛЬТАТЫ */}
                    {activeTab === 'results' && (
                        <div className="tab-content-tournamentdetails">
                            <h3>📊 Результаты матчей</h3>
                            
                            {(() => {
                                // Расширенная логика определения завершенных матчей
                                const completedMatches = matches.filter(match => 
                                    match.status === 'completed' || 
                                    match.status === 'DONE' || 
                                    match.state === 'DONE' || 
                                    match.winner_team_id || 
                                    match.winner_id ||
                                    (match.score1 !== undefined && match.score2 !== undefined) ||
                                    (match.team1_score !== undefined && match.team2_score !== undefined)
                                );

                                console.log('🎯 Результаты: найдено завершенных матчей:', completedMatches.length, 'из', matches.length);
                                
                                if (completedMatches.length > 0) {
                                    return (
                                        <div className="results-compact-list">
                                            {completedMatches
                                                .sort((a, b) => {
                                                    // Сортируем по раунду (по убыванию) и времени завершения
                                                    const roundA = Number(a.round) || 0;
                                                    const roundB = Number(b.round) || 0;
                                                    if (roundB !== roundA) return roundB - roundA;
                                                    
                                                    const timeA = new Date(a.completed_at || a.updated_at || 0);
                                                    const timeB = new Date(b.completed_at || b.updated_at || 0);
                                                    return timeB - timeA;
                                                })
                                                .map(match => {
                                                    // Извлекаем счет из разных возможных полей
                                                    const score1 = match.score1 !== undefined ? Number(match.score1) : 
                                                                   (match.team1_score !== undefined ? Number(match.team1_score) : 0);
                                                    const score2 = match.score2 !== undefined ? Number(match.score2) : 
                                                                   (match.team2_score !== undefined ? Number(match.team2_score) : 0);
                                                    
                                                    // Определяем победителя
                                                    const winnerId = match.winner_team_id || match.winner_id;
                                                    const team1IsWinner = winnerId === match.team1_id;
                                                    const team2IsWinner = winnerId === match.team2_id;
                                                    
                                                    // Получаем имена команд (для микс турниров может потребоваться поиск по ID)
                                                    let team1Name = match.team1_name || match.participant1_name || 'Команда 1';
                                                    let team2Name = match.team2_name || match.participant2_name || 'Команда 2';
                                                    
                                                    // Если есть ID команд и массив команд, ищем имена
                                                    if (match.team1_id && mixedTeams && mixedTeams.length > 0) {
                                                        const team1 = mixedTeams.find(team => team.id === match.team1_id);
                                                        if (team1) team1Name = team1.name;
                                                    }
                                                    if (match.team2_id && mixedTeams && mixedTeams.length > 0) {
                                                        const team2 = mixedTeams.find(team => team.id === match.team2_id);
                                                        if (team2) team2Name = team2.name;
                                                    }
                                                    
                                                    return (
                                                        <div key={match.id} className="result-compact-item">
                                                            <div className="result-compact-content">
                                                                <div className="result-compact-round">
                                                                    {match.round !== undefined ? (
                                                                        match.round === -1 ? 'Предварительный' : `Раунд ${match.round}`
                                                                    ) : (
                                                                        `Матч ${match.match_number || match.number || match.id}`
                                                                    )}
                                                                    {match.is_third_place_match && (
                                                                        <span className="third-place-indicator">🥉 Матч за 3-е место</span>
                                                                    )}
                                                                    {match.bracket_type === 'grand_final' && (
                                                                        <span className="grand-final-indicator">👑 Гранд-финал</span>
                                                                    )}
                                                                </div>
                                                                <div className="result-compact-match">
                                                                    <button 
                                                                        className={`team-name-btn ${team1IsWinner ? 'winner' : ''}`}
                                                                        onClick={() => handleTeamClick(team1Name)}
                                                                        title={team1IsWinner ? 'Победитель' : ''}
                                                                    >
                                                                        {team1IsWinner && '🏆 '}{team1Name}
                                                                    </button>
                                                                    <span className="match-score">
                                                                        <span className={team1IsWinner ? 'winner-score' : ''}>{score1}</span>
                                                                        <span className="score-separator">:</span>
                                                                        <span className={team2IsWinner ? 'winner-score' : ''}>{score2}</span>
                                                                    </span>
                                                                    <button 
                                                                        className={`team-name-btn ${team2IsWinner ? 'winner' : ''}`}
                                                                        onClick={() => handleTeamClick(team2Name)}
                                                                        title={team2IsWinner ? 'Победитель' : ''}
                                                                    >
                                                                        {team2IsWinner && '🏆 '}{team2Name}
                                                                    </button>
                                                                </div>
                                                                <div className="result-compact-actions">
                                                                    <button 
                                                                        className="details-btn"
                                                                        onClick={() => handleMatchClick(match)}
                                                                        title="Показать детали матча"
                                                                    >
                                                                        🔍 Подробнее
                                                                    </button>
                                                                    {userPermissions.canEdit && tournament.status !== 'completed' && (
                                                                        <button 
                                                                            className="edit-compact-btn"
                                                                            onClick={() => openMatchResultModal(match)}
                                                                            title="Редактировать результат"
                                                                        >
                                                                            ✏️ Изменить
                                                                        </button>
                                                                    )}
                                                                    {match.completed_at && (
                                                                        <span className="match-completed-time">
                                                                            {new Date(match.completed_at).toLocaleString('ru-RU')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="empty-state">
                                            <p>📊 Результатов пока нет</p>
                                            <p>Результаты появятся после завершения матчей</p>
                                            {matches && matches.length > 0 && (
                                                <div className="matches-debug-info">
                                                    <details>
                                                        <summary>🔍 Диагностика матчей ({matches.length} всего)</summary>
                                                        <ul>
                                                            {matches.slice(0, 5).map(match => (
                                                                <li key={match.id}>
                                                                    Матч {match.id}: статус="{match.status}", state="{match.state}", 
                                                                    winner_id={match.winner_team_id || match.winner_id || 'нет'}, 
                                                                    счет={match.score1 || match.team1_score || 0}:{match.score2 || match.team2_score || 0}
                                                                </li>
                                                            ))}
                                                            {matches.length > 5 && <li>... и еще {matches.length - 5} матчей</li>}
                                                        </ul>
                                                    </details>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                            })()}

                            {/* ПОБЕДИТЕЛИ */}
                            {tournament.status === 'completed' && tournamentWinners.winner && (
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
                                                        {tournamentWinners.winner.members && (
                                                            <div className="team-members">
                                                                <h5>🏆 Победители (участники команды):</h5>
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
                                                                                <span className="member-achievement">- Чемпион турнира</span>
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                                <div className="team-achievement">
                                                                    <strong>Каждый участник команды получает статус "Победитель турнира"</strong>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="solo-winner">
                                                        <Link to={`/profile/${tournamentWinners.winner.user_id}`} className="winner-name">
                                                            <span className="winner-medal">🥇</span>
                                                            {tournamentWinners.winner.name}
                                                        </Link>
                                                        <div className="winner-achievement">Чемпион турнира</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Второе место */}
                                        {tournamentWinners.secondPlace && (
                                            <div className="winner-card place-2">
                                                <div className="medal-icon silver-medal">🥈</div>
                                                <div className="winner-info">
                                                    {tournamentWinners.secondPlace.type === 'team' ? (
                                                        <div className="team-winner">
                                                            <h4>{tournamentWinners.secondPlace.name}</h4>
                                                            {tournamentWinners.secondPlace.members && (
                                                                <div className="team-members">
                                                                    <h5>🥈 Серебряные призеры (участники команды):</h5>
                                                                    <ul>
                                                                        {tournamentWinners.secondPlace.members.map((member, idx) => {
                                                                            const memberName = member.name || member.username;
                                                                            const formattedName = formatMemberName(memberName);
                                                                            
                                                                            return (
                                                                                <li key={idx} className="team-member second-place-member">
                                                                                    <span className="member-medal">🥈</span>
                                                                                    {member.user_id ? (
                                                                                        <Link 
                                                                                            to={`/profile/${member.user_id}`} 
                                                                                            className={`member-name second-place-name-link ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                                            title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                                                        >
                                                                                            {formattedName.displayName}
                                                                                        </Link>
                                                                                    ) : (
                                                                                        <span 
                                                                                            className={`member-name second-place-name-text ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                                            title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                                                        >
                                                                                            {formattedName.displayName}
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="member-achievement">- Серебряный призер</span>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                    <div className="team-achievement">
                                                                        <strong>Каждый участник команды получает статус "Серебряный призер"</strong>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="solo-winner">
                                                            <Link to={`/profile/${tournamentWinners.secondPlace.user_id}`} className="winner-name">
                                                                <span className="winner-medal">🥈</span>
                                                                {tournamentWinners.secondPlace.name}
                                                            </Link>
                                                            <div className="winner-achievement">Серебряный призер</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Третье место */}
                                        {tournamentWinners.thirdPlace && (
                                            <div className="winner-card place-3">
                                                <div className="medal-icon bronze-medal">🥉</div>
                                                <div className="winner-info">
                                                    {tournamentWinners.thirdPlace.type === 'team' ? (
                                                        <div className="team-winner">
                                                            <h4>{tournamentWinners.thirdPlace.name}</h4>
                                                            {tournamentWinners.thirdPlace.members && (
                                                                <div className="team-members">
                                                                    <h5>🥉 Бронзовые призеры (участники команды):</h5>
                                                                    <ul>
                                                                        {tournamentWinners.thirdPlace.members.map((member, idx) => {
                                                                            const memberName = member.name || member.username;
                                                                            const formattedName = formatMemberName(memberName);
                                                                            
                                                                            return (
                                                                                <li key={idx} className="team-member third-place-member">
                                                                                    <span className="member-medal">🥉</span>
                                                                                    {member.user_id ? (
                                                                                        <Link 
                                                                                            to={`/profile/${member.user_id}`} 
                                                                                            className={`member-name third-place-name-link ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                                            title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                                                        >
                                                                                            {formattedName.displayName}
                                                                                        </Link>
                                                                                    ) : (
                                                                                        <span 
                                                                                            className={`member-name third-place-name-text ${formattedName.isLongName ? 'member-name-long' : ''}`}
                                                                                            title={formattedName.isTruncated ? formattedName.originalName : undefined}
                                                                                        >
                                                                                            {formattedName.displayName}
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="member-achievement">- Бронзовый призер</span>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                    <div className="team-achievement">
                                                                        <strong>Каждый участник команды получает статус "Бронзовый призер"</strong>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="solo-winner">
                                                            <Link to={`/profile/${tournamentWinners.thirdPlace.user_id}`} className="winner-name">
                                                                <span className="winner-medal">🥉</span>
                                                                {tournamentWinners.thirdPlace.name}
                                                            </Link>
                                                            <div className="winner-achievement">Бронзовый призер</div>
                                                        </div>
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
                            />
                        </div>
                    )}
                </div>

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
                    selectedMatch={modals.selectedMatch}
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
            </section>
        </TournamentErrorBoundary>
    );
}

export default TournamentDetails;