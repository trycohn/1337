import React, { useState, useEffect } from 'react';
import api from '../axios';
import './Profile.css';

function Profile() {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [faceitId, setFaceitId] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [verificationData, setVerificationData] = useState({
        fullName: '',
        birthDate: '',
        avatarUrl: ''
    });
    const [emailToken, setEmailToken] = useState('');
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [steamNickname, setSteamNickname] = useState(''); // Оставляем как есть

    const fetchUserData = async (token) => {
        try {
            const response = await api.get('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(response.data);
            setNewUsername(response.data.username);
        } catch (err) {
            setError(err.response?.data?.message || 'Ошибка загрузки данных пользователя');
        }
    };

    const fetchStats = async (token) => {
        try {
            const response = await api.get('/api/users/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(response.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Ошибка загрузки статистики');
        }
    };

    const linkSteam = () => {
        const token = localStorage.getItem('token');
        if (token) {
            const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
            const steamLoginUrl = `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${baseUrl}/api/users/steam-callback&openid.realm=${baseUrl}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
            window.location.href = steamLoginUrl;
        } else {
            setError('Вы должны быть авторизованы для привязки Steam');
        }
    };

    const handleSteamCallback = async (steamId, token) => {
        try {
            const response = await api.post('/api/users/link-steam', { steamId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, steam_id: steamId, steam_url: `https://steamcommunity.com/profiles/${steamId}` } : null);
            setError('');
            window.history.replaceState({}, document.title, '/profile');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка привязки Steam');
        }
    };

    const unlinkSteam = async () => {
        const token = localStorage.getItem('token');
        try {
            await api.post('/api/users/unlink-steam', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, steam_id: null, steam_url: null } : null);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отвязки Steam');
        }
    };

    const updateUsername = async () => {
        const token = localStorage.getItem('token');
        try {
            const response = await api.post('/api/users/update-username', { username: newUsername }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, username: newUsername } : null);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка изменения никнейма');
        }
    };

    const fetchAndSetSteamNickname = async () => { // Переименованная функция
        const token = localStorage.getItem('token');
        try {
            const response = await api.get('/api/users/steam-nickname', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSteamNickname(response.data.steamNickname);
            setShowModal(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка получения никнейма Steam');
        }
    };

    const confirmSteamNickname = async () => {
        setNewUsername(steamNickname);
        await updateUsername();
        setShowModal(false);
    };

    const closeModal = () => {
        setShowModal(false);
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchUserData(token);
            fetchStats(token);
            const urlParams = new URLSearchParams(window.location.search);
            const steamId = urlParams.get('steamId');
            if (steamId) {
                handleSteamCallback(steamId, token);
            }
        }
    }, []);

    const linkFaceit = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/users/link-faceit', { faceitId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, faceit_id: response.data.faceitId } : null);
            setFaceitId('');
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка привязки FACEit');
        }
    };

    const verifyProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/users/verify', verificationData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, ...response.data.user } : null);
            setVerificationData({ fullName: '', birthDate: '', avatarUrl: '' });
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка верификации профиля');
        }
    };

    const verifyEmail = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/users/verify-email', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`Токен отправлен в консоль: ${response.data.token}`);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отправки токена');
        }
    };

    const confirmEmail = async () => {
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/users/confirm-email', { token: emailToken }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, is_verified: true } : null);
            setEmailToken('');
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Ошибка подтверждения email');
        }
    };

    if (!user) return <p>Загрузка...</p>;

    return (
        <div className="profile">
            <h2>Личный кабинет</h2>
            {error && <p className="error">{error}</p>}
            
            <section>
                <h3>Данные пользователя</h3>
                <p>Имя пользователя: {user.username}</p>
                <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Новый никнейм"
                />
                <button onClick={updateUsername}>Изменить никнейм</button>
                {user.steam_id && (
                    <button onClick={fetchAndSetSteamNickname}>Установить никнейм Steam</button> // Используем новую функцию
                )}
                <p>Email: {user.email}</p>
                <p>Статус верификации: {user.is_verified ? 'Верифицирован' : 'Не верифицирован'}</p>
            </section>

            <section>
                <h3>Привязка профилей</h3>
                <div>
                    <p>Steam: {user.steam_url || 'Не привязан'}</p>
                    {!user.steam_url && (
                        <button onClick={linkSteam}>Привязать Steam</button>
                    )}
                    {user.steam_url && (
                    <button onClick={unlinkSteam}>Отвязать стим</button>
                    )}
                </div>
                <div>
                    <input 
                        value={faceitId} 
                        onChange={(e) => setFaceitId(e.target.value)} 
                        placeholder="FACEit ID" 
                    />
                    <button onClick={linkFaceit}>Привязать FACEit</button>
                </div>
                <p>FACEit: {user.faceit_id || 'Не привязан'}</p>
            </section>

            <section>
                <h3>Верификация профиля</h3>
                {!user.is_verified && (
                    <>
                        <input 
                            value={verificationData.fullName} 
                            onChange={(e) => setVerificationData({ ...verificationData, fullName: e.target.value })} 
                            placeholder="ФИО" 
                        />
                        <input 
                            type="date" 
                            value={verificationData.birthDate} 
                            onChange={(e) => setVerificationData({ ...verificationData, birthDate: e.target.value })} 
                        />
                        <input 
                            value={verificationData.avatarUrl} 
                            onChange={(e) => setVerificationData({ ...verificationData, avatarUrl: e.target.value })} 
                            placeholder="URL аватара" 
                        />
                        <button onClick={verifyProfile}>Верифицировать</button>
                    </>
                )}
            </section>

            <section>
                <h3>Подтверждение email</h3>
                {!user.is_verified && (
                    <>
                        <button onClick={verifyEmail}>Отправить токен</button>
                        <input 
                            value={emailToken} 
                            onChange={(e) => setEmailToken(e.target.value)} 
                            placeholder="Введите токен" 
                        />
                        <button onClick={confirmEmail}>Подтвердить</button>
                    </>
                )}
            </section>

            <section>
                <h3>Статистика</h3>
                {stats ? (
                    <>
                        <h4>Турниры</h4>
                        <ul>
                            {stats.tournaments.map((t) => (
                                <li key={t.tournament_id}>{t.name} - {t.result}</li>
                            ))}
                        </ul>
                        <h4>Соло</h4>
                        <p>W:L: {stats.solo.wins}:{stats.solo.losses} ({stats.solo.winRate}%)</p>
                        <h4>Командные</h4>
                        <p>W:L: {stats.team.wins}:{stats.team.losses} ({stats.team.winRate}%)</p>
                    </>
                ) : (
                    <p>Статистика загружается...</p>
                )}
            </section>

            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <p>Твой никнейм в Steam "{steamNickname}", устанавливаем в качестве основного на профиль?</p>
                        <button onClick={confirmSteamNickname}>Да</button>
                        <button onClick={closeModal}>Нет</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;