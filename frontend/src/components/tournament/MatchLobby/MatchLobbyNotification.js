// 🔔 MatchLobbyNotification - Компонент уведомления о приглашении в лобби
import React, { useState, useEffect } from 'react';
import axios from '../../../axios';
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

    // 🆕 Автопоказ панели при наличии активных лобби пользователя
    useEffect(() => {
        let cancelled = false;
        async function fetchActiveLobbies() {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('/api/tournaments/lobbies/active', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!cancelled && res?.data?.success && Array.isArray(res.data.lobbies) && res.data.lobbies.length > 0) {
                    const invites = res.data.lobbies.map(l => ({ lobbyId: l.id }));
                    setLobbyInvites(invites);
                    setShowNotification(true);
                }
            } catch (e) {
                // молча игнорируем
            }
        }
        fetchActiveLobbies();
        return () => { cancelled = true; };
    }, [user]);

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