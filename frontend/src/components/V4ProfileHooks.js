// ✨ V4 ULTIMATE: Революционные функции для работы с расширенной статистикой
import { useState, useEffect } from 'react';
import api from '../axios';

export const useV4ProfileHooks = (user, activeTab) => {
    // V4 состояния
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
    const [v4ActiveView, setV4ActiveView] = useState('overview');

    // ⏱️ Debounce механизм для предотвращения частых запросов
    const [lastRequestTime, setLastRequestTime] = useState({});
    const REQUEST_DEBOUNCE_MS = 2000; // 2 секунды между запросами одного типа
    
    const shouldMakeRequest = (requestType) => {
        const now = Date.now();
        const lastTime = lastRequestTime[requestType] || 0;
        
        if (now - lastTime < REQUEST_DEBOUNCE_MS) {
            console.log(`⏱️ Debounce: пропускаем ${requestType}, последний запрос ${now - lastTime}ms назад`);
            return false;
        }
        
        setLastRequestTime(prev => ({ ...prev, [requestType]: now }));
        return true;
    };

    // 🔥 Инициализация WebSocket соединения для real-time обновлений
    const initializeWebSocket = () => {
        if (!user?.id) return () => {};
        
        console.log('🔌 Инициализация WebSocket для пользователя:', user.id);
        
        // Отключаем предыдущее соединение если есть
        if (websocket && websocket.readyState !== WebSocket.CLOSED) {
            console.log('🔌 Закрываем предыдущее WebSocket соединение');
            websocket.close();
        }
        
        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
        const wsUrl = baseUrl.replace('http', 'ws') + '/ws/stats';
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('🚀 WebSocket соединение установлено');
            ws.send(JSON.stringify({
                type: 'authenticate',
                userId: user.id,
                token: localStorage.getItem('token')
            }));
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleRealTimeUpdate(data);
            } catch (error) {
                console.error('❌ Ошибка обработки WebSocket сообщения:', error);
            }
        };
        
        ws.onerror = (error) => {
            console.error('❌ Ошибка WebSocket:', error);
        };
        
        ws.onclose = (event) => {
            console.log('🔌 WebSocket соединение закрыто:', event.code, event.reason);
            
            // Переподключение только если не было явного закрытия и пользователь все еще на вкладке stats
            if (event.code !== 1000 && activeTab === 'stats' && user?.id) {
                console.log('🔄 Переподключение WebSocket через 5 секунд...');
                setTimeout(() => {
                    if (activeTab === 'stats' && user?.id) {
                        initializeWebSocket();
                    }
                }, 5000);
            }
        };
        
        setWebsocket(ws);
        
        // Возвращаем функцию очистки
        return () => {
            console.log('🧹 Очистка WebSocket соединения');
            if (ws.readyState !== WebSocket.CLOSED) {
                ws.close(1000, 'Component unmounting');
            }
        };
    };
    
    // 📡 Обработка real-time обновлений (с debounce)
    const handleRealTimeUpdate = (data) => {
        console.log('📡 Real-time обновление:', data.type);
        
        switch (data.type) {
            case 'stats_updated':
                setRealTimeUpdates(prev => [data, ...prev.slice(0, 4)]);
                // Debounced обновление статистики
                if (shouldMakeRequest('real-time-stats')) {
                    fetchV4EnhancedStats();
                }
                break;
            case 'achievement_unlocked':
                setShowAchievementNotification(data.achievement);
                setTimeout(() => setShowAchievementNotification(null), 5000);
                // Debounced обновление достижений
                if (shouldMakeRequest('real-time-achievements')) {
                    fetchAchievements();
                }
                break;
            case 'ranking_updated':
                setGlobalRank(data.rank);
                break;
            case 'performance_milestone':
                setRealTimeUpdates(prev => [data, ...prev.slice(0, 4)]);
                break;
            default:
                console.log('❓ Неизвестный тип real-time обновления:', data.type);
                break;
        }
    };
    
    // 📊 Загрузка расширенной статистики V4
    const fetchV4EnhancedStats = async () => {
        if (!user?.id || !shouldMakeRequest('enhanced-stats')) return;
        
        setIsLoadingV4Stats(true);
        try {
            console.log('📊 Загружаем V4 Enhanced Stats для пользователя:', user.id);
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/v4/enhanced-stats/${user.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setV4EnhancedStats(response.data.stats);
            setPerformanceData(response.data.performanceHistory || []);
            setCurrentStreak(response.data.currentStreak);
            setPersonalBests(response.data.personalBests || {});
            setWeeklyProgress(response.data.weeklyProgress);
            
        } catch (err) {
            console.error('❌ Ошибка загрузки V4 статистики:', err);
        } finally {
            setIsLoadingV4Stats(false);
        }
    };
    
    // 🏆 Загрузка достижений
    const fetchAchievements = async () => {
        if (!user?.id || !shouldMakeRequest('achievements')) return;
        
        setIsLoadingAchievements(true);
        try {
            console.log('🏆 Загружаем достижения для пользователя:', user.id);
            const token = localStorage.getItem('token');
            const [achievementsRes, userAchievementsRes] = await Promise.all([
                api.get('/api/v4/achievements', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                api.get(`/api/v4/user-achievements/${user.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            
            setAchievements(achievementsRes.data);
            setUserAchievements(userAchievementsRes.data);
            
        } catch (err) {
            console.error('❌ Ошибка загрузки достижений:', err);
        } finally {
            setIsLoadingAchievements(false);
        }
    };
    
    // 🤖 Получение AI анализа производительности
    const fetchAIAnalysis = async () => {
        if (!user?.id) return;
        
        setIsLoadingAI(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.post(`/api/v4/ai-analysis/${user.id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setAiAnalysis(response.data);
            
        } catch (err) {
            console.error('Ошибка получения AI анализа:', err);
        } finally {
            setIsLoadingAI(false);
        }
    };
    
    // 📈 Загрузка глобальных лидербордов
    const fetchLeaderboards = async () => {
        if (!shouldMakeRequest('leaderboards')) return;
        
        try {
            console.log('📈 Загружаем лидерборды');
            const token = localStorage.getItem('token');
            const response = await api.get('/api/v4/leaderboards', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setLeaderboards(response.data);
            
            // Найти позицию текущего пользователя
            if (user?.id) {
                const userRank = response.data.find(item => item.user_id === user.id);
                if (userRank) {
                    setGlobalRank(userRank.rank);
                }
            }
            
        } catch (err) {
            console.error('❌ Ошибка загрузки лидербордов:', err);
        }
    };

    // Инициализация V4 при загрузке пользователя
    useEffect(() => {
        if (user?.id && activeTab === 'stats') {
            console.log('🔄 Инициализация V4 данных для пользователя:', user.id);
            
            // Инициализируем WebSocket
            const cleanup = initializeWebSocket();
            
            // Загружаем данные V4
            fetchV4EnhancedStats();
            fetchAchievements();
            fetchLeaderboards();
            
            return cleanup;
        }
    }, [user?.id, activeTab]);

    return {
        // Состояния
        v4EnhancedStats,
        achievements,
        userAchievements,
        aiAnalysis,
        performanceData,
        leaderboards,
        currentStreak,
        isLoadingV4Stats,
        isLoadingAchievements,
        isLoadingAI,
        websocket,
        realTimeUpdates,
        showAchievementNotification,
        globalRank,
        weeklyProgress,
        personalBests,
        v4ActiveView,
        setV4ActiveView,
        
        // Функции
        fetchV4EnhancedStats,
        fetchAchievements,
        fetchAIAnalysis,
        fetchLeaderboards,
        handleRealTimeUpdate
    };
}; 