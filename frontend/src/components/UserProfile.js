import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../axios';
import './Profile.css';
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
                <div className="avatar-container">
                    <img 
                        src={ensureHttps(user.avatar_url) || '/default-avatar.png'} 
                        alt="Аватар пользователя" 
                        className="user-avatar"
                    />
                </div>
                <div className="user-info">
                    <h2>{user.username}</h2>
                    {user.online_status && (
                        <div className={`online-status ${getOnlineStatusClass()}`}>
                            {user.online_status}
                        </div>
                    )}
                    {renderFriendActionButton()}
                </div>
            </div>
            
            <div className="profile-content">
                <div className="profile-navigation">
                    <button 
                        className={`nav-tab ${activeTab === 'main' ? 'active' : ''}`}
                        onClick={() => setActiveTab('main')}
                    >
                        Профиль
                    </button>
                    <button 
                        className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stats')}
                    >
                        Статистика
                    </button>
                    {user.friends && user.friends.length > 0 && (
                        <button 
                            className={`nav-tab ${activeTab === 'friends' ? 'active' : ''}`}
                            onClick={() => setActiveTab('friends')}
                        >
                            Друзья
                        </button>
                    )}
                </div>
                
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
                                    <div className="rank-container">
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
                                    <div className="stats-grid">
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