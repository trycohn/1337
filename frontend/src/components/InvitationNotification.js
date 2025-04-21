import React from 'react';
import { Link } from 'react-router-dom';
import './InvitationNotification.css';

function InvitationNotification({ notification, onAccept, onReject }) {
    const handleAccept = () => {
        onAccept(notification.invitation_id);
    };

    const handleReject = () => {
        onReject(notification.invitation_id);
    };

    return (
        <div className="invitation-notification">
            <div className="invitation-message">
                {notification.message}
            </div>
            <div className="invitation-actions">
                <Link to={`/tournaments/${notification.tournament_id}`}>
                    <button className="view-tournament-btn">Посмотреть турнир</button>
                </Link>
                <button className="accept-btn" onClick={handleAccept}>Принять</button>
                <button className="reject-btn" onClick={handleReject}>Отклонить</button>
            </div>
        </div>
    );
}

export default InvitationNotification; 