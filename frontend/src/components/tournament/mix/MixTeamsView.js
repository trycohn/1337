import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import MixTeamCard from './MixTeamCard';
import api from '../../../utils/api';
import { getSocketInstance } from '../../../services/socketClient_v5_simplified';

function MixTeamsView({ tournament, teams = [], isLoading = false, isAdminOrCreator = false }) {
    const tournamentId = tournament?.id;
    const formatNorm = (tournament?.format || '').toString().trim().toLowerCase();
    const mixTypeNorm = (tournament?.mix_type || '').toString().trim().toLowerCase();
    const isFullMix = formatNorm === 'full_mix' || (formatNorm === 'mix' && mixTypeNorm === 'full');
    const [rounds, setRounds] = useState([]);
    const [currentRound, setCurrentRound] = useState(null);
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
        if (!isFullMix || !tournamentId) return;
        if (!currentRound || rounds.length === 0) return;
        loadSnapshot(currentRound);
    }, [isFullMix, tournamentId, currentRound, rounds.length, loadSnapshot]);

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

    // Команды лежат внутри item.snapshot.teams (JSONB из БД)
    const fullMixTeams = useMemo(() => (snapshot?.snapshot?.teams || snapshot?.teams || []), [snapshot]);
    const isApprovedTeams = !!(snapshot && snapshot.approved_teams === true);
    // Упрощаем: для Full Mix показываем только утвержденные команды из снапшота,
    // черновики не отображаем здесь (переносим в отдельную страницу)
    const teamsToRender = isFullMix ? (isApprovedTeams ? fullMixTeams : []) : teams;

    const [actionMessage, setActionMessage] = useState('');
    const [busy, setBusy] = useState(false);

    // Убираем подтверждение/переформирование из этого компонента — всё на странице черновика

    const openDraftPage = useCallback(() => {
        const id = tournament?.id;
        if (!id) return;
        window.open(`/tournaments/${id}/fullmix/draft`, '_blank');
    }, [tournament?.id]);

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

    // Для Full Mix не делаем ранний return, чтобы показывать панель управления даже без команд
    if (!isFullMix && (!Array.isArray(teams) || teams.length === 0)) {
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
                    <div className="fullmixdraft-rounds" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {rounds.map(r => (
                            <button key={r.round_number} className={`fullmix-round-btn ${r.round_number === currentRound ? 'is-active' : ''}`} disabled={r.round_number === currentRound} onClick={() => setCurrentRound(r.round_number)}>
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
                            <button className="btn btn-secondary" onClick={openDraftPage}>Открыть черновик</button>
                            {actionMessage && <span style={{ color: '#aaa', fontSize: 12 }}>{actionMessage}</span>}
                        </div>
                    )}
                </div>
            )}

            {isFullMix && teamsToRender.length === 0 ? (
                <div className="no-teams-message-mixteams">
                    <h4>Команды еще не сформированы</h4>
                    <p>Для управления черновиком используйте кнопку «Открыть черновик».</p>
                </div>
            ) : (
                <div className="mixed-teams-grid-mixteams">
                    {teamsToRender.map((team, idx) => (
                        <MixTeamCard key={team.id || idx} team={team} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default MixTeamsView;


