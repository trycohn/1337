import React from 'react';
import AttachmentMenu from './AttachmentMenu';

function ChatInput({ 
    activeChat, 
    newMessage, 
    onInputChange, 
    onSubmit, 
    onKeyPress, 
    onSendAttachment 
}) {
    // Проверяем, является ли чат только для чтения
    // Личные чаты с системным пользователем 1337community доступны для ответа
    const isReadOnly = activeChat.type === 'tournament' && activeChat.name === '1337community';

    if (isReadOnly) {
        return (
            <div className="chat-input-area read-only">
                <span>Чат только для уведомлений</span>
            </div>
        );
    }

    return (
        <div className="chat-input-area">
            <form onSubmit={onSubmit}>
                <AttachmentMenu onSendAttachment={onSendAttachment} />
                
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
    );
}

export default ChatInput; 