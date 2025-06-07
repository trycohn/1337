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
        status: 'all', // all, registered, unregistered
        ratingRange: 'all', // all, low, medium, high
        sortBy: 'name', // name, rating, joinDate
        sortOrder: 'asc' // asc, desc
    });

    // 🎯 СТАТИСТИКА УЧАСТНИКОВ
    const statistics = useMemo(() => {
        const registered = participants.filter(p => p.user_id).length;
        const unregistered = participants.filter(p => !p.user_id).length;
        
        const ratings = participants
            .map(p => ratingType === 'faceit' ? parseInt(p.faceit_elo) || 0 : parseInt(p.cs2_premier_rank) || 0)
            .filter(r => r > 0);
        
        const avgRating = ratings.length > 0 
            ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length)
            : 0;
        
        const maxRating = ratings.length > 0 ? Math.max(...ratings) : 0;
        const minRating = ratings.length > 0 ? Math.min(...ratings) : 0;
        
        return {
            total: participants.length,
            registered,
            unregistered,
            avgRating,
            maxRating,
            minRating,
            hasRatings: ratings.length > 0
        };
    }, [participants, ratingType]);

    // 🎯 ФИЛЬТРОВАННЫЕ И ОТСОРТИРОВАННЫЕ УЧАСТНИКИ
    const filteredParticipants = useMemo(() => {
        let filtered = [...participants];

        // Поиск по имени
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(p => 
                (p.name || p.username || '').toLowerCase().includes(searchLower)
            );
        }

        // Фильтр по статусу
        if (filters.status !== 'all') {
            filtered = filtered.filter(p => 
                filters.status === 'registered' ? !!p.user_id : !p.user_id
            );
        }

        // Фильтр по рейтингу
        if (filters.ratingRange !== 'all' && statistics.hasRatings) {
            filtered = filtered.filter(p => {
                const rating = ratingType === 'faceit' 
                    ? parseInt(p.faceit_elo) || 0 
                    : parseInt(p.cs2_premier_rank) || 0;
                
                if (rating === 0) return filters.ratingRange === 'low';
                
                const { avgRating } = statistics;
                switch (filters.ratingRange) {
                    case 'low': return rating < avgRating * 0.8;
                    case 'medium': return rating >= avgRating * 0.8 && rating <= avgRating * 1.2;
                    case 'high': return rating > avgRating * 1.2;
                    default: return true;
                }
            });
        }

        // Сортировка
        filtered.sort((a, b) => {
            let valueA, valueB;
            
            switch (filters.sortBy) {
                case 'rating':
                    valueA = ratingType === 'faceit' 
                        ? parseInt(a.faceit_elo) || 0 
                        : parseInt(a.cs2_premier_rank) || 0;
                    valueB = ratingType === 'faceit' 
                        ? parseInt(b.faceit_elo) || 0 
                        : parseInt(b.cs2_premier_rank) || 0;
                    break;
                case 'joinDate':
                    valueA = new Date(a.created_at || a.joined_at || 0);
                    valueB = new Date(b.created_at || b.joined_at || 0);
                    break;
                case 'name':
                default:
                    valueA = (a.name || a.username || '').toLowerCase();
                    valueB = (b.name || b.username || '').toLowerCase();
                    break;
            }
            
            if (filters.sortOrder === 'desc') {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            } else {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            }
        });

        return filtered;
    }, [participants, filters, statistics, ratingType]);

    // 🎯 ОБРАБОТЧИКИ ФИЛЬТРОВ
    const updateFilter = useCallback((key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const clearFilters = useCallback(() => {
        setFilters({
            search: '',
            status: 'all',
            ratingRange: 'all',
            sortBy: 'name',
            sortOrder: 'asc'
        });
    }, []);

    // 🎯 ПРОВЕРКА БЛОКИРОВКИ (если сетка создана)
    const isManagementBlocked = useMemo(() => {
        return matches && matches.length > 0;
    }, [matches]);

    // 🎯 ПРОВЕРКА УЧАСТИЯ ПОЛЬЗОВАТЕЛЯ
    const isUserParticipating = useMemo(() => {
        return userPermissions?.isParticipating || false;
    }, [userPermissions]);

    // 🎯 ТАБЫ НАВИГАЦИИ
    const tabs = [
        {
            id: 'current',
            label: 'Текущие участники',
            icon: '👥',
            count: participants.length
        },
        {
            id: 'add',
            label: 'Добавить участников', 
            icon: '➕',
            disabled: isManagementBlocked || !isCreatorOrAdmin
        },
        {
            id: 'teams',
            label: 'Команды',
            icon: '🎲',
            count: mixedTeams.length,
            show: tournament?.format === 'mix'
        },
        {
            id: 'statistics',
            label: 'Статистика',
            icon: '📊'
        }
    ];

    // 🎯 РЕНДЕР КАРТОЧКИ УЧАСТНИКА
    const renderParticipantCard = useCallback((participant, index) => {
        const rating = ratingType === 'faceit' 
            ? participant.faceit_elo 
            : participant.cs2_premier_rank;

        return (
            <div key={participant.id || index} className="unified-participant-card">
                <div className="participant-avatar-section">
                    {participant.avatar_url ? (
                        <img 
                            src={ensureHttps(participant.avatar_url)} 
                            alt={participant.name || participant.username || 'Участник'}
                            className="unified-participant-avatar"
                            onError={(e) => {e.target.src = '/default-avatar.png'}}
                        />
                    ) : (
                        <div className="unified-avatar-placeholder">
                            {(participant.name || participant.username || 'У').charAt(0).toUpperCase()}
                        </div>
                    )}
                    {!participant.user_id && (
                        <div className="unregistered-indicator" title="Незарегистрированный участник">
                            👤
                        </div>
                    )}
                </div>
                
                <div className="participant-info-section">
                    <div className="participant-main-info">
                        {participant.user_id ? (
                            <Link 
                                to={`/profile/${participant.user_id}`}
                                className="participant-name-link"
                            >
                                {participant.name || participant.username}
                            </Link>
                        ) : (
                            <span className="participant-name-text">
                                {participant.name || 'Незарегистрированный участник'}
                            </span>
                        )}
                        
                        {rating && (
                            <div className="participant-rating-badge">
                                <span className="rating-type">
                                    {ratingType === 'faceit' ? 'FACEIT' : 'CS2'}
                                </span>
                                <span className="rating-value">{rating}</span>
                            </div>
                        )}
                    </div>
                    
                    {participant.email && (
                        <div className="participant-secondary-info">
                            📧 {participant.email}
                        </div>
                    )}
                </div>
                
                {isCreatorOrAdmin && !isManagementBlocked && (
                    <div className="participant-actions">
                        <button
                            className="remove-participant-btn"
                            onClick={() => onRemoveParticipant(participant.id)}
                            title="Удалить участника"
                        >
                            🗑️
                        </button>
                    </div>
                )}
            </div>
        );
    }, [ratingType, isCreatorOrAdmin, isManagementBlocked, onRemoveParticipant]);

    // 🎯 РЕНДЕР ВКЛАДКИ "ТЕКУЩИЕ УЧАСТНИКИ"
    const renderCurrentParticipantsTab = () => (
        <div className="current-participants-tab">
            {/* Фильтры и поиск */}
            <div className="participants-controls">
                <div className="search-and-filters">
                    <div className="search-section">
                        <input
                            type="text"
                            placeholder="🔍 Поиск по имени..."
                            value={filters.search}
                            onChange={(e) => updateFilter('search', e.target.value)}
                            className="participants-search-input"
                        />
                    </div>
                    
                    <div className="filters-section">
                        <select
                            value={filters.status}
                            onChange={(e) => updateFilter('status', e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">Все участники</option>
                            <option value="registered">Зарегистрированные</option>
                            <option value="unregistered">Незарегистрированные</option>
                        </select>
                        
                        {statistics.hasRatings && (
                            <select
                                value={filters.ratingRange}
                                onChange={(e) => updateFilter('ratingRange', e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">Все рейтинги</option>
                                <option value="high">Высокий рейтинг</option>
                                <option value="medium">Средний рейтинг</option>
                                <option value="low">Низкий рейтинг</option>
                            </select>
                        )}
                        
                        <select
                            value={`${filters.sortBy}-${filters.sortOrder}`}
                            onChange={(e) => {
                                const [sortBy, sortOrder] = e.target.value.split('-');
                                updateFilter('sortBy', sortBy);
                                updateFilter('sortOrder', sortOrder);
                            }}
                            className="filter-select"
                        >
                            <option value="name-asc">Имя (А-Я)</option>
                            <option value="name-desc">Имя (Я-А)</option>
                            <option value="rating-desc">Рейтинг (↓)</option>
                            <option value="rating-asc">Рейтинг (↑)</option>
                            <option value="joinDate-desc">Дата (новые)</option>
                            <option value="joinDate-asc">Дата (старые)</option>
                        </select>
                        
                        {(filters.search || filters.status !== 'all' || filters.ratingRange !== 'all') && (
                            <button
                                onClick={clearFilters}
                                className="clear-filters-btn"
                                title="Очистить фильтры"
                            >
                                ✕ Сбросить
                            </button>
                        )}
                    </div>
                </div>
                
                {/* Статистика результатов */}
                <div className="results-summary">
                    <span className="results-count">
                        Показано: {filteredParticipants.length} из {participants.length}
                    </span>
                    {filteredParticipants.length !== participants.length && (
                        <span className="filtered-indicator">
                            (фильтр активен)
                        </span>
                    )}
                </div>
            </div>
            
            {/* Список участников */}
            {filteredParticipants.length > 0 ? (
                <div className="unified-participants-grid">
                    {filteredParticipants.map(renderParticipantCard)}
                </div>
            ) : (
                <div className="empty-participants-state">
                    {filters.search || filters.status !== 'all' || filters.ratingRange !== 'all' ? (
                        <div className="no-results">
                            <div className="no-results-icon">🔍</div>
                            <h4>Участники не найдены</h4>
                            <p>Попробуйте изменить критерии поиска или фильтры</p>
                            <button onClick={clearFilters} className="clear-filters-btn">
                                Сбросить фильтры
                            </button>
                        </div>
                    ) : (
                        <div className="no-participants">
                            <div className="no-participants-icon">👥</div>
                            <h4>Пока нет участников</h4>
                            <p>Участники появятся после регистрации в турнире</p>
                            
                            {/* Кнопка участия для пользователя */}
                            {user && tournament.status === 'active' && !isUserParticipating && !isManagementBlocked && handleParticipate && (
                                <button 
                                    className="participate-btn"
                                    onClick={handleParticipate}
                                >
                                    🎯 Стать первым участником
                                </button>
                            )}
                            
                            {/* Быстрые действия для админов */}
                            {isCreatorOrAdmin && tournament.status === 'active' && !isManagementBlocked && (
                                <div className="quick-admin-actions">
                                    <p>Как организатор, вы можете:</p>
                                    <div className="quick-actions-grid">
                                        <button 
                                            className="quick-action-btn primary"
                                            onClick={onShowParticipantSearchModal}
                                        >
                                            🔍 Найти участников
                                        </button>
                                        <button 
                                            className="quick-action-btn secondary"
                                            onClick={onShowAddParticipantModal}
                                        >
                                            👤 Добавить незарегистрированного
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    // 🎯 РЕНДЕР ВКЛАДКИ "ДОБАВИТЬ УЧАСТНИКОВ"
    const renderAddParticipantsTab = () => (
        <div className="add-participants-tab">
            <div className="add-participants-header">
                <h4>Управление участниками</h4>
                <p>Добавляйте зарегистрированных пользователей или незарегистрированных участников</p>
            </div>
            
            <div className="add-participants-options">
                <div className="add-option-card">
                    <div className="option-icon">🔍</div>
                    <div className="option-content">
                        <h5>Найти пользователя</h5>
                        <p>Поиск среди зарегистрированных пользователей системы</p>
                        <button 
                            className="add-option-btn primary"
                            onClick={onShowParticipantSearchModal}
                        >
                            Открыть поиск
                        </button>
                    </div>
                </div>
                
                <div className="add-option-card">
                    <div className="option-icon">👤</div>
                    <div className="option-content">
                        <h5>Добавить незарегистрированного</h5>
                        <p>Добавление участника без аккаунта в системе</p>
                        <button 
                            className="add-option-btn secondary"
                            onClick={onShowAddParticipantModal}
                        >
                            Добавить вручную
                        </button>
                    </div>
                </div>
            </div>
            
            {isManagementBlocked && (
                <div className="management-blocked-notice">
                    <div className="blocked-icon">🚫</div>
                    <div className="blocked-content">
                        <h5>Управление заблокировано</h5>
                        <p>Сетка турнира уже сгенерирована. Изменение участников недоступно.</p>
                    </div>
                </div>
            )}
        </div>
    );

    // 🎯 РЕНДЕР ВКЛАДКИ "КОМАНДЫ"
    const renderTeamsTab = () => (
        <div className="teams-tab">
            <div className="teams-header">
                <h4>Управление командами</h4>
                <p>Генерация и просмотр команд для mix турнира</p>
                
                {/* Селектор типа рейтинга */}
                {setRatingType && (
                    <div className="rating-type-selector">
                        <label>Тип рейтинга для балансировки:</label>
                        <select 
                            value={ratingType} 
                            onChange={(e) => setRatingType(e.target.value)}
                            className="rating-type-select"
                        >
                            <option value="faceit">FACEIT ELO</option>
                            <option value="cs2">CS2 Premier</option>
                        </select>
                    </div>
                )}
            </div>
            
            {/* Генератор команд */}
            {isCreatorOrAdmin && tournament.status === 'active' && (
                <div className="team-generator-section">
                    <TeamGenerator 
                        tournament={tournament}
                        participants={participants}
                        onTeamsGenerated={onTeamsGenerated}
                        onTeamsUpdated={onTeamsUpdated}
                        onRemoveParticipant={onRemoveParticipant}
                        isAdminOrCreator={isCreatorOrAdmin}
                        toast={(msg) => {
                            // Если есть setMessage, используем его для уведомлений
                            if (setMessage) {
                                setMessage(msg);
                                setTimeout(() => setMessage(''), 3000);
                            } else {
                                console.log('Team Generator Message:', msg);
                            }
                        }}
                    />
                </div>
            )}
            
            {/* Список команд */}
            {mixedTeams.length > 0 ? (
                <div className="teams-display-section">
                    <div className="teams-section-header">
                        <h5>🎲 Сформированные команды ({mixedTeams.length})</h5>
                    </div>
                    
                    <div className="teams-grid">
                        {mixedTeams.map((team, index) => (
                            <div key={team.id || index} className="team-card-unified">
                                <div className="team-header">
                                    <h5>{team.name || `Команда ${index + 1}`}</h5>
                                    {calculateTeamAverageRating && (
                                        <div className="team-rating">
                                            Средний рейтинг: {calculateTeamAverageRating(team)}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="team-members">
                                    {team.members?.map((member, memberIndex) => (
                                        <div key={member.user_id || member.participant_id || memberIndex} className="team-member">
                                            <span className="member-name">
                                                {member.user_id ? (
                                                    <Link to={`/profile/${member.user_id}`}>
                                                        {member.name || member.username}
                                                    </Link>
                                                ) : (
                                                    <span>{member.name}</span>
                                                )}
                                            </span>
                                            <span className="member-rating">
                                                {ratingType === 'faceit' 
                                                    ? member.faceit_elo || '—'
                                                    : member.cs2_premier_rank || '—'
                                                }
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="no-teams-state">
                    <div className="no-teams-icon">🎲</div>
                    <h4>Команды не сформированы</h4>
                    <p>
                        {participants.length < 2 
                            ? 'Для генерации команд необходимо минимум 2 участника'
                            : 'Используйте генератор команд выше для создания команд'
                        }
                    </p>
                </div>
            )}
        </div>
    );

    // 🎯 РЕНДЕР ВКЛАДКИ "СТАТИСТИКА"
    const renderStatisticsTab = () => (
        <div className="statistics-tab">
            <div className="statistics-header">
                <h4>Статистика участников</h4>
                <p>Общая информация о составе турнира</p>
            </div>
            
            <div className="statistics-grid">
                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-content">
                        <div className="stat-value">{statistics.total}</div>
                        <div className="stat-label">Всего участников</div>
                    </div>
                </div>
                
                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                        <div className="stat-value">{statistics.registered}</div>
                        <div className="stat-label">Зарегистрированных</div>
                    </div>
                </div>
                
                <div className="stat-card">
                    <div className="stat-icon">👤</div>
                    <div className="stat-content">
                        <div className="stat-value">{statistics.unregistered}</div>
                        <div className="stat-label">Незарегистрированных</div>
                    </div>
                </div>
                
                {statistics.hasRatings && (
                    <>
                        <div className="stat-card">
                            <div className="stat-icon">📊</div>
                            <div className="stat-content">
                                <div className="stat-value">{statistics.avgRating}</div>
                                <div className="stat-label">Средний рейтинг</div>
                            </div>
                        </div>
                        
                        <div className="stat-card">
                            <div className="stat-icon">📈</div>
                            <div className="stat-content">
                                <div className="stat-value">{statistics.maxRating}</div>
                                <div className="stat-label">Максимальный</div>
                            </div>
                        </div>
                        
                        <div className="stat-card">
                            <div className="stat-icon">📉</div>
                            <div className="stat-content">
                                <div className="stat-value">{statistics.minRating}</div>
                                <div className="stat-label">Минимальный</div>
                            </div>
                        </div>
                    </>
                )}
                
                {/* Статистика команд для mix турниров */}
                {tournament?.format === 'mix' && mixedTeams.length > 0 && (
                    <>
                        <div className="stat-card">
                            <div className="stat-icon">🎲</div>
                            <div className="stat-content">
                                <div className="stat-value">{mixedTeams.length}</div>
                                <div className="stat-label">Команд сформировано</div>
                            </div>
                        </div>
                        
                        <div className="stat-card">
                            <div className="stat-icon">⚖️</div>
                            <div className="stat-content">
                                <div className="stat-value">
                                    {Math.round(participants.length / Math.max(mixedTeams.length, 1))}
                                </div>
                                <div className="stat-label">Участников в команде</div>
                            </div>
                        </div>
                    </>
                )}
            </div>
            
            {tournament?.max_participants && (
                <div className="capacity-indicator">
                    <div className="capacity-header">
                        <span>Заполненность турнира</span>
                        <span>{statistics.total} / {tournament.max_participants}</span>
                    </div>
                    <div className="capacity-bar">
                        <div 
                            className="capacity-fill"
                            style={{ 
                                width: `${Math.min((statistics.total / tournament.max_participants) * 100, 100)}%` 
                            }}
                        />
                    </div>
                    <div className="capacity-status">
                        {statistics.total >= tournament.max_participants ? (
                            <span className="status-full">🔴 Турнир заполнен</span>
                        ) : (
                            <span className="status-available">
                                🟢 Доступно мест: {tournament.max_participants - statistics.total}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="unified-participants-panel">
            {/* Навигация по табам */}
            <div className="unified-tabs-navigation">
                {tabs
                    .filter(tab => tab.show !== false)
                    .map(tab => (
                        <button
                            key={tab.id}
                            className={`unified-tab-btn ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
                            onClick={() => !tab.disabled && setActiveTab(tab.id)}
                            disabled={tab.disabled}
                        >
                            <span className="tab-icon">{tab.icon}</span>
                            <span className="tab-label">{tab.label}</span>
                            {tab.count !== undefined && (
                                <span className="tab-count">{tab.count}</span>
                            )}
                        </button>
                    ))}
            </div>
            
            {/* Контент табов */}
            <div className="unified-tab-content">
                {activeTab === 'current' && renderCurrentParticipantsTab()}
                {activeTab === 'add' && renderAddParticipantsTab()}
                {activeTab === 'teams' && renderTeamsTab()}
                {activeTab === 'statistics' && renderStatisticsTab()}
            </div>
        </div>
    );
};

export default UnifiedParticipantsPanel; 