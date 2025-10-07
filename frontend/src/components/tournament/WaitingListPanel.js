import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { ensureHttps } from '../../utils/userHelpers';
import './WaitingListPanel.css';

/**
 * Панель листа ожидания для командных турниров
 * Отображается как отдельная секция на вкладке участников
 */
const WaitingListPanel = ({ tournament, user, isAdminOrCreator, onUpdate }) => {
    const [waitingList, setWaitingList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [userInWaitingList, setUserInWaitingList] = useState(false);

    // Загрузка листа ожидания
    const loadWaitingList = async () => {
        if (!tournament?.id) return;

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await api.get(
                `/api/tournaments/${tournament.id}/waiting-list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success) {
                setWaitingList(response.data.waitingList || []);
                
                // Проверяем есть ли текущий пользователь в листе
                if (user?.id) {
                    const userExists = response.data.waitingList.some(p => p.user_id === user.id);
                    setUserInWaitingList(userExists);
                }
            }
        } catch (err) {
            console.error('Ошибка загрузки листа ожидания:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tournament?.waiting_list_enabled) {
            loadWaitingList();
        }
    }, [tournament?.id, tournament?.waiting_list_enabled]);

    // Присоединиться к листу ожидания
    const handleJoinWaitingList = async () => {
        try {
            setIsJoining(true);
            setMessage('');
            
            const token = localStorage.getItem('token');
            const response = await api.post(
                `/api/tournaments/${tournament.id}/waiting-list/join`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success) {
                setMessage('✅ Вы добавлены в лист ожидания');
                setUserInWaitingList(true);
                await loadWaitingList();
                
                if (onUpdate) {
                    onUpdate();
                }
            }
        } catch (err) {
            const errorCode = err.response?.data?.code;
            
            if (errorCode === 'FACEIT_LINK_REQUIRED') {
                if (window.confirm('Для участия требуется привязать FACEIT аккаунт. Перейти к привязке?')) {
                    window.location.href = '/profile#faceit';
                }
            } else if (errorCode === 'STEAM_LINK_REQUIRED') {
                if (window.confirm('Для участия требуется привязать Steam аккаунт. Перейти к привязке?')) {
                    window.location.href = '/profile#steam';
                }
            } else {
                setMessage(`❌ ${err.response?.data?.error || 'Ошибка при добавлении в лист ожидания'}`);
            }
        } finally {
            setIsJoining(false);
            setTimeout(() => setMessage(''), 5000);
        }
    };

    if (!tournament?.waiting_list_enabled) {
        return null;
    }

    return (
        <div className="waiting-list-panel-container">
            <div className="waiting-list-header">
                <h3>📋 Лист ожидания</h3>
                <span className="waiting-count">{waitingList.length} {waitingList.length === 1 ? 'игрок' : 'игроков'}</span>
            </div>

            {message && (
                <div className={`waiting-list-message ${message.startsWith('✅') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            {/* Кнопка для игрока */}
            {user && !isAdminOrCreator && !userInWaitingList && tournament?.status === 'active' && (
                <div className="join-waiting-section">
                    <p>Нет команды? Заявитесь в лист ожидания, и организатор добавит вас в команду.</p>
                    <button 
                        className="btn btn-primary"
                        onClick={handleJoinWaitingList}
                        disabled={isJoining}
                    >
                        {isJoining ? 'Обработка...' : 'Заявиться в лист ожидания'}
                    </button>
                    
                    {(tournament.waiting_list_require_faceit || tournament.waiting_list_require_steam) && (
                        <p className="requirements-hint">
                            Требования: 
                            {tournament.waiting_list_require_faceit && ' привязка FACEIT'}
                            {tournament.waiting_list_require_faceit && tournament.waiting_list_require_steam && ','}
                            {tournament.waiting_list_require_steam && ' привязка Steam'}
                        </p>
                    )}
                </div>
            )}

            {userInWaitingList && (
                <div className="user-in-waiting-notice">
                    ✅ Вы находитесь в листе ожидания. Ожидайте назначения в команду.
                </div>
            )}

            {/* Список ожидающих */}
            {loading ? (
                <div className="waiting-list-loading">Загрузка...</div>
            ) : waitingList.length === 0 ? (
                <div className="waiting-list-empty">
                    <p>В листе ожидания пока нет игроков</p>
                </div>
            ) : (
                <div className="waiting-list-grid">
                    {waitingList.map(participant => {
                        const rating = tournament?.mix_rating_type === 'faceit'
                            ? (participant.faceit_elo || participant.user_faceit_elo || 1000)
                            : (participant.cs2_premier_rank || participant.user_cs2_premier_rank || 5);

                        return (
                            <div key={participant.id} className="waiting-participant-card">
                                <div className="participant-avatar">
                                    {participant.avatar_url ? (
                                        <img 
                                            src={ensureHttps(participant.avatar_url)} 
                                            alt={participant.name}
                                        />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {(participant.name || participant.username || '?').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="participant-info">
                                    <div className="participant-name">
                                        {participant.name || participant.username}
                                    </div>
                                    <div className="participant-rating">
                                        {tournament?.mix_rating_type === 'faceit' 
                                            ? `${rating} ELO`
                                            : `Premier ${rating}`
                                        }
                                    </div>
                                </div>
                                <div className="participant-time">
                                    {new Date(participant.created_at).toLocaleString('ru-RU', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WaitingListPanel;
