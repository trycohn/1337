import React, { useState } from 'react';
import './ChatWindow.css';
import Message from './Message';
import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput';
import ParticipantsModal from './ParticipantsModal';
import { decodeTokenPayload } from '../utils/userHelpers';
import { groupMessagesByDate, formatGroupDate } from '../utils/messageGrouping';
import { useTournamentChat } from '../hooks/useTournamentChat';

function ChatWindow({ 
    activeChat, 
    messages, 
    newMessage, 
    onInputChange, 
    onSubmit, 
    onKeyPress,
    onSendAttachment,
    messagesEndRef,
    onDeleteMessage,
    onBackToChats,
    isMobile,
    onHideChat
}) {
    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    
    const {
        participants,
        chatInfo,
        loadingParticipants,
        isTournamentChat,
        loadTournamentParticipants
    } = useTournamentChat();

    // Обработчик клика на заголовок чата (для турнирных чатов)
    const handleHeaderClick = async () => {
        const isTournament = isTournamentChat(activeChat);
        if (!isTournament) return;
        
        if (showParticipantsModal) {
            setShowParticipantsModal(false);
            return;
        }

        await loadTournamentParticipants(activeChat);
        setShowParticipantsModal(true);
    };

    const closeParticipantsModal = () => {
        setShowParticipantsModal(false);
    };
    
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
    
    const messageGroups = groupMessagesByDate(messages);
    const isTournament = isTournamentChat(activeChat);

    return (
        <div className="chat-window">
            <ChatHeader 
                activeChat={activeChat}
                isMobile={isMobile}
                onBackToChats={onBackToChats}
                onHideChat={onHideChat}
                onHeaderClick={handleHeaderClick}
                isTournamentChat={isTournament}
                loadingParticipants={loadingParticipants}
            />
            
            <ParticipantsModal 
                show={showParticipantsModal && isTournament}
                onClose={closeParticipantsModal}
                participants={participants}
                chatInfo={chatInfo}
            />
            
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
                                onDeleteMessage={onDeleteMessage}
                                showUserInfo={isTournament} // Для турнирных чатов показываем аватарки и ники
                            />
                        ))}
                    </div>
                ))}
                
                {/* Элемент для прокрутки к последнему сообщению */}
                <div ref={messagesEndRef} />
            </div>
            
            <ChatInput 
                activeChat={activeChat}
                newMessage={newMessage}
                onInputChange={onInputChange}
                onSubmit={onSubmit}
                onKeyPress={onKeyPress}
                onSendAttachment={onSendAttachment}
            />
        </div>
    );
}

export default ChatWindow; 