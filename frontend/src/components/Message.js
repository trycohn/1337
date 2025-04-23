import React, { useState, useRef, useEffect } from 'react';
import './Message.css';
import { formatDate } from '../utils/dateHelpers';

function Message({ message, isOwn, onDeleteMessage }) {
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const contextMenuRef = useRef(null);
    
    // Состояние для обработки действия по уведомлению
    const [actionLoading, setActionLoading] = useState(false);
    const [responded, setResponded] = useState(false);
    
    // Выбор класса для сообщения в зависимости от отправителя
    const messageClass = () => {
        let baseClass = isOwn ? 'message own' : 'message';
        if (message.message_type === 'image') {
            baseClass += ' image-message';
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
        if (!message.content_meta?.notification_id || !message.content_meta?.type) return;
        
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const notifId = message.content_meta.notification_id;
            const notifType = message.content_meta.type;
            
            let endpoint = '';
            let data = {};
            
            // Определяем эндпоинт и данные в зависимости от типа уведомления
            if (notifType === 'friend_request') {
                // Получаем список входящих заявок в друзья для определения requestId
                const friendsResponse = await fetch('/api/friends/requests/incoming', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const friendRequests = await friendsResponse.json();
                
                // Ищем соответствующую заявку
                const friendRequest = friendRequests.find(req => 
                    req.user?.id === message.content_meta.requester_id
                );
                
                if (!friendRequest) {
                    throw new Error('Заявка в друзья не найдена');
                }
                
                endpoint = `/api/friends/${actionType === 'accept' ? 'accept' : 'reject'}`;
                data = { requestId: friendRequest.id };
            } 
            else if (notifType === 'admin_request') {
                // Для запроса на администрирование
                const tournamentId = message.content_meta.tournament_id;
                endpoint = `/api/tournaments/${tournamentId}/respond-admin-request`;
                data = { 
                    requesterId: message.content_meta.requester_id,
                    action: actionType
                };
            }
            else if (notifType === 'tournament_invite') {
                // Для приглашения в турнир
                const invitationId = message.content_meta.invitation_id;
                endpoint = `/api/tournaments/${invitationId}/handle-invitation`;
                data = { action: actionType, invitation_id: invitationId };
            }
            
            if (endpoint) {
                await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                
                // Помечаем уведомление как прочитанное
                await fetch(`/api/notifications/mark-read?notificationId=${notifId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                setResponded(true);
            }
        } catch (err) {
            console.error('Ошибка при ответе на уведомление:', err);
        } finally {
            setActionLoading(false);
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
                const canRespond = notifId && ['friend_request','admin_request','tournament_invite'].includes(notifType);
                return (
                    <div className="message-announcement">
                        <div className="announcement-icon">📣</div>
                        <div className="announcement-text">{message.content}</div>
                        {canRespond && !responded && (
                            <div className="announcement-actions">
                                <button 
                                    className="action-accept" 
                                    disabled={actionLoading} 
                                    onClick={() => handleNotificationAction('accept')}
                                    title="Принять"
                                >
                                    ✓
                                </button>
                                <button 
                                    className="action-reject" 
                                    disabled={actionLoading} 
                                    onClick={() => handleNotificationAction('reject')}
                                    title="Отклонить"
                                >
                                    ✗
                                </button>
                            </div>
                        )}
                        {responded && (
                            <div className="announcement-response">
                                Вы уже ответили на это уведомление
                            </div>
                        )}
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
        <div className={`message-container ${isOwn ? 'own-container' : ''}`}>
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
            <div className="message-meta">
                <span className="message-time">{formatDate(message.created_at)}</span>
                {renderMessageStatus()}
            </div>
        </div>
    );
}

export default Message; 