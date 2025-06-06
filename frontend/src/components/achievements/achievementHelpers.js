/**
 * Утилиты и константы для системы достижений
 */

// Категории достижений
export const ACHIEVEMENT_CATEGORIES = [
    { id: 'all', name: 'Все', icon: '🎯' },
    { id: 'tournaments', name: 'Турниры', icon: '🏆' },
    { id: 'matches', name: 'Матчи', icon: '⚔️' },
    { id: 'social', name: 'Социальные', icon: '👥' },
    { id: 'streaks', name: 'Серии', icon: '🔥' },
    { id: 'special', name: 'Особые', icon: '💎' }
];

// Редкость достижений
export const ACHIEVEMENT_RARITY = {
    common: { name: 'Обычное', icon: '🥉', color: '#8D9194' },
    rare: { name: 'Редкое', icon: '🥈', color: '#4285F4' },
    epic: { name: 'Эпическое', icon: '🥇', color: '#9C27B0' },
    legendary: { name: 'Легендарное', icon: '💎', color: '#FF9800' }
};

// Типы действий для отслеживания прогресса
export const ACHIEVEMENT_ACTIONS = {
    // Турниры
    TOURNAMENT_CREATED: 'tournament_created',
    TOURNAMENT_WON: 'tournament_won',
    TOURNAMENT_PARTICIPATED: 'tournament_participated',
    TOURNAMENT_ORGANIZED: 'tournament_organized',
    
    // Матчи
    MATCH_WON: 'match_won',
    MATCH_LOST: 'match_lost',
    MATCH_DRAW: 'match_draw',
    PERFECT_GAME: 'perfect_game',
    COMEBACK_WIN: 'comeback_win',
    
    // Социальные
    FRIEND_ADDED: 'friend_added',
    MESSAGE_SENT: 'message_sent',
    PROFILE_UPDATED: 'profile_updated',
    
    // Серии
    WIN_STREAK: 'win_streak',
    DAILY_LOGIN: 'daily_login',
    WEEKLY_ACTIVE: 'weekly_active',
    
    // Особые
    FIRST_LOGIN: 'first_login',
    PROFILE_COMPLETE: 'profile_complete',
    STEAM_LINKED: 'steam_linked',
    FACEIT_LINKED: 'faceit_linked'
};

/**
 * Форматирование XP для отображения
 */
export const formatXP = (xp) => {
    if (xp >= 1000000) {
        return `${(xp / 1000000).toFixed(1)}M`;
    }
    if (xp >= 1000) {
        return `${(xp / 1000).toFixed(1)}K`;
    }
    return xp.toString();
};

/**
 * Получение иконки достижения
 */
export const getAchievementIcon = (icon) => {
    if (!icon) return '🏆';
    
    // Проверяем, является ли иконка эмодзи
    if (/\p{Emoji}/u.test(icon)) {
        return icon;
    }
    
    // Если это не эмодзи, возвращаем дефолтную иконку
    return '🏆';
};

/**
 * Вычисление уровня игрока на основе XP
 */
export const calculatePlayerLevel = (totalXP) => {
    if (totalXP < 1000) return 1;
    
    // Каждый уровень требует больше XP (прогрессивная система)
    let level = 1;
    let requiredXP = 1000;
    let currentXP = totalXP;
    
    while (currentXP >= requiredXP && level < 100) {
        currentXP -= requiredXP;
        level++;
        requiredXP = level * 1000; // Увеличиваем требования с каждым уровнем
    }
    
    return level;
};

/**
 * Вычисление XP до следующего уровня
 */
export const getXPToNextLevel = (totalXP, currentLevel) => {
    if (currentLevel >= 100) return 0;
    
    const nextLevelRequiredXP = (currentLevel + 1) * 1000;
    const currentLevelStartXP = currentLevel * 1000;
    const progressInCurrentLevel = totalXP - currentLevelStartXP;
    
    return nextLevelRequiredXP - progressInCurrentLevel;
};

/**
 * Получение цвета редкости достижения
 */
export const getRarityColor = (rarity) => {
    return ACHIEVEMENT_RARITY[rarity]?.color || ACHIEVEMENT_RARITY.common.color;
};

/**
 * Получение названия редкости
 */
export const getRarityName = (rarity) => {
    return ACHIEVEMENT_RARITY[rarity]?.name || ACHIEVEMENT_RARITY.common.name;
};

/**
 * Получение иконки редкости
 */
export const getRarityIcon = (rarity) => {
    return ACHIEVEMENT_RARITY[rarity]?.icon || ACHIEVEMENT_RARITY.common.icon;
};

/**
 * Проверка, является ли достижение недавно полученным
 */
export const isRecentAchievement = (unlockedAt, hours = 24) => {
    if (!unlockedAt) return false;
    
    const unlockTime = new Date(unlockedAt);
    const now = new Date();
    const timeDiff = now - unlockTime;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    return hoursDiff <= hours;
};

/**
 * Группировка достижений по категориям
 */
export const groupAchievementsByCategory = (achievements) => {
    return achievements.reduce((groups, achievement) => {
        const category = achievement.category_id || 'other';
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(achievement);
        return groups;
    }, {});
};

/**
 * Сортировка достижений по приоритету
 */
export const sortAchievementsByPriority = (achievements, userAchievements = []) => {
    const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));
    
    return achievements.sort((a, b) => {
        // Сначала разблокированные
        const aUnlocked = unlockedIds.has(a.id);
        const bUnlocked = unlockedIds.has(b.id);
        
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;
        
        // Затем по редкости (более редкие сначала)
        const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
        const aPriority = rarityOrder[a.rarity] || 0;
        const bPriority = rarityOrder[b.rarity] || 0;
        
        if (aPriority !== bPriority) return bPriority - aPriority;
        
        // В конце по названию
        return a.name.localeCompare(b.name);
    });
};

/**
 * Получение статистики по достижениям
 */
export const getAchievementStatistics = (achievements, userAchievements) => {
    const stats = {
        total: achievements.length,
        unlocked: userAchievements.length,
        byCategory: {},
        byRarity: {},
        totalXP: 0,
        averageProgress: 0
    };
    
    // Статистика по категориям
    ACHIEVEMENT_CATEGORIES.forEach(category => {
        if (category.id === 'all') return;
        
        const categoryAchievements = achievements.filter(a => a.category_id === category.id);
        const unlockedInCategory = userAchievements.filter(ua => {
            const achievement = achievements.find(a => a.id === ua.achievement_id);
            return achievement && achievement.category_id === category.id;
        });
        
        stats.byCategory[category.id] = {
            total: categoryAchievements.length,
            unlocked: unlockedInCategory.length,
            percentage: categoryAchievements.length > 0 ? 
                Math.round((unlockedInCategory.length / categoryAchievements.length) * 100) : 0
        };
    });
    
    // Статистика по редкости
    Object.keys(ACHIEVEMENT_RARITY).forEach(rarity => {
        const rarityAchievements = achievements.filter(a => a.rarity === rarity);
        const unlockedRarity = userAchievements.filter(ua => {
            const achievement = achievements.find(a => a.id === ua.achievement_id);
            return achievement && achievement.rarity === rarity;
        });
        
        stats.byRarity[rarity] = {
            total: rarityAchievements.length,
            unlocked: unlockedRarity.length,
            percentage: rarityAchievements.length > 0 ? 
                Math.round((unlockedRarity.length / rarityAchievements.length) * 100) : 0
        };
    });
    
    // Общий XP от достижений
    stats.totalXP = userAchievements.reduce((total, ua) => {
        const achievement = achievements.find(a => a.id === ua.achievement_id);
        return total + (achievement?.xp_reward || 0);
    }, 0);
    
    // Средний прогресс
    stats.completionRate = stats.total > 0 ? 
        Math.round((stats.unlocked / stats.total) * 100) : 0;
    
    return stats;
};

/**
 * Создание уведомления о достижении
 */
export const createAchievementNotification = (achievement, type = 'unlocked') => {
    const notifications = {
        unlocked: {
            title: '🎉 Достижение получено!',
            message: `Вы получили достижение "${achievement.name}"`,
            description: achievement.description,
            xp: achievement.xp_reward,
            duration: 5000
        },
        progress: {
            title: '📈 Прогресс достижения',
            message: `Прогресс по "${achievement.name}" обновлён`,
            description: achievement.description,
            duration: 3000
        },
        level_up: {
            title: '🎊 Новый уровень!',
            message: `Поздравляем с достижением нового уровня!`,
            duration: 4000
        }
    };
    
    return notifications[type] || notifications.unlocked;
};

/**
 * Проверка условий для получения достижения
 */
export const checkAchievementConditions = (achievement, userData, actionData) => {
    if (!achievement.conditions) return false;
    
    try {
        const conditions = typeof achievement.conditions === 'string' ? 
            JSON.parse(achievement.conditions) : achievement.conditions;
        
        // Проверяем каждое условие
        for (const [key, value] of Object.entries(conditions)) {
            const userValue = userData[key] || actionData[key] || 0;
            
            if (typeof value === 'number') {
                if (userValue < value) return false;
            } else if (typeof value === 'object') {
                if (value.min !== undefined && userValue < value.min) return false;
                if (value.max !== undefined && userValue > value.max) return false;
                if (value.equals !== undefined && userValue !== value.equals) return false;
            }
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка проверки условий достижения:', error);
        return false;
    }
};

/**
 * Форматирование времени для отображения
 */
export const formatTimeAgo = (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);
    
    if (diffInSeconds < 60) return 'только что';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин назад`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч назад`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} дн назад`;
    
    return past.toLocaleDateString('ru-RU');
}; 