import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../axios';
import './Profile.css';
import MobileProfileSheet from './MobileProfileSheet';
import './MobileProfileSheet.css';
import { redirectIfCurrentUser, isCurrentUser, decodeTokenPayload, ensureHttps } from '../utils/userHelpers';

function UserProfile() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [friendStatus, setFriendStatus] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('main');
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [badgeCount, setBadgeCount] = useState(0);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Свайп-открытие листа профиля как в чатах
    useEffect(() => {
        if (!isMobile) return;
        let startX = null;
        let startY = null;
        const threshold = 45;
        function onTouchStart(e) {
            if (e.touches[0].clientX < 20) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            } else {
                startX = null; startY = null;
            }
        }
        function onTouchEnd(e) {
            if (startX == null) return;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = Math.abs(e.changedTouches[0].clientY - startY);
            if (dx > threshold && dy < 60) setSheetOpen(true);
            startX = null; startY = null;
        }
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchend', onTouchEnd);
        };
    }, [isMobile]);

    // Бэйдж на кнопке (например, уведомления)
    useEffect(() => {
        if (!user) { setBadgeCount(0); return; }
        const candidates = [
            user.notifications_unread,
            user.unread_notifications,
            user.unread_count,
            user.alerts_unread
        ].filter(v => typeof v === 'number' && v > 0);
        const sum = candidates.length ? candidates.reduce((a,b)=>a+b,0) : 0;
        setBadgeCount(sum);
    }, [user]);

    useEffect(() => {
        // Перенаправляем на личный кабинет, если ID совпадает с текущим пользователем
        if (redirectIfCurrentUser(userId, navigate)) {
            return;
        }

        const fetchUserProfile = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/api/users/profile/${userId}`);
                setUser(response.data);
                setError('');
            } catch (err) {
                console.log('❌ Ошибка получения профиля:', err.response?.status, err.response?.data);
                
                // Специфичная обработка для 404 ошибки
                if (err.response?.status === 404) {
                    setError('Пользователь не найден. Возможно, этот профиль больше не существует или был удален.');
                } else if (err.response?.status >= 500) {
                    setError('Сервер временно недоступен. Попробуйте обновить страницу через несколько минут.');
                } else {
                    setError(err.response?.data?.message || 'Ошибка загрузки профиля пользователя. Попробуйте обновить страницу.');
                }
            } finally {
                setLoading(false);
            }
        };

        const fetchFriendStatus = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return; // Если пользователь не авторизован, не проверяем
                
                const response = await api.get(`/api/friends/status/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFriendStatus(response.data);
            } catch (err) {
                console.error('Ошибка получения статуса дружбы:', err);
            }
        };

        fetchUserProfile();
        fetchFriendStatus();
    }, [userId, navigate]);

    const renderRankGroups = () => {
        // Если у пользователя нет ранга Premier, показываем сообщение
        if (!user.premier_rank) {
            return <p>Нет данных о ранге Premier</p>;
        }
        
        // Если есть ранг Premier, отображаем его
        return (
            <div className="rank-row">
                <p>Premier Rank: {user.premier_rank}</p>
            </div>
        );
    };
    
    // Функция для получения класса статуса онлайн
    const getOnlineStatusClass = () => {
        if (!user.online_status) return '';
        
        if (user.online_status === 'online') {
            return 'status-online';
        } else {
            return 'status-offline';
        }
    };

    // Функция для отправки заявки в друзья
    const sendFriendRequest = async () => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Для добавления в друзья необходимо авторизоваться');
                return;
            }
            
            await api.post('/api/friends/request', { friendId: userId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем статус дружбы
            setFriendStatus({
                status: 'pending',
                direction: 'outgoing'
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отправки заявки в друзья');
        } finally {
            setActionLoading(false);
        }
    };

    // Функция для принятия заявки в друзья
    const acceptFriendRequest = async () => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/friends/accept', { requestId: friendStatus.id }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем статус дружбы
            setFriendStatus({
                ...friendStatus,
                status: 'accepted',
                direction: null
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка принятия заявки в друзья');
        } finally {
            setActionLoading(false);
        }
    };

    // Функция для отклонения заявки в друзья
    const rejectFriendRequest = async () => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/friends/reject', { requestId: friendStatus.id }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем статус дружбы
            setFriendStatus({
                status: 'none'
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отклонения заявки в друзья');
        } finally {
            setActionLoading(false);
        }
    };

    // Функция для удаления из друзей
    const removeFriend = async () => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/friends/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем статус дружбы
            setFriendStatus({
                status: 'none'
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка удаления из друзей');
        } finally {
            setActionLoading(false);
        }
    };

    // Функция для отображения кнопки действия в зависимости от статуса дружбы
    const renderFriendActionButton = () => {
        if (!friendStatus) return null;
        
        const currentUserId = decodeTokenPayload(localStorage.getItem('token'))?.id;
        if (currentUserId === userId) return null; // Не показываем кнопку на своем профиле
        
        switch (friendStatus.status) {
            case 'none':
                return (
                    <button 
                        className="add-friend-btn" 
                        onClick={sendFriendRequest}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Загрузка...' : 'Добавить в друзья'}
                    </button>
                );
            case 'pending':
                if (friendStatus.direction === 'incoming') {
                    return (
                        <div className="request-actions">
                            <button 
                                className="accept-request-btn" 
                                onClick={acceptFriendRequest}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Загрузка...' : 'Принять заявку'}
                            </button>
                            <button 
                                className="reject-request-btn" 
                                onClick={rejectFriendRequest}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Загрузка...' : 'Отклонить'}
                            </button>
                        </div>
                    );
                } else {
                    return (
                        <button 
                            className="pending-request-btn" 
                            disabled={true}
                        >
                            Заявка отправлена
                        </button>
                    );
                }
            case 'accepted':
                return (
                    <button 
                        className="remove-friend-btn" 
                        onClick={removeFriend}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Загрузка...' : 'Удалить из друзей'}
                    </button>
                );
            default:
                return null;
        }
    };

    if (loading) return <div className="profile-loading">Загрузка профиля...</div>;
    
    if (error) {
        return (
            <div className="profile-error-container">
                <div className="profile-error-content">
                    <div className="error-icon">❌</div>
                    <h2>Профиль недоступен</h2>
                    <p className="error-message">{error}</p>
                    <div className="error-actions">
                        <button 
                            className="btn-primary" 
                            onClick={() => navigate(-1)}
                        >
                            ← Назад
                        </button>
                        <button 
                            className="btn-secondary" 
                            onClick={() => window.location.reload()}
                        >
                            🔄 Обновить
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    if (!user) return <div className="profile-not-found">Пользователь не найден</div>;

    return (
        <div className="profile-container">
            <div className="profile-header">
                <div className="profile-header-content">
                    <div className="profile-avatar-section">
                        <img 
                            src={ensureHttps(user.avatar_url) || '/default-avatar.png'} 
                            alt="Аватар пользователя" 
                            className="profile-avatar avatar-glow"
                        />
                    </div>
                    <div className="profile-user-info">
                        <p className="profile-user-name">{user.username}</p>
                        <div className="profile-user-status">
                            <span className={`status-indicator ${user.online_status === 'online' ? '' : 'offline'}`}></span>
                            <span>{user.online_status === 'online' ? 'Онлайн' : 'Не в сети'}</span>
                        </div>
                        <div className="profile-user-meta meta-row">
                            <div className="meta-item">
                                <span>ID: {user.id || userId}</span>
                            </div>
                            <div className={`meta-item ${user.email ? (user.is_verified ? 'ok' : 'warn') : 'muted'}`}>
                                <span>✉ {user.email ? (user.is_verified ? 'Подтвержден' : 'Не подтвержден') : 'Нет'}</span>
                            </div>
                            {user.steam_url && (
                                <div className="meta-item ok">
                                    <span>🎮 Steam</span>
                                </div>
                            )}
                            {(user.faceit || user.faceit_id) && (
                                <div className="meta-item ok">
                                    <span>⚡ FACEIT</span>
                                </div>
                            )}
                        </div>
                        {renderFriendActionButton()}
                    </div>
                </div>
            </div>
            
            <div className="profile-content">
                {/* Навигация: десктоп — вкладки, мобайл — всплывающее меню */}
                {!isMobile ? (
                    <div className="profile-navigation">
                        <button className={`nav-tab ${activeTab === 'main' ? 'active' : ''}`} onClick={() => setActiveTab('main')}>Профиль</button>
                        <button className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Статистика</button>
                        {user.friends && user.friends.length > 0 && (
                            <button className={`nav-tab ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => setActiveTab('friends')}>Друзья</button>
                        )}
                    </div>
                ) : (
                    <div className="profile-mobile-nav">
                        <button className="profile-toggle-button" onClick={() => setSheetOpen(true)} aria-label="Открыть меню профиля">
                            <span className="triangle" />
                            {badgeCount > 0 && (
                                <span className="profile-toggle-badge">{Math.min(99, badgeCount)}</span>
                            )}
                        </button>
                        <MobileProfileSheet
                            isOpen={sheetOpen}
                            onClose={() => setSheetOpen(false)}
                            activeTab={activeTab}
                            onSelectTab={setActiveTab}
                            tabs={[{key:'main',label:'Профиль'},{key:'stats',label:'Статистика'}].concat((user.friends&&user.friends.length>0)?[{key:'friends',label:'Друзья'}]:[])}
                        />
                    </div>
                )}
                
                <div className="profile-tab-content">
                    {activeTab === 'main' && (
                        <div className="main-tab">
                            <section className="steam-section">
                                <h3>Steam</h3>
                                <div>
                                    <p>
                                        {user.steam_url 
                                            ? <span>Профиль: <a href={user.steam_url} target="_blank" rel="noopener noreferrer">
                                                {user.steam_nickname || user.steam_url.split('/').pop()}
                                              </a></span>
                                            : 'Не привязан'}
                                    </p>
                                </div>
                            </section>

                            {user.faceit && (
                                <section className="faceit-section">
                                    <h3>Faceit</h3>
                                    <div>
                                        <p>
                                            <span>
                                                Профиль: <a href={user.faceit.faceitUrl} target="_blank" rel="noopener noreferrer">{user.faceit.faceitNickname}</a>
                                            </span>
                                        </p>
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'stats' && (
                        <div className="stats-tab">
                            {user.steam_url && user.premier_rank && (
                                <section className="cs2-stats-section">
                                    <h3>Статистика CS2</h3>
                                    <div className="rank-container rank-container-mobile">
                                        {renderRankGroups()}
                                    </div>
                                </section>
                            )}

                            {user.faceit && user.faceit.elo > 0 && (
                                <section className="faceit-stats-section">
                                    <h3>Статистика FACEIT{user.faceit.statsFrom === 'csgo' ? ' (CS:GO)' : ''}</h3>
                                    <div className="faceit-elo">
                                        <p><strong>ELO:</strong> {user.faceit.elo}</p>
                                        <p><strong>Уровень:</strong> {user.faceit.level}</p>
                                    </div>
                                    {user.faceit.stats && (
                                        <div className="faceit-detailed-stats">
                                            <p><strong>Матчи:</strong> {user.faceit.stats.Matches || 0}</p>
                                            <p><strong>Винрейт:</strong> {user.faceit.stats['Win Rate %'] || '0'}%</p>
                                            <p><strong>K/D:</strong> {user.faceit.stats['Average K/D Ratio'] || '0'}</p>
                                            <p><strong>HS %:</strong> {user.faceit.stats['Average Headshots %'] || '0'}%</p>
                                        </div>
                                    )}
                                </section>
                            )}
                            
                            <section>
                                <h3>Статистика турниров</h3>
                                {user.stats ? (
                                    <div className="stats-grid stats-grid-mobile">
                                        <div className="stats-card">
                                            <div className="stats-value">{user.stats.solo.wins}</div>
                                            <div className="stats-label">Победы соло</div>
                                        </div>
                                        <div className="stats-card">
                                            <div className="stats-value">{user.stats.solo.losses}</div>
                                            <div className="stats-label">Поражения соло</div>
                                        </div>
                                        <div className="stats-card">
                                            <div className="stats-value">{user.stats.solo.winRate}%</div>
                                            <div className="stats-label">Винрейт соло</div>
                                        </div>
                                        <div className="stats-card">
                                            <div className="stats-value">{user.stats.team.wins}</div>
                                            <div className="stats-label">Победы команда</div>
                                        </div>
                                        <div className="stats-card">
                                            <div className="stats-value">{user.stats.team.losses}</div>
                                            <div className="stats-label">Поражения команда</div>
                                        </div>
                                        <div className="stats-card">
                                            <div className="stats-value">{user.stats.team.winRate}%</div>
                                            <div className="stats-label">Винрейт команда</div>
                                        </div>
                                    </div>
                                ) : (
                                    <p>Нет статистики</p>
                                )}
                                
                                {user.stats && user.stats.tournaments.length > 0 && (
                                    <div className="recent-matches">
                                        <h3>Турниры</h3>
                                        <div className="matches-list">
                                            {user.stats.tournaments.map((t, index) => (
                                                <div key={index} className="match-item">
                                                    <div className="match-info">
                                                        <span className="match-opponent">{t.name}</span>
                                                        <span className="match-score">{t.result}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                    
                    {activeTab === 'friends' && user.friends && user.friends.length > 0 && (
                        <div className="friends-tab">
                            <section className="friends-section">
                                <h3>Друзья</h3>
                                <div className="friends-list">
                                    {user.friends.map(friend => (
                                        <div key={friend.id} className="friend-item">
                                            <a href={isCurrentUser(friend.id) ? `/profile` : `/user/${friend.id}`} className="friend-link">
                                                <img 
                                                    src={ensureHttps(friend.avatar_url) || '/default-avatar.png'} 
                                                    alt={friend.username} 
                                                    className="friend-avatar" 
                                                />
                                                <div className="friend-details">
                                                    <span className="friend-username">{friend.username}</span>
                                                    {friend.online_status && (
                                                        <span className={`friend-status ${friend.online_status === 'online' ? 'status-online' : 'status-offline'}`}>
                                                            {friend.online_status}
                                                        </span>
                                                    )}
                                                </div>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default UserProfile; 