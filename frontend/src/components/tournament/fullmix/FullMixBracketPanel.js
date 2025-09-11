import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../../../utils/api';
import { getSocketInstance, authenticateSocket } from '../../../services/socketClient_v5_simplified';
import './FullMixBracketPanel.css';

function FullMixBracketPanel({ tournament, isAdminOrCreator }) {
    const tournamentId = tournament?.id;
    const [rounds, setRounds] = useState([]); // [{round_number, approved_teams, approved_matches}]
    const [currentRound, setCurrentRound] = useState(1);
    const [snapshot, setSnapshot] = useState(null); // {teams, matches, standings, meta}
    const [liveStandings, setLiveStandings] = useState([]);
    const [settings, setSettings] = useState(null); // {wins_to_win, rating_mode}
    const [participantsCount, setParticipantsCount] = useState(null);
    const [loading, setLoading] = useState(false);
    const [approving, setApproving] = useState(false);
    const [actionMessage, setActionMessage] = useState('');

    const loadSettings = useCallback(async () => {
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/settings`);
            setSettings(res.data?.settings || null);
        } catch (_) {}
    }, [tournamentId]);

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

    const loadParticipantsCount = useCallback(async () => {
        try {
            // Получаем оригинальный пул участников турнира
            const res = await api.get(`/api/tournaments/${tournamentId}/original-participants`);
            const total = res.data?.total || res.data?.participants?.length || null;
            setParticipantsCount(total);
        } catch (_) {}
    }, [tournamentId]);

    const loadStandings = useCallback(async () => {
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/standings`);
            try { console.log('[FullMix] loadStandings -> rows:', Array.isArray(res.data?.standings) ? res.data.standings.length : 'n/a'); } catch (_) {}
            setLiveStandings(res.data?.standings || []);
        } catch (_) {
            try { console.warn('[FullMix] loadStandings failed'); } catch (_) {}
            setLiveStandings([]);
        }
    }, [tournamentId]);

    useEffect(() => {
        if (!tournamentId) return;
        loadSettings();
        loadRounds();
        loadParticipantsCount();
        loadStandings();
    }, [tournamentId, loadSettings, loadRounds, loadParticipantsCount, loadStandings]);

    useEffect(() => {
        if (!tournamentId || !currentRound) return;
        loadSnapshot(currentRound);
        loadStandings();
    }, [tournamentId, currentRound, loadSnapshot, loadStandings]);

    // Live updates via Socket.IO
    useEffect(() => {
        const socket = getSocketInstance && getSocketInstance();
        if (!socket || !tournamentId) return;
        // Гарантируем вступление в комнату после установления соединения/переподключения
        const joinRoom = () => {
            try { socket.emit && socket.emit('join_tournament', tournamentId); } catch (_) {}
        };
        // 🛡️ Авторизация сокета, если есть токен
        try {
            const token = localStorage.getItem('token');
            if (token && (!socket.auth || socket.auth.token !== token)) {
                authenticateSocket(token);
            }
        } catch (_) {}
        if (socket.connected) joinRoom();
        socket.on && socket.on('connect', joinRoom);

        const onRoundCompleted = (payload) => {
            if (!payload || payload.round == null) return;
            try { console.log('[FullMix] socket fullmix_round_completed', payload); } catch (_) {}
            loadRounds();
            loadSnapshot(payload.round);
            loadStandings();
        };
        const onMatchUpdated = (payload) => {
            if (!payload) return;
            try { console.log('[FullMix] socket fullmix_match_updated', payload); } catch (_) {}
            loadRounds();
            loadSnapshot(currentRound || payload.round);
            loadStandings();
        };
        socket.on('fullmix_round_completed', onRoundCompleted);
        socket.on('fullmix_match_updated', onMatchUpdated);
        return () => {
            socket.off && socket.off('connect', joinRoom);
            socket.off && socket.off('fullmix_round_completed', onRoundCompleted);
            socket.off && socket.off('fullmix_match_updated', onMatchUpdated);
        };
    }, [tournamentId, currentRound, loadRounds, loadSnapshot, loadStandings]);

    // 🔁 Резервный поллинг, если сокет недоступен или соединение потеряно
    useEffect(() => {
        const socket = getSocketInstance && getSocketInstance();
        if (!tournamentId) return;
        let intervalId = null;
        const startPolling = () => {
            if (intervalId) return;
            intervalId = setInterval(() => {
                loadStandings();
                if (currentRound) loadSnapshot(currentRound);
            }, 7000);
        };
        const stopPolling = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };
        const handleConnect = () => stopPolling();
        const handleDisconnect = () => startPolling();
        if (!socket || !socket.connected) startPolling();
        socket && socket.on && socket.on('connect', handleConnect);
        socket && socket.on && socket.on('disconnect', handleDisconnect);
        return () => {
            stopPolling();
            socket && socket.off && socket.off('connect', handleConnect);
            socket && socket.off && socket.off('disconnect', handleDisconnect);
        };
    }, [tournamentId, currentRound, loadSnapshot, loadStandings]);

    const onApprove = useCallback(async (type) => {
        if (!currentRound) return;
        setApproving(true);
        try {
            const payload = { approveTeams: type === 'teams', approveMatches: type === 'matches' };
            await api.post(`/api/tournaments/${tournamentId}/fullmix/rounds/${currentRound}/approve`, payload);
            await loadRounds();
            await loadSnapshot(currentRound);
        } finally {
            setApproving(false);
        }
    }, [tournamentId, currentRound, loadRounds, loadSnapshot]);

    const isFull = useMemo(() => (tournament?.mix_type || '').toLowerCase() === 'full', [tournament?.mix_type]);
    const ratingDisplay = useMemo(() => {
        const map = { random: 'Random', rating: 'По рейтингу' };
        return map[(settings?.rating_mode || 'random')] || 'Random';
    }, [settings?.rating_mode]);

    const teams = snapshot?.teams || [];
    const matches = snapshot?.matches || [];
    const standings = (liveStandings && liveStandings.length > 0) ? liveStandings : (snapshot?.standings || []);
    const sortedStandings = useMemo(() => {
        const arr = Array.isArray(standings) ? [...standings] : [];
        return arr.sort((a, b) => {
            const dw = (b.wins || 0) - (a.wins || 0);
            if (dw !== 0) return dw;
            const dl = (a.losses || 0) - (b.losses || 0);
            if (dl !== 0) return dl;
            return (a.username || '').localeCompare(b.username || '');
        });
    }, [standings]);
    const meta = snapshot?.meta || {};
    const finalistsSet = new Set((meta.finalists || []).map(id => parseInt(id, 10)));
    const eliminatedSet = new Set((meta.eliminated || []).map(id => parseInt(id, 10)));
    const notInTeams = useMemo(() => {
        if (!participantsCount || teams.length === 0) return null;
        const placed = teams.reduce((sum, t) => sum + (Array.isArray(t.members) ? t.members.length : 0), 0);
        return Math.max(0, participantsCount - placed);
    }, [participantsCount, teams]);

    // Admin actions
    const startFirstRound = useCallback(async () => {
        if (!tournamentId) return;
        setActionMessage('Стартуем 1 раунд...');
        try {
            await api.post(`/api/tournaments/${tournamentId}/fullmix/start`, {});
            await loadRounds();
            const last = rounds[rounds.length - 1]?.round_number || 1;
            setCurrentRound(last);
            await loadSnapshot(last);
            await loadStandings();
            setActionMessage('Раунд 1 создан');
        } catch (e) {
            setActionMessage('Ошибка старта раунда');
        } finally {
            setTimeout(() => setActionMessage(''), 3000);
        }
    }, [tournamentId, rounds, loadRounds, loadSnapshot, loadStandings]);

    // Объединённая логика: завершить текущий раунд и сразу попытаться сгенерировать следующий

    const completeCurrentRound = useCallback(async () => {
        if (!tournamentId || !currentRound) return;
        setActionMessage('Завершаем текущий раунд...');
        try {
            await api.post(`/api/tournaments/${tournamentId}/fullmix/complete-round`, { round: currentRound });
            // После завершения сразу пытаемся сгенерировать следующий раунд
            try {
                setActionMessage('Генерируем следующий раунд...');
                await api.post(`/api/tournaments/${tournamentId}/fullmix/generate-next`, {});
            } catch (_) {
                // Если турнир завершён по wins_to_win, генерация вернёт completed — это ок
            }
            await loadRounds();
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/snapshots`);
            const items = (res.data?.items || []).sort((a,b) => a.round_number - b.round_number);
            const last = items.length > 0 ? items[items.length - 1].round_number : currentRound;
            setCurrentRound(last);
            await loadSnapshot(last);
            setActionMessage(`Раунд ${currentRound} завершён`);
        } catch (e) {
            setActionMessage('Ошибка завершения раунда');
        } finally {
            setTimeout(() => setActionMessage(''), 3000);
        }
    }, [tournamentId, currentRound, loadRounds, loadSnapshot]);

    return (
        <div className="fullmix-panel" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
            {/* Standings слева */}
            <div className="fullmix-standings">
                <div className="fullmix-standings-headline">
                    <h4 className="fullmix-standings-title">Standings</h4>
                    <div className="fullmix-standings-round">Раунд {currentRound || '—'}</div>
                </div>
                <div className="fullmix-standings-scroll">
                    <table className="fullmix-standings-table">
                        <thead>
                            <tr>
                                <th>Игрок</th>
                                <th>G</th>
                                <th>W</th>
                                <th>L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStandings.map((s, idx) => (
                                <tr key={s.user_id || idx}>
                                    <td>{s.username}</td>
                                    <td>{(s.wins || 0) + (s.losses || 0)}</td>
                                    <td>{s.wins}</td>
                                    <td>{s.losses}</td>
                                </tr>
                            ))}
                            {sortedStandings.length === 0 && (
                                <tr><td colSpan={4} className="fullmix-standings-empty">Нет данных</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Правый блок — матчи и переключатель раундов */}
            <div className="fullmix-matches" style={{ display: 'grid', gap: 12 }}>
                {/* Инфо блок */}
                <div className="fullmix-info" style={{ background: '#000', border: '1px solid #1D1D1D', borderRadius: 8, padding: 12 }}>
                    <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
                        <li>Формат турнира: MIX</li>
                        <li>Тип MIX турнира: {isFull ? 'Fullmix' : 'Classic'}</li>
                        <li>Тип распределения: {ratingDisplay}</li>
                        <li>Игроков в команде: {tournament?.team_size || 5}</li>
                        <li>Количество сформированных команд: {teams.length}</li>
                        <li>Количество игроков не в командах: {notInTeams ?? '—'}</li>
                    </ul>
                </div>

                {/* Admin controls */}
                {isAdminOrCreator && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {rounds.length === 0 && (
                            <button className="btn btn-primary" onClick={startFirstRound}>Стартовать раунд 1</button>
                        )}
                        {rounds.length > 0 && (
                            <>
                                <button className="btn btn-secondary" onClick={() => window.open(`/tournaments/${tournamentId}/fullmix/draft`, '_blank')}>Открыть черновик</button>
                                <button className="btn btn-primary" onClick={completeCurrentRound}>Завершить текущий раунд</button>
                                <button className="btn btn-secondary" onClick={() => window.open(window.location.href, '_blank')}>Открыть в отдельном окне</button>
                            </>
                        )}
                        {actionMessage && <span style={{ color: '#ccc', fontSize: 12 }}>{actionMessage}</span>}
                    </div>
                )}

                {/* Переключатель раундов */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#ccc', fontSize: 13 }}>Раунды:</span>
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

                {/* Матчи текущего раунда */}
                <div className="fullmix-matches-list" style={{ display: 'grid', gap: 8 }}>
                    {loading ? (
                        <div style={{ color: '#888' }}>Загрузка...</div>
                    ) : (
                        matches.length > 0 ? matches.map(m => (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#000', border: '1px solid #1D1D1D', borderRadius: 8, padding: '10px 12px' }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <span style={{ color: '#fff' }}>Матч #{m.id}</span>
                                    <span style={{ color: '#aaa', fontSize: 12 }}>R{currentRound}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <a className="btn btn-secondary" href={`/tournaments/${tournamentId}/match/${m.id}`}>
                                        Открыть
                                    </a>
                                </div>
                            </div>
                        )) : (
                            <div style={{ color: '#888' }}>Матчей нет</div>
                        )
                    )}
                </div>

                {/* Блок подтверждения убран, вместо него кнопка открытия черновика в панели выше */}
            </div>
        </div>
    );
}

export default FullMixBracketPanel;


