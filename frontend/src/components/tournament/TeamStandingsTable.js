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

            if (response.data.success) {
                console.log(`📊 [TeamStandings] Получено ${response.data.standings.length} команд`);
                setStandings(response.data.standings);
            }

        } catch (error) {
            console.error(`❌ [TeamStandings] Ошибка загрузки:`, error);
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
                    <p>Нет данных о командах</p>
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
                                            src={ensureHttps(team.avatar_url) || '/default-avatar.png'}
                                            alt={team.team_name}
                                            onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                        />
                                    </div>
                                    <div className="team-name">
                                        <Link to={`/teams/${team.team_id}`}>
                                            {team.team_name}
                                        </Link>
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

