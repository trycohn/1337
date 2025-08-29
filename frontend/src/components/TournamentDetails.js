// 🔧 QA REFACTORED VERSION - TournamentDetails.js v5.0 МОДУЛЬНАЯ АРХИТЕКТУРА
// ✅ Убран дублированный функционал - используем новые API endpoints
// ✅ Обновлены API пути согласно модульной архитектуре
// ✅ Упрощена логика без дублирования кода

// Импорты React и связанные
import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../utils/api';
import { getSocketInstance, authenticateSocket, watchTournament, unwatchTournament } from '../services/socketClient_v5_simplified';
import { useModalSystem } from '../hooks/useModalSystem';
import useTournamentManagement from '../hooks/tournament/useTournamentManagement';
import { useLoaderAutomatic } from '../hooks/useLoaderAutomaticHook';
import { enrichMatchWithParticipantNames, validateParticipantData } from '../utils/participantHelpers';

// Утилиты и хелперы
import { ensureHttps } from '../utils/userHelpers';
import { 
    isCounterStrike2, 
    gameHasMaps, 
    getGameMaps as getGameMapsHelper, 
    getDefaultMap as getDefaultMapHelper, 
    getDefaultCS2Maps 
} from '../utils/mapHelpers';

// Контекст
import { useUser } from '../context/UserContext';

// Стили
import './TournamentDetails.css';

// Компоненты
import TournamentInfoSection from './TournamentInfoSection';
import MatchResultModal from './tournament/modals/MatchResultModal';
import MatchDetailsModal from './tournament/modals/MatchDetailsModal';
import ParticipantSearchModal from './tournament/modals/ParticipantSearchModal';
import AddParticipantModal from './tournament/modals/AddParticipantModal';
import ThirdPlaceMatchModal from './tournament/modals/ThirdPlaceMatchModal';
import TournamentFloatingActionPanel from './tournament/TournamentFloatingActionPanel';
import TournamentAdminPanel from './tournament/TournamentAdminPanel';
import TournamentParticipants from './tournament/TournamentParticipants';
import TournamentWinners from './tournament/TournamentWinners';
import TournamentResults from './tournament/TournamentResults';
import BracketManagementPanel from './tournament/BracketManagementPanel';
import DeleteTournamentModal from './tournament/modals/DeleteTournamentModal';
import './tournament/BracketManagementPanel.css';

// 🏆 Обычный импорт PodiumSection (исправлено для устранения ошибки сборки)
import PodiumSection from './tournament/PodiumSection';

// 🆕 Прогресс-бар турнира
import TournamentProgressBar from './tournament/TournamentProgressBar';

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
const CACHE_VALIDITY_PERIOD = 30 * 1000; // 🔧 АДАПТИВНОЕ КЕШИРОВАНИЕ: 30 секунд для быстрого обновления
const MAPS_CACHE_VALIDITY_PERIOD = 24 * 60 * 60 * 1000; // 24 часа

// 🆕 КОНФИГУРАЦИЯ ГИБРИДНОГО РЕШЕНИЯ
const HYBRID_CONFIG = {
    // Адаптивное кеширование
    CACHE_NORMAL: 30 * 1000,     // 30 секунд - обычное состояние
    CACHE_ACTIVE: 10 * 1000,     // 10 секунд - когда турнир активный
    CACHE_UPDATING: 5 * 1000,    // 5 секунд - во время операций
    CACHE_CRITICAL: 1 * 1000,    // 1 секунда - критические операции (старт/стоп)
    
    // WebSocket мониторинг
    WEBSOCKET_TIMEOUT: 3000,     // Таймаут ожидания WebSocket
    FALLBACK_DELAY: 2000,        // Задержка перед fallback
    
    // Retry логика
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    
    // Типы обновлений
    UPDATE_TYPES: {
        STATUS_CHANGE: 'status_change',
        PARTICIPANTS: 'participants_update', 
        MATCHES: 'matches_update',
        TEAMS: 'teams_update',
        GENERAL: 'general_update'
    }
};

// 🎯 Кеширование для повышения производительности
const CACHE_DURATION = 30000; // 30 секунд

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
    const [availableMaps, setAvailableMaps] = useState({});
    const [originalParticipants, setOriginalParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreator, setIsCreator] = useState(false);
    const [isAdminOrCreator, setIsAdminOrCreator] = useState(false);

    // 🆕 Состояние активной вкладки
    const [activeTab, setActiveTab] = useState('info');
    
    // Проверяем URL параметр tab при загрузке
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam && ['info', 'bracket', 'participants', 'results', 'management'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, []);
    
    // 🆕 Состояния для модального окна матча за 3-е место
    const [showThirdPlaceModal, setShowThirdPlaceModal] = useState(false);
    const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
    const [isRegenerationMode, setIsRegenerationMode] = useState(false);
    
    // Состояния для модальных окон
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

    // 🆕 СОСТОЯНИЕ ДЛЯ МОДАЛЬНОГО ОКНА УДАЛЕНИЯ ТУРНИРА
    const [deleteTournamentModal, setDeleteTournamentModal] = useState(false);
    const [isDeletingTournament, setIsDeletingTournament] = useState(false);

    // 🆕 ГИБРИДНАЯ СИСТЕМА СОСТОЯНИЯ
    const [hybridState, setHybridState] = useState({
        isWebSocketConnected: false,
        lastWebSocketEvent: null,
        cacheStrategy: 'normal',
        pendingOperations: new Set(),
        fallbackActive: false,
        updateQueue: [],
        retryCount: 0
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
    
    const [selectedMatchForDetails, setSelectedMatchForDetailsBase] = useState(null);

    // Обертка для логирования изменений selectedMatchForDetails
    const setSelectedMatchForDetails = useCallback((match) => {
        console.log('🔄 setSelectedMatchForDetails вызван:', {
            oldMatchId: selectedMatchForDetails?.id,
            newMatchId: match?.id,
            newMatchData: match,
            stackTrace: new Error().stack?.split('\n')[1]?.trim()
        });
        setSelectedMatchForDetailsBase(match);
    }, [selectedMatchForDetails]);

    // Логирование изменений selectedMatchForDetails
    useEffect(() => {
        console.log('🔍 selectedMatchForDetails изменился:', {
            matchId: selectedMatchForDetails?.id,
            team1: selectedMatchForDetails?.team1_name,
            team2: selectedMatchForDetails?.team2_name
        });
    }, [selectedMatchForDetails]);

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

    // 🆕 АДАПТИВНОЕ ОПРЕДЕЛЕНИЕ ВРЕМЕНИ КЕШИРОВАНИЯ
    const getAdaptiveCacheTime = useCallback(() => {
        if (hybridState.pendingOperations.size > 0) {
            return 1000; // CACHE_CRITICAL: 1 секунда - критические операции
        }
        
        if (tournament?.status === 'in_progress') {
            return 10000; // CACHE_ACTIVE: 10 секунд - когда турнир активный
        }
        
        if (hybridState.cacheStrategy === 'updating') {
            return 5000; // CACHE_UPDATING: 5 секунд - во время операций
        }
        
        return 30000; // CACHE_NORMAL: 30 секунд - обычное состояние
    }, [tournament?.status, hybridState.pendingOperations.size, hybridState.cacheStrategy]);

    // 🆕 ПРИНУДИТЕЛЬНАЯ ОЧИСТКА КЕША С АДАПТИВНОСТЬЮ
    const clearAdaptiveCache = useCallback((reason = 'manual') => {
        const cacheKey = `tournament_cache_${id}`;
        const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(cacheTimestampKey);
        
        console.log(`🧹 [AdaptiveCache] Кеш очищен по причине: ${reason}`);
        
        // Временно переключаемся на критический режим кеширования
        setHybridState(prev => ({
            ...prev,
            cacheStrategy: 'updating'
        }));
        
        // Возвращаемся к нормальному режиму через 10 секунд
        setTimeout(() => {
            setHybridState(prev => ({
                ...prev,
                cacheStrategy: 'normal'
            }));
        }, 10000);
    }, [id]);

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

    // 🆕 УЛУЧШЕННАЯ ЗАГРУЗКА ДАННЫХ С АДАПТИВНЫМ КЕШИРОВАНИЕМ
    const fetchTournamentDataHybrid = useCallback(async (forceRefresh = false, operation = null) => {
        if (!id) {
            setError('Не указан ID турнира');
            return;
        }

        console.log('🔄 [Hybrid] Начинаем загрузку данных турнира', {
            id,
            forceRefresh,
            operation,
            cacheStrategy: hybridState.cacheStrategy
        });

        setLoading(true);
        setError(null);

        // Добавляем операцию в состояние
        if (operation) {
            setHybridState(prev => ({
                ...prev,
                pendingOperations: new Set(prev.pendingOperations).add(operation)
            }));
        }

        // Определяем адаптивное время кеширования
        const adaptiveCacheTime = getAdaptiveCacheTime();
        
        // Проверяем кеш (если не принудительное обновление)
        const cacheKey = `tournament_cache_${id}`;
        const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
        
        try {
            if (!forceRefresh) {
                const cachedTournament = localStorage.getItem(cacheKey);
                const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
                
                if (cachedTournament && cacheTimestamp) {
                    const now = Date.now();
                    const timestamp = parseInt(cacheTimestamp, 10);
                    
                    if (!isNaN(timestamp) && (now - timestamp) < adaptiveCacheTime) {
                        try {
                            const parsedTournament = JSON.parse(cachedTournament);
                            const validation = validateTournamentData(parsedTournament);
                            
                            if (validation.isValid) {
                                console.log(`✅ [Hybrid] Данные загружены из кеша (${adaptiveCacheTime/1000}s TTL)`);
                                setTournament(parsedTournament);
                                setOriginalParticipants(parsedTournament.participants || []);
                                setMatches(parsedTournament.matches || []);
                                setLoading(false);
                                
                                // Удаляем операцию из состояния
                                if (operation) {
                                    setHybridState(prev => {
                                        const newPending = new Set(prev.pendingOperations);
                                        newPending.delete(operation);
                                        return { ...prev, pendingOperations: newPending };
                                    });
                                }
                                return;
                            }
                        } catch (parseError) {
                            console.warn('⚠️ [Hybrid] Поврежденный кеш, загружаем с сервера');
                            localStorage.removeItem(cacheKey);
                            localStorage.removeItem(cacheTimestampKey);
                        }
                    }
                }
            }

            // Загружаем с сервера с retry логикой
            let retryCount = 0;
            const maxRetries = HYBRID_CONFIG.MAX_RETRIES;
            
            while (retryCount <= maxRetries) {
                try {
                    const response = await api.get(`/api/tournaments/${id}`);
                    
                    if (response.data) {
                        const validation = validateTournamentData(response.data);
                        if (!validation.isValid) {
                            throw new Error(`Некорректные данные турнира: ${validation.error}`);
                        }

                        console.log(`✅ [Hybrid] Данные загружены с сервера (попытка ${retryCount + 1})`);
                        
                        // Сохраняем в кеш
                        localStorage.setItem(cacheKey, JSON.stringify(response.data));
                        localStorage.setItem(cacheTimestampKey, Date.now().toString());
                        
                        // Обновляем состояние
                        setTournament(response.data);
                        setOriginalParticipants(response.data.participants || []);
                        setMatches(response.data.matches || []);
                        
                        // Сбрасываем счетчик retry
                        setHybridState(prev => ({ ...prev, retryCount: 0 }));
                        
                        break; // Успешно загружено
                    }
                } catch (apiError) {
                    retryCount++;
                    console.warn(`⚠️ [Hybrid] Ошибка загрузки (попытка ${retryCount}/${maxRetries + 1}):`, apiError.message);
                    
                    if (retryCount > maxRetries) {
                        throw apiError; // Исчерпаны попытки
                    }
                    
                    // Экспоненциальная задержка
                    await new Promise(resolve => 
                        setTimeout(resolve, HYBRID_CONFIG.RETRY_DELAY * Math.pow(2, retryCount - 1))
                    );
                }
            }
            
        } catch (error) {
            console.error('❌ [Hybrid] Критическая ошибка загрузки данных:', error);
            
            if (handleAuthError(error, 'загрузке данных турнира')) {
                return;
            }
            
            setError(`Ошибка загрузки турнира: ${error.message}`);
            
            // Активируем fallback режим
            setHybridState(prev => ({ 
                ...prev, 
                fallbackActive: true,
                retryCount: prev.retryCount + 1 
            }));
            
        } finally {
            setLoading(false);
            
            // Удаляем операцию из состояния
            if (operation) {
                setHybridState(prev => {
                    const newPending = new Set(prev.pendingOperations);
                    newPending.delete(operation);
                    return { ...prev, pendingOperations: newPending };
                });
            }
        }
    }, [id, hybridState.cacheStrategy, getAdaptiveCacheTime, handleAuthError]);

    // Обновляем основную функцию загрузки
    const fetchTournamentData = fetchTournamentDataHybrid;

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

    // Обработчик генерации команд
    const handleTeamsGenerated = useCallback((teams) => {
        if (Array.isArray(teams)) {
            if (tournament?.participants?.length > 0) {
                setOriginalParticipants([...tournament.participants]);
            }
        }
    }, [tournament?.participants]);

    // 🔧 ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ИНФОРМАЦИИ ОБ УЧАСТНИКЕ (вынесена на уровень компонента)
    const getParticipantInfo = useCallback((teamId) => {
        if (!teamId) return null;

        // Создаем карты участников и команд из данных турнира
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
    }, [tournament]);

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

        // Создание безопасного участника
        const createSafeParticipant = (teamId, resultText, isWinner, status = 'PLAYED') => {
            const participantInfo = getParticipantInfo(teamId);

            // 🆕 ИСПРАВЛЕНО: Правильное определение BYE участников
            const isBYE = !teamId;
            const participantName = isBYE ? 'BYE' : (participantInfo?.name || 'TBD');

            return {
                id: teamId ? String(teamId) : 'tbd',
                resultText: resultText !== null ? String(resultText) : null,
                isWinner: Boolean(isWinner),
                status: status || 'NO_SHOW',
                name: participantName,
                score: resultText,
                avatarUrl: participantInfo?.avatar_url ? ensureHttps(participantInfo.avatar_url) : null
            };
        };

        // Формируем массив игр с дополнительными проверками
        const safeGames = matches
            .filter(match => match != null && match !== undefined && match.id) // Более строгая фильтрация
            .map(match => {
                // 🔧 ИСПРАВЛЕНО: Дополнительная проверка что match действительно объект
                if (typeof match !== 'object' || match === null) {
                    console.warn('⚠️ Пропускаем невалидный матч:', match);
                    return null;
                }

                let status = 'SCHEDULED';
                // 🆕 ИСПРАВЛЕНО: Проверяем статус из БД для BYE матчей
                if (match.status === 'completed' || match.winner_team_id) {
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
                    // 🆕 ДОБАВЛЕНО: Передаем оригинальный статус из БД для BYE матчей
                    status: match.status,
                    name: match.name || `Матч ${match.tournament_match_number || match.match_number || match.id}`,
                    bracket_type: match.bracket_type || 'winner',
                    round: match.round !== undefined ? match.round : 0,
                    // 🔧 ИСПРАВЛЕНО: Добавляем проверку bracket_type перед использованием
                    is_third_place_match: (match.bracket_type && match.bracket_type === 'placement') || false,
                    // 🆕 ДОБАВЛЕНО: Передаем tournament_match_number для локальной нумерации
                    tournament_match_number: match.tournament_match_number,
                    match_number: match.match_number,
                    // 🆕 ДОБАВЛЕНО: Передаем maps_data для отображения счета карт
                    maps_data: match.maps_data || [],
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
            })
            .filter(game => game !== null); // Удаляем null значения после map

        console.log('✅ Безопасные игры для BracketRenderer созданы:', safeGames.length);
        return safeGames;
    }, [matches, tournament]);

    // 🔧 ОБНОВЛЕННАЯ ФУНКЦИЯ СОХРАНЕНИЯ РЕЗУЛЬТАТА МАТЧА (API v2.0)
    const saveMatchResult = useCallback(async (resultData) => {
        if (!selectedMatch) {
            console.error('❌ Нет выбранного матча для сохранения результата');
            return;
        }

        const matchId = typeof selectedMatch === 'object' ? selectedMatch.id : selectedMatch;
        
        if (!matchId && matchId !== 0) {
            console.error('❌ Не удалось определить ID матча:', selectedMatch);
            return;
        }

        console.log('💾 Начинаем сохранение результата матча через API v2.0:', {
            matchId,
            resultData,
            tournamentId: id,
            selectedMatch: selectedMatch
        });

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Отсутствует токен авторизации');
            }

            // 🔧 УНИВЕРСАЛЬНОЕ ИСПРАВЛЕНИЕ: Определяем winner_team_id для команд И соло участников
            let winner_team_id = null;
            
            // Если уже есть winner_team_id в resultData, используем его
            if (resultData.winner_team_id) {
                winner_team_id = resultData.winner_team_id;
                console.log('✅ Используем переданный winner_team_id:', winner_team_id);
            } 
            // Если есть winner ('team1' или 'team2'), преобразуем его в ID
            else if (resultData.winner && selectedMatch) {
                const matchData = typeof selectedMatch === 'object' ? selectedMatch : 
                                  matches.find(m => m.id === parseInt(selectedMatch));
                
                if (matchData && matchData.team1_id && matchData.team2_id) {
                    if (resultData.winner === 'team1') {
                        winner_team_id = matchData.team1_id;
                    } else if (resultData.winner === 'team2') {
                        winner_team_id = matchData.team2_id;
                    }
                    
                    // 🆕 УНИВЕРСАЛЬНАЯ ЛОГИКА: Определяем тип турнира для логирования
                    const participantType = tournament?.participant_type || 'unknown';
                    const entityType = participantType === 'solo' ? 'участника' : 'команды';
                    
                    console.log('✅ Преобразован winner в winner_team_id для', entityType, ':', {
                        participant_type: participantType,
                        winner: resultData.winner,
                        team1_id: matchData.team1_id,
                        team2_id: matchData.team2_id,
                        winner_team_id: winner_team_id,
                        entity_type: entityType
                    });
            } else {
                    console.warn('⚠️ Не удалось найти team1_id/team2_id в данных матча:', matchData);
                }
            }

            // 🆕 ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ: Проверяем что winner_team_id существует среди участников
            if (winner_team_id && tournament) {
                let isValidWinner = false;
                
                if (tournament.participant_type === 'solo' && tournament.participants) {
                    // Для соло турниров проверяем среди участников
                    isValidWinner = tournament.participants.some(p => p.id === winner_team_id);
                } else if (tournament.participant_type === 'team' && tournament.teams) {
                    // Для командных турниров проверяем среди команд
                    isValidWinner = tournament.teams.some(t => t.id === winner_team_id);
                }
                
                if (!isValidWinner) {
                    console.warn('⚠️ winner_team_id не найден среди участников турнира:', {
                        winner_team_id,
                        participant_type: tournament.participant_type,
                        available_participants: tournament.participants?.length || 0,
                        available_teams: tournament.teams?.length || 0
                    });
                }
            }

            console.log('🎯 Итоговые данные для отправки (универсальные):', {
                score1: parseInt(resultData.score1) || 0,
                score2: parseInt(resultData.score2) || 0,
                maps_data: resultData.maps_data || [],
                winner_team_id: winner_team_id,
                participant_type: tournament?.participant_type,
                tournament_format: tournament?.format
            });

            // 🔧 ИСПРАВЛЕНО: Используем новый API endpoint согласно модульной архитектуре
            const response = await api.post(`/api/tournaments/${id}/matches/${matchId}/result`, {
                score1: parseInt(resultData.score1) || 0,
                score2: parseInt(resultData.score2) || 0,
                maps_data: resultData.maps_data || [],
                winner_team_id: winner_team_id  // ✅ Передаем winner_team_id вместо winner
            }, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Результат матча успешно сохранен через API v2.0:', response.data);

            // Очищаем кеш турнира
            const cacheKey = `tournament_cache_${id}`;
            const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimestampKey);

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
    }, [selectedMatch, id, fetchTournamentData, closeModal, matches, tournament]);

    // 🔧 ОБНОВЛЕННАЯ ФУНКЦИЯ СБРОСА РЕЗУЛЬТАТОВ (API v2.0)
    const resetMatchResults = useCallback(async () => {
        const confirmMessage = `⚠️ ВНИМАНИЕ!\n\n` +
            `Вы собираетесь очистить результаты всех матчей турнира.\n\n` +
            `Это действие:\n` +
            `• Очистит результаты всех матчей (счет, карты)\n` +
            `• Вернет команды к исходным позициям в сетке\n` +
            `• Изменит статус турнира на "Активный"\n` +
            `• Позволит заново провести турнир с той же сеткой\n` +
            `• НЕ МОЖЕТ БЫТЬ ОТМЕНЕНО\n\n` +
            `Продолжить?`;

        const confirmed = window.confirm(confirmMessage);
        if (!confirmed) return;

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Отсутствует токен авторизации');
            }

            console.log('🔄 Начинаем сброс результатов через API v2.0 для турнира', id);

            // 🔧 ИСПРАВЛЕНО: Используем новый API endpoint
            const response = await api.post(`/api/tournaments/${id}/clear-match-results`, {}, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Результаты матчей успешно сброшены через API v2.0:', response.data);

            // Очищаем кеш турнира
            const cacheKey = `tournament_cache_${id}`;
            const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimestampKey);

            // Обновляем данные турнира
            await fetchTournamentData();

            setMessage('✅ Результаты матчей успешно очищены! Турнир возвращен к начальному состоянию и готов к повторному проведению.');
            setTimeout(() => setMessage(''), 5000);

        } catch (error) {
            console.error('❌ Ошибка при сбросе результатов матчей:', error);
            
            let errorMessage = 'Ошибка при сбросе результатов матчей';
            
            if (error.response?.status === 403) {
                errorMessage = 'У вас нет прав для сброса результатов этого турнира';
            } else if (error.response?.status === 404) {
                errorMessage = 'Турнир не найден';
            } else if (error.response?.status === 400) {
                errorMessage = error.response.data?.error || 'Сброс результатов недоступен для этого турнира';
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
    }, [id, fetchTournamentData]);

    // 🆕 Функция переключения вкладок
    const switchTab = useCallback((tabName) => {
        setActiveTab(tabName);
        console.log('🔄 Переключение на вкладку:', tabName);
    }, []);

    // 🆕 Проверка, нужно ли показывать вкладку участников
    const shouldShowParticipantsTab = useMemo(() => {
        // Вкладка "Участники" должна отображаться всегда
        // Ограничения контента применяются внутри компонента TournamentParticipants
        return tournament ? true : false;
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
                            onParticipationUpdate={fetchTournamentData}
                            userTeams={teams}
                            matches={matches}
                        />

                        {/* 🏆 ПОДИУМ С ПРИЗЕРАМИ для завершенных турниров */}
                        {tournament?.status === 'completed' && games.length > 0 && (
                            <PodiumSection tournament={tournament} matches={matches} />
                        )}

                        {/* 🆕 ПРОГРЕСС-БАР ТУРНИРА */}
                        {tournament && (
                            <div className="bracket-stage-wrapper bracket-full-bleed">
                                <TournamentProgressBar 
                                    matches={matches}
                                    tournamentStatus={tournament?.status}
                                    tournament={tournament}
                                />
                            </div>
                        )}

                        {/* Турнирная сетка */}
                        {games.length > 0 && (
                            <div className="bracket-stage-wrapper bracket-full-bleed" style={{ overscrollBehavior: 'contain' }}>
                                <h3 className="bracket-section-title">🏆 Турнирная сетка</h3>
                                <TournamentErrorBoundary>
                                    <Suspense fallback={
                                        <div className="bracket-loading" data-testid="bracket-loading">
                                            🔄 Загрузка турнирной сетки...
                                        </div>
                                    }>
                                        <LazyBracketRenderer
                                            games={games}
                                            tournament={tournament}
                                            canEditMatches={false}
                                            readOnly
                                            selectedMatch={selectedMatch}
                                            setSelectedMatch={(match) => {
                                                if (match === null || match === undefined) {
                                                    setSelectedMatch(null);
            return;
        }
        
                                                const matchId = typeof match === 'object' && match !== null ? match.id : match;
                                                
                                                if (matchId) {
                                                    const fullMatch = matches.find(m => m.id === parseInt(matchId));
                                                    if (fullMatch && false) {
                                                        setSelectedMatch(fullMatch);
                                                        setMatchResultData({
                                                            score1: fullMatch.score1 || 0,
                                                            score2: fullMatch.score2 || 0,
                                                            maps_data: fullMatch.maps_data || []
                                                        });
                                                        openModal('matchResult');
                                                    } else {
                                                        setSelectedMatch(matchId);
                                                    }
                                                } else {
                                                    setSelectedMatch(null);
                                                }
                                            }}
                                            handleTeamClick={() => {}}
                                            format={tournament.format}
                                            isAdminOrCreator={isAdminOrCreator}
                                            onMatchClick={(match) => {
                                                if (match && match.id) {
                                                    // Для завершенных турниров — всегда открываем страницу матча вместо модалки
                                                    if (tournament?.status === 'completed') {
                                                        window.location.href = `/tournaments/${tournament.id}/match/${match.id}`;
                                                        return;
                                                    }
                                                    const originalMatch = matches.find(m => m.id === parseInt(match.id));
                                                    if (originalMatch) {
                                                        const enrichedMatch = enrichMatchWithParticipantNames(originalMatch, tournament);
                                                        setSelectedMatchForDetails(enrichedMatch);
                                                        openModal('matchDetails');
                                                    }
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
                        <TournamentParticipants
                            tournament={tournament}
                            user={user}
                            isAdminOrCreator={isAdminOrCreator}
                            originalParticipants={originalParticipants}
                            onTeamsGenerated={handleTeamsGenerated}
                            onTournamentUpdate={async (updateInfo) => {
                                // Обработка разных типов обновлений
                                if (updateInfo?.action === 'remove_participant') {
                                    // Мгновенное удаление участника из состояния
                                    const participantId = updateInfo.participantId;
                                    
                                    console.log('🚀 Обновляем состояние турнира после удаления участника:', participantId);
                                    
                                    // Обновляем tournament.participants
                                    setTournament(prev => ({
                                        ...prev,
                                        participants: prev.participants?.filter(p => p.id !== participantId) || []
                                    }));
                                    
                                    // Обновляем originalParticipants
                                    setOriginalParticipants(prev => prev.filter(p => p.id !== participantId));
                                    
                                    // Очищаем кеш для следующих запросов
                                    const cacheKey = `tournament_cache_${id}`;
                                    const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
                                    localStorage.removeItem(cacheKey);
                                    localStorage.removeItem(cacheTimestampKey);
                                    
                                    // Обновляем данные с сервера в фоне
                                    setTimeout(() => {
                                        fetchTournamentData();
                                    }, 1000);
                                } else {
                                    // Обычное обновление данных
                                    await fetchTournamentData();
                                }
                            }}
                        />
                    </div>
                );

            case 'bracket':
                return (
                    <div className="tab-content-bracket">
                        {/* Новая система управления сеткой */}
                        <BracketManagementPanel
                            tournament={tournament}
                            user={user}
                            matches={matches}
                            isAdminOrCreator={isAdminOrCreator}
                            onBracketUpdate={async (updateData) => {
                                console.log('🔄 Обновление сетки:', updateData);
                                
                                // Очищаем кеш турнира
                                const cacheKey = `tournament_cache_${id}`;
                                const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
                                localStorage.removeItem(cacheKey);
                                localStorage.removeItem(cacheTimestampKey);
                                
                                // Обновляем данные турнира
                                await fetchTournamentData();
                                
                                // Показываем сообщение об успехе
                                if (updateData.type === 'generated') {
                                    setMessage('✅ Турнирная сетка успешно сгенерирована!');
                                } else if (updateData.type === 'regenerated') {
                                    setMessage('✅ Турнирная сетка успешно регенерирована!');
                                }
                                
                                setTimeout(() => setMessage(''), 5000);
                            }}
                        />

                        <div className="bracket-stage-wrapper bracket-full-bleed" style={{ overscrollBehavior: 'contain' }}>
                            {/* 🆕 ПРОГРЕСС-БАР ТУРНИРА НА ВКЛАДКЕ СЕТКА */}
                            {tournament && (
                                <TournamentProgressBar 
                                    matches={matches}
                                    tournamentStatus={tournament?.status}
                                    tournament={tournament}
                                />
                            )}

                            {games.length > 0 ? (
                                <TournamentErrorBoundary>
                                    <Suspense fallback={
                                        <div className="bracket-loading" data-testid="bracket-loading">
                                            🔄 Загрузка турнирной сетки...
                                        </div>
                                    }>
                                        <LazyBracketRenderer
                                            games={games}
                                            tournament={tournament}
                                            canEditMatches={false}
                                            selectedMatch={selectedMatch}
                                            setSelectedMatch={(match) => {
                                                if (match === null || match === undefined) {
                                                    setSelectedMatch(null);
                                                    return;
                                                }
                                                
                                                const matchId = typeof match === 'object' && match !== null ? match.id : match;
                                                
                                                if (matchId) {
                                                    const fullMatch = matches.find(m => m.id === parseInt(matchId));
                                                    if (fullMatch && false) {
                                                        setSelectedMatch(fullMatch);
                                                        setMatchResultData({
                                                            score1: fullMatch.score1 || 0,
                                                            score2: fullMatch.score2 || 0,
                                                            maps_data: fullMatch.maps_data || []
                                                        });
                                                        openModal('matchResult');
                                                    } else {
                                                        setSelectedMatch(matchId);
                                                    }
                                                } else {
                                                    setSelectedMatch(null);
                                                }
                                            }}
                                            handleTeamClick={() => {}}
                                            format={tournament.format}
                                            isAdminOrCreator={isAdminOrCreator}
                                            onMatchClick={(match) => {
                                                if (match && match.id) {
                                                    const originalMatch = matches.find(m => m.id === parseInt(match.id));
                                                    if (originalMatch) {
                                                        // 🔧 ИСПРАВЛЕНИЕ: Используем утилиту для обогащения данных матча
                                                        const enrichedMatch = enrichMatchWithParticipantNames(originalMatch, tournament);
                                                        setSelectedMatchForDetails(enrichedMatch);
                                                        openModal('matchDetails');
                                                    }
                                                }
                                            }}
                                            readOnly
                                        />
                                    </Suspense>
                                </TournamentErrorBoundary>
                            ) : (
                                <div className="no-bracket">
                                    <p>Турнирная сетка еще не создана</p>
                                    <small>Используйте панель управления выше для создания турнирной сетки</small>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'results':
                return (
                    <div className="tab-content-results">
                        <TournamentResults 
                            tournament={tournament}
                        />
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
                                onStartTournament={handleStartTournament}
                                onEndTournament={handleEndTournament}
                                onRegenerateBracket={handleGenerateBracket}
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
                                onGenerateBracket={handleGenerateBracket}
                                onClearResults={resetMatchResults}
                                onInviteAdmin={inviteAdmin}
                                onRemoveAdmin={removeAdmin}
                                onShowAdminSearchModal={openAdminSearchModal}
                                onUpdateTournamentSetting={handleUpdateTournamentSetting}
                                onDeleteTournament={openDeleteTournamentModal}
                                onCreateMatchLobby={handleCreateMatchLobby}
                                user={user}
                            />
                        ) : (
                            <div className="access-denied">
                                <p>У вас нет прав для управления этим турниром</p>
                            </div>
                        )}
            </div>
        );

            default:
                return (
                    <div className="tab-content-info">
                        <TournamentInfoSection 
                            tournament={tournament}
                            user={user}
                            isCreator={isCreator}
                            isAdminOrCreator={isAdminOrCreator}
                            onParticipationUpdate={fetchTournamentData}
                            userTeams={teams}
                            matches={matches}
                        />
                    </div>
                );
        }
    };

    // Загрузка данных пользователя
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            console.log('🔄 Загружаем данные пользователя и команды...');
            api.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
                .then((userResponse) => {
                    console.log('✅ Пользователь загружен:', userResponse.data.username);
                    setUser(userResponse.data);
                    
                    // Загружаем команды пользователя
                    return api.get('/api/teams/my-teams', { 
                        headers: { Authorization: `Bearer ${token}` } 
                    });
                })
                .then((res) => {
                    console.log('✅ Команды загружены:', res.data.length);
                    setTeams(Array.isArray(res.data) ? res.data : []);
                })
                .catch((error) => {
                    console.error('❌ Ошибка загрузки пользователя или команд:', error);
                    if (error.response?.status === 403) {
                        console.log('🔐 Ошибка аутентификации, очищаем токен');
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        setError('Сессия истекла. Пожалуйста, войдите в систему заново.');
                        setTimeout(() => navigate('/'), 1000);
                    }
                });
        } else {
            setUser(null);
            setTeams([]);
        }
    }, []); // Убираем handleAuthError из зависимостей чтобы избежать дублирования

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

    // 🆕 Root‑фон для CS2 (body.classList + inline backgroundImage с 70% непрозрачностью)
    useEffect(() => {
        const isCS2 = tournament?.game && /counter\s*strike\s*2|cs2/i.test(tournament.game);
        if (isCS2) {
            document.body.classList.add('cs2-root-bg');
            document.body.style.backgroundImage = "linear-gradient(rgba(0, 0, 0, 0.3), rgba(0,0,0,0.3)), url('/images/headers/CS2-header.png')";
        } else {
            document.body.classList.remove('cs2-root-bg');
            document.body.style.backgroundImage = '';
        }
        return () => {
            document.body.classList.remove('cs2-root-bg');
            document.body.style.backgroundImage = '';
        };
    }, [tournament?.game]);

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

        // 🆕 Используем готовый socketClient_v5_simplified
        const socket = getSocketInstance();
        
        // Авторизуем socket с токеном
        authenticateSocket(token);

        socket.on('connect', () => {
            console.log('✅ Socket.IO соединение установлено через socketClient_v5_simplified');
            watchTournament(id);
            socket.emit('join_tournament_chat', id);
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Socket.IO соединение закрыто:', reason);
        });

        socket.on('error', (error) => {
            console.error('❌ Ошибка Socket.IO соединения:', error);
        });

        // 🆕 СПЕЦИАЛЬНЫЙ ОБРАБОТЧИК ДЛЯ УЧАСТНИКОВ
        socket.on('participant_update', (updateData) => {
            console.log('👥 [WebSocket] Получено событие participant_update:', updateData);
            console.log('👥 [WebSocket] Текущий ID турнира:', parseInt(id));
            console.log('👥 [WebSocket] ID турнира в событии:', updateData.tournamentId);
            
            if (updateData.tournamentId === parseInt(id)) {
                const { action, participant } = updateData;
                
                console.log('✅ [WebSocket] Событие для текущего турнира, действие:', action);
                console.log('✅ [WebSocket] Данные участника:', participant);
                
                if (action === 'added') {
                    console.log('➕ [WebSocket] Добавляем участника в состояние');
                    
                    // Добавляем участника в состояние
                    setTournament(prev => {
                        if (!prev) return prev;
                        
                        // Проверяем, не добавлен ли уже этот участник
                        const existingParticipant = prev.participants?.find(p => p.id === participant.id);
                        if (existingParticipant) {
                            console.log('⚠️ [WebSocket] Участник уже существует в состоянии');
                            return prev;
                        }
                        
                        const newParticipants = [...(prev.participants || []), participant];
                        console.log('✅ [WebSocket] Обновляем tournament.participants:', newParticipants.length);
                        
                        return {
                            ...prev,
                            participants: newParticipants
                        };
                    });
                    
                    setOriginalParticipants(prev => {
                        // Проверяем, не добавлен ли уже этот участник
                        const existingParticipant = prev.find(p => p.id === participant.id);
                        if (existingParticipant) {
                            console.log('⚠️ [WebSocket] Участник уже существует в originalParticipants');
                            return prev;
                        }
                        
                        const newOriginalParticipants = [...prev, participant];
                        console.log('✅ [WebSocket] Обновляем originalParticipants:', newOriginalParticipants.length);
                        
                        return newOriginalParticipants;
                    });
                    
                    console.log('✅ [WebSocket] Участник добавлен через WebSocket:', participant.name);
                    
                } else if (action === 'removed') {
                    console.log('➖ [WebSocket] Удаляем участника из состояния');
                    
                    // Удаляем участника из состояния
                    setTournament(prev => {
                        if (!prev) return prev;
                        
                        const newParticipants = prev.participants?.filter(p => p.id !== participant.id) || [];
                        console.log('✅ [WebSocket] Обновляем tournament.participants после удаления:', newParticipants.length);
                        
                        return {
                            ...prev,
                            participants: newParticipants
                        };
                    });
                    
                    setOriginalParticipants(prev => {
                        const newOriginalParticipants = prev.filter(p => p.id !== participant.id);
                        console.log('✅ [WebSocket] Обновляем originalParticipants после удаления:', newOriginalParticipants.length);
                        
                        return newOriginalParticipants;
                    });
                    
                    console.log('✅ [WebSocket] Участник удален через WebSocket:', participant.name);
                    
                } else if (action === 'updated') {
                    console.log('🔄 [WebSocket] Обновляем данные участника');
                    
                    // Обновляем данные участника
                    setTournament(prev => {
                        if (!prev) return prev;
                        
                        const newParticipants = prev.participants?.map(p => 
                            p.id === participant.id ? { ...p, ...participant } : p
                        ) || [];
                        console.log('✅ [WebSocket] Обновляем tournament.participants:', newParticipants.length);
                        
                        return {
                            ...prev,
                            participants: newParticipants
                        };
                    });
                    
                    setOriginalParticipants(prev => {
                        const newOriginalParticipants = prev.map(p => 
                            p.id === participant.id ? { ...p, ...participant } : p
                        );
                        console.log('✅ [WebSocket] Обновляем originalParticipants:', newOriginalParticipants.length);
                        
                        return newOriginalParticipants;
                    });
                    
                    console.log('✅ [WebSocket] Участник обновлен через WebSocket:', participant.name);
                }
                
                // Очищаем кеш для корректности следующих запросов
                const cacheKey = `tournament_cache_${id}`;
                const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
                
                console.log('🧹 [WebSocket] Кеш очищен для следующих запросов');
            } else {
                console.log('❌ [WebSocket] Событие для другого турнира, игнорируем');
            }
        });

        socket.on('tournament_update', (tournamentData) => {
            if (tournamentData.tournamentId === parseInt(id) || tournamentData.id === parseInt(id)) {
                console.log('📡 [Hybrid] Получено обновление турнира через WebSocket:', tournamentData);
                
                // Обновляем состояние WebSocket
                setHybridState(prev => ({
                    ...prev,
                    isWebSocketConnected: true,
                    lastWebSocketEvent: Date.now(),
                    fallbackActive: false
                }));

                // 🆕 ОБРАБОТКА МЕТАДАННЫХ СОБЫТИЯ
                const metadata = tournamentData._metadata;
                if (metadata) {
                    console.log('📊 [Hybrid] Метаданные события:', {
                        eventId: metadata.eventId,
                        source: metadata.source,
                        updateType: metadata.updateType,
                        timestamp: metadata.timestamp
                    });
                }

                // 🆕 СПЕЦИАЛИЗИРОВАННАЯ ОБРАБОТКА ПО ТИПУ ОБНОВЛЕНИЯ
                const updateType = metadata?.updateType || HYBRID_CONFIG.UPDATE_TYPES.GENERAL;
                
                switch (updateType) {
                    case HYBRID_CONFIG.UPDATE_TYPES.STATUS_CHANGE:
                        console.log('⚡ [Hybrid] МГНОВЕННОЕ обновление статуса турнира:', {
                            oldStatus: tournament?.status,
                            newStatus: tournamentData.status,
                            source: metadata?.source
                        });
                        
                        // Мгновенно обновляем статус
                        setTournament(prev => ({
                            ...prev,
                            status: tournamentData.status
                        }));
                        
                        // Очищаем кеш для следующих запросов
                        clearAdaptiveCache('status_change');
                        
                        // В фоне синхронизируем полные данные через небольшую задержку
                        setTimeout(() => {
                            fetchTournamentData(true, 'status_sync');
                        }, 1000);
                        
                        return; // Не делаем полную перезагрузку сразу

                    case HYBRID_CONFIG.UPDATE_TYPES.PARTICIPANTS:
                        console.log('👥 [Hybrid] Обновление участников');
                        // Участники уже обработаны выше в participant_update
                        return;

                    case HYBRID_CONFIG.UPDATE_TYPES.MATCHES:
                        console.log('⚔️ [Hybrid] Обновление матчей');
                        if (tournamentData.matches) {
                            setMatches(tournamentData.matches);
                            clearAdaptiveCache('matches_update');
                        }
                        break;

                    case HYBRID_CONFIG.UPDATE_TYPES.TEAMS:
                        console.log('🏆 [Hybrid] Обновление команд');
                        if (tournamentData.teams || tournamentData.mixed_teams) {
                            setTournament(prev => ({
                                ...prev,
                                teams: tournamentData.teams || tournamentData.mixed_teams,
                                mixed_teams: tournamentData.mixed_teams || tournamentData.teams
                            }));
                            clearAdaptiveCache('teams_update');
                        }
                        break;

                    case HYBRID_CONFIG.UPDATE_TYPES.GENERAL:
                    default:
                        console.log('🔄 [Hybrid] Общее обновление турнира');
                        break;
                }
                
                // 🆕 ПРОВЕРЯЕМ ТИП ОБНОВЛЕНИЯ УЧАСТНИКОВ (обратная совместимость)
                if (tournamentData.lastUpdate?.type === 'participant_update') {
                    console.log('🔄 [Hybrid] Обновление участников уже обработано, пропускаем полную перезагрузку');
                    return;
                }
                
                // Для остальных типов обновлений делаем полную перезагрузку с задержкой
                setTimeout(() => {
                    fetchTournamentData(true, 'websocket_general');
                }, HYBRID_CONFIG.FALLBACK_DELAY);
            }
        });

        wsRef.current = socket;

        return () => {
            console.log('🔌 Отписываемся от турнира при размонтировании');
            unwatchTournament(id);
            // Примечание: socket.disconnect() не нужен для singleton, он остается для других компонентов
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
            tournament.admins.some(admin => admin?.user_id === user.id) : false;
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
                // 🔧 ОБНОВЛЕННОЕ СООБЩЕНИЕ: учитываем повторные приглашения
                let message = `✅ ${userName} приглашен в администраторы турнира`;
                
                if (result.isResend && result.cancelledInvitations > 0) {
                    message = `🔄 Предыдущее приглашение отменено. ${userName} получил новое приглашение в администраторы турнира`;
                }
                
                setMessage(message);
                setAdminSearchModal(false);
                setAdminSearchQuery('');
                setAdminSearchResults([]);
                
                // Обновляем данные турнира
                await fetchTournamentData();
            } else {
                // 🔧 УПРОЩЕННАЯ ОБРАБОТКА ОШИБОК (убираем сложную логику для повторных приглашений)
                let errorMessage = result.message || 'Ошибка при приглашении администратора';
                setMessage(`❌ ${errorMessage}`);
            }
        } catch (error) {
            console.error('❌ Ошибка приглашения администратора:', error);
            setMessage(`❌ Ошибка при приглашении ${userName}: ${error.message || 'Неизвестная ошибка'}`);
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

    // Определение прав доступа
    const canEditMatches = useMemo(() => {
        // Разрешаем редактирование только если:
        // 1. Пользователь авторизован И (является создателем ИЛИ админом)
        // 2. Турнир находится в статусе "in_progress" (Идет)
        return user && (isCreator || adminRequestStatus === 'accepted') && tournament?.status === 'in_progress';
    }, [user, isCreator, adminRequestStatus, tournament?.status]);

    // 🔧 ГИБРИДНАЯ ФУНКЦИЯ ЗАПУСКА ТУРНИРА
    const handleStartTournament = useCallback(async () => {
        // 🆕 РЕГИСТРИРУЕМ КРИТИЧЕСКУЮ ОПЕРАЦИЮ
        const operationId = 'startTournament';
        
        try {
            setLoading(true);
            
            setHybridState(prev => ({
                ...prev,
                pendingOperations: new Set(prev.pendingOperations).add(operationId),
                cacheStrategy: 'critical'
            }));
            
            // 🆕 ПРИНУДИТЕЛЬНАЯ ОЧИСТКА КЕША ПЕРЕД КРИТИЧЕСКОЙ ОПЕРАЦИЕЙ
            clearAdaptiveCache('start_tournament_pre');
            console.log('🧹 [Hybrid] Кеш принудительно очищен перед запуском турнира');
            
            // 🆕 ТАЙМЕР ОЖИДАНИЯ WEBSOCKET ОБНОВЛЕНИЯ
            let websocketReceived = false;
            const websocketTimeout = setTimeout(() => {
                if (!websocketReceived) {
                    console.warn('⚠️ [Hybrid] WebSocket обновление не получено, используем fallback');
                    setHybridState(prev => ({ ...prev, fallbackActive: true }));
                    fetchTournamentData(true, 'start_fallback');
                }
            }, HYBRID_CONFIG.WEBSOCKET_TIMEOUT);
            
            // 🆕 ПОДПИСЫВАЕМСЯ НА WEBSOCKET ОБНОВЛЕНИЯ СТАТУСА
            const handleStatusUpdate = (data) => {
                if (data._metadata?.updateType === HYBRID_CONFIG.UPDATE_TYPES.STATUS_CHANGE && 
                    data._metadata?.source === 'startTournament') {
                    websocketReceived = true;
                    clearTimeout(websocketTimeout);
                    console.log('✅ [Hybrid] WebSocket обновление статуса получено');
                }
            };
            
            const result = await tournamentManagement.startTournament();
            
            if (result.success) {
                setMessage('✅ Турнир успешно запущен!');
                
                // 🆕 ОЖИДАЕМ WEBSOCKET ОБНОВЛЕНИЕ ИЛИ ИСПОЛЬЗУЕМ FALLBACK
                if (!websocketReceived) {
                    setTimeout(() => {
                        if (!websocketReceived) {
                            console.log('🔄 [Hybrid] Fallback: загружаем данные через API');
                            clearAdaptiveCache('start_tournament_fallback');
                            fetchTournamentData(true, 'start_tournament_success');
                        }
                    }, HYBRID_CONFIG.FALLBACK_DELAY);
                }
                
            } else {
                clearTimeout(websocketTimeout);
                setMessage(`❌ ${result.error || 'Ошибка при запуске турнира'}`);
                
                // Очищаем кеш при ошибке
                clearAdaptiveCache('start_tournament_error');
            }
        } catch (error) {
            console.error('❌ [Hybrid] Ошибка при запуске турнира:', error);
            setMessage('❌ Ошибка при запуске турнира');
            
            // Очищаем кеш при ошибке и принудительно обновляем
            clearAdaptiveCache('start_tournament_exception');
            setTimeout(() => {
                fetchTournamentData(true, 'start_tournament_error_recovery');
            }, 1000);
            
        } finally {
            setLoading(false);
            
            // Удаляем операцию из состояния
            setHybridState(prev => {
                const newPending = new Set(prev.pendingOperations);
                newPending.delete(operationId);
                return { 
                    ...prev, 
                    pendingOperations: newPending,
                    cacheStrategy: newPending.size > 0 ? 'updating' : 'normal'
                };
            });
            
            setTimeout(() => setMessage(''), 5000);
        }
    }, [tournamentManagement, clearAdaptiveCache, fetchTournamentData]);

    // 🆕 ОБРАБОТЧИК ОБНОВЛЕНИЯ НАСТРОЕК ТУРНИРА
    const handleUpdateTournamentSetting = useCallback(async (field, value) => {
        console.log(`🔧 [handleUpdateTournamentSetting] Обновление настройки: ${field} = ${value}`);
        
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Пользователь не авторизован');
        }

        let endpoint;
        let payload;

        // Определяем endpoint и payload в зависимости от поля
        switch (field) {
            case 'game':
                endpoint = `/api/tournaments/${id}/game`;
                payload = { game: value };
                break;
            case 'format':
                endpoint = `/api/tournaments/${id}/format`;
                payload = { format: value };
                break;
            case 'bracket_type':
                endpoint = `/api/tournaments/${id}/bracket-type`;
                payload = { bracket_type: value };
                break;
            case 'mix_rating_type':
                endpoint = `/api/tournaments/${id}/rating-type`;
                payload = { mix_rating_type: value };
                break;
            case 'team_size':
                endpoint = `/api/tournaments/${id}/team-size`;
                payload = { team_size: value };
                break;
            case 'start_date':
                endpoint = `/api/tournaments/${id}/start-date`;
                payload = { start_date: value };
                break;
            case 'lobby_enabled':
                endpoint = `/api/tournaments/${id}/lobby-enabled`;
                payload = { lobby_enabled: value };
                break;
            case 'mix_link_requirements':
                endpoint = `/api/tournaments/${id}/mix-link-requirements`;
                payload = { 
                    require_faceit_linked: !!value.require_faceit_linked,
                    require_steam_linked: !!value.require_steam_linked
                };
                break;
            default:
                throw new Error(`Неизвестное поле настройки: ${field}`);
        }

        try {
            const response = await api.put(endpoint, payload, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`✅ [handleUpdateTournamentSetting] Настройка ${field} успешно обновлена:`, response.data);

            // Очищаем кеш турнира
            const cacheKey = `tournament_cache_${id}`;
            const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimestampKey);

            // Обновляем данные турнира
            await fetchTournamentData();

            // Показываем уведомление
            setMessage(`✅ ${response.data.message || 'Настройка успешно обновлена'}`);
            setTimeout(() => setMessage(''), 5000);

        } catch (error) {
            console.error(`❌ [handleUpdateTournamentSetting] Ошибка обновления настройки ${field}:`, error);
            const errorMessage = error.response?.data?.message || error.message || 'Неизвестная ошибка';
            throw new Error(errorMessage);
        }
    }, [id, fetchTournamentData]);

    // 🔧 УПРОЩЕННАЯ ФУНКЦИЯ ЗАВЕРШЕНИЯ ТУРНИРА (ЧЕРЕЗ ХУК)
    const handleEndTournament = useCallback(async () => {
        const confirmMessage = `🏁 Вы собираетесь завершить турнир.\n\nПосле завершения:\n• Нельзя будет изменить результаты\n• Будут подведены итоги\n• Действие необратимо\n\nПродолжить?`;
        
        if (!window.confirm(confirmMessage)) return;

        try {
            setLoading(true);
            const result = await tournamentManagement.endTournament();
            
            if (result.success) {
                setMessage('✅ Турнир успешно завершен!');
                await fetchTournamentData();
            } else {
                setMessage(`❌ ${result.error || 'Ошибка при завершении турнира'}`);
            }
        } catch (error) {
            console.error('❌ Ошибка при завершении турнира:', error);
            setMessage('❌ Ошибка при завершении турнира');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 5000);
        }
    }, [tournamentManagement, fetchTournamentData]);

    // 🗑️ ФУНКЦИЯ УДАЛЕНИЯ ТУРНИРА
    const handleDeleteTournament = useCallback(async () => {
        if (!tournament?.id) {
            setMessage('❌ Не удалось определить ID турнира');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        try {
            setIsDeletingTournament(true);
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Отсутствует токен авторизации');
            }

            console.log('🗑️ Начинаем удаление турнира:', tournament.id);

            const response = await api.delete(`/api/tournaments/${tournament.id}`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Турнир успешно удален:', response.data);

            // Очищаем кеш турнира
            const cacheKey = `tournament_cache_${tournament.id}`;
            const cacheTimestampKey = `tournament_cache_timestamp_${tournament.id}`;
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimestampKey);

            // Закрываем модальное окно
            setDeleteTournamentModal(false);

            // Показываем сообщение об успехе
            setMessage('✅ Турнир успешно удален!');
            
            // Перенаправляем на главную страницу через 2 секунды
            setTimeout(() => {
                navigate('/');
            }, 2000);

        } catch (error) {
            console.error('❌ Ошибка при удалении турнира:', error);
            
            let errorMessage = 'Ошибка при удалении турнира';
            
            if (error.response?.status === 403) {
                errorMessage = 'У вас нет прав для удаления этого турнира';
            } else if (error.response?.status === 404) {
                errorMessage = 'Турнир не найден';
            } else if (error.response?.status === 400) {
                errorMessage = error.response.data?.error || 'Турнир нельзя удалить в текущем состоянии';
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }

            setMessage(`❌ ${errorMessage}`);
            setTimeout(() => setMessage(''), 5000);
        } finally {
            setIsDeletingTournament(false);
        }
    }, [tournament, navigate]);

    // 🔧 ФУНКЦИЯ ОТКРЫТИЯ МОДАЛЬНОГО ОКНА УДАЛЕНИЯ ТУРНИРА
    const openDeleteTournamentModal = useCallback(() => {
        setDeleteTournamentModal(true);
        console.log('🗑️ Открыто модальное окно удаления турнира');
    }, []);

    // 🔧 ФУНКЦИЯ ЗАКРЫТИЯ МОДАЛЬНОГО ОКНА УДАЛЕНИЯ ТУРНИРА
    const closeDeleteTournamentModal = useCallback(() => {
        if (isDeletingTournament) {
            console.log('⚠️ Попытка закрыть модальное окно во время удаления - игнорируем');
            return;
        }
        setDeleteTournamentModal(false);
        console.log('🗑️ Закрыто модальное окно удаления турнира');
    }, [isDeletingTournament]);

    // 🏆 УПРОЩЕННАЯ ФУНКЦИЯ ГЕНЕРАЦИИ СЕТКИ (API v2.0)
    const handleGenerateBracket = useCallback(async (useThirdPlace = null) => {
        // Для Double Elimination матч за 3-е место включен по умолчанию
        if (tournament?.bracket_type === 'double_elimination') {
            console.log('🎯 Double Elimination: автоматически включаем матч за 3-е место');
            useThirdPlace = true;
        }
        
        // Если параметр матча за 3-е место не передан, показываем модальное окно
        if (useThirdPlace === null) {
            console.log('🎯 Открываем модальное окно выбора матча за 3-е место для ГЕНЕРАЦИИ');
            setIsRegenerationMode(false);
            setShowThirdPlaceModal(true);
            return;
        }

        if (loading) {
            console.log('⚠️ Операция уже выполняется, игнорируем клик');
            return;
        }

        console.log(`🚀 Генерируем сетку через API v2.0 с параметром thirdPlaceMatch: ${useThirdPlace}`);

        try {
            setLoading(true);
            
            const token = localStorage.getItem('token');
            const response = await api.post(`/api/tournaments/${id}/generate-bracket`, {
                thirdPlaceMatch: useThirdPlace
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.success) {
                const matchText = useThirdPlace ? 'с матчем за 3-е место' : 'без матча за 3-е место';
                setMessage(`✅ Турнирная сетка успешно сгенерирована ${matchText}!`);
                
                // Очищаем кеш турнира
                const cacheKey = `tournament_cache_${id}`;
                const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
                
                // Обновляем данные
                await fetchTournamentData();
                
                // Очищаем сообщение через несколько секунд
                setTimeout(() => {
                    setMessage(null);
                }, 3000);
                
            } else {
                setError(`❌ Ошибка генерации сетки: ${response.data.error}`);
            }
            
        } catch (error) {
            console.error('❌ Ошибка генерации сетки:', error);
            setError(`❌ Ошибка генерации сетки: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    }, [id, loading, tournament?.bracket_type, setMessage, setError, fetchTournamentData]);

    // �� УПРОЩЕННАЯ ФУНКЦИЯ РЕГЕНЕРАЦИИ СЕТКИ (API v2.0)
    const handleRegenerateBracket = useCallback(async (useThirdPlace = null) => {
        // Для Double Elimination матч за 3-е место включен по умолчанию
        if (tournament?.bracket_type === 'double_elimination') {
            console.log('🎯 Double Elimination: автоматически включаем матч за 3-е место');
            useThirdPlace = true;
        }
        
        // Если параметр матча за 3-е место не передан, показываем модальное окно
        if (useThirdPlace === null) {
            console.log('🎯 Открываем модальное окно выбора матча за 3-е место для РЕГЕНЕРАЦИИ');
            setIsRegenerationMode(true);
            setShowThirdPlaceModal(true);
            return;
        }

        if (loading) {
            console.log('⚠️ Операция уже выполняется, игнорируем клик');
            return;
        }

        console.log(`🚀 Регенерируем сетку через API v2.0 с параметром thirdPlaceMatch: ${useThirdPlace}`);
        
        const shuffleText = '\n• Участники будут случайно перемешаны для сбалансированной сетки';
        const thirdPlaceText = useThirdPlace ? '\n• Будет добавлен матч за 3-е место' : '\n• Матч за 3-е место не будет создан';
        
        const confirmMessage = `🔄 Вы собираетесь перегенерировать турнирную сетку.\n\nВНИМАНИЕ:\n• Все результаты матчей будут удалены\n• Сетка будет создана заново${shuffleText}${thirdPlaceText}\n• Действие необратимо\n\nПродолжить?`;

        if (!window.confirm(confirmMessage)) {
            return;
        }

        try {
            setLoading(true);
            
            const token = localStorage.getItem('token');
            const response = await api.post(`/api/tournaments/${id}/regenerate-bracket`, {
                shuffle: true,
                thirdPlaceMatch: Boolean(useThirdPlace)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.success) {
                const matchText = useThirdPlace ? 'с матчем за 3-е место' : 'без матча за 3-е место';
                setMessage(`✅ Турнирная сетка успешно перегенерирована ${matchText}!`);
                
                // Очищаем кеш турнира
                const cacheKey = `tournament_cache_${id}`;
                const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
                
                // Обновляем данные
                await fetchTournamentData();
                
                // Очищаем сообщение через несколько секунд
                setTimeout(() => {
                    setMessage(null);
                }, 3000);
                
            } else {
                setError(`❌ Ошибка регенерации сетки: ${response.data.error}`);
            }
            
        } catch (error) {
            console.error('❌ Ошибка регенерации сетки:', error);
            setError(`❌ Ошибка регенерации сетки: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    }, [id, loading, tournament?.bracket_type, setMessage, setError, fetchTournamentData]);

    // 🚨 УПРОЩЕННАЯ ФУНКЦИЯ ЭКСТРЕННОЙ ОСТАНОВКИ (API v2.0)
    const handleKillGeneration = useCallback(async () => {
        if (user?.role !== 'admin') {
            setMessage('❌ Только администраторы могут выполнять экстренную остановку процессов');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        const confirmMessage = `🚨 ЭКСТРЕННАЯ ОСТАНОВКА ПРОЦЕССОВ\n\nВНИМАНИЕ:\n• Будут остановлены все зависшие процессы генерации\n• Незавершенные операции будут прерваны\n• Статус турнира будет восстановлен\n\nЭто действие следует использовать только при зависании системы!\n\nПродолжить?`;
        
        if (!window.confirm(confirmMessage)) return;

        try {
            setLoading(true);
            setMessage('🚨 Останавливаем зависшие процессы...');
            
            const token = localStorage.getItem('token');
            const response = await api.post(`/api/tournaments/${id}/kill-generation`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.success) {
                setMessage(`✅ ${response.data.message}`);
                console.log('🚨 Процессы остановлены:', response.data);
                
                // Очищаем кеш турнира
                const cacheKey = `tournament_cache_${id}`;
                const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
                
                await fetchTournamentData();
            } else {
                setMessage(`❌ ${response.data.error || 'Ошибка при остановке процессов'}`);
            }
        } catch (error) {
            console.error('❌ Ошибка при остановке процессов:', error);
            let errorMessage = 'Ошибка при остановке процессов';
            
            if (error.response?.data?.details) {
                errorMessage = error.response.data.details;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setMessage(`❌ ${errorMessage}`);
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 8000);
        }
    }, [id, user?.role, fetchTournamentData]);

    // 🔒 Обновление cooldown счетчика - УБРАНО, так как таймауты больше не используются
    // useEffect(() => {
    //     let interval;
    //     if (regenerationCooldown > 0) {
    //         interval = setInterval(() => {
    //             setRegenerationCooldown(prev => Math.max(0, prev - 100));
    //         }, 100);
    //     }
    //     return () => clearInterval(interval);
    // }, [regenerationCooldown]);

    // 🆕 ОБРАБОТЧИКИ ДЛЯ МОДАЛЬНОГО ОКНА МАТЧА ЗА 3-Е МЕСТО (ИСПРАВЛЕНО)
    const handleThirdPlaceModalConfirm = useCallback((needThirdPlace) => {
        const mode = isRegenerationMode ? 'РЕГЕНЕРАЦИИ' : 'ГЕНЕРАЦИИ';
        console.log(`🎯 Пользователь выбрал: ${needThirdPlace ? 'нужен' : 'не нужен'} матч за 3-е место для ${mode}`);
        setThirdPlaceMatch(needThirdPlace);
        setShowThirdPlaceModal(false);
        
        // 🔧 ИСПРАВЛЕНО: Используем унифицированные функции
        if (isRegenerationMode) {
            handleRegenerateBracket(needThirdPlace);
        } else {
        handleGenerateBracket(needThirdPlace);
        }
        
        // Сбрасываем режим
        setIsRegenerationMode(false);
    }, [handleGenerateBracket, handleRegenerateBracket, isRegenerationMode]);

    const handleThirdPlaceModalClose = useCallback(() => {
        const mode = isRegenerationMode ? 'регенерацию' : 'генерацию';
        console.log(`❌ Пользователь отменил ${mode} сетки`);
        setShowThirdPlaceModal(false);
        setIsRegenerationMode(false); // Сбрасываем режим
    }, [isRegenerationMode]);

    // 🎮 Создание лобби матча
    const handleCreateMatchLobby = useCallback(async (matchId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Отсутствует токен авторизации');
            }
            
            console.log('🎮 Создаем лобби для матча:', matchId);
            
            const response = await api.post(
                `/api/tournaments/${id}/matches/${matchId}/create-lobby`,
                {},
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ Лобби матча создано:', response.data);
            
            setMessage('✅ Лобби матча успешно создано! Приглашения отправлены участникам.');
            
            // Обновляем данные турнира
            await fetchTournamentData();
            
        } catch (error) {
            console.error('❌ Ошибка создания лобби:', error);
            
            let errorMessage = 'Ошибка при создании лобби матча';
            
            if (error.response?.status === 403) {
                errorMessage = 'У вас нет прав для создания лобби';
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setMessage(`❌ ${errorMessage}`);
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 5000);
        }
    }, [id, fetchTournamentData]);

    // 👤 Обработчик добавления незарегистрированного участника
    const handleAddParticipant = useCallback(async () => {
        if (!newParticipantData.display_name?.trim()) {
            setMessage('❌ Укажите имя участника');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        try {
            setLoading(true);
            console.log('👤 Добавляем участника:', newParticipantData);

            const result = await tournamentManagement.addUnregisteredParticipant(newParticipantData);
            
            if (result.success) {
                console.log('✅ Участник успешно добавлен:', result.data);
                
                // 🚀 МГНОВЕННОЕ ОБНОВЛЕНИЕ СОСТОЯНИЯ - добавляем участника в локальное состояние
                const newParticipant = {
                    id: result.data?.id || Date.now(), // временный ID если не вернулся с сервера
                    name: newParticipantData.display_name,
                    display_name: newParticipantData.display_name,
                    email: newParticipantData.email || null,
                    faceit_elo: newParticipantData.faceit_elo || null,
                    cs2_premier_rank: newParticipantData.cs2_premier_rank || null,
                    user_id: null, // незарегистрированный участник
                    avatar_url: null,
                    in_team: false,
                    created_at: new Date().toISOString()
                };
                
                // Обновляем состояние участников немедленно
                setTournament(prev => ({
                    ...prev,
                    participants: [...(prev.participants || []), newParticipant]
                }));
                
                // Обновляем originalParticipants для микс турниров
                setOriginalParticipants(prev => [...prev, newParticipant]);
                
                console.log('🚀 Участник добавлен в локальное состояние мгновенно');
                
                // Закрываем модальное окно
                closeModal('addParticipant');
                
                // Очищаем форму
                setNewParticipantData({
                    display_name: '',
                    email: '',
                    faceit_elo: '',
                    cs2_premier_rank: ''
                });
                
                // Очищаем кеш турнира для следующих запросов
                const cacheKey = `tournament_cache_${id}`;
                const cacheTimestampKey = `tournament_cache_timestamp_${id}`;
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
                
                // Обновляем данные турнира в фоне для синхронизации с сервером
                setTimeout(() => {
                    fetchTournamentData();
                }, 1000);
                
                setMessage(`✅ ${newParticipantData.display_name} добавлен в турнир`);
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage(`❌ ${result.error || 'Ошибка при добавлении участника'}`);
                setTimeout(() => setMessage(''), 5000);
            }
        } catch (error) {
            console.error('❌ Ошибка при добавлении участника:', error);
            setMessage(`❌ Ошибка при добавлении участника: ${error.message}`);
            setTimeout(() => setMessage(''), 5000);
        } finally {
            setLoading(false);
        }
    }, [newParticipantData, tournamentManagement, id, fetchTournamentData, closeModal, setMessage, setLoading]);

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
                        �� Попробовать снова
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
            <div
                className={`tournament-details-tournamentdetails ${tournament?.game && /counter\s*strike\s*2|cs2/i.test(tournament.game) ? 'with-root-bg' : ''}`}
                data-testid="tournament-details"
            >
                <div className="tournament-layout">
                    <div className="tournament-main">
                        {/* Заголовок турнира (CS2: делим на 2 блока в общем флексе) */}
                        <div className={`tournament-header ${tournament?.game && /counter\s*strike\s*2|cs2/i.test(tournament.game) ? 'with-cs2-hero' : ''}`}>
                            <div className={`tournament-header-tournamentdetails ${tournament?.game && /counter\s*strike\s*2|cs2/i.test(tournament.game) ? 'with-cs2-hero' : ''}`}>
                                <h2 data-testid="tournament-title">{tournament.name}</h2>
                                <div className="header-meta">
                                    <div className="header-meta-row">
                                        <span className="meta-label">Организатор:</span>
                                        <span className="meta-value">
                                            {tournament?.organizer_name || tournament?.organizer?.name || tournament?.organizer || tournament?.organizer_slug || '—'}
                                        </span>
                                    </div>
                                    <div className="header-meta-row">
                                        <span className="meta-label">Дисциплина:</span>
                                        <span className="meta-value">{tournament?.game || '—'}</span>
                                    </div>
                                </div>
                                <div className="header-actions">
                                    {tournament?.access_type === 'closed' ? (
                                        <span className="invite-only">🔒 Invite only</span>
                                    ) : (
                                        <button 
                                            className="btn btn-primary"
                                            onClick={async () => {
                                                try {
                                                    if (!user) {
                                                        localStorage.setItem('returnToTournament', tournament.id);
                                                        localStorage.setItem('tournamentAction', 'participate');
                                                        window.location.href = '/register?action=participate';
                                                        return;
                                                    }
                                                    const participantType = tournament.participant_type;
                                                    const payload = tournament.format === 'mix'
                                                        ? {}
                                                        : participantType === 'solo' ? {} : { teamId: null, newTeamName: null };
                                                    const token = localStorage.getItem('token');
                                                    await api.post(`/api/tournaments/${tournament.id}/participate`, payload, {
                                                        headers: { Authorization: `Bearer ${token}` }
                                                    });
                                                    await fetchTournamentData();
                                                } catch (e) {
                                                    console.error('Ошибка участия:', e);
                                                }
                                            }}
                                        >
                                            Принять участие
                                        </button>
                                    )}
                                    <button 
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setActiveTab('info');
                                            requestAnimationFrame(() => {
                                                setTimeout(() => {
                                                    const el = document.querySelector('.rules-block');
                                                    if (el && typeof el.scrollIntoView === 'function') {
                                                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }
                                                }, 50);
                                            });
                                        }}
                                    >
                                        Регламент
                                    </button>
                                </div>
                            </div>
                            <div className={`tournament-header-infoblock ${tournament?.game && /counter\s*strike\s*2|cs2/i.test(tournament.game) ? 'with-cs2-hero' : ''}`}>
                                {/* Правый инфоблок: призовой, старт, статус, прогресс, формат, участники, команда */}
                                <div className="infoblock-stats">
                                    <div className="infoblock-grid infoblock-top">
                                        <div className="infoblock-item infoblock-prize">
                                            <div className="infoblock-label">Призовой фонд</div>
                                            <div className="infoblock-value">{tournament?.prize_pool ? tournament.prize_pool : 'Не указан'}</div>
                                        </div>
                                        <div className="infoblock-item infoblock-start">
                                            <div className="infoblock-label">Старт</div>
                                            <div className="infoblock-value">{tournament?.start_date ? new Date(tournament.start_date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                                        </div>
                                        <div className="infoblock-item infoblock-status">
                                            <div className="infoblock-label">Статус</div>
                                            <div className="infoblock-value">{(() => { const map = { registration: 'Регистрация', active: 'Активный', in_progress: 'Идет', completed: 'Завершен', upcoming: 'Предстоящий' }; return map[tournament?.status] || tournament?.status || '—'; })()}</div>
                                        </div>
                                    </div>
                                    <div className="infoblock-progress">
                                        <TournamentProgressBar matches={matches || []} tournamentStatus={tournament?.status} tournament={tournament} compact={true} />
                                    </div>
                                    <div className="infoblock-grid infoblock-bottom">
                                        <div className="infoblock-item infoblock-format">
                                            <div className="infoblock-label">Формат</div>
                                            <div className="infoblock-value">{tournament?.format === 'mix' ? 'Микс' : (tournament?.participant_type === 'team' ? 'Командный' : 'Соло')}</div>
                                        </div>
                                        <div className="infoblock-item infoblock-participants">
                                            <div className="infoblock-label">Участники</div>
                                            <div className="infoblock-value">{(() => { const displayed = tournament?.format === 'mix' ? (tournament?.players_count ?? tournament?.participant_count ?? 0) : (tournament?.participant_count ?? 0); return tournament?.max_participants ? `${displayed} из ${tournament.max_participants}` : displayed; })()}</div>
                                        </div>
                                        <div className="infoblock-item infoblock-team-size">
                                            <div className="infoblock-label">В команде</div>
                                            <div className="infoblock-value">{tournament?.team_size || 5}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 🆕 Навигация по вкладкам */}
                        <div className={`tabs-navigation-tournamentdetails ${tournament?.game && /counter\s*strike\s*2|cs2/i.test(tournament.game) ? 'offset-from-hero' : ''}`}>
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
                        onSubmit={handleAddParticipant}
                        isLoading={loading}
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

                {/* 🆕 Модальное окно выбора матча за 3-е место */}
                <ThirdPlaceMatchModal
                    isOpen={showThirdPlaceModal}
                    onClose={handleThirdPlaceModalClose}
                    onConfirm={handleThirdPlaceModalConfirm}
                    participantCount={tournament?.participants?.length || 0}
                    tournamentName={tournament?.name || ''}
                />

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

                {/* 🗑️ Модальное окно удаления турнира */}
                {deleteTournamentModal && (
                    <DeleteTournamentModal
                        isOpen={deleteTournamentModal}
                        onClose={closeDeleteTournamentModal}
                        onConfirm={handleDeleteTournament}
                        tournament={tournament}
                        isLoading={isDeletingTournament}
                    />
                )}

                {/* Плавающая панель действий */}
                <TournamentFloatingActionPanel
                    tournament={tournament}
                    user={user}
                    hasAccess={isAdminOrCreator}
                    onStartTournament={handleStartTournament}
                    onEndTournament={handleEndTournament}
                    onClearResults={resetMatchResults}
                    hasMatches={matches.length > 0}
                    hasBracket={games.length > 0}
                    // 🆕 Пропсы для микс турниров
                    mixedTeams={tournament?.teams || []}
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
