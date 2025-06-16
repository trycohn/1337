import React from 'react';
import { ensureHttps } from '../utils/userHelpers';

function ParticipantsModal({ 
    show, 
    onClose, 
    participants, 
    chatInfo 
}) {
    if (!show) return null;

    return (
        <div className="participants-modal-overlay" onClick={onClose}>
            <div className="participants-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Участники: {chatInfo?.name}</h3>
                    <button className="close-button" onClick={onClose}>×</button>
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
    );
}

export default ParticipantsModal; 