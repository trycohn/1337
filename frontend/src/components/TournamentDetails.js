// 🔧 QA REFACTORED VERSION - TournamentDetails.js v4.2.5
// ✅ Реорганизация страницы турнира с табовой структурой
// ✅ Убран блок достижений
// ✅ Скрыт список участников микс-турнира после формирования команд
// ✅ Добавлена система вкладок

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

// 🆕 ИМПОРТ ХУКА ДЛЯ УПРАВЛЕНИЯ ТУРНИРОМ
import useTournamentManagement from '../hooks/tournament/useTournamentManagement';

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

// Компонент призеров турнира
const TournamentWinners = React.memo(({ tournament }) => {
    if (tournament.status !== 'completed' || !tournament.winners) {
        return null;
    }

    const winners = Array.isArray(tournament.winners) ? tournament.winners : [];
    
    if (winners.length === 0) {
        return null;
    }

    return (
        <div className="winners-section">
            <h3>🏆 Призеры турнира</h3>
            <div className="winners-podium">
                {winners.slice(0, 3).map((winner, index) => (
                    <div key={winner.id || index} className={`winner-card place-${index + 1}`}>
                        <div className="medal-icon">
                            {index === 0 && <span className="gold-medal">🥇</span>}
                            {index === 1 && <span className="silver-medal">🥈</span>}
                            {index === 2 && <span className="bronze-medal">🥉</span>}
                        </div>
                        <div className="winner-info">
                            {winner.avatar_url && (
                                <img 
                                    src={ensureHttps(winner.avatar_url)} 
                                    alt={`Призер ${index + 1}`}
                                    className="winner-avatar"
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                            )}
                            <div className="winner-name">
                                {winner.user_id ? (
                                    <Link to={`/user/${winner.user_id}`} target="_blank" rel="noopener noreferrer">
                                        {winner.name || winner.username || 'Участник'}
                                    </Link>
                                ) : (
                                    <span>{winner.name || winner.username || 'Участник'}</span>
                                )}
                            </div>
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

    // 🆕 Состояние активной вкладки
    const [activeTab, setActiveTab] = useState('info');

    // Состояния для модальных окон (упрощенная версия без хука)
    const [modals, setModals] = useState({
        addParticipant: false,
        participantSearch: false,
        matchResult: false,
        matchDetails: false
    });

    // 🆕 СОСТОЯНИЯ ДЛЯ ПОИСКА АДМИНИСТРАТОРОВ
    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [adminSearchResults, setAdminSearchResults] = useState([]);
    const [isSearchingAdmins, setIsSearchingAdmins] = useState(false);
    const [adminSearchModal, setAdminSearchModal] = useState(false);

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

    // 🆕 ХУК ДЛЯ УПРАВЛЕНИЯ ТУРНИРОМ
    const tournamentManagement = useTournamentManagement(id);

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

    // 🆕 Функция сохранения результата матча
    const saveMatchResult = useCallback(async (resultData) => {
        if (!selectedMatch) {
            console.error('❌ Нет выбранного матча для сохранения результата');
            return;
        }

        // Получаем ID матча из selectedMatch
        const matchId = typeof selectedMatch === 'object' ? selectedMatch.id : selectedMatch;
        
        if (!matchId && matchId !== 0) {
            console.error('❌ Не удалось определить ID матча:', selectedMatch);
            return;
        }

        console.log('💾 Начинаем сохранение результата матча:', {
            matchId,
            resultData,
            tournamentId: id
        });

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Отсутствует токен авторизации');
            }

            // Подготовка данных для отправки
            const submitData = {
                score1: parseInt(resultData.score1) || 0,
                score2: parseInt(resultData.score2) || 0,
                maps_data: resultData.maps_data || [],
                winner_team_id: null
            };

            // Определение победителя
            if (resultData.winner === 'team1') {
                submitData.winner_team_id = selectedMatch.team1_id;
            } else if (resultData.winner === 'team2') {
                submitData.winner_team_id = selectedMatch.team2_id;
            } else if (submitData.score1 > submitData.score2) {
                submitData.winner_team_id = selectedMatch.team1_id;
            } else if (submitData.score2 > submitData.score1) {
                submitData.winner_team_id = selectedMatch.team2_id;
            }

            console.log('📡 Отправляем данные на сервер:', submitData);

            // Отправка запроса на сервер
            const response = await api.post(`/api/tournaments/matches/${matchId}/result`, submitData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Результат матча успешно сохранен:', response.data);

            // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Очищаем кеш турнира после сохранения
            const cacheKey = `tournament_cache_${id}`;
            const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimestampKey);
            console.log('🗑️ Кеш турнира очищен для принудительного обновления');

            // Закрываем модальное окно
            closeModal('matchResult');
            setSelectedMatch(null);
            setMatchResultData({ score1: 0, score2: 0, maps_data: [] });

            // Обновляем данные турнира
            await fetchTournamentData();

            setMessage('✅ Результат матча успешно сохранен!');
            setTimeout(() => setMessage(''), 3000);

        } catch (error) {
            console.error('❌ Ошибка при сохранении результата матча:', error);
            
            let errorMessage = 'Ошибка при сохранении результата матча';
            
            if (error.response?.status === 403) {
                errorMessage = 'У вас нет прав для редактирования результатов этого матча';
            } else if (error.response?.status === 404) {
                errorMessage = 'Матч не найден';
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            setMessage(`❌ ${errorMessage}`);
            setTimeout(() => setMessage(''), 5000);
        } finally {
            setLoading(false);
        }
    }, [selectedMatch, id, fetchTournamentData, closeModal]);

    // 🆕 Функция переключения вкладок
    const switchTab = useCallback((tabName) => {
        setActiveTab(tabName);
        console.log('🔄 Переключение на вкладку:', tabName);
    }, []);

    // 🆕 Проверка, нужно ли показывать вкладку участников
    const shouldShowParticipantsTab = useMemo(() => {
        if (!tournament) return false;
        
        // Для микс-турниров применяем специальную логику
        if (tournament.format === 'mix') {
            // Скрываем для микс-турниров в статусах "in-progress" и "completed"
            if (tournament.status === 'in-progress' || tournament.status === 'completed') {
                return false;
            }
            
            // Скрываем если команды уже сформированы
            if (tournament.teams && tournament.teams.length > 0) {
                return false;
            }
        }
        
        // Для всех остальных типов турниров (solo, team) всегда показываем участников
        return true;
    }, [tournament]);

    // 🆕 Автоматическое переключение на доступную вкладку
    useEffect(() => {
        if (!shouldShowParticipantsTab && activeTab === 'participants') {
            // Если вкладка участников недоступна, переключаемся на главную
            setActiveTab('info');
            console.log('🔄 Автоматическое переключение с вкладки "Участники" на "Главная"');
        }
    }, [shouldShowParticipantsTab, activeTab]);

    // 🆕 Рендеринг контента вкладок
    const renderTabContent = () => {
        switch (activeTab) {
            case 'info':
                return (
                    <div className="tab-content-info">
                        {/* Информационная секция */}
                        <TournamentInfoSection 
                            tournament={tournament}
                            user={user}
                            isCreator={isCreator}
                            isAdminOrCreator={isAdminOrCreator}
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
                                            setSelectedMatch={(match) => {
                                                // 🔧 ИСПРАВЛЕНИЕ: Обрабатываем match как объект или ID с проверкой на null
                                                console.log('🎯 setSelectedMatch вызван с:', match, 'тип:', typeof match);
                                                
                                                if (match === null || match === undefined) {
                                                    console.log('🎯 Выбран матч: null/undefined - снимаем выделение');
                                                    setSelectedMatch(null);
                                                    return;
                                                }
                                                
                                                const matchId = typeof match === 'object' && match !== null ? match.id : match;
                                                console.log('🎯 Выбран матч ID:', matchId, 'из объекта:', match);
                                                
                                                if (matchId) {
                                                    // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Найти полный объект матча и открыть модальное окно
                                                    const fullMatch = matches.find(m => m.id === parseInt(matchId));
                                                    if (fullMatch && canEditMatches) {
                                                        console.log('🎯 Найден полный объект матча:', fullMatch);
                                                        
                                                        // Получаем информацию о командах
                                                        const team1Info = tournament.teams?.find(t => t.id === fullMatch.team1_id) || 
                                                                         tournament.participants?.find(p => p.id === fullMatch.team1_id);
                                                        const team2Info = tournament.teams?.find(t => t.id === fullMatch.team2_id) || 
                                                                         tournament.participants?.find(p => p.id === fullMatch.team2_id);
                                                        
                                                        // Создаем расширенный объект матча
                                                        const matchWithTeamInfo = {
                                                            ...fullMatch,
                                                            team1_name: team1Info?.name || team1Info?.username || 'Команда 1',
                                                            team2_name: team2Info?.name || team2Info?.username || 'Команда 2',
                                                            team1_composition: team1Info,
                                                            team2_composition: team2Info
                                                        };
                                                        
                                                        setSelectedMatch(matchWithTeamInfo);
                                                        setMatchResultData({
                                                            score1: fullMatch.score1 || 0,
                                                            score2: fullMatch.score2 || 0,
                                                            maps_data: fullMatch.maps_data || []
                                                        });
                                                        openModal('matchResult');
                                                        console.log('🎯 Открыто модальное окно для редактирования матча:', matchId);
                                                    } else {
                                                        console.warn('⚠️ Матч не найден или нет прав на редактирование:', matchId);
                                                        setSelectedMatch(matchId);
                                                    }
                                                } else {
                                                    console.warn('⚠️ Не удалось определить ID матча из:', match);
                                                    setSelectedMatch(null);
                                                }
                                            }}
                                            handleTeamClick={() => {}}
                                            format={tournament.format}
                                            onMatchClick={(match) => {
                                                console.log('🎯 onMatchClick вызван с:', match);
                                                if (match && match.id) {
                                                    setSelectedMatchForDetails(match);
                                                    openModal('matchDetails');
                                                } else {
                                                    console.warn('⚠️ onMatchClick: некорректный объект матча:', match);
                                                }
                                            }}
                                        />
                                    </Suspense>
                                </TournamentErrorBoundary>
                            </div>
                        )}

                        {/* Призеры турнира */}
                        <TournamentWinners tournament={tournament} />
                    </div>
                );

            case 'participants':
                return (
                    <div className="tab-content-participants">
                        <h3>👥 Участники турнира</h3>
                        
                        {/* Панель участников - скрываем для микс-турниров с сформированными командами */}
                        {!(tournament.format === 'mix' && tournament.teams && tournament.teams.length > 0) && (
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
                        )}

                        {/* Генератор команд для микс-турниров */}
                        {tournament.format === 'mix' && (
                            <TeamGenerator
                                tournament={tournament}
                                participants={tournament.teams && tournament.teams.length > 0 ? [] : originalParticipants}
                                onTeamsGenerated={handleTeamsGenerated}
                                onTeamsUpdated={() => {}}
                                onRemoveParticipant={() => {}}
                                isAdminOrCreator={isAdminOrCreator}
                            />
                        )}

                        {/* Сообщение для микс-турниров с сформированными командами */}
                        {tournament.format === 'mix' && tournament.teams && tournament.teams.length > 0 && (
                            <div className="teams-formed-notice">
                                <div className="notice-content">
                                    <h4>✅ Команды сформированы</h4>
                                    <p>Участники распределены по командам. Список участников теперь доступен в генераторе команд.</p>
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'bracket':
                return (
                    <div className="tab-content-bracket">
                        <div className="bracket-tab-header">
                            <h3>🏆 Турнирная сетка</h3>
                            <div className="bracket-controls">
                                {canGenerateBracket && (
                                    <button 
                                        className="generate-bracket-button"
                                        onClick={() => {}}
                                    >
                                        🎯 Сгенерировать сетку
                                    </button>
                                )}
                                {canEditMatches && games.length > 0 && (
                                    <button 
                                        className="regenerate-bracket-button"
                                        onClick={() => {}}
                                    >
                                        🔄 Перегенерировать сетку
                                    </button>
                                )}
                            </div>
                        </div>

                        {games.length > 0 ? (
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
                        ) : (
                            <div className="empty-state">
                                <p>🏗️ Турнирная сетка не сгенерирована</p>
                                <p className="text-muted">
                                    {canGenerateBracket 
                                        ? 'Для генерации сетки нужно минимум 2 участника' 
                                        : 'Дождитесь генерации сетки организатором турнира'
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                );

            case 'results':
                return (
                    <div className="tab-content-results">
                        <h3>📊 Результаты матчей</h3>
                        
                        {matches.length > 0 ? (
                            <div className="results-compact-list">
                                {matches
                                    .filter(match => match.winner_team_id || (match.score1 !== null && match.score2 !== null))
                                    .sort((a, b) => new Date(b.updated_at || b.completed_at) - new Date(a.updated_at || a.completed_at))
                                    .map((match) => {
                                        const team1Info = tournament.teams?.find(t => t.id === match.team1_id) || 
                                                         tournament.participants?.find(p => p.id === match.team1_id);
                                        const team2Info = tournament.teams?.find(t => t.id === match.team2_id) || 
                                                         tournament.participants?.find(p => p.id === match.team2_id);

                                        return (
                                            <div key={match.id} className="result-compact-item">
                                                <div className="result-compact-content">
                                                    <div className="result-compact-round">
                                                        {match.is_third_place_match && (
                                                            <span className="third-place-indicator">🥉 За 3-е место</span>
                                                        )}
                                                        {match.round === Math.max(...matches.map(m => m.round)) && !match.is_third_place_match && (
                                                            <span className="grand-final-indicator">🏆 Финал</span>
                                                        )}
                                                        {!match.is_third_place_match && match.round !== Math.max(...matches.map(m => m.round)) && (
                                                            <span>Раунд {match.round}</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="result-compact-match">
                                                        <button 
                                                            className={`team-name-btn ${match.winner_team_id === match.team1_id ? 'winner' : ''}`}
                                                            onClick={() => {
                                                                if (team1Info) {
                                                                    // Показать состав команды
                                                                }
                                                            }}
                                                        >
                                                            {team1Info?.name || team1Info?.username || 'Команда 1'}
                                                        </button>
                                                        
                                                        <div className="match-score">
                                                            <span className={match.winner_team_id === match.team1_id ? 'winner-score' : ''}>{match.score1 || 0}</span>
                                                            <span className="score-separator">:</span>
                                                            <span className={match.winner_team_id === match.team2_id ? 'winner-score' : ''}>{match.score2 || 0}</span>
                                                        </div>
                                                        
                                                        <button 
                                                            className={`team-name-btn ${match.winner_team_id === match.team2_id ? 'winner' : ''}`}
                                                            onClick={() => {
                                                                if (team2Info) {
                                                                    // Показать состав команды
                                                                }
                                                            }}
                                                        >
                                                            {team2Info?.name || team2Info?.username || 'Команда 2'}
                                                        </button>
                                                    </div>

                                                    <div className="result-compact-actions">
                                                        <button 
                                                            className="details-btn"
                                                            onClick={() => {
                                                                setSelectedMatchForDetails(match);
                                                                openModal('matchDetails');
                                                            }}
                                                        >
                                                            📋 Детали
                                                        </button>
                                                        
                                                        {canEditMatches && (
                                                            <button 
                                                                className="edit-compact-btn"
                                                                onClick={() => {
                                                                    // 🔧 ИСПРАВЛЕНИЕ: Передаем весь объект матча, но с правильными данными о командах
                                                                    const matchWithTeamInfo = {
                                                                        ...match,
                                                                        team1_name: team1Info?.name || team1Info?.username || 'Команда 1',
                                                                        team2_name: team2Info?.name || team2Info?.username || 'Команда 2',
                                                                        team1_composition: team1Info,
                                                                        team2_composition: team2Info
                                                                    };
                                                                    setSelectedMatch(matchWithTeamInfo);
                                                                    setMatchResultData({
                                                                        score1: match.score1 || 0,
                                                                        score2: match.score2 || 0,
                                                                        maps_data: match.maps_data || []
                                                                    });
                                                                    openModal('matchResult');
                                                                }}
                                                            >
                                                                ✏️ Изменить
                                                            </button>
                                                        )}
                                                    </div>

                                                    {match.completed_at && (
                                                        <div className="match-completed-time">
                                                            Завершен: {new Date(match.completed_at).toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>📋 Результаты матчей пока отсутствуют</p>
                                <p className="text-muted">Результаты появятся после проведения матчей</p>
                            </div>
                        )}
                    </div>
                );

            case 'management':
                return (
                    <div className="tab-content-management">
                        {isAdminOrCreator ? (
                            <TournamentAdminPanel
                                tournament={tournament}
                                participants={tournament.participants || []}
                                matches={matches}
                                isCreatorOrAdmin={isAdminOrCreator}
                                isLoading={loading}
                                onStartTournament={() => {}}
                                onEndTournament={() => {}}
                                onRegenerateBracket={() => {}}
                                onShowAddParticipantModal={() => openModal('addParticipant')}
                                onShowParticipantSearchModal={() => openModal('participantSearch')}
                                onRemoveParticipant={() => {}}
                                onEditMatchResult={(match) => {
                                    setSelectedMatch(match);
                                    setMatchResultData({
                                        score1: match.score1 || 0,
                                        score2: match.score2 || 0,
                                        maps_data: match.maps_data || []
                                    });
                                    openModal('matchResult');
                                }}
                                onGenerateBracket={() => {}}
                                onClearResults={() => {}}
                                onInviteAdmin={inviteAdmin}
                                onRemoveAdmin={removeAdmin}
                                onShowAdminSearchModal={openAdminSearchModal}
                            />
                        ) : (
                            <div className="access-denied">
                                <h3>🔒 Доступ ограничен</h3>
                                <p>Эта секция доступна только администраторам и создателю турнира.</p>
                            </div>
                        )}
                    </div>
                );

            default:
                return <div>Неизвестная вкладка</div>;
        }
    };

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

    // 🆕 ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ АДМИНИСТРАТОРАМИ

    // Поиск пользователей для приглашения в администраторы
    const searchAdmins = useCallback(async (query) => {
        if (!query || query.trim().length < 3) {
            setAdminSearchResults([]);
            return;
        }

        setIsSearchingAdmins(true);
        try {
            const result = await tournamentManagement.searchUsers(query.trim());
            if (result.success) {
                setAdminSearchResults(result.data || []);
            } else {
                setAdminSearchResults([]);
                setMessage(`❌ Ошибка поиска: ${result.error}`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('❌ Ошибка поиска администраторов:', error);
            setAdminSearchResults([]);
            setMessage('❌ Ошибка при поиске пользователей');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setIsSearchingAdmins(false);
        }
    }, [tournamentManagement]);

    // Приглашение пользователя в администраторы
    const inviteAdmin = useCallback(async (userId, userName) => {
        try {
            setIsSearchingAdmins(true);
            const result = await tournamentManagement.inviteAdmin(userId);
            
            if (result.success) {
                setMessage(`✅ ${userName} приглашен в администраторы турнира`);
                setAdminSearchModal(false);
                setAdminSearchQuery('');
                setAdminSearchResults([]);
                
                // Обновляем данные турнира
                await fetchTournamentData();
            } else {
                setMessage(`❌ ${result.message || 'Ошибка при приглашении администратора'}`);
            }
        } catch (error) {
            console.error('❌ Ошибка приглашения администратора:', error);
            setMessage('❌ Ошибка при приглашении администратора');
        } finally {
            setIsSearchingAdmins(false);
            setTimeout(() => setMessage(''), 5000);
        }
    }, [tournamentManagement, fetchTournamentData]);

    // Удаление администратора
    const removeAdmin = useCallback(async (userId) => {
        const confirmed = window.confirm('Вы уверены, что хотите удалить этого администратора?');
        if (!confirmed) return;

        try {
            const result = await tournamentManagement.removeAdmin(userId);
            
            if (result.success) {
                setMessage('✅ Администратор удален из турнира');
                
                // Обновляем данные турнира
                await fetchTournamentData();
            } else {
                setMessage(`❌ ${result.message || 'Ошибка при удалении администратора'}`);
            }
        } catch (error) {
            console.error('❌ Ошибка удаления администратора:', error);
            setMessage('❌ Ошибка при удалении администратора');
        } finally {
            setTimeout(() => setMessage(''), 5000);
        }
    }, [tournamentManagement, fetchTournamentData]);

    // Открытие модального окна поиска администраторов
    const openAdminSearchModal = useCallback(() => {
        setAdminSearchModal(true);
        setAdminSearchQuery('');
        setAdminSearchResults([]);
    }, []);

    // Закрытие модального окна поиска администраторов
    const closeAdminSearchModal = useCallback(() => {
        setAdminSearchModal(false);
        setAdminSearchQuery('');
        setAdminSearchResults([]);
        setIsSearchingAdmins(false);
    }, []);

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

    // 🆕 Основной рендер с системой вкладок
    return (
        <TournamentErrorBoundary>
            <div className="tournament-details-tournamentdetails" data-testid="tournament-details">
                <div className="tournament-layout">
                    <div className="tournament-main">
                        {/* Заголовок турнира */}
                        <div className="tournament-header-tournamentdetails">
                            <h2 data-testid="tournament-title">{tournament.name}</h2>
                        </div>

                        {/* 🆕 Навигация по вкладкам */}
                        <div className="tabs-navigation-tournamentdetails">
                            <button 
                                className={`tab-button-tournamentdetails ${activeTab === 'info' ? 'active' : ''}`}
                                onClick={() => switchTab('info')}
                            >
                                <span className="tab-label-tournamentdetails">📋 Главная</span>
                            </button>
                            
                            {shouldShowParticipantsTab && (
                                <button 
                                    className={`tab-button-tournamentdetails ${activeTab === 'participants' ? 'active' : ''}`}
                                    onClick={() => switchTab('participants')}
                                >
                                    <span className="tab-label-tournamentdetails">👥 Участники</span>
                                </button>
                            )}
                            
                            <button 
                                className={`tab-button-tournamentdetails ${activeTab === 'bracket' ? 'active' : ''}`}
                                onClick={() => switchTab('bracket')}
                            >
                                <span className="tab-label-tournamentdetails">🏆 Сетка</span>
                            </button>
                            
                            <button 
                                className={`tab-button-tournamentdetails ${activeTab === 'results' ? 'active' : ''}`}
                                onClick={() => switchTab('results')}
                            >
                                <span className="tab-label-tournamentdetails">📊 Результаты</span>
                            </button>
                            
                            {isAdminOrCreator && (
                                <button 
                                    className={`tab-button-tournamentdetails ${activeTab === 'management' ? 'active' : ''}`}
                                    onClick={() => switchTab('management')}
                                >
                                    <span className="tab-label-tournamentdetails">⚙️ Управление</span>
                                </button>
                            )}
                        </div>

                        {/* 🆕 Контент вкладок */}
                        <div className="tournament-content-tournamentdetails">
                            <div className="tab-content-tournamentdetails">
                                {renderTabContent()}
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
                        onSave={saveMatchResult}
                        isLoading={loading}
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

                {/* 🆕 Модальное окно поиска администраторов */}
                {adminSearchModal && (
                    <ParticipantSearchModal
                        isOpen={adminSearchModal}
                        onClose={closeAdminSearchModal}
                        mode="admin"
                        onInviteAdmin={inviteAdmin}
                        searchQuery={adminSearchQuery}
                        setSearchQuery={setAdminSearchQuery}
                        searchResults={adminSearchResults}
                        isSearching={isSearchingAdmins}
                        onSearch={searchAdmins}
                        existingAdmins={tournament?.admins || []}
                        existingParticipants={[]} // Не нужно для режима админов
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