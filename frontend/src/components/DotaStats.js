import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DotaStats.css';

const DotaStats = () => {
    const [activeTab, setActiveTab] = useState('search');
    const [playerStats, setPlayerStats] = useState(null);
    const [matchDetails, setMatchDetails] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [heroStats, setHeroStats] = useState([]);
    const [proMatches, setProMatches] = useState([]);
    const [distributions, setDistributions] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [steamId, setSteamId] = useState('');
    const [matchId, setMatchId] = useState('');

    const API_BASE = process.env.NODE_ENV === 'production' 
        ? 'https://1337community.com/api' 
        : 'http://localhost:3000/api';

    // Поиск игроков
    const searchPlayers = async () => {
        if (!searchQuery.trim()) return;
        
        setLoading(true);
        setError('');
        
        try {
            const response = await axios.get(`${API_BASE}/dota-stats/search/${encodeURIComponent(searchQuery)}`);
            setSearchResults(response.data);
        } catch (error) {
            setError('Ошибка поиска игроков: ' + error.response?.data?.error || error.message);
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    };

    // Получение статистики игрока
    const getPlayerStats = async (steamIdInput = null) => {
        const targetSteamId = steamIdInput || steamId;
        if (!targetSteamId.trim()) return;
        
        setLoading(true);
        setError('');
        
        try {
            const response = await axios.get(`${API_BASE}/dota-stats/player/${targetSteamId}`);
            setPlayerStats(response.data);
            setActiveTab('player');
        } catch (error) {
            setError('Ошибка получения статистики игрока: ' + error.response?.data?.error || error.message);
            setPlayerStats(null);
        } finally {
            setLoading(false);
        }
    };

    // Получение информации о матче
    const getMatchDetails = async () => {
        if (!matchId.trim()) return;
        
        setLoading(true);
        setError('');
        
        try {
            const response = await axios.get(`${API_BASE}/dota-stats/match/${matchId}`);
            setMatchDetails(response.data);
            setActiveTab('match');
        } catch (error) {
            setError('Ошибка получения информации о матче: ' + error.response?.data?.error || error.message);
            setMatchDetails(null);
        } finally {
            setLoading(false);
        }
    };

    // Загрузка статистики героев
    const loadHeroStats = async () => {
        setLoading(true);
        setError('');
        
        try {
            const response = await axios.get(`${API_BASE}/dota-stats/heroes`);
            setHeroStats(response.data);
        } catch (error) {
            setError('Ошибка получения статистики героев: ' + error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    // Загрузка профессиональных матчей
    const loadProMatches = async () => {
        setLoading(true);
        setError('');
        
        try {
            const response = await axios.get(`${API_BASE}/dota-stats/pro-matches`);
            setProMatches(response.data);
        } catch (error) {
            setError('Ошибка получения профессиональных матчей: ' + error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    // Загрузка распределения рангов
    const loadDistributions = async () => {
        setLoading(true);
        setError('');
        
        try {
            const response = await axios.get(`${API_BASE}/dota-stats/distributions`);
            setDistributions(response.data);
        } catch (error) {
            setError('Ошибка получения распределения рангов: ' + error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    // Форматирование времени
    const formatTime = (timestamp) => {
        return new Date(timestamp * 1000).toLocaleString('ru-RU');
    };

    // Форматирование длительности матча
    const formatDuration = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    // Получение названия ранга
    const getRankName = (rankTier) => {
        const ranks = {
            11: 'Herald 1', 12: 'Herald 2', 13: 'Herald 3', 14: 'Herald 4', 15: 'Herald 5',
            21: 'Guardian 1', 22: 'Guardian 2', 23: 'Guardian 3', 24: 'Guardian 4', 25: 'Guardian 5',
            31: 'Crusader 1', 32: 'Crusader 2', 33: 'Crusader 3', 34: 'Crusader 4', 35: 'Crusader 5',
            41: 'Archon 1', 42: 'Archon 2', 43: 'Archon 3', 44: 'Archon 4', 45: 'Archon 5',
            51: 'Legend 1', 52: 'Legend 2', 53: 'Legend 3', 54: 'Legend 4', 55: 'Legend 5',
            61: 'Ancient 1', 62: 'Ancient 2', 63: 'Ancient 3', 64: 'Ancient 4', 65: 'Ancient 5',
            71: 'Divine 1', 72: 'Divine 2', 73: 'Divine 3', 74: 'Divine 4', 75: 'Divine 5',
            80: 'Immortal'
        };
        return ranks[rankTier] || 'Unknown';
    };

    // Добавляем функцию для получения URL картинки ранга после функции getRankName
    const getRankImageUrl = (rankTier) => {
        if (!rankTier) return '/default-rank.png';
        
        // Определение основного ранга (первая цифра)
        const mainRank = Math.floor(rankTier / 10);
        // Определение звезды (вторая цифра)
        const stars = rankTier % 10;
        
        // Массив названий рангов
        const rankNames = {
            1: 'herald',
            2: 'guardian',
            3: 'crusader',
            4: 'archon',
            5: 'legend',
            6: 'ancient',
            7: 'divine',
            8: 'immortal'
        };
        
        const rankName = rankNames[mainRank] || 'unranked';
        
        // Для Immortal ранга (80) не отображаем звезды
        if (mainRank === 8) {
            return `https://www.opendota.com/assets/images/dota2/rank_icons/${rankName}.png`;
        }
        
        return `https://www.opendota.com/assets/images/dota2/rank_icons/${rankName}_${stars}.png`;
    };

    return (
        <div className="dota-stats">
            <div className="dota-stats-header">
                <h2>📊 Статистика Dota 2</h2>
                <p>Данные предоставлены STRATZ API</p>
            </div>

            <div className="dota-stats-tabs">
                <button 
                    className={`tab ${activeTab === 'search' ? 'active' : ''}`}
                    onClick={() => setActiveTab('search')}
                >
                    🔍 Поиск игроков
                </button>
                <button 
                    className={`tab ${activeTab === 'player' ? 'active' : ''}`}
                    onClick={() => setActiveTab('player')}
                >
                    👤 Статистика игрока
                </button>
                <button 
                    className={`tab ${activeTab === 'match' ? 'active' : ''}`}
                    onClick={() => setActiveTab('match')}
                >
                    ⚔️ Информация о матче
                </button>
                <button 
                    className={`tab ${activeTab === 'heroes' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('heroes');
                        if (heroStats.length === 0) loadHeroStats();
                    }}
                >
                    🦸 Статистика героев
                </button>
                <button 
                    className={`tab ${activeTab === 'pro' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('pro');
                        if (proMatches.length === 0) loadProMatches();
                    }}
                >
                    🏆 Про-матчи
                </button>
                <button 
                    className={`tab ${activeTab === 'ranks' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('ranks');
                        if (!distributions) loadDistributions();
                    }}
                >
                    🏅 Распределение рангов
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading">Загрузка...</div>}

            {/* Поиск игроков */}
            {activeTab === 'search' && (
                <div className="search-section">
                    <h3>Поиск игроков</h3>
                    <div className="search-form">
                        <input
                            type="text"
                            placeholder="Введите ник игрока"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchPlayers()}
                        />
                        <button onClick={searchPlayers} disabled={loading}>
                            Найти
                        </button>
                    </div>
                    
                    {searchResults.length > 0 && (
                        <div className="search-results">
                            <h4>Результаты поиска:</h4>
                            {searchResults.map((player, index) => (
                                <div key={index} className="search-result-item">
                                    <img src={player.avatar} alt="Avatar" className="player-avatar" />
                                    <div className="player-info">
                                        <strong>{player.personaname}</strong>
                                        <p>Account ID: {player.account_id}</p>
                                        <p>Последний матч: {player.last_match_time ? formatTime(player.last_match_time) : 'Неизвестно'}</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            // Конвертируем account_id в steam_id
                                            const steamId64 = (BigInt(player.account_id) + BigInt('76561197960265728')).toString();
                                            getPlayerStats(steamId64);
                                        }}
                                    >
                                        Посмотреть статистику
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Статистика игрока */}
            {activeTab === 'player' && (
                <div className="player-section">
                    <h3>Статистика игрока</h3>
                    <div className="player-form">
                        <input
                            type="text"
                            placeholder="Введите Steam ID"
                            value={steamId}
                            onChange={(e) => setSteamId(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && getPlayerStats()}
                        />
                        <button onClick={() => getPlayerStats()} disabled={loading}>
                            Получить статистику
                        </button>
                    </div>

                    {playerStats && (
                        <div className="player-stats">
                            <div className="player-profile">
                                <img src={playerStats.profile.avatarfull} alt="Avatar" className="player-avatar-large" />
                                <div className="profile-info">
                                    <h4>{playerStats.profile.personaname}</h4>
                                    <p>Account ID: {playerStats.profile.account_id}</p>
                                    <p className="rank-info">
                                        <span>Ранг:</span>
                                        <img 
                                            src={getRankImageUrl(playerStats.profile.rank_tier)} 
                                            alt={`Rank ${playerStats.profile.rank_tier}`}
                                            className="rank-icon"
                                            onError={(e) => {
                                                e.target.src = '/default-rank.png';
                                            }}
                                        />
                                        <span>
                                            {playerStats.profile.rank_tier ? getRankName(playerStats.profile.rank_tier) : 'Неизвестно'}
                                            {(() => {
                                                // Определяем MMR из различных источников
                                                let mmrValue = null;
                                                let mmrSource = null;
                                                
                                                // Отладочная информация
                                                console.log('🎯 DotaStats MMR данные:', {
                                                    solo_competitive_rank: playerStats.profile?.solo_competitive_rank,
                                                    competitive_rank: playerStats.profile?.competitive_rank,
                                                    mmr_estimate: playerStats.profile?.mmr_estimate,
                                                    mmr_source: playerStats.profile?.mmr_source,
                                                    leaderboard_rank: playerStats.profile?.leaderboard_rank,
                                                    profile: playerStats.profile
                                                });
                                                
                                                // Приоритет 1: solo_competitive_rank
                                                if (playerStats.profile.solo_competitive_rank && playerStats.profile.solo_competitive_rank > 0) {
                                                    mmrValue = playerStats.profile.solo_competitive_rank;
                                                    mmrSource = 'solo_competitive_rank';
                                                } 
                                                // Приоритет 2: competitive_rank
                                                else if (playerStats.profile.competitive_rank && playerStats.profile.competitive_rank > 0) {
                                                    mmrValue = playerStats.profile.competitive_rank;
                                                    mmrSource = 'competitive_rank';
                                                } 
                                                // Приоритет 3: mmr_estimate
                                                else if (playerStats.profile.mmr_estimate) {
                                                    if (typeof playerStats.profile.mmr_estimate === 'object' && playerStats.profile.mmr_estimate.estimate) {
                                                        mmrValue = playerStats.profile.mmr_estimate.estimate;
                                                        mmrSource = 'mmr_estimate.estimate';
                                                    } else if (typeof playerStats.profile.mmr_estimate === 'number' && playerStats.profile.mmr_estimate > 0) {
                                                        mmrValue = playerStats.profile.mmr_estimate;
                                                        mmrSource = 'mmr_estimate';
                                                    }
                                                }
                                                // Приоритет 4: leaderboard_rank для очень высоких MMR
                                                else if (playerStats.profile.leaderboard_rank && playerStats.profile.leaderboard_rank > 0) {
                                                    mmrValue = 5500 + Math.round((1000 - playerStats.profile.leaderboard_rank) * 10);
                                                    mmrSource = 'leaderboard_rank_estimate';
                                                }
                                                
                                                console.log('🎯 DotaStats результат MMR:', { mmrValue, mmrSource });
                                                
                                                // Отображаем MMR в скобках рядом с названием ранга
                                                if (mmrValue && typeof mmrValue === 'number' && mmrValue > 0) {
                                                    const mmrText = mmrSource === 'leaderboard_rank_estimate' ? 
                                                        ` (~${Math.round(mmrValue)} MMR)` : 
                                                        ` (${Math.round(mmrValue)} MMR)`;
                                                    return mmrText;
                                                }
                                                
                                                return '';
                                            })()}
                                        </span>
                                    </p>
                                    {playerStats.profile.leaderboard_rank && (
                                        <p>Место в рейтинге: #{playerStats.profile.leaderboard_rank}</p>
                                    )}
                                </div>
                            </div>

                            <div className="stats-overview">
                                <h4>Общая статистика</h4>
                                <div className="stats-grid">
                                    <div className="stat-item">
                                        <span className="stat-label">Всего матчей:</span>
                                        <span className="stat-value">{playerStats.stats.total_matches || 0}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Побед:</span>
                                        <span className="stat-value">{playerStats.stats.win}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Поражений:</span>
                                        <span className="stat-value">{playerStats.stats.lose}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Винрейт:</span>
                                        <span className="stat-value">{playerStats.stats.winrate}%</span>
                                    </div>
                                    {playerStats.profile.behavior_score && (
                                        <div className="stat-item">
                                            <span className="stat-label">Поведенческий рейтинг:</span>
                                            <span className="stat-value">{playerStats.profile.behavior_score}</span>
                                        </div>
                                    )}
                                    {playerStats.stats.mvp_count > 0 && (
                                        <div className="stat-item">
                                            <span className="stat-label">MVP наград:</span>
                                            <span className="stat-value">{playerStats.stats.mvp_count}</span>
                                        </div>
                                    )}
                                    {playerStats.stats.top_core_count > 0 && (
                                        <div className="stat-item">
                                            <span className="stat-label">Лучший керри:</span>
                                            <span className="stat-value">{playerStats.stats.top_core_count}</span>
                                        </div>
                                    )}
                                    {playerStats.stats.top_support_count > 0 && (
                                        <div className="stat-item">
                                            <span className="stat-label">Лучший саппорт:</span>
                                            <span className="stat-value">{playerStats.stats.top_support_count}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="recent-matches">
                                <h4>Последние матчи</h4>
                                <div className="matches-list">
                                    {playerStats.recent_matches.map((match, index) => (
                                        <div key={index} className={`match-item ${match.win ? 'win' : 'loss'}`}>
                                            <div className="match-hero">Hero ID: {match.hero_id}</div>
                                            <div className="match-kda">{match.kills}/{match.deaths}/{match.assists}</div>
                                            <div className="match-gpm-xpm">
                                                {match.gold_per_min && match.xp_per_min && (
                                                    <>GPM: {match.gold_per_min}, XPM: {match.xp_per_min}</>
                                                )}
                                            </div>
                                            <div className="match-duration">{formatDuration(match.duration)}</div>
                                            <div className="match-result">{match.win ? 'Победа' : 'Поражение'}</div>
                                            <div className="match-time">{formatTime(match.start_time)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="top-heroes">
                                <h4>Топ героев</h4>
                                <div className="heroes-list">
                                    {playerStats.top_heroes.map((hero, index) => (
                                        <div key={index} className="hero-item">
                                            <div className="hero-name">Hero ID: {hero.hero_id}</div>
                                            <div className="hero-games">Игр: {hero.games}</div>
                                            <div className="hero-winrate">Винрейт: {hero.winrate}%</div>
                                            {hero.avg_kills && (
                                                <div className="hero-avg-stats">
                                                    Сред. K/D/A: {hero.avg_kills}/{hero.avg_deaths}/{hero.avg_assists}
                                                </div>
                                            )}
                                            {hero.avg_gpm && hero.avg_xpm && (
                                                <div className="hero-avg-economy">
                                                    GPM: {hero.avg_gpm}, XPM: {hero.avg_xpm}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Информация о матче */}
            {activeTab === 'match' && (
                <div className="match-section">
                    <h3>Информация о матче</h3>
                    <div className="match-form">
                        <input
                            type="text"
                            placeholder="Введите ID матча"
                            value={matchId}
                            onChange={(e) => setMatchId(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && getMatchDetails()}
                        />
                        <button onClick={getMatchDetails} disabled={loading}>
                            Получить информацию
                        </button>
                    </div>

                    {matchDetails && (
                        <div className="match-details">
                            <div className="match-header">
                                <h4>Матч #{matchDetails.match_id}</h4>
                                <p>Длительность: {formatDuration(matchDetails.duration)}</p>
                                <p>Время начала: {formatTime(matchDetails.start_time)}</p>
                                <p>Победитель: {matchDetails.radiant_win ? 'Radiant' : 'Dire'}</p>
                            </div>

                            <div className="teams-scores">
                                <div className="team radiant">
                                    <h5>Radiant: {matchDetails.radiant_team.score}</h5>
                                </div>
                                <div className="team dire">
                                    <h5>Dire: {matchDetails.dire_team.score}</h5>
                                </div>
                            </div>

                            <div className="players-table">
                                <h4>Игроки</h4>
                                <div className="players-grid">
                                    {matchDetails.players.map((player, index) => (
                                        <div key={index} className={`player-row ${player.is_radiant ? 'radiant' : 'dire'}`}>
                                            <div className="player-info">
                                                {player.avatar && (
                                                    <img src={player.avatar} alt="Avatar" className="player-mini-avatar" />
                                                )}
                                                <div className="player-name">{player.personaname || 'Anonymous'}</div>
                                            </div>
                                            <div className="player-hero">Hero ID: {player.hero_id}</div>
                                            <div className="player-position">
                                                {player.position && `Pos ${player.position}`}
                                            </div>
                                            <div className="player-kda">{player.kills}/{player.deaths}/{player.assists}</div>
                                            <div className="player-cs">{player.last_hits}/{player.denies}</div>
                                            <div className="player-gpm-xpm">
                                                GPM: {player.gold_per_min} | XPM: {player.xp_per_min}
                                            </div>
                                            <div className="player-net-worth">{player.net_worth ? `${player.net_worth} золота` : 'N/A'}</div>
                                            <div className="player-damage">
                                                Урон: {player.hero_damage || 0}
                                            </div>
                                            {player.stats && (
                                                <div className="player-extended-stats">
                                                    {player.stats.wards_placed > 0 && (
                                                        <span>Варды: {player.stats.wards_placed}</span>
                                                    )}
                                                    {player.stats.creeps_stacked > 0 && (
                                                        <span>Стаки: {player.stats.creeps_stacked}</span>
                                                    )}
                                                    {player.stats.rune_pickup_count > 0 && (
                                                        <span>Руны: {player.stats.rune_pickup_count}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                
                                {matchDetails.win_rates && (
                                    <div className="match-predictions">
                                        <h5>Прогноз победы на начало матча:</h5>
                                        <p>Radiant: {(matchDetails.win_rates.radiantWinRate * 100).toFixed(1)}%</p>
                                        <p>Dire: {(matchDetails.win_rates.direWinRate * 100).toFixed(1)}%</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Статистика героев */}
            {activeTab === 'heroes' && (
                <div className="heroes-section">
                    <h3>Статистика героев в профессиональных матчах (STRATZ)</h3>
                    <div className="heroes-table">
                        {heroStats.slice(0, 30).map((hero, index) => (
                            <div key={index} className="hero-stat-item">
                                <div className="hero-name">{hero.name || hero.short_name}</div>
                                <div className="hero-meta-info">
                                    <span className="primary-attr">Осн. атрибут: {hero.primary_attr}</span>
                                    <span className="attack-type">{hero.attack_type}</span>
                                </div>
                                <div className="hero-stats">
                                    <span>Всего матчей: {hero.total_matches}</span>
                                    <span>Пики: {hero.pro_pick}</span>
                                    <span>Победы: {hero.pro_win}</span>
                                    <span>Баны: {hero.pro_ban}</span>
                                    <span>Винрейт: {hero.win_rate}%</span>
                                    <span>Пик-рейт: {hero.pick_rate}%</span>
                                    <span>Бан-рейт: {hero.ban_rate}%</span>
                                </div>
                                {hero.roles && hero.roles.length > 0 && (
                                    <div className="hero-roles">
                                        Роли: {hero.roles.join(', ')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Профессиональные матчи */}
            {activeTab === 'pro' && (
                <div className="pro-matches-section">
                    <h3>Последние профессиональные матчи (STRATZ)</h3>
                    <div className="pro-matches-list">
                        {proMatches.slice(0, 25).map((match, index) => (
                            <div key={index} className="pro-match-item">
                                <div className="match-teams">
                                    <span className={match.radiant_win ? 'winner' : ''}>{match.radiant_name || 'Radiant'}</span>
                                    <span className="vs">VS</span>
                                    <span className={!match.radiant_win ? 'winner' : ''}>{match.dire_name || 'Dire'}</span>
                                </div>
                                <div className="match-score">
                                    {match.radiant_score} - {match.dire_score}
                                </div>
                                <div className="match-meta">
                                    <div className="match-league">
                                        {match.league_name}
                                        {match.league_tier && (
                                            <span className="league-tier"> (Tier {match.league_tier})</span>
                                        )}
                                    </div>
                                    {match.series_type && (
                                        <div className="series-type">Серия: {match.series_type}</div>
                                    )}
                                    <div className="match-duration">Длительность: {formatDuration(match.duration)}</div>
                                </div>
                                <div className="match-time">{formatTime(match.start_time)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Распределение рангов */}
            {activeTab === 'ranks' && distributions && (
                <div className="distributions-section">
                    <h3>Распределение рангов</h3>
                    {distributions.ranks && (
                        <div className="ranks-distribution">
                            <h4>Распределение по рангам</h4>
                            <div className="ranks-chart">
                                {distributions.ranks.rows.map((rank, index) => (
                                    <div key={index} className="rank-bar">
                                        <div className="rank-label">{rank.bin_name}</div>
                                        <div className="rank-percentage">{(rank.game_count / distributions.ranks.sum * 100).toFixed(2)}%</div>
                                        <div className="rank-count">{rank.game_count} игроков</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DotaStats; 