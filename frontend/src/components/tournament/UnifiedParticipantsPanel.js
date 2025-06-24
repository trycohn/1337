/**
 * UnifiedParticipantsPanel v1.1.0 - Мультивидовое отображение участников турнира
 * 
 * @version 1.1.0 (Multi-View Display + Smart Features + Gaming Interfaces)
 * @created 2025-01-22
 * @updated 2025-01-27 (CSS Isolation)
 * @author 1337 Community Development Team
 * @purpose Унифицированная панель управления участниками с тремя видами отображения
 * @features Smart Cards + Data Table + Gaming Roster + Табы + Фильтры + Статистика
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import TeamGenerator from '../TeamGenerator';
import './UnifiedParticipantsPanel.css';

/**
 * 🎯 ГЛАВНЫЙ КОМПОНЕНТ: UnifiedParticipantsPanel v1.1.0
 * 
 * Унифицированная панель управления участниками турнира с табами, фильтрами, статистикой и 3 видами отображения.
 * Объединяет функциональность Варианта 1 (табы) с возможностями Варианта 2 (фильтры/статистика) + Multi-View Display.
 * 
 * @param {Object} props - Пропсы компонента
 * @param {Object} props.tournament - Объект турнира с информацией о турнире
 * @param {Array} props.participants - Массив участников турнира
 * @param {Array} props.matches - Массив матчей турнира
 * @param {Array} props.mixedTeams - Массив сгенерированных команд
 * @param {boolean} props.isCreatorOrAdmin - Права администратора/создателя
 * @param {string} props.ratingType - Тип рейтинга ('faceit' | 'cs2')
 * @param {Function} props.onRemoveParticipant - Обработчик удаления участника
 * @param {Function} props.onShowAddParticipantModal - Обработчик открытия модалки добавления
 * @param {Function} props.onShowParticipantSearchModal - Обработчик открытия модалки поиска
 * @param {Function} props.onTeamsGenerated - Обработчик генерации команд
 * @param {Function} props.onTeamsUpdated - Обработчик обновления команд
 * @param {Function} props.calculateTeamAverageRating - Функция расчета среднего рейтинга команды
 * @param {Function} props.setRatingType - Функция изменения типа рейтинга
 * @param {Object} props.user - Текущий пользователь
 * @param {Object} props.userPermissions - Права пользователя
 * @param {Function} props.handleParticipate - Обработчик участия в турнире
 * @param {Function} props.setMessage - Функция установки сообщений
 * @param {Function} props.onViewChange - Обработчик изменения вида отображения (новый)
 * @returns {JSX.Element} Унифицированная панель управления участниками
 */
const UnifiedParticipantsPanel = ({
    tournament,
    participants = [],
    matches = [],
    mixedTeams = [],
    isCreatorOrAdmin = false,
    ratingType = 'faceit',
    onRemoveParticipant,
    onShowAddParticipantModal,
    onShowParticipantSearchModal,
    onTeamsGenerated,
    onTeamsUpdated,
    calculateTeamAverageRating,
    setRatingType,
    user,
    userPermissions,
    handleParticipate,
    setMessage,
    displayMode = 'smart-cards',
    onViewChange
}) => {
    // 🔧 ФУНКЦИЯ ДЛЯ ПРАВИЛЬНОГО РАСЧЕТА РЕЙТИНГА УЧАСТНИКА КОМАНДЫ
    const getCorrectMemberRating = useCallback((member, ratingType) => {
        if (ratingType === 'faceit') {
            // Приоритет: кастомный ELO → пользовательский ELO → faceit_rating → user_faceit_rating → дефолт
            if (member.faceit_elo && !isNaN(parseInt(member.faceit_elo)) && parseInt(member.faceit_elo) > 0) {
                return parseInt(member.faceit_elo);
            } else if (member.user_faceit_elo && !isNaN(parseInt(member.user_faceit_elo)) && parseInt(member.user_faceit_elo) > 0) {
                return parseInt(member.user_faceit_elo);
            } else if (member.faceit_rating && !isNaN(parseInt(member.faceit_rating)) && parseInt(member.faceit_rating) > 0) {
                return parseInt(member.faceit_rating);
            } else if (member.user_faceit_rating && !isNaN(parseInt(member.user_faceit_rating)) && parseInt(member.user_faceit_rating) > 0) {
                return parseInt(member.user_faceit_rating);
            }
            return 1000; // дефолт для FACEIT
        } else {
            // Приоритет: кастомный ранг → пользовательский ранг → premier_rank → user_premier_rank → дефолт
            if (member.cs2_premier_rank && !isNaN(parseInt(member.cs2_premier_rank)) && parseInt(member.cs2_premier_rank) > 0) {
                return parseInt(member.cs2_premier_rank);
            } else if (member.premier_rank && !isNaN(parseInt(member.premier_rank)) && parseInt(member.premier_rank) > 0) {
                return parseInt(member.premier_rank);
            } else if (member.user_premier_rank && !isNaN(parseInt(member.user_premier_rank)) && parseInt(member.user_premier_rank) > 0) {
                return parseInt(member.user_premier_rank);
            } else if (member.premier_rating && !isNaN(parseInt(member.premier_rating)) && parseInt(member.premier_rating) > 0) {
                return parseInt(member.premier_rating);
            } else if (member.user_premier_rating && !isNaN(parseInt(member.user_premier_rating)) && parseInt(member.user_premier_rating) > 0) {
                return parseInt(member.user_premier_rating);
            }
            return 5; // дефолт для Premier
        }
    }, []);

    // 🎯 ОСНОВНЫЕ СОСТОЯНИЯ
    const [activeTab, setActiveTab] = useState('current');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterRating, setFilterRating] = useState('all');

    // 🎯 ДОСТУПНЫЕ ВИДЫ ОТОБРАЖЕНИЯ
    const displayModes = [
        {
            id: 'smart-cards',
            label: '📱 Smart Cards',
            description: 'Современные карточки с богатым контентом и анимациями',
            icon: '🃏'
        },
        {
            id: 'data-table', 
            label: '📊 Data Table',
            description: 'Профессиональная таблица данных с сортировкой',
            icon: '📋'
        },
        {
            id: 'gaming-roster',
            label: '🎮 Gaming Roster', 
            description: 'Геймифицированный интерфейс в стиле TCG/RPG игр',
            icon: '⚡'
        }
    ];

    // 🎯 УТИЛИТАРНЫЕ ФУНКЦИИ (ПЕРЕМЕЩЕНЫ ВЫШЕ ДЛЯ ИСПРАВЛЕНИЯ use-before-define)
    const getRating = useCallback((participant) => {
        if (ratingType === 'faceit') {
            return parseInt(participant.faceit_elo) || 0;
        } else {
            return parseInt(participant.cs2_premier_rank) || 0;
        }
    }, [ratingType]);

    const getStatusFromRating = useCallback((rating) => {
        if (rating > 2000) return 'high';
        if (rating > 1200) return 'medium';
        return 'low';
    }, []);

    const getOnlineStatus = useCallback((participant) => {
        // Заглушка для определения онлайн статуса
        return Math.random() > 0.5 ? 'online' : 'offline';
    }, []);

    const getAchievements = useCallback((participant) => {
        // Заглушка для количества достижений
        return Math.floor(Math.random() * 20);
    }, []);

    const getWins = useCallback((participant) => {
        // Заглушка для количества побед
        return Math.floor(Math.random() * 50);
    }, []);

    const getTournaments = useCallback((participant) => {
        // Заглушка для количества турниров
        return Math.floor(Math.random() * 10);
    }, []);

    // 🆕 ОБРАБОТЧИКИ ФИЛЬТРОВ
    const handleFilterChange = useCallback((filterType, value) => {
        switch (filterType) {
            case 'search':
                setSearchQuery(value);
                break;
            case 'sortBy':
                setSortBy(value);
                break;
            case 'status':
                setFilterStatus(value);
                break;
            case 'rating':
                setFilterRating(value);
                break;
            default:
                break;
        }
    }, []);

    const handleResetFilters = useCallback(() => {
        setSearchQuery('');
        setSortBy('name');
        setFilterStatus('all');
        setFilterRating('all');
    }, []);

    const handleTabChange = useCallback((tabId) => {
        setActiveTab(tabId);
    }, []);

    // 🎯 ОБРАБОТКА ДАННЫХ УЧАСТНИКОВ
    const processedParticipants = useMemo(() => {
        let result = [...participants];

        // Поиск
        if (searchQuery.trim()) {
            result = result.filter(p => 
                p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.username?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Фильтр по статусу
        if (filterStatus !== 'all') {
            result = result.filter(p => {
                const rating = getRating(p);
                const status = getStatusFromRating(rating);
                return status === filterStatus;
            });
        }

        // Фильтр по рейтингу
        if (filterRating !== 'all') {
            result = result.filter(p => {
                const rating = getRating(p);
                switch (filterRating) {
                    case 'high': return rating > 2000;
                    case 'medium': return rating >= 1200 && rating <= 2000;
                    case 'low': return rating < 1200;
                    default: return true;
                }
            });
        }

        // Сортировка
        result.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    const nameA = a.name || a.username || '';
                    const nameB = b.name || b.username || '';
                    return nameA.localeCompare(nameB);
                case 'rating':
                    return getRating(b) - getRating(a);
                default:
                    return 0;
            }
        });

        return result;
    }, [participants, searchQuery, sortBy, filterStatus, filterRating, getRating, getStatusFromRating]);

    // 🎯 ВЫЧИСЛЕНИЯ ДЛЯ СТАТИСТИКИ
    const statistics = useMemo(() => {
        const total = participants.length;
        const registered = participants.filter(p => p.user_id).length;
        const unregistered = total - registered;
        
        const ratings = participants.map(p => getRating(p)).filter(r => r > 0);
        const averageRating = ratings.length > 0 
            ? Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length)
            : 0;

        const highRated = participants.filter(p => getRating(p) > 2000).length;
        const mediumRated = participants.filter(p => {
            const rating = getRating(p);
            return rating >= 1200 && rating <= 2000;
        }).length;
        const lowRated = participants.filter(p => getRating(p) < 1200).length;

        return {
            total,
            registered,
            unregistered,
            averageRating,
            highRated,
            mediumRated,
            lowRated
        };
    }, [participants, getRating]);

    const capacityInfo = useMemo(() => {
        const current = participants.length;
        const max = tournament?.max_participants || null;
        const percentage = max ? Math.round((current / max) * 100) : 0;
        
        return {
            current,
            max,
            percentage,
            isFull: max ? current >= max : false,
            remaining: max ? Math.max(0, max - current) : null
        };
    }, [participants.length, tournament?.max_participants]);

    // 🎯 ФУНКЦИИ РЕНДЕРИНГА ВИДОВ ОТОБРАЖЕНИЯ
    const renderSmartCards = useCallback((participantsToRender) => {
        if (participantsToRender.length === 0) {
            return (
                <div className="empty-participants-state-participants-list">
                    <div className="no-participants-participants-list">
                        <div className="no-participants-icon-participants-list">👥</div>
                        <h4>Нет участников</h4>
                        <p>Участники появятся здесь после регистрации в турнире</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="smart-cards-grid-participants-list">
                {participantsToRender.map((participant) => {
                    const rating = getRating(participant);
                    const isOnline = getOnlineStatus(participant) === 'online';
                    const achievements = getAchievements(participant);
                    
                    return (
                        <div key={participant.id} className="smart-participant-card-participants-list">
                            {/* Аватар секция */}
                            <div className="smart-avatar-section-participants-list">
                                <div className="smart-avatar-container-participants-list">
                                    <img 
                                        src={participant.avatar_url || '/default-avatar.png'} 
                                        alt={participant.name}
                                        className="smart-avatar-participants-list"
                                    />
                                    <div className={`online-indicator-participants-list ${isOnline ? 'online' : 'offline'}`}></div>
                                    {achievements > 10 && <div className="achievement-crown-participants-list">👑</div>}
                                </div>
                            </div>

                            {/* Информация участника */}
                            <div className="smart-participant-info-participants-list">
                                <div className="smart-name-section-participants-list">
                                    {participant.user_id ? (
                                        <Link to={`/profile/${participant.user_id}`} className="smart-participant-name-participants-list">
                                            {participant.name}
                                        </Link>
                                    ) : (
                                        <span className="smart-participant-name-participants-list">{participant.name}</span>
                                    )}
                                    <div className="smart-rating-display-participants-list">
                                        <div className={`rating-badge-participants-list ${getStatusFromRating(rating)}`}>
                                            ⭐ {rating}
                                        </div>
                                    </div>
                                </div>

                                {/* Мини-статистика */}
                                <div className="smart-mini-stats-participants-list">
                                    <div className="stat-chip-participants-list">
                                        <span className="stat-icon-participants-list">🏆</span>
                                        <span className="stat-value-participants-list">{achievements}</span>
                                    </div>
                                    <div className="stat-chip-participants-list">
                                        <span className="stat-icon-participants-list">⚡</span>
                                        <span className="stat-value-participants-list">{isOnline ? 'Онлайн' : 'Офлайн'}</span>
                                    </div>
                                </div>

                                {/* Прогресс рейтинга */}
                                {rating > 0 && (
                                    <div className="rating-progress-participants-list">
                                        <div className="progress-bar-participants-list">
                                            <div 
                                                className="progress-fill-participants-list"
                                                style={{ width: `${Math.min((rating / 3000) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="progress-text-participants-list">{rating}/3000</span>
                                    </div>
                                )}
                            </div>

                            {/* Действия */}
                            {isCreatorOrAdmin && (
                                <div className="smart-actions-participants-list">
                                    <button 
                                        className="smart-remove-btn-participants-list"
                                        onClick={() => onRemoveParticipant(participant.id)}
                                        title="Удалить участника"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }, [getRating, getStatusFromRating, getOnlineStatus, getAchievements, isCreatorOrAdmin, onRemoveParticipant]);

    const renderDataTable = useCallback((participantsToRender) => {
        if (participantsToRender.length === 0) {
            return (
                <div className="empty-participants-state-participants-list">
                    <div className="no-participants-participants-list">
                        <div className="no-participants-icon-participants-list">📊</div>
                        <h4>Нет данных для отображения</h4>
                        <p>Таблица будет заполнена после добавления участников</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="data-table-container-participants-list">
                <div className="table-responsive-participants-list">
                    <table className="participants-data-table-participants-list">
                        <thead>
                            <tr>
                                <th className="avatar-col">
                                    Фото
                                </th>
                                <th className="name-col sortable" onClick={() => handleFilterChange('sortBy', 'name')}>
                                    Имя {sortBy === 'name' && '↕️'}
                                </th>
                                <th className="status-col">Статус</th>
                                <th className="rating-col sortable" onClick={() => handleFilterChange('sortBy', 'rating')}>
                                    Рейтинг {sortBy === 'rating' && '↕️'}
                                </th>
                                <th className="stats-col">Статистика</th>
                                {isCreatorOrAdmin && <th className="actions-col">Действия</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {participantsToRender.map((participant) => {
                                const rating = getRating(participant);
                                const status = getStatusFromRating(rating);
                                const wins = getWins(participant);
                                const tournaments = getTournaments(participant);

                                return (
                                    <tr key={participant.id} className="table-row">
                                        <td className="avatar-cell">
                                            <img 
                                                src={participant.avatar_url || '/default-avatar.png'} 
                                                alt={participant.name}
                                                className="table-avatar-participants-list"
                                            />
                                        </td>
                                        <td className="name-cell">
                                            {participant.user_id ? (
                                                <Link to={`/profile/${participant.user_id}`} className="table-participant-name-participants-list">
                                                    {participant.name}
                                                </Link>
                                            ) : (
                                                <span className="table-participant-name-participants-list guest">{participant.name}</span>
                                            )}
                                        </td>
                                        <td className="status-cell">
                                            {participant.user_id ? 'Зарегистрирован' : 'Гость'}
                                        </td>
                                        <td className="rating-cell">
                                            <span className={`table-rating-participants-list ${status}`}>
                                                {rating || 'Н/Д'}
                                            </span>
                                        </td>
                                        <td className="stats-cell">
                                            <div className="table-stats-participants-list">
                                                <span className="wins-stat-participants-list">🏆 {wins}</span>
                                                <span className="tournaments-stat-participants-list">🎮 {tournaments}</span>
                                            </div>
                                        </td>
                                        {isCreatorOrAdmin && (
                                            <td className="actions-cell">
                                                <button 
                                                    className="table-remove-btn-participants-list"
                                                    onClick={() => onRemoveParticipant(participant.id)}
                                                    title="Удалить участника"
                                                >
                                                    Удалить
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, [handleFilterChange, sortBy, getRating, getStatusFromRating, getWins, getTournaments, isCreatorOrAdmin, onRemoveParticipant]);

    const renderGamingRoster = useCallback((participantsToRender) => {
        if (participantsToRender.length === 0) {
            return (
                <div className="empty-participants-state-participants-list">
                    <div className="no-participants-participants-list">
                        <div className="no-participants-icon-participants-list">⚡</div>
                        <h4>Пустая гильдия</h4>
                        <p>Ваша гильдия станет могущественной после призыва воинов</p>
                    </div>
                </div>
            );
        }

        // Вычисляем данные для геймификации
        const participantsWithGameData = participantsToRender.map((participant, index) => {
            const rating = getRating(participant);
            const powerLevel = rating || 1000;
            
            // Определяем редкость на основе рейтинга
            let rarity = 'common';
            if (powerLevel > 2500) rarity = 'legendary';
            else if (powerLevel > 2000) rarity = 'epic';
            else if (powerLevel > 1500) rarity = 'rare';

            // Топ-3 игрока получают особый статус
            const isTopPlayer = index < 3;

            return {
                ...participant,
                powerLevel,
                rarity,
                isTopPlayer
            };
        });

        const totalPower = participantsWithGameData.reduce((sum, p) => sum + p.powerLevel, 0);

        return (
            <div className="gaming-roster-container-participants-list">
                {/* Заголовок ростера */}
                <div className="roster-header-participants-list">
                    <h3 className="roster-title-participants-list">⚔️ Tournament Champions ⚔️</h3>
                    <div className="power-level-indicator-participants-list">
                        Суммарная мощь: <span className="total-power-participants-list">{totalPower.toLocaleString()}</span>
                    </div>
                </div>

                {/* Сетка игровых карт */}
                <div className="gaming-cards-grid-participants-list">
                    {participantsWithGameData.map((participant, index) => {
                        const { powerLevel, rarity, isTopPlayer } = participant;

                        return (
                            <div 
                                key={participant.id} 
                                className={`gaming-card-participants-list ${rarity} ${isTopPlayer ? 'top-player' : ''}`}
                            >
                                {/* Рамка редкости */}
                                <div className="rarity-frame-participants-list">
                                    <div className="rarity-corners-participants-list">
                                        <div className="corner-participants-list top-left"></div>
                                        <div className="corner-participants-list top-right"></div>
                                        <div className="corner-participants-list bottom-left"></div>
                                        <div className="corner-participants-list bottom-right"></div>
                                    </div>
                                </div>

                                {/* Индикатор ранга */}
                                <div className="rank-indicator-participants-list">
                                    <span className="rank-number-participants-list">#{index + 1}</span>
                                    <span className="rarity-label-participants-list">{rarity.toUpperCase()}</span>
                                </div>

                                {/* Аватар с эффектами */}
                                <div className="gaming-avatar-container-participants-list">
                                    <div className={`avatar-glow-participants-list ${rarity}`}></div>
                                    <img 
                                        src={participant.avatar_url || '/default-avatar.png'} 
                                        alt={participant.name}
                                        className="gaming-avatar-participants-list"
                                    />
                                    {isTopPlayer && <div className="crown-effect-participants-list">👑</div>}
                                </div>

                                {/* Информация игрока */}
                                <div className="gaming-player-info-participants-list">
                                    <div className="player-name-section-participants-list">
                                        {participant.user_id ? (
                                            <Link to={`/profile/${participant.user_id}`} className="gaming-player-name-participants-list">
                                                {participant.name}
                                            </Link>
                                        ) : (
                                            <span className="gaming-player-name-participants-list guest">{participant.name}</span>
                                        )}
                                    </div>

                                    {/* Power Level */}
                                    <div className="power-level-section-participants-list">
                                        <div className="power-label-participants-list">POWER LEVEL</div>
                                        <div className="power-value-participants-list">{powerLevel.toLocaleString()}</div>
                                        <div className="power-bar-participants-list">
                                            <div 
                                                className="power-fill-participants-list"
                                                style={{ width: `${Math.min((powerLevel / 3000) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* RPG статистика */}
                                    <div className="gaming-stats-participants-list">
                                        <div className="stat-row-participants-list">
                                            <span className="stat-name-participants-list">ATK</span>
                                            <span className="stat-value-participants-list">{Math.floor(powerLevel / 50)}</span>
                                        </div>
                                        <div className="stat-row-participants-list">
                                            <span className="stat-name-participants-list">DEF</span>
                                            <span className="stat-value-participants-list">{Math.floor(powerLevel / 60)}</span>
                                        </div>
                                        <div className="stat-row-participants-list">
                                            <span className="stat-name-participants-list">SPD</span>
                                            <span className="stat-value-participants-list">{Math.floor(powerLevel / 40)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Действия */}
                                {isCreatorOrAdmin && (
                                    <div className="gaming-actions-participants-list">
                                        <button 
                                            className="gaming-remove-btn-participants-list"
                                            onClick={() => onRemoveParticipant(participant.id)}
                                            title="Изгнать из гильдии"
                                        >
                                            ИЗГНАТЬ
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }, [getRating, isCreatorOrAdmin, onRemoveParticipant]);

    // 🎯 ОСНОВНЫЕ ФУНКЦИИ РЕНДЕРИНГА
    const renderCurrentParticipants = useCallback(() => {
        return (
            <div className="current-participants-tab-participants-list">
                {/* Элементы управления */}
                <div className="participants-controls-participants-list">
                    <div className="search-and-filters-participants-list">
                        <div className="search-section-participants-list">
                            <input
                                type="text"
                                className="participants-search-input-participants-list"
                                placeholder="🔍 Поиск по имени участника..."
                                value={searchQuery}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                            />
                        </div>
                        
                        <div className="filters-section-participants-list">
                            <select 
                                className="filter-select-participants-list"
                                value={filterStatus}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                            >
                                <option value="all">Все статусы</option>
                                <option value="high">Высокий рейтинг</option>
                                <option value="medium">Средний рейтинг</option>
                                <option value="low">Низкий рейтинг</option>
                            </select>

                            <select 
                                className="filter-select-participants-list"
                                value={filterRating}
                                onChange={(e) => handleFilterChange('rating', e.target.value)}
                            >
                                <option value="all">Все рейтинги</option>
                                <option value="high">2000+ ELO</option>
                                <option value="medium">1200-2000 ELO</option>
                                <option value="low">Меньше 1200 ELO</option>
                            </select>

                            {/* 🆕 Селектор вида отображения */}
                            <select 
                                className="display-mode-select-participants-list"
                                value={displayMode}
                                onChange={(e) => onViewChange && onViewChange(e.target.value)}
                            >
                                {displayModes.map(mode => (
                                    <option key={mode.id} value={mode.id}>
                                        {mode.icon} {mode.label}
                                    </option>
                                ))}
                            </select>

                            {(searchQuery || filterStatus !== 'all' || filterRating !== 'all') && (
                                <button 
                                    className="clear-filters-btn-participants-list"
                                    onClick={handleResetFilters}
                                    title="Очистить все фильтры"
                                >
                                    Сбросить
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Итоги фильтрации */}
                    <div className="results-summary-participants-list">
                        <span className="filtered-indicator-participants-list">
                            📊 Показано: {processedParticipants.length} из {participants.length} участников
                        </span>
                        {(searchQuery || filterStatus !== 'all' || filterRating !== 'all') && (
                            <span> • Фильтры активны</span>
                        )}
                    </div>
                </div>

                {/* 🆕 Область отображения с переключением видов */}
                {!(tournament?.format === 'mix' && mixedTeams?.length > 0) && (
                    <div className={`participants-display-area-participants-list display-mode-${displayMode}`}>
                        {displayMode === 'smart-cards' && renderSmartCards(processedParticipants)}
                        {displayMode === 'data-table' && renderDataTable(processedParticipants)}
                        {displayMode === 'gaming-roster' && renderGamingRoster(processedParticipants)}
                    </div>
                )}

                {/* 🎯 ИНФОРМАЦИЯ ДЛЯ МИКС ТУРНИРОВ С КОМАНДАМИ */}
                {(tournament?.format === 'mix' && mixedTeams?.length > 0) && (
                    <div className="mix-teams-info-participants-list">
                        <div className="info-card-participants-list">
                            
                            <div className="info-content-participants-list">
                                <h4>Команды сформированы!</h4>
                                <p>Все участники разделены на команды. Подробную информацию о командах и составах смотрите в блоке ниже.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🎯 МИКС ТУРНИРЫ: TeamGenerator для формирования и отображения команд */}
                {tournament?.format === 'mix' && (
                    <div className="mix-tournament-section-participants-list">
                        <TeamGenerator
                            tournament={tournament}
                            participants={participants}
                            onTeamsGenerated={onTeamsGenerated}
                            onTeamsUpdated={onTeamsUpdated}
                            onRemoveParticipant={onRemoveParticipant}
                            isAdminOrCreator={isCreatorOrAdmin}
                        />
                    </div>
                )}

                {/* Заглушка если нет участников */}
                {participants.length === 0 && (
                    <div className="empty-participants-state-participants-list">
                        <div className="no-participants-participants-list">
                            <div className="no-participants-icon-participants-list">👥</div>
                            <h4>Пока нет участников</h4>
                            <p>Станьте первым участником турнира или пригласите друзей!</p>
                            {!userPermissions?.isParticipating && user && (
                                <button 
                                    className="btn btn-primary"
                                    onClick={handleParticipate}
                                >
                                    🎯 Участвовать
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }, [
        searchQuery,
        filterStatus, 
        filterRating,
        displayMode,
        processedParticipants,
        participants.length,
        userPermissions?.isParticipating,
        user,
        handleFilterChange,
        handleResetFilters,
        onViewChange,
        renderSmartCards,
        renderDataTable,
        renderGamingRoster,
        handleParticipate,
        // 🎯 НОВЫЕ ЗАВИСИМОСТИ ДЛЯ МИКС ТУРНИРОВ
        tournament?.format,
        mixedTeams?.length,
        onTeamsGenerated,
        onTeamsUpdated,
        onRemoveParticipant,
        isCreatorOrAdmin
    ]);

    const renderAddParticipants = useCallback(() => {
        const canManageParticipants = isCreatorOrAdmin && 
            tournament?.status === 'active' && 
            (!matches || matches.length === 0);

        if (!canManageParticipants) {
            return (
                <div className="add-participants-tab-participants-list">
                    <div className="management-blocked-notice-participants-list">
                        <div className="blocked-icon-participants-list">🚫</div>
                        <div className="blocked-content-participants-list">
                            <h5>Управление участниками недоступно</h5>
                            <p>
                                {!isCreatorOrAdmin && "У вас нет прав для управления участниками этого турнира."}
                                {isCreatorOrAdmin && tournament?.status !== 'active' && "Управление участниками доступно только для активных турниров."}
                                {isCreatorOrAdmin && tournament?.status === 'active' && matches?.length > 0 && "Нельзя добавлять участников после создания турнирной сетки."}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="add-participants-tab-participants-list">
                <div className="add-participants-header-participants-list">
                    <h4>Добавить участников</h4>
                    <p>Выберите способ добавления новых участников в турнир</p>
                </div>

                <div className="add-participants-options-participants-list">
                    {/* Поиск зарегистрированных пользователей */}
                    <div className="add-option-card-participants-list">
                        <div className="option-icon-participants-list">👤</div>
                        <div className="option-content-participants-list">
                            <h5>Зарегистрированные пользователи</h5>
                            <p>Найдите и добавьте пользователей, которые уже зарегистрированы на платформе</p>
                            <button 
                                className="add-option-btn-participants-list primary"
                                onClick={onShowParticipantSearchModal}
                            >
                                🔍 Найти пользователей
                            </button>
                        </div>
                    </div>

                    {/* Добавление незарегистрированных участников */}
                    <div className="add-option-card-participants-list">
                        <div className="option-icon-participants-list">✏️</div>
                        <div className="option-content-participants-list">
                            <h5>Незарегистрированные участники</h5>
                            <p>Добавьте участников вручную, указав их игровые данные</p>
                            <button 
                                className="add-option-btn-participants-list secondary"
                                onClick={onShowAddParticipantModal}
                            >
                                ➕ Добавить вручную
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [isCreatorOrAdmin, tournament?.status, matches, onShowParticipantSearchModal, onShowAddParticipantModal]);

    const renderTeams = useCallback(() => {
        if (!mixedTeams || mixedTeams.length === 0) {
            return (
                <div className="teams-tab-participants-list">
                    <div className="teams-header-participants-list">
                        <h4>Команды турнира</h4>
                        <p>Здесь будут отображены сформированные команды</p>
                    </div>
                    
                    <div className="no-teams-state-participants-list">
                        <div className="no-teams-icon-participants-list">⚽</div>
                        <h4>Команды не сформированы</h4>
                        <p>
                            {tournament?.format === 'mix' 
                                ? "Команды будут сформированы автоматически во вкладке 'Участники'"
                                : "Команды появятся после их создания администратором турнира"
                            }
                        </p>
                        {tournament?.format === 'mix' && (
                            <p className="mix-teams-hint">
                                💡 Для формирования команд перейдите во вкладку "Участники"
                            </p>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="teams-tab-participants-list">
                <div className="teams-header-participants-list">
                    <h4>Команды турнира ({mixedTeams.length})</h4>
                    <p>
                        {tournament?.format === 'mix' 
                            ? "Автоматически сформированные команды на основе рейтинга участников"
                            : "Команды турнира"
                        }
                    </p>
                </div>

                {/* 🎯 СТАТИСТИКА КОМАНД */}
                <div className="teams-stats-participants-list">
                    <div className="team-stat-participants-list">
                        <span className="stat-label-participants-list">Всего команд:</span>
                        <span className="stat-value-participants-list">{mixedTeams.length}</span>
                    </div>
                    <div className="team-stat-participants-list">
                        <span className="stat-label-participants-list">Игроков в командах:</span>
                        <span className="stat-value-participants-list">
                            {mixedTeams.reduce((total, team) => total + (team.members?.length || 0), 0)}
                        </span>
                    </div>
                    <div className="team-stat-participants-list">
                        <span className="stat-label-participants-list">Средний рейтинг:</span>
                        <span className="stat-value-participants-list">
                            {mixedTeams.length > 0 ? Math.round(
                                mixedTeams.reduce((sum, team) => {
                                    const teamRating = calculateTeamAverageRating ? calculateTeamAverageRating(team) : 0;
                                    return sum + teamRating;
                                }, 0) / mixedTeams.length
                            ) : 0}
                        </span>
                    </div>
                </div>

                <div className="teams-grid-participants-list">
                    {mixedTeams.map((team, index) => (
                        <div key={team.id || index} className="team-card-unified-participants-list enhanced">
                            <div className="team-header-participants-list">
                                <div className="team-title-section-participants-list">
                                    <h5>{team.name || `Команда ${index + 1}`}</h5>
                                    <span className="team-members-count-participants-list">
                                        👥 {team.members?.length || 0} участников
                                    </span>
                                </div>
                                <div className="team-rating-participants-list enhanced">
                                    <span className="rating-label-participants-list">
                                        {ratingType === 'faceit' ? 'FACEIT' : 'Premier'}:
                                    </span>
                                    <span className="rating-value-participants-list">
                                        {calculateTeamAverageRating ? calculateTeamAverageRating(team) : '—'}
                                    </span><br></br>
                                    <span className="rating-suffix-participants-list">ELO</span>
                                </div>
                            </div>
                            
                            {/* 🎯 СОСТАВ КОМАНДЫ */}
                            <div className="team-composition-participants-list">
                                <h6>👥 Состав:</h6>
                                {team.members && team.members.length > 0 ? (
                                    <div className="team-members-participants-list">
                                        {team.members.map((member, memberIndex) => (
                                            <div key={memberIndex} className="team-member-participants-list enhanced">
                                                <div className="member-avatar-participants-list">
                                                    <img 
                                                        src={member.avatar_url || '/default-avatar.png'} 
                                                        alt={member.name}
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = '/default-avatar.png';
                                                        }}
                                                    />
                                                </div>
                                                <div className="member-info-participants-list">
                                                    <div className="member-name-participants-list">
                                                        {member.user_id ? (
                                                            <a href={`/profile/${member.user_id}`}>
                                                                {member.name || member.username}
                                                            </a>
                                                        ) : (
                                                            <span>{member.name}</span>
                                                        )}
                                                    </div>
                                                    <div className="member-rating-participants-list">
                                                        {ratingType === 'faceit' 
                                                            ? `${getCorrectMemberRating(member, 'faceit')} ELO`
                                                            : `Ранг ${getCorrectMemberRating(member, 'premier')}`
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="no-members-participants-list">Состав команды не определен</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 🎯 ПРИМЕЧАНИЕ ДЛЯ МИКС ТУРНИРОВ */}
                {tournament?.format === 'mix' && (
                    <div className="mix-teams-management-note">
                        <div className="note-icon">💡</div>
                        <div className="note-content">
                            <h6>Управление командами</h6>
                            <p>Для создания или редактирования команд перейдите во вкладку "Участники"</p>
                        </div>
                    </div>
                )}
            </div>
        );
    }, [
        mixedTeams, 
        tournament?.format, 
        isCreatorOrAdmin, 
        participants, 
        onTeamsGenerated, 
        onTeamsUpdated, 
        onRemoveParticipant, 
        calculateTeamAverageRating,
        getRating,
        ratingType
    ]);

    const renderStatistics = useCallback(() => {
        return (
            <div className="statistics-tab-participants-list">
                <div className="statistics-header-participants-list">
                    <h4>Статистика участников</h4>
                    <p>Детальная аналитика по участникам турнира</p>
                </div>

                <div className="statistics-grid-participants-list">
                    <div className="stat-card-participants-list">
                        <div className="stat-icon-participants-list">👥</div>
                        <div className="stat-content-participants-list">
                            <div className="stat-value-participants-list">{statistics.total}</div>
                            <div className="stat-label-participants-list">Всего участников</div>
                        </div>
                    </div>

                    <div className="stat-card-participants-list">
                        <div className="stat-icon-participants-list">✅</div>
                        <div className="stat-content-participants-list">
                            <div className="stat-value-participants-list">{statistics.registered}</div>
                            <div className="stat-label-participants-list">Зарегистрированные</div>
                        </div>
                    </div>

                    <div className="stat-card-participants-list">
                        <div className="stat-icon-participants-list">👤</div>
                        <div className="stat-content-participants-list">
                            <div className="stat-value-participants-list">{statistics.unregistered}</div>
                            <div className="stat-label-participants-list">Гости</div>
                        </div>
                    </div>

                    <div className="stat-card-participants-list">
                        <div className="stat-icon-participants-list">📊</div>
                        <div className="stat-content-participants-list">
                            <div className="stat-value-participants-list">{statistics.averageRating}</div>
                            <div className="stat-label-participants-list">Средний рейтинг</div>
                        </div>
                    </div>

                    <div className="stat-card-participants-list">
                        <div className="stat-icon-participants-list">🔥</div>
                        <div className="stat-content-participants-list">
                            <div className="stat-value-participants-list">{statistics.highRated}</div>
                            <div className="stat-label-participants-list">Высокий рейтинг</div>
                        </div>
                    </div>

                    <div className="stat-card-participants-list">
                        <div className="stat-icon-participants-list">⚖️</div>
                        <div className="stat-content-participants-list">
                            <div className="stat-value-participants-list">{statistics.mediumRated}</div>
                            <div className="stat-label-participants-list">Средний рейтинг</div>
                        </div>
                    </div>

                    <div className="stat-card-participants-list">
                        <div className="stat-icon-participants-list">🌱</div>
                        <div className="stat-content-participants-list">
                            <div className="stat-value-participants-list">{statistics.lowRated}</div>
                            <div className="stat-label-participants-list">Низкий рейтинг</div>
                        </div>
                    </div>
                </div>

                {/* Индикатор заполненности */}
                {capacityInfo.max && (
                    <div className="capacity-indicator-participants-list">
                        <div className="capacity-header-participants-list">
                            <span>Заполненность турнира</span>
                            <span>{capacityInfo.current} / {capacityInfo.max}</span>
                        </div>
                        <div className="capacity-bar-participants-list">
                            <div 
                                className="capacity-fill-participants-list"
                                style={{ width: `${capacityInfo.percentage}%` }}
                            ></div>
                        </div>
                        <div className="capacity-status-participants-list">
                            {capacityInfo.isFull ? (
                                <div className="status-full-participants-list">
                                    🚫 Турнир заполнен
                                </div>
                            ) : (
                                <div className="status-available-participants-list">
                                    ✅ Осталось мест: {capacityInfo.remaining}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }, [statistics, capacityInfo]);

    // 🎯 ОСНОВНОЙ РЕНДЕР КОМПОНЕНТА
    const tabs = useMemo(() => [
        {
            id: 'current',
            label: 'Участники',
            icon: '👥',
            count: participants.length,
            render: renderCurrentParticipants
        },
        {
            id: 'add',
            label: 'Добавить',
            icon: '➕',
            render: renderAddParticipants,
            disabled: !isCreatorOrAdmin
        },
        {
            id: 'teams',
            label: 'Команды',
            icon: '⚽',
            count: mixedTeams?.length || 0,
            render: renderTeams,
            hidden: tournament?.format === 'mix' || (!mixedTeams || mixedTeams.length === 0)
        },
        {
            id: 'statistics',
            label: 'Статистика',
            icon: '📊',
            render: renderStatistics
        }
    ], [
        participants.length,
        mixedTeams?.length,
        tournament?.format,
        isCreatorOrAdmin,
        renderCurrentParticipants,
        renderAddParticipants,
        renderTeams,
        renderStatistics
    ]);

    const visibleTabs = useMemo(() => 
        tabs.filter(tab => !tab.hidden),
        [tabs]
    );

    return (
        <div className="unified-participants-panel-participants-list">
            {/* Навигация по табам */}
            <nav className="unified-tabs-navigation-participants-list">
                {visibleTabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`unified-tab-btn-participants-list ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
                        onClick={() => !tab.disabled && handleTabChange(tab.id)}
                        disabled={tab.disabled}
                    >
                        <span className="tab-icon-participants-list">{tab.icon}</span>
                        <span className="tab-label-participants-list">{tab.label}</span>
                        {typeof tab.count === 'number' && (
                            <span className="tab-count-participants-list">{tab.count}</span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Содержимое активного таба */}
            <div className="unified-tab-content-participants-list">
                {visibleTabs.find(tab => tab.id === activeTab)?.render()}
            </div>
        </div>
    );
};

export default UnifiedParticipantsPanel; 