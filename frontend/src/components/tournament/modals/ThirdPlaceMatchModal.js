// =====================================================
// МОДАЛЬНОЕ ОКНО ВЫБОРА МАТЧА ЗА 3-Е МЕСТО
// Версия: 1.0 - Для Single Elimination турниров
// =====================================================

import React from 'react';
import './ThirdPlaceMatchModal.css';

const ThirdPlaceMatchModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    participantCount = 0,
    tournamentName = ''
}) => {
    if (!isOpen) return null;

    const handleYes = () => {
        onConfirm(true);
        onClose();
    };

    const handleNo = () => {
        onConfirm(false);
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleCancel}>
            <div className="third-place-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>🥉 Матч за 3-е место</h3>
                    <button className="modal-close" onClick={handleCancel}>×</button>
                </div>
                
                <div className="modal-body">
                    <div className="tournament-info">
                        <div className="info-item">
                            <span className="info-label">Турнир:</span>
                            <span className="info-value">{tournamentName}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Участников:</span>
                            <span className="info-value">{participantCount}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Формат:</span>
                            <span className="info-value">Single Elimination</span>
                        </div>
                    </div>

                    <div className="question-section">
                        <div className="question-icon">🤔</div>
                        <h4>Нужен ли матч за 3-е место?</h4>
                        <p className="question-description">
                            Матч за третье место проводится между проигравшими в полуфинале 
                            для определения бронзового призера турнира.
                        </p>
                    </div>

                    <div className="benefits-section">
                        <div className="benefit-column">
                            <h5>✅ С матчем за 3-е место:</h5>
                            <ul>
                                <li>Четкое определение 3-го места</li>
                                <li>Дополнительный зрелищный матч</li>
                                <li>Больше игрового времени</li>
                                <li>Справедливое распределение призов</li>
                            </ul>
                        </div>
                        <div className="benefit-column">
                            <h5>❌ Без матча за 3-е место:</h5>
                            <ul>
                                <li>Быстрое завершение турнира</li>
                                <li>Меньше нагрузки на игроков</li>
                                <li>Фокус только на финале</li>
                                <li>Два 3-х места (ничья)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button 
                        className="btn btn-success" 
                        onClick={handleYes}
                        title="Добавить матч за 3-е место"
                    >
                        <span>🥉</span>
                        Да, нужен
                    </button>
                    
                    <button 
                        className="btn btn-secondary" 
                        onClick={handleNo}
                        title="Обойтись без матча за 3-е место"
                    >
                        <span>⚡</span>
                        Нет, не нужен
                    </button>
                    
                    <button 
                        className="btn btn-outline" 
                        onClick={handleCancel}
                        title="Отменить генерацию сетки"
                    >
                        <span>❌</span>
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ThirdPlaceMatchModal; 