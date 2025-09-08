import React, { useState } from 'react';
import './TournamentChat.css';
import { ensureHttps } from '../utils/userHelpers';
import { getAvatarCategoryClass } from '../utils/avatarCategory';
import api from '../utils/api';

function TournamentChat({ messages, newMessage, onInputChange, onSubmit, onKeyPress, chatEndRef, user, tournamentId }) {
    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    const [participants, setParticipants] = useState([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);
    const [chatInfo, setChatInfo] = useState(null);

    const handleHeaderClick = async () => {
        if (showParticipantsModal) {
            setShowParticipantsModal(false);
            return;
        }

        setLoadingParticipants(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/tournaments/${tournamentId}/chat/participants`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setParticipants(response.data.participants);
            setChatInfo({
                name: response.data.chat_name,
                creator: response.data.tournament_creator,
                totalCount: response.data.total_count
            });
            setShowParticipantsModal(true);
        } catch (error) {
            console.error('Ошибка загрузки участников чата:', error);
        } finally {
            setLoadingParticipants(false);
        }
    };

    const closeModal = () => {
        setShowParticipantsModal(false);
    };

    return (
        <div className="tournament-chat-panel">
            <div className="chat-header" onClick={handleHeaderClick} style={{ cursor: 'pointer' }}>
                <h3>Чат турнира</h3>
                {loadingParticipants && <span className="loading-indicator">...</span>}
            </div>
            
            {/* Модальное окно с участниками */}
            {showParticipantsModal && (
                <div className="participants-modal-overlay" onClick={closeModal}>
                    <div className="participants-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Чат: {chatInfo?.name}</h3>
                            <button className="close-button" onClick={closeModal}>×</button>
                        </div>
                        <div className="modal-content">
                            <div className="participants-count">
                                Участников: {chatInfo?.totalCount}
                            </div>
                            <div className="participants-list">
                                {participants.map((participant) => (
                                    <div key={participant.user_id} className="participant-item">
                                        <div className="participant-avatar">
                                            <img 
                                                className={getAvatarCategoryClass(participant.avatar_url)}
                                                src={ensureHttps(participant.avatar_url) || '/default-avatar.png'} 
                                                alt={participant.username}
                                                onError={(e) => {e.target.src = '/default-avatar.png'}}
                                            />
                                        </div>
                                        <div className="participant-info">
                                            <span className="participant-name">{participant.username}</span>
                                            <div className="participant-badges">
                                                {participant.is_creator && (
                                                    <span className="badge creator-badge">Создатель</span>
                                                )}
                                                {participant.is_admin && !participant.is_creator && (
                                                    <span className="badge admin-badge">Админ</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="chat-messages">
                {messages.map((message, index) => (
                    <div key={index} className={`chat-message ${message.sender_id === user?.id ? 'own-message' : ''}`}>
                        {message.sender_id !== user?.id && (
                            <div className="message-avatar">
                                <img 
                                    className={getAvatarCategoryClass(message.sender_avatar || message.avatar_url)}
                                    src={ensureHttps(message.sender_avatar || message.avatar_url) || '/default-avatar.png'} 
                                    alt={message.sender_username || message.username} 
                                    onError={(e) => {e.target.src = '/default-avatar.png'}}
                                />
                            </div>
                        )}
                        <div className="message-content">
                            {message.sender_id !== user?.id && (
                                <div className="message-header">
                                    <span className="message-username">{message.sender_username || message.username}</span>
                                    <span className="message-time">
                                        {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            )}
                            <div className="message-text">{message.content}</div>
                            {message.sender_id === user?.id && (
                                <div className="message-time-own">
                                    {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            )}
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