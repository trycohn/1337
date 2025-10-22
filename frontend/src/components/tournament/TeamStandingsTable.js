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

            // 🔍 Детальная диагностика аватаров
            if (response.data.standings) {
                response.data.standings.forEach((team, idx) => {
                    console.log(`🔍 [TeamStandings] Команда #${idx + 1}:`, {
                        name: team.team_name,
                        placement: team.placement,
                        avatar_url: team.avatar_url,
                        members_count: team.members?.length || 0,
                        has_members: !!team.members,
                        first_member: team.members?.[0],
                        roster_from_match: team.roster_from_match
                    });
                });
            }

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
                    
                    // 🔍 Диагностика для 4-го места
                    if (index === 3) {
                        console.log(`🔍 [TeamStandings] Команда #${index + 1}:`, {
                            team_name: team.team_name,
                            placement: team.placement,
                            placement_range: team.placement_range,
                            medal,
                            placement_display: placement
                        });
                    }

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
                                    <div className="team-name-wrapper">
                                        <div className="team-name">
                                            {tournament?.participant_type === 'solo' && !tournament?.format?.includes('mix') ? (
                                                // Чистые SOLO турниры - ссылка на игрока
                                                <Link to={`/user/${team.members?.[0]?.user_id}`}>
                                                    {team.team_name}
                                                </Link>
                                            ) : (
                                                // Mix и Team турниры - просто название
                                                <span>{team.team_name}</span>
                                            )}
                                        </div>
                                        {/* Метка для Mix команд */}
                                        {(tournament?.format === 'mix' || tournament?.format === 'full_mix') && (
                                            <div className="team-type-label">Mix Team</div>
                                        )}
                                    </div>
                                </div>

                                {/* Аватары участников (кликабельные) - показываем для ВСЕХ типов */}
                                {team.members && Array.isArray(team.members) && team.members.length > 0 && (
                                    <div className="team-members-avatars">
                                        {team.members.slice(0, 5).map((member, idx) => {
                                            // Проверка наличия данных
                                            if (!member || (!member.user_id && !member.name)) {
                                                console.warn(`⚠️ [TeamStandings] Пропущен некорректный member:`, member);
                                                return null;
                                            }

                                            // Если есть user_id - делаем ссылку, иначе просто аватар
                                            const avatarContent = (
                                                <div className="member-avatar">
                                                    <img 
                                                        src={ensureHttps(member.avatar_url) || '/default-avatar.png'}
                                                        alt={member.name || 'Player'}
                                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                                    />
                                                    {member.is_captain && (
                                                        <div className="captain-badge">👑</div>
                                                    )}
                                                </div>
                                            );

                                            return member.user_id ? (
                                                <Link 
                                                    key={idx}
                                                    to={`/user/${member.user_id}`}
                                                    className="member-avatar-link"
                                                    title={member.name}
                                                >
                                                    {avatarContent}
                                                </Link>
                                            ) : (
                                                <div key={idx} className="member-avatar-link" title={member.name}>
                                                    {avatarContent}
                                                </div>
                                            );
                                        })}
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

