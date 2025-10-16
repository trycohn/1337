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

        // Слушаем приглашения в лобби (турнирные)
        const handleLobbyInvite = (data) => {
            console.log('📨 Получено приглашение в лобби:', data);
            const payload = { lobbyId: data?.lobbyId || data?.id, type: 'tournament' };
            setLobbyInvites(prev => [...prev, payload]);
            setShowNotification(true);
        };

        socket.on('match_lobby_invite', handleLobbyInvite);

        // Слушаем приглашения в админ-лобби
        const handleAdminLobbyInvite = (data) => {
            console.log('📨 Получено приглашение в админ-лобби:', data);
            const payload = { lobbyId: data?.lobbyId || data?.lobby_id || data?.id, type: 'admin' };
            setLobbyInvites(prev => [...prev, payload]);
            setShowNotification(true);
        };
        socket.on('admin_match_lobby_invite', handleAdminLobbyInvite);

        return () => {
            socket.off('match_lobby_invite', handleLobbyInvite);
            socket.off('admin_match_lobby_invite', handleAdminLobbyInvite);
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
                    const invites = res.data.lobbies.map(l => ({ lobbyId: l.id, type: 'tournament' }));
                    setLobbyInvites(invites);
                    setShowNotification(true);
                }
                // Также подхватим админ-приглашения
                const res2 = await axios.get('/api/admin/match-lobbies/my-invites', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!cancelled && res2?.data?.success && Array.isArray(res2.data.invites) && res2.data.invites.length > 0) {
                    const invites2 = res2.data.invites.map(l => ({ lobbyId: l.lobby_id, type: 'admin' }));
                    setLobbyInvites(prev => [...prev, ...invites2]);
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
            // Открываем в новом окне (админ/турнирное лобби)
            const targetUrl = latestInvite.type === 'admin'
                ? `/admin/match?lobby=${latestInvite.lobbyId}`
                : `/match-lobby/${latestInvite.lobbyId}`;
            window.open(targetUrl, '_blank');
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