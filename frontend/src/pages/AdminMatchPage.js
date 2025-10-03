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
    const [createdMatchId, setCreatedMatchId] = useState(null);
    const [finalScore1, setFinalScore1] = useState('');
    const [finalScore2, setFinalScore2] = useState('');
    const [finalWinnerTeam, setFinalWinnerTeam] = useState('');
    const [configJsonUrl, setConfigJsonUrl] = useState('');
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
    // Per‑player readiness
    const [playerReady, setPlayerReady] = useState({}); // { [userId]: boolean }
    const playerReadyRef = useRef({});
    const pollInFlightRef = useRef(false);
    const teamConfirmInFlightRef = useRef({ 1: false, 2: false });
    const missingReadyCountersRef = useRef({}); // { [userId]: consecutive-misses }
    const readyStorageKey = useMemo(() => lobbyId ? `admin_lobby_player_ready_${lobbyId}` : null, [lobbyId]);
    
    // Inline hints state
    const [hints, setHints] = useState({
        format: !localStorage.getItem('hint_format_used'),
        invite: !localStorage.getItem('hint_invite_used'),
        ready: !localStorage.getItem('hint_ready_used'),
        pickban: !localStorage.getItem('hint_pickban_used'),
    });

    const dismissHint = useCallback((key) => {
        localStorage.setItem(`hint_${key}_used`, 'true');
        setHints(prev => ({ ...prev, [key]: false }));
    }, []);

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

    // Load saved readiness on lobby change
    useEffect(() => {
        if (!readyStorageKey) return;
        try {
            const raw = localStorage.getItem(readyStorageKey);
            if (raw) {
                const saved = JSON.parse(raw);
                if (saved && typeof saved === 'object') {
                    setPlayerReady(prev => ({ ...prev, ...saved }));
                }
            }
        } catch (_) {}
    }, [readyStorageKey]);

    // Persist readiness changes
    useEffect(() => {
        if (!readyStorageKey) return;
        try {
            localStorage.setItem(readyStorageKey, JSON.stringify(playerReady));
        } catch (_) {}
    }, [playerReady, readyStorageKey]);

    // держим актуальное значение готовности в ref для фоновых интервалов
    useEffect(() => { playerReadyRef.current = playerReady; }, [playerReady]);

    function isTeamAllReady(teamId) {
        const list = teamId === 1 ? team1Users : team2Users;
        if (!list || list.length === 0) return false;
        return list.every(u => !!playerReady[u.id]);
    }

    async function confirmTeamReady(teamId) {
        try {
            if (teamConfirmInFlightRef.current[teamId]) return;
            teamConfirmInFlightRef.current[teamId] = true;
            const token = localStorage.getItem('token');
            await api.post(`/api/admin/match-lobby/${lobbyId}/ready`, { team: teamId, ready: true }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (_) {
        } finally {
            teamConfirmInFlightRef.current[teamId] = false;
        }
    }

    async function onTogglePlayerReady(userId, teamId) {
        // локальный тумблер
        setPlayerReady(prev => {
            const next = { ...prev, [userId]: !prev[userId] };
            // без таймера: при полной готовности команды сразу подтверждаем её на сервере
            setTimeout(async () => {
                if (isTeamAllReady(teamId)) {
                    try { await confirmTeamReady(teamId); } catch (_) {}
                }
            }, 0);
            return next;
        });
        // отправим heartbeat в лобби (для live) — без изменения прав на backend
        try {
            const token = localStorage.getItem('token');
            const nextReady = !(playerReady[userId]);
            await api.post(`/api/admin/match-lobby/${lobbyId}/presence`, { ready: nextReady }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (_) {}
    }

    // Heartbeat присутствия: обновляем last_seen и текущую готовность пользователя раз в 10с
    useEffect(() => {
        if (!user || !lobbyId) return;
        const token = localStorage.getItem('token');
        let timer = null;
        const push = async () => {
            try {
                const currentReady = !!playerReadyRef.current[user?.id];
                await api.post(`/api/admin/match-lobby/${lobbyId}/presence`, { ready: currentReady }, { headers: { Authorization: `Bearer ${token}` } });
            } catch (_) {}
        };
        // мгновенный пульс при монтировании
        push();
        timer = setInterval(push, 10000);
        return () => { if (timer) clearInterval(timer); };
    }, [user?.id, lobbyId]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        api.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => {
                setUser(r.data);
                setIsAdmin(r.data?.role === 'admin');
                try { console.log('[ADMIN_LOBBY] /users/me =>', { id: r.data?.id, role: r.data?.role }); } catch (_) {}
            })
            .catch(() => {});
    }, []);

    // Приглашать может админ или создатель лобби
    const canInvite = useMemo(() => {
        if (!user) return false;
        if (isAdmin) return true;
        // создатель лобби всегда может приглашать
        if (lobby && lobby.created_by && Number(lobby.created_by) === Number(user.id)) return true;
        // админ лобби (owner/admin) тоже может приглашать
        // сервер уже проверяет права, здесь просто не блокируем UI
        return true;
    }, [isAdmin, lobby, user]);

    // Создать/получить админ-лобби
    const ensureAdminLobby = useCallback(async () => {
        if (!isAdmin) { try { console.log('[ADMIN_LOBBY] ensureAdminLobby skipped (not admin)'); } catch (_) {} return; }
        const token = localStorage.getItem('token');
        try { console.log('[ADMIN_LOBBY] ensureAdminLobby start'); } catch (_) {}
        const { data } = await api.post('/api/admin/match-lobby', {}, { headers: { Authorization: `Bearer ${token}` } });
        if (data?.success) {
            setLobbyId(data.lobby.id);
            try { console.log('[ADMIN_LOBBY] ensureAdminLobby ok', { lobbyId: data.lobby.id }); } catch (_) {}
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
                try { console.log('[ADMIN_LOBBY] initial state loaded', { team1: (r.data.team1_users || []).length, team2: (r.data.team2_users || []).length, unassigned: (r.data.unassigned_users || []).length }); } catch (_) {}
            } else {
                setLobby(data.lobby);
                setAvailableMaps(data.available_maps || []);
            }
        }
    }, [isAdmin]);

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
            const acceptFlag = !!team;
            try { console.log('[INVITE_PANEL] invite click', { lobbyId, userId, team, accept: acceptFlag, canInvite }); } catch (_) {}
            await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: userId, team, accept: acceptFlag }, { headers: { Authorization: `Bearer ${token}` } });
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
            try { console.log('[INVITE_PANEL] fetched friends', Array.isArray(data) ? data.length : 0); } catch (_) {}
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

    useEffect(() => {
        if (invitePanelOpen) {
            try {
                console.log('[INVITE_PANEL] state', { lobbyId, canInvite, invitePanelTeam, userId: user?.id, createdBy: lobby?.created_by });
            } catch (_) {}
        }
    }, [invitePanelOpen, canInvite, invitePanelTeam, lobby, user, lobbyId]);

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
                try { console.log('[INVITE_PANEL] search results', Array.isArray(data) ? data.length : 0, 'for', value); } catch (_) {}
                setInviteResults(Array.isArray(data) ? data : []);
            } catch (_) { setInviteResults([]); }
        }, 250);
    }

    // DnD helpers
    function handleDragStart(e, userId) {
        try { e.dataTransfer.setData('text/plain', String(userId)); } catch (_) {}
    }
    function handleDrop(team, targetUserId = null) {
        return async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const token = localStorage.getItem('token');
            let raw = '';
            try { raw = e.dataTransfer.getData('text/plain'); } catch (_) {}
            const draggedUserId = Number(raw);
            if (!draggedUserId || !lobbyId) return;
            
            try {
                // Если дропнули на другого игрока (targetUserId) — меняем местами
                if (targetUserId && targetUserId !== draggedUserId) {
                    // Находим текущие команды обоих игроков
                    let draggedTeam = null;
                    let targetTeam = null;
                    
                    if (team1Users.some(u => u.id === draggedUserId)) draggedTeam = 1;
                    else if (team2Users.some(u => u.id === draggedUserId)) draggedTeam = 2;
                    
                    if (team1Users.some(u => u.id === targetUserId)) targetTeam = 1;
                    else if (team2Users.some(u => u.id === targetUserId)) targetTeam = 2;
                    
                    // Меняем местами: draggedUser → targetTeam, targetUser → draggedTeam
                    if (draggedTeam !== null && targetTeam !== null) {
                        await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: draggedUserId, team: targetTeam, accept: true }, { headers: { Authorization: `Bearer ${token}` } });
                        await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: targetUserId, team: draggedTeam, accept: true }, { headers: { Authorization: `Bearer ${token}` } });
                    }
                } else {
                    // Обычное перемещение в команду/пустой слот
                    await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: draggedUserId, team, accept: true }, { headers: { Authorization: `Bearer ${token}` } });
                }
                
                // Обновляем состояние
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
                    if (Array.isArray(r.data.ready_user_ids)) {
                        setPlayerReady(prev => {
                            const next = { ...prev };
                            for (const id of r.data.ready_user_ids) next[id] = true;
                            // снимаем готовность тех, кого нет в списке
                            for (const u of [...r.data.team1_users || [], ...r.data.team2_users || []]) {
                                if (!r.data.ready_user_ids.includes(u.id)) next[u.id] = false;
                            }
                            return next;
                        });
                    }
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

    // Live‑обновления через polling (без WS) с динамическим интервалом и паузой в background
    useEffect(() => {
        if (!user || !lobbyId) return;
        const token = localStorage.getItem('token');
        let timer = null;
        const getDelay = () => {
            const hidden = typeof document !== 'undefined' && document.hidden;
            const status = lobby?.status;
            if (hidden) return 15000; // вкладка в фоне — реже
            if (status === 'picking') return 3000; // активный этап — умеренно
            if (status === 'ready' || status === 'waiting') return 5000;
            return 4000; // дефолт
        };
        const onVisibility = () => { /* сбросим таймер на новый интервал */ };
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
        const pull = async () => {
            if (pollInFlightRef.current) { timer = setTimeout(pull, 4000); return; }
            pollInFlightRef.current = true;
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

                    // стабилизация готовности: липкая синхронизация + гистерезис 2 цикла на снятие готовности
                    const t1 = (r.data.team1_users || []).map(u => u.id);
                    const t2 = (r.data.team2_users || []).map(u => u.id);
                    const readySet = new Set(Array.isArray(r.data.ready_user_ids) ? r.data.ready_user_ids : []);

                    let nextReadyMap = { ...playerReadyRef.current };
                    const counters = missingReadyCountersRef.current;
                    for (const id of [...t1, ...t2]) {
                        if (readySet.has(id)) {
                            nextReadyMap[id] = true;
                            counters[id] = 0;
                        } else {
                            counters[id] = (counters[id] || 0) + 1;
                            if (counters[id] >= 2) {
                                nextReadyMap[id] = false;
                            }
                        }
                    }
                    setPlayerReady(nextReadyMap);

                    // расчет «все готовы» по стабилизированным данным
                    const allReady1 = t1.length > 0 && t1.every(id => !!nextReadyMap[id]);
                    const allReady2 = t2.length > 0 && t2.every(id => !!nextReadyMap[id]);

                    // без таймера: подтверждаем готовность команды сразу
                    if (allReady1 && r.data.lobby?.team1_ready !== true) { try { await confirmTeamReady(1); } catch (_) {} }
                    if (allReady2 && r.data.lobby?.team2_ready !== true) { try { await confirmTeamReady(2); } catch (_) {} }

                    // авто‑подхват ссылок подключения, когда матч готов к подключению/созданию
                    if ((['match_created','ready_to_create','completed'].includes(r.data.lobby?.status)) && !connectInfo) {
                        try {
                            const conn = await api.get(`/api/admin/match-lobby/${lobbyId}/connect`, { headers: { Authorization: `Bearer ${token}` } });
                            if (conn?.data?.success) setConnectInfo(conn.data);
                        } catch (_) {}
                    }
                    // Если матч уже завершён на сервере — редиректим всех в страницу матча (если мы знаем id)
                    if (r.data.lobby?.match_id && r.data.lobby?.status === 'completed') {
                        try { window.location.href = `/matches/custom/${r.data.lobby.match_id}`; } catch (_) {}
                    }
                }
            } catch (_) {}
            pollInFlightRef.current = false;
            timer = setTimeout(pull, getDelay());
        };
        pull();
        return () => {
            if (timer) clearTimeout(timer);
            if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
        };
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

    // Fallback retry: если лобби не создалось, повторим попытку через 1.5с
    useEffect(() => {
        if (!isAdmin || lobbyId) return;
        const t = setTimeout(() => {
            try { console.log('[ADMIN_LOBBY] retry ensureAdminLobby (timer)'); } catch (_) {}
            ensureAdminLobby().catch(() => {});
        }, 1500);
        return () => clearTimeout(t);
    }, [isAdmin, lobbyId, ensureAdminLobby]);

    // Не блокируем страницу для приглашенных не-админов

    return (
        <div className="custom-match-page">
            <h2>МАТЧ — тестовое лобби</h2>
            
            {/* Подсказка: выбор формата */}
            {hints.format && !lobby?.match_format && (
                <div className="inline-hint inline-hint-info">
                    <svg className="hint-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="10" fill="#4a9eff"/>
                        <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">i</text>
                    </svg>
                    <span className="hint-text">
                        <strong>Выберите формат матча:</strong> BO1 (1 карта), BO3 (до 2 побед), BO5 (до 3 побед)
                    </span>
                    <button className="hint-close" onClick={() => dismissHint('format')} aria-label="Закрыть подсказку">×</button>
                </div>
            )}
            
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
                    {(() => {
                        const ready1 = lobby?.team1_ready === true;
                        const ready2 = lobby?.team2_ready === true;
                        const hasFormat = !!lobby?.match_format;
                        const canStart = !!lobbyId && hasFormat && (lobby?.status === 'ready' || (ready1 && ready2));
                        
                        let tip = '';
                        if (!hasFormat) {
                            tip = 'Сначала выберите формат матча (BO1, BO3 или BO5)';
                        } else if (!ready1 || !ready2) {
                            tip = `Готовность команд: ${ready1 ? 'Team_A — ready' : 'Team_A — not ready'}, ${ready2 ? 'Team_B — ready' : 'Team_B — not ready'}`;
                        }
                        
                        return (
                            <div className="custom-match-tooltip">
                                <button
                                    className={`btn btn-secondary ${!canStart ? 'btn-disabled' : ''}`}
                                    disabled={!canStart}
                                    onClick={async () => {
                                        const token = localStorage.getItem('token');
                                        const { data } = await api.post(`/api/admin/match-lobby/${lobbyId}/start-pick`, {}, { headers: { Authorization: `Bearer ${token}` } });
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
                                        }
                                    }}
                                    title={canStart ? 'Начать процедуру выбора карт' : tip}
                                >Начать BAN/PICK</button>
                                {!canStart && tip && (
                                    <div className="custom-match-tooltip-bubble">{tip}</div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
            

            {/* Подсказка: приглашение игроков */}
            {hints.invite && team1Users.length === 0 && team2Users.length === 0 && (
                <div className="inline-hint inline-hint-success">
                    <svg className="hint-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" fill="#ffd700"/>
                    </svg>
                    <span className="hint-text">
                        <strong>Добавьте игроков:</strong> Нажмите <strong>+</strong> в слотах команд или откройте панель справа для приглашения друзей
                    </span>
                    <button className="hint-close" onClick={() => dismissHint('invite')} aria-label="Закрыть подсказку">×</button>
                </div>
            )}
            
            {/* Подсказка: начать процедуру BAN/PICK когда команды готовы */}
            {hints.pickban && lobby?.status === 'ready' && lobby?.team1_ready && lobby?.team2_ready && (
                <div className="inline-hint inline-hint-success">
                    <svg className="hint-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#00ff00"/>
                    </svg>
                    <span className="hint-text">
                        ✅ <strong>Обе команды готовы!</strong> Нажмите кнопку <strong>"Начать BAN/PICK"</strong> выше, чтобы капитаны начали выбор карт
                    </span>
                    <button className="hint-close" onClick={() => dismissHint('pickban')} aria-label="Закрыть подсказку">×</button>
                </div>
            )}
            
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

            {(isAdmin || Number(lobby?.created_by) === Number(user?.id)) && (
                <div className="custom-match-mt-16">
                    {/* Очистка лобби — только админ или создатель */}
                    <button className="btn btn-secondary" disabled={!lobbyId || !user || (lobby && user && lobby.created_by && Number(lobby.created_by) !== Number(user.id))}
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
                                    try {
                                        const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                        if (r?.data?.success) {
                                            setLobby(r.data.lobby);
                                            setSelections(r.data.selections || []);
                                            setAvailableMaps(r.data.available_maps || []);
                                            setTeam1Users(r.data.team1_users || []);
                                            setTeam2Users(r.data.team2_users || []);
                                        }
                                    } catch(_) {}
                                }
                            } catch (_) {}
                        }}>
                        Очистить лобби
                    </button>
                </div>
            )}

            {/* Подключение к серверу */}
            {lobby && lobby.status === 'match_created' && (
                <div className="custom-match-mt-16">
                    <h3>Подключение к серверу</h3>
                    {connectInfo && connectInfo.connect ? (
                        <>
                            <div className="list-row">
                                <div className="list-row-left">
                                    <span>Игроки:</span>
                                    <code className="code-inline custom-match-code-inline">{connectInfo.connect}</code>
                                </div>
                                <div className="list-row-right">
                                    <button className="btn btn-secondary" onClick={() => copy(connectInfo.connect)}>Копировать</button>
                                </div>
                            </div>
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
                        </>
                    ) : (
                        <div className="admin-error">
                            ⚠️ Не удалось найти свободный сервер. Добавьте сервера в админ панели или проверьте что они активны и доступны.
                        </div>
                    )}
                </div>
            )}

            {/* Завершение матча (только админ/создатель), когда матч создан */}
            {lobby && lobby.status === 'match_created' && (isAdmin || Number(lobby?.created_by) === Number(user?.id)) && (
                <div className="custom-match-mt-16">
                    <h3>Завершить матч</h3>
                    <div className="list-row">
                        <div className="list-row-left" style={{gap:12, alignItems:'center'}}>
                            <span>{lobby.team1_name || 'Team_A'}</span>
                            <input
                                type="number"
                                min="0"
                                value={finalScore1}
                                onChange={(e)=>setFinalScore1(e.target.value)}
                                placeholder="Счёт"
                                className="input"
                                style={{width:80}}
                            />
                            <span>:</span>
                            <input
                                type="number"
                                min="0"
                                value={finalScore2}
                                onChange={(e)=>setFinalScore2(e.target.value)}
                                placeholder="Счёт"
                                className="input"
                                style={{width:80}}
                            />
                            <select value={finalWinnerTeam} onChange={(e)=>setFinalWinnerTeam(e.target.value)} className="input" style={{width:200}}>
                                <option value="">Победитель…</option>
                                <option value="1">{lobby.team1_name || 'Team_A'}</option>
                                <option value="2">{lobby.team2_name || 'Team_B'}</option>
                            </select>
                        </div>
                        <div className="list-row-right">
                            <button
                                className="btn btn-primary"
                                onClick={async ()=>{
                                    const token = localStorage.getItem('token');
                                    const body = {
                                        score1: Number(finalScore1)||0,
                                        score2: Number(finalScore2)||0,
                                        winner_team_id: finalWinnerTeam ? Number(finalWinnerTeam) : null
                                    };
                                    try {
                                        await api.post(`/api/admin/match-lobby/${lobbyId}/complete`, body, { headers: { Authorization: `Bearer ${token}` } });
                                        // следующий pull увидит status=completed и выполнит редирект
                                    } catch (_) {}
                                }}
                                disabled={!finalWinnerTeam || finalScore1==='' || finalScore2===''}
                            >Завершить</button>
                        </div>
                    </div>
                </div>
            )}

            

            {/* Подсказка: процедура pick/ban во время выбора карт */}
            {lobby?.status === 'picking' && selections.length < 3 && (
                <div className="inline-hint inline-hint-info">
                    <svg className="hint-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#00ff00"/>
                    </svg>
                    <span className="hint-text">
                        🎮 <strong>Капитаны выбирают карты по очереди.</strong> Выбранные карты будут подсвечены зелёным. После завершения появятся ссылки подключения к серверу
                    </span>
                    <button className="hint-close" onClick={() => dismissHint('pickban')} aria-label="Закрыть подсказку">×</button>
                </div>
            )}
            
            {/* Доска выбора карт */}
            {lobby && lobby.match_format && availableMaps?.length > 0 && (
                <div className="custom-match-mt-16">
                    <MapSelectionBoard
                        maps={availableMaps}
                        selections={selections}
                        currentTurn={lobby.current_turn_team || null}
                        myTeamId={(() => {
                            const meId = Number(user?.id);
                            if (team1Users.some(u => Number(u.id) === meId)) return 1;
                            if (team2Users.some(u => Number(u.id) === meId)) return 2;
                            return null;
                        })()}
                        isCaptain={(() => {
                            const meId = Number(user?.id);
                            // капитан по умолчанию — первый в списке команды
                            const cap1 = team1Users[0]?.id ? Number(team1Users[0].id) : null;
                            const cap2 = team2Users[0]?.id ? Number(team2Users[0].id) : null;
                            return meId === cap1 || meId === cap2;
                        })()}
                        format={lobby.match_format}
                        status={lobby.status}
                        onMapAction={async (mapName, action) => {
                            try {
                                const token = localStorage.getItem('token');
                                const { data } = await api.post(`/api/admin/match-lobby/${lobbyId}/select-map`, { mapName, action }, { headers: { Authorization: `Bearer ${token}` } });
                                if (data?.success) {
                                    // Обновляем selections напрямую из ответа
                                    if (data.selections) setSelections(data.selections);
                                    if (data.available_maps) setAvailableMaps(data.available_maps);
                                    // Если пик/бан завершён — сохраняем match_id и ссылки
                                    if (data.completed) {
                                        if (data.match_id) setCreatedMatchId(data.match_id);
                                        if (data.connect && data.gotv) setConnectInfo({ connect: data.connect, gotv: data.gotv });
                                    }
                                    // Подтягиваем свежее состояние лобби (но не дублируем запросы)
                                    const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                    if (r?.data?.success) {
                                        setLobby(r.data.lobby);
                                        setSelections(r.data.selections || []);
                                        setAvailableMaps(r.data.available_maps || []);
                                    }
                                }
                            } catch (err) {
                                console.error('Ошибка выбора карты:', err);
                            }
                        }}
                        teamNames={{ 1: lobby.team1_name || 'Team_A', 2: lobby.team2_name || 'Team_B' }}
                    />
                </div>
            )}

            {/* Ссылка на JSON конфиг после завершения BAN/PICK */}
            {configJsonUrl && (
                <div className="custom-match-mt-16">
                    <h3>JSON конфиг лобби</h3>
                    <div className="list-row">
                        <div className="list-row-left">
                            <a href={configJsonUrl} target="_blank" rel="noreferrer" className="code-inline custom-match-code-inline">{configJsonUrl}</a>
                        </div>
                        <div className="list-row-right">
                            <button className="btn btn-secondary" onClick={() => copy(`${window.location.origin}${configJsonUrl}`)}>Копировать URL</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Подсказка: готовность игроков */}
            {hints.ready && (team1Users.length > 0 || team2Users.length > 0) && lobby?.status === 'waiting' && (
                <div className="inline-hint inline-hint-warning">
                    <svg className="hint-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#ffa500"/>
                    </svg>
                    <span className="hint-text">
                        💡 <strong>Каждый игрок отмечает готовность.</strong> Первый в команде становится капитаном (золотая рамка). Админ может принудительно отметить команду готовой кнопкой "ready"
                    </span>
                    <button className="hint-close" onClick={() => dismissHint('ready')} aria-label="Закрыть подсказку">×</button>
                </div>
            )}
            
            {/* Составы команд (dropzones с placeholder-слотами) */}
            <div className="custom-match-mt-16">
                <h3>Состав команд</h3>
                <div className="custom-match-row-lg custom-match-teams">
                    {/* Команда 1 */}
                    <div className="custom-match-team-column custom-match-dropzone" onDragOver={e=>e.preventDefault()} onDrop={handleDrop(1)}>
                        <h4>
                            {lobby?.team1_name || 'Team_A'}
                            <span className="custom-match-team-ready-status custom-match-ml-8">
                                {lobby?.team1_ready === true ? 'ready' : 'not ready'}
                            </span>
                        </h4>
                        {team1Users.length === 0 && <div className="custom-match-muted">Нет игроков</div>}
                        {team1Users.map((u, idx) => (
                            <div key={`t1-${u.id}`} className={`list-row custom-match-list-row ${idx === 0 ? 'custom-match-captain-row' : ''}`} draggable onDragStart={(e)=>handleDragStart(e, u.id)} onDragOver={e=>e.preventDefault()} onDrop={handleDrop(1, u.id)}>
                                <div className="list-row-left">
                                    <span
                                        className={`custom-match-ready-toggle ${playerReady[u.id] ? 'on' : 'off'} ${u.id !== Number(user?.id) ? 'disabled' : ''}`}
                                        title={playerReady[u.id] ? 'Готов' : 'Не готов'}
                                        onClick={() => { if (u.id === Number(user?.id)) onTogglePlayerReady(u.id, 1); }}
                                        role="img"
                                        aria-label={playerReady[u.id] ? 'Готов' : 'Не готов'}
                                    >
                                        {playerReady[u.id]
                                            ? (
                                                <svg className="custom-match-ready-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor"><path d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z"/></svg>
                                            ) : (
                                                <svg className="custom-match-ready-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor"><path d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/></svg>
                                            )}
                                    </span>
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
                        {(isAdmin || Number(lobby?.created_by) === Number(user?.id)) && (
                            <div className="custom-match-mt-8">
                                <button className="btn btn-secondary" onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    await api.post(`/api/admin/match-lobby/${lobbyId}/ready`, { team: 1, ready: true }, { headers: { Authorization: `Bearer ${token}` } });
                                }}>ready</button>
                            </div>
                        )}
                    </div>
                    {/* VS Block */}
                    <div className="custom-match-vs-block">VS</div>
                    {/* Команда 2 */}
                    <div className="custom-match-team-column custom-match-dropzone" onDragOver={e=>e.preventDefault()} onDrop={handleDrop(2)}>
                        <h4>
                            {lobby?.team2_name || 'Team_B'}
                            <span className="custom-match-team-ready-status custom-match-ml-8">
                                {lobby?.team2_ready === true ? 'ready' : 'not ready'}
                            </span>
                        </h4>
                        {team2Users.length === 0 && <div className="custom-match-muted">Нет игроков</div>}
                        {team2Users.map((u, idx) => (
                            <div key={`t2-${u.id}`} className={`list-row custom-match-list-row ${idx === 0 ? 'custom-match-captain-row' : ''}`} draggable onDragStart={(e)=>handleDragStart(e, u.id)} onDragOver={e=>e.preventDefault()} onDrop={handleDrop(2, u.id)}>
                                <div className="list-row-left">
                                    <span
                                        className={`custom-match-ready-toggle ${playerReady[u.id] ? 'on' : 'off'} ${u.id !== Number(user?.id) ? 'disabled' : ''}`}
                                        title={playerReady[u.id] ? 'Готов' : 'Не готов'}
                                        onClick={() => { if (u.id === Number(user?.id)) onTogglePlayerReady(u.id, 2); }}
                                        role="img"
                                        aria-label={playerReady[u.id] ? 'Готов' : 'Не готов'}
                                    >
                                        {playerReady[u.id]
                                            ? (
                                                <svg className="custom-match-ready-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor"><path d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z"/></svg>
                                            ) : (
                                                <svg className="custom-match-ready-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor"><path d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/></svg>
                                            )}
                                    </span>
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
                        {(isAdmin || Number(lobby?.created_by) === Number(user?.id)) && (
                            <div className="custom-match-mt-8">
                                <button className="btn btn-secondary" onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    await api.post(`/api/admin/match-lobby/${lobbyId}/ready`, { team: 2, ready: true }, { headers: { Authorization: `Bearer ${token}` } });
                                }}>ready</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Кнопка подключиться после завершения */}
            {(connectInfo?.connect || ['match_created','ready_to_create','completed'].includes(lobby?.status)) && (
                <div className="custom-match-mt-16">
                    {['ready_to_create','completed'].includes(lobby?.status) && Number(lobby?.created_by) === Number(user?.id) && (
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
                                                    disabled={!lobbyId || !canInvite}
                                                    onClick={() => canInvite && inviteUserToTeam(fr.id, invitePanelTeam || null)}
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
                                                    <button className="btn btn-secondary" disabled={!lobbyId || !canInvite} onClick={() => canInvite && inviteUserToTeam(u.id, invitePanelTeam || null)}>Пригласить</button>
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
            
            {/* Кнопка "Показать все подсказки" */}
            {(!hints.format || !hints.invite || !hints.ready || !hints.pickban) && (
                <button 
                    className="show-hints-btn"
                    onClick={() => {
                        setHints({ format: true, invite: true, ready: true, pickban: true });
                        localStorage.removeItem('hint_format_used');
                        localStorage.removeItem('hint_invite_used');
                        localStorage.removeItem('hint_ready_used');
                        localStorage.removeItem('hint_pickban_used');
                    }}
                    title="Показать все подсказки"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
                    </svg>
                    Подсказки
                </button>
            )}
        </div>
    );
}

export default AdminMatchPage;


