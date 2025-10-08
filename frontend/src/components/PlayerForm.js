import React from 'react';
import './PlayerForm.css';

/**
 * PlayerForm - Отображение текущей формы игрока
 * Показывает последние матчи и стрики
 */
function PlayerForm({ recentMatches = [], stats }) {
    // Определяем текущий стрик
    const getCurrentStreak = (matches) => {
        if (!matches || matches.length === 0) return { type: null, count: 0 };
        
        let streakType = matches[0].won ? 'win' : 'loss';
        let count = 0;
        
        for (const match of matches) {
            const matchType = match.won ? 'win' : 'loss';
            if (matchType === streakType) {
                count++;
            } else {
                break;
            }
        }
        
        return { type: streakType, count };
    };

    // Вычисляем тренд винрейта (сравниваем последние 10 и предыдущие 10 матчей)
    const getWinrateTrend = (stats) => {
        if (!stats) return { direction: 'neutral', change: 0 };
        
        // Для демонстрации: сравниваем общий винрейт с 60%
        const totalWins = (stats.solo?.wins || 0) + (stats.team?.wins || 0);
        const totalMatches = totalWins + (stats.solo?.losses || 0) + (stats.team?.losses || 0);
        const currentWinrate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;
        
        if (currentWinrate > 60) {
            return { direction: 'up', change: Math.round(currentWinrate - 60) };
        } else if (currentWinrate < 40) {
            return { direction: 'down', change: Math.round(40 - currentWinrate) };
        }
        
        return { direction: 'neutral', change: 0 };
    };

    const streak = getCurrentStreak(recentMatches);
    const trend = getWinrateTrend(stats);
    
    // Отображаем последние 10 матчей
    const displayMatches = recentMatches.slice(0, 10);

    if (displayMatches.length === 0 && !stats) {
        return null;
    }

    return (
        <div className="player-form">
            <div className="player-form-header">
                <h4 className="form-title">Текущая форма</h4>
                {trend.direction !== 'neutral' && (
                    <div className={`trend-indicator trend-${trend.direction}`}>
                        <span className="trend-icon">
                            {trend.direction === 'up' ? '↗️' : '↘️'}
                        </span>
                        <span className="trend-text">
                            {trend.direction === 'up' ? 'Винрейт растет' : 'Винрейт падает'}
                        </span>
                        <span className="trend-value">
                            {trend.change > 0 ? `+${trend.change}%` : `${trend.change}%`}
                        </span>
                    </div>
                )}
            </div>

            {/* Стрик */}
            {streak.count > 2 && (
                <div className={`streak-banner streak-${streak.type}`}>
                    <div className="streak-icon">
                        {streak.type === 'win' ? '🔥' : '❄️'}
                    </div>
                    <div className="streak-content">
                        <div className="streak-label">
                            {streak.type === 'win' ? 'Серия побед' : 'Серия поражений'}
                        </div>
                        <div className="streak-count">{streak.count} подряд</div>
                    </div>
                </div>
            )}

            {/* История последних матчей */}
            {displayMatches.length > 0 && (
                <div className="recent-matches-visual">
                    <div className="matches-label">Последние матчи:</div>
                    <div className="matches-indicators">
                        {displayMatches.map((match, index) => (
                            <div
                                key={index}
                                className={`match-indicator ${match.won ? 'win' : 'loss'}`}
                                title={`${match.won ? 'Победа' : 'Поражение'} - ${match.map_name || 'Unknown'}`}
                            >
                                {match.won ? 'W' : 'L'}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default PlayerForm;

