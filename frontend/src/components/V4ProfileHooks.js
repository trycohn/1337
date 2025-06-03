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

    // 🔥 Инициализация WebSocket соединения для real-time обновлений
    const initializeWebSocket = () => {
        if (!user?.id) return;
        
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
            const data = JSON.parse(event.data);
            handleRealTimeUpdate(data);
        };
        
        ws.onclose = () => {
            console.log('🔌 WebSocket соединение закрыто');
            // Переподключение через 5 секунд
            setTimeout(initializeWebSocket, 5000);
        };
        
        setWebsocket(ws);
        
        return () => ws.close();
    };
    
    // 📡 Обработка real-time обновлений
    const handleRealTimeUpdate = (data) => {
        switch (data.type) {
            case 'stats_updated':
                setRealTimeUpdates(prev => [data, ...prev.slice(0, 4)]);
                fetchV4EnhancedStats();
                break;
            case 'achievement_unlocked':
                setShowAchievementNotification(data.achievement);
                setTimeout(() => setShowAchievementNotification(null), 5000);
                fetchAchievements();
                break;
            case 'ranking_updated':
                setGlobalRank(data.rank);
                break;
            case 'performance_milestone':
                setRealTimeUpdates(prev => [data, ...prev.slice(0, 4)]);
                break;
            default:
                console.log('Unknown real-time update type:', data.type);
                break;
        }
    };
    
    // 📊 Загрузка расширенной статистики V4
    const fetchV4EnhancedStats = async () => {
        if (!user?.id) return;
        
        setIsLoadingV4Stats(true);
        try {
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
            console.error('Ошибка загрузки V4 статистики:', err);
        } finally {
            setIsLoadingV4Stats(false);
        }
    };
    
    // 🏆 Загрузка достижений
    const fetchAchievements = async () => {
        if (!user?.id) return;
        
        setIsLoadingAchievements(true);
        try {
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
            console.error('Ошибка загрузки достижений:', err);
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
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/v4/leaderboards', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setLeaderboards(response.data);
            
            // Найти позицию текущего пользователя
            const userRank = response.data.find(item => item.user_id === user.id);
            if (userRank) {
                setGlobalRank(userRank.rank);
            }
            
        } catch (err) {
            console.error('Ошибка загрузки лидербордов:', err);
        }
    };

    // Инициализация V4 при загрузке пользователя
    useEffect(() => {
        if (user?.id && activeTab === 'stats') {
            // Инициализируем WebSocket
            const cleanup = initializeWebSocket();
            
            // Загружаем данные V4
            fetchV4EnhancedStats();
            fetchAchievements();
            fetchLeaderboards();
            
            return cleanup;
        }
    }, [user?.id, activeTab, initializeWebSocket, fetchV4EnhancedStats, fetchAchievements, fetchLeaderboards]);

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