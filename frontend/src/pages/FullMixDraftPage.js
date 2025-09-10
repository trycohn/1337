import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getSocketInstance } from '../services/socketClient_v5_simplified';
import './FullMixDraftPage.css';

function FullMixDraftPage() {
    const { id } = useParams();
    const tournamentId = parseInt(id);
    const navigate = useNavigate();

    const [round, setRound] = useState(1);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [message, setMessage] = useState('');
    const [approved, setApproved] = useState(false);

    const loadRounds = useCallback(async () => {
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/snapshots`);
            const items = (res.data?.items || []).sort((a, b) => a.round_number - b.round_number);
            setRounds(items);
            if (items.length > 0) setRound(items[items.length - 1].round_number);
        } catch (_) {
            setRounds([]);
        }
    }, [tournamentId]);

    const loadSnapshot = useCallback(async (r) => {
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${r}`);
            const item = res.data?.item || null;
            setSnapshot(item);
            if (item && item.approved_teams === true) setApproved(true);
        } catch (_) {
            setSnapshot(null);
        }
    }, [tournamentId]);

    const loadPreview = useCallback(async (r) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${r}/preview`);
            const item = res.data?.item || null;
            setPreview(item);
            setApproved(false);
            if (!item) {
                // Если черновик отсутствует (после approve), показываем утверждённый снапшот
                await loadSnapshot(r);
            } else {
                // Сбрасываем снапшот, если отображаем черновик
                setSnapshot(null);
            }
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
    }, [tournamentId, loadRounds]);

    useEffect(() => {
        if (!tournamentId || !round) return;
        loadPreview(round);
    }, [tournamentId, round, loadPreview]);

    useEffect(() => {
        const socket = getSocketInstance && getSocketInstance();
        if (!socket) return;
        const onPreviewUpdated = (payload) => {
            if (!payload || payload.tournamentId !== tournamentId) return;
            if (payload.round && payload.round === round) loadPreview(round);
        };
        socket.on && socket.on('fullmix_preview_updated', onPreviewUpdated);
        return () => socket.off && socket.off('fullmix_preview_updated', onPreviewUpdated);
    }, [tournamentId, round, loadPreview]);

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

    // Генерация черновика матчей (после утверждения составов)
    const [matchesPreview, setMatchesPreview] = useState([]);
    const [matchTeamMap, setMatchTeamMap] = useState(new Map());
    const [matchesApproved, setMatchesApproved] = useState(false);

    const loadMatchesPreview = useCallback(async (r) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${r}/preview`);
            const item = res.data?.item || null;
            const mp = Array.isArray(item?.preview?.matches) ? item.preview.matches : [];
            setMatchesPreview(mp);
            const teamsArr = Array.isArray(item?.preview?.teams) ? item.preview.teams : [];
            const map = new Map();
            teamsArr.forEach(t => { if (t.team_id) map.set(t.team_id, t.name || `Команда ${t.team_id}`); });
            setMatchTeamMap(map);
        } catch (_) {
            setMatchesPreview([]);
            setMatchTeamMap(new Map());
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    const regenerateMatchesPreview = useCallback(async () => {
        if (!approved) {
            setMessage('Сначала подтвердите составы команд');
            return;
        }
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
            await api.post(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}/approve`, { approveTeams: true });
            setApproved(true);
            setMessage('Составы подтверждены');
            await loadSnapshot(round);
        } catch (e) {
            setMessage(e?.response?.data?.error || 'Ошибка подтверждения');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 2000);
        }
    }, [tournamentId, round, loadSnapshot]);

    const teams = useMemo(() => (
        (preview?.preview?.teams) || (snapshot?.snapshot?.teams) || []
    ), [preview, snapshot]);

    return (
        <div className="fullmixdraft-page" style={{ padding: 16 }}>
            <div className="fullmixdraft-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Назад</button>
                <h2 className="fullmixdraft-title" style={{ margin: 0 }}>FullMix Черновик — Турнир #{tournamentId}</h2>
            </div>

            <div className="fullmixdraft-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className="fullmixdraft-round-label" style={{ color: '#ccc', fontSize: 13 }}>Раунды:</span>
                <div className="fullmixdraft-rounds" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(rounds.length > 0 ? rounds.map(r => r.round_number) : [1]).map(rn => (
                        <button
                            key={rn}
                            className={`btn ${rn === round ? 'btn-primary' : 'btn-secondary'}`}
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
            ) : teams.length === 0 ? (
                <div className="fullmixdraft-empty" style={{ padding: 24, border: '1px solid #1f1f1f', borderRadius: 8, background: '#0a0a0a' }}>
                    <p style={{ margin: 0 }}>Черновик пуст. Нажмите «Переформировать составы», чтобы сгенерировать черновик.</p>
                </div>
            ) : (
                <div className="fullmixdraft-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="fullmixdraft-teams" style={{ display: 'grid', gap: 12 }}>
                        <div className="fullmixdraft-teams-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button className="btn btn-secondary" disabled={loading} onClick={createOrRegeneratePreview}>Переформировать составы</button>
                            <button className="btn btn-primary" disabled={loading || teams.length === 0 || approved} onClick={approveTeams}>
                                {approved ? 'Составы подтверждены' : 'Подтвердить составы'}
                            </button>
                        </div>
                        {teams.map((team, idx) => (
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
                        ))}
                    </div>
                    <div className="fullmixdraft-matches" style={{ display: 'grid', gap: 12 }}>
                        <div className="fullmixdraft-matches-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button className="btn btn-secondary" onClick={regenerateMatchesPreview} disabled={!approved || loading}>Переформировать пары матчей</button>
                            <button className="btn btn-primary" onClick={approveMatches} disabled={!approved || loading || matchesPreview.length === 0 || matchesApproved}>
                                {matchesApproved ? 'Матчи подтверждены' : 'Подтвердить матчи'}
                            </button>
                        </div>
                        {(!approved) && (
                            <div className="fullmixdraft-matches-note" style={{ color: '#aaa', fontSize: 12 }}>Сначала подтвердите составы команд, затем формируйте пары матчей.</div>
                        )}
                        {(approved && matchesPreview.length === 0) && (
                            <div className="fullmixdraft-matches-empty" style={{ color: '#aaa', fontSize: 12 }}>Пары матчей не сформированы.</div>
                        )}
                        {matchesPreview.length > 0 && (
                            <div className="fullmixdraft-matches-list" style={{ display: 'grid', gap: 8 }}>
                                {matchesPreview.map((p, i) => (
                                    <div key={i} className="fullmixdraft-match-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #1f1f1f', borderRadius: 8, padding: 10, background: '#0a0a0a' }}>
                                        <span>Матч {i + 1}</span>
                                        <span>{matchTeamMap.get(p.team1_id) || `#${p.team1_id}`} vs {matchTeamMap.get(p.team2_id) || `#${p.team2_id}`}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default FullMixDraftPage;
