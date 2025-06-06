// Enhanced Profile Component для варианта 4
// Real-time обновления, достижения, AI-анализ, интерактивные графики

import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../axios';
import './V4EnhancedProfile.css';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    PointElement, 
    LineElement, 
    Title, 
    Tooltip, 
    Legend,
    ArcElement,
    BarElement
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

// Регистрируем компоненты Chart.js
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    BarElement
);

function V4EnhancedProfile() {
    // Основные состояния
    const [user, setUser] = useState(null);
    const [enhancedStats, setEnhancedStats] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [performanceAnalysis, setPerformanceAnalysis] = useState(null);
    const [gameAnalytics, setGameAnalytics] = useState(null);
    const [performanceHistory, setPerformanceHistory] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);

    // UI состояния
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [notifications, setNotifications] = useState([]);
    const [chartPeriod, setChartPeriod] = useState('6m');

    // WebSocket соединение
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    // Инициализация компонента
    useEffect(() => {
        initializeComponent();
        return () => {
            // Cleanup при размонтировании
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, []);

    const initializeComponent = async () => {
        try {
            await loadUserData();
            await loadEnhancedStats();
            await loadAchievements();
            await loadPerformanceAnalysis();
            await loadGameAnalytics();
            await loadPerformanceHistory();
            await loadLeaderboard();
            
            // Инициализируем WebSocket после загрузки данных
            initializeWebSocket();
            
            setIsLoading(false);
        } catch (error) {
            console.error('❌ Ошибка инициализации компонента:', error);
            setIsLoading(false);
        }
    };

    const loadUserData = async () => {
        try {
            const response = await api.get('/api/users/me');
            setUser(response.data);
        } catch (error) {
            console.error('❌ Ошибка загрузки данных пользователя:', error);
        }
    };

    const loadEnhancedStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/v4/stats/enhanced/${localStorage.getItem('userId') || '1'}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEnhancedStats(response.data);
        } catch (error) {
            console.error('❌ Ошибка загрузки расширенной статистики:', error);
        }
    };

    const loadAchievements = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/v4/achievements/${localStorage.getItem('userId') || '1'}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAchievements(response.data);
        } catch (error) {
            console.error('❌ Ошибка загрузки достижений:', error);
        }
    };

    const loadPerformanceAnalysis = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/v4/analysis/performance/${localStorage.getItem('userId') || '1'}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPerformanceAnalysis(response.data);
        } catch (error) {
            console.error('❌ Ошибка загрузки анализа производительности:', error);
        }
    };

    const loadGameAnalytics = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/v4/analytics/games/${localStorage.getItem('userId') || '1'}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGameAnalytics(response.data);
        } catch (error) {
            console.error('❌ Ошибка загрузки игровой аналитики:', error);
        }
    };

    const loadPerformanceHistory = async (period = '6m') => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/v4/analytics/performance-history/${localStorage.getItem('userId') || '1'}?period=${period}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPerformanceHistory(response.data);
        } catch (error) {
            console.error('❌ Ошибка загрузки истории производительности:', error);
        }
    };

    const loadLeaderboard = async () => {
        try {
            const response = await api.get('/api/v4/leaderboard/achievements?limit=10');
            setLeaderboard(response.data.leaderboard);
        } catch (error) {
            console.error('❌ Ошибка загрузки лидерборда:', error);
        }
    };

    // WebSocket функции
    const initializeWebSocket = () => {
        try {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}/ws/stats`;
            
            wsRef.current = new WebSocket(wsUrl);
            
            wsRef.current.onopen = () => {
                console.log('🔌 WebSocket подключен для real-time обновлений');
                setIsRealTimeConnected(true);
                
                // Подписываемся на обновления статистики
                wsRef.current.send(JSON.stringify({
                    type: 'subscribe_stats',
                    userId: localStorage.getItem('userId') || '1',
                    token: localStorage.getItem('token')
                }));
            };
            
            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleWebSocketMessage(data);
                } catch (error) {
                    console.error('❌ Ошибка обработки WebSocket сообщения:', error);
                }
            };
            
            wsRef.current.onclose = (event) => {
                console.log('🔌 WebSocket отключен');
                setIsRealTimeConnected(false);
                
                // Переподключение только если не было явного закрытия
                if (event.code !== 1000 && event.code !== 1006) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        console.log('🔄 Переподключение WebSocket...');
                        initializeWebSocket();
                    }, 5000);
                }
            };
            
            wsRef.current.onerror = (error) => {
                console.warn('⚠️ WebSocket недоступен, продолжаем без real-time обновлений');
                setIsRealTimeConnected(false);
                // Не выводим ошибку, просто логируем warning
            };
        } catch (error) {
            console.warn('⚠️ WebSocket недоступен, продолжаем без real-time обновлений:', error.message);
            setIsRealTimeConnected(false);
        }
    };

    const handleWebSocketMessage = (data) => {
        switch (data.type) {
            case 'stats_update':
                setEnhancedStats(data.data);
                addNotification('📊 Статистика обновлена в реальном времени!', 'success');
                break;
                
            case 'stats_recalculated':
                setEnhancedStats(data.data);
                addNotification('🔄 Статистика пересчитана!', 'info');
                // Перезагружаем связанные данные
                loadAchievements();
                loadPerformanceAnalysis();
                break;
                
            case 'tournament_analysis':
                setPerformanceAnalysis(data.data);
                break;
                
            case 'achievement_unlocked':
                addNotification(`🏆 Новое достижение: ${data.achievement.name}!`, 'achievement');
                loadAchievements(); // Перезагружаем достижения
                break;
                
            case 'pong':
                // Heartbeat ответ
                break;
                
            case 'error':
                addNotification(`❌ Ошибка: ${data.message}`, 'error');
                break;
                
            default:
                console.log('❓ Неизвестный тип WebSocket сообщения:', data.type);
        }
    };

    const addNotification = (message, type = 'info') => {
        const notification = {
            id: Date.now(),
            message,
            type,
            timestamp: new Date()
        };
        
        setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Максимум 5 уведомлений
        
        // Автоматически убираем уведомление через 5 секунд
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 5000);
    };

    // Функции UI
    const switchTab = (tabName) => {
        setActiveTab(tabName);
    };

    const handleChartPeriodChange = async (period) => {
        setChartPeriod(period);
        await loadPerformanceHistory(period);
    };

    const requestAIAnalysis = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'request_tournament_analysis',
                userId: localStorage.getItem('userId') || '1',
                token: localStorage.getItem('token')
            }));
            addNotification('🤖 AI анализ запрошен...', 'info');
        }
    };

    const checkAchievements = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.post(`/api/v4/achievements/check/${localStorage.getItem('userId') || '1'}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.newAchievements.length > 0) {
                addNotification(response.data.message, 'achievement');
                loadAchievements(); // Перезагружаем достижения
            } else {
                addNotification(response.data.message, 'info');
            }
        } catch (error) {
            console.error('❌ Ошибка проверки достижений:', error);
            addNotification('❌ Не удалось проверить достижения', 'error');
        }
    };

    // Вспомогательные функции для рендеринга
    const renderNotifications = () => {
        return (
            <div className="v4-notifications">
                {notifications.map(notification => (
                    <div 
                        key={notification.id} 
                        className={`v4-notification v4-notification-${notification.type}`}
                    >
                        <span className="v4-notification-message">{notification.message}</span>
                        <span className="v4-notification-time">
                            {notification.timestamp.toLocaleTimeString()}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    const renderConnectionStatus = () => {
        return (
            <div className={`v4-connection-status ${isRealTimeConnected ? 'connected' : 'disconnected'}`}>
                <span className="v4-connection-indicator">
                    {isRealTimeConnected ? '🟢' : '🔴'}
                </span>
                <span className="v4-connection-text">
                    {isRealTimeConnected ? 'Real-time подключен' : 'Переподключение...'}
                </span>
            </div>
        );
    };

    const renderPerformanceChart = () => {
        if (!performanceHistory || !performanceHistory.history) return null;

        const data = {
            labels: performanceHistory.history.map(h => 
                new Date(h.week).toLocaleDateString('ru-RU', { 
                    month: 'short', 
                    day: 'numeric' 
                })
            ),
            datasets: [
                {
                    label: 'Производительность',
                    data: performanceHistory.history.map(h => h.performance),
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Винрейт %',
                    data: performanceHistory.history.map(h => parseFloat(h.winRate) * 100),
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    fill: false,
                    tension: 0.4
                }
            ]
        };

        const options = {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff'
                    }
                },
                title: {
                    display: true,
                    text: 'История производительности',
                    color: '#ffffff'
                }
            },
            scales: {
                x: {
                    ticks: { color: '#ffffff' },
                    grid: { color: '#333333' }
                },
                y: {
                    ticks: { color: '#ffffff' },
                    grid: { color: '#333333' }
                }
            }
        };

        return <Line data={data} options={options} />;
    };

    const renderGameDistribution = () => {
        if (!gameAnalytics || !gameAnalytics.games) return null;

        const data = {
            labels: gameAnalytics.games.map(g => g.game),
            datasets: [{
                data: gameAnalytics.games.map(g => g.tournaments),
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40'
                ],
                borderWidth: 2,
                borderColor: '#1a1a1a'
            }]
        };

        const options = {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff'
                    }
                },
                title: {
                    display: true,
                    text: 'Распределение по играм',
                    color: '#ffffff'
                }
            }
        };

        return <Doughnut data={data} options={options} />;
    };

    const renderAchievementProgress = () => {
        if (!achievements || !achievements.achievements) return null;

        const categories = [...new Set(achievements.achievements.map(a => a.category))];
        
        return categories.map(category => {
            const categoryAchievements = achievements.achievements.filter(a => a.category === category);
            const unlockedCount = categoryAchievements.filter(a => a.isUnlocked).length;
            const totalCount = categoryAchievements.length;
            const progressPercentage = Math.round((unlockedCount / totalCount) * 100);

            return (
                <div key={category} className="v4-achievement-category">
                    <div className="v4-achievement-category-header">
                        <h4>{getCategoryName(category)}</h4>
                        <span className="v4-achievement-progress">
                            {unlockedCount}/{totalCount} ({progressPercentage}%)
                        </span>
                    </div>
                    <div className="v4-achievement-progress-bar">
                        <div 
                            className="v4-achievement-progress-fill"
                            style={{ width: `${progressPercentage}%` }}
                        ></div>
                    </div>
                    <div className="v4-achievement-grid">
                        {categoryAchievements.map(achievement => (
                            <div 
                                key={achievement.key}
                                className={`v4-achievement-card ${achievement.isUnlocked ? 'unlocked' : 'locked'} rarity-${achievement.rarity}`}
                            >
                                <div className="v4-achievement-icon">{achievement.icon}</div>
                                <div className="v4-achievement-info">
                                    <h5>{achievement.name}</h5>
                                    <p>{achievement.description}</p>
                                    {!achievement.isUnlocked && (
                                        <div className="v4-achievement-progress-text">
                                            {achievement.progress}/{achievement.maxProgress}
                                        </div>
                                    )}
                                </div>
                                <div className="v4-achievement-points">
                                    {achievement.points} очков
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        });
    };

    const getCategoryName = (category) => {
        const categoryNames = {
            tournaments: '🏆 Турниры',
            games: '🎮 Игры',
            social: '👥 Социальные',
            streaks: '🔥 Серии',
            performance: '💎 Производительность',
            special: '⭐ Особые'
        };
        return categoryNames[category] || category;
    };

    const renderDashboard = () => {
        if (!enhancedStats) return <div>Загрузка...</div>;

        return (
            <div className="v4-dashboard">
                {/* Основные метрики */}
                <div className="v4-metrics-grid">
                    <div className="v4-metric-card v4-metric-primary">
                        <div className="v4-metric-value">
                            {enhancedStats.extended?.totalTournaments || 0}
                        </div>
                        <div className="v4-metric-label">Всего турниров</div>
                        <div className="v4-metric-trend">
                            {enhancedStats.extended?.trends?.direction === 'improving' ? '📈' : 
                             enhancedStats.extended?.trends?.direction === 'declining' ? '📉' : '➡️'}
                        </div>
                    </div>

                    <div className="v4-metric-card v4-metric-success">
                        <div className="v4-metric-value">
                            {enhancedStats.extended?.winningTournaments || 0}
                        </div>
                        <div className="v4-metric-label">Побед</div>
                        <div className="v4-metric-icon">🏆</div>
                    </div>

                    <div className="v4-metric-card v4-metric-info">
                        <div className="v4-metric-value">
                            {enhancedStats.extended?.topThreeFinishes || 0}
                        </div>
                        <div className="v4-metric-label">Топ-3 финиша</div>
                        <div className="v4-metric-icon">🥉</div>
                    </div>

                    <div className="v4-metric-card v4-metric-warning">
                        <div className="v4-metric-value">
                            {enhancedStats.extended?.averageFinishPosition || 'N/A'}
                        </div>
                        <div className="v4-metric-label">Среднее место</div>
                        <div className="v4-metric-icon">📊</div>
                    </div>
                </div>

                {/* Графики */}
                <div className="v4-charts-grid">
                    <div className="v4-chart-container">
                        <div className="v4-chart-header">
                            <h3>История производительности</h3>
                            <div className="v4-chart-controls">
                                {['1m', '3m', '6m', '1y'].map(period => (
                                    <button
                                        key={period}
                                        className={`v4-period-btn ${chartPeriod === period ? 'active' : ''}`}
                                        onClick={() => handleChartPeriodChange(period)}
                                    >
                                        {period}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {renderPerformanceChart()}
                    </div>

                    <div className="v4-chart-container">
                        <h3>Распределение по играм</h3>
                        {renderGameDistribution()}
                    </div>
                </div>

                {/* AI Анализ */}
                {performanceAnalysis && (
                    <div className="v4-ai-analysis">
                        <div className="v4-ai-header">
                            <h3>🤖 AI Анализ производительности</h3>
                            <button 
                                className="v4-ai-refresh-btn"
                                onClick={requestAIAnalysis}
                            >
                                Обновить анализ
                            </button>
                        </div>
                        
                        <div className="v4-ai-content">
                            <div className="v4-ai-rating">
                                <div className="v4-rating-circle">
                                    <span className="v4-rating-value">
                                        {performanceAnalysis.performanceRating || 0}
                                    </span>
                                    <span className="v4-rating-label">Рейтинг</span>
                                </div>
                            </div>

                            <div className="v4-ai-insights">
                                <div className="v4-ai-section">
                                    <h4>💪 Сильные стороны</h4>
                                    <ul>
                                        {performanceAnalysis.strengths?.map((strength, index) => (
                                            <li key={index}>{strength}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="v4-ai-section">
                                    <h4>📈 Рекомендации</h4>
                                    <ul>
                                        {performanceAnalysis.improvements?.map((improvement, index) => (
                                            <li key={index}>{improvement}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="v4-ai-section">
                                    <h4>🎯 Предсказание</h4>
                                    <div className="v4-prediction">
                                        <span className="v4-prediction-text">
                                            {performanceAnalysis.prediction?.prediction}
                                        </span>
                                        <span className="v4-prediction-confidence">
                                            Уверенность: {performanceAnalysis.prediction?.confidence}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="v4-loading-container">
                <div className="v4-loading-spinner"></div>
                <div className="v4-loading-text">
                    Загружаем ваш персональный дашборд...
                </div>
            </div>
        );
    }

    return (
        <div className="v4-enhanced-profile">
            {/* Header с уведомлениями и статусом подключения */}
            <div className="v4-header">
                <div className="v4-header-left">
                    <h1>Profile 4.0</h1>
                    <span className="v4-version-badge">ULTIMATE</span>
                </div>
                <div className="v4-header-right">
                    {renderConnectionStatus()}
                    <button 
                        className="v4-achievements-check-btn"
                        onClick={checkAchievements}
                    >
                        🏆 Проверить достижения
                    </button>
                </div>
            </div>

            {/* Уведомления */}
            {renderNotifications()}

            {/* Навигация */}
            <div className="v4-navigation">
                <button 
                    className={`v4-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => switchTab('dashboard')}
                >
                    📊 Дашборд
                </button>
                <button 
                    className={`v4-nav-btn ${activeTab === 'achievements' ? 'active' : ''}`}
                    onClick={() => switchTab('achievements')}
                >
                    🏆 Достижения
                </button>
                <button 
                    className={`v4-nav-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
                    onClick={() => switchTab('leaderboard')}
                >
                    👑 Лидерборд
                </button>
            </div>

            {/* Основной контент */}
            <div className="v4-content">
                {activeTab === 'dashboard' && renderDashboard()}
                
                {activeTab === 'achievements' && (
                    <div className="v4-achievements-section">
                        <div className="v4-achievements-header">
                            <h2>🏆 Достижения</h2>
                            {achievements && (
                                <div className="v4-achievements-summary">
                                    <span>
                                        {achievements.unlockedCount}/{achievements.totalCount} разблокировано
                                    </span>
                                    <span className="v4-achievements-points">
                                        {achievements.totalPoints} очков
                                    </span>
                                </div>
                            )}
                        </div>
                        {renderAchievementProgress()}
                    </div>
                )}
                
                {activeTab === 'leaderboard' && (
                    <div className="v4-leaderboard-section">
                        <h2>👑 Лидерборд достижений</h2>
                        <div className="v4-leaderboard-list">
                            {leaderboard.map((entry, index) => (
                                <div key={entry.userId} className="v4-leaderboard-entry">
                                    <div className="v4-leaderboard-rank">
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${entry.rank}`}
                                    </div>
                                    <div className="v4-leaderboard-user">
                                        <img 
                                            src={entry.avatarUrl || '/default-avatar.png'} 
                                            alt={entry.username}
                                            className="v4-leaderboard-avatar"
                                        />
                                        <span className="v4-leaderboard-username">{entry.username}</span>
                                    </div>
                                    <div className="v4-leaderboard-stats">
                                        <span className="v4-leaderboard-points">{entry.points} очков</span>
                                        <span className="v4-leaderboard-achievements">
                                            {entry.unlockedCount} достижений
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default V4EnhancedProfile; 