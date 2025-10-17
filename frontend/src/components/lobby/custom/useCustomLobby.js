// 🎮 useCustomLobby - Хук для кастомного лобби
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../axios';

function useCustomLobby(user, isAdmin) {
    const navigate = useNavigate();
    const [lobbyId, setLobbyId] = useState(null);
    const [lobby, setLobby] = useState(null);
    const [availableMaps, setAvailableMaps] = useState([]);
    const [selections, setSelections] = useState([]);
    const [team1Users, setTeam1Users] = useState([]);
    const [team2Users, setTeam2Users] = useState([]);
    const [unassignedUsers, setUnassignedUsers] = useState([]);
    const [invitedPendingUsers, setInvitedPendingUsers] = useState([]);
    const [invitedDeclinedUsers, setInvitedDeclinedUsers] = useState([]);
    const [onlineUserIds, setOnlineUserIds] = useState([]);
    const [playerReady, setPlayerReady] = useState({});
    const [loading, setLoading] = useState(false);
    const playerReadyRef = useRef({});
    const pollInFlightRef = useRef(false);
    const teamConfirmInFlightRef = useRef({ 1: false, 2: false });
    const readyStorageKey = useMemo(() => lobbyId ? `admin_lobby_player_ready_${lobbyId}` : null, [lobbyId]);

    // Может ли пользователь приглашать
    const canInvite = useMemo(() => {
        if (!user) return false;
        if (isAdmin) return true;
        if (lobby && lobby.created_by && Number(lobby.created_by) === Number(user.id)) return true;
        return true; // Backend проверяет права
    }, [isAdmin, lobby, user]);

    // Обновление состояния лобби
    const updateLobbyState = useCallback((data) => {
        setLobby(data.lobby);
        setSelections(data.selections || []);
        setAvailableMaps(data.available_maps || []);
        setTeam1Users(data.team1_users || []);
        setTeam2Users(data.team2_users || []);
        setUnassignedUsers(data.unassigned_users || []);
        setInvitedPendingUsers(data.invited_pending_users || []);
        setInvitedDeclinedUsers(data.invited_declined_users || []);
        setOnlineUserIds(data.online_user_ids || []);
        
        // Обновляем готовность игроков из данных сервера
        const readyState = {};
        [...(data.team1_users || []), ...(data.team2_users || [])].forEach(u => {
            readyState[u.id] = u.is_ready || false;
        });
        setPlayerReady(readyState);
    }, []);

    // Создать/получить админ-лобби
    const ensureAdminLobby = useCallback(async () => {
        if (!isAdmin) return;
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            const { data } = await api.post('/api/admin/match-lobby', {}, { headers: { Authorization: `Bearer ${token}` } });
            if (data?.success) {
                setLobbyId(data.lobby.id);
                const r = await api.get(`/api/admin/match-lobby/${data.lobby.id}`, { headers: { Authorization: `Bearer ${token}` } });
                if (r?.data?.success) {
                    updateLobbyState(r.data);
                } else {
                    setLobby(data.lobby);
                    setAvailableMaps(data.available_maps || []);
                }
            }
        } catch (err) {
            console.error('Ошибка создания лобби:', err);
        } finally {
            setLoading(false);
        }
    }, [isAdmin, updateLobbyState]);

    // Загрузить лобби для приглашенного пользователя
    const loadInvitedLobby = useCallback(async () => {
        if (isAdmin) return; // Админы создают лобби сами
        
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            // Получаем список приглашений
            const { data } = await api.get('/api/admin/match-lobbies/my-invites', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (data?.success && data.invites?.length > 0) {
                // Берем первое активное лобби
                const invite = data.invites[0];
                setLobbyId(invite.lobby_id);
                
                // Загружаем полное состояние лобби
                const r = await api.get(`/api/admin/match-lobby/${invite.lobby_id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (r?.data?.success) {
                    updateLobbyState(r.data);
                }
            }
        } catch (err) {
            console.error('Ошибка загрузки приглашенного лобби:', err);
        } finally {
            setLoading(false);
        }
    }, [isAdmin, updateLobbyState]);

    // Загрузка состояния лобби
    const refreshLobbyState = useCallback(async () => {
        if (!lobbyId) return;
        const token = localStorage.getItem('token');
        try {
            const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (r?.data?.success) {
                updateLobbyState(r.data);
            }
        } catch (err) {
            console.error('Ошибка загрузки лобби:', err);
        }
    }, [lobbyId, updateLobbyState]);

    // Приглашение пользователя
    const inviteUserToTeam = useCallback(async (userId, team) => {
        console.log('[useCustomLobby] inviteUserToTeam вызван:', { userId, team, lobbyId });
        
        if (!userId || !team) {
            console.error('[useCustomLobby] Отсутствует userId или team:', { userId, team });
            return;
        }
        
        if (!lobbyId) {
            console.error('[useCustomLobby] Отсутствует lobbyId! Нужно создать лобби сначала.');
            return;
        }
        
        const token = localStorage.getItem('token');
        try {
            const acceptFlag = !!team;
            console.log('[useCustomLobby] Отправка приглашения:', { lobbyId, userId, team, acceptFlag });
            
            await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: userId, team, accept: acceptFlag }, { headers: { Authorization: `Bearer ${token}` } });
            
            console.log('[useCustomLobby] Приглашение успешно, обновляем состояние');
            await refreshLobbyState();
        } catch (err) {
            console.error('[useCustomLobby] Ошибка приглашения:', err);
        }
    }, [lobbyId, refreshLobbyState]);

    // Удаление пользователя
    const removeUserFromLobby = useCallback(async (userId) => {
        if (!userId || !lobbyId) return;
        const token = localStorage.getItem('token');
        try {
            await api.delete(`/api/admin/match-lobby/${lobbyId}/invite/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (Number(userId) === Number(user?.id)) {
                navigate('/tournaments', { replace: true });
                return;
            }
            await refreshLobbyState();
        } catch (err) {
            console.error('Ошибка удаления:', err);
        }
    }, [lobbyId, user, navigate, refreshLobbyState]);

    // Установка формата матча
    const setMatchFormat = useCallback(async (format) => {
        if (!lobbyId) return;
        const token = localStorage.getItem('token');
        try {
            await api.post(`/api/admin/match-lobby/${lobbyId}/format`, { format }, { headers: { Authorization: `Bearer ${token}` } });
            await refreshLobbyState();
        } catch (err) {
            console.error('Ошибка установки формата:', err);
        }
    }, [lobbyId, refreshLobbyState]);

    // Готовность игрока
    const togglePlayerReady = useCallback(async (userId, teamId) => {
        if (!lobbyId) return;
        
        // Оптимистичное обновление UI
        setPlayerReady(prev => ({ ...prev, [userId]: !prev[userId] }));
        
        const token = localStorage.getItem('token');
        try {
            // Отправляем на backend новый endpoint для отдельного игрока
            const newReady = !playerReady[userId];
            await api.post(
                `/api/admin/match-lobby/${lobbyId}/player-ready`, 
                { userId, ready: newReady }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('[useCustomLobby] Готовность обновлена:', { userId, ready: newReady });
        } catch (err) {
            console.error('Ошибка обновления готовности:', err);
            // Откатываем оптимистичное обновление
            setPlayerReady(prev => ({ ...prev, [userId]: !prev[userId] }));
        }
    }, [lobbyId, playerReady]);

    // Действие с картой
    const handleMapAction = useCallback(async (mapName, action) => {
        if (!lobbyId) return;
        const token = localStorage.getItem('token');
        
        console.log('[useCustomLobby] Действие с картой:', { mapName, action });
        
        try {
            await api.post(
                `/api/admin/match-lobby/${lobbyId}/select-map`, 
                { mapName, action }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('[useCustomLobby] Действие успешно выполнено');
            await refreshLobbyState();
        } catch (err) {
            console.error('[useCustomLobby] Ошибка действия с картой:', err);
            console.error('[useCustomLobby] Детали:', {
                status: err.response?.status,
                data: err.response?.data
            });
        }
    }, [lobbyId, refreshLobbyState]);

    // Ручной запуск процедуры пик/бан
    const startPickBan = useCallback(async () => {
        if (!lobbyId) return;
        
        console.log('[useCustomLobby] Запуск процедуры пик/бан для лобби:', lobbyId);
        
        const token = localStorage.getItem('token');
        try {
            console.log('[useCustomLobby] Отправка запроса POST /api/admin/match-lobby/' + lobbyId + '/start-pick');
            
            const { data } = await api.post(
                `/api/admin/match-lobby/${lobbyId}/start-pick`, 
                {}, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('[useCustomLobby] Ответ от сервера:', data);
            
            if (data?.success) {
                console.log('[useCustomLobby] Процедура успешно запущена, обновляем состояние');
                await refreshLobbyState();
            } else {
                console.error('[useCustomLobby] Сервер вернул success: false');
            }
        } catch (err) {
            console.error('[useCustomLobby] Ошибка запуска процедуры:', err);
            console.error('[useCustomLobby] Детали ошибки:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });
            alert(err.response?.data?.error || 'Ошибка запуска процедуры');
        }
    }, [lobbyId, refreshLobbyState]);

    // Создание матча
    const createMatch = useCallback(async () => {
        if (!lobbyId) return;
        const token = localStorage.getItem('token');
        try {
            const { data } = await api.post(`/api/admin/match-lobby/${lobbyId}/create-match`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (data?.success && data.match_id) {
                navigate(`/matches/custom/${data.match_id}`);
            }
        } catch (err) {
            console.error('Ошибка создания матча:', err);
        }
    }, [lobbyId, navigate]);

    // Очистка лобби
    const clearLobby = useCallback(async () => {
        if (!lobbyId) return;
        const token = localStorage.getItem('token');
        try {
            await api.post(`/api/admin/match-lobby/${lobbyId}/clear`, {}, { headers: { Authorization: `Bearer ${token}` } });
            await refreshLobbyState();
        } catch (err) {
            console.error('Ошибка очистки лобби:', err);
        }
    }, [lobbyId, refreshLobbyState]);

    // Сделать игрока капитаном (перемещение на первое место)
    const makeCaptain = useCallback(async (userId, team) => {
        if (!lobbyId || !userId || !team) return;
        
        const token = localStorage.getItem('token');
        const teamUsers = team === 1 ? team1Users : team2Users;
        
        // Создаем новый порядок: выбранный пользователь первый, остальные по старому порядку
        const newOrder = [
            userId,
            ...teamUsers.filter(u => u.id !== userId).map(u => u.id)
        ];
        
        console.log('[useCustomLobby] Новый порядок команды:', { team, newOrder });
        
        try {
            await api.post(
                `/api/admin/match-lobby/${lobbyId}/reorder-team`, 
                { team, userIds: newOrder }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await refreshLobbyState();
        } catch (err) {
            console.error('Ошибка изменения капитана:', err);
        }
    }, [lobbyId, team1Users, team2Users, refreshLobbyState]);

    // Очистка старой готовности при смене лобби
    useEffect(() => {
        if (!readyStorageKey) return;
        // При входе в новое лобби очищаем старую готовность
        try {
            localStorage.removeItem(readyStorageKey);
            setPlayerReady({});
            console.log('[useCustomLobby] Очищена готовность для нового лобби');
        } catch (_) {}
    }, [readyStorageKey]);

    // Не сохраняем готовность в localStorage - всегда начинаем с "не готов"
    // useEffect(() => {
    //     if (!readyStorageKey) return;
    //     try {
    //         localStorage.setItem(readyStorageKey, JSON.stringify(playerReady));
    //     } catch (_) {}
    // }, [playerReady, readyStorageKey]);

    useEffect(() => { 
        playerReadyRef.current = playerReady; 
    }, [playerReady]);

    // Инициализация готовности для новых игроков
    useEffect(() => {
        setPlayerReady(prev => {
            const next = { ...prev };
            for (const u of team1Users) if (next[u.id] === undefined) next[u.id] = false;
            for (const u of team2Users) if (next[u.id] === undefined) next[u.id] = false;
            return next;
        });
    }, [team1Users, team2Users]);

    // 🔄 Live обновление состояния лобби каждые 2 секунды
    useEffect(() => {
        if (!lobbyId) return;
        
        let isActive = true;
        
        const poll = async () => {
            if (!isActive || !lobbyId) return;
            
            const token = localStorage.getItem('token');
            try {
                const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                if (r?.data?.success && isActive) {
                    updateLobbyState(r.data);
                }
            } catch (err) {
                console.error('Polling ошибка:', err);
            }
        };
        
        const interval = setInterval(poll, 2000);
        
        return () => {
            isActive = false;
            clearInterval(interval);
        };
    }, [lobbyId, updateLobbyState]);

    return {
        lobbyId,
        lobby,
        availableMaps,
        selections,
        team1Users,
        team2Users,
        unassignedUsers,
        invitedPendingUsers,
        invitedDeclinedUsers,
        onlineUserIds,
        playerReady,
        loading,
        canInvite,
        ensureAdminLobby,
        loadInvitedLobby,
        refreshLobbyState,
        updateLobbyState,
        inviteUserToTeam,
        removeUserFromLobby,
        setMatchFormat,
        togglePlayerReady,
        handleMapAction,
        startPickBan,
        createMatch,
        clearLobby,
        makeCaptain
    };
}

export default useCustomLobby;

