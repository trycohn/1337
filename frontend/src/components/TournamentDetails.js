// Импорты React и связанные
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';
import './TournamentDetails.css';
import TeamGenerator from './TeamGenerator';
import { ensureHttps } from '../utils/userHelpers';
// Импортируем вспомогательные функции для работы с картами
import { isCounterStrike2, gameHasMaps, getGameMaps as getGameMapsHelper, getDefaultMap as getDefaultMapHelper, getDefaultCS2Maps } from '../utils/mapHelpers';

// Импорт уведомлений и тостов
// Импорт модулярной системы V4.2.1
import useTournamentModals from '../hooks/tournament/useTournamentModals';
import MatchResultModal from './tournament/modals/MatchResultModal';
import MatchDetailsModal from './tournament/modals/MatchDetailsModal';

// eslint-disable-next-line no-unused-vars
import { useUser } from '../context/UserContext';

// ИСПРАВЛЕНИЕ: убираем React.lazy и используем обычный импорт
import BracketRenderer from './BracketRenderer';

// ИСПРАВЛЕНИЕ: упрощаем ErrorBoundary
class BracketErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        console.error('BracketErrorBoundary: ошибка в рендере bracket:', error);
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('BracketErrorBoundary: полная информация об ошибке:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="bracket-error" style={{
                    padding: '20px',
                    textAlign: 'center',
                    background: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    margin: '20px 0'
                }}>
                    <h3>⚠️ Произошла ошибка при отображении турнирной сетки</h3>
                    <p>Пожалуйста, обновите страницу или попробуйте позже.</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{
                            padding: '8px 16px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Обновить страницу
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

// Глобальные константы
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Конфигурация для игр с картами
const GAME_CONFIGS = {
    COUNTER_STRIKE_2: {
        id: 21,
        name: 'Counter-Strike 2',
        hasMaps: true
    },
    // Здесь можно добавить другие игры в будущем
    // Например:
    // VALORANT: {
    //     id: 3,
    //     name: 'Valorant',
    //     hasMaps: true
    // },
};

// Функция для проверки, поддерживает ли игра карты
// Компонент для отображения оригинального списка участников
const OriginalParticipantsList = ({ participants, tournament }) => {
  if (!participants || participants.length === 0) {
    return (
      <div className="original-participants-list-wrapper">
        <h3>Зарегистрированные игроки (0)</h3>
        <p className="no-participants">Нет зарегистрированных игроков</p>
      </div>
    );
  }

  return (
    <div className="original-participants-list-wrapper">
      <h3>Зарегистрированные игроки ({participants.length})</h3>
      <div className="original-participants-grid">
        {participants.map((participant) => (
          <div key={participant?.id || `participant-${Math.random()}`} className="participant-card">
            <div className="participant-info">
              <div className="participant-avatar">
                {participant && participant.avatar_url ? (
                  <img 
                    src={ensureHttps(participant.avatar_url)} 
                    alt={((participant && participant.name) || '?').charAt(0)} 
                    onError={(e) => {e.target.src = '/default-avatar.png'}}
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {((participant && participant.name) || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {participant && participant.user_id ? (
                <Link 
                  to={`/user/${participant.user_id}`} 
                  className="participant-name"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {participant.name || 'Участник'}
                </Link>
              ) : (
                <span className="participant-name">{participant?.name || 'Участник'}</span>
              )}
              <span className="participant-rating">FACEIT: {participant.faceit_elo || 1000}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function TournamentDetails() {
    const { id } = useParams();
    
    // eslint-disable-next-line no-unused-vars
    const [tournament, setTournament] = useState(null);
    // eslint-disable-next-line no-unused-vars
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
    const [selectedWinnerId, setSelectedWinnerId] = useState(null);
    const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
    const [matchScores, setMatchScores] = useState({ team1: 0, team2: 0 });
    const [selectedUser, setSelectedUser] = useState(null);
    const wsRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreator, setIsCreator] = useState(false);
    const [isAdminOrCreator, setIsAdminOrCreator] = useState(false);
    const [userSearchResults, setUserSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState('');
    const [showFullDescription, setShowFullDescription] = useState(false);
    const [isEditingPrizePool, setIsEditingPrizePool] = useState(false);
    const [editedPrizePool, setEditedPrizePool] = useState('');
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
    const [viewingMatchDetails, setViewingMatchDetails] = useState(false);
    const [matchDetails, setMatchDetails] = useState(null);
    const [maps, setMaps] = useState([{ map: 'de_dust2', score1: 0, score2: 0 }]);
    const [showMapSelection, setShowMapSelection] = useState(false);
    const descriptionRef = useRef("");
    const prizePoolRef = useRef("");
    const fullDescriptionRef = useRef("");
    const rulesRef = useRef("");
    // УДАЛЕНО: состояния для чата
    const [showEndTournamentModal, setShowEndTournamentModal] = useState(false);
    const [originalParticipants, setOriginalParticipants] = useState([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [sentInvitations, setSentInvitations] = useState([]);
    
    // Добавляем новое состояние для хранения карт для разных игр
    const [availableMaps, setAvailableMaps] = useState({});
    
    // Проверяем, соединились ли с вебсокетом
    const [wsConnected, setWsConnected] = useState(false);
    
    // 🆕 ИНТЕГРАЦИЯ МОДУЛЬНОЙ СИСТЕМЫ V4.2.1
    const tournamentModals = useTournamentModals();
    
    // eslint-disable-next-line no-unused-vars
    const checkParticipation = useCallback(() => {
        // ... implementation ...
    }, [tournament, user]);
    
    const addMap = () => {
        const defaultMap = getDefaultMapHelper(tournament?.game);
        setMaps([...maps, { map: defaultMap, score1: 0, score2: 0 }]);
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
    
    // Функция для проверки участия пользователя в турнире
    const fetchTournamentData = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        // Проверяем кеш в localStorage
        const cacheKey = `tournament_cache_${id}`;
        const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
        const cachedTournament = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
        const cacheValidityPeriod = 2 * 60 * 1000; // 2 минуты в миллисекундах
        
        // Если есть валидный кеш (не старше 2 минут), используем его
        if (cachedTournament && cacheTimestamp) {
            const now = new Date().getTime();
            const timestamp = parseInt(cacheTimestamp, 10);
            
            if (!isNaN(timestamp) && (now - timestamp) < cacheValidityPeriod) {
                try {
                    const parsedTournament = JSON.parse(cachedTournament);
                    if (parsedTournament && parsedTournament.id) {
                        console.log(`Используем кешированные данные турнира ${id}`);
                        setTournament(parsedTournament);
                        setMatches(parsedTournament.matches || []);
                        
                        // Сохраняем исходный список участников при загрузке турнира
                        if (parsedTournament.participants && parsedTournament.participants.length > 0) {
                            setOriginalParticipants(parsedTournament.participants);
                        }
                        
                        setLoading(false);
                        return;
                    }
                } catch (parseError) {
                    console.error('Ошибка при разборе кешированных данных турнира:', parseError);
                    // Если произошла ошибка при разборе, очищаем кеш
                    localStorage.removeItem(cacheKey);
                    localStorage.removeItem(cacheTimestampKey);
                }
            } else {
                // Кеш устарел, очищаем его
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
            }
        }
        
        // Если нет валидного кеша, делаем запрос к API
        console.log(`Загружаем данные турнира ${id} с сервера...`);
        
        try {
            const response = await api.get(`/api/tournaments/${id}`);
            
            // Кешируем результаты в localStorage
            localStorage.setItem(cacheKey, JSON.stringify(response.data));
            localStorage.setItem(cacheTimestampKey, new Date().getTime().toString());
            
            setTournament(response.data);
            setMatches(response.data.matches || []);
            
            // Сохраняем исходный список участников при загрузке турнира
            if (response.data.participants && response.data.participants.length > 0) {
                setOriginalParticipants(response.data.participants);
            }
        } catch (error) {
            console.error('Ошибка загрузки турнира:', error);
            setError('Ошибка загрузки данных турнира');
            
            // Пробуем использовать данные из кеша, даже если они устаревшие
            try {
                const oldCache = localStorage.getItem(cacheKey);
                if (oldCache) {
                    const parsedOldCache = JSON.parse(oldCache);
                    if (parsedOldCache && parsedOldCache.id) {
                        console.log(`Используем устаревшие кешированные данные турнира ${id} из-за ошибки API`);
                        setTournament(parsedOldCache);
                        setMatches(parsedOldCache.matches || []);
                        
                        if (parsedOldCache.participants && parsedOldCache.participants.length > 0) {
                            setOriginalParticipants(parsedOldCache.participants);
                        }
                        
                        setError('Использованы кешированные данные. Некоторая информация может быть устаревшей.');
                    }
                }
            } catch (cacheError) {
                console.error('Ошибка при попытке использовать устаревший кеш:', cacheError);
            }
        } finally {
            setLoading(false);
        }
    }, [id]);
    
    // Функция для загрузки карт из БД
    const fetchMapsForGame = useCallback(async (gameName) => {
        try {
            if (!gameName) return;
            
            // Если карты для этой игры уже загружены в состоянии, не делаем повторный запрос
            if (availableMaps[gameName] && availableMaps[gameName].length > 0) {
                return;
            }
            
            // Устанавливаем флаг, что мы начали загружать карты для этой игры,
            // чтобы предотвратить множественные запросы
            setAvailableMaps(prev => ({
                ...prev,
                [gameName]: prev[gameName] || [],
                [`${gameName}_loading`]: true
            }));
            
            // Проверяем, есть ли карты в localStorage
            const cacheKey = `maps_cache_${gameName}`;
            const cachedMaps = localStorage.getItem(cacheKey);
            const cacheTimestampKey = `maps_cache_timestamp_${gameName}`;
            const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
            const cacheValidityPeriod = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
            
            // Если есть валидный кеш (не старше 24 часов), используем его
            if (cachedMaps && cacheTimestamp) {
                const now = new Date().getTime();
                const timestamp = parseInt(cacheTimestamp, 10);
                
                if (!isNaN(timestamp) && (now - timestamp) < cacheValidityPeriod) {
                    try {
                        const parsedMaps = JSON.parse(cachedMaps);
                        if (Array.isArray(parsedMaps) && parsedMaps.length > 0) {
                            console.log(`Используем кешированные карты для игры ${gameName}`);
                            setAvailableMaps(prev => ({
                                ...prev,
                                [gameName]: parsedMaps,
                                [`${gameName}_loading`]: false
                            }));
                            return;
                        }
                    } catch (parseError) {
                        console.error('Ошибка при разборе кешированных карт:', parseError);
                        // Если произошла ошибка при разборе, очищаем кеш
                        localStorage.removeItem(cacheKey);
                        localStorage.removeItem(cacheTimestampKey);
                    }
                } else {
                    // Кеш устарел, очищаем его
                    localStorage.removeItem(cacheKey);
                    localStorage.removeItem(cacheTimestampKey);
                }
            }
            
            // Если нет валидного кеша, делаем запрос к API
            console.log(`Загружаем карты для игры ${gameName} с сервера...`);
            
            // Добавляем задержку между повторными запросами
            await new Promise(resolve => setTimeout(resolve, 300));
            
            try {
                const response = await api.get(`/api/maps?game=${encodeURIComponent(gameName)}`);
                
                if (response.data && Array.isArray(response.data)) {
                    // Сохраняем карты в кеш
                    localStorage.setItem(cacheKey, JSON.stringify(response.data));
                    localStorage.setItem(cacheTimestampKey, new Date().getTime().toString());
                    
                    // Обновляем состояние
                    setAvailableMaps(prev => ({
                        ...prev,
                        [gameName]: response.data,
                        [`${gameName}_loading`]: false
                    }));
                    console.log(`Загружены карты для игры ${gameName}:`, response.data);
                }
            } catch (apiError) {
                console.error(`Ошибка при загрузке карт для игры ${gameName}:`, apiError);
                
                // В случае ошибки, используем запасной вариант со стандартными картами для CS2
                if (isCounterStrike2(gameName)) {
                    console.log(`Используем стандартные карты для игры ${gameName}`);
                    
                    // Базовый набор карт для CS2
                    const defaultMaps = getDefaultCS2Maps();
                    
                    // Сохраняем стандартные карты в кеш и состояние
                    localStorage.setItem(`maps_cache_${gameName}`, JSON.stringify(defaultMaps));
                    localStorage.setItem(`maps_cache_timestamp_${gameName}`, new Date().getTime().toString());
                    
                    setAvailableMaps(prev => ({
                        ...prev,
                        [gameName]: defaultMaps,
                        [`${gameName}_loading`]: false
                    }));
                } else {
                    // Если это не CS2, устанавливаем пустой массив
                    setAvailableMaps(prev => ({
                        ...prev,
                        [gameName]: [],
                        [`${gameName}_loading`]: false
                    }));
                }
            }
        } catch (error) {
            console.error(`Ошибка при получении карт для игры ${gameName}:`, error);
            
            // Сбрасываем флаг загрузки и устанавливаем пустой массив
            setAvailableMaps(prev => ({
                ...prev,
                [gameName]: [],
                [`${gameName}_loading`]: false
            }));
        }
    }, [isCounterStrike2, availableMaps]);
    
// Функция для получения карт для конкретной игры с использованием хелпера
const getGameMaps = useCallback((game) => {
    return getGameMapsHelper(game, availableMaps);
}, [availableMaps]);

    
// Функция для получения одной карты по умолчанию для данной игры
const getDefaultMap = useCallback((game) => {
    return getDefaultMapHelper(game, availableMaps);
}, [availableMaps]);


    // Используем useMemo, чтобы уменьшить количество перерисовок
    const memoizedGameData = useMemo(() => {
        // Этот объект будет пересоздаваться только когда изменятся availableMaps или tournament
        return {
            tournamentGame: tournament?.game,
            gameSupportsMap: tournament?.game ? gameHasMaps(tournament.game) : false,
            availableMapsForGame: tournament?.game ? (availableMaps[tournament.game] || []) : [],
            isMapLoading: tournament?.game ? !!availableMaps[`${tournament.game}_loading`] : false
        };
    }, [tournament?.game, availableMaps, gameHasMaps]);
    
    // Загружаем данные пользователя
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
        } else {
            setUser(null);
            setTeams([]);
        }
    }, []);
    
    // Загружаем данные турнира
    useEffect(() => {
        fetchTournamentData();
    }, [id, fetchTournamentData]);
    
    // Загружаем карты для турнира
    useEffect(() => {
        const { tournamentGame, availableMapsForGame, isMapLoading } = memoizedGameData;
        
        // Загружаем карты только если:
        // 1. Есть игра
        // 2. У нас нет карт для этой игры
        // 3. Мы еще не начали загрузку карт
        if (tournamentGame && availableMapsForGame.length === 0 && !isMapLoading) {
            console.log(`Инициирую загрузку карт для ${tournamentGame}`);
            fetchMapsForGame(tournamentGame);
        }
    }, [memoizedGameData, fetchMapsForGame]);
    
    // Настройка Socket.IO для получения обновлений турнира
    useEffect(() => {
        // Только установим соединение, если у нас есть токен и ID турнира
        if (!user || !tournament?.id) {
            console.log('Отложена инициализация WebSocket: нет пользователя или ID турнира');
            return;
        }
        
        console.log('Инициализация WebSocket соединения для турнира', tournament.id);
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('Отсутствует токен для WebSocket подключения');
            return;
        }
        
        // Если уже есть соединение, закрываем его перед созданием нового
        if (wsRef.current) {
            console.log('Закрываем существующее WebSocket соединение');
            wsRef.current.disconnect();
            wsRef.current = null;
        }
        
        // Создаем новое соединение с улучшенными параметрами подключения
        const socket = io(API_URL, {
            query: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
        });
        
        socket.on('connect', () => {
            console.log('Socket.IO соединение установлено в компоненте TournamentDetails');
            socket.emit('watch_tournament', id);
        });
        
        socket.on('disconnect', (reason) => {
            console.log('Socket.IO соединение закрыто:', reason);
        });
        
        socket.on('error', (error) => {
            console.error('Ошибка Socket.IO соединения:', error);
        });
        
        socket.on('connect_error', (error) => {
            console.error('Ошибка подключения Socket.IO:', error);
        });
        
        socket.on('tournament_update', (tournamentData) => {
            if (tournamentData.tournamentId === parseInt(id) || tournamentData.id === parseInt(id)) {
                console.log('Получено обновление турнира через WebSocket');
                fetchTournamentData();
            }
        });
        
        
        wsRef.current = socket;
        
        // Очистка при размонтировании
        return () => {
            console.log('Закрываем Socket.IO соединение при размонтировании');
            if (socket) {
                socket.disconnect();
            }
        };
    }, [id, user, tournament, fetchTournamentData, API_URL]);
    
    // Проверка участия пользователя и прав администратора
    useEffect(() => {
        if (!user || !tournament) return;
        // Проверка участия
        const participants = tournament.participants || [];
        const isParticipant = participants.some(
            (p) =>
                (tournament.participant_type === 'solo' && p.user_id === user.id) ||
                (tournament.participant_type === 'team' && p.creator_id === user.id)
        );
        setIsParticipating(isParticipant);

        // Проверка прав администратора и создателя
        setIsCreator(user.id === tournament.created_by);
        const isAdmin = tournament.admins?.some(admin => admin.id === user.id);
        setIsAdminOrCreator(user.id === tournament.created_by || isAdmin);

        return () => {
          if (wsRef.current) {
            wsRef.current.close();
          }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Функция для получения имени раунда
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
            // Получаем информацию об участнике из карты, если она доступна
            const participantInfo = teamId ? participantsMap[teamId] : null;
            
            return {
                id: teamId ? safeToString(teamId) : 'tbd',
                resultText: resultText !== null ? safeToString(resultText) : null,
                isWinner: Boolean(isWinner),
                status: status || 'NO_SHOW',
                name: name || 'TBD',
                score: resultText,
                // Добавляем аватар участника, если он доступен
                avatarUrl: participantInfo?.avatar_url ? ensureHttps(participantInfo.avatar_url) : null
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
    }, [matches, tournament, ensureHttps]);

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
    }, [games, tournament]); // Добавил tournament в зависимости

    // Обработчик успешной генерации команд в TeamGenerator
    const handleTeamsGenerated = (teams) => {
        if (teams && Array.isArray(teams)) {
            setMixedTeams(teams);
            
            // Сохраняем текущий список участников до формирования команд
            if (tournament && tournament.participants && tournament.participants.length > 0) {
                setOriginalParticipants([...tournament.participants]);
            }
        }
    };

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
    const handleUserSearchWithDelay = useCallback((query) => {
        // Очищаем предыдущий таймаут, если он существует
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        setSearchQuery(query);
        
        // Если запрос короткий, не выполняем поиск
        if (!query || query.length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            setIsSearching(false);
            return;
        }
        
        // Сохраняем флаг, что идет поиск
        setIsSearching(true);
        
        // Устанавливаем таймаут перед отправкой запроса
        const newTimeout = setTimeout(async () => {
            try {
                // Проверяем кеш для экономии запросов
                const cacheKey = `userSearch_${query}`;
                const cachedResults = localStorage.getItem(cacheKey);
                
                if (cachedResults) {
                    const parsedResults = JSON.parse(cachedResults);
                    console.log(`Использую кешированные результаты поиска для "${query}"`);
                    setSearchResults(parsedResults);
                    setShowSearchResults(true);
                    setIsSearching(false);
                    return;
                }
                
                // Если в кеше нет, делаем запрос на сервер
                console.log(`Поиск пользователей по запросу: "${query}"`);
                const response = await api.get(`/api/users/search?query=${encodeURIComponent(query)}`);
                
                if (response.data && response.data.length > 0) {
                    // Фильтруем результаты, исключая пользователей, которые уже участвуют в турнире
                    const filteredResults = response.data.filter(
                        (user) => !isUserParticipant(user.id) && !isInvitationSent(user.id)
                    );
                    
                    // Кешируем результаты на 10 минут
                    localStorage.setItem(cacheKey, JSON.stringify(filteredResults));
                    localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
                    
                    setSearchResults(filteredResults);
                } else {
                    setSearchResults([]);
                }
                
                setShowSearchResults(true);
                setIsSearching(false);
            } catch (error) {
                console.error("Ошибка при поиске пользователей:", error);
                setSearchResults([]);
                setShowSearchResults(false);
                setIsSearching(false);
            }
        }, 500); // Добавляем задержку в 500 мс
        
        setSearchTimeout(newTimeout);
    }, [isUserParticipant, isInvitationSent, searchTimeout]);

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
            console.logwarning('У вас нет прав для генерации сетки или сетка уже сгенерирована');
            return;
        }

        try {
            setMessage('Генерация сетки...');
            console.loginfo('Начинаем генерацию сетки...');
            
            // Проверка количества участников
            if (!tournament.participants || tournament.participants.length < 2) {
                setMessage('Недостаточно участников для генерации сетки. Минимум 2 участника.');
                console.logerror('Недостаточно участников для генерации сетки. Минимум 2 участника.');
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
            console.logsuccess('Сетка успешно сгенерирована!');
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
            console.logerror(errorMessage);
            
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
            if (matchData && matchData.maps_data && gameHasMaps(tournament.game)) {
                try {
                    const parsedMapsData = JSON.parse(matchData.maps_data);
                    if (Array.isArray(parsedMapsData) && parsedMapsData.length > 0) {
                        setMaps(parsedMapsData);
                        setShowMapSelection(true);
                    } else {
                        // Если данные есть, но не валидны, сбрасываем к исходному состоянию
                        setMaps([{ map: getGameMaps(tournament.game)[0] || '', score1: 0, score2: 0 }]);
                        setShowMapSelection(gameHasMaps(tournament.game));
                    }
                } catch (e) {
                    console.error('Ошибка при разборе данных карт:', e);
                    setMaps([{ map: getGameMaps(tournament.game)[0] || '', score1: 0, score2: 0 }]);
                    setShowMapSelection(gameHasMaps(tournament.game));
                }
            } else {
                // Для новых матчей или игр без карт
                const defaultMap = getGameMaps(tournament.game)[0] || '';
                setMaps([{ map: defaultMap, score1: 0, score2: 0 }]);
                setShowMapSelection(gameHasMaps(tournament.game));
            }
            
            // Отладочная информация
            console.log('Данные матча:', {
                match: selectedGame,
                team1Id,
                team2Id,
                selectedWinner,
                isByeMatch: isByeMatch,
                gameWithMaps: gameHasMaps(tournament.game)
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
                maps: gameHasMaps(tournament.game) ? maps : undefined
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
            
            // Если игра поддерживает карты и есть карты, обновляем счет на основе побед на картах
            let finalScore1 = score1;
            let finalScore2 = score2;
            
            if (tournament && gameHasMaps(tournament.game) && maps.length > 0) {
                // Считаем победы на картах
                const team1Wins = maps.filter(m => parseInt(m.score1) > parseInt(m.score2)).length;
                const team2Wins = maps.filter(m => parseInt(m.score2) > parseInt(m.score1)).length;
                
                // Обновляем счет
                finalScore1 = team1Wins;
                finalScore2 = team2Wins;
                
                console.log('Обновлен счет на основе карт:', { team1Wins, team2Wins });
            }
            
            // Формируем данные запроса
            const requestData = {
                matchId: Number(updatedMatch.id),
                winner_team_id: Number(winnerId),
                score1: Number(finalScore1) || 0,
                score2: Number(finalScore2) || 0
            };
            
            // Если включён выбор карт и игра поддерживает карты, добавляем информацию о картах
            if (gameHasMaps(tournament.game)) {
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
                // Выводим текст ошибки из ответа сервера, если он есть
                if (requestError.response && requestError.response.data && requestError.response.data.error) {
                    setMessage(`Ошибка: ${requestError.response.data.error}`);
                } else {
                    setMessage('Не удалось автоматически обновить результаты, данные синхронизированы');
                }
                console.log('⚠️ Запрос к API не удался, обновляем данные вручную', requestError.response?.data);
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
            console.log('🔍 [TournamentDetails] viewMatchDetails вызван с matchId:', matchId);
            
            const matchData = matches.find(m => m.id === parseInt(matchId));
            if (!matchData) {
                console.error(`❌ [TournamentDetails] Матч с ID ${matchId} не найден`);
                return;
            }

            console.log('✅ [TournamentDetails] Найден матч:', matchData);
            
            // 🆕 ИСПОЛЬЗУЕМ МОДУЛЬНУЮ СИСТЕМУ V4.2.1
            tournamentModals.openMatchResultModal(matchData);
            
        } catch (error) {
            console.error('❌ [TournamentDetails] Ошибка при просмотре деталей матча:', error);
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
            console.logsuccess(`Кэш приглашения для пользователя #${userId} очищен`);
            setMessage(`Кэш приглашения для пользователя #${userId} очищен`);
        } catch (error) {
            console.error('Ошибка при очистке кэша приглашения:', error);
            // Используем наше toast-уведомление
            console.logerror('Ошибка при очистке кэша приглашения');
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
            console.logsuccess('Весь кэш приглашений очищен');
            setMessage('Весь кэш приглашений очищен');
        } catch (error) {
            console.error('Ошибка при очистке всего кэша приглашений:', error);
            // Используем наше toast-уведомление
            console.logerror('Ошибка при очистке кэша приглашений');
            setMessage('Ошибка при очистке кэша приглашений');
        }
    };

    // Удаление участника турнира
    useEffect(() => {
        if (!userIdToRemove) return;
        
        const removeParticipant = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    console.logerror('Необходима авторизация для удаления участника');
                    return;
                }
                
                await api.delete(`/api/tournaments/${id}/participants/${userIdToRemove}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                // Обновляем список участников
                await fetchTournamentData();
                console.logsuccess('Участник успешно удален');
            } catch (error) {
                console.logerror(error.response?.data?.error || 'Ошибка при удалении участника');
                console.error('Ошибка при удалении участника:', error);
            } finally {
                setUserIdToRemove('');
            }
        };
        
        if (window.confirm('Вы уверены, что хотите удалить этого участника?')) {
            removeParticipant();
        } else {
            setUserIdToRemove('');
        }
    }, [userIdToRemove, id, fetchTournamentData]);

    if (!tournament) return <p>Загрузка...</p>;

    const canRequestAdmin = user && !isCreator && !adminRequestStatus;
    const canGenerateBracket = user && (isCreator || adminRequestStatus === 'accepted') && matches.length === 0;
    const canEditMatches = user && (isCreator || adminRequestStatus === 'accepted');

    // Получение победителей турнира
    const getTournamentWinners = () => {
        if (!matches || matches.length === 0 || tournament.status !== 'completed') {
            return [];
        }

        const result = [];
        
        // Определяем финальный матч
        let finalMatch = matches.find(match => {
            if (tournament.format === 'single_elimination' || tournament.format === 'mix') {
                const maxRound = Math.max(...matches.map(m => m.round));
                return match.round === maxRound && !match.is_third_place_match;
            } else if (tournament.format === 'double_elimination') {
                return match.next_match_id === null && !match.is_third_place_match;
            }
            return false;
        });

        // Если финал не найден или нет победителя, возвращаем пустой массив
        if (!finalMatch || !finalMatch.winner_team_id) {
            return [];
        }

        // Находим имя победителя (1 место)
        const firstPlaceId = finalMatch.winner_team_id;
        const firstPlaceParticipant = tournament.participants.find(p => p.id === firstPlaceId);
        if (firstPlaceParticipant) {
            // Находим членов команды для 1 места (если это командный турнир)
            let teamMembers = [];
            if (tournament.participant_type === 'team') {
                // Проверим, включены ли уже участники в команду
                if (Array.isArray(tournament.participants) && tournament.participants.some(p => p.team_id)) {
                    // Ищем участников с соответствующим team_id
                    teamMembers = tournament.participants
                        .filter(p => p.team_id === firstPlaceId)
                        .map(m => ({
                            id: m.id,
                            name: m.name || m.username,
                            avatar_url: m.avatar_url
                        }));
                }
            }

            result.push({
                place: 1,
                name: firstPlaceParticipant.name || firstPlaceParticipant.username,
                id: firstPlaceId,
                avatar_url: firstPlaceParticipant.avatar_url,
                members: teamMembers.length > 0 ? teamMembers : null
            });
        }

        // Находим второе место (проигравший в финале)
        const secondPlaceId = finalMatch.team1_id === firstPlaceId ? finalMatch.team2_id : finalMatch.team1_id;
        const secondPlaceParticipant = tournament.participants.find(p => p.id === secondPlaceId);
        if (secondPlaceParticipant) {
            // Находим членов команды для 2 места (если это командный турнир)
            let teamMembers = [];
            if (tournament.participant_type === 'team') {
                // Проверим, включены ли уже участники в команду
                if (Array.isArray(tournament.participants) && tournament.participants.some(p => p.team_id)) {
                    // Ищем участников с соответствующим team_id
                    teamMembers = tournament.participants
                        .filter(p => p.team_id === secondPlaceId)
                        .map(m => ({
                            id: m.id,
                            name: m.name || m.username,
                            avatar_url: m.avatar_url
                        }));
                }
            }

            result.push({
                place: 2,
                name: secondPlaceParticipant.name || secondPlaceParticipant.username,
                id: secondPlaceId,
                avatar_url: secondPlaceParticipant.avatar_url,
                members: teamMembers.length > 0 ? teamMembers : null
            });
        }

        // Находим матч за третье место, если он есть
        const thirdPlaceMatch = matches.find(m => m.is_third_place_match === true);
        if (thirdPlaceMatch && thirdPlaceMatch.winner_team_id) {
            const thirdPlaceId = thirdPlaceMatch.winner_team_id;
            const thirdPlaceParticipant = tournament.participants.find(p => p.id === thirdPlaceId);
            if (thirdPlaceParticipant) {
                // Находим членов команды для 3 места (если это командный турнир)
                let teamMembers = [];
                if (tournament.participant_type === 'team') {
                    // Проверим, включены ли уже участники в команду
                    if (Array.isArray(tournament.participants) && tournament.participants.some(p => p.team_id)) {
                        // Ищем участников с соответствующим team_id
                        teamMembers = tournament.participants
                            .filter(p => p.team_id === thirdPlaceId)
                            .map(m => ({
                                id: m.id,
                                name: m.name || m.username,
                                avatar_url: m.avatar_url
                            }));
                    }
                }

                result.push({
                    place: 3,
                    name: thirdPlaceParticipant.name || thirdPlaceParticipant.username,
                    id: thirdPlaceId,
                    avatar_url: thirdPlaceParticipant.avatar_url,
                    members: teamMembers.length > 0 ? teamMembers : null
                });
            }
        }

        // Логирование для диагностики
        console.log('Найдены победители:', result);
        if (tournament.participant_type === 'team') {
            console.log('Это командный турнир, структура участников:', tournament.participants);
        }

        return result;
    };

    // Компонент для рендеринга призёров турнира
    const renderWinners = () => {
        const tournamentWinners = getTournamentWinners();
        if (!tournamentWinners || tournamentWinners.length === 0) {
            return null;
        }

        return (
            <div className="winners-section">
                <h3>Призёры турнира</h3>
                <div className="winners-podium">
                    {tournamentWinners.map(winner => (
                        <div key={winner.id} className={`winner-card place-${winner.place}`}>
                            <div className="medal-icon">
                                {winner.place === 1 && <span className="gold-medal">🥇</span>}
                                {winner.place === 2 && <span className="silver-medal">🥈</span>}
                                {winner.place === 3 && <span className="bronze-medal">🥉</span>}
                            </div>
                            <div className="winner-avatar">
                                <img 
                                    src={ensureHttps(winner.avatar_url) || '/default-avatar.png'} 
                                    alt={`${winner.name} аватар`} 
                                    className="winner-avatar-img"
                                    onError={(e) => {e.target.src = '/default-avatar.png'}}
                                />
                            </div>
                            <div className="winner-name">
                                <strong>{winner.name}</strong>
                            </div>
                            {winner.members && winner.members.length > 0 && (
                                <div className="team-members">
                                    <h4>Состав команды:</h4>
                                    <ul>
                                        {winner.members.map((member, idx) => (
                                            <li key={idx} className="team-member">
                                                <img 
                                                    src={ensureHttps(member.avatar_url) || '/default-avatar.png'} 
                                                    alt={`${member.name} аватар`} 
                                                    className="member-avatar-img"
                                                    onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                />
                                                <span className="member-name">{member.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

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
                        <li key={participant?.id || `participant-${Math.random()}`} className="participant-item">
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
            console.logerror('Описание не может быть пустым');
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
            
            console.logsuccess('Описание успешно обновлено');
            setIsEditingDescription(false);
        } catch (error) {
            console.error('Ошибка при обновлении описания:', error);
            console.logerror(error.message || 'Не удалось обновить описание');
        } finally {
            setLoading(false);
        }
    };
    
    // Функция сохранения призового фонда
    const handleSavePrizePool = async () => {
        if (!prizePoolRef.current.trim()) {
            console.logerror('Информация о призовом фонде не может быть пустой');
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
            
            console.logsuccess('Призовой фонд успешно обновлен');
            setIsEditingPrizePool(false);
        } catch (error) {
            console.error('Ошибка при обновлении призового фонда:', error);
            console.logerror(error.message || 'Не удалось обновить призовой фонд');
        } finally {
            setLoading(false);
        }
    };
    
    // Функция сохранения полного описания турнира
    const handleSaveFullDescription = async () => {
        if (!fullDescriptionRef.current.trim()) {
            console.logerror('Полное описание не может быть пустым');
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
            
            console.logsuccess('Полное описание успешно обновлено');
            setIsEditingFullDescription(false);
        } catch (error) {
            console.error('Ошибка при обновлении полного описания:', error);
            console.logerror(error.message || 'Не удалось обновить полное описание');
        } finally {
            setLoading(false);
        }
    };
    
    // Функция сохранения правил турнира
    const handleSaveRules = async () => {
        if (!rulesRef.current.trim()) {
            console.logerror('Правила не могут быть пустыми');
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
            
            console.logsuccess('Правила успешно обновлены');
            setIsEditingRules(false);
        } catch (error) {
            console.error('Ошибка при обновлении правил:', error);
            console.logerror(error.message || 'Не удалось обновить правила');
        } finally {
            setLoading(false);
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
    const handleInviteUser = async (userId, username) => {
        if (!tournament || !tournament.id || !userId || !username) return;
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.post(`/api/tournaments/${tournament.id}/invite`, {
                username: username
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.data) {
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
                
                console.logsuccess('Приглашение успешно отправлено');
            }
        } catch (error) {
            console.error('Ошибка при отправке приглашения:', error);
            console.logerror(error.response?.data?.error || 'Не удалось отправить приглашение');
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
            console.logsuccess('Турнир успешно запущен');
        } catch (error) {
            console.error('Ошибка при запуске турнира:', error);
            console.logerror(error.message || 'Не удалось запустить турнир');
        } finally {
            setLoading(false);
        }
    };

    // Функция для пересоздания сетки турнира
    const handleRegenerateBracket = () => {
        console.loginfo("Функция пересоздания сетки отключена");
    };
    
    // Функция для завершения турнира
    const handleEndTournament = () => {
        setShowEndTournamentModal(true);
    };

    // Функция для фактического завершения турнира после подтверждения
    const confirmEndTournament = async () => {
        try {
            // eslint-disable-next-line no-unused-vars
            const response = await api.post(`/api/tournaments/${id}/end`, {});
            setTournament(prev => ({ ...prev, status: 'завершен' }));
            setShowEndTournamentModal(false);
            setMessage('Турнир успешно завершен!');
        } catch (error) {
            console.error('Ошибка при завершении турнира:', error);
            setMessage('Ошибка при завершении турнира!');
        }
    };
    
    // Функция для сброса результатов матчей
    const handleClearMatchResults = () => {
        console.loginfo("Функция сброса результатов отключена");
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
                    
                    {/* Отображаем оригинальный список участников - показываем всегда */}
                    {tournament && (
                        <OriginalParticipantsList 
                            participants={originalParticipants.length > 0 ? originalParticipants : tournament.participants} 
                            tournament={tournament}
                        />
                    )}
                    
                    {/* Если это не микс-турнир, показываем стандартное отображение участников, 
                        иначе этим займется TeamGenerator */}
                    {tournament.format !== 'mix' && renderParticipants()}
                    
                    {tournament.status === 'completed' && renderWinners()}
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
                                <div className="add-participant-section">
                                    <h3>Добавление участников</h3>
                                    <div className="search-container" ref={searchContainerRef}>
                                        <input 
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => handleUserSearchWithDelay(e.target.value)}
                                            placeholder="Поиск пользователей..."
                                            className="search-input add-participant-placeholder"
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
                                                                    <button 
                                                                        className="action-link no-bg-button search-result-action-button"
                                                                        disabled
                                                                    >
                                                                        уже отправлено
                                                                    </button>
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
                                    <div className="add-unregistered-participant">
                                        <input className="add-participant-placeholder"
                                            type="text"
                                            value={addParticipantName}
                                            onChange={(e) => setAddParticipantName(e.target.value)}
                                            placeholder="Имя участника"
                                        />
                                        <button className="add-participant-button" onClick={handleAddParticipant}>Добавить незарегистрированного участника</button>
                                    </div>
                                </div>
                            )}
                            {!isAdminOrCreator && tournament?.status === 'active' && (
                                <button onClick={handleRequestAdmin} className="request-admin-btn">
                                    Запросить права администратора
                                </button>
                            )}
                        </div>
                    )}
                    
                    {/* Заменяем секцию микс-турнира на компонент TeamGenerator */}
                    {tournament?.format === 'mix' && (
                        <TeamGenerator
                            tournament={tournament}
                            participants={tournament.participants || []}
                            onTeamsGenerated={handleTeamsGenerated}
                            onTeamsUpdated={fetchTournamentData}
                            onRemoveParticipant={setUserIdToRemove}
                            isAdminOrCreator={isAdminOrCreator}
                        />
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
                                        <BracketErrorBoundary>
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
                                        </BracketErrorBoundary>
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
                                
                                {tournament && gameHasMaps(tournament.game) ? (
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
                                                        {getGameMaps(tournament.game).map(map => (
                                                            <option key={map.name} value={map.name}>{map.name}</option>
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
                                        
                                        {maps.length < 7 && (
                                            <button 
                                                onClick={addMap} 
                                                className="add-map-btn"
                                                title="Добавить карту"
                                            >
                                                + Добавить карту
                                            </button>
                                        )}
                                        
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
                                                // Если это CS2 и у нас есть карты, обновляем общий счет на основе карт
            if (tournament && isCounterStrike2(tournament.game) && maps.length > 0) {
                                                    // Рассчитываем общий счет по победам на картах
                                                    const team1Wins = maps.filter(m => parseInt(m.score1) > parseInt(m.score2)).length;
                                                    const team2Wins = maps.filter(m => parseInt(m.score2) > parseInt(m.score1)).length;
                                                    
                                                    // Обновляем счет матча перед отправкой
                                                    setMatchScores({
                                                        team1: team1Wins,
                                                        team2: team2Wins
                                                    });
                                                }
                                                
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
                </div>
            </div>
            
            {/* Модальное окно подтверждения завершения турнира */}
            {showEndTournamentModal && (
                <div className="modal" onClick={() => setShowEndTournamentModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Подтверждение завершения турнира</h3>
                        <p>Вы уверены, что хотите завершить турнир?</p>
                        <p>После завершения турнир перейдет в статус "Завершен" и изменение результатов матчей будет недоступно.</p>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowEndTournamentModal(false)}>
                                Отмена
                            </button>
                            <button 
                                className="confirm-winner"
                                onClick={confirmEndTournament}
                            >
                                Завершить турнир
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
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
            
            {/* 🆕 МОДУЛЬНЫЕ КОМПОНЕНТЫ V4.2.1 */}
            <MatchResultModal
                tournament={tournament}
                matches={matches}
                onUpdateMatch={fetchTournamentData}
                tournamentModals={tournamentModals}
                canEditMatches={canEditMatches}
                getGameMaps={getGameMaps}
            />
            
            <MatchDetailsModal
                tournament={tournament}
                matches={matches}
                tournamentModals={tournamentModals}
            />
        </section>
    );
}

export default TournamentDetails;
