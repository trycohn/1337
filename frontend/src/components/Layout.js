import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import api from '../axios';
import io from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment } from '@fortawesome/free-regular-svg-icons';
import CreateTournament from './CreateTournament';
import './Home.css';

function Layout() {
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef(null);
    const navigate = useNavigate();

    const fetchUser = async (token) => {
        try {
            const response = await api.get('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUser(response.data);
            const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000');
            socket.emit('register', response.data.id);
            socket.on('notification', (notification) => {
                setNotifications((prev) => [notification, ...prev]);
            });
            const notificationsResponse = await api.get(`/api/notifications?userId=${response.data.id}`);
            setNotifications(notificationsResponse.data);
            return () => socket.disconnect();
        } catch (error) {
            console.error('❌ Ошибка получения данных пользователя:', error.response ? error.response.data : error.message);
            localStorage.removeItem('token');
            setUser(null);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && !user) {
            fetchUser(token);
        }
        const urlParams = new URLSearchParams(window.location.search);
        const steamToken = urlParams.get('token');
        if (steamToken) {
            localStorage.setItem('token', steamToken);
            fetchUser(steamToken);
            navigate('/profile', { replace: true });
        }
    }, [navigate, user]);

    useEffect(() => {
        if (showNotifications && notifications.length === 0) {
            const timer = setTimeout(() => {
                setShowNotifications(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [showNotifications, notifications]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showNotifications && notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showNotifications]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/api/users/login', {
                email,
                password,
            });
            localStorage.setItem('token', response.data.token);
            setError(null);
            await fetchUser(response.data.token);
            setEmail('');
            setPassword('');
        } catch (error) {
            setError(error.response?.data?.message || 'Ошибка входа');
            console.error('❌ Ошибка входа:', error.response ? error.response.data : error.message);
        }
    };

    const handleSteamLogin = () => {
        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
        window.location.href = `${baseUrl}/api/users/steam`; // Убраны лишние слэши
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/');
    };

    const handleTournamentCreated = (newTournament) => {
        setShowCreateForm(false);
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const toggleNotifications = async () => {
        const token = localStorage.getItem('token');
        if (!showNotifications && token && user) {
            try {
                await api.post(
                    `/api/notifications/mark-read?userId=${user.id}`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setNotifications((prev) =>
                    prev.map((n) => (n.type !== 'admin_request' ? { ...n, is_read: true } : n))
                );
            } catch (error) {
                console.error('❌ Ошибка отметки уведомлений:', error.response ? error.response.data : error.message);
            }
        }
        setShowNotifications(!showNotifications);
    };

    const handleRespondAdminRequest = async (notification, action) => {
        const token = localStorage.getItem('token');
        try {
            const response = await api.post(
                `/api/tournaments/${notification.tournament_id}/respond-admin-request`,
                { requesterId: notification.requester_id, action },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await api.post(
                `/api/notifications/mark-read?userId=${user.id}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNotifications((prev) =>
                prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)).filter((n) => n.id !== notification.id)
            );
            alert(response.data.message);
        } catch (error) {
            alert(error.response?.data?.error || 'Ошибка при обработке запроса');
        }
    };

    const unreadCount = notifications.filter((n) => !n.is_read).length;
    const getNotificationLimit = () => {
        const width = window.innerWidth;
        if (width <= 600) return 3;
        if (width <= 900) return 6;
        return 10;
    };
    const visibleNotifications = notifications.slice(0, getNotificationLimit());

    return (
        <div className="home-container">
            <header className="header">
                <div className="nav-container">
                    <button className="hamburger" onClick={toggleMenu}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 6H21V8H3V6Z" fill="#007bff"/>
                            <path d="M3 11H21V13H3V11Z" fill="#007bff"/>
                            <path d="M3 16H21V18H3V16Z" fill="#007bff"/>
                        </svg>
                    </button>
                    <nav className={`navigation ${isMenuOpen ? 'open' : ''}`}>
                        <Link to="/" onClick={() => setIsMenuOpen(false)}>Главная</Link>
                        <Link to="/tournaments" onClick={() => setIsMenuOpen(false)}>Турниры</Link>
                        {user && (
                            <>
                                <button onClick={() => { setShowCreateForm(!showCreateForm); setIsMenuOpen(false); }}>
                                    Создать турнир
                                </button>
                                <Link to="/profile" onClick={() => setIsMenuOpen(false)}>Мой профиль</Link>
                            </>
                        )}
                        {!user && (
                            <Link to="/register" onClick={() => setIsMenuOpen(false)}>Регистрация</Link>
                        )}
                    </nav>
                </div>
                <div className="auth-block">
                    {user ? (
                        <div className="user-info">
                            <Link to="/profile" className="username-link">
                                Привет, {user.username}!
                            </Link>
                            <div className="notifications">
                                <div className="bell-container" onClick={toggleNotifications}>
                                    <FontAwesomeIcon
                                        icon={faComment}
                                        className="bell-icon"
                                        style={{ color: '#000000' }}
                                    />
                                    {unreadCount > 0 && <span className="unread-count">{unreadCount}</span>}
                                </div>
                                {showNotifications && (
                                    <div className="notification-dropdown-wrapper" ref={notificationRef}>
                                        <div className="notification-dropdown">
                                            {visibleNotifications.length > 0 ? (
                                                visibleNotifications.map((notification) => (
                                                    <div
                                                        key={notification.id}
                                                        className={`notification-item ${notification.is_read ? '' : 'unread'}`}
                                                    >
                                                        {notification.message ? (
                                                            <>
                                                                {notification.type === 'admin_request' && notification.tournament_id && notification.requester_id ? (
                                                                    <>
                                                                        {notification.message.split(' для турнира ')[0]} для турнира{' '}
                                                                        <Link to={`/tournaments/${notification.tournament_id}`}>
                                                                            "{notification.message.split(' для турнира ')[1]?.split('"')[1] || 'турнир'}"
                                                                        </Link>{' '}
                                                                        - {new Date(notification.created_at).toLocaleString('ru-RU')}
                                                                        <div className="admin-request-actions">
                                                                            <button onClick={() => handleRespondAdminRequest(notification, 'accept')}>
                                                                                Принять
                                                                            </button>
                                                                            <button onClick={() => handleRespondAdminRequest(notification, 'reject')}>
                                                                                Отклонить
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                ) : notification.tournament_id ? (
                                                                    <>
                                                                        {notification.message.split(' турнира ')[0]} турнира{' '}
                                                                        <Link to={`/tournaments/${notification.tournament_id}`}>
                                                                            "{notification.message.split(' турнира ')[1]?.split('"')[1] || 'турнир'}"
                                                                        </Link>{' '}
                                                                        - {new Date(notification.created_at).toLocaleString('ru-RU')}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {notification.message} - {new Date(notification.created_at).toLocaleString('ru-RU')}
                                                                    </>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>Неизвестное уведомление - {new Date(notification.created_at).toLocaleString('ru-RU')}</>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="no-notifications">Уведомлений пока нет</div>
                                            )}
                                        </div>
                                        <div className="notification-footer">
                                            <Link to="/notifications" className="show-all" onClick={() => setShowNotifications(false)}>
                                                Показать все
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button onClick={handleLogout}>Выйти</button>
                        </div>
                    ) : (
                        <form className="login-form" onSubmit={handleLogin}>
                            <input
                                type="email"
                                placeholder="Электронная почта"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Пароль"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button type="submit">Войти</button>
                            <button type="button" onClick={handleSteamLogin}>Войти через Steam</button>
                            {error && <span className="error">{error}</span>}
                        </form>
                    )}
                </div>
            </header>

            <main>
                {showCreateForm ? (
                    <CreateTournament onTournamentCreated={handleTournamentCreated} />
                ) : (
                    <Outlet />
                )}
            </main>
        </div>
    );
}

export default Layout;