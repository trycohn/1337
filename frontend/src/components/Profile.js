/* eslint-disable no-undef */
import React, { useState, useEffect, useRef } from 'react';
import Skeleton from 'react-loading-skeleton';
import api from '../axios';
import ProfileReputation from './ProfileReputation'; // Компонент репутации
import DetailedStats from './stats/DetailedStats'; // 📊 Детальная статистика
import ProfileShowcase from './ProfileShowcase'; // 🏆 Витрина достижений
import PlayerForm from './PlayerForm'; // 🔥 Текущая форма игрока
import FriendsComparison from './FriendsComparison'; // 👥 Сравнение с друзьями
import useRealTimeStats from '../hooks/useRealTimeStats'; // 🔌 Real-time обновления
import './Profile.css';
import { isCurrentUser, ensureHttps } from '../utils/userHelpers';
import { useAuth } from '../context/AuthContext';
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

import AchievementsPanel from './achievements/AchievementsPanel';
import MobileProfileSheet from './MobileProfileSheet';
import MyTeams from './MyTeams';

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

// Подборщик предзагруженных аватарок (подкомпонент)
function PreloadedAvatarPicker({ onPicked }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [filterCat, setFilterCat] = useState('all');

    useEffect(() => {
        let mounted = true;
        (async function fetchList() {
            try {
                setLoading(true);
                const res = await api.get('/api/users/preloaded-avatars');
                if (!mounted) return;
                setItems((res.data && res.data.avatars) || []);
            } catch (e) {
                if (!mounted) return;
                setErrorMsg('Не удалось загрузить список аватаров');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    return (
        <div className="preloaded-avatars-container">
            <div className="preloaded-header">
                <h4>Быстрый выбор</h4>
            </div>
            {loading && (
                <div className="preloaded-skeletons">
                    <Skeleton height={24} width={180} style={{ marginBottom: 12 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 48px)', gap: 12 }}>
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} width={48} height={48} />
                        ))}
                    </div>
                </div>
            )}
            {errorMsg && <div className="error">{errorMsg}</div>}
            {!loading && !errorMsg && (
                <div className="preloaded-avatars-grid">
                    <div className="preloaded-filter" style={{display:'flex', gap:12, alignItems:'center'}}>
                        <span style={{color:'#aaa', fontSize:12, textTransform:'uppercase'}}>Фильтр:</span>
                        <select value={filterCat} onChange={(e)=>setFilterCat(e.target.value)} className="status-filter">
                            <option value="all">Все</option>
                            <option value="standard">Стандартные</option>
                            <option value="rare">Редкие</option>
                            <option value="special">Специальные</option>
                            <option value="epic">Эпические</option>
                            <option value="legendary">Легендарные</option>
                        </select>
                    </div>

                    {['standard','rare','special','epic','legendary'].map(cat => {
                        if (filterCat !== 'all' && filterCat !== cat) return null;
                        const group = items.filter(i => (i.category || 'standard') === cat);
                        if (group.length === 0) return null;
                        return (
                            <div key={cat} className={`pre-avatar-group group-${cat}`}>
                                <div className="group-header">
                                    {cat === 'legendary' ? 'Легендарные' : cat === 'epic' ? 'Эпические' : cat === 'special' ? 'Специальные' : cat === 'rare' ? 'Редкие' : 'Стандартные'}
                                </div>
                                <div className="group-grid">
                                    {group.map((it) => (
                                        <button
                                            key={it.filename}
                                            className={`pre-avatar-item cat-${cat}`}
                                            onClick={() => onPicked && onPicked(it.url)}
                                            title={it.filename}
                                            aria-label={`Выбрать аватар ${it.filename}`}
                                        >
                                            <img src={it.url} alt={it.filename} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {items.length === 0 && (
                        <div className="empty-state" style={{padding: '16px'}}>Пока нет предзагруженных аватарок</div>
                    )}
                </div>
            )}
        </div>
    );
}

function Profile() {
    const { user, loading: authLoading, updateUser } = useAuth(); // Получаем пользователя из AuthContext
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
    const [recentMatches, setRecentMatches] = useState([]);
    
    // Avatar states
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
    const [verificationSuccess, setVerificationSuccess] = useState('');
    
    // Email adding states
    const [showAddEmailModal, setShowAddEmailModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [addEmailError, setAddEmailError] = useState('');
    
    // Email required modal state
    const [showEmailRequiredModal, setShowEmailRequiredModal] = useState(false);

    // Password change states
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

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
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
    const [sheetOpen, setSheetOpen] = useState(false);

    // 🔌 Real-time обновления через WebSocket
    const handleRealTimeUpdate = (update) => {
        console.log('📊 [Profile] Получено real-time обновление:', update);
        
        if (update.type === 'achievement') {
            // Показываем уведомление о новом достижении
            console.log('🏆 Новое достижение разблокировано!');
            // Можно добавить toast-уведомление
        } else if (update.type === 'levelUp') {
            console.log('⭐ Повышение уровня!', update.data);
            // Можно добавить celebration анимацию
        } else {
            // Обновляем статистику
            fetchUserStats();
        }
    };

    const { connected: wsConnected } = useRealTimeStats(user?.id, handleRealTimeUpdate);

    // 🔧 Глобально, безусловно регистрируем обработчик ресайза (исключаем условные вызовы хуков)
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // 🔎 Иконки игр (мэппинг названия → код иконки/бейджа)
    function getGameKey(game) {
        if (!game) return 'game';
        const g = String(game).toLowerCase();
        if (g.includes('dota')) return 'dota2';
        if (g.includes('valorant')) return 'valorant';
        if (g.includes('quake')) return 'quake';
        if (g.includes('league of legends') || g.includes('lol')) return 'lol';
        if (g.includes('танков') || g.includes('world of tanks')) return 'wot';
        if (g.includes('hearthstone')) return 'hearthstone';
        if (g.includes('cs 1.6')) return 'cs16';
        if (g.includes('eafc')) return 'eafc25';
        if (g.includes('counter strike 2') || g.includes('cs2') || g.includes('counter-strike 2')) return 'cs2';
        if (g.includes('apex')) return 'apex';
        if (g.includes('fortnite')) return 'fortnite';
        if (g.includes('pubg')) return 'pubg';
        if (g.includes('rocket league')) return 'rocketleague';
        if (g.includes('overwatch')) return 'overwatch2';
        if (g.includes('rainbow six') || g.includes('r6')) return 'r6s';
        return 'game';
    }

    function renderGameIcon(game) {
        // Переход на использование общих иконок из public/images/games_icons
        try {
            const { GameIcon } = require('../utils/game-icons');
            return <GameIcon game={game} size={20} className="tournament-game-icon" />;
        } catch (e) {
        const key = getGameKey(game);
        const title = game || '';
        const initialsMap = {
            dota2: 'D2', valorant: 'V', quake: 'Q', lol: 'LoL', wot: 'WoT', hearthstone: 'Hs', cs16: 'CS',
            eafc25: 'EA', cs2: 'CS2', apex: 'A', fortnite: 'F', pubg: 'P', rocketleague: 'RL', overwatch2: 'OW', r6s: 'R6', game: 'G'
        };
        const text = initialsMap[key] || 'G';
        return (
            <span className={`game-icon-badge game-${key}`} title={title} aria-label={title}>{text}</span>
        );
        }
    }

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
    const [editingOrgSlug, setEditingOrgSlug] = useState(null);
    const [editOrgData, setEditOrgData] = useState({ name: '', description: '', website_url: '', vk_url: '', telegram_url: '', contact_email: '', contact_phone: '', logo_url: '' });
    const [editOrgLogoFile, setEditOrgLogoFile] = useState(null);
    const editOrgFileInputRef = useRef(null);
    const [loadingOrganizations, setLoadingOrganizations] = useState(false);
    const [showOrgRequestForm, setShowOrgRequestForm] = useState(false);
    
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
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [performanceData, setPerformanceData] = useState([]);
    const [leaderboards, setLeaderboards] = useState([]);
    const [currentStreak, setCurrentStreak] = useState(null);
    const [isLoadingV4Stats, setIsLoadingV4Stats] = useState(false);
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


    // 🏆 КОНСТАНТЫ КАТЕГОРИЙ ДОСТИЖЕНИЙ
    const achievementCategories = [
        { id: 'all', name: 'Все', icon: '🎯' },
        { id: 'tournaments', name: 'Турниры', icon: '🏆' },
        { id: 'matches', name: 'Матчи', icon: '⚔️' },
        { id: 'social', name: 'Социальные', icon: '👥' },
        { id: 'streaks', name: 'Серии', icon: '🔥' },
        { id: 'special', name: 'Особые', icon: '💎' }
    ];

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

    // Функция для получения приблизительного MMR на основе rank_tier
    const getDotaMMR = (dotaStatsProfile) => {
        if (!dotaStatsProfile) return 0;
        
        // Приоритет 1: точный MMR из соревновательного режима
        if (dotaStatsProfile.solo_competitive_rank && dotaStatsProfile.solo_competitive_rank > 0) {
            return dotaStatsProfile.solo_competitive_rank;
        }
        
        if (dotaStatsProfile.competitive_rank && dotaStatsProfile.competitive_rank > 0) {
            return dotaStatsProfile.competitive_rank;
        }
        
        // Приоритет 2: наш расчетный MMR
        if (dotaStatsProfile.estimated_mmr && dotaStatsProfile.estimated_mmr > 0) {
            return dotaStatsProfile.estimated_mmr;
        }
        
        // Приоритет 3: расчет MMR на основе rank_tier (fallback)
        if (dotaStatsProfile.rank_tier) {
            const rankTier = dotaStatsProfile.rank_tier;
            const rankNumber = Math.floor(rankTier / 10); // 1-8 (Herald-Immortal)
            const stars = rankTier % 10; // 1-5
            
            // MMR диапазоны для каждого ранга (средние значения)
            const mmrRanges = {
                1: { 1: 77, 2: 231, 3: 385, 4: 539, 5: 693 }, // Herald
                2: { 1: 847, 2: 1001, 3: 1155, 4: 1309, 5: 1463 }, // Guardian
                3: { 1: 1617, 2: 1771, 3: 1925, 4: 2079, 5: 2233 }, // Crusader
                4: { 1: 2387, 2: 2541, 3: 2695, 4: 2849, 5: 3003 }, // Archon
                5: { 1: 3157, 2: 3311, 3: 3465, 4: 3619, 5: 3773 }, // Legend
                6: { 1: 3927, 2: 4081, 3: 4235, 4: 4389, 5: 4543 }, // Ancient
                7: { 1: 4720, 2: 4920, 3: 5120, 4: 5320, 5: 5420 }, // Divine
                8: { 1: 5620, 2: 5720, 3: 5820, 4: 5920, 5: 6020 } // Immortal
            };
            
            if (rankNumber >= 1 && rankNumber <= 8 && stars >= 1 && stars <= 5) {
                return mmrRanges[rankNumber] && mmrRanges[rankNumber][stars] ? mmrRanges[rankNumber][stars] : 0;
            }
        }
        
        return 0;
    };

    // УБИРАЕМ ЗАПРОС К /api/users/me - используем данные из AuthContext
    const initializeUserData = () => {
        if (user) {
            console.log('✅ Инициализация профиля из AuthContext:', user.username);
            setNewUsername(user.username);
            
            // Извлекаем ранг Premier из данных пользователя
            if (user.cs2_premier_rank) {
                setPremierRank(user.cs2_premier_rank);
            }
            
            // Автоматически загружаем статистику CS2 только при первой привязке Steam
            // (только если есть steam_id и нет cs2_premier_rank)
            if (user.steam_id && user.cs2_premier_rank === 0) {
                fetchCs2Stats(user.steam_id);
            }
        }
    };

    const fetchCs2Stats = async (steamId) => {
        const id = steamId || (user && user.steam_id);
        if (!id) return;
        
        const startedAt = Date.now();
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
            const elapsed = Date.now() - startedAt;
            const wait = elapsed < 1000 ? (1000 - elapsed) : 0;
            setTimeout(() => setIsLoadingCs2Stats(false), wait);
        }
    };   

    const fetchStats = async (token) => {
        try {
            // 🔄 ВКЛЮЧАЕМ ОБРАТНО автоматический пересчет статистики С ЗАЩИТОЙ ОТ ЧАСТЫХ ЗАПРОСОВ
            setIsRecalculating(true);
            setRecalculationStatus('Проверяем статистику турниров...');
            setRecalculationError('');
            
            // Добавляем защиту от частых запросов - не чаще раза в 30 секунд
            const lastRecalcTime = localStorage.getItem('lastRecalcTime');
            const now = Date.now();
            const RECALC_COOLDOWN = 30000; // 30 секунд
            
            let shouldRecalculate = true;
            if (lastRecalcTime) {
                const timeSinceLastRecalc = now - parseInt(lastRecalcTime);
                if (timeSinceLastRecalc < RECALC_COOLDOWN) {
                    console.log('🛡️ [Profile] Пропускаем пересчет - cooldown активен');
                    setRecalculationStatus('✅ Статистика актуальна (недавно обновлена)');
                    shouldRecalculate = false;
                }
            }
            
            if (shouldRecalculate) {
                try {
                    localStorage.setItem('lastRecalcTime', now.toString());
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
                    }
                } catch (recalcError) {
                    console.warn('⚠️ Ошибка автоматического пересчета:', recalcError);
                    setRecalculationError('⚠️ Пересчет статистики пропущен (сервер занят)');
                    
                    // Graceful degradation - продолжаем выполнение даже если пересчет не удался
                }
            }
            
            console.log('📊 Загружаем статистику пользователя...');
            const response = await api.get('/api/users/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(response.data);
            
            // Загружаем недавние матчи для отображения формы
            try {
                const recentResponse = await api.get(`/api/player-stats/player/${user.id}/recent?limit=10`);
                if (recentResponse.data.success) {
                    setRecentMatches(recentResponse.data.matches);
                }
            } catch (err) {
                console.log('⚠️ Не удалось загрузить недавние матчи:', err);
            }
            
            // Показываем финальный статус успеха
            if (!recalculationError && shouldRecalculate) {
                setRecalculationStatus('✅ Статистика актуальна');
                setTimeout(() => {
                    setRecalculationStatus('');
                }, 3000); // Показываем успех 3 секунды
            } else if (!shouldRecalculate) {
                setTimeout(() => {
                    setRecalculationStatus('');
                }, 2000); // Показываем статус 2 секунды
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
        
        const startedAt = Date.now();
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
            const elapsed = Date.now() - startedAt;
            const wait = elapsed < 1000 ? (1000 - elapsed) : 0;
            setTimeout(() => setIsLoadingDotaStats(false), wait);
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
            // setUser(prevUser => prevUser ? { ...prevUser, steam_id: steamId, steam_url: `https://steamcommunity.com/profiles/${steamId}` } : null); // Убран - используем AuthContext
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
            // setUser(prevUser => prevUser ? { ...prevUser, steam_id: null, steam_url: null } : null); // Убран - используем AuthContext
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
            // setUser(prevUser => prevUser ? { ...prevUser, faceit_id: null } : null); // Убран - используем AuthContext
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
            // setUser(prevUser => prevUser ? { ...prevUser, username: newUsername } : null); // Убран - используем AuthContext
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
            setVerificationSuccess('');
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
            // setUser(prevUser => prevUser ? { ...prevUser, is_verified: true } : null); // Убран - используем AuthContext
            setError('');
            setVerificationError('');
            setVerificationSuccess('Верификация прошла успешно. Обновляем профиль...');
            // Показываем сообщение 3 секунды, затем перезагружаем профиль
            setTimeout(() => {
                closeEmailVerificationModal();
                if (typeof window !== 'undefined') window.location.reload();
            }, 3000);
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
        if (token && user) {
            // Инициализируем данные профиля из AuthContext
            initializeUserData();
            // Загружаем статистику
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
    }, [user]); // Добавляем user в зависимости для загрузки данных когда пользователь готов

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
        const startedAt = Date.now();
        try {
            const response = await api.get('/api/users/steam-nickname', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const nickname = response.data.steamNickname;
            const elapsed = Date.now() - startedAt;
            const wait = elapsed < 1000 ? (1000 - elapsed) : 0;
            setTimeout(() => setSteamNickname(nickname), wait);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка получения никнейма Steam');
        }
    };

    const fetchFaceitInfo = async () => {
        const token = localStorage.getItem('token');
        const startedAt = Date.now();
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
            const elapsed = Date.now() - startedAt;
            const wait = elapsed < 1000 ? (1000 - elapsed) : 0;
            setTimeout(() => setIsLoadingFaceitInfo(false), wait);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('faceit') === 'success') {
            initializeUserData();
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
        
        // Сначала сохраняем email на сервере
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/users/update-email', { email: newEmail }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            setAddEmailError(err.response?.data?.error || err.response?.data?.message || 'Ошибка сохранения email');
            return;
        }
        
        // Затем обновляем локальные данные и открываем модал верификации
        try {
            updateUser({ email: newEmail, is_verified: false });
            closeAddEmailModal();
            setShowEmailVerificationModal(true);
        } catch (uiErr) {
            console.error('Ошибка локального обновления после сохранения email:', uiErr);
        }
            
        // И наконец, отправляем код верификации (ошибки тут не считаем ошибкой сохранения)
        try {
            await sendVerificationCode();
            localStorage.setItem('verification_code_sent', 'true');
        } catch (sendErr) {
            console.error('Не удалось отправить код верификации:', sendErr);
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

    // Функции для смены пароля
    const openChangePasswordModal = () => {
        setShowChangePasswordModal(true);
        setPasswordError('');
        setPasswordSuccess('');
        setPasswordData({
            oldPassword: '',
            newPassword: '',
            confirmPassword: ''
        });
    };

    const closeChangePasswordModal = () => {
        setIsClosingModal(true);
        
        setTimeout(() => {
            setShowChangePasswordModal(false);
            setIsClosingModal(false);
            setPasswordError('');
            setPasswordSuccess('');
            setPasswordData({
                oldPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        }, 300);
    };

    const handlePasswordChange = (field, value) => {
        setPasswordData(prev => ({
            ...prev,
            [field]: value
        }));
        
        // Сброс ошибок при изменении полей
        if (passwordError) {
            setPasswordError('');
        }
    };

    const changePassword = async () => {
        const { oldPassword, newPassword, confirmPassword } = passwordData;
        
        // Валидация на frontend
        if (!oldPassword || !newPassword || !confirmPassword) {
            setPasswordError('Все поля обязательны для заполнения');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            setPasswordError('Новые пароли не совпадают');
            return;
        }
        
        if (newPassword.length < 6) {
            setPasswordError('Новый пароль должен содержать минимум 6 символов');
            return;
        }
        
        setIsChangingPassword(true);
        setPasswordError('');
        
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/users/change-password', passwordData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setPasswordSuccess('Пароль успешно изменен');
            
            // Автоматически закрываем модальное окно через 2 секунды
            setTimeout(() => {
                closeChangePasswordModal();
            }, 2000);
            
        } catch (err) {
            setPasswordError(err.response?.data?.message || 'Ошибка при смене пароля');
        } finally {
            setIsChangingPassword(false);
        }
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
            
            // Обновляем аватар в AuthContext
            updateUser({ avatar_url: response.data.avatar_url });
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
            
            // Обновляем аватар в AuthContext
            updateUser({ avatar_url: response.data.avatar_url });
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
            
            // Обновляем аватар в AuthContext
            updateUser({ avatar_url: response.data.avatar_url });
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
        if (tabName === 'matchhistory' && user && !loadingMatchHistory) {
            loadMatchHistory(user.id).catch(() => {});
        }
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
                    {lastFive.map((match, index) => {
                        const result = (match.result || '').toLowerCase();
                        const resultClass = result === 'win' ? 'win' : result === 'draw' ? 'draw' : 'loss';
                        const statusLabel = result === 'win' ? 'Победа' : result === 'draw' ? 'Ничья' : 'Поражение';
                        const rawOpponent = match.opponent || '';
                        const isOpponentKnown = !!rawOpponent && rawOpponent !== 'Неизвестный соперник';
                        const opponent = isOpponentKnown ? rawOpponent : 'Нет данных';
                        const dateText = match.date ? new Date(match.date).toLocaleDateString('ru-RU') : '';
                        const hasScore = !!match.score;
                        const scoreText = hasScore ? match.score : '—';
                        if (!isOpponentKnown && !hasScore) {
                            return (
                                <div key={index} className="match-row empty">
                                    <div className="match-empty">Нет данных</div>
                            </div>
                            );
                        }
                        return (
                            <div key={index} className={`match-row ${resultClass}`}>
                                <div className="match-date" title={dateText}>{dateText || '—'}</div>
                                <div className={`match-opponent${isOpponentKnown ? '' : ' empty'}`} title={opponent}>{opponent}</div>
                                <div className="match-score">{scoreText}</div>
                                <div className="match-status">
                                    <span className="result">{statusLabel}</span>
                                    {(match.is_test || match.test) && <span className="match-badge-test">Тест</span>}
                            </div>
                        </div>
                        );
                    })}
                </div>
                <button className="view-all-btn view-all-btn-red" onClick={openMatchHistoryModal}>
                    Показать все матчи →
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

    // Render friend item — новый дизайн карточки из макета
    const renderFriendItem = (friend) => {
        const statusRaw = friend.friend.online_status || 'offline';
        const username = friend.friend.username;
        const profileHref = isCurrentUser(friend.friend.id) ? `/profile` : `/user/${friend.friend.id}`;

        let dotClass = 'offline';
        let statusLabel = 'Не в сети';
        if (statusRaw === 'online') { dotClass = 'online'; statusLabel = 'В сети'; }
        else if (statusRaw === 'ingame' || statusRaw === 'in_game' || statusRaw === 'playing') { dotClass = 'ingame'; statusLabel = 'В игре'; }
        
        return (
            <div key={friend.id} className="card">
                <div className="avatar">
                    <img 
                        src={ensureHttps(friend.friend.avatar_url) || '/default-avatar.png'} 
                        alt={username}
                    />
                        </div>
                <div className="info">
                    <div className="name" title={username}>{username}</div>
                    <div className="meta">
                        <span className={`dot ${dotClass}`}></span>
                        <span>{statusLabel}</span>
                            </div>
                    <div className="toolbar">
                        <a className="btn" href={profileHref}>Профиль</a>
                        <button className="btn primary" onClick={() => openChatWith(friend.friend.id)}>Написать</button>
                    </div>
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

    // Открыть чат с пользователем (простая навигация)
    const openChatWith = (userId) => {
        window.location.href = `/chats?to=${userId}`;
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

    async function loadMatchHistory(userId) {
        try {
            setLoadingMatchHistory(true);
            const { data } = await api.get(`/api/admin/users/${userId}/matches`, {
                params: { page: 1, limit: 50 }
            });
            if (data?.success && Array.isArray(data.items)) {
                setMatchHistory(data.items);
            } else if (Array.isArray(data)) {
                // fallback: если вернулся массив без оболочки
                setMatchHistory(data);
            } else {
                setMatchHistory([]);
            }
        } catch (_) {
            setMatchHistory([]);
        } finally {
            setLoadingMatchHistory(false);
        }
    }

    if (!user) return <div className="loading-spinner">Загрузка...</div>;

    return (
        <div className="profile-container">
            {error && <div className="error">{error}</div>}
            
            {/* Header Section */}
            <div className="profile-header">
                <div className="profile-header-content">
                    <div className="profile-avatar-section">
                        <img 
                            src={ensureHttps(user.avatar_url) || '/default-avatar.png'} 
                            alt="Аватар пользователя" 
                            className="profile-avatar avatar-glow"
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
                        <div className="profile-user-meta meta-row">
                            <div className="meta-item" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <span>ID: {user.id}</span>
                                {Array.isArray(user?.roles) && user.roles.includes('verified_user') ? (
                                    <span className="badge-verified" title="Пользователь верифицирован">Пользователь верифицирован</span>
                                ) : (
                                    <span className="badge-unverified" title="Пользователь неверифицирован">Пользователь неверифицирован</span>
                                )}
                            </div>
                        </div>
                        
                        {/* 🏆 Витрина достижений */}
                        {stats && <ProfileShowcase stats={stats} userId={user.id} />}
                    </div>
                    
                    {/* Убраны быстрые статблоки из хедера по запросу */}
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
            
            {/* Horizontal Navigation Tabs */}
            <div className="profile-tabs-navigation">
                {isMobile ? (
                    <>
                        <button className="profile-toggle-button" onClick={() => setSheetOpen(true)} aria-label="Открыть меню профиля">
                            <span className="triangle" />
                        </button>
                        <MobileProfileSheet
                            isOpen={sheetOpen}
                            onClose={() => setSheetOpen(false)}
                            activeTab={activeTab}
                            onSelectTab={(key) => switchTab(key)}
                            tabs={[
                                { key: 'main', label: 'Основная' },
                                { key: 'stats', label: 'Статистика' },
                                { key: 'friends', label: 'Друзья' },
                                { key: 'teams', label: 'Мои команды' },
                                { key: 'matchhistory', label: 'История матчей' },
                                { key: 'achievements', label: 'Достижения' },
                                ...((userOrganizations && userOrganizations.length > 0) ? [{ key: 'organization', label: 'Организация' }] : []),
                                { key: 'tournaments', label: 'Турниры' },
                                { key: 'reputation', label: 'Репутация' },
                            ]}
                        />
                    </>
                ) : (
                    <div className="tabs-navigation-profile">
                        <button 
                            className={`tab-button-profile ${activeTab === 'main' ? 'active' : ''}`} 
                            onClick={() => switchTab('main')}
                        >
                            <span className="tab-label-profile">Основная</span>
                        </button>
                        <button 
                            className={`tab-button-profile ${activeTab === 'stats' ? 'active' : ''}`} 
                            onClick={() => switchTab('stats')}
                        >
                            <span className="tab-label-profile">Статистика</span>
                        </button>
                        <button 
                            className={`tab-button-profile ${activeTab === 'friends' ? 'active' : ''}`} 
                            onClick={() => switchTab('friends')}
                        >
                            <span className="tab-label-profile">Друзья</span>
                        </button>
                        <button 
                            className={`tab-button-profile ${activeTab === 'teams' ? 'active' : ''}`} 
                            onClick={() => switchTab('teams')}
                        >
                            <span className="tab-label-profile">Мои команды</span>
                        </button>
                        <button 
                            className={`tab-button-profile ${activeTab === 'matchhistory' ? 'active' : ''}`} 
                            onClick={() => switchTab('matchhistory')}
                        >
                            <span className="tab-label-profile">История матчей</span>
                        </button>
                        <button 
                            className={`tab-button-profile ${activeTab === 'achievements' ? 'active' : ''}`} 
                            onClick={() => switchTab('achievements')}
                        >
                            <span className="tab-label-profile">Достижения</span>
                            {newAchievementsCount > 0 && (
                                <span className="achievement-notification-badge">{newAchievementsCount}</span>
                            )}
                        </button>
                        {userOrganizations && userOrganizations.length > 0 && (
                            <button 
                                className={`tab-button-profile ${activeTab === 'organization' ? 'active' : ''}`} 
                                onClick={() => switchTab('organization')}
                            >
                                <span className="tab-label-profile">Организация</span>
                            </button>
                        )}
                        <button 
                            className={`tab-button-profile ${activeTab === 'tournaments' ? 'active' : ''}`} 
                            onClick={() => switchTab('tournaments')}
                        >
                            <span className="tab-label-profile">Турниры</span>
                        </button>
                        <button 
                            className={`tab-button-profile ${activeTab === 'reputation' ? 'active' : ''}`} 
                            onClick={() => switchTab('reputation')}
                        >
                            <span className="tab-label-profile">Репутация</span>
                        </button>
                    </div>
                )}
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
                                {/* Макетная зона: контейнер и карточки как в шаблоне */}
                                <div className="mi-scope">
                                    <div className="mi-container">
                                        <section className="mi-card">
                                            <h3 className="mi-title">Данные пользователя</h3>

                                            {/* Строка: Имя пользователя */}
                                            <div className="mi-form-row">
                                                <div className="mi-label">Имя пользователя</div>
                                            <input
                                                    className="mi-input"
                                                type="text"
                                                value={newUsername}
                                                onChange={(e) => setNewUsername(e.target.value)}
                                                placeholder="Новый никнейм"
                                            />
                                                <div className="mi-actions">
                                                    <button className="mi-btn" onClick={updateUsername}>Изменить ник</button>
                                            </div>
                                        </div>
                                        
                                            {/* Строка: Email */}
                                            <div className="mi-form-row">
                                                <div className="mi-label">Email</div>
                                                <div className="mi-value" style={{justifySelf: 'start', paddingLeft: '13px'}}>{user.email || 'Не указан'}</div>
                                                <div className="mi-actions">
                                                    {user.email ? (
                                                        user.is_verified ? (
                                                            <div className="mi-badge mi-badge-success">Подтвержден</div>
                                                        ) : (
                                                            <button className="mi-btn" onClick={openEmailVerificationModal}>Подтвердить</button>
                                                        )
                                                    ) : (
                                                        <button className="mi-btn" onClick={openAddEmailModal}>Привязать</button>
                                                )}
                                            </div>
                                        </div>

                                            {/* Строка: Пароль */}
                                            <div className="mi-form-row">
                                                <div className="mi-label">Пароль</div>
                                                <div className="mi-value" style={{justifySelf: 'start', paddingLeft: '13px'}}>••••••••</div>
                                                <div className="mi-actions">
                                                    <button className="mi-btn" onClick={openChangePasswordModal}>Сменить пароль</button>
                                            </div>
                                        </div>
                                        </section>

                                        {/* Макетный стиль: привязки аккаунтов */}
                                        <section className="mi-card">
                                            <h3 className="mi-title">Привязки аккаунтов</h3>

                                            {/* Steam */}
                                            <div className="mi-bind-row">
                                                <div className="mi-bind-left">
                                                    <div className="mi-service-icon" aria-hidden="true">
                                                        <i className="fa-brands fa-steam"></i>
                                    </div>
                                                    <div>
                                                        <div>Steam</div>
                                                        <div className={`mi-status ${user.steam_url ? 'ok' : 'none'}`}>
                                                            {user.steam_url ? (
                                                                steamNickname ? (
                                                                    <a href={user.steam_url} target="_blank" rel="noopener noreferrer">{steamNickname}</a>
                                                                ) : (
                                                                    <Skeleton width={120} height={16} baseColor="#2a2a2a" highlightColor="#3a3a3a" />
                                                                )
                                                            ) : 'Не привязан'}
                                        </div>
                                    </div>
                                                </div>
                                                {user.steam_url ? (
                                                    <button className="mi-btn mi-btn-danger" onClick={unlinkSteam}>Отвязать</button>
                                                ) : (
                                                    <button className="mi-btn" onClick={linkSteam}>Привязать</button>
                                                )}
                                </div>

                                            {/* Faceit */}
                                            <div className="mi-bind-row">
                                                <div className="mi-bind-left">
                                                    <div className="mi-service-icon" aria-hidden="true">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="24" height="24" aria-label="FACEIT shard">
                                                          <polygon fill="#AEB2B7" points="11 28 31 28 40 17 40 39"/>
                                                        </svg>
                                    </div>
                                        <div>
                                                        <div>Faceit</div>
                                                        <div className={`mi-status ${user.faceit_id ? 'ok' : 'none'}`}>
                                                            {user.faceit_id ? (
                                                                isLoadingFaceitInfo ? (
                                                                    <Skeleton width={120} height={16} baseColor="#2a2a2a" highlightColor="#3a3a3a" />
                                                                ) : (
                                                                    faceitInfo ? (
                                                                        <a href={faceitInfo.faceitUrl} target="_blank" rel="noopener noreferrer">{faceitInfo.faceitNickname}</a>
                                                                    ) : 'Активен'
                                                                )
                                                            ) : 'Не привязан'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {user.faceit_id ? (
                                                    <button className="mi-btn mi-btn-danger" onClick={unlinkFaceit}>Отвязать</button>
                                                ) : (
                                                    <button className="mi-btn" onClick={linkFaceit}>Привязать</button>
                                            )}
                                        </div>

                                            <div className="mi-helper">Опасные действия подсвечены красным. Привязка откроется в новом окне сервиса.</div>
                                        </section>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {/* Stats Tab */}
                        {activeTab === 'stats' && (
                            <>
                                <div className="content-header">
                                    <h2 className="content-title">Статистика</h2>
                                    {wsConnected && (
                                        <div className="realtime-indicator">
                                            <span className="realtime-dot"></span>
                                            <span className="realtime-text">Live</span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* 👥 Friends Comparison */}
                                <FriendsComparison userId={user.id} stats={stats} />
                                
                                {/* 📊 DETAILED STATS - FIRST BLOCK */}
                                <div className="content-card">
                                    <div className="card-header">
                                        <h3 className="card-title">Детальная статистика</h3>
                                    </div>
                                    <div className="card-content">
                                        <DetailedStats userId={user.id} />
                                        {/* 🔥 Player Form - Current streak and trend */}
                                        <PlayerForm recentMatches={recentMatches} stats={stats} />
                                    </div>
                                </div>
                                
                                {/* Site Stats */}
                                <div className="content-card">
                                    <div className="card-header">
                                        <h3 className="card-title">Статистика сайта</h3>
                                        {isRecalculating && (
                                            <div className="recalculation-status-container">
                                                <Skeleton width={220} height={16} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="card-content">
                                        {stats ? (
                                            <div className="stats-grid stats-grid-compact">
                                                <div className="stats-card stat-compact">
                                                    <div className="stat-icon" aria-hidden>🎮</div>
                                                    <div className="stats-value emphasis">
                                                        {(stats.solo.wins || 0) + (stats.solo.losses || 0) + (stats.team.wins || 0) + (stats.team.losses || 0)}
                                                    </div>
                                                    <div className="stats-label subtle">Всего матчей</div>
                                                </div>
                                                <div className="stats-card stat-compact">
                                                    <div className="stat-icon" aria-hidden>🏆</div>
                                                    <div className="stats-value emphasis">{stats.tournaments ? stats.tournaments.length : 0}</div>
                                                    <div className="stats-label subtle">Турниров</div>
                                                </div>
                                                <div className="stats-card stat-compact">
                                                    <div className="stat-icon" aria-hidden>🏆</div>
                                                    <div className="stats-value emphasis">
                                                        {stats.tournaments ? stats.tournaments.filter(t => t.result === 'Победитель').length : 0}
                                                    </div>
                                                    <div className="stats-label subtle">Выигранных турниров</div>
                                                </div>
                                                <div className="stats-card stat-compact stat-winrate">
                                                    <div className="stat-icon" aria-hidden>%</div>
                                                        {(() => {
                                                            const totalWins = (stats.solo.wins || 0) + (stats.team.wins || 0);
                                                            const totalMatches = (stats.solo.wins || 0) + (stats.solo.losses || 0) + (stats.team.wins || 0) + (stats.team.losses || 0);
                                                        const wr = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
                                                        return (
                                                            <div className="winrate-ring" style={{ '--value': wr }}>
                                                                <div className="ring-inner">{wr}%</div>
                                                    </div>
                                                        );
                                                    })()}
                                                    <div className="stats-label subtle">Винрейт</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="stats-grid stats-grid-compact">
                                                {[...Array(4)].map((_, i) => (
                                                    <div key={i} className="stats-card stat-compact">
                                                        <div className="stat-icon" aria-hidden>
                                                            <Skeleton circle width={24} height={24} />
                                                        </div>
                                                        <div className="stats-value emphasis">
                                                            <Skeleton width={80} height={24} />
                                                        </div>
                                                        <div className="stats-label subtle">
                                                            <Skeleton width={120} height={14} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* История матчей удалена из вкладки Статистика по требованию */}
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
                                {(user && user.role === 'admin' && user.steam_url) && (
                                    <div className="content-card cs2-stats">
                                        <div className="card-header">
                                            <h3 className="card-title">Статистика CS2</h3>
                                            {premierRank > 0 && (
                                                <button 
                                                    className="btn btn-sm" 
                                                    onClick={() => fetchCs2Stats()}
                                                    disabled={isLoadingCs2Stats}
                                                >
                                                    Обновить
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

                                {/* Dota 2 Stats (admin only) */}
                                {user && user.role === 'admin' && (
                                <div className="content-card dota-stats">
                                    <div className="card-header">
                                        <h3 className="card-title">Статистика Dota 2</h3>
                                        {!dotaProfile && user?.steam_id && (
                                            <button 
                                                className="btn btn-sm" 
                                                onClick={linkDotaSteam}
                                                disabled={isLoadingDotaStats}
                                            >
                                                Загрузить статистику
                                            </button>
                                        )}
                                    </div>
                                    <div className="card-content">
                                        {isLoadingDotaStats ? (
                                            <div className="dota-stats-skeleton">
                                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                    <Skeleton width={64} height={64} />
                                                    <div style={{ flex: 1 }}>
                                                        <Skeleton width={160} height={20} style={{ marginBottom: 8 }} />
                                                        <Skeleton width={220} height={16} />
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: 16 }}>
                                                    <Skeleton height={140} />
                                                </div>
                                            </div>
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
                                                                            estimated_mmr: dotaStats.profile?.estimated_mmr,
                                                                            mmr_estimate: dotaStats.profile?.mmr_estimate,
                                                                            leaderboard_rank: dotaStats.profile?.leaderboard_rank,
                                                                            rank_tier: dotaStats.profile?.rank_tier
                                                                        });
                                                                        
                                                                        // Приоритет 1: solo_competitive_rank (точный MMR)
                                                                        if (dotaStats.profile?.solo_competitive_rank && dotaStats.profile.solo_competitive_rank > 0) {
                                                                            mmrValue = dotaStats.profile.solo_competitive_rank;
                                                                            mmrSource = 'solo_competitive_rank';
                                                                        } 
                                                                        // Приоритет 2: competitive_rank (точный MMR)
                                                                        else if (dotaStats.profile?.competitive_rank && dotaStats.profile.competitive_rank > 0) {
                                                                            mmrValue = dotaStats.profile.competitive_rank;
                                                                            mmrSource = 'competitive_rank';
                                                                        }
                                                                        // Приоритет 3: estimated_mmr (наш расчетный MMR на основе rank_tier)
                                                                        else if (dotaStats.profile?.estimated_mmr && dotaStats.profile.estimated_mmr > 0) {
                                                                            mmrValue = dotaStats.profile.estimated_mmr;
                                                                            mmrSource = 'estimated_mmr';
                                                                        }
                                                                        // Приоритет 4: mmr_estimate (может быть объектом или числом)
                                                                        else if (dotaStats.profile?.mmr_estimate) {
                                                                            if (typeof dotaStats.profile.mmr_estimate === 'object' && dotaStats.profile.mmr_estimate.estimate) {
                                                                                mmrValue = dotaStats.profile.mmr_estimate.estimate;
                                                                                mmrSource = 'mmr_estimate.estimate';
                                                                            } else if (typeof dotaStats.profile.mmr_estimate === 'number' && dotaStats.profile.mmr_estimate > 0) {
                                                                                mmrValue = dotaStats.profile.mmr_estimate;
                                                                                mmrSource = 'mmr_estimate';
                                                                            }
                                                                        } 
                                                                        // Приоритет 5: leaderboard_rank для очень высоких MMR
                                                                        else if (dotaStats.profile?.leaderboard_rank && dotaStats.profile.leaderboard_rank > 0) {
                                                                            // Для leaderboard rank, примерный MMR можно оценить как 5500+ для топ игроков
                                                                            mmrValue = 5500 + Math.round((1000 - dotaStats.profile.leaderboard_rank) * 10);
                                                                            mmrSource = 'leaderboard_rank_estimate';
                                                                        }
                                                                        // Приоритет 6: проверяем корневой уровень mmr_estimate
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
                                                                            let mmrText = '';
                                                                            
                                                                            if (mmrSource === 'estimated_mmr') {
                                                                                mmrText = ` (~${Math.round(mmrValue)} MMR)`;
                                                                            } else if (mmrSource === 'leaderboard_rank_estimate') {
                                                                                mmrText = ` (~${Math.round(mmrValue)} MMR)`;
                                                                            } else {
                                                                                mmrText = ` (${Math.round(mmrValue)} MMR)`;
                                                                            }
                                                                            
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
                                )}
                            </>
                        )}
                        
                        {/* Friends Tab */}
                        {activeTab === 'friends' && (
                            <>
                                <div className="content-header">
                                    <h2 className="content-title">Друзья</h2>
                                </div>
                                
                                {/* Friends — новый макет */}
                                <div className="friends-wrap">
                                    <div className="section">
                                        <h2>Поиск друзей</h2>
                                        <div className="search">
                                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                                                <input
                                                    type="text"
                                                placeholder="Поиск пользователя по нику…"
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
                                                                <button onClick={() => sendFriendRequest(user.id)} className="btn btn-sm">
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

                                        <div className="list">
                                            <h2>Мои друзья ({friends.length})</h2>
                                        {loadingFriends ? (
                                            <div className="loading-spinner">Загрузка списка друзей...</div>
                                        ) : friends.length > 0 ? (
                                                <div className="grid">
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
                        
                        {/* Teams Tab */}
                        {activeTab === 'teams' && (
                            <>
                            <MyTeams user={user} />
                                {(!userOrganizations || userOrganizations.length === 0) && (
                                <div style={{ marginTop: 12, fontSize: '12px', color: 'var(--text-muted)' }}>
                                    Хотите создать новую организацию? Свяжитесь с администрацией для подачи заявки.
                                    <div style={{ marginTop: 8 }}>
                                        <button
                                            className="mi-btn"
                                            onClick={() => {
                                                if (!user.email) { openAddEmailModal(); return; }
                                                if (user.email && !user.is_verified) { openEmailVerificationModal(); return; }
                                                setShowOrgRequestForm(true);
                                                switchTab('organization');
                                            }}
                                        >
                                            Оставить заявку
                                        </button>
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
                                ) : (
                                    <>
                                        <div className="orgs-wrap">
                                            <div className="orgs-section">
                                                <h2 className="orgs-title">Мои организации</h2>
                                                <div className="orgs-grid">
                                                    {(userOrganizations || []).map((org) => (
                                                        <div key={org.id} className="org-card">
                                                            <div className="org-head">
                                                                <div className="org-avatar">
                                                                    <img src={ensureHttps(org.logo_url) || '/default-org-logo.png'} alt={org.name} />
                                            </div>
                                                                <div>
                                                                    <div className="org-name">{org.name}</div>
                                                                    <div className="org-role">{org.role === 'manager' ? 'Менеджер' : org.role === 'admin' ? 'Администратор' : 'Участник'}</div>
                                                                </div>
                                                                    </div>

                                                            <div className="org-meta">
                                                                <span className="org-badge">{org.tournaments_count || 0} турниров</span>
                                                                    </div>

                                                            {org.description && <div className="org-desc">{org.description}</div>}

                                                            <div className="org-actions">
                                                                {(org.role === 'manager' || (user && user.role === 'admin')) && (
                                                                    editingOrgSlug === org.slug ? (
                                                                        <button className="org-btn primary" onClick={async()=>{
                                                                            try {
                                                                                const token = localStorage.getItem('token');
                                                                                let logoUrl = editOrgData.logo_url || '';
                                                                                if (editOrgLogoFile) {
                                                                                    const fd = new FormData();
                                                                                    fd.append('logo', editOrgLogoFile);
                                                                                    const uploadRes = await api.post(`/api/organizers/${org.slug}/logo`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }});
                                                                                    if (uploadRes.data && uploadRes.data.success) logoUrl = uploadRes.data.url;
                                                                                }
                                                                                const body = { ...editOrgData, logo_url: logoUrl };
                                                                                await api.put(`/api/organizers/${org.slug}`, body, { headers: { Authorization: `Bearer ${token}` }});
                                                                                setEditingOrgSlug(null);
                                                                                setEditOrgLogoFile(null);
                                                                                await fetchUserOrganizations();
                                                                            } catch (e) {}
                                                                        }}>Сохранить</button>
                                                                    ) : (
                                                                        <button className="org-btn primary" onClick={()=>{
                                                                            setEditingOrgSlug(org.slug);
                                                                            setEditOrgData({
                                                                                name: org.name||'',
                                                                                description: org.description||'',
                                                                                website_url: org.website_url||'',
                                                                                vk_url: org.vk_url||'',
                                                                                telegram_url: org.telegram_url||'',
                                                                                contact_email: org.contact_email||'',
                                                                                contact_phone: org.contact_phone||'',
                                                                                logo_url: org.logo_url||''
                                                                            });
                                                                        }}>Редактировать</button>
                                                                    )
                                                                )}
                                                                <a className="org-btn" href={`/organizer/${org.slug}`} target="_blank" rel="noopener noreferrer">Перейти</a>
                                                            </div>
                                                            
                                                            {editingOrgSlug === org.slug && (
                                                                <div className="org-edit-form" style={{marginTop:12}}>
                                                                    <div className="form-group">
                                                                        <label>Название</label>
                                                                        <input value={editOrgData.name} onChange={(e)=>setEditOrgData({...editOrgData, name: e.target.value})} />
                                                                </div>
                                                                    <div className="form-group">
                                                                        <label>Описание</label>
                                                                        <textarea rows="3" value={editOrgData.description||''} onChange={(e)=>setEditOrgData({...editOrgData, description: e.target.value})} />
                                                            </div>
                                                                    <div className="form-row">
                                                                        <div className="form-group">
                                                                            <label>Сайт</label>
                                                                            <input value={editOrgData.website_url||''} onChange={(e)=>setEditOrgData({...editOrgData, website_url: e.target.value})} />
                                                                        </div>
                                                                        <div className="form-group">
                                                                            <label>VK</label>
                                                                            <input value={editOrgData.vk_url||''} onChange={(e)=>setEditOrgData({...editOrgData, vk_url: e.target.value})} />
                                                                        </div>
                                                                    </div>
                                                                    <div className="form-row">
                                                                        <div className="form-group">
                                                                            <label>Telegram</label>
                                                                            <input value={editOrgData.telegram_url||''} onChange={(e)=>setEditOrgData({...editOrgData, telegram_url: e.target.value})} />
                                                                        </div>
                                                                        <div className="form-group">
                                                                            <label>Email</label>
                                                                            <input value={editOrgData.contact_email||''} onChange={(e)=>setEditOrgData({...editOrgData, contact_email: e.target.value})} />
                                                                        </div>
                                                                        <div className="form-group">
                                                                            <label>Телефон</label>
                                                                            <input value={editOrgData.contact_phone||''} onChange={(e)=>setEditOrgData({...editOrgData, contact_phone: e.target.value})} />
                                                                        </div>
                                                                    </div>
                                                                    <div className="form-group">
                                                                        <label>Логотип</label>
                                                                        <div>
                                                                            <input type="file" ref={editOrgFileInputRef} accept="image/*" style={{display:'none'}} onChange={(e)=>{
                                                                                const f = e.target.files && e.target.files[0];
                                                                                if (!f) return;
                                                                                if (f.size > 10*1024*1024) return;
                                                                                setEditOrgLogoFile(f);
                                                                            }} />
                                                                            <button type="button" onClick={()=>editOrgFileInputRef.current && editOrgFileInputRef.current.click()} className="btn btn-secondary">Загрузить логотип</button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="form-actions">
                                                                        <button className="btn btn-secondary" onClick={()=>{ setEditingOrgSlug(null); setEditOrgLogoFile(null); }}>Отмена</button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}

                                                    {/* Плейсхолдер-плитка для создания новой организации */}
                                                    {!organizationRequest && (
                                                        <div className="org-card" style={{justifyContent:'center', alignItems:'center', textAlign:'center', gap:'10px'}}>
                                                            <div className="org-name">Создать организацию</div>
                                                            <div className="org-desc">Подайте заявку администратору для создания новой организации.</div>
                                                            <div className="org-actions" style={{justifyContent:'center'}}>
                                                                <button className="org-btn primary" onClick={()=>{
                                                                    if (!user.email) { openAddEmailModal(); return; }
                                                                    if (user.email && !user.is_verified) { openEmailVerificationModal(); return; }
                                                                    setShowOrgRequestForm(true);
                                                                }}>Оставить заявку</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="org-footer">
                                                    <span>Хотите создать новую организацию? Свяжитесь с администрацией для подачи заявки.</span>
                                                    {!organizationRequest && (
                                                        <button type="button" className="link" onClick={(e)=>{ if (!user.email) { openAddEmailModal(); return; } if (!user.is_verified) { openEmailVerificationModal(); return; } setShowOrgRequestForm(true); }}>Оставить заявку</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Статус заявки как карточка в общей сетке (только если не approved) */}
                                        {organizationRequest && organizationRequest.status !== 'approved' && (
                                            <div className="orgs-wrap" style={{paddingTop:0}}>
                                                <div className="orgs-section">
                                                    <div className="orgs-grid">
                                                        <div className="org-card">
                                                            <div className="org-head">
                                                                <div className="org-avatar"><img src={ensureHttps(user?.avatar_url) || '/default-avatar.png'} alt="" /></div>
                                                                <div>
                                                                    <div className="org-name">{organizationRequest.organization_name}</div>
                                                                    <div className="org-role">Заявка на организацию</div>
                                    </div>
                                            </div>
                                                            <div className="org-meta">
                                                                <span className={`org-badge ${organizationRequest.status}`}>
                                                            {organizationRequest.status === 'pending' && 'На рассмотрении'}
                                                            {organizationRequest.status === 'rejected' && 'Отклонена'}
                                                        </span>
                                                                <span className="org-badge">от {new Date(organizationRequest.created_at).toLocaleDateString('ru-RU')}</span>
                                                    </div>
                                                            {organizationRequest.description && (
                                                                <div className="org-desc">{organizationRequest.description}</div>
                                                            )}
                                                        {organizationRequest.admin_comment && (
                                                                <div className="org-desc">Комментарий администратора: {organizationRequest.admin_comment}</div>
                                                        )}
                                                            <div className="org-actions">
                                                                <button className="org-btn" onClick={()=>fetchOrganizationRequest()}>Обновить статус</button>
                                                                <button className="org-btn" onClick={()=>setShowOrgRequestForm(true)}>Изменить данные</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                        )}

                                        {/* Форма заявки (новый макет рендерим ниже грида) */}
                                        {showOrgRequestForm && (
                                    <div className="organization-tab">
                                        <div className="content-card">
                                            <div className="card-header">
                                                <h3 className="card-title">Заявка на создание аккаунта организации</h3>
                                            </div>
                                            <div className="card-content">
                                                <p>Заполните форму ниже, чтобы подать заявку на создание аккаунта организации. Это позволит вам организовывать турниры от имени вашей организации.</p>

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

                                                {user.email && user.is_verified && (
                                                    <form onSubmit={submitOrganizationRequest} className="organization-form">
                                                        {organizationError && (
                                                                    <div className="organization-error">{organizationError}</div>
                                                        )}
                                                        {organizationSuccess && (
                                                                    <div className="organization-success">{organizationSuccess}</div>
                                                        )}
                                                        <div className="form-group">
                                                                    <label htmlFor="organizationName">Название организации <span className="required">*</span></label>
                                                                    <input type="text" id="organizationName" name="organizationName" value={organizationData.organizationName} onChange={handleOrganizationInputChange} placeholder="Введите название вашей организации" required />
                                                        </div>
                                                        <div className="form-group">
                                                                    <label htmlFor="description">Краткое описание организации <span className="required">*</span></label>
                                                                    <textarea id="description" name="description" value={organizationData.description} onChange={handleOrganizationInputChange} placeholder="Расскажите о вашей организации, её деятельности и целях..." rows="4" required />
                                                        </div>
                                                        <div className="form-group">
                                                            <label htmlFor="websiteUrl">Сайт организации</label>
                                                                    <input type="url" id="websiteUrl" name="websiteUrl" value={organizationData.websiteUrl} onChange={handleOrganizationInputChange} placeholder="https://example.com" />
                                                        </div>
                                                        <div className="form-group">
                                                            <label htmlFor="vkUrl">Ссылка на VK</label>
                                                                    <input type="url" id="vkUrl" name="vkUrl" value={organizationData.vkUrl} onChange={handleOrganizationInputChange} placeholder="https://vk.com/your_organization" />
                                                        </div>
                                                        <div className="form-group">
                                                            <label htmlFor="telegramUrl">Ссылка на Telegram</label>
                                                                    <input type="url" id="telegramUrl" name="telegramUrl" value={organizationData.telegramUrl} onChange={handleOrganizationInputChange} placeholder="https://t.me/your_organization" />
                                                        </div>
                                                        <div className="form-group">
                                                            <label>Логотип организации</label>
                                                            <div className="logo-upload-section">
                                                                        <input type="file" ref={organizationFileInputRef} onChange={handleOrganizationLogoChange} accept="image/*" style={{ display: 'none' }} />
                                                                {organizationLogoPreview ? (
                                                                    <div className="logo-preview">
                                                                                <img src={organizationLogoPreview} alt="Предпросмотр логотипа" className="organization-logo-preview" />
                                                                        <div className="logo-actions">
                                                                                    <button type="button" onClick={triggerOrganizationFileInput} className="change-logo-btn">Изменить</button>
                                                                                    <button type="button" onClick={removeOrganizationLogo} className="remove-logo-btn">Удалить</button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="logo-upload-placeholder">
                                                                                <button type="button" onClick={triggerOrganizationFileInput} className="upload-logo-btn">📁 Выбрать файл логотипа</button>
                                                                        <p className="upload-hint">Рекомендуемый размер: 200x200px, формат: PNG, JPG</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="form-group submit-group">
                                                                    <button type="submit" className="submit-organization-btn" disabled={isSubmittingOrganization}>{isSubmittingOrganization ? 'Отправка...' : 'Отправить заявку'}</button>
                                                        </div>
                                                    </form>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                        )}
                                    </>
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
                                                className={`btn btn-secondary ${tournamentViewMode === 'table' ? 'active' : ''}`} 
                                                onClick={() => setTournamentViewMode('table')}
                                            >
                                                Таблица
                                            </button>
                                            <button 
                                                className={`btn btn-secondary ${tournamentViewMode === 'card' ? 'active' : ''}`} 
                                                onClick={() => setTournamentViewMode('card')}
                                            >
                                                Карточки
                                            </button>
                                        </div>

                                        {!isMobile && (
                                            <div className="tournaments-filter-bar">
                                                <input
                                                    type="text"
                                                    placeholder="Поиск по названию"
                                                    value={tournamentFilters.name}
                                                    onChange={(e) => setTournamentFilters({...tournamentFilters, name: e.target.value})}
                                                    className="mobile-filter-input"
                                                />
                                            </div>
                                        )}
                                        
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
                                                            <td data-label="Игра" title={tournament.game}>{renderGameIcon(tournament.game)}</td>
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
                                                                <span className="tournament-value" title={tournament.game}>{renderGameIcon(tournament.game)}</span>
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

                                        {/* Mobile-only compact table */}
                                        {isMobile && (
                                            <div className="tournaments-mobile-only">
                                                <table className="tournaments-table tournaments-table-compact">
                                                    <thead>
                                                        <tr>
                                                            <th style={{width:'44px'}}></th>
                                                            <th>Название</th>
                                                            <th>Дата</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredAndSortedUserTournaments.map((t) => (
                                                            <tr key={t.id} className="tournament-row-compact">
                                                                <td>{renderGameIcon(t.game)}</td>
                                                                <td title={t.name}><a href={`/tournaments/${t.id}`}>{t.name}</a></td>
                                                                <td>{new Date(t.start_date).toLocaleDateString('ru-RU')}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
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
                            <AchievementsPanel userId={user.id} />
                        )}
                        
                        {/* 📊 REPUTATION TAB */}
                        {activeTab === 'reputation' && (
                            <ProfileReputation userId={user.id} />
                        )}
                        
                        {activeTab === 'matchhistory' && (
                            <>
                                <div className="content-header">
                                    <h3>История матчей</h3>
                                </div>
                                {loadingMatchHistory && <div>Загрузка…</div>}
                                {!loadingMatchHistory && matchHistory.length === 0 && (
                                    <div className="empty-state">Пока нет сыгранных матчей</div>
                                )}
                                {!loadingMatchHistory && matchHistory.length > 0 && (
                                    <div className="match-history-list">
                                        {([...matchHistory]
                                            .sort((a, b) => {
                                                const da = a.created_at || a.date;
                                                const db = b.created_at || b.date;
                                                const ta = da ? new Date(da).getTime() : 0;
                                                const tb = db ? new Date(db).getTime() : 0;
                                                return tb - ta; // от новых к старым
                                            })
                                        ).map((m) => {
                                                const isCustom = m.source_type === 'custom';
                                                const title = isCustom ? 'Custom match' : (m.tournament_name || (m.tournament_id ? 'Tournament' : 'Матч'));
                                            const game = m.game || 'Counter-Strike 2';
                                            const score1 = m.score1 ?? 0;
                                            const score2 = m.score2 ?? 0;
                                            const result = score1 === score2 ? '—' : (score1 > score2 ? 'Победа' : 'Поражение');
                                                const dateRaw = m.created_at || m.date;
                                                const dateStr = dateRaw ? new Date(dateRaw).toLocaleString('ru-RU') : '';
                                                const userIdLocal = user?.id;
                                                let opponentName = 'Неизвестный соперник';
                                                if (isCustom) {
                                                    const t1 = Array.isArray(m.team1_players) ? m.team1_players : [];
                                                    const t2 = Array.isArray(m.team2_players) ? m.team2_players : [];
                                                    const inT1 = userIdLocal ? t1.some(p => Number(p.user_id) === Number(userIdLocal)) : false;
                                                    const inT2 = userIdLocal ? t2.some(p => Number(p.user_id) === Number(userIdLocal)) : false;
                                                    if (inT1) opponentName = m.team2_name || 'Соперник';
                                                    else if (inT2) opponentName = m.team1_name || 'Соперник';
                                                    else opponentName = (m.team1_name && m.team2_name) ? `${m.team1_name}` : 'Соперник';
                                                } else if (m.team1_name || m.team2_name) {
                                                    // Турнирный матч: показываем вторую команду как соперника, если не знаем сторону
                                                    opponentName = m.team2_name || m.team1_name;
                                                }
                                                const href = isCustom ? `/matches/custom/${m.id}` : (m.tournament_id ? `/tournaments/${m.tournament_id}/match/${m.id}` : '#');
                                            return (
                                                <a key={`${m.source_type}-${m.id}`} className="match-history-row" href={href}>
                                                         <div className="match-history-left">
                                                             <span className="match-history-game" title={game}>{renderGameIcon(game)}</span>
                                                             {isCustom ? (
                                                                 <span className="match-history-title" style={{minWidth: 120}}>{title}</span>
                                                             ) : (
                                                                 <a className="match-history-title" style={{minWidth: 120}} href={`/tournaments/${m.tournament_id}`}>
                                                                     {title}
                                                                 </a>
                                                             )}
                                                         </div>
                                                    <div className="match-history-right" style={{gap: 12}}>
                                                            <span>{result} {score1}:{score2}</span>
                                                            <span style={{color:'#aaa'}}>Соперник: {opponentName}</span>
                                                            <span style={{color:'#999'}}>{dateStr}</span>
                                                    </div>
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
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

                        <div className="avatar-modal-grid">
                            <div className="avatar-modal-left">
                                <div className="avatar-preview mini">
                                    <img 
                                        src={ensureHttps(user.avatar_url) || '/default-avatar.png'} 
                                        alt="Текущий аватар" 
                                        className="current-avatar"
                                    />
                                </div>

                                <div className="avatar-options compact">
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
                                        <button onClick={setAvatarFromSteam}>Аватар из Steam</button>
                                    )}
                                    {user.faceit_id && (
                                        <button onClick={setAvatarFromFaceit}>Аватар из FACEIT</button>
                                    )}
                                </div>
                            </div>

                            <div className="avatar-modal-divider" aria-hidden="true" />

                            <div className="avatar-modal-right">
                                <PreloadedAvatarPicker onPicked={async (url)=>{
                                    try {
                                        const token = localStorage.getItem('token');
                                        const res = await api.post('/api/users/set-preloaded-avatar', { url }, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        if (res.data && res.data.avatar_url) {
                                            // ensureHttps для относительных ссылок добавит схему/домен при рендере
                                            updateUser({ avatar_url: res.data.avatar_url });
                                            closeAvatarModal();
                                        }
                                    } catch (e) {
                                        setError('Не удалось установить аватар');
                                    }
                                }} />
                            </div>
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
                            <div className="match-history-skeleton">
                                <Skeleton width={180} height={20} style={{ marginBottom: 12 }} />
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 80px 120px 120px', gap: 12, marginBottom: 10 }}>
                                        <Skeleton height={18} />
                                        <Skeleton height={18} />
                                        <Skeleton height={18} />
                                        <Skeleton height={18} />
                                        <Skeleton height={18} />
                                        <Skeleton height={18} />
                                    </div>
                                ))}
                            </div>
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

            {/* Modal for changing password */}
            {showChangePasswordModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeChangePasswordModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Смена пароля</h3>
                        
                        <div className="password-form">
                            <div className="form-group">
                                <label className="form-label">Старый пароль</label>
                                <input
                                    type="password"
                                    value={passwordData.oldPassword}
                                    onChange={(e) => handlePasswordChange('oldPassword', e.target.value)}
                                    placeholder="Введите текущий пароль"
                                    className="form-input"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Новый пароль</label>
                                <input
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                                    placeholder="Введите новый пароль (минимум 6 символов)"
                                    className="form-input"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Подтвердите новый пароль</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                                    placeholder="Повторите новый пароль"
                                    className="form-input"
                                />
                            </div>
                            
                            {passwordError && <p className="error">{passwordError}</p>}
                            {passwordSuccess && <p className="success">{passwordSuccess}</p>}
                            
                            <div className="modal-buttons">
                                <button 
                                    onClick={changePassword} 
                                    className="btn btn-primary"
                                    disabled={isChangingPassword || !passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                                >
                                    {isChangingPassword ? 'Сохранение...' : 'Сменить пароль'}
                                </button>
                                <button onClick={closeChangePasswordModal} className="btn btn-secondary">
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;