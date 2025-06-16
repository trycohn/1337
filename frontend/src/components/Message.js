import React, { useState, useRef, useEffect } from 'react';
import './Message.css';
import { formatDate } from '../utils/dateHelpers';
import { ensureHttps } from '../utils/userHelpers';
import axios from 'axios';

function Message({ message, isOwn, onDeleteMessage, showUserInfo = false }) {
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const contextMenuRef = useRef(null);
    
    // Состояние для обработки действия по уведомлению
    const [actionLoading, setActionLoading] = useState(false);
    const [responded, setResponded] = useState(false);
    
    // Выбор класса для сообщения в зависимости от отправителя
    const messageClass = () => {
        let baseClass = isOwn ? 'message own' : 'message';
        
        // Для уведомлений (announcement) используем специальный класс без стандартного фона
        if (message.message_type === 'announcement') {
            baseClass = 'message announcement-wrapper';
        } else if (message.message_type === 'image') {
            baseClass += ' image-message';
        }
        
        // Для турнирных чатов добавляем специальный класс
        if (showUserInfo) {
            baseClass += ' tournament-message';
        }
        
        return baseClass;
    };
    
    // Обработчик правого клика на сообщении
    const handleContextMenu = (e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        setShowContextMenu(true);
    };
    
    // Скрыть контекстное меню при клике в любом месте
    const handleClickOutside = (e) => {
        if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
            setShowContextMenu(false);
        }
    };
    
    // Функция для удаления сообщения
    const handleDeleteMessage = () => {
        if (onDeleteMessage) {
            onDeleteMessage(message.id);
        }
        setShowContextMenu(false);
    };
    
    // Добавляем и удаляем обработчики событий
    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    // Обработчик действия по уведомлению (accept/reject)
    const handleNotificationAction = async (actionType) => {
        if (!message.content_meta?.notification_id) return;
        
        // Сначала проверим, не был ли этот запрос уже обработан
        if (isNotificationProcessed()) {
            alert('Это уведомление уже было обработано.');
            return;
        }
        
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Необходимо авторизоваться');
                return;
            }

            const response = await axios.post(
                `/api/notifications/respond?notificationId=${message.content_meta.notification_id}`,
                { action: actionType },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            // Формируем конкретное сообщение в зависимости от типа уведомления и действия
            let successMessage = 'Уведомление обработано';
            const notifType = message.content_meta?.type;
            
            if (notifType === 'tournament_invite') {
                successMessage = actionType === 'accept' ? 'Приглашение принято. Вы успешно присоединились к турниру!' : 'Приглашение отклонено';
            } else if (notifType === 'friend_request') {
                successMessage = actionType === 'accept' ? 'Заявка в друзья принята' : 'Заявка в друзья отклонена';
            } else if (notifType === 'admin_request') {
                successMessage = actionType === 'accept' ? 'Запрос на администрирование принят' : 'Запрос на администрирование отклонен';
            }
            
            alert(successMessage);
            setResponded(true);
            
            // Обновляем метаданные сообщения для отображения статуса
            if (message.content_meta) {
                message.content_meta.action = actionType;
                message.content_meta.processed = true;
            }
            
            console.log('Уведомление успешно обработано:', response.data);
        } catch (err) {
            console.error('Ошибка при ответе на уведомление:', err);
            const errorMessage = err.response?.data?.error || err.message || 'Ошибка при обработке уведомления';
            alert(errorMessage);
        } finally {
            setActionLoading(false);
        }
    };
    
    // Преобразуем текст для кнопок в зависимости от типа уведомления
    const getActionButtonsText = () => {
        const type = message.content_meta?.type;
        if (!type) return { accept: 'Принять', reject: 'Отклонить' };
        
        switch (type) {
            case 'friend_request':
                return { accept: 'Принять заявку', reject: 'Отклонить' };
            case 'admin_request':
                return { accept: 'Назначить админом', reject: 'Отклонить' };
            case 'tournament_invite':
                return { accept: 'Присоединиться', reject: 'Отказаться' };
            default:
                return { accept: 'Принять', reject: 'Отклонить' };
        }
    };
    
    // Проверка, обработано ли уведомление
    const isNotificationProcessed = () => {
        return message.content_meta?.processed || message.content_meta?.action;
    };
    
    // Получение типа действия для уведомления
    const getActionType = () => {
        return message.content_meta?.action || 'unknown';
    };
    
    // Получение текста статуса для обработанного уведомления
    const getProcessedStatusText = () => {
        const action = getActionType();
        const type = message.content_meta?.type;
        
        if (!type) return action === 'accept' ? 'Принято' : 'Отклонено';
        
        switch (type) {
            case 'friend_request':
                return action === 'accept' ? 'Заявка в друзья принята' : 'Заявка в друзья отклонена';
            case 'admin_request':
                return action === 'accept' ? 'Запрос на администрирование принят' : 'Запрос на администрирование отклонен';
            case 'tournament_invite':
                return action === 'accept' ? 'Приглашение принято' : 'Приглашение отклонено';
            default:
                return action === 'accept' ? 'Принято' : 'Отклонено';
        }
    };
    
    // Рендер содержимого сообщения в зависимости от его типа
    const renderMessageContent = () => {
        switch (message.message_type) {
            case 'image':
                return (
                    <div className="message-image">
                        <img 
                            src={message.content} 
                            alt="Изображение" 
                            onClick={() => window.open(message.content, '_blank')}
                        />
                    </div>
                );
                
            case 'document':
                return (
                    <div className="message-document">
                        <div className="document-icon">📄</div>
                        <div className="document-info">
                            <div className="document-name">{message.content_meta?.filename || 'Документ'}</div>
                            <a 
                                href={message.content} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="document-download"
                            >
                                Скачать
                            </a>
                        </div>
                    </div>
                );
                
            case 'file':
                return (
                    <div className="message-file">
                        <div className="file-icon">📎</div>
                        <div className="file-info">
                            <div className="file-name">{message.content_meta?.filename || 'Файл'}</div>
                            <a 
                                href={message.content} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="file-download"
                            >
                                Скачать
                            </a>
                        </div>
                    </div>
                );
                
            case 'announcement':
                // Кнопки для уведомлений с возможностью ответа
                const notifId = message.content_meta?.notification_id;
                const notifType = message.content_meta?.type;
                const canRespond = notifId && ['friend_request', 'admin_request', 'tournament_invite'].includes(notifType);
                const buttonTexts = getActionButtonsText();
                const isProcessed = isNotificationProcessed();
                
                return (
                    <div className="message-announcement">
                        <div className="announcement-icon">📣</div>
                        <div className="announcement-content">
                            <div className="announcement-text">{message.content}</div>
                            
                            {canRespond && !responded && !isProcessed && (
                                <div className="announcement-actions">
                                    <button 
                                        className="action-button accept" 
                                        disabled={actionLoading} 
                                        onClick={() => handleNotificationAction('accept')}
                                    >
                                        {actionLoading ? 'Обработка...' : buttonTexts.accept}
                                    </button>
                                    <button 
                                        className="action-button reject" 
                                        disabled={actionLoading} 
                                        onClick={() => handleNotificationAction('reject')}
                                    >
                                        {actionLoading ? 'Обработка...' : buttonTexts.reject}
                                    </button>
                                </div>
                            )}
                            
                            {(responded || isProcessed) && (
                                <div className="announcement-response">
                                    <span className={`response-status ${getActionType() === 'accept' ? 'accepted' : 'rejected'}`}>
                                        {isProcessed ? getProcessedStatusText() : 'Уведомление обработано'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
                
            default:
                // Обычное текстовое сообщение
                return <div className="message-text">{message.content}</div>;
        }
    };
    
    // Индикатор статуса сообщения (прочитано/отправлено/доставлено)
    const renderMessageStatus = () => {
        if (isOwn) {
            if (message.is_read) {
                return <span className="message-status read">✅</span>;
            } else {
                return <span className="message-status sent">✓</span>;
            }
        }
        return null;
    };

    return (
        <div className={`message-container ${isOwn ? 'own-container' : ''} ${showUserInfo ? 'tournament-container' : ''}`}>
            {showUserInfo && (
                <div className="message-user-info">
                    <div className="message-user-avatar">
                        <img 
                            src={ensureHttps(message.sender_avatar || message.avatar_url) || '/default-avatar.png'} 
                            alt={message.sender_username || message.username} 
                            onError={(e) => {e.target.src = '/default-avatar.png'}}
                        />
                    </div>
                    <div className="message-user-details">
                        <span className="message-username">{message.sender_username || message.username || 'Система'}</span>
                        <span className="message-time-header">
                            {formatDate(message.created_at)}
                        </span>
                    </div>
                </div>
            )}
            
            <div className={messageClass()} onContextMenu={handleContextMenu}>
                {renderMessageContent()}
                
                {showContextMenu && (
                    <div 
                        className="message-context-menu" 
                        ref={contextMenuRef}
                        style={{
                            top: `${menuPosition.y}px`,
                            right: isOwn ? `${menuPosition.x}px` : 'auto',
                            left: !isOwn ? `${menuPosition.x}px` : 'auto'
                        }}
                    >
                        <ul>
                            <li onClick={handleDeleteMessage}>Удалить</li>
                        </ul>
                    </div>
                )}
            </div>
            
            {!showUserInfo && (
                <div className="message-meta">
                    <span className="message-time">{formatDate(message.created_at)}</span>
                    {renderMessageStatus()}
                </div>
            )}
        </div>
    );
}

export default Message; 