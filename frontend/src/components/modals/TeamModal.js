import React, { useState, useRef, useEffect } from 'react';
import api from '../../utils/api';
import { ensureHttps } from '../../utils/userHelpers';
import './TeamModal.css';

const TeamModal = ({ team, onClose, onTeamUpdated, onTeamDeleted, currentUser }) => {
    const [teamData, setTeamData] = useState(team);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [showInviteSection, setShowInviteSection] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [inviteMessage, setInviteMessage] = useState('');
    const [transferCaptainMode, setTransferCaptainMode] = useState(false);
    const [selectedNewCaptain, setSelectedNewCaptain] = useState(null);
    
    const fileInputRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    const isCurrentUserCaptain = teamData.captain_id === currentUser?.id;

    // Обновляем данные команды при изменении пропа
    useEffect(() => {
        setTeamData(team);
    }, [team]);

    // Поиск пользователей
    const searchUsers = async (query) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            setIsSearching(true);
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/teams/search-users?query=${encodeURIComponent(query)}&teamId=${teamData.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSearchResults(response.data);
        } catch (err) {
            console.error('Ошибка поиска пользователей:', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Обработка изменения поискового запроса
    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            searchUsers(query);
        }, 300);
    };

    // Загрузка аватара команды
    const handleAvatarUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setError('Размер файла не должен превышать 5MB');
            return;
        }

        setUploadingAvatar(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await api.post(`/api/teams/${teamData.id}/avatar`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            const updatedTeam = { ...teamData, avatar_url: response.data.avatar_url };
            setTeamData(updatedTeam);
            onTeamUpdated(updatedTeam);
        } catch (err) {
            console.error('Ошибка загрузки аватара:', err);
            setError(err.response?.data?.error || 'Ошибка загрузки аватара');
        } finally {
            setUploadingAvatar(false);
        }
    };

    // Пригласить пользователя
    const inviteUser = async (userId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            await api.post(`/api/teams/${teamData.id}/invite`, {
                userId,
                message: inviteMessage.trim() || null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Убираем пользователя из результатов поиска
            setSearchResults(searchResults.filter(user => user.id !== userId));
            setInviteMessage('');
            setError('');
            
            // Показываем уведомление об успехе
            window.alert('Приглашение отправлено!');
        } catch (err) {
            console.error('Ошибка отправки приглашения:', err);
            setError(err.response?.data?.error || 'Ошибка отправки приглашения');
        } finally {
            setLoading(false);
        }
    };

    // Удалить участника
    const removeMember = async (userId, username) => {
        if (!window.confirm(`Вы уверены, что хотите удалить ${username} из команды?`)) {
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            await api.delete(`/api/teams/${teamData.id}/members/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Обновляем данные команды
            const updatedTeam = {
                ...teamData,
                members: teamData.members.filter(member => member.id !== userId),
                member_count: teamData.member_count - 1
            };
            setTeamData(updatedTeam);
            onTeamUpdated(updatedTeam);
            setError('');
        } catch (err) {
            console.error('Ошибка удаления участника:', err);
            setError(err.response?.data?.error || 'Ошибка удаления участника');
        } finally {
            setLoading(false);
        }
    };

    // Передать капитанство
    const transferCaptaincy = async () => {
        if (!selectedNewCaptain) return;

        if (!window.confirm(`Вы уверены, что хотите передать капитанство пользователю ${selectedNewCaptain.username}?`)) {
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            await api.post(`/api/teams/${teamData.id}/transfer-captaincy`, {
                newCaptainId: selectedNewCaptain.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Обновляем данные команды
            const updatedTeam = {
                ...teamData,
                captain_id: selectedNewCaptain.id,
                members: teamData.members.map(member => ({
                    ...member,
                    role: member.id === selectedNewCaptain.id ? 'captain' : 
                          member.id === currentUser.id ? 'member' : member.role
                }))
            };
            setTeamData(updatedTeam);
            onTeamUpdated(updatedTeam);
            setTransferCaptainMode(false);
            setSelectedNewCaptain(null);
            setError('');
        } catch (err) {
            console.error('Ошибка передачи капитанства:', err);
            setError(err.response?.data?.error || 'Ошибка передачи капитанства');
        } finally {
            setLoading(false);
        }
    };

    // Покинуть команду
    const leaveTeam = async () => {
        if (!window.confirm('Вы уверены, что хотите покинуть команду?')) {
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            await api.post(`/api/teams/${teamData.id}/leave`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            onTeamDeleted(teamData.id);
        } catch (err) {
            console.error('Ошибка выхода из команды:', err);
            setError(err.response?.data?.error || 'Ошибка выхода из команды');
        } finally {
            setLoading(false);
        }
    };

    // Удалить команду
    const deleteTeam = async () => {
        if (!window.confirm('Вы уверены, что хотите удалить команду? Это действие необратимо.')) {
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            await api.delete(`/api/teams/${teamData.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            onTeamDeleted(teamData.id);
        } catch (err) {
            console.error('Ошибка удаления команды:', err);
            setError(err.response?.data?.error || 'Ошибка удаления команды');
        } finally {
            setLoading(false);
        }
    };

    const handleModalClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleModalClick}>
            <div className="team-modal">
                <div className="modal-header">
                    <h2>Управление командой</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="team-modal-content">
                    {error && (
                        <div className="error-message">
                            {error}
                            <button onClick={() => setError('')}>✕</button>
                        </div>
                    )}

                    <div className="team-modal-layout">
                        {/* Левая часть - информация о команде */}
                        <div className="team-info-section">
                            <div className="team-card-large">
                                <div className="team-header-large">
                                    <div className="team-avatar-container-large">
                                        {teamData.avatar_url ? (
                                            <img 
                                                src={ensureHttps(teamData.avatar_url)} 
                                                alt={teamData.name}
                                                className="team-avatar-large"
                                            />
                                        ) : (
                                            <div className="team-avatar-placeholder-large">
                                                {teamData.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        {isCurrentUserCaptain && (
                                            <div className="avatar-overlay">
                                                <button 
                                                    className="change-avatar-btn"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={uploadingAvatar}
                                                >
                                                    {uploadingAvatar ? '⏳' : '📷'}
                                                </button>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleAvatarUpload}
                                                    style={{ display: 'none' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="team-info-large">
                                        <h3 className="team-name-large">{teamData.name}</h3>
                                        <div className="team-badges-large">
                                            {isCurrentUserCaptain && (
                                                <span className="captain-badge">Капитан</span>
                                            )}
                                            {!teamData.is_permanent && (
                                                <span className="temporary-badge">Разовая</span>
                                            )}
                                        </div>
                                        {teamData.description && (
                                            <p className="team-description">{teamData.description}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="team-members-section">
                                    <h4>Участники команды ({teamData.member_count})</h4>
                                    <div className="members-list-large">
                                        {teamData.members.map(member => (
                                            <div key={member.id} className="member-item-large">
                                                <div className="member-info">
                                                    <div className="member-avatar-large">
                                                        {member.avatar_url ? (
                                                            <img 
                                                                src={ensureHttps(member.avatar_url)} 
                                                                alt={member.username}
                                                            />
                                                        ) : (
                                                            <div className="avatar-placeholder-large">
                                                                {member.username.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="member-details">
                                                        <span className="member-name-large">
                                                            {member.username}
                                                            {member.role === 'captain' && ' 👑'}
                                                        </span>
                                                        <span className="member-role">
                                                            {member.role === 'captain' ? 'Капитан' : 'Участник'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {isCurrentUserCaptain && member.id !== currentUser.id && (
                                                    <button 
                                                        className="btn btn-secondary"
                                                        onClick={() => removeMember(member.id, member.username)}
                                                        disabled={loading}
                                                        title="Удалить из команды"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Кнопки управления командой */}
                            <div className="team-actions">
                                {isCurrentUserCaptain ? (
                                    <>
                                        <button 
                                            className="transfer-captain-btn"
                                            onClick={() => setTransferCaptainMode(!transferCaptainMode)}
                                            disabled={teamData.members.length <= 1}
                                        >
                                            Передать капитанство
                                        </button>
                                        <button 
                                            className="delete-team-btn"
                                            onClick={deleteTeam}
                                            disabled={loading}
                                        >
                                            Удалить команду
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        className="leave-team-btn"
                                        onClick={leaveTeam}
                                        disabled={loading}
                                    >
                                        Покинуть команду
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Правая часть - управление участниками */}
                        {isCurrentUserCaptain && (
                            <div className="team-management-section">
                                {transferCaptainMode ? (
                                    <div className="transfer-captain-section">
                                        <h4>Передать капитанство</h4>
                                        <p>Выберите нового капитана из участников команды:</p>
                                        <div className="captain-candidates">
                                            {teamData.members
                                                .filter(member => member.id !== currentUser.id)
                                                .map(member => (
                                                    <div 
                                                        key={member.id}
                                                        className={`candidate-item ${selectedNewCaptain?.id === member.id ? 'selected' : ''}`}
                                                        onClick={() => setSelectedNewCaptain(member)}
                                                    >
                                                        <div className="member-avatar-small">
                                                            {member.avatar_url ? (
                                                                <img 
                                                                    src={ensureHttps(member.avatar_url)} 
                                                                    alt={member.username}
                                                                />
                                                            ) : (
                                                                <div className="avatar-placeholder-small">
                                                                    {member.username.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span>{member.username}</span>
                                                    </div>
                                                ))}
                                        </div>
                                        <div className="transfer-actions">
                                            <button 
                                                className="cancel-transfer-btn"
                                                onClick={() => {
                                                    setTransferCaptainMode(false);
                                                    setSelectedNewCaptain(null);
                                                }}
                                            >
                                                Отмена
                                            </button>
                                            <button 
                                                className="confirm-transfer-btn"
                                                onClick={transferCaptaincy}
                                                disabled={!selectedNewCaptain || loading}
                                            >
                                                Передать капитанство
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="invite-section">
                                        <div className="invite-header">
                                            <h4>Пригласить в команду</h4>
                                            <button 
                                                className="toggle-invite-btn"
                                                onClick={() => setShowInviteSection(!showInviteSection)}
                                            >
                                                {showInviteSection ? '−' : '+'}
                                            </button>
                                        </div>

                                        {showInviteSection && (
                                            <div className="invite-form">
                                                <div className="search-section">
                                                    <input
                                                        type="text"
                                                        placeholder="Поиск пользователей..."
                                                        value={searchQuery}
                                                        onChange={handleSearchChange}
                                                        className="search-input"
                                                    />
                                                    
                                                    {isSearching && (
                                                        <div className="search-loading">Поиск...</div>
                                                    )}

                                                    {searchResults.length > 0 && (
                                                        <div className="search-results">
                                                            {searchResults.map(user => (
                                                                <div key={user.id} className="search-result-item">
                                                                    <div className="user-info">
                                                                        <div className="user-avatar-small">
                                                                            {user.avatar_url ? (
                                                                                <img 
                                                                                    src={ensureHttps(user.avatar_url)} 
                                                                                    alt={user.username}
                                                                                />
                                                                            ) : (
                                                                                <div className="avatar-placeholder-small">
                                                                                    {user.username.charAt(0).toUpperCase()}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <span>{user.username}</span>
                                                                    </div>
                                                                    <button 
                                                                        className="invite-user-btn"
                                                                        onClick={() => inviteUser(user.id)}
                                                                        disabled={loading}
                                                                    >
                                                                        Пригласить
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                                                        <div className="no-results">
                                                            Пользователи не найдены
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="invite-message-section">
                                                    <label>Сообщение к приглашению (необязательно):</label>
                                                    <textarea
                                                        value={inviteMessage}
                                                        onChange={(e) => setInviteMessage(e.target.value)}
                                                        placeholder="Добавьте сообщение к приглашению..."
                                                        rows="3"
                                                        maxLength="200"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamModal; 