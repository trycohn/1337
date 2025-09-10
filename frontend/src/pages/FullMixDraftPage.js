import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getSocketInstance } from '../services/socketClient_v5_simplified';

function FullMixDraftPage() {
    const { id } = useParams();
    const tournamentId = parseInt(id);
    const navigate = useNavigate();

    const [round, setRound] = useState(1);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [message, setMessage] = useState('');

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

    const loadPreview = useCallback(async (r) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${r}/preview`);
            setPreview(res.data?.item || null);
        } catch (e) {
            setPreview(null);
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

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
            await api.post(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}/preview`, {});
            await loadPreview(round);
            setMessage('Черновик обновлен');
        } catch (e) {
            setMessage(e?.response?.data?.error || 'Ошибка генерации черновика');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 2000);
        }
    }, [tournamentId, round, loadPreview]);

    const approveTeams = useCallback(async () => {
        setMessage('Подтверждаем составы...');
        setLoading(true);
        try {
            await api.post(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}/approve`, { approveTeams: true });
            setMessage('Составы подтверждены');
        } catch (e) {
            setMessage(e?.response?.data?.error || 'Ошибка подтверждения');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 2000);
        }
    }, [tournamentId, round]);

    const teams = useMemo(() => (preview?.preview?.teams || []), [preview]);

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Назад</button>
                <h2 style={{ margin: 0 }}>FullMix Черновик — Турнир #{tournamentId}</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ color: '#ccc', fontSize: 13 }}>Раунд:</span>
                <select value={round} onChange={e => setRound(parseInt(e.target.value))} className="input">
                    {(rounds.length > 0 ? rounds.map(r => r.round_number) : [1]).map(rn => (
                        <option key={rn} value={rn}>{rn}</option>
                    ))}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" disabled={loading} onClick={createOrRegeneratePreview}>Переформировать составы</button>
                    <button className="btn btn-primary" disabled={loading || teams.length === 0} onClick={approveTeams}>Подтвердить составы</button>
                </div>
                {message && <span style={{ color: '#aaa', fontSize: 12 }}>{message}</span>}
            </div>

            {loading ? (
                <p>Загрузка...</p>
            ) : teams.length === 0 ? (
                <div style={{ padding: 24, border: '1px solid #1f1f1f', borderRadius: 8, background: '#0a0a0a' }}>
                    <p style={{ margin: 0 }}>Черновик пуст. Нажмите «Переформировать составы», чтобы сгенерировать черновик.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                    {teams.map((team, idx) => (
                        <div key={team.id || idx} style={{ border: '1px solid #1f1f1f', borderRadius: 8, background: '#0a0a0a', padding: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <strong>{team.name || `Команда ${idx + 1}`}</strong>
                                {Array.isArray(team.members) && <span style={{ color: '#888', fontSize: 12 }}>Игроков: {team.members.length}</span>}
                            </div>
                            <div style={{ display: 'grid', gap: 6 }}>
                                {(team.members || []).map((m, j) => (
                                    <div key={m.id || j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#222', display: 'inline-block' }} />
                                        <span>{m.name || m.username || `Игрок ${j + 1}`}</span>
                                        {m.is_captain && <span style={{ color: '#999', fontSize: 12 }}>(капитан)</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default FullMixDraftPage;
