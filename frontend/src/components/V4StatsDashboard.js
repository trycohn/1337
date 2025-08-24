// ✨ V4 ULTIMATE: Революционный дашборд статистики
import React from 'react';
import { Line, Bar, Radar, Doughnut } from 'react-chartjs-2';

const V4StatsDashboard = ({
    v4Data,
    stats,
    onViewChange,
    requestEnhancedRecalculation,
    isRecalculating,
    recalculationStatus,
    recalculationError
}) => {
    const {
        v4EnhancedStats,
        achievements,
        userAchievements,
        aiAnalysis,
        performanceData,
        currentStreak,
        isLoadingAchievements,
        isLoadingAI,
        realTimeUpdates,
        showAchievementNotification,
        globalRank,
        weeklyProgress,
        personalBests,
        v4ActiveView,
        setV4ActiveView,
        fetchAIAnalysis
    } = v4Data;

    // 📊 Генерация данных для графиков производительности
    const generatePerformanceChartData = () => {
        if (!performanceData || performanceData.length === 0) return null;
        
        const last30Days = performanceData.slice(-30);
        
        return {
            labels: last30Days.map(d => new Date(d.date).toLocaleDateString('ru-RU')),
            datasets: [
                {
                    label: 'Винрейт',
                    data: last30Days.map(d => d.winrate),
                    borderColor: '#4caf50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Активность',
                    data: last30Days.map(d => d.activity_score),
                    borderColor: '#2196f3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        };
    };
    
    // 🎯 Данные для радарной диаграммы навыков
    const generateSkillRadarData = () => {
        if (!v4EnhancedStats) return null;
        
        const skills = v4EnhancedStats.skillAnalysis || {};
        
        return {
            labels: ['Стратегия', 'Тактика', 'Механика', 'Работа в команде', 'Адаптация', 'Лидерство'],
            datasets: [{
                label: 'Уровень навыков',
                data: [
                    skills.strategy || 0,
                    skills.tactics || 0,
                    skills.mechanics || 0,
                    skills.teamwork || 0,
                    skills.adaptation || 0,
                    skills.leadership || 0
                ],
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                borderColor: '#4caf50',
                borderWidth: 2,
                pointBackgroundColor: '#4caf50',
                pointBorderColor: '#ffffff',
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: '#4caf50'
            }]
        };
    };
    
    // 🏆 Данные для диаграммы достижений по категориям
    const generateAchievementsCategoryData = () => {
        if (!userAchievements || userAchievements.length === 0) return null;
        
        const categories = {};
        achievements.forEach(achievement => {
            categories[achievement.category] = (categories[achievement.category] || 0) + 1;
        });
        
        const unlockedCategories = {};
        userAchievements.forEach(userAch => {
            const achievement = achievements.find(a => a.id === userAch.achievement_id);
            if (achievement) {
                unlockedCategories[achievement.category] = (unlockedCategories[achievement.category] || 0) + 1;
            }
        });
        
        return {
            labels: Object.keys(categories),
            datasets: [{
                label: 'Прогресс достижений',
                data: Object.keys(categories).map(cat => 
                    Math.round((unlockedCategories[cat] || 0) / categories[cat] * 100)
                ),
                backgroundColor: [
                    '#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#795548'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };
    };
    
    // 🎮 Данные для графика статистики по играм
    const generateGameStatsData = () => {
        if (!stats?.byGame) return null;
        
        const games = Object.keys(stats.byGame);
        const winrates = games.map(game => {
            const gameStats = stats.byGame[game];
            const totalWins = gameStats.solo.wins + gameStats.team.wins;
            const totalMatches = totalWins + gameStats.solo.losses + gameStats.team.losses;
            return totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
        });
        
        return {
            labels: games,
            datasets: [{
                label: 'Винрейт по играм (%)',
                data: winrates,
                backgroundColor: games.map((_, index) => 
                    `hsla(${index * 60}, 70%, 50%, 0.8)`
                ),
                borderColor: games.map((_, index) => 
                    `hsla(${index * 60}, 70%, 40%, 1)`
                ),
                borderWidth: 2
            }]
        };
    };
    
    // 📈 Опции для графиков Chart.js
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: '#ffffff',
                    font: {
                        family: 'system-ui'
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: '#333333',
                borderWidth: 1
            }
        },
        scales: {
            x: {
                ticks: { color: '#cccccc' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
                ticks: { color: '#cccccc' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        }
    };
    
    const radarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#ffffff'
                }
            }
        },
        scales: {
            r: {
                beginAtZero: true,
                max: 100,
                ticks: { color: '#cccccc' },
                grid: { color: 'rgba(255, 255, 255, 0.2)' },
                pointLabels: { color: '#ffffff' }
            }
        }
    };

    return (
        <div className="v4-ultimate-dashboard">
            {/* V4 Navigation */}
            <div className="v4-navigation">
                <button 
                    className={`v4-nav-btn ${v4ActiveView === 'overview' ? 'active' : ''}`}
                    onClick={() => setV4ActiveView('overview')}
                >
                    🔥 Обзор
                </button>
                <button 
                    className={`v4-nav-btn ${v4ActiveView === 'charts' ? 'active' : ''}`}
                    onClick={() => setV4ActiveView('charts')}
                >
                    📊 Графики
                </button>
                <button 
                    className="btn btn-secondary"
                    onClick={() => setV4ActiveView('achievements')}
                >
                    🏆 Достижения
                </button>
                <button 
                    className="btn btn-secondary"
                    onClick={() => setV4ActiveView('ai')}
                >
                    🤖 AI Анализ
                </button>
                <button 
                    className="btn btn-secondary v4-enhanced-recalc"
                    onClick={requestEnhancedRecalculation}
                    disabled={isRecalculating}
                >
                    {isRecalculating ? '🔄 Анализируем...' : '🚀 Глубокий анализ'}
                </button>
            </div>

            {/* Real-time Updates */}
            {realTimeUpdates.length > 0 && (
                <div className="v4-realtime-updates">
                    <h4>🔴 Live обновления</h4>
                    {realTimeUpdates.map((update, index) => (
                        <div key={index} className="v4-realtime-item">
                            <span className="v4-update-time">
                                {new Date(update.timestamp).toLocaleTimeString('ru-RU')}
                            </span>
                            <span className="v4-update-message">{update.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Achievement Notification */}
            {showAchievementNotification && (
                <div className="v4-achievement-notification">
                    <div className="v4-achievement-content">
                        <span className="v4-achievement-icon">🏆</span>
                        <div>
                            <h4>Новое достижение!</h4>
                            <p>{showAchievementNotification.title}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Content based on active view */}
            {v4ActiveView === 'overview' && (
                <div className="v4-overview-content">
                    {/* Enhanced Stats Grid */}
                    {v4EnhancedStats && (
                        <div className="v4-enhanced-stats-grid">
                            <div className="v4-stat-card v4-primary">
                                <div className="v4-stat-icon">⚡</div>
                                <div className="v4-stat-content">
                                    <div className="v4-stat-value">{v4EnhancedStats.performanceScore || 0}</div>
                                    <div className="v4-stat-label">Performance Score</div>
                                </div>
                            </div>
                            
                            <div className="v4-stat-card v4-success">
                                <div className="v4-stat-icon">🎯</div>
                                <div className="v4-stat-content">
                                    <div className="v4-stat-value">{globalRank || '--'}</div>
                                    <div className="v4-stat-label">Глобальный ранг</div>
                                </div>
                            </div>
                            
                            <div className="v4-stat-card v4-warning">
                                <div className="v4-stat-icon">🔥</div>
                                <div className="v4-stat-content">
                                    <div className="v4-stat-value">{currentStreak?.current || 0}</div>
                                    <div className="v4-stat-label">Текущая серия</div>
                                </div>
                            </div>
                            
                            <div className="v4-stat-card v4-info">
                                <div className="v4-stat-icon">🏆</div>
                                <div className="v4-stat-content">
                                    <div className="v4-stat-value">{userAchievements.length}</div>
                                    <div className="v4-stat-label">Достижений</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Weekly Progress */}
                    {weeklyProgress && (
                        <div className="v4-weekly-progress">
                            <h4>📈 Прогресс недели</h4>
                            <div className="v4-progress-bars">
                                <div className="v4-progress-item">
                                    <span>Матчи</span>
                                    <div className="v4-progress-bar">
                                        <div 
                                            className="v4-progress-fill"
                                            style={{ width: `${(weeklyProgress.matches / weeklyProgress.target_matches) * 100}%` }}
                                        ></div>
                                    </div>
                                    <span>{weeklyProgress.matches}/{weeklyProgress.target_matches}</span>
                                </div>
                                <div className="v4-progress-item">
                                    <span>Винрейт</span>
                                    <div className="v4-progress-bar">
                                        <div 
                                            className="v4-progress-fill"
                                            style={{ width: `${weeklyProgress.winrate}%` }}
                                        ></div>
                                    </div>
                                    <span>{weeklyProgress.winrate}%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Personal Bests */}
                    {Object.keys(personalBests).length > 0 && (
                        <div className="v4-personal-bests">
                            <h4>🥇 Личные рекорды</h4>
                            <div className="v4-bests-grid">
                                {Object.entries(personalBests).map(([key, value]) => (
                                    <div key={key} className="v4-best-item">
                                        <div className="v4-best-label">{key}</div>
                                        <div className="v4-best-value">{value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {v4ActiveView === 'charts' && (
                <div className="v4-charts-content">
                    <div className="v4-charts-grid">
                        {/* Performance Chart */}
                        {generatePerformanceChartData() && (
                            <div className="v4-chart-container">
                                <h4>📈 Динамика производительности</h4>
                                <div className="v4-chart-wrapper">
                                    <Line data={generatePerformanceChartData()} options={chartOptions} />
                                </div>
                            </div>
                        )}

                        {/* Skills Radar */}
                        {generateSkillRadarData() && (
                            <div className="v4-chart-container">
                                <h4>🎯 Анализ навыков</h4>
                                <div className="v4-chart-wrapper">
                                    <Radar data={generateSkillRadarData()} options={radarOptions} />
                                </div>
                            </div>
                        )}

                        {/* Game Stats Bar Chart */}
                        {generateGameStatsData() && (
                            <div className="v4-chart-container">
                                <h4>🎮 Статистика по играм</h4>
                                <div className="v4-chart-wrapper">
                                    <Bar data={generateGameStatsData()} options={chartOptions} />
                                </div>
                            </div>
                        )}

                        {/* Achievements Doughnut */}
                        {generateAchievementsCategoryData() && (
                            <div className="v4-chart-container">
                                <h4>🏆 Прогресс достижений</h4>
                                <div className="v4-chart-wrapper">
                                    <Doughnut data={generateAchievementsCategoryData()} options={chartOptions} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {v4ActiveView === 'achievements' && (
                <div className="v4-achievements-content">
                    {isLoadingAchievements ? (
                        <div className="v4-loading">🔄 Загрузка достижений...</div>
                    ) : (
                        <div className="v4-achievements-grid">
                            {achievements.map(achievement => {
                                const unlocked = userAchievements.find(ua => ua.achievement_id === achievement.id);
                                return (
                                    <div 
                                        key={achievement.id} 
                                        className={`v4-achievement-card ${unlocked ? 'unlocked' : 'locked'}`}
                                    >
                                        <div className="v4-achievement-icon">
                                            {achievement.icon || '🏆'}
                                        </div>
                                        <div className="v4-achievement-content">
                                            <h4>{achievement.title}</h4>
                                            <p>{achievement.description}</p>
                                            <div className="v4-achievement-meta">
                                                <span className={`v4-rarity rarity-${achievement.rarity}`}>
                                                    {achievement.rarity}
                                                </span>
                                                <span className="v4-points">
                                                    {achievement.points} очков
                                                </span>
                                            </div>
                                            {unlocked && (
                                                <div className="v4-achievement-date">
                                                    Получено: {new Date(unlocked.unlocked_at).toLocaleDateString('ru-RU')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {v4ActiveView === 'ai' && (
                <div className="v4-ai-content">
                    {!aiAnalysis ? (
                        <div className="v4-ai-prompt">
                            <h4>🤖 AI Анализ производительности</h4>
                            <p>Получите персональные рекомендации и глубокий анализ вашей игры с помощью искусственного интеллекта.</p>
                            <button 
                                className="v4-ai-generate-btn"
                                onClick={fetchAIAnalysis}
                                disabled={isLoadingAI}
                            >
                                {isLoadingAI ? '🔄 Анализируем...' : '🚀 Запустить анализ'}
                            </button>
                        </div>
                    ) : (
                        <div className="v4-ai-results">
                            <div className="v4-ai-summary">
                                <h4>📊 Сводка анализа</h4>
                                <p>{aiAnalysis.summary}</p>
                            </div>
                            
                            <div className="v4-ai-recommendations">
                                <h4>💡 Рекомендации</h4>
                                <ul>
                                    {aiAnalysis.recommendations?.map((rec, index) => (
                                        <li key={index}>{rec}</li>
                                    ))}
                                </ul>
                            </div>
                            
                            <div className="v4-ai-predictions">
                                <h4>🔮 Прогнозы</h4>
                                <div className="v4-predictions-grid">
                                    {aiAnalysis.predictions?.map((pred, index) => (
                                        <div key={index} className="v4-prediction-item">
                                            <div className="v4-prediction-label">{pred.metric}</div>
                                            <div className="v4-prediction-value">{pred.predicted_value}</div>
                                            <div className="v4-prediction-confidence">
                                                Уверенность: {pred.confidence}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default V4StatsDashboard; 