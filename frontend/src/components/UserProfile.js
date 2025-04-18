import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../axios';
import './Profile.css';

function UserProfile() {
    const { userId } = useParams();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [friendStatus, setFriendStatus] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/api/users/profile/${userId}`);
                setUser(response.data);
                setError('');
            } catch (err) {
                setError(err.response?.data?.message || 'Ошибка загрузки профиля пользователя');
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
    }, [userId]);

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
        
        const currentUserId = JSON.parse(atob(localStorage.getItem('token')?.split('.')[1] || 'e30='))?.id;
        if (currentUserId == userId) return null; // Не показываем кнопку на своем профиле
        
        switch (friendStatus.status) {
            case 'none':
                return (
                    <button 
                        className="friend-action-btn add-friend" 
                        onClick={sendFriendRequest}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Загрузка...' : 'Добавить в друзья'}
                    </button>
                );
            case 'pending':
                if (friendStatus.direction === 'incoming') {
                    return (
                        <div className="friend-request-actions">
                            <button 
                                className="friend-action-btn accept-request" 
                                onClick={acceptFriendRequest}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Загрузка...' : 'Принять заявку'}
                            </button>
                            <button 
                                className="friend-action-btn reject-request" 
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
                            className="friend-action-btn pending-request" 
                            disabled={true}
                        >
                            Заявка отправлена
                        </button>
                    );
                }
            case 'accepted':
                return (
                    <button 
                        className="friend-action-btn remove-friend" 
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
    if (error) return <div className="profile-error">{error}</div>;
    if (!user) return <div className="profile-not-found">Пользователь не найден</div>;

    return (
        <div className="profile">
            <div className="profile-header">
                <div className="avatar-container">
                    <img 
                        src={user.avatar_url || '/default-avatar.png'} 
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
                    {user.steam_url && user.premier_rank && (
                        <div className="cs2-stats">
                            <h4>Статистика CS2</h4>
                            <div className="rank-container">
                                {renderRankGroups()}
                            </div>
                        </div>
                    )}
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

                        {user.faceit.elo > 0 && (
                            <div className="faceit-stats">
                                <h4>Статистика FACEIT{user.faceit.statsFrom === 'csgo' ? ' (CS:GO)' : ''}</h4>
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
                            </div>
                        )}
                    </div>
                </section>
            )}

            <section>
                <h3>Статистика турниров</h3>
                {user.stats ? (
                    <>
                        <h4>Турниры</h4>
                        {user.stats.tournaments.length > 0 ? (
                            <ul>
                                {user.stats.tournaments.map((t, index) => (
                                    <li key={index}>{t.name} - {t.result}</li>
                                ))}
                            </ul>
                        ) : (
                            <p>Нет данных об участии в турнирах</p>
                        )}
                        <h4>Соло</h4>
                        <p>W:L: {user.stats.solo.wins}:{user.stats.solo.losses} ({user.stats.solo.winRate}%)</p>
                        <h4>Командные</h4>
                        <p>W:L: {user.stats.team.wins}:{user.stats.team.losses} ({user.stats.team.winRate}%)</p>
                    </>
                ) : (
                    <p>Нет статистики</p>
                )}
            </section>

            {user.friends && user.friends.length > 0 && (
                <section className="friends-section">
                    <h3>Друзья</h3>
                    <div className="friends-list">
                        {user.friends.map(friend => (
                            <div key={friend.id} className="friend-item">
                                <a href={`/profile/${friend.id}`} className="friend-link">
                                    <img 
                                        src={friend.avatar_url || '/default-avatar.png'} 
                                        alt={friend.username} 
                                        className="friend-avatar" 
                                    />
                                    <span className="friend-username">{friend.username}</span>
                                </a>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

export default UserProfile; 