/**
 * 📊 TOURNAMENT STATS PANEL
 * Большой блок статистики турнира: MVP и панель лидеров
 * @version 1.0.0
 * @date 13 октября 2025
 */

import React, { useState, useEffect } from 'react';
import api from '../../axios';
import { ensureHttps } from '../../utils/userHelpers';
import './TournamentStatsPanel.css';

const TournamentStatsPanel = ({ tournamentId }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchTournamentStats();
    }, [tournamentId]);

    const fetchTournamentStats = async () => {
        try {
            setLoading(true);
            console.log(`📊 [TournamentStatsPanel] Загрузка статистики турнира ${tournamentId}`);

            const response = await api.get(`/api/tournaments/${tournamentId}/stats`);

            console.log(`📊 [TournamentStatsPanel] Ответ:`, response.data);

            if (!response.data.hasStats) {
                setStats(null);
                setError('Статистика пока недоступна');
                return;
            }

            setStats(response.data);
            setError(null);

        } catch (err) {
            console.error(`❌ [TournamentStatsPanel] Ошибка загрузки статистики:`, err);
            setError('Ошибка загрузки статистики');
            setStats(null);
        } finally {
            setLoading(false);
        }
    };

    // Форматтеры
    const fmt = (value, decimals = 0) => {
        if (value === null || value === undefined) return '0';
        return Number(value).toFixed(decimals);
    };

    const pct = (value) => {
        if (value === null || value === undefined) return '0%';
        return `${Math.round(Number(value))}%`;
    };

    const formatMoney = (value) => {
        if (value === null || value === undefined) return '$0';
        return `$${Number(value).toLocaleString()}`;
    };

    if (loading) {
        return (
            <div className="tournament-stats-panel">
                <div className="tournament-stats-loading">
                    <div className="tournament-stats-spinner"></div>
                    <p>Загрузка статистики турнира...</p>
                </div>
            </div>
        );
    }

    if (error || !stats || !stats.hasStats) {
        return null; // Не показываем блок если нет данных
    }

    const { mvp, leaders } = stats;

    // Карточки лидеров (аналогично LeadersPanel матча, но с дополнительными показателями)
    const leaderCards = [
        { 
            key: 'kills', 
            slug: 'most-kills', 
            title: 'Most Kills', 
            value: leaders.most_kills?.total_kills ?? 0, 
            name: leaders.most_kills?.username || leaders.most_kills?.name,
            subtitle: `${fmt(leaders.most_kills?.kd_ratio, 2)} K/D`
        },
        { 
            key: 'adr', 
            slug: 'highest-adr', 
            title: 'Highest ADR', 
            value: fmt(leaders.highest_adr?.avg_adr, 1), 
            name: leaders.highest_adr?.username || leaders.highest_adr?.name,
            subtitle: `${leaders.highest_adr?.total_kills ?? 0} kills`
        },
        { 
            key: 'hs', 
            slug: 'best-hs', 
            title: 'Highest HS%', 
            value: pct(leaders.best_hs?.hs_percentage || 0), 
            name: leaders.best_hs?.username || leaders.best_hs?.name,
            subtitle: `${leaders.best_hs?.total_headshot_kills ?? 0} HS kills`
        },
        { 
            key: 'acc', 
            slug: 'best-accuracy', 
            title: 'Best Accuracy', 
            value: pct(leaders.best_accuracy?.accuracy || 0), 
            name: leaders.best_accuracy?.username || leaders.best_accuracy?.name,
            subtitle: `${leaders.best_accuracy?.shots_on_target ?? 0}/${leaders.best_accuracy?.shots_fired ?? 0} shots`
        },
        { 
            key: 'clutch', 
            slug: 'clutch-king', 
            title: 'Clutch King', 
            value: leaders.clutch_king?.clutch_1v1_won ?? 0, 
            name: leaders.clutch_king?.username || leaders.clutch_king?.name,
            subtitle: pct(leaders.clutch_king?.clutch_1v1_rate || 0)
        },
        { 
            key: 'money', 
            slug: 'eco-master', 
            title: 'Total Money', 
            value: formatMoney(leaders.eco_master?.total_money_earned || 0), 
            name: leaders.eco_master?.username || leaders.eco_master?.name,
            subtitle: `${leaders.eco_master?.matches_played ?? 0} matches`
        }
    ];

    return (
        <div className="tournament-stats-panel">
            <div className="tournament-stats-header">
                <h3>🏆 Статистика турнира</h3>
                <p className="tournament-stats-subtitle">
                    {stats.totalPlayers} {stats.totalPlayers === 1 ? 'игрок' : 'игроков'} • {stats.summary?.total_matches_played || 0} матчей
                </p>
            </div>

            <div className="tournament-stats-content">
                {/* MVP Карточка (большая, 2x2) */}
                <div className="tournament-stats-mvp-section">
                    <div className="tournament-stats-mvp-card">
                        <div className="mvp-crown">👑</div>
                        <div className="mvp-title">MVP ТУРНИРА</div>
                        
                        <div className="mvp-player-info">
                            <div className="mvp-avatar">
                                <img 
                                    src={ensureHttps(mvp?.avatar_url) || '/default-avatar.png'}
                                    alt={mvp?.username || 'MVP'}
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                            </div>
                            <div className="mvp-name">{mvp?.username || 'Unknown'}</div>
                        </div>

                        <div className="mvp-stats-grid">
                            <div className="mvp-stat">
                                <div className="mvp-stat-label">Rating</div>
                                <div className="mvp-stat-value">{fmt(mvp?.mvp_rating, 2)}</div>
                            </div>
                            <div className="mvp-stat">
                                <div className="mvp-stat-label">K/D</div>
                                <div className="mvp-stat-value">{fmt(mvp?.kd_ratio, 2)}</div>
                            </div>
                            <div className="mvp-stat">
                                <div className="mvp-stat-label">ADR</div>
                                <div className="mvp-stat-value">{fmt(mvp?.avg_adr, 1)}</div>
                            </div>
                            <div className="mvp-stat">
                                <div className="mvp-stat-label">HS%</div>
                                <div className="mvp-stat-value">{pct(mvp?.hs_percentage)}</div>
                            </div>
                            <div className="mvp-stat">
                                <div className="mvp-stat-label">Kills</div>
                                <div className="mvp-stat-value">{mvp?.total_kills ?? 0}</div>
                            </div>
                            <div className="mvp-stat">
                                <div className="mvp-stat-label">Matches</div>
                                <div className="mvp-stat-value">{mvp?.matches_played ?? 0}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Панель лидеров (6 карточек в grid) */}
                <div className="tournament-stats-leaders-grid">
                    {leaderCards.map((card) => (
                        <div key={card.key} className={`tournament-leader-card card-${card.slug}`}>
                            <div className="leader-card-title">{card.title}</div>
                            <div className="leader-card-value">{card.value}</div>
                            <div className="leader-card-name">{card.name || '-'}</div>
                            {card.subtitle && (
                                <div className="leader-card-subtitle">{card.subtitle}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Сводная статистика турнира (внизу, мелким шрифтом) */}
            {stats.summary && (
                <div className="tournament-stats-summary">
                    <div className="summary-stat">
                        <span className="summary-label">Средний K/D:</span>
                        <span className="summary-value">{fmt(stats.summary.avg_kd_ratio, 2)}</span>
                    </div>
                    <div className="summary-stat">
                        <span className="summary-label">Средний ADR:</span>
                        <span className="summary-value">{fmt(stats.summary.avg_adr, 1)}</span>
                    </div>
                    <div className="summary-stat">
                        <span className="summary-label">Средний HS%:</span>
                        <span className="summary-value">{pct(stats.summary.avg_hs_percentage)}</span>
                    </div>
                    <div className="summary-stat">
                        <span className="summary-label">Всего Ace:</span>
                        <span className="summary-value">{stats.summary.total_aces ?? 0}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentStatsPanel;

