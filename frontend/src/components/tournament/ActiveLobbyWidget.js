// 🎮 ActiveLobbyWidget - Виджет активного лобби в турнире
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../axios';
import './ActiveLobbyWidget.css';

function ActiveLobbyWidget({ tournamentId, user }) {
    const navigate = useNavigate();
    const [activeLobby, setActiveLobby] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !tournamentId) {
            setLoading(false);
            return;
        }

        checkActiveLobby();
    }, [tournamentId, user]);

    const checkActiveLobby = async () => {
        try {
            const token = localStorage.getItem('token');
            const { data } = await api.get(
                `/api/tournaments/${tournamentId}/my-active-lobby`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (data.success && data.hasLobby) {
                setActiveLobby(data.lobby);
            }
        } catch (error) {
            console.error('Ошибка проверки активного лобби:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !activeLobby) {
        return null;
    }

    // Если лобби устарело
    if (activeLobby.expired) {
        return (
            <div className="active-lobby-widget expired">
                <div className="widget-icon">⏰</div>
                <div className="widget-content">
                    <h4>Лобби устарело</h4>
                    <p>Ваше лобби создано более 1 часа назад и больше недоступно</p>
                    <p className="widget-hint">Попросите администратора создать новое лобби</p>
                </div>
            </div>
        );
    }

    return (
        <div className="active-lobby-widget">
            <div className="widget-icon">🎮</div>
            <div className="widget-content">
                <h4>У вас есть активное лобби!</h4>
                <p>Вас ждут участники для начала матча</p>
                <button 
                    className="widget-join-btn"
                    onClick={() => navigate(`/match-lobby/${activeLobby.id}`)}
                >
                    Войти в лобби
                </button>
            </div>
            <button 
                className="widget-close"
                onClick={() => setActiveLobby(null)}
                title="Закрыть"
            >
                ✕
            </button>
        </div>
    );
}

export default ActiveLobbyWidget;

