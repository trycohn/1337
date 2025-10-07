import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../utils/api';
import { ensureHttps } from '../../../utils/userHelpers';
import './TeamEditModal.css';

/**
 * Модалка редактирования состава команды турнира
 * Поддерживает два режима:
 * 1. С листом ожидания - двухпанельный интерфейс
 * 2. Без листа ожидания - простой интерфейс
 */
const TeamEditModal = ({ 
    isOpen, 
    onClose, 
    team, 
    tournament,
    onTeamUpdated 
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Состав команды
    const [teamMembers, setTeamMembers] = useState([]);
    
    // Лист ожидания (для турниров с waiting_list_enabled)
    const [waitingList, setWaitingList] = useState([]);
    
    // Поиск пользователей
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    
    // Добавление незарегистрированного игрока
    const [newPlayerNick, setNewPlayerNick] = useState('');

    const isWaitingListEnabled = tournament?.waiting_list_enabled;

    // Загрузка данных при открытии
    useEffect(() => {
        if (isOpen && team?.id && tournament?.id) {
            loadTeamMembers();
            if (isWaitingListEnabled) {
                loadWaitingList();
            }
        }
    }, [isOpen, team?.id, tournament?.id, isWaitingListEnabled]);

    // Загрузка состава команды
    const loadTeamMembers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get(
                `/api/tournaments/${tournament.id}/teams/${team.id}/members`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success) {
                setTeamMembers(response.data.members || []);
            }
        } catch (err) {
            console.error('Ошибка загрузки состава:', err);
        }
    };

    // Загрузка листа ожидания
    const loadWaitingList = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get(
                `/api/tournaments/${tournament.id}/waiting-list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success) {
                setWaitingList(response.data.waitingList || []);
            }
        } catch (err) {
            console.error('Ошибка загрузки листа ожидания:', err);
        }
    };

    // Добавить участника из листа ожидания
    const handleAddFromWaitingList = async (participant) => {
        try {
            setLoading(true);
            setError('');
            
            const token = localStorage.getItem('token');
            await api.post(
                `/api/tournaments/${tournament.id}/waiting-list/${participant.id}/assign`,
                { teamId: team.id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setSuccess(`${participant.name} добавлен в команду`);
            setTimeout(() => setSuccess(''), 3000);
            
            // Обновляем данные
            await loadTeamMembers();
            await loadWaitingList();
            
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка при добавлении участника');
        } finally {
            setLoading(false);
        }
    };

    // Поиск зарегистрированных пользователей
    const searchUsers = async (query) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            setIsSearching(true);
            const token = localStorage.getItem('token');
            const response = await api.get(
                `/api/users/search?query=${encodeURIComponent(query)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Фильтруем уже добавленных участников
            const filtered = response.data.filter(user => 
                !teamMembers.some(m => m.user_id === user.id)
            );
            
            setSearchResults(filtered);
        } catch (err) {
            console.error('Ошибка поиска:', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Добавить зарегистрированного пользователя
    const handleAddRegisteredUser = async (user) => {
        try {
            setLoading(true);
            setError('');
            
            const token = localStorage.getItem('token');
            await api.post(
                `/api/tournaments/${tournament.id}/teams/${team.id}/members`,
                { userId: user.id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setSuccess(`${user.username} добавлен в команду`);
            setTimeout(() => setSuccess(''), 3000);
            setSearchQuery('');
            setSearchResults([]);
            
            await loadTeamMembers();
            
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка при добавлении участника');
        } finally {
            setLoading(false);
        }
    };

    // Добавить незарегистрированного игрока
    const handleAddUnregistered = async () => {
        if (!newPlayerNick.trim()) {
            setError('Введите ник игрока');
            return;
        }

        try {
            setLoading(true);
            setError('');
            
            const token = localStorage.getItem('token');
            await api.post(
                `/api/tournaments/${tournament.id}/teams/${team.id}/members`,
                { nickname: newPlayerNick.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setSuccess(`${newPlayerNick} добавлен в команду`);
            setTimeout(() => setSuccess(''), 3000);
            setNewPlayerNick('');
            
            await loadTeamMembers();
            
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка при добавлении игрока');
        } finally {
            setLoading(false);
        }
    };

    // Удалить участника из команды
    const handleRemoveMember = async (participantId, participantName) => {
        if (!window.confirm(`Удалить ${participantName} из команды?`)) {
            return;
        }

        try {
            setLoading(true);
            setError('');
            
            const token = localStorage.getItem('token');
            await api.delete(
                `/api/tournaments/${tournament.id}/teams/${team.id}/members/${participantId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setSuccess(`${participantName} удален из команды`);
            setTimeout(() => setSuccess(''), 3000);
            
            await loadTeamMembers();
            
            // Если был лист ожидания - обновляем его тоже
            if (isWaitingListEnabled) {
                await loadWaitingList();
            }
            
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка при удалении участника');
        } finally {
            setLoading(false);
        }
    };

    // Закрытие модалки
    const handleClose = () => {
        setError('');
        setSuccess('');
        setSearchQuery('');
        setSearchResults([]);
        setNewPlayerNick('');
        onClose();
        
        // Уведомляем родительский компонент об обновлении
        if (onTeamUpdated) {
            onTeamUpdated();
        }
    };

    // Поиск с задержкой
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length >= 2) {
                searchUsers(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Рендер участника
    const renderMember = (member, showRemove = true) => {
        const rating = tournament?.mix_rating_type === 'faceit' 
            ? (member.faceit_elo || member.user_faceit_elo || 1000)
            : (member.cs2_premier_rank || member.user_cs2_premier_rank || 5);

        return (
            <div key={member.id} className="team-member-item">
                <div className="member-info">
                    <div className="member-avatar">
                        {member.avatar_url ? (
                            <img 
                                src={ensureHttps(member.avatar_url)} 
                                alt={member.name}
                            />
                        ) : (
                            <div className="avatar-placeholder">
                                {(member.name || member.username || '?').charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="member-details">
                        <span className="member-name">
                            {member.name || member.username}
                            {member.is_captain && <span className="captain-badge"> 👑</span>}
                        </span>
                        <span className="member-rating">
                            {tournament?.mix_rating_type === 'faceit' ? `${rating} ELO` : `Premier ${rating}`}
                        </span>
                    </div>
                </div>
                {showRemove && (
                    <button 
                        className="remove-member-btn"
                        onClick={() => handleRemoveMember(member.id, member.name || member.username)}
                        disabled={loading}
                    >
                        ❌
                    </button>
                )}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div 
                className={`team-edit-modal ${isWaitingListEnabled ? 'with-waiting-list' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h3>✏️ Редактирование команды "{team?.name}"</h3>
                    <button className="close-btn" onClick={handleClose}>✕</button>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className={`modal-body ${isWaitingListEnabled ? 'two-column' : 'single-column'}`}>
                    {/* С ЛИСТОМ ОЖИДАНИЯ - Двухпанельный интерфейс */}
                    {isWaitingListEnabled ? (
                        <>
                            {/* Левая панель - Лист ожидания */}
                            <div className="waiting-list-panel">
                                <h4>📋 Лист ожидания ({waitingList.length})</h4>
                                <div className="waiting-list-content">
                                    {waitingList.length === 0 ? (
                                        <p className="empty-message">Нет игроков в листе ожидания</p>
                                    ) : (
                                        <div className="members-list">
                                            {waitingList.map(participant => (
                                                <div key={participant.id} className="waiting-participant">
                                                    <div className="participant-info">
                                                        <div className="participant-avatar">
                                                            {participant.avatar_url ? (
                                                                <img 
                                                                    src={ensureHttps(participant.avatar_url)} 
                                                                    alt={participant.name}
                                                                />
                                                            ) : (
                                                                <div className="avatar-placeholder">
                                                                    {(participant.name || participant.username || '?').charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="participant-details">
                                                            <span className="participant-name">
                                                                {participant.name || participant.username}
                                                            </span>
                                                            <span className="participant-rating">
                                                                {tournament?.mix_rating_type === 'faceit' 
                                                                    ? `${participant.faceit_elo || participant.user_faceit_elo || 1000} ELO`
                                                                    : `Premier ${participant.cs2_premier_rank || participant.user_cs2_premier_rank || 5}`
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        className="add-to-team-btn"
                                                        onClick={() => handleAddFromWaitingList(participant)}
                                                        disabled={loading}
                                                        title="Добавить в команду"
                                                    >
                                                        ➡️
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Правая панель - Состав команды */}
                            <div className="team-roster-panel">
                                <h4>👥 Состав команды ({teamMembers.length}/{tournament?.team_size || 5})</h4>
                                <div className="team-roster-content">
                                    {teamMembers.length === 0 ? (
                                        <p className="empty-message">Нет участников в команде</p>
                                    ) : (
                                        <div className="members-list">
                                            {teamMembers.map(member => renderMember(member, true))}
                                        </div>
                                    )}
                                    
                                    {/* Статистика команды */}
                                    {teamMembers.length > 0 && (
                                        <div className="team-stats">
                                            <div className="stat-item">
                                                <span className="stat-label">Средний рейтинг:</span>
                                                <span className="stat-value">
                                                    {(() => {
                                                        const ratings = teamMembers.map(m => {
                                                            return tournament?.mix_rating_type === 'faceit'
                                                                ? (m.faceit_elo || m.user_faceit_elo || 1000)
                                                                : (m.cs2_premier_rank || m.user_cs2_premier_rank || 5);
                                                        });
                                                        const avg = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
                                                        return tournament?.mix_rating_type === 'faceit' ? `${avg} ELO` : `${avg}`;
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* БЕЗ ЛИСТА ОЖИДАНИЯ - Простой интерфейс */
                        <div className="simple-edit-panel">
                            {/* Текущий состав */}
                            <div className="current-members-section">
                                <h4>👥 Текущий состав ({teamMembers.length}/{tournament?.team_size || 5})</h4>
                                <div className="members-list">
                                    {teamMembers.length === 0 ? (
                                        <p className="empty-message">Нет участников в команде</p>
                                    ) : (
                                        teamMembers.map(member => renderMember(member, true))
                                    )}
                                </div>
                            </div>

                            {/* Добавление участников */}
                            <div className="add-members-section">
                                <h4>➕ Добавить участников</h4>
                                
                                {/* Поиск зарегистрированных */}
                                <div className="search-section">
                                    <label>Поиск зарегистрированных пользователей:</label>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Введите имя пользователя..."
                                        disabled={loading}
                                    />
                                    
                                    {isSearching && <div className="searching">Поиск...</div>}
                                    
                                    {searchResults.length > 0 && (
                                        <div className="search-results">
                                            {searchResults.map(user => (
                                                <div key={user.id} className="search-result-item">
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
                                                        onClick={() => handleAddRegisteredUser(user)}
                                                        disabled={loading}
                                                    >
                                                        Добавить
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Добавление незарегистрированного */}
                                <div className="unregistered-section">
                                    <label>Или добавить незарегистрированного:</label>
                                    <div className="unregistered-form">
                                        <input
                                            type="text"
                                            value={newPlayerNick}
                                            onChange={(e) => setNewPlayerNick(e.target.value)}
                                            placeholder="Ник игрока"
                                            disabled={loading}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddUnregistered();
                                                }
                                            }}
                                        />
                                        <button 
                                            className="add-unregistered-btn"
                                            onClick={handleAddUnregistered}
                                            disabled={loading || !newPlayerNick.trim()}
                                        >
                                            ➕ Добавить
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button 
                        className="btn btn-secondary"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeamEditModal;
