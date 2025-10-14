/**
 * 🏅 USER ACHIEVEMENTS PANEL
 * Панель достижений пользователя в турнирах
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../axios';
import AchievementBadge from './AchievementBadge';
import './UserAchievementsPanel.css';

const UserAchievementsPanel = ({ userId }) => {
    const [achievements, setAchievements] = useState([]);
    const [medals, setMedals] = useState({ gold: 0, silver: 0, bronze: 0, mvp: 0 });
    const [globalRank, setGlobalRank] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAchievements();
        fetchGlobalRank();
    }, [userId]);

    const fetchAchievements = async () => {
        try {
            const response = await api.get(`/api/achievements/user/${userId}`);
            
            if (response.data.success) {
                setAchievements(response.data.achievements || []);
                setMedals(response.data.medals || { gold: 0, silver: 0, bronze: 0, mvp: 0 });
            }
        } catch (error) {
            console.error(`❌ [UserAchievements] Ошибка загрузки достижений:`, error);
        } finally {
            setLoading(false);
        }
    };

    const fetchGlobalRank = async () => {
        try {
            const response = await api.get(`/api/achievements/user/${userId}/rank`);
            
            if (response.data.hasRank) {
                setGlobalRank(response.data.rank);
            }
        } catch (error) {
            console.error(`❌ [UserAchievements] Ошибка загрузки ранга:`, error);
        }
    };

    if (loading) {
        return (
            <div className="user-achievements-panel">
                <div className="achievements-loading">
                    <div className="spinner"></div>
                    <p>Загрузка достижений...</p>
                </div>
            </div>
        );
    }

    if (achievements.length === 0) {
        return (
            <div className="user-achievements-panel">
                <div className="achievements-empty">
                    <div className="empty-icon">🏆</div>
                    <h3>Пока нет достижений</h3>
                    <p>Участвуйте в турнирах и показывайте лучшую статистику!</p>
                    <Link to="/tournaments" className="btn btn-primary">
                        Найти турниры
                    </Link>
                </div>
            </div>
        );
    }

    // Группируем достижения по турнирам
    const achievementsByTournament = achievements.reduce((acc, achievement) => {
        const key = achievement.tournament_id;
        if (!acc[key]) {
            acc[key] = {
                tournament_id: achievement.tournament_id,
                tournament_name: achievement.tournament_name,
                game: achievement.game,
                achievements: []
            };
        }
        acc[key].achievements.push(achievement);
        return acc;
    }, {});

    const tournaments = Object.values(achievementsByTournament);

    return (
        <div className="user-achievements-panel">
            {/* Статистика медалей */}
            <div className="medals-summary">
                <div className="summary-card">
                    <div className="summary-icon">👑</div>
                    <div className="summary-value">{medals.mvp}</div>
                    <div className="summary-label">MVP</div>
                </div>
                <div className="summary-card">
                    <div className="summary-icon">🥇</div>
                    <div className="summary-value">{medals.gold}</div>
                    <div className="summary-label">Золото</div>
                </div>
                <div className="summary-card">
                    <div className="summary-icon">🥈</div>
                    <div className="summary-value">{medals.silver}</div>
                    <div className="summary-label">Серебро</div>
                </div>
                <div className="summary-card">
                    <div className="summary-icon">🥉</div>
                    <div className="summary-value">{medals.bronze}</div>
                    <div className="summary-label">Бронза</div>
                </div>
                {globalRank && (
                    <div className="summary-card global-rank-card">
                        <div className="summary-icon">🌍</div>
                        <div className="summary-value">#{globalRank}</div>
                        <div className="summary-label">Глобальный ранг</div>
                    </div>
                )}
            </div>

            {/* Список достижений по турнирам */}
            <div className="achievements-list">
                <h3>Турниры ({tournaments.length})</h3>
                
                {tournaments.map((tournament) => (
                    <div key={tournament.tournament_id} className="tournament-achievements">
                        <div className="tournament-header">
                            <Link to={`/tournaments/${tournament.tournament_id}`} className="tournament-name">
                                {tournament.tournament_name}
                            </Link>
                            <span className="tournament-game">{tournament.game}</span>
                        </div>
                        
                        <div className="achievements-badges">
                            {tournament.achievements.map((achievement) => (
                                <AchievementBadge 
                                    key={achievement.id}
                                    achievement={achievement}
                                    size="medium"
                                    showTooltip={true}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Ссылка на глобальный лидерборд */}
            <div className="leaderboard-cta">
                <Link to="/leaderboard" className="btn btn-primary">
                    🌍 Посмотреть глобальный рейтинг
                </Link>
            </div>
        </div>
    );
};

export default UserAchievementsPanel;

