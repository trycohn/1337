import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './InvitationNotification.css';

function InvitationNotification({ notification, onAccept, onReject }) {
    const navigate = useNavigate();
    
    const handleAccept = async () => {
        await onAccept(notification.invitation_id);
        
        // После принятия приглашения в командный турнир перенаправляем на страницу с параметром invite=team
        if (notification.tournament_id) {
            // Проверяем, командный ли это турнир (если в сообщении есть слово "командный")
            const isTeamTournament = notification.message?.includes('командный');
            const url = isTeamTournament 
                ? `/tournaments/${notification.tournament_id}?invite=team`
                : `/tournaments/${notification.tournament_id}`;
            navigate(url);
        }
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