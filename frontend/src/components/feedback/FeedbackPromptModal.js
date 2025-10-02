/**
 * 🎮 FEEDBACK PROMPT MODAL
 * Первая модалка с вопросом "Хотите оценить матч?"
 * 
 * @version 1.0.0
 * @date 2025-10-02
 */

import React from 'react';
import './FeedbackPromptModal.css';

function FeedbackPromptModal({ isOpen, onClose, onAccept, matchInfo }) {
    if (!isOpen) return null;
    
    return (
        <div className="feedback-prompt-overlay" onClick={onClose}>
            <div className="feedback-prompt-modal" onClick={(e) => e.stopPropagation()}>
                <div className="feedback-prompt-content">
                    {/* Иконка */}
                    <div className="feedback-prompt-icon">
                        📊
                    </div>
                    
                    {/* Заголовок */}
                    <h2 className="feedback-prompt-title">
                        Хотите оценить прошедший матч?
                    </h2>
                    
                    {/* Описание */}
                    <p className="feedback-prompt-description">
                        Ваше мнение поможет сделать турниры честнее и приятнее для всех игроков.
                    </p>
                    
                    {/* Информация о матче */}
                    {matchInfo && (
                        <div className="feedback-prompt-match-info">
                            <span className="match-info-label">Матч завершен</span>
                            {matchInfo.team1_name && matchInfo.team2_name && (
                                <span className="match-info-teams">
                                    {matchInfo.team1_name} vs {matchInfo.team2_name}
                                </span>
                            )}
                        </div>
                    )}
                    
                    {/* Награда */}
                    <div className="feedback-prompt-reward">
                        <span className="reward-icon">🪙</span>
                        <span className="reward-text">
                            Получите до <strong>50 Leet Coins</strong> за вашу оценку
                        </span>
                    </div>
                    
                    {/* Кнопки */}
                    <div className="feedback-prompt-actions">
                        <button 
                            className="feedback-btn feedback-btn-secondary"
                            onClick={onClose}
                        >
                            ⏭️ Пропустить
                        </button>
                        <button 
                            className="feedback-btn feedback-btn-primary"
                            onClick={onAccept}
                        >
                            ✅ Оценить матч
                        </button>
                    </div>
                    
                    {/* Подсказка */}
                    <p className="feedback-prompt-hint">
                        Займет всего 30-60 секунд
                    </p>
                </div>
            </div>
        </div>
    );
}

export default FeedbackPromptModal;

