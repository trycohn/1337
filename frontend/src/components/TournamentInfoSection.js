import React, { useState, useEffect } from 'react';
import './TournamentInfoSection.css';
import { ensureHttps } from '../utils/userHelpers';
import ParticipationConfirmModal from './tournament/modals/ParticipationConfirmModal';
import TeamSelectionModal from './modals/TeamSelectionModal';

const TournamentInfoSection = ({ 
    tournament, 
    user, 
    isCreator, 
    isAdminOrCreator,
    onParticipationUpdate, // Колбэк для обновления данных турнира
    userTeams = [] // Команды пользователя
}) => {
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingRegulations, setIsEditingRegulations] = useState(false);
    const [description, setDescription] = useState(tournament?.description || '');
    const [regulations, setRegulations] = useState(tournament?.regulations || '');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [showActions, setShowActions] = useState(false);
    
    // 🆕 Состояния для управления отображением регламента
    const [showRegulationsTooltip, setShowRegulationsTooltip] = useState(false);

    // 🆕 Состояния для участия в турнире
    const [showParticipationConfirm, setShowParticipationConfirm] = useState(false);
    const [showTeamSelection, setShowTeamSelection] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [participationLoading, setParticipationLoading] = useState(false);

    // Обновляем значения при изменении турнира
    useEffect(() => {
        setDescription(tournament?.description || '');
        setRegulations(tournament?.regulations || '');
    }, [tournament]);

    // 🆕 Проверка, является ли пользователь участником
    const isUserParticipant = () => {
        if (!user || !tournament?.participants) return false;
        return tournament.participants.some(participant => 
            participant.user_id === user.id || participant.id === user.id
        );
    };

    // 🆕 Проверка возможности участия
    const canParticipate = () => {
        if (!user) return false;
        if (!tournament) return false;
        if (tournament.status !== 'active') return false;
        if (isUserParticipant()) return false;
        
        // Проверка лимита участников
        if (tournament.max_participants && tournament.participants?.length >= tournament.max_participants) {
            return false;
        }
        
        return true;
    };

    // 🆕 Получение команд пользователя для конкретной игры
    const getEligibleTeams = () => {
        if (!userTeams || !tournament?.game) return [];
        
        return userTeams.filter(team => {
            // Проверяем, что команда подходит по дисциплине
            return team.game === tournament.game || team.game === null; // null означает универсальную команду
        });
    };

    // 🆕 Обработчик нажатия на кнопку участия
    const handleParticipateClick = () => {
        if (!canParticipate()) return;

        const participantType = tournament.participant_type;

        if (participantType === 'team') {
            const eligibleTeams = getEligibleTeams();
            
            if (eligibleTeams.length === 0) {
                // Нет подходящих команд - предлагаем создать временную
                setShowTeamSelection(true);
            } else {
                // Есть команды - показываем выбор
                setShowTeamSelection(true);
            }
        } else {
            // Solo или Mix - сразу показываем подтверждение
            setShowParticipationConfirm(true);
        }
    };

    // 🆕 Подтверждение участия для Solo/Mix турниров
    const handleConfirmParticipation = async () => {
        setParticipationLoading(true);
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/tournaments/${tournament.id}/participate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    participant_type: tournament.participant_type
                })
            });

            const data = await response.json();

            if (response.ok) {
                setShowParticipationConfirm(false);
                if (onParticipationUpdate) {
                    onParticipationUpdate();
                }
                console.log('✅ Успешное участие в турнире');
            } else {
                throw new Error(data.message || 'Ошибка при участии в турнире');
            }
        } catch (error) {
            console.error('❌ Ошибка участия в турнире:', error);
            alert(`Ошибка: ${error.message}`);
        } finally {
            setParticipationLoading(false);
        }
    };

    // 🆕 Обработчик выбора команды для участия
    const handleTeamSelected = async (team) => {
        setSelectedTeam(team);
        setShowTeamSelection(false);
        setShowParticipationConfirm(true);
    };

    // 🆕 Подтверждение участия с командой
    const handleConfirmTeamParticipation = async () => {
        if (!selectedTeam) return;

        setParticipationLoading(true);
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/tournaments/${tournament.id}/participate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    participant_type: 'team',
                    team_id: selectedTeam.id,
                    team_data: selectedTeam
                })
            });

            const data = await response.json();

            if (response.ok) {
                setShowParticipationConfirm(false);
                setSelectedTeam(null);
                if (onParticipationUpdate) {
                    onParticipationUpdate();
                }
                console.log('✅ Успешное участие команды в турнире');
            } else {
                throw new Error(data.message || 'Ошибка при участии команды в турнире');
            }
        } catch (error) {
            console.error('❌ Ошибка участия команды в турнире:', error);
            alert(`Ошибка: ${error.message}`);
        } finally {
            setParticipationLoading(false);
        }
    };

    // 🆕 Закрытие модальных окон
    const handleCloseModals = () => {
        setShowParticipationConfirm(false);
        setShowTeamSelection(false);
        setSelectedTeam(null);
    };

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
    
    // 🆕 Функция для обрезки текста до указанного количества символов
    const truncateText = (text, maxLength = 400) => {
        if (!text || text.length <= maxLength) return text;
        
        // Находим последний пробел до максимальной длины
        const truncated = text.substring(0, maxLength);
        const lastSpaceIndex = truncated.lastIndexOf(' ');
        
        // Если нашли пробел, обрезаем до него, иначе просто по максимальной длине
        return lastSpaceIndex > 0 ? 
            truncated.substring(0, lastSpaceIndex) + '...' : 
            truncated + '...';
    };

    // 🆕 Функция для открытия полного регламента в новой вкладке
    const openFullRegulations = () => {
        if (!regulations) return;
        
        // Создаем HTML для полного регламента
        const fullRegulationsHTML = `
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Регламент турнира - ${tournament?.name || 'Турнир'}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        line-height: 1.6;
                        background-color: #f5f5f5;
                        color: #333;
                    }
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 30px;
                        border-radius: 10px;
                        margin-bottom: 30px;
                        text-align: center;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                    }
                    .header p {
                        margin: 10px 0 0 0;
                        opacity: 0.9;
                    }
                    .content {
                        background: white;
                        padding: 30px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .regulation-text {
                        white-space: pre-wrap;
                        font-size: 16px;
                        line-height: 1.8;
                    }
                    @media print {
                        body { background-color: white; }
                        .header { background: #667eea; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Регламент турнира</h1>
                    <p>${tournament?.name || 'Турнир'}</p>
                </div>
                <div class="content">
                    <div class="regulation-text">${regulations.replace(/\n/g, '<br>')}</div>
                </div>
            </body>
            </html>
        `;
        
        // Открываем новое окно с полным регламентом
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write(fullRegulationsHTML);
            newWindow.document.close();
        }
    };

    // 🆕 Проверка, нужно ли сокращать регламент
    const shouldTruncateRegulations = (text) => {
        return text && text.length > 400;
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

                {/* 🆕 Кнопка участия в турнире */}
                {canParticipate() && (
                    <div className="meta-row">
                        <div className="meta-item participation-section">
                            <strong>🎯 Участие в турнире:</strong>
                            <div className="participation-controls">
                                <button 
                                    className="participate-btn"
                                    onClick={handleParticipateClick}
                                    disabled={participationLoading}
                                >
                                    {participationLoading ? (
                                        <>
                                            <span className="loading-spinner"></span>
                                            Участвую...
                                        </>
                                    ) : (
                                        <>
                                            🚀 Участвовать в турнире
                                        </>
                                    )}
                                </button>
                                
                                {tournament.participant_type === 'team' && (
                                    <div className="participation-hint">
                                        <span className="hint-icon">💡</span>
                                        <span>Для участия потребуется выбрать команду</span>
                                    </div>
                                )}
                                
                                {tournament.participant_type === 'mix' && (
                                    <div className="participation-hint">
                                        <span className="hint-icon">🎲</span>
                                        <span>Команды будут сформированы автоматически</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Отображение статуса участия для уже участвующих */}
                {isUserParticipant() && (
                    <div className="meta-row">
                        <div className="meta-item participation-status">
                            <strong>✅ Ваш статус:</strong>
                            <span className="participant-status-badge">
                                🎯 Вы участвуете в турнире
                            </span>
                        </div>
                    </div>
                )}

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
                                    {/* 🆕 Сокращенное отображение регламента с тултипом */}
                                    {shouldTruncateRegulations(regulations) ? (
                                        <div className="rules-container">
                                            {/* Сокращенный текст */}
                                            <div 
                                                className="rules-truncated"
                                                onMouseEnter={() => setShowRegulationsTooltip(true)}
                                                onMouseLeave={() => setShowRegulationsTooltip(false)}
                                                style={{ position: 'relative' }}
                                            >
                                                {truncateText(regulations).split('\n').map((line, index) => (
                                                    <div key={index} className="rule-item">{line}</div>
                                                ))}
                                                
                                                {/* Тултип для показа полного регламента */}
                                                {showRegulationsTooltip && (
                                                    <div className="regulations-tooltip">
                                                        <div className="tooltip-content">
                                                            <p>📋 Показать полный регламент</p>
                                                            <button 
                                                                className="tooltip-link"
                                                                onClick={openFullRegulations}
                                                                title="Открыть полный регламент в новой вкладке"
                                                            >
                                                                🔗 Открыть в новой вкладке
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Индикатор сокращения */}
                                            <div className="truncation-indicator">
                                                <span>📄 Показаны первые 400 символов</span>
                                                <button 
                                                    className="view-full-btn"
                                                    onClick={openFullRegulations}
                                                    title="Открыть полный регламент в новой вкладке"
                                                >
                                                    👁️ Показать полный регламент
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Полный текст, если он короткий
                                        <div>
                                            {regulations.split('\n').map((line, index) => (
                                                <div key={index} className="rule-item">{line}</div>
                                            ))}
                                        </div>
                                    )}
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

            {/* 🆕 Модальные окна */}
            {/* Модальное окно подтверждения участия */}
            <ParticipationConfirmModal
                isOpen={showParticipationConfirm}
                onClose={handleCloseModals}
                onConfirm={selectedTeam ? handleConfirmTeamParticipation : handleConfirmParticipation}
                tournament={tournament}
                isLoading={participationLoading}
                participationType={tournament?.participant_type}
            />

            {/* Модальное окно выбора команды */}
            {showTeamSelection && (
                <TeamSelectionModal
                    onClose={handleCloseModals}
                    onTeamSelected={handleTeamSelected}
                    tournamentId={tournament?.id}
                    user={user}
                />
            )}
        </div>
    );
};

export default TournamentInfoSection; 