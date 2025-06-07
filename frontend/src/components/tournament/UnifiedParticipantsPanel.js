/**
 * UnifiedParticipantsPanel v1.0.0 - Унифицированная панель управления участниками
 * 
 * @version 1.0.0 (Unified Dashboard + Smart Features)
 * @created 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Объединение управления участниками с табами, фильтрами и статистикой
 * @features Табы, фильтры, статистика, поиск, управление участниками
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ensureHttps } from '../../utils/userHelpers';
import TeamGenerator from '../TeamGenerator';
import './UnifiedParticipantsPanel.css';

/**
 * 🎯 ГЛАВНЫЙ КОМПОНЕНТ: UnifiedParticipantsPanel
 * 
 * Унифицированная панель управления участниками турнира с табами, фильтрами и статистикой.
 * Объединяет функциональность Варианта 1 (табы) с возможностями Варианта 2 (фильтры/статистика).
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
    setMessage
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
     * 👥 Рендер таба "Текущие участники"
     * 
     * Отображает список участников с фильтрами, поиском и возможностями управления.
     * Включает умные фильтры, карточки участников и действия администратора.
     * 
     * @returns {JSX.Element} Таб со списком участников
     */
    const renderCurrentParticipants = () => (
        <div className="unified-tab-content current-participants">
            {/* 🔍 ПАНЕЛЬ ФИЛЬТРОВ */}
            <div className="filters-panel">
                <div className="filters-row">
                    {/* Поиск */}
                    <div className="filter-group search-group">
                        <label htmlFor="participant-search">🔍 Поиск участников:</label>
                        <input
                            id="participant-search"
                            type="text"
                            placeholder="Введите имя участника..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            className="search-input"
                        />
                    </div>

                    {/* Фильтр по статусу */}
                    <div className="filter-group">
                        <label htmlFor="status-filter">📋 Статус:</label>
                        <select
                            id="status-filter"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">Все участники</option>
                            <option value="registered">Зарегистрированные</option>
                            <option value="unregistered">Гости</option>
                        </select>
                    </div>

                    {/* Фильтр по рейтингу */}
                    <div className="filter-group">
                        <label htmlFor="rating-filter">⭐ Рейтинг:</label>
                        <select
                            id="rating-filter"
                            value={filters.rating}
                            onChange={(e) => handleFilterChange('rating', e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">Все рейтинги</option>
                            <option value="high">Высокий (2500+)</option>
                            <option value="medium">Средний (1500-2499)</option>
                            <option value="low">Низкий (&lt;1500)</option>
                        </select>
                    </div>

                    {/* Сортировка */}
                    <div className="filter-group">
                        <label htmlFor="sort-filter">📊 Сортировка:</label>
                        <select
                            id="sort-filter"
                            value={filters.sortBy}
                            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                            className="filter-select"
                        >
                            <option value="name">По имени</option>
                            <option value="rating">По рейтингу</option>
                            <option value="date">По дате</option>
                        </select>
                    </div>

                    {/* Кнопка сброса */}
                    <button
                        onClick={handleResetFilters}
                        className="reset-filters-btn"
                        title="Сбросить все фильтры"
                    >
                        🔄 Сброс
                    </button>
                </div>

                {/* Информация о фильтрации */}
                <div className="filter-info">
                    Показано <strong>{filteredParticipants.length}</strong> из <strong>{participants.length}</strong> участников
                    {filters.search && <span className="filter-tag">Поиск: "{filters.search}"</span>}
                    {filters.status !== 'all' && <span className="filter-tag">Статус: {filters.status === 'registered' ? 'Зарегистрированные' : 'Гости'}</span>}
                    {filters.rating !== 'all' && <span className="filter-tag">Рейтинг: {filters.rating}</span>}
                </div>
            </div>

            {/* 👥 СПИСОК УЧАСТНИКОВ */}
            <div className="participants-list">
                {filteredParticipants.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">😔</div>
                        <h3>Участники не найдены</h3>
                        <p>
                            {participants.length === 0 
                                ? 'В турнире пока нет участников'
                                : 'Попробуйте изменить параметры фильтрации'
                            }
                        </p>
                        {filters.search || filters.status !== 'all' || filters.rating !== 'all' ? (
                            <button onClick={handleResetFilters} className="btn btn-primary">
                                🔄 Сбросить фильтры
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className="participants-grid">
                        {filteredParticipants.map(participant => (
                            <div key={participant.id} className="participant-card">
                                {/* Аватар и основная информация */}
                                <div className="participant-header">
                                    <div className="participant-avatar">
                                        <img
                                            src={ensureHttps(participant.avatar_url) || '/default-avatar.png'}
                                            alt={participant.name}
                                            onError={(e) => {
                                                e.target.src = '/default-avatar.png';
                                            }}
                                        />
                                    </div>
                                    <div className="participant-info">
                                        <h4 className="participant-name">
                                            {participant.user_id ? (
                                                <Link 
                                                    to={`/profile/${participant.user_id}`}
                                                    className="participant-link"
                                                >
                                                    {participant.name}
                                                </Link>
                                            ) : (
                                                participant.name
                                            )}
                                        </h4>
                                        {getStatusBadge(participant)}
                                    </div>
                                </div>

                                {/* Рейтинги */}
                                <div className="participant-ratings">
                                    <div className={`rating-item ${getRatingClass(getRating(participant))}`}>
                                        <span className="rating-label">
                                            {ratingType === 'faceit' ? 'FACEIT:' : 'CS2:'}
                                        </span>
                                        <span className="rating-value">
                                            {formatRating(getRating(participant))}
                                        </span>
                                    </div>
                                </div>

                                {/* Действия администратора */}
                                {isCreatorOrAdmin && (
                                    <div className="participant-actions">
                                        <button
                                            onClick={() => onRemoveParticipant(participant.id)}
                                            className="btn btn-danger btn-sm"
                                            title="Удалить участника"
                                        >
                                            🗑️ Удалить
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
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