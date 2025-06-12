import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import api from '../axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope } from '@fortawesome/free-regular-svg-icons';
import './Home.css';
import './Layout.css';
import Loader from './Loader';
import { useLoader } from '../context/LoaderContext';
import { useAuth } from '../context/AuthContext';
import { ensureHttps } from '../utils/userHelpers';
import { useSocket } from '../hooks/useSocket';

function Layout() {
    const { user, logout } = useAuth(); // Получаем пользователя из AuthContext
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
            if (!token) {
                console.log('📊 [Layout] Нет токена для получения счетчика');
                return;
            }
            
            console.log('📊 [Layout] Запрашиваем счетчик непрочитанных сообщений...');
            const response = await api.get('/api/chats/unread-count', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const count = response.data.unread_count || 0;
            console.log('📊 [Layout] Получен счетчик из API:', count);
            setUnreadCount(count);
        } catch (error) {
            console.error('❌ [Layout] Ошибка получения количества непрочитанных сообщений:', error);
        }
    };

    // Загрузка счетчика при готовности пользователя
    useEffect(() => {
        if (user) {
            console.log('📊 [Layout] Пользователь загружен, получаем счетчик сообщений');
            fetchUnreadCount();
        }
    }, [user]);

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
                console.log('📬 [Layout] Получено новое сообщение:', message);
                console.log('📬 [Layout] Sender ID:', message.sender_id, 'Current user ID:', user.id);
                
                // Увеличиваем счетчик только если сообщение не от текущего пользователя
                if (message.sender_id !== user.id) {
                    console.log('📬 [Layout] Увеличиваем счетчик непрочитанных сообщений');
                    setUnreadCount(prev => {
                        const newCount = prev + 1;
                        console.log('📬 [Layout] Новый счетчик:', newCount);
                        return newCount;
                    });
                } else {
                    console.log('📬 [Layout] Не увеличиваем счетчик (собственное сообщение)');
                }
            };

            const handleReadStatus = () => {
                console.log('📬 [Layout] Получено событие read_status, обновляем счетчик');
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

    // Обновляем счетчик при каждом переходе между страницами
    useEffect(() => {
        if (user) {
            console.log('📊 [Layout] Переход на страницу:', location.pathname);
            fetchUnreadCount();
        }
    }, [location.pathname, user]);

    // Обновляем счетчик при получении фокуса окна
    useEffect(() => {
        if (!user) return;

        const handleFocus = () => {
            console.log('📊 [Layout] Окно получило фокус, обновляем счетчик');
            fetchUnreadCount();
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('📊 [Layout] Страница стала видимой, обновляем счетчик');
                fetchUnreadCount();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user]);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setLoading(false);
        }, 800);
        return () => clearTimeout(timer);
    }, [location.pathname, setLoading]);

    const handleLogout = () => {
        logout(); // Используем logout из AuthContext
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