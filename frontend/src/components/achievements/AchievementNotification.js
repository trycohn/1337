import React, { useEffect, useState } from 'react';
import { formatTimeAgo, getRarityColor } from './achievementHelpers';
import './Achievements.css';

/**
 * Компонент уведомления о достижении
 */
const AchievementNotification = ({ notification, onClose, autoClose = true }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        // Показываем уведомление с небольшой задержкой для анимации
        const showTimeout = setTimeout(() => {
            setIsVisible(true);
        }, 100);

        // Автоматически закрываем уведомление
        let closeTimeout;
        if (autoClose && notification.duration) {
            closeTimeout = setTimeout(() => {
                handleClose();
            }, notification.duration);
        }

        return () => {
            clearTimeout(showTimeout);
            if (closeTimeout) clearTimeout(closeTimeout);
        };
    }, [autoClose, notification.duration]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300); // Время анимации закрытия
    };

    const getNotificationClass = () => {
        let classes = ['achievement-notification'];
        
        if (isVisible && !isClosing) {
            classes.push('visible');
        }
        
        if (isClosing) {
            classes.push('closing');
        }

        if (notification.type) {
            classes.push(`notification-${notification.type}`);
        }

        return classes.join(' ');
    };

    const renderNotificationContent = () => {
        switch (notification.type) {
            case 'achievement_unlocked':
                return (
                    <div className="notification-content achievement-unlocked">
                        <div className="notification-icon">
                            {notification.achievement?.icon || '🏆'}
                        </div>
                        <div className="notification-text">
                            <h4 className="notification-title">🎉 Достижение получено!</h4>
                            <p className="notification-message">{notification.achievement?.name}</p>
                            <p className="notification-description">{notification.achievement?.description}</p>
                            {notification.achievement?.xp_reward && (
                                <div className="notification-xp">
                                    <span className="xp-icon">⭐</span>
                                    <span>+{notification.achievement.xp_reward} XP</span>
                                </div>
                            )}
                            {notification.achievement?.rarity && (
                                <div 
                                    className="notification-rarity"
                                    style={{ color: getRarityColor(notification.achievement.rarity) }}
                                >
                                    {notification.achievement.rarity === 'common' && '🥉 Обычное'}
                                    {notification.achievement.rarity === 'rare' && '🥈 Редкое'}
                                    {notification.achievement.rarity === 'epic' && '🥇 Эпическое'}
                                    {notification.achievement.rarity === 'legendary' && '💎 Легендарное'}
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'level_up':
                return (
                    <div className="notification-content level-up">
                        <div className="notification-icon level-up-icon">
                            🎊
                        </div>
                        <div className="notification-text">
                            <h4 className="notification-title">Новый уровень!</h4>
                            <p className="notification-message">{notification.message}</p>
                            {notification.newLevel && (
                                <div className="notification-level">
                                    <span className="level-badge">Уровень {notification.newLevel}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'progress_update':
                return (
                    <div className="notification-content progress-update">
                        <div className="notification-icon">
                            📈
                        </div>
                        <div className="notification-text">
                            <h4 className="notification-title">Прогресс обновлён</h4>
                            <p className="notification-message">{notification.message}</p>
                            {notification.progress && (
                                <div className="notification-progress">
                                    <div className="progress-bar">
                                        <div 
                                            className="progress-fill"
                                            style={{ width: `${notification.progress.percentage}%` }}
                                        ></div>
                                    </div>
                                    <span className="progress-text">
                                        {notification.progress.current} / {notification.progress.total}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'streak_milestone':
                return (
                    <div className="notification-content streak-milestone">
                        <div className="notification-icon streak-icon">
                            🔥
                        </div>
                        <div className="notification-text">
                            <h4 className="notification-title">Серия продолжается!</h4>
                            <p className="notification-message">{notification.message}</p>
                            {notification.streakDays && (
                                <div className="notification-streak">
                                    <span className="streak-number">{notification.streakDays}</span>
                                    <span className="streak-label">дней подряд</span>
                                </div>
                            )}
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="notification-content default">
                        <div className="notification-icon">
                            {notification.icon || '🔔'}
                        </div>
                        <div className="notification-text">
                            <h4 className="notification-title">{notification.title || 'Уведомление'}</h4>
                            <p className="notification-message">{notification.message}</p>
                            {notification.description && (
                                <p className="notification-description">{notification.description}</p>
                            )}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className={getNotificationClass()}>
            <div className="notification-inner">
                {renderNotificationContent()}
                <button 
                    className="notification-close" 
                    onClick={handleClose}
                    title="Закрыть"
                >
                    ×
                </button>
            </div>
            {notification.timestamp && (
                <div className="notification-timestamp">
                    {formatTimeAgo(notification.timestamp)}
                </div>
            )}
        </div>
    );
};

/**
 * Провайдер уведомлений для управления глобальными уведомлениями
 */
export const AchievementNotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = (notification) => {
        const id = Date.now() + Math.random();
        const newNotification = {
            ...notification,
            id,
            timestamp: new Date().toISOString()
        };

        setNotifications(prev => [...prev, newNotification]);

        // Автоматически удаляем уведомление через определенное время
        if (notification.duration !== 0) {
            setTimeout(() => {
                removeNotification(id);
            }, notification.duration || 5000);
        }

        return id;
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const clearAllNotifications = () => {
        setNotifications([]);
    };

    return (
        <>
            {children}
            <div className="achievement-notifications-container">
                {notifications.map(notification => (
                    <AchievementNotification
                        key={notification.id}
                        notification={notification}
                        onClose={() => removeNotification(notification.id)}
                        autoClose={notification.duration !== 0}
                    />
                ))}
            </div>
        </>
    );
};

export default AchievementNotification; 