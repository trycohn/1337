import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ensureHttps } from '../../../utils/userHelpers';
import './ParticipantSearchModal.css';

/**
 * ParticipantSearchModal v3.0 - Универсальное модальное окно для поиска пользователей
 * 
 * @version 3.0 (Переработанный интерфейс и исправление перезагрузки)
 * @updated 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Поиск пользователей для добавления в участники или администраторы
 * @features Два режима работы, улучшенный UI, предотвращение перезагрузки
 */
const ParticipantSearchModal = ({
    isOpen,
    onClose,
    onInvite,
    onInviteAdmin, // 🆕 Функция для приглашения в администраторы
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    onSearch,
    mode = 'participant', // 🆕 Режим: 'participant' или 'admin'
    existingParticipants = [], // Существующие участники для фильтрации
    existingAdmins = [] // 🆕 Существующие администраторы для фильтрации
}) => {
    // 🔍 ДИАГНОСТИКА: логируем пропсы при инициализации
    console.log('🔍 [ParticipantSearchModal] Инициализация компонента:', {
        isOpen,
        mode,
        hasOnInvite: !!onInvite,
        hasOnInviteAdmin: !!onInviteAdmin,
        existingParticipantsCount: existingParticipants.length,
        existingAdminsCount: existingAdmins.length,
        searchResultsCount: searchResults?.length || 0
    });

    // Локальное состояние для предотвращения перезагрузки
    const [localQuery, setLocalQuery] = useState('');
    const [debounceTimeout, setDebounceTimeout] = useState(null);

    // Мемоизированные заголовки и настройки для разных режимов
    const modalConfig = useMemo(() => {
        switch (mode) {
            case 'admin':
                return {
                    title: 'Пригласить администратора',
                    placeholder: 'Введите имя пользователя для поиска...',
                    emptyStateIcon: '👑',
                    emptyStateTitle: 'Поиск администраторов',
                    emptyStateText: 'Введите имя пользователя, чтобы найти кандидатов в администраторы турнира',
                    noResultsIcon: '🔍',
                    noResultsTitle: 'Пользователи не найдены',
                    noResultsText: 'Попробуйте изменить поисковый запрос',
                    cssClass: 'admin-mode'
                };
            case 'participant':
            default:
                return {
                    title: 'Добавить участника',
                    placeholder: 'Введите имя пользователя для поиска...',
                    emptyStateIcon: '👥',
                    emptyStateTitle: 'Поиск участников',
                    emptyStateText: 'Введите имя пользователя, чтобы найти участников для турнира',
                    noResultsIcon: '🔍',
                    noResultsTitle: 'Пользователи не найдены',
                    noResultsText: 'Попробуйте изменить поисковый запрос',
                    cssClass: 'participant-mode'
                };
        }
    }, [mode]);

    // Фильтрованные результаты с исключением уже добавленных пользователей
    const filteredResults = useMemo(() => {
        if (!searchResults || !Array.isArray(searchResults)) return [];

        const existingIds = mode === 'admin' 
            ? existingAdmins.map(admin => admin.id || admin.user_id)
            : existingParticipants.map(participant => participant.user_id || participant.id);

        return searchResults.filter(user => !existingIds.includes(user.id));
    }, [searchResults, existingParticipants, existingAdmins, mode]);

    // Сброс локального состояния при открытии/закрытии модального окна
    useEffect(() => {
        if (isOpen) {
            setLocalQuery(searchQuery || '');
        } else {
            setLocalQuery('');
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
                setDebounceTimeout(null);
            }
        }
    }, [isOpen, searchQuery]);

    // Обработка изменения поискового запроса с дебаунсом
    const handleSearchChange = useCallback((e) => {
        const value = e.target.value;
        setLocalQuery(value);

        // Очищаем предыдущий таймаут
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }

        // Обновляем глобальное состояние и выполняем поиск с задержкой
        const newTimeout = setTimeout(() => {
            setSearchQuery(value);
            if (onSearch) {
                console.log('🔍 [ParticipantSearchModal] Выполняем поиск:', value);
                onSearch(value);
            } else {
                console.warn('🔍 [ParticipantSearchModal] onSearch не передан!');
            }
        }, 300); // 300ms задержка

        setDebounceTimeout(newTimeout);
    }, [debounceTimeout, setSearchQuery, onSearch]);

    // Очистка таймаута при размонтировании
    useEffect(() => {
        return () => {
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }
        };
    }, [debounceTimeout]);

    // Функция проверки, является ли пользователь уже участником/администратором
    const isUserAlreadyAdded = useCallback((userId) => {
        if (mode === 'admin') {
            return existingAdmins.some(admin => 
                (admin.id || admin.user_id) === userId
            );
        } else {
            return existingParticipants.some(participant => 
                (participant.user_id || participant.id) === userId
            );
        }
    }, [existingParticipants, existingAdmins, mode]);

    // Обработка приглашения пользователя
    const handleInvite = useCallback(async (userId, userName) => {
        console.log('🎯 [ParticipantSearchModal] handleInvite вызван:', { userId, userName, mode });
        console.log('🎯 [ParticipantSearchModal] onInvite:', typeof onInvite);
        console.log('🎯 [ParticipantSearchModal] onInviteAdmin:', typeof onInviteAdmin);
        
        try {
            if (mode === 'admin' && onInviteAdmin) {
                console.log('👑 [ParticipantSearchModal] Вызываем onInviteAdmin');
                await onInviteAdmin(userId, userName);
            } else if (mode === 'participant' && onInvite) {
                console.log('👥 [ParticipantSearchModal] Вызываем onInvite');
                await onInvite(userId, userName);
            } else {
                console.error('❌ [ParticipantSearchModal] Не найден подходящий обработчик!', {
                    mode,
                    hasOnInvite: !!onInvite,
                    hasOnInviteAdmin: !!onInviteAdmin
                });
            }
        } catch (error) {
            console.error('❌ [ParticipantSearchModal] Ошибка при приглашении пользователя:', error);
        }
    }, [mode, onInvite, onInviteAdmin]);

    // Закрытие модального окна
    const handleClose = useCallback(() => {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
            setDebounceTimeout(null);
        }
        setLocalQuery('');
        onClose();
    }, [debounceTimeout, onClose]);

    // Обработка нажатия Escape
    useEffect(() => {
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && isOpen) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
            return () => document.removeEventListener('keydown', handleEscapeKey);
        }
    }, [isOpen, handleClose]);

    // Обработка клика по overlay
    const handleOverlayClick = useCallback((e) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    }, [handleClose]);

    if (!isOpen) return null;

    return (
        <div className="search-modal-overlay" onClick={handleOverlayClick}>
            <div className={`search-modal-content ${modalConfig.cssClass}`} onClick={(e) => e.stopPropagation()}>
                {/* Заголовок модального окна */}
                <div className="search-modal-header">
                    <h3>{modalConfig.title}</h3>
                    <button 
                        className="close-search-modal"
                        onClick={handleClose}
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>

                {/* Поле поиска */}
                <div className="search-input-container">
                    <input
                        type="text"
                        className="search-input-field"
                        placeholder={modalConfig.placeholder}
                        value={localQuery}
                        onChange={handleSearchChange}
                        autoFocus
                    />
                </div>

                {/* Контейнер результатов */}
                <div className="search-results-container">
                    {/* Состояние загрузки */}
                    {isSearching && (
                        <div className="search-loading">
                            <div className="search-loading-icon">⏳</div>
                            <h4>Поиск пользователей...</h4>
                            <p>Пожалуйста, подождите</p>
                        </div>
                    )}

                    {/* Пустое состояние (нет запроса) */}
                    {!isSearching && !localQuery && (
                        <div className="search-placeholder">
                            <div className="search-placeholder-icon">{modalConfig.emptyStateIcon}</div>
                            <h4>{modalConfig.emptyStateTitle}</h4>
                            <p>{modalConfig.emptyStateText}</p>
                        </div>
                    )}

                    {/* Нет результатов */}
                    {!isSearching && localQuery && localQuery.length >= 2 && filteredResults.length === 0 && (
                        <div className="search-no-results">
                            <div className="search-no-results-icon">{modalConfig.noResultsIcon}</div>
                            <h4>{modalConfig.noResultsTitle}</h4>
                            <p>{modalConfig.noResultsText}</p>
                            {localQuery.length < 3 && (
                                <p><small>Минимальная длина запроса: 2 символа</small></p>
                            )}
                        </div>
                    )}

                    {/* Список результатов */}
                    {!isSearching && filteredResults.length > 0 && (
                        <div className="search-results-list">
                            {filteredResults.map((user) => {
                                const isAlreadyAdded = isUserAlreadyAdded(user.id);
                                
                                return (
                                    <div key={user.id} className="search-result-item">
                                        <div className="user-info">
                                            {/* Аватар пользователя */}
                                            <div className="user-avatar">
                                                {user.avatar_url ? (
                                                    <img 
                                                        src={ensureHttps(user.avatar_url)} 
                                                        alt={user.username || 'Пользователь'}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div 
                                                    className="avatar-placeholder"
                                                    style={{
                                                        display: user.avatar_url ? 'none' : 'flex'
                                                    }}
                                                >
                                                    {(user.username || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            </div>

                                            {/* Информация о пользователе */}
                                            <div className="user-details">
                                                <div className="user-name">
                                                    {user.username || `User #${user.id}`}
                                                </div>
                                                {(user.faceit_elo || user.cs2_premier_rank) && (
                                                    <div className="user-rating">
                                                        {user.faceit_elo && `${user.faceit_elo} ELO`}
                                                        {user.faceit_elo && user.cs2_premier_rank && ' • '}
                                                        {user.cs2_premier_rank && `Premier ${user.cs2_premier_rank}`}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Действия */}
                                        <div className="user-actions">
                                            {/* Кнопка просмотра профиля */}
                                            <Link 
                                                to={`/user/${user.id}`}
                                                className="action-button view-profile-btn"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                👤 Профиль
                                            </Link>

                                            {/* Кнопка приглашения */}
                                            {isAlreadyAdded ? (
                                                <button 
                                                    className="action-button already-participant-btn"
                                                    disabled
                                                >
                                                    {mode === 'admin' ? 'же администратор' : 'Уже участвует'}
                                                </button>
                                            ) : (
                                                <button 
                                                    className={`action-button ${mode === 'admin' ? 'admin-invite-btn' : 'add-participant-btn'}`}
                                                    onClick={() => {
                                                        // Проверяем, что username существует
                                                        const userName = user.username || `User${user.id}`;
                                                        console.log('🔘 [ParticipantSearchModal] Клик по кнопке приглашения!', {
                                                            userId: user.id,
                                                            userName: userName,
                                                            mode,
                                                            isAlreadyAdded
                                                        });
                                                        handleInvite(user.id, userName);
                                                    }}
                                                >
                                                    {mode === 'admin' ? 'Пригласить админом' : 'Пригласить в турнир'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Слишком много результатов (лимит) */}
                    {!isSearching && filteredResults.length >= 50 && (
                        <div className="search-too-many-results">
                            <p>Показаны первые 50 результатов. Уточните поисковый запрос для более точного поиска.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ParticipantSearchModal; 