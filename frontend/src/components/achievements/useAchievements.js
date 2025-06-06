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
            
            setAchievements(response.data || []);
            return response.data;
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
            const response = await api.get(`/api/achievements/user/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setUserAchievements(response.data.achievements || []);
            setAchievementProgress(response.data.progress || {});
            setPlayerLevel(response.data.level || 1);
            setPlayerXP(response.data.xp || 0);
            setDailyStreak(response.data.streak || { current: 0, longest: 0 });
            
            return response.data;
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
            const response = await api.post('/api/achievements/check-progress', {
                userId,
                actionType,
                actionData
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.success) {
                // Обновляем прогресс
                if (response.data.updatedProgress) {
                    setAchievementProgress(prev => ({
                        ...prev,
                        ...response.data.updatedProgress
                    }));
                }
                
                // Обновляем XP и уровень
                if (response.data.xpGained) {
                    setPlayerXP(prev => prev + response.data.xpGained);
                    
                    if (response.data.levelUp) {
                        setPlayerLevel(prev => prev + 1);
                        showAchievementNotification({
                            type: 'level_up',
                            message: `Поздравляем! Достигнут ${response.data.newLevel} уровень!`,
                            icon: '🎉'
                        });
                    }
                }
                
                // Обрабатываем новые достижения
                if (response.data.newAchievements && response.data.newAchievements.length > 0) {
                    setUserAchievements(prev => [...prev, ...response.data.newAchievements]);
                    setNewAchievements(prev => [...prev, ...response.data.newAchievements]);
                    
                    // Показываем уведомления о новых достижениях
                    response.data.newAchievements.forEach(achievement => {
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
            await api.post('/api/achievements/mark-seen', {
                achievementIds: newAchievements.map(a => a.achievement_id)
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