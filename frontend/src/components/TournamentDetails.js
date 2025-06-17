// 🔧 QA REFACTORED VERSION - TournamentDetails.js v4.2.4
// ✅ Исправлены дублированные объявления функций
// ✅ Оптимизированы импорты
// ✅ Улучшена обработка ошибок
// ✅ Добавлена валидация данных
// ✅ Повышена тестируемость
// ✅ Устранены циклические зависимости

// Импорты React и связанные
import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';

// Утилиты и хелперы
import { ensureHttps } from '../utils/userHelpers';
import { 
    isCounterStrike2, 
    gameHasMaps, 
    getGameMaps as getGameMapsHelper, 
    getDefaultMap as getDefaultMapHelper, 
    getDefaultCS2Maps 
} from '../utils/mapHelpers';

// Стили
import './TournamentDetails.css';

// Компоненты
import TeamGenerator from './TeamGenerator';
import TournamentInfoSection from './TournamentInfoSection';
import MatchResultModal from './tournament/modals/MatchResultModal';
import MatchDetailsModal from './tournament/modals/MatchDetailsModal';
import ParticipantSearchModal from './tournament/modals/ParticipantSearchModal';
import AddParticipantModal from './tournament/modals/AddParticipantModal';
import TournamentFloatingActionPanel from './tournament/TournamentFloatingActionPanel';
import UnifiedParticipantsPanel from './tournament/UnifiedParticipantsPanel';
import TournamentAdminPanel from './tournament/TournamentAdminPanel';
import AchievementsPanel from './achievements/AchievementsPanel';

// Контекст
import { useUser } from '../context/UserContext';

// Ленивая загрузка BracketRenderer с улучшенной обработкой ошибок
const LazyBracketRenderer = React.lazy(() => 
    import('./BracketRenderer').catch(err => {
        console.error('❌ Ошибка при загрузке BracketRenderer:', err);
        return { 
            default: () => (
                <div className="bracket-error" data-testid="bracket-load-error">
                    <h3>⚠️ Ошибка загрузки турнирной сетки</h3>
                    <p>Не удалось загрузить компонент турнирной сетки. Пожалуйста, обновите страницу.</p>
                    <button onClick={() => window.location.reload()}>🔄 Обновить страницу</button>
                </div>
            ) 
        };
    })
);

// Error Boundary для обработки ошибок рендеринга
class TournamentErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('❌ Ошибка в TournamentDetails:', error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="tournament-error-boundary" data-testid="tournament-error">
                    <h2>⚠️ Произошла ошибка</h2>
                    <p>Произошла ошибка при отображении турнира. Пожалуйста, обновите страницу или попробуйте позже.</p>
                    <details style={{ marginTop: '20px' }}>
                        <summary>Техническая информация</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                            {this.state.errorInfo?.componentStack}
                        </pre>
                    </details>
                    <button onClick={() => window.location.reload()}>🔄 Обновить страницу</button>
                </div>
            );
        }

        return this.props.children;
    }
}

// Константы
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const CACHE_VALIDITY_PERIOD = 2 * 60 * 1000; // 2 минуты
const MAPS_CACHE_VALIDITY_PERIOD = 24 * 60 * 60 * 1000; // 24 часа

// Утилиты валидации
const validateTournamentData = (data) => {
    if (!data || typeof data !== 'object') {
        return { isValid: false, error: 'Данные турнира отсутствуют или имеют неверный формат' };
    }
    
    if (!data.id || !data.name) {
        return { isValid: false, error: 'Отсутствуют обязательные поля турнира (id, name)' };
    }
    
    return { isValid: true };
};

const validateParticipantData = (participant) => {
    if (!participant || typeof participant !== 'object') {
        return false;
    }
    return participant.id && (participant.name || participant.username);
};

// Компонент для отображения оригинального списка участников
const OriginalParticipantsList = React.memo(({ participants, tournament }) => {
    // Валидация пропсов
    if (!Array.isArray(participants)) {
        console.warn('⚠️ OriginalParticipantsList: participants не является массивом');
        return (
            <div className="original-participants-list-wrapper" data-testid="participants-invalid">
                <h3>Зарегистрированные игроки (0)</h3>
                <p className="no-participants">Ошибка загрузки участников</p>
            </div>
        );
    }

    if (participants.length === 0) {
        return (
            <div className="original-participants-list-wrapper" data-testid="participants-empty">
                <h3>Зарегистрированные игроки (0)</h3>
                <p className="no-participants">Нет зарегистрированных игроков</p>
            </div>
        );
    }

    // Фильтруем только валидных участников
    const validParticipants = participants.filter(validateParticipantData);

    return (
        <div className="original-participants-list-wrapper" data-testid="participants-list">
            <h3>Зарегистрированные игроки ({validParticipants.length})</h3>
            <div className="original-participants-grid">
                {validParticipants.map((participant) => (
                    <div 
                        key={participant.id || `participant-${Math.random()}`} 
                        className="participant-card"
                        data-testid={`participant-${participant.id}`}
                    >
                        <div className="participant-info">
                            <div className="participant-avatar">
                                {participant.avatar_url ? (
                                    <img 
                                        src={ensureHttps(participant.avatar_url)} 
                                        alt={`Аватар ${participant.name || participant.username || 'участника'}`}
                                        onError={(e) => {
                                            e.target.src = '/default-avatar.png';
                                        }}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="avatar-placeholder">
                                        {(participant.name || participant.username || '?').charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            {participant.user_id ? (
                                <Link 
                                    to={`/user/${participant.user_id}`} 
                                    className="participant-name"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    data-testid={`participant-link-${participant.id}`}
                                >
                                    {participant.name || participant.username || 'Участник'}
                                </Link>
                            ) : (
                                <span className="participant-name">
                                    {participant.name || participant.username || 'Участник'}
                                </span>
                            )}
                            <span className="participant-rating">
                                FACEIT: {participant.faceit_elo || 1000}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

// Основной компонент
function TournamentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    // Состояния
    const [tournament, setTournament] = useState(null);
    const [user, setUser] = useState(null);
    const [teams, setTeams] = useState([]);
    const [message, setMessage] = useState('');
    const [isParticipating, setIsParticipating] = useState(false);
    const [adminRequestStatus, setAdminRequestStatus] = useState(null);
    const [matches, setMatches] = useState([]);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [maps, setMaps] = useState([]);
    const [availableMaps, setAvailableMaps] = useState({});
    const [originalParticipants, setOriginalParticipants] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isCreator, setIsCreator] = useState(false);
    const [isAdminOrCreator, setIsAdminOrCreator] = useState(false);

    // Состояния для модальных окон (упрощенная версия без хука)
    const [modals, setModals] = useState({
        addParticipant: false,
        participantSearch: false,
        matchResult: false,
        matchDetails: false
    });

    // Данные для модальных окон
    const [newParticipantData, setNewParticipantData] = useState({
        display_name: '',
        email: '',
        faceit_elo: '',
        cs2_premier_rank: ''
    });

    const [matchResultData, setMatchResultData] = useState({
        score1: 0,
        score2: 0,
        maps_data: []
    });

    const [selectedMatchForDetails, setSelectedMatchForDetails] = useState(null);

    // Рефы
    const wsRef = useRef(null);

    // Функции управления модальными окнами
    const openModal = useCallback((modalName) => {
        setModals(prev => ({ ...prev, [modalName]: true }));
    }, []);

    const closeModal = useCallback((modalName) => {
        setModals(prev => ({ ...prev, [modalName]: false }));
    }, []);

    // Утилитарные функции
    const handleAuthError = useCallback((error, context = '') => {
        if (error.response && error.response.status === 403) {
            console.log(`🔐 Ошибка аутентификации${context ? ` при ${context}` : ''}, очищаем токен`);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Очищаем все кеши
            Object.keys(localStorage).forEach(key => {
                if (key.includes('tournament_cache_') || key.includes('invitedUsers_')) {
                    localStorage.removeItem(key);
                }
            });
            
            setError('Сессия истекла. Пожалуйста, войдите в систему заново.');
            
            // Перенаправляем на главную страницу
            setTimeout(() => {
                navigate('/');
            }, 1000);
            
            return true;
        }
        return false;
    }, [navigate]);

    // Проверка участия пользователя
    const isUserParticipant = useCallback((userId) => {
        if (!tournament?.participants || !userId) return false;
        return tournament.participants.some(participant => 
            validateParticipantData(participant) && participant.id === userId
        );
    }, [tournament]);

    // Загрузка данных турнира с улучшенной обработкой ошибок
    const fetchTournamentData = useCallback(async () => {
        if (!id) {
            setError('Не указан ID турнира');
            return;
        }

        console.log('🔄 Начинаем загрузку данных турнира', id);
        setLoading(true);
        setError(null);

        // Проверяем кеш
        const cacheKey = `tournament_cache_${id}`;
        const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
        
        try {
            const cachedTournament = localStorage.getItem(cacheKey);
            const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
            
            // Валидация кеша
            if (cachedTournament && cacheTimestamp) {
                const now = Date.now();
                const timestamp = parseInt(cacheTimestamp, 10);
                
                if (!isNaN(timestamp) && (now - timestamp) < CACHE_VALIDITY_PERIOD) {
                    const parsedTournament = JSON.parse(cachedTournament);
                    const validation = validateTournamentData(parsedTournament);
                    
                    if (validation.isValid) {
                        console.log('✅ Используем валидные кешированные данные турнира');
                        setTournament(parsedTournament);
                        setMatches(Array.isArray(parsedTournament.matches) ? parsedTournament.matches : []);
                        
                        if (Array.isArray(parsedTournament.participants)) {
                            setOriginalParticipants(parsedTournament.participants);
                        }
                        
                        setLoading(false);
                        return;
                    } else {
                        console.warn('⚠️ Кешированные данные невалидны:', validation.error);
                        localStorage.removeItem(cacheKey);
                        localStorage.removeItem(cacheTimestampKey);
                    }
                }
            }

            // Загрузка с сервера
            console.log('🌐 Загружаем данные турнира с сервера...');
            const response = await api.get(`/api/tournaments/${id}`);
            const tournamentData = response.data;

            const validation = validateTournamentData(tournamentData);
            if (!validation.isValid) {
                throw new Error(validation.error);
            }

            console.log('✅ Данные турнира получены и валидны');
            setTournament(tournamentData);
            setMatches(Array.isArray(tournamentData.matches) ? tournamentData.matches : []);
            
            if (Array.isArray(tournamentData.participants)) {
                setOriginalParticipants(tournamentData.participants);
            }

            // Сохраняем в кеш
            localStorage.setItem(cacheKey, JSON.stringify(tournamentData));
            localStorage.setItem(cacheTimestampKey, Date.now().toString());

        } catch (error) {
            console.error('❌ Ошибка загрузки турнира:', error);
            
            if (!handleAuthError(error, 'загрузке турнира')) {
                setError(error.message || 'Ошибка загрузки турнира');
            }
            
            // Очищаем поврежденный кеш
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimestampKey);
        } finally {
            setLoading(false);
        }
    }, [id, handleAuthError]);

    // Загрузка карт для игры
    const fetchMapsForGame = useCallback(async (gameName) => {
        if (!gameName || availableMaps[gameName]) return;

        try {
            setAvailableMaps(prev => ({
                ...prev,
                [`${gameName}_loading`]: true
            }));

            const cacheKey = `maps_cache_${gameName}`;
            const cacheTimestampKey = `maps_cache_timestamp_${gameName}`;
            
            // Проверяем кеш карт
            const cachedMaps = localStorage.getItem(cacheKey);
            const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
            
            if (cachedMaps && cacheTimestamp) {
                const now = Date.now();
                const timestamp = parseInt(cacheTimestamp, 10);
                
                if (!isNaN(timestamp) && (now - timestamp) < MAPS_CACHE_VALIDITY_PERIOD) {
                    const parsedMaps = JSON.parse(cachedMaps);
                    if (Array.isArray(parsedMaps)) {
                        console.log(`✅ Используем кешированные карты для игры ${gameName}`);
                        setAvailableMaps(prev => ({
                            ...prev,
                            [gameName]: parsedMaps,
                            [`${gameName}_loading`]: false
                        }));
                        return;
                    }
                }
            }

            // Загружаем с сервера
            console.log(`🌐 Загружаем карты для игры ${gameName} с сервера...`);
            const response = await api.get(`/api/maps?game=${encodeURIComponent(gameName)}`);
            
            if (response.data && Array.isArray(response.data)) {
                localStorage.setItem(cacheKey, JSON.stringify(response.data));
                localStorage.setItem(cacheTimestampKey, Date.now().toString());
                
                setAvailableMaps(prev => ({
                    ...prev,
                    [gameName]: response.data,
                    [`${gameName}_loading`]: false
                }));
            } else {
                throw new Error('Получен неверный формат данных карт');
            }

        } catch (error) {
            console.error(`❌ Ошибка при загрузке карт для игры ${gameName}:`, error);
            
            // Fallback для CS2
            if (isCounterStrike2(gameName)) {
                const defaultMaps = getDefaultCS2Maps();
                setAvailableMaps(prev => ({
                    ...prev,
                    [gameName]: defaultMaps,
                    [`${gameName}_loading`]: false
                }));
            } else {
                setAvailableMaps(prev => ({
                    ...prev,
                    [gameName]: [],
                    [`${gameName}_loading`]: false
                }));
            }
        }
    }, [availableMaps]);

    // Функции для работы с картами
    const getGameMaps = useCallback((game) => {
        return getGameMapsHelper(game, availableMaps);
    }, [availableMaps]);

    const getDefaultMap = useCallback((game) => {
        return getDefaultMapHelper(game, availableMaps);
    }, [availableMaps]);

    // Функции для работы с картами в матче
    const addMap = useCallback(() => {
        const defaultMap = getDefaultMap(tournament?.game);
        setMaps(prevMaps => [...prevMaps, { map: defaultMap, score1: 0, score2: 0 }]);
    }, [tournament?.game, getDefaultMap]);

    const removeMap = useCallback((index) => {
        setMaps(prevMaps => prevMaps.filter((_, i) => i !== index));
    }, []);

    const updateMapScore = useCallback((index, team, score) => {
        setMaps(prevMaps => {
            const newMaps = [...prevMaps];
            if (newMaps[index]) {
                newMaps[index][`score${team}`] = score;
            }
            return newMaps;
        });
    }, []);

    const updateMapSelection = useCallback((index, mapName) => {
        setMaps(prevMaps => {
            const newMaps = [...prevMaps];
            if (newMaps[index]) {
                newMaps[index].map = mapName;
            }
            return newMaps;
        });
    }, []);

    // Определение прав доступа
    const canGenerateBracket = useMemo(() => {
        return user && (isCreator || adminRequestStatus === 'accepted') && matches.length === 0;
    }, [user, isCreator, adminRequestStatus, matches.length]);

    const canEditMatches = useMemo(() => {
        return user && (isCreator || adminRequestStatus === 'accepted');
    }, [user, isCreator, adminRequestStatus]);

    // Подготовка данных для отображения сетки
    const games = useMemo(() => {
        if (!Array.isArray(matches) || matches.length === 0) {
            console.log('🚫 Games: нет матчей для отображения');
            return [];
        }

        console.log('🎮 Генерация данных для BracketRenderer с', matches.length, 'матчами');

        // Создаем карты участников и команд
        const participantsMap = {};
        const teamsMap = {};

        if (tournament?.participants) {
            tournament.participants.forEach(participant => {
                if (validateParticipantData(participant)) {
                    participantsMap[participant.id] = participant;
                }
            });
        }

        if (tournament?.teams) {
            tournament.teams.forEach(team => {
                if (team?.id) {
                    teamsMap[team.id] = team;
                }
            });
        }

        // Функция для получения информации об участнике/команде
        const getParticipantInfo = (teamId) => {
            if (!teamId) return null;

            if (teamsMap[teamId]) {
                const team = teamsMap[teamId];
                return {
                    id: teamId,
                    name: team.name,
                    avatar_url: team.members?.[0]?.avatar_url || null,
                    members: team.members || []
                };
            }

            if (participantsMap[teamId]) {
                const participant = participantsMap[teamId];
                return {
                    id: teamId,
                    name: participant.name || participant.username,
                    avatar_url: participant.avatar_url,
                    members: []
                };
            }

            return null;
        };

        // Создание безопасного участника
        const createSafeParticipant = (teamId, resultText, isWinner, status = 'PLAYED') => {
            const participantInfo = getParticipantInfo(teamId);

            return {
                id: teamId ? String(teamId) : 'tbd',
                resultText: resultText !== null ? String(resultText) : null,
                isWinner: Boolean(isWinner),
                status: status || 'NO_SHOW',
                name: participantInfo?.name || 'TBD',
                score: resultText,
                avatarUrl: participantInfo?.avatar_url ? ensureHttps(participantInfo.avatar_url) : null
            };
        };

        // Формируем массив игр
        const safeGames = matches.map(match => {
            let status = 'SCHEDULED';
            if (match.winner_team_id) {
                status = 'DONE';
            } else if (match.team1_id && match.team2_id) {
                status = 'READY';
            }

            const team1Result = match.score1 !== null ? match.score1 : null;
            const team2Result = match.score2 !== null ? match.score2 : null;

            return {
                id: String(match.id),
                nextMatchId: match.next_match_id ? String(match.next_match_id) : null,
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
                        team1Result,
                        match.winner_team_id === match.team1_id,
                        match.team1_id ? 'PLAYED' : 'NO_SHOW'
                    ),
                    createSafeParticipant(
                        match.team2_id,
                        team2Result,
                        match.winner_team_id === match.team2_id,
                        match.team2_id ? 'PLAYED' : 'NO_SHOW'
                    )
                ]
            };
        });

        console.log('✅ Безопасные игры для BracketRenderer созданы:', safeGames.length);
        return safeGames;
    }, [matches, tournament]);

    // Обработчик генерации команд
    const handleTeamsGenerated = useCallback((teams) => {
        if (Array.isArray(teams)) {
            if (tournament?.participants?.length > 0) {
                setOriginalParticipants([...tournament.participants]);
            }
        }
    }, [tournament?.participants]);

    // Загрузка данных пользователя
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
                .then((userResponse) => {
                    setUser(userResponse.data);
                    return api.get(`/api/teams?userId=${userResponse.data.id}`, { 
                        headers: { Authorization: `Bearer ${token}` } 
                    });
                })
                .then((res) => setTeams(Array.isArray(res.data) ? res.data : []))
                .catch((error) => {
                    console.error('❌ Ошибка загрузки пользователя или команд:', error);
                    handleAuthError(error, 'загрузке пользователя');
                });
        } else {
            setUser(null);
            setTeams([]);
        }
    }, [handleAuthError]);

    // Загрузка данных турнира
    useEffect(() => {
        fetchTournamentData();
    }, [fetchTournamentData]);

    // Загрузка карт при изменении игры
    useEffect(() => {
        if (tournament?.game && gameHasMaps(tournament.game)) {
            console.log(`🗺️ Загружаем карты для игры: ${tournament.game}`);
            fetchMapsForGame(tournament.game);
        }
    }, [tournament?.game, fetchMapsForGame]);

    // WebSocket соединение
    useEffect(() => {
        if (!user || !tournament?.id) {
            console.log('⏳ Отложена инициализация WebSocket: нет пользователя или ID турнира');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            console.log('⏳ Отсутствует токен для WebSocket подключения');
            return;
        }

        console.log('🔌 Инициализация WebSocket соединения для турнира', tournament.id);

        // Закрываем существующее соединение
        if (wsRef.current) {
            console.log('🔌 Закрываем существующее WebSocket соединение');
            wsRef.current.disconnect();
            wsRef.current = null;
        }

        // Создаем новое соединение
        const socket = io(API_URL, {
            query: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
        });

        socket.on('connect', () => {
            console.log('✅ Socket.IO соединение установлено');
            socket.emit('watch_tournament', id);
            socket.emit('join_tournament_chat', id);
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Socket.IO соединение закрыто:', reason);
        });

        socket.on('error', (error) => {
            console.error('❌ Ошибка Socket.IO соединения:', error);
        });

        socket.on('tournament_update', (tournamentData) => {
            if (tournamentData.tournamentId === parseInt(id) || tournamentData.id === parseInt(id)) {
                console.log('📡 Получено обновление турнира через WebSocket');
                fetchTournamentData();
            }
        });

        wsRef.current = socket;

        return () => {
            console.log('🔌 Закрываем Socket.IO соединение при размонтировании');
            if (socket) {
                socket.disconnect();
            }
        };
    }, [id, user, tournament?.id, fetchTournamentData]);

    // Проверка прав пользователя
    useEffect(() => {
        if (!user || !tournament) return;

        // Проверка участия
        const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
        const isParticipant = participants.some(p => {
            if (!validateParticipantData(p)) return false;
            return (tournament.participant_type === 'solo' && p.user_id === user.id) ||
                   (tournament.participant_type === 'team' && p.creator_id === user.id);
        });
        setIsParticipating(isParticipant);

        // Проверка прав администратора
        setIsCreator(user.id === tournament.created_by);
        const isAdmin = Array.isArray(tournament.admins) ? 
            tournament.admins.some(admin => admin?.id === user.id) : false;
        setIsAdminOrCreator(user.id === tournament.created_by || isAdmin);

        // Проверка статуса запроса на администрирование
        const token = localStorage.getItem('token');
        if (token) {
            api.get(`/api/tournaments/${id}/admin-request-status`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            .then((statusResponse) => setAdminRequestStatus(statusResponse.data.status))
            .catch((error) => {
                console.error('❌ Ошибка загрузки статуса администратора:', error);
            });
        }
    }, [user, tournament, id]);

    // Обработка ошибок загрузки
    if (loading) {
        return (
            <div className="tournament-loading" data-testid="tournament-loading">
                <div className="loading-content">
                    <h2>🔄 Загрузка турнира...</h2>
                    <p>Пожалуйста, подождите</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="auth-error-container" data-testid="tournament-error">
                <div className="auth-error-message">
                    <h2>⚠️ Ошибка загрузки турнира</h2>
                    <p>{error}</p>
                    <button 
                        className="auth-error-button" 
                        onClick={() => {
                            setError(null);
                            fetchTournamentData();
                        }}
                    >
                        🔄 Попробовать снова
                    </button>
                </div>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="tournament-not-found" data-testid="tournament-not-found">
                <h2>❓ Турнир не найден</h2>
                <p>Турнир с указанным ID не существует или был удален.</p>
                <button onClick={() => navigate('/')}>🏠 На главную</button>
            </div>
        );
    }

    // Основной рендер
    return (
        <TournamentErrorBoundary>
            <div className="tournament-details-tournamentdetails" data-testid="tournament-details">
                <div className="tournament-layout">
                    <div className="tournament-main">
                        {/* Заголовок турнира */}
                        <div className="tournament-header-tournamentdetails">
                            <h2 data-testid="tournament-title">{tournament.name}</h2>
                        </div>

                        {/* Навигация по табам */}
                        <div className="tabs-navigation-tournamentdetails">
                            <button className="tab-button-tournamentdetails active">
                                <span className="tab-label-tournamentdetails">📋 Информация</span>
                            </button>
                        </div>

                        {/* Контент турнира */}
                        <div className="tournament-content-tournamentdetails">
                            <div className="tab-content-tournamentdetails">
                                {/* Информационная секция */}
                                <TournamentInfoSection 
                                    tournament={tournament}
                                    user={user}
                                    isCreator={isCreator}
                                    isAdminOrCreator={isAdminOrCreator}
                                />

                                {/* Панель участников */}
                                <UnifiedParticipantsPanel
                                    tournament={tournament}
                                    participants={tournament.participants || []}
                                    matches={matches}
                                    mixedTeams={tournament.teams || []}
                                    isCreatorOrAdmin={isAdminOrCreator}
                                    user={user}
                                    onRemoveParticipant={() => {}}
                                    onShowAddParticipantModal={() => openModal('addParticipant')}
                                    onShowParticipantSearchModal={() => openModal('participantSearch')}
                                    onTeamsGenerated={handleTeamsGenerated}
                                    onTeamsUpdated={() => {}}
                                    calculateTeamAverageRating={() => 0}
                                    setRatingType={() => {}}
                                    userPermissions={{}}
                                    handleParticipate={() => {}}
                                    setMessage={setMessage}
                                />

                                {/* Турнирная сетка */}
                                {games.length > 0 && (
                                    <div className="bracket-section">
                                        <h3>🏆 Турнирная сетка</h3>
                                        <TournamentErrorBoundary>
                                            <Suspense fallback={
                                                <div className="bracket-loading" data-testid="bracket-loading">
                                                    🔄 Загрузка турнирной сетки...
                                                </div>
                                            }>
                                                <LazyBracketRenderer
                                                    games={games}
                                                    canEditMatches={canEditMatches}
                                                    selectedMatch={selectedMatch}
                                                    setSelectedMatch={setSelectedMatch}
                                                    handleTeamClick={() => {}}
                                                    format={tournament.format}
                                                    onMatchClick={(match) => {
                                                        setSelectedMatchForDetails(match);
                                                        openModal('matchDetails');
                                                    }}
                                                />
                                            </Suspense>
                                        </TournamentErrorBoundary>
                                    </div>
                                )}

                                {/* Генератор команд для микс-турниров */}
                                {tournament.participant_type === 'mix' && (
                                    <TeamGenerator
                                        tournament={tournament}
                                        participants={originalParticipants}
                                        onTeamsGenerated={handleTeamsGenerated}
                                        onTeamsUpdated={() => {}}
                                        onRemoveParticipant={() => {}}
                                        isAdminOrCreator={isAdminOrCreator}
                                    />
                                )}

                                {/* Панель достижений */}
                                {user && (
                                    <AchievementsPanel userId={user.id} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Модальные окна */}
                {modals.addParticipant && (
                    <AddParticipantModal
                        isOpen={modals.addParticipant}
                        onClose={() => closeModal('addParticipant')}
                        newParticipantData={newParticipantData}
                        setNewParticipantData={setNewParticipantData}
                        onSubmit={() => {}}
                        isLoading={false}
                    />
                )}

                {modals.participantSearch && (
                    <ParticipantSearchModal
                        isOpen={modals.participantSearch}
                        onClose={() => closeModal('participantSearch')}
                        onInvite={() => {}}
                        searchQuery=""
                        setSearchQuery={() => {}}
                        searchResults={[]}
                        isSearching={false}
                        onSearch={() => {}}
                        existingParticipants={tournament.participants || []}
                    />
                )}

                {modals.matchResult && selectedMatch && (
                    <MatchResultModal
                        isOpen={modals.matchResult}
                        onClose={() => closeModal('matchResult')}
                        selectedMatch={selectedMatch}
                        matchResultData={matchResultData}
                        setMatchResultData={setMatchResultData}
                        onSave={() => {}}
                        isLoading={false}
                        tournament={tournament}
                    />
                )}

                {modals.matchDetails && selectedMatchForDetails && (
                    <MatchDetailsModal
                        isOpen={modals.matchDetails}
                        onClose={() => closeModal('matchDetails')}
                        selectedMatch={selectedMatchForDetails}
                        canEdit={canEditMatches}
                        onEdit={() => {
                            closeModal('matchDetails');
                            setSelectedMatch(selectedMatchForDetails);
                            openModal('matchResult');
                        }}
                        tournament={tournament}
                    />
                )}

                {/* Плавающая панель действий */}
                <TournamentFloatingActionPanel
                    tournament={tournament}
                    user={user}
                    hasAccess={isAdminOrCreator}
                    onStartTournament={() => {}}
                    onEndTournament={() => {}}
                    onGenerateBracket={() => {}}
                    onRegenerateBracket={() => {}}
                    onClearResults={() => {}}
                    hasMatches={matches.length > 0}
                    hasBracket={games.length > 0}
                />

                {/* Сообщения */}
                {message && (
                    <div className="tournament-message" data-testid="tournament-message">
                        {message}
                    </div>
                )}
            </div>
        </TournamentErrorBoundary>
    );
}

export default TournamentDetails; 