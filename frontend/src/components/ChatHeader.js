import React from 'react';
import { ensureHttps } from '../utils/userHelpers';

function ChatHeader({ 
    activeChat, 
    isMobile, 
    onBackToChats, 
    onHideChat, 
    onHeaderClick, 
    isTournamentChat, 
    loadingParticipants 
}) {
    const getOnlineStatusClass = () => {
        if (!activeChat.online_status) return '';
        
        if (activeChat.online_status === 'online') {
            return 'status-online';
        } else {
            return 'status-offline';
        }
    };

    return (
        <div className="chat-header">
            {isMobile && (
                <button className="back-to-chats" onClick={onBackToChats}>
                    Назад
                </button>
            )}
            <div className="chat-header-avatar">
                <img 
                    src={ensureHttps(activeChat.avatar_url) || '/default-avatar.png'} 
                    alt={activeChat.name} 
                    className="chat-avatar"
                />
            </div>
            <div 
                className="chat-header-info" 
                onClick={isTournamentChat ? onHeaderClick : undefined}
                style={{ cursor: isTournamentChat ? 'pointer' : 'default' }}
            >
                <h2>{activeChat.name}</h2>
                {loadingParticipants && <span className="loading-indicator">...</span>}
                {activeChat.online_status && !isTournamentChat && (
                    <div className={`online-status ${getOnlineStatusClass()}`}>
                        {activeChat.online_status}
                    </div>
                )}
                {isTournamentChat && (
                    <div className="tournament-chat-status">
                        Групповой чат турнира
                    </div>
                )}
            </div>
            
            {onHideChat && (
                <button className="hide-chat-btn" onClick={() => onHideChat(activeChat.id)} title="Скрыть чат">
                    ✕
                </button>
            )}
        </div>
    );
}

export default ChatHeader; 