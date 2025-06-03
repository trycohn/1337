import React, { useState, useEffect, useRef } from 'react';
import api from '../axios';
import './Profile.css';
import { isCurrentUser, ensureHttps } from '../utils/userHelpers';
// V4 ULTIMATE: Добавляем импорты для графиков и WebSocket
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    RadialLinearScale,
    ArcElement,
    Filler
} from 'chart.js';
import { Line, Bar, Radar, Doughnut } from 'react-chartjs-2';

// ✨ V4 ULTIMATE: Импорты революционных компонентов
import { useV4ProfileHooks } from './V4ProfileHooks';
import V4StatsDashboard from './V4StatsDashboard';
import './V4Stats.css';

// Регистрируем компоненты Chart.js
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    RadialLinearScale,
    ArcElement,
    Filler
);

function Profile() {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [cs2Stats, setCs2Stats] = useState(null);
    const [isLoadingCs2Stats, setIsLoadingCs2Stats] = useState(false);
    const [faceitId, setFaceitId] = useState('');
    const [faceitInfo, setFaceitInfo] = useState(null);
    const [isLoadingFaceitInfo, setIsLoadingFaceitInfo] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [steamNickname, setSteamNickname] = useState('');
    const [premierRank, setPremierRank] = useState(0);
    
    // Avatar states
    const [avatar, setAvatar] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const fileInputRef = useRef(null);
    
    // Email verification states re
    const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isResendDisabled, setIsResendDisabled] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [isClosingModal, setIsClosingModal] = useState(false);
    const [verificationError, setVerificationError] = useState('');
    
    // Email adding states
    const [showAddEmailModal, setShowAddEmailModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [addEmailError, setAddEmailError] = useState('');
    
    // Email required modal state
    const [showEmailRequiredModal, setShowEmailRequiredModal] = useState(false);

    // Friends states
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);

    // Match history states
    const [matchHistory, setMatchHistory] = useState([]);
    const [loadingMatchHistory, setLoadingMatchHistory] = useState(false);
    const [showMatchHistoryModal, setShowMatchHistoryModal] = useState(false);

    // Active tab state
    const [activeTab, setActiveTab] = useState('main');

    // Поиск пользователей для добавления
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchPerformed, setSearchPerformed] = useState(false);
    const searchTimeoutRef = useRef(null);

    // Добавляем новое состояние для отправленных заявок в друзья
    const [sentFriendRequests, setSentFriendRequests] = useState([]);

    // Состояния для заявки на организацию
    const [organizationData, setOrganizationData] = useState({
        organizationName: '',
        description: '',
        websiteUrl: '',
        vkUrl: '',
        telegramUrl: ''
    });
    const [organizationLogo, setOrganizationLogo] = useState(null);
    const [organizationLogoPreview, setOrganizationLogoPreview] = useState(null);
    const [isSubmittingOrganization, setIsSubmittingOrganization] = useState(false);
    const [organizationError, setOrganizationError] = useState('');
    const [organizationSuccess, setOrganizationSuccess] = useState('');
    const organizationFileInputRef = useRef(null);

    // Состояния для участия в организациях
    const [userOrganizations, setUserOrganizations] = useState([]);
    const [loadingOrganizations, setLoadingOrganizations] = useState(false);
    
    // Состояния для статуса заявки на организацию
    const [organizationRequest, setOrganizationRequest] = useState(null);
    const [loadingRequest, setLoadingRequest] = useState(false);

    // Состояния для статистики
    const [dotaProfile, setDotaProfile] = useState(null);
    const [dotaStats, setDotaStats] = useState(null);
    const [isLoadingDotaStats, setIsLoadingDotaStats] = useState(false);
    
    // Состояния для турниров игрока
    const [userTournaments, setUserTournaments] = useState([]);
    const [loadingTournaments, setLoadingTournaments] = useState(false);
    const [tournamentFilters, setTournamentFilters] = useState({
        game: '',
        name: '',
        format: '',
        status: '',
        start_date: null,
    });
    const [tournamentSort, setTournamentSort] = useState({ field: '', direction: 'asc' });
    const [activeTournamentFilter, setActiveTournamentFilter] = useState(null);
    const [tournamentViewMode, setTournamentViewMode] = useState('table');
    const tournamentFilterRefs = {
        name: useRef(null),
        game: useRef(null),
        format: useRef(null),
        status: useRef(null),
        start_date: useRef(null),
    };

    // Добавляем состояние для индикатора пересчета
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [recalculationStatus, setRecalculationStatus] = useState('');
    const [recalculationError, setRecalculationError] = useState('');

    // ✨ V4 ULTIMATE: Новые состояния для революционной функциональности
    const [v4EnhancedStats, setV4EnhancedStats] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [userAchievements, setUserAchievements] = useState([]);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [performanceData, setPerformanceData] = useState([]);
    const [leaderboards, setLeaderboards] = useState([]);
    const [currentStreak, setCurrentStreak] = useState(null);
    const [isLoadingV4Stats, setIsLoadingV4Stats] = useState(false);
    const [isLoadingAchievements, setIsLoadingAchievements] = useState(false);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [websocket, setWebsocket] = useState(null);
    const [realTimeUpdates, setRealTimeUpdates] = useState([]);
    const [showAchievementNotification, setShowAchievementNotification] = useState(null);
    const [globalRank, setGlobalRank] = useState(null);
    const [weeklyProgress, setWeeklyProgress] = useState(null);
    const [personalBests, setPersonalBests] = useState({});
    const [v4ActiveView, setV4ActiveView] = useState('overview'); // overview, charts, achievements, ai

    // ✨ V4 ULTIMATE: Инициализация революционного хука
    const v4Data = useV4ProfileHooks(user, activeTab);

    // 🔄 Функция расширенного пересчета с AI анализом
    const requestEnhancedRecalculation = async () => {
        if (!user?.id) return;
        
        setIsRecalculating(true);
        setRecalculationStatus('Запускаем глубокий анализ статистики...');
        setRecalculationError('');
        
        try {
            const token = localStorage.getItem('token');
            
            // Базовый пересчет статистики
            const basicResponse = await api.post('/api/users/recalculate-tournament-stats', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (basicResponse.data.success) {
                setRecalculationStatus('✅ Базовая статистика обновлена. Запускаем AI анализ...');
                
                // V4 расширенный пересчет с AI
                const enhancedResponse = await api.post(`/api/v4/recalculate-enhanced/${user.id}`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (enhancedResponse.data.success) {
                    setRecalculationStatus('✅ Анализ завершен успешно!');
                    
                    // Обновляем все данные
                    await Promise.all([
                        fetchStats(token),
                        v4Data.fetchV4EnhancedStats(),
                        v4Data.fetchAchievements(),
                        v4Data.fetchAIAnalysis && v4Data.fetchAIAnalysis(),
                        v4Data.fetchLeaderboards()
                    ]);
                } else {
                    setRecalculationStatus('✅ Базовая статистика обновлена. AI анализ будет доступен позже.');
                }
            }
            
        } catch (err) {
            console.error('Ошибка расширенного пересчета:', err);
            setRecalculationError('❌ Ошибка при глубоком анализе. Попробуйте стандартный пересчет.');
        } finally {
            setIsRecalculating(false);
            setTimeout(() => {
                setRecalculationStatus('');
                setRecalculationError('');
            }, 5000);
        }
    };

    // Функция для получения URL картинки героя Dota 2
    const getHeroImageUrl = (heroId) => {
        if (!heroId) return '/default-hero.png';
        return `https://cdn.dota2.com/apps/dota2/images/heroes/${getHeroName(heroId)}_full.png`;
    };

    // Функция для получения имени героя по ID
    const getHeroName = (heroId) => {
        const heroNames = {
            1: 'antimage',
            2: 'axe',
            3: 'bane',
            4: 'bloodseeker',
            5: 'crystal_maiden',
            6: 'drow_ranger',
            7: 'earthshaker',
            8: 'juggernaut',
            9: 'mirana',
            10: 'morphling',
            11: 'nevermore',
            12: 'phantom_lancer',
            13: 'puck',
            14: 'pudge',
            15: 'razor',
            16: 'sand_king',
            17: 'storm_spirit',
            18: 'sven',
            19: 'tiny',
            20: 'vengefulspirit',
            21: 'windrunner',
            22: 'zuus',
            23: 'kunkka',
            25: 'lina',
            26: 'lion',
            27: 'shadow_shaman',
            28: 'slardar',
            29: 'tidehunter',
            30: 'witch_doctor',
            31: 'lich',
            32: 'riki',
            33: 'enigma',
            34: 'tinker',
            35: 'sniper',
            36: 'necrolyte',
            37: 'warlock',
            38: 'beastmaster',
            39: 'queenofpain',
            40: 'venomancer',
            41: 'faceless_void',
            42: 'skeleton_king',
            43: 'death_prophet',
            44: 'phantom_assassin',
            45: 'pugna',
            46: 'templar_assassin',
            47: 'viper',
            48: 'luna',
            49: 'dragon_knight',
            50: 'dazzle',
            51: 'rattletrap',
            52: 'leshrac',
            53: 'furion',
            54: 'life_stealer',
            55: 'dark_seer',
            56: 'clinkz',
            57: 'omniknight',
            58: 'enchantress',
            59: 'huskar',
            60: 'night_stalker',
            61: 'broodmother',
            62: 'bounty_hunter',
            63: 'weaver',
            64: 'jakiro',
            65: 'batrider',
            66: 'chen',
            67: 'spectre',
            68: 'ancient_apparition',
            69: 'doom_bringer',
            70: 'ursa',
            71: 'spirit_breaker',
            72: 'gyrocopter',
            73: 'alchemist',
            74: 'invoker',
            75: 'silencer',
            76: 'obsidian_destroyer',
            77: 'lycan',
            78: 'brewmaster',
            79: 'shadow_demon',
            80: 'lone_druid',
            81: 'chaos_knight',
            82: 'meepo',
            83: 'treant',
            84: 'ogre_magi',
            85: 'undying',
            86: 'rubick',
            87: 'disruptor',
            88: 'nyx_assassin',
            89: 'naga_siren',
            90: 'keeper_of_the_light',
            91: 'wisp',
            92: 'visage',
            93: 'slark',
            94: 'medusa',
            95: 'troll_warlord',
            96: 'centaur',
            97: 'magnataur',
            98: 'shredder',
            99: 'bristleback',
            100: 'tusk',
            101: 'skywrath_mage',
            102: 'abaddon',
            103: 'elder_titan',
            104: 'legion_commander',
            105: 'techies',
            106: 'ember_spirit',
            107: 'earth_spirit',
            108: 'abyssal_underlord',
            109: 'terrorblade',
            110: 'phoenix',
            111: 'oracle',
            112: 'winter_wyvern',
            113: 'arc_warden',
            114: 'monkey_king',
            119: 'dark_willow',
            120: 'pangolier',
            121: 'grimstroke',
            123: 'hoodwink',
            126: 'void_spirit',
            128: 'snapfire',
            129: 'mars',
            135: 'dawnbreaker',
            136: 'marci',
            137: 'primal_beast',
            138: 'muerta'
        };
        
        return heroNames[heroId] || `hero_${heroId}`;
    };

    const fetchUserData = async (token) => {
        try {
            const response = await api.get('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(response.data);
            setNewUsername(response.data.username);
            
            // Устанавливаем аватар, если он есть
            if (response.data.avatar_url) {
                setAvatar(response.data.avatar_url);
            }
            
            // Извлекаем ранг Premier из данных пользователя
            if (response.data.cs2_premier_rank) {
                setPremierRank(response.data.cs2_premier_rank);
            }
            
            // Автоматически загружаем статистику CS2 только при первой привязке Steam
            // (только если есть steam_id и нет cs2_premier_rank)
            if (response.data.steam_id && response.data.cs2_premier_rank === 0) {
                fetchCs2Stats(response.data.steam_id);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Ошибка загрузки данных пользователя');
        }
    };

    const fetchCs2Stats = async (steamId) => {
        const id = steamId || (user && user.steam_id);
        if (!id) return;
        
        setIsLoadingCs2Stats(true);
        try {
            const response = await api.get(`/api/playerStats/${id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.data.success) {
                setCs2Stats(response.data.data);
                // Обновляем ранг Premier из ответа API
                if (response.data.premier_rank !== undefined) {
                    setPremierRank(response.data.premier_rank);
                }
            }
        } catch (err) {
            setError('Ошибка получения статистики CS2');
        } finally {
            setIsLoadingCs2Stats(false);
        }
    };   

    const fetchStats = async (token) => {
        try {
            // 🔄 АВТОМАТИЧЕСКИЙ ПЕРЕСЧЕТ статистики при каждой загрузке профиля
            setIsRecalculating(true);
            setRecalculationStatus('Проверяем статистику турниров...');
            setRecalculationError('');
            
            try {
                const recalcResponse = await api.post('/api/users/recalculate-tournament-stats', {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (recalcResponse.data.success) {
                    const details = recalcResponse.data.details;
                    
                    // Показываем детальный статус
                    if (details.total === 0) {
                        setRecalculationStatus('Турниры не найдены');
                    } else if (details.errors === 0) {
                        setRecalculationStatus(
                            `✅ ${recalcResponse.data.statusMessage || `Обновлено: ${details.updated} из ${details.total} турниров`}`
                        );
                    } else {
                        setRecalculationStatus(
                            `⚠️ ${recalcResponse.data.statusMessage || `Обновлено: ${details.updated} из ${details.total}, ошибок: ${details.errors}`}`
                        );
                    }
                    
                    console.log('✅ Статистика автоматически пересчитана:', {
                        total: details.total,
                        updated: details.updated,
                        skipped: details.skipped,
                        errors: details.errors
                    });
                } else {
                    setRecalculationError('Не удалось обновить статистику');
                }
            } catch (recalcErr) {
                console.log('⚠️ Автоматический пересчет статистики пропущен:', recalcErr.response?.data);
                
                const errorData = recalcErr.response?.data;
                
                // Детальная обработка ошибок
                if (errorData?.needsTableCreation) {
                    setRecalculationError('⚠️ Система статистики требует настройки. Обратитесь к администратору.');
                } else if (errorData?.sqlErrorCode === '23505') {
                    setRecalculationError('⚠️ Конфликт данных при обновлении. Попробуйте позже.');
                } else if (errorData?.sqlErrorCode === '23503') {
                    setRecalculationError('⚠️ Проблема целостности данных. Обратитесь к администратору.');
                } else if (recalcErr.response?.status === 500) {
                    setRecalculationError('⚠️ Сервер временно недоступен. Попробуйте позже.');
                } else {
                    setRecalculationError('⚠️ Пересчет статистики временно недоступен');
                }
                
                // Graceful degradation - продолжаем выполнение даже если пересчет не удался
            }
            
            // Небольшая задержка для лучшего UX - пользователь видит процесс
            setTimeout(() => {
                if (!recalculationError) {
                    setRecalculationStatus('Загружаем обновленную статистику...');
                }
            }, 500);
            
            const response = await api.get('/api/users/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(response.data);
            
            // Показываем финальный статус успеха
            if (!recalculationError) {
                setRecalculationStatus('✅ Статистика актуальна');
                setTimeout(() => {
                    setRecalculationStatus('');
                }, 3000); // Показываем успех 3 секунды
            }
            
        } catch (err) {
            setError(err.response?.data?.message || 'Ошибка загрузки статистики');
            setRecalculationError('❌ Не удалось загрузить статистику');
        } finally {
            setIsRecalculating(false);
            // Очищаем ошибки через некоторое время для лучшего UX
            if (recalculationError) {
                setTimeout(() => {
                    setRecalculationError('');
                }, 8000); // Показываем ошибку 8 секунд
            }
        }
    };

    // Функции для работы с Dota 2
    const fetchDotaProfile = async () => {
        if (!user?.id) return;
        
        try {
            const response = await api.get(`/api/dota-stats/profile/${user.id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setDotaProfile(response.data);
            
            // Автоматически обновляем статистику если профиль существует
            if (response.data.steam_id) {
                fetchDotaStats(response.data.steam_id);
            }
        } catch (err) {
            // Профиль может не существовать - это нормально, не логируем ошибку
            setDotaProfile(null);
        }
    };

    const fetchDotaStats = async (steamId) => {
        if (!steamId) return;
        
        setIsLoadingDotaStats(true);
        try {
            const response = await api.get(`/api/dota-stats/player/${steamId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setDotaStats(response.data);
            
            // Автоматически сохраняем обновленную статистику
            await api.post('/api/dota-stats/profile/save', {
                user_id: user.id,
                steam_id: steamId,
                dota_stats: response.data
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
        } catch (err) {
            // Dota API может быть недоступен - это нормально
            setDotaStats(null);
        } finally {
            setIsLoadingDotaStats(false);
        }
    };

    const linkDotaSteam = async () => {
        if (!user?.steam_id) {
            setError('Сначала привяжите Steam аккаунт в разделе "Основная информация"');
            return;
        }

        try {
            // Получаем статистику игрока используя привязанный Steam ID
            const response = await api.get(`/api/dota-stats/player/${user.steam_id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            // Если статистика получена успешно, сохраняем профиль
            await api.post('/api/dota-stats/profile/save', {
                user_id: user.id,
                steam_id: user.steam_id,
                dota_stats: response.data
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            setDotaStats(response.data);
            setDotaProfile({ user_id: user.id, steam_id: user.steam_id, dota_stats: response.data });
            setError('');
        } catch (err) {
            setError('Dota API временно недоступен');
        }
    };

    const unlinkDotaSteam = async () => {
        try {
            await api.delete(`/api/dota-stats/profile/${user.id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setDotaProfile(null);
            setDotaStats(null);
            setError('');
        } catch (err) {
            setError('Dota API временно недоступен');
        }
    };

    const linkSteam = () => {
        const token = localStorage.getItem('token');
        if (token) {
            const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
            const steamLoginUrl = `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${baseUrl}/api/users/steam-callback&openid.realm=${baseUrl}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
            window.location.href = steamLoginUrl;
        } else {
            setError('Вы должны быть авторизованы для привязки Steam');
        }
    };

    const handleSteamCallback = async (steamId, token) => {
        try {
            const response = await api.post('/api/users/link-steam', { steamId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, steam_id: steamId, steam_url: `https://steamcommunity.com/profiles/${steamId}` } : null);
            setError('');
            window.history.replaceState({}, document.title, '/profile');
            
            // После привязки Steam автоматически загружаем и сохраняем статистику CS2
            fetchCs2Stats(steamId);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка привязки Steam');
        }
    };

    const unlinkSteam = async () => {
        const token = localStorage.getItem('token');
        
        // Проверяем, есть ли привязанная почта
        if (!user.email) {
            // Показываем модальное окно с предупреждением и предложением привязать почту
            setShowEmailRequiredModal(true);
            return;
        }
        
        try {
            await api.post('/api/users/unlink-steam', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, steam_id: null, steam_url: null } : null);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отвязки Steam');
        }
    };

    const unlinkFaceit = async () => {
        const token = localStorage.getItem('token');
        
        // Проверяем, есть ли привязанная почта
        if (!user.email) {
            // Показываем модальное окно с предупреждением и предложением привязать почту
            setShowEmailRequiredModal(true);
            return;
        }
        
        try {
            await api.post('/api/users/unlink-faceit', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, faceit_id: null } : null);
            setFaceitInfo(null);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отвязки FACEIT');
        }
    };

    const updateUsername = async () => {
        const token = localStorage.getItem('token');
        try {
            const response = await api.post('/api/users/update-username', { username: newUsername }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, username: newUsername } : null);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка изменения никнейма');
        }
    };

    const fetchAndSetSteamNickname = async () => {
        const token = localStorage.getItem('token');
        try {
            const response = await api.get('/api/users/steam-nickname', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSteamNickname(response.data.steamNickname);
            setShowModal(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка получения никнейма Steam');
        }
    };

    const confirmSteamNickname = async () => {
        setNewUsername(steamNickname);
        await updateUsername();
        setShowModal(false);
    };

    const closeModal = () => {
        setShowModal(false);
    };

    // Функция открытия модального окна с проверкой первого запуска
    const openEmailVerificationModal = async () => {
        setShowEmailVerificationModal(true);
        
        // Проверяем, был ли уже отправлен код ранее
        const codeWasSentBefore = localStorage.getItem('verification_code_sent') === 'true';
        
        if (!codeWasSentBefore) {
            // Если код отправляется впервые, отправляем его и устанавливаем флаг
            await sendVerificationCode();
            localStorage.setItem('verification_code_sent', 'true');
        }
    };

    // Обновляем функцию закрытия модального окна
    const closeEmailVerificationModal = () => {
        setIsClosingModal(true);
        
        // Ждем завершения анимации перед фактическим скрытием модального окна
        setTimeout(() => {
            setShowEmailVerificationModal(false);
            setIsClosingModal(false);
            setVerificationCode('');
            setVerificationError(''); // Сбрасываем ошибку при закрытии
        }, 300); // Время должно совпадать с длительностью анимации в CSS (0.3s)
    };

    const sendVerificationCode = async () => {
        if (isResendDisabled) return;
        
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/users/verify-email', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Сбрасываем ошибку при успешной отправке нового кода
            setVerificationError('');
            
            // Устанавливаем задержку 3 минуты на повторную отправку
            setIsResendDisabled(true);
            const countdownTime = 180; // 3 минуты в секундах
            setResendCountdown(countdownTime);
            
            // Сохраняем время окончания задержки в localStorage
            const endTime = Date.now() + countdownTime * 1000;
            localStorage.setItem('resendCodeEndTime', endTime.toString());
            
            // Запускаем обратный отсчет
            startCountdown(countdownTime);
            
            setError('');
        } catch (err) {
            setVerificationError(err.response?.data?.error || 'Ошибка отправки кода подтверждения');
        }
    };

    const startCountdown = (seconds) => {
        let remainingSeconds = seconds;
        const intervalId = setInterval(() => {
            remainingSeconds -= 1;
            setResendCountdown(remainingSeconds);
            
            if (remainingSeconds <= 0) {
                clearInterval(intervalId);
                setIsResendDisabled(false);
                setResendCountdown(0);
                localStorage.removeItem('resendCodeEndTime');
            }
        }, 1000);
    };

    const submitVerificationCode = async () => {
        if (verificationCode.length !== 6) {
            setVerificationError('Код подтверждения должен состоять из 6 цифр');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/users/confirm-email', { code: verificationCode }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем статус верификации пользователя
            setUser(prevUser => prevUser ? { ...prevUser, is_verified: true } : null);
            closeEmailVerificationModal();
            setError('');
        } catch (err) {
            // Устанавливаем ошибку в модальном окне вместо общей ошибки
            setVerificationError(err.response?.data?.message || 'Неверный код подтверждения');
        }
    };

    // Функция для обработки ввода кода
    const handleCodeChange = (e) => {
        const value = e.target.value;
        // Принимаем только цифры и не более 6 символов
        const code = value.replace(/\D/g, '').slice(0, 6);
        setVerificationCode(code);
    };

    // Функция для обработки вставки из буфера обмена
    const handleCodePaste = async (e) => {
        e.preventDefault();
        try {
            // Получаем текст из буфера обмена
            const text = await navigator.clipboard.readText();
            // Фильтруем только цифры и ограничиваем длину
            const code = text.replace(/\D/g, '').slice(0, 6);
            setVerificationCode(code);
        } catch (err) {
            console.error('Не удалось получить доступ к буферу обмена:', err);
        }
    };

    // Функция для фокусировки на скрытом поле ввода при клике на контейнер цифр
    const handleCodeContainerClick = () => {
        document.getElementById('hidden-code-input').focus();
    };

    // Добавим эффект для автоматической проверки кода, когда он заполнен полностью
    useEffect(() => {
        if (verificationCode.length === 6) {
            submitVerificationCode();
        }
    }, [verificationCode]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchUserData(token);
            fetchStats(token);
            const urlParams = new URLSearchParams(window.location.search);
            const steamId = urlParams.get('steamId');
            if (steamId) {
                handleSteamCallback(steamId, token);
            }

            // Загружаем список друзей при загрузке страницы
            fetchFriends();
            // Загружаем заявки в друзья
            fetchFriendRequests();
            // Загружаем отправленные заявки в друзья
            fetchSentFriendRequests();
            // Загружаем историю матчей
            fetchMatchHistory();
            // Загружаем организации пользователя
            fetchUserOrganizations();
            // Проверяем статус заявки на организацию
            fetchOrganizationRequest();
            // Загружаем профиль Dota 2
            fetchDotaProfile();
            // Загружаем турниры пользователя
            fetchUserTournaments();
        }
        
        // Проверяем, есть ли сохраненное время окончания задержки
        const savedEndTime = localStorage.getItem('resendCodeEndTime');
        if (savedEndTime) {
            const endTime = parseInt(savedEndTime);
            const now = Date.now();
            const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));
            
            if (remainingTime > 0) {
                setIsResendDisabled(true);
                setResendCountdown(remainingTime);
                startCountdown(remainingTime);
            } else {
                localStorage.removeItem('resendCodeEndTime');
            }
        }
    }, []);

    // Загружаем никнейм Steam при изменении user.steam_id
    useEffect(() => {
        if (user && user.steam_id) {
            fetchSteamNickname();
        }
    }, [user?.steam_id]);

    // Загружаем информацию о FACEit при изменении user.faceit_id
    useEffect(() => {
        if (user && user.faceit_id) {
            fetchFaceitInfo();
        }
    }, [user?.faceit_id]);

    // Загружаем профиль Dota 2 при изменении user.id
    useEffect(() => {
        if (user && user.id) {
            fetchDotaProfile();
        }
    }, [user?.id]);

    const fetchSteamNickname = async () => {
        const token = localStorage.getItem('token');
        try {
            const response = await api.get('/api/users/steam-nickname', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSteamNickname(response.data.steamNickname);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка получения никнейма Steam');
        }
    };

    const fetchFaceitInfo = async () => {
        const token = localStorage.getItem('token');
        setIsLoadingFaceitInfo(true);
        try {
            const response = await api.get('/api/users/faceit-info', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFaceitInfo(response.data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка получения информации FACEit');
        } finally {
            setIsLoadingFaceitInfo(false);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('faceit') === 'success') {
            fetchUserData(localStorage.getItem('token'));
        } else if (params.get('error')) {
            setError(`Ошибка привязки FACEIT: ${params.get('error')}`);
        }
    }, []);

    const linkFaceit = () => {
        const token = localStorage.getItem('token');
        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
        window.location.href = `${baseUrl}/api/users/link-faceit?token=${token}`;
    };

    const renderRankGroups = () => {
        // Если у пользователя нет ранга Premier, показываем сообщение
        if (!premierRank) {
            return <p>Нет данных о ранге Premier</p>;
        }
        
        // Если есть статистика CS2, используем ее для отображения ранга
        if (cs2Stats && cs2Stats.ranks) {
            // Создаём копии для дальнейшей работы
            let filteredRanks = cs2Stats.ranks.filter(url => !url.includes('logo-cs2.png'));
            
            // Если есть картинка logo-csgo.png, отрезаем её и все, что после
            const csgoIdx = filteredRanks.findIndex(url => url.includes('logo-csgo.png'));
            if (csgoIdx !== -1) {
                filteredRanks = filteredRanks.slice(0, csgoIdx);
            }
            
            // Ищем последний ранг premier.png
            const lastPremierIndex = filteredRanks.findLastIndex(url => url.includes('premier.png'));
            
            // Если найден premier.png, показываем его
            if (lastPremierIndex !== -1) {
                return (
                    <div>
                        <div className="rank-row">
                            <div className="rank-group">
                                <img src={filteredRanks[lastPremierIndex]} alt="premier" className="rank-image" />
                            </div>
                            <div className="rank-win">
                                <span>{premierRank}</span>
                            </div>
                        </div>
                    </div>
                );
            }
        }
        
        // Если нет изображения ранга, но есть числовое значение ранга
        return (
            <div className="rank-row">
                <p>Premier Rank: {premierRank}</p>
            </div>
        );
    };

    // Функция для открытия модального окна добавления почты
    const openAddEmailModal = () => {
        setShowAddEmailModal(true);
        setAddEmailError('');
    };

    // Функция закрытия модального окна добавления почты
    const closeAddEmailModal = () => {
        setIsClosingModal(true);
        
        setTimeout(() => {
            setShowAddEmailModal(false);
            setIsClosingModal(false);
            setNewEmail('');
            setAddEmailError('');
        }, 300);
    };

    // Функция для сохранения новой почты
    const saveEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) {
            setAddEmailError('Пожалуйста, введите корректный email');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/users/update-email', { email: newEmail }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем данные пользователя с новым email
            setUser(prevUser => prevUser ? { ...prevUser, email: newEmail, is_verified: false } : null);
            
            // Закрываем модальное окно добавления email
            closeAddEmailModal();
            
            // Открываем модальное окно подтверждения email
            setShowEmailVerificationModal(true);
            
            // Отправляем код верификации
            await sendVerificationCode();
            localStorage.setItem('verification_code_sent', 'true');
            
        } catch (err) {
            setAddEmailError(err.response?.data?.error || 'Ошибка сохранения email');
        }
    };

    // Добавить функцию закрытия модального окна с требованием привязать почту
    const closeEmailRequiredModal = () => {
        setIsClosingModal(true);
        
        setTimeout(() => {
            setShowEmailRequiredModal(false);
            setIsClosingModal(false);
        }, 300);
    };

    // Функция для загрузки аватара
    const handleAvatarUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Проверяем тип файла (разрешаем только изображения)
        if (!file.type.startsWith('image/')) {
            setError('Пожалуйста, выберите файл изображения');
            return;
        }

        // Ограничение размера файла (например, 5 МБ)
        const maxSize = 5 * 1024 * 1024; // 5 МБ в байтах
        if (file.size > maxSize) {
            setError('Размер файла не должен превышать 5 МБ');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        setUploadingAvatar(true);
        try {
            const token = localStorage.getItem('token');
            // Убираем явное указание Content-Type, чтобы axios сам проставил boundary
            const response = await api.post('/api/users/upload-avatar', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем аватар в состоянии
            setAvatar(response.data.avatar_url);
            setUser(prevUser => ({...prevUser, avatar_url: response.data.avatar_url}));
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка загрузки аватара');
        } finally {
            setUploadingAvatar(false);
        }
    };

    // Функция для установки аватара из Steam
    const setAvatarFromSteam = async () => {
        if (!user.steam_id) {
            setError('Steam не привязан');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/users/set-steam-avatar', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем аватар в состоянии
            setAvatar(response.data.avatar_url);
            setUser(prevUser => ({...prevUser, avatar_url: response.data.avatar_url}));
            setError('');
            setShowAvatarModal(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка установки аватара из Steam');
        }
    };

    // Функция для установки аватара из FACEIT
    const setAvatarFromFaceit = async () => {
        if (!user.faceit_id) {
            setError('FACEIT не привязан');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/users/set-faceit-avatar', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем аватар в состоянии
            setAvatar(response.data.avatar_url);
            setUser(prevUser => ({...prevUser, avatar_url: response.data.avatar_url}));
            setError('');
            setShowAvatarModal(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка установки аватара из FACEIT');
        }
    };

    // Обработчик клика на кнопку выбора файла
    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    // Открытие модального окна выбора аватара
    const openAvatarModal = () => {
        setShowAvatarModal(true);
    };

    // Закрытие модального окна выбора аватара
    const closeAvatarModal = () => {
        setShowAvatarModal(false);
    };

    // Функция для загрузки списка друзей
    const fetchFriends = async () => {
        setLoadingFriends(true);
        try {
            const token = localStorage.getItem('token');
            // Сначала получаем базовый список друзей
            const response = await api.get('/api/friends', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Фильтруем только принятые заявки
            const acceptedFriends = response.data.filter(f => f.status === 'accepted');
            
            // Для каждого друга запрашиваем дополнительную информацию, включая статус онлайн
            const friendsWithDetails = await Promise.all(
                acceptedFriends.map(async (friend) => {
                    try {
                        const detailsResponse = await api.get(`/api/users/profile/${friend.friend.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        
                        // Обновляем информацию о статусе онлайн
                        return {
                            ...friend,
                            friend: {
                                ...friend.friend,
                                online_status: detailsResponse.data.online_status
                            }
                        };
                    } catch (err) {
                        console.error(`Ошибка загрузки деталей для друга ${friend.friend.id}:`, err);
                        return friend; // Возвращаем исходные данные в случае ошибки
                    }
                })
            );
            
            setFriends(friendsWithDetails);
        } catch (err) {
            console.error('Ошибка загрузки списка друзей:', err);
        } finally {
            setLoadingFriends(false);
        }
    };

    // Функция для загрузки входящих заявок в друзья
    const fetchFriendRequests = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/friends/requests/incoming', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFriendRequests(response.data);
        } catch (err) {
            console.error('Ошибка загрузки заявок в друзья:', err);
        }
    };

    // Функция для принятия заявки в друзья
    const acceptFriendRequest = async (requestId) => {
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/friends/accept', { requestId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем списки друзей и заявок
            fetchFriends();
            fetchFriendRequests();
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка принятия заявки в друзья');
        }
    };

    // Функция для отклонения заявки в друзья
    const rejectFriendRequest = async (requestId) => {
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/friends/reject', { requestId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем список заявок
            fetchFriendRequests();
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отклонения заявки в друзья');
        }
    };

    // Функция для удаления из друзей
    const removeFriend = async (friendId) => {
        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/friends/${friendId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем список друзей
            fetchFriends();
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка удаления из друзей');
        }
    };

    // Функция для загрузки истории матчей
    const fetchMatchHistory = async () => {
        setLoadingMatchHistory(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/users/match-history', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMatchHistory(response.data || []);
        } catch (err) {
            // Просто устанавливаем пустой массив, не логируем ошибку
            setMatchHistory([]);
        } finally {
            setLoadingMatchHistory(false);
        }
    };

    // Переключение между вкладками
    const switchTab = (tabName) => {
        setActiveTab(tabName);
    };

    // Открытие модального окна истории матчей
    const openMatchHistoryModal = () => {
        setShowMatchHistoryModal(true);
    };

    // Закрытие модального окна истории матчей
    const closeMatchHistoryModal = () => {
        setIsClosingModal(true);
        
        setTimeout(() => {
            setShowMatchHistoryModal(false);
            setIsClosingModal(false);
        }, 300);
    };

    // Rendering last 5 matches
    const renderLastFiveMatches = () => {
        if (loadingMatchHistory) {
            return <p>Загрузка истории матчей...</p>;
        }

        const lastFive = matchHistory.slice(0, 5);
        
        if (lastFive.length === 0) {
            return <p>Нет истории матчей</p>;
        }

        return (
            <div className="recent-matches">
                <h4>Последние 5 матчей</h4>
                <div className="matches-list">
                    {lastFive.map((match, index) => (
                        <div key={index} className={`match-item ${match.result === 'win' ? 'win' : 'loss'}`}>
                            <div className="match-date">{new Date(match.date).toLocaleDateString()}</div>
                            <div className="match-info">
                                <span className="match-opponent">{match.opponent}</span>
                                <span className="match-score">{match.score}</span>
                            </div>
                            <div className="match-tournament">
                                <a href={`/tournament/${match.tournament_id}`}>{match.tournament_name}</a>
                            </div>
                        </div>
                    ))}
                </div>
                <button className="view-all-btn" onClick={openMatchHistoryModal}>
                    Показать все матчи
                </button>
            </div>
        );
    };

    // Функция для получения класса статуса онлайн
    const getOnlineStatusClass = (status) => {
        if (!status) return '';
        
        if (status === 'online') {
            return 'status-online';
        } else {
            return 'status-offline';
        }
    };

    // Render friend item with additional info on hover
    const renderFriendItem = (friend) => {
        // Проверяем и устанавливаем статус по умолчанию, если он отсутствует
        const onlineStatus = friend.friend.online_status || 'offline';
        
        return (
            <div key={friend.id} className="friend-card">
                <div className="friend-card-content">
                    <img 
                        src={ensureHttps(friend.friend.avatar_url) || '/default-avatar.png'} 
                        alt={friend.friend.username} 
                        className="friend-avatar"
                    />
                    <div className="friend-info">
                        <a 
                            href={isCurrentUser(friend.friend.id) ? `/profile` : `/user/${friend.friend.id}`} 
                            className="friend-username"
                            title={friend.friend.username}
                        >
                            {friend.friend.username}
                        </a>
                        <div className={`friend-status ${getOnlineStatusClass(onlineStatus)}`}>
                            {onlineStatus === 'online' ? 'Онлайн' : 'Не в сети'}
                        </div>
                        {onlineStatus === 'offline' && friend.friend.last_online && (
                            <div className="friend-last-online">
                                Был в сети: {new Date(friend.friend.last_online).toLocaleDateString('ru-RU')}
                            </div>
                        )}
                    </div>
                </div>
                <div className="friend-actions">
                    <button 
                        className="remove-friend-btn" 
                        onClick={() => removeFriend(friend.friend.id)}
                        title="Удалить из друзей"
                    >
                        ✕
                    </button>
                </div>
            </div>
        );
    };

    // Добавляем функцию для загрузки отправленных заявок в друзья
    const fetchSentFriendRequests = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/friends/requests/outgoing', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSentFriendRequests(response.data);
        } catch (err) {
            console.error('Ошибка загрузки отправленных заявок в друзья:', err);
        }
    };

    // Обновляем функцию отправки заявки в друзья
    const sendFriendRequest = async (userId) => {
        try {
            await api.post('/api/friends/request', { friendId: userId }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            // Обновляем список отправленных заявок
            await fetchSentFriendRequests();
            
            // Обновляем список результатов поиска с учетом новой отправленной заявки
            setSearchResults(prev => prev.map(user => {
                if (user.id === userId) {
                    return { ...user, requestSent: true };
                }
                return user;
            }));
        } catch (err) {
            console.error('Ошибка отправки заявки в друзья:', err);
        }
    };

    // Добавляю функцию для отмены исходящих заявок в друзья
    const cancelSentFriendRequest = async (requestId) => {
        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/friends/requests/outgoing/${requestId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Обновляем список исходящих заявок
            await fetchSentFriendRequests();
        } catch (err) {
            console.error('Ошибка отмены исходящей заявки в друзья:', err);
        }
    };

    // Обновляем функцию поиска
    const handleSearchChange = async (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        
        // Clear any existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        
        if (value.length < 2) {
            setSearchResults([]);
            setSearchPerformed(false);
            return;
        }
        
        // Set a new timeout (debounce)
        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await api.get(`/api/users/search?query=${encodeURIComponent(value)}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                // Фильтруем пользователей, уже добавленных в друзья
                const data = response.data;
                const friendIds = friends.map(f => f.friend.id);
                const sentRequestIds = sentFriendRequests.map(req => req.friendId);
                
                // Отфильтруем пользователей, которые уже в друзьях
                const filtered = data.filter(user => !friendIds.includes(user.id));
                
                // Отметим пользователей, которым уже отправлены заявки
                const markedResults = filtered.map(user => ({
                    ...user,
                    requestSent: sentRequestIds.includes(user.id)
                }));
                
                setSearchResults(markedResults);
                setSearchPerformed(true);
            } catch (err) {
                console.error('Ошибка поиска пользователей:', err);
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms delay before executing search
    };

    // Функции для обработки заявки на организацию
    const handleOrganizationInputChange = (e) => {
        const { name, value } = e.target;
        setOrganizationData(prev => ({
            ...prev,
            [name]: value
        }));
        // Очищаем ошибки при изменении данных
        if (organizationError) {
            setOrganizationError('');
        }
    };

    const handleOrganizationLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Проверяем тип файла
            if (!file.type.startsWith('image/')) {
                setOrganizationError('Пожалуйста, выберите файл изображения');
                return;
            }
            
            // Проверяем размер файла (максимум 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setOrganizationError('Размер файла не должен превышать 5MB');
                return;
            }
            
            setOrganizationLogo(file);
            
            // Создаем превью
            const reader = new FileReader();
            reader.onload = (e) => {
                setOrganizationLogoPreview(e.target.result);
            };
            reader.readAsDataURL(file);
            
            if (organizationError) {
                setOrganizationError('');
            }
        }
    };

    const triggerOrganizationFileInput = () => {
        organizationFileInputRef.current?.click();
    };

    const removeOrganizationLogo = () => {
        setOrganizationLogo(null);
        setOrganizationLogoPreview(null);
        if (organizationFileInputRef.current) {
            organizationFileInputRef.current.value = '';
        }
    };

    const submitOrganizationRequest = async (e) => {
        e.preventDefault();
        
        // Проверяем обязательные поля
        if (!organizationData.organizationName.trim() || !organizationData.description.trim()) {
            setOrganizationError('Название организации и описание обязательны');
            return;
        }
        
        setIsSubmittingOrganization(true);
        setOrganizationError('');
        setOrganizationSuccess('');
        
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            
            // Добавляем текстовые данные
            Object.keys(organizationData).forEach(key => {
                if (organizationData[key]) {
                    formData.append(key, organizationData[key]);
                }
            });
            
            // Добавляем логотип, если он есть
            if (organizationLogo) {
                formData.append('logo', organizationLogo);
            }
            
            const response = await api.post('/api/users/create-organization-request', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            setOrganizationSuccess('Заявка успешно отправлена! Мы свяжемся с вами в течение 1-3 рабочих дней.');
            
            // Очищаем форму
            setOrganizationData({
                organizationName: '',
                description: '',
                websiteUrl: '',
                vkUrl: '',
                telegramUrl: ''
            });
            removeOrganizationLogo();
            
            // Обновляем статус заявки
            fetchOrganizationRequest();
            
        } catch (err) {
            setOrganizationError(err.response?.data?.error || 'Не удалось отправить заявку');
        } finally {
            setIsSubmittingOrganization(false);
        }
    };

    // Функция для загрузки организаций пользователя
    const fetchUserOrganizations = async () => {
        setLoadingOrganizations(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/organizers/user/my-organizations', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUserOrganizations(response.data || []);
        } catch (err) {
            // Просто устанавливаем пустой массив
            setUserOrganizations([]);
        } finally {
            setLoadingOrganizations(false);
        }
    };

    // Функция для проверки статуса заявки на организацию
    const fetchOrganizationRequest = async () => {
        setLoadingRequest(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/users/organization-request-status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOrganizationRequest(response.data);
        } catch (err) {
            // 404 для заявки - это нормально, заявки может не быть
            setOrganizationRequest(null);
        } finally {
            setLoadingRequest(false);
        }
    };

    // Функции для работы с турнирами игрока
    const fetchUserTournaments = async () => {
        setLoadingTournaments(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/users/tournaments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUserTournaments(response.data);
        } catch (err) {
            console.error('Ошибка загрузки турниров пользователя:', err);
            setUserTournaments([]);
        } finally {
            setLoadingTournaments(false);
        }
    };

    const handleTournamentFilterChange = (e) => {
        const { name, value } = e.target;
        setTournamentFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleTournamentSort = (field) => {
        setTournamentSort((prev) => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const applyTournamentFilter = (field, value) => {
        setTournamentFilters((prev) => ({ ...prev, [field]: value }));
        setActiveTournamentFilter(null);
    };

    const clearTournamentFilter = (field) => {
        setTournamentFilters((prev) => ({ ...prev, [field]: field === 'start_date' ? null : '' }));
        setActiveTournamentFilter(null);
    };

    const clearAllTournamentFilters = () => {
        setTournamentFilters({
            game: '',
            name: '',
            format: '',
            status: '',
            start_date: null,
        });
        setActiveTournamentFilter(null);
    };

    const toggleTournamentFilter = (filterName) => {
        const newActiveFilter = activeTournamentFilter === filterName ? null : filterName;
        setActiveTournamentFilter(newActiveFilter);
    };

    const uniqueTournamentValues = (field) => {
        let values = [...new Set(userTournaments.map((t) => t[field]).filter(Boolean))].sort();
        return values;
    };

    const hasActiveTournamentFilters = () => {
        return tournamentFilters.game !== '' || tournamentFilters.name !== '' || tournamentFilters.format !== '' || 
               tournamentFilters.status !== '' || tournamentFilters.start_date !== null;
    };

    const filteredAndSortedUserTournaments = userTournaments
        .filter((tournament) => {
            return (
                (tournamentFilters.game === '' || tournament.game === tournamentFilters.game) &&
                (tournamentFilters.name === '' || tournament.name?.toLowerCase().includes(tournamentFilters.name.toLowerCase())) &&
                (tournamentFilters.format === '' || tournament.format === tournamentFilters.format) &&
                (tournamentFilters.status === '' || tournament.status === tournamentFilters.status) &&
                (tournamentFilters.start_date === null ||
                    new Date(tournament.start_date).toLocaleDateString('ru-RU') ===
                    tournamentFilters.start_date.toLocaleDateString('ru-RU'))
            );
        })
        .sort((a, b) => {
            if (!tournamentSort.field) return 0;
            if (tournamentSort.field === 'participant_count') {
                return tournamentSort.direction === 'asc'
                    ? a.participant_count - b.participant_count
                    : b.participant_count - a.participant_count;
            }
            if (tournamentSort.field === 'start_date') {
                return tournamentSort.direction === 'asc'
                    ? new Date(a.start_date) - new Date(b.start_date)
                    : new Date(b.start_date) - new Date(a.start_date);
            }
            return 0;
        });

    if (!user) return <div className="loading-spinner">Загрузка...</div>;

    return (
        <div className="profile-page">
            {/* Современный минималистичный дизайн */}
            <div className="profile-layout">
                {/* Левая панель с навигацией и основной информацией */}
                <aside className="profile-aside">
                    {/* Секция пользователя */}
                    <div className="user-section">
                        <div className="user-avatar-wrapper">
                            <img 
                                src={ensureHttps(avatar) || '/default-avatar.png'} 
                                alt="User avatar" 
                                className="user-avatar"
                                onClick={openAvatarModal}
                            />
                            <button className="avatar-edit-btn" onClick={openAvatarModal}>
                                <span className="icon">✎</span>
                            </button>
                            {user?.online_status === 'online' && (
                                <div className="online-indicator"></div>
                            )}
                        </div>
                        
                        <h1 className="user-name">{user?.username}</h1>
                        <p className="user-id">ID: {user?.id}</p>
                        
                        {/* Краткая статистика */}
                        <div className="user-quick-stats">
                            <div className="quick-stat">
                                <span className="stat-value">
                                    {stats ? (stats.solo.wins || 0) + (stats.team.wins || 0) : 0}
                                </span>
                                <span className="stat-label">Побед</span>
                            </div>
                            <div className="quick-stat">
                                <span className="stat-value">
                                    {stats?.tournaments ? stats.tournaments.length : 0}
                                </span>
                                <span className="stat-label">Турниров</span>
                            </div>
                            <div className="quick-stat">
                                <span className="stat-value">
                                    {(() => {
                                        if (!stats) return '0%';
                                        const totalWins = (stats.solo.wins || 0) + (stats.team.wins || 0);
                                        const totalMatches = totalWins + (stats.solo.losses || 0) + (stats.team.losses || 0);
                                        return totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) + '%' : '0%';
                                    })()}
                                </span>
                                <span className="stat-label">Винрейт</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Навигация */}
                    <nav className="profile-nav">
                        <button 
                            className={`nav-item ${activeTab === 'main' ? 'active' : ''}`}
                            onClick={() => switchTab('main')}
                        >
                            <span className="nav-icon">⚙</span>
                            <span className="nav-text">Настройки</span>
                        </button>
                        <button 
                            className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
                            onClick={() => switchTab('stats')}
                        >
                            <span className="nav-icon">📊</span>
                            <span className="nav-text">Статистика</span>
                        </button>
                        <button 
                            className={`nav-item ${activeTab === 'friends' ? 'active' : ''}`}
                            onClick={() => switchTab('friends')}
                        >
                            <span className="nav-icon">👥</span>
                            <span className="nav-text">Друзья</span>
                            {friendRequests.length > 0 && (
                                <span className="nav-badge">{friendRequests.length}</span>
                            )}
                        </button>
                        <button 
                            className={`nav-item ${activeTab === 'organization' ? 'active' : ''}`}
                            onClick={() => switchTab('organization')}
                        >
                            <span className="nav-icon">🏢</span>
                            <span className="nav-text">Организация</span>
                        </button>
                        <button 
                            className={`nav-item ${activeTab === 'tournaments' ? 'active' : ''}`}
                            onClick={() => switchTab('tournaments')}
                        >
                            <span className="nav-icon">🏆</span>
                            <span className="nav-text">Турниры</span>
                        </button>
                        <button 
                            className={`nav-item ${activeTab === 'v4analytics' ? 'active' : ''}`}
                            onClick={() => switchTab('v4analytics')}
                        >
                            <span className="nav-icon">🔥</span>
                            <span className="nav-text">Аналитика V4</span>
                            <span className="nav-badge new">NEW</span>
                        </button>
                    </nav>
                    
                    {/* Статус аккаунта */}
                    <div className="account-status">
                        <h3 className="status-title">Статус аккаунта</h3>
                        <div className="status-items">
                            <div className={`status-item ${user?.email ? 'connected' : ''}`}>
                                <span className="status-icon">✉</span>
                                <span className="status-text">
                                    {user?.email ? 'Email привязан' : 'Email не привязан'}
                                </span>
                            </div>
                            <div className={`status-item ${user?.steam_id ? 'connected' : ''}`}>
                                <span className="status-icon">🎮</span>
                                <span className="status-text">
                                    {user?.steam_id ? 'Steam привязан' : 'Steam не привязан'}
                                </span>
                            </div>
                            <div className={`status-item ${user?.faceit_id ? 'connected' : ''}`}>
                                <span className="status-icon">🎯</span>
                                <span className="status-text">
                                    {user?.faceit_id ? 'FACEIT привязан' : 'FACEIT не привязан'}
                                </span>
                            </div>
                        </div>
                    </div>
                </aside>
                
                {/* Основной контент */}
                <main className="profile-main">
                    {/* Уведомления */}
                    {error && (
                        <div className="notification error">
                            <span className="notification-icon">⚠</span>
                            <span className="notification-text">{error}</span>
                            <button className="notification-close" onClick={() => setError('')}>×</button>
                        </div>
                    )}
                    
                    {!user?.email && (
                        <div className="notification warning">
                            <span className="notification-icon">⚠</span>
                            <div className="notification-content">
                                <strong>Внимание!</strong> 
                                <p>У вас не указан email. Вы не можете создавать и администрировать турниры.</p>
                            </div>
                            <button className="notification-action" onClick={openAddEmailModal}>
                                Привязать email
                            </button>
                        </div>
                    )}
                    
                    {user?.email && !user?.is_verified && (
                        <div className="notification warning">
                            <span className="notification-icon">⚠</span>
                            <div className="notification-content">
                                <strong>Внимание!</strong>
                                <p>Ваш email не подтвержден. Вы не можете создавать и администрировать турниры.</p>
                            </div>
                            <button className="notification-action" onClick={openEmailVerificationModal}>
                                Подтвердить email
                            </button>
                        </div>
                    )}
                    
                    {/* Контент вкладок */}
                    <div className="tab-content">
                        {/* Вкладка Настройки */}
                        {activeTab === 'main' && (
                            <div className="settings-tab">
                                <header className="tab-header">
                                    <h2 className="tab-title">Настройки профиля</h2>
                                </header>
                                
                                <div className="settings-sections">
                                    {/* Основная информация */}
                                    <section className="settings-section">
                                        <h3 className="section-title">Основная информация</h3>
                                        <div className="settings-card">
                                            <div className="setting-item">
                                                <label className="setting-label">Имя пользователя</label>
                                                <div className="setting-control">
                                                    <input
                                                        type="text"
                                                        className="setting-input"
                                                        value={newUsername}
                                                        onChange={(e) => setNewUsername(e.target.value)}
                                                        placeholder="Введите новый никнейм"
                                                    />
                                                    <div className="setting-actions">
                                                        <button className="btn btn-primary" onClick={updateUsername}>
                                                            Изменить
                                                        </button>
                                                        {user?.steam_id && (
                                                            <button className="btn btn-secondary" onClick={fetchAndSetSteamNickname}>
                                                                Использовать Steam
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="setting-item">
                                                <label className="setting-label">Email</label>
                                                <div className="setting-control">
                                                    <div className="setting-value">
                                                        {user?.email || 'Не указан'}
                                                        {user?.email && (
                                                            <span className={`verification-badge ${user.is_verified ? 'verified' : 'unverified'}`}>
                                                                {user.is_verified ? '✓ Подтвержден' : '⚠ Не подтвержден'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="setting-actions">
                                                        {!user?.email ? (
                                                            <button className="btn btn-primary" onClick={openAddEmailModal}>
                                                                Привязать email
                                                            </button>
                                                        ) : !user.is_verified && (
                                                            <button className="btn btn-primary" onClick={openEmailVerificationModal}>
                                                                Подтвердить email
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                    
                                    {/* Интеграции */}
                                    <section className="settings-section">
                                        <h3 className="section-title">Интеграции</h3>
                                        
                                        <div className="integration-card">
                                            <div className="integration-header">
                                                <div className="integration-info">
                                                    <img src="/steam-icon.svg" alt="Steam" className="integration-icon" />
                                                    <div>
                                                        <h4 className="integration-name">Steam</h4>
                                                        <p className="integration-status">
                                                            {user?.steam_url ? (
                                                                <>
                                                                    Привязан: 
                                                                    <a href={user.steam_url} target="_blank" rel="noopener noreferrer" className="integration-link">
                                                                        {steamNickname || 'Загрузка...'}
                                                                    </a>
                                                                </>
                                                            ) : (
                                                                'Не привязан'
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="integration-actions">
                                                    {!user?.steam_url ? (
                                                        <button className="btn btn-primary" onClick={linkSteam}>
                                                            Привязать
                                                        </button>
                                                    ) : (
                                                        <button className="btn btn-danger" onClick={unlinkSteam}>
                                                            Отвязать
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="integration-card">
                                            <div className="integration-header">
                                                <div className="integration-info">
                                                    <img src="/faceit-icon.svg" alt="FACEIT" className="integration-icon" />
                                                    <div>
                                                        <h4 className="integration-name">FACEIT</h4>
                                                        <p className="integration-status">
                                                            {user?.faceit_id ? (
                                                                <>
                                                                    Привязан: 
                                                                    {isLoadingFaceitInfo ? (
                                                                        'Загрузка...'
                                                                    ) : faceitInfo ? (
                                                                        <a href={faceitInfo.faceitUrl} target="_blank" rel="noopener noreferrer" className="integration-link">
                                                                            {faceitInfo.faceitNickname}
                                                                        </a>
                                                                    ) : (
                                                                        user.faceit_id
                                                                    )}
                                                                </>
                                                            ) : (
                                                                'Не привязан'
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="integration-actions">
                                                    {!user?.faceit_id ? (
                                                        <button className="btn btn-primary" onClick={linkFaceit}>
                                                            Привязать
                                                        </button>
                                                    ) : (
                                                        <button className="btn btn-danger" onClick={unlinkFaceit}>
                                                            Отвязать
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}
                        
                        {/* Вкладка Статистика */}
                        {activeTab === 'stats' && (
                            <div className="stats-tab">
                                <header className="tab-header">
                                    <h2 className="tab-title">Статистика</h2>
                                    {(isRecalculating || recalculationStatus || recalculationError) && (
                                        <div className="recalculation-status">
                                            {isRecalculating && (
                                                <div className="status-message loading">
                                                    <span className="status-icon">⟳</span>
                                                    {recalculationStatus || 'Обновление статистики...'}
                                                </div>
                                            )}
                                            {!isRecalculating && recalculationStatus && (
                                                <div className="status-message success">
                                                    {recalculationStatus}
                                                </div>
                                            )}
                                            {recalculationError && (
                                                <div className="status-message error">
                                                    {recalculationError}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </header>
                                
                                {/* Общая статистика */}
                                <section className="stats-overview">
                                    <div className="stats-grid">
                                        <div className="stat-card">
                                            <div className="stat-icon">🎮</div>
                                            <div className="stat-content">
                                                <div className="stat-number">
                                                    {stats ? (stats.solo.wins || 0) + (stats.solo.losses || 0) + (stats.team.wins || 0) + (stats.team.losses || 0) : 0}
                                                </div>
                                                <div className="stat-description">Всего матчей</div>
                                            </div>
                                        </div>
                                        
                                        <div className="stat-card">
                                            <div className="stat-icon">🏆</div>
                                            <div className="stat-content">
                                                <div className="stat-number">
                                                    {stats?.tournaments ? stats.tournaments.length : 0}
                                                </div>
                                                <div className="stat-description">Турниров сыграно</div>
                                            </div>
                                        </div>
                                        
                                        <div className="stat-card">
                                            <div className="stat-icon">🥇</div>
                                            <div className="stat-content">
                                                <div className="stat-number">
                                                    {stats?.tournaments ? stats.tournaments.filter(t => t.result === 'Победитель').length : 0}
                                                </div>
                                                <div className="stat-description">Турниров выиграно</div>
                                            </div>
                                        </div>
                                        
                                        <div className="stat-card">
                                            <div className="stat-icon">📈</div>
                                            <div className="stat-content">
                                                <div className="stat-number">
                                                    {(() => {
                                                        if (!stats) return '0%';
                                                        const totalWins = (stats.solo.wins || 0) + (stats.team.wins || 0);
                                                        const totalMatches = totalWins + (stats.solo.losses || 0) + (stats.team.losses || 0);
                                                        return totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) + '%' : '0%';
                                                    })()}
                                                </div>
                                                <div className="stat-description">Общий винрейт</div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                                
                                {/* Последние матчи */}
                                <section className="recent-matches-section">
                                    <h3 className="section-title">Последние матчи</h3>
                                    {renderLastFiveMatches()}
                                </section>
                                
                                {/* Статистика по играм */}
                                {stats?.byGame && Object.keys(stats.byGame).length > 0 && (
                                    <section className="game-stats-section">
                                        <h3 className="section-title">Статистика по играм</h3>
                                        <div className="game-stats-grid">
                                            {Object.entries(stats.byGame).map(([game, gameStats]) => {
                                                const totalSolo = gameStats.solo.wins + gameStats.solo.losses;
                                                const totalTeam = gameStats.team.wins + gameStats.team.losses;
                                                const soloWinRate = totalSolo > 0 ? ((gameStats.solo.wins / totalSolo) * 100).toFixed(1) : 0;
                                                const teamWinRate = totalTeam > 0 ? ((gameStats.team.wins / totalTeam) * 100).toFixed(1) : 0;
                                                
                                                return (
                                                    <div key={game} className="game-stat-card">
                                                        <div className="game-stat-header">
                                                            <h4 className="game-name">{game}</h4>
                                                        </div>
                                                        <div className="game-stat-content">
                                                            <div className="game-mode">
                                                                <h5>Solo</h5>
                                                                <div className="mode-stats">
                                                                    <div className="mode-stat">
                                                                        <span className="mode-stat-value">{gameStats.solo.wins}</span>
                                                                        <span className="mode-stat-label">Побед</span>
                                                                    </div>
                                                                    <div className="mode-stat">
                                                                        <span className="mode-stat-value">{gameStats.solo.losses}</span>
                                                                        <span className="mode-stat-label">Поражений</span>
                                                                    </div>
                                                                    <div className="mode-stat">
                                                                        <span className="mode-stat-value">{soloWinRate}%</span>
                                                                        <span className="mode-stat-label">Винрейт</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="game-mode">
                                                                <h5>Team</h5>
                                                                <div className="mode-stats">
                                                                    <div className="mode-stat">
                                                                        <span className="mode-stat-value">{gameStats.team.wins}</span>
                                                                        <span className="mode-stat-label">Побед</span>
                                                                    </div>
                                                                    <div className="mode-stat">
                                                                        <span className="mode-stat-value">{gameStats.team.losses}</span>
                                                                        <span className="mode-stat-label">Поражений</span>
                                                                    </div>
                                                                    <div className="mode-stat">
                                                                        <span className="mode-stat-value">{teamWinRate}%</span>
                                                                        <span className="mode-stat-label">Винрейт</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}
                                
                                {/* CS2 Stats */}
                                {user?.steam_url && (
                                    <section className="cs2-stats-section">
                                        <div className="section-header">
                                            <h3 className="section-title">Статистика CS2</h3>
                                            {premierRank > 0 && (
                                                <button 
                                                    className="btn btn-secondary btn-sm" 
                                                    onClick={() => fetchCs2Stats()}
                                                    disabled={isLoadingCs2Stats}
                                                >
                                                    {isLoadingCs2Stats ? 'Загрузка...' : 'Обновить'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="cs2-stats-content">
                                            {renderRankGroups()}
                                        </div>
                                    </section>
                                )}
                                
                                {/* FACEIT Stats */}
                                {faceitInfo && faceitInfo.elo > 0 && (
                                    <section className="faceit-stats-section">
                                        <h3 className="section-title">
                                            Статистика FACEIT{faceitInfo.statsFrom === 'csgo' ? ' (CS:GO)' : ''}
                                        </h3>
                                        <div className="faceit-stats-content">
                                            <div className="faceit-main-stats">
                                                <div className="faceit-stat">
                                                    <span className="faceit-stat-value">{faceitInfo.elo}</span>
                                                    <span className="faceit-stat-label">ELO</span>
                                                </div>
                                                <div className="faceit-stat">
                                                    <span className="faceit-stat-value">{faceitInfo.level}</span>
                                                    <span className="faceit-stat-label">Уровень</span>
                                                </div>
                                            </div>
                                            {faceitInfo.stats && (
                                                <div className="faceit-detailed-stats">
                                                    <div className="faceit-detail-stat">
                                                        <span className="detail-label">Матчи:</span>
                                                        <span className="detail-value">{faceitInfo.stats.Matches || 0}</span>
                                                    </div>
                                                    <div className="faceit-detail-stat">
                                                        <span className="detail-label">Винрейт:</span>
                                                        <span className="detail-value">{faceitInfo.stats['Win Rate %'] || '0'}%</span>
                                                    </div>
                                                    <div className="faceit-detail-stat">
                                                        <span className="detail-label">K/D:</span>
                                                        <span className="detail-value">{faceitInfo.stats['Average K/D Ratio'] || '0'}</span>
                                                    </div>
                                                    <div className="faceit-detail-stat">
                                                        <span className="detail-label">HS %:</span>
                                                        <span className="detail-value">{faceitInfo.stats['Average Headshots %'] || '0'}%</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                )}
                                
                                {/* Dota 2 Stats */}
                                <section className="dota-stats-section">
                                    <div className="section-header">
                                        <h3 className="section-title">Статистика Dota 2</h3>
                                        {!dotaProfile && user?.steam_id && (
                                            <button 
                                                className="btn btn-secondary btn-sm" 
                                                onClick={linkDotaSteam}
                                                disabled={isLoadingDotaStats}
                                            >
                                                {isLoadingDotaStats ? 'Загрузка...' : 'Загрузить статистику'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="dota-stats-content">
                                        {isLoadingDotaStats ? (
                                            <div className="loading-state">
                                                <div className="loading-spinner"></div>
                                                <p>Загрузка статистики Dota 2...</p>
                                            </div>
                                        ) : dotaStats ? (
                                            <div className="dota-stats-container">
                                                {/* Профиль игрока */}
                                                <div className="dota-profile-card">
                                                    <img 
                                                        src={dotaStats.profile?.avatarfull || '/default-avatar.png'} 
                                                        alt="Steam Avatar" 
                                                        className="dota-player-avatar" 
                                                    />
                                                    <div className="dota-player-info">
                                                        <h4>{dotaStats.profile?.personaname || 'Неизвестно'}</h4>
                                                        <p className="dota-account-id">Account ID: {dotaStats.profile?.account_id}</p>
                                                        {dotaStats.profile?.rank_tier && (
                                                            <p className="dota-rank">Медаль: {dotaStats.profile.rank_tier}</p>
                                                        )}
                                                        {dotaStats.profile?.mmr_estimate && (
                                                            <p className="dota-mmr">MMR: ~{dotaStats.profile.mmr_estimate}</p>
                                                        )}
                                                    </div>
                                                    <button 
                                                        className="btn btn-danger btn-sm"
                                                        onClick={unlinkDotaSteam}
                                                    >
                                                        Отвязать
                                                    </button>
                                                </div>

                                                {/* Общая статистика */}
                                                <div className="dota-general-stats">
                                                    <div className="dota-stat">
                                                        <span className="dota-stat-value">{dotaStats.stats?.win || 0}</span>
                                                        <span className="dota-stat-label">Побед</span>
                                                    </div>
                                                    <div className="dota-stat">
                                                        <span className="dota-stat-value">{dotaStats.stats?.lose || 0}</span>
                                                        <span className="dota-stat-label">Поражений</span>
                                                    </div>
                                                    <div className="dota-stat">
                                                        <span className="dota-stat-value">{dotaStats.stats?.winrate || 0}%</span>
                                                        <span className="dota-stat-label">Винрейт</span>
                                                    </div>
                                                </div>

                                                {/* Последние матчи */}
                                                {dotaStats.recent_matches && dotaStats.recent_matches.length > 0 && (
                                                    <div className="dota-recent-matches">
                                                        <h5>Последние матчи</h5>
                                                        <div className="dota-matches-list">
                                                            {dotaStats.recent_matches.slice(0, 5).map((match, index) => (
                                                                <div key={index} className={`dota-match ${match.win ? 'win' : 'loss'}`}>
                                                                    <img 
                                                                        src={getHeroImageUrl(match.hero_id)} 
                                                                        alt={`Hero ${match.hero_id}`}
                                                                        className="dota-hero-icon"
                                                                        onError={(e) => {
                                                                            e.target.src = '/default-hero.png';
                                                                        }}
                                                                    />
                                                                    <div className="dota-match-kda">{match.kills}/{match.deaths}/{match.assists}</div>
                                                                    <div className="dota-match-duration">
                                                                        {Math.floor(match.duration / 60)}:{(match.duration % 60).toString().padStart(2, '0')}
                                                                    </div>
                                                                    <div className="dota-match-result">
                                                                        {match.win ? 'Победа' : 'Поражение'}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Топ героев */}
                                                {dotaStats.top_heroes && dotaStats.top_heroes.length > 0 && (
                                                    <div className="dota-top-heroes">
                                                        <h5>Топ героев</h5>
                                                        <div className="dota-heroes-grid">
                                                            {dotaStats.top_heroes.slice(0, 5).map((hero, index) => (
                                                                <div key={index} className="dota-hero-card">
                                                                    <img 
                                                                        src={getHeroImageUrl(hero.hero_id)} 
                                                                        alt={`Hero ${hero.hero_id}`}
                                                                        className="dota-hero-image"
                                                                        onError={(e) => {
                                                                            e.target.src = '/default-hero.png';
                                                                        }}
                                                                    />
                                                                    <div className="dota-hero-stats">
                                                                        <div className="hero-stat">
                                                                            <span className="hero-stat-value">{hero.games}</span>
                                                                            <span className="hero-stat-label">Игр</span>
                                                                        </div>
                                                                        <div className="hero-stat">
                                                                            <span className="hero-stat-value">{hero.winrate}%</span>
                                                                            <span className="hero-stat-label">Винрейт</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : !user?.steam_id ? (
                                            <div className="empty-state">
                                                <p>Для отображения статистики Dota 2 необходимо привязать Steam аккаунт</p>
                                                <p className="empty-state-hint">Перейдите в раздел "Настройки" и привяжите Steam</p>
                                            </div>
                                        ) : (
                                            <div className="empty-state">
                                                <p>Статистика Dota 2 не загружена</p>
                                                <p className="empty-state-hint">Нажмите "Загрузить статистику" для получения данных</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                                
                                {/* V4 Dashboard */}
                                <V4StatsDashboard
                                    v4Data={v4Data}
                                    stats={stats}
                                    requestEnhancedRecalculation={requestEnhancedRecalculation}
                                    isRecalculating={isRecalculating}
                                    recalculationStatus={recalculationStatus}
                                    recalculationError={recalculationError}
                                />
                            </div>
                        )}
                        
                        {/* V4 Analytics Tab */}
                        {activeTab === 'v4analytics' && (
                            <div className="v4-analytics-tab">
                                <header className="tab-header">
                                    <h2 className="tab-title">
                                        🔥 Аналитика V4 ULTIMATE
                                        <span className="v4-badge">ULTIMATE</span>
                                    </h2>
                                </header>
                                
                                <div className="v4-content">
                                    <V4StatsDashboard
                                        v4Data={v4Data}
                                        stats={stats}
                                        requestEnhancedRecalculation={requestEnhancedRecalculation}
                                        isRecalculating={isRecalculating}
                                        recalculationStatus={recalculationStatus}
                                        recalculationError={recalculationError}
                                    />
                                </div>
                            </div>
                        )}
                        
                        {/* Friends Tab */}
                        {activeTab === 'friends' && (
                            <div className="friends-tab">
                                <header className="tab-header">
                                    <h2 className="tab-title">Друзья</h2>
                                </header>
                                
                                {/* Поиск друзей */}
                                <section className="friends-search-section">
                                    <div className="search-container">
                                        <div className="search-input-wrapper">
                                            <span className="search-icon">🔍</span>
                                            <input
                                                type="text"
                                                className="search-input"
                                                placeholder="Поиск пользователя по нику..."
                                                value={searchQuery}
                                                onChange={handleSearchChange}
                                            />
                                        </div>
                                        
                                        {/* Результаты поиска */}
                                        {searchResults.length > 0 && (
                                            <div className="search-results">
                                                {searchResults.map(user => (
                                                    <div key={user.id} className="search-result-item">
                                                        <img
                                                            src={ensureHttps(user.avatar_url) || '/default-avatar.png'}
                                                            alt={user.username}
                                                            className="search-result-avatar"
                                                        />
                                                        <div className="search-result-info">
                                                            <a href={`/user/${user.id}`} className="search-result-name">
                                                                {user.username}
                                                            </a>
                                                        </div>
                                                        <div className="search-result-action">
                                                            {user.requestSent ? (
                                                                <button className="btn btn-secondary btn-sm" disabled>
                                                                    Заявка отправлена
                                                                </button>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => sendFriendRequest(user.id)} 
                                                                    className="btn btn-primary btn-sm"
                                                                >
                                                                    Добавить
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && searchPerformed && (
                                            <div className="search-empty">
                                                <p>Пользователи не найдены</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                                
                                {/* Заявки в друзья */}
                                {friendRequests.length > 0 && (
                                    <section className="friend-requests-section">
                                        <h3 className="section-title">Входящие заявки ({friendRequests.length})</h3>
                                        <div className="friend-requests-list">
                                            {friendRequests.map(request => (
                                                <div key={request.id} className="friend-request-item">
                                                    <img
                                                        src={ensureHttps(request.user.avatar_url) || '/default-avatar.png'}
                                                        alt={request.user.username}
                                                        className="friend-request-avatar"
                                                    />
                                                    <div className="friend-request-info">
                                                        <a href={`/user/${request.user.id}`} className="friend-request-name">
                                                            {request.user.username}
                                                        </a>
                                                    </div>
                                                    <div className="friend-request-actions">
                                                        <button 
                                                            className="btn btn-success btn-sm" 
                                                            onClick={() => acceptFriendRequest(request.id)}
                                                        >
                                                            Принять
                                                        </button>
                                                        <button 
                                                            className="btn btn-danger btn-sm" 
                                                            onClick={() => rejectFriendRequest(request.id)}
                                                        >
                                                            Отклонить
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                
                                {/* Исходящие заявки */}
                                {sentFriendRequests.length > 0 && (
                                    <section className="sent-requests-section">
                                        <h3 className="section-title">Исходящие заявки ({sentFriendRequests.length})</h3>
                                        <div className="sent-requests-list">
                                            {sentFriendRequests.map(request => (
                                                <div key={request.id} className="sent-request-item">
                                                    <img
                                                        src={ensureHttps(request.user.avatar_url) || '/default-avatar.png'}
                                                        alt={request.user.username}
                                                        className="sent-request-avatar"
                                                    />
                                                    <div className="sent-request-info">
                                                        <a href={`/user/${request.user.id}`} className="sent-request-name">
                                                            {request.user.username}
                                                        </a>
                                                    </div>
                                                    <div className="sent-request-actions">
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            onClick={() => cancelSentFriendRequest(request.id)}
                                                        >
                                                            Отменить
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                
                                {/* Список друзей */}
                                <section className="friends-list-section">
                                    <h3 className="section-title">Мои друзья ({friends.length})</h3>
                                    {loadingFriends ? (
                                        <div className="loading-state">
                                            <div className="loading-spinner"></div>
                                            <p>Загрузка списка друзей...</p>
                                        </div>
                                    ) : friends.length > 0 ? (
                                        <div className="friends-grid">
                                            {friends.map(friend => (
                                                <div key={friend.id} className="friend-card">
                                                    <div className="friend-avatar-wrapper">
                                                        <img 
                                                            src={ensureHttps(friend.friend.avatar_url) || '/default-avatar.png'} 
                                                            alt={friend.friend.username} 
                                                            className="friend-avatar"
                                                        />
                                                        <div className={`friend-status-indicator ${friend.friend.online_status || 'offline'}`}></div>
                                                    </div>
                                                    <div className="friend-info">
                                                        <a 
                                                            href={isCurrentUser(friend.friend.id) ? `/profile` : `/user/${friend.friend.id}`} 
                                                            className="friend-name"
                                                        >
                                                            {friend.friend.username}
                                                        </a>
                                                        <p className="friend-status">
                                                            {friend.friend.online_status === 'online' ? 'Онлайн' : 
                                                             friend.friend.last_online ? 
                                                             `Был в сети: ${new Date(friend.friend.last_online).toLocaleDateString('ru-RU')}` : 
                                                             'Не в сети'}
                                                        </p>
                                                    </div>
                                                    <button 
                                                        className="friend-remove-btn" 
                                                        onClick={() => removeFriend(friend.friend.id)}
                                                        title="Удалить из друзей"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            <div className="empty-icon">👥</div>
                                            <p>У вас пока нет друзей</p>
                                            <p className="empty-state-hint">Используйте поиск выше, чтобы найти и добавить друзей</p>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}
                        
                        {/* Organization Tab */}
                        {activeTab === 'organization' && (
                            <div className="organization-tab">
                                <header className="tab-header">
                                    <h2 className="tab-title">Организации</h2>
                                </header>
                                
                                {loadingOrganizations || loadingRequest ? (
                                    <div className="loading-state">
                                        <div className="loading-spinner"></div>
                                        <p>Загрузка информации об организациях...</p>
                                    </div>
                                ) : userOrganizations && userOrganizations.length > 0 ? (
                                    <section className="my-organizations-section">
                                        <h3 className="section-title">Мои организации</h3>
                                        <div className="organizations-grid">
                                            {userOrganizations.map(org => (
                                                <div key={org.id} className="organization-card">
                                                    <div className="org-header">
                                                        <img 
                                                            src={ensureHttps(org.logo_url) || '/default-org-logo.png'}
                                                            alt={org.name}
                                                            className="org-logo"
                                                        />
                                                        <div className="org-info">
                                                            <h4 className="org-name">
                                                                <a href={`/organizer/${org.slug}`} target="_blank" rel="noopener noreferrer">
                                                                    {org.name}
                                                                </a>
                                                            </h4>
                                                            <p className="org-role">
                                                                {org.role === 'manager' ? 'Менеджер' : 
                                                                 org.role === 'admin' ? 'Администратор' : 'Участник'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="org-stats">
                                                        <div className="org-stat">
                                                            <span className="org-stat-value">{org.tournaments_count}</span>
                                                            <span className="org-stat-label">Турниров</span>
                                                        </div>
                                                        <div className="org-stat">
                                                            <span className="org-stat-value">
                                                                {new Date(org.joined_at).toLocaleDateString('ru-RU')}
                                                            </span>
                                                            <span className="org-stat-label">Состою с</span>
                                                        </div>
                                                    </div>
                                                    {org.description && (
                                                        <p className="org-description">{org.description}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                ) : organizationRequest ? (
                                    <section className="organization-request-section">
                                        <div className="request-status-card">
                                            <div className="request-header">
                                                <h3>{organizationRequest.organization_name}</h3>
                                                <span className={`status-badge ${organizationRequest.status}`}>
                                                    {organizationRequest.status === 'pending' && 'На рассмотрении'}
                                                    {organizationRequest.status === 'approved' && 'Одобрена'}
                                                    {organizationRequest.status === 'rejected' && 'Отклонена'}
                                                </span>
                                            </div>
                                            <div className="request-details">
                                                <p><strong>Описание:</strong> {organizationRequest.description}</p>
                                                <p><strong>Дата подачи:</strong> {new Date(organizationRequest.created_at).toLocaleDateString('ru-RU')}</p>
                                                {organizationRequest.reviewed_at && (
                                                    <p><strong>Дата рассмотрения:</strong> {new Date(organizationRequest.reviewed_at).toLocaleDateString('ru-RU')}</p>
                                                )}
                                                {organizationRequest.admin_comment && (
                                                    <div className="admin-comment">
                                                        <p><strong>Комментарий администратора:</strong></p>
                                                        <p className="comment-text">{organizationRequest.admin_comment}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>
                                ) : (
                                    <section className="create-organization-section">
                                        <div className="section-intro">
                                            <h3 className="section-title">Создать организацию</h3>
                                            <p>Заполните форму ниже, чтобы подать заявку на создание аккаунта организации.</p>
                                        </div>
                                        
                                        {/* Проверка требований */}
                                        {!user?.email && (
                                            <div className="requirement-alert error">
                                                <span className="alert-icon">⚠</span>
                                                <div className="alert-content">
                                                    <h4>Требования не выполнены</h4>
                                                    <p>Для подачи заявки необходимо привязать email к аккаунту.</p>
                                                </div>
                                                <button className="btn btn-primary" onClick={openAddEmailModal}>
                                                    Привязать email
                                                </button>
                                            </div>
                                        )}
                                        
                                        {user?.email && !user?.is_verified && (
                                            <div className="requirement-alert error">
                                                <span className="alert-icon">⚠</span>
                                                <div className="alert-content">
                                                    <h4>Требования не выполнены</h4>
                                                    <p>Для подачи заявки необходимо подтвердить email.</p>
                                                </div>
                                                <button className="btn btn-primary" onClick={openEmailVerificationModal}>
                                                    Подтвердить email
                                                </button>
                                            </div>
                                        )}
                                        
                                        {/* Форма создания организации */}
                                        {user?.email && user?.is_verified && (
                                            <form onSubmit={submitOrganizationRequest} className="organization-form">
                                                {organizationError && (
                                                    <div className="form-error">
                                                        <span className="error-icon">⚠</span>
                                                        {organizationError}
                                                    </div>
                                                )}
                                                
                                                {organizationSuccess && (
                                                    <div className="form-success">
                                                        <span className="success-icon">✓</span>
                                                        {organizationSuccess}
                                                    </div>
                                                )}
                                                
                                                <div className="form-group">
                                                    <label className="form-label">
                                                        Название организации <span className="required">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        name="organizationName"
                                                        value={organizationData.organizationName}
                                                        onChange={handleOrganizationInputChange}
                                                        placeholder="Введите название вашей организации"
                                                        required
                                                    />
                                                </div>
                                                
                                                <div className="form-group">
                                                    <label className="form-label">
                                                        Описание <span className="required">*</span>
                                                    </label>
                                                    <textarea
                                                        className="form-textarea"
                                                        name="description"
                                                        value={organizationData.description}
                                                        onChange={handleOrganizationInputChange}
                                                        placeholder="Расскажите о вашей организации..."
                                                        rows="4"
                                                        required
                                                    />
                                                </div>
                                                
                                                <div className="form-group">
                                                    <label className="form-label">Логотип организации</label>
                                                    <div className="logo-upload-area">
                                                        <input 
                                                            type="file" 
                                                            ref={organizationFileInputRef}
                                                            onChange={handleOrganizationLogoChange}
                                                            accept="image/*"
                                                            style={{ display: 'none' }}
                                                        />
                                                        
                                                        {organizationLogoPreview ? (
                                                            <div className="logo-preview">
                                                                <img 
                                                                    src={organizationLogoPreview} 
                                                                    alt="Логотип" 
                                                                    className="logo-preview-image"
                                                                />
                                                                <div className="logo-actions">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={triggerOrganizationFileInput}
                                                                        className="btn btn-secondary btn-sm"
                                                                    >
                                                                        Изменить
                                                                    </button>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={removeOrganizationLogo}
                                                                        className="btn btn-danger btn-sm"
                                                                    >
                                                                        Удалить
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="logo-upload-placeholder" onClick={triggerOrganizationFileInput}>
                                                                <span className="upload-icon">📁</span>
                                                                <p>Нажмите для загрузки логотипа</p>
                                                                <p className="upload-hint">Рекомендуемый размер: 200x200px</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label className="form-label">Сайт организации</label>
                                                        <input
                                                            type="url"
                                                            className="form-input"
                                                            name="websiteUrl"
                                                            value={organizationData.websiteUrl}
                                                            onChange={handleOrganizationInputChange}
                                                            placeholder="https://example.com"
                                                        />
                                                    </div>
                                                    
                                                    <div className="form-group">
                                                        <label className="form-label">VK</label>
                                                        <input
                                                            type="url"
                                                            className="form-input"
                                                            name="vkUrl"
                                                            value={organizationData.vkUrl}
                                                            onChange={handleOrganizationInputChange}
                                                            placeholder="https://vk.com/..."
                                                        />
                                                    </div>
                                                    
                                                    <div className="form-group">
                                                        <label className="form-label">Telegram</label>
                                                        <input
                                                            type="url"
                                                            className="form-input"
                                                            name="telegramUrl"
                                                            value={organizationData.telegramUrl}
                                                            onChange={handleOrganizationInputChange}
                                                            placeholder="https://t.me/..."
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <button 
                                                    type="submit" 
                                                    className="btn btn-primary btn-lg btn-block"
                                                    disabled={isSubmittingOrganization}
                                                >
                                                    {isSubmittingOrganization ? 'Отправка...' : 'Отправить заявку'}
                                                </button>
                                                
                                                <div className="form-info">
                                                    <h4>Информация о процессе:</h4>
                                                    <ul>
                                                        <li>Заявки рассматриваются в течение 1-3 рабочих дней</li>
                                                        <li>После одобрения с вами свяжется администрация</li>
                                                        <li>Все поля со звездочкой (*) обязательны для заполнения</li>
                                                        <li>Логотип должен быть в формате PNG или JPG, до 5MB</li>
                                                    </ul>
                                                </div>
                                            </form>
                                        )}
                                    </section>
                                )}
                            </div>
                        )}
                        
                        {/* Tournaments Tab */}
                        {activeTab === 'tournaments' && (
                            <div className="tournaments-tab">
                                <header className="tab-header">
                                    <h2 className="tab-title">Турниры</h2>
                                    <div className="tab-controls">
                                        <div className="view-switcher">
                                            <button 
                                                className={`view-btn ${tournamentViewMode === 'table' ? 'active' : ''}`} 
                                                onClick={() => setTournamentViewMode('table')}
                                            >
                                                Таблица
                                            </button>
                                            <button 
                                                className={`view-btn ${tournamentViewMode === 'card' ? 'active' : ''}`} 
                                                onClick={() => setTournamentViewMode('card')}
                                            >
                                                Карточки
                                            </button>
                                        </div>
                                    </div>
                                </header>
                                
                                {/* Фильтры */}
                                <div className="tournaments-filters">
                                    <input
                                        type="text"
                                        placeholder="Поиск по названию..."
                                        value={tournamentFilters.name}
                                        onChange={(e) => setTournamentFilters({...tournamentFilters, name: e.target.value})}
                                        className="filter-input"
                                    />
                                    
                                    {hasActiveTournamentFilters() && (
                                        <button 
                                            onClick={clearAllTournamentFilters}
                                            className="clear-filters-btn"
                                        >
                                            Сбросить фильтры
                                        </button>
                                    )}
                                </div>
                                
                                {loadingTournaments ? (
                                    <div className="loading-state">
                                        <div className="loading-spinner"></div>
                                        <p>Загрузка турниров...</p>
                                    </div>
                                ) : filteredAndSortedUserTournaments.length > 0 ? (
                                    <>
                                        {tournamentViewMode === 'table' ? (
                                            <div className="tournaments-table-wrapper">
                                                <table className="tournaments-table">
                                                    <thead>
                                                        <tr>
                                                            <th 
                                                                className={tournamentFilters.game ? 'filtered' : ''}
                                                                onClick={() => toggleTournamentFilter('game')}
                                                            >
                                                                Игра {tournamentFilters.game && <span className="filter-active">✓</span>}
                                                            </th>
                                                            <th>Название</th>
                                                            <th onClick={() => handleTournamentSort('participant_count')}>
                                                                Участники
                                                                <span className="sort-icon">
                                                                    {tournamentSort.field === 'participant_count' && 
                                                                     (tournamentSort.direction === 'asc' ? '↑' : '↓')}
                                                                </span>
                                                            </th>
                                                            <th 
                                                                className={tournamentFilters.status ? 'filtered' : ''}
                                                                onClick={() => toggleTournamentFilter('status')}
                                                            >
                                                                Статус {tournamentFilters.status && <span className="filter-active">✓</span>}
                                                            </th>
                                                            <th onClick={() => handleTournamentSort('start_date')}>
                                                                Дата
                                                                <span className="sort-icon">
                                                                    {tournamentSort.field === 'start_date' && 
                                                                     (tournamentSort.direction === 'asc' ? '↑' : '↓')}
                                                                </span>
                                                            </th>
                                                            <th>Результат</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredAndSortedUserTournaments.map((tournament) => (
                                                            <tr key={tournament.id}>
                                                                <td>{tournament.game}</td>
                                                                <td>
                                                                    <a href={`/tournaments/${tournament.id}`} className="tournament-link">
                                                                        {tournament.name}
                                                                    </a>
                                                                </td>
                                                                <td>
                                                                    {tournament.max_participants
                                                                        ? `${tournament.participant_count} из ${tournament.max_participants}`
                                                                        : tournament.participant_count}
                                                                </td>
                                                                <td>
                                                                    <span className={`tournament-status ${tournament.status}`}>
                                                                        {tournament.status === 'active' ? 'Активен' : 
                                                                         tournament.status === 'in_progress' ? 'Идет' : 
                                                                         tournament.status === 'completed' ? 'Завершен' : 
                                                                         'Неизвестно'}
                                                                    </span>
                                                                </td>
                                                                <td>{new Date(tournament.start_date).toLocaleDateString('ru-RU')}</td>
                                                                <td>
                                                                    {tournament.tournament_result ? (
                                                                        <span className={`tournament-result ${
                                                                            tournament.tournament_result.toLowerCase().includes('победитель') ? 'winner' :
                                                                            tournament.tournament_result.toLowerCase().includes('место') ? 'top' :
                                                                            'participant'
                                                                        }`}>
                                                                            {tournament.tournament_result}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="tournament-result pending">
                                                                            {tournament.status === 'completed' ? 'Не указан' : 'В процессе'}
                                                                        </span>
                                                                    )}
                                                                    {tournament.wins !== undefined && tournament.losses !== undefined && (
                                                                        <span className="tournament-score">
                                                                            ({tournament.wins}W/{tournament.losses}L)
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                
                                                {/* Выпадающие фильтры */}
                                                {activeTournamentFilter === 'game' && (
                                                    <div className="filter-dropdown" ref={tournamentFilterRefs.game}>
                                                        {tournamentFilters.game && (
                                                            <div
                                                                onClick={() => clearTournamentFilter('game')}
                                                                className="filter-option clear"
                                                            >
                                                                ✕ Сбросить фильтр
                                                            </div>
                                                        )}
                                                        {uniqueTournamentValues('game').map((value) => (
                                                            <div
                                                                key={value}
                                                                onClick={() => applyTournamentFilter('game', value)}
                                                                className="filter-option"
                                                            >
                                                                {value}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                {activeTournamentFilter === 'status' && (
                                                    <div className="filter-dropdown" ref={tournamentFilterRefs.status}>
                                                        {tournamentFilters.status && (
                                                            <div
                                                                onClick={() => clearTournamentFilter('status')}
                                                                className="filter-option clear"
                                                            >
                                                                ✕ Сбросить фильтр
                                                            </div>
                                                        )}
                                                        {uniqueTournamentValues('status').map((value) => (
                                                            <div
                                                                key={value}
                                                                onClick={() => applyTournamentFilter('status', value)}
                                                                className="filter-option"
                                                            >
                                                                {value === 'active' ? 'Активен' : 
                                                                 value === 'in_progress' ? 'Идет' : 
                                                                 value === 'completed' ? 'Завершен' : 
                                                                 value}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="tournaments-cards">
                                                {filteredAndSortedUserTournaments.map((tournament) => (
                                                    <div key={tournament.id} className="tournament-card">
                                                        <div className="tournament-card-header">
                                                            <h3 className="tournament-name">
                                                                <a href={`/tournaments/${tournament.id}`}>
                                                                    {tournament.name}
                                                                </a>
                                                            </h3>
                                                            <span className={`tournament-status ${tournament.status}`}>
                                                                {tournament.status === 'active' ? 'Активен' : 
                                                                 tournament.status === 'in_progress' ? 'Идет' : 
                                                                 tournament.status === 'completed' ? 'Завершен' : 
                                                                 'Неизвестно'}
                                                            </span>
                                                        </div>
                                                        <div className="tournament-card-body">
                                                            <div className="tournament-detail">
                                                                <span className="detail-label">Игра:</span>
                                                                <span className="detail-value">{tournament.game}</span>
                                                            </div>
                                                            <div className="tournament-detail">
                                                                <span className="detail-label">Участники:</span>
                                                                <span className="detail-value">
                                                                    {tournament.max_participants
                                                                        ? `${tournament.participant_count} из ${tournament.max_participants}`
                                                                        : tournament.participant_count}
                                                                </span>
                                                            </div>
                                                            <div className="tournament-detail">
                                                                <span className="detail-label">Дата:</span>
                                                                <span className="detail-value">
                                                                    {new Date(tournament.start_date).toLocaleDateString('ru-RU')}
                                                                </span>
                                                            </div>
                                                            <div className="tournament-detail">
                                                                <span className="detail-label">Результат:</span>
                                                                <span className="detail-value">
                                                                    {tournament.tournament_result ? (
                                                                        <span className={`tournament-result ${
                                                                            tournament.tournament_result.toLowerCase().includes('победитель') ? 'winner' :
                                                                            tournament.tournament_result.toLowerCase().includes('место') ? 'top' :
                                                                            'participant'
                                                                        }`}>
                                                                            {tournament.tournament_result}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="tournament-result pending">
                                                                            {tournament.status === 'completed' ? 'Не указан' : 'В процессе'}
                                                                        </span>
                                                                    )}
                                                                    {tournament.wins !== undefined && tournament.losses !== undefined && (
                                                                        <span className="tournament-score">
                                                                            ({tournament.wins}W/{tournament.losses}L)
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="empty-state">
                                        <div className="empty-icon">🏆</div>
                                        <p>
                                            {userTournaments.length === 0 
                                                ? 'Вы еще не участвовали в турнирах'
                                                : 'Турниры не найдены. Попробуйте изменить фильтры.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
            
            {/* Все модальные окна остаются без изменений */}
            {showEmailVerificationModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeEmailVerificationModal}>
                    <div className="modal-content email-verification-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Подтверждение email</h3>
                        <p>На вашу почту {user.email} был отправлен 6-значный код. Введите его ниже:</p>
                        
                        <div className="code-input-container" onClick={handleCodeContainerClick}>
                            <input 
                                id="hidden-code-input"
                                className="code-input-hidden"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={verificationCode}
                                onChange={handleCodeChange}
                                onPaste={handleCodePaste}
                                autoFocus
                            />
                            <div className="code-display">
                                {[0, 1, 2, 3, 4, 5].map((index) => (
                                    <div 
                                        key={index} 
                                        className={`code-digit ${verificationCode[index] ? 'filled' : ''} ${index === verificationCode.length ? 'active' : ''}`}
                                    >
                                        {verificationCode[index] || ''}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {verificationError && (
                            <div className="verification-error">
                                {verificationError}
                            </div>
                        )}
                        
                        <div className="modal-buttons">
                            <button 
                                onClick={sendVerificationCode} 
                                disabled={isResendDisabled}
                            >
                                {localStorage.getItem('verification_code_sent') === 'true' ? 'Отправить повторно' : 'Отправить код'}
                                {isResendDisabled && (
                                    <span className="resend-countdown">
                                        {Math.floor(resendCountdown / 60)}:{(resendCountdown % 60).toString().padStart(2, '0')}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {showAddEmailModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeAddEmailModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Привязка email</h3>
                        <p>Пожалуйста, введите ваш email:</p>
                        
                        <input 
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="example@example.com"
                            className="email-input"
                            autoFocus
                        />
                        
                        {addEmailError && (
                            <div className="verification-error">
                                {addEmailError}
                            </div>
                        )}
                        
                        <div className="modal-buttons">
                            <button onClick={saveEmail}>Сохранить</button>
                            <button onClick={closeAddEmailModal}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <p>Твой никнейм в Steam "{steamNickname}", устанавливаем в качестве основного на профиль?</p>
                        <button onClick={confirmSteamNickname}>Да</button>
                        <button onClick={closeModal}>Нет</button>
                    </div>
                </div>
            )}
            
            {showEmailRequiredModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeEmailRequiredModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Необходима привязка email</h3>
                        <p>Для отвязки аккаунтов Steam или FACEIT необходимо сначала привязать электронную почту.</p>
                        <p>Это требуется для того, чтобы у вас сохранялся доступ к аккаунту.</p>
                        
                        <div className="modal-buttons">
                            <button onClick={() => {
                                closeEmailRequiredModal();
                                setTimeout(() => openAddEmailModal(), 350);
                            }}>Привязать email</button>
                            <button onClick={closeEmailRequiredModal}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showAvatarModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeAvatarModal}>
                    <div className="modal-content avatar-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Изменить аватар</h3>
                        
                        <div className="avatar-preview">
                            <img 
                                src={ensureHttps(avatar) || '/default-avatar.png'} 
                                alt="Текущий аватар" 
                                className="current-avatar"
                            />
                        </div>
                        
                        <div className="avatar-options">
                            <button 
                                onClick={triggerFileInput} 
                                disabled={uploadingAvatar}
                            >
                                {uploadingAvatar ? 'Загрузка...' : 'Загрузить свой аватар'}
                            </button>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleAvatarUpload} 
                                accept="image/*" 
                                style={{ display: 'none' }} 
                            />
                            
                            {user.steam_id && (
                                <button onClick={setAvatarFromSteam}>
                                    Установить аватар из Steam
                                </button>
                            )}
                            
                            {user.faceit_id && (
                                <button onClick={setAvatarFromFaceit}>
                                    Установить аватар из FACEIT
                                </button>
                            )}
                        </div>
                        
                        <button onClick={closeAvatarModal} className="close-modal-btn">
                            Закрыть
                        </button>
                    </div>
                </div>
            )}
            
            {showMatchHistoryModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeMatchHistoryModal}>
                    <div className="modal-content match-history-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>История матчей</h3>
                        
                        {loadingMatchHistory ? (
                            <p>Загрузка истории матчей...</p>
                        ) : (
                            <div className="full-match-history">
                                {matchHistory.length > 0 ? (
                                    <table className="match-history-table">
                                        <thead>
                                            <tr>
                                                <th>Дата</th>
                                                <th>Турнир</th>
                                                <th>Соперник</th>
                                                <th>Счет</th>
                                                <th>Результат</th>
                                                <th>Дисциплина</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matchHistory.map((match, index) => (
                                                <tr key={index} className={match.result === 'win' ? 'win' : 'loss'}>
                                                    <td>{new Date(match.date).toLocaleDateString()}</td>
                                                    <td>
                                                        <a href={`/tournament/${match.tournament_id}`}>
                                                            {match.tournament_name}
                                                        </a>
                                                    </td>
                                                    <td>{match.opponent}</td>
                                                    <td>{match.score}</td>
                                                    <td>
                                                        {match.result === 'win' ? 'Победа' : 'Поражение'}
                                                    </td>
                                                    <td>{match.discipline}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p>История матчей отсутствует</p>
                                )}
                            </div>
                        )}
                        
                        <button onClick={closeMatchHistoryModal} className="close-modal-btn">
                            Закрыть
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;