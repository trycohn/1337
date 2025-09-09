import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../utils/api';
import { getSocketInstance } from '../../../services/socketClient_v5_simplified';

function FullMixParticipantsPanel({ tournament, isAdminOrCreator }) {
    const tournamentId = tournament?.id;
    const [rounds, setRounds] = useState([]);
    const [currentRound, setCurrentRound] = useState(1);
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadRounds = useCallback(async () => {
        const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/snapshots`);
        const items = (res.data?.items || []).sort((a,b) => a.round_number - b.round_number);
        setRounds(items);
        if (items.length > 0) setCurrentRound(items[items.length - 1].round_number);
    }, [tournamentId]);

    const loadSnapshot = useCallback(async (round) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}`);
            setSnapshot(res.data?.item || null);
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => {
        if (!tournamentId) return;
        loadRounds();
    }, [tournamentId, loadRounds]);

    useEffect(() => {
        if (!tournamentId || !currentRound) return;
        loadSnapshot(currentRound);
    }, [tournamentId, currentRound, loadSnapshot]);

    // Live updates: обновляем список при завершении раунда
    useEffect(() => {
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
    }, [tournamentId, loadRounds, loadSnapshot]);

    const teams = useMemo(() => snapshot?.snapshot?.teams || snapshot?.teams || [], [snapshot]);
    const isApprovedTeams = !!(snapshot && snapshot.approved_teams === true);
    const canSeeTeams = isAdminOrCreator || isApprovedTeams;

    // Управление составами перенесено на вкладку "MIX команды"

    return (
        <div className="fullmix-participants-panel" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0 }}>Сформированные команды</h4>
                <span style={{ color: '#aaa', fontSize: 13 }}>Раунды:</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {rounds.map(r => (
                        <button
                            key={r.round_number}
                            className={`btn ${r.round_number === currentRound ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setCurrentRound(r.round_number)}
                        >
                            {r.round_number}
                        </button>
                    ))}
                    {rounds.length === 0 && <span style={{ color: '#888' }}>Нет раундов</span>}
                </div>
            </div>

            {/* Управление составами скрыто на вкладке "Участники" (только информирование) */}

            <div style={{ display: 'grid', gap: 10 }}>
                {loading ? (
                    <div style={{ color: '#888' }}>Загрузка команд...</div>
                ) : !canSeeTeams ? (
                    <div style={{ color: '#888' }}>Составы раунда ожидают подтверждения организатором</div>
                ) : teams.length === 0 ? (
                    <div style={{ color: '#888' }}>Команды не сформированы</div>
                ) : (
                    teams.map(team => (
                        <div key={team.id} style={{ background: '#000', border: '1px solid #1D1D1D', borderRadius: 8, padding: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1d1d1d' }} />
                                    <strong>{team.name || `Команда ${team.id}`}</strong>
                                </div>
                                <div style={{ color: '#aaa', fontSize: 12 }}>R{currentRound}</div>
                            </div>
                            <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                                {(team.members || []).map(m => (
                                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <img
                                                src={m.avatar_url || '/uploads/avatars/preloaded/circle-user.svg'}
                                                alt={m.display_name || m.username || m.name}
                                                style={{ width: 24, height: 24, borderRadius: '50%' }}
                                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/uploads/avatars/preloaded/circle-user.svg'; }}
                                            />
                                            <span>{m.display_name || m.username || m.name}</span>
                                            {m.is_captain && <span style={{ color: '#ff0000', fontSize: 12, marginLeft: 4 }}>капитан</span>}
                                        </div>
                                        <div style={{ color: '#aaa', fontSize: 12 }}>
                                            {m.faceit_elo ? `FACEIT: ${m.faceit_elo}` : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default FullMixParticipantsPanel;


