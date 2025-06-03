// Импорты React и связанные
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';
import './TournamentDetails.css';
import TeamGenerator from './TeamGenerator';
import { ensureHttps } from '../utils/userHelpers';
// Импортируем вспомогательные функции для работы с картами
import { 
  isCounterStrike2, 
  gameHasMaps, 
  getGameMaps as getGameMapsHelper, 
  getDefaultMap as getDefaultMapHelper, 
  getDefaultCS2Maps 
} from '../utils/mapHelpers';

// Импортируем BracketRenderer напрямую вместо использования React.lazy
import BracketRenderer from './BracketRenderer';


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

// Компонент для отображения оригинального списка участников
const OriginalParticipantsList = ({ participants, tournament }) => {
  // Не показываем список для микс-турниров, если есть сформированные команды
  if (tournament.format === 'mix' && tournament.teams && tournament.teams.length > 0) {
    return null;
  }

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
    const [chatMessages, setChatMessages] = useState([]);
    const [newChatMessage, setNewChatMessage] = useState('');
    const chatEndRef = useRef(null);
    const [showEndTournamentModal, setShowEndTournamentModal] = useState(false);
    const [showClearResultsModal, setShowClearResultsModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [originalParticipants, setOriginalParticipants] = useState([]);
    const [sentInvitations, setSentInvitations] = useState([]);
    
    // Состояние для хранения информации о создателе турнира
    const [creator, setCreator] = useState(null);
    
    // Добавляем новое состояние для хранения карт для разных игр
    const [availableMaps, setAvailableMaps] = useState({});
    
    // Проверяем, соединились ли с вебсокетом
    const [wsConnected, setWsConnected] = useState(false);
    
    // Состояния для редактирования результатов матча
    const [isEditingMatch, setIsEditingMatch] = useState(false);
    const [editingMatchData, setEditingMatchData] = useState(null);
    const [editingMaps, setEditingMaps] = useState([]);
    const [editingWinner, setEditingWinner] = useState(null);
    const [editingScores, setEditingScores] = useState({ team1: 0, team2: 0 });
    
    // Состояние для активной вкладки
    const [activeTab, setActiveTab] = useState('info');
    
    // Состояние для журнала событий
    const [tournamentLogs, setTournamentLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    
    // Состояние для модального окна состава команды
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [selectedTeamData, setSelectedTeamData] = useState(null);
    
    // Определение вкладок
    const tabs = [
        { id: 'info', label: 'Информация' },
        { id: 'participants', label: 'Участники' },
        { id: 'bracket', label: 'Сетка' },
        { id: 'results', label: 'Результаты' },
        { id: 'logs', label: 'Журнал' },
        { id: 'streams', label: 'Стримы' },
        { id: 'admin', label: 'Управление', adminOnly: true }
    ];
    
    // Фильтруем вкладки в зависимости от прав пользователя
    const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdminOrCreator);
    
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
    
    // eslint-disable-next-line no-unused-vars
    const checkParticipation = useCallback(() => {
        // ... implementation ...
    }, [tournament, user]);
    
    const addMap = () => {
        const defaultMap = getDefaultMap(tournament?.game, availableMaps);
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
                        
                        // Загружаем информацию о создателе турнира
                        if (parsedTournament.created_by) {
                            fetchCreatorInfo(parsedTournament.created_by);
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
            
            // Загружаем информацию о создателе турнира
            if (response.data.created_by) {
                fetchCreatorInfo(response.data.created_by);
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
                        
                        // Загружаем информацию о создателе турнира из кеша
                        if (parsedOldCache.created_by) {
                            fetchCreatorInfo(parsedOldCache.created_by);
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
    }, [id, fetchCreatorInfo]);
    
    // Функция для загрузки данных турнира с принудительной очисткой кеша
    const fetchTournamentDataForcefully = useCallback(async (clearCache = false) => {
        setLoading(true);
        setError(null);
        
        // Принудительно очищаем кеш при необходимости
        if (clearCache) {
            const cacheKey = `tournament_cache_${id}`;
            const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimestampKey);
            console.log(`Кеш турнира ${id} принудительно очищен`);
        }
        
        try {
            console.log(`Принудительная загрузка данных турнира ${id} с сервера...`);
            
            const response = await api.get(`/api/tournaments/${id}?_t=${Date.now()}`); // Добавляем timestamp для избежания кеширования браузера
            
            // Кешируем новые результаты
            const cacheKey = `tournament_cache_${id}`;
            const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
            localStorage.setItem(cacheKey, JSON.stringify(response.data));
            localStorage.setItem(cacheTimestampKey, new Date().getTime().toString());
            
            setTournament(response.data);
            setMatches(response.data.matches || []);
            
            // Сохраняем исходный список участников при загрузке турнира
            if (response.data.participants && response.data.participants.length > 0) {
                setOriginalParticipants(response.data.participants);
            }
            
            // Загружаем информацию о создателе турнира
            if (response.data.created_by) {
                fetchCreatorInfo(response.data.created_by);
            }
            
            console.log(`Данные турнира ${id} успешно обновлены:`, {
                status: response.data.status,
                participantsCount: response.data.participants?.length || 0,
                matchesCount: response.data.matches?.length || 0
            });
            
        } catch (error) {
            console.error('Ошибка при принудительной загрузке турнира:', error);
            setError('Ошибка загрузки данных турнира');
            
            // В крайнем случае пробуем использовать старый кеш
            try {
                const cacheKey = `tournament_cache_${id}`;
                const oldCache = localStorage.getItem(cacheKey);
                if (oldCache) {
                    const parsedOldCache = JSON.parse(oldCache);
                    if (parsedOldCache && parsedOldCache.id) {
                        console.log(`Используем старый кеш турнира ${id} из-за ошибки API`);
                        setTournament(parsedOldCache);
                        setMatches(parsedOldCache.matches || []);
                        setError('Использованы кешированные данные. Некоторая информация может быть устаревшей.');
                    }
                }
            } catch (cacheError) {
                console.error('Ошибка при попытке использовать старый кеш:', cacheError);
            }
        } finally {
            setLoading(false);
        }
    }, [id, fetchCreatorInfo]);
    
    // Функция для загрузки информации о создателе турнира
    const fetchCreatorInfo = async (creatorId) => {
        if (!creatorId) return;
        
        try {
            // Делаем прямой запрос к API для получения информации из БД
            console.log(`Загружаем информацию о создателе турнира (ID: ${creatorId}) из базы данных`);
            
            // Используем правильный маршрут API для получения данных пользователя
            // Примечание: маршрут `/api/users/profile/${creatorId}` может быть более надежным, чем `/api/users/${creatorId}`
            const response = await api.get(`/api/users/profile/${creatorId}`);
            
            if (response.data) {
                console.log(`Информация о создателе турнира успешно загружена из БД:`, response.data);
                setCreator(response.data);
                
                // Кешируем результат для возможного использования в будущем
                const cacheKey = `user_${creatorId}`;
                localStorage.setItem(cacheKey, JSON.stringify(response.data));
                localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
            }
        } catch (error) {
            console.error('Ошибка при загрузке данных создателя турнира из БД:', error);
            
            // Попытаемся найти информацию о создателе в списке участников
            if (tournament && tournament.participants && Array.isArray(tournament.participants)) {
                console.log('Поиск информации о создателе в списке участников турнира');
                
                const creatorFromParticipants = tournament.participants.find(
                    participant => participant.user_id === creatorId || participant.id === creatorId
                );
                
                if (creatorFromParticipants) {
                    console.log('Найдена информация о создателе в списке участников:', creatorFromParticipants);
                    
                    const creatorInfo = {
                        id: creatorId,
                        username: creatorFromParticipants.name || creatorFromParticipants.username || `Участник #${creatorId}`,
                        avatar_url: creatorFromParticipants.avatar_url || null,
                        fromParticipants: true
                    };
                    
                    setCreator(creatorInfo);
                    return;
                }
            }
            
            // Проверяем, есть ли кешированные данные
            try {
                console.log('Поиск информации о создателе в локальном кеше');
                const cacheKey = `user_${creatorId}`;
                const cachedUser = localStorage.getItem(cacheKey);
                
                if (cachedUser) {
                    const parsedUser = JSON.parse(cachedUser);
                    if (parsedUser && parsedUser.id === creatorId) {
                        console.log('Найдена информация о создателе в кеше:', parsedUser);
                        setCreator(parsedUser);
                        return;
                    }
                }
            } catch (cacheError) {
                console.error('Ошибка при проверке кешированных данных:', cacheError);
            }
            
            // Проверяем, можем ли мы получить данные из tournament.created_by_info
            if (tournament && tournament.created_by_info) {
                console.log('Использование информации о создателе из tournament.created_by_info');
                setCreator(tournament.created_by_info);
                return;
            }
            
            // Если все источники информации недоступны, создаем заглушку
            console.log('Все источники информации о создателе недоступны, создаем заглушку');
            setCreator({
                id: creatorId,
                username: `Создатель #${creatorId}`,
                avatar_url: null,
                isError: true
            });
        }
    };
    
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
    
    // Функция для загрузки журнала событий турнира
    const fetchTournamentLogs = useCallback(async () => {
        if (!tournament || !tournament.id) return;
        
        setLogsLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('Нет токена для загрузки журнала событий');
                return;
            }
            
            const response = await api.get(`/api/tournaments/${tournament.id}/logs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data) {
                setTournamentLogs(response.data);
            }
        } catch (error) {
            console.error('Ошибка загрузки журнала событий:', error);
        } finally {
            setLogsLoading(false);
        }
    }, [tournament]);
    
    // Загружаем журнал событий при переключении на вкладку
    useEffect(() => {
        if (activeTab === 'logs' && tournament) {
            fetchTournamentLogs();
        }
    }, [activeTab, tournament, fetchTournamentLogs]);
    
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
            socket.emit('join_tournament_chat', id);
            setWsConnected(true);
        });
        
        socket.on('disconnect', (reason) => {
            console.log('Socket.IO соединение закрыто:', reason);
            setWsConnected(false);
        });
        
        socket.on('error', (error) => {
            console.error('Ошибка Socket.IO соединения:', error);
            setWsConnected(false);
        });
        
        socket.on('connect_error', (error) => {
            console.error('Ошибка подключения Socket.IO:', error);
            setWsConnected(false);
        });
        
        socket.on('tournament_update', (tournamentData) => {
            if (tournamentData.tournamentId === parseInt(id) || tournamentData.id === parseInt(id)) {
                console.log('Получено обновление турнира через WebSocket:', tournamentData);
                
                // Обрабатываем различные форматы данных
                const data = tournamentData.data || tournamentData;
                
                // Если это обновление статуса, принудительно обновляем данные
                if (data.status && data.status !== tournament.status) {
                    console.log(`Статус турнира изменился с ${tournament.status} на ${data.status}`);
                    
                    // Принудительно перезагружаем данные с очисткой кеша
                    setTimeout(async () => {
                        try {
                            await fetchTournamentDataForcefully(true);
                            console.log('Данные турнира обновлены после изменения статуса через WebSocket');
                        } catch (error) {
                            console.error('Ошибка обновления данных после WebSocket события:', error);
                        }
                    }, 500);
                } else {
                    // Обычное обновление данных турнира
                    setTournament(prev => {
                        const updatedTournament = { ...prev, ...data };
                        console.log('Обновленные данные турнира через WebSocket:', updatedTournament);
                        return updatedTournament;
                    });
                }
                
                // Обновляем список матчей
                const matchesData = data.matches || tournamentData.matches || [];
                if (Array.isArray(matchesData)) {
                    console.log(`Получено ${matchesData.length} матчей через WebSocket`);
                    setMatches(matchesData);
                }
                
                // Устанавливаем сообщение для пользователя
                if (tournamentData.message) {
                    setMessage(tournamentData.message);
                    setTimeout(() => setMessage(''), 3000);
                }
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket.IO соединение закрыто в компоненте TournamentDetails:', reason);
            setWsConnected(false);
        });

        // Обработка новых сообщений чата турнира
        socket.on('tournament_message', (message) => {
            setChatMessages(prev => [...prev, message]);
        });

        wsRef.current = socket;
        
        // Очистка при размонтировании
        return () => {
            console.log('Закрываем Socket.IO соединение при размонтировании');
            if (socket) {
                socket.disconnect();
            }
            setWsConnected(false);
        };
    }, [id, user, tournament, fetchTournamentDataForcefully, API_URL]);
    
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

        // Проверка статуса запроса на администрирование
        if (localStorage.getItem('token')) {
            api
                .get(`/api/tournaments/${id}/admin-request-status`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                })
                .then((statusResponse) => setAdminRequestStatus(statusResponse.data.status))
                .catch((error) => console.error('Ошибка загрузки статуса администратора:', error));
        }
    }, [user, tournament, id]);
    
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

    useEffect(() => {
        setupWebSocket();
        return () => {
          if (wsRef.current) {
            wsRef.current.close();
          }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

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
        console.log('handleTeamsGenerated вызван с командами:', teams);
        
        if (teams && Array.isArray(teams)) {
            // Сохраняем команды в состоянии
            setMixedTeams(teams);
            console.log('mixedTeams обновлен:', teams);
            
            // Сохраняем текущий список участников до формирования команд
            if (tournament && tournament.participants && tournament.participants.length > 0) {
                setOriginalParticipants([...tournament.participants]);
                console.log('originalParticipants сохранен:', tournament.participants);
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
            alert('У вас нет прав для генерации сетки или сетка уже сгенерирована');
            return;
        }

        try {
            setMessage('Генерация сетки...');
            alert('Начинаем генерацию сетки...');
            
            // Проверка количества участников
            if (!tournament.participants || tournament.participants.length < 2) {
                setMessage('Недостаточно участников для генерации сетки. Минимум 2 участника.');
                alert('Недостаточно участников для генерации сетки. Минимум 2 участника.');
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
            alert('Сетка успешно сгенерирована!');
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
            alert(errorMessage);
            
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
            console.log('=== НАЧАЛО ОТЛАДКИ viewMatchDetails ===');
            console.log('Поиск матча с ID:', matchId);
            console.log('Все доступные матчи:', matches);
            
            const matchData = matches.find(m => m.id === parseInt(matchId));
            if (!matchData) {
                console.error(`Матч с ID ${matchId} не найден`);
                return;
            }

            console.log('Найденный матч:', matchData);

            // Если матч не завершен, не показываем детали
            if (!matchData.winner_team_id) {
                console.log('Матч не завершен, не показываем детали');
                return;
            }

            // Получаем информацию о командах
            const team1Info = tournament.participants.find(p => p.id === matchData.team1_id);
            const team2Info = tournament.participants.find(p => p.id === matchData.team2_id);

            console.log('Информация о командах:');
            console.log('Team1Info:', team1Info);
            console.log('Team2Info:', team2Info);

            const match = {
                id: matchData.id,
                team1: {
                    name: team1Info?.name || 'Участник 1',
                    score: matchData.score1,
                    winner: matchData.winner_team_id === matchData.team1_id
                },
                team2: {
                    name: team2Info?.name || 'Участник 2', 
                    score: matchData.score2,
                    winner: matchData.winner_team_id === matchData.team2_id
                },
                winner_id: matchData.winner_team_id,
                maps: []
            };

            // Отладочная информация
            console.log('=== ОТЛАДКА ДАННЫХ О КАРТАХ ===');
            console.log('Игра турнира:', tournament.game);
            console.log('Поддерживает ли игра карты:', gameHasMaps(tournament.game));
            console.log('Данные карт из БД (maps_data):', matchData.maps_data);
            console.log('Тип данных maps_data:', typeof matchData.maps_data);
            console.log('Является ли maps_data строкой:', typeof matchData.maps_data === 'string');
            console.log('Является ли maps_data объектом:', typeof matchData.maps_data === 'object');
            console.log('Является ли maps_data null:', matchData.maps_data === null);
            console.log('Является ли maps_data undefined:', matchData.maps_data === undefined);

            // Если есть данные о картах и это игра с картами, парсим их
            if (matchData.maps_data && gameHasMaps(tournament.game)) {
                console.log('Условие выполнено: есть данные о картах и игра поддерживает карты');
                try {
                    let parsedMapsData;
                    
                    // Проверяем, нужно ли парсить JSON
                    if (typeof matchData.maps_data === 'string') {
                        console.log('maps_data - строка, парсим JSON');
                        parsedMapsData = JSON.parse(matchData.maps_data);
                    } else if (typeof matchData.maps_data === 'object' && matchData.maps_data !== null) {
                        console.log('maps_data - уже объект, используем как есть');
                        parsedMapsData = matchData.maps_data;
                    } else {
                        console.log('maps_data имеет неожиданный тип:', typeof matchData.maps_data);
                        parsedMapsData = [];
                    }
                    
                    console.log('Распарсенные данные карт:', parsedMapsData);
                    console.log('Тип распарсенных данных:', typeof parsedMapsData);
                    console.log('Является ли массивом:', Array.isArray(parsedMapsData));
                    
                    if (Array.isArray(parsedMapsData) && parsedMapsData.length > 0) {
                        // Преобразуем данные карт в правильный формат
                        match.maps = parsedMapsData.map((mapData, index) => {
                            console.log(`Обработка карты ${index}:`, mapData);
                            
                            // Безопасное получение названия карты
                            let mapName = 'Неизвестная карта';
                            if (mapData.mapName && typeof mapData.mapName === 'string') {
                                mapName = mapData.mapName;
                            } else if (mapData.map) {
                                if (typeof mapData.map === 'string') {
                                    mapName = mapData.map;
                                } else if (typeof mapData.map === 'object' && mapData.map !== null) {
                                    // Если map - объект, пытаемся извлечь название
                                    if (mapData.map.name) {
                                        mapName = mapData.map.name;
                                    } else if (mapData.map.display_name) {
                                        mapName = mapData.map.display_name;
                                    } else if (mapData.map.mapName) {
                                        mapName = mapData.map.mapName;
                                    }
                                }
                            }
                            
                            return {
                                mapName: mapName,
                                team1Score: mapData.score1 || mapData.team1Score || 0,
                                team2Score: mapData.score2 || mapData.team2Score || 0
                            };
                        });
                        console.log('Преобразованные данные карт:', match.maps);
                    } else {
                        console.log('Данные карт пусты или не являются массивом');
                        match.maps = [];
                    }
                } catch (e) {
                    console.error('Ошибка при разборе данных карт:', e);
                    match.maps = [];
                }
            } else {
                console.log('Условие НЕ выполнено:');
                console.log('- Есть данные о картах:', !!matchData.maps_data);
                console.log('- Игра поддерживает карты:', gameHasMaps(tournament.game));
                match.maps = [];
            }

            console.log('Финальные данные матча для отображения:', match);
            console.log('Количество карт для отображения:', match.maps.length);
            console.log('=== КОНЕЦ ОТЛАДКИ ===');
            
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
            if (!tournament || !tournament.id) {
                alert('Ошибка: данные турнира недоступны');
                return;
            }
            
            const cacheKey = `invitedUsers_${tournament.id}`;
            const cachedInvitedUsers = localStorage.getItem(cacheKey);
            
            if (cachedInvitedUsers) {
                const invitedUsers = JSON.parse(cachedInvitedUsers);
                const updatedInvitedUsers = invitedUsers.filter(id => id !== userId);
                localStorage.setItem(cacheKey, JSON.stringify(updatedInvitedUsers));
                alert(`Кэш приглашения для пользователя #${userId} очищен`);
            }
        } catch (error) {
            console.error('Ошибка при очистке кэша приглашения:', error);
            alert('Ошибка при очистке кэша приглашения');
        }
    };

    // Функция для полной очистки кэша приглашений
    const clearAllInvitationsCache = () => {
        try {
            if (!tournament || !tournament.id) {
                alert('Ошибка: данные турнира недоступны');
                return;
            }
            
            const cacheKey = `invitedUsers_${tournament.id}`;
            localStorage.removeItem(cacheKey);
            alert('Весь кэш приглашений очищен');
        } catch (error) {
            console.error('Ошибка при очистке кэша приглашений:', error);
            alert('Ошибка при очистке кэша приглашений');
        }
    };

    // Удаление участника турнира
    useEffect(() => {
        if (!userIdToRemove) return;
        
        const removeParticipant = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Необходима авторизация для удаления участника');
                return;
            }

            try {
                await api.delete(`/api/tournaments/${id}/participants/${userIdToRemove}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert('Участник успешно удален');
                await fetchTournamentData();
            } catch (error) {
                alert(error.response?.data?.error || 'Ошибка при удалении участника');
            }
        };
        
        if (window.confirm('Вы уверены, что хотите удалить этого участника?')) {
            removeParticipant();
        } else {
            setUserIdToRemove('');
        }
    }, [userIdToRemove, id, fetchTournamentData]);

    // Отслеживаем изменения в mixedTeams
    useEffect(() => {
        console.log('mixedTeams изменился:', mixedTeams);
        // Когда команды созданы, обновляем флаг для скрытия списка
    }, [mixedTeams]);

    if (!tournament) return <p>Загрузка...</p>;

    const canRequestAdmin = user && !isCreator && !adminRequestStatus;
    const canGenerateBracket = user && (isCreator || adminRequestStatus === 'accepted') && matches.length === 0;
    const canEditMatches = user && (isCreator || adminRequestStatus === 'accepted');
    const canEndTournament = user && (isCreator || adminRequestStatus === 'accepted') && tournament.status === 'in_progress';

    // Получение победителей турнира
    const getTournamentWinners = () => {
        console.log('🏆 Начинаем определение победителей турнира');
        console.log('🏆 Статус турнира:', tournament?.status);
        console.log('🏆 Количество матчей:', matches?.length || 0);
        console.log('🏆 Участники турнира:', tournament?.participants?.length || 0);
        
        if (!matches || matches.length === 0) {
            console.log('❌ Нет матчей для определения победителей');
            return [];
        }
        
        // Расширяем условия завершенного турнира
        const tournamentCompleted = (
            tournament.status === 'completed' || 
            tournament.status === 'завершен' || 
            tournament.status === 'finished' ||
            tournament.status === 'Завершен' ||
            tournament.status === 'COMPLETED'
        );
        
        if (!tournamentCompleted) {
            console.log('❌ Турнир не завершен для определения победителей. Статус:', tournament.status);
            return [];
        }
        
        console.log('✅ Турнир завершен, определяем победителей...');
        
        // Находим финальный матч (последний по round)
        const maxRound = Math.max(...matches.map(m => m.round));
        console.log('🏆 Максимальный раунд в турнире:', maxRound);
        
        const finalMatch = matches.find(match => 
            match.round === maxRound && 
            !match.is_third_place_match && 
            match.winner_team_id
        );
        
        if (!finalMatch) {
            console.log('❌ Финальный матч не найден или не завершен');
            return [];
        }
        
        console.log('🏆 Найден финальный матч:', finalMatch);
        
        const result = [];
        
        console.log('🏆 Все матчи турнира:', matches.map(m => ({
            id: m.id,
            round: m.round,
            winner_team_id: m.winner_team_id,
            is_third_place_match: m.is_third_place_match,
            team1_id: m.team1_id,
            team2_id: m.team2_id
        })));
        
        // Функция для получения членов команды
        const getTeamMembers = (teamId) => {
            let teamMembers = [];
            
            // Для микс-турниров ищем в сформированных командах
            if (tournament.format === 'mix' && tournament.teams && Array.isArray(tournament.teams)) {
                const mixTeam = tournament.teams.find(team => team.id === teamId);
                if (mixTeam && mixTeam.members && Array.isArray(mixTeam.members)) {
                    teamMembers = mixTeam.members.map(member => ({
                        id: member.id || member.user_id,
                        name: member.name || member.username,
                        avatar_url: member.avatar_url
                    }));
                }
            }
            // Для обычных командных турниров ищем участников с team_id
            else if (tournament.participant_type === 'team') {
                if (Array.isArray(tournament.participants) && tournament.participants.some(p => p.team_id)) {
                    teamMembers = tournament.participants
                        .filter(p => p.team_id === teamId)
                        .map(m => ({
                            id: m.id,
                            name: m.name || m.username,
                            avatar_url: m.avatar_url
                        }));
                }
            }
            
            return teamMembers.length > 0 ? teamMembers : null;
        };

        // Находим имя победителя (1 место)
        const firstPlaceId = finalMatch.winner_team_id;
        const firstPlaceParticipant = tournament.participants?.find(p => p.id === firstPlaceId);
        console.log('🥇 Победитель (1 место):', firstPlaceParticipant);
        
        if (firstPlaceParticipant) {
            const teamMembers = getTeamMembers(firstPlaceId);

            result.push({
                place: 1,
                name: firstPlaceParticipant.name || firstPlaceParticipant.username,
                id: firstPlaceId,
                avatar_url: firstPlaceParticipant.avatar_url,
                members: teamMembers
            });
        }

        // Находим второе место (проигравший в финале)
        const secondPlaceId = finalMatch.team1_id === firstPlaceId ? finalMatch.team2_id : finalMatch.team1_id;
        const secondPlaceParticipant = tournament.participants?.find(p => p.id === secondPlaceId);
        console.log('🥈 Второе место:', secondPlaceParticipant);
        
        if (secondPlaceParticipant) {
            const teamMembers = getTeamMembers(secondPlaceId);

            result.push({
                place: 2,
                name: secondPlaceParticipant.name || secondPlaceParticipant.username,
                id: secondPlaceId,
                avatar_url: secondPlaceParticipant.avatar_url,
                members: teamMembers
            });
        }

        // Находим матч за третье место, если он есть
        const thirdPlaceMatch = matches.find(m => m.is_third_place_match === true && m.winner_team_id);
        console.log('🥉 Матч за третье место:', thirdPlaceMatch);
        
        if (thirdPlaceMatch && thirdPlaceMatch.winner_team_id) {
            const thirdPlaceId = thirdPlaceMatch.winner_team_id;
            const thirdPlaceParticipant = tournament.participants?.find(p => p.id === thirdPlaceId);
            if (thirdPlaceParticipant) {
                const teamMembers = getTeamMembers(thirdPlaceId);

                result.push({
                    place: 3,
                    name: thirdPlaceParticipant.name || thirdPlaceParticipant.username,
                    id: thirdPlaceId,
                    avatar_url: thirdPlaceParticipant.avatar_url,
                    members: teamMembers
                });
            }
        }

        console.log('🏆 Итоговые победители:', result);
        return result;
    };

    // Компонент для рендеринга призёров турнира
    const renderWinners = () => {
        console.log('🏆 Начинаем отрисовку подиума победителей');
        console.log('🏆 Статус турнира для отрисовки:', tournament?.status);
        
        const tournamentWinners = getTournamentWinners();
        console.log('🏆 Получены победители для отрисовки:', tournamentWinners);
        
        // Расширяем условия завершенного турнира для отображения
        const tournamentCompleted = (
            tournament.status === 'completed' || 
            tournament.status === 'завершен' || 
            tournament.status === 'finished' ||
            tournament.status === 'Завершен' ||
            tournament.status === 'COMPLETED'
        );
        
        if (!tournamentWinners || tournamentWinners.length === 0) {
            console.log('❌ Нет победителей для отрисовки подиума');
            
            // Если турнир завершен, но нет победителей, показываем сообщение
            if (tournamentCompleted) {
                return (
                    <div className="winners-podium-container">
                        <div className="no-winners-message">
                            <h3>Турнир завершен</h3>
                            <p>Победители не определены или данные не загружены.</p>
                            <button 
                                onClick={() => fetchTournamentDataForcefully(true)}
                                className="reload-winners-btn"
                            >
                                Обновить данные
                            </button>
                        </div>
                    </div>
                );
            }
            return null;
        }

        console.log('✅ Отрисовываем подиум с', tournamentWinners.length, 'победителями');

        return (
            <div className="winners-section">
                <h3>Призёры турнира</h3>
                <div className="winners-podium">
                    {tournamentWinners.map(winner => {
                        console.log('🏆 Отрисовываем победителя:', winner);
                        
                        return (
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
                                {/* Показываем состав команды для всех типов турниров */}
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
                                {/* Если участников нет в команде, но это одиночный турнир, показываем заглушку */}
                                {(!winner.members || winner.members.length === 0) && tournament.participant_type === 'solo' && (
                                    <div className="solo-participant">
                                        <p>Одиночный участник</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
            <div className="participants-list-tournamentdetails">
                <h4>Участники ({tournament.participants.length})</h4>
                <ul>
                    {tournament.participants.map((participant) => (
                        <li key={participant?.id || `participant-${Math.random()}`} className="participant-item-tournamentdetails">
                            {/* Проверяем, является ли участник текущим авторизованным пользователем */}
                            <Link 
                                to={user && participant.user_id === user.id ? '/profile' : `/user/${participant.user_id}`} 
                                className="participant-link-tournamentdetails"
                            >
                                <div className="participant-avatar-tournamentdetails">
                                    <img 
                                        src={ensureHttps(participant.avatar_url) || '/default-avatar.png'} 
                                        alt={`${participant.name || participant.username || 'Участник'} аватар`} 
                                        className="participant-avatar-img-tournamentdetails"
                                        onError={(e) => {e.target.src = '/default-avatar.png'}}
                                    />
                                </div>
                                <div className="participant-info-tournamentdetails">
                                    <span className="participant-name-tournamentdetails">{participant.name || participant.username}</span>
                                    {participant.is_admin && <span className="admin-badge-tournamentdetails">Админ</span>}
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
        const token = localStorage.getItem('token');
        if (!token) return;

        if (!editedDescription.trim()) {
            alert('Описание не может быть пустым');
            return;
        }

        try {
            const response = await api.put(
                `/api/tournaments/${id}`,
                { description: editedDescription },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data) {
                setTournament(prev => ({
                    ...prev,
                    description: editedDescription
                }));
                setIsEditingDescription(false);
                alert('Описание успешно обновлено');
            }
        } catch (error) {
            console.error('Ошибка при обновлении описания:', error);
            alert(error.message || 'Не удалось обновить описание');
        }
    };

    const handleSavePrizePool = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        if (!editedPrizePool.trim()) {
            alert('Информация о призовом фонде не может быть пустой');
            return;
        }

        try {
            const response = await api.put(
                `/api/tournaments/${id}`,
                { prize_pool: editedPrizePool },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data) {
                setTournament(prev => ({
                    ...prev,
                    prize_pool: editedPrizePool
                }));
                setIsEditingPrizePool(false);
                alert('Призовой фонд успешно обновлен');
            }
        } catch (error) {
            console.error('Ошибка при обновлении призового фонда:', error);
            alert(error.message || 'Не удалось обновить призовой фонд');
        }
    };

    const handleSaveFullDescription = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        if (!editedFullDescription.trim()) {
            alert('Полное описание не может быть пустым');
            return;
        }

        try {
            const response = await api.put(
                `/api/tournaments/${id}`,
                { full_description: editedFullDescription },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data) {
                setTournament(prev => ({
                    ...prev,
                    full_description: editedFullDescription
                }));
                setIsEditingFullDescription(false);
                alert('Полное описание успешно обновлено');
            }
        } catch (error) {
            console.error('Ошибка при обновлении полного описания:', error);
            alert(error.message || 'Не удалось обновить полное описание');
        }
    };

    const handleSaveRules = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        if (!editedRules.trim()) {
            alert('Правила не могут быть пустыми');
            return;
        }

        try {
            const response = await api.put(
                `/api/tournaments/${id}`,
                { rules: editedRules },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data) {
                setTournament(prev => ({
                    ...prev,
                    rules: editedRules
                }));
                setIsEditingRules(false);
                alert('Правила успешно обновлены');
            }
        } catch (error) {
            console.error('Ошибка при обновлении правил:', error);
            alert(error.message || 'Не удалось обновить правила');
        }
    };
    
    // Обработчик приглашения конкретного пользователя
    const handleInviteUser = async (userId, username) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            await api.post(
                `/api/tournaments/${id}/invite`,
                { username: username },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Добавляем пользователя в кэш приглашенных
            const cacheKey = `invitedUsers_${tournament.id}`;
            const cachedInvitedUsers = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            if (!cachedInvitedUsers.includes(userId)) {
                cachedInvitedUsers.push(userId);
                localStorage.setItem(cacheKey, JSON.stringify(cachedInvitedUsers));
            }

            alert('Приглашение успешно отправлено');
        } catch (error) {
            console.error('Ошибка при отправке приглашения:', error);
            alert(error.response?.data?.error || 'Не удалось отправить приглашение');
        }
    };
    
    // Обработчик запуска турнира с оптимистичным обновлением
    const handleStartTournament = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Необходима авторизация для запуска турнира');
            return;
        }

        // Проверяем текущий статус
        if (tournament.status !== 'active' && tournament.status !== 'pending') {
            setMessage('Турнир уже запущен или завершен');
            return;
        }

        // Сохраняем оригинальные данные для возможного отката
        const originalTournament = { ...tournament };
        
        try {
            // Оптимистично обновляем UI - сразу меняем статус
            setTournament(prev => ({ 
                ...prev, 
                status: 'in_progress'
            }));
            setMessage('Запуск турнира...');
            
            // Отправляем запрос на сервер
            const response = await api.post(
                `/api/tournaments/${id}/start`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('Турнир успешно запущен, ответ сервера:', response.data);
            
            // Если сервер вернул обновленные данные турнира, используем их
            if (response.data && response.data.tournament) {
                setTournament(response.data.tournament);
                setMatches(response.data.tournament.matches || []);
            }
            
            setMessage('Турнир успешно запущен');
            
            // Принудительно обновляем данные с сервера через небольшую задержку
            setTimeout(async () => {
                try {
                    await fetchTournamentDataForcefully(true); // Очищаем кеш
                    console.log('Данные турнира синхронизированы после запуска');
                } catch (syncError) {
                    console.error('Ошибка синхронизации после запуска:', syncError);
                }
            }, 1000);
            
        } catch (error) {
            console.error('Ошибка при запуске турнира:', error);
            
            // Откатываем оптимистичные изменения
            setTournament(originalTournament);
            
            // Показываем детальную ошибку
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Не удалось запустить турнир';
            setMessage(`Ошибка запуска турнира: ${errorMessage}`);
            
            // Принудительно обновляем данные на случай, если состояние рассинхронизировалось
            setTimeout(async () => {
                try {
                    await fetchTournamentDataForcefully(true);
                    console.log('Данные турнира синхронизированы после ошибки');
                } catch (syncError) {
                    console.error('Ошибка синхронизации после ошибки:', syncError);
                }
            }, 2000);
        }
        
        // Очищаем сообщение через 5 секунд
        setTimeout(() => {
            setMessage('');
        }, 5000);
    };

    // Функция для пересоздания сетки турнира
    const handleRegenerateBracket = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        if (!canGenerateBracket) {
            alert('У вас нет прав для пересоздания сетки');
            return;
        }

        try {
            setMessage('Пересоздание сетки...');
            alert('Начинаем пересоздание сетки...');
            
            // Проверка количества участников
            if (!tournament.participants || tournament.participants.length < 2) {
                setMessage('Недостаточно участников для пересоздания сетки. Минимум 2 участника.');
                alert('Недостаточно участников для пересоздания сетки. Минимум 2 участника.');
                return;
            }
            
            const regenerateBracketResponse = await api.post(
                `/api/tournaments/${id}/generate-bracket`,
                { 
                    thirdPlaceMatch: tournament.format === 'double_elimination' ? true : thirdPlaceMatch,
                    regenerate: true // Указываем, что нужно пересоздать сетку
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('Ответ от сервера:', regenerateBracketResponse.data);
            
            // Обновления турнира должны прийти через WebSocket,
            // но дополнительно обновляем данные из ответа
            if (regenerateBracketResponse.data.tournament) {
                const tournamentData = regenerateBracketResponse.data.tournament;
                
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
            
            setMessage('Сетка успешно пересоздана');
            alert('Сетка успешно пересоздана!');
        } catch (error) {
            console.error('Ошибка при пересоздании сетки:', error);
            
            // Проверяем тип ошибки для информативного сообщения
            let errorMessage = 'Ошибка при пересоздании сетки';
            
            if (error.response) {
                // Структурированное сообщение об ошибке от сервера
                if (error.response.status === 400) {
                    errorMessage = error.response.data.error || 'Неверные параметры для пересоздания сетки';
                } else if (error.response.status === 401) {
                    errorMessage = 'Необходима авторизация';
                } else if (error.response.status === 403) {
                    errorMessage = 'У вас нет прав на выполнение этого действия';
                } else if (error.response.status === 404) {
                    errorMessage = 'API маршрут не найден. Возможно, требуется обновление сервера.';
                } else if (error.response.status === 500) {
                    errorMessage = 'Ошибка сервера при пересоздании сетки. Попробуйте позже.';
                } else {
                    errorMessage = error.response.data.error || 'Ошибка при пересоздании сетки';
                }
            }
            
            setMessage(errorMessage);
            alert(errorMessage);
            
            // Пытаемся синхронизировать данные с сервера
            try {
                await fetchTournamentData();
            } catch (fetchError) {
                console.error('Ошибка при синхронизации данных:', fetchError);
            }
        }
    };
    
    // Функция для завершения турнира с оптимистичным обновлением
    const handleEndTournament = () => {
        setShowEndTournamentModal(true);
    };

    // Функция для фактического завершения турнира после подтверждения
    const confirmEndTournament = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Необходима авторизация для завершения турнира');
            setShowEndTournamentModal(false);
            return;
        }

        // Сохраняем оригинальные данные для возможного отката
        const originalTournament = { ...tournament };
        
        try {
            // Оптимистично обновляем UI
            setTournament(prev => ({ 
                ...prev, 
                status: 'completed'
            }));
            setMessage('Завершение турнира...');
            setShowEndTournamentModal(false);
            
            // Отправляем запрос на сервер
            const response = await api.post(
                `/api/tournaments/${id}/end`, 
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('Турнир успешно завершен, ответ сервера:', response.data);
            
            // Если сервер вернул обновленные данные турнира, используем их
            if (response.data && response.data.tournament) {
                setTournament(response.data.tournament);
                setMatches(response.data.tournament.matches || []);
            }
            
            setMessage('Турнир успешно завершен!');
            
            // Принудительно обновляем данные с сервера через небольшую задержку
            setTimeout(async () => {
                try {
                    await fetchTournamentDataForcefully(true); // Очищаем кеш
                    console.log('Данные турнира синхронизированы после завершения');
                } catch (syncError) {
                    console.error('Ошибка синхронизации после завершения:', syncError);
                }
            }, 1000);
            
        } catch (error) {
            console.error('Ошибка при завершении турнира:', error);
            
            // Откатываем оптимистичные изменения
            setTournament(originalTournament);
            setShowEndTournamentModal(false);
            
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Не удалось завершить турнир';
            setMessage(`Ошибка завершения турнира: ${errorMessage}`);
            
            // Принудительно обновляем данные на случай рассинхронизации
            setTimeout(async () => {
                try {
                    await fetchTournamentDataForcefully(true);
                    console.log('Данные турнира синхронизированы после ошибки завершения');
                } catch (syncError) {
                    console.error('Ошибка синхронизации после ошибки завершения:', syncError);
                }
            }, 2000);
        }
        
        // Очищаем сообщение через 5 секунд
        setTimeout(() => {
            setMessage('');
        }, 5000);
    };
    
    // Функция для сброса результатов матчей
    const handleClearMatchResults = () => {
        setShowClearResultsModal(true);
    };

    // Функция для подтверждения сброса результатов матчей
    const confirmClearMatchResults = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Необходима авторизация для очистки результатов');
            setShowClearResultsModal(false);
            return;
        }

        // Сохраняем оригинальные данные для возможного отката
        const originalTournament = { ...tournament };
        const originalMatches = [...matches];
        
        try {
            setMessage('Очистка результатов матчей...');
            setShowClearResultsModal(false);
            
            // Оптимистично обновляем UI - очищаем результаты матчей
            const clearedMatches = matches.map(match => ({
                ...match,
                winner_team_id: null,
                score1: 0,
                score2: 0
            }));
            setMatches(clearedMatches);
            
            // Отправляем запрос на сервер
            const response = await api.post(
                `/api/tournaments/${id}/clear-match-results`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('Результаты матчей успешно очищены, ответ сервера:', response.data);
            
            // Если сервер вернул обновленные данные турнира, используем их
            if (response.data && response.data.tournament) {
                setTournament(response.data.tournament);
                setMatches(response.data.tournament.matches || []);
            }
            
            setMessage('Результаты матчей успешно очищены!');
            
            // Принудительно обновляем данные с сервера через небольшую задержку
            setTimeout(async () => {
                try {
                    await fetchTournamentDataForcefully(true); // Очищаем кеш
                    console.log('Данные турнира синхронизированы после очистки результатов');
                } catch (syncError) {
                    console.error('Ошибка синхронизации после очистки результатов:', syncError);
                }
            }, 1000);
            
        } catch (error) {
            console.error('Ошибка при сбросе результатов матчей:', error);
            
            // Откатываем оптимистичные изменения
            setTournament(originalTournament);
            setMatches(originalMatches);
            setShowClearResultsModal(false);
            
            // Показываем детальную ошибку
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Не удалось очистить результаты матчей';
            setMessage(`Ошибка очистки результатов: ${errorMessage}`);
            
            // Принудительно обновляем данные на случай рассинхронизации
            setTimeout(async () => {
                try {
                    await fetchTournamentDataForcefully(true);
                    console.log('Данные турнира синхронизированы после ошибки очистки результатов');
                } catch (syncError) {
                    console.error('Ошибка синхронизации после ошибки очистки результатов:', syncError);
                }
            }, 2000);
        }
        
        // Очищаем сообщение через 5 секунд
        setTimeout(() => {
            setMessage('');
        }, 5000);
    };

    // Функция для возможности редактирования матча
    const canEditMatchResult = (matchId) => {
        if (!isAdminOrCreator || tournament.status === 'completed') {
            return false;
        }

        const matchData = matches.find(m => m.id === parseInt(matchId));
        if (!matchData || !matchData.winner_team_id) {
            return false; // Матч не завершен
        }

        // Проверяем, что ни один из участников этого матча не сыграл следующий матч
        const winnerId = matchData.winner_team_id;
        const loserId = matchData.team1_id === winnerId ? matchData.team2_id : matchData.team1_id;

        // Находим следующие матчи, где участвуют победитель или проигравший
        const nextMatches = matches.filter(m => 
            (m.team1_id === winnerId || m.team2_id === winnerId || 
             m.team1_id === loserId || m.team2_id === loserId) && 
            m.id !== matchData.id
        );

        // Если есть следующие матчи с результатами, редактирование запрещено
        const hasPlayedNextMatches = nextMatches.some(m => m.winner_team_id);
        
        return !hasPlayedNextMatches;
    };

    // Функция для начала редактирования матча
    const startEditingMatch = (matchId) => {
        if (!canEditMatchResult(matchId)) {
            alert('Редактирование этого матча недоступно');
            return;
        }

        const match = matches.find(m => m.id === matchId);
        if (!match) return;

        setIsEditingMatch(true);
        setEditingMatchData(match);
        setEditingWinner(match.winner_team_id);
        setEditingScores({
            team1: match.score1 || 0,
            team2: match.score2 || 0
        });

        // Загружаем карты, если они есть
        if (match.maps_data && gameHasMaps(tournament.game)) {
            try {
                const parsedMaps = JSON.parse(match.maps_data);
                setEditingMaps(Array.isArray(parsedMaps) ? parsedMaps : []);
            } catch (e) {
                console.error('Ошибка при разборе данных карт:', e);
                setEditingMaps([]);
            }
        } else {
            setEditingMaps([]);
        }
    };

    // Функция для отмены редактирования
    const cancelEditingMatch = () => {
        setIsEditingMatch(false);
        setEditingMatchData(null);
        setEditingMaps([]);
        setEditingWinner(null);
        setEditingScores({ team1: 0, team2: 0 });
    };

    // Функции для работы с картами в режиме редактирования
    const addEditingMap = () => {
        const defaultMap = getDefaultMap(tournament?.game);
        setEditingMaps([...editingMaps, { map: defaultMap, score1: 0, score2: 0 }]);
    };

    const removeEditingMap = (index) => {
        const newMaps = [...editingMaps];
        newMaps.splice(index, 1);
        setEditingMaps(newMaps);
    };

    const updateEditingMapScore = (index, team, score) => {
        const newMaps = [...editingMaps];
        newMaps[index][`score${team}`] = score;
        setEditingMaps(newMaps);
    };

    const updateEditingMapSelection = (index, mapName) => {
        const newMaps = [...editingMaps];
        newMaps[index].map = mapName;
        setEditingMaps(newMaps);
    };

    // Функция для сохранения изменений результата матча
    const saveMatchEdit = async () => {
        if (!editingWinner) {
            alert('Не выбран победитель матча');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            alert('Необходима авторизация');
            return;
        }

        try {
            const requestData = {
                matchId: editingMatchData.id,
                winner_team_id: editingWinner,
                score1: editingScores.team1,
                score2: editingScores.team2
            };

            if (gameHasMaps(tournament.game) && editingMaps.length > 0) {
                requestData.maps = editingMaps;
            }

            const response = await api.post(
                `/api/tournaments/${id}/update-match`,
                requestData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.tournament) {
                setTournament(response.data.tournament);
                setMatches(response.data.tournament.matches || []);
            }

            alert('Результаты матча успешно обновлены');
            cancelEditingMatch();
            await fetchTournamentData();
        } catch (error) {
            console.error('Ошибка при сохранении изменений:', error);
            alert(error.response?.data?.error || 'Ошибка при сохранении изменений');
        }
    };

    // Функция для отображения состава команды
    const showTeamComposition = (teamId, teamName) => {
        if (!teamId || !tournament) return;

        let teamMembers = [];
        
        // Для микс-турниров ищем в сформированных командах
        if (tournament.format === 'mix' && tournament.teams && Array.isArray(tournament.teams)) {
            const mixTeam = tournament.teams.find(team => team.id === teamId);
            if (mixTeam && mixTeam.members && Array.isArray(mixTeam.members)) {
                teamMembers = mixTeam.members.map(member => ({
                    id: member.id || member.user_id,
                    name: member.name || member.username,
                    avatar_url: member.avatar_url,
                    faceit_elo: member.faceit_elo
                }));
            }
        }
        // Для обычных командных турниров ищем участников с team_id
        else if (tournament.participant_type === 'team') {
            if (Array.isArray(tournament.participants) && tournament.participants.some(p => p.team_id)) {
                teamMembers = tournament.participants
                    .filter(p => p.team_id === teamId)
                    .map(m => ({
                        id: m.id,
                        name: m.name || m.username,
                        avatar_url: m.avatar_url,
                        faceit_elo: m.faceit_elo
                    }));
            }
        }
        // Для одиночных турниров находим одного участника
        else if (tournament.participant_type === 'solo') {
            const soloParticipant = tournament.participants.find(p => p.id === teamId);
            if (soloParticipant) {
                teamMembers = [{
                    id: soloParticipant.id,
                    name: soloParticipant.name || soloParticipant.username,
                    avatar_url: soloParticipant.avatar_url,
                    faceit_elo: soloParticipant.faceit_elo
                }];
            }
        }

        setSelectedTeamData({
            id: teamId,
            name: teamName || 'Команда',
            members: teamMembers,
            type: tournament.participant_type,
            format: tournament.format
        });
        setShowTeamModal(true);
    };

    // Функция для закрытия модального окна состава команды
    const closeTeamModal = () => {
        setShowTeamModal(false);
        setSelectedTeamData(null);
    };

    return (
        <section className="tournament-details-tournamentdetails">
            <div className="tournament-header-tournamentdetails">
                <h2>
                    {tournament.name} ({
                        tournament.status === 'active' || tournament.status === 'pending' ? 'Активен' : 
                        tournament.status === 'in_progress' ? 'Идет' : 
                        tournament.status === 'completed' || tournament.status === 'завершен' ? 'Завершен' : 
                        'Неизвестный статус'
                    })
                </h2>
                
                {/* Навигация по вкладкам */}
                <div className="tabs-navigation-tournamentdetails">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-button-tournamentdetails ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="tab-label-tournamentdetails">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="tournament-content-tournamentdetails">
                {/* Вкладка: Информация */}
                {activeTab === 'info' && (
                    <div className="tab-content-tournamentdetails tab-info-tournamentdetails">
                        <div className="tournament-info-grid-tournamentdetails">
                            <div className="info-main-tournamentdetails">
                                <div className="tournament-info-section">
                                    <div className="info-block-tournamentdetails">
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

                                    <div className="info-block-tournamentdetails">
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
                                        <div className="info-block-tournamentdetails">
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
                                
                                <div className="tournament-meta-info-tournamentdetails">
                                    <div className="meta-item-tournamentdetails">
                                        <strong>Формат:</strong> {tournament.format}
                                    </div>
                                    <div className="meta-item-tournamentdetails">
                                        <strong>Дисциплина:</strong> {tournament.game || 'Не указана'}
                                    </div>
                                    <div className="meta-item-tournamentdetails">
                                        <strong>Дата старта:</strong> {new Date(tournament.start_date).toLocaleDateString('ru-RU')}
                                    </div>
                                    {tournament.end_date && (
                                        <div className="meta-item-tournamentdetails">
                                            <strong>Дата окончания:</strong> {new Date(tournament.end_date).toLocaleDateString('ru-RU')}
                                        </div>
                                    )}
                                    <div className="meta-item-tournamentdetails creator-info-tournamentdetails">
                                        <strong>Создатель:</strong>{' '}
                                        {creator ? (
                                            <span className="creator-display">
                                                <span className="creator-avatar">
                                                    {creator.avatar_url ? (
                                                        <img 
                                                            src={ensureHttps(creator.avatar_url)} 
                                                            alt={creator.username.charAt(0)} 
                                                            onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                        />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {creator.username.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </span>
                                                {creator.isError ? (
                                                    <span className="creator-name">{creator.username}</span>
                                                ) : (
                                                    <Link to={`/user/${creator.id}`} className="creator-link">
                                                        {creator.username}
                                                    </Link>
                                                )}
                                            </span>
                                        ) : (
                                            'Загрузка...'
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="info-bracket">
                                <h3>Турнирная сетка</h3>
                                {Array.isArray(matches) && matches.length > 0 ? (
                                    <>
                                        {Array.isArray(games) && games.length > 0 ? (
                                            <div className="custom-tournament-bracket">
                                                <div className="tournament-bracket">
                                                    <ErrorBoundary>
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
                                                {isAdminOrCreator && tournament?.status === 'pending' && (
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
                                
                                {(tournament.status === 'completed' || tournament.status === 'завершен' || tournament.status === 'finished' || tournament.status === 'Завершен' || tournament.status === 'COMPLETED') && renderWinners()}
                            </div>
                        </div>
                    </div>
                )}
                
                
                {/* Вкладка: Участники */}
                {activeTab === 'participants' && (
                    <div className="tab-content tab-participants">
                        {tournament.format === 'mix' ? (
                            <TeamGenerator
                                tournament={tournament}
                                participants={tournament.participants || []}
                                onTeamsGenerated={handleTeamsGenerated}
                                onTeamsUpdated={fetchTournamentData}
                                onRemoveParticipant={setUserIdToRemove}
                                isAdminOrCreator={isAdminOrCreator}
                            />
                        ) : (
                            <>
                                <OriginalParticipantsList 
                                    participants={originalParticipants.length > 0 ? originalParticipants : tournament.participants} 
                                    tournament={tournament}
                                />
                                {renderParticipants()}
                            </>
                        )}
                        
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
                    </div>
                )}
                
                {/* Вкладка: Сетка */}
                {activeTab === 'bracket' && (
                    <div className="tab-content tab-bracket">
                        {Array.isArray(matches) && matches.length > 0 ? (
                            <>
                                {Array.isArray(games) && games.length > 0 ? (
                                    <div className="bracket-fullscreen">
                                        <ErrorBoundary>
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
                                        </ErrorBoundary>
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
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="bracket-empty">
                                <p>Сетка ещё не сгенерирована</p>
                                <p>Перейдите во вкладку "Управление" для генерации сетки</p>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Вкладка: Результаты */}
                {activeTab === 'results' && (
                    <div className="tab-content tab-results">
                        <h3>Результаты матчей</h3>
                        
                        {/* Показываем подиум победителей, если турнир завершен */}
                        {(tournament.status === 'completed' || tournament.status === 'завершен' || tournament.status === 'finished') && renderWinners()}
                        
                        {matches && matches.length > 0 ? (
                            <div className="results-compact-list">
                                {matches
                                    .filter(match => match.winner_team_id) // Показываем только завершенные матчи
                                    .sort((a, b) => b.id - a.id) // Сортируем по ID в обратном порядке
                                    .map(match => {
                                        const team1 = tournament.participants.find(p => p.id === match.team1_id);
                                        const team2 = tournament.participants.find(p => p.id === match.team2_id);
                                        const isTeam1Winner = match.winner_team_id === match.team1_id;
                                        const isTeam2Winner = match.winner_team_id === match.team2_id;
                                        
                                        return (
                                            <div key={match.id} className="result-compact-item">
                                                <div className="result-compact-content">
                                                    <span className="result-compact-round">
                                                        {getRoundName(match.round, Math.max(...matches.map(m => m.round)))}
                                                        {match.is_third_place_match && <span className="third-place-indicator">3-е место</span>}
                                                    </span>
                                                    
                                                    <div className="result-compact-match">
                                                        <button 
                                                            className={`team-name-btn ${isTeam1Winner ? 'winner' : ''}`}
                                                            onClick={() => showTeamComposition(match.team1_id, team1?.name)}
                                                            title="Показать состав команды"
                                                        >
                                                            {team1?.name || 'TBD'}
                                                        </button>
                                                        
                                                        <span className="match-score">
                                                            {match.score1 || 0}:{match.score2 || 0}
                                                        </span>
                                                        
                                                        <button 
                                                            className={`team-name-btn ${isTeam2Winner ? 'winner' : ''}`}
                                                            onClick={() => showTeamComposition(match.team2_id, team2?.name)}
                                                            title="Показать состав команды"
                                                        >
                                                            {team2?.name || 'TBD'}
                                                        </button>
                                                    </div>
                                                    
                                                    <button 
                                                        className="details-btn"
                                                        onClick={() => viewMatchDetails(match.id)}
                                                        title="Подробная информация о матче"
                                                    >
                                                        подробнее
                                                    </button>
                                                    
                                                    {canEditMatchResult(match.id) && (
                                                        <button 
                                                            className="edit-compact-btn"
                                                            onClick={() => startEditingMatch(match.id)}
                                                            title="Редактировать результат"
                                                        >
                                                            ✏️
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                {matches.filter(match => match.winner_team_id).length === 0 && (
                                    <p className="no-results">Пока нет завершенных матчей</p>
                                )}
                            </div>
                        ) : (
                            <p className="no-results">Матчи еще не сгенерированы</p>
                        )}
                    </div>
                )}
                
                
                {/* Вкладка: Журнал */}
                {activeTab === 'logs' && (
                    <div className="tab-content tab-logs">
                        <h3>Журнал событий турнира</h3>
                        {logsLoading ? (
                            <div className="logs-loading">Загрузка журнала событий...</div>
                        ) : tournamentLogs.length > 0 ? (
                            <div className="logs-list">
                                {tournamentLogs.map((log) => {
                                    const eventDate = new Date(log.created_at);
                                    const eventData = log.event_data || {};
                                    
                                    // Функция для получения текста события
                                    const getEventText = () => {
                                        switch (log.event_type) {
                                            case 'tournament_created':
                                                return `Турнир "${eventData.name}" создан`;
                                            case 'participant_joined':
                                                return `${log.username || 'Участник'} зарегистрировался в турнире`;
                                            case 'participant_left':
                                                return `${log.username || 'Участник'} покинул турнир`;
                                            case 'tournament_started':
                                                return `Турнир начался (${eventData.participantCount || 0} участников)`;
                                            case 'tournament_completed':
                                                return 'Турнир завершен';
                                            case 'bracket_generated':
                                                return 'Сетка турнира сгенерирована';
                                            case 'bracket_regenerated':
                                                return 'Сетка турнира пересоздана';
                                            case 'match_completed':
                                                return `Матч завершен: ${eventData.winner || 'Неизвестный победитель'}`;
                                            case 'round_completed':
                                                return `${eventData.roundName || 'Раунд'} завершен`;
                                            case 'admin_assigned':
                                                return `${eventData.adminName || 'Пользователь'} назначен администратором`;
                                            case 'admin_removed':
                                                return `${eventData.adminName || 'Пользователь'} снят с должности администратора`;
                                            case 'settings_changed':
                                                return 'Настройки турнира изменены';
                                            default:
                                                return log.event_type;
                                        }
                                    };
                                    
                                    // Функция для получения иконки события
                                    const getEventIcon = () => {
                                        switch (log.event_type) {
                                            case 'tournament_created': return '🏆';
                                            case 'participant_joined': return '➕';
                                            case 'participant_left': return '➖';
                                            case 'tournament_started': return '▶️';
                                            case 'tournament_completed': return '🏁';
                                            case 'bracket_generated': return '🔀';
                                            case 'bracket_regenerated': return '🔄';
                                            case 'match_completed': return '⚔️';
                                            case 'round_completed': return '✅';
                                            case 'admin_assigned': return '👑';
                                            case 'admin_removed': return '❌';
                                            case 'settings_changed': return '⚙️';
                                            default: return '📌';
                                        }
                                    };
                                    
                                    return (
                                        <div key={log.id} className="log-item">
                                            <div className="log-icon">{getEventIcon()}</div>
                                            <div className="log-content">
                                                <div className="log-text">{getEventText()}</div>
                                                <div className="log-meta">
                                                    {log.username && (
                                                        <span className="log-user">
                                                            <Link to={`/user/${log.user_id}`}>
                                                                {log.username}
                                                            </Link>
                                                        </span>
                                                    )}
                                                    <span className="log-time">
                                                        {eventDate.toLocaleDateString('ru-RU', {
                                                            day: 'numeric',
                                                            month: 'long',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="logs-empty">
                                <p>Журнал событий пуст</p>
                                <p className="logs-hint">Здесь будет отображаться история всех действий в турнире</p>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Вкладка: Стримы */}
                {activeTab === 'streams' && (
                    <div className="tab-content tab-streams">
                        <h3>Стримы турнира</h3>
                        <div className="streams-placeholder">
                            <p>Функция стримов находится в разработке</p>
                            <button className="want-stream-btn">
                                <span className="btn-icon">📹</span>
                                Хочу стримить
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Вкладка: Управление */}
                {activeTab === 'admin' && isAdminOrCreator && (
                    <div className="tab-content tab-admin">
                        <h3>Управление турниром</h3>
                        
                        {/* Генерация и пересоздание сетки */}
                        {matches.length === 0 && canGenerateBracket && (
                            <div className="admin-section">
                                <h4>Генерация сетки</h4>
                                <div className="admin-controls">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={thirdPlaceMatch}
                                            onChange={(e) => setThirdPlaceMatch(e.target.checked)}
                                        />
                                        Нужен матч за третье место?
                                    </label>
                                    <button 
                                        className="admin-button primary"
                                        onClick={handleGenerateBracket}
                                    >
                                        <span className="btn-icon">🏗️</span>
                                        Сгенерировать сетку
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {matches.length > 0 && (tournament?.status === 'pending' || tournament?.status === 'active') && (
                            <div className="admin-section">
                                <h4>Управление сеткой</h4>
                                <div className="admin-controls">
                                    <button 
                                        className="admin-button primary"
                                        onClick={handleStartTournament}
                                    >
                                        <span className="btn-icon">▶️</span>
                                        Начать турнир
                                    </button>
                                    <button 
                                        className="admin-button secondary"
                                        onClick={handleRegenerateBracket}
                                    >
                                        <span className="btn-icon">🔄</span>
                                        Пересоздать сетку
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {tournament?.status === 'in_progress' && (
                            <div className="admin-section">
                                <h4>Управление турниром</h4>
                                <div className="admin-controls">
                                    <button 
                                        className="admin-button"
                                        onClick={handleClearMatchResults}
                                    >
                                        <span className="btn-icon">🗑️</span>
                                        Очистить результаты
                                    </button>
                                    <button 
                                        className="admin-button danger"
                                        onClick={handleEndTournament}
                                    >
                                        <span className="btn-icon">🏁</span>
                                        Завершить турнир
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {tournament?.status === 'completed' && (
                            <div className="admin-section">
                                <div className="tournament-completed-info">
                                    <div className="completed-status">
                                        <span className="btn-icon">✅</span>
                                        <div className="status-text">
                                            <p><strong>Турнир успешно завершен</strong></p>
                                            <p>Все результаты зафиксированы и изменение данных турнира больше невозможно.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {message && (
                    <p className={`message ${message.includes('успешно') ? 'success' : 'error'}`}>{message}</p>
                )}
            </div>
            
            {/* Модальные окна остаются без изменений */}
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
                <div className="modal match-details-modal" onClick={closeMatchDetails}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <span className="close" onClick={closeMatchDetails}>&times;</span>
                        <h4>Результаты матча</h4>
                        
                        <div className="match-teams">
                            <div className={`team-info ${matchDetails.team1.winner ? 'winner' : ''}`}>
                                <h5>{matchDetails.team1.name}</h5>
                                <div className="team-score">{matchDetails.team1.score}</div>
                                {matchDetails.team1.winner && <div className="winner-badge">🏆 Победитель</div>}
                            </div>
                            
                            <div className="match-score">vs</div>
                            
                            <div className={`team-info ${matchDetails.team2.winner ? 'winner' : ''}`}>
                                <h5>{matchDetails.team2.name}</h5>
                                <div className="team-score">{matchDetails.team2.score}</div>
                                {matchDetails.team2.winner && <div className="winner-badge">🏆 Победитель</div>}
                            </div>
                        </div>
                        
                        {/* Общий счет матча */}
                        <div className="match-summary">
                            <h4>Общий счет</h4>
                            <div className="final-score">
                                <span className={`score-item ${matchDetails.team1.winner ? 'winner-score' : ''}`}>
                                    {matchDetails.team1.name}: {matchDetails.team1.score || 0}
                                </span>
                                <span className="score-separator"> - </span>
                                <span className={`score-item ${matchDetails.team2.winner ? 'winner-score' : ''}`}>
                                    {matchDetails.team2.name}: {matchDetails.team2.score || 0}
                                </span>
                            </div>
                        </div>
                        
                        {/* Улучшенное отображение результатов карт */}
                        {matchDetails.maps && matchDetails.maps.length > 0 ? (
                            <div className="maps-results">
                                <h4>Результаты по картам ({matchDetails.maps.length} карт)</h4>
                                
                                <table className="maps-table">
                                    <thead>
                                        <tr>
                                            <th>Карта</th>
                                            <th>{matchDetails.team1.name}</th>
                                            <th>{matchDetails.team2.name}</th>
                                            <th>Результат</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matchDetails.maps.map((map, index) => {
                                            const team1Winner = parseInt(map.team1Score) > parseInt(map.team2Score);
                                            const team2Winner = parseInt(map.team2Score) > parseInt(map.team1Score);
                                            const isDraw = parseInt(map.team1Score) === parseInt(map.team2Score);
                                            
                                            return (
                                                <tr key={index}>
                                                    <td>
                                                        <span>{(() => {
                                                            if (map.mapName && typeof map.mapName === 'string') return map.mapName;
                                                            if (map.map) {
                                                                if (typeof map.map === 'string') return map.map;
                                                                if (typeof map.map === 'object' && map.map.name) return map.map.name;
                                                                if (typeof map.map === 'object' && map.map.mapName) return map.map.mapName;
                                                            }
                                                            return 'Неизвестная карта';
                                                        })()}</span>
                                                    </td>
                                                    <td className={team1Winner ? 'map-winner' : ''}>{map.team1Score}</td>
                                                    <td className={team2Winner ? 'map-winner' : ''}>{map.team2Score}</td>
                                                    <td>
                                                        {team1Winner && (
                                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                <span style={{ marginRight: '5px' }}>{matchDetails.team1.name}</span>
                                                                <i className="fas fa-trophy" style={{ color: '#FFD700' }}></i>
                                                            </div>
                                                        )}
                                                        {team2Winner && (
                                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                <span style={{ marginRight: '5px' }}>{matchDetails.team2.name}</span>
                                                                <i className="fas fa-trophy" style={{ color: '#FFD700' }}></i>
                                                            </div>
                                                        )}
                                                        {isDraw && <span>Ничья</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                
                                {/* Статистика по картам */}
                                <div className="maps-statistics">
                                    <h5>Статистика по картам:</h5>
                                    <div className="maps-stats">
                                        <div className="stat-item">
                                            <span className="stat-label">{matchDetails.team1.name} побед:</span>
                                            <span className="stat-value">
                                                {matchDetails.maps.filter(m => parseInt(m.team1Score) > parseInt(m.team2Score)).length}
                                            </span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">{matchDetails.team2.name} побед:</span>
                                            <span className="stat-value">
                                                {matchDetails.maps.filter(m => parseInt(m.team2Score) > parseInt(m.team1Score)).length}
                                            </span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Ничьих:</span>
                                            <span className="stat-value">
                                                {matchDetails.maps.filter(m => parseInt(m.team1Score) === parseInt(m.team2Score)).length}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="no-maps-info">
                                <p>Детальная статистика по картам недоступна для этого матча.</p>
                            </div>
                        )}
                        
                        <div className="modal-actions">
                            <button onClick={closeMatchDetails}>Закрыть</button>
                            {/* Кнопка редактирования для администраторов */}
                            {canEditMatchResult(matchDetails.id) && (
                                <button 
                                    onClick={() => startEditingMatch(matchDetails.id)}
                                    className="edit-match-btn"
                                >
                                    Редактировать результат
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Модальное окно для редактирования результатов матча */}
            {isEditingMatch && editingMatchData && (
                <div className="modal" onClick={cancelEditingMatch}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Редактирование результата матча</h3>
                        
                        <div className="edit-match-teams">
                            <label>
                                <input
                                    type="radio"
                                    name="winner"
                                    value={editingMatchData.team1_id}
                                    checked={editingWinner === editingMatchData.team1_id}
                                    onChange={(e) => setEditingWinner(Number(e.target.value))}
                                />
                                {tournament.participants.find(p => p.id === editingMatchData.team1_id)?.name || 'Команда 1'}
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="winner"
                                    value={editingMatchData.team2_id}
                                    checked={editingWinner === editingMatchData.team2_id}
                                    onChange={(e) => setEditingWinner(Number(e.target.value))}
                                />
                                {tournament.participants.find(p => p.id === editingMatchData.team2_id)?.name || 'Команда 2'}
                            </label>
                        </div>
                        
                        {gameHasMaps(tournament.game) ? (
                            <div className="maps-container">
                                <h4>Карты матча</h4>
                                {editingMaps.map((mapData, index) => (
                                    <div key={index} className="map-entry">
                                        <div className="map-select-container">
                                            <select 
                                                value={mapData.map}
                                                onChange={(e) => updateEditingMapSelection(index, e.target.value)}
                                                className="map-select"
                                            >
                                                {getGameMaps(tournament.game).map(map => (
                                                    <option key={map.name} value={map.name}>{map.name}</option>
                                                ))}
                                            </select>
                                            {editingMaps.length > 1 && (
                                                <button 
                                                    onClick={() => removeEditingMap(index)}
                                                    className="remove-map-btn"
                                                >
                                                    ✖
                                                </button>
                                            )}
                                        </div>
                                        <div className="map-scores">
                                            <div className="score-container">
                                                <span className="participant-name">
                                                    {tournament.participants.find(p => p.id === editingMatchData.team1_id)?.name || 'Команда 1'}
                                                </span>
                                                <input
                                                    type="number"
                                                    value={mapData.score1}
                                                    onChange={(e) => updateEditingMapScore(index, 1, Number(e.target.value))}
                                                    className="score-input"
                                                    min="0"
                                                />
                                            </div>
                                            <div className="score-container">
                                                <span className="participant-name">
                                                    {tournament.participants.find(p => p.id === editingMatchData.team2_id)?.name || 'Команда 2'}
                                                </span>
                                                <input
                                                    type="number"
                                                    value={mapData.score2}
                                                    onChange={(e) => updateEditingMapScore(index, 2, Number(e.target.value))}
                                                    className="score-input"
                                                    min="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                {editingMaps.length < 7 && (
                                    <button onClick={addEditingMap} className="add-map-btn">
                                        + Добавить карту
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="score-inputs">
                                <div className="score-container">
                                    <span className="participant-name">
                                        {tournament.participants.find(p => p.id === editingMatchData.team1_id)?.name || 'Команда 1'}
                                    </span>
                                    <input
                                        type="number"
                                        value={editingScores.team1}
                                        onChange={(e) => setEditingScores({ ...editingScores, team1: Number(e.target.value) })}
                                        className="score-input"
                                        min="0"
                                    />
                                </div>
                                <div className="score-container">
                                    <span className="participant-name">
                                        {tournament.participants.find(p => p.id === editingMatchData.team2_id)?.name || 'Команда 2'}
                                    </span>
                                    <input
                                        type="number"
                                        value={editingScores.team2}
                                        onChange={(e) => setEditingScores({ ...editingScores, team2: Number(e.target.value) })}
                                        className="score-input"
                                        min="0"
                                    />
                                </div>
                            </div>
                        )}
                        
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={cancelEditingMatch}>
                                Отмена
                            </button>
                            <button className="confirm-winner" onClick={saveMatchEdit}>
                                Сохранить изменения
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
            
            {/* Модальное окно подтверждения сброса результатов матчей */}
            {showClearResultsModal && (
                <div className="modal" onClick={() => setShowClearResultsModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Подтверждение сброса результатов</h3>
                        <p>Вы уверены, что хотите сбросить результаты всех матчей?</p>
                        <p>Это действие очистит все результаты матчей в турнире, но сохранит структуру сетки.</p>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowClearResultsModal(false)}>
                                Отмена
                            </button>
                            <button 
                                className="confirm-winner"
                                onClick={confirmClearMatchResults}
                            >
                                Сбросить результаты
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Модальное окно состава команды */}
            {showTeamModal && selectedTeamData && (
                <div className="modal team-composition-modal" onClick={closeTeamModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="team-modal-header">
                            <h3>{selectedTeamData.name}</h3>
                            <button className="close-btn" onClick={closeTeamModal}>&times;</button>
                        </div>
                        
                        <div className="team-composition-content">
                            {selectedTeamData.members && selectedTeamData.members.length > 0 ? (
                                <>
                                    <div className="team-stats">
                                        <div className="team-stat-item">
                                            <span className="stat-label">Игроков:</span>
                                            <span className="stat-value">{selectedTeamData.members.length}</span>
                                        </div>
                                        {selectedTeamData.members.some(m => m.faceit_elo) && (
                                            <div className="team-stat-item">
                                                <span className="stat-label">Средний ELO:</span>
                                                <span className="stat-value">
                                                    {Math.round(
                                                        selectedTeamData.members
                                                            .filter(m => m.faceit_elo)
                                                            .reduce((sum, m) => sum + (m.faceit_elo || 1000), 0) / 
                                                        selectedTeamData.members.filter(m => m.faceit_elo).length
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="team-members-list">
                                        {selectedTeamData.members.map((member, index) => (
                                            <div key={member.id || index} className="team-member-item">
                                                <div className="member-avatar">
                                                    <img 
                                                        src={ensureHttps(member.avatar_url) || '/default-avatar.png'} 
                                                        alt={`${member.name} аватар`}
                                                        onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                    />
                                                </div>
                                                <div className="member-info">
                                                    <div className="member-name">
                                                        {member.name || 'Участник'}
                                                    </div>
                                                    {member.faceit_elo && (
                                                        <div className="member-elo">
                                                            FACEIT: {member.faceit_elo}
                                                        </div>
                                                    )}
                                                </div>
                                                {member.id && user && member.id !== user.id && (
                                                    <div className="member-actions">
                                                        <Link 
                                                            to={`/user/${member.id}`} 
                                                            className="view-profile-btn"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            Профиль
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="no-members">
                                    <p>Информация о составе недоступна</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default TournamentDetails;
