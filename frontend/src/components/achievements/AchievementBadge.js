/**
 * 🏅 ACHIEVEMENT BADGE COMPONENT
 * Компонент значка достижения
 * @version 1.0.0
 */

import React from 'react';
import './AchievementBadge.css';

const AchievementBadge = ({ achievement, size = 'medium', showTooltip = true }) => {
    if (!achievement) return null;

    const { achievement_type, rank, value, tournament_name, coins_awarded } = achievement;

    // Определяем цвет медали
    const getMedalColor = () => {
        if (rank === 1) return 'gold';
        if (rank === 2) return 'silver';
        if (rank === 3) return 'bronze';
        return 'default';
    };

    // Определяем иконку по типу достижения
    const getAchievementIcon = () => {
        const icons = {
            'mvp': '👑',
            'most_kills': '🔫',
            'highest_adr': '💥',
            'best_hs': '🎯',
            'clutch_king': '⚡',
            'eco_master': '💰',
            'most_assists': '🤝',
            'best_accuracy': '🎪'
        };
        return icons[achievement_type] || '🏆';
    };

    // Определяем название достижения
    const getAchievementName = () => {
        const names = {
            'mvp': 'MVP Tournament',
            'most_kills': 'Most Kills',
            'highest_adr': 'Highest ADR',
            'best_hs': 'Best HS%',
            'clutch_king': 'Clutch King',
            'eco_master': 'Eco Master',
            'most_assists': 'Most Assists',
            'best_accuracy': 'Best Accuracy'
        };
        return names[achievement_type] || achievement_type;
    };

    const medalClass = getMedalColor();
    const icon = getAchievementIcon();
    const name = getAchievementName();

    return (
        <div 
            className={`achievement-badge achievement-${size} achievement-${medalClass}`}
            title={showTooltip ? `${name} - ${tournament_name || 'Tournament'}` : ''}
        >
            <div className="achievement-medal">
                <div className="achievement-rank">{rank}</div>
            </div>
            <div className="achievement-icon">{icon}</div>
            {size === 'large' && (
                <div className="achievement-details">
                    <div className="achievement-name">{name}</div>
                    <div className="achievement-value">{value}</div>
                    {coins_awarded > 0 && (
                        <div className="achievement-coins">+{coins_awarded} 🪙</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AchievementBadge;

