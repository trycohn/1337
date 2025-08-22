import { useState, useEffect, useCallback, useRef } from 'react';
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
import MatchLobbyNotification from './tournament/MatchLobby/MatchLobbyNotification';

function Layout() {
    const { user, logout } = useAuth(); // Получаем пользователя из AuthContext
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const { loading, setLoading } = useLoader();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [prevPathname, setPrevPathname] = useState(location.pathname);

    // Ref для защиты от частых запросов
    const lastFetchTime = useRef(0);
    const FETCH_COOLDOWN = 1000; // 1 секунда между запросами

    // Создаем стабильную ссылку на функцию
    const fetchUnreadCountRef = useRef();

    // Функция для получения количества непрочитанных сообщений с защитой от частых запросов
    const fetchUnreadCount = useCallback(async () => {
        const now = Date.now();
        if (now - lastFetchTime.current < FETCH_COOLDOWN) {
            console.log('📊 [Layout] Пропускаем запрос - слишком частый вызов');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('📊 [Layout] Нет токена для получения счетчика');
                return;
            }
            
            lastFetchTime.current = now;
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
    }, []);

    // Обновляем ref при изменении функции
    useEffect(() => {
        fetchUnreadCountRef.current = fetchUnreadCount;
    }, [fetchUnreadCount]);

    // Функция для пометки всех сообщений как увиденных
    const markAllMessagesSeen = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            console.log('👁️ [Layout] Помечаем все сообщения как увиденные...');
            await api.post('/api/chats/mark-all-seen', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log('✅ [Layout] Все сообщения помечены как увиденные');
            setUnreadCount(0);
        } catch (error) {
            console.error('❌ [Layout] Ошибка пометки сообщений как увиденных:', error);
        }
    }, []);

    // Загрузка счетчика при готовности пользователя (только один раз при загрузке)
    useEffect(() => {
        if (user && fetchUnreadCountRef.current) {
            console.log('📊 [Layout] Пользователь загружен, получаем счетчик сообщений');
            fetchUnreadCountRef.current();
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
                // Используем стабильную ссылку на функцию
                if (fetchUnreadCountRef.current) {
                    setTimeout(() => fetchUnreadCountRef.current(), 100);
                }
            };

            const handleMessagesRead = (data) => {
                console.log('📖 [Layout] Получено событие messages_read для чата:', data.chat_id);
                // Используем стабильную ссылку на функцию
                if (fetchUnreadCountRef.current) {
                    setTimeout(() => fetchUnreadCountRef.current(), 100);
                }
            };

            // Подписываемся на события сообщений
            socket.on('new_message', handleNewMessage);
            socket.on('read_status', handleReadStatus);
            socket.on('messages_read', handleMessagesRead);

            // Cleanup
            return () => {
                console.log('🧹 [Layout] Отписываемся от Socket.IO событий');
                socket.off('new_message', handleNewMessage);
                socket.off('read_status', handleReadStatus);
                socket.off('messages_read', handleMessagesRead);
            };
        }
    }, [socket, user]);

    // Обновляем счетчик при каждом переходе между страницами
    useEffect(() => {
        if (user && prevPathname !== location.pathname) {
            console.log('📊 [Layout] Переход на страницу:', location.pathname, 'с предыдущей:', prevPathname);
            
            // Если переходим на страницу чатов, помечаем все сообщения как увиденные
            if (location.pathname === '/messages') {
                console.log('📊 [Layout] Переход на страницу чатов, помечаем все как увиденные');
                markAllMessagesSeen();
            } else if (prevPathname === '/messages' && fetchUnreadCountRef.current) {
                // Если уходим со страницы чатов, обновляем счетчик
                console.log('📊 [Layout] Уход со страницы чатов, обновляем счетчик');
                setTimeout(() => fetchUnreadCountRef.current(), 500);
            }
            
            // Сохраняем текущий путь как предыдущий для следующего раза
            setPrevPathname(location.pathname);
        }
    }, [location.pathname, user, prevPathname, markAllMessagesSeen]);

    // Обновляем счетчик при получении фокуса окна (с ограничением частоты)
    useEffect(() => {
        if (!user) return;

        let focusTimeout;

        const handleFocus = () => {
            console.log('📊 [Layout] Окно получило фокус, обновляем счетчик');
            clearTimeout(focusTimeout);
            if (fetchUnreadCountRef.current) {
                focusTimeout = setTimeout(() => fetchUnreadCountRef.current(), 1000); // Задержка 1 секунда
            }
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('📊 [Layout] Страница стала видимой, обновляем счетчик');
                clearTimeout(focusTimeout);
                if (fetchUnreadCountRef.current) {
                    focusTimeout = setTimeout(() => fetchUnreadCountRef.current(), 1000); // Задержка 1 секунда
                }
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearTimeout(focusTimeout);
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

    // Обработчик клика на иконку сообщений
    const handleMessagesIconClick = () => {
        console.log('📊 [Layout] Клик на иконку сообщений, помечаем все сообщения как увиденные');
        markAllMessagesSeen();
    };

    // Закрытие меню при клике вне его области и нажатии Escape
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isMenuOpen && !event.target.closest('.navigation') && !event.target.closest('.hamburger')) {
                setIsMenuOpen(false);
            }
        };

        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && isMenuOpen) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscapeKey);
            // Предотвращаем прокрутку фона при открытом меню
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscapeKey);
            document.body.style.overflow = 'unset';
        };
    }, [isMenuOpen]);

    return (
        <div className="home-container">
            {loading && <Loader />}
            <header className="header">
                    <div className="nav-container">
                        <Link to="/" className="site-logo">
                            <h1>1337</h1>
                        </Link>
                        <button className="hamburger" onClick={toggleMenu}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H21V8H3V6Z" fill="#ffffff"/>
                                <path d="M3 11H21V13H3V11Z" fill="#ffffff"/>
                                <path d="M3 16H21V18H3V16Z" fill="#ffffff"/>
                            </svg>
                        </button>
                        <nav 
                            className={`navigation ${isMenuOpen ? 'open' : ''}`}
                            onClick={(e) => {
                                // Закрываем меню при клике по фону (не по ссылкам)
                                if (e.target === e.currentTarget) {
                                    setIsMenuOpen(false);
                                }
                            }}
                        >
                            <Link to="/" className="nav-link btn-ghost" onClick={() => setIsMenuOpen(false)}>Главная</Link>
                            <Link to="/tournaments" className="nav-link btn-ghost" onClick={() => setIsMenuOpen(false)}>Турниры</Link>
                            {user && (
                                <>
                                    <Link to="/messages" className="nav-link btn-ghost" onClick={() => setIsMenuOpen(false)}>Чаты</Link>
                                    <Link to="/profile" className="nav-link btn-ghost" onClick={() => setIsMenuOpen(false)}>Мой профиль</Link>
                                    {user.role === 'admin' && (
                                        <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="nav-link admin-link">
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
                                <Link to="/create" className="btn btn-primary create-btn">
                                    Создать турнир
                                </Link>
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
                                <Link to="/messages" className="messages-link" onClick={handleMessagesIconClick}>
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
                                <button className="btn btn-secondary" onClick={handleLogout}>Выйти</button>
                            </div>
                        ) : (
                            <div className="login-button-container">
                                <Link to="/auth" className="login-button">Войти</Link>
                            </div>
                        )}
                    </div>
                </header>

            {(() => {
                const isMessengerPage = isMobile && location.pathname === '/messages';
                const isBracketSharePage = /^\/tournaments\/[^/]+\/bracket$/.test(location.pathname);
                const mainClass = [
                    isMessengerPage ? 'messenger-page' : '',
                    isBracketSharePage ? 'fullwidth-page' : ''
                ].filter(Boolean).join(' ');
                return (
                    <main className={mainClass}>
                        <Outlet />
                    </main>
                );
            })()}
            {/* Компонент уведомления о лобби матча */}
            {user && socket && <MatchLobbyNotification socket={socket} user={user} />}
        </div>
    );
}

export default Layout;