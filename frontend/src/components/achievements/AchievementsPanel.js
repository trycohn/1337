import React, { useState, useCallback } from 'react';
import { useAchievements } from './useAchievements';
import AchievementNotification from './AchievementNotification';
import { ACHIEVEMENT_CATEGORIES, formatXP, getAchievementIcon } from './achievementHelpers';
import './Achievements.css';

/**
 * Панель достижений - основной компонент для отображения и управления достижениями
 */
const AchievementsPanel = ({ userId }) => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortBy, setSortBy] = useState('rarity'); // rarity, progress, name, unlocked
    const [showCompleted, setShowCompleted] = useState(true);
    const [showInProgress, setShowInProgress] = useState(true);
    const [showLocked, setShowLocked] = useState(true);
    
    const {
        achievements,
        userAchievements,
        achievementProgress,
        playerLevel,
        playerXP,
        dailyStreak,
        newAchievements,
        isLoading,
        error,
        showNotification,
        getAchievementStats,
        getAchievementsByCategory,
        isAchievementUnlocked,
        getAchievementProgress,
        closeNotification,
        markNewAchievementsAsSeen
    } = useAchievements(userId);

    /**
     * Фильтрация и сортировка достижений
     */
    const getFilteredAndSortedAchievements = useCallback(() => {
        let filtered = getAchievementsByCategory(selectedCategory);
        
        // Фильтрация по статусу
        filtered = filtered.filter(achievement => {
            const isUnlocked = isAchievementUnlocked(achievement.id);
            const progress = getAchievementProgress(achievement.id);
            const hasProgress = progress > 0;
            
            if (isUnlocked && showCompleted) return true;
            if (!isUnlocked && hasProgress && showInProgress) return true;
            if (!isUnlocked && !hasProgress && showLocked) return true;
            return false;
        });
        
        // Сортировка
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'rarity':
                    const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4 };
                    return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
                    
                case 'progress':
                    const progressA = getAchievementProgress(a.id) / (a.max_progress || 1);
                    const progressB = getAchievementProgress(b.id) / (b.max_progress || 1);
                    return progressB - progressA;
                    
                case 'name':
                    return a.name.localeCompare(b.name);
                    
                case 'unlocked':
                    const unlockedA = isAchievementUnlocked(a.id);
                    const unlockedB = isAchievementUnlocked(b.id);
                    if (unlockedA && !unlockedB) return -1;
                    if (!unlockedA && unlockedB) return 1;
                    return 0;
                    
                default:
                    return 0;
            }
        });
        
        return filtered;
    }, [selectedCategory, sortBy, showCompleted, showInProgress, showLocked, 
        getAchievementsByCategory, isAchievementUnlocked, getAchievementProgress]);

    /**
     * Обработка клика по категории
     */
    const handleCategoryClick = useCallback((categoryId) => {
        setSelectedCategory(categoryId);
        
        if (categoryId === 'achievements' && newAchievements.length > 0) {
            markNewAchievementsAsSeen();
        }
    }, [newAchievements.length, markNewAchievementsAsSeen]);

    /**
     * Получение прогресса в процентах
     */
    const getProgressPercentage = useCallback((achievement) => {
        if (!achievement.max_progress) return 100;
        const progress = getAchievementProgress(achievement.id);
        return Math.min((progress / achievement.max_progress) * 100, 100);
    }, [getAchievementProgress]);

    /**
     * Получение статистики по категориям
     */
    const getCategoryStats = useCallback((categoryId) => {
        const categoryAchievements = getAchievementsByCategory(categoryId);
        const unlockedInCategory = categoryAchievements.filter(a => isAchievementUnlocked(a.id)).length;
        return {
            total: categoryAchievements.length,
            unlocked: unlockedInCategory
        };
    }, [getAchievementsByCategory, isAchievementUnlocked]);

    const stats = getAchievementStats();
    const filteredAchievements = getFilteredAndSortedAchievements();

    if (isLoading) {
        return (
            <div className="achievements-panel">
                <div className="achievements-loading">
                    <div className="loading-spinner"></div>
                    <p>Загружаем ваши достижения...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="achievements-panel">
                <div className="achievements-error">
                    <p>❌ {error}</p>
                    <button onClick={() => window.location.reload()}>
                        Попробовать снова
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="achievements-panel">
            {/* Заголовок и статистика */}
            <div className="achievements-header">
                <div className="achievements-title">
                    <h2>🏆 Достижения</h2>
                    <div className="achievements-summary">
                        <div className="achievement-stat">
                            <span className="achievement-count">{stats.unlocked}</span>
                            <span className="achievement-label">получено</span>
                        </div>
                        <div className="achievement-stat">
                            <span className="achievement-count">{stats.total - stats.unlocked}</span>
                            <span className="achievement-label">осталось</span>
                        </div>
                        <div className="achievement-stat">
                            <span className="achievement-count">{stats.level}</span>
                            <span className="achievement-label">уровень</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Прогресс игрока */}
            <div className="player-progress-section">
                <div className="level-progress">
                    <div className="level-info">
                        <div className="current-level">
                            <span className="level-number">{stats.level}</span>
                            <span className="level-label">УРОВЕНЬ</span>
                        </div>
                        <div className="xp-progress">
                            <div className="xp-info">
                                <span className="current-xp">{formatXP(stats.currentXP)} XP</span>
                                {stats.level < 100 && (
                                    <span className="next-level-xp">
                                        / {formatXP(stats.level * 1000)} XP до {stats.level + 1} уровня
                                    </span>
                                )}
                            </div>
                            <div className="xp-bar">
                                <div 
                                    className="xp-fill" 
                                    style={{
                                        width: `${stats.level < 100 ? 
                                            Math.min((stats.currentXP / (stats.level * 1000)) * 100, 100) : 
                                            100}%`
                                    }}
                                ></div>
                            </div>
                        </div>
                    </div>
                    
                    {stats.dailyStreak > 0 && (
                        <div className="daily-streak">
                            <div className="streak-icon">🔥</div>
                            <div className="streak-info">
                                <div className="streak-number">{stats.dailyStreak}</div>
                                <div className="streak-label">дней подряд</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Фильтры и категории */}
            <div className="achievements-controls">
                <div className="achievement-categories">
                    {ACHIEVEMENT_CATEGORIES.map(category => {
                        const categoryStats = category.id === 'all' ? stats : getCategoryStats(category.id);
                        const hasNewInCategory = category.id === 'achievements' && newAchievements.length > 0;
                        
                        return (
                            <button
                                key={category.id}
                                className={`category-filter ${selectedCategory === category.id ? 'active' : ''}`}
                                onClick={() => handleCategoryClick(category.id)}
                            >
                                <span className="category-icon">{category.icon}</span>
                                <span className="category-name">{category.name}</span>
                                <span className="category-count">
                                    {category.id === 'all' ? 
                                        `${categoryStats.unlocked}/${categoryStats.total}` :
                                        `${categoryStats.unlocked}/${categoryStats.total}`
                                    }
                                </span>
                                {hasNewInCategory && (
                                    <span className="new-badge">{newAchievements.length}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="achievements-filters">
                    <div className="filter-group">
                        <label>Сортировка:</label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="rarity">По редкости</option>
                            <option value="progress">По прогрессу</option>
                            <option value="name">По названию</option>
                            <option value="unlocked">Сначала разблокированные</option>
                        </select>
                    </div>

                    <div className="visibility-filters">
                        <label>
                            <input 
                                type="checkbox" 
                                checked={showCompleted} 
                                onChange={(e) => setShowCompleted(e.target.checked)}
                            />
                            Завершённые
                        </label>
                        <label>
                            <input 
                                type="checkbox" 
                                checked={showInProgress} 
                                onChange={(e) => setShowInProgress(e.target.checked)}
                            />
                            В процессе
                        </label>
                        <label>
                            <input 
                                type="checkbox" 
                                checked={showLocked} 
                                onChange={(e) => setShowLocked(e.target.checked)}
                            />
                            Заблокированные
                        </label>
                    </div>
                </div>
            </div>

            {/* Список достижений */}
            <div className="achievements-grid">
                {filteredAchievements.length > 0 ? (
                    filteredAchievements.map(achievement => {
                        const isUnlocked = isAchievementUnlocked(achievement.id);
                        const progress = getAchievementProgress(achievement.id);
                        const progressPercent = getProgressPercentage(achievement);
                        const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
                        const isNew = newAchievements.some(na => na.achievement_id === achievement.id);

                        return (
                            <div 
                                key={achievement.id} 
                                className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'} ${isNew ? 'new' : ''}`}
                            >
                                <div className="achievement-icon">
                                    {isUnlocked ? 
                                        getAchievementIcon(achievement.icon) : 
                                        '🔒'
                                    }
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
                                {isNew && (
                                    <div className="achievement-new-badge">NEW!</div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="empty-achievements">
                        <div className="empty-achievements-icon">🏆</div>
                        <h3>Достижения не найдены</h3>
                        <p>Попробуйте изменить фильтры или выберите другую категорию</p>
                    </div>
                )}
            </div>

            {/* Уведомления о достижениях */}
            {showNotification && (
                <AchievementNotification
                    notification={showNotification}
                    onClose={closeNotification}
                />
            )}
        </div>
    );
};

export default AchievementsPanel; 