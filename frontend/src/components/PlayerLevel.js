import React from 'react';
import { useAchievements } from './achievements/useAchievements';
import './PlayerLevel.css';

/**
 * PlayerLevel - Отображение уровня игрока и прогресса
 * Показывает текущий уровень, XP и прогноз до следующего уровня
 */
function PlayerLevel({ userId, stats }) {
    const { 
        playerLevel, 
        playerXP,
        dailyStreak,
        isLoading 
    } = useAchievements(userId);

    // Формула расчета XP для следующего уровня
    const getXPForLevel = (level) => {
        return Math.floor(100 * Math.pow(1.5, level - 1));
    };

    // Текущий и следующий уровень
    const currentLevel = playerLevel || 1;
    const nextLevel = currentLevel + 1;
    
    // XP для текущего и следующего уровня
    const currentLevelXP = getXPForLevel(currentLevel);
    const nextLevelXP = getXPForLevel(nextLevel);
    const xpInCurrentLevel = playerXP - currentLevelXP;
    const xpNeededForNext = nextLevelXP - playerXP;
    const progressPercent = ((xpInCurrentLevel) / (nextLevelXP - currentLevelXP)) * 100;

    // Прогноз: сколько турниров/матчей нужно
    const avgXPPerTournament = 50; // Средний XP за турнир
    const avgXPPerMatch = 15; // Средний XP за матч
    
    const tournamentsNeeded = Math.ceil(xpNeededForNext / avgXPPerTournament);
    const matchesNeeded = Math.ceil(xpNeededForNext / avgXPPerMatch);

    // Определяем титул по уровню
    const getPlayerTitle = (level) => {
        if (level >= 50) return { title: 'Легенда', color: '#FFD700' };
        if (level >= 40) return { title: 'Мастер', color: '#FF4500' };
        if (level >= 30) return { title: 'Эксперт', color: '#9370DB' };
        if (level >= 20) return { title: 'Ветеран', color: '#4169E1' };
        if (level >= 10) return { title: 'Опытный', color: '#32CD32' };
        return { title: 'Новичок', color: '#A9A9A9' };
    };

    const playerTitle = getPlayerTitle(currentLevel);

    if (isLoading) {
        return (
            <div className="player-level skeleton">
                <div className="level-info">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="player-level">
            <div className="level-header">
                <div className="level-badge" style={{ borderColor: playerTitle.color }}>
                    <div className="level-number">{currentLevel}</div>
                    <div className="level-title" style={{ color: playerTitle.color }}>
                        {playerTitle.title}
                    </div>
                </div>
                
                <div className="level-details">
                    <div className="xp-info">
                        <span className="xp-current">{playerXP.toLocaleString()}</span>
                        <span className="xp-separator">/</span>
                        <span className="xp-next">{nextLevelXP.toLocaleString()}</span>
                        <span className="xp-label">XP</span>
                    </div>
                    
                    {dailyStreak > 0 && (
                        <div className="daily-streak">
                            🔥 Серия: {dailyStreak} {dailyStreak === 1 ? 'день' : 'дней'}
                        </div>
                    )}
                </div>
            </div>

            {/* Прогресс-бар */}
            <div className="level-progress-container">
                <div className="level-progress-bar">
                    <div 
                        className="level-progress-fill"
                        style={{ 
                            width: `${Math.min(progressPercent, 100)}%`,
                            background: `linear-gradient(90deg, ${playerTitle.color}, ${playerTitle.color}dd)`
                        }}
                    >
                        <span className="progress-text">
                            {Math.round(progressPercent)}%
                        </span>
                    </div>
                </div>
                <div className="level-progress-label">
                    До {nextLevel} уровня: <strong>{xpNeededForNext.toLocaleString()} XP</strong>
                </div>
            </div>

            {/* Прогноз */}
            <div className="level-forecast">
                <div className="forecast-title">💡 Прогноз достижения</div>
                <div className="forecast-items">
                    <div className="forecast-item">
                        <span className="forecast-icon">🏆</span>
                        <span className="forecast-value">{tournamentsNeeded}</span>
                        <span className="forecast-label">
                            {tournamentsNeeded === 1 ? 'турнир' : tournamentsNeeded < 5 ? 'турнира' : 'турниров'}
                        </span>
                    </div>
                    <div className="forecast-separator">или</div>
                    <div className="forecast-item">
                        <span className="forecast-icon">🎮</span>
                        <span className="forecast-value">{matchesNeeded}</span>
                        <span className="forecast-label">
                            {matchesNeeded === 1 ? 'матч' : matchesNeeded < 5 ? 'матча' : 'матчей'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Бонусы за уровень */}
            {currentLevel % 5 === 0 && (
                <div className="level-milestone">
                    🎉 Достигнут рубеж {currentLevel} уровня!
                </div>
            )}
        </div>
    );
}

export default PlayerLevel;

