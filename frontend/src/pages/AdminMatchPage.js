import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
    const searchDebounce = useRef(null);

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

    async function addToSelection(u) {
        if (!u || !u.id) return;
        if (selected.some(s => s.id === u.id)) return;
        setSelected(prev => [...prev, u]);
        try {
            if (!lobbyId) await ensureAdminLobby();
            const token = localStorage.getItem('token');
            await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: u.id }, { headers: { Authorization: `Bearer ${token}` } });
            const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (r?.data?.success) {
                setLobby(r.data.lobby);
                setSelections(r.data.selections || []);
                setAvailableMaps(r.data.available_maps || []);
                setTeam1Users(r.data.team1_users || []);
                setTeam2Users(r.data.team2_users || []);
                setUnassignedUsers(r.data.unassigned_users || []);
            }
        } catch (_) {}
    }

    function removeFromSelection(id) {
        setSelected(prev => prev.filter(u => u.id !== id));
    }

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

    useEffect(() => { ensureAdminLobby().catch(() => {}); }, [ensureAdminLobby]);

    if (!isAdmin) {
        return (
            <div className="admin-match-page">
                <h2>МАТЧ (доступ только администраторам)</h2>
                <p>Недостаточно прав.</p>
            </div>
        );
    }

    return (
        <div className="admin-match-page">
            <h2>МАТЧ — тестовое лобби</h2>
            <div className="mt-8">
                <div className="row">
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
            <div className="mt-12" style={{ maxWidth: 640 }}>
                <label className="sr-only" htmlFor="user-search">Поиск пользователей</label>
                <input
                    id="user-search"
                    className="input"
                    placeholder="Поиск пользователей (минимум 2 символа)"
                    value={query}
                    onChange={onSearchChange}
                />
                {!!results.length && (
                    <div className="mt-8">
                        {results.map(u => (
                            <div key={u.id} className="list-row">
                                <div className="list-row-left">
                                    <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm" />
                                    <span className="ml-8">{u.username}</span>
                                    {u.steam_id ? <span className="ml-8 muted">SteamID: {u.steam_id}</span> : <span className="ml-8 danger-text">нет Steam</span>}
                                </div>
                                <div className="list-row-right">
                                    <button className="btn btn-secondary" disabled={!lobbyId}
                                        onClick={() => addToSelection(u)}>Пригласить</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Участники не в командах */}
            {unassignedUsers.length > 0 && (
                <div className="mt-16">
                    <h3>Участники не в командах</h3>
                    {unassignedUsers.map(u => (
                        <div key={`un-${u.id}`} className="list-row">
                            <div className="list-row-left">
                                <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm" />
                                <span className="ml-8">{u.username}</span>
                            </div>
                            <div className="list-row-right">
                                <button className="btn btn-secondary" onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: u.id, team: 1, accept: true }, { headers: { Authorization: `Bearer ${token}` } });
                                    const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                    if (r?.data?.success) {
                                        setLobby(r.data.lobby);
                                        setSelections(r.data.selections || []);
                                        setAvailableMaps(r.data.available_maps || []);
                                        setTeam1Users(r.data.team1_users || []);
                                        setTeam2Users(r.data.team2_users || []);
                                        setUnassignedUsers(r.data.unassigned_users || []);
                                    }
                                }}>В Команду 1</button>
                                <button className="btn btn-secondary ml-8" onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: u.id, team: 2, accept: true }, { headers: { Authorization: `Bearer ${token}` } });
                                    const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                    if (r?.data?.success) {
                                        setLobby(r.data.lobby);
                                        setSelections(r.data.selections || []);
                                        setAvailableMaps(r.data.available_maps || []);
                                        setTeam1Users(r.data.team1_users || []);
                                        setTeam2Users(r.data.team2_users || []);
                                        setUnassignedUsers(r.data.unassigned_users || []);
                                    }
                                }}>В Команду 2</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-16">
                <h3>Выбранные игроки</h3>
                {selected.length === 0 && <div className="muted">Никого не выбрано</div>}
                {selected.map(u => (
                    <div key={u.id} className="list-row">
                        <div className="list-row-left">
                            <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm" />
                            <span className="ml-8">{u.username}</span>
                            {u.steam_id ? <span className="ml-8 muted">SteamID: {u.steam_id}</span> : <span className="ml-8 danger-text">нет Steam</span>}
                        </div>
                        <div className="list-row-right">
                            <button className="btn btn-secondary" onClick={() => removeFromSelection(u.id)}>Убрать</button>
                            <button className="btn btn-secondary ml-8" disabled={!lobbyId}
                                onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: u.id, team: 1, accept: true }, { headers: { Authorization: `Bearer ${token}` } });
                                    const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                    if (r?.data?.success) { setLobby(r.data.lobby); setSelections(r.data.selections || []); setAvailableMaps(r.data.available_maps || []); setTeam1Users(r.data.team1_users || []); setTeam2Users(r.data.team2_users || []); }
                                }}>В команду 1</button>
                            <button className="btn btn-secondary ml-8" disabled={!lobbyId}
                                onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    await api.post(`/api/admin/match-lobby/${lobbyId}/invite`, { user_id: u.id, team: 2, accept: true }, { headers: { Authorization: `Bearer ${token}` } });
                                    const r = await api.get(`/api/admin/match-lobby/${lobbyId}`, { headers: { Authorization: `Bearer ${token}` } });
                                    if (r?.data?.success) { setLobby(r.data.lobby); setSelections(r.data.selections || []); setAvailableMaps(r.data.available_maps || []); setTeam1Users(r.data.team1_users || []); setTeam2Users(r.data.team2_users || []); }
                                }}>В команду 2</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-16">
                <button className="btn btn-primary" onClick={createTestLobby} disabled={loading || !lobbyId}>
                    {loading ? 'Запрашиваем…' : 'Подключения (если готово)'}
                </button>
                <button className="btn btn-secondary ml-8" onClick={syncWhitelist} disabled={loading || (team1Users.length + team2Users.length === 0)}>
                    Синхронизировать whitelist
                </button>
                {/* Очистка лобби — только создатель */}
                <button className="btn btn-secondary ml-8" disabled={!lobbyId || !user || (lobby && user && lobby.created_by && Number(lobby.created_by) !== Number(user.id))}
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
                <div className="mt-16">
                    <h3>Подключение</h3>
                    {connectInfo.connect && (
                        <div className="list-row">
                            <div className="list-row-left">
                                <span>Игроки:</span>
                                <code className="code-inline">{connectInfo.connect}</code>
                            </div>
                            <div className="list-row-right">
                                <button className="btn btn-secondary" onClick={() => copy(connectInfo.connect)}>Копировать</button>
                            </div>
                        </div>
                    )}
                    {connectInfo.gotv && (
                        <div className="list-row mt-8">
                            <div className="list-row-left">
                                <span>GOTV:</span>
                                <code className="code-inline">{connectInfo.gotv}</code>
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
                <div className="mt-16">
                    <div className="row">
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
                <div className="mt-16">
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

            {/* Составы команд */}
            {(team1Users.length > 0 || team2Users.length > 0) && (
                <div className="mt-16">
                    <h3>Состав команд</h3>
                    <div className="row-lg">
                        <div>
                            <h4>{lobby?.team1_name || 'Команда 1'}</h4>
                            {team1Users.length === 0 && <div className="muted">Нет игроков</div>}
                            {team1Users.map(u => (
                                <div key={`t1-${u.id}`} className="list-row">
                                    <div className="list-row-left">
                                        <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm" />
                                        <span className="ml-8">{u.username}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <h4>{lobby?.team2_name || 'Команда 2'}</h4>
                            {team2Users.length === 0 && <div className="muted">Нет игроков</div>}
                            {team2Users.map(u => (
                                <div key={`t2-${u.id}`} className="list-row">
                                    <div className="list-row-left">
                                        <img src={u.avatar_url || '/images/avatars/default.svg'} alt="avatar" className="avatar-sm" />
                                        <span className="ml-8">{u.username}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Кнопка подключиться после завершения */}
            {(connectInfo?.connect || lobby?.status === 'match_created' || lobby?.status === 'ready_to_create') && (
                <div className="mt-16">
                    {lobby?.status === 'ready_to_create' && Number(lobby?.created_by) === Number(user?.id) && (
                        <button className="btn btn-primary" onClick={async () => {
                            const token = localStorage.getItem('token');
                            const { data } = await api.post(`/api/admin/match-lobby/${lobbyId}/create-match`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            if (data?.success) setConnectInfo({ connect: data.connect, gotv: data.gotv });
                        }}>СОЗДАЕМ МАТЧ?</button>
                    )}
                    {connectInfo?.connect && (
                        <a className="btn btn-primary ml-8" href={connectInfo.connect} target="_blank" rel="noreferrer">
                            Подключиться к матчу
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

export default AdminMatchPage;


