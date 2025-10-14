/**
 * 🌍 GLOBAL MVP LEADERBOARD
 * Глобальный лидерборд MVP игроков
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import api from '../../axios';
import { ensureHttps } from '../../utils/userHelpers';
import { Link } from 'react-router-dom';
import './GlobalMVPLeaderboard.css';

const GlobalMVPLeaderboard = ({ limit = 50, showFilters = true }) => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('global_mvp_score');

    useEffect(() => {
        fetchLeaderboard();
    }, [sortBy, limit]);

    const fetchLeaderboard = async () => {
        try {
            setLoading(true);
            console.log(`🌍 [GlobalMVPLeaderboard] Загрузка лидерборда, сортировка: ${sortBy}`);

            const response = await api.get(`/api/achievements/global-leaderboard?limit=${limit}&sort=${sortBy}`);

            console.log(`📊 [GlobalMVPLeaderboard] Получено ${response.data.leaderboard.length} игроков`);
            setLeaderboard(response.data.leaderboard);

        } catch (error) {
            console.error(`❌ [GlobalMVPLeaderboard] Ошибка загрузки:`, error);
            setLeaderboard([]);
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return Number(num).toLocaleString();
    };

    const getMedalEmoji = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `${rank}`;
    };

    if (loading) {
        return (
            <div className="global-mvp-leaderboard">
                <div className="leaderboard-loading">
                    <div className="spinner"></div>
                    <p>Загрузка глобального лидерборда...</p>
                </div>
            </div>
        );
    }

    if (leaderboard.length === 0) {
        return (
            <div className="global-mvp-leaderboard">
                <div className="leaderboard-empty">
                    <h3>Лидерборд пуст</h3>
                    <p>Станьте первым MVP в турнире!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="global-mvp-leaderboard">
            <div className="leaderboard-header">
                <h2>🌍 Глобальный рейтинг MVP</h2>
                <p className="leaderboard-subtitle">
                    {leaderboard.length} лучших игроков платформы
                </p>
            </div>

            {showFilters && (
                <div className="leaderboard-filters">
                    <label>Сортировка:</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="global_mvp_score">MVP Score</option>
                        <option value="total_mvp_count">Количество MVP</option>
                        <option value="gold_medals">Золотые медали</option>
                        <option value="tournaments_played">Турниров сыграно</option>
                    </select>
                </div>
            )}

            <div className="leaderboard-list">
                {leaderboard.map((player, index) => (
                    <div key={player.user_id} className={`leaderboard-item rank-${player.global_rank}`}>
                        <div className="leaderboard-rank">
                            {getMedalEmoji(player.global_rank)}
                        </div>

                        <div className="leaderboard-player">
                            <Link to={`/user/${player.user_id}`} className="player-link">
                                <div className="player-avatar">
                                    <img 
                                        src={ensureHttps(player.avatar_url) || '/default-avatar.png'}
                                        alt={player.username}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                <div className="player-name">{player.username}</div>
                            </Link>
                        </div>

                        <div className="leaderboard-medals">
                            {player.gold_medals > 0 && (
                                <span className="medal-badge gold" title="Золотые медали">
                                    🥇 {player.gold_medals}
                                </span>
                            )}
                            {player.silver_medals > 0 && (
                                <span className="medal-badge silver" title="Серебряные медали">
                                    🥈 {player.silver_medals}
                                </span>
                            )}
                            {player.bronze_medals > 0 && (
                                <span className="medal-badge bronze" title="Бронзовые медали">
                                    🥉 {player.bronze_medals}
                                </span>
                            )}
                        </div>

                        <div className="leaderboard-stats">
                            <div className="stat-item" title="MVP турниров">
                                <span className="stat-label">MVP:</span>
                                <span className="stat-value mvp-count">{player.total_mvp_count || 0}</span>
                            </div>
                            <div className="stat-item" title="Турниров сыграно">
                                <span className="stat-label">Турниров:</span>
                                <span className="stat-value">{player.tournaments_played || 0}</span>
                            </div>
                            <div className="stat-item" title="Средний K/D">
                                <span className="stat-label">K/D:</span>
                                <span className="stat-value">{Number(player.avg_kd_ratio || 0).toFixed(2)}</span>
                            </div>
                            <div className="stat-item" title="Средний ADR">
                                <span className="stat-label">ADR:</span>
                                <span className="stat-value">{Number(player.avg_adr || 0).toFixed(1)}</span>
                            </div>
                        </div>

                        <div className="leaderboard-score">
                            <div className="score-value">{formatNumber(player.global_mvp_score)}</div>
                            <div className="score-label">баллов</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GlobalMVPLeaderboard;

