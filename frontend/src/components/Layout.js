import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import api from '../axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope } from '@fortawesome/free-regular-svg-icons';
import './Home.css';
import './Layout.css';
import Loader from './Loader';
import { useLoader } from '../context/LoaderContext';
import { ensureHttps } from '../utils/userHelpers';
import { useSocket } from '../hooks/useSocket';

function Layout() {
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const { loading, setLoading } = useLoader();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);


    // Функция для получения количества непрочитанных сообщений
    const fetchUnreadCount = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const response = await api.get('/api/chats/unread-count', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setUnreadCount(response.data.unread_count || 0);
        } catch (error) {
            console.error('Ошибка получения количества непрочитанных сообщений:', error);
        }
    };

    const fetchUser = async (token) => {
        setLoading(true);
        try {
            const response = await api.get('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUser(response.data);
            
            // После получения пользователя, получаем количество непрочитанных сообщений
            await fetchUnreadCount();
        } catch (error) {
            console.error('❌ Ошибка получения данных пользователя:', error.response ? error.response.data : error.message);
            localStorage.removeItem('token');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

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

    // 🚀 Socket.IO подключение с новым hook
    const socket = useSocket();

    // Подключение к Socket.IO при наличии пользователя (только один раз)
    useEffect(() => {
        if (!user) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        console.log('🚀 [Layout] Подключение к Socket.IO...');
        
        // Подключаемся с авторизацией
        const connected = socket.connect(token);
        
        if (connected) {
            // Обработчики событий
            const handleNewMessage = (message) => {
                // Увеличиваем счетчик только если сообщение не от текущего пользователя
                // и мы не находимся в чатах
                if (message.sender_id !== user.id && location.pathname !== '/messages') {
                    setUnreadCount(prev => prev + 1);
                }
            };

            const handleReadStatus = () => {
                fetchUnreadCount();
            };

            // Подписываемся на события сообщений
            socket.on('new_message', handleNewMessage);
            socket.on('read_status', handleReadStatus);

            // Cleanup
            return () => {
                console.log('🧹 [Layout] Отписываемся от Socket.IO событий');
                socket.off('new_message', handleNewMessage);
                socket.off('read_status', handleReadStatus);
            };
        }
    }, [user?.id]); // Только user.id в зависимостях

    // Обновляем счетчик при переходе на страницу чатов
    useEffect(() => {
        if (location.pathname === '/messages' && user) {
            // Небольшая задержка для обновления счетчика после посещения чатов
            const timer = setTimeout(() => {
                fetchUnreadCount();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [location.pathname, user]);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setLoading(false);
        }, 800);
        return () => clearTimeout(timer);
    }, [location.pathname, setLoading]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/');
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

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
                                    {user.role === 'admin' && (
                                        <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="admin-link">
                                            Админ панель
                                        </Link>
                                    )}
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
                                <Link to="/messages" className="messages-link">
                                    <div className="messages-icon-container">
                                        <FontAwesomeIcon
                                            icon={faEnvelope}
                                            className="messages-icon"
                                            style={{ color: '#FFFFFF' }}
                                        />
                                        {unreadCount > 0 && (
                                            <span className="unread-badge">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </Link>
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