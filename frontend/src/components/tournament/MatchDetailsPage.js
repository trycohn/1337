import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
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
    const { user } = useUser();
    const [editingMapIndex, setEditingMapIndex] = useState(null);
    const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
    const [score1Input, setScore1Input] = useState('');
    const [score2Input, setScore2Input] = useState('');
    const [isSavingMap, setIsSavingMap] = useState(false);
    const [userIsAdmin, setUserIsAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        // Фолбек: получаем id пользователя из JWT, если контекст недоступен
        try {
            if (user?.id) { setCurrentUserId(user.id); return; }
            const token = localStorage.getItem('token');
            if (!token) return;
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload?.id) setCurrentUserId(payload.id);
        } catch (e) {
            // ignore
        }
    }, [user]);

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

    const handleCompleteMatch = async () => {
        if (!isAdminOrCreator) return;
        if (!window.confirm('Подтвердить завершение матча? Результат будет зафиксирован.')) return;
        try {
            const token = localStorage.getItem('token');
            if (!token) { alert('Нужна авторизация'); return; }

            // Определяем победителя
            let winnerTeamId = match.winner_team_id;
            let s1 = Number.isFinite(match.score1) ? match.score1 : 0;
            let s2 = Number.isFinite(match.score2) ? match.score2 : 0;

            // Если есть данные по картам
            if (Array.isArray(match.maps_data) && match.maps_data.length > 0) {
                // 1) Ровно одна карта — финальный счёт = счёт этой карты
                if (match.maps_data.length === 1) {
                    const only = match.maps_data[0];
                    const m1 = (only.score1 ?? only.team1_score);
                    const m2 = (only.score2 ?? only.team2_score);
                    if (typeof m1 === 'number' && typeof m2 === 'number') {
                        s1 = m1;
                        s2 = m2;
                    }
                } else {
                    // 2) Несколько карт — агрегируем как количество выигранных карт
                    let wins1 = 0;
                    let wins2 = 0;
                    for (const m of match.maps_data) {
                        const m1 = (m.score1 ?? m.team1_score);
                        const m2 = (m.score2 ?? m.team2_score);
                        if (typeof m1 === 'number' && typeof m2 === 'number') {
                            if (m1 > m2) wins1++; else if (m2 > m1) wins2++;
                        }
                    }
                    if (wins1 + wins2 > 0) {
                        s1 = wins1;
                        s2 = wins2;
                    }
                }
            }

            if (!winnerTeamId) {
                if (s1 !== s2) {
                    winnerTeamId = s1 > s2 ? match.team1_id : match.team2_id;
                } else if (Array.isArray(match.maps_data) && match.maps_data.length > 0) {
                    let wins1 = 0, wins2 = 0;
                    for (const m of match.maps_data) {
                        const m1 = (m.score1 ?? m.team1_score) ?? 0;
                        const m2 = (m.score2 ?? m.team2_score) ?? 0;
                        if (m1 > m2) wins1++; else if (m2 > m1) wins2++;
                    }
                    if (wins1 !== wins2) winnerTeamId = wins1 > wins2 ? match.team1_id : match.team2_id;
                }
            }

            if (!winnerTeamId) { alert('Невозможно определить победителя. Укажите счёт или победителя.'); return; }

            const body = {
                winner_team_id: winnerTeamId,
                score1: s1,
                score2: s2,
                maps_data: match.maps_data || []
            };

            const resp = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            if (!resp.ok) throw new Error('Не удалось завершить матч');
            await fetchMatchDetails();
            alert('Матч завершён');
        } catch (e) {
            alert(e.message || 'Ошибка завершения матча');
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
        return mapImages[mapName?.toLowerCase()] || '/images/maps/mirage.jpg';
    };
    const isAdminOrCreator = !!(tournament && (
        (currentUserId && tournament.created_by === currentUserId) ||
        userIsAdmin ||
        (Array.isArray(tournament.admins) && currentUserId && tournament.admins.some(a => a.user_id === currentUserId))
    ));

    useEffect(() => {
        // Фолбек-проверка прав администратора, если не создатель и список admins не загружен
        const checkAdmin = async () => {
            try {
                if (!tournamentId) return;
                if (tournament && currentUserId && tournament.created_by === currentUserId) { setUserIsAdmin(true); return; }
                const token = localStorage.getItem('token');
                if (!token) return;
                const resp = await fetch(`/api/tournaments/${tournamentId}/admin-request-status`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!resp.ok) return;
                const data = await resp.json();
                if (data?.status === 'accepted') setUserIsAdmin(true);
            } catch (_) {}
        };
        checkAdmin();
    }, [currentUserId, tournament, tournamentId]);

    const renderPickedMapsWithSides = () => {
        const rawMapsData = match?.maps_data;
        const selections = match?.selections || [];
        const mapsData = (Array.isArray(rawMapsData) && rawMapsData.length > 0)
            ? rawMapsData
            : getPickedMapsFromSelections().map(n => ({ map_name: n, score1: null, score2: null }));
        if (!Array.isArray(mapsData) || mapsData.length === 0) return null;
        const teamNameById = {
            [match.team1_id]: match.team1_name || 'Команда 1',
            [match.team2_id]: match.team2_name || 'Команда 2'
        };
        // Для каждой выбранной карты ищем, кто делал pick
        const items = mapsData.map((m, idx) => {
            const pick = selections.find(s => (s.action_type || s.type) === 'pick' && normalizeMapName(s.map_name || s.map || s.name) === normalizeMapName(m.map_name));
            const pickerTeamId = pick?.team_id;
            const sideChooserTeamId = pickerTeamId ? (pickerTeamId === match.team1_id ? match.team2_id : match.team1_id) : null;
            const sideChooserName = sideChooserTeamId ? teamNameById[sideChooserTeamId] : 'Определяется';
            return (
                <div
                    key={`${m.map_name}-${idx}`}
                    className="match-map-card"
                    onClick={() => {
                        if (!isAdminOrCreator) return;
                        if (editingMapIndex === idx) return;
                        setEditingMapIndex(idx);
                        setScore1Input(m.score1 ?? '');
                        setScore2Input(m.score2 ?? '');
                    }}
                    style={{ cursor: isAdminOrCreator ? 'pointer' : 'default' }}
                >
                    <img src={getMapImage(m.map_name)} alt={m.map_name} />
                    <div className="map-title">Карта {idx + 1}: {m.map_name}</div>
                    <div className="map-meta">Сторону выбирает: {sideChooserName}</div>
                    {isAdminOrCreator && (
                        editingMapIndex === idx ? (
                            <div className="map-inline-editor" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                                <input
                                    type="number"
                                    min="0"
                                    className="score-input"
                                    style={{ width: 64 }}
                                    value={score1Input}
                                    onChange={(e) => setScore1Input(e.target.value)}
                                    placeholder={teamNameById[match.team1_id]}
                                />
                                <span>:</span>
                                <input
                                    type="number"
                                    min="0"
                                    className="score-input"
                                    style={{ width: 64 }}
                                    value={score2Input}
                                    onChange={(e) => setScore2Input(e.target.value)}
                                    placeholder={teamNameById[match.team2_id]}
                                />
                                <button
                                    className="btn btn-primary"
                                    disabled={isSavingMap}
                                    onClick={async () => {
                                        try {
                                            setIsSavingMap(true);
                                            const token = localStorage.getItem('token');
                                            const s1 = score1Input === '' ? null : parseInt(score1Input, 10);
                                            const s2 = score2Input === '' ? null : parseInt(score2Input, 10);
                                            const body = {
                                                maps_data: mapsData.map((mm, i) => i === idx ? { ...mm, score1: s1, score2: s2 } : mm)
                                            };
                                            const resp = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/result`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                                body: JSON.stringify(body)
                                            });
                                            if (!resp.ok) throw new Error('Не удалось сохранить счёт карты');
                                            await fetchMatchDetails();
                                            setEditingMapIndex(null);
                                        } catch (e) {
                                            alert(e.message);
                                        } finally {
                                            setIsSavingMap(false);
                                        }
                                    }}
                                >
                                    {isSavingMap ? 'Сохранение…' : 'Сохранить'}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    disabled={isSavingMap}
                                    onClick={() => setEditingMapIndex(null)}
                                >
                                    Отменить
                                </button>
                            </div>
                        ) : (
                            <div className="map-edit-hint" style={{ marginTop: 8, position: 'relative' }}>
                                <button
                                    className="btn btn-secondary"
                                    style={{ position: 'relative', zIndex: 2, pointerEvents: 'auto' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingMapIndex(idx);
                                        setScore1Input(m.score1 ?? '');
                                        setScore2Input(m.score2 ?? '');
                                    }}
                                    title="Редактировать счёт карты"
                                >
                                    Ввести счёт
                                </button>
                            </div>
                        )
                    )}
                </div>
            );
        });
        return (
            <section className="match-picked-maps">
                <h3>Выбранные карты</h3>
                <div className="match-maps-grid">{items}</div>
            </section>
        );
    };

    const renderSelectionsHistory = () => {
        const selections = match?.selections || [];
        if (!Array.isArray(selections) || selections.length === 0) return null;
        const teamNameById = {
            [match.team1_id]: match.team1_name || 'Команда 1',
            [match.team2_id]: match.team2_name || 'Команда 2'
        };
        return (
            <section className="match-veto-history">
                <h3>История пиков/банов</h3>
                <ol>
                    {selections.map((s, i) => (
                        <li key={i} className={`veto-item ${s.action_type}`}>
                            {teamNameById[s.team_id] || 'Команда'} {s.action_type} {s.map_name}
                        </li>
                    ))}
                </ol>
            </section>
        );
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

    function getPickedMapsFromSelections() {
        const selections = match?.selections || [];
        return selections
            .filter(s => (s.action_type || s.type) === 'pick')
            .map(s => normalizeMapName(s.map_name || s.map || s.name));
    }

    function getPickedMapsFromSelections() {
        const selections = match?.selections || [];
        return selections
            .filter(s => (s.action_type || s.type) === 'pick')
            .map(s => normalizeMapName(s.map_name || s.map || s.name));
    }

    function getEditableMapsData() {
        const rawMapsData = match?.maps_data;
        if (Array.isArray(rawMapsData) && rawMapsData.length > 0) return rawMapsData;
        return getPickedMapsFromSelections().map(n => ({ map_name: n, score1: null, score2: null }));
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
        const pickedBySelections = new Set(getPickedMapsFromSelections());
        
        return (
            <div className="match-map-pool">
                <h3 className="section-title">🗺️ Карты</h3>
                <div className="map-pool-grid">
                    {displayPool.map(rawName => {
                        const mapKey = normalizeMapName(rawName);
                        const mapData = playedMapsData.get(mapKey);
                        const isPlayed = playedMapsData.has(mapKey);
                        const isSelected = isPlayed || pickedBySelections.has(mapKey);
                        
                        return (
                            <div
                                key={mapKey}
                                className={`map-card ${isSelected ? 'map-played' : 'map-not-played'}`}
                                onClick={() => {
                                    if (!isAdminOrCreator || !isSelected) return;
                                    const mapsDataArr = getEditableMapsData();
                                    const idx = mapsDataArr.findIndex(m => normalizeMapName(m.map_name || m.map || m.name) === mapKey);
                                    if (idx >= 0) {
                                        setEditingMapIndex(idx);
                                        const m = mapsDataArr[idx];
                                        setScore1Input(m.score1 ?? m.team1_score ?? '');
                                        setScore2Input(m.score2 ?? m.team2_score ?? '');
                                        setIsScoreModalOpen(true);
                                    }
                                }}
                                style={{ cursor: isAdminOrCreator && isSelected ? 'pointer' : 'default' }}
                            >
                                <div className="map-image-wrapper">
                                    <img src={getMapImage(mapKey)} alt={mapKey} className="map-image" />
                                    {isSelected && <div className="map-played-overlay">✓</div>}
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {isAdminOrCreator && (
                            <button className="btn btn-primary" onClick={handleCompleteMatch} title="Завершить матч и зафиксировать результат">
                                Завершить матч
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={() => setIsShareModalOpen(true)}>
                            🔗 Поделиться
                        </button>
                    </div>
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

            {/* Модалка ввода счёта */}
            {isScoreModalOpen && isAdminOrCreator && (
                <div className="score-modal-overlay" onClick={() => setIsScoreModalOpen(false)}>
                    <div className="score-modal" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                            const mapsData = getEditableMapsData();
                            const idx = editingMapIndex ?? 0;
                            const current = mapsData[idx];
                            const mapTitle = current?.map_name || 'Карта';
                            const team1 = match.team1_name || 'Команда 1';
                            const team2 = match.team2_name || 'Команда 2';
                            return (
                                <>
                                    <div className="score-modal-header">
                                        <span className="score-modal-title">{mapTitle.toUpperCase()}</span>
                                        <button className="score-modal-close" onClick={() => setIsScoreModalOpen(false)}>✕</button>
                                    </div>
                                    <div className="score-modal-body">
                                        <div className="score-field">
                                            <label>{team1}</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="score-input"
                                                value={score1Input}
                                                onChange={(e) => setScore1Input(e.target.value)}
                                            />
                                        </div>
                                        <div className="score-sep">:</div>
                                        <div className="score-field">
                                            <label>{team2}</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="score-input"
                                                value={score2Input}
                                                onChange={(e) => setScore2Input(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="score-modal-actions">
                                        <button
                                            className="btn btn-primary"
                                            onClick={async () => {
                                                try {
                                                    setIsSavingMap(true);
                                                    const token = localStorage.getItem('token');
                                                    const s1 = score1Input === '' ? null : parseInt(score1Input, 10);
                                                    const s2 = score2Input === '' ? null : parseInt(score2Input, 10);
                                                    const mapsData = getEditableMapsData();
                                                    const body = {
                                                        maps_data: mapsData.map((mm, i) => i === (editingMapIndex ?? 0) ? { ...mm, score1: s1, score2: s2 } : mm)
                                                    };
                                                    const resp = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/result`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                                        body: JSON.stringify(body)
                                                    });
                                                    if (!resp.ok) throw new Error('Не удалось сохранить счёт карты');
                                                    await fetchMatchDetails();
                                                    setIsScoreModalOpen(false);
                                                    setEditingMapIndex(null);
                                                } catch (e) {
                                                    alert(e.message);
                                                } finally {
                                                    setIsSavingMap(false);
                                                }
                                            }}
                                            title="Сохранить"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => { setIsScoreModalOpen(false); setEditingMapIndex(null); }}
                                            title="Отменить"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
            
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