// 🔔 MatchLobbyNotification - Компонент уведомления о приглашении в лобби
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MatchLobbyNotification.css';

function MatchLobbyNotification({ socket, user }) {
    const navigate = useNavigate();
    const [lobbyInvites, setLobbyInvites] = useState([]);
    const [showNotification, setShowNotification] = useState(false);

    useEffect(() => {
        if (!socket || !user) return;

        // Слушаем приглашения в лобби
        const handleLobbyInvite = (data) => {
            console.log('📨 Получено приглашение в лобби:', data);
            setLobbyInvites(prev => [...prev, data]);
            setShowNotification(true);
        };

        socket.on('match_lobby_invite', handleLobbyInvite);

        return () => {
            socket.off('match_lobby_invite', handleLobbyInvite);
        };
    }, [socket, user]);

    // Обработка клика по уведомлению
    const handleNotificationClick = () => {
        if (lobbyInvites.length > 0) {
            const latestInvite = lobbyInvites[lobbyInvites.length - 1];
            // Открываем в новом окне
            window.open(`/lobby/${latestInvite.lobbyId}`, '_blank');
            // Очищаем приглашения
            setLobbyInvites([]);
            setShowNotification(false);
        }
    };

    // Закрытие уведомления
    const handleClose = (e) => {
        e.stopPropagation();
        setShowNotification(false);
        setLobbyInvites([]);
    };

    if (!showNotification || lobbyInvites.length === 0) {
        return null;
    }

    return (
        <div 
            className="lobby-match-lobby-notification"
            onClick={handleNotificationClick}
        >
            <div className="lobby-notification-content">
                <div className="lobby-notification-icon">
                    🎮
                </div>
                <div className="lobby-notification-text">
                    ЛОББИ МАТЧА
                </div>
                <button 
                    className="lobby-notification-close"
                    onClick={handleClose}
                    aria-label="Закрыть"
                >
                    ✕
                </button>
            </div>
            {lobbyInvites.length > 1 && (
                <div className="lobby-notification-badge">
                    {lobbyInvites.length}
                </div>
            )}
        </div>
    );
}

export default MatchLobbyNotification; 