import React, { useState, useEffect } from 'react';
import api from '../axios';
import './FriendsComparison.css';

/**
 * FriendsComparison - Сравнение статистики с друзьями
 * Показывает как пользователь выступает относительно своих друзей
 */
function FriendsComparison({ userId, stats }) {
    const [friendsStats, setFriendsStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (userId && stats) {
            loadFriendsComparison();
        }
    }, [userId, stats]);

    const loadFriendsComparison = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/api/users/${userId}/friends-comparison`);
            setFriendsStats(response.data);
        } catch (error) {
            console.log('⚠️ Не удалось загрузить сравнение с друзьями:', error);
            setFriendsStats(null);
        } finally {
            setLoading(false);
        }
    };

    // Вычисляем процентиль игрока среди друзей
    const calculatePercentile = (userValue, friendsValues) => {
        if (!friendsValues || friendsValues.length === 0) return 50;
        
        const sorted = [...friendsValues, userValue].sort((a, b) => a - b);
        const userIndex = sorted.indexOf(userValue);
        return Math.round((userIndex / sorted.length) * 100);
    };

    if (loading) {
        return (
            <div className="friends-comparison loading">
                <div className="comparison-header">
                    <h4>Сравнение с друзьями</h4>
                    <div className="loading-text">Загрузка...</div>
                </div>
            </div>
        );
    }

    if (!friendsStats || !friendsStats.hasFriends) {
        return null; // Не показываем если нет друзей
    }

    // Вычисляем метрики для сравнения
    const userWinrate = stats ? calculateWinrate(stats) : 0;
    const avgFriendWinrate = friendsStats.avgWinrate || 50;
    const winratePercentile = calculatePercentile(userWinrate, friendsStats.friendsWinrates || []);

    const userMatches = stats ? getTotalMatches(stats) : 0;
    const avgFriendMatches = friendsStats.avgMatches || 0;
    const matchesPercentile = calculatePercentile(userMatches, friendsStats.friendsMatches || []);

    const userTournaments = stats?.tournaments?.length || 0;
    const avgFriendTournaments = friendsStats.avgTournaments || 0;
    const tournamentsPercentile = calculatePercentile(userTournaments, friendsStats.friendsTournaments || []);

    function calculateWinrate(stats) {
        const totalWins = (stats.solo?.wins || 0) + (stats.team?.wins || 0);
        const totalMatches = totalWins + (stats.solo?.losses || 0) + (stats.team?.losses || 0);
        return totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
    }

    function getTotalMatches(stats) {
        return (stats.solo?.wins || 0) + (stats.solo?.losses || 0) + 
               (stats.team?.wins || 0) + (stats.team?.losses || 0);
    }

    // Определяем общее место среди друзей
    const overallPercentile = Math.round((winratePercentile + matchesPercentile + tournamentsPercentile) / 3);
    const getBadge = (percentile) => {
        if (percentile >= 80) return { text: 'Топ игрок', icon: '👑', color: '#FFD700' };
        if (percentile >= 60) return { text: 'Выше среднего', icon: '⭐', color: '#4CAF50' };
        if (percentile >= 40) return { text: 'Средний уровень', icon: '📊', color: '#2196F3' };
        return { text: 'Есть к чему стремиться', icon: '💪', color: '#9E9E9E' };
    };

    const badge = getBadge(overallPercentile);

    return (
        <div className="friends-comparison">
            <div className="comparison-header" onClick={() => setExpanded(!expanded)}>
                <div className="header-main">
                    <h4>
                        <span className="badge-icon" style={{ color: badge.color }}>{badge.icon}</span>
                        Сравнение с друзьями
                    </h4>
                    <div className="overall-badge" style={{ borderColor: badge.color, color: badge.color }}>
                        Лучше {overallPercentile}% друзей
                    </div>
                </div>
                <button className="expand-btn">
                    {expanded ? '▲' : '▼'}
                </button>
            </div>

            {expanded && (
                <div className="comparison-details">
                    <div className="comparison-metric">
                        <div className="metric-header">
                            <span className="metric-icon">💯</span>
                            <span className="metric-name">Винрейт</span>
                        </div>
                        <div className="metric-values">
                            <span className="user-value">{userWinrate}%</span>
                            <span className="vs">vs</span>
                            <span className="avg-value">{avgFriendWinrate.toFixed(1)}%</span>
                        </div>
                        <div className="metric-bar">
                            <div 
                                className="metric-fill"
                                style={{ 
                                    width: `${winratePercentile}%`,
                                    background: winratePercentile >= 50 ? '#4CAF50' : '#FF5252'
                                }}
                            />
                        </div>
                        <div className="metric-percentile">
                            Лучше {winratePercentile}% друзей
                        </div>
                    </div>

                    <div className="comparison-metric">
                        <div className="metric-header">
                            <span className="metric-icon">🎮</span>
                            <span className="metric-name">Матчей сыграно</span>
                        </div>
                        <div className="metric-values">
                            <span className="user-value">{userMatches}</span>
                            <span className="vs">vs</span>
                            <span className="avg-value">{Math.round(avgFriendMatches)}</span>
                        </div>
                        <div className="metric-bar">
                            <div 
                                className="metric-fill"
                                style={{ 
                                    width: `${matchesPercentile}%`,
                                    background: matchesPercentile >= 50 ? '#4CAF50' : '#FF5252'
                                }}
                            />
                        </div>
                        <div className="metric-percentile">
                            Лучше {matchesPercentile}% друзей
                        </div>
                    </div>

                    <div className="comparison-metric">
                        <div className="metric-header">
                            <span className="metric-icon">🏆</span>
                            <span className="metric-name">Турниров</span>
                        </div>
                        <div className="metric-values">
                            <span className="user-value">{userTournaments}</span>
                            <span className="vs">vs</span>
                            <span className="avg-value">{Math.round(avgFriendTournaments)}</span>
                        </div>
                        <div className="metric-bar">
                            <div 
                                className="metric-fill"
                                style={{ 
                                    width: `${tournamentsPercentile}%`,
                                    background: tournamentsPercentile >= 50 ? '#4CAF50' : '#FF5252'
                                }}
                            />
                        </div>
                        <div className="metric-percentile">
                            Лучше {tournamentsPercentile}% друзей
                        </div>
                    </div>

                    <div className="comparison-footer">
                        <span className="friends-count">
                            📊 Сравнение с {friendsStats.friendsCount} {friendsStats.friendsCount === 1 ? 'другом' : 'друзьями'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FriendsComparison;

