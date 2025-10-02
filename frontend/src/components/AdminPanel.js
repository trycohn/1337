import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axios';
import './AdminPanel.css';
import './AdminPanel.css';
import { ensureHttps } from '../utils/userHelpers';
import { useAuth } from '../context/AuthContext'; // Добавляем AuthContext

function UploadMapImage() {
    const [mapKey, setMapKey] = useState('mirage');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const onSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;
        try {
            setLoading(true);
            setMsg('');
            const form = new FormData();
            form.append('mapKey', mapKey);
            form.append('image', file);
            const res = await fetch('/api/admin/upload/map-image', {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: form
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Ошибка');
            setMsg(`Готово: ${data.file}`);
        } catch (err) {
            setMsg(`Ошибка: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };
    return (
        <form onSubmit={onSubmit} className="map-upload-form" style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <label>Карта:</label>
            <input value={mapKey} onChange={(e)=>setMapKey(e.target.value)} className="map-input" placeholder="mirage" />
            <input type="file" accept="image/*" onChange={(e)=>setFile(e.target.files[0]||null)} />
            <button className="btn" disabled={loading || !file}>Загрузить (320x180)</button>
            {msg && <span style={{color:'#aaa'}}>{msg}</span>}
        </form>
    );
}

function UploadLogo() {
    const [type, setType] = useState('org');
    const [name, setName] = useState('logo');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const onSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;
        try {
            setLoading(true);
            setMsg('');
            const form = new FormData();
            form.append('type', type);
            form.append('name', name);
            form.append('logo', file);
            const res = await fetch('/api/admin/upload/logo', {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: form
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Ошибка');
            setMsg(`Готово: ${data.url}`);
        } catch (err) {
            setMsg(`Ошибка: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };
    return (
        <form onSubmit={onSubmit} className="logo-upload-form" style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginTop:8}}>
            <label>Тип:</label>
            <select value={type} onChange={(e)=>setType(e.target.value)} className="status-filter">
                <option value="org">Организация</option>
                <option value="team">Команда</option>
                <option value="tournament">Турнир</option>
            </select>
            <input value={name} onChange={(e)=>setName(e.target.value)} className="map-input" placeholder="название для файла" />
            <input type="file" accept="image/*" onChange={(e)=>setFile(e.target.files[0]||null)} />
            <button className="btn" disabled={loading || !file}>Загрузить (1000x1000)</button>
            {msg && <span style={{color:'#aaa'}}>{msg}</span>}
        </form>
    );
}

function AdminPanel() {
    const navigate = useNavigate();
    const { user: authUser, loading: authLoading } = useAuth(); // Используем пользователя из AuthContext
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState({});
    const [activeTab, setActiveTab] = useState('requests');
    
    // 🛡️ АНТИЧИТ: Trust Scores state
    const [trustScores, setTrustScores] = useState([]);
    const [trustStats, setTrustStats] = useState(null);
    const [trustLoading, setTrustLoading] = useState(false);
    const [trustFilter, setTrustFilter] = useState('all');
    const [trustSort, setTrustSort] = useState('score_asc');
    const [trustPagination, setTrustPagination] = useState({ total: 0, limit: 50, offset: 0 });
    const [recheckingUserId, setRecheckingUserId] = useState(null);
    
    // 🎮 FEEDBACKS: State для системы обратной связи
    const [suspiciousPlayers, setSuspiciousPlayers] = useState([]);
    const [feedbackStats, setFeedbackStats] = useState(null);
    const [feedbacksLoading, setFeedbacksLoading] = useState(false);
    const [feedbackFilter, setFeedbackFilter] = useState({ min_cheating: 3, max_reputation: 50 });
    const [feedbackSort, setFeedbackSort] = useState('cheating_desc');
    const [feedbackPagination, setFeedbackPagination] = useState({ total: 0, limit: 50, offset: 0 });
    
    // 📊 MATCHZY STATS: State для детальной статистики
    const [matchzyAnomalies, setMatchzyAnomalies] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [leaderboardMetric, setLeaderboardMetric] = useState('rating');
    const [statsLoading, setStatsLoading] = useState(false);
    // Preloaded avatars state
    const [preAvatars, setPreAvatars] = useState([]);
    const [preAvatarsLoading, setPreAvatarsLoading] = useState(false);
    const [preAvatarsMsg, setPreAvatarsMsg] = useState('');
    const [uploadCategory, setUploadCategory] = useState('standard');
    const [defaultAvatarUrl, setDefaultAvatarUrl] = useState(null);
    const [showDefaultConfirm, setShowDefaultConfirm] = useState(false);
    const [candidateDefault, setCandidateDefault] = useState(null);
    // Default Map Pool state
    const [defaultMapPool, setDefaultMapPool] = useState([]);
    const [mapPoolLoading, setMapPoolLoading] = useState(false);
    const [mapPoolError, setMapPoolError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Состояния для модалок действий
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [actionData, setActionData] = useState({
        contact_email: '',
        contact_phone: '',
        admin_comment: ''
    });

    // Управление аккаунтами
    const [accountSearchId, setAccountSearchId] = useState('');
    const [accountUser, setAccountUser] = useState(null);
    const [accountLoading, setAccountLoading] = useState(false);
    const [accountError, setAccountError] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [passwordResetValue, setPasswordResetValue] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState('');

    async function adminFetchUserById() {
        if (!accountSearchId) return;
        try {
            setAccountLoading(true);
            setAccountError('');
            setPasswordResetValue('');
            const response = await api.get(`/api/admin/users/${accountSearchId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setAccountUser(response.data);
            setNewUsername(response.data.username || '');
        } catch (err) {
            console.error('Ошибка получения пользователя:', err);
            setAccountUser(null);
            setAccountError(err?.response?.data?.error || 'Пользователь не найден');
        } finally {
            setAccountLoading(false);
        }
    }

    async function adminUpdateUsername() {
        if (!accountUser || !newUsername || newUsername === accountUser.username) return;
        try {
            setAccountLoading(true);
            setAccountError('');
            await api.post(`/api/admin/users/${accountUser.id}/username`, { username: newUsername }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            await adminFetchUserById();
        } catch (err) {
            console.error('Ошибка смены ника:', err);
            setAccountError(err?.response?.data?.error || 'Не удалось обновить ник');
        } finally {
            setAccountLoading(false);
        }
    }

    async function adminResetEmail() {
        if (!accountUser) return;
        try {
            setAccountLoading(true);
            setAccountError('');
            await api.post(`/api/admin/users/${accountUser.id}/reset-email`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            await adminFetchUserById();
        } catch (err) {
            console.error('Ошибка сброса email:', err);
            setAccountError(err?.response?.data?.error || 'Не удалось сбросить email');
        } finally {
            setAccountLoading(false);
        }
    }

    async function adminResetPassword() {
        if (!accountUser) return;
        try {
            setAccountLoading(true);
            setAccountError('');
            const res = await api.post(`/api/admin/users/${accountUser.id}/reset-password`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setPasswordResetValue(res.data?.newPassword || '');
        } catch (err) {
            console.error('Ошибка сброса пароля:', err);
            setAccountError(err?.response?.data?.error || 'Не удалось сбросить пароль');
        } finally {
            setAccountLoading(false);
        }
    }

    async function adminDeleteAccount() {
        if (!accountUser) return;
        if (deleteConfirm !== `${accountUser.id}`) {
            setAccountError('Для подтверждения введите ID пользователя.');
            return;
        }
        try {
            setAccountLoading(true);
            setAccountError('');
            await api.delete(`/api/admin/users/${accountUser.id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setAccountUser(null);
            setAccountSearchId('');
            setNewUsername('');
            setDeleteConfirm('');
        } catch (err) {
            console.error('Ошибка удаления аккаунта:', err);
            setAccountError(err?.response?.data?.error || 'Не удалось удалить аккаунт');
        } finally {
            setAccountLoading(false);
        }
    }

    const checkAdminAccess = useCallback(async () => {
        try {
            // Используем пользователя из AuthContext вместо запроса к API
            if (authLoading) {
                return;
            }
            if (!authUser) {
                console.log('❌ Нет пользователя в AuthContext, редирект на авторизацию');
                navigate('/login');
                return;
            }

            if (authUser.role !== 'admin') {
                console.log('❌ Пользователь не админ, редирект на главную');
                navigate('/');
                return;
            }

            console.log('✅ Админские права подтверждены для:', authUser.username);
            setUser(authUser);
        } catch (err) {
            console.error('Ошибка проверки доступа:', err);
            navigate('/login');
        } finally {
            setLoading(false);
        }
    }, [navigate, authUser, authLoading]); // Добавляем authUser в зависимости

    const fetchRequests = useCallback(async () => {
        try {
            const response = await api.get(`/api/admin/organization-requests?status=${statusFilter}&page=${pagination.page}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setRequests(response.data.requests);
            setPagination(response.data.pagination);
        } catch (err) {
            console.error('Ошибка загрузки заявок:', err);
        }
    }, [statusFilter, pagination.page]);

    const fetchStats = useCallback(async () => {
        try {
            const response = await api.get('/api/admin/stats', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setStats(response.data);
        } catch (err) {
            console.error('Ошибка загрузки статистики:', err);
        }
    }, []);
    
    // 🛡️ АНТИЧИТ: Загрузка Trust Scores
    const fetchTrustScores = useCallback(async () => {
        setTrustLoading(true);
        try {
            const action = trustFilter === 'all' ? '' : trustFilter;
            const response = await api.get('/api/admin/trust-scores', {
                params: {
                    limit: trustPagination.limit,
                    offset: trustPagination.offset,
                    sort: trustSort,
                    action: action || undefined
                },
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (response.data.success) {
                setTrustScores(response.data.data);
                setTrustPagination(prev => ({
                    ...prev,
                    total: response.data.pagination.total
                }));
            }
        } catch (err) {
            console.error('❌ Ошибка загрузки Trust Scores:', err);
        } finally {
            setTrustLoading(false);
        }
    }, [trustFilter, trustSort, trustPagination.limit, trustPagination.offset]);
    
    // 🛡️ АНТИЧИТ: Загрузка статистики Trust Scores
    const fetchTrustStats = useCallback(async () => {
        try {
            const response = await api.get('/api/admin/trust-scores/stats', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (response.data.success) {
                setTrustStats(response.data.stats);
            }
        } catch (err) {
            console.error('❌ Ошибка загрузки статистики Trust Scores:', err);
        }
    }, []);
    
    // 🛡️ АНТИЧИТ: Перепроверка Trust Score пользователя
    const recheckTrustScore = async (userId) => {
        setRecheckingUserId(userId);
        try {
            const response = await api.post(`/api/admin/trust-scores/${userId}/recheck`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (response.data.success) {
                alert(`✅ Trust Score перепроверен:\n\nПользователь: ${response.data.user.username}\nНовый счет: ${response.data.trust_result.score}/100\nДействие: ${response.data.trust_result.action}`);
                fetchTrustScores();
                fetchTrustStats();
            }
        } catch (err) {
            console.error('❌ Ошибка перепроверки Trust Score:', err);
            alert('❌ Ошибка перепроверки Trust Score');
        } finally {
            setRecheckingUserId(null);
        }
    };
    
    // 🛡️ АНТИЧИТ: Бан пользователя
    const banUser = async (userId, username) => {
        const reason = prompt(`Укажите причину бана для пользователя ${username}:`);
        if (!reason) return;
        
        try {
            const response = await api.post(`/api/admin/users/${userId}/ban`, 
                { reason },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}
            );
            
            if (response.data.success) {
                alert(`✅ Пользователь ${username} успешно забанен`);
                fetchTrustScores();
                fetchTrustStats();
            }
        } catch (err) {
            console.error('❌ Ошибка бана пользователя:', err);
            alert('❌ Ошибка бана пользователя');
        }
    };
    
    // 🛡️ АНТИЧИТ: Разбан пользователя
    const unbanUser = async (userId, username) => {
        if (!window.confirm(`Разбанить пользователя ${username}?`)) return;
        
        try {
            const response = await api.post(`/api/admin/users/${userId}/unban`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (response.data.success) {
                alert(`✅ Пользователь ${username} разбанен`);
                fetchTrustScores();
                fetchTrustStats();
            }
        } catch (err) {
            console.error('❌ Ошибка разбана пользователя:', err);
            alert('❌ Ошибка разбана пользователя');
        }
    };
    
    // 🎮 FEEDBACKS: Загрузка suspicious players
    const fetchSuspiciousPlayers = useCallback(async () => {
        setFeedbacksLoading(true);
        try {
            const response = await api.get('/api/admin/suspicious-players', {
                params: {
                    min_cheating_reports: feedbackFilter.min_cheating,
                    max_reputation: feedbackFilter.max_reputation,
                    limit: feedbackPagination.limit,
                    offset: feedbackPagination.offset,
                    sort: feedbackSort
                },
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (response.data.success) {
                setSuspiciousPlayers(response.data.players);
                setFeedbackPagination(prev => ({
                    ...prev,
                    total: response.data.total
                }));
            }
        } catch (err) {
            console.error('❌ Ошибка загрузки suspicious players:', err);
        } finally {
            setFeedbacksLoading(false);
        }
    }, [feedbackFilter, feedbackSort, feedbackPagination.limit, feedbackPagination.offset]);
    
    // 🎮 FEEDBACKS: Загрузка статистики
    const fetchFeedbackStats = useCallback(async () => {
        try {
            const response = await api.get('/api/admin/feedback-stats', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (response.data.success) {
                setFeedbackStats(response.data);
            }
        } catch (err) {
            console.error('❌ Ошибка загрузки статистики feedbacks:', err);
        }
    }, []);
    
    // 📊 MATCHZY: Загрузка аномалий
    const fetchMatchzyAnomalies = useCallback(async () => {
        setStatsLoading(true);
        try {
            const response = await api.get('/api/player-stats/admin/stats-anomalies', {
                params: { reviewed: 'false', severity: null, limit: 50 },
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (response.data.success) {
                setMatchzyAnomalies(response.data.anomalies);
            }
        } catch (err) {
            console.error('❌ Ошибка загрузки аномалий:', err);
        } finally {
            setStatsLoading(false);
        }
    }, []);
    
    // 📊 MATCHZY: Загрузка leaderboard
    const fetchLeaderboard = useCallback(async () => {
        try {
            const response = await api.get('/api/player-stats/leaderboard', {
                params: { metric: leaderboardMetric, limit: 20 }
            });
            
            if (response.data.success) {
                setLeaderboard(response.data.leaderboard);
            }
        } catch (err) {
            console.error('❌ Ошибка загрузки leaderboard:', err);
        }
    }, [leaderboardMetric]);

    useEffect(() => {
        checkAdminAccess();
    }, [checkAdminAccess]);

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchRequests();
            fetchStats();
            fetchDefaultMapPool();
            fetchPreloadedAvatars();
            // 🛡️ АНТИЧИТ: Загружаем Trust Scores при первой загрузке
            if (activeTab === 'trustScores') {
                fetchTrustScores();
                fetchTrustStats();
            }
            // 🎮 FEEDBACKS: Загружаем Feedbacks при первой загрузке
            if (activeTab === 'feedbacks') {
                fetchSuspiciousPlayers();
                fetchFeedbackStats();
            }
            // 📊 MATCHZY: Загружаем Stats при первой загрузке
            if (activeTab === 'matchzyStats') {
                fetchMatchzyAnomalies();
                fetchLeaderboard();
            }
        }
    }, [user, fetchRequests, fetchStats, activeTab, fetchTrustScores, fetchTrustStats, fetchSuspiciousPlayers, fetchFeedbackStats, fetchMatchzyAnomalies, fetchLeaderboard]);

    const fetchDefaultMapPool = useCallback(async () => {
        try {
            setMapPoolLoading(true);
            setMapPoolError(null);
            const res = await api.get('/api/admin/default-map-pool', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const maps = (res.data && res.data.maps) || [];
            setDefaultMapPool(maps);
        } catch (e) {
            console.error('Ошибка загрузки дефолтного маппула:', e);
            setMapPoolError('Не удалось загрузить дефолтный маппул');
        } finally {
            setMapPoolLoading(false);
        }
    }, []);

    const moveMap = (index, dir) => {
        setDefaultMapPool(prev => {
            const arr = [...prev];
            const ni = index + dir;
            if (ni < 0 || ni >= arr.length) return arr;
            const tmp = arr[index];
            arr[index] = arr[ni];
            arr[ni] = tmp;
            return arr;
        });
    };

    const removeMap = (index) => {
        setDefaultMapPool(prev => prev.filter((_, i) => i !== index));
    };

    const addMap = () => {
        setDefaultMapPool(prev => [...prev, { map_name: '', display_order: prev.length + 1 }]);
    };

    const updateMapName = (index, value) => {
        setDefaultMapPool(prev => prev.map((m, i) => i === index ? { ...m, map_name: value } : m));
    };

    const saveDefaultMapPool = async () => {
        try {
            setMapPoolLoading(true);
            setMapPoolError(null);
            const maps = defaultMapPool
                .map(m => (m.map_name || '').trim().toLowerCase())
                .filter(Boolean)
                .map(n => n.replace(/^de[_-]?/, ''));
            if (maps.length === 0) {
                setMapPoolError('Список карт не может быть пуст');
                setMapPoolLoading(false);
                return;
            }
            await api.put('/api/admin/default-map-pool', { maps }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            await fetchDefaultMapPool();
            alert('Дефолтный маппул сохранён');
        } catch (e) {
            console.error('Ошибка сохранения маппула:', e);
            setMapPoolError('Не удалось сохранить маппул');
        } finally {
            setMapPoolLoading(false);
        }
    };

    const fetchPreloadedAvatars = async () => {
        try {
            setPreAvatarsLoading(true);
            const res = await api.get('/api/admin/preloaded-avatars', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setPreAvatars((res.data && res.data.avatars) || []);
            // загрузим текущий дефолт
            try {
                const d = await api.get('/api/admin/preloaded-avatars/default', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                setDefaultAvatarUrl(d.data?.default_url || null);
            } catch (e) {
                // ignore
            }
        } catch (e) {
            console.error('Ошибка загрузки предзагруженных аватарок:', e);
        } finally {
            setPreAvatarsLoading(false);
        }
    };

    const uploadPreloadedAvatar = async (file, name, category) => {
        if (!file) return;
        try {
            setPreAvatarsMsg('');
            setPreAvatarsLoading(true);
            const form = new FormData();
            if (name) form.append('name', name);
            form.append('image', file);
            const res = await api.post('/api/admin/preloaded-avatars', form, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.data?.success) throw new Error(res.data?.error || 'Ошибка');
            // Установим категорию, если не стандартная
            const createdFilename = res.data?.filename;
            if (createdFilename && category && category !== 'standard') {
                await api.patch(`/api/admin/preloaded-avatars/${encodeURIComponent(createdFilename)}/category`, { category }, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
            }
            setPreAvatarsMsg('Загружено');
            await fetchPreloadedAvatars();
        } catch (e) {
            const msg = e?.response?.data?.error || e?.message || 'Ошибка загрузки';
            setPreAvatarsMsg(`Ошибка: ${msg}`);
        } finally {
            setPreAvatarsLoading(false);
        }
    };

    const updateAvatarCategory = async (filename, category) => {
        if (!filename) return;
        try {
            await api.patch(`/api/admin/preloaded-avatars/${encodeURIComponent(filename)}/category`, { category }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            // Обновим локально без полного рефетча
            setPreAvatars(prev => prev.map(a => a.filename === filename ? { ...a, category } : a));
        } catch (e) {
            alert(e?.response?.data?.error || 'Не удалось обновить категорию');
        }
    };

    const deletePreloadedAvatar = async (filename) => {
        if (!filename) return;
        try {
            setPreAvatarsLoading(true);
            await api.delete(`/api/admin/preloaded-avatars/${encodeURIComponent(filename)}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            await fetchPreloadedAvatars();
        } catch (e) {
            console.error('Ошибка удаления аватарки:', e);
        } finally {
            setPreAvatarsLoading(false);
        }
    };

    const confirmSetDefault = (avatar) => {
        setCandidateDefault(avatar);
        setShowDefaultConfirm(true);
    };

    const applySetDefault = async () => {
        if (!candidateDefault) return;
        try {
            setPreAvatarsLoading(true);
            await api.put('/api/admin/preloaded-avatars/default', { filename: candidateDefault.filename }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setShowDefaultConfirm(false);
            setCandidateDefault(null);
            await fetchPreloadedAvatars();
        } catch (e) {
            alert(`Не удалось установить дефолтный аватар: ${e?.response?.data?.error || e.message}`);
        } finally {
            setPreAvatarsLoading(false);
        }
    };

    const fetchRequestDetails = async (requestId) => {
        try {
            const response = await api.get(`/api/admin/organization-requests/${requestId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setSelectedRequest(response.data);
            setShowRequestModal(true);
        } catch (err) {
            console.error('Ошибка загрузки деталей заявки:', err);
        }
    };

    const handleApprove = async () => {
        if (!selectedRequest) return;

        setActionLoading(true);
        try {
            await api.post(`/api/admin/organization-requests/${selectedRequest.id}/approve`, actionData, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            setShowApproveModal(false);
            setShowRequestModal(false);
            setActionData({ contact_email: '', contact_phone: '', admin_comment: '' });
            fetchRequests();
            fetchStats();
        } catch (err) {
            console.error('Ошибка одобрения заявки:', err);
            alert('Ошибка при одобрении заявки');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest || !actionData.admin_comment.trim()) {
            alert('Комментарий обязателен при отклонении заявки');
            return;
        }

        setActionLoading(true);
        try {
            await api.post(`/api/admin/organization-requests/${selectedRequest.id}/reject`, {
                admin_comment: actionData.admin_comment
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            setShowRejectModal(false);
            setShowRequestModal(false);
            setActionData({ contact_email: '', contact_phone: '', admin_comment: '' });
            fetchRequests();
            fetchStats();
        } catch (err) {
            console.error('Ошибка отклонения заявки:', err);
            alert('Ошибка при отклонении заявки');
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'pending': return 'status-pending';
            case 'approved': return 'status-approved';
            case 'rejected': return 'status-rejected';
            default: return '';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'На рассмотрении';
            case 'approved': return 'Одобрена';
            case 'rejected': return 'Отклонена';
            default: return status;
        }
    };

    if (loading) {
        return <div className="admin-loading">Загрузка...</div>;
    }

    if (!user || user.role !== 'admin') {
        return <div className="admin-error">Доступ запрещен</div>;
    }

    return (
        <div className="admin-panel">
            <div className="admin-header">
                <h1>Административная панель</h1>
                <p>Добро пожаловать, {user.username}!</p>
            </div>

            {/* Навигация */}
            <div className="admin-navigation">
                <button 
                    className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                >
                    Статистика
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('requests')}
                >
                    Заявки на организации
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'accounts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('accounts')}
                >
                    Упр. аккаунтами
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'mapPool' ? 'active' : ''}`}
                    onClick={() => setActiveTab('mapPool')}
                >
                    Карт-пул (дефолт)
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'avatars' ? 'active' : ''}`}
                    onClick={() => setActiveTab('avatars')}
                >
                    Предзагруженные аватарки
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'trustScores' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trustScores')}
                >
                    🛡️ Trust Scores
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'feedbacks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('feedbacks')}
                >
                    🎮 Feedbacks
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'matchzyStats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('matchzyStats')}
                >
                    📊 Stats
                </button>
            </div>

            {/* Содержимое вкладок */}
            {activeTab === 'accounts' && (
                <div className="accounts-tab">
                    <h2>Управление аккаунтами</h2>
                    <div className="account-search" style={{display:'flex', gap:8, alignItems:'center', margin:'12px 0'}}>
                        <input 
                            type="number" 
                            min="1"
                            value={accountSearchId}
                            onChange={(e)=>setAccountSearchId(e.target.value)}
                            className="map-input"
                            placeholder="ID пользователя"
                        />
                        <button className="btn" onClick={adminFetchUserById} disabled={accountLoading || !accountSearchId}>Найти</button>
                    </div>
                    {accountError && <div className="admin-error" style={{textAlign:'left'}}>{accountError}</div>}
                    {accountLoading && <div className="admin-loading">Загрузка...</div>}

                    {accountUser && (
                        <div className="account-card" style={{background:'#111', border:'1px solid #333', padding:16, marginTop:12}}>
                            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12}}>
                                <div><div style={{color:'#aaa'}}>ID</div><div>{accountUser.id}</div></div>
                                <div><div style={{color:'#aaa'}}>Никнейм</div><div>{accountUser.username || '-'}</div></div>
                                <div><div style={{color:'#aaa'}}>Email</div><div>{accountUser.email || '-'}</div></div>
                                <div><div style={{color:'#aaa'}}>Роль</div><div>{accountUser.role}</div></div>
                                <div><div style={{color:'#aaa'}}>Верифицирован</div><div>{accountUser.is_verified ? 'да' : 'нет'}</div></div>
                                <div><div style={{color:'#aaa'}}>Steam ID</div><div>{accountUser.steam_id || '-'}</div></div>
                                <div><div style={{color:'#aaa'}}>FACEIT ID</div><div>{accountUser.faceit_id || '-'}</div></div>
                                <div><div style={{color:'#aaa'}}>Создан</div><div>{accountUser.created_at ? new Date(accountUser.created_at).toLocaleString() : '-'}</div></div>
                            </div>

                            <hr style={{borderColor:'#333', margin:'12px 0'}} />

                            <div style={{display:'flex', flexDirection:'column', gap:12}}>
                                <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                                    <input 
                                        className="map-input"
                                        placeholder="Новый ник"
                                        value={newUsername}
                                        onChange={(e)=>setNewUsername(e.target.value)}
                                    />
                                    <button className="btn" onClick={adminUpdateUsername} disabled={accountLoading || !newUsername || newUsername === accountUser.username}>Сменить ник</button>
                                </div>

                                <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                                    <button className="btn" onClick={adminResetEmail} disabled={accountLoading}>Сбросить email</button>
                                </div>

                                <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                                    <button className="btn" onClick={adminResetPassword} disabled={accountLoading}>Сбросить пароль</button>
                                    {passwordResetValue && (
                                        <input className="map-input" value={passwordResetValue} readOnly onFocus={(e)=>e.target.select()} />
                                    )}
                                </div>

                                <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                                    <input 
                                        className="map-input"
                                        placeholder={`Введите ${accountUser.id} для подтверждения`}
                                        value={deleteConfirm}
                                        onChange={(e)=>setDeleteConfirm(e.target.value)}
                                    />
                                    <button className="btn-small danger" onClick={adminDeleteAccount} disabled={accountLoading}>Удалить аккаунт</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'stats' && (
                <div className="stats-tab">
                    <h2>Статистика платформы</h2>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{stats.users?.total_users || 0}</div>
                            <div className="stat-label">Всего пользователей</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.users?.admin_users || 0}</div>
                            <div className="stat-label">Администраторов</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.organizers?.total_organizers || 0}</div>
                            <div className="stat-label">Организаций</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.tournaments?.total_tournaments || 0}</div>
                            <div className="stat-label">Турниров</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.requests?.pending || 0}</div>
                            <div className="stat-label">Заявок на рассмотрении</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.requests?.approved || 0}</div>
                            <div className="stat-label">Одобренных заявок</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'requests' && (
                <div className="requests-tab">
                    <div className="requests-header">
                        <h2>Заявки на создание организаций</h2>
                        <div className="requests-filters">
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="status-filter"
                            >
                                <option value="all">Все заявки</option>
                                <option value="pending">На рассмотрении</option>
                                <option value="approved">Одобренные</option>
                                <option value="rejected">Отклоненные</option>
                            </select>
                        </div>
                    </div>

                    <div className="requests-list">
                        {requests.length > 0 ? (
                            requests.map(request => (
                                <div key={request.id} className="request-card">
                                    <div className="request-header">
                                        <div className="request-info">
                                            <h3>{request.organization_name}</h3>
                                            <p className="request-user">
                                                От: <span>{request.username}</span> ({request.email})
                                            </p>
                                            <p className="request-date">
                                                {formatDate(request.created_at)}
                                            </p>
                                        </div>
                                        <div className="request-status">
                                            <span className={`status-badge ${getStatusClass(request.status)}`}>
                                                {getStatusText(request.status)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="request-description">
                                        <p>{request.description.length > 150 
                                            ? request.description.substring(0, 150) + '...' 
                                            : request.description}
                                        </p>
                                    </div>

                                    <div className="request-actions">
                                        <button 
                                            className="view-details-btn"
                                            onClick={() => fetchRequestDetails(request.id)}
                                        >
                                            Подробнее
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="no-requests">Заявки не найдены</div>
                        )}
                    </div>

                    {/* Пагинация */}
                    {pagination.pages > 1 && (
                        <div className="pagination">
                            <button 
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            >
                                Назад
                            </button>
                            <span>Страница {pagination.page} из {pagination.pages}</span>
                            <button 
                                disabled={pagination.page === pagination.pages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            >
                                Далее
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'mapPool' && (
                <div className="admin-map-pool">
                    <h2>Глобальный карт-пул по умолчанию</h2>
                    {mapPoolError && <div className="admin-error">{mapPoolError}</div>}
                    {mapPoolLoading && <div className="admin-loading">Загрузка...</div>}
                    <div className="map-pool-editor">
                        <div className="map-pool-list">
                            {defaultMapPool.map((m, idx) => (
                                <div key={idx} className="map-pool-item">
                                    <span className="order">{idx + 1}.</span>
                                    <input
                                        type="text"
                                        placeholder="ancient / dust2 / inferno ..."
                                        value={m.map_name}
                                        onChange={(e) => updateMapName(idx, e.target.value)}
                                        className="map-input"
                                    />
                                    <button onClick={() => moveMap(idx, -1)} className="btn-small">↑</button>
                                    <button onClick={() => moveMap(idx, 1)} className="btn-small">↓</button>
                                    <button onClick={() => removeMap(idx)} className="btn-small danger">✕</button>
                                </div>
                            ))}
                        </div>
                        <div className="map-pool-actions">
                            <button onClick={addMap} className="btn">Добавить карту</button>
                            <button onClick={saveDefaultMapPool} className="btn primary" disabled={mapPoolLoading}>Сохранить</button>
                        </div>
                        <div className="map-pool-hint">
                            Разрешены ключи: ancient, dust2, inferno, mirage, nuke, overpass, vertigo, anubis, train
                        </div>
                        <hr style={{borderColor:'#333', margin:'16px 0'}} />
                        <h3>Загрузка изображений</h3>
                        <UploadMapImage />
                        <UploadLogo />
                    </div>
                </div>
            )}

            {activeTab === 'avatars' && (
                <div className="admin-avatars">
                    <h2>Предзагруженные аватарки</h2>
                    <div className="avatar-upload-row" style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                        <input type="text" placeholder="имя (необязательно)" className="map-input" id="pre-avatar-name" />
                        <select className="status-filter" value={uploadCategory} onChange={(e)=>setUploadCategory(e.target.value)}>
                            <option value="standard">Стандартные</option>
                            <option value="rare">Редкие</option>
                            <option value="special">Специальные</option>
                            <option value="epic">Эпические</option>
                            <option value="legendary">Легендарные</option>
                        </select>
                        <input type="file" accept="image/*" onChange={(e)=>{
                            const file = e.target.files && e.target.files[0];
                            const nameInput = document.getElementById('pre-avatar-name');
                            const name = nameInput ? nameInput.value : '';
                            uploadPreloadedAvatar(file, name, uploadCategory);
                            e.target.value='';
                        }} />
                        <button className="btn" disabled={preAvatarsLoading}>Загрузить 512x512</button>
                        {preAvatarsMsg && <span style={{color:'#aaa'}}>{preAvatarsMsg}</span>}
                    </div>

                    <div className="preloaded-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:12, marginTop:16}}>
                        {preAvatarsLoading && <div className="admin-loading">Загрузка...</div>}
                        {!preAvatarsLoading && preAvatars.map((a) => (
                            <div key={a.filename} className="pre-avatar-card" style={{background:'#111', border:'1px solid #333', padding:8, display:'flex', flexDirection:'column', gap:6}}>
                                <div style={{position:'relative'}}>
                                    <img src={a.url} alt={a.filename} style={{width:'100%', aspectRatio:'1/1', objectFit:'cover', border:'1px solid #222'}} />
                                    <span style={{position:'absolute', top:6, right:6, background:'#000', border:'1px solid #333', padding:'2px 6px', fontSize:12}}>
                                        {a.category === 'legendary' ? 'Легендарные' : a.category === 'epic' ? 'Эпические' : a.category === 'special' ? 'Специальные' : a.category === 'rare' ? 'Редкие' : 'Стандартные'}
                                    </span>
                                    {defaultAvatarUrl === a.url && (
                                        <span style={{position:'absolute', top:6, left:6, background:'#222', border:'1px solid #444', padding:'2px 6px', fontSize:12}}>Дефолт</span>
                                    )}
                                </div>
                                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                                    <select className="status-filter" value={a.category || 'standard'} onChange={(e)=>updateAvatarCategory(a.filename, e.target.value)}>
                                        <option value="standard">Стандартные</option>
                                        <option value="rare">Редкие</option>
                                        <option value="special">Специальные</option>
                                        <option value="epic">Эпические</option>
                                        <option value="legendary">Легендарные</option>
                                    </select>
                                    <button className="btn-small danger" onClick={()=>deletePreloadedAvatar(a.filename)}>Удалить</button>
                                    {defaultAvatarUrl !== a.url && (
                                        <button className="btn-small" onClick={()=>confirmSetDefault(a)}>Сделать дефолтом</button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {!preAvatarsLoading && preAvatars.length === 0 && (
                            <div className="admin-loading" style={{gridColumn:'1/-1'}}>Нет аватарок</div>
                        )}
                    </div>
                </div>
            )}

            {showDefaultConfirm && candidateDefault && (
                <div className="modal-overlay" onClick={()=>setShowDefaultConfirm(false)}>
                    <div className="modal-content action-modal" onClick={(e)=>e.stopPropagation()}>
                        <h3>Сделать аватар дефолтным</h3>
                        <p>Этот аватар будет у всех пользователей без собственного аватара. Продолжить?</p>
                        <div style={{display:'flex', gap:12, alignItems:'center', margin:'8px 0'}}>
                            <img src={candidateDefault.url} alt={candidateDefault.filename} style={{width:80, height:80, objectFit:'cover', border:'1px solid #333'}} />
                            <span style={{color:'#aaa'}}>{candidateDefault.filename}</span>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={applySetDefault} disabled={preAvatarsLoading}>Подтвердить</button>
                            <button className="btn btn-secondary" onClick={()=>setShowDefaultConfirm(false)}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно деталей заявки */}
            {showRequestModal && selectedRequest && (
                <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
                    <div className="modal-content request-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Заявка на создание организации</h3>
                            <button 
                                className="close-btn"
                                onClick={() => setShowRequestModal(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="request-details">
                            <div className="detail-section">
                                <h4>Информация о заявителе</h4>
                                <div className="user-info">
                                    <img 
                                        src={ensureHttps(selectedRequest.avatar_url) || '/default-avatar.png'}
                                        alt={selectedRequest.username}
                                        className="user-avatar"
                                    />
                                    <div>
                                        <p><strong>Никнейм:</strong> {selectedRequest.username}</p>
                                        <p><strong>Email:</strong> {selectedRequest.email}</p>
                                        <p><strong>ID пользователя:</strong> {selectedRequest.user_id}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h4>Данные организации</h4>
                                <p><strong>Название:</strong> {selectedRequest.organization_name}</p>
                                <p><strong>Описание:</strong></p>
                                <div className="description-box">{selectedRequest.description}</div>
                                
                                {selectedRequest.website_url && (
                                    <p><strong>Сайт:</strong> <a href={ensureHttps(selectedRequest.website_url)} target="_blank" rel="noopener noreferrer">{selectedRequest.website_url}</a></p>
                                )}
                                {selectedRequest.vk_url && (
                                    <p><strong>VK:</strong> <a href={ensureHttps(selectedRequest.vk_url)} target="_blank" rel="noopener noreferrer">{selectedRequest.vk_url}</a></p>
                                )}
                                {selectedRequest.telegram_url && (
                                    <p><strong>Telegram:</strong> <a href={ensureHttps(selectedRequest.telegram_url)} target="_blank" rel="noopener noreferrer">{selectedRequest.telegram_url}</a></p>
                                )}
                                
                                {selectedRequest.logo_url && (
                                    <div className="logo-section">
                                        <p><strong>Логотип:</strong></p>
                                        <img 
                                            src={ensureHttps(selectedRequest.logo_url)}
                                            alt="Логотип организации"
                                            className="organization-logo"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="detail-section">
                                <p><strong>Дата подачи:</strong> {formatDate(selectedRequest.created_at)}</p>
                                <p><strong>Статус:</strong> <span className={`status-badge ${getStatusClass(selectedRequest.status)}`}>{getStatusText(selectedRequest.status)}</span></p>
                                
                                {selectedRequest.reviewed_by_username && (
                                    <>
                                        <p><strong>Рассмотрена:</strong> {selectedRequest.reviewed_by_username}</p>
                                        <p><strong>Дата рассмотрения:</strong> {formatDate(selectedRequest.reviewed_at)}</p>
                                    </>
                                )}
                                
                                {selectedRequest.admin_comment && (
                                    <div className="admin-comment">
                                        <p><strong>Комментарий администратора:</strong></p>
                                        <div className="comment-box">{selectedRequest.admin_comment}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedRequest.status === 'pending' && (
                            <div className="modal-actions">
                                <button 
                                    className="approve-btn"
                                    onClick={() => setShowApproveModal(true)}
                                >
                                    Одобрить
                                </button>
                                <button 
                                    className="reject-btn"
                                    onClick={() => setShowRejectModal(true)}
                                >
                                    Отклонить
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Модальное окно одобрения */}
            {showApproveModal && (
                <div className="modal-overlay">
                    <div className="modal-content action-modal">
                        <h3>Одобрение заявки</h3>
                        <p>Вы уверены, что хотите одобрить заявку на создание организации "{selectedRequest?.organization_name}"?</p>
                        
                        <div className="form-group">
                            <label>Контактный email (необязательно):</label>
                            <input 
                                type="email"
                                value={actionData.contact_email}
                                onChange={(e) => setActionData(prev => ({ ...prev, contact_email: e.target.value }))}
                                placeholder="Оставьте пустым для использования email заявителя"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Контактный телефон (необязательно):</label>
                            <input 
                                type="tel"
                                value={actionData.contact_phone}
                                onChange={(e) => setActionData(prev => ({ ...prev, contact_phone: e.target.value }))}
                                placeholder="+7 (900) 123-45-67"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Комментарий (необязательно):</label>
                            <textarea 
                                value={actionData.admin_comment}
                                onChange={(e) => setActionData(prev => ({ ...prev, admin_comment: e.target.value }))}
                                placeholder="Дополнительные комментарии или инструкции..."
                                rows="3"
                            />
                        </div>
                        
                        <div className="modal-actions">
                            <button 
                                className="btn btn-secondary"
                                onClick={handleApprove}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Обработка...' : 'Одобрить'}
                            </button>
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setShowApproveModal(false)}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно отклонения */}
            {showRejectModal && (
                <div className="modal-overlay">
                    <div className="modal-content action-modal">
                        <h3>Отклонение заявки</h3>
                        <p>Укажите причину отклонения заявки на создание организации "{selectedRequest?.organization_name}":</p>
                        
                        <div className="form-group">
                            <label>Причина отклонения <span className="required">*</span>:</label>
                            <textarea 
                                value={actionData.admin_comment}
                                onChange={(e) => setActionData(prev => ({ ...prev, admin_comment: e.target.value }))}
                                placeholder="Укажите подробную причину отклонения заявки..."
                                rows="4"
                                required
                            />
                        </div>
                        
                        <div className="modal-actions">
                            <button 
                                className="btn btn-secondary"
                                onClick={handleReject}
                                disabled={actionLoading || !actionData.admin_comment.trim()}
                            >
                                {actionLoading ? 'Обработка...' : 'Отклонить'}
                            </button>
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setShowRejectModal(false)}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 🛡️ АНТИЧИТ: Вкладка Trust Scores */}
            {activeTab === 'trustScores' && (
                <div className="trust-scores-tab">
                    <h2>🛡️ Система Trust Scores (Античит)</h2>
                    
                    {/* Статистика */}
                    {trustStats && (
                        <div className="trust-stats-grid">
                            <div className="stat-card">
                                <div className="stat-value">{trustStats.total_users || 0}</div>
                                <div className="stat-label">Всего проверено</div>
                            </div>
                            <div className="stat-card stat-trusted">
                                <div className="stat-value">{trustStats.trusted || 0}</div>
                                <div className="stat-label">✅ Доверенные</div>
                            </div>
                            <div className="stat-card stat-normal">
                                <div className="stat-value">{trustStats.normal || 0}</div>
                                <div className="stat-label">Обычные</div>
                            </div>
                            <div className="stat-card stat-watch">
                                <div className="stat-value">{trustStats.watch_list || 0}</div>
                                <div className="stat-label">⚠️ На контроле</div>
                            </div>
                            <div className="stat-card stat-soft-ban">
                                <div className="stat-value">{trustStats.soft_bans || 0}</div>
                                <div className="stat-label">Требуют проверки</div>
                            </div>
                            <div className="stat-card stat-banned">
                                <div className="stat-value">{trustStats.banned_users || 0}</div>
                                <div className="stat-label">❌ В бане</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{trustStats.avg_score || 0}</div>
                                <div className="stat-label">Средний Trust Score</div>
                            </div>
                            <div className="stat-card stat-vac">
                                <div className="stat-value">{trustStats.users_with_vac || 0}</div>
                                <div className="stat-label">С VAC банами</div>
                            </div>
                        </div>
                    )}
                    
                    {/* Фильтры и сортировка */}
                    <div className="trust-filters">
                        <div className="filter-group">
                            <label>Фильтр по действию:</label>
                            <select 
                                className="status-filter"
                                value={trustFilter}
                                onChange={(e) => {
                                    setTrustFilter(e.target.value);
                                    setTrustPagination(prev => ({ ...prev, offset: 0 }));
                                }}
                            >
                                <option value="all">Все</option>
                                <option value="TRUSTED">✅ Доверенные</option>
                                <option value="NORMAL">Обычные</option>
                                <option value="WATCH_LIST">⚠️ На контроле</option>
                                <option value="SOFT_BAN">Требуют проверки</option>
                                <option value="HARD_BAN">❌ Заблокированные</option>
                            </select>
                        </div>
                        
                        <div className="filter-group">
                            <label>Сортировка:</label>
                            <select 
                                className="status-filter"
                                value={trustSort}
                                onChange={(e) => setTrustSort(e.target.value)}
                            >
                                <option value="score_asc">По счету (возр.)</option>
                                <option value="score_desc">По счету (убыв.)</option>
                                <option value="recent">По дате (новые)</option>
                                <option value="oldest">По дате (старые)</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Таблица Trust Scores */}
                    {trustLoading ? (
                        <div className="admin-loading">Загрузка Trust Scores...</div>
                    ) : (
                        <>
                            <div className="trust-scores-table">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Пользователь</th>
                                            <th>Trust Score</th>
                                            <th>Действие</th>
                                            <th>Аккаунт</th>
                                            <th>CS2</th>
                                            <th>Steam</th>
                                            <th>Баны</th>
                                            <th>Статус</th>
                                            <th>Проверен</th>
                                            <th>Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trustScores.length === 0 ? (
                                            <tr>
                                                <td colSpan="11" style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
                                                    Нет данных
                                                </td>
                                            </tr>
                                        ) : (
                                            trustScores.map((ts) => (
                                                <tr key={ts.id} className={`trust-row trust-action-${ts.trust_action.toLowerCase()}`}>
                                                    <td>{ts.user_id}</td>
                                                    <td>
                                                        <div className="user-cell">
                                                            <strong>{ts.username}</strong>
                                                            <span className="user-email">{ts.email}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className={`trust-score-badge score-${Math.floor(ts.trust_score / 20)}`}>
                                                            {ts.trust_score}/100
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`trust-action-badge action-${ts.trust_action.toLowerCase()}`}>
                                                            {ts.trust_action === 'TRUSTED' && '✅ Доверенный'}
                                                            {ts.trust_action === 'NORMAL' && 'Обычный'}
                                                            {ts.trust_action === 'WATCH_LIST' && '⚠️ Контроль'}
                                                            {ts.trust_action === 'SOFT_BAN' && '🔸 Проверка'}
                                                            {ts.trust_action === 'HARD_BAN' && '❌ Блокирован'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="account-info">
                                                            <span>{ts.account_age_days || 0} дн.</span>
                                                            <span className="info-secondary">Lvl {ts.steam_level || 0}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="cs2-hours">{ts.cs2_hours || 0}ч</span>
                                                    </td>
                                                    <td>
                                                        <a 
                                                            href={ts.steam_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="steam-link"
                                                        >
                                                            {ts.profile_public ? '🔓' : '🔒'} Профиль
                                                        </a>
                                                    </td>
                                                    <td>
                                                        <div className="bans-info">
                                                            {ts.vac_bans > 0 && <span className="ban-badge vac">VAC: {ts.vac_bans}</span>}
                                                            {ts.game_bans > 0 && <span className="ban-badge game">Game: {ts.game_bans}</span>}
                                                            {ts.vac_bans === 0 && ts.game_bans === 0 && <span className="ban-badge clean">Чисто</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`user-status ${ts.is_banned ? 'banned' : 'active'}`}>
                                                            {ts.is_banned ? '❌ Забанен' : '✅ Активен'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="checked-date">
                                                            {new Date(ts.checked_at).toLocaleDateString('ru-RU')}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="trust-actions">
                                                            <button
                                                                className="btn-small"
                                                                onClick={() => recheckTrustScore(ts.user_id)}
                                                                disabled={recheckingUserId === ts.user_id}
                                                                title="Перепроверить Trust Score"
                                                            >
                                                                {recheckingUserId === ts.user_id ? '⏳' : '🔄'}
                                                            </button>
                                                            {!ts.is_banned ? (
                                                                <button
                                                                    className="btn-small danger"
                                                                    onClick={() => banUser(ts.user_id, ts.username)}
                                                                    title="Забанить пользователя"
                                                                >
                                                                    🚫
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    className="btn-small"
                                                                    onClick={() => unbanUser(ts.user_id, ts.username)}
                                                                    title="Разбанить пользователя"
                                                                >
                                                                    ✅
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Пагинация */}
                            {trustPagination.total > trustPagination.limit && (
                                <div className="trust-pagination">
                                    <button
                                        className="btn"
                                        onClick={() => setTrustPagination(prev => ({
                                            ...prev,
                                            offset: Math.max(0, prev.offset - prev.limit)
                                        }))}
                                        disabled={trustPagination.offset === 0}
                                    >
                                        ← Предыдущая
                                    </button>
                                    <span className="pagination-info">
                                        Показано {trustPagination.offset + 1}—{Math.min(trustPagination.offset + trustPagination.limit, trustPagination.total)} из {trustPagination.total}
                                    </span>
                                    <button
                                        className="btn"
                                        onClick={() => setTrustPagination(prev => ({
                                            ...prev,
                                            offset: prev.offset + prev.limit
                                        }))}
                                        disabled={trustPagination.offset + trustPagination.limit >= trustPagination.total}
                                    >
                                        Следующая →
                                    </button>
                                </div>
                            )}
                            
                            {/* Легенда */}
                            <div className="trust-legend">
                                <h3>Расшифровка Trust Score:</h3>
                                <div className="legend-grid">
                                    <div className="legend-item">
                                        <span className="trust-score-badge score-4">80-100</span>
                                        <span>✅ Доверенный - опытный аккаунт, чистая история</span>
                                    </div>
                                    <div className="legend-item">
                                        <span className="trust-score-badge score-3">60-79</span>
                                        <span>Обычный - нормальный пользователь</span>
                                    </div>
                                    <div className="legend-item">
                                        <span className="trust-score-badge score-2">40-59</span>
                                        <span>⚠️ На контроле - повышенное внимание</span>
                                    </div>
                                    <div className="legend-item">
                                        <span className="trust-score-badge score-1">20-39</span>
                                        <span>🔸 Требует проверки - подозрительный аккаунт</span>
                                    </div>
                                    <div className="legend-item">
                                        <span className="trust-score-badge score-0">0-19</span>
                                        <span>❌ Заблокирован - критически низкий счет</span>
                                    </div>
                                </div>
                                <p className="legend-note">
                                    <strong>Автоматическая блокировка:</strong> VAC бан &lt;1 года, Game бан &lt;6 месяцев<br />
                                    <strong>Перепроверка:</strong> Раз в 7 дней при входе
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}
            
            {/* 🎮 FEEDBACKS: Вкладка Match Feedbacks */}
            {activeTab === 'feedbacks' && (
                <div className="feedbacks-tab">
                    <h2>🎮 Match Feedbacks & Reputation</h2>
                    
                    {/* Статистика */}
                    {feedbackStats && (
                        <div className="feedback-stats-section">
                            <h3>Общая статистика</h3>
                            <div className="feedback-stats-grid">
                                <div className="stat-card">
                                    <div className="stat-value">{feedbackStats.feedback?.total_feedbacks || 0}</div>
                                    <div className="stat-label">Всего оценок</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{feedbackStats.completion?.completion_rate || 0}%</div>
                                    <div className="stat-label">Completion Rate</div>
                                </div>
                                <div className="stat-card stat-danger">
                                    <div className="stat-value">{feedbackStats.feedback?.cheating_reports || 0}</div>
                                    <div className="stat-label">Жалоб на читинг</div>
                                </div>
                                <div className="stat-card stat-warning">
                                    <div className="stat-value">{feedbackStats.feedback?.toxic_reports || 0}</div>
                                    <div className="stat-label">Жалоб на токсичность</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{feedbackStats.reputation?.avg_reputation || 50}</div>
                                    <div className="stat-label">Средняя репутация</div>
                                </div>
                                <div className="stat-card stat-info">
                                    <div className="stat-value">{feedbackStats.reputation?.flagged_for_cheating || 0}</div>
                                    <div className="stat-label">Зафлагано (3+ жалоб)</div>
                                </div>
                                <div className="stat-card stat-success">
                                    <div className="stat-value">{feedbackStats.coins?.total_coins_earned || 0}</div>
                                    <div className="stat-label">Coins роздано</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{feedbackStats.reputation?.players_with_reputation || 0}</div>
                                    <div className="stat-label">Игроков с репутацией</div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Фильтры */}
                    <div className="feedback-filters">
                        <div className="filter-group">
                            <label>Мин. жалоб на чит:</label>
                            <input 
                                type="number"
                                min="1"
                                value={feedbackFilter.min_cheating}
                                onChange={(e) => setFeedbackFilter(prev => ({ 
                                    ...prev, 
                                    min_cheating: parseInt(e.target.value) || 1 
                                }))}
                                className="map-input"
                                style={{width: '80px'}}
                            />
                        </div>
                        
                        <div className="filter-group">
                            <label>Макс. репутация:</label>
                            <input 
                                type="number"
                                min="0"
                                max="100"
                                value={feedbackFilter.max_reputation}
                                onChange={(e) => setFeedbackFilter(prev => ({ 
                                    ...prev, 
                                    max_reputation: parseInt(e.target.value) || 50 
                                }))}
                                className="map-input"
                                style={{width: '80px'}}
                            />
                        </div>
                        
                        <div className="filter-group">
                            <label>Сортировка:</label>
                            <select 
                                className="status-filter"
                                value={feedbackSort}
                                onChange={(e) => setFeedbackSort(e.target.value)}
                            >
                                <option value="cheating_desc">По жалобам (убыв.)</option>
                                <option value="reputation_asc">По репутации (возр.)</option>
                                <option value="reputation_desc">По репутации (убыв.)</option>
                                <option value="recent">По дате (новые)</option>
                            </select>
                        </div>
                        
                        <button 
                            className="btn"
                            onClick={() => {
                                setFeedbackPagination(prev => ({ ...prev, offset: 0 }));
                                fetchSuspiciousPlayers();
                            }}
                        >
                            🔍 Применить
                        </button>
                    </div>
                    
                    {/* Таблица suspicious players */}
                    {feedbacksLoading ? (
                        <div className="admin-loading">Загрузка подозрительных игроков...</div>
                    ) : (
                        <>
                            <h3>🚨 Подозрительные игроки ({feedbackPagination.total})</h3>
                            
                            <div className="suspicious-players-table">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Игрок</th>
                                            <th>Репутация</th>
                                            <th>Trust Score</th>
                                            <th>Жалоб на чит</th>
                                            <th>Подозр./Всего</th>
                                            <th>Токсич.</th>
                                            <th>Статус</th>
                                            <th>Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {suspiciousPlayers.length === 0 ? (
                                            <tr>
                                                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
                                                    {feedbackStats?.reputation?.flagged_for_cheating > 0 ? 
                                                        'Нет игроков по заданным фильтрам' :
                                                        'Пока нет подозрительных игроков 🎉'
                                                    }
                                                </td>
                                            </tr>
                                        ) : (
                                            suspiciousPlayers.map((player) => (
                                                <tr 
                                                    key={player.user_id}
                                                    className={`suspicious-row ${player.cheating_reports >= 5 ? 'critical' : ''}`}
                                                >
                                                    <td>{player.user_id}</td>
                                                    <td>
                                                        <div className="user-cell">
                                                            <strong>{player.username}</strong>
                                                            <span className="user-email">{player.email}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className={`reputation-badge rep-${Math.floor(player.reputation_index / 20)}`}>
                                                            {player.reputation_index}/100
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {player.trust_score ? (
                                                            <span className="trust-badge-small">{player.trust_score}/100</span>
                                                        ) : (
                                                            <span style={{color: '#666'}}>-</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`danger-badge ${player.cheating_reports >= 5 ? 'critical' : ''}`}>
                                                            {player.cheating_reports}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{color: player.suspicious_reports > 0 ? '#ffaa00' : '#999'}}>
                                                            {player.suspicious_reports} / {player.total_feedbacks}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={player.toxic_behavior > 0 ? 'toxic-badge' : ''}>
                                                            {player.toxic_behavior || 0}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`user-status ${player.is_banned ? 'banned' : 'active'}`}>
                                                            {player.is_banned ? '❌ Banned' : '✅ Active'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="feedback-actions">
                                                            <button
                                                                className="btn-small"
                                                                onClick={() => {
                                                                    const reports = player.recent_negative_reports || [];
                                                                    const details = `
Игрок: ${player.username}
Репутация: ${player.reputation_index}/100
Жалоб на чит: ${player.cheating_reports}
Подозрительных: ${player.suspicious_reports}
Всего оценок: ${player.total_feedbacks}

Недавние негативные отзывы:
${reports.map((r, i) => `${i+1}. ${r.reviewer_name}: ${r.fairness_rating || r.behavior_rating} (${r.tournament_name})`).join('\n')}
                                                                    `.trim();
                                                                    alert(details);
                                                                }}
                                                                title="Детали"
                                                            >
                                                                🔍
                                                            </button>
                                                            {!player.is_banned ? (
                                                                <button
                                                                    className="btn-small danger"
                                                                    onClick={() => banUser(player.user_id, player.username)}
                                                                    title="Забанить"
                                                                >
                                                                    🚫
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    className="btn-small"
                                                                    onClick={() => unbanUser(player.user_id, player.username)}
                                                                    title="Разбанить"
                                                                >
                                                                    ✅
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Пагинация */}
                            {feedbackPagination.total > feedbackPagination.limit && (
                                <div className="feedback-pagination">
                                    <button
                                        className="btn"
                                        onClick={() => setFeedbackPagination(prev => ({
                                            ...prev,
                                            offset: Math.max(0, prev.offset - prev.limit)
                                        }))}
                                        disabled={feedbackPagination.offset === 0}
                                    >
                                        ← Предыдущая
                                    </button>
                                    <span className="pagination-info">
                                        Показано {feedbackPagination.offset + 1}—{Math.min(feedbackPagination.offset + feedbackPagination.limit, feedbackPagination.total)} из {feedbackPagination.total}
                                    </span>
                                    <button
                                        className="btn"
                                        onClick={() => setFeedbackPagination(prev => ({
                                            ...prev,
                                            offset: prev.offset + prev.limit
                                        }))}
                                        disabled={feedbackPagination.offset + feedbackPagination.limit >= feedbackPagination.total}
                                    >
                                        Следующая →
                                    </button>
                                </div>
                            )}
                            
                            {/* Пояснение */}
                            <div className="feedback-legend">
                                <h4>Критерии попадания в список:</h4>
                                <ul>
                                    <li>3+ жалобы на читинг ИЛИ</li>
                                    <li>Репутация ≤50/100</li>
                                </ul>
                                <p className="legend-note">
                                    <strong>Рекомендация:</strong> Проверяйте игроков с 5+ жалобами на читинг в приоритетном порядке.
                                    Игроки с низкой репутацией могут быть просто токсичными, а не читерами.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}
            
            {/* 📊 MATCHZY STATS: Вкладка детальной статистики */}
            {activeTab === 'matchzyStats' && (
                <div className="matchzy-stats-tab">
                    <h2>📊 MatchZy Detailed Statistics</h2>
                    
                    {/* Аномалии */}
                    <div className="anomalies-section">
                        <h3>🚨 Обнаруженные аномалии ({matchzyAnomalies.length})</h3>
                        
                        {statsLoading ? (
                            <div className="admin-loading">Загрузка аномалий...</div>
                        ) : matchzyAnomalies.length === 0 ? (
                            <div className="stats-empty">
                                🎉 Нет непроверенных аномалий! Все чисто.
                            </div>
                        ) : (
                            <div className="anomalies-table">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Игрок</th>
                                            <th>Аномалия</th>
                                            <th>Severity</th>
                                            <th>Значение</th>
                                            <th>Турнир/Матч</th>
                                            <th>Дата</th>
                                            <th>Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matchzyAnomalies.map(anomaly => (
                                            <tr key={anomaly.id} className={`anomaly-row severity-${anomaly.severity.toLowerCase()}`}>
                                                <td>{anomaly.user_id}</td>
                                                <td>
                                                    <div className="user-cell">
                                                        <strong>{anomaly.username}</strong>
                                                        <span className="user-email">{anomaly.email}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="anomaly-type">
                                                        {anomaly.anomaly_type === 'high_hs_percentage' && 'HS% Too High'}
                                                        {anomaly.anomaly_type === 'sudden_improvement' && 'Sudden Improvement'}
                                                        {anomaly.anomaly_type === 'low_utility_high_kills' && 'Low Utility / High K/D'}
                                                        {anomaly.anomaly_type === 'perfect_clutches' && 'Perfect Clutches'}
                                                        {anomaly.anomaly_type === 'prefiring_pattern' && 'Prefiring Pattern'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`severity-badge severity-${anomaly.severity.toLowerCase()}`}>
                                                        {anomaly.severity === 'CRITICAL' && '🔴 CRITICAL'}
                                                        {anomaly.severity === 'HIGH' && '⚠️ HIGH'}
                                                        {anomaly.severity === 'MEDIUM' && '🟡 MEDIUM'}
                                                        {anomaly.severity === 'LOW' && '🟢 LOW'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="anomaly-value">
                                                        {anomaly.value?.toFixed(1) || '-'}
                                                        {anomaly.expected_value && (
                                                            <span className="anomaly-expected"> (exp: {anomaly.expected_value.toFixed(0)})</span>
                                                        )}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="anomaly-context">
                                                        {anomaly.tournament_name || 'Unknown'}<br/>
                                                        <span style={{color: '#666', fontSize: '11px'}}>Match #{anomaly.match_id}</span>
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="anomaly-date">
                                                        {new Date(anomaly.detected_at).toLocaleDateString('ru-RU')}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="anomaly-actions">
                                                        <button
                                                            className="btn-small"
                                                            onClick={() => {
                                                                alert(`Аномалия: ${anomaly.description}\n\nEvidence: ${JSON.stringify(anomaly.evidence, null, 2)}`);
                                                            }}
                                                            title="Детали"
                                                        >
                                                            🔍
                                                        </button>
                                                        <button
                                                            className="btn-small danger"
                                                            onClick={() => banUser(anomaly.user_id, anomaly.username)}
                                                            title="Забанить"
                                                        >
                                                            🚫
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    
                    {/* Leaderboards */}
                    <div className="leaderboards-section">
                        <div className="leaderboard-header">
                            <h3>🏆 Leaderboards</h3>
                            <select 
                                className="status-filter"
                                value={leaderboardMetric}
                                onChange={(e) => {
                                    setLeaderboardMetric(e.target.value);
                                    setTimeout(fetchLeaderboard, 100);
                                }}
                            >
                                <option value="rating">Rating</option>
                                <option value="kd">K/D Ratio</option>
                                <option value="hs">Headshot %</option>
                                <option value="adr">ADR</option>
                                <option value="clutch">Clutch Success</option>
                            </select>
                        </div>
                        
                        {leaderboard.length === 0 ? (
                            <div className="stats-empty">Нет данных для leaderboard</div>
                        ) : (
                            <div className="leaderboard-table">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Игрок</th>
                                            <th>Матчи</th>
                                            <th>W/L</th>
                                            <th>K/D</th>
                                            <th>ADR</th>
                                            <th>HS%</th>
                                            <th>Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((player, index) => (
                                            <tr key={player.user_id} className={index < 3 ? 'top-player' : ''}>
                                                <td>
                                                    <span className="rank-number">
                                                        {index + 1}
                                                        {index === 0 && ' 🥇'}
                                                        {index === 1 && ' 🥈'}
                                                        {index === 2 && ' 🥉'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="leaderboard-player">
                                                        <img 
                                                            src={player.avatar_url || '/default-avatar.png'}
                                                            alt={player.username}
                                                            className="player-avatar-small"
                                                            onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                                        />
                                                        <strong>{player.username}</strong>
                                                    </div>
                                                </td>
                                                <td>{player.total_matches}</td>
                                                <td>
                                                    <span className="wl-stat">
                                                        {player.total_wins}W-{player.total_losses}L
                                                    </span>
                                                </td>
                                                <td className={player.kd_ratio > 1 ? 'good' : 'bad'}>
                                                    {player.kd_ratio?.toFixed(2)}
                                                </td>
                                                <td>{player.avg_adr?.toFixed(0)}</td>
                                                <td>{player.avg_hs_percentage?.toFixed(0)}%</td>
                                                <td className="rating-highlight">
                                                    {player.avg_rating?.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    
                    {/* Инфо */}
                    <div className="matchzy-info">
                        <h4>ℹ️ Информация</h4>
                        <p>
                            Детальная статистика собирается автоматически от MatchZy plugin на игровых серверах.
                            Аномалии детектируются в реальном времени и интегрированы с Trust Score системой.
                        </p>
                        <p className="info-note">
                            <strong>Настройка MatchZy:</strong> Добавьте webhook URL в конфиг сервера.
                            Детали в документации: ГОТОВО_ДЕТАЛЬНАЯ_СТАТИСТИКА_MATCHZY.md
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPanel; 