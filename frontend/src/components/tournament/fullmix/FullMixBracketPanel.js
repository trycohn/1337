import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../../../utils/api';
import { getSocketInstance, authenticateSocket } from '../../../services/socketClient_v5_simplified';
import BracketRenderer from '../../BracketRenderer';
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
    const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
    const [suggestSwitchOpen, setSuggestSwitchOpen] = useState(false);
    const [suggestedRound, setSuggestedRound] = useState(null);
    const lastMaxRoundRef = React.useRef(null);
    const [roundsInfo, setRoundsInfo] = useState([]); // [{round, completed, isFinal}]
    const [displayRoundLabel, setDisplayRoundLabel] = useState('—');
    const [lastCompletedRound, setLastCompletedRound] = useState(0);
    const [errorTip, setErrorTip] = useState('');
    const [infoOpen, setInfoOpen] = useState(false);
    const [infoTitle, setInfoTitle] = useState('');
    const [infoMessage, setInfoMessage] = useState('');

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
        if (items.length > 0) {
            const numbers = items.map(i => i.round_number);
            const maxRound = numbers[numbers.length - 1];
            // 1) Попытка взять из URL
            let initial = null;
            try {
                const url = new URL(window.location.href);
                const qRound = parseInt(url.searchParams.get('round'), 10);
                if (Number.isInteger(qRound) && numbers.includes(qRound)) initial = qRound;
            } catch (_) {}
            // 2) Попытка взять из localStorage
            if (initial == null) {
                try {
                    const stored = parseInt(localStorage.getItem(`fm_current_round_${tournamentId}`), 10);
                    if (Number.isInteger(stored) && numbers.includes(stored)) initial = stored;
                } catch (_) {}
            }
            // 3) Фоллбек: последний (максимальный) раунд
            if (initial == null) initial = maxRound;

            // Если текущий ещё не установлен
            if (!currentRound) {
                setCurrentRound(initial);
            } else if (!numbers.includes(currentRound)) {
                // Если выбранный исчез — берём последний
                setCurrentRound(maxRound);
            }

            // Детект появления нового раунда
            if (lastMaxRoundRef.current == null) lastMaxRoundRef.current = maxRound;
            if (maxRound > lastMaxRoundRef.current) {
                // Появился новый раунд
                const declineKey = `fm_declined_jump_${tournamentId}_${maxRound}`;
                const declined = localStorage.getItem(declineKey) === '1';
                if (isAdminOrCreator && !declined) {
                    setSuggestedRound(maxRound);
                    setSuggestSwitchOpen(true);
                } else if (!isAdminOrCreator) {
                    // Зрителям переключаем автоматически
                    setCurrentRound(maxRound);
                }
                lastMaxRoundRef.current = maxRound;
            }

            // Подсчёт завершённых/финальных раундов для отображения текущего
            try {
                // Загружаем все матчи один раз, чтобы корректно определить завершённость раундов
                let allMatches = [];
                try {
                    const mres = await api.get(`/api/tournaments/${tournamentId}/matches`);
                    allMatches = mres.data?.data || mres.data || [];
                } catch (_) {}

                const details = await Promise.all(numbers.map(async (rn) => {
                    try {
                        const rres = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${rn}`);
                        const item = rres.data?.item || {};
                        const ms = Array.isArray(allMatches) ? allMatches.filter(m => Number(m.round) === Number(rn)) : [];
                        const completed = ms.length > 0 && ms.every(m => (m?.status === 'completed') || (m?.winner_team_id));
                        const isFinal = !!(item?.snapshot?.meta?.final_round);
                        return { round: rn, completed, isFinal };
                    } catch (_) {
                        return { round: rn, completed: false, isFinal: false };
                    }
                }));
                setRoundsInfo(details);
                const lcr = details.filter(d => d.completed).map(d => d.round).sort((a,b)=>a-b).pop() || 0;
                setLastCompletedRound(lcr);
                const last = details[details.length - 1];
                if (last && last.isFinal) {
                    setDisplayRoundLabel('ФИНАЛ');
                } else if (settings?.current_round) {
                    setDisplayRoundLabel(String(settings.current_round));
                } else {
                    const completedCount = details.filter(d => d.completed).length;
                    setDisplayRoundLabel(String(Math.max(1, completedCount + 1)));
                }
            } catch (_) {}
        }
    }, [tournamentId, currentRound, isAdminOrCreator]);

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
        if (!tournamentId) return;
        const targetRound = currentRound || (rounds.length > 0 ? rounds[rounds.length - 1].round_number : null);
        if (!targetRound) return;
        loadSnapshot(targetRound);
        loadStandings();
    }, [tournamentId, currentRound, rounds, loadSnapshot, loadStandings]);

    // Синхронизация выбранного раунда с настройками турнира (истина из БД)
    useEffect(() => {
        if (!settings?.current_round) return;
        const desired = parseInt(settings.current_round, 10);
        if (!Number.isInteger(desired)) return;
        const numbers = rounds.map(r => r.round_number);
        const target = numbers.includes(desired) ? desired : (numbers[numbers.length - 1] || desired);
        if (target && currentRound !== target) {
            setCurrentRound(target);
            try {
                localStorage.setItem(`fm_current_round_${tournamentId}`, String(target));
                const url = new URL(window.location.href);
                url.searchParams.set('round', String(target));
                window.history.replaceState({}, '', url.toString());
            } catch (_) {}
        }
    }, [settings?.current_round, rounds.length]);

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
            // Не переключаемся автоматически, только обновляем списки
            loadRounds();
            // если сейчас смотрим этот раунд — просто обновим снапшот
            if (currentRound === payload.round) loadSnapshot(payload.round);
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

    const completeCurrentRound = useCallback(async (targetRound) => {
        if (!tournamentId) return;
        const usedRound = Number.isInteger(parseInt(targetRound, 10)) ? parseInt(targetRound, 10) : (lastCompletedRound || currentRound);
        if (!usedRound) return;
        setActionMessage('Завершаем текущий раунд...');
        try {
            const res = await api.post(`/api/tournaments/${tournamentId}/fullmix/complete-round`, { round: usedRound });
            await loadRounds();
            // После завершения раунда НЕ генерируем следующий автоматически.
            // Ожидаем действий администратора в черновике (двухэтапное утверждение).
            await loadSnapshot(usedRound);
            setActionMessage(`Раунд ${usedRound} завершён. Сформируйте следующий раунд через Черновик.`);
            // Обновляем настройки, чтобы подтянуть новый current_round из БД и синхронизировать UI
            await loadSettings();

            // Информационное сообщение о результате отбора (финалисты / доп. раунд / исключённые)
            let nri = res?.data?.next_round_info;
            const openInfo = (payload) => {
                if (!payload) return;
                const finalists = Array.isArray(payload.finalists) ? payload.finalists : [];
                const eliminated = Array.isArray(payload.eliminated) ? payload.eliminated : [];
                const isExtraRound = Boolean(payload.extra_round);

                let title = 'Результат отбора';
                let text = '';

                const namesFrom = (arr) => {
                    if (!Array.isArray(arr) || arr.length === 0) return '';
                    const names = arr.map(x => x?.username || x?.name || (x?.user_id != null ? `ID ${x.user_id}` : '')).filter(Boolean);
                    return names.length > 0 ? names.join(', ') : '';
                };

                if (finalists.length > 0) {
                    const names = namesFrom(finalists);
                    text = names ? `Определены финалисты (${finalists.length}): ${names}.\nБудет создан финальный раунд.` : `Определены финалисты (${finalists.length}). Будет создан финальный раунд.`;
                } else if (isExtraRound) {
                    text = 'Финалисты не определены, будет создан дополнительный раунд.';
                    if (eliminated.length > 0) {
                        const names = namesFrom(eliminated);
                        text += names ? `\nТОП худших определены и будут исключены из турнира: ${names}.` : `\nТОП худших определены и будут исключены из турнира (${eliminated.length}).`;
                    } else {
                        text += '\nТОП худших определить не удалось, все участники остаются в пуле.';
                    }
                } else {
                    text = 'Отбор завершён. Перейдите в Черновик для формирования следующего раунда.';
                }

                setInfoTitle(title);
                setInfoMessage(text);
                setInfoOpen(true);
            };

            if (nri) {
                openInfo(nri);
            } else {
                // Фолбэк: читаем снапшот следующего раунда и берём meta
                const nextRound = usedRound + 1;
                try {
                    const rs = await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${nextRound}`);
                    const meta = rs?.data?.item?.snapshot?.meta || rs?.data?.snapshot?.meta || null;
                    if (meta) {
                        openInfo({
                            finalists: meta.finalists || [],
                            eliminated: meta.eliminated || [],
                            extra_round: Boolean(meta.extra_round)
                        });
                    }
                } catch (_e) {
                    // игнорируем: просто нет данных для показа
                }
            }
        } catch (e) {
            const msg = e?.response?.data?.error || 'Раунд не может быть завершён: не все матчи завершены.';
            setErrorTip(msg);
        } finally {
            setTimeout(() => setActionMessage(''), 3000);
        }
    }, [tournamentId, currentRound, lastCompletedRound, loadRounds, loadSnapshot, loadSettings]);

    return (
        <>
            {/* Header with admin controls */}
            {isAdminOrCreator && (
                <div className="fullmix-header">
                    <span>
                        Текущий раунд: {displayRoundLabel === 'ФИНАЛ'
                            ? 'ФИНАЛ'
                            : `${displayRoundLabel}${settings?.wins_to_win ? ` из ${settings.wins_to_win}` : ''}`}
                    </span>
                    {rounds.length === 0 && (
                        <button className="btn btn-primary" onClick={startFirstRound}>Стартовать раунд 1</button>
                    )}
                    {rounds.length > 0 && (
                        <>
                            <button className="btn btn-secondary" onClick={() => window.open(`/tournaments/${tournamentId}/fullmix/draft`, '_blank')}>Открыть черновик</button>
                            <button className="btn btn-primary" onClick={() => setConfirmFinishOpen(true)}>Завершить текущий раунд</button>
                            <button className="btn btn-secondary" onClick={() => window.open(`/tournaments/${tournament.id}/bracket`, '_blank', 'noopener,noreferrer')}>Открыть в отдельном окне</button>
                        </>
                    )}
                    {actionMessage && <span className="fullmix-header-message">{actionMessage}</span>}
                    {errorTip && (
                        <div style={{ position: 'relative', marginLeft: 12 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1a1a1a', color: '#fff', border: '1px solid #ff0000', borderRadius: 6, padding: '6px 10px' }}>
                                <span style={{ color: '#ff6b6b' }}>✖</span>
                                <span style={{ fontSize: 13 }}>{errorTip}</span>
                                <button className="btn btn-secondary" onClick={() => setErrorTip('')} style={{ padding: '2px 6px' }}>✕</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="fullmix-panel">
            {/* Standings */}
            <div className="fullmix-standings">
                <div className="fullmix-standings-headline">
                    <h4 className="fullmix-standings-title">Standings</h4>
                    <div className="fullmix-standings-round">
                        {displayRoundLabel === 'ФИНАЛ'
                            ? 'ФИНАЛ'
                            : `Раунд ${displayRoundLabel}${settings?.wins_to_win ? ` из ${settings.wins_to_win}` : ''}`}
                    </div>
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

            {/* Правая часть удалена по требованию */}
            </div>

            {/* Модалка подтверждения завершения раунда */}
            {confirmFinishOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#000', border: '1px solid #1D1D1D', borderRadius: 8, padding: 16, width: 420, maxWidth: '90vw' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <h4 style={{ margin: 0 }}>Подтверждение</h4>
                            <button className="btn btn-secondary" onClick={() => setConfirmFinishOpen(false)}>✕</button>
                        </div>
                        <div style={{ color: '#ccc', marginBottom: 16 }}>
                            Завершить раунд № {(settings?.current_round ?? currentRound) || '—'}? После завершения переформирование в этом раунде будет недоступно.
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setConfirmFinishOpen(false)}>Отмена</button>
                            <button className="btn btn-primary" onClick={async () => { setConfirmFinishOpen(false); await completeCurrentRound(settings?.current_round || currentRound || lastCompletedRound); }}>Завершить</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модалка предложения перейти к новому раунду (для админов) */}
            {suggestSwitchOpen && suggestedRound && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#000', border: '1px solid #1D1D1D', borderRadius: 8, padding: 16, width: 420, maxWidth: '90vw' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <h4 style={{ margin: 0 }}>Новый раунд</h4>
                            <button className="btn btn-secondary" onClick={() => { setSuggestSwitchOpen(false); localStorage.setItem(`fm_declined_jump_${tournamentId}_${suggestedRound}`, '1'); }}>✕</button>
                        </div>
                        <div style={{ color: '#ccc', marginBottom: 16 }}>
                            Появился раунд № {suggestedRound}. Перейти к нему?
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => { setSuggestSwitchOpen(false); localStorage.setItem(`fm_declined_jump_${tournamentId}_${suggestedRound}`, '1'); }}>Нет</button>
                            <button className="btn btn-primary" onClick={() => {
                                setSuggestSwitchOpen(false);
                                setCurrentRound(suggestedRound);
                            }}>Да</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Информационное окно о финалистах / исключениях */}
            {infoOpen && (
                <div className="fullmix-info-modal-overlay">
                    <div className="fullmix-info-modal">
                        <div className="fullmix-info-modal__header">
                            <h4 className="fullmix-info-modal__title">{infoTitle || 'Информация'}</h4>
                            <button className="btn btn-secondary fullmix-info-modal__close" onClick={() => setInfoOpen(false)}>✕</button>
                        </div>
                        <pre className="fullmix-info-modal__content">{infoMessage}</pre>
                        <div className="fullmix-info-modal__actions">
                            <button className="btn btn-primary" onClick={() => setInfoOpen(false)}>Понятно</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default FullMixBracketPanel;


