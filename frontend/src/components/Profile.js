import React, { useState, useEffect } from 'react';
import api from '../axios';
import './Profile.css';

/* global FACEIT */

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
            
            // Автоматически загружаем статистику CS2, если есть steam_id
            if (response.data.steam_id) {
                fetchCs2Stats(response.data.steam_id);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Ошибка загрузки данных пользователя');
        }
    };

    const fetchCs2Stats = async (steamId) => {
        const id = steamId || (user && user.steam_id);
        if (!id) return;
        
        setIsLoadingCs2Stats(true);
        try {
            const response = await api.get(`/api/playerStats/${id}`);
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

    // Функция для инициализации параметров FACEIT SDK и генерации state
    const initFaceitSdk = () => {
        try {
            // Проверяем наличие SDK и функции инициализации
            if (!window.FACEIT_CONFIG || !window.FACEIT || typeof window.FACEIT.init !== 'function') {
                console.error('FACEIT SDK не загружен или недоступен');
                setError('FACEIT SDK не загружен. Пожалуйста, обновите страницу или попробуйте позже.');
                return false;
            }

            // Генерируем state с userId для безопасности
            const userId = user?.id || '';
            const randomPart = Math.random().toString(36).substring(2, 10);
            const state = `${randomPart}-${userId}`;

            // Получаем client_id из конфигурации или переменных окружения
            let clientId = window.FACEIT_CONFIG.client_id;
            if (clientId.includes('%REACT_APP_')) {
                clientId = process.env.REACT_APP_FACEIT_CLIENT_ID || 'b1e036ba-787c-4898-967b-bb94a5479a8c';
            }

            // Обновляем параметры инициализации
            const initParams = {
                client_id: clientId,
                response_type: 'code',
                state: state,
                redirect_popup: true,
                debug: true
            };

            console.log('Реинициализация FACEIT SDK с параметрами:', {
                ...initParams,
                client_id: initParams.client_id.substring(0, 6) + '...'
            });

            // Реинициализация SDK с новыми параметрами
            window.FACEIT.init(initParams);
            window.FACEIT_CONFIG.is_sdk_loaded = true;
            return true;
        } catch (err) {
            console.error('Ошибка инициализации FACEIT SDK:', err);
            setError('Не удалось инициализировать FACEIT SDK. Пожалуйста, попробуйте позже.');
            return false;
        }
    };

    // Обновляем функцию привязки FACEIT
    const linkFaceit = () => {
        try {
            // Если SDK еще не загружен, попробуем инициализировать его
            if (!window.FACEIT_CONFIG || !window.FACEIT_CONFIG.is_sdk_loaded) {
                // Пробуем инициализировать через глобальную функцию
                if (window.initFaceitSdk && window.initFaceitSdk()) {
                    console.log('FACEIT SDK инициализирован через глобальную функцию');
                } else {
                    console.error('FACEIT SDK не загружен или недоступен');
                    setError('FACEIT SDK не загружен. Пожалуйста, обновите страницу или попробуйте позже.');
                    return;
                }
            }
            
            if (!initFaceitSdk()) return;

            // Добавляем div для кнопки, если его еще нет
            const faceitLoginDiv = document.getElementById('faceitLogin');
            if (!faceitLoginDiv) {
                const div = document.createElement('div');
                div.id = 'faceitLogin';
                div.style.display = 'none';
                document.body.appendChild(div);
            }

            // Вызываем логин через FACEIT SDK
            console.log('Вызываем FACEIT.loginWithFaceit()');
            const popup = window.FACEIT.loginWithFaceit();
            if (!popup) {
                setError('Не удалось открыть окно авторизации FACEIT');
            } else {
                console.log('Окно авторизации FACEIT открыто');
            }
        } catch (err) {
            console.error('Ошибка при вызове FACEIT логина:', err);
            setError('Ошибка авторизации FACEIT. Пожалуйста, попробуйте позже.');
        }
    };

    // Добавляем функцию для обработки кода авторизации
    const handleFaceitCode = async (code, state) => {
        if (!code) {
            setError('Отсутствует код авторизации FACEIT');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            // Отправляем код на бэкенд для обмена на токен
            const response = await api.post('/api/users/faceit-oauth', 
                { code, state },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data && response.data.success) {
                setError('');
                fetchUserData(token);
            }
        } catch (err) {
            console.error('Ошибка обработки кода FACEIT:', err);
            setError(err.response?.data?.message || 'Ошибка привязки FACEIT аккаунта');
        }
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

            // Проверяем параметры для FACEIT
            const code = urlParams.get('code');
            const state = urlParams.get('state');
            if (code && state) {
                handleFaceitCode(code, state);
                // Очищаем URL после обработки
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('faceit') === 'success') {
            fetchUserData(localStorage.getItem('token')); // Обновить данные пользователя
        } else if (params.get('error')) {
            setError(`Ошибка привязки FACEIT: ${params.get('error')}`);
        }
    }, []);

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
    
        // Создаём копии для дальнейшей работы
        let winValues = Array.from(cs2Stats.wins);
        let filteredRanks = cs2Stats.ranks.filter(url => !url.includes('logo-cs2.png'));
    
        // Если есть картинка logo-csgo.png, отрезаем её и все, что после
        const csgoIdx = filteredRanks.findIndex(url => url.includes('logo-csgo.png'));
        if (csgoIdx !== -1) {
            filteredRanks = filteredRanks.slice(0, csgoIdx);
        }
    
        const groups = [];
    
        // Функция для проверки формата win (например, "12,361" или "---")
        const validWinFormat = (win) => /^(\d{1,3}(,\d{3})*|---)$/.test(win);
    
        // Функция для поиска и удаления первого win-значения с корректным форматом
        const getValidWinValue = () => {
            for (let i = 0; i < winValues.length; i++) {
                if (validWinFormat(winValues[i])) {
                    const val = winValues[i];
                    winValues.splice(i, 1);
                    return val;
                }
            }
            return '---';
        };
    
        // Ищем все вхождения premier.png и для каждого формируем отдельную группу
        const premierIndices = [];
        filteredRanks.forEach((url, index) => {
            if (url.includes('premier.png')) {
                premierIndices.push(index);
            }
        });
    
        // Обрабатываем каждое найденное вхождение premier.png.
        // Ищем win-значения по всему массиву winValues, а не только первые.
        premierIndices
            .sort((a, b) => b - a)
            .forEach(idx => {
                const win1 = getValidWinValue();
                const win2 = getValidWinValue();
                groups.unshift({
                    type: 'premier',
                    image: filteredRanks[idx],
                    wins: [win1, win2]
                });
                filteredRanks.splice(idx, 1); // удаляем premier.png для дальнейшей группировки
            });
    
        // Формируем группы по 3 картинки (группы могут быть неполными)
        for (let i = 0; i < filteredRanks.length; i += 3) {
            groups.push({
                type: 'group',
                images: filteredRanks.slice(i, i + 3)
            });
        }
    
        return (
            <div>
                {groups.map((group, index) => {
                    if (group.type === 'premier') {
                        return (
                            <div key={`group-${index}`} className="rank-row">
                                <div className="rank-group">
                                    <img src={group.image} alt="premier" className="rank-image" />
                                </div>
                                <div className="rank-win">
                                    <span>{group.wins[0]}</span>
                                    {group.wins[1] && <span> {group.wins[1]}</span>}
                                </div>
                            </div>
                        );
                    } else {
                        return (
                            <div key={`group-${index}`} className="rank-row">
                                {group.images.map((img, idx) => (
                                    <div key={`img-${idx}`} className="rank-group">
                                        <img src={img} alt={`rank ${idx + 1}`} className="rank-image" />
                                    </div>
                                ))}
                            </div>
                        );
                    }
                })}
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
                                onClick={() => fetchCs2Stats()}
                                disabled={isLoadingCs2Stats}
                            >
                                {isLoadingCs2Stats ? 'Загрузка...' : 'Обновить статистику CS2'}
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
                    <button onClick={linkFaceit}>Привязать FACEit</button>
                    {/* Добавляем скрытый div для кнопки FACEIT */}
                    <div id="faceitLogin" style={{ display: 'none' }}></div>
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