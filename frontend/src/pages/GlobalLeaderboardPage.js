/**
 * 🌍 GLOBAL LEADERBOARD PAGE
 * Страница с глобальным лидербордом MVP
 * @version 1.0.0
 */

import React from 'react';
import GlobalMVPLeaderboard from '../components/achievements/GlobalMVPLeaderboard';
import './GlobalLeaderboardPage.css';

const GlobalLeaderboardPage = () => {
    return (
        <div className="global-leaderboard-page">
            <div className="global-leaderboard-container">
                <div className="page-hero">
                    <h1>🏆 Зал славы</h1>
                    <p>Лучшие игроки платформы 1337 Community</p>
                </div>

                <GlobalMVPLeaderboard limit={100} showFilters={true} />

                <div className="leaderboard-info">
                    <h3>Как попасть в топ?</h3>
                    <div className="info-grid">
                        <div className="info-card">
                            <div className="info-icon">👑</div>
                            <div className="info-title">Станьте MVP</div>
                            <div className="info-text">Побеждайте в турнирах и показывайте лучшую статистику</div>
                            <div className="info-reward">+100 баллов за каждый MVP</div>
                        </div>
                        <div className="info-card">
                            <div className="info-icon">🥇</div>
                            <div className="info-title">Золотые медали</div>
                            <div className="info-text">Становитесь топ-1 в категориях (Most Kills, ADR, etc)</div>
                            <div className="info-reward">+10 баллов за золото</div>
                        </div>
                        <div className="info-card">
                            <div className="info-icon">🥈</div>
                            <div className="info-title">Серебряные медали</div>
                            <div className="info-text">Топ-2 в категориях турнира</div>
                            <div className="info-reward">+5 баллов за серебро</div>
                        </div>
                        <div className="info-card">
                            <div className="info-icon">🥉</div>
                            <div className="info-title">Бронзовые медали</div>
                            <div className="info-text">Топ-3 в категориях турнира</div>
                            <div className="info-reward">+2 балла за бронзу</div>
                        </div>
                    </div>
                </div>

                <div className="rewards-info">
                    <h3>💰 Награды Leet Coins</h3>
                    <div className="rewards-table">
                        <div className="reward-row reward-header">
                            <div>Достижение</div>
                            <div>🥇 1 место</div>
                            <div>🥈 2 место</div>
                            <div>🥉 3 место</div>
                        </div>
                        <div className="reward-row">
                            <div>👑 MVP турнира</div>
                            <div className="reward-value">500 🪙</div>
                            <div className="reward-value">250 🪙</div>
                            <div className="reward-value">100 🪙</div>
                        </div>
                        <div className="reward-row">
                            <div>🔫 Most Kills</div>
                            <div className="reward-value">200 🪙</div>
                            <div className="reward-value">100 🪙</div>
                            <div className="reward-value">50 🪙</div>
                        </div>
                        <div className="reward-row">
                            <div>💥 Highest ADR</div>
                            <div className="reward-value">150 🪙</div>
                            <div className="reward-value">75 🪙</div>
                            <div className="reward-value">30 🪙</div>
                        </div>
                        <div className="reward-row">
                            <div>🎯 Best HS%</div>
                            <div className="reward-value">150 🪙</div>
                            <div className="reward-value">75 🪙</div>
                            <div className="reward-value">30 🪙</div>
                        </div>
                        <div className="reward-row">
                            <div>⚡ Clutch King</div>
                            <div className="reward-value">200 🪙</div>
                            <div className="reward-value">100 🪙</div>
                            <div className="reward-value">50 🪙</div>
                        </div>
                        <div className="reward-row">
                            <div>💰 Eco Master</div>
                            <div className="reward-value">100 🪙</div>
                            <div className="reward-value">50 🪙</div>
                            <div className="reward-value">25 🪙</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalLeaderboardPage;

