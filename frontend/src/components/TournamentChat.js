import React from 'react';
import './TournamentChat.css';
import { ensureHttps } from '../utils/userHelpers';

function TournamentChat({ messages, newMessage, onInputChange, onSubmit, onKeyPress, chatEndRef, user }) {
    return (
        <div className="tournament-chat-panel">
            <div className="chat-header">
                <h3>Чат турнира</h3>
            </div>
            <div className="chat-messages">
                {messages.map((message, index) => (
                    <div key={index} className={`chat-message ${message.sender_id === user?.id ? 'own-message' : ''}`}>
                        <div className="message-avatar">
                            <img 
                                src={ensureHttps(message.avatar_url) || '/default-avatar.png'} 
                                alt={message.username} 
                                onError={(e) => {e.target.src = '/default-avatar.png'}}
                            />
                        </div>
                        <div className="message-content">
                            <div className="message-header">
                                <span className="message-username">{message.username}</span>
                                <span className="message-time">
                                    {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                            <div className="message-text">{message.content}</div>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            {user && (
                <div className="chat-input">
                    <form onSubmit={onSubmit}>
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={onInputChange}
                            onKeyPress={onKeyPress}
                            placeholder="Введите сообщение..."
                        />
                        <button type="submit">Отправить</button>
                    </form>
                </div>
            )}
        </div>
    );
}

export default TournamentChat; 