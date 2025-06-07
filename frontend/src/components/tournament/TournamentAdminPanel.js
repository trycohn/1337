/**
 * TournamentAdminPanel v2.0.0 - Минималистичная панель управления
 * 
 * @version 2.0.0 (Оптимизированная версия)
 * @updated 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Минималистичная панель управления турниром с умным дизайном
 * @features Аватары участников, ELO рейтинги, кнопки в заголовке, масштабируемость
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ensureHttps } from '../../utils/userHelpers';
import './TournamentAdminPanel.css';

const TournamentAdminPanel = ({
    tournament,
    participants,
    matches,
    isCreatorOrAdmin,
    isLoading,
    onStartTournament,
    onEndTournament,
    onRegenerateBracket,
    onShowAddParticipantModal,
    onShowParticipantSearchModal,
    onRemoveParticipant,
    onEditMatchResult,
    onGenerateBracket,
    onClearResults
}) => {
    if (!isCreatorOrAdmin) {
        return null;
    }

    const getStatusDisplay = () => {
        const statusMap = {
            'registration': { icon: '📋', text: 'Регистрация', class: 'status-registration' },
            'active': { icon: '🎮', text: 'Активный', class: 'status-active' },
            'in_progress': { icon: '⚔️', text: 'В процессе', class: 'status-in-progress' },
            'completed': { icon: '🏆', text: 'Завершен', class: 'status-completed' }
        };
        
        return statusMap[tournament?.status] || { icon: '❓', text: 'Неизвестно', class: 'status-unknown' };
    };

    const statusDisplay = getStatusDisplay();
    const hasMatches = matches && matches.length > 0;
    const hasBracket = hasMatches;

    return (
        <div className="tournament-admin-panel-v2">
            {/* 🎯 ЗАГОЛОВОК С СТАТУСОМ И КНОПКАМИ УПРАВЛЕНИЯ */}
            <div className="admin-panel-header-v2">
                <div className="header-main-info">
                    <h3>⚙️ Панель управления турниром</h3>
                    <div className={`tournament-status-v2 ${statusDisplay.class}`}>
                        <span className="status-icon-v2">{statusDisplay.icon}</span>
                        <span className="status-text-v2">{statusDisplay.text}</span>
                    </div>
                </div>

                {/* 🎯 КНОПКИ УПРАВЛЕНИЯ СТАТУСОМ В ЗАГОЛОВКЕ */}
                <div className="header-controls">
                    {/* Начать турнир */}
                    {tournament?.status === 'active' && hasBracket && (
                        <button 
                            className="header-control-btn start-btn-v2"
                            onClick={onStartTournament}
                            disabled={isLoading}
                            title="Запустить турнир"
                        >
                            🚀 Начать турнир
                        </button>
                    )}

                    {/* Завершить турнир */}
                    {tournament?.status === 'in_progress' && (
                        <button 
                            className="header-control-btn end-btn-v2"
                            onClick={onEndTournament}
                            disabled={isLoading}
                            title="Завершить турнир"
                        >
                            🏁 Завершить турнир
                        </button>
                    )}
                </div>
            </div>

            <div className="admin-panel-content-v2">
                {/* 🎯 КРАТКАЯ ИНФОРМАЦИЯ О ТУРНИРЕ */}
                <div className="tournament-info-compact">
                    <div className="info-stats">
                        <div className="stat-item">
                            <span className="stat-value">{participants?.length || 0}</span>
                            <span className="stat-label">Участников</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{matches?.length || 0}</span>
                            <span className="stat-label">Матчей</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{tournament?.game || 'N/A'}</span>
                            <span className="stat-label">Игра</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{tournament?.format || 'N/A'}</span>
                            <span className="stat-label">Формат</span>
                        </div>
                    </div>
                </div>

                {/* 🎯 МИНИМАЛИСТИЧНЫЙ СПИСОК УЧАСТНИКОВ */}
                {participants && participants.length > 0 && (
                    <div className="participants-section-v2">
                        <div className="section-header">
                            <h4>👥 Участники ({participants.length})</h4>
                            {tournament?.status === 'active' && !hasBracket && (
                                <div className="section-controls">
                                    <button 
                                        className="add-btn-compact"
                                        onClick={onShowParticipantSearchModal}
                                        disabled={isLoading}
                                        title="Найти участника"
                                    >
                                        🔍
                                    </button>
                                    <button 
                                        className="add-btn-compact"
                                        onClick={onShowAddParticipantModal}
                                        disabled={isLoading}
                                        title="Добавить незарегистрированного"
                                    >
                                        👤
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="participants-grid-v2">
                            {participants.map((participant, index) => (
                                <div key={participant.id || index} className="participant-card-v2">
                                    <div className="participant-info-v2">
                                        {/* АВАТАР УЧАСТНИКА */}
                                        <div className="participant-avatar-v2">
                                            {participant.avatar_url ? (
                                                <img 
                                                    src={ensureHttps(participant.avatar_url)} 
                                                    alt={participant.name || participant.username || 'Участник'}
                                                    onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                />
                                            ) : (
                                                <div className="avatar-placeholder-v2">
                                                    {(participant.name || participant.username || 'У').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        {/* ИНФОРМАЦИЯ ОБ УЧАСТНИКЕ */}
                                        <div className="participant-details-v2">
                                            {participant.user_id ? (
                                                <Link 
                                                    to={`/profile/${participant.user_id}`}
                                                    className="participant-name-v2"
                                                >
                                                    {participant.name || participant.username || 'Участник'}
                                                </Link>
                                            ) : (
                                                <span className="participant-name-v2 unregistered">
                                                    {participant.name || 'Незарегистрированный участник'}
                                                </span>
                                            )}
                                            
                                            {/* ELO РЕЙТИНГ */}
                                            {participant.faceit_elo && (
                                                <div className="participant-elo-v2">
                                                    {participant.faceit_elo} ELO
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* КНОПКА УДАЛЕНИЯ */}
                                    {tournament?.status === 'active' && !hasBracket && (
                                        <button
                                            className="remove-participant-btn-v2"
                                            onClick={() => onRemoveParticipant(participant.id)}
                                            disabled={isLoading}
                                            title="Удалить участника"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 🎯 УПРАВЛЕНИЕ ТУРНИРНОЙ СЕТКОЙ */}
                <div className="bracket-section-v2">
                    <h4>🏆 Управление сеткой</h4>
                    <div className="bracket-actions">
                        {/* Генерация сетки */}
                        {tournament?.status === 'active' && !hasBracket && participants?.length >= 2 && (
                            <button 
                                className="action-btn-v2 generate-btn"
                                onClick={onGenerateBracket}
                                disabled={isLoading}
                                title="Создать турнирную сетку"
                            >
                                ⚡ Сгенерировать сетку
                            </button>
                        )}

                        {/* Перегенерация сетки */}
                        {tournament?.status === 'active' && hasBracket && (
                            <button 
                                className="action-btn-v2 regenerate-btn"
                                onClick={onRegenerateBracket}
                                disabled={isLoading}
                                title="Пересоздать турнирную сетку"
                            >
                                🔄 Перегенерировать сетку
                            </button>
                        )}
                    </div>

                    {participants?.length < 2 && (
                        <div className="warning-message-v2">
                            ⚠️ Для создания сетки нужно минимум 2 участника
                        </div>
                    )}
                </div>

                {/* 🎯 УПРАВЛЕНИЕ РЕЗУЛЬТАТАМИ */}
                {tournament?.status === 'in_progress' && matches?.some(m => m.status === 'completed') && (
                    <div className="results-section-v2">
                        <h4>📊 Управление результатами</h4>
                        <div className="results-actions">
                            <button 
                                className="action-btn-v2 clear-btn"
                                onClick={onClearResults}
                                disabled={isLoading}
                                title="Очистить все результаты матчей"
                            >
                                🗑️ Очистить результаты
                            </button>
                        </div>
                    </div>
                )}

                {/* 🎯 УПРАВЛЕНИЕ МАТЧАМИ */}
                {tournament?.status === 'in_progress' && matches && matches.length > 0 && (
                    <div className="matches-section-v2">
                        <h4>⚔️ Активные матчи</h4>
                        <div className="matches-list-v2">
                            {matches
                                .filter(match => match.status !== 'completed')
                                .slice(0, 3)
                                .map((match, index) => (
                                    <div key={match.id || index} className="match-item-v2">
                                        <div className="match-info-v2">
                                            <div className="match-teams">
                                                {match.team1_name || match.participant1_name || 'Команда 1'} vs{' '}
                                                {match.team2_name || match.participant2_name || 'Команда 2'}
                                            </div>
                                            <div className="match-round">
                                                Раунд {match.round || '?'}
                                            </div>
                                        </div>
                                        <button
                                            className="edit-match-btn-v2"
                                            onClick={() => onEditMatchResult(match)}
                                            disabled={isLoading}
                                            title="Редактировать результат"
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* 🎯 ЗАВЕРШЕННЫЙ ТУРНИР */}
                {tournament?.status === 'completed' && (
                    <div className="completed-section-v2">
                        <div className="completed-status-v2">
                            <span className="completed-icon">🏆</span>
                            <div className="completed-text">
                                <p>Турнир успешно завершен</p>
                                <p>Все результаты сохранены</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TournamentAdminPanel; 