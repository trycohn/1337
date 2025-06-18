import React, { useState, useEffect } from 'react';
import './TournamentInfoSection.css';
import { ensureHttps } from '../utils/userHelpers';

const TournamentInfoSection = ({ tournament, user, isCreator, isAdminOrCreator }) => {
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingRegulations, setIsEditingRegulations] = useState(false);
    const [description, setDescription] = useState(tournament?.description || '');
    const [regulations, setRegulations] = useState(tournament?.regulations || '');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [showActions, setShowActions] = useState(false);

    // Обновляем значения при изменении турнира
    useEffect(() => {
        setDescription(tournament?.description || '');
        setRegulations(tournament?.regulations || '');
    }, [tournament]);

    // Функция для получения читаемого названия дисциплины
    const getGameDisplayName = (game) => {
        const gameNames = {
            'Counter-Strike 2': 'Counter-Strike 2',
            'Counter Strike 2': 'Counter-Strike 2',
            'cs2': 'Counter-Strike 2',
            'dota2': 'Dota 2',
            'Dota 2': 'Dota 2',
            'valorant': 'Valorant',
            'lol': 'League of Legends',
            'overwatch': 'Overwatch 2'
        };
        return gameNames[game] || game || 'Не указана';
    };

    // Функция для получения читаемого названия формата
    const getFormatDisplayName = (format) => {
        const formatNames = {
            'single_elimination': 'Одиночное исключение',
            'double_elimination': 'Двойное исключение',
            'round_robin': 'Круговой турнир',
            'swiss': 'Швейцарская система',
            'mix': 'Микс-турнир'
        };
        return formatNames[format] || format || 'Не указан';
    };

    // Функция для получения читаемого названия типа участников
    const getParticipantTypeDisplayName = (type) => {
        const typeNames = {
            'solo': 'Одиночный',
            'team': 'Командный',
            'mix': 'Микс'
        };
        return typeNames[type] || type || 'Не указан';
    };

    // 🆕 Функция для получения читаемого статуса турнира
    const getStatusDisplayName = (status) => {
        const statusConfig = {
            // 🔧 ИСПРАВЛЕННЫЕ СТАТУСЫ - соответствуют backend API
            'active': { label: '🟢 Активный', class: 'status-active' },
            'in_progress': { label: '🟢 Идет', class: 'status-in-progress' },
            'in-progress': { label: '🟢 Идет', class: 'status-in-progress' }, // Альтернативное написание
            'completed': { label: '✅ Завершен', class: 'status-completed' },
            
            // 🔧 ДОПОЛНИТЕЛЬНЫЕ СТАТУСЫ (если будут добавлены в будущем)
            'upcoming': { label: '🔜 Предстоящий', class: 'status-upcoming' },
            'ongoing': { label: '🟢 Идет', class: 'status-ongoing' },
            'cancelled': { label: '❌ Отменен', class: 'status-cancelled' },
            'paused': { label: '⏸️ Приостановлен', class: 'status-paused' },
            'pending': { label: '⏳ Ожидание', class: 'status-pending' }
        };
        
        const result = statusConfig[status] || { label: `❓ ${status || 'Неизвестно'}`, class: 'status-unknown' };
        
        // 🔧 ОТЛАДОЧНАЯ ИНФОРМАЦИЯ
        console.log('🔍 getStatusDisplayName:', {
            inputStatus: status,
            inputType: typeof status,
            foundConfig: !!statusConfig[status],
            result: result
        });
        
        return result;
    };

    // Функция для форматирования даты
    const formatDate = (dateString) => {
        if (!dateString) return 'Не указана';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Некорректная дата';
        }
    };

    // Сохранение описания
    const handleSaveDescription = async () => {
        setIsLoading(true);
        try {
            // TODO: Добавить API вызов для сохранения описания
            console.log('Сохранение описания:', description);
            setIsEditingDescription(false);
        } catch (error) {
            console.error('Ошибка сохранения описания:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Сохранение регламента
    const handleSaveRegulations = async () => {
        setIsLoading(true);
        try {
            // TODO: Добавить API вызов для сохранения регламента
            console.log('Сохранение регламента:', regulations);
            setIsEditingRegulations(false);
        } catch (error) {
            console.error('Ошибка сохранения регламента:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Отмена редактирования описания
    const handleCancelDescription = () => {
        setDescription(tournament?.description || '');
        setIsEditingDescription(false);
    };

    // Отмена редактирования регламента
    const handleCancelRegulations = () => {
        setRegulations(tournament?.regulations || '');
        setIsEditingRegulations(false);
    };

    const handleParticipantClick = (participant) => {
        setSelectedParticipant(participant);
        setShowActions(true);
    };

    const handleOpenProfile = () => {
        if (selectedParticipant) {
            window.open(`/profile/${selectedParticipant.id}`, '_blank');
            setShowActions(false);
            setSelectedParticipant(null);
        }
    };

    // 🆕 Получение информации о создателе турнира
    const getCreatorInfo = () => {
        if (tournament?.creator_username) {
            return {
                id: tournament.created_by,
                username: tournament.creator_username,
                avatar_url: tournament.creator_avatar_url
            };
        }
        return null;
    };

    // 🆕 Получение списка администраторов
    const getAdmins = () => {
        if (Array.isArray(tournament?.admins)) {
            return tournament.admins;
        }
        return [];
    };

    const creatorInfo = getCreatorInfo();
    const adminsList = getAdmins();
    const statusInfo = getStatusDisplayName(tournament?.status);

    return (
        <div className="tournament-info-section">
            <div className="section-header">
                <h2>📋 Информация о турнире</h2>
            </div>

            {/* Основная информация о турнире */}
            <div className="tournament-meta-grid">
                <div className="meta-row">
                    <div className="meta-item">
                        <strong>🎮 Дисциплина:</strong>
                        <span>{getGameDisplayName(tournament?.game)}</span>
                    </div>
                    
                    <div className="meta-item">
                        <strong>🏆 Формат турнира:</strong>
                        <span>{getFormatDisplayName(tournament?.format)}</span>
                    </div>
                </div>

                <div className="meta-row">
                    <div className="meta-item">
                        <strong>👥 Тип участия:</strong>
                        <span>{getParticipantTypeDisplayName(tournament?.participant_type)}</span>
                    </div>
                    
                    <div className="meta-item">
                        <strong>📊 Участников:</strong>
                        <span>
                            {tournament?.participants?.length || 0}
                            {tournament?.max_participants && ` / ${tournament.max_participants}`}
                        </span>
                    </div>
                </div>

                <div className="meta-row">
                    <div className="meta-item">
                        <strong>📅 Дата создания:</strong>
                        <span>{formatDate(tournament?.created_at)}</span>
                    </div>
                    
                    <div className="meta-item">
                        <strong>🚀 Дата старта:</strong>
                        <span>{formatDate(tournament?.start_date) || 'Не назначена'}</span>
                    </div>
                </div>

                <div className="meta-row">
                    <div className="meta-item">
                        <strong>⚡ Статус:</strong>
                        <span className={`status-badge ${statusInfo.class}`}>
                            {statusInfo.label}
                        </span>
                    </div>

                    {tournament?.prize_pool && (
                        <div className="meta-item">
                            <strong>💰 Призовой фонд:</strong>
                            <span>{tournament.prize_pool}</span>
                        </div>
                    )}
                </div>

                {/* 🆕 Блок с создателем и администраторами */}
                <div className="meta-row">
                    <div className="meta-item creator-meta">
                        <strong>👤 Создатель турнира:</strong>
                        <div className="creator-display">
                            <div className="creator-avatar">
                                {creatorInfo?.avatar_url ? (
                                    <img 
                                        src={ensureHttps(creatorInfo.avatar_url)} 
                                        alt={creatorInfo.username}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                ) : (
                                    <div className="avatar-placeholder">
                                        {(creatorInfo?.username || 'U')[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="creator-info">
                                {creatorInfo ? (
                                    <a 
                                        href={`/profile/${creatorInfo.id}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="creator-link"
                                    >
                                        {creatorInfo.username}
                                    </a>
                                ) : (
                                    <span className="creator-name">Неизвестный создатель</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 🆕 Администраторы турнира */}
                    {adminsList.length > 0 && (
                        <div className="meta-item admins-meta">
                            <strong>👑 Администраторы ({adminsList.length}):</strong>
                            <div className="admins-list">
                                {adminsList.slice(0, 3).map((admin, index) => (
                                    <div key={admin.id || index} className="admin-item">
                                        <div className="admin-avatar">
                                            {admin.avatar_url ? (
                                                <img 
                                                    src={ensureHttps(admin.avatar_url)} 
                                                    alt={admin.username}
                                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                                />
                                            ) : (
                                                <div className="avatar-placeholder admin-placeholder">
                                                    {(admin.username || 'A')[0].toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="admin-info">
                                            <a 
                                                href={`/profile/${admin.user_id || admin.id}`}
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="admin-link"
                                                title={`Администратор с ${formatDate(admin.assigned_at)}`}
                                            >
                                                {admin.username}
                                            </a>
                                        </div>
                                    </div>
                                ))}
                                {adminsList.length > 3 && (
                                    <div className="more-admins">
                                        +{adminsList.length - 3} еще
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Блок описания */}
            <div className="description-block">
                <div className="block-header">
                    <h3>📝 Описание турнира</h3>
                    {isAdminOrCreator && !isEditingDescription && (
                        <div className="edit-controls">
                            <button 
                                className="edit-btn"
                                onClick={() => setIsEditingDescription(true)}
                                disabled={isLoading}
                            >
                                ✏️ Редактировать
                            </button>
                        </div>
                    )}
                    {isEditingDescription && (
                        <div className="edit-actions">
                            <button 
                                className="save-btn"
                                onClick={handleSaveDescription}
                                disabled={isLoading}
                            >
                                💾 Сохранить
                            </button>
                            <button 
                                className="cancel-btn"
                                onClick={handleCancelDescription}
                                disabled={isLoading}
                            >
                                ❌ Отмена
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="tournament-description-content">
                    {isEditingDescription ? (
                        <textarea
                            className="description-editor"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Введите описание турнира..."
                            disabled={isLoading}
                        />
                    ) : (
                        <>
                            {description ? (
                                <div className="tournament-description">
                                    {description.split('\n').map((line, index) => (
                                        <p key={index}>{line}</p>
                                    ))}
                                </div>
                            ) : (
                                <div className="no-description">
                                    {isAdminOrCreator ? (
                                        <p>Описание турнира не добавлено. Нажмите "Редактировать" для добавления.</p>
                                    ) : (
                                        <p>Описание турнира не предоставлено.</p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Блок регламента */}
            <div className="rules-block">
                <div className="block-header">
                    <h3>📋 Регламент турнира</h3>
                    {isAdminOrCreator && !isEditingRegulations && (
                        <div className="edit-controls">
                            <button 
                                className="edit-btn"
                                onClick={() => setIsEditingRegulations(true)}
                                disabled={isLoading}
                            >
                                ✏️ Редактировать
                            </button>
                        </div>
                    )}
                    {isEditingRegulations && (
                        <div className="edit-actions">
                            <button 
                                className="save-btn"
                                onClick={handleSaveRegulations}
                                disabled={isLoading}
                            >
                                💾 Сохранить
                            </button>
                            <button 
                                className="cancel-btn"
                                onClick={handleCancelRegulations}
                                disabled={isLoading}
                            >
                                ❌ Отмена
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="tournament-rules-content">
                    {isEditingRegulations ? (
                        <textarea
                            className="rules-editor"
                            value={regulations}
                            onChange={(e) => setRegulations(e.target.value)}
                            placeholder="Введите регламент турнира..."
                            disabled={isLoading}
                        />
                    ) : (
                        <>
                            {regulations ? (
                                <div className="rules-text">
                                    {regulations.split('\n').map((line, index) => (
                                        <div key={index} className="rule-item">{line}</div>
                                    ))}
                                </div>
                            ) : (
                                <div className="default-rules">
                                    {isAdminOrCreator ? (
                                        <div 
                                            className="no-rules-admin"
                                            onClick={() => setIsEditingRegulations(true)}
                                        >
                                            <p>Регламент турнира не добавлен. Нажмите здесь для добавления.</p>
                                        </div>
                                    ) : (
                                        <div className="rule-section">
                                            <h4>🎯 Общие правила</h4>
                                            <ul>
                                                <li>Соблюдение правил Fair Play</li>
                                                <li>Запрет на использование читов и эксплойтов</li>
                                                <li>Уважительное отношение к соперникам</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Участники турнира - скрываем для микс-турниров с сформированными командами */}
            {!(tournament?.format === 'mix' && tournament?.teams && tournament?.teams.length > 0) && (
                <div className="participants-section">
                    <h3>👥 Участники турнира</h3>
                    <div className="participants-list">
                        {tournament?.participants?.map(participant => (
                            <div 
                                key={participant.id} 
                                className="participant-item"
                                onClick={() => handleParticipantClick(participant)}
                            >
                                <img 
                                    src={ensureHttps(participant.avatar_url) || '/default-avatar.png'} 
                                    alt={participant.username || participant.name || 'Участник'}
                                    className="participant-avatar"
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                                <span className="participant-name">
                                    {participant.username || participant.name || 'Участник'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {showActions && selectedParticipant && (
                        <div className="participant-actions-modal" onClick={() => setShowActions(false)}>
                            <div className="actions-content" onClick={(e) => e.stopPropagation()}>
                                <h4>Действия с участником</h4>
                                <button 
                                    className="action-button profile-button"
                                    onClick={handleOpenProfile}
                                >
                                    👤 Открыть профиль
                                </button>
                                {isAdminOrCreator && (
                                    <button 
                                        className="action-button remove-button"
                                        onClick={() => {
                                            // TODO: Добавить функцию удаления участника
                                            console.log('Удаление участника:', selectedParticipant);
                                            setShowActions(false);
                                        }}
                                    >
                                        🗑️ Удалить из турнира
                                    </button>
                                )}
                                <button 
                                    className="action-button cancel-button"
                                    onClick={() => setShowActions(false)}
                                >
                                    ❌ Отмена
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TournamentInfoSection; 