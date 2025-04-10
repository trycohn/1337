import React, { useState, useEffect } from 'react';
import api from '../axios';
import './Profile.css';

function Profile() {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [cs2Stats, setCs2Stats] = useState(null);
    const [isLoadingCs2Stats, setIsLoadingCs2Stats] = useState(false);
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

    const fetchCs2Stats = async () => {
        if (!user.steam_id) return;
        
        setIsLoadingCs2Stats(true);
        try {
            const response = await api.get(`/api/playerStats/${user.steam_id}`);
            if (response.data.success) {
                setCs2Stats(response.data.data);
            }
        } catch (err) {
            setError('Ошибка получения статистики CS2');
        } finally {
            setIsLoadingCs2Stats(false);
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

    const renderRankGroups = () => {
        if (!cs2Stats || !cs2Stats.ranks || !cs2Stats.wins) return null;

        // Отфильтровать логотип CS2
        const filteredRanks = cs2Stats.ranks.filter(url => !url.includes('logo-cs2.png'));

        // Проверяем, что массив достаточно длинный для группировки
        if (filteredRanks.length < 13) return (<p>Недостаточно данных для отображения статистики</p>);

        // Формируем группы согласно описанной логике
        const group1 = { image: filteredRanks[0], win: cs2Stats.wins[0] };
        const group2 = filteredRanks.slice(1, 4);     // wingman.png, wingman10.svg, wingman11.svg
        const group3 = filteredRanks.slice(4, 7);     // de_dust2_v2.png, ranks/4.png, ranks/4.png
        const group4 = filteredRanks.slice(7, 10);    // cs2_office.png, ranks/0.png, ranks/0.png
        const group5 = filteredRanks.slice(10, 13);   // de_anubis.png, ranks/0.png, ranks/0.png

        return (
            <div>
                {/* Группа 1: premier.png с win */}
                <div className="rank-row">
                    <div className="rank-group">
                        <img src={group1.image} alt="premier" className="rank-image" />
                        <div className="rank-win">{group1.win}</div>
                    </div>
                </div>

                {/* Группа 2: wingman */}
                <div className="rank-row">
                    <div className="rank-group">
                        <img src={group2[0]} alt="wingman" className="rank-image" />
                    </div>
                    <div className="rank-group">
                        <img src={group2[1]} alt="wingman 10" className="rank-image" />
                    </div>
                    <div className="rank-group">
                        <img src={group2[2]} alt="wingman 11" className="rank-image" />
                    </div>
                </div>

                {/* Группа 3: de_dust2_v2 */}
                <div className="rank-row">
                    <div className="rank-group">
                        <img src={group3[0]} alt="de_dust2_v2" className="rank-image" />
                    </div>
                    <div className="rank-group">
                        <img src={group3[1]} alt="rank 4 (1)" className="rank-image" />
                    </div>
                    <div className="rank-group">
                        <img src={group3[2]} alt="rank 4 (2)" className="rank-image" />
                    </div>
                </div>

                {/* Группа 4: cs2_office */}
                <div className="rank-row">
                    <div className="rank-group">
                        <img src={group4[0]} alt="cs2_office" className="rank-image" />
                    </div>
                    <div className="rank-group">
                        <img src={group4[1]} alt="rank 0 (1)" className="rank-image" />
                    </div>
                    <div className="rank-group">
                        <img src={group4[2]} alt="rank 0 (2)" className="rank-image" />
                    </div>
                </div>

                {/* Группа 5: de_anubis */}
                <div className="rank-row">
                    <div className="rank-group">
                        <img src={group5[0]} alt="de_anubis" className="rank-image" />
                    </div>
                    <div className="rank-group">
                        <img src={group5[1]} alt="rank 0 (3)" className="rank-image" />
                    </div>
                    <div className="rank-group">
                        <img src={group5[2]} alt="rank 0 (4)" className="rank-image" />
                    </div>
                </div>
            </div>
        );
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
                        <div className="steam-buttons">
                            <button onClick={unlinkSteam}>Отвязать стим</button>
                            <button 
                                onClick={fetchCs2Stats} 
                                disabled={isLoadingCs2Stats}
                            >
                                {isLoadingCs2Stats ? 'Загрузка...' : 'Статистика CS2'}
                            </button>
                        </div>
                    )}
    
                    {cs2Stats && (
                        <div className="cs2-stats">
                            <h4>Статистика CS2</h4>
                            <div className="rank-container">
                                {renderRankGroups()}
                            </div>
                        </div>
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