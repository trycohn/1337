import React from 'react';
import { ensureHttps } from '../utils/userHelpers';

function ParticipantsModal({ 
    show, 
    onClose, 
    participants, 
    chatInfo 
}) {
    if (!show) return null;

    // Функция для форматирования времени последней активности
    const formatLastSeen = (joinedAt) => {
        if (!joinedAt) return 'давно заходил(а)';
        
        const now = new Date();
        const joined = new Date(joinedAt);
        const diffInMinutes = Math.floor((now - joined) / 60000);
        
        if (diffInMinutes < 1) return 'только что';
        if (diffInMinutes < 60) return `${diffInMinutes} мин назад`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} ч назад`;
        return `${Math.floor(diffInMinutes / 1440)} дн назад`;
    };

    // Функция для определения онлайн статуса (пока временная логика)
    const isUserOnline = (joinedAt) => {
        if (!joinedAt) return false;
        const now = new Date();
        const joined = new Date(joinedAt);
        const diffInMinutes = Math.floor((now - joined) / 60000);
        // Считаем онлайн если заходил менее 5 минут назад
        return diffInMinutes < 5;
    };

    return (
        <div className="participants-modal-overlay" onClick={onClose}>
            <div className="participants-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Участники — {chatInfo?.name}</h3>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <div className="modal-content">
                    <div className="participants-count">
                        {chatInfo?.totalCount} участников
                    </div>
                    <div className="participants-list">
                        {participants.map((participant) => (
                            <div key={participant.user_id} className="participant-item">
                                <div className="participant-avatar">
                                    <img 
                                        src={ensureHttps(participant.avatar_url) || '/default-avatar.png'} 
                                        alt={participant.username}
                                        onError={(e) => {e.target.src = '/default-avatar.png'}}
                                    />
                                    <div className={`online-indicator ${isUserOnline(participant.joined_at) ? 'online' : 'offline'}`}></div>
                                </div>
                                <div className="participant-info">
                                    <div className="participant-name-line">
                                        <span className="participant-name">{participant.username}</span>
                                        <div className="participant-badges">
                                            {participant.is_creator && (
                                                <span className="badge creator-badge">🛡️</span>
                                            )}
                                            {participant.is_admin && !participant.is_creator && (
                                                <span className="badge admin-badge">⚙️</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="participant-status">
                                        {isUserOnline(participant.joined_at) ? 'В сети' : formatLastSeen(participant.joined_at)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ParticipantsModal; 