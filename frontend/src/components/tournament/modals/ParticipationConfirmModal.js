import React from 'react';
import './ParticipationConfirmModal.css';

const ParticipationConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    tournament,
    isLoading = false,
    participationType = 'solo' // 'solo', 'mix', 'team'
}) => {
    if (!isOpen) return null;

    const getParticipationText = () => {
        switch (participationType) {
            case 'team':
                return 'присоединиться к турниру с выбранной командой';
            case 'mix':
                return 'присоединиться к микс-турниру (команды будут сформированы автоматически)';
            default:
                return 'принять участие в турнире';
        }
    };

    const getModalTitle = () => {
        switch (participationType) {
            case 'team':
                return 'Подтверждение участия команды';
            case 'mix':
                return 'Подтверждение участия в микс-турнире';
            default:
                return 'Подтверждение участия';
        }
    };

    return (
        <div className="modal-overlay participation-confirm-overlay">
            <div className="modal-content participation-confirm-modal">
                <div className="modal-header">
                    <h3>{getModalTitle()}</h3>
                    <button 
                        className="close-btn" 
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        ✕
                    </button>
                </div>

                <div className="modal-body">
                    <div className="participation-info">
                        <div className="tournament-info">
                            <h4>{tournament?.name}</h4>
                            <div className="tournament-details">
                                <p><strong>Игра:</strong> {tournament?.game}</p>
                                <p><strong>Формат:</strong> {tournament?.format}</p>
                                <p><strong>Тип участников:</strong> {tournament?.participant_type}</p>
                                {tournament?.max_participants && (
                                    <p><strong>Максимум участников:</strong> {tournament.max_participants}</p>
                                )}
                                {tournament?.scheduled_start && (
                                    <p><strong>Начало:</strong> {new Date(tournament.scheduled_start).toLocaleString('ru-RU')}</p>
                                )}
                            </div>
                        </div>

                        <div className="confirmation-message">
                            <p>Вы уверены, что хотите <strong>{getParticipationText()}</strong>?</p>
                            
                            {participationType === 'mix' && (
                                <div className="mix-info">
                                    <p className="info-note">
                                        <span className="info-icon">ℹ️</span>
                                        В микс-турнире команды формируются автоматически на основе рейтинга игроков.
                                    </p>
                                </div>
                            )}

                            {participationType === 'team' && (
                                <div className="team-info">
                                    <p className="info-note">
                                        <span className="info-icon">👥</span>
                                        Убедитесь, что ваша команда готова к участию в турнире.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button 
                        className="btn-cancel" 
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Отмена
                    </button>
                    <button 
                        className="btn-confirm-participation" 
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <span className="loading-spinner"></span>
                                Участвую...
                            </>
                        ) : (
                            'Подтвердить участие'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ParticipationConfirmModal; 