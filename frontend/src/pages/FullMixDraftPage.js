import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { getSocketInstance } from '../services/socketClient_v5_simplified';
import './FullMixDraftPage.css';

function FullMixDraftPage() {
    const { id } = useParams();
    const tournamentId = parseInt(id);
    const navigate = useNavigate();
    const location = useLocation();
    const initializedRef = useRef(false);

    const urlRound = useMemo(() => {
        try {
            const params = new URLSearchParams(location.search);
            const r = parseInt(params.get('round'), 10);
            return Number.isInteger(r) ? r : null;
        } catch (_) {
            return null;
        }
    }, [location.search]);

    const [round, setRound] = useState(1);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [message, setMessage] = useState('');
    const [approved, setApproved] = useState(false);

    // Генерация черновика матчей (после утверждения составов)
    const [matchesPreview, setMatchesPreview] = useState([]);
    const [matchTeamMap, setMatchTeamMap] = useState(new Map());
    const [matchesApproved, setMatchesApproved] = useState(false);
    const [eliminated, setEliminated] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [standingsMap, setStandingsMap] = useState(new Map());
    const [standingsByUser, setStandingsByUser] = useState(new Map());
    const [searchName, setSearchName] = useState('');

    const loadMatchesPreview = useCallback(async (r) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${r}/preview`);
            const item = res.data?.item || null;
            const mp = Array.isArray(item?.preview?.matches) ? item.preview.matches : [];
            setMatchesPreview(mp);
            const teamsArr = Array.isArray(item?.preview?.teams) ? item.preview.teams : [];
            const map = new Map();
            teamsArr.forEach(t => { if (t.team_id != null) map.set(String(t.team_id), t.name || `Команда ${t.team_id}`); });
            setMatchTeamMap(map);
        } catch (_) {
            setMatchesPreview([]);
            setMatchTeamMap(new Map());
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    const loadRounds = useCallback(async () => {
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/snapshots`);
            const items = (res.data?.items || []).sort((a, b) => a.round_number - b.round_number);
            setRounds(items);
            if (items.length > 0 && !initializedRef.current) {
                const numbers = items.map(i => i.round_number);
                const target = (Number.isInteger(urlRound) && numbers.includes(urlRound))
                    ? urlRound
                    : items[0].round_number;
                setRound(target);
                initializedRef.current = true;
            }
        } catch (_) {
            setRounds([]);
        }
    }, [tournamentId, urlRound]);

    const loadSnapshot = useCallback(async (r) => {
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${r}`);
            const item = res.data?.item || null;
            setSnapshot(item);
            setApproved(!!(item && item.approved_teams === true));
            setMatchesApproved(!!(item && item.approved_matches === true));
        } catch (_) {
            setSnapshot(null);
        }
    }, [tournamentId]);

    const loadEliminated = useCallback(async () => {
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/eliminated`);
            setEliminated(res.data?.items || []);
        } catch (_) {
            setEliminated([]);
        }
    }, [tournamentId]);

    const loadParticipants = useCallback(async () => {
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}`);
            const list = Array.isArray(res.data?.participants) ? res.data.participants : [];
            setParticipants(list);
        } catch (_) {
            setParticipants([]);
        }
    }, [tournamentId]);

    const loadStandings = useCallback(async () => {
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/standings`);
            const items = Array.isArray(res.data?.items) ? res.data.items : [];
            const byPid = new Map();
            const byUid = new Map();
            items.forEach(row => {
                const wins = Number(row.wins || 0);
                const losses = Number(row.losses || 0);
                const games = wins + losses;
                const participantId = row.participant_id ?? row.id;
                const userId = row.user_id ?? row.uid ?? row.participant_id ?? row.id;
                if (participantId != null) byPid.set(Number(participantId), { wins, losses, games });
                if (userId != null) byUid.set(Number(userId), { wins, losses, games });
            });
            setStandingsMap(byPid);
            setStandingsByUser(byUid);
        } catch (_) {
            setStandingsMap(new Map());
            setStandingsByUser(new Map());
        }
    }, [tournamentId]);

    const loadPreview = useCallback(async (r) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${r}/preview`);
            const item = res.data?.item || null;
            setPreview(item);
            // Если превью содержит матчи/справочник команд — заполняем список матчей
            if (item && item.preview) {
                const mp = Array.isArray(item.preview.matches) ? item.preview.matches : [];
                setMatchesPreview(mp);
                const teamsArr = Array.isArray(item.preview.teams) ? item.preview.teams : [];
                const map = new Map();
                teamsArr.forEach(t => { if (t.team_id != null) map.set(String(t.team_id), t.name || `Команда ${t.team_id}`); });
                setMatchTeamMap(map);
            }
            // Всегда подгружаем снапшот для получения approved-флагов и обогащения участников
            await loadSnapshot(r);
        } catch (e) {
            setPreview(null);
            await loadSnapshot(r);
        } finally {
            setLoading(false);
        }
    }, [tournamentId, loadSnapshot]);

    useEffect(() => {
        if (!tournamentId) return;
        loadRounds();
        loadEliminated();
        loadParticipants();
        loadStandings();
    }, [tournamentId, loadRounds, loadParticipants, loadStandings]);

    useEffect(() => {
        if (!tournamentId || !round) return;
        loadPreview(round);
        // Одновременно пытаемся подтянуть превью матчей, если оно есть
        loadMatchesPreview(round);
    }, [tournamentId, round, loadPreview, loadMatchesPreview]);

    // Реакция на смену параметра ?round= в URL (например, при навигации из панели)
    useEffect(() => {
        if (Number.isInteger(urlRound) && urlRound !== round) setRound(urlRound);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlRound]);

    useEffect(() => {
        const socket = getSocketInstance && getSocketInstance();
        if (!socket) return;
        const onPreviewUpdated = (payload) => {
            if (!payload || payload.tournamentId !== tournamentId) return;
            if (payload.round && payload.round === round) loadPreview(round);
        };
        const onElimUpdated = (payload) => {
            if (!payload) return;
            loadEliminated();
        };
        socket.on && socket.on('fullmix_preview_updated', onPreviewUpdated);
        socket.on && socket.on('fullmix_eliminated_updated', onElimUpdated);
        return () => {
            socket.off && socket.off('fullmix_preview_updated', onPreviewUpdated);
            socket.off && socket.off('fullmix_eliminated_updated', onElimUpdated);
        };
    }, [tournamentId, round, loadPreview, loadEliminated]);

    const createOrRegeneratePreview = useCallback(async () => {
        setMessage('Генерируем черновик...');
        setLoading(true);
        try {
            await api.post(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}/preview`, { mode: 'teams' });
            await loadPreview(round);
            setMessage('Черновик обновлен');
        } catch (e) {
            setMessage(e?.response?.data?.error || 'Ошибка генерации черновика');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 2000);
        }
    }, [tournamentId, round, loadPreview]);


    const regenerateMatchesPreview = useCallback(async () => {
        if (!approved) {
            setMessage('Сначала подтвердите составы команд');
            return;
        }
        // Для SE/DE матчи не превьюятся — составы фиксированных команд меняются отдельно
        try {
            const t = window.__CURRENT_TOURNAMENT__ || null;
            const bt = (t?.bracket_type || '').toString().toLowerCase();
            if (bt === 'single_elimination' || bt === 'double_elimination') {
                setMessage('Для SE/DE превью матчей не требуется — меняются только составы команд.');
                setTimeout(() => setMessage(''), 3000);
                return;
            }
        } catch (_) {}
        setMessage('Генерируем пары матчей...');
        setLoading(true);
        try {
            await api.post(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}/preview`, { mode: 'matches' });
            await loadMatchesPreview(round);
            setMessage('Пары матчей обновлены');
        } catch (e) {
            setMessage(e?.response?.data?.error || 'Ошибка генерации пар матчей');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 2000);
        }
    }, [tournamentId, round, approved, loadMatchesPreview]);

    const approveMatches = useCallback(async () => {
        if (!approved) {
            setMessage('Сначала подтвердите составы команд');
            return;
        }
        try {
            const t = window.__CURRENT_TOURNAMENT__ || null;
            const bt = (t?.bracket_type || '').toString().toLowerCase();
            if (bt === 'single_elimination' || bt === 'double_elimination') {
                setMessage('Для SE/DE подтверждение матчей не требуется.');
                setTimeout(() => setMessage(''), 3000);
                return;
            }
        } catch (_) {}
        if (!matchesPreview || matchesPreview.length === 0) {
            setMessage('Сгенерируйте пары матчей перед подтверждением');
            return;
        }
        setMessage('Подтверждаем пары матчей...');
        setLoading(true);
        try {
            await api.post(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}/approve`, { approveMatches: true });
            setMatchesApproved(true);
            setMessage('Матчи подтверждены');
            await loadSnapshot(round);
        } catch (e) {
            setMessage(e?.response?.data?.error || 'Ошибка подтверждения матчей');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 2000);
        }
    }, [tournamentId, round, matchesPreview, approved, loadSnapshot]);

    const approveTeams = useCallback(async () => {
        setMessage('Подтверждаем составы...');
        setLoading(true);
        try {
            // 🆕 Получаем данные турнира напрямую из API для точной проверки
            console.log('🔍 Проверяем тип сетки турнира...');
            const tournamentResponse = await api.get(`/api/tournaments/${tournamentId}`);
            const tournament = tournamentResponse.data;
            
            const bracketType = (tournament?.bracket_type || '').toString().toLowerCase();
            const isSEorDE = bracketType === 'single_elimination' || bracketType === 'double_elimination';
            
            console.log('📊 Тип турнира:', {
                bracket_type: tournament?.bracket_type,
                format: tournament?.format,
                mix_type: tournament?.mix_type,
                isSEorDE
            });
            
            if (isSEorDE) {
                // ДЛЯ SE/DE используем новый endpoint confirm-rosters
                console.log('🆕 SE/DE: используем endpoint confirm-rosters');
                await api.post(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}/confirm-rosters`);
            } else {
                // ДЛЯ SWISS используем старый endpoint approve
                console.log('🔄 Swiss: используем endpoint approve');
                await api.post(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}/approve`, { approveTeams: true });
            }
            
            setApproved(true);
            setMessage('Составы подтверждены и сохранены');
            await loadSnapshot(round);
        } catch (e) {
            console.error('❌ Ошибка подтверждения:', e);
            setMessage(e?.response?.data?.error || e?.response?.data?.message || 'Ошибка подтверждения');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [tournamentId, round, loadSnapshot]);

    const teams = useMemo(() => {
        const p = Array.isArray(preview?.preview?.teams) ? preview.preview.teams : [];
        const s = Array.isArray(snapshot?.snapshot?.teams) ? snapshot.snapshot.teams : [];
        if (p.length === 0) return s;
        const hasMembers = p.some(t => Array.isArray(t.members) && t.members.length > 0);
        if (hasMembers) return p;
        if (s.length === 0) return p;
        const byId = new Map(s.map(t => [t.team_id, t]));
        return p.map(t => {
            const src = byId.get(t.team_id);
            if (src && Array.isArray(src.members) && src.members.length > 0) {
                return { ...t, members: src.members };
            }
            return t;
        });
    }, [preview, snapshot]);

    // Карта имён команд из снапшота для отображения подтверждённых матчей
    const snapshotTeamNameMap = useMemo(() => {
        const map = new Map();
        const arr = Array.isArray(snapshot?.snapshot?.teams) ? snapshot.snapshot.teams : [];
        arr.forEach(t => {
            const name = t?.name || (t?.team_id != null ? `Команда ${t.team_id}` : undefined);
            const keys = [];
            if (t?.team_id != null) keys.push(String(t.team_id));
            if (t?.id != null) keys.push(String(t.id));
            keys.forEach(k => map.set(k, name));
        });
        return map;
    }, [snapshot]);

    // Источник матчей: если уже подтверждены — берём из снапшота, иначе из превью
    const matchesToShow = useMemo(() => {
        if (matchesApproved) {
            return Array.isArray(snapshot?.snapshot?.matches) ? snapshot.snapshot.matches : [];
        }
        return Array.isArray(matchesPreview) ? matchesPreview : [];
    }, [matchesApproved, snapshot, matchesPreview]);

    return (
        <div className="fullmixdraft-page" style={{ padding: 16 }}>
            <div className="fullmixdraft-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button className="btn btn-secondary" onClick={() => navigate(`/tournaments/${tournamentId}`)}>← Назад</button>
                <h2 className="fullmixdraft-title" style={{ margin: 0 }}>FullMix Черновик — Турнир #{tournamentId}</h2>
            </div>

            <div className="fullmixdraft-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className="fullmixdraft-round-label" style={{ color: '#ccc', fontSize: 13 }}>Раунды:</span>
                <div className="fullmixdraft-rounds" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(rounds.length > 0 ? rounds.map(r => r.round_number) : [1]).map(rn => (
                        <button
                            key={rn}
                            className={`fullmix-round-btn ${rn === round ? 'is-active' : ''}`}
                            disabled={rn === round}
                            onClick={() => setRound(rn)}
                        >
                            {rn}
                        </button>
                    ))}
                </div>
                {message && <span className="fullmixdraft-message" style={{ color: '#aaa', fontSize: 12 }}>{message}</span>}
            </div>

            {loading ? (
                <p className="fullmixdraft-loading">Загрузка...</p>
            ) : (
                <div className="fullmixdraft-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="fullmixdraft-teams" style={{ display: 'grid', gap: 12 }}>
                        <div className="fullmixdraft-teams-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button className="btn btn-secondary" disabled={loading || approved || matchesApproved} onClick={createOrRegeneratePreview}>Переформировать составы</button>
                            <button className="btn btn-primary" disabled={loading || teams.length === 0 || approved} onClick={approveTeams}>
                                {approved ? 'Составы подтверждены' : 'Подтвердить составы'}
                            </button>
                        </div>
                        {teams.length === 0 ? (
                            <div className="fullmixdraft-empty" style={{ padding: 24, border: '1px solid #1f1f1f', borderRadius: 8, background: '#0a0a0a' }}>
                                <p style={{ margin: 0 }}>Черновик пуст. Нажмите «Переформировать составы», чтобы сгенерировать черновик.</p>
                            </div>
                        ) : (
                            teams.map((team, idx) => (
                                <div key={team.id || idx} className="fullmixdraft-team-card" style={{ border: '1px solid #1f1f1f', borderRadius: 8, background: '#0a0a0a', padding: 12 }}>
                                    <div className="fullmixdraft-team-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <strong>{team.name || `Команда ${idx + 1}`}</strong>
                                        {Array.isArray(team.members) && <span style={{ color: '#888', fontSize: 12 }}>Игроков: {team.members.length}</span>}
                                    </div>
                                    <div className="fullmixdraft-team-members" style={{ display: 'grid', gap: 6 }}>
                                        {(team.members || []).map((m, j) => (
                                            <div key={m.id || j} className="fullmixdraft-team-member" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div className="fullmixdraft-team-member-avatar" style={{ width: 22, height: 22, borderRadius: '50%', background: '#222', display: 'inline-block' }} />
                                                <span className="fullmixdraft-team-member-name">{m.name || m.username || `Игрок ${j + 1}`}</span>
                                                {m.is_captain && <span className="fullmixdraft-team-member-captain" style={{ color: '#999', fontSize: 12 }}>(капитан)</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="fullmixdraft-matches" style={{ display: 'grid', gap: 12 }}>
                        <div className="fullmixdraft-matches-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button className="btn btn-secondary" onClick={regenerateMatchesPreview} disabled={!approved || loading || matchesApproved}>Переформировать пары матчей</button>
                            <button className="btn btn-primary" onClick={approveMatches} disabled={!approved || loading || matchesToShow.length === 0 || matchesApproved}>
                                {matchesApproved ? 'Матчи подтверждены' : 'Подтвердить матчи'}
                            </button>
                        </div>
                        {(!approved) && (
                            <div className="fullmixdraft-matches-note" style={{ color: '#aaa', fontSize: 12 }}>Сначала подтвердите составы команд, затем формируйте пары матчей.</div>
                        )}
                        {(approved && !matchesApproved && matchesToShow.length === 0) && (
                            <div className="fullmixdraft-matches-empty" style={{ color: '#aaa', fontSize: 12 }}>Пары матчей не сформированы.</div>
                        )}
                        {matchesToShow.length > 0 && (
                            <div className="fullmixdraft-matches-list" style={{ display: 'grid', gap: 8 }}>
                                {matchesToShow.map((p, i) => (
                                    <div key={i} className="fullmixdraft-match-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #1f1f1f', borderRadius: 8, padding: 10, background: '#0a0a0a' }}>
                                        <span>Матч {i + 1}</span>
                                        <span>
                                            {p.team1_name || snapshotTeamNameMap.get(String(p.team1_id)) || matchTeamMap.get(String(p.team1_id)) || `#${p.team1_id}`} 
                                            {' vs '} 
                                            {p.team2_name || snapshotTeamNameMap.get(String(p.team2_id)) || matchTeamMap.get(String(p.team2_id)) || `#${p.team2_id}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Админ-блок: управление статусами участников */}
                    <div className="fullmixdraft-eliminated" style={{ gridColumn: '1 / span 2', border: '1px solid #1f1f1f', borderRadius: 8, background: '#0a0a0a', padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
                            <strong>Участники и статусы</strong>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder="Поиск по нику"
                                    value={searchName}
                                    onChange={(e) => setSearchName(e.target.value)}
                                    style={{ background: '#000', color: '#fff', border: '1px solid #1f1f1f', borderRadius: 6, padding: '6px 8px', width: 260 }}
                                />
                                <button
                                    className="btn btn-secondary"
                                    onClick={async () => {
                                        try {
                                            setLoading(true);
                                            await api.post(`/api/tournaments/${tournamentId}/fullmix/eliminated/recover`);
                                            await Promise.all([loadEliminated(), loadParticipants(), loadStandings()]);
                                            setMessage('Восстановление завершено');
                                        } catch (e) {
                                            setMessage(e?.response?.data?.error || 'Ошибка восстановления');
                                        } finally {
                                            setLoading(false);
                                            setTimeout(() => setMessage(''), 2000);
                                        }
                                    }}
                                >Восстановить удалённых</button>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left' }}>
                                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #1f1f1f' }}>Участник</th>
                                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #1f1f1f' }}>G</th>
                                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #1f1f1f' }}>W</th>
                                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #1f1f1f' }}>L</th>
                                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #1f1f1f' }}>Статус</th>
                                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #1f1f1f', textAlign: 'right' }}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const elimSetByPid = new Set(eliminated.map(e => Number(e.participant_id)).filter(Number.isFinite));
                                        const elimSetByUid = new Set(eliminated.map(e => Number(e.user_id)).filter(Number.isFinite));
                                        const finalistsArr = Array.isArray(snapshot?.snapshot?.meta?.finalists) ? snapshot.snapshot.meta.finalists : [];
                                        const finSetPid = new Set(finalistsArr.map(v => Number(v.participant_id)).filter(Number.isFinite));
                                        const finSetUid = new Set(finalistsArr.map(v => Number(v.user_id)).filter(Number.isFinite));
                                        const presentByUid = new Set(participants.map(p => Number(p.user_id)).filter(Number.isFinite));
                                        const presentByPid = new Set(participants.map(p => Number(p.id)).filter(Number.isFinite));
                                        const extrasUsers = eliminated
                                            .filter(e => {
                                                const uid = Number(e.user_id);
                                                return Number.isFinite(uid) && !presentByUid.has(uid);
                                            })
                                            .map(e => ({ id: -Math.abs(Number(e.user_id)), user_id: Number(e.user_id), username: e.username, avatar_url: null }));
                                        const extrasParticipants = eliminated
                                            .filter(e => {
                                                const pid = Number(e.participant_id);
                                                return Number.isFinite(pid) && !presentByPid.has(pid);
                                            })
                                            .map(e => ({ id: -100000 - Math.abs(Number(e.participant_id)), user_id: null, username: e.username, avatar_url: null, participant_id: Number(e.participant_id) }));
                                        const rowsAll = [...participants, ...extrasUsers, ...extrasParticipants];
                                        const filtered = rowsAll.filter(p => {
                                            const name = (p.username || p.name || '').toString().toLowerCase();
                                            const q = searchName.trim().toLowerCase();
                                            if (!q) return true;
                                            return name.includes(q);
                                        });
                                        return filtered.map(p => {
                                            const stat = standingsMap.get(p.id) || standingsByUser.get(p.user_id) || { wins: 0, losses: 0, games: 0 };
                                            const pidVal = Number(p.id ?? p.participant_id);
                                            const isElim = elimSetByPid.has(pidVal) || elimSetByUid.has(p.user_id);
                                            const isFinal = finSetPid.has(pidVal) || finSetUid.has(p.user_id);
                                            const status = isFinal ? 'финалист' : (isElim ? 'исключен' : 'играет');
                                            const onExclude = async () => {
                                                try {
                                                    await api.post(`/api/tournaments/${tournamentId}/fullmix/eliminated`, { user_ids: [p.user_id] });
                                                    await loadEliminated();
                                                } catch (_) {}
                                            };
                                            const onReturn = async () => {
                                                try {
                                                    await api.delete(`/api/tournaments/${tournamentId}/fullmix/eliminated`, { data: { user_ids: [p.user_id] } });
                                                    await loadEliminated();
                                                } catch (_) {}
                                            };
                                            const onRowClick = async () => {
                                                if (isElim) await onReturn(); else await onExclude();
                                            };
                                            return (
                                                <tr key={p.id} onClick={onRowClick} style={{ cursor: 'pointer' }}>
                                                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #111' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <img src={p.avatar_url || '/images/avatars/default.svg'} alt="avatar" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', background: '#222' }} />
                                                            <span style={isElim ? { textDecoration: 'line-through' } : undefined}>{p.username || p.name || `ID ${p.id}`}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #111' }}>{stat.games}</td>
                                                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #111' }}>{stat.wins}</td>
                                                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #111' }}>{stat.losses}</td>
                                                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #111', textTransform: 'capitalize' }}>{status}</td>
                                                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #111', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                                        <button className="btn btn-secondary" style={{ marginRight: 8 }} onClick={onExclude} disabled={isElim}>Исключить</button>
                                                        <button className="btn btn-secondary" onClick={onReturn} disabled={!isElim}>Вернуть</button>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FullMixDraftPage;
