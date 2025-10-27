import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PickBanTimeline } from './match-stats/PickBanTimeline';
import { LeadersPanel } from './match-stats/LeadersPanel';
import { ScoreTable } from './match-stats/ScoreTable';
import './match-stats/match-stats.css';
import { MapsAccordion } from './match-stats/MapsAccordion';
import { SkeletonCards, SkeletonTable, SkeletonMapTiles } from './match-stats/Skeletons';
import { StatusPanel } from './match-stats/StatusPanel';
import { useUser } from '../../context/UserContext';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ensureHttps } from '../../utils/userHelpers';
import { getParticipantInfo } from '../../utils/participantHelpers';
import MatchMetaTags from '../SEO/MatchMetaTags';
import MatchShareModal from './modals/MatchShareModal';
import EditMatchResultModal from './modals/EditMatchResultModal'; // ✏️ Модальное окно редактирования
import { MatchFeedbackManager } from '../feedback'; // 🎮 Match Feedback система
import api from '../../axios'; // 🔧 ИСПРАВЛЕНО: импорт axios
import useTournamentSocket from '../../hooks/tournament/useTournamentSocket'; // 🔴 WebSocket для live обновлений
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
    const [editingMapKey, setEditingMapKey] = useState(null);
    const [userIsAdmin, setUserIsAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    // 🆕 Лобби-статистика для турнирного матча
    const [lobbyStats, setLobbyStats] = useState(null);
    const [expandedMap, setExpandedMap] = useState(null);
    const [pollVersion, setPollVersion] = useState(0);
    const [compact, setCompact] = useState(true);
    useEffect(() => { try { localStorage.setItem('match_compact_mode','true'); } catch(_) {} }, []);
    // 🎬 Доступные демо-файлы
    const [demosAvailable, setDemosAvailable] = useState({});
    
    // ✏️ Редактирование завершенного матча
    const [isEditMatchModalOpen, setIsEditMatchModalOpen] = useState(false);
    const [editMatchData, setEditMatchData] = useState(null);
    
    // 🎮 FEEDBACK: State для системы обратной связи
    const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
    const [feedbackChecked, setFeedbackChecked] = useState(false);

    // 🔍 fetchMatchDetails БЕЗ useCallback для избежания бесконечного цикла
    const fetchMatchDetails = async () => {
        try {
            setLoading(true);
            
            // Получаем данные матча и турнира (публичные роуты)
            let matchResponse, tournamentResponse;
            try {
                [matchResponse, tournamentResponse] = await Promise.all([
                    fetch(`/api/tournaments/${tournamentId}/match/${matchId}`),
                    fetch(`/api/tournaments/${tournamentId}`)
                ]);
            } catch (fetchError) {
                console.error('❌ [MatchDetailsPage] Ошибка сетевого запроса:', fetchError);
                throw new Error('Ошибка подключения к серверу. Проверьте интернет-соединение.');
            }

            if (!matchResponse.ok) {
                const errorText = await matchResponse.text();
                console.error('❌ [MatchDetailsPage] Ошибка загрузки матча:', matchResponse.status, errorText);
                throw new Error(`Ошибка загрузки матча (${matchResponse.status})`);
            }
            
            if (!tournamentResponse.ok) {
                const errorText = await tournamentResponse.text();
                console.error('❌ [MatchDetailsPage] Ошибка загрузки турнира:', tournamentResponse.status, errorText);
                throw new Error(`Ошибка загрузки турнира (${tournamentResponse.status})`);
            }

            const matchData = await matchResponse.json();
            const tournamentData = await tournamentResponse.json();
            
            // Новый публичный роут возвращает данные в поле data
            const matchInfo = matchData.data || matchData;
            const tournamentInfo = tournamentData.data || tournamentData;
            
            setMatch(matchInfo);
            // 🆕 Лобби-статистика (если матч создан через лобби)
            // Всегда пытаемся загрузить один раз
            let matchzyMatchId = null;
            
                try {
                    const ls = await api.get(`/api/matches/tournament/${matchId}/stats?v=${pollVersion}`);
                    if (ls?.data?.success) {
                        const s = ls.data;
                        console.log('✅ [MatchDetailsPage] Статистика загружена:', {
                            maps: s.maps?.length,
                            pickban: s.pickban?.length,
                            playersByTeam: s.playersByTeam ? 'да' : 'нет',
                            playersByMap: s.playersByMap ? Object.keys(s.playersByMap).length : 0,
                            playersByMapKeys: Object.keys(s.playersByMap || {})
                        });
                        
                        // Встраиваем карточки карт и selections в существующую страницу (аккордеоны будут позже)
                        matchInfo.maps_data = s.maps?.map(m => ({
                            map_name: m.mapname,
                            team1_score: m.team1_score,
                            team2_score: m.team2_score
                        })) || matchInfo.maps_data;
                        matchInfo.selections = (Array.isArray(s.pickban) ? s.pickban.map(x => ({
                            action_type: x.action,
                            team_id: x.team_id,
                            map_name: x.mapname
                        })) : matchInfo.selections) || [];
                        // Присвоим, чтобы отрисовали блоки карт и историю
                        setMatch({ ...matchInfo });
                        setLobbyStats(s);
                        matchzyMatchId = s.matchid;
                    }
                } catch (err) { 
                console.log('📊 [MatchDetailsPage] Статистика недоступна (это нормально для ручных матчей):', err.response?.status);
                // Для завершенных матчей БЕЗ статистики - не проблема
                if (matchInfo.status === 'completed') {
                    console.log('⏸️ [MatchDetailsPage] Матч завершен, статистика отсутствует - показываем базовые данные');
                }
            }
            setTournament(tournamentInfo);
            
            // Загружаем историю матчей команд
            if (matchInfo.team1_id && matchInfo.team2_id) {
                await fetchTeamHistory(matchInfo.team1_id, matchInfo.team2_id);
            }
            
            // 🎬 Загружаем доступные демки (если есть matchzy matchid)
            if (matchzyMatchId) {
                await fetchAvailableDemos(matchzyMatchId);
            }
        } catch (err) {
            console.error('Ошибка загрузки деталей матча:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 🔄 ВЫЗЫВАЕМ fetchMatchDetails при загрузке и изменениях
    useEffect(() => {
        fetchMatchDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournamentId, matchId, pollVersion]);

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
    
    // 🔴 LIVE ОБНОВЛЕНИЯ МАТЧА ЧЕРЕЗ WEBSOCKET
    const handleTournamentUpdate = useCallback((data) => {
        console.log('🔄 [MatchDetailsPage] Получено обновление турнира:', data);
        
        // НЕ обновляем если матч завершен вручную
        if (match?.status === 'completed' && !lobbyStats) {
            console.log('⏸️ [MatchDetailsPage] Матч завершен вручную, автообновление отключено');
            return;
        }
        
        // Если обновление касается нашего матча - увеличиваем pollVersion для перезагрузки
        if (data && typeof data === 'object') {
            const updateType = data._metadata?.updateType;
            
            // Обновление матча
            if (updateType === 'match_updated' && data.matchId === parseInt(matchId)) {
                console.log('🎯 [MatchDetailsPage] Обновление нашего матча, перезагружаем...');
                setPollVersion(v => v + 1);
            }
            // Общее обновление матчей
            else if (data.matches || updateType === 'matches_update') {
                console.log('🔄 [MatchDetailsPage] Обнаружено обновление матчей, перезагружаем...');
                setPollVersion(v => v + 1);
            }
        }
    }, [matchId, match, lobbyStats]);

    const handleMatchUpdate = useCallback((data) => {
        console.log('🎯 [MatchDetailsPage] Получено обновление матча:', data);
        
        // НЕ обновляем если матч завершен вручную
        if (match?.status === 'completed' && !lobbyStats) {
            console.log('⏸️ [MatchDetailsPage] Матч завершен вручную, автообновление отключено');
            return;
        }
        
        // Если это обновление нашего матча - обновляем данные
        if (data && data.matchId === parseInt(matchId)) {
            console.log('✅ [MatchDetailsPage] Обновление относится к нашему матчу, перезагружаем...');
            setPollVersion(v => v + 1);
        }
    }, [matchId, match, lobbyStats]);

    // Подключаем WebSocket для live обновлений
    useTournamentSocket({
        tournamentId,
        user,
        onTournamentUpdate: handleTournamentUpdate,
        onParticipantUpdate: () => {}, // Не используется на странице матча
        onError: (error) => console.error('❌ [MatchDetailsPage] WebSocket error:', error)
    });
    
    // 🎮 FEEDBACK: Проверка нужно ли показать feedback
    useEffect(() => {
        const checkFeedbackNeeded = async () => {
            if (!match || !user || feedbackChecked) return;
            
            // Только для завершенных матчей
            if (match.state !== 'DONE' && match.state !== 'SCORE_DONE') return;
            
            try {
                const response = await api.get(`/api/matches/${match.id}/feedback/check`);
                
                if (!response.data.feedback_given) {
                    // Даем время посмотреть результат, потом показываем модалку
                    setTimeout(() => {
                        setShowFeedbackPrompt(true);
                    }, 1500);
                }
                
                setFeedbackChecked(true);
            } catch (error) {
                console.log('Feedback check failed, skipping');
                setFeedbackChecked(true);
            }
        };
        
        checkFeedbackNeeded();
    }, [match, user, feedbackChecked]);

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

    // 🎬 Загрузка доступных демо-файлов
    const fetchAvailableDemos = async (matchzyMatchId) => {
        try {
            const response = await fetch(`/api/demos/available/${matchzyMatchId}`);
            if (response.ok) {
                const demos = await response.json();
                setDemosAvailable(demos);
            }
        } catch (err) {
            console.error('Ошибка загрузки списка демок:', err);
            // Не критично, просто не будет кнопок скачивания
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

    // ✏️ Обработчик редактирования завершенного матча
    const handleEditMatch = () => {
        if (!isAdminOrCreator) return;
        
        // Проверяем наличие всех участников
        if (!match.team1_id || !match.team2_id) {
            alert('Не все участники матча определены. Редактирование невозможно.');
            return;
        }
        
        // Открываем модальное окно с текущими данными
        setEditMatchData({
            maps_data: match.maps_data || [],
            score1: match.score1,
            score2: match.score2,
            winner_team_id: match.winner_team_id
        });
        setIsEditMatchModalOpen(true);
    };

    // 📥 Ручной импорт статистики
    const [isImporting, setIsImporting] = useState(false);
    const handleImportStats = async () => {
        if (!matchId) return;
        
        const confirmImport = window.confirm(
            'Импортировать статистику матча?\n\n' +
            'Это обновит счет и статистику игроков на основе данных с игрового сервера.'
        );
        
        if (!confirmImport) return;
        
        try {
            setIsImporting(true);
            const token = localStorage.getItem('token');
            
            const response = await api.post(
                `/api/matchzy/import-match-stats/${matchId}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success) {
                alert('Импорт статистики запущен! Обновите страницу через несколько секунд.');
                // Обновляем данные через 5 секунд
                setTimeout(() => {
                    fetchMatchDetails();
                    setPollVersion(v => v + 1);
                }, 5000);
            } else {
                throw new Error(response.data.error || 'Ошибка импорта');
            }
        } catch (error) {
            console.error('Ошибка импорта статистики:', error);
            alert(error.response?.data?.error || error.message || 'Ошибка импорта статистики');
        } finally {
            setIsImporting(false);
        }
    };

    // ✏️ Сохранение отредактированного матча
    const handleSaveEditedMatch = async (updatedData) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Нужна авторизация');
                return;
            }

            const resp = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/result`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json', 
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify(updatedData)
            });

            const result = await resp.json();

            if (!resp.ok) {
                throw new Error(result.message || result.error || 'Не удалось сохранить изменения');
            }

            // Показываем сообщение с учетом ограничений
            if (result.limitedEdit) {
                alert(result.message || 'Изменены только данные карт, так как уже сыграны следующие матчи');
            } else {
                alert('Матч успешно отредактирован');
            }

            // Закрываем модальное окно и обновляем данные
            setIsEditMatchModalOpen(false);
            await fetchMatchDetails();

        } catch (e) {
            alert(e.message || 'Ошибка редактирования матча');
        }
    };

    // Редактирование серии удалено — счёт выставляется кликом по карте

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
                    
                    {/* 🎬 Кнопка скачивания демки */}
                    {demosAvailable[idx + 1]?.available && lobbyStats?.matchid && (
                        <button
                            className="demo-download-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/api/demos/download/${lobbyStats.matchid}/${idx + 1}`;
                            }}
                            title="Скачать демку"
                        >
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 15.575q-.2 0-.375-.062T11.3 15.3l-3.6-3.6q-.275-.275-.275-.7t.275-.7q.275-.275.7-.275t.7.275l2.2 2.2V5q0-.425.288-.712T12 4q.425 0 .713.288T13 5v7.5l2.2-2.2q.275-.275.7-.275t.7.275q.275.275.275.7t-.275.7l-3.6 3.6q-.15.15-.325.213t-.375.062M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15q.425 0 .713.288T6 16v2h12v-2q0-.425.288-.712T19 15q.425 0 .713.288T20 16v2q0 .825-.587 1.413T18 20z"/>
                            </svg>
                        </button>
                    )}
                    
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

    // 🎯 Используем useMemo для кеширования вычисленного счета
    const displayedScores = useMemo(() => {
        if (!match) return [0, 0];
        
        const maps = match?.maps_data;
        
        console.log('🎯 [useMemo displayedScores] Расчет счета:', {
            hasMaps: Array.isArray(maps),
            mapsCount: maps?.length,
            maps: maps,
            matchScore1: match?.score1,
            matchScore2: match?.score2
        });
        
        if (Array.isArray(maps) && maps.length > 0) {
            // Одна карта — показываем реальный счёт карты
            if (maps.length === 1) {
                const only = maps[0];
                const m1 = parseInt(only.score1 ?? only.team1_score) || 0;
                const m2 = parseInt(only.score2 ?? only.team2_score) || 0;
                console.log('📊 Одна карта, возвращаем счет:', [m1, m2]);
                return [m1, m2];
            }
            // Несколько карт — показываем количество выигранных карт
            let wins1 = 0, wins2 = 0;
            for (const m of maps) {
                const m1 = parseInt(m.score1 ?? m.team1_score) || 0;
                const m2 = parseInt(m.score2 ?? m.team2_score) || 0;
                console.log(`  Карта: ${m.map_name || m.mapName || 'unknown'} - ${m1}:${m2}`);
                if (m1 > m2) wins1++;
                else if (m2 > m1) wins2++;
            }
            console.log(`📊 Несколько карт, wins: ${wins1}:${wins2}`);
            if (wins1 + wins2 > 0) return [wins1, wins2];
        }
        const s1 = parseInt(match?.score1) || 0;
        const s2 = parseInt(match?.score2) || 0;
        console.log(`📊 Fallback к score1:score2 =`, [s1, s2]);
        return [s1, s2];
    }, [match, match?.maps_data, match?.score1, match?.score2]);

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
        // Если есть лобби-статистика — используем её для идентичного UI кастомному матчу
        if (lobbyStats && lobbyStats.success) {
            const { match: m, maps, playersByTeam, playersByMap, pickban } = lobbyStats;
            const titleLeft = m.team1_name || 'Команда 1';
            const titleRight = m.team2_name || 'Команда 2';

            const pickbanView = <PickBanTimeline steps={pickban} />;

            return (
                <>
                    {pickbanView}
                    <LeadersPanel leaders={lobbyStats.leaders} />
                    <div className="match-compact-toggle compact-toggle">
                        <label><input type="checkbox" checked={!!compact} onChange={(e)=>{ setCompact(e.target.checked); try { localStorage.setItem('match_compact_mode', String(e.target.checked)); } catch(_) {} }} /> Компактный режим таблиц</label>
                    </div>
                    <ScoreTable title={`${titleLeft}`} rows={playersByTeam?.team1 || []} compact={compact} />
                    <ScoreTable title={`${titleRight}`} rows={playersByTeam?.team2 || []} compact={compact} />
                    <MapsAccordion titleLeft={titleLeft} titleRight={titleRight} maps={maps} playersByMap={playersByMap} compact={compact} />
                </>
            );
        }

        // 1) Сыгранные карты из результата матча (для отображения счётов) — старый режим
        const mapsDataRaw = match.maps_data;
        const hasMapsDataRaw = Array.isArray(mapsDataRaw) && mapsDataRaw.length > 0;

        const playedMapsData = new Map();
        if (hasMapsDataRaw) {
            mapsDataRaw.forEach(mapInfo => {
                const mapName = normalizeMapName(mapInfo.map_name || mapInfo.mapName || mapInfo.name || mapInfo.map || '');
                const team1Score = mapInfo.team1_score !== undefined ? mapInfo.team1_score : (mapInfo.score1 || 0);
                const team2Score = mapInfo.team2_score !== undefined ? mapInfo.team2_score : (mapInfo.score2 || 0);
                if (mapName) {
                    playedMapsData.set(mapName, { team1_score: team1Score, team2_score: team2Score });
                }
            });
        }

        // 2) Если есть история лобби (selections) — показываем карты в порядке BAN/PICK
        const selections = Array.isArray(match?.selections) ? match.selections : [];
        // Если нет ни карт, ни истории лобби — показываем стандартный пул (ниже)
        const teamNameById = {
            [match.team1_id]: match.team1_name || 'Команда 1',
            [match.team2_id]: match.team2_name || 'Команда 2'
        };

        if (selections.length > 0) {
            return (
                <div className="match-map-pool">
                    <h3 className="section-title">Карты</h3>
                    <div className="map-pool-grid">
                        {selections.map((s, idx) => {
                            const mapKey = normalizeMapName(s.map_name || s.map || s.name);
                            const isBan = (s.action_type || s.type) === 'ban';
                            const isPick = (s.action_type || s.type) === 'pick';
                            const mapData = playedMapsData.get(mapKey);
                            const teamName = teamNameById[s.team_id] || 'Команда';
                            const canEdit = isAdminOrCreator && isPick;
                            return (
                                <div
                                    key={`${mapKey}-${idx}`}
                                    className={`map-card ${isPick ? 'map-played' : ''} ${isBan ? 'map-banned' : ''}`}
                                    onClick={() => {
                                        if (!canEdit) return;
                                        const mapsDataArr = getEditableMapsData();
                                        const editIdx = mapsDataArr.findIndex(m => normalizeMapName(m.map_name || m.map || m.name) === mapKey);
                                        if (editIdx >= 0) {
                                            setEditingMapIndex(editIdx);
                                            const m = mapsDataArr[editIdx];
                                            setScore1Input(m.score1 ?? m.team1_score ?? '');
                                            setScore2Input(m.score2 ?? m.team2_score ?? '');
                                        } else {
                                            setEditingMapIndex(null);
                                            setScore1Input('');
                                            setScore2Input('');
                                        }
                                        setEditingMapKey(mapKey);
                                        setIsScoreModalOpen(true);
                                    }}
                                    style={{ cursor: canEdit ? 'pointer' : 'default' }}
                                >
                                    <div className="map-image-wrapper">
                                        <img src={getMapImage(mapKey)} alt={mapKey} className="map-image" />
                                        {isPick && <div className="map-played-overlay">✓</div>}
                                        {isBan && <div className="map-banned-overlay">✖</div>}
                                    </div>
                                    <div className="map-name">{mapKey.toUpperCase()}</div>
                                    <div className={`map-action-label ${isBan ? 'ban' : 'pick'}`}>
                                        {teamName} {isBan ? 'BAN' : 'PICK'}
                                    </div>
                                    {isPick && mapData && (
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
        }

        // 3) Иначе показываем стандартный пул (как раньше)
        const agreedPool = Array.isArray(match.available_maps)
            ? match.available_maps.map(m => normalizeMapName(m)).filter(Boolean)
            : [];
        const fallbackPool = ['dust2', 'mirage', 'inferno', 'nuke', 'overpass', 'vertigo', 'ancient'];
        const displayPool = (agreedPool.length > 0 ? agreedPool : fallbackPool);
        const pickedBySelections = new Set(getPickedMapsFromSelections());

        return (
            <div className="match-map-pool">
                <h3 className="section-title">Карты</h3>
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
                                    if (!isAdminOrCreator) return;
                                    const mapsDataArr = getEditableMapsData();
                                    const idx = mapsDataArr.findIndex(m => normalizeMapName(m.map_name || m.map || m.name) === mapKey);
                                    if (idx >= 0) {
                                        setEditingMapIndex(idx);
                                        const m = mapsDataArr[idx];
                                        setScore1Input(m.score1 ?? m.team1_score ?? '');
                                        setScore2Input(m.score2 ?? m.team2_score ?? '');
                                    } else {
                                        setEditingMapIndex(null);
                                        setScore1Input('');
                                        setScore2Input('');
                                    }
                                    setEditingMapKey(mapKey);
                                    setIsScoreModalOpen(true);
                                }}
                                style={{ cursor: isAdminOrCreator ? 'pointer' : 'default' }}
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
                <h3 className="section-title">Составы команд</h3>
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
                <h3 className="section-title">Последние матчи</h3>
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
                <h2>Ошибка загрузки</h2>
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
                <h2>Матч не найден</h2>
                <button onClick={() => navigate(-1)} className="btn-back">
                    ← Назад
                </button>
            </div>
        );
    }

  // 🧩 Идентичный рендер для турнирного матча, созданного через лобби (как на кастомной странице)
  if (lobbyStats && lobbyStats.success) {
    const { match: m, maps, playersByTeam, playersByMap, pickban } = lobbyStats;
    const titleLeft = m.team1_name || 'Команда 1';
    const titleRight = m.team2_name || 'Команда 2';
    const score1 = Number.isFinite(m.team1_score) ? m.team1_score : '-';
    const score2 = Number.isFinite(m.team2_score) ? m.team2_score : '-';
    const isCompleted = Number.isFinite(m.team1_score) && Number.isFinite(m.team2_score);

    const isCS2 = tournament?.game && /counter\s*strike\s*2|cs2/i.test(tournament.game);

    return (
      <>
        {/* Полноценный хедер турнира */}
        <div className={`tournament-header ${isCS2 ? 'with-cs2-hero' : ''}`}>
          <div className={`tournament-header-tournamentdetails ${isCS2 ? 'with-cs2-hero' : ''}`}>
            <h2>{tournament.name}</h2>
            <div className="header-meta">
              <div className="header-meta-row">
                <span className="meta-label">Организатор:</span>
                <span className="meta-value">
                  {tournament?.organizer_name || tournament?.organizer?.name || '—'}
                </span>
              </div>
              <div className="header-meta-row">
                <span className="meta-label">Дисциплина:</span>
                <span className="meta-value">{tournament?.game || '—'}</span>
              </div>
            </div>
            <div className="header-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => navigate(`/tournaments/${tournamentId}`)}
              >
                ← Вернуться к турниру
              </button>
            </div>
          </div>
          
          <div className={`tournament-header-infoblock ${isCS2 ? 'with-cs2-hero' : ''}`}>
            <div className="infoblock-stats">
              <div className="infoblock-grid infoblock-top">
                <div className="infoblock-item infoblock-prize">
                  <div className="infoblock-label">Призовой фонд</div>
                  <div className="infoblock-value">{tournament?.prize_pool || 'Не указан'}</div>
                </div>
                <div className="infoblock-item infoblock-start">
                  <div className="infoblock-label">Старт</div>
                  <div className="infoblock-value">
                    {tournament?.start_date ? new Date(tournament.start_date).toLocaleString('ru-RU', { 
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                    }) : '—'}
                  </div>
                </div>
                <div className="infoblock-item infoblock-status">
                  <div className="infoblock-label">Статус</div>
                  <div className="infoblock-value">
                    {(() => {
                      const map = { registration: 'Регистрация', active: 'Активный', in_progress: 'Идет', completed: 'Завершен', upcoming: 'Предстоящий' };
                      return map[tournament?.status] || tournament?.status || '—';
                    })()}
                  </div>
                </div>
              </div>
              <div className="infoblock-grid infoblock-bottom">
                <div className="infoblock-item infoblock-format">
                  <div className="infoblock-label">Формат</div>
                  <div className="infoblock-value">
                    {tournament?.participant_type === 'team' ? 'Командный' : 'Соло'}
                  </div>
                </div>
                <div className="infoblock-item infoblock-participants">
                  <div className="infoblock-label">Участники</div>
                  <div className="infoblock-value">
                    {tournament?.participant_count || 0}
                    {tournament?.max_participants ? ` из ${tournament.max_participants}` : ''}
                  </div>
                </div>
                <div className="infoblock-item infoblock-team-size">
                  <div className="infoblock-label">В команде</div>
                  <div className="infoblock-value">{tournament?.team_size || 5}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Главный заголовок с командами и счетом */}
        <div className="match-header-section">
          <div className="match-status-bar">
            <span className="match-status">{isCompleted ? 'Завершен' : 'В процессе'}</span>
          </div>

          <div className="match-main-header">
            {/* Команда 1 */}
            <div className={`team-block team-left ${isCompleted && Number(score1) > Number(score2) ? 'winner' : ''}`}>
              <img 
                src={playersByTeam?.team1?.[0]?.avatar_url || '/default-avatar.png'} 
                alt={titleLeft}
                className="team-logo"
                onError={(e) => { e.target.src = '/default-avatar.png'; }}
              />
              <h2 className="team-name">{titleLeft}</h2>
            </div>

            {/* Счет */}
            <div className="match-score-block">
              <div className="match-score">
                <span className={`score ${isCompleted && Number(score1) > Number(score2) ? 'winner' : ''}`}>{score1}</span>
                <span className="score-separator">:</span>
                <span className={`score ${isCompleted && Number(score2) > Number(score1) ? 'winner' : ''}`}>{score2}</span>
              </div>
              <div className="match-format">
                {m.match_format?.toUpperCase() || 'BO1'}
              </div>
            </div>

            {/* Команда 2 */}
            <div className={`team-block team-right ${isCompleted && Number(score2) > Number(score1) ? 'winner' : ''}`}>
              <img 
                src={playersByTeam?.team2?.[0]?.avatar_url || '/default-avatar.png'} 
                alt={titleRight}
                className="team-logo"
                onError={(e) => { e.target.src = '/default-avatar.png'; }}
              />
              <h2 className="team-name">{titleRight}</h2>
            </div>
          </div>
        </div>

        {/* Блок управления матчем */}
        <div className="match-status-bar">
          <span className={`match-status ${isCompleted ? 'completed' : 'in-progress'}`}>
            {isCompleted ? 'Завершен' : 'В процессе'}
          </span>
          <div className="match-status-bar-buttons">
            {userIsAdmin && (
              <>
                {isCompleted ? (
                  <button 
                    className="btn btn-primary" 
                    onClick={handleEditMatch} 
                    title="Редактировать результат матча"
                  >
                    Редактировать матч
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary" 
                    onClick={handleCompleteMatch} 
                    title="Завершить матч и зафиксировать результат"
                    disabled={tournament?.status === 'completed'}
                  >
                    Завершить матч
                  </button>
                )}
                <button 
                  className="btn btn-secondary" 
                  onClick={handleImportStats} 
                  disabled={isImporting}
                  title="Импортировать статистику с игрового сервера"
                  style={{ marginLeft: '8px' }}
                >
                  {isImporting ? 'Импорт...' : '📥 Импорт статистики'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="match-stats-container">

        {/* Блок подключения показываем до завершения матча */}
        {!isCompleted && (m.connect || m.gotv) && (
          <div className="match-connect-container">
            <h3>Подключение</h3>
            {m.connect && (
              <div className="list-row">
                <div className="list-row-left">
                  <span>Игроки:</span>
                  <code className="code-inline">{m.connect}</code>
                </div>
                <div className="list-row-right">
                  <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(m.connect)}>Копировать</button>
                </div>
              </div>
            )}
            {m.gotv && (
              <div className="list-row match-connect-row">
                <div className="list-row-left">
                  <span>GOTV:</span>
                  <code className="code-inline">{m.gotv}</code>
                </div>
                <div className="list-row-right">
                  <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(m.gotv)}>Копировать</button>
                </div>
              </div>
            )}
          </div>
        )}

        <LeadersPanel leaders={lobbyStats.leaders} />

        <div className="match-compact-toggle compact-toggle">
          <button
            type="button"
            className={`toggle-switch ${compact ? 'on' : ''}`}
            aria-pressed={!!compact}
            onClick={() => { const next = !compact; setCompact(next); try { localStorage.setItem('match_compact_mode', String(next)); } catch(_) {} }}
            title={compact ? 'Переключить на подробный вид' : 'Переключить на компактный вид'}
          >
            <span className="toggle-track"><span className="toggle-thumb"></span></span>
            <span className="toggle-text">{compact ? 'Компактно' : 'Подробно'}</span>
          </button>
        </div>

        <ScoreTable title={`${titleLeft}`} rows={playersByTeam?.team1 || []} compact={compact} />
        <ScoreTable title={`${titleRight}`} rows={playersByTeam?.team2 || []} compact={compact} />

        {/* История бан/пик над картами */}
        {Array.isArray(pickban) && pickban.length > 0 && (
          <PickBanTimeline steps={pickban} />
        )}

        <MapsAccordion
          titleLeft={titleLeft}
          titleRight={titleRight}
          maps={maps}
          playersByMap={playersByMap}
          compact={compact}
        />
      </div>
      </>
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
                    <div className="match-status-bar-buttons">
                        {isAdminOrCreator && (
                            <>
                                {match.status === 'completed' ? (
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={handleEditMatch} 
                                        title="Редактировать результат матча"
                                    >
                                        Редактировать матч
                                    </button>
                                ) : (
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={handleCompleteMatch} 
                                        title="Завершить матч и зафиксировать результат"
                                        disabled={tournament?.status === 'completed'}
                                    >
                                        Завершить матч
                                    </button>
                                )}
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={handleImportStats} 
                                    disabled={isImporting}
                                    title="Импортировать статистику с игрового сервера"
                                    style={{ marginLeft: '8px' }}
                                >
                                    {isImporting ? 'Импорт...' : '📥 Импорт статистики'}
                                </button>
                            </>
                        )}
                        <button className="btn btn-secondary" onClick={() => setIsShareModalOpen(true)}>
                            Поделиться
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
                            <span className={`score ${match.winner_team_id === match.team1_id ? 'winner' : ''}`}>{displayedScores[0]}</span>
                            <span className="score-separator">:</span>
                            <span className={`score ${match.winner_team_id === match.team2_id ? 'winner' : ''}`}>{displayedScores[1]}</span>
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

            {/* Скелетоны и панель ожидания до прихода статистики */}
            {!lobbyStats && (
                <>
                    <SkeletonCards count={6} />
                    <div className="match-compact-toggle compact-toggle">
                        <label><input type="checkbox" checked={!!compact} onChange={(e)=>{ setCompact(e.target.checked); try { localStorage.setItem('match_compact_mode', String(e.target.checked)); } catch(_) {} }} /> Компактный режим таблиц</label>
                    </div>
                    <SkeletonTable rows={8} />
                    <div className="match-status-container">
                        <StatusPanel completedAt={null} onRefresh={() => setPollVersion(v => v + 1)} />
                    </div>
                </>
            )}

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
                                                    const base = getEditableMapsData();
                                                    // Обеспечиваем наличие выбранной карты в массиве
                                                    let mapsList = Array.isArray(base) ? [...base] : [];
                                                    const key = normalizeMapName(editingMapKey || current?.map_name || current?.map || current?.name);
                                                    let idx = (editingMapIndex != null) ? editingMapIndex : mapsList.findIndex(mm => normalizeMapName(mm.map_name || mm.map || mm.name) === key);
                                                    if (idx < 0) {
                                                        mapsList.push({ map_name: key, score1: null, score2: null });
                                                        idx = mapsList.length - 1;
                                                    }
                                                    mapsList = mapsList.map((mm, i) => i === idx ? { ...mm, score1: s1, score2: s2 } : mm);
                                                    const body = { maps_data: mapsList };
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

            {/* Итог считается автоматически по картам; отдельная серия-модалка не требуется */}
            
            {/* Pick & Ban — удалено, история интегрирована в маппул */}
            
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
            
            {/* ✏️ Модальное окно редактирования результата */}
            <EditMatchResultModal
                isOpen={isEditMatchModalOpen}
                onClose={() => setIsEditMatchModalOpen(false)}
                matchData={editMatchData}
                match={match}
                onSave={handleSaveEditedMatch}
                onDataChange={(updatedData) => {
                    // 🔴 LIVE обновление счета на странице при изменении в модальном окне
                    console.log('🔄 [MatchDetailsPage] Live обновление счета:', updatedData);
                    setMatch(prev => ({
                        ...prev,
                        score1: updatedData.score1,
                        score2: updatedData.score2,
                        winner_team_id: updatedData.winner_team_id,
                        maps_data: updatedData.maps_data
                    }));
                }}
            />
            
            {/* 🎮 FEEDBACK: Система обратной связи после матча */}
            {user && match && (
                <MatchFeedbackManager
                    matchId={match.id}
                    matchInfo={{
                        team1_name: match.team1_name,
                        team2_name: match.team2_name
                    }}
                    triggerShow={showFeedbackPrompt}
                    onComplete={() => setShowFeedbackPrompt(false)}
                />
            )}
        </div>
    );
};

export default MatchDetailsPage;