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
import ChatWindow from './ChatWindow';

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

// Глобальные константы
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

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
    // Состояния для просмотра деталей завершенного матча
    const [viewingMatchDetails, setViewingMatchDetails] = useState(false);
    const [matchDetails, setMatchDetails] = useState(null);
    // Состояния для работы с картами в матчах CS2
    const [maps, setMaps] = useState([{ map: 'de_dust2', score1: 0, score2: 0 }]);
    const [showMapSelection, setShowMapSelection] = useState(false);
    // Refs для работы с формами
    const descriptionRef = useRef("");
    const prizePoolRef = useRef("");
    const fullDescriptionRef = useRef("");
    const rulesRef = useRef("");
    const csgoMaps = [
        'de_dust2',
        'de_mirage',
        'de_nuke',
        'de_train',
        'de_anubis',
        'de_ancient',
        'de_inferno'
    ];
    // Состояния для чата турнира
    const [chatMessages, setChatMessages] = useState([]);
    const [newChatMessage, setNewChatMessage] = useState('');
    const chatEndRef = useRef(null);

    const addMap = () => {
        setMaps([...maps, { map: 'de_dust2', score1: 0, score2: 0 }]);
    };

    const removeMap = (index) => {
        const newMaps = [...maps];
        newMaps.splice(index, 1);
        setMaps(newMaps);
    };

    const updateMapScore = (index, team, score) => {
        const newMaps = [...maps];
        newMaps[index][`score${team}`] = score;
        setMaps(newMaps);
    };

    const updateMapSelection = (index, mapName) => {
        const newMaps = [...maps];
        newMaps[index].map = mapName;
        setMaps(newMaps);
    };

    // Получаем функции для отображения toast-уведомлений
    const toast = useToast();

    // Функция для проверки участия пользователя в турнире
    const checkParticipation = useCallback((tournamentData) => {
        if (!user || !tournamentData || !tournamentData.participants) return;
        
        const participants = tournamentData.participants || [];
        const isParticipant = participants.some(
            (p) => 
                (tournamentData.participant_type === 'solo' && p.user_id === user.id) ||
                (tournamentData.participant_type === 'team' && p.creator_id === user.id)
        );
        
        setIsParticipating(isParticipant);
    }, [user]);

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
            // Присоединяемся к чату турнира
            socket.emit('join_tournament_chat', id);
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

        // Обработка новых сообщений чата турнира
        socket.on('tournament_message', (message) => {
            setChatMessages(prev => [...prev, message]);
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
                // setUser(currentUser); // УБРАНО, чтобы не было зацикливания

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

    // Загрузка истории сообщений чата турнира
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        api.get(`/api/tournaments/${id}/chat/messages`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => setChatMessages(res.data))
        .catch(err => console.error('Ошибка загрузки сообщений чата турнира:', err));
    }, [id]);

    // Прокрутка чата вниз при новом сообщении
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    // Обработчики ввода и отправки сообщений
    const handleChatInputChange = (e) => {
        setNewChatMessage(e.target.value);
    };
    const handleChatSubmit = (e) => {
        e.preventDefault();
        if (!newChatMessage.trim() || !wsRef.current) return;
        wsRef.current.emit('tournament_message', { tournamentId: id, content: newChatMessage });
        setNewChatMessage('');
    };
    const handleChatKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            handleChatSubmit(e);
        }
    };

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
            
            // Проверяем, сохранены ли данные о картах для этого матча
            const matchData = matches.find(m => m.id === safeMatchId);
            if (matchData && matchData.maps_data && tournament.game === 'Counter-Strike 2') {
                try {
                    const parsedMapsData = JSON.parse(matchData.maps_data);
                    if (Array.isArray(parsedMapsData) && parsedMapsData.length > 0) {
                        setMaps(parsedMapsData);
                        setShowMapSelection(true);
                    } else {
                        // Если данные есть, но не валидны, сбрасываем к исходному состоянию
                        setMaps([{ map: 'de_dust2', score1: 0, score2: 0 }]);
                        setShowMapSelection(tournament.game === 'Counter-Strike 2');
                    }
                } catch (e) {
                    console.error('Ошибка при разборе данных карт:', e);
                    setMaps([{ map: 'de_dust2', score1: 0, score2: 0 }]);
                    setShowMapSelection(tournament.game === 'Counter-Strike 2');
                }
            } else {
                // Для новых матчей или не-CS2 матчей
                setMaps([{ map: 'de_dust2', score1: 0, score2: 0 }]);
                setShowMapSelection(tournament.game === 'Counter-Strike 2');
            }
            
            // Отладочная информация
            console.log('Данные матча:', {
                match: selectedGame,
                team1Id,
                team2Id,
                selectedWinner,
                isByeMatch: isByeMatch,
                isCS2: tournament.game === 'Counter-Strike 2'
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
                isByeMatch,
                maps: showMapSelection ? maps : undefined
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
            
            // Формируем данные запроса
            const requestData = {
                matchId: parseInt(updatedMatch.id),
                winner_team_id: winnerId,
                score1: score1 || 0,
                score2: score2 || 0
            };
            
            // Если включён выбор карт и это CS2, добавляем информацию о картах
            if (showMapSelection && tournament.game === 'Counter-Strike 2') {
                requestData.maps = maps;
            }
            
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

    // Функция для закрытия модального окна с деталями матча
    const closeMatchDetails = () => {
        setViewingMatchDetails(false);
        setMatchDetails(null);
    };

    // Функция для просмотра деталей завершенного матча
    const viewMatchDetails = (matchId) => {
        try {
            const matchData = matches.find(m => m.id === parseInt(matchId));
            if (!matchData) {
                console.error(`Матч с ID ${matchId} не найден`);
            return;
        }

            // Если матч не завершен, не показываем детали
            if (!matchData.winner_team_id) {
            return;
        }

            const match = {
                id: matchData.id,
                team1: tournament.participants.find(p => p.id === matchData.team1_id)?.name || 'Участник 1',
                team2: tournament.participants.find(p => p.id === matchData.team2_id)?.name || 'Участник 2',
                score1: matchData.score1,
                score2: matchData.score2,
                winner_id: matchData.winner_team_id,
                maps: []
            };

            // Если есть данные о картах и это CS2, парсим их
            if (matchData.maps_data && tournament.game === 'Counter-Strike 2') {
                try {
                    const parsedMapsData = JSON.parse(matchData.maps_data);
                    if (Array.isArray(parsedMapsData) && parsedMapsData.length > 0) {
                        match.maps = parsedMapsData;
                    }
                } catch (e) {
                    console.error('Ошибка при разборе данных карт:', e);
                }
            }

            setMatchDetails(match);
            setViewingMatchDetails(true);
        } catch (error) {
            console.error('Ошибка при просмотре деталей матча:', error);
        }
    };

    // Функция для проверки и валидации кэша приглашений
    const validateInvitationCache = useCallback(() => {
        if (!tournament) return; // Добавляем проверку, чтобы избежать ошибок
        
        try {
            // Проверяем кэш приглашенных пользователей
            const cachedInvited = JSON.parse(localStorage.getItem(`tournament_${id}_invited_users`) || '[]');
            
            // Если кэш не пуст, проверяем, есть ли какие-то изменения в составе участников
            if (cachedInvited.length > 0 && tournament && tournament.participants) {
                // Фильтруем кэш, исключая пользователей, которые уже стали участниками
                const filteredCache = cachedInvited.filter(userId => {
                    return !tournament.participants.some(participant => 
                        participant.user_id === userId || participant.creator_id === userId
                    );
                });
                
                // Если были изменения, обновляем кэш
                if (filteredCache.length !== cachedInvited.length) {
                    localStorage.setItem(`tournament_${id}_invited_users`, JSON.stringify(filteredCache));
                    setInvitedUsers(filteredCache);
                } else {
                    setInvitedUsers(cachedInvited);
                }
            } else {
                setInvitedUsers(cachedInvited);
            }
        } catch (error) {
            console.error('Ошибка при валидации кэша приглашений:', error);
            // При ошибке очищаем кэш для безопасности
            localStorage.removeItem(`tournament_${id}_invited_users`);
            setInvitedUsers([]);
        }
    }, [id, tournament]);

    // Проверяем актуальность кэша при загрузке турнира
    useEffect(() => {
        validateInvitationCache();
    }, [validateInvitationCache]);

    // Проверка кэша приглашений при загрузке турнира
    useEffect(() => {
        if (!tournament || !tournament.id) return;
        try {
            // Получаем список приглашённых пользователей из кэша
            const cacheKey = `invitedUsers_${tournament.id}`;
            const cachedInvitedUsers = localStorage.getItem(cacheKey);
            if (cachedInvitedUsers) {
                const invitedUsers = JSON.parse(cachedInvitedUsers);
                // Проверяем, не стали ли некоторые приглашённые пользователи уже участниками
                const updatedInvitedUsers = invitedUsers.filter(userId => {
                    return !tournament.participants.some(participant => participant.id === userId);
                });
                // Обновляем кэш, если список изменился
                if (updatedInvitedUsers.length !== invitedUsers.length) {
                    localStorage.setItem(cacheKey, JSON.stringify(updatedInvitedUsers));
                }
            }
        } catch (error) {
            console.error('Ошибка при проверке кэша приглашений:', error);
            // В случае ошибки очищаем кэш для безопасности
            localStorage.removeItem(`invitedUsers_${tournament.id}`);
        }
    }, [tournament]);

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

    // Функция сохранения короткого описания турнира
    const handleSaveDescription = async () => {
        if (!descriptionRef.current.trim()) {
            toast.error('Описание не может быть пустым');
            return;
        }
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/${id}/update`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    description: descriptionRef.current
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Не удалось обновить описание');
            }
            
            setTournament(prev => ({
                ...prev,
                description: descriptionRef.current
            }));
            
            toast.success('Описание успешно обновлено');
            setIsEditingDescription(false);
        } catch (error) {
            console.error('Ошибка при обновлении описания:', error);
            toast.error(error.message || 'Не удалось обновить описание');
        } finally {
            setLoading(false);
        }
    };
    
    // Функция сохранения призового фонда
    const handleSavePrizePool = async () => {
        if (!prizePoolRef.current.trim()) {
            toast.error('Информация о призовом фонде не может быть пустой');
            return;
        }
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/${id}/update`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    prize_pool: prizePoolRef.current
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Не удалось обновить призовой фонд');
            }
            
            setTournament(prev => ({
                ...prev,
                prize_pool: prizePoolRef.current
            }));
            
            toast.success('Призовой фонд успешно обновлен');
            setIsEditingPrizePool(false);
        } catch (error) {
            console.error('Ошибка при обновлении призового фонда:', error);
            toast.error(error.message || 'Не удалось обновить призовой фонд');
        } finally {
            setLoading(false);
        }
    };
    
    // Функция сохранения полного описания турнира
    const handleSaveFullDescription = async () => {
        if (!fullDescriptionRef.current.trim()) {
            toast.error('Полное описание не может быть пустым');
            return;
        }
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/${id}/update`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    full_description: fullDescriptionRef.current
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Не удалось обновить полное описание');
            }
            
            setTournament(prev => ({
                ...prev,
                full_description: fullDescriptionRef.current
            }));
            
            toast.success('Полное описание успешно обновлено');
            setIsEditingFullDescription(false);
        } catch (error) {
            console.error('Ошибка при обновлении полного описания:', error);
            toast.error(error.message || 'Не удалось обновить полное описание');
        } finally {
            setLoading(false);
        }
    };
    
    // Функция сохранения правил турнира
    const handleSaveRules = async () => {
        if (!rulesRef.current.trim()) {
            toast.error('Правила не могут быть пустыми');
            return;
        }
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/${id}/update`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    rules: rulesRef.current
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Не удалось обновить правила');
            }
            
            setTournament(prev => ({
                ...prev,
                rules: rulesRef.current
            }));
            
            toast.success('Правила успешно обновлены');
            setIsEditingRules(false);
        } catch (error) {
            console.error('Ошибка при обновлении правил:', error);
            toast.error(error.message || 'Не удалось обновить правила');
        } finally {
            setLoading(false);
        }
    };
    
    // Приглашение пользователя по username или email
    const handleInvite = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('Пожалуйста, войдите, чтобы отправить приглашение');
            return;
        }

        if (inviteMethod === 'username' && !inviteUsername) {
            toast.error('Пожалуйста, укажите никнейм пользователя');
            return;
        }

        if (inviteMethod === 'email' && !inviteEmail) {
            toast.error('Пожалуйста, укажите email пользователя');
            return;
        }

        try {
            const response = await api.post(`/api/tournaments/${id}/invite`, {
                username: inviteMethod === 'username' ? inviteUsername : null,
                email: inviteMethod === 'email' ? inviteEmail : null
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            toast.success(response.data.message || 'Приглашение успешно отправлено');
            setInviteUsername('');
            setInviteEmail('');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Ошибка при отправке приглашения');
        }
    };
    
    // Проверка кэша приглашений при загрузке турнира
    
    
    // Проверка, является ли пользователь участником турнира
    const isUserParticipant = (userId) => {
        if (!tournament || !tournament.participants) return false;
        return tournament.participants.some(participant => participant.id === userId);
    };
    
    // Проверка, было ли отправлено приглашение пользователю
    const isInvitationSent = (userId) => {
        if (!tournament || !tournament.id) return false;
        
        try {
            const cacheKey = `invitedUsers_${tournament.id}`;
            const cachedInvitedUsers = localStorage.getItem(cacheKey);
            
            if (cachedInvitedUsers) {
                const invitedUsers = JSON.parse(cachedInvitedUsers);
                return invitedUsers.includes(userId);
            }
        } catch (error) {
            console.error('Ошибка при проверке статуса приглашения:', error);
        }
        
        return false;
    };
    
    // Обработчик приглашения конкретного пользователя
    const handleInviteUser = async (userId) => {
        if (!tournament || !tournament.id || !userId) return;
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}/invite-user/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Не удалось отправить приглашение');
            }
            
            // Добавляем пользователя в кэш приглашенных
            const cacheKey = `invitedUsers_${tournament.id}`;
            let invitedUsers = [];
            
            try {
                const cachedInvitedUsers = localStorage.getItem(cacheKey);
                if (cachedInvitedUsers) {
                    invitedUsers = JSON.parse(cachedInvitedUsers);
                }
            } catch (error) {
                console.error('Ошибка при чтении кэша приглашений:', error);
            }
            
            if (!invitedUsers.includes(userId)) {
                invitedUsers.push(userId);
                localStorage.setItem(cacheKey, JSON.stringify(invitedUsers));
            }
            
            toast.success('Приглашение успешно отправлено');
        } catch (error) {
            console.error('Ошибка при отправке приглашения:', error);
            toast.error(error.message || 'Не удалось отправить приглашение');
        } finally {
            setLoading(false);
        }
    };
    
    // Обработчик формирования команд
    const handleFormTeams = async () => {
        if (!tournament || !tournament.id) return;
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}/form-teams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Не удалось сформировать команды');
            }
            
            // Обновляем данные турнира
            fetchTournamentData();
            toast.success('Команды успешно сформированы');
        } catch (error) {
            console.error('Ошибка при формировании команд:', error);
            toast.error(error.message || 'Не удалось сформировать команды');
        } finally {
            setLoading(false);
        }
    };
    
    // Обработчик запуска турнира
    const handleStartTournament = async () => {
        if (!tournament || !tournament.id) return;
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Не удалось запустить турнир');
            }
            
            // Обновляем данные турнира
            fetchTournamentData();
            toast.success('Турнир успешно запущен');
        } catch (error) {
            console.error('Ошибка при запуске турнира:', error);
            toast.error(error.message || 'Не удалось запустить турнир');
        } finally {
            setLoading(false);
        }
    };

    // Функция для пересоздания сетки турнира
    const handleRegenerateBracket = () => {
        toast.info("Функция пересоздания сетки отключена");
    };
    
    // Функция для завершения турнира
    const handleEndTournament = () => {
        toast.info("Функция завершения турнира отключена");
    };
    
    // Функция для сброса результатов матчей
    const handleClearMatchResults = () => {
        toast.info("Функция сброса результатов отключена");
    };

    return (
        <section className="tournament-details">
            <div className="tournament-layout">
                <div className="tournament-main">
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
                                            onMatchClick={viewMatchDetails}
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
                                
                                {showMapSelection ? (
                                    <div className="maps-container">
                                        <h4>Карты матча</h4>
                                        {maps.map((mapData, index) => (
                                            <div key={index} className="map-entry">
                                                <div className="map-select-container">
                                                    <select 
                                                        value={mapData.map}
                                                        onChange={(e) => updateMapSelection(index, e.target.value)}
                                                        className="map-select"
                                                    >
                                                        {csgoMaps.map(map => (
                                                            <option key={map} value={map}>{map}</option>
                                                        ))}
                                                    </select>
                                                    {maps.length > 1 && (
                                                        <button 
                                                            onClick={() => removeMap(index)}
                                                            className="remove-map-btn"
                                                            title="Удалить карту"
                                                        >
                                                            ✖
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="map-scores">
                                                    <div className="score-container">
                                                        <span className="participant-name">
                                                            {games?.find((m) => m.id === selectedMatch.toString())?.participants[0]?.name || 'Участник 1'}
                                                        </span>
                                                        <input
                                                            type="number"
                                                            value={mapData.score1}
                                                            onChange={(e) => updateMapScore(index, 1, Number(e.target.value))}
                                                            className="score-input"
                                                            min="0"
                                                        />
                                                    </div>
                                                    <div className="score-container">
                                                        <span className="participant-name">
                                                            {games?.find((m) => m.id === selectedMatch.toString())?.participants[1]?.name || 'Участник 2'}
                                                        </span>
                                                        <input
                                                            type="number"
                                                            value={mapData.score2}
                                                            onChange={(e) => updateMapScore(index, 2, Number(e.target.value))}
                                                            className="score-input"
                                                            min="0"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        <button 
                                            onClick={addMap} 
                                            className="add-map-btn"
                                            title="Добавить карту"
                                        >
                                            + Добавить карту
                                        </button>
                                        
                                        {maps.length > 1 && (
                                            <div className="total-score">
                                                <h4>Общий счет</h4>
                                                <div className="score-summary">
                                                    <div className="team-score">
                                                        <span className="team-name">
                                                            {games?.find((m) => m.id === selectedMatch.toString())?.participants[0]?.name || 'Участник 1'}:
                                                        </span>
                                                        <span className="score-value">
                                                            {maps.filter(m => parseInt(m.score1) > parseInt(m.score2)).length}
                                                        </span>
                                                    </div>
                                                    <div className="team-score">
                                                        <span className="team-name">
                                                            {games?.find((m) => m.id === selectedMatch.toString())?.participants[1]?.name || 'Участник 2'}:
                                                        </span>
                                                        <span className="score-value">
                                                            {maps.filter(m => parseInt(m.score2) > parseInt(m.score1)).length}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
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
                                )}
                                
                                <div className="modal-actions">
                                    <button className="cancel-btn" onClick={handleCloseModal}>
                                        Отмена
                                    </button>
                                    <button 
                                        className="confirm-winner"
                                        onClick={() => {
                                            const matchInfo = games.find((m) => m.id === selectedMatch.toString());
                                            if (matchInfo) {
                                                handleUpdateMatch(matchInfo);
                                            }
                                        }}
                                    >
                                        Подтвердить победителя
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Модальное окно для просмотра деталей завершенного матча */}
                    {viewingMatchDetails && matchDetails && (
                        <div className="modal" onClick={() => setViewingMatchDetails(false)}>
                            <div className="modal-content match-details-modal" onClick={(e) => e.stopPropagation()}>
                                <h3>Результаты матча</h3>
                                
                                <div className="match-teams">
                                    <div className={`team-info ${matchDetails.winner_id === matchDetails.team1_id ? 'winner' : ''}`}>
                                        <span className="team-name">{matchDetails.team1}</span>
                                        {matchDetails.winner_id === matchDetails.team1_id && <span className="winner-badge">Победитель</span>}
                                    </div>
                                    <div className="match-score">
                                        <span>{matchDetails.score1} : {matchDetails.score2}</span>
                                    </div>
                                    <div className={`team-info ${matchDetails.winner_id === matchDetails.team2_id ? 'winner' : ''}`}>
                                        <span className="team-name">{matchDetails.team2}</span>
                                        {matchDetails.winner_id === matchDetails.team2_id && <span className="winner-badge">Победитель</span>}
                                    </div>
                                </div>
                                
                                {matchDetails.maps && matchDetails.maps.length > 0 && (
                                    <div className="maps-results">
                                        <h4>Результаты по картам</h4>
                                        <table className="maps-table">
                                            <thead>
                                                <tr>
                                                    <th>Карта</th>
                                                    <th>{matchDetails.team1}</th>
                                                    <th>{matchDetails.team2}</th>
                                                    <th>Результат</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {matchDetails.maps.map((map, index) => (
                                                    <tr key={index}>
                                                        <td>{map.map}</td>
                                                        <td>{map.score1}</td>
                                                        <td>{map.score2}</td>
                                                        <td>
                                                            {parseInt(map.score1) > parseInt(map.score2) 
                                                                ? <span className="map-winner">{matchDetails.team1}</span>
                                                                : parseInt(map.score2) > parseInt(map.score1)
                                                                    ? <span className="map-winner">{matchDetails.team2}</span>
                                                                    : 'Ничья'
                                                            }
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                
                                <div className="modal-buttons">
                                    <button onClick={() => setViewingMatchDetails(false)}>Закрыть</button>
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
                    {tournament?.status === "completed" && isAdminOrCreator && (
                        <button 
                            className="end-tournament-button"
                            onClick={handleEndTournament}
                        >
                            Завершить турнир
                        </button>
                    )}
                    {isAdminOrCreator && (
                        <button 
                            className="clear-results-button"
                            onClick={handleClearMatchResults}
                        >
                            Сбросить результаты
                        </button>
                    )}
                </div>
                {/* Панель чата турнира */}
                <div className="tournament-chat-panel">
                    <ChatWindow
                        activeChat={{ id, name: tournament.name, avatar_url: '/default-avatar.png' }}
                        messages={chatMessages}
                        newMessage={newChatMessage}
                        onInputChange={handleChatInputChange}
                        onSubmit={handleChatSubmit}
                        onKeyPress={handleChatKeyPress}
                        onSendAttachment={() => {}}
                        onDeleteMessage={() => {}}
                        messagesEndRef={chatEndRef}
                    />
                </div>
            </div>
        </section>
    );
}

export default TournamentDetails;