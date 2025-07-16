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
import TournamentSettingsPanel from './TournamentSettingsPanel';
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
    onClearResults,
    // 🆕 НОВЫЕ ПРОПСЫ ДЛЯ УПРАВЛЕНИЯ АДМИНИСТРАТОРАМИ
    onInviteAdmin,
    onRemoveAdmin,
    onShowAdminSearchModal,
    // 🆕 НОВЫЙ ПРОПС ДЛЯ УПРАВЛЕНИЯ НАСТРОЙКАМИ ТУРНИРА
    onUpdateTournamentSetting,
    // 🗑️ НОВЫЙ ПРОПС ДЛЯ УДАЛЕНИЯ ТУРНИРА
    onDeleteTournament,
    // 🆕 ДОБАВЛЕН ПРОПС USER ДЛЯ ПРОВЕРКИ СОЗДАТЕЛЯ
    user,
    // 🆕 НОВЫЙ ПРОПС ДЛЯ СОЗДАНИЯ ЛОББИ МАТЧА
    onCreateMatchLobby
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

    // 🎯 НОВАЯ ФУНКЦИЯ ДЛЯ ОПРЕДЕЛЕНИЯ СЛЕДУЮЩЕГО ЭТАПА
    const getNextStageAction = () => {
        const hasMatches = matches && matches.length > 0;
        const hasBracket = hasMatches;
        const participantsCount = participants?.length || 0;

        switch (tournament?.status) {
            case 'registration':
            case 'active':
                if (hasBracket) {
                    // Если сетка есть - можно начинать турнир
                    return {
                        action: 'start',
                        label: '🚀 Начать турнир',
                        className: 'next-stage-btn start-stage',
                        handler: onStartTournament
                    };
                } else {
                    // Если сетки нет - показываем кнопку начала с предупреждением
                    if (participantsCount >= 2) {
                        return {
                            action: 'start_warning',
                            label: '🚀 Начать турнир',
                            className: 'next-stage-btn start-stage',
                            handler: () => handleStartWithWarning()
                        };
                    } else {
                        return {
                            action: 'waiting',
                            label: '⏳ Ожидание участников',
                            className: 'next-stage-btn waiting-stage',
                            disabled: true
                        };
                    }
                }

            case 'in_progress':
                return {
                    action: 'end',
                    label: '🏁 Завершить турнир',
                    className: 'next-stage-btn end-stage',
                    handler: onEndTournament
                };

            case 'completed':
                return {
                    action: 'completed',
                    label: '✅ Турнир завершен',
                    className: 'next-stage-btn completed-stage',
                    disabled: true
                };

            default:
                return null;
        }
    };

    // 🎯 НОВАЯ ФУНКЦИЯ ДЛЯ ОБРАБОТКИ НАЧАЛА ТУРНИРА БЕЗ СЕТКИ
    const handleStartWithWarning = () => {
        const confirmed = window.confirm(
            '⚠️ Внимание!\n\n' +
            'Сетка турнира еще не создана. Перед началом турнира необходимо сгенерировать турнирную сетку.\n\n' +
            'Вы можете:\n' +
            '1. Сначала создать сетку в разделе "Управление сеткой"\n' +
            '2. Затем нажать "Начать турнир"\n\n' +
            'Хотите создать сетку сейчас?'
        );
        
        if (confirmed && onGenerateBracket) {
            onGenerateBracket();
        }
    };

    const statusDisplay = getStatusDisplay();
    const nextStageAction = getNextStageAction();
    const hasMatches = matches && matches.length > 0;
    const hasBracket = hasMatches;
    const hasNoResults = matches?.some(m => m.status === 'completed') || matches?.some(m => m.status === 'ready');

    return (
        <div className="tournament-admin-panel-v2">
            {/* 🎯 ЗАГОЛОВОК С СТАТУСОМ И КНОПКОЙ СЛЕДУЮЩЕГО ЭТАПА */}
            <div className="admin-panel-header-v2">
                <div className="header-main-info">
                    <h3>⚙️ Панель управления турниром</h3>
                    <div className="status-and-action">
                        <div className={`tournament-status-v2 ${statusDisplay.class}`}>
                            <span className="status-icon-v2">{statusDisplay.icon}</span>
                            <span className="status-text-v2">{statusDisplay.text}</span>
                        </div>
                        
                        {/* 🎯 КНОПКА СЛЕДУЮЩЕГО ЭТАПА */}
                        {nextStageAction && (
                            <button 
                                className={nextStageAction.className}
                                onClick={nextStageAction.handler}
                                disabled={nextStageAction.disabled || isLoading}
                                title={nextStageAction.label}
                            >
                                {nextStageAction.label}
                            </button>
                        )}
                    </div>
                </div>

                {/* 🎯 ДОПОЛНИТЕЛЬНЫЕ КНОПКИ УПРАВЛЕНИЯ (ЕСЛИ НУЖНЫ) */}
                <div className="header-controls">
                    {/* Перегенерация сетки */}
                    {tournament?.status === 'active' && hasBracket && (
                        <button 
                            className="header-control-btn secondary-btn-v2"
                            onClick={onRegenerateBracket}
                            disabled={isLoading}
                            title="Пересоздать турнирную сетку"
                        >
                            🔄 Перегенерировать
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
                                                    to={`/user/${participant.user_id}`}
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

                {/* 🆕 УПРАВЛЕНИЕ АДМИНИСТРАТОРАМИ ТУРНИРА */}
                <div className="admins-section-v2">
                    <div className="section-header">
                        <h4>👑 Администраторы турнира</h4>
                        <div className="section-controls">
                            <button 
                                className="add-btn-compact invite-admin-btn"
                                onClick={onShowAdminSearchModal}
                                disabled={isLoading}
                                title="Пригласить администратора"
                            >
                                ➕ Пригласить
                            </button>
                        </div>
                    </div>

                    <div className="current-admins-list">
                        {/* Создатель турнира */}
                        <div className="admin-item creator">
                            <div className="admin-info">
                                <div className="admin-name">
                                    {tournament?.creator_username || 
                                     (tournament?.created_by ? `User ID: ${tournament.created_by}` : 'Неизвестный создатель')}
                                </div>
                                <div className="admin-role">Создатель турнира</div>
                            </div>
                            <div className="admin-actions">
                                <span className="creator-badge">👑 Создатель</span>
                            </div>
                        </div>

                        {/* Дополнительные администраторы */}
                        {tournament?.admins && tournament.admins.length > 0 && tournament.admins.map(admin => (
                            <div key={admin.id} className="admin-item">
                                <div className="admin-info">
                                    <div className="admin-name">{admin.username}</div>
                                    <div className="admin-role">Администратор</div>
                                </div>
                                <div className="admin-actions">
                                    <button
                                        className="remove-admin-btn"
                                        onClick={() => onRemoveAdmin(admin.user_id)}
                                        title="Удалить администратора"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 🎯 УПРАВЛЕНИЕ ТУРНИРНОЙ СЕТКОЙ */}
                <div className="bracket-section-v2">
                    <h4>🏆 Управление сеткой</h4>
                    <div className="bracket-actions">
                        {/* Генерация сетки */}
                        {tournament?.status === 'active' && !hasBracket && participants?.length >= 2 && (
                            <button 
                                className="action-btn-v2 generate-btn"
                                onClick={() => onGenerateBracket()}
                                disabled={isLoading}
                                title="Создать турнирную сетку"
                            >
                                🎲 Генерировать сетку
                            </button>
                        )}
                        
                        {/* Регенерация сетки */}
                        {tournament?.status === 'active' && hasBracket && hasNoResults && (
                            <button 
                                className="action-btn-v2 regenerate-btn"
                                onClick={() => onRegenerateBracket()}
                                disabled={isLoading}
                                title="Перегенерировать турнирную сетку"
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

                {/* 🎮 УПРАВЛЕНИЕ ЛОББИ МАТЧЕЙ (для CS2) */}
                {tournament?.lobby_enabled && tournament?.status === 'in_progress' && (
                    <div className="lobby-section-v2">
                        <h4>🎮 Управление лобби матчей</h4>
                        <div className="lobby-info">
                            <p>Лобби матчей включено для этого турнира</p>
                            <small>Участники будут получать приглашения для выбора карт перед началом матча</small>
                        </div>
                        <div className="lobby-actions">
                            {matches?.filter(m => m.status === 'ready' && !m.lobby_created).map(match => (
                                <button
                                    key={match.id}
                                    className="action-btn-v2 create-lobby-btn"
                                    onClick={() => onCreateMatchLobby && onCreateMatchLobby(match.id)}
                                    disabled={isLoading}
                                    title={`Создать лобби для матча ${match.team1_name} vs ${match.team2_name}`}
                                >
                                    🎮 Создать лобби: {match.team1_name} vs {match.team2_name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 🆕 УПРАВЛЕНИЕ НАСТРОЙКАМИ ТУРНИРА */}
                {tournament?.status === 'active' && (
                    <TournamentSettingsPanel 
                        tournament={tournament}
                        isLoading={isLoading}
                        onUpdateSetting={onUpdateTournamentSetting}
                    />
                )}

                {/* 🎯 УПРАВЛЕНИЕ РЕЗУЛЬТАТАМИ */}
                {tournament?.status === 'ongoing' && matches?.some(m => m.status === 'completed') && (
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
                            <button 
                                className="action-btn-v2 reset-btn"
                                onClick={onClearResults}
                                disabled={isLoading}
                                title="Сбросить все результаты матчей и вернуть их в исходное состояние"
                            >
                                🔄 Сбросить результаты
                            </button>
                        </div>
                    </div>
                )}

                {/* 🎯 УПРАВЛЕНИЕ МАТЧАМИ */}
                {tournament?.status === 'ongoing' && matches?.some(m => m.status === 'completed') && (
                    <div className="matches-section-v2">
                        <h4>⚔️ Управление матчами</h4>
                        <div className="matches-actions">
                            <button 
                                className="action-btn-v2 edit-btn"
                                onClick={() => onEditMatchResult()}
                                disabled={isLoading}
                            >
                                ✏️ Редактировать результат
                            </button>
                        </div>
                    </div>
                )}

                {/* 🚨 ОПАСНЫЕ ДЕЙСТВИЯ */}
                <div className="danger-zone-section-v2">
                    <h4>🚨 Опасные действия</h4>
                    <div className="danger-zone-warning">
                        <p>⚠️ Действия в этой секции необратимы. Будьте осторожны!</p>
                    </div>
                    <div className="danger-actions">
                        {/* 🗑️ УДАЛЕНИЕ ТУРНИРА - ТОЛЬКО ДЛЯ СОЗДАТЕЛЯ */}
                        {tournament?.created_by === user?.id && (
                            <button 
                                className="action-btn-v2 danger-btn delete-tournament-btn"
                                onClick={onDeleteTournament}
                                disabled={isLoading}
                                title="Удалить турнир полностью (только для создателя)"
                            >
                                🗑️ Удалить турнир
                            </button>
                        )}
                        {tournament?.created_by !== user?.id && (
                            <div className="creator-only-warning">
                                <p>⚠️ Удаление турнира доступно только создателю</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TournamentAdminPanel; 