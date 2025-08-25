import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ensureHttps } from '../../utils/userHelpers';
import { getParticipantInfo } from '../../utils/participantHelpers';
import MatchMetaTags from '../SEO/MatchMetaTags';
import MatchShareModal from './modals/MatchShareModal';
import './MatchDetailsPage.css';

/**
 * 📋 СТРАНИЦА ДЕТАЛЕЙ МАТЧА (HLTV Style)
 * Современная страница с подробной информацией о матче
 * @version 2.0
 */
const MatchDetailsPage = () => {
    const { tournamentId, matchId } = useParams();
    const navigate = useNavigate();
    const [match, setMatch] = useState(null);
    const [tournament, setTournament] = useState(null);
    const [teamHistory, setTeamHistory] = useState({ team1: [], team2: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    useEffect(() => {
        fetchMatchDetails();
    }, [tournamentId, matchId]);

    const fetchMatchDetails = async () => {
        try {
            setLoading(true);
            
            // Получаем данные матча и турнира (публичные роуты)
            const [matchResponse, tournamentResponse] = await Promise.all([
                fetch(`/api/tournaments/${tournamentId}/match/${matchId}`),
                fetch(`/api/tournaments/${tournamentId}`)
            ]);

            if (!matchResponse.ok || !tournamentResponse.ok) {
                throw new Error('Не удалось загрузить данные матча');
            }

            const matchData = await matchResponse.json();
            const tournamentData = await tournamentResponse.json();
            
            // Новый публичный роут возвращает данные в поле data
            const matchInfo = matchData.data || matchData;
            const tournamentInfo = tournamentData.data || tournamentData;
            
            setMatch(matchInfo);
            setTournament(tournamentInfo);
            
            // Загружаем историю матчей команд
            if (matchInfo.team1_id && matchInfo.team2_id) {
                await fetchTeamHistory(matchInfo.team1_id, matchInfo.team2_id);
            }
        } catch (err) {
            console.error('Ошибка загрузки деталей матча:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeamHistory = async (team1Id, team2Id) => {
        try {
            const [team1History, team2History] = await Promise.all([
                fetch(`/api/teams/${team1Id}/matches?limit=5`).then(r => r.ok ? r.json() : { data: [] }),
                fetch(`/api/teams/${team2Id}/matches?limit=5`).then(r => r.ok ? r.json() : { data: [] })
            ]);
            
            setTeamHistory({
                team1: team1History.data || [],
                team2: team2History.data || []
            });
        } catch (err) {
            console.error('Ошибка загрузки истории команд:', err);
            // Не критично, продолжаем без истории
        }
    };

    const getTeamLogo = (team) => {
        if (!team) return '/default-avatar.png';
        return team.avatar_url || team.logo_url || '/default-avatar.png';
    };

    const getMapImage = (mapName) => {
        // Возвращаем изображение карты или заглушку
        const mapImages = {
            'dust2': '/images/maps/dust2.jpg',
            'mirage': '/images/maps/mirage.jpg',
            'inferno': '/images/maps/inferno.jpg',
            'nuke': '/images/maps/nuke.jpg',
            'overpass': '/images/maps/overpass.jpg',
            'vertigo': '/images/maps/vertigo.jpg',
            'ancient': '/images/maps/ancient.jpg',
            'anubis': '/images/maps/anubis.jpg',
            'train': '/images/maps/train.jpg',
            'de_train': '/images/maps/train.jpg'
        };
        return mapImages[mapName?.toLowerCase()] || '/images/maps/default.jpg';
    };

    const getMatchStatusClass = (status) => {
        const statusClasses = {
            'scheduled': 'status-scheduled',
            'live': 'status-live',
            'completed': 'status-completed',
            'cancelled': 'status-cancelled'
        };
        return statusClasses[status] || 'status-default';
    };

    const getMatchStatusText = (status) => {
        const statusTexts = {
            'scheduled': 'Запланирован',
            'live': 'LIVE',
            'completed': 'Завершен',
            'cancelled': 'Отменен'
        };
        return statusTexts[status] || status;
    };

    const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    function normalizeMapName(raw) {
        if (!raw) return '';
        let name = String(raw).toLowerCase().trim();
        name = name.replace(/^de[_\-\s]?/, ''); // убираем префикс de_
        name = name.replace(/\s+/g, ' ').trim();
        // Нормализация часто встречающихся вариантов
        if (name.includes('dust')) return 'dust2';
        if (name.includes('mirage')) return 'mirage';
        if (name.includes('inferno')) return 'inferno';
        if (name.includes('nuke')) return 'nuke';
        if (name.includes('overpass')) return 'overpass';
        if (name.includes('vertigo')) return 'vertigo';
        if (name.includes('ancient')) return 'ancient';
        if (name.includes('anubis')) return 'anubis';
        return name.replace(/\s|\-/g, '');
    }

    const renderMapPool = () => {
        // 1) Согласованный маппул турнира (приоритетный список для сетки)
        const agreedPool = Array.isArray(match.available_maps)
            ? match.available_maps.map(m => normalizeMapName(m)).filter(Boolean)
            : [];

        // 2) Сыгранные карты из результата матча
        const mapsDataRaw = match.maps_data;
        const hasMapsDataRaw = Array.isArray(mapsDataRaw) && mapsDataRaw.length > 0;
        
        // Создаем Map для быстрого поиска данных о сыгранных картах
        const playedMapsData = new Map();
        if (hasMapsDataRaw) {
            mapsDataRaw.forEach(mapInfo => {
                // Поддерживаем разные форматы полей
                const mapName = normalizeMapName(mapInfo.map_name || mapInfo.mapName || mapInfo.name || mapInfo.map || '');
                const team1Score = mapInfo.team1_score !== undefined ? mapInfo.team1_score : (mapInfo.score1 || 0);
                const team2Score = mapInfo.team2_score !== undefined ? mapInfo.team2_score : (mapInfo.score2 || 0);
                
                if (mapName) {
                    playedMapsData.set(mapName, {
                        team1_score: team1Score,
                        team2_score: team2Score
                    });
                }
            });
        }

        // 3) Итоговый список карт для отображения: берем согласованный, иначе дефолтный пул CS2
        const fallbackPool = ['dust2', 'mirage', 'inferno', 'nuke', 'overpass', 'vertigo', 'ancient'];
        const displayPool = (agreedPool.length > 0 ? agreedPool : fallbackPool);
        
        return (
            <div className="match-map-pool">
                <h3 className="section-title">🗺️ Карты</h3>
                <div className="map-pool-grid">
                    {displayPool.map(rawName => {
                        const mapKey = normalizeMapName(rawName);
                        const mapData = playedMapsData.get(mapKey);
                        const isPlayed = playedMapsData.has(mapKey);
                        
                        return (
                            <div key={mapKey} className={`map-card ${isPlayed ? 'map-played' : 'map-not-played'}`}>
                                <div className="map-image-wrapper">
                                    <img src={getMapImage(mapKey)} alt={mapKey} className="map-image" />
                                    {isPlayed && <div className="map-played-overlay">✓</div>}
                                </div>
                                <div className="map-name">{mapKey.toUpperCase()}</div>
                                {isPlayed && mapData && (
                                    <div className="map-score">
                                        <span className={match.winner_team_id === match.team1_id && mapData.team1_score > mapData.team2_score ? 'winner-score' : ''}>
                                            {mapData.team1_score}
                                        </span>
                                        <span className="score-divider">:</span>
                                        <span className={match.winner_team_id === match.team2_id && mapData.team2_score > mapData.team1_score ? 'winner-score' : ''}>
                                            {mapData.team2_score}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderPickBanHistory = () => {
        if (!match.pick_ban_data || !Array.isArray(match.pick_ban_data)) return null;
        
        return (
            <div className="match-pick-ban">
                <h3 className="section-title">🎯 Pick & Ban</h3>
                <div className="pick-ban-timeline">
                    {match.pick_ban_data.map((action, index) => (
                        <div key={index} className={`pick-ban-item ${action.type}`}>
                            <div className="pick-ban-order">#{index + 1}</div>
                            <div className="pick-ban-team">
                                {action.team_id === match.team1_id ? match.team1_name : match.team2_name}
                            </div>
                            <div className={`pick-ban-action ${action.type}`}>
                                {action.type === 'ban' ? '🚫 BAN' : '✅ PICK'}
                            </div>
                            <div className="pick-ban-map">{action.map_name?.toUpperCase()}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const openUserProfile = (userId, isAuthorizedUser) => {
        if (userId) window.open(`/user/${userId}`, '_blank');
        else if (!isAuthorizedUser) alert('Игрок был добавлен единоразова в рамках турнира и не проходил авторизацию');
    };

    const openTeamPage = (teamId) => {
        if (teamId) window.open(`/teams/${teamId}`, '_blank');
    };

    const renderTeamLineups = () => {
        if (!tournament?.teams && !tournament?.participants) return null;
        
        const team1Info = getParticipantInfo(match.team1_id, tournament);
        const team2Info = getParticipantInfo(match.team2_id, tournament);
        
        return (
            <div className="match-lineups">
                <h3 className="section-title">👥 Составы команд</h3>
                <div className="lineups-grid">
                    {/* Команда 1 */}
                    <div className="lineup-team">
                        <div className="lineup-header" onClick={() => openTeamPage(match.team1_id)} style={{cursor:'pointer'}}>
                            <img src={getTeamLogo(team1Info)} alt={team1Info?.name} className="lineup-logo" />
                            <h4 className="lineup-team-name">{team1Info?.name || 'TBD'}</h4>
                        </div>
                        <div className="lineup-players">
                            {team1Info?.members ? (
                                team1Info.members.map((player, idx) => (
                                    <div key={idx} className="lineup-player">
                                        <img 
                                            src={ensureHttps(player.avatar_url || '/default-avatar.png')} 
                                            alt={player.name}
                                            className="player-avatar"
                                        />
                                        <span
                                            className="player-name linklike"
                                            onClick={() => openUserProfile(player.user_id || player.id, Boolean(player.user_id || player.id))}
                                            title={player.id ? 'Открыть профиль' : 'Игрок был добавлен единоразова в рамках турнира и не проходил авторизацию'}
                                        >
                                            {player.name}
                                        </span>
                                        {player.is_captain && <span className="captain-badge">C</span>}
                                    </div>
                                ))
                            ) : (
                                <div className="lineup-player">
                                    <img 
                                        src={ensureHttps(team1Info?.avatar_url || '/default-avatar.png')} 
                                        alt={team1Info?.name}
                                        className="player-avatar"
                                    />
                                    <span className="player-name">{team1Info?.name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Команда 2 */}
                    <div className="lineup-team">
                        <div className="lineup-header" onClick={() => openTeamPage(match.team2_id)} style={{cursor:'pointer'}}>
                            <img src={getTeamLogo(team2Info)} alt={team2Info?.name} className="lineup-logo" />
                            <h4 className="lineup-team-name">{team2Info?.name || 'TBD'}</h4>
                        </div>
                        <div className="lineup-players">
                            {team2Info?.members ? (
                                team2Info.members.map((player, idx) => (
                                    <div key={idx} className="lineup-player">
                                        <img 
                                            src={ensureHttps(player.avatar_url || '/default-avatar.png')} 
                                            alt={player.name}
                                            className="player-avatar"
                                        />
                                        <span
                                            className="player-name linklike"
                                            onClick={() => openUserProfile(player.user_id || player.id, Boolean(player.user_id || player.id))}
                                            title={player.id ? 'Открыть профиль' : 'Игрок был добавлен единоразова в рамках турнира и не проходил авторизацию'}
                                        >
                                            {player.name}
                                        </span>
                                        {player.is_captain && <span className="captain-badge">C</span>}
                                    </div>
                                ))
                            ) : (
                                <div className="lineup-player">
                                    <img 
                                        src={ensureHttps(team2Info?.avatar_url || '/default-avatar.png')} 
                                        alt={team2Info?.name}
                                        className="player-avatar"
                                    />
                                    <span className="player-name">{team2Info?.name}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTeamHistory = () => {
        if (!teamHistory.team1.length && !teamHistory.team2.length) return null;
        
        return (
            <div className="match-team-history">
                <h3 className="section-title">📊 Последние матчи</h3>
                <div className="history-grid">
                    {/* История команды 1 */}
                    <div className="history-team">
                        <h4 className="history-team-name">{match.team1_name || 'Команда 1'}</h4>
                        <div className="history-matches">
                            {teamHistory.team1.length > 0 ? (
                                teamHistory.team1.map((histMatch, idx) => (
                                    <div key={idx} className={`history-match ${histMatch.result}`}>
                                        <div className="history-opponent">
                                            vs {histMatch.opponent_name}
                                        </div>
                                        <div className="history-score">
                                            {histMatch.score}
                                        </div>
                                        <div className={`history-result ${histMatch.result}`}>
                                            {histMatch.result === 'win' ? 'W' : 'L'}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-history">Нет предыдущих матчей</div>
                            )}
                        </div>
                    </div>

                    {/* История команды 2 */}
                    <div className="history-team">
                        <h4 className="history-team-name">{match.team2_name || 'Команда 2'}</h4>
                        <div className="history-matches">
                            {teamHistory.team2.length > 0 ? (
                                teamHistory.team2.map((histMatch, idx) => (
                                    <div key={idx} className={`history-match ${histMatch.result}`}>
                                        <div className="history-opponent">
                                            vs {histMatch.opponent_name}
                                        </div>
                                        <div className="history-score">
                                            {histMatch.score}
                                        </div>
                                        <div className={`history-result ${histMatch.result}`}>
                                            {histMatch.result === 'win' ? 'W' : 'L'}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-history">Нет предыдущих матчей</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="match-details-loading">
                <div className="loading-spinner"></div>
                <p>Загрузка деталей матча...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="match-details-error">
                <h2>❌ Ошибка загрузки</h2>
                <p>{error}</p>
                <button onClick={() => navigate(-1)} className="btn-back">
                    ← Назад
                </button>
            </div>
        );
    }

    if (!match || !tournament) {
        return (
            <div className="match-details-error">
                <h2>🔍 Матч не найден</h2>
                <button onClick={() => navigate(-1)} className="btn-back">
                    ← Назад
                </button>
            </div>
        );
    }

    const team1Info = getParticipantInfo(match.team1_id, tournament);
    const team2Info = getParticipantInfo(match.team2_id, tournament);

    return (
        <div className="match-details-page">
            <MatchMetaTags match={match} tournament={tournament} />
            
            {/* Навигация */}
            <div className="match-breadcrumb">
                <Link to="/">Главная</Link>
                <span className="breadcrumb-separator">/</span>
                <Link to={`/tournaments/${tournament.id}`}>{tournament.name}</Link>
                <span className="breadcrumb-separator">/</span>
                <span>Матч #{match.match_number || match.id}</span>
            </div>

            {/* Главный заголовок с командами и счетом */}
            <div className="match-header-section">
                <div className="match-status-bar">
                    <span className={`match-status ${getMatchStatusClass(match.status)}`}>
                        {getMatchStatusText(match.status)}
                    </span>
                    <span className="match-date">{formatDate(match.match_date || match.created_at)}</span>
                    <button className="btn btn-secondary" onClick={() => setIsShareModalOpen(true)}>
                        🔗 Поделиться
                    </button>
                </div>

                <div className="match-main-header">
                    {/* Команда 1 */}
                    <div className={`team-block team-left ${match.winner_team_id === match.team1_id ? 'winner' : ''}`}
                         onClick={() => window.open(`/teams/${match.team1_id}`, '_blank')}
                         style={{cursor:'pointer'}}>
                        <img 
                            src={getTeamLogo(team1Info)} 
                            alt={team1Info?.name}
                            className="team-logo"
                        />
                        <h2 className="team-name">{team1Info?.name || 'TBD'}</h2>
                    </div>

                    {/* Счет */}
                    <div className="match-score-block">
                        <div className="match-score">
                            <span className={`score ${match.winner_team_id === match.team1_id ? 'winner' : ''}`}>
                                {match.score1 || 0}
                            </span>
                            <span className="score-separator">:</span>
                            <span className={`score ${match.winner_team_id === match.team2_id ? 'winner' : ''}`}>
                                {match.score2 || 0}
                            </span>
                        </div>
                        <div className="match-format">
                            {match.round_name || `Раунд ${match.round}`}
                        </div>
                    </div>

                    {/* Команда 2 */}
                    <div className={`team-block team-right ${match.winner_team_id === match.team2_id ? 'winner' : ''}`}
                         onClick={() => window.open(`/teams/${match.team2_id}`, '_blank')}
                         style={{cursor:'pointer'}}>
                        <img 
                            src={getTeamLogo(team2Info)} 
                            alt={team2Info?.name}
                            className="team-logo"
                        />
                        <h2 className="team-name">{team2Info?.name || 'TBD'}</h2>
                    </div>
                </div>
            </div>

            {/* Карты */}
            {renderMapPool()}
            
            {/* Pick & Ban */}
            {renderPickBanHistory()}
            
            {/* Составы команд */}
            {renderTeamLineups()}
            
            {/* История матчей */}
            {renderTeamHistory()}

            {/* Модальное окно шейринга */}
            <MatchShareModal 
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                selectedMatch={match}
                tournament={tournament}
            />
        </div>
    );
};

export default MatchDetailsPage;