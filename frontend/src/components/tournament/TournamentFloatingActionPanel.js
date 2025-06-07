/**
 * TournamentFloatingActionPanel v1.0.1 - Плавающая панель действий
 * 
 * @version 1.0.1 (Исправлено нарушение правил React Hooks)
 * @created 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Компактная плавающая панель управления турниром
 * @features Сворачивание/разворачивание, умное отображение кнопок, анимации
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
    hasBracket = false
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Проверка прав доступа
    const isAdminOrCreator = hasAccess || (user && tournament && 
        (tournament.creator_id === user.id || tournament.created_by === user.id || user.role === 'admin'));

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
    }, [tournament, hasBracket, hasMatches, onStartTournament, onEndTournament, 
        onGenerateBracket, onRegenerateBracket, onClearResults]);

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