import React, { useState, useRef } from 'react';
import './ChatWindow.css';
import Message from './Message';
import { decodeTokenPayload } from '../utils/userHelpers';

function ChatWindow({ 
    activeChat, 
    messages, 
    newMessage, 
    onInputChange, 
    onSubmit, 
    onKeyPress,
    onSendAttachment,
    messagesEndRef 
}) {
    const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
    const fileInputRef = useRef(null);
    
    // Если нет активного чата, показываем заглушку
    if (!activeChat) {
        return (
            <div className="chat-window empty-chat">
                <div className="select-chat-message">
                    Выберите чат или начните новую беседу
                </div>
            </div>
        );
    }
    
    // Получаем класс статуса онлайн
    const getOnlineStatusClass = () => {
        if (!activeChat.online_status) return '';
        
        if (activeChat.online_status === 'online') {
            return 'status-online';
        } else {
            return 'status-offline';
        }
    };
    
    // Обработчик клика по кнопке прикрепления файла
    const handleAttachmentClick = () => {
        setShowAttachmentOptions(!showAttachmentOptions);
    };
    
    // Обработчик выбора типа вложения
    const handleAttachmentTypeSelect = (type) => {
        fileInputRef.current.setAttribute('data-type', type);
        fileInputRef.current.click();
        setShowAttachmentOptions(false);
    };
    
    // Обработчик выбора файла
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const type = fileInputRef.current.getAttribute('data-type');
        onSendAttachment(file, type);
        
        // Сбрасываем значение input, чтобы можно было выбрать тот же файл снова
        e.target.value = '';
    };
    
    // Группируем сообщения по дате
    const groupMessagesByDate = () => {
        if (!messages.length) return [];
        
        const groups = [];
        let currentGroup = {
            date: new Date(messages[0].created_at).toDateString(),
            messages: [messages[0]]
        };
        
        for (let i = 1; i < messages.length; i++) {
            const messageDate = new Date(messages[i].created_at).toDateString();
            
            if (messageDate === currentGroup.date) {
                currentGroup.messages.push(messages[i]);
            } else {
                groups.push(currentGroup);
                currentGroup = {
                    date: messageDate,
                    messages: [messages[i]]
                };
            }
        }
        
        groups.push(currentGroup);
        return groups;
    };
    
    // Форматирование даты группы сообщений
    const formatGroupDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Сегодня';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Вчера';
        } else {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        }
    };
    
    const messageGroups = groupMessagesByDate();

    return (
        <div className="chat-window">
            <div className="chat-header">
                <div className="chat-header-avatar">
                    <img 
                        src={activeChat.avatar_url || '/default-avatar.png'} 
                        alt={activeChat.name} 
                    />
                </div>
                <div className="chat-header-info">
                    <h2>{activeChat.name}</h2>
                    {activeChat.online_status && (
                        <div className={`online-status ${getOnlineStatusClass()}`}>
                            {activeChat.online_status}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="chat-messages">
                {messageGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="message-group">
                        <div className="message-date-separator">
                            <span>{formatGroupDate(group.date)}</span>
                        </div>
                        
                        {group.messages.map((message, messageIndex) => (
                            <Message 
                                key={message.id || messageIndex} 
                                message={message} 
                                isOwn={(() => {
                                    const payload = decodeTokenPayload(localStorage.getItem('token'));
                                    return payload ? message.sender_id === payload.id : false;
                                })()}
                            />
                        ))}
                    </div>
                ))}
                
                {/* Элемент для прокрутки к последнему сообщению */}
                <div ref={messagesEndRef} />
            </div>
            
            <div className="chat-input-area">
                <form onSubmit={onSubmit}>
                    <div className="attachment-button" onClick={handleAttachmentClick}>
                        <i className="attachment-icon">📎</i>
                        
                        {showAttachmentOptions && (
                            <div className="attachment-options">
                                <div className="attachment-option" onClick={() => handleAttachmentTypeSelect('image')}>
                                    <i>📷</i> Фото
                                </div>
                                <div className="attachment-option" onClick={() => handleAttachmentTypeSelect('document')}>
                                    <i>📄</i> Документ
                                </div>
                                <div className="attachment-option" onClick={() => handleAttachmentTypeSelect('file')}>
                                    <i>📁</i> Файл
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileSelect}
                    />
                    
                    <input 
                        type="text" 
                        placeholder="Введите сообщение..." 
                        value={newMessage}
                        onChange={onInputChange}
                        onKeyPress={onKeyPress}
                    />
                    
                    <button type="submit">
                        <span>➤</span>
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ChatWindow; 