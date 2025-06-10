/**
 * TournamentFloatingActionPanel v1.1.0 - Плавающая панель действий + Селектор вида
 * 
 * @version 1.1.0 (Добавлен селектор вида отображения участников)
 * @created 2025-01-22
 * @updated 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Компактная плавающая панель управления турниром + переключение видов участников
 * @features Сворачивание/разворачивание, умное отображение кнопок, анимации, селектор вида участников
 */

import React, { useState, useMemo } from 'react';
import './TournamentFloatingActionPanel.css';

const TournamentFloatingActionPanel = ({
    tournament,
    user,
    hasAccess,
    onStartTournament,
    onEndTournament,
    onGenerateBracket,
    onRegenerateBracket,
    onClearResults,
    hasMatches = false,
    hasBracket = false,
    // 🆕 Новые пропсы для управления видом отображения участников
    displayMode = 'smart-cards',
    onDisplayModeChange,
    showDisplayModeSelector = true, // Флаг для показа/скрытия селектора
    // 🆕 Новые пропсы для переформирования команд
    mixedTeams = [],
    onReformTeams
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // 🎨 Конфигурация видов отображения
    const displayModes = [
        {
            id: 'smart-cards',
            label: 'Smart Cards',
            description: 'Современные карточки с богатым контентом',
            icon: '🃏'
        },
        {
            id: 'data-table', 
            label: 'Data Table',
            description: 'Профессиональная таблица данных',
            icon: '📋'
        },
        {
            id: 'gaming-roster',
            label: 'Gaming Roster', 
            description: 'Геймифицированный интерфейс',
            icon: '⚡'
        }
    ];

    // Проверка прав доступа
    const isAdminOrCreator = hasAccess || (user && tournament && 
        (tournament.creator_id === user.id || tournament.created_by === user.id || user.role === 'admin'));

    // 🆕 ФУНКЦИЯ ПРОВЕРКИ ВОЗМОЖНОСТИ ПЕРЕФОРМИРОВАНИЯ КОМАНД
    const canReformTeams = useMemo(() => {
        // Базовые проверки
        if (!tournament || !isAdminOrCreator) return false;
        
        // Проверка статуса турнира - должен быть 'active', но НЕ 'in_progress'
        if (tournament.status !== 'active') return false;
        
        // Проверка что турнир микс-формата
        if (tournament.format !== 'mix') return false;
        
        // Проверка наличия команд для переформирования
        const hasTeams = (mixedTeams && mixedTeams.length > 0) || 
                         (tournament.teams && tournament.teams.length > 0);
        if (!hasTeams) return false;
        
        // Проверка что нет созданных матчей (турнир еще не начался)
        if (tournament.matches && tournament.matches.length > 0) return false;
        if (hasMatches) return false;
        
        return true;
    }, [tournament, isAdminOrCreator, mixedTeams, hasMatches]);

    // Определяем доступные действия на основе статуса турнира
    const availableActions = useMemo(() => {
        if (!tournament) return [];
        
        const actions = [];
        const status = tournament.status;

        // "Сгенерировать турнирную сетку" - при статусе "Активный", если сетки нет
        if (status === 'active' && !hasBracket) {
            actions.push({
                id: 'generate-bracket',
                icon: '⚡',
                title: 'Сгенерировать турнирную сетку',
                description: 'Создать турнирную сетку для проведения турнира',
                onClick: onGenerateBracket,
                color: 'primary',
                priority: 1
            });
        }

        // "Перегенерация турнирной сетки" - при статусе "Активный", если сетка есть
        if (status === 'active' && hasBracket) {
            actions.push({
                id: 'regenerate-bracket',
                icon: '🔄',
                title: 'Перегенерировать сетку',
                description: 'Заново создать турнирную сетку',
                onClick: onRegenerateBracket,
                color: 'warning',
                priority: 2
            });
        }

        // 🆕 "Переформировать команды" - для микс турниров с активными командами
        if (canReformTeams && onReformTeams) {
            actions.push({
                id: 'reform-teams',
                icon: '🔄',
                title: 'Переформировать команды',
                description: 'Пересоздать команды на основе рейтинга участников',
                onClick: onReformTeams,
                color: 'warning',
                priority: 2
            });
        }

        // "Начать турнир" - при статусе "Активный", если сетка есть
        if (status === 'active' && hasBracket) {
            actions.push({
                id: 'start-tournament',
                icon: '🚀',
                title: 'Начать турнир',
                description: 'Запустить проведение турнира',
                onClick: onStartTournament,
                color: 'success',
                priority: 1
            });
        }

        // "Очистить результаты матчей" - при статусе "Идет", если есть матчи
        if (status === 'in_progress' && hasMatches) {
            actions.push({
                id: 'clear-results',
                icon: '🗑️',
                title: 'Очистить результаты',
                description: 'Удалить все результаты матчей',
                onClick: onClearResults,
                color: 'danger',
                priority: 3
            });
        }

        // "Завершить турнир" - при статусе "Идет"
        if (status === 'in_progress') {
            actions.push({
                id: 'end-tournament',
                icon: '🏁',
                title: 'Завершить турнир',
                description: 'Завершить проведение турнира',
                onClick: onEndTournament,
                color: 'primary',
                priority: 1
            });
        }

        // Сортируем по приоритету (меньшее число = выше приоритет)
        return actions.sort((a, b) => a.priority - b.priority);
    }, [tournament, hasBracket, hasMatches, canReformTeams, 
        onStartTournament, onEndTournament, onGenerateBracket, 
        onRegenerateBracket, onClearResults, onReformTeams]);

    // Если нет прав или турнира - не показываем панель вообще
    if (!isAdminOrCreator || !tournament) {
        return null;
    }

    // Если нет доступных действий - не показываем панель
    if (availableActions.length === 0) {
        return null;
    }

    // Обработчик переключения состояния панели
    const handleToggle = () => {
        if (isAnimating) return;
        
        setIsAnimating(true);
        setIsExpanded(!isExpanded);
        
        // Убираем флаг анимации после завершения
        setTimeout(() => setIsAnimating(false), 300);
    };

    // Обработчик клика по действию
    const handleActionClick = (action) => {
        if (action.onClick && typeof action.onClick === 'function') {
            action.onClick();
        }
    };

    // 🎨 Обработчик изменения вида отображения участников
    const handleDisplayModeChange = (newMode) => {
        if (onDisplayModeChange && typeof onDisplayModeChange === 'function') {
            onDisplayModeChange(newMode);
        }
    };

    // Определяем цвет индикатора статуса
    const getStatusIndicatorColor = () => {
        switch (tournament.status) {
            case 'active': return '#4CAF50';
            case 'in_progress': return '#FF9800';
            case 'completed': return '#9E9E9E';
            default: return '#2196F3';
        }
    };

    // Текст статуса турнира на русском
    const getStatusText = () => {
        switch (tournament.status) {
            case 'active': return 'Активный';
            case 'in_progress': return 'Идет';
            case 'completed': return 'Завершен';
            default: return 'Неизвестно';
        }
    };

    return (
        <div className={`tournament-floating-panel ${isExpanded ? 'expanded' : 'collapsed'} ${isAnimating ? 'animating' : ''}`}>
            {/* Основная кнопка-переключатель */}
            <div className="floating-panel-toggle" onClick={handleToggle}>
                <div className="toggle-icon">
                    {isExpanded ? '✕' : '⚙️'}
                </div>
                <div className="status-indicator" style={{ backgroundColor: getStatusIndicatorColor() }}>
                    <div className="status-text">{getStatusText()}</div>
                </div>
                <div className="actions-count">
                    {availableActions.length}
                </div>
            </div>

            {/* Развернутая панель с действиями */}
            {isExpanded && (
                <div className="floating-panel-content">
                    <div className="panel-header">
                        <h4>Управление турниром</h4>
                        <span className="tournament-name">{tournament.name}</span>
                    </div>

                    {/* 🆕 СЕКЦИЯ СЕЛЕКТОРА ВИДА ОТОБРАЖЕНИЯ */}
                    {showDisplayModeSelector && onDisplayModeChange && (
                        <div className="display-mode-section-participants-list">
                            <div className="section-header-participants-list">
                                <span className="section-icon-participants-list">🎨</span>
                                <span className="section-title-participants-list">Вид участников</span>
                            </div>
                            <div className="display-mode-selector-participants-list">
                                <select
                                    className="floating-display-mode-select-participants-list"
                                    value={displayMode}
                                    onChange={(e) => handleDisplayModeChange(e.target.value)}
                                    title="Переключить вид отображения участников"
                                >
                                    {displayModes.map(mode => (
                                        <option key={mode.id} value={mode.id}>
                                            {mode.icon} {mode.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="mode-description-participants-list">
                                    {displayModes.find(mode => mode.id === displayMode)?.description}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="panel-actions">
                        {availableActions.map((action) => (
                            <div 
                                key={action.id}
                                className={`floating-action-item ${action.color}`}
                                onClick={() => handleActionClick(action)}
                                title={action.description}
                            >
                                <div className="action-icon">
                                    {action.icon}
                                </div>
                                <div className="action-content">
                                    <div className="action-title">
                                        {action.title}
                                    </div>
                                    <div className="action-description">
                                        {action.description}
                                    </div>
                                </div>
                                <div className="action-arrow">
                                    →
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="panel-footer">
                        <div className="panel-info">
                            💡 Доступные действия для статуса: <strong>{getStatusText()}</strong>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentFloatingActionPanel; 