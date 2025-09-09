import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import MixTeamCard from './MixTeamCard';
import api from '../../../utils/api';
import { getSocketInstance } from '../../../services/socketClient_v5_simplified';

function MixTeamsView({ tournament, teams = [], isLoading = false, isAdminOrCreator = false }) {
    const tournamentId = tournament?.id;
    const isFullMix = tournament?.format === 'mix' && (tournament?.mix_type || '').toLowerCase() === 'full';
    const [rounds, setRounds] = useState([]);
    const [currentRound, setCurrentRound] = useState(1);
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadRounds = useCallback(async () => {
        if (!isFullMix) return;
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/snapshots`);
            const items = (res.data?.items || []).sort((a,b) => a.round_number - b.round_number);
            setRounds(items);
            if (items.length > 0) setCurrentRound(items[items.length - 1].round_number);
        } catch (e) {
            console.warn('[FullMix] Не удалось загрузить список раундов:', e?.message || e);
            setRounds([]);
        }
    }, [tournamentId, isFullMix]);

    const loadSnapshot = useCallback(async (round) => {
        if (!isFullMix) return;
        setLoading(true);
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}`);
            setSnapshot(res.data?.item || null);
        } catch (e) {
            console.warn('[FullMix] Не удалось загрузить снапшот раунда:', e?.message || e);
            setSnapshot(null);
        } finally {
            setLoading(false);
        }
    }, [tournamentId, isFullMix]);

    useEffect(() => {
        if (!isFullMix || !tournamentId) return;
        loadRounds();
    }, [isFullMix, tournamentId, loadRounds]);

    useEffect(() => {
        if (!isFullMix || !tournamentId || !currentRound) return;
        loadSnapshot(currentRound);
    }, [isFullMix, tournamentId, currentRound, loadSnapshot]);

    useEffect(() => {
        if (!isFullMix) return;
        const socket = getSocketInstance && getSocketInstance();
        if (!socket || !tournamentId) return;
        const onRoundCompleted = (payload) => {
            if (!payload || payload.round == null) return;
            loadRounds();
            loadSnapshot(payload.round);
        };
        socket.on('fullmix_round_completed', onRoundCompleted);
        return () => {
            socket.off && socket.off('fullmix_round_completed', onRoundCompleted);
        };
    }, [isFullMix, tournamentId, loadRounds, loadSnapshot]);

    const fullMixTeams = useMemo(() => (snapshot?.teams || []), [snapshot]);
    const teamsToRender = isFullMix ? fullMixTeams : teams;

    const [actionMessage, setActionMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const approveTeams = useCallback(async () => {
        if (!isFullMix || !currentRound) return;
        setBusy(true);
        setActionMessage('Подтверждаем составы...');
        try {
            await api.post(`/api/tournaments/${tournamentId}/fullmix/rounds/${currentRound}/approve`, { approveTeams: true });
            await loadSnapshot(currentRound);
            setActionMessage('Составы подтверждены');
        } catch (_) {
            setActionMessage('Ошибка подтверждения');
        } finally {
            setBusy(false);
            setTimeout(() => setActionMessage(''), 2500);
        }
    }, [isFullMix, currentRound, tournamentId, loadSnapshot]);

    const reshuffleTeams = useCallback(async () => {
        if (!isFullMix || !currentRound) return;
        setBusy(true);
        setActionMessage('Переформируем команды...');
        try {
            await api.post(`/api/tournaments/${tournamentId}/fullmix/generate-next`, { forceReshuffle: true, targetRound: currentRound });
            await loadSnapshot(currentRound);
            setActionMessage('Команды переформированы');
        } catch (_) {
            setActionMessage('Ошибка переформирования');
        } finally {
            setBusy(false);
            setTimeout(() => setActionMessage(''), 2500);
        }
    }, [isFullMix, currentRound, tournamentId, loadSnapshot]);

    const startFirstRound = useCallback(async () => {
        if (!isFullMix) return;
        setBusy(true);
        setActionMessage('Формируем команды для 1 раунда...');
        try {
            await api.post(`/api/tournaments/${tournamentId}/fullmix/start`, {});
            await loadRounds();
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/snapshots`);
            const items = (res.data?.items || []).sort((a,b) => a.round_number - b.round_number);
            const last = items.length > 0 ? items[items.length - 1].round_number : 1;
            setCurrentRound(last);
            await loadSnapshot(last);
            setActionMessage('Команды первого раунда созданы');
        } catch (_) {
            setActionMessage('Ошибка формирования команд');
        } finally {
            setBusy(false);
            setTimeout(() => setActionMessage(''), 2500);
        }
    }, [isFullMix, tournamentId, loadRounds, loadSnapshot]);
    if (isLoading || loading) {
        return (
            <SkeletonTheme baseColor="#2a2a2a" highlightColor="#3a3a3a">
                <div className="teams-display-mixteams">
                    <div className="mixed-teams-grid-mixteams">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="mixteam-card-skeleton" style={{ padding: 16, border: '1px solid #1f1f1f', borderRadius: 8, background: '#0a0a0a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <Skeleton circle width={32} height={32} />
                                    <Skeleton width={160} height={16} />
                                </div>
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {[...Array(4)].map((__, j) => (
                                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Skeleton circle width={24} height={24} />
                                            <Skeleton width={160} height={16} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </SkeletonTheme>
        );
    }

    if ((!isFullMix && (!Array.isArray(teams) || teams.length === 0)) || (isFullMix && teamsToRender.length === 0)) {
        return (
            <div className="no-teams-message-mixteams">
                <h4>Команды еще не сформированы</h4>
                <p>Как только организатор сформирует команды, они появятся здесь.</p>
            </div>
        );
    }

    return (
        <div className="teams-display-mixteams">
            {isFullMix && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span style={{ color: '#ccc', fontSize: 13 }}>Раунды:</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {rounds.map(r => (
                            <button key={r.round_number} className={`btn ${r.round_number === currentRound ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentRound(r.round_number)}>
                                {r.round_number}
                            </button>
                        ))}
                        {rounds.length === 0 && <span style={{ color: '#888' }}>Нет раундов</span>}
                    </div>
                    {isAdminOrCreator && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {rounds.length === 0 && (
                                <button className="btn btn-primary" disabled={busy} onClick={startFirstRound}>Сформировать команды для 1 раунда</button>
                            )}
                            <button className="btn btn-primary" disabled={busy} onClick={approveTeams}>Подтвердить составы</button>
                            <button className="btn btn-secondary" disabled={busy} onClick={reshuffleTeams}>Переформировать</button>
                            {actionMessage && <span style={{ color: '#aaa', fontSize: 12 }}>{actionMessage}</span>}
                        </div>
                    )}
                </div>
            )}

            <div className="mixed-teams-grid-mixteams">
                {teamsToRender.map((team, idx) => (
                    <MixTeamCard key={team.id || idx} team={team} />
                ))}
            </div>
        </div>
    );
}

export default MixTeamsView;


