/**
 * 🏆 TEAM STANDINGS TABLE
 * Таблица итоговых мест команд в турнире (левая колонка)
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../axios';
import { ensureHttps } from '../../utils/userHelpers';
import './TeamStandingsTable.css';

const TeamStandingsTable = ({ tournamentId, tournament }) => {
    const [standings, setStandings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (tournamentId) {
            fetchStandings();
        }
    }, [tournamentId]);

    const fetchStandings = async () => {
        try {
            setLoading(true);
            console.log(`🏆 [TeamStandings] Загрузка standings для турнира ${tournamentId}`);

            const response = await api.get(`/api/tournaments/${tournamentId}/standings`);

            console.log(`📊 [TeamStandings] Ответ сервера:`, {
                success: response.data.success,
                standings_count: response.data.standings?.length || 0,
                totalTeams: response.data.totalTeams,
                first_team: response.data.standings?.[0]
            });

            if (response.data.success && response.data.standings) {
                setStandings(response.data.standings);
            } else {
                console.warn(`⚠️ [TeamStandings] Нет данных о standings`);
                setStandings([]);
            }

        } catch (error) {
            console.error(`❌ [TeamStandings] Ошибка загрузки:`, error);
            console.error(`❌ [TeamStandings] Детали ошибки:`, {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            setStandings([]);
        } finally {
            setLoading(false);
        }
    };

    const getMedalEmoji = (placement) => {
        if (placement === 1) return '🥇';
        if (placement === 2) return '🥈';
        if (placement === 3) return '🥉';
        return null;
    };

    const getPlacementDisplay = (team) => {
        if (team.placement_range) {
            return team.placement_range;
        }
        if (team.placement) {
            return `${team.placement}`;
        }
        return '-';
    };

    if (loading) {
        return (
            <div className="team-standings-table">
                <div className="standings-loading">
                    <div className="spinner"></div>
                    <p>Загрузка таблицы...</p>
                </div>
            </div>
        );
    }

    if (standings.length === 0) {
        return (
            <div className="team-standings-table">
                <div className="standings-empty">
                    <div className="empty-icon">📊</div>
                    <h4>Таблица недоступна</h4>
                    <p className="empty-reason">
                        {tournament?.status !== 'completed' 
                            ? 'Турнир еще не завершен' 
                            : 'Нет данных о участниках'}
                    </p>
                    <p className="empty-hint">
                        Турнир: {tournament?.name || 'ID ' + tournamentId}
                        <br />
                        Тип: {tournament?.participant_type || 'неизвестен'}
                        <br />
                        Формат: {tournament?.format || 'неизвестен'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="team-standings-table">
            <div className="standings-header">
                <h3>Квалификация</h3>
                <div className="standings-count">{standings.length} команд</div>
            </div>

            <div className="standings-list">
                {standings.map((team, index) => {
                    const medal = getMedalEmoji(team.placement);
                    const placement = getPlacementDisplay(team);

                    return (
                        <div 
                            key={team.team_id} 
                            className={`standings-row placement-${team.placement || 'unknown'}`}
                        >
                            <div className="standings-placement">
                                {medal ? (
                                    <span className="placement-medal">{medal}</span>
                                ) : (
                                    <span className="placement-text">{placement}</span>
                                )}
                            </div>

                            <div className="standings-team-info">
                                <div className="team-main">
                                    <div className="team-avatar">
                                        <img 
                                            src={ensureHttps(team.avatar_url || team.members?.[0]?.avatar_url) || '/default-avatar.png'}
                                            alt={team.team_name}
                                            onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                        />
                                    </div>
                                    <div className="team-name">
                                        {tournament?.participant_type === 'solo' ? (
                                            <Link to={`/user/${team.members?.[0]?.user_id}`}>
                                                {team.team_name}
                                            </Link>
                                        ) : (
                                            <span>{team.team_name}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Аватары участников (кликабельные) */}
                                {team.members && team.members.length > 0 && (
                                    <div className="team-members-avatars">
                                        {team.members.slice(0, 5).map((member, idx) => (
                                            <Link 
                                                key={idx}
                                                to={`/user/${member.user_id}`}
                                                className="member-avatar-link"
                                                title={member.name}
                                            >
                                                <div className="member-avatar">
                                                    <img 
                                                        src={ensureHttps(member.avatar_url) || '/default-avatar.png'}
                                                        alt={member.name}
                                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                                    />
                                                    {member.is_captain && (
                                                        <div className="captain-badge">👑</div>
                                                    )}
                                                </div>
                                            </Link>
                                        ))}
                                        {team.members.length > 5 && (
                                            <div className="member-avatar more-members">
                                                +{team.members.length - 5}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="standings-stats">
                                <div className="stat-item">
                                    <span className="stat-value win">{team.wins}</span>
                                    <span className="stat-label">W</span>
                                </div>
                                <div className="stat-divider">:</div>
                                <div className="stat-item">
                                    <span className="stat-value loss">{team.losses}</span>
                                    <span className="stat-label">L</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TeamStandingsTable;

