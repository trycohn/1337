/**
 * 🎮 POST-MATCH FEEDBACK MODAL
 * Полная форма оценки игроков после матча
 * 
 * @version 1.0.0
 * @date 2025-10-02
 */

import React, { useState, useEffect } from 'react';
import api from '../../axios';
import './PostMatchFeedbackModal.css';

function PostMatchFeedbackModal({ isOpen, onClose, matchId, matchInfo }) {
    const [loading, setLoading] = useState(true);
    const [teammates, setTeammates] = useState([]);
    const [opponents, setOpponents] = useState([]);
    const [feedbacks, setFeedbacks] = useState({});
    const [submitting, setSubmitting] = useState(false);
    
    useEffect(() => {
        if (isOpen && matchId) {
            loadParticipants();
        }
    }, [isOpen, matchId]);
    
    const loadParticipants = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/api/matches/${matchId}/feedback/participants`);
            
            if (response.data.success) {
                setTeammates(response.data.teammates || []);
                setOpponents(response.data.opponents || []);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки участников:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleRating = (playerId, category, value) => {
        setFeedbacks(prev => ({
            ...prev,
            [playerId]: {
                ...prev[playerId],
                [category]: value
            }
        }));
    };
    
    const handleSubmit = async () => {
        // Проверка что хотя бы кто-то оценен
        if (Object.keys(feedbacks).length === 0) {
            alert('Оцените хотя бы одного игрока');
            return;
        }
        
        setSubmitting(true);
        try {
            const feedbacksArray = Object.entries(feedbacks).map(([userId, ratings]) => ({
                reviewed_id: parseInt(userId),
                fairness_rating: ratings.fairness || null,
                behavior_rating: ratings.behavior || null,
                teamplay_rating: ratings.teamplay || null,
                communication_rating: ratings.communication || null
            }));
            
            const response = await api.post(`/api/matches/${matchId}/feedback`, {
                feedbacks: feedbacksArray
            });
            
            if (response.data.success) {
                alert(`✅ ${response.data.message}\n\nОценок сохранено: ${response.data.feedbacks_saved}\nНачислено coins: ${response.data.coins_earned} 🪙`);
                onClose();
            }
        } catch (error) {
            console.error('❌ Ошибка отправки feedback:', error);
            alert('❌ Ошибка отправки feedback. Попробуйте позже.');
        } finally {
            setSubmitting(false);
        }
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="post-feedback-overlay" onClick={onClose}>
            <div className="post-feedback-modal" onClick={(e) => e.stopPropagation()}>
                {/* Заголовок */}
                <div className="post-feedback-header">
                    <h2>📊 Оценка матча</h2>
                    <button 
                        className="feedback-close-btn"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>
                
                {loading ? (
                    <div className="feedback-loading">
                        Загрузка участников...
                    </div>
                ) : (
                    <div className="post-feedback-content">
                        {/* Секция соперников */}
                        {opponents.length > 0 && (
                            <div className="feedback-section">
                                <h3 className="feedback-section-title">
                                    Оцените соперников:
                                </h3>
                                <p className="feedback-section-hint">
                                    Как прошла игра против них? Были ли подозрительные моменты?
                                </p>
                                
                                {opponents.map(player => (
                                    <div key={player.id} className="feedback-player-card">
                                        {/* Информация об игроке */}
                                        <div className="feedback-player-info">
                                            <img 
                                                src={player.avatar_url || '/default-avatar.png'}
                                                alt={player.username}
                                                className="feedback-player-avatar"
                                                onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                            />
                                            <span className="feedback-player-name">
                                                {player.username}
                                            </span>
                                        </div>
                                        
                                        {/* Оценка честности */}
                                        <div className="feedback-rating-group">
                                            <label>Честность игры:</label>
                                            <div className="feedback-rating-buttons">
                                                <button
                                                    className={`rating-btn rating-clean ${feedbacks[player.id]?.fairness === 'clean' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'fairness', 'clean')}
                                                >
                                                    😊 Чисто
                                                </button>
                                                <button
                                                    className={`rating-btn rating-normal ${feedbacks[player.id]?.fairness === 'normal' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'fairness', 'normal')}
                                                >
                                                    😐 Норм
                                                </button>
                                                <button
                                                    className={`rating-btn rating-suspicious ${feedbacks[player.id]?.fairness === 'suspicious' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'fairness', 'suspicious')}
                                                >
                                                    ⚠️ Подозрительно
                                                </button>
                                                <button
                                                    className={`rating-btn rating-cheating ${feedbacks[player.id]?.fairness === 'cheating' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'fairness', 'cheating')}
                                                >
                                                    ☠️ Чит
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Оценка поведения */}
                                        <div className="feedback-rating-group">
                                            <label>Поведение:</label>
                                            <div className="feedback-rating-buttons">
                                                <button
                                                    className={`rating-btn rating-good ${feedbacks[player.id]?.behavior === 'excellent' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'behavior', 'excellent')}
                                                >
                                                    👍 Отлично
                                                </button>
                                                <button
                                                    className={`rating-btn rating-normal ${feedbacks[player.id]?.behavior === 'normal' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'behavior', 'normal')}
                                                >
                                                    😐 Норм
                                                </button>
                                                <button
                                                    className={`rating-btn rating-toxic ${feedbacks[player.id]?.behavior === 'toxic' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'behavior', 'toxic')}
                                                >
                                                    👎 Токсично
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Секция тиммейтов */}
                        {teammates.length > 0 && (
                            <div className="feedback-section">
                                <h3 className="feedback-section-title">
                                    Оцените тиммейтов:
                                </h3>
                                <p className="feedback-section-hint">
                                    Как играли ваши союзники? Была ли командная работа?
                                </p>
                                
                                {teammates.map(player => (
                                    <div key={player.id} className="feedback-player-card">
                                        {/* Информация об игроке */}
                                        <div className="feedback-player-info">
                                            <img 
                                                src={player.avatar_url || '/default-avatar.png'}
                                                alt={player.username}
                                                className="feedback-player-avatar"
                                                onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                            />
                                            <span className="feedback-player-name">
                                                {player.username}
                                            </span>
                                        </div>
                                        
                                        {/* Командная игра */}
                                        <div className="feedback-rating-group">
                                            <label>Командная игра:</label>
                                            <div className="feedback-rating-buttons">
                                                <button
                                                    className={`rating-btn rating-good ${feedbacks[player.id]?.teamplay === 'excellent' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'teamplay', 'excellent')}
                                                >
                                                    👍 Отлично
                                                </button>
                                                <button
                                                    className={`rating-btn rating-normal ${feedbacks[player.id]?.teamplay === 'normal' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'teamplay', 'normal')}
                                                >
                                                    😐 Норм
                                                </button>
                                                <button
                                                    className={`rating-btn rating-bad ${feedbacks[player.id]?.teamplay === 'poor' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'teamplay', 'poor')}
                                                >
                                                    👎 Плохо
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Коммуникация */}
                                        <div className="feedback-rating-group">
                                            <label>Коммуникация:</label>
                                            <div className="feedback-rating-buttons">
                                                <button
                                                    className={`rating-btn rating-good ${feedbacks[player.id]?.communication === 'good' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'communication', 'good')}
                                                >
                                                    💬 Хорошо
                                                </button>
                                                <button
                                                    className={`rating-btn rating-normal ${feedbacks[player.id]?.communication === 'normal' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'communication', 'normal')}
                                                >
                                                    😐 Норм
                                                </button>
                                                <button
                                                    className={`rating-btn rating-silent ${feedbacks[player.id]?.communication === 'silent' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'communication', 'silent')}
                                                >
                                                    🔇 Молчал
                                                </button>
                                                <button
                                                    className={`rating-btn rating-toxic ${feedbacks[player.id]?.communication === 'toxic' ? 'active' : ''}`}
                                                    onClick={() => handleRating(player.id, 'communication', 'toxic')}
                                                >
                                                    😠 Токсик
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Итоговая информация */}
                        <div className="feedback-summary">
                            <div className="feedback-summary-item">
                                <span>Оценено игроков:</span>
                                <strong>{Object.keys(feedbacks).length}</strong>
                            </div>
                            <div className="feedback-summary-item">
                                <span>Награда:</span>
                                <strong className="reward-highlight">
                                    {Object.keys(feedbacks).length * 10} 🪙
                                </strong>
                            </div>
                        </div>
                        
                        {/* Кнопки действий */}
                        <div className="post-feedback-actions">
                            <button 
                                className="feedback-btn feedback-btn-secondary"
                                onClick={onClose}
                                disabled={submitting}
                            >
                                Отмена
                            </button>
                            <button 
                                className="feedback-btn feedback-btn-primary"
                                onClick={handleSubmit}
                                disabled={Object.keys(feedbacks).length === 0 || submitting}
                            >
                                {submitting ? '⏳ Отправка...' : '✅ Отправить feedback'}
                            </button>
                        </div>
                        
                        {/* Предупреждение */}
                        <p className="feedback-warning">
                            ⚠️ Ложные обвинения в читинге наказываются снижением вашей репутации
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PostMatchFeedbackModal;

