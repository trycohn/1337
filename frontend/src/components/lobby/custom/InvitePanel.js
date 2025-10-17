// 👥 InvitePanel - Панель приглашения игроков в кастомное лобби
import React, { useState, useRef, useEffect } from 'react';
import api from '../../../axios';
import './InvitePanel.css';

function InvitePanel({ isOpen, onClose, targetTeam, onInvite, lobbyId }) {
    const [friends, setFriends] = useState([]);
    const [friendsExpanded, setFriendsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const searchDebounce = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            loadFriends();
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const loadFriends = async () => {
        try {
            const token = localStorage.getItem('token');
            const { data } = await api.get('/api/friends', { headers: { Authorization: `Bearer ${token}` } });
            const list = Array.isArray(data) ? data.map(f => f.friend) : [];
            setFriends(list);
        } catch (err) {
            console.error('Ошибка загрузки друзей:', err);
            setFriends([]);
        }
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        
        if (!value || value.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        
        searchDebounce.current = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                const { data } = await api.get('/api/users/search', {
                    params: { q: value, limit: 10 },
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSearchResults(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Ошибка поиска:', err);
                setSearchResults([]);
            }
        }, 250);
    };

    const handleInvite = async (userId) => {
        if (onInvite) {
            await onInvite(userId, targetTeam);
            setSearchQuery('');
            setSearchResults([]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="invite-panel-overlay" onClick={onClose}>
            <div className="invite-panel" onClick={(e) => e.stopPropagation()}>
                <div className="invite-panel-header">
                    <h3>
                        👥 Пригласить в команду {targetTeam}
                    </h3>
                    <button className="invite-panel-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* Поиск пользователей */}
                <div className="invite-search-section">
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Поиск игрока..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="invite-search-input"
                    />
                    
                    {searchResults.length > 0 && (
                        <div className="invite-search-results">
                            {searchResults.map(user => (
                                <div key={user.id} className="invite-user-item">
                                    <div className="invite-user-avatar">
                                        <img 
                                            src={user.avatar || '/default-avatar.png'}
                                            alt={user.username || user.display_name}
                                            onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                        />
                                    </div>
                                    <div className="invite-user-info">
                                        <span className="invite-user-name">
                                            {user.username || user.display_name}
                                        </span>
                                    </div>
                                    <button
                                        className="btn-invite"
                                        onClick={() => handleInvite(user.id)}
                                    >
                                        Пригласить
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Список друзей */}
                {friends.length > 0 && (
                    <div className="invite-friends-section">
                        <button
                            className="friends-toggle"
                            onClick={() => setFriendsExpanded(!friendsExpanded)}
                        >
                            <span>👥 Друзья ({friends.length})</span>
                            <span className="toggle-icon">{friendsExpanded ? '▼' : '▶'}</span>
                        </button>
                        
                        {friendsExpanded && (
                            <div className="friends-list">
                                {friends.map(friend => (
                                    <div key={friend.id} className="invite-user-item">
                                        <div className="invite-user-avatar">
                                            <img 
                                                src={friend.avatar || '/default-avatar.png'}
                                                alt={friend.username || friend.display_name}
                                                onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                            />
                                        </div>
                                        <div className="invite-user-info">
                                            <span className="invite-user-name">
                                                {friend.username || friend.display_name}
                                            </span>
                                        </div>
                                        <button
                                            className="btn-invite"
                                            onClick={() => handleInvite(friend.id)}
                                        >
                                            Пригласить
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default InvitePanel;

