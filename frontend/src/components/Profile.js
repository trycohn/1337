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

    // 🏆 РАСШИРЕННАЯ СИСТЕМА ДОСТИЖЕНИЙ
    const [playerLevel, setPlayerLevel] = useState(1);
    const [playerXP, setPlayerXP] = useState(0);
    const [xpToNextLevel, setXpToNextLevel] = useState(1000);
    const [selectedAchievementCategory, setSelectedAchievementCategory] = useState('all');
    const [newAchievementsCount, setNewAchievementsCount] = useState(0);
    const [recentAchievementUnlocks, setRecentAchievementUnlocks] = useState([]);
    const [achievementProgress, setAchievementProgress] = useState({});
    const [weeklyAchievementTarget, setWeeklyAchievementTarget] = useState(null);
    const [dailyStreaks, setDailyStreaks] = useState({
        current: 0,
        longest: 0,
        lastActivity: null
    });

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

    // OpenDota константы героев (будем кэшировать)
    const [heroesData, setHeroesData] = useState(null);
    const [dotaConstants, setDotaConstants] = useState(null);

    // Функция для получения данных о героях из OpenDota API
    const fetchHeroesData = async () => {
        if (heroesData) return heroesData; // Используем кэш
        
        try {
            const response = await api.get('/api/dota-stats/heroes', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setHeroesData(response.data);
            return response.data;
        } catch (err) {
            console.error('Ошибка получения данных о героях:', err);
            return null;
        }
    };

    // Функция для получения констант из OpenDota API
    const fetchDotaConstants = async (resource) => {
        try {
            const response = await api.get(`/api/dota-stats/constants/${resource}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            return response.data;
        } catch (err) {
            console.error(`Ошибка получения констант ${resource}:`, err);
            return null;
        }
    };

    // Функция для получения URL изображения героя через OpenDota CDN
    const getHeroImageUrl = (heroId) => {
        if (!heroId) return '/default-hero.png';
        
        // OpenDota использует прямые ссылки на изображения героев
        return `https://cdn.opendota.com/apps/dota2/images/heroes/${getHeroName(heroId)}_full.png`;
    };

    // Обновленная функция для получения имени героя с поддержкой OpenDota констант
    const getHeroName = (heroId) => {
        // Если есть данные о героях из API, используем их
        if (heroesData) {
            const hero = heroesData.find(h => h.id === heroId);
            if (hero) {
                return hero.name.replace('npc_dota_hero_', '');
            }
        }
        
        // Фолбэк на хардкод мапинг для совместимости
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

    // Функция для получения локализованного имени героя
    const getHeroLocalizedName = (heroId) => {
        if (heroesData) {
            const hero = heroesData.find(h => h.id === heroId);
            if (hero) {
                return hero.localized_name;
            }
        }
        
        // Фолбэк на английские имена
        const heroLocalizedNames = {
            1: 'Anti-Mage',
            2: 'Axe',
            3: 'Bane',
            4: 'Bloodseeker',
            5: 'Crystal Maiden',
            6: 'Drow Ranger',
            7: 'Earthshaker',
            8: 'Juggernaut',
            9: 'Mirana',
            10: 'Morphling',
            11: 'Shadow Fiend',
            12: 'Phantom Lancer',
            13: 'Puck',
            14: 'Pudge',
            15: 'Razor',
            16: 'Sand King',
            17: 'Storm Spirit',
            18: 'Sven',
            19: 'Tiny',
            20: 'Vengeful Spirit',
            21: 'Windranger',
            22: 'Zeus',
            23: 'Kunkka',
            25: 'Lina',
            26: 'Lion',
            27: 'Shadow Shaman',
            28: 'Slardar',
            29: 'Tidehunter',
            30: 'Witch Doctor',
            31: 'Lich',
            32: 'Riki',
            33: 'Enigma',
            34: 'Tinker',
            35: 'Sniper',
            36: 'Necrophos',
            37: 'Warlock',
            38: 'Beastmaster',
            39: 'Queen of Pain',
            40: 'Venomancer',
            41: 'Faceless Void',
            42: 'Wraith King',
            43: 'Death Prophet',
            44: 'Phantom Assassin',
            45: 'Pugna',
            46: 'Templar Assassin',
            47: 'Viper',
            48: 'Luna',
            49: 'Dragon Knight',
            50: 'Dazzle',
            51: 'Clockwerk',
            52: 'Leshrac',
            53: 'Nature\'s Prophet',
            54: 'Lifestealer',
            55: 'Dark Seer',
            56: 'Clinkz',
            57: 'Omniknight',
            58: 'Enchantress',
            59: 'Huskar',
            60: 'Night Stalker',
            61: 'Broodmother',
            62: 'Bounty Hunter',
            63: 'Weaver',
            64: 'Jakiro',
            65: 'Batrider',
            66: 'Chen',
            67: 'Spectre',
            68: 'Ancient Apparition',
            69: 'Doom',
            70: 'Ursa',
            71: 'Spirit Breaker',
            72: 'Gyrocopter',
            73: 'Alchemist',
            74: 'Invoker',
            75: 'Silencer',
            76: 'Outworld Destroyer',
            77: 'Lycan',
            78: 'Brewmaster',
            79: 'Shadow Demon',
            80: 'Lone Druid',
            81: 'Chaos Knight',
            82: 'Meepo',
            83: 'Treant Protector',
            84: 'Ogre Magi',
            85: 'Undying',
            86: 'Rubick',
            87: 'Disruptor',
            88: 'Nyx Assassin',
            89: 'Naga Siren',
            90: 'Keeper of the Light',
            91: 'Io',
            92: 'Visage',
            93: 'Slark',
            94: 'Medusa',
            95: 'Troll Warlord',
            96: 'Centaur Warrunner',
            97: 'Magnus',
            98: 'Timbersaw',
            99: 'Bristleback',
            100: 'Tusk',
            101: 'Skywrath Mage',
            102: 'Abaddon',
            103: 'Elder Titan',
            104: 'Legion Commander',
            105: 'Techies',
            106: 'Ember Spirit',
            107: 'Earth Spirit',
            108: 'Underlord',
            109: 'Terrorblade',
            110: 'Phoenix',
            111: 'Oracle',
            112: 'Winter Wyvern',
            113: 'Arc Warden',
            114: 'Monkey King',
            119: 'Dark Willow',
            120: 'Pangolier',
            121: 'Grimstroke',
            123: 'Hoodwink',
            126: 'Void Spirit',
            128: 'Snapfire',
            129: 'Mars',
            135: 'Dawnbreaker',
            136: 'Marci',
            137: 'Primal Beast',
            138: 'Muerta'
        };
        
        return heroLocalizedNames[heroId] || `Hero ${heroId}`;
    };

    // Обновленная функция для получения URL иконки ранга с поддержкой новой системы OpenDota
    const getRankImageUrl = (rankTier) => {
        if (!rankTier) return null;
        
        const rank = Math.floor(rankTier / 10); // Основной ранг (1-8)
        const stars = rankTier % 10; // Количество звезд (1-5)
        
        if (rank === 8) {
            // Immortal ранг
            return `https://cdn.opendota.com/apps/dota2/images/dota_react/icons/ranks/rank_tier_${rank}0.png`;
        } else if (rank >= 1 && rank <= 7) {
            // Остальные ранги с звездами
            return `https://cdn.opendota.com/apps/dota2/images/dota_react/icons/ranks/rank_tier_${rank}${stars}.png`;
        }
        
        return null;
    };

    // Обновленная функция для получения названия ранга
    const getRankName = (rankTier) => {
        if (!rankTier) return 'Без ранга';
        
        const rank = Math.floor(rankTier / 10);
        const stars = rankTier % 10;
        
        const rankNames = {
            1: 'Рекрут',
            2: 'Страж', 
            3: 'Рыцарь',
            4: 'Герой',
            5: 'Легенда',
            6: 'Властелин',
            7: 'Божество',
            8: 'Имморталь'
        };
        
        const rankName = rankNames[rank] || 'Неизвестный ранг';
        
        if (rank === 8) {
            return rankName;
        }
        
        return `${rankName} ${stars}`;
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
                await fetchDotaStats(response.data.steam_id);
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
            console.log('🔍 Загружаем статистику Dota 2 через OpenDota API...');
            
            // Получаем статистику игрока
            const response = await api.get(`/api/dota-stats/player/${steamId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            console.log('✅ Статистика Dota 2 получена:', response.data);
            setDotaStats(response.data);
            
            // Загружаем данные о героях если их еще нет
            if (!heroesData) {
                await fetchHeroesData();
            }
            
            // Автоматически сохраняем обновленную статистику
            if (user?.id) {
                await api.post('/api/dota-stats/profile/save', {
                    user_id: user.id,
                    steam_id: steamId,
                    dota_stats: response.data
                }, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                console.log('✅ Статистика Dota 2 сохранена в профиль');
            }
            
        } catch (err) {
            console.error('❌ Ошибка получения статистики Dota 2:', err);
            setError(err.response?.data?.details || 'OpenDota API временно недоступен');
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

        setIsLoadingDotaStats(true);
        try {
            console.log('🔗 Привязываем Dota 2 профиль через OpenDota API...');
            
            // Получаем статистику игрока используя привязанный Steam ID
            const response = await api.get(`/api/dota-stats/player/${user.steam_id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            // Загружаем данные о героях если их еще нет
            if (!heroesData) {
                await fetchHeroesData();
            }
            
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
            console.log('✅ Dota 2 профиль успешно привязан');
        } catch (err) {
            console.error('❌ Ошибка привязки Dota 2 профиля:', err);
            setError(err.response?.data?.details || 'OpenDota API временно недоступен');
        } finally {
            setIsLoadingDotaStats(false);
        }
    };

    const unlinkDotaSteam = async () => {
        try {
            console.log('🔗 Отвязываем Dota 2 профиль...');
            
            await api.delete(`/api/dota-stats/profile/${user.id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            setDotaProfile(null);
            setDotaStats(null);
            setError('');
            console.log('✅ Dota 2 профиль успешно отвязан');
        } catch (err) {
            console.error('❌ Ошибка отвязки Dota 2 профиля:', err);
            setError(err.response?.data?.details || 'OpenDota API временно недоступен');
        }
    };

    // Функция для обновления статистики Dota 2 через OpenDota API
    const refreshDotaStats = async () => {
        if (!dotaProfile || !dotaProfile.steam_id) {
            setError('Сначала привяжите аккаунт Dota 2');
            return;
        }

        setIsLoadingDotaStats(true);
        try {
            console.log('🔄 Запрашиваем обновление статистики Dota 2...');
            
            // Запрашиваем обновление данных игрока в OpenDota
            await api.post(`/api/dota-stats/player/${dotaProfile.steam_id}/refresh`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            setError('Запрос на обновление отправлен в OpenDota. Данные будут обновлены в течение нескольких минут.');
            
            // Повторно получаем статистику через некоторое время
            setTimeout(async () => {
                try {
                    await fetchDotaStats(dotaProfile.steam_id);
                    console.log('✅ Статистика Dota 2 обновлена');
                } catch (err) {
                    console.error('Ошибка получения обновленной статистики:', err);
                }
            }, 10000); // Ждем 10 секунд перед получением обновленных данных
            
        } catch (err) {
            console.error('❌ Ошибка обновления статистики Dota 2:', err);
            setError(err.response?.data?.details || 'Ошибка запроса обновления статистики');
        } finally {
            setTimeout(() => {
                setIsLoadingDotaStats(false);
            }, 2000); // Показываем загрузку еще 2 секунды
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
            // Загружаем данные о героях для Dota 2
            fetchHeroesData();
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
        <div className="profile-container">
            {error && <div className="error">{error}</div>}
            
            {/* Header Section */}
            <div className="profile-header">
                <div className="profile-header-content">
                    <div className="profile-avatar-section">
                        <img 
                            src={ensureHttps(avatar) || '/default-avatar.png'} 
                            alt="Аватар пользователя" 
                            className="profile-avatar"
                            onClick={openAvatarModal}
                        />
                        <button className="avatar-change-btn" onClick={openAvatarModal}>
                            Поменять
                        </button>
                    </div>
                    
                    <div className="profile-user-info">
                        <p className="profile-user-name">{user.username}</p>
                        <div className="profile-user-status">
                            <span className="status-indicator"></span>
                            <span>Онлайн</span>
                        </div>
                        <div className="profile-user-meta">
                            <div className="meta-item">
                                <span>ID: {user.id}</span>
                            </div>
                            {user.email && (
                                <div className="meta-item">
                                    <span>Email: {user.is_verified ? '✓ Подтвержден' : '⚠ Не подтвержден'}</span>
                                </div>
                            )}
                            {user.steam_url && (
                                <div className="meta-item">
                                    <span>Steam: Привязан</span>
                                </div>
                            )}
                            {user.faceit_id && (
                                <div className="meta-item">
                                    <span>FACEIT: Привязан</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="profile-quick-stats">
                        {stats && (
                            <>
                                <div className="quick-stat-card">
                                    <div className="quick-stat-value">
                                        {(stats.solo.wins || 0) + (stats.solo.losses || 0) + (stats.team.wins || 0) + (stats.team.losses || 0)}
                                    </div>
                                    <div className="quick-stat-label">Всего матчей</div>
                                </div>
                                <div className="quick-stat-card">
                                    <div className="quick-stat-value">{stats.tournaments ? stats.tournaments.length : 0}</div>
                                    <div className="quick-stat-label">Турниров</div>
                                </div>
                                <div className="quick-stat-card">
                                    <div className="quick-stat-value">
                                        {stats.tournaments ? stats.tournaments.filter(t => t.result === 'Победитель').length : 0}
                                    </div>
                                    <div className="quick-stat-label">Выигранных турниров</div>
                                </div>
                                <div className="quick-stat-card">
                                    <div className="quick-stat-value">
                                        {(() => {
                                            const totalWins = (stats.solo.wins || 0) + (stats.team.wins || 0);
                                            const totalMatches = (stats.solo.wins || 0) + (stats.solo.losses || 0) + (stats.team.wins || 0) + (stats.team.losses || 0);
                                            return totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
                                        })()}%
                                    </div>
                                    <div className="quick-stat-label">Винрейт</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Alert Messages */}
            {!user.email && (
                <div className="verification-alert">
                    <p>
                        <strong>Внимание!</strong> У вас не указан email. Вы не можете создавать и администрировать турниры.
                    </p>
                    <button onClick={openAddEmailModal}>Привязать email</button>
                </div>
            )}
            
            {user.email && !user.is_verified && (
                <div className="verification-alert">
                    <p>
                        <strong>Внимание!</strong> Ваш email не подтвержден. Вы не можете создавать и администрировать турниры.
                    </p>
                    <button onClick={openEmailVerificationModal}>Подтвердить email</button>
                </div>
            )}
            
            {/* Main Content */}
            <div className="profile-main-content">
                {/* Sidebar Navigation */}
                <div className="profile-sidebar">
                    <nav className="sidebar-nav-profile">
                        <button 
                            className={`nav-tab-profile ${activeTab === 'main' ? 'active' : ''}`} 
                            onClick={() => switchTab('main')}
                        >
                            <div className="nav-tab-content-profile">
                                <span className="nav-tab-icon-profile">👤</span>
                                <span>Основная</span>
                            </div>
                        </button>
                        <button 
                            className={`nav-tab-profile ${activeTab === 'stats' ? 'active' : ''}`} 
                            onClick={() => switchTab('stats')}
                        >
                            <div className="nav-tab-content-profile">
                                <span className="nav-tab-icon-profile">📊</span>
                                <span>Статистика</span>
                            </div>
                        </button>
                        <button 
                            className={`nav-tab-profile ${activeTab === 'friends' ? 'active' : ''}`} 
                            onClick={() => switchTab('friends')}
                        >
                            <div className="nav-tab-content-profile">
                                <span className="nav-tab-icon-profile">👥</span>
                                <span>Друзья</span>
                            </div>
                        </button>
                        <button 
                            className={`nav-tab-profile ${activeTab === 'achievements' ? 'active' : ''}`} 
                            onClick={() => switchTab('achievements')}
                        >
                            <div className="nav-tab-content-profile">
                                <span className="nav-tab-icon-profile">🏆</span>
                                <span>Достижения</span>
                                {newAchievementsCount > 0 && (
                                    <span className="achievement-notification-badge">{newAchievementsCount}</span>
                                )}
                            </div>
                        </button>
                        <button 
                            className={`nav-tab-profile ${activeTab === 'organization' ? 'active' : ''}`} 
                            onClick={() => switchTab('organization')}
                        >
                            <div className="nav-tab-content-profile">
                                <span className="nav-tab-icon-profile">🏢</span>
                                <span>Организация</span>
                            </div>
                        </button>
                        <button 
                            className={`nav-tab-profile ${activeTab === 'tournaments' ? 'active' : ''}`} 
                            onClick={() => switchTab('tournaments')}
                        >
                            <div className="nav-tab-content-profile">
                                <span className="nav-tab-icon-profile">🏆</span>
                                <span>Турниры</span>
                            </div>
                        </button>
                        <button 
                            className={`nav-tab-profile ${activeTab === 'v4analytics' ? 'active' : ''}`} 
                            onClick={() => switchTab('v4analytics')}
                        >
                            <div className="nav-tab-content-profile">
                                <span className="nav-tab-icon-profile">🔥</span>
                                <span>Аналитика V4 ULTIMATE</span>
                            </div>
                        </button>
                    </nav>
                </div>
                
                {/* Content Area */}
                <div className="profile-content-area">
                    <div className="content-section">
                        {/* Main Tab */}
                        {activeTab === 'main' && (
                            <>
                                <div className="content-header">
                                    <h2 className="content-title">Основная информация</h2>
                                </div>
                                
                                <div className="content-card">
                                    <div className="card-header">
                                        <h3 className="card-title">Данные пользователя</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="form-group nickname-section">
                                            <label className="form-label">Имя пользователя</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={newUsername}
                                                onChange={(e) => setNewUsername(e.target.value)}
                                                placeholder="Новый никнейм"
                                            />
                                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                                                <button className="btn btn-sm" onClick={updateUsername}>
                                                    Изменить никнейм
                                                </button>
                                                {user.steam_id && (
                                                    <button className="btn btn-secondary btn-sm btn-steam" onClick={fetchAndSetSteamNickname}>
                                                        Установить никнейм Steam
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="form-group">
                                            <label className="form-label">Email</label>
                                            <div className="card-content">
                                                <p>{user.email || 'Не указан'}</p>
                                                {!user.email ? (
                                                    <button className="btn btn-sm" onClick={openAddEmailModal}>
                                                        Привязать email
                                                    </button>
                                                ) : (
                                                    <p>Статус верификации: {user.is_verified ? 'Подтвержден' : 'Не подтвержден'}</p>
                                                )}
                                                {user.email && !user.is_verified && (
                                                    <button className="btn btn-sm" onClick={openEmailVerificationModal}>
                                                        Подтвердить email
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="content-card steam-section">
                                    <div className="card-header">
                                        <h3 className="card-title">Steam</h3>
                                    </div>
                                    <div className="card-content">
                                        <p>
                                            {user.steam_url 
                                                ? <span>Привязан: <a href={user.steam_url} target="_blank" rel="noopener noreferrer">{steamNickname || 'Загрузка...'}</a></span>
                                                : 'Не привязан'}
                                        </p>
                                        <div className="steam-buttons">
                                            {!user.steam_url ? (
                                                <button className="btn" onClick={linkSteam}>Привязать Steam</button>
                                            ) : (
                                                <button className="btn btn-danger" onClick={unlinkSteam}>Отвязать Steam</button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="content-card faceit-section">
                                    <div className="card-header">
                                        <h3 className="card-title">FACEIT</h3>
                                    </div>
                                    <div className="card-content">
                                        <p>
                                            {user.faceit_id 
                                                ? <span>
                                                    Привязан: {isLoadingFaceitInfo 
                                                        ? 'Загрузка...' 
                                                        : (faceitInfo 
                                                            ? <a href={faceitInfo.faceitUrl} target="_blank" rel="noopener noreferrer">{faceitInfo.faceitNickname}</a> 
                                                            : user.faceit_id)
                                                    }
                                                </span>
                                                : 'Не привязан'
                                            }
                                        </p>
                                        <div>
                                            {!user.faceit_id ? (
                                                <button className="btn" onClick={linkFaceit}>Привязать FACEIT</button>
                                            ) : (
                                                <button className="btn btn-danger" onClick={unlinkFaceit}>Отвязать FACEIT</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {/* Stats Tab */}
                        {activeTab === 'stats' && (
                            <>
                                <div className="content-header">
                                    <h2 className="content-title">Статистика</h2>
                                </div>
                                
                                {/* Site Stats */}
                                <div className="content-card">
                                    <div className="card-header">
                                        <h3 className="card-title">Статистика сайта</h3>
                                        {(isRecalculating || recalculationStatus || recalculationError) && (
                                            <div className="recalculation-status-container">
                                                {isRecalculating && (
                                                    <div className="recalculating-notice">
                                                        🔄 {recalculationStatus || 'Обновление статистики...'}
                                                    </div>
                                                )}
                                                {!isRecalculating && recalculationStatus && (
                                                    <div className="recalculation-success">
                                                        ✅ {recalculationStatus}
                                                    </div>
                                                )}
                                                {recalculationError && (
                                                    <div className="recalculation-error">
                                                        ⚠️ {recalculationError}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="card-content">
                                        {stats ? (
                                            <div className="stats-grid">
                                                <div className="stats-card">
                                                    <div className="stats-value">
                                                        {(stats.solo.wins || 0) + (stats.solo.losses || 0) + (stats.team.wins || 0) + (stats.team.losses || 0)}
                                                    </div>
                                                    <div className="stats-label">Всего матчей</div>
                                                </div>
                                                <div className="stats-card">
                                                    <div className="stats-value">{stats.tournaments ? stats.tournaments.length : 0}</div>
                                                    <div className="stats-label">Турниров</div>
                                                </div>
                                                <div className="stats-card">
                                                    <div className="stats-value">
                                                        {stats.tournaments ? stats.tournaments.filter(t => t.result === 'Победитель').length : 0}
                                                    </div>
                                                    <div className="stats-label">Выигранных турниров</div>
                                                </div>
                                                <div className="stats-card">
                                                    <div className="stats-value">
                                                        {(() => {
                                                            const totalWins = (stats.solo.wins || 0) + (stats.team.wins || 0);
                                                            const totalMatches = (stats.solo.wins || 0) + (stats.solo.losses || 0) + (stats.team.wins || 0) + (stats.team.losses || 0);
                                                            return totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
                                                        })()}%
                                                    </div>
                                                    <div className="stats-label">Винрейт</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="loading-spinner">Статистика загружается...</div>
                                        )}
                                        
                                        {renderLastFiveMatches()}
                                    </div>
                                </div>
                                
                                {/* Game Stats Section */}
                                {stats && stats.byGame && Object.keys(stats.byGame).length > 0 && (
                                    <div className="content-card game-stats-section">
                                        <div className="card-header">
                                            <h3 className="card-title">Статистика по играм</h3>
                                        </div>
                                        <div className="card-content">
                                            <div className="game-stats-grid">
                                                {Object.entries(stats.byGame).map(([game, gameStats]) => {
                                                    const totalSolo = gameStats.solo.wins + gameStats.solo.losses;
                                                    const totalTeam = gameStats.team.wins + gameStats.team.losses;
                                                    const soloWinRate = totalSolo > 0 ? ((gameStats.solo.wins / totalSolo) * 100).toFixed(1) : 0;
                                                    const teamWinRate = totalTeam > 0 ? ((gameStats.team.wins / totalTeam) * 100).toFixed(1) : 0;
                                                    
                                                    return (
                                                        <div key={game} className="game-stat-card">
                                                            <div className="game-stat-header">
                                                                <h4 className="game-stat-title">{game}</h4>
                                                                <span className="game-stat-icon">🎮</span>
                                                            </div>
                                                            <div className="game-stat-body">
                                                                <div className="stat-type-section">
                                                                    <div className="stat-type-label">Solo</div>
                                                                    <div className="stat-type-values">
                                                                        <div className="stat-value-item">
                                                                            <span className="stat-value-label">Побед</span>
                                                                            <span className="stat-value-number">{gameStats.solo.wins}</span>
                                                                        </div>
                                                                        <div className="stat-value-item">
                                                                            <span className="stat-value-label">Поражений</span>
                                                                            <span className="stat-value-number">{gameStats.solo.losses}</span>
                                                                        </div>
                                                                        <div className="stat-value-item">
                                                                            <span className="stat-value-label">Винрейт</span>
                                                                            <span className="stat-value-number">{soloWinRate}%</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="stat-type-section">
                                                                    <div className="stat-type-label">Team</div>
                                                                    <div className="stat-type-values">
                                                                        <div className="stat-value-item">
                                                                            <span className="stat-value-label">Побед</span>
                                                                            <span className="stat-value-number">{gameStats.team.wins}</span>
                                                                        </div>
                                                                        <div className="stat-value-item">
                                                                            <span className="stat-value-label">Поражений</span>
                                                                            <span className="stat-value-number">{gameStats.team.losses}</span>
                                                                        </div>
                                                                        <div className="stat-value-item">
                                                                            <span className="stat-value-label">Винрейт</span>
                                                                            <span className="stat-value-number">{teamWinRate}%</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* CS2 Stats */}
                                {user.steam_url && (
                                    <div className="content-card cs2-stats">
                                        <div className="card-header">
                                            <h3 className="card-title">Статистика CS2</h3>
                                            {premierRank > 0 && (
                                                <button 
                                                    className="btn btn-sm" 
                                                    onClick={() => fetchCs2Stats()}
                                                    disabled={isLoadingCs2Stats}
                                                >
                                                    {isLoadingCs2Stats ? 'Загрузка...' : 'Обновить'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="card-content">
                                            <div className="rank-container">
                                                {renderRankGroups()}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* FACEIT Stats */}
                                {faceitInfo && faceitInfo.elo > 0 && (
                                    <div className="content-card faceit-stats">
                                        <div className="card-header">
                                            <h3 className="card-title">Статистика FACEIT{faceitInfo.statsFrom === 'csgo' ? ' (CS:GO)' : ''}</h3>
                                        </div>
                                        <div className="card-content">
                                            <div className="faceit-elo">
                                                <p><strong>ELO:</strong> {faceitInfo.elo}</p>
                                                <p><strong>Уровень:</strong> {faceitInfo.level}</p>
                                            </div>
                                            {faceitInfo.stats && (
                                                <div className="faceit-detailed-stats">
                                                    <p><strong>Матчи:</strong> {faceitInfo.stats.Matches || 0}</p>
                                                    <p><strong>Винрейт:</strong> {faceitInfo.stats['Win Rate %'] || '0'}%</p>
                                                    <p><strong>K/D:</strong> {faceitInfo.stats['Average K/D Ratio'] || '0'}</p>
                                                    <p><strong>HS %:</strong> {faceitInfo.stats['Average Headshots %'] || '0'}%</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Dota 2 Stats */}
                                <div className="content-card dota-stats">
                                    <div className="card-header">
                                        <h3 className="card-title">Статистика Dota 2</h3>
                                        {!dotaProfile && user?.steam_id && (
                                            <button 
                                                className="btn btn-sm" 
                                                onClick={linkDotaSteam}
                                                disabled={isLoadingDotaStats}
                                            >
                                                {isLoadingDotaStats ? 'Загрузка...' : 'Загрузить статистику'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="card-content">
                                        {isLoadingDotaStats ? (
                                            <div className="loading-spinner">Загрузка статистики Dota 2...</div>
                                        ) : dotaStats ? (
                                            <div className="dota-player-stats">
                                                {/* Профиль игрока */}
                                                <div className="dota-profile-info">
                                                    <img 
                                                        src={dotaStats.profile?.avatarfull || '/default-avatar.png'} 
                                                        alt="Steam Avatar" 
                                                        className="dota-avatar" 
                                                    />
                                                    <div className="dota-profile-details">
                                                        <h4>{dotaStats.profile?.personaname || 'Неизвестно'}</h4>
                                                        {dotaStats.profile?.rank_tier && (
                                                            <div className="dota-rank-info">
                                                                <strong>Ранг: </strong>
                                                                {getRankImageUrl(dotaStats.profile.rank_tier) && (
                                                                    <img 
                                                                        src={getRankImageUrl(dotaStats.profile.rank_tier)}
                                                                        alt={getRankName(dotaStats.profile.rank_tier)}
                                                                        className="dota-rank-icon"
                                                                        style={{ width: '24px', height: '24px', marginRight: '8px', verticalAlign: 'middle' }}
                                                                        onError={(e) => {
                                                                            e.target.style.display = 'none';
                                                                        }}
                                                                    />
                                                                )}
                                                                <span>
                                                                    {getRankName(dotaStats.profile.rank_tier)}
                                                                    {(() => {
                                                                        // Определяем MMR из различных источников
                                                                        let mmrValue = null;
                                                                        let mmrSource = null;
                                                                        
                                                                        // Отладочная информация
                                                                        console.log('🎯 Дота статистика для отображения MMR:', {
                                                                            solo_competitive_rank: dotaStats.profile?.solo_competitive_rank,
                                                                            competitive_rank: dotaStats.profile?.competitive_rank,
                                                                            mmr_estimate: dotaStats.profile?.mmr_estimate,
                                                                            mmr_source: dotaStats.profile?.mmr_source,
                                                                            leaderboard_rank: dotaStats.profile?.leaderboard_rank,
                                                                            profile: dotaStats.profile
                                                                        });
                                                                        
                                                                        // Приоритет 1: solo_competitive_rank
                                                                        if (dotaStats.profile?.solo_competitive_rank && dotaStats.profile.solo_competitive_rank > 0) {
                                                                            mmrValue = dotaStats.profile.solo_competitive_rank;
                                                                            mmrSource = 'solo_competitive_rank';
                                                                        } 
                                                                        // Приоритет 2: competitive_rank
                                                                        else if (dotaStats.profile?.competitive_rank && dotaStats.profile.competitive_rank > 0) {
                                                                            mmrValue = dotaStats.profile.competitive_rank;
                                                                            mmrSource = 'competitive_rank';
                                                                        }
                                                                        // Приоритет 3: mmr_estimate (может быть объектом или числом)
                                                                        else if (dotaStats.profile?.mmr_estimate) {
                                                                            if (typeof dotaStats.profile.mmr_estimate === 'object' && dotaStats.profile.mmr_estimate.estimate) {
                                                                                mmrValue = dotaStats.profile.mmr_estimate.estimate;
                                                                                mmrSource = 'mmr_estimate.estimate';
                                                                            } else if (typeof dotaStats.profile.mmr_estimate === 'number' && dotaStats.profile.mmr_estimate > 0) {
                                                                                mmrValue = dotaStats.profile.mmr_estimate;
                                                                                mmrSource = 'mmr_estimate';
                                                                            }
                                                                        } 
                                                                        // Приоритет 4: leaderboard_rank для очень высоких MMR
                                                                        else if (dotaStats.profile?.leaderboard_rank && dotaStats.profile.leaderboard_rank > 0) {
                                                                            // Для leaderboard rank, примерный MMR можно оценить как 5500+ для топ игроков
                                                                            mmrValue = 5500 + Math.round((1000 - dotaStats.profile.leaderboard_rank) * 10);
                                                                            mmrSource = 'leaderboard_rank_estimate';
                                                                        }
                                                                        // Приоритет 5: проверяем корневой уровень mmr_estimate
                                                                        else if (dotaStats.mmr_estimate) {
                                                                            if (typeof dotaStats.mmr_estimate === 'object' && dotaStats.mmr_estimate.estimate) {
                                                                                mmrValue = dotaStats.mmr_estimate.estimate;
                                                                                mmrSource = 'root.mmr_estimate.estimate';
                                                                            } else if (typeof dotaStats.mmr_estimate === 'number' && dotaStats.mmr_estimate > 0) {
                                                                                mmrValue = dotaStats.mmr_estimate;
                                                                                mmrSource = 'root.mmr_estimate';
                                                                            }
                                                                        }
                                                                        
                                                                        console.log('🎯 Результат определения MMR:', { mmrValue, mmrSource });
                                                                        
                                                                        // Отображаем MMR в скобках рядом с названием ранга
                                                                        if (mmrValue && typeof mmrValue === 'number' && mmrValue > 0) {
                                                                            const mmrText = mmrSource === 'leaderboard_rank_estimate' ? 
                                                                                ` (~${Math.round(mmrValue)} MMR)` : 
                                                                                ` (${Math.round(mmrValue)} MMR)`;
                                                                            return mmrText;
                                                                        }
                                                                        
                                                                        return '';
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {(() => {
                                                            // Удаляем дублирующий блок MMR, так как теперь он отображается рядом с рангом
                                                            return null;
                                                        })()}
                                                        {dotaStats.profile?.leaderboard_rank && (
                                                            <p><strong>Место в рейтинге:</strong> #{dotaStats.profile.leaderboard_rank}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Общая статистика */}
                                                <div className="dota-general-stats">
                                                    <h5>Общая статистика</h5>
                                                    <div className="stats-grid">
                                                        <div className="stat-item">
                                                            <span className="stat-label">Побед:</span>
                                                            <span className="stat-value">{dotaStats.stats?.win || 0}</span>
                                                        </div>
                                                        <div className="stat-item">
                                                            <span className="stat-label">Поражений:</span>
                                                            <span className="stat-value">{dotaStats.stats?.lose || 0}</span>
                                                        </div>
                                                        <div className="stat-item">
                                                            <span className="stat-label">Винрейт:</span>
                                                            <span className="stat-value">{dotaStats.stats?.winrate || 0}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : dotaProfile && dotaProfile.steam_id ? (
                                            <div className="no-dota-stats">
                                                <p>Не удалось загрузить статистику Dota 2</p>
                                                <p>Steam ID: {dotaProfile.steam_id}</p>
                                                <button 
                                                    className="btn btn-sm" 
                                                    onClick={() => fetchDotaStats(dotaProfile.steam_id)}
                                                >
                                                    Попробовать снова
                                                </button>
                                            </div>
                                        ) : !user?.steam_id ? (
                                            <div className="no-dota-profile">
                                                <p>Для отображения статистики Dota 2 необходимо привязать Steam аккаунт</p>
                                                <p>Перейдите в раздел "Основная информация" и привяжите Steam</p>
                                            </div>
                                        ) : (
                                            <div className="no-dota-profile">
                                                <p>Статистика Dota 2 не загружена</p>
                                                <p>Нажмите "Загрузить статистику" для получения данных</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ✨ V4 ULTIMATE: Революционный дашборд статистики */}
                                <V4StatsDashboard
                                    v4Data={v4Data}
                                    stats={stats}
                                    requestEnhancedRecalculation={requestEnhancedRecalculation}
                                    isRecalculating={isRecalculating}
                                    recalculationStatus={recalculationStatus}
                                    recalculationError={recalculationError}
                                />
                            </>
                        )}
                        
                        {/* ✨ V4 ULTIMATE ANALYTICS TAB */}
                        {activeTab === 'v4analytics' && (
                            <>
                                <div className="content-header">
                                    <h2 className="content-title">🔥 Аналитика V4 ULTIMATE</h2>
                                    <div className="v4-ultimate-badge">
                                        <span>NEW</span>
                                    </div>
                                </div>
                                
                                {/* V4 ULTIMATE: Революционный дашборд статистики */}
                                <div className="content-card v4-ultimate-section">
                                    <div className="card-header">
                                        <h3 className="card-title">🚀 V4 ULTIMATE ДАШБОРД</h3>
                                        <div className="v4-ultimate-badge">
                                            <span>ULTIMATE</span>
                                        </div>
                                    </div>
                                    <div className="card-content">
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
                            </>
                        )}
                        
                        {/* Friends Tab */}
                        {activeTab === 'friends' && (
                            <>
                                <div className="content-header">
                                    <h2 className="content-title">Друзья</h2>
                                </div>
                                
                                {/* Friend Search */}
                                <div className="content-card friends-section">
                                    <div className="card-header">
                                        <h3 className="card-title">Поиск друзей</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="friends-search">
                                            <div style={{ position: 'relative' }}>
                                                <span className="search-icon">🔍</span>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Поиск пользователя по нику..."
                                                    value={searchQuery}
                                                    onChange={handleSearchChange}
                                                />
                                            </div>
                                            {searchResults.length > 0 && (
                                                <div className="search-results">
                                                    {searchResults.map(user => (
                                                        <div key={user.id} className="search-item">
                                                            <img
                                                                src={ensureHttps(user.avatar_url) || '/default-avatar.png'}
                                                                alt={user.username}
                                                                className="search-avatar"
                                                            />
                                                            <a href={`/user/${user.id}`} className="search-username">
                                                                {user.username}
                                                            </a>
                                                            <div>
                                                                {user.requestSent ? (
                                                                    <button className="btn btn-sm" disabled>
                                                                        Отправлено
                                                                    </button>
                                                                ) : (
                                                                    <button 
                                                                        onClick={() => sendFriendRequest(user.id)} 
                                                                        className="btn btn-sm"
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
                                                <p className="empty-state-description">Пользователи не найдены</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Friends List */}
                                <div className="content-card">
                                    <div className="card-header">
                                        <h3 className="card-title">Мои друзья ({friends.length})</h3>
                                    </div>
                                    <div className="card-content">
                                        {loadingFriends ? (
                                            <div className="loading-spinner">Загрузка списка друзей...</div>
                                        ) : friends.length > 0 ? (
                                            <div className="friends-list">
                                                {friends.map(friend => renderFriendItem(friend))}
                                            </div>
                                        ) : (
                                            <div className="empty-state">
                                                <div className="empty-state-title">У вас пока нет друзей</div>
                                                <div className="empty-state-description">Используйте поиск выше, чтобы найти и добавить друзей</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Friend Requests */}
                                {friendRequests.length > 0 && (
                                    <div className="content-card">
                                        <div className="card-header">
                                            <h3 className="card-title">Заявки в друзья ({friendRequests.length})</h3>
                                        </div>
                                        <div className="card-content">
                                            <div className="friend-requests">
                                                {friendRequests.map(request => (
                                                    <div key={request.id} className="friend-request-card">
                                                        <div className="request-user-info">
                                                            <img
                                                                src={ensureHttps(request.user.avatar_url) || '/default-avatar.png'}
                                                                alt={request.user.username}
                                                                className="request-avatar"
                                                            />
                                                            <a href={`/user/${request.user.id}`} className="request-username">
                                                                {request.user.username}
                                                            </a>
                                                        </div>
                                                        <div className="request-actions">
                                                            <button 
                                                                className="accept-request-btn" 
                                                                onClick={() => acceptFriendRequest(request.id)}
                                                            >
                                                                Принять
                                                            </button>
                                                            <button 
                                                                className="reject-request-btn" 
                                                                onClick={() => rejectFriendRequest(request.id)}
                                                            >
                                                                Отклонить
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Sent Friend Requests */}
                                {sentFriendRequests.length > 0 && (
                                    <div className="content-card">
                                        <div className="card-header">
                                            <h3 className="card-title">Исходящие заявки ({sentFriendRequests.length})</h3>
                                        </div>
                                        <div className="card-content">
                                            <div className="friend-requests">
                                                {sentFriendRequests.map(request => (
                                                    <div key={request.id} className="friend-request-card">
                                                        <div className="request-user-info">
                                                            <img
                                                                src={ensureHttps(request.user.avatar_url) || '/default-avatar.png'}
                                                                alt={request.user.username}
                                                                className="request-avatar"
                                                            />
                                                            <a href={`/user/${request.user.id}`} className="request-username">
                                                                {request.user.username}
                                                            </a>
                                                        </div>
                                                        <div className="request-actions">
                                                            <button
                                                                className="reject-request-btn"
                                                                onClick={() => cancelSentFriendRequest(request.id)}
                                                            >
                                                                Отменить
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        
                        {/* Organization Tab */}
                        {activeTab === 'organization' && (
                            <>
                                <div className="content-header">
                                    <h2 className="content-title">Организации</h2>
                                </div>
                                
                                {loadingOrganizations || loadingRequest ? (
                                    <div className="loading-spinner">
                                        <p>Загрузка информации об организациях...</p>
                                    </div>
                                ) : userOrganizations && userOrganizations.length > 0 ? (
                                    <div className="user-organizations">
                                        <div className="content-card">
                                            <div className="card-header">
                                                <h3 className="card-title">Мои организации</h3>
                                            </div>
                                            <div className="card-content">
                                                <div className="organizations-list">
                                                    {userOrganizations.map(org => (
                                                        <div key={org.id} className="organization-card">
                                                            <div className="org-card-header">
                                                                <div className="org-logo-container">
                                                                    <img 
                                                                        src={ensureHttps(org.logo_url) || '/default-org-logo.png'}
                                                                        alt={org.name}
                                                                        className="org-card-logo"
                                                                    />
                                                                </div>
                                                                <div className="org-card-info">
                                                                    <h4>
                                                                        <a 
                                                                            href={`/organizer/${org.slug}`} 
                                                                            className="org-name-link"
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer"
                                                                        >
                                                                            {org.name}
                                                                        </a>
                                                                    </h4>
                                                                    <div className="org-role">
                                                                        {org.role === 'manager' ? 'Менеджер' : 
                                                                         org.role === 'admin' ? 'Администратор' : 'Участник'}
                                                                    </div>
                                                                    <div className="org-joined">
                                                                        Состою с {new Date(org.joined_at).toLocaleDateString('ru-RU')}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="org-stats">
                                                                <div className="org-stat-item">
                                                                    <span className="org-stat-value">{org.tournaments_count}</span>
                                                                    <span className="org-stat-label">Турниров</span>
                                                                </div>
                                                            </div>
                                                            
                                                            {org.description && (
                                                                <div className="org-description">
                                                                    <p>{org.description}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div className="add-organization-note">
                                                    <p>Хотите создать новую организацию? Свяжитесь с администрацией для подачи заявки.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : organizationRequest ? (
                                    <div className="organization-request-status">
                                        <div className="content-card">
                                            <div className="card-header">
                                                <h3 className="card-title">Статус заявки на создание организации</h3>
                                            </div>
                                            <div className="card-content">
                                                <div className="request-status-card">
                                                    <div className="status-header">
                                                        <h4>{organizationRequest.organization_name}</h4>
                                                        <span className={`status-badge status-${organizationRequest.status}`}>
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
                                                                <div className="comment-text">{organizationRequest.admin_comment}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="organization-tab">
                                        <div className="content-card">
                                            <div className="card-header">
                                                <h3 className="card-title">Заявка на создание аккаунта организации</h3>
                                            </div>
                                            <div className="card-content">
                                                <p>Заполните форму ниже, чтобы подать заявку на создание аккаунта организации. Это позволит вам организовывать турниры от имени вашей организации.</p>

                                                {/* Email Requirements */}
                                                {!user.email && (
                                                    <div className="organization-requirement-alert">
                                                        <h4>❌ Требования не выполнены</h4>
                                                        <p>Для подачи заявки необходимо привязать email к аккаунту.</p>
                                                        <button onClick={openAddEmailModal}>Привязать email</button>
                                                    </div>
                                                )}

                                                {user.email && !user.is_verified && (
                                                    <div className="organization-requirement-alert">
                                                        <h4>❌ Требования не выполнены</h4>
                                                        <p>Для подачи заявки необходимо подтвердить email.</p>
                                                        <button onClick={openEmailVerificationModal}>Подтвердить email</button>
                                                    </div>
                                                )}

                                                {/* Form */}
                                                {user.email && user.is_verified && (
                                                    <form onSubmit={submitOrganizationRequest} className="organization-form">
                                                        {organizationError && (
                                                            <div className="organization-error">
                                                                {organizationError}
                                                            </div>
                                                        )}

                                                        {organizationSuccess && (
                                                            <div className="organization-success">
                                                                {organizationSuccess}
                                                            </div>
                                                        )}

                                                        <div className="form-group">
                                                            <label htmlFor="organizationName">
                                                                Название организации <span className="required">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                id="organizationName"
                                                                name="organizationName"
                                                                value={organizationData.organizationName}
                                                                onChange={handleOrganizationInputChange}
                                                                placeholder="Введите название вашей организации"
                                                                required
                                                            />
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="description">
                                                                Краткое описание организации <span className="required">*</span>
                                                            </label>
                                                            <textarea
                                                                id="description"
                                                                name="description"
                                                                value={organizationData.description}
                                                                onChange={handleOrganizationInputChange}
                                                                placeholder="Расскажите о вашей организации, её деятельности и целях..."
                                                                rows="4"
                                                                required
                                                            />
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="websiteUrl">Сайт организации</label>
                                                            <input
                                                                type="url"
                                                                id="websiteUrl"
                                                                name="websiteUrl"
                                                                value={organizationData.websiteUrl}
                                                                onChange={handleOrganizationInputChange}
                                                                placeholder="https://example.com"
                                                            />
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="vkUrl">Ссылка на VK</label>
                                                            <input
                                                                type="url"
                                                                id="vkUrl"
                                                                name="vkUrl"
                                                                value={organizationData.vkUrl}
                                                                onChange={handleOrganizationInputChange}
                                                                placeholder="https://vk.com/your_organization"
                                                            />
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="telegramUrl">Ссылка на Telegram</label>
                                                            <input
                                                                type="url"
                                                                id="telegramUrl"
                                                                name="telegramUrl"
                                                                value={organizationData.telegramUrl}
                                                                onChange={handleOrganizationInputChange}
                                                                placeholder="https://t.me/your_organization"
                                                            />
                                                        </div>

                                                        <div className="form-group">
                                                            <label>Логотип организации</label>
                                                            <div className="logo-upload-section">
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
                                                                            alt="Предпросмотр логотипа" 
                                                                            className="organization-logo-preview"
                                                                        />
                                                                        <div className="logo-actions">
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={triggerOrganizationFileInput}
                                                                                className="change-logo-btn"
                                                                            >
                                                                                Изменить
                                                                            </button>
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={removeOrganizationLogo}
                                                                                className="remove-logo-btn"
                                                                            >
                                                                                Удалить
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="logo-upload-placeholder">
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={triggerOrganizationFileInput}
                                                                            className="upload-logo-btn"
                                                                        >
                                                                            📁 Выбрать файл логотипа
                                                                        </button>
                                                                        <p className="upload-hint">Рекомендуемый размер: 200x200px, формат: PNG, JPG</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="form-group submit-group">
                                                            <button 
                                                                type="submit" 
                                                                className="submit-organization-btn"
                                                                disabled={isSubmittingOrganization}
                                                            >
                                                                {isSubmittingOrganization ? 'Отправка...' : 'Отправить заявку'}
                                                            </button>
                                                        </div>

                                                        <div className="organization-info">
                                                            <h4>Информация о процессе:</h4>
                                                            <ul>
                                                                <li>Заявки рассматриваются в течение 1-3 рабочих дней</li>
                                                                <li>После одобрения с вами свяжется администрация для уточнения деталей</li>
                                                                <li>Все поля, отмеченные звездочкой (*), обязательны для заполнения</li>
                                                                <li>Логотип должен быть в формате изображения (PNG, JPG) размером до 5MB</li>
                                                            </ul>
                                                        </div>
                                                    </form>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        
                        {/* Tournaments Tab */}
                        {activeTab === 'tournaments' && (
                            <>
                                <div className="content-header">
                                    <h2 className="content-title">Турниры</h2>
                                </div>
                                
                                {loadingTournaments ? (
                                    <div className="loading-spinner">
                                        <p>Загрузка турниров...</p>
                                    </div>
                                ) : (
                                    <div className="tournaments-section">
                                        {hasActiveTournamentFilters() && (
                                            <div style={{ marginBottom: '16px', textAlign: 'right' }}>
                                                <button 
                                                    onClick={clearAllTournamentFilters}
                                                    className="clear-all-filters-btn"
                                                >
                                                    ✕ Сбросить все фильтры
                                                </button>
                                            </div>
                                        )}
                                        
                                        <div className="tournaments-view-controls">
                                            <button 
                                                className={`view-mode-btn ${tournamentViewMode === 'table' ? 'active' : ''}`} 
                                                onClick={() => setTournamentViewMode('table')}
                                            >
                                                Таблица
                                            </button>
                                            <button 
                                                className={`view-mode-btn ${tournamentViewMode === 'card' ? 'active' : ''}`} 
                                                onClick={() => setTournamentViewMode('card')}
                                            >
                                                Карточки
                                            </button>
                                        </div>

                                        <div className="tournaments-filter-bar">
                                            <input
                                                type="text"
                                                placeholder="Поиск по названию"
                                                value={tournamentFilters.name}
                                                onChange={(e) => setTournamentFilters({...tournamentFilters, name: e.target.value})}
                                                className="mobile-filter-input"
                                            />
                                        </div>
                                        
                                        {tournamentViewMode === 'table' ? (
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th ref={tournamentFilterRefs.game} className={tournamentFilters.game ? 'filtered' : ''}>
                                                            {activeTournamentFilter === 'game' ? (
                                                                <div className="dropdown" style={{
                                                                    position: 'absolute',
                                                                    top: '100%',
                                                                    left: '0',
                                                                    right: '0',
                                                                    background: '#1a1a1a',
                                                                    color: '#ffffff',
                                                                    border: '1px solid #333333',
                                                                    borderRadius: '6px',
                                                                    zIndex: 9999,
                                                                    maxHeight: '200px',
                                                                    overflowY: 'auto',
                                                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                                                                    marginTop: '4px',
                                                                    minWidth: '150px',
                                                                    whiteSpace: 'nowrap',
                                                                    display: 'block',
                                                                    visibility: 'visible'
                                                                }}>
                                                                    {tournamentFilters.game && (
                                                                        <div
                                                                            onClick={() => clearTournamentFilter('game')}
                                                                            className="dropdown-item clear-filter"
                                                                            style={{
                                                                                padding: '12px 16px',
                                                                                cursor: 'pointer',
                                                                                backgroundColor: '#333333',
                                                                                color: '#ffffff',
                                                                                borderBottom: '2px solid #444444'
                                                                            }}
                                                                        >
                                                                            ✕ Сбросить фильтр
                                                                        </div>
                                                                    )}
                                                                    {uniqueTournamentValues('game').map((value) => (
                                                                        <div
                                                                            key={value}
                                                                            onClick={() => applyTournamentFilter('game', value)}
                                                                            className="dropdown-item"
                                                                            style={{
                                                                                padding: '12px 16px',
                                                                                cursor: 'pointer',
                                                                                borderBottom: '1px solid #2a2a2a',
                                                                                backgroundColor: 'transparent',
                                                                                color: '#ffffff'
                                                                            }}
                                                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2a2a'}
                                                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                                                        >
                                                                            {value}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    Игра{tournamentFilters.game && ` (${tournamentFilters.game})`}{' '}
                                                                    <span className="dropdown-icon" onClick={() => toggleTournamentFilter('game')}>
                                                                        ▼
                                                                    </span>
                                                                </>
                                                            )}
                                                        </th>
                                                        <th ref={tournamentFilterRefs.name} className={tournamentFilters.name ? 'filtered' : ''}>
                                                            {activeTournamentFilter === 'name' ? (
                                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                                    <input
                                                                        name="name"
                                                                        value={tournamentFilters.name}
                                                                        onChange={handleTournamentFilterChange}
                                                                        placeholder="Поиск по названию"
                                                                        autoFocus
                                                                        style={{ flex: 1 }}
                                                                    />
                                                                    {tournamentFilters.name && (
                                                                        <button
                                                                            onClick={() => clearTournamentFilter('name')}
                                                                            style={{
                                                                                padding: '4px 8px',
                                                                                backgroundColor: '#333333',
                                                                                color: '#ffffff',
                                                                                border: '1px solid #555555',
                                                                                borderRadius: '4px',
                                                                                cursor: 'pointer',
                                                                                fontSize: '11px'
                                                                            }}
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    Название{tournamentFilters.name && ` (${tournamentFilters.name})`}{' '}
                                                                    <span className="filter-icon" onClick={() => toggleTournamentFilter('name')}>
                                                                        🔍
                                                                    </span>
                                                                </>
                                                            )}
                                                        </th>
                                                        <th>
                                                            Участники{' '}
                                                            <span className="sort-icon" onClick={() => handleTournamentSort('participant_count')}>
                                                                {tournamentSort.field === 'participant_count' && tournamentSort.direction === 'asc' ? '▲' : '▼'}
                                                            </span>
                                                        </th>
                                                        <th ref={tournamentFilterRefs.status} className={tournamentFilters.status ? 'filtered' : ''}>
                                                            {activeTournamentFilter === 'status' ? (
                                                                <div className="dropdown" style={{
                                                                    position: 'absolute',
                                                                    top: '100%',
                                                                    left: '0',
                                                                    right: '0',
                                                                    background: '#1a1a1a',
                                                                    color: '#ffffff',
                                                                    border: '1px solid #333333',
                                                                    borderRadius: '6px',
                                                                    zIndex: 9999,
                                                                    maxHeight: '200px',
                                                                    overflowY: 'auto',
                                                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                                                                    marginTop: '4px',
                                                                    minWidth: '150px',
                                                                    whiteSpace: 'nowrap',
                                                                    display: 'block',
                                                                    visibility: 'visible'
                                                                }}>
                                                                    {tournamentFilters.status && (
                                                                        <div
                                                                            onClick={() => clearTournamentFilter('status')}
                                                                            className="dropdown-item clear-filter"
                                                                            style={{
                                                                                padding: '12px 16px',
                                                                                cursor: 'pointer',
                                                                                backgroundColor: '#333333',
                                                                                color: '#ffffff',
                                                                                borderBottom: '2px solid #444444'
                                                                            }}
                                                                        >
                                                                            ✕ Сбросить фильтр
                                                                        </div>
                                                                    )}
                                                                    {uniqueTournamentValues('status').map((value) => (
                                                                        <div
                                                                            key={value}
                                                                            onClick={() => applyTournamentFilter('status', value)}
                                                                            className="dropdown-item"
                                                                            style={{
                                                                                padding: '12px 16px',
                                                                                cursor: 'pointer',
                                                                                borderBottom: '1px solid #2a2a2a',
                                                                                backgroundColor: 'transparent',
                                                                                color: '#ffffff'
                                                                            }}
                                                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2a2a'}
                                                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                                                        >
                                                                            {value === 'active' ? 'Активен' : 
                                                                             value === 'in_progress' ? 'Идет' : 
                                                                             value === 'completed' ? 'Завершен' : 
                                                                             value}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    Статус{tournamentFilters.status && ` (${
                                                                        tournamentFilters.status === 'active' ? 'Активен' : 
                                                                        tournamentFilters.status === 'in_progress' ? 'Идет' : 
                                                                        tournamentFilters.status === 'completed' ? 'Завершен' : 
                                                                        tournamentFilters.status
                                                                    })`}{' '}
                                                                    <span className="dropdown-icon" onClick={() => toggleTournamentFilter('status')}>
                                                                        ▼
                                                                    </span>
                                                                </>
                                                            )}
                                                        </th>
                                                        <th>
                                                            Дата{' '}
                                                            <span className="sort-icon" onClick={() => handleTournamentSort('start_date')}>
                                                                {tournamentSort.field === 'start_date' && tournamentSort.direction === 'asc' ? '▲' : '▼'}
                                                            </span>
                                                        </th>
                                                        <th>Результат</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredAndSortedUserTournaments.map((tournament) => (
                                                        <tr key={tournament.id}>
                                                            <td data-label="Игра" title={tournament.game}>{tournament.game}</td>
                                                            <td data-label="Название" title={tournament.name}>
                                                                <a href={`/tournaments/${tournament.id}`}>{tournament.name}</a>
                                                            </td>
                                                            <td data-label="Участники">
                                                                {tournament.max_participants
                                                                    ? `${tournament.participant_count} из ${tournament.max_participants}`
                                                                    : tournament.participant_count}
                                                            </td>
                                                            <td data-label="Статус">
                                                                <span className={`tournament-status-badge ${
                                                                    tournament.status === 'active' ? 'tournament-status-active' : 
                                                                    tournament.status === 'in_progress' ? 'tournament-status-in-progress' : 
                                                                    tournament.status === 'completed' ? 'tournament-status-completed' : 
                                                                    'tournament-status-completed'
                                                                }`}>
                                                                    {tournament.status === 'active' ? 'Активен' : 
                                                                     tournament.status === 'in_progress' ? 'Идет' : 
                                                                     tournament.status === 'completed' ? 'Завершен' : 
                                                                     'Неизвестно'}
                                                                </span>
                                                            </td>
                                                            <td data-label="Дата">{new Date(tournament.start_date).toLocaleDateString('ru-RU')}</td>
                                                            <td data-label="Результат">
                                                                {tournament.tournament_result ? (
                                                                    <span className={`tournament-result ${
                                                                        tournament.tournament_result.toLowerCase().includes('победитель') ? 'победитель' :
                                                                        tournament.tournament_result.toLowerCase().includes('место') ? 'призер' :
                                                                        tournament.tournament_result.toLowerCase().includes('финал') ? 'призер' :
                                                                        'участник'
                                                                    }`}>
                                                                        {tournament.tournament_result}
                                                                    </span>
                                                                ) : (
                                                                    <span className="tournament-result pending">
                                                                        {tournament.status === 'completed' ? 'Не указан' : 'В процессе'}
                                                                    </span>
                                                                )}
                                                                {tournament.wins !== undefined && tournament.losses !== undefined && (
                                                                    <div className="tournament-stats">
                                                                        <small>({tournament.wins}П/{tournament.losses}П)</small>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="tournaments-cards">
                                                {filteredAndSortedUserTournaments.map((tournament) => (
                                                    <div key={tournament.id} className="tournament-card">
                                                        <h3 className="tournament-name">
                                                            <a href={`/tournaments/${tournament.id}`}>{tournament.name}</a>
                                                        </h3>
                                                        <div className="tournament-details">
                                                            <div className="tournament-info">
                                                                <span className="tournament-label">Игра:</span>
                                                                <span className="tournament-value">{tournament.game}</span>
                                                            </div>
                                                            <div className="tournament-info">
                                                                <span className="tournament-label">Участники:</span>
                                                                <span className="tournament-value">
                                                                    {tournament.max_participants
                                                                        ? `${tournament.participant_count} из ${tournament.max_participants}`
                                                                        : tournament.participant_count}
                                                                </span>
                                                            </div>
                                                            <div className="tournament-info">
                                                                <span className="tournament-label">Дата:</span>
                                                                <span className="tournament-value">
                                                                    {new Date(tournament.start_date).toLocaleDateString('ru-RU')}
                                                                </span>
                                                            </div>
                                                            <div className="tournament-info">
                                                                <span className="tournament-label">Статус:</span>
                                                                <span className={`tournament-status ${
                                                                    tournament.status === 'active' ? 'active' : 
                                                                    tournament.status === 'in_progress' ? 'in-progress' : 
                                                                    'completed'
                                                                }`}>
                                                                    {tournament.status === 'active' ? 'Активен' : 
                                                                     tournament.status === 'in_progress' ? 'Идет' : 
                                                                     tournament.status === 'completed' ? 'Завершен' : 
                                                                     'Неизвестный статус'}
                                                                </span>
                                                            </div>
                                                            <div className="tournament-info">
                                                                <span className="tournament-label">Результат:</span>
                                                                <span className="tournament-value">
                                                                    {tournament.tournament_result ? (
                                                                        <span className={`tournament-result ${
                                                                            tournament.tournament_result.toLowerCase().includes('победитель') ? 'победитель' :
                                                                            tournament.tournament_result.toLowerCase().includes('место') ? 'призер' :
                                                                            tournament.tournament_result.toLowerCase().includes('финал') ? 'призер' :
                                                                            'участник'
                                                                        }`}>
                                                                            {tournament.tournament_result}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="tournament-result pending">
                                                                            {tournament.status === 'completed' ? 'Не указан' : 'В процессе'}
                                                                        </span>
                                                                    )}
                                                                    {tournament.wins !== undefined && tournament.losses !== undefined && (
                                                                        <div className="tournament-stats">
                                                                            <small> ({tournament.wins}П/{tournament.losses}П)</small>
                                                                        </div>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {filteredAndSortedUserTournaments.length === 0 && (
                                            <div className="empty-state">
                                                <div className="empty-state-title">Турниры не найдены</div>
                                                <div className="empty-state-description">
                                                    {userTournaments.length === 0 
                                                        ? 'Вы еще не участвовали в турнирах'
                                                        : 'Попробуйте изменить фильтры поиска'
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                        
                        {/* Achievements Tab */}
                        {activeTab === 'achievements' && (
                            <>
                                <div className="content-header">
                                    <h2 className="content-title">🏆 Достижения</h2>
                                    <div className="achievements-summary">
                                        <div className="achievement-stat">
                                            <span className="achievement-count">{userAchievements.length}</span>
                                            <span className="achievement-label">получено</span>
                                        </div>
                                        <div className="achievement-stat">
                                            <span className="achievement-count">{achievements.length - userAchievements.length}</span>
                                            <span className="achievement-label">осталось</span>
                                        </div>
                                        <div className="achievement-stat">
                                            <span className="achievement-count">{playerLevel || 1}</span>
                                            <span className="achievement-label">уровень</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Player Progress Card */}
                                <div className="content-card player-progress-card">
                                    <div className="card-header">
                                        <h3 className="card-title">🔥 Прогресс игрока</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="player-level-section">
                                            <div className="level-info">
                                                <div className="current-level">
                                                    <span className="level-number">{playerLevel || 1}</span>
                                                    <span className="level-label">УРОВЕНЬ</span>
                                                </div>
                                                <div className="xp-progress">
                                                    <div className="xp-info">
                                                        <span className="current-xp">{playerXP || 0} XP</span>
                                                        {(playerLevel || 1) < 100 && (
                                                            <span className="next-level-xp">
                                                                / {((playerLevel || 1) * 1000)} XP до {(playerLevel || 1) + 1} уровня
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="xp-bar">
                                                        <div 
                                                            className="xp-fill" 
                                                            style={{
                                                                width: `${(playerLevel || 1) < 100 ? 
                                                                    Math.min(((playerXP || 0) / ((playerLevel || 1) * 1000)) * 100, 100) : 
                                                                    100}%`
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {dailyStreak > 0 && (
                                                <div className="daily-streak">
                                                    <div className="streak-icon">🔥</div>
                                                    <div className="streak-info">
                                                        <div className="streak-number">{dailyStreak}</div>
                                                        <div className="streak-label">дней подряд</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Achievement Categories */}
                                <div className="content-card achievements-section">
                                    <div className="card-header">
                                        <h3 className="card-title">Категории достижений</h3>
                                        <div className="achievement-filters">
                                            {achievementCategories.map(category => (
                                                <button
                                                    key={category.id}
                                                    className={`category-filter ${selectedAchievementCategory === category.id ? 'active' : ''}`}
                                                    onClick={() => setSelectedAchievementCategory(category.id)}
                                                >
                                                    <span className="category-icon">{category.icon}</span>
                                                    <span className="category-name">{category.name}</span>
                                                    <span className="category-count">
                                                        {userAchievements.filter(ua => achievements.find(a => a.id === ua.achievement_id)?.category_id === category.id).length}/
                                                        {achievements.filter(a => a.category_id === category.id).length}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="card-content">
                                        <div className="achievements-grid">
                                            {achievements
                                                .filter(achievement => 
                                                    selectedAchievementCategory === 'all' || 
                                                    achievement.category_id === selectedAchievementCategory
                                                )
                                                .map(achievement => {
                                                    const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
                                                    const isUnlocked = !!userAchievement;
                                                    const progress = achievementProgress[achievement.id] || 0;
                                                    const progressPercent = achievement.max_progress > 0 ? 
                                                        Math.min((progress / achievement.max_progress) * 100, 100) : 0;

                                                    return (
                                                        <div key={achievement.id} className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
                                                            <div className="achievement-icon">
                                                                {isUnlocked ? achievement.icon : '🔒'}
                                                            </div>
                                                            <div className="achievement-info">
                                                                <h4 className="achievement-name">{achievement.name}</h4>
                                                                <p className="achievement-description">{achievement.description}</p>
                                                                
                                                                {achievement.max_progress > 0 && (
                                                                    <div className="achievement-progress">
                                                                        <div className="progress-bar">
                                                                            <div 
                                                                                className="progress-fill" 
                                                                                style={{width: `${progressPercent}%`}}
                                                                            ></div>
                                                                        </div>
                                                                        <div className="progress-text">
                                                                            {progress} / {achievement.max_progress}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                
                                                                <div className="achievement-meta">
                                                                    <div className="achievement-xp">
                                                                        <span className="xp-icon">⭐</span>
                                                                        <span className="xp-value">{achievement.xp_reward} XP</span>
                                                                    </div>
                                                                    {isUnlocked && userAchievement && (
                                                                        <div className="achievement-date">
                                                                            Получено: {new Date(userAchievement.unlocked_at).toLocaleDateString('ru-RU')}
                                                                        </div>
                                                                    )}
                                                                    {achievement.rarity && (
                                                                        <div className={`achievement-rarity rarity-${achievement.rarity}`}>
                                                                            {achievement.rarity === 'common' && '🥉 Обычное'}
                                                                            {achievement.rarity === 'rare' && '🥈 Редкое'}
                                                                            {achievement.rarity === 'epic' && '🥇 Эпическое'}
                                                                            {achievement.rarity === 'legendary' && '💎 Легендарное'}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {newAchievementsCount > 0 && userAchievement && 
                                                                Date.now() - new Date(userAchievement.unlocked_at).getTime() < 24 * 60 * 60 * 1000 && (
                                                                <div className="achievement-new-badge">NEW!</div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                        
                                        {achievements
                                            .filter(achievement => 
                                                selectedAchievementCategory === 'all' || 
                                                achievement.category_id === selectedAchievementCategory
                                            ).length === 0 && (
                                            <div className="empty-state">
                                                <div className="empty-state-title">Достижения не найдены</div>
                                                <div className="empty-state-description">
                                                    В выбранной категории пока нет достижений
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Recent Achievements */}
                                {userAchievements.slice(0, 5).length > 0 && (
                                    <div className="content-card recent-achievements">
                                        <div className="card-header">
                                            <h3 className="card-title">🌟 Недавние достижения</h3>
                                        </div>
                                        <div className="card-content">
                                            <div className="recent-achievements-list">
                                                {userAchievements
                                                    .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at))
                                                    .slice(0, 5)
                                                    .map(userAchievement => {
                                                        const achievement = achievements.find(a => a.id === userAchievement.achievement_id);
                                                        if (!achievement) return null;
                                                        
                                                        return (
                                                            <div key={userAchievement.id} className="recent-achievement-item">
                                                                <div className="recent-achievement-icon">{achievement.icon}</div>
                                                                <div className="recent-achievement-info">
                                                                    <div className="recent-achievement-name">{achievement.name}</div>
                                                                    <div className="recent-achievement-date">
                                                                        {new Date(userAchievement.unlocked_at).toLocaleDateString('ru-RU')}
                                                                    </div>
                                                                </div>
                                                                <div className="recent-achievement-xp">
                                                                    +{achievement.xp_reward} XP
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Achievement Statistics */}
                                <div className="content-card achievement-statistics">
                                    <div className="card-header">
                                        <h3 className="card-title">📊 Статистика достижений</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="stats-grid">
                                            <div className="stat-item">
                                                <div className="stat-value">{userAchievements.length}</div>
                                                <div className="stat-label">Получено достижений</div>
                                            </div>
                                            <div className="stat-item">
                                                <div className="stat-value">
                                                    {Math.round((userAchievements.length / Math.max(achievements.length, 1)) * 100)}%
                                                </div>
                                                <div className="stat-label">Прогресс</div>
                                            </div>
                                            <div className="stat-item">
                                                <div className="stat-value">
                                                    {userAchievements.reduce((total, ua) => {
                                                        const achievement = achievements.find(a => a.id === ua.achievement_id);
                                                        return total + (achievement?.xp_reward || 0);
                                                    }, 0)}
                                                </div>
                                                <div className="stat-label">XP из достижений</div>
                                            </div>
                                            <div className="stat-item">
                                                <div className="stat-value">
                                                    {userAchievements.filter(ua => {
                                                        const achievement = achievements.find(a => a.id === ua.achievement_id);
                                                        return achievement?.rarity === 'epic' || achievement?.rarity === 'legendary';
                                                    }).length}
                                                </div>
                                                <div className="stat-label">Редких достижений</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Modals */}
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