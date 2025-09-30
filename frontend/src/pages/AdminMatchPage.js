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
                <div className="custom-match-row">
                    <button className="btn btn-secondary" disabled={!lobbyId} onClick={async () => {
                        const token = localStorage.getItem('token');
                        await api.post(`/api/admin/match-lobby/${lobbyId}/format`, { format: 'bo1' }, { headers: { Authorization: `Bearer ${token}` } });
                        const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                        if (r?.data?.success) { setLobby(r.data.lobby); setSelections(r.data.selections || []); setAvailableMaps(r.data.available_maps || []); setTeam1Users(r.data.team1_users || []); setTeam2Users(r.data.team2_users || []); }
                    }}>BO1</button>
                    <button className="btn btn-secondary" disabled={!lobbyId} onClick={async () => {
                        const token = localStorage.getItem('token');
                        await api.post(`/api/admin/match-lobby/${lobbyId}/format`, { format: 'bo3' }, { headers: { Authorization: `Bearer ${token}` } });
                        const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                        if (r?.data?.success) { setLobby(r.data.lobby); setSelections(r.data.selections || []); setAvailableMaps(r.data.available_maps || []); setTeam1Users(r.data.team1_users || []); setTeam2Users(r.data.team2_users || []); }
                    }}>BO3</button>
                    <button className="btn btn-secondary" disabled={!lobbyId} onClick={async () => {
                        const token = localStorage.getItem('token');
                        await api.post(`/api/admin/match-lobby/${lobbyId}/format`, { format: 'bo5' }, { headers: { Authorization: `Bearer ${token}` } });
                        const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                        if (r?.data?.success) { setLobby(r.data.lobby); setSelections(r.data.selections || []); setAvailableMaps(r.data.available_maps || []); setTeam1Users(r.data.team1_users || []); setTeam2Users(r.data.team2_users || []); }
                    }}>BO5</button>
                    {/* Старт пик/бан (после готовности обеих команд) */}
                    <button className="btn btn-secondary" disabled={!lobbyId || !(lobby?.status === 'ready')}
                        onClick={async () => {
                            const token = localStorage.getItem('token');
                            const { data } = await api.post(`/api/admin/match-lobby/${lobbyId}/start-pick`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            if (data?.success) {
                                const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                if (r?.data?.success) { setLobby(r.data.lobby); setSelections(r.data.selections || []); setAvailableMaps(r.data.available_maps || []); setTeam1Users(r.data.team1_users || []); setTeam2Users(r.data.team2_users || []); }
                            }
                        }}>Начать ban/pick</button>
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

            {/* Панель готовности и вступления админа */}
            {lobbyId && (
                <div className="custom-match-mt-16">
                    <div className="custom-match-row">
                        <button className="btn btn-secondary" onClick={async () => {
                            const token = localStorage.getItem('token');
                            await api.post(`/api/admin/match-lobby/${lobbyId}/join`, { team: 1 }, { headers: { Authorization: `Bearer ${token}` } });
                        }}>Вступить в Команду 1</button>
                        <button className="btn btn-secondary" onClick={async () => {
                            const token = localStorage.getItem('token');
                            await api.post(`/api/admin/match-lobby/${lobbyId}/join`, { team: 2 }, { headers: { Authorization: `Bearer ${token}` } });
                        }}>Вступить в Команду 2</button>
                        <button className="btn btn-secondary" onClick={async () => {
                            const token = localStorage.getItem('token');
                            await api.post(`/api/admin/match-lobby/${lobbyId}/ready`, { team: 1, ready: true }, { headers: { Authorization: `Bearer ${token}` } });
                        }}>Команда 1 Готова</button>
                        <button className="btn btn-secondary" onClick={async () => {
                            const token = localStorage.getItem('token');
                            await api.post(`/api/admin/match-lobby/${lobbyId}/ready`, { team: 2, ready: true }, { headers: { Authorization: `Bearer ${token}` } });
                        }}>Команда 2 Готова</button>
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
                        <h4>{lobby?.team1_name || 'Команда 1'}</h4>
                        {team1Users.length === 0 && <div className="custom-match-muted">Нет игроков</div>}
                        {team1Users.map(u => (
                            <div key={`t1-${u.id}`} className="list-row custom-match-list-row" draggable onDragStart={(e)=>handleDragStart(e, u.id)}>
                                <div className="list-row-left">
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
                        <h4>{lobby?.team2_name || 'Команда 2'}</h4>
                        {team2Users.length === 0 && <div className="custom-match-muted">Нет игроков</div>}
                        {team2Users.map(u => (
                            <div key={`t2-${u.id}`} className="list-row custom-match-list-row" draggable onDragStart={(e)=>handleDragStart(e, u.id)}>
                                <div className="list-row-left">
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
        </div>
    );
}

export default AdminMatchPage;


