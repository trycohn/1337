/**
 * UnifiedParticipantsPanel v1.1.0 - Унифицированная панель управления участниками
 * 
 * @version 1.1.0 (Multi-View Display + Enhanced UX)
 * @created 2025-01-22
 * @updated 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Объединение управления участниками с табами, фильтрами и статистикой + 3 вида отображения
 * @features Табы, фильтры, статистика, поиск, управление участниками, Smart Cards, Data Table, Gaming Roster
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ensureHttps } from '../../utils/userHelpers';
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
    // Дополнительные пропсы для команд
    onTeamsGenerated,
    onTeamsUpdated,
    calculateTeamAverageRating,
    // Дополнительные пропсы для полной совместимости
    setRatingType,
    user,
    userPermissions,
    handleParticipate,
    setMessage,
    // 🆕 Новый пропс для передачи изменения вида в родительский компонент
    onViewChange
}) => {
    // 🎯 СОСТОЯНИЯ ТАБОВ
    const [activeTab, setActiveTab] = useState('current');
    
    // 🎯 СОСТОЯНИЯ ФИЛЬТРОВ
    const [filters, setFilters] = useState({
        search: '',
        status: 'all', // 'all', 'registered', 'unregistered'
        rating: 'all', // 'all', 'low', 'medium', 'high'
        sortBy: 'name' // 'name', 'rating', 'date'
    });

    // 🆕 СОСТОЯНИЕ ВИДА ОТОБРАЖЕНИЯ
    const [displayMode, setDisplayMode] = useState('smart-cards'); // 'smart-cards', 'data-table', 'gaming-roster'

    // 🎯 ДОСТУПНЫЕ ВИДЫ ОТОБРАЖЕНИЯ
    const displayModes = [
        {
            id: 'smart-cards',
            label: '📱 Smart Cards',
            description: 'Современные карточки с богатым контентом',
            icon: '🃏'
        },
        {
            id: 'data-table', 
            label: '📊 Data Table',
            description: 'Профессиональная таблица данных',
            icon: '📋'
        },
        {
            id: 'gaming-roster',
            label: '🎮 Gaming Roster', 
            description: 'Геймифицированный интерфейс',
            icon: '⚡'
        }
    ];

    // 🆕 ОБРАБОТЧИК ИЗМЕНЕНИЯ ВИДА ОТОБРАЖЕНИЯ
    /**
     * 🎨 Обработчик изменения вида отображения
     * 
     * Изменяет текущий вид отображения участников и уведомляет родительский компонент.
     * Используется как в локальном селекторе, так и в плавающей панели управления.
     * 
     * @param {string} newMode - Новый режим отображения ('smart-cards', 'data-table', 'gaming-roster')
     */
    const handleDisplayModeChange = useCallback((newMode) => {
        setDisplayMode(newMode);
        
        // Уведомляем родительский компонент об изменении для синхронизации с плавающей панелью
        if (onViewChange && typeof onViewChange === 'function') {
            onViewChange(newMode);
        }
    }, [onViewChange]);

    // 🔧 УТИЛИТАРНЫЕ ФУНКЦИИ (ПЕРЕМЕЩЕНЫ ПЕРЕД ИСПОЛЬЗОВАНИЕМ)
    /**
     * ⭐ Получение рейтинга участника
     * 
     * Извлекает рейтинг участника в зависимости от выбранного типа рейтинга.
     * Обрабатывает различные форматы данных и возвращает числовое значение.
     * 
     * @param {Object} participant - Объект участника
     * @returns {number|null} Рейтинг участника или null если отсутствует
     * 
     * Поддерживаемые типы рейтинга:
     * - 'faceit': FACEIT ELO рейтинг
     * - 'cs2': CS2 Premier рейтинг
     */
    const getRating = useCallback((participant) => {
        if (!participant) return null;

        if (ratingType === 'faceit') {
            return participant.faceit_elo || null;
        } else if (ratingType === 'cs2') {
            return participant.cs2_premier_rank || null;
        }

        return null;
    }, [ratingType]);

    /**
     * 🎨 Получение CSS класса для рейтинга
     * 
     * Определяет CSS класс для цветовой индикации рейтинга участника.
     * Используется для визуального выделения разных уровней рейтинга.
     * 
     * @param {number} rating - Рейтинг участника
     * @returns {string} CSS класс для рейтинга
     * 
     * Классификация рейтингов:
     * - rating-high: >= 2500 (зеленый)
     * - rating-medium: 1500-2499 (желтый)
     * - rating-low: < 1500 (красный)
     * - rating-none: отсутствует (серый)
     */
    const getRatingClass = useCallback((rating) => {
        if (!rating) return 'rating-none';
        if (rating >= 2500) return 'rating-high';
        if (rating >= 1500) return 'rating-medium';
        return 'rating-low';
    }, []);

    /**
     * 🎯 Форматирование рейтинга для отображения
     * 
     * Преобразует числовой рейтинг в отформатированную строку для UI.
     * Обрабатывает случаи отсутствия рейтинга и различные форматы.
     * 
     * @param {number|null} rating - Рейтинг участника
     * @returns {string} Отформатированная строка рейтинга
     */
    const formatRating = useCallback((rating) => {
        if (!rating) return 'Н/Д';
        return rating.toLocaleString();
    }, []);

    /**
     * 🏷️ Получение бейджа статуса участника
     * 
     * Создает JSX элемент бейджа для отображения статуса участника.
     * Визуально различает зарегистрированных и незарегистрированных участников.
     * 
     * @param {Object} participant - Объект участника
     * @returns {JSX.Element} JSX элемент бейджа статуса
     */
    const getStatusBadge = useCallback((participant) => {
        const isRegistered = participant.user_id !== null;
        return (
            <span className={`participant-status-badge ${isRegistered ? 'registered' : 'unregistered'}`}>
                {isRegistered ? '✅ Зарегистрирован' : '👤 Гость'}
            </span>
        );
    }, []);

    // 🎯 КОНФИГУРАЦИЯ ТАБОВ
    /**
     * 📋 Конфигурация табов панели участников
     * 
     * Определяет структуру навигации по табам с иконками, названиями и счетчиками.
     * Используется для генерации табочной навигации и определения активных вкладок.
     * 
     * @constant {Array<Object>} tabsConfig - Массив конфигураций табов
     * @property {string} id - Уникальный идентификатор таба
     * @property {string} icon - Эмодзи иконка для таба
     * @property {string} label - Отображаемое название таба
     * @property {Function} getCount - Функция для расчета счетчика таба
     */
    const tabsConfig = [
        {
            id: 'current',
            icon: '👥',
            label: 'Текущие участники',
            getCount: () => participants.length
        },
        {
            id: 'add',
            icon: '➕',
            label: 'Добавить участников',
            getCount: () => null // Без счетчика
        },
        {
            id: 'teams',
            icon: '🎲',
            label: 'Команды',
            getCount: () => mixedTeams.length
        },
        {
            id: 'stats',
            icon: '📊',
            label: 'Статистика',
            getCount: () => null // Без счетчика
        }
    ];

    // 🔍 ФИЛЬТРАЦИЯ И ПОИСК УЧАСТНИКОВ
    /**
     * 🔍 Фильтрация и сортировка участников
     * 
     * Применяет все активные фильтры (поиск, статус, рейтинг) и сортировку к списку участников.
     * Использует useMemo для оптимизации производительности и предотвращения лишних вычислений.
     * 
     * @returns {Array} Отфильтрованный и отсортированный массив участников
     * 
     * Логика фильтрации:
     * 1. Поиск по имени (регистронезависимый)
     * 2. Фильтр по статусу (зарегистрированные/незарегистрированные)
     * 3. Фильтр по рейтингу (низкий/средний/высокий)
     * 4. Сортировка по выбранному критерию
     */
    const filteredParticipants = useMemo(() => {
        let filtered = [...participants];

        // 🔎 Поиск по имени
        if (filters.search.trim()) {
            const searchLower = filters.search.toLowerCase().trim();
            filtered = filtered.filter(participant => 
                participant.name?.toLowerCase().includes(searchLower)
            );
        }

        // 📋 Фильтр по статусу регистрации
        if (filters.status !== 'all') {
            filtered = filtered.filter(participant => {
                const isRegistered = participant.user_id !== null;
                return filters.status === 'registered' ? isRegistered : !isRegistered;
            });
        }

        // ⭐ Фильтр по рейтингу
        if (filters.rating !== 'all') {
            filtered = filtered.filter(participant => {
                const rating = getRating(participant);
                if (!rating) return filters.rating === 'low'; // Нет рейтинга = низкий
                
                if (filters.rating === 'low') return rating < 1500;
                if (filters.rating === 'medium') return rating >= 1500 && rating < 2500;
                if (filters.rating === 'high') return rating >= 2500;
                return true;
            });
        }

        // 📊 Сортировка
        filtered.sort((a, b) => {
            switch (filters.sortBy) {
                case 'name':
                    return (a.name || '').localeCompare(b.name || '');
                case 'rating':
                    const ratingA = getRating(a) || 0;
                    const ratingB = getRating(b) || 0;
                    return ratingB - ratingA; // По убыванию
                case 'date':
                    // Предполагаем что есть поле created_at или similar
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                default:
                    return 0;
            }
        });

        return filtered;
    }, [participants, filters, getRating]);

    // 📊 СТАТИСТИКА УЧАСТНИКОВ
    /**
     * 📊 Расчет статистики участников
     * 
     * Вычисляет различные метрики участников турнира для отображения в разделе статистики.
     * Включает общую статистику, рейтинговые показатели и статистику команд.
     * 
     * @returns {Object} Объект со всей статистикой участников
     * 
     * Вычисляемые метрики:
     * - Общее количество участников
     * - Количество зарегистрированных/незарегистрированных
     * - Средний, максимальный, минимальный рейтинг
     * - Статистика команд и заполненности турнира
     */
    const participantsStats = useMemo(() => {
        const totalCount = participants.length;
        const registeredCount = participants.filter(p => p.user_id !== null).length;
        const unregisteredCount = totalCount - registeredCount;

        // 📈 Рейтинговые статистики
        const ratings = participants
            .map(p => getRating(p))
            .filter(r => r !== null && r > 0);

        const avgRating = ratings.length > 0 
            ? Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length)
            : 0;

        const maxRating = ratings.length > 0 ? Math.max(...ratings) : 0;
        const minRating = ratings.length > 0 ? Math.min(...ratings) : 0;

        // 🎲 Статистика команд
        const teamsCount = mixedTeams.length;
        const avgTeamSize = teamsCount > 0 
            ? Math.round(mixedTeams.reduce((sum, team) => sum + team.members.length, 0) / teamsCount)
            : 0;

        // 📊 Заполненность турнира
        const maxParticipants = tournament.max_participants || null;
        const fillPercentage = maxParticipants 
            ? Math.round((totalCount / maxParticipants) * 100)
            : null;

        return {
            totalCount,
            registeredCount,
            unregisteredCount,
            avgRating,
            maxRating,
            minRating,
            teamsCount,
            avgTeamSize,
            maxParticipants,
            fillPercentage
        };
    }, [participants, mixedTeams, tournament.max_participants, getRating]);

    // 🎨 ФУНКЦИИ РЕНДЕРИНГА РАЗНЫХ ВИДОВ ОТОБРАЖЕНИЯ
    /**
     * 🃏 Рендер Smart Cards - Современные карточки с богатым контентом
     * 
     * @param {Array} participantsToRender - Массив участников для отображения
     * @returns {JSX.Element} Smart Cards вид
     */
    const renderSmartCards = useCallback((participantsToRender) => (
        <div className="smart-cards-grid">
            {participantsToRender.map(participant => {
                const rating = getRating(participant);
                const isOnline = Math.random() > 0.3; // Заглушка для онлайн статуса
                const achievements = Math.floor(Math.random() * 15); // Заглушка для достижений
                
                return (
                    <div key={participant.id} className="smart-participant-card">
                        {/* Аватар с индикаторами */}
                        <div className="smart-avatar-section">
                            <div className="smart-avatar-container">
                                <img
                                    src={ensureHttps(participant.avatar_url) || '/default-avatar.png'}
                                    alt={participant.name}
                                    className="smart-avatar"
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                                <div className={`online-indicator ${isOnline ? 'online' : 'offline'}`}></div>
                                {achievements > 10 && <div className="achievement-crown">👑</div>}
                            </div>
                            {getStatusBadge(participant)}
                        </div>

                        {/* Основная информация */}
                        <div className="smart-participant-info">
                            <div className="smart-name-section">
                                {participant.user_id ? (
                                    <Link to={`/profile/${participant.user_id}`} className="smart-participant-name">
                                        {participant.name}
                                    </Link>
                                ) : (
                                    <span className="smart-participant-name">{participant.name}</span>
                                )}
                                <div className="smart-rating-display">
                                    <span className={`rating-badge ${getRatingClass(rating)}`}>
                                        {ratingType === 'faceit' ? '🎯' : '🏆'} {formatRating(rating)}
                                    </span>
                                </div>
                            </div>

                            {/* Мини-статистика */}
                            <div className="smart-mini-stats">
                                <div className="stat-chip">
                                    <span className="stat-icon">🏆</span>
                                    <span className="stat-value">{achievements}</span>
                                </div>
                                <div className="stat-chip">
                                    <span className="stat-icon">⚡</span>
                                    <span className="stat-value">{isOnline ? 'Онлайн' : 'Офлайн'}</span>
                                </div>
                            </div>

                            {/* Прогресс-бар рейтинга */}
                            {rating && (
                                <div className="rating-progress">
                                    <div className="progress-bar">
                                        <div 
                                            className="progress-fill"
                                            style={{ width: `${Math.min((rating / 3000) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                    <span className="progress-text">{rating}/3000</span>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        {isCreatorOrAdmin && (
                            <div className="smart-actions">
                                <button
                                    onClick={() => onRemoveParticipant(participant.id)}
                                    className="smart-remove-btn"
                                    title="Удалить участника"
                                >
                                    🗑️
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    ), [getRating, getRatingClass, formatRating, getStatusBadge, ratingType, isCreatorOrAdmin, onRemoveParticipant]);

    /**
     * 📊 Рендер Data Table - Профессиональная таблица данных
     * 
     * @param {Array} participantsToRender - Массив участников для отображения
     * @returns {JSX.Element} Data Table вид
     */
    const renderDataTable = useCallback((participantsToRender) => (
        <div className="data-table-container">
            <div className="table-responsive">
                <table className="participants-data-table">
                    <thead>
                        <tr>
                            <th className="avatar-col">
                                <span>👤</span>
                            </th>
                            <th className="name-col sortable" onClick={() => handleFilterChange('sortBy', 'name')}>
                                Имя {filters.sortBy === 'name' && '↕️'}
                            </th>
                            <th className="status-col">Статус</th>
                            <th className="rating-col sortable" onClick={() => handleFilterChange('sortBy', 'rating')}>
                                Рейтинг {filters.sortBy === 'rating' && '↕️'}
                            </th>
                            <th className="stats-col">Статистика</th>
                            {isCreatorOrAdmin && <th className="actions-col">Действия</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {participantsToRender.map(participant => {
                            const rating = getRating(participant);
                            const wins = Math.floor(Math.random() * 50); // Заглушка для побед
                            const tournaments = Math.floor(Math.random() * 20); // Заглушка для турниров
                            
                            return (
                                <tr key={participant.id} className="table-row">
                                    <td className="avatar-cell">
                                        <img
                                            src={ensureHttps(participant.avatar_url) || '/default-avatar.png'}
                                            alt={participant.name}
                                            className="table-avatar"
                                            onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                        />
                                    </td>
                                    <td className="name-cell">
                                        {participant.user_id ? (
                                            <Link to={`/profile/${participant.user_id}`} className="table-participant-name">
                                                {participant.name}
                                            </Link>
                                        ) : (
                                            <span className="table-participant-name guest">{participant.name}</span>
                                        )}
                                    </td>
                                    <td className="status-cell">
                                        {getStatusBadge(participant)}
                                    </td>
                                    <td className="rating-cell">
                                        <span className={`table-rating ${getRatingClass(rating)}`}>
                                            {formatRating(rating)}
                                        </span>
                                    </td>
                                    <td className="stats-cell">
                                        <div className="table-stats">
                                            <span className="wins-stat">🏆 {wins}</span>
                                            <span className="tournaments-stat">🎮 {tournaments}</span>
                                        </div>
                                    </td>
                                    {isCreatorOrAdmin && (
                                        <td className="actions-cell">
                                            <button
                                                onClick={() => onRemoveParticipant(participant.id)}
                                                className="table-remove-btn"
                                                title="Удалить участника"
                                            >
                                                ❌
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
    ), [getRating, getRatingClass, formatRating, getStatusBadge, filters.sortBy, handleFilterChange, isCreatorOrAdmin, onRemoveParticipant]);

    /**
     * 🎮 Рендер Gaming Roster - Геймифицированный интерфейс
     * 
     * @param {Array} participantsToRender - Массив участников для отображения
     * @returns {JSX.Element} Gaming Roster вид
     */
    const renderGamingRoster = useCallback((participantsToRender) => {
        // Сортируем участников по рейтингу для создания легенд
        const sortedByRating = [...participantsToRender].sort((a, b) => {
            const ratingA = getRating(a) || 0;
            const ratingB = getRating(b) || 0;
            return ratingB - ratingA;
        });

        const getRarityTier = (participant, index) => {
            const rating = getRating(participant) || 0;
            if (index === 0 && rating > 2500) return 'legendary';
            if (rating > 2000 || index < 3) return 'epic';
            if (rating > 1500 || index < 6) return 'rare';
            return 'common';
        };

        return (
            <div className="gaming-roster-container">
                <div className="roster-header">
                    <h3 className="roster-title">⚔️ Tournament Champions ⚔️</h3>
                    <div className="power-level-indicator">
                        Суммарная мощь: <span className="total-power">{participantsToRender.reduce((sum, p) => sum + (getRating(p) || 1000), 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="gaming-cards-grid">
                    {sortedByRating.map((participant, index) => {
                        const rating = getRating(participant);
                        const rarity = getRarityTier(participant, index);
                        const powerLevel = rating || 1000;
                        const isTopPlayer = index < 3;
                        
                        return (
                            <div key={participant.id} className={`gaming-card ${rarity} ${isTopPlayer ? 'top-player' : ''}`}>
                                {/* Рамка редкости */}
                                <div className="rarity-frame">
                                    <div className="rarity-corners">
                                        <div className="corner top-left"></div>
                                        <div className="corner top-right"></div>
                                        <div className="corner bottom-left"></div>
                                        <div className="corner bottom-right"></div>
                                    </div>
                                </div>

                                {/* Ранк и позиция */}
                                <div className="rank-indicator">
                                    <span className="rank-number">#{index + 1}</span>
                                    <span className="rarity-label">{rarity.toUpperCase()}</span>
                                </div>

                                {/* Аватар с эффектами */}
                                <div className="gaming-avatar-container">
                                    <div className={`avatar-glow ${rarity}`}></div>
                                    <img
                                        src={ensureHttps(participant.avatar_url) || '/default-avatar.png'}
                                        alt={participant.name}
                                        className="gaming-avatar"
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                    {isTopPlayer && <div className="crown-effect">👑</div>}
                                </div>

                                {/* Информация игрока */}
                                <div className="gaming-player-info">
                                    <div className="player-name-section">
                                        {participant.user_id ? (
                                            <Link to={`/profile/${participant.user_id}`} className="gaming-player-name">
                                                {participant.name}
                                            </Link>
                                        ) : (
                                            <span className="gaming-player-name guest">{participant.name}</span>
                                        )}
                                        {getStatusBadge(participant)}
                                    </div>

                                    {/* Power Level */}
                                    <div className="power-level-section">
                                        <div className="power-label">POWER LEVEL</div>
                                        <div className="power-value">{powerLevel.toLocaleString()}</div>
                                        <div className="power-bar">
                                            <div 
                                                className="power-fill"
                                                style={{ width: `${Math.min((powerLevel / 3000) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* Статы */}
                                    <div className="gaming-stats">
                                        <div className="stat-row">
                                            <span className="stat-name">ATK</span>
                                            <span className="stat-value">{Math.floor(powerLevel / 50)}</span>
                                        </div>
                                        <div className="stat-row">
                                            <span className="stat-name">DEF</span>
                                            <span className="stat-value">{Math.floor(powerLevel / 60)}</span>
                                        </div>
                                        <div className="stat-row">
                                            <span className="stat-name">SPD</span>
                                            <span className="stat-value">{Math.floor(powerLevel / 40)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Действия */}
                                {isCreatorOrAdmin && (
                                    <div className="gaming-actions">
                                        <button
                                            onClick={() => onRemoveParticipant(participant.id)}
                                            className="gaming-remove-btn"
                                            title="Удалить из ростера"
                                        >
                                            ⚔️ KICK
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }, [getRating, getRatingClass, formatRating, getStatusBadge, isCreatorOrAdmin, onRemoveParticipant]);

    // 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
    /**
     * 🔄 Обработчик изменения фильтров
     * 
     * Обновляет состояние фильтров при изменении параметров фильтрации.
     * Использует useCallback для оптимизации производительности.
     * 
     * @param {string} filterType - Тип фильтра ('search', 'status', 'rating', 'sortBy')
     * @param {string} value - Новое значение фильтра
     */
    const handleFilterChange = useCallback((filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value
        }));
    }, []);

    /**
     * 🎨 Сброс всех фильтров
     * 
     * Возвращает все фильтры к значениям по умолчанию.
     * Полезно для быстрой очистки всех примененных фильтров.
     */
    const handleResetFilters = useCallback(() => {
        setFilters({
            search: '',
            status: 'all',
            rating: 'all',
            sortBy: 'name'
        });
    }, []);

    /**
     * 📱 Переключение таба
     * 
     * Изменяет активный таб панели участников.
     * При переключении табов может выполняться дополнительная логика.
     * 
     * @param {string} tabId - Идентификатор таба для активации
     */
    const handleTabChange = useCallback((tabId) => {
        setActiveTab(tabId);
        
        // Дополнительная логика при переключении табов
        if (tabId === 'current') {
            // Сбросить фильтры при возврате к списку участников
            // handleResetFilters(); // Опционально
        }
    }, []);

    // 🎨 РЕНДЕР КОМПОНЕНТОВ ТАБОВ
    /**
     * 👥 Рендер вкладки "Текущие участники" с мультивидовым отображением
     * 
     * Отображает список участников турнира с умными фильтрами, поиском и статистикой.
     * Поддерживает 3 вида отображения: Smart Cards, Data Table, Gaming Roster.
     * 
     * @returns {JSX.Element} Вкладка с текущими участниками
     */
    const renderCurrentParticipants = () => (
        <div className="current-participants-tab">
            {/* Контролы фильтрации и управления */}
            <div className="participants-controls">
                {/* Секция поиска и фильтров */}
                <div className="search-and-filters">
                    <div className="search-section">
                        <input
                            type="text"
                            className="participants-search-input"
                            placeholder="🔍 Поиск участников..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                        />
                    </div>
                    
                    <div className="filters-section">
                        <select
                            className="filter-select"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="all">👥 Все участники</option>
                            <option value="registered">✅ Зарегистрированные</option>
                            <option value="unregistered">👤 Незарегистрированные</option>
                        </select>
                        
                        <select
                            className="filter-select"
                            value={filters.rating}
                            onChange={(e) => handleFilterChange('rating', e.target.value)}
                        >
                            <option value="all">🎯 Любой рейтинг</option>
                            <option value="high">🔥 Высокий (2000+)</option>
                            <option value="medium">⚡ Средний (1500-2000)</option>
                            <option value="low">📈 Начальный (&lt;1500)</option>
                        </select>
                        
                        <select
                            className="filter-select"
                            value={filters.sortBy}
                            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                        >
                            <option value="name">📝 По имени</option>
                            <option value="rating">🏆 По рейтингу</option>
                            <option value="date">📅 По дате</option>
                        </select>
                        
                        {/* 🆕 СЕЛЕКТОР ВИДА ОТОБРАЖЕНИЯ */}
                        <select
                            className="display-mode-select"
                            value={displayMode}
                            onChange={(e) => handleDisplayModeChange(e.target.value)}
                            title="Выберите вид отображения участников"
                        >
                            {displayModes.map(mode => (
                                <option key={mode.id} value={mode.id}>
                                    {mode.icon} {mode.label}
                                </option>
                            ))}
                        </select>
                        
                        <button 
                            className="clear-filters-btn"
                            onClick={handleResetFilters}
                            title="Сбросить все фильтры"
                        >
                            🧹 Сбросить
                        </button>
                    </div>
                </div>

                {/* Сводка результатов */}
                <div className="results-summary">
                    <span className="filtered-indicator">
                        Показано: <strong>{filteredParticipants.length}</strong> из <strong>{participants.length}</strong>
                        {(filters.search || filters.status !== 'all' || filters.rating !== 'all') && ' (отфильтровано)'}
                    </span>
                </div>
            </div>

            {/* 🎨 МУЛЬТИВИДОВОЕ ОТОБРАЖЕНИЕ УЧАСТНИКОВ */}
            <div className={`participants-display-area display-mode-${displayMode}`}>
                {filteredParticipants.length > 0 ? (
                    <>
                        {/* Smart Cards View */}
                        {displayMode === 'smart-cards' && renderSmartCards(filteredParticipants)}
                        
                        {/* Data Table View */}
                        {displayMode === 'data-table' && renderDataTable(filteredParticipants)}
                        
                        {/* Gaming Roster View */}
                        {displayMode === 'gaming-roster' && renderGamingRoster(filteredParticipants)}
                    </>
                ) : (
                    <div className="empty-participants-state">
                        {filters.search || filters.status !== 'all' || filters.rating !== 'all' ? (
                            <div className="no-results">
                                <div className="no-results-icon">🔍</div>
                                <h4>Участники не найдены</h4>
                                <p>Попробуйте изменить параметры поиска или фильтры</p>
                                <button 
                                    className="clear-filters-btn"
                                    onClick={handleResetFilters}
                                >
                                    🧹 Сбросить фильтры
                                </button>
                            </div>
                        ) : (
                            <div className="no-participants">
                                <div className="no-participants-icon">👥</div>
                                <h4>Пока нет участников</h4>
                                <p>Станьте первым участником этого турнира!</p>
                                {isCreatorOrAdmin && (
                                    <div className="admin-add-suggestions">
                                        <button 
                                            onClick={onShowParticipantSearchModal}
                                            className="add-option-btn primary"
                                        >
                                            👤 Найти участников
                                        </button>
                                        <button 
                                            onClick={onShowAddParticipantModal}
                                            className="add-option-btn secondary"
                                        >
                                            ➕ Добавить незарегистрированного
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    /**
     * ➕ Рендер таба "Добавить участников"
     * 
     * Отображает опции для добавления новых участников в турнир.
     * Включает кнопки для поиска зарегистрированных пользователей и добавления гостей.
     * 
     * @returns {JSX.Element} Таб для добавления участников
     */
    const renderAddParticipants = () => (
        <div className="unified-tab-content add-participants">
            <div className="add-options">
                <div className="add-option-card">
                    <div className="option-icon">🔍</div>
                    <h3>Найти зарегистрированного пользователя</h3>
                    <p>Поиск среди зарегистрированных пользователей системы</p>
                    <button
                        onClick={onShowParticipantSearchModal}
                        className="btn btn-primary"
                        disabled={!isCreatorOrAdmin}
                    >
                        🔍 Открыть поиск
                    </button>
                </div>

                <div className="add-option-card">
                    <div className="option-icon">👤</div>
                    <h3>Добавить незарегистрированного участника</h3>
                    <p>Добавление участника-гостя без регистрации в системе</p>
                    <button
                        onClick={onShowAddParticipantModal}
                        className="btn btn-secondary"
                        disabled={!isCreatorOrAdmin}
                    >
                        ➕ Добавить гостя
                    </button>
                </div>
            </div>

            {!isCreatorOrAdmin && (
                <div className="permission-notice">
                    <p>ℹ️ Только создатель турнира и администраторы могут добавлять участников</p>
                </div>
            )}

            {/* Переключатель типа рейтинга */}
            {setRatingType && (
                <div className="rating-type-selector">
                    <h4>⚙️ Тип рейтинга для отображения:</h4>
                    <div className="rating-options">
                        <label className="rating-option">
                            <input
                                type="radio"
                                value="faceit"
                                checked={ratingType === 'faceit'}
                                onChange={(e) => setRatingType(e.target.value)}
                            />
                            <span>🎯 FACEIT ELO</span>
                        </label>
                        <label className="rating-option">
                            <input
                                type="radio"
                                value="cs2"
                                checked={ratingType === 'cs2'}
                                onChange={(e) => setRatingType(e.target.value)}
                            />
                            <span>🏆 CS2 Premier</span>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );

    /**
     * 🎲 Рендер таба "Команды"
     * 
     * Отображает управление командами для mix турниров.
     * Включает генерацию команд и просмотр существующих команд.
     * 
     * @returns {JSX.Element} Таб для управления командами
     */
    const renderTeams = () => (
        <div className="unified-tab-content teams">
            {tournament.type === 'mix' ? (
                <div className="teams-content">
                    {/* Генератор команд */}
                    {isCreatorOrAdmin && (
                        <div className="team-generator-section">
                            <h3>🎲 Генератор команд</h3>
                            <TeamGenerator
                                participants={participants}
                                onTeamsGenerated={onTeamsGenerated}
                                ratingType={ratingType}
                                calculateTeamAverageRating={calculateTeamAverageRating}
                            />
                        </div>
                    )}

                    {/* Просмотр команд */}
                    {mixedTeams.length > 0 && (
                        <div className="teams-display">
                            <h3>👥 Сформированные команды ({mixedTeams.length})</h3>
                            <div className="teams-grid">
                                {mixedTeams.map((team, index) => (
                                    <div key={index} className="team-card">
                                        <div className="team-header">
                                            <h4>Команда {index + 1}</h4>
                                            <div className="team-average-rating">
                                                Средний рейтинг: {calculateTeamAverageRating ? Math.round(calculateTeamAverageRating(team)) : 'Н/Д'}
                                            </div>
                                        </div>
                                        <div className="team-members">
                                            {team.members.map(member => (
                                                <div key={member.id} className="team-member">
                                                    <img
                                                        src={ensureHttps(member.avatar_url) || '/default-avatar.png'}
                                                        alt={member.name}
                                                        className="member-avatar"
                                                        onError={(e) => {
                                                            e.target.src = '/default-avatar.png';
                                                        }}
                                                    />
                                                    <div className="member-info">
                                                        <span className="member-name">{member.name}</span>
                                                        <span className="member-rating">
                                                            {formatRating(getRating(member))}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {mixedTeams.length === 0 && (
                        <div className="no-teams-message">
                            <p>🎲 Команды еще не сформированы</p>
                            {isCreatorOrAdmin && participants.length >= 2 && (
                                <p>Используйте генератор команд выше для создания команд</p>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="not-mix-tournament">
                    <div className="info-message">
                        <div className="info-icon">ℹ️</div>
                        <h3>Управление командами недоступно</h3>
                        <p>Функция управления командами доступна только для mix турниров</p>
                        <p>Тип текущего турнира: <strong>{tournament.type}</strong></p>
                    </div>
                </div>
            )}
        </div>
    );

    /**
     * 📊 Рендер таба "Статистика"
     * 
     * Отображает детальную статистику участников, команд и турнира.
     * Включает общие метрики, рейтинговую статистику и прогресс заполнения.
     * 
     * @returns {JSX.Element} Таб со статистикой
     */
    const renderStatistics = () => (
        <div className="unified-tab-content statistics">
            <div className="stats-grid">
                {/* Общая статистика */}
                <div className="stats-card">
                    <h3>👥 Общая статистика</h3>
                    <div className="stats-list">
                        <div className="stat-item">
                            <span className="stat-label">Всего участников:</span>
                            <span className="stat-value">{participantsStats.totalCount}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Зарегистрированные:</span>
                            <span className="stat-value registered">{participantsStats.registeredCount}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Гости:</span>
                            <span className="stat-value unregistered">{participantsStats.unregisteredCount}</span>
                        </div>
                    </div>
                </div>

                {/* Рейтинговая статистика */}
                <div className="stats-card">
                    <h3>⭐ Рейтинговая статистика</h3>
                    <div className="stats-list">
                        <div className="stat-item">
                            <span className="stat-label">Средний рейтинг:</span>
                            <span className={`stat-value ${getRatingClass(participantsStats.avgRating)}`}>
                                {formatRating(participantsStats.avgRating)}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Максимальный:</span>
                            <span className={`stat-value ${getRatingClass(participantsStats.maxRating)}`}>
                                {formatRating(participantsStats.maxRating)}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Минимальный:</span>
                            <span className={`stat-value ${getRatingClass(participantsStats.minRating)}`}>
                                {formatRating(participantsStats.minRating)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Статистика команд */}
                {tournament.type === 'mix' && (
                    <div className="stats-card">
                        <h3>🎲 Статистика команд</h3>
                        <div className="stats-list">
                            <div className="stat-item">
                                <span className="stat-label">Сформировано команд:</span>
                                <span className="stat-value">{participantsStats.teamsCount}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Средний размер команды:</span>
                                <span className="stat-value">{participantsStats.avgTeamSize || 'Н/Д'}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Заполненность турнира */}
                {participantsStats.maxParticipants && (
                    <div className="stats-card">
                        <h3>📊 Заполненность турнира</h3>
                        <div className="fill-progress">
                            <div className="progress-bar">
                                <div 
                                    className="progress-fill"
                                    style={{ width: `${participantsStats.fillPercentage}%` }}
                                ></div>
                            </div>
                            <div className="progress-text">
                                {participantsStats.totalCount} / {participantsStats.maxParticipants} 
                                ({participantsStats.fillPercentage}%)
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Дополнительная информация */}
            <div className="stats-additional">
                <h4>ℹ️ Дополнительная информация</h4>
                <ul>
                    <li>Тип турнира: <strong>{tournament.type}</strong></li>
                    <li>Отображаемый рейтинг: <strong>{ratingType === 'faceit' ? 'FACEIT ELO' : 'CS2 Premier'}</strong></li>
                    <li>Статус турнира: <strong>{tournament.status}</strong></li>
                    {tournament.max_participants && (
                        <li>Ограничение участников: <strong>{tournament.max_participants}</strong></li>
                    )}
                </ul>
            </div>
        </div>
    );

    // 🎨 ОСНОВНОЙ РЕНДЕР
    return (
        <div className="unified-participants-panel">
            {/* 📋 НАВИГАЦИЯ ПО ТАБАМ */}
            <div className="unified-tabs-navigation">
                {tabsConfig.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    >
                        <span className="tab-icon">{tab.icon}</span>
                        <span className="tab-label">{tab.label}</span>
                        {tab.getCount && tab.getCount() !== null && (
                            <span className="tab-count">{tab.getCount()}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* 📄 СОДЕРЖИМОЕ ТАБОВ */}
            <div className="unified-tabs-content">
                {activeTab === 'current' && renderCurrentParticipants()}
                {activeTab === 'add' && renderAddParticipants()}
                {activeTab === 'teams' && renderTeams()}
                {activeTab === 'stats' && renderStatistics()}
            </div>
        </div>
    );
};

export default UnifiedParticipantsPanel; 