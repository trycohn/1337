import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { ensureHttps } from '../../utils/userHelpers';
import './TeamSelectionModal.css';

const TeamSelectionModal = ({ onClose, onTeamSelected, tournamentId, user }) => {
    const [teams, setTeams] = useState({
        permanent: [],
        temporary: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [isCreatingTemp, setIsCreatingTemp] = useState(false);
    const [tempTeamName, setTempTeamName] = useState('');
    const [tempTeamMembers, setTempTeamMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Загрузка команд пользователя
    useEffect(() => {
        const fetchTeams = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');
                const response = await api.get(`/api/teams/for-tournament/${tournamentId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTeams(response.data);
            } catch (err) {
                console.error('Ошибка загрузки команд:', err);
                setError('Ошибка загрузки команд');
            } finally {
                setLoading(false);
            }
        };

        fetchTeams();
    }, [tournamentId]);

    // Поиск пользователей для добавления в разовую команду
    const searchUsers = async (query) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            setIsSearching(true);
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/teams/search-users?query=${encodeURIComponent(query)}&teamId=0`, {
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

    // Создание разовой команды
    const handleCreateTempTeam = async () => {
        if (!tempTeamName.trim()) {
            setError('Введите название команды');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            // Создаем разовую команду
            const response = await api.post('/api/teams', {
                name: tempTeamName.trim(),
                is_permanent: false,
                tournament_id: tournamentId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const tempTeam = response.data;

            // Приглашаем выбранных пользователей
            for (const member of tempTeamMembers) {
                try {
                    await api.post(`/api/teams/${tempTeam.id}/invite`, {
                        userId: member.id,
                        message: `Приглашение в команду "${tempTeam.name}" для участия в турнире`
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                } catch (inviteErr) {
                    console.error('Ошибка отправки приглашения:', inviteErr);
                }
            }

            onTeamSelected(tempTeam);
        } catch (err) {
            console.error('Ошибка создания команды:', err);
            setError(err.response?.data?.error || 'Ошибка создания команды');
        } finally {
            setLoading(false);
        }
    };

    // Выбор существующей команды
    const handleSelectExistingTeam = () => {
        if (!selectedTeam) {
            setError('Выберите команду');
            return;
        }
        onTeamSelected(selectedTeam);
    };

    // Добавление пользователя в разовую команду
    const addUserToTempTeam = (user) => {
        if (!tempTeamMembers.find(member => member.id === user.id)) {
            setTempTeamMembers([...tempTeamMembers, user]);
            setSearchResults(searchResults.filter(u => u.id !== user.id));
            setSearchQuery('');
        }
    };

    // Удаление пользователя из разовой команды
    const removeUserFromTempTeam = (userId) => {
        setTempTeamMembers(tempTeamMembers.filter(member => member.id !== userId));
    };

    const handleModalClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length >= 2) {
            setTimeout(() => searchUsers(query), 300);
        } else {
            setSearchResults([]);
        }
    };

    if (loading) {
        return (
            <div className="modal-overlay" onClick={handleModalClick}>
                <div className="team-selection-modal">
                    <div className="loading">Загрузка команд...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={handleModalClick}>
            <div className="team-selection-modal">
                <div className="modal-header">
                    <h2>Выбор команды для турнира</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="team-selection-content">
                    {error && (
                        <div className="error-message">
                            {error}
                            <button onClick={() => setError('')}>✕</button>
                        </div>
                    )}

                    <div className="selection-options">
                        <div className="option-tabs">
                            <button 
                                className={`tab-btn ${!isCreatingTemp ? 'active' : ''}`}
                                onClick={() => setIsCreatingTemp(false)}
                            >
                                Мои команды
                            </button>
                            <button 
                                className={`tab-btn ${isCreatingTemp ? 'active' : ''}`}
                                onClick={() => setIsCreatingTemp(true)}
                            >
                                Создать разовую команду
                            </button>
                        </div>

                        {!isCreatingTemp ? (
                            // Выбор существующей команды
                            <div className="existing-teams">
                                {teams.permanent.length === 0 && teams.temporary.length === 0 ? (
                                    <div className="no-teams">
                                        <p>У вас нет команд. Создайте разовую команду для участия в турнире.</p>
                                    </div>
                                ) : (
                                    <>
                                        {teams.permanent.length > 0 && (
                                            <div className="teams-section">
                                                <h4>Постоянные команды</h4>
                                                <div className="teams-list">
                                                    {teams.permanent.map(team => (
                                                        <div 
                                                            key={team.id}
                                                            className={`team-option ${selectedTeam?.id === team.id ? 'selected' : ''}`}
                                                            onClick={() => setSelectedTeam(team)}
                                                        >
                                                            <div className="team-avatar">
                                                                {team.avatar_url ? (
                                                                    <img 
                                                                        src={ensureHttps(team.avatar_url)} 
                                                                        alt={team.name}
                                                                    />
                                                                ) : (
                                                                    <div className="avatar-placeholder">
                                                                        {team.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="team-info">
                                                                <h5>{team.name}</h5>
                                                                <span>{team.member_count} участников</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {teams.temporary.length > 0 && (
                                            <div className="teams-section">
                                                <h4>Разовые команды для этого турнира</h4>
                                                <div className="teams-list">
                                                    {teams.temporary.map(team => (
                                                        <div 
                                                            key={team.id}
                                                            className={`team-option ${selectedTeam?.id === team.id ? 'selected' : ''}`}
                                                            onClick={() => setSelectedTeam(team)}
                                                        >
                                                            <div className="team-avatar">
                                                                {team.avatar_url ? (
                                                                    <img 
                                                                        src={ensureHttps(team.avatar_url)} 
                                                                        alt={team.name}
                                                                    />
                                                                ) : (
                                                                    <div className="avatar-placeholder">
                                                                        {team.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="team-info">
                                                                <h5>{team.name}</h5>
                                                                <span>{team.member_count} участников</span>
                                                                <span className="temp-badge">Разовая</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="action-buttons">
                                            <button 
                                                className="btn btn-secondary"
                                                onClick={handleSelectExistingTeam}
                                                disabled={!selectedTeam}
                                            >
                                                Выбрать команду
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            // Создание разовой команды
                            <div className="create-temp-team">
                                <div className="form-group">
                                    <label>Название команды *</label>
                                    <input
                                        type="text"
                                        value={tempTeamName}
                                        onChange={(e) => setTempTeamName(e.target.value)}
                                        placeholder="Введите название команды"
                                        maxLength="20"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Пригласить участников (необязательно)</label>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        placeholder="Поиск пользователей..."
                                    />
                                    
                                    {isSearching && (
                                        <div className="search-loading">Поиск...</div>
                                    )}

                                    {searchResults.length > 0 && (
                                        <div className="search-results">
                                            {searchResults.map(user => (
                                                <div key={user.id} className="search-result">
                                                    <div className="user-info">
                                                        <div className="user-avatar">
                                                            {user.avatar_url ? (
                                                                <img 
                                                                    src={ensureHttps(user.avatar_url)} 
                                                                    alt={user.username}
                                                                />
                                                            ) : (
                                                                <div className="avatar-placeholder">
                                                                    {user.username.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span>{user.username}</span>
                                                    </div>
                                                    <button 
                                                        className="add-user-btn"
                                                        onClick={() => addUserToTempTeam(user)}
                                                    >
                                                        Добавить
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {tempTeamMembers.length > 0 && (
                                    <div className="selected-members">
                                        <h5>Приглашенные участники:</h5>
                                        <div className="members-list">
                                            {tempTeamMembers.map(member => (
                                                <div key={member.id} className="member-item">
                                                    <div className="user-info">
                                                        <div className="user-avatar">
                                                            {member.avatar_url ? (
                                                                <img 
                                                                    src={ensureHttps(member.avatar_url)} 
                                                                    alt={member.username}
                                                                />
                                                            ) : (
                                                                <div className="avatar-placeholder">
                                                                    {member.username.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span>{member.username}</span>
                                                    </div>
                                                    <button 
                                                        className="remove-user-btn"
                                                        onClick={() => removeUserFromTempTeam(member.id)}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="action-buttons">
                                    <button 
                                        className="btn btn-secondary"
                                        onClick={handleCreateTempTeam}
                                        disabled={!tempTeamName.trim() || loading}
                                    >
                                        {loading ? 'Создание...' : 'Создать и участвовать'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamSelectionModal; 