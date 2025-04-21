import React, { useState, useEffect, useRef } from 'react';
import api from '../axios';
import './Profile.css';
import { isCurrentUser } from '../utils/userHelpers';

function Profile() {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [cs2Stats, setCs2Stats] = useState(null);
    const [isLoadingCs2Stats, setIsLoadingCs2Stats] = useState(false);
    const [faceitId, setFaceitId] = useState('');
    const [faceitInfo, setFaceitInfo] = useState(null);
    const [isLoadingFaceitInfo, setIsLoadingFaceitInfo] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [steamNickname, setSteamNickname] = useState('');
    const [premierRank, setPremierRank] = useState(0);
    
    // Avatar states
    const [avatar, setAvatar] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const fileInputRef = useRef(null);
    
    // Email verification states re
    const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isResendDisabled, setIsResendDisabled] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [isClosingModal, setIsClosingModal] = useState(false);
    const [verificationError, setVerificationError] = useState('');
    
    // Email adding states
    const [showAddEmailModal, setShowAddEmailModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [addEmailError, setAddEmailError] = useState('');
    
    // Email required modal state
    const [showEmailRequiredModal, setShowEmailRequiredModal] = useState(false);

    // Friends states
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);

    // Match history states
    const [matchHistory, setMatchHistory] = useState([]);
    const [loadingMatchHistory, setLoadingMatchHistory] = useState(false);
    const [showMatchHistoryModal, setShowMatchHistoryModal] = useState(false);

    // Active tab state
    const [activeTab, setActiveTab] = useState('main');

    const fetchUserData = async (token) => {
        try {
            const response = await api.get('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(response.data);
            setNewUsername(response.data.username);
            
            // Устанавливаем аватар, если он есть
            if (response.data.avatar_url) {
                setAvatar(response.data.avatar_url);
            }
            
            // Извлекаем ранг Premier из данных пользователя
            if (response.data.cs2_premier_rank) {
                setPremierRank(response.data.cs2_premier_rank);
            }
            
            // Автоматически загружаем статистику CS2 только при первой привязке Steam
            // (только если есть steam_id и нет cs2_premier_rank)
            if (response.data.steam_id && response.data.cs2_premier_rank === 0) {
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
            const response = await api.get(`/api/playerStats/${id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.data.success) {
                setCs2Stats(response.data.data);
                // Обновляем ранг Premier из ответа API
                if (response.data.premier_rank !== undefined) {
                    setPremierRank(response.data.premier_rank);
                }
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
            
            // После привязки Steam автоматически загружаем и сохраняем статистику CS2
            fetchCs2Stats(steamId);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка привязки Steam');
        }
    };

    const unlinkSteam = async () => {
        const token = localStorage.getItem('token');
        
        // Проверяем, есть ли привязанная почта
        if (!user.email) {
            // Показываем модальное окно с предупреждением и предложением привязать почту
            setShowEmailRequiredModal(true);
            return;
        }
        
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

    const unlinkFaceit = async () => {
        const token = localStorage.getItem('token');
        
        // Проверяем, есть ли привязанная почта
        if (!user.email) {
            // Показываем модальное окно с предупреждением и предложением привязать почту
            setShowEmailRequiredModal(true);
            return;
        }
        
        try {
            await api.post('/api/users/unlink-faceit', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prevUser => prevUser ? { ...prevUser, faceit_id: null } : null);
            setFaceitInfo(null);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отвязки FACEIT');
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

    const fetchAndSetSteamNickname = async () => {
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

    // Функция открытия модального окна с проверкой первого запуска
    const openEmailVerificationModal = async () => {
        setShowEmailVerificationModal(true);
        
        // Проверяем, был ли уже отправлен код ранее
        const codeWasSentBefore = localStorage.getItem('verification_code_sent') === 'true';
        
        if (!codeWasSentBefore) {
            // Если код отправляется впервые, отправляем его и устанавливаем флаг
            await sendVerificationCode();
            localStorage.setItem('verification_code_sent', 'true');
        }
    };

    // Обновляем функцию закрытия модального окна
    const closeEmailVerificationModal = () => {
        setIsClosingModal(true);
        
        // Ждем завершения анимации перед фактическим скрытием модального окна
        setTimeout(() => {
            setShowEmailVerificationModal(false);
            setIsClosingModal(false);
            setVerificationCode('');
            setVerificationError(''); // Сбрасываем ошибку при закрытии
        }, 300); // Время должно совпадать с длительностью анимации в CSS (0.3s)
    };

    const sendVerificationCode = async () => {
        if (isResendDisabled) return;
        
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/users/verify-email', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Сбрасываем ошибку при успешной отправке нового кода
            setVerificationError('');
            
            // Устанавливаем задержку 3 минуты на повторную отправку
            setIsResendDisabled(true);
            const countdownTime = 180; // 3 минуты в секундах
            setResendCountdown(countdownTime);
            
            // Сохраняем время окончания задержки в localStorage
            const endTime = Date.now() + countdownTime * 1000;
            localStorage.setItem('resendCodeEndTime', endTime.toString());
            
            // Запускаем обратный отсчет
            startCountdown(countdownTime);
            
            setError('');
        } catch (err) {
            setVerificationError(err.response?.data?.error || 'Ошибка отправки кода подтверждения');
        }
    };

    const startCountdown = (seconds) => {
        let remainingSeconds = seconds;
        const intervalId = setInterval(() => {
            remainingSeconds -= 1;
            setResendCountdown(remainingSeconds);
            
            if (remainingSeconds <= 0) {
                clearInterval(intervalId);
                setIsResendDisabled(false);
                setResendCountdown(0);
                localStorage.removeItem('resendCodeEndTime');
            }
        }, 1000);
    };

    const submitVerificationCode = async () => {
        if (verificationCode.length !== 6) {
            setVerificationError('Код подтверждения должен состоять из 6 цифр');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/users/confirm-email', { code: verificationCode }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем статус верификации пользователя
            setUser(prevUser => prevUser ? { ...prevUser, is_verified: true } : null);
            closeEmailVerificationModal();
            setError('');
        } catch (err) {
            // Устанавливаем ошибку в модальном окне вместо общей ошибки
            setVerificationError(err.response?.data?.message || 'Неверный код подтверждения');
        }
    };

    // Функция для обработки ввода кода
    const handleCodeChange = (e) => {
        const value = e.target.value;
        // Принимаем только цифры и не более 6 символов
        const code = value.replace(/\D/g, '').slice(0, 6);
        setVerificationCode(code);
    };

    // Функция для обработки вставки из буфера обмена
    const handleCodePaste = async (e) => {
        e.preventDefault();
        try {
            // Получаем текст из буфера обмена
            const text = await navigator.clipboard.readText();
            // Фильтруем только цифры и ограничиваем длину
            const code = text.replace(/\D/g, '').slice(0, 6);
            setVerificationCode(code);
        } catch (err) {
            console.error('Не удалось получить доступ к буферу обмена:', err);
        }
    };

    // Функция для фокусировки на скрытом поле ввода при клике на контейнер цифр
    const handleCodeContainerClick = () => {
        document.getElementById('hidden-code-input').focus();
    };

    // Добавим эффект для автоматической проверки кода, когда он заполнен полностью
    useEffect(() => {
        if (verificationCode.length === 6) {
            submitVerificationCode();
        }
    }, [verificationCode]);

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

            // Загружаем список друзей при загрузке страницы
            fetchFriends();
            // Загружаем заявки в друзья
            fetchFriendRequests();
            // Загружаем историю матчей
            fetchMatchHistory();
        }
        
        // Проверяем, есть ли сохраненное время окончания задержки
        const savedEndTime = localStorage.getItem('resendCodeEndTime');
        if (savedEndTime) {
            const endTime = parseInt(savedEndTime);
            const now = Date.now();
            const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));
            
            if (remainingTime > 0) {
                setIsResendDisabled(true);
                setResendCountdown(remainingTime);
                startCountdown(remainingTime);
            } else {
                localStorage.removeItem('resendCodeEndTime');
            }
        }
    }, []);

    // Загружаем никнейм Steam при изменении user.steam_id
    useEffect(() => {
        if (user && user.steam_id) {
            fetchSteamNickname();
        }
    }, [user?.steam_id]);

    // Загружаем информацию о FACEit при изменении user.faceit_id
    useEffect(() => {
        if (user && user.faceit_id) {
            fetchFaceitInfo();
        }
    }, [user?.faceit_id]);

    const fetchSteamNickname = async () => {
        const token = localStorage.getItem('token');
        try {
            const response = await api.get('/api/users/steam-nickname', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSteamNickname(response.data.steamNickname);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка получения никнейма Steam');
        }
    };

    const fetchFaceitInfo = async () => {
        const token = localStorage.getItem('token');
        setIsLoadingFaceitInfo(true);
        try {
            const response = await api.get('/api/users/faceit-info', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFaceitInfo(response.data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка получения информации FACEit');
        } finally {
            setIsLoadingFaceitInfo(false);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('faceit') === 'success') {
            fetchUserData(localStorage.getItem('token'));
        } else if (params.get('error')) {
            setError(`Ошибка привязки FACEIT: ${params.get('error')}`);
        }
    }, []);

    const linkFaceit = () => {
        const token = localStorage.getItem('token');
        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
        window.location.href = `${baseUrl}/api/users/link-faceit?token=${token}`;
    };

    const renderRankGroups = () => {
        // Если у пользователя нет ранга Premier, показываем сообщение
        if (!premierRank) {
            return <p>Нет данных о ранге Premier</p>;
        }
        
        // Если есть статистика CS2, используем ее для отображения ранга
        if (cs2Stats && cs2Stats.ranks) {
            // Создаём копии для дальнейшей работы
            let filteredRanks = cs2Stats.ranks.filter(url => !url.includes('logo-cs2.png'));
            
            // Если есть картинка logo-csgo.png, отрезаем её и все, что после
            const csgoIdx = filteredRanks.findIndex(url => url.includes('logo-csgo.png'));
            if (csgoIdx !== -1) {
                filteredRanks = filteredRanks.slice(0, csgoIdx);
            }
            
            // Ищем последний ранг premier.png
            const lastPremierIndex = filteredRanks.findLastIndex(url => url.includes('premier.png'));
            
            // Если найден premier.png, показываем его
            if (lastPremierIndex !== -1) {
                return (
                    <div>
                        <div className="rank-row">
                            <div className="rank-group">
                                <img src={filteredRanks[lastPremierIndex]} alt="premier" className="rank-image" />
                            </div>
                            <div className="rank-win">
                                <span>{premierRank}</span>
                            </div>
                        </div>
                    </div>
                );
            }
        }
        
        // Если нет изображения ранга, но есть числовое значение ранга
        return (
            <div className="rank-row">
                <p>Premier Rank: {premierRank}</p>
            </div>
        );
    };

    // Функция для открытия модального окна добавления почты
    const openAddEmailModal = () => {
        setShowAddEmailModal(true);
        setAddEmailError('');
    };

    // Функция закрытия модального окна добавления почты
    const closeAddEmailModal = () => {
        setIsClosingModal(true);
        
        setTimeout(() => {
            setShowAddEmailModal(false);
            setIsClosingModal(false);
            setNewEmail('');
            setAddEmailError('');
        }, 300);
    };

    // Функция для сохранения новой почты
    const saveEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) {
            setAddEmailError('Пожалуйста, введите корректный email');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/users/update-email', { email: newEmail }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем данные пользователя с новым email
            setUser(prevUser => prevUser ? { ...prevUser, email: newEmail, is_verified: false } : null);
            
            // Закрываем модальное окно добавления email
            closeAddEmailModal();
            
            // Открываем модальное окно подтверждения email
            setShowEmailVerificationModal(true);
            
            // Отправляем код верификации
            await sendVerificationCode();
            localStorage.setItem('verification_code_sent', 'true');
            
        } catch (err) {
            setAddEmailError(err.response?.data?.error || 'Ошибка сохранения email');
        }
    };

    // Добавить функцию закрытия модального окна с требованием привязать почту
    const closeEmailRequiredModal = () => {
        setIsClosingModal(true);
        
        setTimeout(() => {
            setShowEmailRequiredModal(false);
            setIsClosingModal(false);
        }, 300);
    };

    // Функция для загрузки аватара
    const handleAvatarUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Проверяем тип файла (разрешаем только изображения)
        if (!file.type.startsWith('image/')) {
            setError('Пожалуйста, выберите файл изображения');
            return;
        }

        // Ограничение размера файла (например, 5 МБ)
        const maxSize = 5 * 1024 * 1024; // 5 МБ в байтах
        if (file.size > maxSize) {
            setError('Размер файла не должен превышать 5 МБ');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        setUploadingAvatar(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/users/upload-avatar', formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            // Обновляем аватар в состоянии
            setAvatar(response.data.avatar_url);
            setUser(prevUser => ({...prevUser, avatar_url: response.data.avatar_url}));
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка загрузки аватара');
        } finally {
            setUploadingAvatar(false);
        }
    };

    // Функция для установки аватара из Steam
    const setAvatarFromSteam = async () => {
        if (!user.steam_id) {
            setError('Steam не привязан');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/users/set-steam-avatar', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем аватар в состоянии
            setAvatar(response.data.avatar_url);
            setUser(prevUser => ({...prevUser, avatar_url: response.data.avatar_url}));
            setError('');
            setShowAvatarModal(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка установки аватара из Steam');
        }
    };

    // Функция для установки аватара из FACEIT
    const setAvatarFromFaceit = async () => {
        if (!user.faceit_id) {
            setError('FACEIT не привязан');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/users/set-faceit-avatar', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем аватар в состоянии
            setAvatar(response.data.avatar_url);
            setUser(prevUser => ({...prevUser, avatar_url: response.data.avatar_url}));
            setError('');
            setShowAvatarModal(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка установки аватара из FACEIT');
        }
    };

    // Обработчик клика на кнопку выбора файла
    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    // Открытие модального окна выбора аватара
    const openAvatarModal = () => {
        setShowAvatarModal(true);
    };

    // Закрытие модального окна выбора аватара
    const closeAvatarModal = () => {
        setShowAvatarModal(false);
    };

    // Функция для загрузки списка друзей
    const fetchFriends = async () => {
        setLoadingFriends(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/friends', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Фильтруем только принятые заявки
            const acceptedFriends = response.data.filter(f => f.status === 'accepted');
            setFriends(acceptedFriends);
        } catch (err) {
            console.error('Ошибка загрузки списка друзей:', err);
        } finally {
            setLoadingFriends(false);
        }
    };

    // Функция для загрузки входящих заявок в друзья
    const fetchFriendRequests = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/friends/requests/incoming', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFriendRequests(response.data);
        } catch (err) {
            console.error('Ошибка загрузки заявок в друзья:', err);
        }
    };

    // Функция для принятия заявки в друзья
    const acceptFriendRequest = async (requestId) => {
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/friends/accept', { requestId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем списки друзей и заявок
            fetchFriends();
            fetchFriendRequests();
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка принятия заявки в друзья');
        }
    };

    // Функция для отклонения заявки в друзья
    const rejectFriendRequest = async (requestId) => {
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/friends/reject', { requestId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем список заявок
            fetchFriendRequests();
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отклонения заявки в друзья');
        }
    };

    // Функция для удаления из друзей
    const removeFriend = async (friendId) => {
        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/friends/${friendId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем список друзей
            fetchFriends();
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка удаления из друзей');
        }
    };

    // Функция для загрузки истории матчей
    const fetchMatchHistory = async () => {
        setLoadingMatchHistory(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/users/match-history', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMatchHistory(response.data);
        } catch (err) {
            console.error('Ошибка загрузки истории матчей:', err);
        } finally {
            setLoadingMatchHistory(false);
        }
    };

    // Переключение между вкладками
    const switchTab = (tabName) => {
        setActiveTab(tabName);
    };

    // Открытие модального окна истории матчей
    const openMatchHistoryModal = () => {
        setShowMatchHistoryModal(true);
    };

    // Закрытие модального окна истории матчей
    const closeMatchHistoryModal = () => {
        setIsClosingModal(true);
        
        setTimeout(() => {
            setShowMatchHistoryModal(false);
            setIsClosingModal(false);
        }, 300);
    };

    // Rendering last 5 matches
    const renderLastFiveMatches = () => {
        if (loadingMatchHistory) {
            return <p>Загрузка истории матчей...</p>;
        }

        const lastFive = matchHistory.slice(0, 5);
        
        if (lastFive.length === 0) {
            return <p>Нет истории матчей</p>;
        }

        return (
            <div className="recent-matches">
                <h4>Последние 5 матчей</h4>
                <div className="matches-list">
                    {lastFive.map((match, index) => (
                        <div key={index} className={`match-item ${match.result === 'win' ? 'win' : 'loss'}`}>
                            <div className="match-date">{new Date(match.date).toLocaleDateString()}</div>
                            <div className="match-info">
                                <span className="match-opponent">{match.opponent}</span>
                                <span className="match-score">{match.score}</span>
                            </div>
                            <div className="match-tournament">
                                <a href={`/tournament/${match.tournament_id}`}>{match.tournament_name}</a>
                            </div>
                        </div>
                    ))}
                </div>
                <button className="view-all-btn" onClick={openMatchHistoryModal}>
                    Показать все матчи
                </button>
            </div>
        );
    };

    // Render friend item with additional info on hover
    const renderFriendItem = (friend) => {
        // Проверяем и устанавливаем статус по умолчанию, если он отсутствует
        const onlineStatus = friend.friend.online_status || 'offline';
        const lastActive = friend.friend.last_active || 'недавно';
        
        return (
            <div key={friend.id} className="friend-item">
                <a href={isCurrentUser(friend.friend.id) ? `/profile` : `/user/${friend.friend.id}`} className="friend-link">
                    <img 
                        src={friend.friend.avatar_url || '/default-avatar.png'} 
                        alt={friend.friend.username} 
                        className="friend-avatar"
                    />
                    <div className="friend-details">
                        <span className="friend-username" title={friend.friend.username}>{friend.friend.username}</span>
                        <span className={`friend-status ${onlineStatus === 'online' ? 'online' : 'offline'}`}>
                            {onlineStatus === 'online' ? 'Онлайн' : `Был в сети ${lastActive}`}
                        </span>
                    </div>
                </a>
                <div className="friend-hover-info">
                    <div className="friend-stats">
                        <p>Матчей вместе: <span>{friend.matches_together || 0}</span></p>
                        <p>Винрейт против друга: <span>{friend.win_rate || 0}%</span></p>
                        <p>Последняя игра: <span>{friend.last_match || 'Нет данных'}</span></p>
                    </div>
                    <button className="send-message-btn">Сообщение</button>
                </div>
                <button 
                    className="remove-friend-btn" 
                    onClick={() => removeFriend(friend.friend.id)}
                    title="Удалить из друзей"
                >
                    ✕
                </button>
            </div>
        );
    };

    if (!user) return <p>Загрузка...</p>;

    return (
        <div className="profile-container">
            {error && <p className="error">{error}</p>}
            
            <div className="profile-header">
                <div className="avatar-container">
                    <img 
                        src={avatar || '/default-avatar.png'} 
                        alt="Аватар пользователя" 
                        className="user-avatar"
                        onClick={openAvatarModal}
                    />
                    <button className="change-avatar-btn" onClick={openAvatarModal}>
                        Изменить аватар
                    </button>
                </div>
                <div className="user-info">
                    <h2>{user.username}</h2>
                </div>
            </div>
            
            {/* Плашка с предупреждением для пользователей без email */}
            {!user.email && (
                <div className="verification-alert">
                    <p>
                        <strong>Внимание!</strong> У вас не указан email. Вы не можете создавать и администрировать турниры.
                    </p>
                    <button onClick={openAddEmailModal}>Привязать email</button>
                </div>
            )}
            
            {/* Плашка с предупреждением для неверифицированных пользователей */}
            {user.email && !user.is_verified && (
                <div className="verification-alert">
                    <p>
                        <strong>Внимание!</strong> Ваш email не подтвержден. Вы не можете создавать и администрировать турниры.
                    </p>
                    <button onClick={openEmailVerificationModal}>Подтвердить email</button>
                </div>
            )}
            
            <div className="profile-content">
                <div className="profile-navigation">
                    <button 
                        className={`nav-tab ${activeTab === 'main' ? 'active' : ''}`} 
                        onClick={() => switchTab('main')}
                    >
                        Основная
                    </button>
                    <button 
                        className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`} 
                        onClick={() => switchTab('stats')}
                    >
                        Статистика
                    </button>
                    <button 
                        className={`nav-tab ${activeTab === 'friends' ? 'active' : ''}`} 
                        onClick={() => switchTab('friends')}
                    >
                        Друзья
                    </button>
                </div>
                
                <div className="profile-tab-content">
                    {/* Основная вкладка */}
                    {activeTab === 'main' && (
                        <div className="main-tab">
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
                                    <button onClick={fetchAndSetSteamNickname}>Установить никнейм Steam</button>
                                )}
                                <p>Email: {user.email || 'Не указан'}</p>
                                {!user.email ? (
                                    <button onClick={openAddEmailModal}>Привязать email</button>
                                ) : (
                                    <p>Статус верификации: {user.is_verified ? 'Подтвержден' : 'Не подтвержден'}</p>
                                )}
                                {user.email && !user.is_verified && (
                                    <button onClick={openEmailVerificationModal}>Подтвердить email</button>
                                )}
                            </section>

                            <section className="steam-section">
                                <h3>Steam</h3>
                                <div>
                                    <p>
                                        {user.steam_url 
                                            ? <span>Привязан: <a href={user.steam_url} target="_blank" rel="noopener noreferrer">{steamNickname || 'Загрузка...'}</a></span>
                                            : 'Не привязан'}
                                    </p>
                                    {!user.steam_url && (
                                        <button onClick={linkSteam}>Привязать Steam</button>
                                    )}
                                    {user.steam_url && (
                                        <div className="steam-buttons">
                                            <button className="unlink-button" onClick={unlinkSteam}>Отвязать стим</button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="faceit-section">
                                <h3>Faceit</h3>
                                <div>
                                    {!user.faceit_id && (
                                        <button onClick={linkFaceit}>Привязать FACEit</button>
                                    )}
                                    <p>
                                        {user.faceit_id 
                                            ? <span>
                                                Привязан: {isLoadingFaceitInfo 
                                                    ? 'Загрузка...' 
                                                    : (faceitInfo 
                                                        ? <a href={faceitInfo.faceitUrl} target="_blank" rel="noopener noreferrer">{faceitInfo.faceitNickname}</a> 
                                                        : user.faceit_id)
                                            }
                                          </span>
                                            : 'Не привязан'
                                        }
                                    </p>
                                    {user.faceit_id && (
                                        <button className="unlink-button" onClick={unlinkFaceit}>Отвязать FACEIT</button>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}
                    
                    {/* Вкладка статистики */}
                    {activeTab === 'stats' && (
                        <div className="stats-tab">
                            {/* Статистика сайта */}
                            <section className="site-stats-section">
                                <h3>Статистика сайта</h3>
                                {stats ? (
                                    <div className="stats-grid">
                                        <div className="stats-card">
                                            <div className="stats-value">{stats.solo.wins + stats.solo.losses + stats.team.wins + stats.team.losses}</div>
                                            <div className="stats-label">Всего матчей</div>
                                        </div>
                                        <div className="stats-card">
                                            <div className="stats-value">{stats.tournaments.length}</div>
                                            <div className="stats-label">Турниров</div>
                                        </div>
                                        <div className="stats-card">
                                            <div className="stats-value">
                                                {stats.tournaments.filter(t => t.result === 'Победитель').length}
                                            </div>
                                            <div className="stats-label">Выигранных турниров</div>
                                        </div>
                                        <div className="stats-card">
                                            <div className="stats-value">
                                                {Math.round(((stats.solo.wins + stats.team.wins) / 
                                                (stats.solo.wins + stats.solo.losses + stats.team.wins + stats.team.losses) * 100) || 0)}%
                                            </div>
                                            <div className="stats-label">Винрейт</div>
                                        </div>
                                    </div>
                                ) : (
                                    <p>Статистика загружается...</p>
                                )}
                                
                                {renderLastFiveMatches()}
                            </section>
                            
                            {/* Статистика CS2 */}
                            {user.steam_url && (
                                <section className="cs2-stats-section">
                                    <h3>Статистика CS2</h3>
                                    <div className="rank-container">
                                        {renderRankGroups()}
                                    </div>
                                    {premierRank > 0 && (
                                        <button 
                                            className="update-stats-button" 
                                            onClick={() => fetchCs2Stats()}
                                            disabled={isLoadingCs2Stats}
                                        >
                                            {isLoadingCs2Stats ? 'Загрузка...' : 'Обновить статистику CS2'}
                                        </button>
                                    )}
                                    {cs2Stats && (
                                        <div className="cs2-detailed-stats">
                                            {/* Дополнительная статистика CS2, если доступна */}
                                        </div>
                                    )}
                                </section>
                            )}
                            
                            {/* Статистика FACEIT */}
                            {faceitInfo && faceitInfo.elo > 0 && (
                                <section className="faceit-stats-section">
                                    <h3>Статистика FACEIT{faceitInfo.statsFrom === 'csgo' ? ' (CS:GO)' : ''}</h3>
                                    <div className="faceit-elo">
                                        <p><strong>ELO:</strong> {faceitInfo.elo}</p>
                                        <p><strong>Уровень:</strong> {faceitInfo.level}</p>
                                    </div>
                                    {faceitInfo.stats && (
                                        <div className="faceit-detailed-stats">
                                            <p><strong>Матчи:</strong> {faceitInfo.stats.Matches || 0}</p>
                                            <p><strong>Винрейт:</strong> {faceitInfo.stats['Win Rate %'] || '0'}%</p>
                                            <p><strong>K/D:</strong> {faceitInfo.stats['Average K/D Ratio'] || '0'}</p>
                                            <p><strong>HS %:</strong> {faceitInfo.stats['Average Headshots %'] || '0'}%</p>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    )}
                    
                    {/* Вкладка друзей */}
                    {activeTab === 'friends' && (
                        <div className="friends-tab">
                            {/* Секция друзей */}
                            <section className="friends-section">
                                <h3>Друзья</h3>
                                {loadingFriends ? (
                                    <p>Загрузка списка друзей...</p>
                                ) : (
                                    <>
                                        <div className="friends-list">
                                            {friends.length > 0 ? (
                                                friends.map(friend => renderFriendItem(friend))
                                            ) : (
                                                <p>У вас пока нет друзей</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </section>

                            {/* Секция заявок в друзья */}
                            {friendRequests.length > 0 && (
                                <section className="friend-requests-section">
                                    <h3>Заявки в друзья</h3>
                                    <div className="friend-requests">
                                        {friendRequests.map(request => (
                                            <div key={request.id} className="friend-request-item">
                                                <div className="request-user">
                                                    <img 
                                                        src={request.user.avatar_url || '/default-avatar.png'} 
                                                        alt={request.user.username} 
                                                        className="request-avatar" 
                                                    />
                                                    <a href={`/user/${request.user.id}`} className="request-username">
                                                        {request.user.username}
                                                    </a>
                                                </div>
                                                <div className="request-actions">
                                                    <button 
                                                        className="accept-request-btn" 
                                                        onClick={() => acceptFriendRequest(request.id)}
                                                    >
                                                        Принять
                                                    </button>
                                                    <button 
                                                        className="reject-request-btn" 
                                                        onClick={() => rejectFriendRequest(request.id)}
                                                    >
                                                        Отклонить
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Модальные окна и прочее остаются как есть */}
            {/* ... existing modals ... */}
            
            {/* Модальное окно с полной историей матчей */}
            {showMatchHistoryModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeMatchHistoryModal}>
                    <div className="modal-content match-history-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>История матчей</h3>
                        
                        {loadingMatchHistory ? (
                            <p>Загрузка истории матчей...</p>
                        ) : (
                            <div className="full-match-history">
                                {matchHistory.length > 0 ? (
                                    <table className="match-history-table">
                                        <thead>
                                            <tr>
                                                <th>Дата</th>
                                                <th>Турнир</th>
                                                <th>Соперник</th>
                                                <th>Счет</th>
                                                <th>Результат</th>
                                                <th>Дисциплина</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matchHistory.map((match, index) => (
                                                <tr key={index} className={match.result === 'win' ? 'win' : 'loss'}>
                                                    <td>{new Date(match.date).toLocaleDateString()}</td>
                                                    <td>
                                                        <a href={`/tournament/${match.tournament_id}`}>
                                                            {match.tournament_name}
                                                        </a>
                                                    </td>
                                                    <td>{match.opponent}</td>
                                                    <td>{match.score}</td>
                                                    <td>
                                                        {match.result === 'win' ? 'Победа' : 'Поражение'}
                                                    </td>
                                                    <td>{match.discipline}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p>История матчей отсутствует</p>
                                )}
                            </div>
                        )}
                        
                        <button onClick={closeMatchHistoryModal} className="close-modal-btn">
                            Закрыть
                        </button>
                    </div>
                </div>
            )}
            
            {/* Модальное окно для добавления email */}
            {showAddEmailModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeAddEmailModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Привязка email</h3>
                        <p>Пожалуйста, введите ваш email:</p>
                        
                        <input 
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="example@example.com"
                            className="email-input"
                            autoFocus
                        />
                        
                        {addEmailError && (
                            <div className="verification-error">
                                {addEmailError}
                            </div>
                        )}
                        
                        <div className="modal-buttons">
                            <button onClick={saveEmail}>Сохранить</button>
                            <button onClick={closeAddEmailModal}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Обновленное модальное окно подтверждения email */}
            {showEmailVerificationModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeEmailVerificationModal}>
                    <div className="modal-content email-verification-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Подтверждение email</h3>
                        <p>На вашу почту {user.email} был отправлен 6-значный код. Введите его ниже:</p>
                        
                        <div className="code-input-container" onClick={handleCodeContainerClick}>
                            <input 
                                id="hidden-code-input"
                                className="code-input-hidden"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={verificationCode}
                                onChange={handleCodeChange}
                                onPaste={handleCodePaste}
                                autoFocus
                            />
                            <div className="code-display">
                                {[0, 1, 2, 3, 4, 5].map((index) => (
                                    <div 
                                        key={index} 
                                        className={`code-digit ${verificationCode[index] ? 'filled' : ''} ${index === verificationCode.length ? 'active' : ''}`}
                                    >
                                        {verificationCode[index] || ''}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {verificationError && (
                            <div className="verification-error">
                                {verificationError}
                            </div>
                        )}
                        
                        <div className="modal-buttons">
                            <button 
                                onClick={sendVerificationCode} 
                                disabled={isResendDisabled}
                            >
                                {localStorage.getItem('verification_code_sent') === 'true' ? 'Отправить повторно' : 'Отправить код'}
                                {isResendDisabled && (
                                    <span className="resend-countdown">
                                        {Math.floor(resendCountdown / 60)}:{(resendCountdown % 60).toString().padStart(2, '0')}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно для установки никнейма Steam */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <p>Твой никнейм в Steam "{steamNickname}", устанавливаем в качестве основного на профиль?</p>
                        <button onClick={confirmSteamNickname}>Да</button>
                        <button onClick={closeModal}>Нет</button>
                    </div>
                </div>
            )}

            {/* Модальное окно с требованием привязать почту */}
            {showEmailRequiredModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeEmailRequiredModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Необходима привязка email</h3>
                        <p>Для отвязки аккаунтов Steam или FACEIT необходимо сначала привязать электронную почту.</p>
                        <p>Это требуется для того, чтобы у вас сохранялся доступ к аккаунту.</p>
                        
                        <div className="modal-buttons">
                            <button onClick={() => {
                                closeEmailRequiredModal();
                                setTimeout(() => openAddEmailModal(), 350);
                            }}>Привязать email</button>
                            <button onClick={closeEmailRequiredModal}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно выбора аватара */}
            {showAvatarModal && (
                <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeAvatarModal}>
                    <div className="modal-content avatar-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Изменить аватар</h3>
                        
                        <div className="avatar-preview">
                            <img 
                                src={avatar || '/default-avatar.png'} 
                                alt="Текущий аватар" 
                                className="current-avatar"
                            />
                        </div>
                        
                        <div className="avatar-options">
                            <button 
                                onClick={triggerFileInput} 
                                disabled={uploadingAvatar}
                            >
                                {uploadingAvatar ? 'Загрузка...' : 'Загрузить свой аватар'}
                            </button>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleAvatarUpload} 
                                accept="image/*" 
                                style={{ display: 'none' }} 
                            />
                            
                            {user.steam_id && (
                                <button onClick={setAvatarFromSteam}>
                                    Установить аватар из Steam
                                </button>
                            )}
                            
                            {user.faceit_id && (
                                <button onClick={setAvatarFromFaceit}>
                                    Установить аватар из FACEIT
                                </button>
                            )}
                        </div>
                        
                        <button onClick={closeAvatarModal} className="close-modal-btn">
                            Закрыть
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;