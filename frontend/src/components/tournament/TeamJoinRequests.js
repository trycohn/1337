import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './TeamJoinRequests.css';

/**
 * Компонент для отображения и управления запросами на вступление в команду
 * Используется капитанами команд
 */
function TeamJoinRequests({ tournamentId, teamId, onRequestHandled }) {
    const { token } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null);

    useEffect(() => {
        loadRequests();
    }, [tournamentId, teamId]);

    const loadRequests = async () => {
        try {
            setLoading(true);
            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/join-requests`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRequests(response.data.requests || []);
        } catch (err) {
            console.error('Ошибка загрузки запросов:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (requestId) => {
        try {
            setProcessing(requestId);
            await axios.post(
                `${process.env.REACT_APP_API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/join-requests/${requestId}/accept`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Удаляем запрос из списка
            setRequests(prev => prev.filter(r => r.id !== requestId));
            
            if (onRequestHandled) {
                onRequestHandled();
            }

            alert('Игрок добавлен в команду!');
        } catch (err) {
            console.error('Ошибка принятия запроса:', err);
            alert(err.response?.data?.error || 'Не удалось принять запрос');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (requestId) => {
        if (!window.confirm('Вы уверены, что хотите отклонить этот запрос?')) {
            return;
        }

        try {
            setProcessing(requestId);
            await axios.post(
                `${process.env.REACT_APP_API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/join-requests/${requestId}/reject`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Удаляем запрос из списка
            setRequests(prev => prev.filter(r => r.id !== requestId));
            
            if (onRequestHandled) {
                onRequestHandled();
            }

            alert('Запрос отклонен');
        } catch (err) {
            console.error('Ошибка отклонения запроса:', err);
            alert(err.response?.data?.error || 'Не удалось отклонить запрос');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="team-join-requests">
                <h3>Запросы на вступление</h3>
                <div className="loading">Загрузка...</div>
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="team-join-requests">
                <h3>Запросы на вступление</h3>
                <div className="empty-state">
                    <p>Нет активных запросов на вступление</p>
                </div>
            </div>
        );
    }

    return (
        <div className="team-join-requests">
            <h3>Запросы на вступление ({requests.length})</h3>
            
            <div className="requests-list">
                {requests.map(request => (
                    <div key={request.id} className="request-item">
                        <div className="request-header">
                            <div className="user-info">
                                {request.user_avatar && (
                                    <img 
                                        src={request.user_avatar} 
                                        alt={request.user_username}
                                        className="user-avatar"
                                    />
                                )}
                                <div className="user-details">
                                    <span className="username">{request.user_username}</span>
                                    <span className="timestamp">
                                        {new Date(request.created_at).toLocaleDateString('ru-RU')}
                                    </span>
                                </div>
                            </div>

                            {/* Рейтинги пользователя */}
                            {(request.faceit_elo || request.cs2_premier_rank) && (
                                <div className="user-ratings">
                                    {request.faceit_elo && (
                                        <span className="rating faceit">
                                            FACEIT: {request.faceit_elo}
                                        </span>
                                    )}
                                    {request.cs2_premier_rank && (
                                        <span className="rating premier">
                                            CS2: {request.cs2_premier_rank}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {request.message && (
                            <div className="request-message">
                                <p>{request.message}</p>
                            </div>
                        )}

                        <div className="request-actions">
                            <button
                                className="btn-accept"
                                onClick={() => handleAccept(request.id)}
                                disabled={processing === request.id}
                            >
                                {processing === request.id ? 'Обработка...' : '✓ Принять'}
                            </button>
                            <button
                                className="btn-reject"
                                onClick={() => handleReject(request.id)}
                                disabled={processing === request.id}
                            >
                                {processing === request.id ? 'Обработка...' : '✕ Отклонить'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default TeamJoinRequests;

