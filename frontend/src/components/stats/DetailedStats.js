/**
 * 📊 DETAILED STATS COMPONENT
 * Детальная статистика игрока с MatchZy данными
 * 
 * @version 2.0.0
 * @date 2025-10-02
 */

import React, { useState, useEffect } from 'react';
import api from '../../axios';
import './DetailedStats.css';

function DetailedStats({ userId }) {
    const [stats, setStats] = useState(null);
    const [recentMatches, setRecentMatches] = useState([]);
    const [mapStats, setMapStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('overview'); // overview, maps, weapons, recent
    
    useEffect(() => {
        loadAllStats();
    }, [userId]);
    
    const loadAllStats = async () => {
        setLoading(true);
        try {
            const [statsRes, recentRes, mapsRes] = await Promise.all([
                api.get(`/api/player-stats/player/${userId}`),
                api.get(`/api/player-stats/player/${userId}/recent?limit=10`),
                api.get(`/api/player-stats/player/${userId}/maps`)
            ]);
            
            if (statsRes.data.success) setStats(statsRes.data.stats);
            if (recentRes.data.success) setRecentMatches(recentRes.data.matches);
            if (mapsRes.data.success) setMapStats(mapsRes.data.maps);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
        } finally {
            setLoading(false);
        }
    };
    
    if (loading) {
        return <div className="detailed-stats-loading">Загрузка статистики...</div>;
    }
    
    if (!stats || stats.total_matches === 0) {
        return (
            <div className="detailed-stats-empty">
                <div className="empty-icon">📊</div>
                <h3>Пока нет детальной статистики</h3>
                <p>Сыграйте матчи на серверах с MatchZy для сбора детальной статистики</p>
            </div>
        );
    }
    
    return (
        <div className="detailed-stats-container">
            {/* Навигация */}
            <div className="stats-nav">
                <button 
                    className={activeView === 'overview' ? 'active' : ''}
                    onClick={() => setActiveView('overview')}
                >
                    Обзор
                </button>
                <button 
                    className={activeView === 'maps' ? 'active' : ''}
                    onClick={() => setActiveView('maps')}
                >
                    Карты
                </button>
                <button 
                    className={activeView === 'weapons' ? 'active' : ''}
                    onClick={() => setActiveView('weapons')}
                >
                    Оружие
                </button>
                <button 
                    className={activeView === 'recent' ? 'active' : ''}
                    onClick={() => setActiveView('recent')}
                >
                    История
                </button>
            </div>
            
            {/* Overview */}
            {activeView === 'overview' && (
                <div className="stats-overview">
                    <h3>Общая статистика</h3>
                    <p className="stats-subtitle">{stats.total_matches} матчей сыграно</p>
                    
                    {/* Основные метрики */}
                    <div className="stats-grid">
                        <div className="stat-card-detailed">
                            <div className="stat-label">K/D Ratio</div>
                            <div className="stat-value">{stats.kd_ratio?.toFixed(2) || 0}</div>
                            <div className="stat-breakdown">
                                {stats.total_kills} / {stats.total_deaths}
                            </div>
                        </div>
                        
                        <div className="stat-card-detailed">
                            <div className="stat-label">ADR</div>
                            <div className="stat-value">{stats.avg_adr?.toFixed(1) || 0}</div>
                            <div className="stat-breakdown">Average Damage</div>
                        </div>
                        
                        <div className="stat-card-detailed">
                            <div className="stat-label">HS%</div>
                            <div className="stat-value">{stats.avg_hs_percentage?.toFixed(1) || 0}%</div>
                            <div className="stat-breakdown">
                                {stats.total_headshots} / {stats.total_kills}
                            </div>
                        </div>
                        
                        <div className="stat-card-detailed">
                            <div className="stat-label">Rating</div>
                            <div className="stat-value">{stats.avg_rating?.toFixed(2) || 0}</div>
                            <div className="stat-breakdown">HLTV 2.0</div>
                        </div>
                        
                        <div className="stat-card-detailed">
                            <div className="stat-label">Win Rate</div>
                            <div className="stat-value">{stats.win_rate?.toFixed(0) || 0}%</div>
                            <div className="stat-breakdown">
                                {stats.total_wins}W - {stats.total_losses}L
                            </div>
                        </div>
                        
                        <div className="stat-card-detailed">
                            <div className="stat-label">KAST</div>
                            <div className="stat-value">{stats.avg_kast?.toFixed(1) || 0}%</div>
                            <div className="stat-breakdown">Kill/Assist/Survive/Trade</div>
                        </div>
                        
                        <div className="stat-card-detailed">
                            <div className="stat-label">Clutch</div>
                            <div className="stat-value">{stats.clutch_success_rate?.toFixed(0) || 0}%</div>
                            <div className="stat-breakdown">
                                {stats.total_clutch_won} / {stats.total_clutch_total}
                            </div>
                        </div>
                        
                        <div className="stat-card-detailed">
                            <div className="stat-label">MVP</div>
                            <div className="stat-value">{stats.mvp_rate?.toFixed(0) || 0}%</div>
                            <div className="stat-breakdown">
                                {stats.total_mvp} MVP's
                            </div>
                        </div>
                    </div>
                    
                    {/* Продвинутые метрики */}
                    <div className="stats-advanced">
                        <h4>Продвинутая статистика</h4>
                        <div className="stats-row">
                            <div className="stats-col">
                                <span className="metric-label">Entry Success:</span>
                                <span className="metric-value">{stats.entry_success_rate?.toFixed(0) || 0}%</span>
                                <span className="metric-detail">
                                    ({stats.total_entry_kills} kills / {stats.total_entry_deaths} deaths)
                                </span>
                            </div>
                            
                            <div className="stats-col">
                                <span className="metric-label">Opening Duels:</span>
                                <span className="metric-value">{stats.opening_duel_success_rate?.toFixed(0) || 0}%</span>
                                <span className="metric-detail">
                                    ({stats.total_opening_kills}W / {stats.total_opening_deaths}L)
                                </span>
                            </div>
                            
                            <div className="stats-col">
                                <span className="metric-label">Flash Assists:</span>
                                <span className="metric-value">{stats.total_flash_assists || 0}</span>
                                <span className="metric-detail">
                                    ({(stats.total_flash_assists / stats.total_matches || 0).toFixed(1)} per match)
                                </span>
                            </div>
                            
                            <div className="stats-col">
                                <span className="metric-label">Utility Damage:</span>
                                <span className="metric-value">{stats.avg_utility_damage_per_round?.toFixed(0) || 0}</span>
                                <span className="metric-detail">per round</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Maps */}
            {activeView === 'maps' && (
                <div className="stats-maps">
                    <h3>Статистика по картам</h3>
                    
                    {mapStats.length === 0 ? (
                        <div className="stats-empty">Нет данных по картам</div>
                    ) : (
                        <div className="maps-grid">
                            {mapStats.map(map => (
                                <div key={map.map_name} className="map-stat-card">
                                    <div className="map-header">
                                        <h4>{map.map_name.replace('de_', '').toUpperCase()}</h4>
                                        <span className="map-matches">{map.matches_played} матчей</span>
                                    </div>
                                    
                                    <div className="map-winrate">
                                        <div className="winrate-bar">
                                            <div 
                                                className="winrate-fill"
                                                style={{width: `${map.win_rate}%`}}
                                            />
                                        </div>
                                        <span className="winrate-text">
                                            {map.wins}W - {map.losses}L ({map.win_rate?.toFixed(0)}%)
                                        </span>
                                    </div>
                                    
                                    <div className="map-stats-row">
                                        <div>
                                            <span className="map-stat-label">K/D</span>
                                            <span className="map-stat-value">{map.kd_ratio?.toFixed(2)}</span>
                                        </div>
                                        <div>
                                            <span className="map-stat-label">ADR</span>
                                            <span className="map-stat-value">{map.avg_adr?.toFixed(0)}</span>
                                        </div>
                                        <div>
                                            <span className="map-stat-label">Rating</span>
                                            <span className="map-stat-value">{map.avg_rating?.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    
                                    {map.t_side_rounds > 0 && (
                                        <div className="map-sides">
                                            <div className="side-stat">
                                                <span>T: {((map.t_side_wins / map.t_side_rounds) * 100).toFixed(0)}% WR</span>
                                            </div>
                                            <div className="side-stat">
                                                <span>CT: {((map.ct_side_wins / map.ct_side_rounds) * 100).toFixed(0)}% WR</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {/* Weapons */}
            {activeView === 'weapons' && (
                <div className="stats-weapons">
                    <h3>Статистика по оружию</h3>
                    
                    {!stats.weapon_stats || Object.keys(stats.weapon_stats).length === 0 ? (
                        <div className="stats-empty">Нет данных по оружию</div>
                    ) : (
                        <div className="weapons-list">
                            {Object.entries(stats.weapon_stats)
                                .sort((a, b) => (b[1].kills || 0) - (a[1].kills || 0))
                                .slice(0, 10)
                                .map(([weapon, weaponStats]) => (
                                    <div key={weapon} className="weapon-card">
                                        <div className="weapon-name">{weapon.toUpperCase()}</div>
                                        <div className="weapon-stats-grid">
                                            <div>
                                                <span className="weapon-label">Kills</span>
                                                <span className="weapon-value">{weaponStats.kills || 0}</span>
                                            </div>
                                            <div>
                                                <span className="weapon-label">HS</span>
                                                <span className="weapon-value">{weaponStats.headshots || 0}</span>
                                            </div>
                                            <div>
                                                <span className="weapon-label">HS%</span>
                                                <span className="weapon-value">
                                                    {weaponStats.kills > 0 
                                                        ? ((weaponStats.headshots / weaponStats.kills) * 100).toFixed(0)
                                                        : 0}%
                                                </span>
                                            </div>
                                            <div>
                                                <span className="weapon-label">Damage</span>
                                                <span className="weapon-value">{weaponStats.damage || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            )}
            
            {/* Recent Matches */}
            {activeView === 'recent' && (
                <div className="stats-recent">
                    <h3>Последние матчи</h3>
                    
                    {recentMatches.length === 0 ? (
                        <div className="stats-empty">Нет данных</div>
                    ) : (
                        <div className="recent-matches-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Дата</th>
                                        <th>Карта</th>
                                        <th>Результат</th>
                                        <th>K/D/A</th>
                                        <th>ADR</th>
                                        <th>HS%</th>
                                        <th>Rating</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentMatches.map((match) => (
                                        <tr key={match.id} className={match.won ? 'won' : 'lost'}>
                                            <td>{new Date(match.match_date).toLocaleDateString('ru-RU')}</td>
                                            <td>{match.map_name?.replace('de_', '') || '-'}</td>
                                            <td>
                                                <span className={`result-badge ${match.won ? 'win' : 'loss'}`}>
                                                    {match.won ? 'Победа' : 'Поражение'}
                                                </span>
                                            </td>
                                            <td>{match.kills}/{match.deaths}/{match.assists}</td>
                                            <td>{match.adr?.toFixed(0) || 0}</td>
                                            <td>{match.hs_percentage?.toFixed(0) || 0}%</td>
                                            <td className={match.rating > 1.0 ? 'good' : 'bad'}>
                                                {match.rating?.toFixed(2) || 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DetailedStats;

