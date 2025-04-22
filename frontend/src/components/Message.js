import React from 'react';
import './Message.css';
import { formatDate } from '../utils/dateHelpers';

function Message({ message, isOwn }) {
    // Проверяем, если временное сообщение либо установлен флаг is_own
    const messageIsOwn = isOwn || message.is_own || false;
    
    // Выбор класса для сообщения в зависимости от отправителя
    const messageClass = messageIsOwn 
        ? `message own${message.is_temp ? ' message-temp' : ''}` 
        : 'message';
    
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
                return (
                    <div className="message-announcement">
                        <div className="announcement-icon">📣</div>
                        <div className="announcement-text">{message.content}</div>
                    </div>
                );
                
            default:
                // Обычное текстовое сообщение
                return <div className="message-text">{message.content}</div>;
        }
    };
    
    // Индикатор статуса сообщения (прочитано/отправлено/доставлено)
    const renderMessageStatus = () => {
        if (messageIsOwn) {
            if (message.is_temp) {
                return <span className="message-status sending">⏱</span>;
            }
            if (message.is_read) {
                return <span className="message-status read">✅</span>;
            } else {
                return <span className="message-status sent">✓</span>;
            }
        }
        return null;
    };

    return (
        <div className={messageClass}>
            {renderMessageContent()}
            <div className="message-meta">
                <span className="message-time">{formatDate(message.created_at)}</span>
                {renderMessageStatus()}
            </div>
        </div>
    );
}

export default Message; 