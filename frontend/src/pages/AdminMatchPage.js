import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
// Удаляем прямой импорт socket.io-client; используем API + фоновые polling‑обновления
import api from '../axios';
import MapSelectionBoard from '../components/tournament/MatchLobby/MapSelectionBoard';
import '../styles/components.css';
import './AdminMatchPage.css';

function AdminMatchPage() {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState([]);
    const [connectInfo, setConnectInfo] = useState(null);
    const [lobbyId, setLobbyId] = useState(null);
    const [lobby, setLobby] = useState(null);
    const [availableMaps, setAvailableMaps] = useState([]);
    const [selections, setSelections] = useState([]);
    const [team1Users, setTeam1Users] = useState([]);
    const [team2Users, setTeam2Users] = useState([]);
    const [loading, setLoading] = useState(false);
    const [unassignedUsers, setUnassignedUsers] = useState([]);
    const [invitedPendingUsers, setInvitedPendingUsers] = useState([]);
    const [invitedDeclinedUsers, setInvitedDeclinedUsers] = useState([]);
    const [onlineUserIds, setOnlineUserIds] = useState([]);
    const socketRef = useRef(null); // зарезервировано (не используем WS)
    const searchDebounce = useRef(null);
    const searchInputRef = useRef(null);
    // Invite panel state
    const [invitePanelOpen, setInvitePanelOpen] = useState(false);
    const [invitePanelTeam, setInvitePanelTeam] = useState(null);
    const [friends, setFriends] = useState([]);
    const [friendsExpanded, setFriendsExpanded] = useState(false);
    const [inviteSearch, setInviteSearch] = useState('');
    const [inviteResults, setInviteResults] = useState([]);
    const inviteSearchDebounce = useRef(null);
    const inviteSearchInputRef = useRef(null);
    const [formatConfirm, setFormatConfirm] = useState({ open: false, target: null });
    // Per‑player readiness and team countdowns
    const [playerReady, setPlayerReady] = useState({}); // { [userId]: boolean }
    const [teamCountdown, setTeamCountdown] = useState({ 1: null, 2: null });
    const countdownRefs = useRef({ 1: null, 2: null });

    // Presence helpers
    const lobbyPresenceSet = useMemo(() => {
        const ids = [
            ...(team1Users || []).map(u => u.id),
            ...(team2Users || []).map(u => u.id),
            ...(unassignedUsers || []).map(u => u.id)
        ];
        return new Set(ids);
    }, [team1Users, team2Users, unassignedUsers]);

    function getPresenceStatus(userId) {
        if (!userId) return { cls: 'custom-match-status-offline', text: 'Оффлайн' };
        const isOnline = onlineUserIds.includes(userId);
        const inLobby = lobbyPresenceSet.has(userId);
        if (isOnline && inLobby) return { cls: 'custom-match-status-inlobby', text: 'В лобби' };
        if (isOnline) return { cls: 'custom-match-status-online', text: 'Онлайн' };
        return { cls: 'custom-match-status-offline', text: 'Оффлайн' };
    }

    // Initialize readiness for new users
    useEffect(() => {
        setPlayerReady(prev => {
            const next = { ...prev };
            for (const u of team1Users) if (next[u.id] === undefined) next[u.id] = false;
            for (const u of team2Users) if (next[u.id] === undefined) next[u.id] = false;
            return next;
        });
    }, [team1Users, team2Users]);

    function isTeamAllReady(teamId) {
        const list = teamId === 1 ? team1Users : team2Users;
        if (!list || list.length === 0) return false;
        return list.every(u => !!playerReady[u.id]);
    }

    function cancelCountdown(teamId) {
        if (countdownRefs.current[teamId]) {
            clearInterval(countdownRefs.current[teamId]);
            countdownRefs.current[teamId] = null;
        }
        setTeamCountdown(prev => ({ ...prev, [teamId]: null }));
    }

    async function confirmTeamReady(teamId) {
        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/admin/match-lobby/${lobbyId}/ready`, { team: teamId, ready: true }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (_) {}
    }

    function startCountdown(teamId) {
        if (countdownRefs.current[teamId]) return; // already running
        setTeamCountdown(prev => ({ ...prev, [teamId]: 5 }));
        countdownRefs.current[teamId] = setInterval(async () => {
            setTeamCountdown(prev => {
                const val = (prev[teamId] ?? 0) - 1;
                return { ...prev, [teamId]: val };
            });
            const currentVal = teamCountdown[teamId];
            const stillAllReady = isTeamAllReady(teamId);
            if (!stillAllReady) {
                cancelCountdown(teamId);
                return;
            }
            if ((teamCountdown[teamId] ?? 0) <= 0) {
                cancelCountdown(teamId);
                await confirmTeamReady(teamId);
            }
        }, 1000);
    }

    function onTogglePlayerReady(userId, teamId) {
        setPlayerReady(prev => {
            const next = { ...prev, [userId]: !prev[userId] };
            // If any unready during countdown — cancel
            if (!isTeamAllReady(teamId)) cancelCountdown(teamId);
            // If now all ready — start countdown
            setTimeout(() => { if (isTeamAllReady(teamId)) startCountdown(teamId); }, 0);
            return next;
        });
    }

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        api.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => {
                setUser(r.data);
                setIsAdmin(r.data?.role === 'admin');
            })
            .catch(() => {});
    }, []);

    const canInvite = useMemo(() => isAdmin, [isAdmin]);

    // Создать/получить админ-лобби
    const ensureAdminLobby = useCallback(async () => {
        const token = localStorage.getItem('token');
        const { data } = await api.post('/api/admin/match-lobby', {}, { headers: { Authorization: `Bearer ${token}` } });
        if (data?.success) {
            setLobbyId(data.lobby.id);
            // сразу подгрузим полный state лобби
            const r = await api.get(`/api/admin/match-lobby/${data.lobby.id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (r?.data?.success) {
                setLobby(r.data.lobby);
                setSelections(r.data.selections || []);
                setAvailableMaps(r.data.available_maps || []);
                setTeam1Users(r.data.team1_users || []);
                setTeam2Users(r.data.team2_users || []);
                setUnassignedUsers(r.data.unassigned_users || []);
                setInvitedPendingUsers(r.data.invited_pending_users || []);
            } else {
                setLobby(data.lobby);
                setAvailableMaps(data.available_maps || []);
            }
        }
    }, []);

    function onSearchChange(e) {
        const value = e.target.value;
        setQuery(value);
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        if (!value || value.trim().length < 2) {
            setResults([]);
            return;
        }
        searchDebounce.current = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                const { data } = await api.get('/api/users/search', {
                    params: { q: value, limit: 10 },
                    headers: { Authorization: `Bearer ${token}` }
                });
                setResults(Array.isArray(data) ? data : []);
            } catch (_) {
                setResults([]);
            }
        }, 250);
    }

    async function inviteUser(u) {
        if (!u || !u.id) return;
        if (!isAdmin) return;
        try {
            if (!lobbyId) await ensureAdminLobby();
            const token = localStorage.getItem('token');
            await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: u.id, team: null }, { headers: { Authorization: `Bearer ${token}` } });
            const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (r?.data?.success) {
                setLobby(r.data.lobby);
                setSelections(r.data.selections || []);
                setAvailableMaps(r.data.available_maps || []);
                setTeam1Users(r.data.team1_users || []);
                setTeam2Users(r.data.team2_users || []);
                setUnassignedUsers(r.data.unassigned_users || []);
                setInvitedPendingUsers(r.data.invited_pending_users || []);
                setInvitedDeclinedUsers(r.data.invited_declined_users || []);
                setOnlineUserIds(r.data.online_user_ids || []);
            }
        } catch (_) {}
    }

    async function inviteUserToTeam(userId, team) {
        if (!userId || !team) return;
        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: userId, team, accept: true }, { headers: { Authorization: `Bearer ${token}` } });
            const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (r?.data?.success) {
                setLobby(r.data.lobby);
                setSelections(r.data.selections || []);
                setAvailableMaps(r.data.available_maps || []);
                setTeam1Users(r.data.team1_users || []);
                setTeam2Users(r.data.team2_users || []);
                setUnassignedUsers(r.data.unassigned_users || []);
                setInvitedPendingUsers(r.data.invited_pending_users || []);
                setInvitedDeclinedUsers(r.data.invited_declined_users || []);
                setOnlineUserIds(r.data.online_user_ids || []);
            }
        } catch (_) {}
    }

    const openInvitePanel = useCallback(async (team) => {
        setInvitePanelTeam(team);
        setInvitePanelOpen(true);
        setFriendsExpanded(false);
        try {
            const token = localStorage.getItem('token');
            const { data } = await api.get('/api/friends', { headers: { Authorization: `Bearer ${token}` } });
            const list = Array.isArray(data) ? data.map(f => f.friend) : [];
            setFriends(list);
        } catch (_) {
            setFriends([]);
        }
        setTimeout(() => { inviteSearchInputRef.current && inviteSearchInputRef.current.focus(); }, 50);
    }, []);

    const closeInvitePanel = useCallback(() => {
        setInvitePanelOpen(false);
        setInviteSearch('');
        setInviteResults([]);
    }, []);

    function onInviteSearchChange(e) {
        const value = e.target.value;
        setInviteSearch(value);
        if (inviteSearchDebounce.current) clearTimeout(inviteSearchDebounce.current);
        if (!value || value.trim().length < 2) {
            setInviteResults([]);
            return;
        }
        inviteSearchDebounce.current = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                const { data } = await api.get('/api/users/search', {
                    params: { q: value, limit: 10 },
                    headers: { Authorization: `Bearer ${token}` }
                });
                setInviteResults(Array.isArray(data) ? data : []);
            } catch (_) { setInviteResults([]); }
        }, 250);
    }

    // DnD helpers
    function handleDragStart(e, userId) {
        try { e.dataTransfer.setData('text/plain', String(userId)); } catch (_) {}
    }
    function handleDrop(team) {
        return async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('token');
            let raw = '';
            try { raw = e.dataTransfer.getData('text/plain'); } catch (_) {}
            const userId = Number(raw);
            if (!userId || !lobbyId) return;
            try {
                await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: userId, team, accept: true }, { headers: { Authorization: `Bearer ${token}` } });
                const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                if (r?.data?.success) {
                    setLobby(r.data.lobby);
                    setSelections(r.data.selections || []);
                    setAvailableMaps(r.data.available_maps || []);
                    setTeam1Users(r.data.team1_users || []);
                    setTeam2Users(r.data.team2_users || []);
                    setUnassignedUsers(r.data.unassigned_users || []);
                    setInvitedPendingUsers(r.data.invited_pending_users || []);
                    setInvitedDeclinedUsers(r.data.invited_declined_users || []);
                    setOnlineUserIds(r.data.online_user_ids || []);
                }
            } catch (_) {}
        };
    }

    // Автозагрузка лобби по параметру ?lobby= для приглашенных
    useEffect(() => {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams(window.location.search || '');
        const qLobby = params.get('lobby');
        if (qLobby && !lobbyId) {
            const idNum = Number(qLobby);
            if (Number.isInteger(idNum) && idNum > 0) {
                (async () => {
                    try {
                        const r = await api.get(`/api/admin/match-lobby/${idNum}`, { headers: { Authorization: `Bearer ${token}` } });
                        if (r?.data?.success) {
                            setLobbyId(idNum);
                            setLobby(r.data.lobby);
                            setSelections(r.data.selections || []);
                            setAvailableMaps(r.data.available_maps || []);
                            setTeam1Users(r.data.team1_users || []);
                            setTeam2Users(r.data.team2_users || []);
                            setUnassignedUsers(r.data.unassigned_users || []);
                            setInvitedPendingUsers(r.data.invited_pending_users || []);
                            setInvitedDeclinedUsers(r.data.invited_declined_users || []);
                            setOnlineUserIds(r.data.online_user_ids || []);
                        }
                    } catch (_) {}
                })();
            }
        }
    }, [lobbyId]);

    // Live‑обновления через короткие polling интервалов (без WS)
    useEffect(() => {
        if (!user || !lobbyId) return;
        const token = localStorage.getItem('token');
        let timer = null;
        const pull = async () => {
            try {
                const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                if (r?.data?.success) {
                    setLobby(r.data.lobby);
                    setSelections(r.data.selections || []);
                    setAvailableMaps(r.data.available_maps || []);
                    setTeam1Users(r.data.team1_users || []);
                    setTeam2Users(r.data.team2_users || []);
                    setUnassignedUsers(r.data.unassigned_users || []);
                    setInvitedPendingUsers(r.data.invited_pending_users || []);
                    setInvitedDeclinedUsers(r.data.invited_declined_users || []);
                    setOnlineUserIds(r.data.online_user_ids || []);
                    // авто‑подхват ссылок подключения, когда матч создан
                    if ((r.data.lobby?.status === 'match_created' || r.data.lobby?.status === 'ready_to_create') && !connectInfo) {
                        try {
                            const conn = await api.get(`/api/admin/match-lobby/${lobbyId}/connect`, { headers: { Authorization: `Bearer ${token}` } });
                            if (conn?.data?.success) setConnectInfo(conn.data);
                        } catch (_) {}
                    }
                }
            } catch (_) {}
            timer = setTimeout(pull, 1500);
        };
        pull();
        return () => { if (timer) clearTimeout(timer); };
    }, [user, lobbyId]);

    function removeFromSelection(id) {}

    async function createTestLobby() {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            // Заглушка: просто запросить текущие ссылки, если уже завершены пики
            if (!lobbyId) await ensureAdminLobby();
            const { data } = await api.get(`/api/admin/match-lobby/${lobbyId || ''}/connect`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data?.success) setConnectInfo(data);
        } catch (e) {
            setConnectInfo(null);
        } finally {
            setLoading(false);
        }
    }

    async function syncWhitelist() {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const body = {
                steam_ids: [
                    ...team1Users.map(u => u.steam_id).filter(Boolean),
                    ...team2Users.map(u => u.steam_id).filter(Boolean)
                ]
            };
            await api.post('/api/admin/match/test-lobby/whitelist', body, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (_) {
        } finally {
            setLoading(false);
        }
    }

    function copy(text) {
        if (!text) return;
        navigator.clipboard?.writeText(text).catch(() => {});
    }

    useEffect(() => {
        if (isAdmin && !lobbyId) {
            ensureAdminLobby().catch(() => {});
        }
    }, [isAdmin, lobbyId, ensureAdminLobby]);

    // Не блокируем страницу для приглашенных не-админов

    return (
        <div className="custom-match-page">
            <h2>МАТЧ — тестовое лобби</h2>
            <div className="custom-match-mt-8">
                <div className="custom-match-format-tabs">
                    {['bo1','bo3','bo5'].map(fmt => (
                        <button
                            key={fmt}
                            className={`custom-match-format-tab ${lobby?.match_format === fmt ? 'active' : ''}`}
                            disabled={!lobbyId}
                            onClick={async (e) => {
                                if (!lobbyId) return;
                                const token = localStorage.getItem('token');
                                const current = lobby?.match_format;
                                if (current && current !== fmt) {
                                    // open confirm modal
                                    setFormatConfirm({ open: true, target: fmt });
                                    return;
                                }
                                await api.post(`/api/admin/match-lobby/${lobbyId}/format`, { format: fmt }, { headers: { Authorization: `Bearer ${token}` } });
                                const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                if (r?.data?.success) { setLobby(r.data.lobby); setSelections(r.data.selections || []); setAvailableMaps(r.data.available_maps || []); setTeam1Users(r.data.team1_users || []); setTeam2Users(r.data.team2_users || []); }
                            }}
                        >{fmt.toUpperCase()}</button>
                    ))}
                </div>
                <div className="custom-match-format-actions custom-match-mt-8">
                    <button className="btn btn-secondary" disabled={!lobbyId || !(lobby?.status === 'ready')}
                        onClick={async () => {
                            const token = localStorage.getItem('token');
                            const { data } = await api.post(`/api/admin/match-lobby/${lobbyId}/start-pick`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            if (data?.success) {
                                const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                if (r?.data?.success) { setLobby(r.data.lobby); setSelections(r.data.selections || []); setAvailableMaps(r.data.available_maps || []); setTeam1Users(r.data.team1_users || []); setTeam2Users(r.data.team2_users || []); }
                            }
                        }}>Начать BAN/PICK</button>
                </div>
            </div>
            <div className="custom-match-mt-12" style={{ maxWidth: 640 }}>
                <label className="sr-only" htmlFor="user-search">Поиск пользователей</label>
                <input
                    id="user-search"
                    ref={searchInputRef}
                    className="input"
                    placeholder="Поиск пользователей (минимум 2 символа)"
                    value={query}
                    onChange={onSearchChange}
                />
                {!!results.length && (
                    <div className="custom-match-mt-8">
                        {(() => {
                            const activeSet = new Set([
                                ...invitedPendingUsers.map(x => x.id),
                                ...unassignedUsers.map(x => x.id),
                                ...team1Users.map(x => x.id),
                                ...team2Users.map(x => x.id)
                            ]);
                            return results.map(u => (
                                <div key={u.id} className="list-row">
                                    <div className="list-row-left">
                                        <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm custom-match-avatar-sm" />
                                        <span className="ml-8 custom-match-ml-8">{u.username}</span>
                                        {u.steam_id ? <span className="ml-8 custom-match-ml-8 custom-match-muted">SteamID: {u.steam_id}</span> : <span className="ml-8 custom-match-ml-8 custom-match-danger-text">нет Steam</span>}
                                    </div>
                                    <div className="list-row-right">
                                        {!activeSet.has(u.id) && isAdmin && (
                                            <button className="btn btn-secondary" disabled={!lobbyId}
                                                onClick={() => inviteUser(u)}>Пригласить</button>
                                        )}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                )}
            </div>

            {/* Участники не в командах (dropzone) */}
            {unassignedUsers.length > 0 && (
                <div className="custom-match-mt-16 custom-match-dropzone" onDragOver={e=>e.preventDefault()} onDrop={handleDrop(null)}>
                    <h3>Участники не в командах</h3>
                    {unassignedUsers.map(u => (
                        <div key={`un-${u.id}`} className="list-row custom-match-list-row" draggable onDragStart={(e)=>handleDragStart(e, u.id)}>
                            <div className="list-row-left">
                                <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm custom-match-avatar-sm" />
                                <span className="ml-8 custom-match-ml-8">{u.username}</span>
                                <span className={`ml-8 custom-match-ml-8 custom-match-muted custom-match-status-dot ${onlineUserIds.includes(u.id) ? 'custom-match-status-online' : 'custom-match-status-offline'}`}>
                                    {onlineUserIds.includes(u.id) ? 'В лобби' : 'оффлайн'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Приглашённые участники (ожидают принятия) */}
            {invitedPendingUsers.length > 0 && (
                <div className="custom-match-mt-16">
                    <h3>Приглашённые участники</h3>
                    {invitedPendingUsers.map(u => (
                        <div key={`pending-${u.id}`} className="list-row custom-match-list-row" draggable onDragStart={(e)=>handleDragStart(e, u.id)}>
                            <div className="list-row-left">
                                <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm custom-match-avatar-sm" />
                                <span className="ml-8 custom-match-ml-8">{u.username}</span>
                                <span className="ml-8 custom-match-ml-8 custom-match-muted custom-match-status-dot custom-match-status-pending">ожидает принятия…</span>
                            </div>
                            <div className="list-row-right custom-match-row-actions">
                                <button className="btn btn-secondary" onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: u.id }, { headers: { Authorization: `Bearer ${token}` } });
                                    const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                    if (r?.data?.success) setInvitedPendingUsers(r.data.invited_pending_users || []);
                                }}>Отправить ещё раз</button>
                                <button className="btn btn-secondary ml-8" onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    await api.delete(`/api/admin/match-lobby/${lobbyId}/invite/${u.id}`, { headers: { Authorization: `Bearer ${token}` } });
                                    const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                    if (r?.data?.success) setInvitedPendingUsers(r.data.invited_pending_users || []);
                                }}>Удалить</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Отказавшиеся участники */}
            {invitedDeclinedUsers.length > 0 && (
                <div className="custom-match-mt-16">
                    <h3>Отказавшиеся</h3>
                    {invitedDeclinedUsers.map(u => (
                        <div key={`declined-${u.id}`} className="list-row">
                            <div className="list-row-left">
                                <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm custom-match-avatar-sm" />
                                <span className="ml-8 custom-match-ml-8">{u.username}</span>
                                <span className="ml-8 custom-match-ml-8 custom-match-muted custom-match-status-dot custom-match-status-declined">Отказ</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            

            <div className="custom-match-mt-16">
                <button className="btn btn-primary" onClick={createTestLobby} disabled={loading || !lobbyId}>
                    {loading ? 'Запрашиваем…' : 'Подключения (если готово)'}
                </button>
                <button className="btn btn-secondary custom-match-ml-8" onClick={syncWhitelist} disabled={loading || (team1Users.length + team2Users.length === 0)}>
                    Синхронизировать whitelist
                </button>
                {/* Очистка лобби — только создатель */}
                <button className="btn btn-secondary custom-match-ml-8" disabled={!lobbyId || !user || (lobby && user && lobby.created_by && Number(lobby.created_by) !== Number(user.id))}
                    onClick={async () => {
                        try {
                            const token = localStorage.getItem('token');
                            const { data } = await api.post(`/api/admin/match-lobby/${lobbyId}/clear`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            if (data?.success) {
                                setLobby(data.lobby);
                                setSelections([]);
                                setTeam1Users([]);
                                setTeam2Users([]);
                                setConnectInfo(null);
                            }
                        } catch (_) {}
                    }}>
                    Очистить лобби
                </button>
            </div>

            {connectInfo && (
                <div className="custom-match-mt-16">
                    <h3>Подключение</h3>
                    {connectInfo.connect && (
                        <div className="list-row">
                            <div className="list-row-left">
                                <span>Игроки:</span>
                                <code className="code-inline custom-match-code-inline">{connectInfo.connect}</code>
                            </div>
                            <div className="list-row-right">
                                <button className="btn btn-secondary" onClick={() => copy(connectInfo.connect)}>Копировать</button>
                            </div>
                        </div>
                    )}
                    {connectInfo.gotv && (
                        <div className="list-row custom-match-mt-8">
                            <div className="list-row-left">
                                <span>GOTV:</span>
                                <code className="code-inline custom-match-code-inline">{connectInfo.gotv}</code>
                            </div>
                            <div className="list-row-right">
                                <button className="btn btn-secondary" onClick={() => copy(connectInfo.gotv)}>Копировать</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Панель готовности команд */}
            {lobbyId && (
                <div className="custom-match-mt-16">
                    <div className="custom-match-row-lg custom-match-teams">
                        {(isAdmin || Number(lobby?.created_by) === Number(user?.id)) && (
                        <div>
                            <button className="btn btn-secondary" onClick={async () => {
                                const token = localStorage.getItem('token');
                                await api.post(`/api/admin/match-lobby/${lobbyId}/ready`, { team: 1, ready: true }, { headers: { Authorization: `Bearer ${token}` } });
                            }}>ready</button>
                        </div>
                        )}
                        {(isAdmin || Number(lobby?.created_by) === Number(user?.id)) && (
                        <div>
                            <button className="btn btn-secondary" onClick={async () => {
                                const token = localStorage.getItem('token');
                                await api.post(`/api/admin/match-lobby/${lobbyId}/ready`, { team: 2, ready: true }, { headers: { Authorization: `Bearer ${token}` } });
                            }}>ready</button>
                        </div>
                        )}
                    </div>
                </div>
            )}

            {/* Доска выбора карт */}
            {lobby && lobby.match_format && availableMaps?.length > 0 && (
                <div className="custom-match-mt-16">
                    <MapSelectionBoard
                        maps={availableMaps}
                        selections={selections}
                        currentTurn={lobby.current_turn_team || null}
                        myTeamId={0}
                        format={lobby.match_format}
                        status={lobby.status}
                        onMapAction={async (mapName, action) => {
                            const token = localStorage.getItem('token');
                            const { data } = await api.post(`/api/admin/match-lobby/${lobbyId}/select-map`, { mapName, action }, { headers: { Authorization: `Bearer ${token}` } });
                            if (data?.success) {
                                const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                if (r?.data?.success) {
                                    setLobby(r.data.lobby);
                                    setSelections(r.data.selections || []);
                                    setAvailableMaps(r.data.available_maps || []);
                                    setTeam1Users(r.data.team1_users || []);
                                    setTeam2Users(r.data.team2_users || []);
                                    setUnassignedUsers(r.data.unassigned_users || []);
                                }
                                // после завершения пиков ждём явное «СОЗДАЕМ МАТЧ?»
                            }
                        }}
                        teamNames={{ 1: lobby.team1_name || 'Команда 1', 2: lobby.team2_name || 'Команда 2' }}
                    />
                </div>
            )}

            {/* Составы команд (dropzones с placeholder-слотами) */}
            <div className="custom-match-mt-16">
                <h3>Состав команд</h3>
                <div className="custom-match-row-lg custom-match-teams">
                    {/* Команда 1 */}
                    <div className="custom-match-team-column custom-match-dropzone" onDragOver={e=>e.preventDefault()} onDrop={handleDrop(1)}>
                        <h4>
                            {lobby?.team1_name || 'Команда 1'}
                            <span className="custom-match-team-ready-status custom-match-ml-8">
                                {teamCountdown[1] != null ? `ready (${teamCountdown[1]})` : (isTeamAllReady(1) ? 'ready' : 'not ready')}
                            </span>
                        </h4>
                        {team1Users.length === 0 && <div className="custom-match-muted">Нет игроков</div>}
                        {team1Users.map(u => (
                            <div key={`t1-${u.id}`} className="list-row custom-match-list-row" draggable onDragStart={(e)=>handleDragStart(e, u.id)}>
                                <div className="list-row-left">
                                    <button className={`custom-match-ready-toggle ${playerReady[u.id] ? 'on' : 'off'}`} title={playerReady[u.id] ? 'Готов' : 'Не готов'} onClick={() => onTogglePlayerReady(u.id, 1)}>
                                        {playerReady[u.id] ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="14" height="14"><path fill="currentColor" d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z"/></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="14" height="14"><path fill="currentColor" d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/></svg>
                                        )}
                                    </button>
                                    <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm custom-match-avatar-sm" />
                                    <span className="ml-8 custom-match-ml-8">{u.username}</span>
                                    {(() => { const p = getPresenceStatus(u.id); return (
                                        <span className={`ml-8 custom-match-ml-8 custom-match-status-dot ${p.cls}`} title={p.text}>{p.text}</span>
                                    ); })()}
                                </div>
                            </div>
                        ))}
                        {(() => {
                            const maxSlots = 5;
                            const placeholders = Math.max(0, maxSlots - team1Users.length);
                            return Array.from({ length: placeholders }).map((_, idx) => (
                                <div
                                    key={`ph-1-${idx}`}
                                    className="custom-match-placeholder-slot"
                                    onClick={() => openInvitePanel(1)}
                                    onDragOver={e=>e.preventDefault()}
                                    onDrop={handleDrop(1)}
                                >
                                    <div className="custom-match-placeholder-inner">
                                        <span className="custom-match-plus">+</span>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                    {/* Команда 2 */}
                    <div className="custom-match-team-column custom-match-dropzone" onDragOver={e=>e.preventDefault()} onDrop={handleDrop(2)}>
                        <h4>
                            {lobby?.team2_name || 'Команда 2'}
                            <span className="custom-match-team-ready-status custom-match-ml-8">
                                {teamCountdown[2] != null ? `ready (${teamCountdown[2]})` : (isTeamAllReady(2) ? 'ready' : 'not ready')}
                            </span>
                        </h4>
                        {team2Users.length === 0 && <div className="custom-match-muted">Нет игроков</div>}
                        {team2Users.map(u => (
                            <div key={`t2-${u.id}`} className="list-row custom-match-list-row" draggable onDragStart={(e)=>handleDragStart(e, u.id)}>
                                <div className="list-row-left">
                                    <button className={`custom-match-ready-toggle ${playerReady[u.id] ? 'on' : 'off'}`} title={playerReady[u.id] ? 'Готов' : 'Не готов'} onClick={() => onTogglePlayerReady(u.id, 2)}>
                                        {playerReady[u.id] ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="14" height="14"><path fill="currentColor" d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z"/></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="14" height="14"><path fill="currentColor" d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/></svg>
                                        )}
                                    </button>
                                    <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm custom-match-avatar-sm" />
                                    <span className="ml-8 custom-match-ml-8">{u.username}</span>
                                    {(() => { const p = getPresenceStatus(u.id); return (
                                        <span className={`ml-8 custom-match-ml-8 custom-match-status-dot ${p.cls}`} title={p.text}>{p.text}</span>
                                    ); })()}
                                </div>
                            </div>
                        ))}
                        {(() => {
                            const maxSlots = 5;
                            const placeholders = Math.max(0, maxSlots - team2Users.length);
                            return Array.from({ length: placeholders }).map((_, idx) => (
                                <div
                                    key={`ph-2-${idx}`}
                                    className="custom-match-placeholder-slot"
                                    onClick={() => openInvitePanel(2)}
                                    onDragOver={e=>e.preventDefault()}
                                    onDrop={handleDrop(2)}
                                >
                                    <div className="custom-match-placeholder-inner">
                                        <span className="custom-match-plus">+</span>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </div>

            {/* Кнопка подключиться после завершения */}
            {(connectInfo?.connect || lobby?.status === 'match_created' || lobby?.status === 'ready_to_create') && (
                <div className="custom-match-mt-16">
                    {lobby?.status === 'ready_to_create' && Number(lobby?.created_by) === Number(user?.id) && (
                        <button className="btn btn-primary" onClick={async () => {
                            const token = localStorage.getItem('token');
                            const { data } = await api.post(`/api/admin/match-lobby/${lobbyId}/create-match`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            if (data?.success) setConnectInfo({ connect: data.connect, gotv: data.gotv });
                        }}>СОЗДАЕМ МАТЧ?</button>
                    )}
                    {connectInfo?.connect && (
                        <a className="btn btn-primary custom-match-ml-8" href={connectInfo.connect} target="_blank" rel="noreferrer">
                            Подключиться к матчу
                        </a>
                    )}
                </div>
            )}

            {/* Invite Side Panel */}
            {invitePanelOpen && (
                <div className="custom-match-invite-overlay" onClick={(e) => {
                    if (e.target.classList.contains('custom-match-invite-overlay')) closeInvitePanel();
                }}>
                    <div className="custom-match-invite-panel" role="dialog" aria-modal="true">
                        <div className="custom-match-invite-header">
                            <div className="custom-match-invite-title">Пригласить</div>
                            <button className="custom-match-invite-close" aria-label="Закрыть" onClick={closeInvitePanel}>×</button>
                        </div>
                        <div className="custom-match-invite-body">
                            {/* Friends block */}
                            <div className="custom-match-invite-section">
                                <div className="custom-match-invite-section-title">Друзья</div>
                                {(friends || []).slice(0, friendsExpanded ? friends.length : 5).map(fr => {
                                    const presence = getPresenceStatus(fr.id);
                                    return (
                                        <div key={`fr-${fr.id}`} className="list-row">
                                            <div className="list-row-left">
                                                <button
                                                    className="custom-match-plus-btn"
                                                    title="Пригласить"
                                                    disabled={!lobbyId}
                                                    onClick={() => inviteUserToTeam(fr.id, invitePanelTeam)}
                                                >+</button>
                                                <img src={fr.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm custom-match-avatar-sm" />
                                                <span className="ml-8 custom-match-ml-8">{fr.username}</span>
                                                <span className={`ml-8 custom-match-ml-8 custom-match-status-dot ${presence.cls}`} title={presence.text}></span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {(friends || []).length > 5 && (
                                    <button className="btn btn-secondary custom-match-mt-8" onClick={() => setFriendsExpanded(v => !v)}>
                                        {friendsExpanded ? 'свернуть' : 'развернуть'}
                                    </button>
                                )}
                            </div>

                            {/* Search block */}
                            <div className="custom-match-invite-section custom-match-mt-16">
                                <div className="custom-match-invite-section-title">Поиск пользователей</div>
                                <input
                                    ref={inviteSearchInputRef}
                                    className="input"
                                    placeholder="Найти пользователя"
                                    value={inviteSearch}
                                    onChange={onInviteSearchChange}
                                />
                                <div className="custom-match-mt-8">
                                    {inviteResults.map(u => {
                                        const presence = getPresenceStatus(u.id);
                                        return (
                                            <div key={`inv-${u.id}`} className="list-row">
                                                <div className="list-row-left">
                                                    <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm custom-match-avatar-sm" />
                                                    <span className="ml-8 custom-match-ml-8">{u.username}</span>
                                                    <span className={`ml-8 custom-match-ml-8 custom-match-status-dot ${presence.cls}`} title={presence.text}></span>
                                                </div>
                                                <div className="list-row-right">
                                                    <button className="btn btn-secondary" disabled={!lobbyId} onClick={() => inviteUserToTeam(u.id, invitePanelTeam)}>Пригласить</button>
                                                    <a className="btn btn-secondary custom-match-ml-8" href={`/user/${u.id}`} target="_blank" rel="noreferrer">Профиль</a>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Format change confirm modal */}
            {formatConfirm.open && (
                <div className="custom-match-invite-overlay" onClick={(e) => {
                    if (e.target.classList.contains('custom-match-invite-overlay')) setFormatConfirm({ open: false, target: null });
                }}>
                    <div className="custom-match-format-confirm" role="dialog" aria-modal="true">
                        <div className="custom-match-invite-header">
                            <div className="custom-match-invite-title">Сменить формат?</div>
                            <button className="custom-match-invite-close" aria-label="Закрыть" onClick={() => setFormatConfirm({ open: false, target: null })}>×</button>
                        </div>
                        <div className="custom-match-format-confirm-body">
                            В случае смены формата матча процедуру BAN/PICK придется начать заново.
                        </div>
                        <div className="custom-match-format-confirm-actions">
                            <button className="btn btn-secondary" onClick={() => setFormatConfirm({ open: false, target: null })}>Отмена</button>
                            <button className="btn btn-primary custom-match-ml-8" onClick={async () => {
                                const target = formatConfirm.target;
                                setFormatConfirm({ open: false, target: null });
                                if (!target || !lobbyId) return;
                                const token = localStorage.getItem('token');
                                await api.post(`/api/admin/match-lobby/${lobbyId}/format`, { format: target }, { headers: { Authorization: `Bearer ${token}` } });
                                const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                if (r?.data?.success) {
                                    setLobby(r.data.lobby);
                                    setSelections(r.data.selections || []);
                                    setAvailableMaps(r.data.available_maps || []);
                                    setTeam1Users(r.data.team1_users || []);
                                    setTeam2Users(r.data.team2_users || []);
                                }
                            }}>Подтвердить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminMatchPage;


