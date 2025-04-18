import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../axios';
import './Profile.css';

function UserProfile() {
    const { userId } = useParams();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

        fetchUserProfile();
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
                </div>
            </div>
            
            <section className="steam-section">
                <h3>Steam</h3>
                <div>
                    <p>
                        {user.steam_url 
                            ? <span>Профиль: <a href={user.steam_url} target="_blank" rel="noopener noreferrer">{user.steam_url.split('/').pop()}</a></span>
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
        </div>
    );
}

export default UserProfile; 