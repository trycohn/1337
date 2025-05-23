import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import api from '../axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment, faEnvelope } from '@fortawesome/free-regular-svg-icons';
import './Home.css';
import './Layout.css';
import Loader from './Loader';
import { useLoader } from '../context/LoaderContext';
import { io } from 'socket.io-client';
import { decodeTokenPayload, ensureHttps } from '../utils/userHelpers';

function Layout() {
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef(null);
    const wsRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { loading, setLoading } = useLoader();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    const fetchUser = async (token) => {
        setLoading(true);
        try {
            const response = await api.get('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUser(response.data);
            
            // Создаем соединение Socket.IO для уведомлений
            const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', { query: { token } });
            socket.on('connect', () => {
                console.log('Socket.IO соединение установлено');
            });
            socket.on('notification', (notification) => {
                console.log('Получено новое уведомление:', notification);
                if (['admin_request_accepted', 'admin_request_rejected'].includes(notification.type)) {
                    api.get(`/api/notifications?userId=${response.data.id}&includeProcessed=false`)
                       .then(res => setNotifications(res.data))
                       .catch(err => console.error('Ошибка получения уведомлений:', err));
                } else {
                    setNotifications((prev) => [notification, ...prev]);
                }
            });
            socket.on('disconnect', (reason) => {
                console.log('Socket.IO соединение закрыто:', reason);
            });
            // Сохраняем ссылку на Socket.IO клиент
            wsRef.current = socket;
            
            // Получаем существующие уведомления (без обработанных запросов)
            const notificationsResponse = await api.get(`/api/notifications?userId=${response.data.id}&includeProcessed=false`);
            setNotifications(notificationsResponse.data);
            
        } catch (error) {
            console.error('❌ Ошибка получения данных пользователя:', error.response ? error.response.data : error.message);
            localStorage.removeItem('token');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };
    
    // Закрываем Socket.IO соединение при размонтировании компонента
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.disconnect();
            }
        };
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && !user) {
            fetchUser(token);
        } else {
            setLoading(false);
        }
        const urlParams = new URLSearchParams(window.location.search);
        const steamToken = urlParams.get('token');
        if (steamToken) {
            localStorage.setItem('token', steamToken);
            fetchUser(steamToken);
            navigate('/profile', { replace: true });
        }
    }, [navigate, user, setLoading]);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setLoading(false);
        }, 800);
        return () => clearTimeout(timer);
    }, [location.pathname, setLoading]);

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

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/');
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const toggleNotifications = async () => {
        const token = localStorage.getItem('token');
        if (!showNotifications && token && user) {
            try {
                // Получаем текущие уведомления
                const response = await api.get(`/api/notifications?userId=${user.id}&includeProcessed=true`);
                const notifications = response.data;
                
                // Фильтруем уведомления, которые не требуют действий
                const notificationsToMarkAsRead = notifications.filter(n => 
                    n.type !== 'tournament_invite' && 
                    n.type !== 'admin_request' && 
                    n.type !== 'friend_request'
                );
                
                // Помечаем как прочитанные только уведомления, не требующие действий
                if (notificationsToMarkAsRead.length > 0) {
                    await api.post(
                        `/api/notifications/mark-read?userId=${user.id}`,
                        { notificationIds: notificationsToMarkAsRead.map(n => n.id) },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    
                    // Обновляем локальное состояние
                    setNotifications(prev => 
                        prev.map(n => 
                            notificationsToMarkAsRead.some(ntr => ntr.id === n.id) 
                                ? { ...n, is_read: true }
                                : n
                        )
                    );
                }
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
                `/api/notifications/mark-read?userId=${user.id}&notificationId=${notification.id}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Получаем обновленный список уведомлений с сервера для обоих типов
            const notificationsForDropdown = await api.get(`/api/notifications?userId=${user.id}&includeProcessed=false`);
            setNotifications(notificationsForDropdown.data);
            
            // Дополнительно вызываем событие, имитирующее Socket.IO для обновления всех компонентов
            if (wsRef.current && wsRef.current.connected) {
                const notificationMessage = {
                    type: 'notification',
                    data: {
                        type: action === 'accept' ? 'admin_request_accepted' : 'admin_request_rejected',
                        tournament_id: notification.tournament_id
                    }
                };
                // Имитируем получение сообщения от сервера
                wsRef.current.emit('notification', notificationMessage);
            }
            
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

    // Отслеживаем изменение размера окна
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="home-container">
            {loading && <Loader />}
            {!(isMobile && location.pathname === '/messages') && (
                <header className="header">
                    <div className="nav-container">
                        <button className="hamburger" onClick={toggleMenu}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H21V8H3V6Z" fill="#ffffff"/>
                                <path d="M3 11H21V13H3V11Z" fill="#ffffff"/>
                                <path d="M3 16H21V18H3V16Z" fill="#ffffff"/>
                            </svg>
                        </button>
                        <nav className={`navigation ${isMenuOpen ? 'open' : ''}`}>
                            <Link to="/" onClick={() => setIsMenuOpen(false)}>Главная</Link>
                            <Link to="/tournaments" onClick={() => setIsMenuOpen(false)}>Турниры</Link>
                            {user && (
                                <>
                                    <Link to="/create" onClick={() => setIsMenuOpen(false)}>
                                        Создать турнир
                                    </Link>
                                    <Link to="/profile" onClick={() => setIsMenuOpen(false)}>Мой профиль</Link>
                                    <Link to="/messages" onClick={() => setIsMenuOpen(false)}>Чаты</Link>
                                </>
                            )}
                        </nav>
                    </div>
                    <div className="auth-block">
                        {user ? (
                            <div className="user-info">
                                <Link to="/profile" className="header-avatar-link">
                                    <img
                                        src={ensureHttps(user.avatar_url) || '/default-avatar.png'}
                                        alt={user.username || 'User'}
                                        className="profile-avatar"
                                    />
                                </Link>
                                <Link to="/profile" className="username-link">
                                    {user.username}
                                </Link>
                                <div className="notifications">
                                    <div className="bell-container" onClick={toggleNotifications}>
                                        <FontAwesomeIcon
                                            icon={faComment}
                                            className="bell-icon"
                                            style={{ color: '#FFFFFF' }}
                                        />
                                        {unreadCount > 0 && <span className="unread-count">{unreadCount}</span>}
                                    </div>
                                    <Link to="/messages" className="messages-link">
                                        <FontAwesomeIcon
                                            icon={faEnvelope}
                                            className="messages-icon"
                                            style={{ color: '#FFFFFF' }}
                                        />
                                    </Link>
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
                                                                    ) : notification.type === 'admin_request_accepted' && notification.tournament_id ? (
                                                                        <>
                                                                            {notification.message} - {new Date(notification.created_at).toLocaleString('ru-RU')}
                                                                            <div className="admin-request-status">
                                                                                <span className="status-accepted">Запрос принят</span>
                                                                            </div>
                                                                        </>
                                                                    ) : notification.type === 'admin_request_rejected' && notification.tournament_id ? (
                                                                        <>
                                                                            {notification.message} - {new Date(notification.created_at).toLocaleString('ru-RU')}
                                                                            <div className="admin-request-status">
                                                                                <span className="status-rejected">Запрос отклонен</span>
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
                            <div className="login-button-container">
                                <Link to="/auth" className="login-button">Войти</Link>
                            </div>
                        )}
                    </div>
                </header>
            )}

            <main className={isMobile && location.pathname === '/messages' ? 'messenger-page' : ''}>
                <Outlet />
            </main>
        </div>
    );
}

export default Layout;