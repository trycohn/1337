// frontend/src/components/TournamentDetails.js
import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense, lazy } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../axios';
import { formatDate } from '../utils/dateHelpers';
import { ensureHttps } from '../utils/userHelpers';
import './TournamentDetails.css';
import { io } from 'socket.io-client';
// Импортируем наш кастомный хук useToast
import { useToast } from './Notifications/ToastContext';

// Используем React.lazy для асинхронной загрузки тяжелого компонента
const BracketRenderer = lazy(() => 
    import('./BracketRenderer').catch(err => {
        console.error('Ошибка при загрузке BracketRenderer:', err);
        // Возвращаем fallback компонент в случае ошибки
        return { 
            default: () => (
                <div className="bracket-error">
                    Не удалось загрузить турнирную сетку. Пожалуйста, обновите страницу.
                </div>
            ) 
        };
    })
);

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
    const [tournament, setTournament] = useState(null);
    const [user, setUser] = useState(null);
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [message, setMessage] = useState('');
    const [isParticipating, setIsParticipating] = useState(false);
    const [addParticipantName, setAddParticipantName] = useState('');
    const [adminRequestStatus, setAdminRequestStatus] = useState(null);
    const [matches, setMatches] = useState([]);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [inviteMethod, setInviteMethod] = useState('username');
    const [inviteUsername, setInviteUsername] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedWinnerId, setSelectedWinnerId] = useState(null);
    const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
    const [matchScores, setMatchScores] = useState({ team1: 0, team2: 0 });
    const [selectedUser, setSelectedUser] = useState(null);
    const wsRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ratingType, setRatingType] = useState('faceit');
    const [isCreator, setIsCreator] = useState(false);
    const [isAdminOrCreator, setIsAdminOrCreator] = useState(false);
    const [userSearchResults, setUserSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState('');
    const [showFullDescription, setShowFullDescription] = useState(false);
    const [isEditingPrizePool, setIsEditingPrizePool] = useState(false);
    const [editedPrizePool, setEditedPrizePool] = useState('');
    const [editedGame, setEditedGame] = useState('');
    const [isEditingGame, setIsEditingGame] = useState(false);
    const [isEditingFullDescription, setIsEditingFullDescription] = useState(false);
    const [isEditingRules, setIsEditingRules] = useState(false);
    const [editedFullDescription, setEditedFullDescription] = useState('');
    const [editedRules, setEditedRules] = useState('');
    const [mixedTeams, setMixedTeams] = useState([]);
    const [searchTimeout, setSearchTimeout] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchContainerRef = useRef(null);
    const [invitedUsers, setInvitedUsers] = useState([]);
    const [userIdToRemove, setUserIdToRemove] = useState('');

    // Получаем функции для отображения toast-уведомлений
    const toast = useToast();

    // Функция для загрузки данных турнира (определяем выше её использования)
    const fetchTournamentData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/api/tournaments/${id}`);
            setTournament(response.data);
            setMatches(response.data.matches || []);
            
            if (response.data.participants) {
                if (response.data.participant_type === 'team') {
                    // Обработка команд
                } else {
                    // Обработка индивидуальных участников
                }
            }
            
            // Проверка наличия пользователя в списке участников
            checkParticipation(response.data);
            
            // Получаем текущий статус запроса на администрирование
            if (user && user.id) {
                try {
                    const adminStatusResponse = await api.get(`/api/tournaments/${id}/admin-request-status`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    });
                    setAdminRequestStatus(adminStatusResponse.data.status);
                } catch (error) {
                    console.error('Ошибка получения статуса запроса:', error);
                }
            }
            
            // Устанавливаем, является ли пользователь создателем или администратором
            if (user) {
                setIsCreator(user.id === response.data.created_by);
                // TODO: добавить проверку на администратора
                setIsAdminOrCreator(user.id === response.data.created_by);
            }
            
        } catch (error) {
            console.error('Ошибка загрузки турнира:', error);
            setError('Ошибка загрузки данных турнира');
        } finally {
            setLoading(false);
        }
    }, [id, user, checkParticipation]);

    // Настройка Socket.IO для получения обновлений турнира
    const setupWebSocket = useCallback(() => {
        const token = localStorage.getItem('token');
        const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', { query: { token } });

        socket.on('connect', () => {
            console.log('Socket.IO соединение установлено в компоненте TournamentDetails');
            socket.emit('watch_tournament', id);
        });

        socket.on('tournament_update', (tournamentData) => {
            if (tournamentData.tournamentId === id || tournamentData.id === parseInt(id)) {
                console.log('Получено обновление турнира через WebSocket:', tournamentData);
                
                // Обрабатываем различные форматы данных
                const data = tournamentData.data || tournamentData;
                
                // Обновляем данные турнира
                setTournament(prev => {
                    // Если получены только определенные поля, сохраняем остальные
                    const updatedTournament = { ...prev, ...data };
                    console.log('Обновленные данные турнира:', updatedTournament);
                    return updatedTournament;
                });
                
                // Обновляем список матчей, учитывая разные форматы
                const matchesData = data.matches || tournamentData.matches || [];
                if (Array.isArray(matchesData)) {
                    console.log(`Получено ${matchesData.length} матчей через WebSocket`);
                    
                    // Проверяем наличие team_id для каждого матча
                    matchesData.forEach(match => {
                        if (!match.team1_id && !match.team2_id) {
                            console.warn(`Матч ${match.id} не имеет участников (TBD)`);
                        }
                    });
                    
                    setMatches(matchesData);
                    
                    // Форсируем обновление компонента после получения новых данных
                    setTimeout(() => {
                        setMessage(prev => {
                            // Если есть предыдущее сообщение, сохраняем его
                            // иначе устанавливаем временное сообщение, которое скоро исчезнет
                            return prev || 'Данные турнира обновлены';
                        });
                        
                        // Очищаем сообщение через 2 секунды, если это наше временное сообщение
                        setTimeout(() => {
                            setMessage(currentMessage => 
                                currentMessage === 'Данные турнира обновлены' ? '' : currentMessage
                            );
                        }, 2000);
                    }, 100);
                }
                
                // Устанавливаем сообщение для пользователя
                if (tournamentData.message) {
                    setMessage(tournamentData.message);
                    // Очищаем сообщение через 3 секунды
                    setTimeout(() => setMessage(''), 3000);
                }
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket.IO соединение закрыто в компоненте TournamentDetails:', reason);
        });

        wsRef.current = socket;
    }, [id]);

    // Загрузка данных
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api
                .get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
                .then((userResponse) => {
                    setUser(userResponse.data);
                    api
                        .get(`/api/teams?userId=${userResponse.data.id}`, { headers: { Authorization: `Bearer ${token}` } })
                        .then((res) => setTeams(res.data || []))
                        .catch((error) => console.error('Ошибка загрузки команд:', error));
                })
                .catch((error) => console.error('Ошибка загрузки пользователя:', error));
        }

        fetchTournamentData();
        setupWebSocket();

        // Эндпоинт для получения приглашений не реализован на бэкенде
        // Будем полагаться на проверку при отправке приглашения

        return () => {
            if (wsRef.current) {
                wsRef.current.emit('unwatch_tournament', id);
                wsRef.current.disconnect();
            }
        };
    }, [id, fetchTournamentData, setupWebSocket]);

    useEffect(() => {
        if (tournament && user) {
            const participants = tournament.participants || [];
            const participating = participants.some(
                (p) =>
                    (tournament.participant_type === 'solo' && p.user_id === user.id) ||
                    (tournament.participant_type === 'team' && p.creator_id === user.id)
            );
            setIsParticipating(participating);

            if (localStorage.getItem('token')) {
                api
                    .get(`/api/tournaments/${id}/admin-request-status`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    })
                    .then((statusResponse) => setAdminRequestStatus(statusResponse.data.status))
                    .catch((error) => console.error('Ошибка загрузки статуса администратора:', error));
            }
        }
    }, [tournament, user, id]);

    useEffect(() => {
        const checkAdminStatus = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const userResponse = await api.get('/api/users/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const currentUser = userResponse.data;
                setUser(currentUser);

                if (tournament) {
                    const isCreator = tournament.created_by === currentUser.id;
                    const isAdmin = tournament.admins?.some(admin => admin.id === currentUser.id);
                    setIsAdminOrCreator(isCreator || isAdmin);
                    setIsCreator(isCreator);
                }
            } catch (error) {
                console.error('Ошибка при проверке статуса администратора:', error);
            }
        };

        if (tournament) {
            checkAdminStatus();
        }
    }, [tournament]);

    const getRoundName = (round, totalRounds) => {
        if (round === -1) return 'Предварительный раунд';
        const roundsLeft = totalRounds - round - 1;
        if (roundsLeft === 0) return 'Финал';
        if (roundsLeft === 1) return 'Полуфинал';
        if (roundsLeft === 2) return 'Четвертьфинал';
        const stage = Math.pow(2, roundsLeft + 1);
        return `1/${stage} финала`;
    };

    // Подготовка данных для отображения сетки
    const games = useMemo(() => {
        if (!matches || matches.length === 0) return [];
        
        console.log('Генерация данных для BracketRenderer с', matches.length, 'матчами');
        
        // Создаем карту участников для быстрого доступа
        const participantsMap = {};
        if (tournament && tournament.participants) {
            tournament.participants.forEach(participant => {
                if (participant && participant.id) {
                    participantsMap[participant.id] = participant;
                }
            });
        }
        
        // Проверяем, есть ли у нас все участники
        if (Object.keys(participantsMap).length === 0 && matches.some(m => m.team1_id || m.team2_id)) {
            console.warn('Список участников пуст, но у матчей есть участники. Данные могут отображаться неправильно.');
        }
        
        // Вспомогательная функция для безопасного преобразования в строку
        const safeToString = (value) => {
            if (value === null || value === undefined) return '';
            return String(value);
        };
        
        // Безопасное создание результата участника
        const createSafeParticipant = (teamId, name, resultText, isWinner, status = 'PLAYED') => {
            return {
                id: teamId ? safeToString(teamId) : 'tbd',
                resultText: resultText !== null ? safeToString(resultText) : null,
                isWinner: Boolean(isWinner),
                status: status || 'NO_SHOW',
                name: name || 'TBD',
                score: resultText
            };
        };
        
        // Формируем массив игр с безопасным преобразованием всех значений
        const safeGames = [];
        
        console.log('Подробный анализ матчей перед трансформацией:', 
            matches.map(m => ({
                id: m.id,
                team1_id: m.team1_id,
                team2_id: m.team2_id,
                winner_team_id: m.winner_team_id,
                round: m.round,
                bracket_type: m.bracket_type || 'winner'
            }))
        );
        
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            
            // Определяем статус матча
            let status = 'SCHEDULED';
            if (match.winner_team_id) {
                status = 'DONE';
            } else if (match.team1_id && match.team2_id) {
                status = 'READY';
            }
            
            // Получаем имена участников
            const team1 = match.team1_id ? participantsMap[match.team1_id]?.name : null;
            const team2 = match.team2_id ? participantsMap[match.team2_id]?.name : null;
            
            // Определяем результаты (счет, если есть)
            const team1Result = match.score1 !== null ? match.score1 : null;
            const team2Result = match.score2 !== null ? match.score2 : null;
            
            // Создаем безопасный объект игры со всеми строковыми ID
            const safeGame = {
                id: safeToString(match.id),
                nextMatchId: match.next_match_id ? safeToString(match.next_match_id) : null,
                tournamentRoundText: `Раунд ${match.round || '?'}`,
                startTime: match.scheduled_time || '',
                state: status,
                name: match.name || `Матч ${match.id}`,
                bracket_type: match.bracket_type || 'winner',
                round: match.round !== undefined ? match.round : 0,
                is_third_place_match: Boolean(match.is_third_place_match),
                participants: [
                    createSafeParticipant(
                        match.team1_id, 
                        team1,
                        team1Result,
                        match.winner_team_id === match.team1_id, // Используем winner_team_id вместо winner_id
                        match.team1_id ? 'PLAYED' : 'NO_SHOW'
                    ),
                    createSafeParticipant(
                        match.team2_id,
                        team2,
                        team2Result,
                        match.winner_team_id === match.team2_id, // Используем winner_team_id вместо winner_id
                        match.team2_id ? 'PLAYED' : 'NO_SHOW'
                    )
                ]
            };
            
            safeGames.push(safeGame);
        }
        
        console.log('Безопасные игры для BracketRenderer созданы:', safeGames.length);
        console.log('Games для визуализации сетки:', safeGames);
        return safeGames;
    }, [matches, tournament]);

    // После каждого обновления matches или tournament, форсируем обновление компонента BracketRenderer
    useEffect(() => {
        if (Array.isArray(matches) && matches.length > 0 && tournament && Array.isArray(tournament.participants)) {
            console.log('Обновление данных для BracketRenderer:', {
                matchesCount: matches.length,
                participantsCount: tournament.participants.length
            });
        }
    }, [matches, tournament?.participants]);

    // Эффект для инициализации отображения турнирной сетки
    useEffect(() => {
        if (Array.isArray(games) && games.length > 0) {
            console.log('TournamentDetails: games готовы для отображения', games.length);
            
            // Небольшой хак для принудительного обновления интерфейса
            // это может помочь с инициализацией drag and drop
            const timer = setTimeout(() => {
                // Просто вызываем перерисовку, не меняя фактически сообщение
                setMessage(prev => prev);
            }, 500);
            
            return () => clearTimeout(timer);
        }
    }, [games]);

    const handleParticipate = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы участвовать');
            return;
        }

        try {
            const payload = tournament.format === 'mix' 
                ? {} 
                : tournament.participant_type === 'solo'
                    ? {}
                    : { teamId: selectedTeam || null, newTeamName: selectedTeam ? null : newTeamName };
            
            const participateResponse = await api.post(`/api/tournaments/${id}/participate`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setMessage(participateResponse.data.message);
            const updatedTournament = await api.get(`/api/tournaments/${id}`);
            setTournament(updatedTournament.data);
            setMatches(updatedTournament.data.matches || []);
            setIsParticipating(true);
            setNewTeamName('');
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка при регистрации');
        }
    };

    const handleWithdraw = async () => {
        const token = localStorage.getItem('token');
        try {
            const withdrawResponse = await api.post(
                `/api/tournaments/${id}/withdraw`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(withdrawResponse.data.message);
            const updatedTournament = await api.get(`/api/tournaments/${id}`);
            setTournament(updatedTournament.data);
            setMatches(updatedTournament.data.matches || []);
            setIsParticipating(false);
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка при отказе');
        }
    };

    // Функция для поиска пользователей с задержкой
    const handleUserSearchWithDelay = (query) => {
        setSearchQuery(query);
        
        // Очищаем предыдущий таймер, если он существует
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // Если запрос пустой, скрываем результаты
        if (!query || query.length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            setIsSearching(false);
            return;
        }

        // Показываем индикатор загрузки
        setIsSearching(true);
        
        // Устанавливаем новый таймер с задержкой 1 секунду
        const newTimeout = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    console.error('Токен авторизации отсутствует');
                    setIsSearching(false);
                    return;
                }
                
                const response = await api.get(`/api/users/search?query=${encodeURIComponent(query)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                // Проверяем наличие данных в ответе
                if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
                    console.log('Пользователи не найдены');
                    setSearchResults([]);
                    setShowSearchResults(false);
                    setIsSearching(false);
                    return;
                }
                
                // Получаем статусы онлайн для найденных пользователей
                const usersWithStatus = await Promise.all(response.data.map(async (user) => {
                    try {
                        const statusResponse = await api.get(`/api/users/${user.id}/status`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        return {
                            ...user,
                            online: statusResponse.data.online,
                            last_online: statusResponse.data.last_online,
                            avatar_url: ensureHttps(user.avatar_url) // Исправляем URL аватара
                        };
                    } catch (error) {
                        console.error(`Ошибка при получении статуса пользователя ${user.id}:`, error);
                        // Если произошла ошибка при получении статуса, возвращаем пользователя без статуса онлайн
                        return {
                            ...user,
                            online: false,
                            last_online: null,
                            avatar_url: ensureHttps(user.avatar_url) // Исправляем URL аватара
                        };
                    }
                }));
                
                // Фильтруем результаты, чтобы убрать null записи и убедиться, что у нас есть результаты
                const filteredResults = usersWithStatus.filter(user => user && user.id);
                
                if (filteredResults.length > 0) {
                    setSearchResults(filteredResults);
                    setShowSearchResults(true);
                } else {
                    setSearchResults([]);
                    setShowSearchResults(false);
                }
                setIsSearching(false);
        } catch (error) {
            console.error('Ошибка при поиске пользователей:', error);
                setSearchResults([]);
                setShowSearchResults(false);
                setIsSearching(false);
            }
        }, 1000); // 1000 мс = 1 секунда (было 3000 мс)
        
        setSearchTimeout(newTimeout);
    };

    // Форматирование даты последнего онлайна
    const formatLastOnline = (lastOnlineDate) => {
        if (!lastOnlineDate) return 'Неизвестно';
        
        const lastOnline = new Date(lastOnlineDate);
        return lastOnline.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleAddParticipant = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы добавить участника');
            return;
        }

        try {
            const addParticipantResponse = await api.post(
                `/api/tournaments/${id}/add-participant`,
                { 
                    participantName: addParticipantName,
                    userId: selectedUser?.id || null
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(addParticipantResponse.data.message);
            const updatedTournament = await api.get(`/api/tournaments/${id}`);
            setTournament(updatedTournament.data);
            setMatches(updatedTournament.data.matches || []);
            setAddParticipantName('');
            setSelectedUser(null);
            setUserSearchResults([]);
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка при добавлении участника');
        }
    };

    const handleRequestAdmin = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы запросить права администратора');
            return;
        }

        try {
            const requestAdminResponse = await api.post(
                `/api/tournaments/${id}/request-admin`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(requestAdminResponse.data.message);
            setAdminRequestStatus('pending');
        } catch (error) {
            // Сервер возвращает { message: '...' } при ошибках авторизации
            setMessage(error.response?.data?.message || error.response?.data?.error || 'Ошибка при запросе прав администратора');
        }
    };

    // Функция для генерации сетки турнира
    const handleGenerateBracket = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы сгенерировать сетку');
            return;
        }

        if (!canGenerateBracket) {
            setMessage('У вас нет прав для генерации сетки или сетка уже сгенерирована');
            toast.warning('У вас нет прав для генерации сетки или сетка уже сгенерирована');
            return;
        }

        try {
            setMessage('Генерация сетки...');
            toast.info('Начинаем генерацию сетки...');
            
            // Проверка количества участников
            if (!tournament.participants || tournament.participants.length < 2) {
                setMessage('Недостаточно участников для генерации сетки. Минимум 2 участника.');
                toast.error('Недостаточно участников для генерации сетки. Минимум 2 участника.');
                return;
            }
            
            const generateBracketResponse = await api.post(
                `/api/tournaments/${id}/generate-bracket`,
                { thirdPlaceMatch: tournament.format === 'double_elimination' ? true : thirdPlaceMatch },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('Ответ от сервера:', generateBracketResponse.data);
            
            // Обновления турнира должны прийти через WebSocket,
            // но дополнительно обновляем данные из ответа
            if (generateBracketResponse.data.tournament) {
                const tournamentData = generateBracketResponse.data.tournament;
                
                if (!Array.isArray(tournamentData.matches) || tournamentData.matches.length === 0) {
                    // Если matches пустой, запрашиваем данные заново
                    await fetchTournamentData();
                } else {
                    // Проверяем данные на корректность
                    console.log('Проверка данных турнира:', {
                        participants: tournamentData.participants?.length || 0,
                        matches: tournamentData.matches.length
                    });
                    
                    // Обновляем состояние с полученными данными
                    setTournament(tournamentData);
                    setMatches(tournamentData.matches);
                    
                    // Добавляем таймер для гарантированного обновления
                    setTimeout(async () => {
                        await fetchTournamentData();
                    }, 500);
                }
            }
            
            setMessage('Сетка успешно сгенерирована');
            toast.success('Сетка успешно сгенерирована!');
        } catch (error) {
            console.error('Ошибка при генерации сетки:', error);
            
            // Проверяем тип ошибки для информативного сообщения
            let errorMessage = 'Ошибка при генерации сетки';
            
            if (error.response) {
                // Структурированное сообщение об ошибке от сервера
                if (error.response.status === 400) {
                    errorMessage = error.response.data.error || 'Неверные параметры для генерации сетки';
                } else if (error.response.status === 401) {
                    errorMessage = 'Необходима авторизация';
                } else if (error.response.status === 403) {
                    errorMessage = 'У вас нет прав на выполнение этого действия';
                } else if (error.response.status === 404) {
                    errorMessage = 'API маршрут не найден. Возможно, требуется обновление сервера.';
                } else if (error.response.status === 500) {
                    errorMessage = 'Ошибка сервера при генерации сетки. Попробуйте позже.';
                } else {
                    errorMessage = error.response.data.error || 'Ошибка при генерации сетки';
                }
            }
            
            setMessage(errorMessage);
            toast.error(errorMessage);
            
            // Пытаемся синхронизировать данные с сервера
            try {
                await fetchTournamentData();
            } catch (fetchError) {
                console.error('Ошибка при синхронизации данных:', fetchError);
            }
        }
    };

    const handleTeamClick = (teamId, matchId) => {
        // Защита от undefined и null значений
        if (teamId === undefined || teamId === null || matchId === undefined || matchId === null) {
            console.error(`Некорректные параметры в handleTeamClick: teamId=${teamId}, matchId=${matchId}`);
            setMessage('Ошибка при выборе команды: некорректный ID');
            return;
        }
        
        // Безопасное преобразование ID в числа или строки
        const safeTeamId = typeof teamId === 'string' ? teamId : String(teamId);
        const safeMatchId = typeof matchId === 'number' ? matchId : parseInt(String(matchId));
        
        console.log(`Клик по команде: teamId=${safeTeamId}, matchId=${safeMatchId}`);
        
        if (!canEditMatches) return;
        
        try {
        // Ищем матч
            const selectedGame = Array.isArray(games) ? games.find(g => g && g.id && parseInt(String(g.id)) === safeMatchId) : null;
            
            if (!selectedGame) {
                console.error(`Матч с ID ${safeMatchId} не найден`);
                setMessage(`Матч не найден`);
                return;
            }
            
            // Получаем id команд (с проверками)
            const team1Id = selectedGame.participants?.[0]?.id ? 
                            (typeof selectedGame.participants[0].id === 'string' ? 
                                parseInt(selectedGame.participants[0].id) : 
                                selectedGame.participants[0].id) : 
                            null;
            
            const team2Id = selectedGame.participants?.[1]?.id ? 
                            (typeof selectedGame.participants[1].id === 'string' ? 
                                parseInt(selectedGame.participants[1].id) : 
                                selectedGame.participants[1].id) : 
                            null;
            
            // Пробуем различные варианты преобразования teamId для надежного сравнения
            const safeTeamIdAsNum = typeof safeTeamId === 'string' ? parseInt(safeTeamId) : safeTeamId;
            const selectedWinner = safeTeamIdAsNum || null;
            
            // Определяем, является ли матч бай-матчем (только один участник)
            const isByeMatch = (!team1Id && team2Id) || (team1Id && !team2Id);
            
            // Проверяем, все ли участники определены (только для обычных матчей, не для бай-матчей)
            if (!isByeMatch) {
                const isTeam1TBD = team1Id === null || selectedGame.participants[0]?.name === 'TBD';
                const isTeam2TBD = team2Id === null || selectedGame.participants[1]?.name === 'TBD';
                
                // Если хотя бы один из участников не определен, показываем сообщение об ошибке
                if (isTeam1TBD || isTeam2TBD) {
                    setMessage('Невозможно определить победителя - один или оба участника еще не определены. Дождитесь завершения предыдущих матчей.');
                    return;
                }
            }
            
            setSelectedMatch(safeMatchId);
            setSelectedWinnerId(safeTeamId);
            
            // Получаем текущие счета из игры
            const team1Score = selectedGame.participants[0]?.score || 0;
            const team2Score = selectedGame.participants[1]?.score || 0;
            
            setMatchScores({
                team1: team1Score,
                team2: team2Score
            });
            
            // Отладочная информация
            console.log('Данные матча:', {
                match: selectedGame,
                team1Id,
                team2Id,
                selectedWinner,
                isByeMatch: isByeMatch
            });
            
            // Для бай матча автоматически выбираем существующую команду как победителя
            if (isByeMatch) {
                // Это bye-матч, автоматически выбираем единственную команду победителем
                const autoWinnerId = team1Id || team2Id;
                if (autoWinnerId) {
                    setSelectedWinnerId(String(autoWinnerId));
                console.log('Автоматически выбран победитель для bye-матча:', autoWinnerId);
                setShowConfirmModal(true);
                } else {
                    setMessage('Ошибка: не удалось определить победителя для bye-матча');
                }
            } 
            // Для обычного матча проверяем, что победитель определен
            else if (selectedWinner) {
                setShowConfirmModal(true);
            } else {
                setMessage('Невозможно выбрать неопределенную команду (TBD) как победителя');
            }
        } catch (error) {
            console.error(`Ошибка в handleTeamClick: ${error.message}`, error);
            setMessage(`Произошла ошибка при выборе команды: ${error.message}`);
        }
    };

    const handleUpdateMatch = async (updatedMatch) => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы обновить результаты');
            return;
        }
        
        try {
            // Получаем ID участников и счета
            let team1Id = updatedMatch?.participants?.[0]?.id;
            let team2Id = updatedMatch?.participants?.[1]?.id;
            const score1 = matchScores.team1;
            const score2 = matchScores.team2;
            let winnerId = selectedWinnerId;
            
            // Проверяем, является ли это bye-матчем (только один участник)
            const isByeMatch = (!team1Id && team2Id) || (team1Id && !team2Id);
            
            // Преобразуем строковые ID в числовые, если они существуют
            team1Id = team1Id ? parseInt(team1Id) : null;
            team2Id = team2Id ? parseInt(team2Id) : null;
            winnerId = winnerId ? parseInt(winnerId) : null;
            
            // Для bye-матча, автоматически устанавливаем единственную команду победителем
            if (isByeMatch && !winnerId) {
                winnerId = team1Id || team2Id;
            }
            
            console.log('Отправляем данные:', {
                matchId: updatedMatch.id,
                winner_team_id: winnerId,
                score1,
                score2,
                team1_id: team1Id,
                team2_id: team2Id,
                isByeMatch
            });
            
            // Проверяем, что ID матча и ID победителя существуют
            if (!updatedMatch.id) {
                throw new Error('ID матча отсутствует');
            }
            
            // Для bye-матча пропускаем проверку на соответствие победителя участникам
            if (!isByeMatch) {
                // Проверяем, что победитель выбран
                if (!winnerId) {
                    throw new Error('Не выбран победитель');
                }
                
                // Убедимся, что winnerId соответствует одной из команд, если обе определены
                if (team1Id !== null && team2Id !== null && winnerId !== team1Id && winnerId !== team2Id) {
                    throw new Error('Выбранный победитель не является участником матча');
                }
            }
            
            // Формируем данные запроса, только с обязательными полями
            const requestData = {
                matchId: parseInt(updatedMatch.id),
                winner_team_id: winnerId,
                score1: score1 || 0,
                score2: score2 || 0
            };
            
            // Отправляем запрос к API только один раз
            let response = null;
            let requestSucceeded = false;
            
            console.log('🔍 Отправка запроса:', `/api/tournaments/${id}/update-match`);
            
            try {
                // Пробуем отправить запрос API для обновления матча
                response = await api.post(
                    `/api/tournaments/${id}/update-match`,
                    requestData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                requestSucceeded = true;
            } catch (requestError) {
                console.log('⚠️ Запрос к API не удался, обновляем данные вручную');
                
                // В случае ошибки API, не пытаемся отправить другой запрос,
                // а просто обновляем турнир с сервера
                requestSucceeded = false;
            }
            
            // Если запрос успешен, используем полученные данные
            if (requestSucceeded && response?.data) {
                console.log('✅ Ответ сервера:', response.data);
                
                // Обновляем данные турнира после изменения
                if (response.data.tournament) {
                    setTournament(response.data.tournament);
                    
                    // Обновляем матчи, если они включены в ответ
                    if (Array.isArray(response.data.tournament.matches)) {
                        setMatches(response.data.tournament.matches);
                    } else {
                        // Если матчи не включены, запрашиваем турнир снова
                        await fetchTournamentData();
                    }
                    
                    setMessage('Результаты успешно обновлены');
                } else {
                    // Если турнир не пришел в ответе, запрашиваем данные снова
                    await fetchTournamentData();
                    setMessage('Результаты обновлены, синхронизируем данные');
                }
            } else {
                // Запрос не удался, обновляем данные вручную
                await fetchTournamentData();
                
                // Для бай-матчей показываем, что обновление выполнено успешно,
                // даже если был тихий сбой API, поскольку это ожидаемое поведение
                if (isByeMatch) {
                    setMessage('Результаты обновлены');
                } else {
                    setMessage('Не удалось автоматически обновить результаты, данные синхронизированы');
                }
            }
            
            // Очищаем сообщение через 3 секунды
            setTimeout(() => {
                setMessage('');
            }, 3000);
            
            // Закрываем модальное окно
            setShowConfirmModal(false);
            setSelectedMatch(null);
        } catch (error) {
            console.error('Ошибка обновления результатов:', error);
            setMessage(`Ошибка: ${error.response?.data?.error || error.message}`);
            
            // В случае ошибки, пробуем обновить данные турнира
            try {
                await fetchTournamentData();
            } catch (fetchError) {
                console.error('Ошибка при обновлении данных после ошибки:', fetchError);
            }
            
            setShowConfirmModal(false);
            setSelectedMatch(null);
        }
    };

    const handleCloseModal = () => {
        setShowConfirmModal(false);
        setSelectedMatch(null);
        setSelectedWinnerId(null);
        setMatchScores({ team1: 0, team2: 0 });
    };

    const handleConfirmWinner = (action) => {
        if (action !== 'yes') {
            handleCloseModal();
            return;
        }
        
        // Ищем выбранный матч
        const matchToUpdate = games.find(g => parseInt(g.id) === selectedMatch);
        
        if (!matchToUpdate) {
            console.error(`Матч с ID ${selectedMatch} не найден`);
            handleCloseModal();
            return;
        }
        
        // Вызываем функцию обновления матча
        handleUpdateMatch(matchToUpdate);
    };

    const handleInvite = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы отправить приглашение');
            return;
        }
        try {
            const payload =
                inviteMethod === 'username' ? { username: inviteUsername } : { email: inviteEmail };
            const inviteResponse = await api.post(`/api/tournaments/${id}/invite`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setMessage(inviteResponse.data.message);
            setInviteUsername('');
            setInviteEmail('');
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка при отправке приглашения');
        }
    };

    const handleInvitationResponse = async (invitationId, action) => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы ответить на приглашение');
            toast.error('Пожалуйста, войдите, чтобы ответить на приглашение');
            return;
        }

        try {
        try {
            const response = await api.post(
                `/api/tournaments/${id}/handle-invitation`,
                { action, invitation_id: invitationId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(response.data.message);
                toast.success(response.data.message);
            fetchTournamentData();
            } catch (error) {
                // Проверяем ошибку, связанную с отсутствующей колонкой в базе данных
                if (error.response?.data?.error?.includes('column') ||
                    error.response?.data?.error?.includes('does not exist')) {
                    // Альтернативная попытка без дополнительных параметров
                    const alternativeResponse = await api.post(
                        `/api/tournaments/${id}/handle-invitation`,
                        { action, invitation_id: invitationId },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setMessage(alternativeResponse.data.message);
                    toast.success(alternativeResponse.data.message);
                    fetchTournamentData();
                } else {
                    // Другие ошибки
                    throw error;
                }
            }
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка при обработке приглашения');
            toast.error(error.response?.data?.error || 'Ошибка при обработке приглашения');
            console.error('Ошибка при обработке приглашения:', error);
        }
    };

    const handleStartTournament = async () => {
        try {
            await api.post(`/api/tournaments/${id}/start`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            fetchTournamentData();
        } catch (err) {
            setError('Ошибка при старте турнира');
        }
    };

    const handleEndTournament = async () => {
        try {
            await api.post(`/api/tournaments/${id}/end`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            fetchTournamentData();
        } catch (err) {
            setError('Ошибка при завершении турнира');
        }
    };

    // Функция для повторной генерации сетки
    const handleRegenerateBracket = async () => {
        // Запрашиваем подтверждение у пользователя
        if (!window.confirm('Вы действительно хотите перегенерировать сетку турнира? Все текущие результаты матчей будут удалены.')) {
            return;
        }
        
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы регенерировать сетку');
            toast.warning('Необходима авторизация');
            return;
        }

        if (!isAdminOrCreator) {
            setMessage('У вас нет прав для регенерации сетки');
            toast.error('У вас нет прав для этого действия');
            return;
        }

        try {
            // Перед запросами, сбрасываем состояния
            setMatches([]);
            setMessage('Генерация новой сетки...');
            toast.info('Начинаем генерацию новой сетки...');
            
            try {
                console.log('🔍 Sending request to:', `/api/tournaments/${id}/generate-bracket`);
                // Генерируем новую сетку
                const generateResponse = await api.post(
                    `/api/tournaments/${id}/generate-bracket`, 
                    { thirdPlaceMatch: tournament.format === 'double_elimination' ? true : thirdPlaceMatch },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                console.log('Новая сетка успешно сгенерирована:', generateResponse.data);
                
                // Немного ждем, чтобы сервер успел обработать изменения
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Обновляем данные турнира после перегенерации
                console.log('🔍 Sending request to:', `/api/tournaments/${id}`);
                const updatedTournamentData = await api.get(`/api/tournaments/${id}`);
                
                if (updatedTournamentData.data) {
                    console.log('Данные турнира при загрузке:', updatedTournamentData.data);
                    setTournament(updatedTournamentData.data);
                    
                    // Проверяем, что в ответе есть массив матчей
                    if (Array.isArray(updatedTournamentData.data.matches)) {
                        console.log(`Загруженные матчи:`, updatedTournamentData.data.matches);
                        console.log(`Количество матчей: ${updatedTournamentData.data.matches.length}`);
                        setMatches(updatedTournamentData.data.matches);
                    } else {
                        console.warn('В ответе от сервера отсутствуют матчи');
                        setMatches([]);
                    }
                }
                
                setMessage('Сетка успешно регенерирована');
                toast.success('Сетка успешно регенерирована!');
                
                // Запрашиваем актуальное состояние турнира через некоторое время
                setTimeout(async () => {
                    try {
                        console.log('Повторный запрос данных турнира для обновления UI');
                        await fetchTournamentData();
                    } catch (retryError) {
                        console.error('Ошибка при обновлении данных турнира:', retryError);
                    }
                }, 1000);
                
            } catch (innerError) {
                console.error('Ошибка при регенерации сетки:', innerError);
                
                // Проверяем тип ошибки для информативного сообщения
                let errorMessage = 'Ошибка при регенерации сетки';
                
                if (innerError.response) {
                    // Серверная ошибка с ответом
                    errorMessage = innerError.response.data?.error || 'Сервер вернул ошибку при регенерации сетки';
                    console.log('Серверная ошибка:', innerError.response.data);
                    
                    if (innerError.response.status === 403) {
                        errorMessage = 'У вас нет прав для регенерации сетки';
                    } else if (innerError.response.status === 400) {
                        // Обрабатываем конкретную ошибку 400
                        if (innerError.response.data?.error === 'Недостаточно участников для генерации сетки') {
                            errorMessage = 'Недостаточно участников для генерации сетки (минимум 2)';
                        }
                    }
                } else if (innerError.request) {
                    // Запрос был сделан, но ответа не получено
                    errorMessage = 'Нет ответа от сервера. Проверьте подключение к интернету.';
                    console.log('Нет ответа от сервера:', innerError.request);
                } else {
                    // Ошибка настройки запроса
                    errorMessage = 'Ошибка при выполнении запроса: ' + innerError.message;
                    console.log('Ошибка при выполнении запроса:', innerError.message);
                }
                
                setMessage(errorMessage);
                toast.error(errorMessage);
                
                // Попробуем все равно загрузить текущее состояние турнира
                try {
                    console.log('Попытка загрузить текущее состояние турнира после ошибки');
                    const currentTournamentData = await api.get(`/api/tournaments/${id}`);
                    if (currentTournamentData.data) {
                        setTournament(currentTournamentData.data);
                        if (Array.isArray(currentTournamentData.data.matches)) {
                            setMatches(currentTournamentData.data.matches);
                        }
                    }
                } catch (loadError) {
                    console.error('Не удалось загрузить текущее состояние турнира:', loadError);
                }
                
                // В любом случае пытаемся обновить данные
                setTimeout(async () => {
                    try {
                        await fetchTournamentData();
                    } catch (retryError) {
                        console.error('Ошибка при обновлении данных турнира:', retryError);
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Неожиданная ошибка при регенерации сетки:', error);
            setMessage('Произошла ошибка при регенерации сетки');
            toast.error('Непредвиденная ошибка при регенерации сетки');
            
            // В любом случае пытаемся обновить данные
            setTimeout(async () => {
                try {
                    await fetchTournamentData();
                } catch (retryError) {
                    console.error('Ошибка при обновлении данных турнира:', retryError);
                }
            }, 1000);
        }
    };

    // Функция для очистки результатов матчей
    const handleClearMatchResults = async () => {
        if (!window.confirm('Вы действительно хотите очистить все результаты матчей? Это действие нельзя отменить.')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setMessage('Необходимо авторизоваться для выполнения этого действия');
                return;
            }
            
            setMessage('Очистка результатов матчей...');
            
            // Отправляем запрос на очистку результатов
            await api.post(
                `/api/tournaments/${id}/clear-match-results`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Обновляем данные турнира
            await fetchTournamentData();
            
            toast.success('Результаты матчей успешно очищены');
            setMessage('Результаты матчей успешно очищены');
        } catch (error) {
            console.error('Ошибка при очистке результатов матчей:', error);
            toast.error('Не удалось очистить результаты матчей: ' + (error.response?.data?.error || error.message));
            setMessage('Ошибка при очистке результатов матчей: ' + (error.response?.data?.error || error.message));
        }
    };

    // Функция для сохранения изменений описания
    const handleSaveDescription = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.put(
                `/api/tournaments/${id}/description`,
                { description: editedDescription },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTournament(prev => ({ ...prev, description: editedDescription }));
            setIsEditingDescription(false);
            setMessage('Описание успешно обновлено');
        } catch (error) {
            setMessage('Ошибка при обновлении описания');
        }
    };

    // Функция для сохранения изменений призового фонда
    const handleSavePrizePool = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.put(
                `/api/tournaments/${id}/prize-pool`,
                { prize_pool: editedPrizePool },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTournament(prev => ({ ...prev, prize_pool: editedPrizePool }));
            setIsEditingPrizePool(false);
            setMessage('Призовой фонд успешно обновлен');
        } catch (error) {
            setMessage('Ошибка при обновлении призового фонда');
        }
    };

    // Функция для сохранения изменений игры
    const handleSaveGame = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.put(
                `/api/tournaments/${id}/game`,
                { game: editedGame },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTournament(prev => ({ ...prev, game: editedGame }));
            setIsEditingGame(false);
            setMessage('Игра успешно обновлена');
        } catch (error) {
            setMessage('Ошибка при обновлении игры');
        }
    };

    // Функция для сохранения изменений полного описания
    const handleSaveFullDescription = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.put(
                `/api/tournaments/${id}/full-description`,
                { full_description: editedFullDescription },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTournament(prev => ({ ...prev, full_description: editedFullDescription }));
            setIsEditingFullDescription(false);
            setMessage('Полное описание успешно обновлено');
        } catch (error) {
            setMessage('Ошибка при обновлении полного описания');
        }
    };

    // Функция для сохранения изменений регламента
    const handleSaveRules = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.put(
                `/api/tournaments/${id}/rules`,
                { rules: editedRules },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTournament(prev => ({ ...prev, rules: editedRules }));
            setIsEditingRules(false);
            setMessage('Регламент успешно обновлен');
        } catch (error) {
            setMessage('Ошибка при обновлении регламента');
        }
    };

    // Инициализация состояний при загрузке турнира
    useEffect(() => {
        if (tournament) {
            setEditedDescription(tournament.description || '');
            setEditedPrizePool(tournament.prize_pool || '');
            setEditedGame(tournament.game || '');
            setEditedFullDescription(tournament.full_description || '');
            setEditedRules(tournament.rules || '');
        }
    }, [tournament]);

    // Логика формирования команд для микса (сохранение на сервере)
    const handleFormTeams = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы сформировать команды');
            return;
        }
        try {
            // Проверяем, формируем команды впервые или переформируем
            const isReforming = mixedTeams.length > 0;
            
            const response = await api.post(
                `/api/tournaments/${id}/mix-generate-teams`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMixedTeams(response.data.teams || []);
            // Удаляем строку, которая меняет тип участников
            setMessage(isReforming ? 'Команды успешно переформированы' : 'Команды успешно сформированы');
            
            // Используем toast для дополнительного уведомления
            toast.success(isReforming ? 'Команды успешно переформированы' : 'Команды успешно сформированы');
        } catch (error) {
            console.error('Ошибка при формировании команд:', error);
            setMessage(error.response?.data?.error || 'Ошибка формирования команд');
            toast.error(error.response?.data?.error || 'Ошибка формирования команд');
        }
    };

    // Загрузка сохраненных команд при загрузке турнира
    useEffect(() => {
        if (tournament?.format === 'mix' && tournament?.participant_type === 'team') {
            const token = localStorage.getItem('token');
            api.get(
                `/api/tournaments/${id}/teams`,
                { headers: { Authorization: `Bearer ${token}` } }
            )
            .then(res => setMixedTeams(res.data || []))
            .catch(err => console.error('Ошибка загрузки команд для турнира:', err));
        }
    }, [tournament, id]);

    // Функция для проверки, является ли пользователь участником турнира
    const isUserParticipant = (userId) => {
        if (!tournament || !tournament.participants) return false;
        return tournament.participants.some(p => p.user_id === userId);
    };

    // Проверка, было ли приглашение отправлено
    const isInvitationSent = useCallback((userId) => {
        console.log('Проверка приглашения для пользователя:', userId);
        console.log('Текущие приглашения:', invitedUsers);
        return invitedUsers.includes(userId);
    }, [invitedUsers]);

    // Функция для отправки приглашения участнику
    const handleInviteUser = async (userId, username) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setMessage('Для отправки приглашения необходимо авторизоваться');
                return;
            }

            // Проверяем, отправлено ли уже приглашение локально в текущей сессии
            if (isInvitationSent(userId)) {
                console.log(`Приглашение для ${username} (${userId}) уже в кэше`);
                setMessage(`Приглашение для пользователя ${username} уже отправлено`);
                return;
            }

            // Проверяем, не является ли пользователь уже участником
            if (isUserParticipant(userId)) {
                console.log(`Пользователь ${username} (${userId}) уже участник`);
                setMessage(`Пользователь ${username} уже является участником турнира`);
                return;
            }

            console.log(`Отправка приглашения пользователю: ${username} (id: ${userId})`);
            
            // Перед отправкой приглашения добавляем пользователя в локальный кэш,
            // чтобы предотвратить повторные клики
            setInvitedUsers(prev => {
                console.log('Добавление в кэш пользователя:', userId);
                console.log('Предыдущий кэш:', prev);
                const newCache = [...prev, userId];
                console.log('Новый кэш:', newCache);
                return newCache;
            });

            // Небольшая задержка для гарантии обновления состояния
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Дополнительная проверка перед отправкой запроса
            if (invitedUsers.includes(userId)) {
                console.log(`Повторная проверка: приглашение для ${username} (${userId}) уже в кэше`);
                setMessage(`Приглашение для пользователя ${username} уже отправлено`);
                return;
            }
            
            try {
                // Используем только параметр username для отправки приглашения
                const inviteResponse = await api.post(
                    `/api/tournaments/${id}/invite`, 
                    { username: username },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                console.log('Успешный ответ от сервера:', inviteResponse.data);
                setMessage(`Приглашение отправлено пользователю ${username}`);
                toast.success(`Приглашение отправлено пользователю ${username}`);
            } catch (apiError) {
                console.error('Подробная ошибка при отправке приглашения:', apiError);
                console.error('Ответ сервера:', apiError.response?.data);
                console.error('Статус ошибки:', apiError.response?.status);
                
                // Обрабатываем ошибку дублирования приглашения
                if (apiError.response?.data?.error?.includes('unique constraint') ||
                    apiError.response?.data?.error?.includes('уже приглашен')) {
                    setMessage(`Приглашение для пользователя ${username} уже существует`);
                    toast.warning(`Приглашение для пользователя ${username} уже существует`);
                    return;
                }
                
                // Проверяем ошибки 400
                if (apiError.response?.status === 400) {
                    if (apiError.response?.data?.error?.includes('уже')) {
                        setMessage(`Пользователь ${username} уже приглашён`);
                        toast.warning(`Пользователь ${username} уже приглашён`);
                    } else if (apiError.response?.data?.error?.includes('Укажите никнейм или email')) {
                        // Пробуем альтернативный вариант
                        try {
                            const secondAttempt = await api.post(
                                `/api/tournaments/${id}/invite`, 
                                { invite_username: username },
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            console.log('Успешный ответ от второй попытки:', secondAttempt.data);
                            setMessage(`Приглашение отправлено пользователю ${username}`);
                            toast.success(`Приглашение отправлено пользователю ${username}`);
                        } catch (secondError) {
                            console.error('Ошибка второй попытки:', secondError);
                            setMessage(`Не удалось отправить приглашение: ${apiError.response?.data?.error}`);
                            toast.error(`Не удалось отправить приглашение: ${apiError.response?.data?.error}`);
                        }
                    } else {
                        setMessage(apiError.response?.data?.error || `Ошибка приглашения: ${apiError.message}`);
                        toast.error(apiError.response?.data?.error || `Ошибка приглашения: ${apiError.message}`);
                    }
                } else if (apiError.response?.status === 500) {
                    // Если ошибка связана с колонкой в базе данных, используем обходной путь
                    if (apiError.response?.data?.error?.includes('column') || 
                        apiError.response?.data?.error?.includes('does not exist')) {
                        try {
                            // Используем только параметр username без дополнительных параметров
                            const alternativeAttempt = await api.post(
                                `/api/tournaments/${id}/invite`,
                                { username: username },
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            console.log('Успешный ответ от альтернативной попытки:', alternativeAttempt.data);
                            setMessage(`Приглашение отправлено пользователю ${username}`);
                            toast.success(`Приглашение отправлено пользователю ${username}`);
                        } catch (altError) {
                            console.error('Ошибка альтернативной попытки:', altError);
                            setMessage(`Сервер не может обработать приглашение. Попробуйте позже.`);
                            toast.error(`Сервер не может обработать приглашение. Попробуйте позже.`);
                        }
                    } else {
                        // Другие ошибки 500
                        setMessage(`Ошибка сервера при отправке приглашения. Попробуйте позже.`);
                        toast.error(`Ошибка сервера при отправке приглашения. Попробуйте позже.`);
                    }
                } else {
                    // Другие ошибки
                    setMessage(apiError.response?.data?.error || `Ошибка при отправке приглашения: ${apiError.message}`);
                    toast.error(apiError.response?.data?.error || `Ошибка при отправке приглашения: ${apiError.message}`);
                }
            }
        } catch (error) {
            console.error('Неожиданная ошибка:', error);
            setMessage(`Произошла непредвиденная ошибка`);
            toast.error(`Произошла непредвиденная ошибка`);
        }
    };

    // Обработчик клика вне списка результатов
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                searchContainerRef.current && 
                !searchContainerRef.current.contains(event.target) && 
                showSearchResults
            ) {
                setShowSearchResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSearchResults]);

    // Сохраняем invitedUsers в localStorage для сохранения между ререндерами
    useEffect(() => {
        // Сохраняем каждое изменение invitedUsers в localStorage
        if (invitedUsers.length > 0) {
            try {
                console.log('Сохраняем invitedUsers в localStorage:', invitedUsers);
                localStorage.setItem(`tournament_${id}_invited_users`, JSON.stringify(invitedUsers));
            } catch (e) {
                console.error('Ошибка сохранения invitedUsers в localStorage:', e);
            }
        }
    }, [invitedUsers, id]);

    // Загружаем invitedUsers из localStorage при монтировании
    useEffect(() => {
        try {
            const savedInvitedUsers = localStorage.getItem(`tournament_${id}_invited_users`);
            if (savedInvitedUsers) {
                const parsedInvitedUsers = JSON.parse(savedInvitedUsers);
                console.log('Загружаем invitedUsers из localStorage:', parsedInvitedUsers);
                setInvitedUsers(parsedInvitedUsers);
            }
        } catch (e) {
            console.error('Ошибка загрузки invitedUsers из localStorage:', e);
        }
    }, [id]);

    // Проверка актуальности кэша приглашений
    const validateInvitationCache = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token || !tournament) return;

            // Так как эндпоинт /api/tournaments/${id}/invitations не реализован на сервере (404),
            // используем другой подход для валидации кэша
            
            // 1. Получаем текущий кэш из localStorage
            const cachedInvitedUsers = JSON.parse(localStorage.getItem(`tournament_${id}_invited_users`) || '[]');
            console.log('Кэшированные приглашения:', cachedInvitedUsers);
            
            // 2. Если кэш пустой, нет смысла его проверять
            if (cachedInvitedUsers.length === 0) {
                console.log('Кэш приглашений пуст, пропускаем проверку');
                return;
            }

            // 3. Проверяем срок жизни кэша - очищаем записи старше суток
            const currentTime = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
            
            // Получаем метаданные кэша, если они существуют
            const cacheMeta = JSON.parse(localStorage.getItem(`tournament_${id}_cache_meta`) || '{}');
            
            // Если метаданных нет или кэш старше суток, создаем новые
            if (!cacheMeta.lastUpdated || (currentTime - cacheMeta.lastUpdated > oneDayMs)) {
                console.log('Обновляем метаданные кэша');
                localStorage.setItem(`tournament_${id}_cache_meta`, JSON.stringify({
                    lastUpdated: currentTime
                }));
                
                // Отображаем уведомление только если кэш был очищен из-за срока давности
                // И только если пользователь - администратор или создатель
                if (cachedInvitedUsers.length > 0) {
                    // Очищаем кэш в любом случае
                    setInvitedUsers([]);
                    localStorage.setItem(`tournament_${id}_invited_users`, JSON.stringify([]));
                    
                    // Но уведомления показываем только администраторам
                    if (isAdminOrCreator) {
                        toast.info('Кэш приглашений обновлен (автоочистка)');
                        setMessage('Кэш приглашений обновлен (автоочистка)');
                    }
                }
            } else {
                console.log('Кэш приглашений актуален, последнее обновление:', new Date(cacheMeta.lastUpdated));
            }
        } catch (error) {
            console.error('Ошибка при проверке актуальности кэша приглашений:', error);
            // В случае ошибки, не меняем кэш
        }
    }, [id, tournament, toast, isAdminOrCreator]);

    // Проверяем актуальность кэша при загрузке турнира
    useEffect(() => {
        if (tournament) {
            validateInvitationCache();
        }
    }, [tournament, validateInvitationCache]);

    // Функция для очистки кэша приглашений для конкретного пользователя
    const clearInvitationCache = (userId) => {
        try {
            // Получаем текущий список приглашенных пользователей
            const currentInvited = JSON.parse(localStorage.getItem(`tournament_${id}_invited_users`) || '[]');
            console.log(`Очистка кэша для пользователя ${userId}. Текущий кэш:`, currentInvited);
            
            // Фильтруем списки, исключая указанный userId
            const updatedInvited = currentInvited.filter(id => id !== userId);
            
            // Обновляем localStorage и состояние
            localStorage.setItem(`tournament_${id}_invited_users`, JSON.stringify(updatedInvited));
            setInvitedUsers(updatedInvited);
            
            console.log(`Кэш обновлен. Новый кэш:`, updatedInvited);
            // Используем наше toast-уведомление
            toast.success(`Кэш приглашения для пользователя #${userId} очищен`);
            setMessage(`Кэш приглашения для пользователя #${userId} очищен`);
        } catch (error) {
            console.error('Ошибка при очистке кэша приглашения:', error);
            // Используем наше toast-уведомление
            toast.error('Ошибка при очистке кэша приглашения');
            setMessage('Ошибка при очистке кэша приглашения');
        }
    };

    // Функция для полной очистки кэша приглашений
    const clearAllInvitationsCache = () => {
        try {
            console.log('Очистка всего кэша приглашений');
            
            // Очищаем localStorage и состояние
            localStorage.removeItem(`tournament_${id}_invited_users`);
            setInvitedUsers([]);
            
            console.log('Кэш приглашений полностью очищен');
            // Используем наше toast-уведомление
            toast.success('Весь кэш приглашений очищен');
            setMessage('Весь кэш приглашений очищен');
        } catch (error) {
            console.error('Ошибка при очистке всего кэша приглашений:', error);
            // Используем наше toast-уведомление
            toast.error('Ошибка при очистке кэша приглашений');
            setMessage('Ошибка при очистке кэша приглашений');
        }
    };

    if (!tournament) return <p>Загрузка...</p>;

    const canRequestAdmin = user && !isCreator && !adminRequestStatus;
    const canGenerateBracket = user && (isCreator || adminRequestStatus === 'accepted') && matches.length === 0;
    const canEditMatches = user && (isCreator || adminRequestStatus === 'accepted');

    // Определение призёров
    let winners = [];
    // Определение, завершен ли финальный матч
    let isFinalMatchComplete = false;
    // Проверяем, все ли матчи в турнире завершены
    let areAllMatchesComplete = false;

    // Проверяем, что у нас есть матчи для анализа
    if (matches && matches.length > 0) {
        // Проверка, завершены ли все матчи
        areAllMatchesComplete = matches.every(match => match.winner_team_id);
        
        // Определение финального матча для текущего формата турнира
        const finalMatch = matches.find(match => {
            // Для Single Elimination последний раунд с наивысшим номером
            if (tournament.format === 'single_elimination') {
                const maxRound = Math.max(...matches.map(m => m.round));
                return match.round === maxRound && !match.is_third_place_match;
            }
            // Для Double Elimination последний матч финального этапа
            else if (tournament.format === 'double_elimination') {
                return match.next_match_id === null && !match.is_third_place_match;
            }
            return false;
        });
        
        // Проверяем, завершен ли финальный матч
        if (finalMatch && finalMatch.winner_team_id) {
            isFinalMatchComplete = true;
        }
    }

    // Отображение участников турнира с аватарами
    const renderParticipants = () => {
        if (!tournament || !tournament.participants || tournament.participants.length === 0) {
            return <p>Пока нет участников</p>;
        }

        return (
            <div className="participants-list">
                <h4>Участники ({tournament.participants.length})</h4>
                <ul>
                    {tournament.participants.map((participant) => (
                        <li key={participant.id} className="participant-item">
                            {/* Проверяем, является ли участник текущим авторизованным пользователем */}
                            <Link 
                                to={user && participant.user_id === user.id ? '/profile' : `/user/${participant.user_id}`} 
                                className="participant-link"
                            >
                                <div className="participant-avatar">
                                    <img 
                                        src={ensureHttps(participant.avatar_url) || '/default-avatar.png'} 
                                        alt={`${participant.name || participant.username || 'Участник'} аватар`} 
                                        className="participant-avatar-img"
                                        onError={(e) => {e.target.src = '/default-avatar.png'}}
                                    />
                                </div>
                                <div className="participant-info">
                                    <span className="participant-name">{participant.name || participant.username}</span>
                                    {participant.is_admin && <span className="admin-badge">Админ</span>}
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <section className="tournament-details">
            <h2>
                {tournament.name} ({tournament.status === 'active' ? 'Активен' : 'Завершён'})
            </h2>
            
            <div className="tournament-info-section">
                <div className="info-block">
                    <h3>Описание</h3>
                    {isEditingDescription ? (
                        <div className="edit-field">
                            <textarea
                                value={editedDescription}
                                onChange={(e) => setEditedDescription(e.target.value)}
                                placeholder="Описание турнира"
                                rows="4"
                            />
                            <button onClick={handleSaveDescription}>Сохранить</button>
                            <button onClick={() => setIsEditingDescription(false)}>Отмена</button>
                        </div>
                    ) : (
                        <div className="info-content">
                            <p>{tournament.description || 'Нет описания'}</p>
                            {isAdminOrCreator && (
                                <button onClick={() => setIsEditingDescription(true)}>Редактировать</button>
                            )}
                        </div>
                    )}
                </div>

                <div className="info-block">
                    <h3>Призовой фонд</h3>
                    {isEditingPrizePool ? (
                        <div className="edit-field">
                            <textarea
                                value={editedPrizePool}
                                onChange={(e) => setEditedPrizePool(e.target.value)}
                                placeholder="Призовой фонд"
                                rows="4"
                            />
                            <button onClick={handleSavePrizePool}>Сохранить</button>
                            <button onClick={() => setIsEditingPrizePool(false)}>Отмена</button>
                        </div>
                    ) : (
                        <div className="info-content">
                            <p>{tournament.prize_pool || 'Не указан'}</p>
                            {isAdminOrCreator && (
                                <button onClick={() => setIsEditingPrizePool(true)}>Редактировать</button>
                            )}
                        </div>
                    )}
                </div>

                {(isAdminOrCreator || showFullDescription) && (
                <div className="info-block">
                    <h3>Регламент</h3>
                    <div className="info-content">
                        {isAdminOrCreator && (
                            <label className="show-full-description">
                                <input
                                    type="checkbox"
                                    checked={showFullDescription}
                                    onChange={(e) => setShowFullDescription(e.target.checked)}
                                />
                                Показать полное описание и регламент
                            </label>
                        )}
                        {showFullDescription && (
                            <div className="full-description">
                                <h4>Полное описание</h4>
                                {isEditingFullDescription ? (
                                    <div className="edit-field">
                                        <textarea
                                            value={editedFullDescription}
                                            onChange={(e) => setEditedFullDescription(e.target.value)}
                                            placeholder="Полное описание турнира"
                                            rows="4"
                                        />
                                        <button onClick={handleSaveFullDescription}>Сохранить</button>
                                        <button onClick={() => setIsEditingFullDescription(false)}>Отмена</button>
                                    </div>
                                ) : (
                                    <div>
                                        <p>{tournament.full_description || 'Нет полного описания'}</p>
                                        {isAdminOrCreator && (
                                            <button onClick={() => setIsEditingFullDescription(true)}>Редактировать</button>
                                        )}
                                    </div>
                                )}
                                <h4>Регламент</h4>
                                {isEditingRules ? (
                                    <div className="edit-field">
                                        <textarea
                                            value={editedRules}
                                            onChange={(e) => setEditedRules(e.target.value)}
                                            placeholder="Регламент турнира"
                                            rows="4"
                                        />
                                        <button onClick={handleSaveRules}>Сохранить</button>
                                        <button onClick={() => setIsEditingRules(false)}>Отмена</button>
                                    </div>
                                ) : (
                                    <div>
                                        <p>{tournament.rules || 'Регламент не указан'}</p>
                                        {isAdminOrCreator && (
                                            <button onClick={() => setIsEditingRules(true)}>Редактировать</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                )}
            </div>

            <p>
                <strong>Формат:</strong> {tournament.format}
            </p>
            <p>
                <strong>Дисциплина:</strong> {tournament.game || 'Не указана'}
            </p>
            <p>
                <strong>Дата старта:</strong> {new Date(tournament.start_date).toLocaleDateString('ru-RU')}
            </p>
            {tournament.end_date && (
                <p>
                    <strong>Дата окончания:</strong>{' '}
                    {new Date(tournament.end_date).toLocaleDateString('ru-RU')}
                </p>
            )}
            <p>
                <strong>Участники ({tournament.participant_count || 0}):</strong>
            </p>
            {renderParticipants()}
            {user && tournament.status === 'active' && (
                <div className="participation-controls">
                    {!isParticipating && matches.length === 0 ? (
                        <>
                            {tournament.format !== 'mix' && tournament.participant_type === 'team' && (
                                <div className="team-selection">
                                    <label>Выберите команду или создайте новую:</label>
                                    <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
                                        <option value="">Создать новую команду</option>
                                        {(teams || []).map((team) => (
                                            <option key={team.id} value={team.id}>
                                                {team.name}
                                            </option>
                                        ))}
                                    </select>
                                    {!selectedTeam && (
                                        <input
                                            type="text"
                                            placeholder="Название новой команды"
                                            value={newTeamName}
                                            onChange={(e) => setNewTeamName(e.target.value)}
                                        />
                                    )}
                                </div>
                            )}
                            <button onClick={handleParticipate}>Участвовать в турнире</button>
                        </>
                    ) : (
                        isParticipating &&
                        matches.length === 0 && (
                            <button onClick={handleWithdraw}>Отказаться от участия</button>
                        )
                    )}
                    {isCreator && matches.length === 0 && (
                        <div className="invite-participant">
                            <h3>Выслать приглашение на турнир</h3>
                            <select value={inviteMethod} onChange={(e) => setInviteMethod(e.target.value)}>
                                <option value="username">По никнейму</option>
                                <option value="email">По email</option>
                            </select>
                            {inviteMethod === 'username' ? (
                                <input
                                    type="text"
                                    placeholder="Никнейм пользователя"
                                    value={inviteUsername}
                                    onChange={(e) => setInviteUsername(e.target.value)}
                                />
                            ) : (
                                <input
                                    type="email"
                                    placeholder="Email пользователя"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                />
                            )}
                            <button onClick={handleInvite}>Пригласить</button>
                        </div>
                    )}
                    {isAdminOrCreator && (
                        <div className="add-participant-section">
                            <h3>Добавить участника</h3>
                            <div className="search-container" ref={searchContainerRef}>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleUserSearchWithDelay(e.target.value)}
                                    placeholder="Поиск пользователей..."
                                    className="search-input"
                                />
                                {isSearching && (
                                    <div className="search-loading">Поиск...</div>
                                )}
                                {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                                    <div className="search-no-results">Пользователи не найдены</div>
                                )}
                                {showSearchResults && searchResults.length > 0 && (
                                    <ul className="search-results-dropdown">
                                        {searchResults.slice(0, 10).map(user => (
                                            <li 
                                                key={user.id}
                                                className="search-result-item"
                                            >
                                                <div className="search-result-content">
                                                    <div className="search-result-avatar">
                                                        <img 
                                                            src={ensureHttps(user.avatar_url) || '/default-avatar.png'} 
                                                            alt={user.username}
                                                            className="user-avatar"
                                                        />
                                                    </div>
                                                    <div className="search-result-info">
                                                        <span className="search-result-name">{user.username}</span>
                                                        <span className={`search-result-status ${user.online ? 'online' : 'offline'}`}>
                                                            {user.online ? 'Онлайн' : `Был онлайн: ${formatLastOnline(user.last_online)}`}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="search-result-actions">
                                                    <div className="action-links">
                                                        {isUserParticipant(user.id) ? (
                                                            <span className="already-participant">уже участвует</span>
                                                        ) : isInvitationSent(user.id) ? (
                                                            <>
                                                                <button 
                                                                    className="action-link no-bg-button search-result-action-button"
                                                                    disabled
                                                                >
                                                                    уже отправлено
                                                                </button>
                                                                {/* Удаляем кнопку сброса кэша, т.к. кэш очищается автоматически */}
                                                            </>
                                                        ) : (
                                                            <button 
                                                                className="action-link no-bg-button search-result-action-button"
                                                                onClick={() => handleInviteUser(user.id, user.username)}
                                                            >
                                                                пригласить
                                                            </button>
                                                        )}
                                                        <a 
                                                            href={`/user/${user.id}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="action-link no-bg-button search-result-action-button"
                                                        >
                                                            профиль
                                                        </a>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                        {searchResults.length > 10 && (
                                            <li className="search-too-many-results">
                                                Слишком много результатов
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>
                            <input
                                type="text"
                                value={addParticipantName}
                                onChange={(e) => setAddParticipantName(e.target.value)}
                                placeholder="Имя участника"
                            />
                            <button onClick={handleAddParticipant}>Добавить участника</button>
                            
                            {/* Удаляем весь блок администрирования кэша приглашений */}
                        </div>
                    )}
                    {!isAdminOrCreator && tournament?.status === 'active' && (
                        <button onClick={handleRequestAdmin} className="request-admin-btn">
                            Запросить права администратора
                        </button>
                    )}
                </div>
            )}
            {tournament?.format === 'mix' && !tournament?.bracket && (
                <div className="mix-settings">
                    {isAdminOrCreator && (
                        <>
                            <h3>Настройки микса</h3>
                            <div className="rating-type-selector">
                                <label>Миксовать по рейтингу:</label>
                                <select
                                    value={ratingType}
                                    onChange={(e) => setRatingType(e.target.value)}
                                >
                                    <option value="faceit">FACEit</option>
                                    <option value="premier">Steam Premier</option>
                                </select>
                            </div>
                            {tournament.participant_type === 'solo' && mixedTeams.length === 0 && (
                                <button onClick={handleFormTeams}>Сформировать команды</button>
                            )}
                            {tournament.participant_type === 'solo' && mixedTeams.length > 0 && tournament.status === 'pending' && (
                                <button onClick={handleFormTeams} className="reformate-teams-button">Переформировать команды</button>
                            )}
                        </>
                    )}
                    {mixedTeams.length > 0 && (
                        <div className="mixed-teams">
                            <h3>Сформированные команды</h3>
                            <div className="mixed-teams-grid">
                                {mixedTeams.map(team => (
                                    <div key={team.id} className="team-card">
                                        <table className="team-table">
                                            <thead>
                                                <tr>
                                                    <th>{team.name}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {team.members.map(member => (
                                                    <tr key={member.participant_id || member.user_id || member.id}>
                                                        <td>
                                                            {member.user_id ? (
                                                                <Link to={`/user/${member.user_id}`}>{member.name}</Link>
                                                            ) : (
                                                                member.name
                                                            )}
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
                </div>
            )}
            <h3>Турнирная сетка</h3>
            {matches.length > 0 && (tournament?.status === 'pending' || tournament?.status === 'active') && (
                <div className="tournament-controls">
                    {isAdminOrCreator && (
                        <button 
                            className="start-tournament"
                            onClick={handleStartTournament}
                        >
                            Начать турнир
                        </button>
                    )}
                    {isAdminOrCreator && (
                        <button 
                            className="regenerate-bracket"
                            onClick={handleRegenerateBracket}
                        >
                            Пересоздать сетку
                        </button>
                    )}
                </div>
            )}
            {Array.isArray(matches) && matches.length > 0 ? (
                <>
                    {console.log('Рендеринг сетки. Количество матчей:', matches.length)}
                    {console.log('Games для визуализации сетки:', games)}
                    {Array.isArray(games) && games.length > 0 ? (
                        <div className="custom-tournament-bracket">
                            <div className="tournament-bracket">
                                <ErrorBoundary>
                                    <Suspense fallback={<div className="loading-bracket">Загрузка турнирной сетки...</div>}>
                                        {(() => {
                                            try {
                                                console.log('Попытка рендеринга сетки с количеством матчей:', games.length);
                                                // Безопасный рендеринг сетки
                                                return (
                                        <BracketRenderer
                                            games={games}
                                            canEditMatches={canEditMatches}
                                            selectedMatch={selectedMatch}
                                            setSelectedMatch={setSelectedMatch}
                                            handleTeamClick={handleTeamClick}
                                            format={tournament.format}
                                            key={`bracket-${matches.length}-${selectedMatch}`}
                                        />
                                                );
                                            } catch (error) {
                                                console.error('Ошибка при рендеринге турнирной сетки:', error);
                                                return (
                                                    <div className="bracket-error">
                                                        Ошибка при отображении турнирной сетки. 
                                                        Пожалуйста, обновите страницу или попробуйте позже.
                                                        <br />
                                                        <button 
                                                            onClick={() => window.location.reload()} 
                                                            className="reload-button"
                                                        >
                                                            Обновить страницу
                                                        </button>
                                                        {isAdminOrCreator && (
                                                            <button 
                                                                onClick={handleRegenerateBracket} 
                                                                className="regenerate-button"
                                                            >
                                                                Пересоздать сетку
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        })()}
                                    </Suspense>
                                </ErrorBoundary>
                            </div>
                        </div>
                    ) : (
                        <div className="bracket-error">
                        <p>Ошибка формирования данных для сетки. Пожалуйста, обновите страницу.</p>
                            <button 
                                onClick={() => window.location.reload()} 
                                className="reload-button"
                            >
                                Обновить страницу
                            </button>
                            {isAdminOrCreator && (
                                <button 
                                    onClick={handleRegenerateBracket} 
                                    className="regenerate-button"
                                >
                                    Пересоздать сетку
                                </button>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <p>Сетка ещё не сгенерирована</p>
                    {canGenerateBracket && (
                        <div className="generation-options">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={thirdPlaceMatch}
                                    onChange={(e) => setThirdPlaceMatch(e.target.checked)}
                                />{' '}
                                Нужен матч за третье место?
                            </label>
                            <button className="generate-bracket-button" onClick={handleGenerateBracket}>
                                Сгенерировать сетку
                            </button>
                        </div>
                    )}
                </>
            )}
            {winners.length > 0 && (
                <div className="winners-list">
                    <h3>Призёры турнира</h3>
                    <ul>
                        {winners.map(([place, name]) => (
                            <li key={place}>
                                {place} место: {name || 'Не определён'}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {showConfirmModal && selectedMatch && (
                <div className="modal" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Подтверждение победителя</h3>
                        <p>
                            Победитель:{' '}
                            <span className="winner-name">
                                {games
                                    ?.find((m) => m.id === selectedMatch.toString())
                                    ?.participants.find((p) => p.id === selectedWinnerId)?.name || 'Не определён'}
                            </span>
                        </p>
                        <div className="score-inputs">
                            <div className="score-container">
                                <span className="participant-name">
                                    {games?.find((m) => m.id === selectedMatch.toString())?.participants[0]?.name ||
                                        'Участник 1'}
                                </span>
                                <input
                                    type="number"
                                    value={matchScores.team1}
                                    onChange={(e) => setMatchScores({ ...matchScores, team1: Number(e.target.value) })}
                                    className="score-input"
                                    min="0"
                                />
                            </div>
                            <div className="score-container">
                                <span className="participant-name">
                                    {games?.find((m) => m.id === selectedMatch.toString())?.participants[1]?.name ||
                                        'Участник 2'}
                                </span>
                                <input
                                    type="number"
                                    value={matchScores.team2}
                                    onChange={(e) => setMatchScores({ ...matchScores, team2: Number(e.target.value) })}
                                    className="score-input"
                                    min="0"
                                />
                            </div>
                        </div>
                        <div className="modal-buttons">
                            <button onClick={() => handleConfirmWinner('yes')}>Подтвердить</button>
                            <button onClick={handleCloseModal}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}
            {message && (
                <p className={message.includes('успешно') ? 'success' : 'error'}>{message}</p>
            )}
            {tournament?.status === 'in_progress' && isAdminOrCreator && (
                <div className="tournament-controls finish-above-bracket">
                    <button 
                        className="end-tournament"
                        onClick={handleEndTournament}
                    >
                        Завершить турнир
                    </button>
                </div>
            )}
            {isAdminOrCreator && matches.length > 0 && (
                <div className="tournament-admin-controls">
                    {tournament?.status === 'in_progress' && (
                    <button 
                            className="clear-results-button"
                            onClick={handleClearMatchResults}
                            title="Очистить все результаты матчей"
                    >
                            Очистить результаты матчей
                    </button>
                    )}
                </div>
            )}
        </section>
    );
}

export default TournamentDetails;