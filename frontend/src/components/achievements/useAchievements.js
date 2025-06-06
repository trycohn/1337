import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

/**
 * Хук для управления системой достижений
 * Обеспечивает загрузку, отслеживание прогресса и разблокировку достижений
 */
export const useAchievements = (userId) => {
    // Основные состояния
    const [achievements, setAchievements] = useState([]);
    const [userAchievements, setUserAchievements] = useState([]);
    const [achievementProgress, setAchievementProgress] = useState({});
    const [playerLevel, setPlayerLevel] = useState(1);
    const [playerXP, setPlayerXP] = useState(0);
    const [dailyStreak, setDailyStreak] = useState({ current: 0, longest: 0 });
    
    // Состояния загрузки
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Уведомления о новых достижениях
    const [newAchievements, setNewAchievements] = useState([]);
    const [showNotification, setShowNotification] = useState(null);

    /**
     * Загрузка всех доступных достижений
     */
    const fetchAchievements = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/achievements', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.success) {
                setAchievements(response.data.achievements || []);
                return response.data.achievements;
            }
            
            setAchievements([]);
            return [];
        } catch (err) {
            console.error('Ошибка загрузки достижений:', err);
            setError('Не удалось загрузить достижения');
            return [];
        }
    }, []);

    /**
     * Загрузка достижений пользователя
     */
    const fetchUserAchievements = useCallback(async () => {
        if (!userId) return [];
        
        try {
            const token = localStorage.getItem('token');
            
            // Получаем прогресс пользователя
            const progressResponse = await api.get('/api/achievements/user/progress', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Получаем список всех достижений с информацией о разблокированных
            const achievementsResponse = await api.get('/api/achievements', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (progressResponse.data.success && achievementsResponse.data.success) {
                const progress = progressResponse.data.progress;
                const allAchievements = achievementsResponse.data.achievements;
                
                // Фильтруем разблокированные достижения
                const unlockedAchievements = allAchievements.filter(a => a.is_unlocked);
                
                // Создаем объект прогресса по ID достижений
                const progressByAchievement = {};
                allAchievements.forEach(achievement => {
                    progressByAchievement[achievement.id] = achievement.user_progress || 0;
                });
                
                setUserAchievements(unlockedAchievements);
                setAchievementProgress(progressByAchievement);
                setPlayerLevel(progress.level || 1);
                setPlayerXP(progress.total_xp || 0);
                setDailyStreak({
                    current: progress.daily_streak_current || 0,
                    longest: progress.daily_streak_longest || 0
                });
                
                return {
                    achievements: unlockedAchievements,
                    progress: progressByAchievement,
                    level: progress.level,
                    xp: progress.total_xp,
                    streak: {
                        current: progress.daily_streak_current || 0,
                        longest: progress.daily_streak_longest || 0
                    }
                };
            }
            
            return {};
        } catch (err) {
            console.error('Ошибка загрузки достижений пользователя:', err);
            setError('Не удалось загрузить прогресс достижений');
            return {};
        }
    }, [userId]);

    /**
     * Проверка и обновление прогресса достижений
     */
    const checkAchievementProgress = useCallback(async (actionType, actionData = {}) => {
        if (!userId) return;
        
        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/achievements/user/action', {
                action_type: actionType,
                action_data: actionData
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.success) {
                const progress = response.data.progress;
                
                // Обновляем уровень и XP
                if (progress) {
                    setPlayerLevel(progress.level || 1);
                    setPlayerXP(progress.total_xp || 0);
                    setDailyStreak({
                        current: progress.daily_streak_current || 0,
                        longest: progress.daily_streak_longest || 0
                    });
                }
                
                // Обрабатываем новые достижения
                if (response.data.new_achievements && response.data.new_achievements.length > 0) {
                    const newAchievements = response.data.new_achievements.map(achievement => ({
                        achievement_id: achievement.id,
                        ...achievement
                    }));
                    
                    setUserAchievements(prev => [...prev, ...newAchievements]);
                    setNewAchievements(prev => [...prev, ...newAchievements]);
                    
                    // Показываем уведомления о новых достижениях
                    newAchievements.forEach(achievement => {
                        setTimeout(() => {
                            showAchievementNotification({
                                type: 'achievement_unlocked',
                                achievement: achievement,
                                message: `Достижение разблокировано: ${achievement.name}`,
                                icon: achievement.icon || '🏆'
                            });
                        }, 500);
                    });
                }
                
                // Проверяем повышение уровня
                if (response.data.level_up) {
                    showAchievementNotification({
                        type: 'level_up',
                        message: `Поздравляем! Достигнут ${progress.level} уровень!`,
                        icon: '🎉'
                    });
                }
            }
            
            return response.data;
        } catch (err) {
            console.error('Ошибка проверки прогресса достижений:', err);
            return { success: false, error: err.message };
        }
    }, [userId]);

    /**
     * Показ уведомления о достижении
     */
    const showAchievementNotification = useCallback((notification) => {
        setShowNotification(notification);
        
        // Автоматически скрываем уведомление через 5 секунд
        setTimeout(() => {
            setShowNotification(null);
        }, 5000);
    }, []);

    /**
     * Закрытие уведомления
     */
    const closeNotification = useCallback(() => {
        setShowNotification(null);
    }, []);

    /**
     * Получение статистики достижений
     */
    const getAchievementStats = useCallback(() => {
        const totalAchievements = achievements.length;
        const unlockedAchievements = userAchievements.length;
        const completionRate = totalAchievements > 0 ? (unlockedAchievements / totalAchievements) * 100 : 0;
        
        const rareAchievements = userAchievements.filter(ua => {
            const achievement = achievements.find(a => a.id === ua.achievement_id);
            return achievement && (achievement.rarity === 'epic' || achievement.rarity === 'legendary');
        }).length;
        
        const totalXPFromAchievements = userAchievements.reduce((total, ua) => {
            const achievement = achievements.find(a => a.id === ua.achievement_id);
            return total + (achievement?.xp_reward || 0);
        }, 0);
        
        return {
            total: totalAchievements,
            unlocked: unlockedAchievements,
            completionRate: Math.round(completionRate),
            rare: rareAchievements,
            totalXP: totalXPFromAchievements,
            level: playerLevel,
            currentXP: playerXP,
            dailyStreak: dailyStreak.current,
            longestStreak: dailyStreak.longest
        };
    }, [achievements, userAchievements, playerLevel, playerXP, dailyStreak]);

    /**
     * Фильтрация достижений по категории
     */
    const getAchievementsByCategory = useCallback((categoryId) => {
        if (categoryId === 'all') return achievements;
        return achievements.filter(achievement => achievement.category_id === categoryId);
    }, [achievements]);

    /**
     * Проверка, разблокировано ли достижение
     */
    const isAchievementUnlocked = useCallback((achievementId) => {
        return userAchievements.some(ua => ua.achievement_id === achievementId);
    }, [userAchievements]);

    /**
     * Получение прогресса достижения
     */
    const getAchievementProgress = useCallback((achievementId) => {
        return achievementProgress[achievementId] || 0;
    }, [achievementProgress]);

    /**
     * Инициализация модуля достижений
     */
    const initializeAchievements = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            await Promise.all([
                fetchAchievements(),
                fetchUserAchievements()
            ]);
        } catch (err) {
            setError('Ошибка инициализации системы достижений');
        } finally {
            setIsLoading(false);
        }
    }, [fetchAchievements, fetchUserAchievements]);

    /**
     * Отметка новых достижений как просмотренных
     */
    const markNewAchievementsAsSeen = useCallback(async () => {
        if (newAchievements.length === 0) return;
        
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/achievements/user/mark-seen', {
                achievement_ids: newAchievements.map(a => a.achievement_id || a.id)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setNewAchievements([]);
        } catch (err) {
            console.error('Ошибка отметки достижений как просмотренных:', err);
        }
    }, [newAchievements]);

    // Автоматическая инициализация при изменении userId
    useEffect(() => {
        if (userId) {
            initializeAchievements();
        }
    }, [userId, initializeAchievements]);

    return {
        // Данные
        achievements,
        userAchievements,
        achievementProgress,
        playerLevel,
        playerXP,
        dailyStreak,
        newAchievements,
        
        // Состояния
        isLoading,
        error,
        showNotification,
        
        // Методы
        fetchAchievements,
        fetchUserAchievements,
        checkAchievementProgress,
        initializeAchievements,
        closeNotification,
        markNewAchievementsAsSeen,
        
        // Утилиты
        getAchievementStats,
        getAchievementsByCategory,
        isAchievementUnlocked,
        getAchievementProgress
    };
}; 