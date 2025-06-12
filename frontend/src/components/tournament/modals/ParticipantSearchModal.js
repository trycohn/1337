import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ensureHttps } from '../../../utils/userHelpers';
import './ParticipantSearchModal.css';

const ParticipantSearchModal = ({
    isOpen,
    onClose,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    onSearchUsers,
    onAddParticipant,
    existingParticipants = [],
    mode = 'participant', // 'participant' | 'admin'
    onInviteAdmin,
    existingAdmins = []
}) => {
    const [debounceTimer, setDebounceTimer] = useState(null);

    // Исправленный дебаунс для поиска
    useEffect(() => {
        // Очищаем предыдущий таймер
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        // Если запрос слишком короткий, очищаем результаты
        if (!searchQuery || searchQuery.length < 2) {
            return;
        }

        console.log('🔍 Настраиваем поиск для:', searchQuery, 'режим:', mode);
        
        // Устанавливаем новый таймер
        const timer = setTimeout(() => {
            console.log('🔍 Выполняем поиск для:', searchQuery);
            onSearchUsers(searchQuery);
        }, 300);
        
        setDebounceTimer(timer);

        // Cleanup функция
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [searchQuery, onSearchUsers, mode]); // Добавляем mode в зависимости

    const handleInputChange = (e) => {
        const value = e.target.value;
        console.log('🔍 Изменение поискового запроса:', value);
        setSearchQuery(value);
    };

    const handleAddUser = (userId) => {
        console.log('🔍 Добавление пользователя:', userId, 'режим:', mode);
        if (mode === 'admin') {
            onInviteAdmin(userId);
        } else {
            onAddParticipant(userId);
        }
    };

    // 🆕 ПРОВЕРКА СУЩЕСТВУЮЩИХ УЧАСТНИКОВ/АДМИНОВ
    const isUserAlreadyInList = (userId) => {
        if (mode === 'admin') {
            return existingAdmins.some(admin => admin.user_id === userId || admin.id === userId);
        } else {
            return existingParticipants.some(p => p.user_id === userId || p.id === userId);
        }
    };

    if (!isOpen) return null;

    // 🆕 КОНФИГУРАЦИЯ ДЛЯ РАЗНЫХ РЕЖИМОВ
    const config = {
        participant: {
            title: '🔍 Поиск и добавление участников',
            placeholder: 'Введите имя пользователя (минимум 2 символа)',
            addButtonText: '➕ Добавить',
            alreadyInText: '✅ Уже участвует',
            searchHint: 'Начните вводить имя пользователя для поиска'
        },
        admin: {
            title: '🔍 Поиск и приглашение администраторов',
            placeholder: 'Введите имя пользователя для приглашения в админы',
            addButtonText: '👑 Пригласить админом',
            alreadyInText: '✅ Уже администратор',
            searchHint: 'Найдите пользователя для приглашения в администраторы'
        }
    };

    const currentConfig = config[mode];

    console.log('🔍 Рендер ParticipantSearchModal:', {
        isOpen,
        mode,
        searchQuery,
        searchResultsCount: searchResults.length,
        isSearching,
        existingCount: mode === 'admin' ? existingAdmins.length : existingParticipants.length
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content participant-search-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{currentConfig.title}</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="search-container">
                    <div className="search-input-container">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleInputChange}
                            placeholder={currentConfig.placeholder}
                            className="search-input"
                            autoFocus
                        />
                        {isSearching && (
                            <div className="search-loading-indicator">
                                <div className="loading-spinner"></div>
                            </div>
                        )}
                    </div>

                    <div className="search-results-container">
                        {searchQuery.length === 0 && (
                            <div className="search-placeholder">
                                <p>{currentConfig.searchHint}</p>
                            </div>
                        )}

                        {searchQuery.length > 0 && searchQuery.length < 2 && (
                            <div className="search-placeholder">
                                <p>Введите минимум 2 символа для поиска</p>
                            </div>
                        )}

                        {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                            <div className="no-results">
                                <p>Пользователи не найдены</p>
                                <span>Попробуйте изменить запрос</span>
                            </div>
                        )}

                        {searchResults.length > 0 && (
                            <div className="search-results-list">
                                {searchResults.map(user => (
                                    <div key={user.id} className="search-result-item">
                                        <div className="user-info">
                                            <div className="user-avatar">
                                                {user.avatar_url ? (
                                                    <img 
                                                        src={ensureHttps(user.avatar_url)} 
                                                        alt={user.username}
                                                        onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                    />
                                                ) : (
                                                    <div className="avatar-placeholder">
                                                        {user.username.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="user-details">
                                                <div className="user-name">{user.username}</div>
                                                {user.faceit_elo && (
                                                    <div className="user-rating">FACEIT: {user.faceit_elo}</div>
                                                )}
                                                {user.cs2_premier_rank && (
                                                    <div className="user-rating">CS2: {user.cs2_premier_rank}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="user-actions">
                                            <Link 
                                                to={`/profile/${user.id}`} 
                                                className="view-profile-btn"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                👁️ Профиль
                                            </Link>
                                            {isUserAlreadyInList(user.id) ? (
                                                <button className="already-participant-btn" disabled>
                                                    {currentConfig.alreadyInText}
                                                </button>
                                            ) : (
                                                <button 
                                                    className={`add-participant-btn ${mode === 'admin' ? 'admin-invite-btn' : ''}`}
                                                    onClick={() => handleAddUser(user.id)}
                                                >
                                                    {currentConfig.addButtonText}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="close-modal-btn" onClick={onClose}>
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ParticipantSearchModal; 