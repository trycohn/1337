import React, { useState, useEffect } from 'react';
import './DeleteTournamentModal.css';

/**
 * DeleteTournamentModal - Модальное окно для подтверждения удаления турнира
 * 
 * @param {boolean} isOpen - Состояние открытия модального окна
 * @param {function} onClose - Функция закрытия модального окна
 * @param {function} onConfirm - Функция подтверждения удаления
 * @param {object} tournament - Данные турнира для удаления
 * @param {boolean} isLoading - Состояние загрузки
 */
const DeleteTournamentModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    tournament, 
    isLoading = false 
}) => {
    const [confirmationText, setConfirmationText] = useState('');
    const [isConfirmEnabled, setIsConfirmEnabled] = useState(false);
    
    const requiredText = 'удалить';
    
    // Проверяем введенный текст
    useEffect(() => {
        setIsConfirmEnabled(confirmationText.toLowerCase().trim() === requiredText);
    }, [confirmationText]);
    
    // Очищаем поле при закрытии/открытии модального окна
    useEffect(() => {
        if (isOpen) {
            setConfirmationText('');
            setIsConfirmEnabled(false);
        }
    }, [isOpen]);
    
    // Обработка закрытия модального окна
    const handleClose = () => {
        if (isLoading) return; // Предотвращаем закрытие во время загрузки
        setConfirmationText('');
        setIsConfirmEnabled(false);
        onClose();
    };
    
    // Обработка подтверждения удаления
    const handleConfirm = () => {
        if (isConfirmEnabled && !isLoading) {
            onConfirm();
        }
    };
    
    // Обработка нажатия Escape
    useEffect(() => {
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && isOpen && !isLoading) {
                handleClose();
            }
        };
        
        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
            return () => document.removeEventListener('keydown', handleEscapeKey);
        }
    }, [isOpen, isLoading]);
    
    // Обработка клика по overlay
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget && !isLoading) {
            handleClose();
        }
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="delete-tournament-modal-overlay__deletetournament" onClick={handleOverlayClick}>
            <div className="delete-tournament-modal__deletetournament">
                <div className="delete-tournament-modal-header__deletetournament">
                    <h3>🗑️ Удаление турнира</h3>
                    <button 
                        className="delete-tournament-modal-close__deletetournament"
                        onClick={handleClose}
                        disabled={isLoading}
                        aria-label="Закрыть модальное окно"
                    >
                        ✕
                    </button>
                </div>
                
                <div className="delete-tournament-modal-content__deletetournament">
                    <div className="delete-tournament-warning__deletetournament">
                        <div className="warning-icon__deletetournament">⚠️</div>
                        <div className="warning-text__deletetournament">
                            <h4>Внимание! Это действие необратимо!</h4>
                            <p>Вы собираетесь удалить турнир:</p>
                            <div className="tournament-info__deletetournament">
                                <strong>"{tournament?.name}"</strong>
                                {tournament?.participants?.length > 0 && (
                                    <span className="participants-count__deletetournament">
                                        • {tournament.participants.length} участников
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="delete-tournament-consequences__deletetournament">
                        <h5>Что будет удалено:</h5>
                        <ul>
                            <li>🏆 Турнир и все его данные</li>
                            <li>👥 Все участники и команды</li>
                            <li>⚔️ Все матчи и результаты</li>
                            <li>💬 Чат турнира</li>
                            <li>📊 Статистика и история</li>
                        </ul>
                    </div>
                    
                    <div className="delete-tournament-confirmation__deletetournament">
                        <label htmlFor="confirmation-input">
                            Для подтверждения удаления турнира пропишите письменно в поле ниже фразу <strong>"{requiredText}"</strong>, а затем нажмите кнопку "Подтверждаю":
                        </label>
                        <input
                            id="confirmation-input"
                            type="text"
                            value={confirmationText}
                            onChange={(e) => setConfirmationText(e.target.value)}
                            placeholder={`Введите "${requiredText}"`}
                            disabled={isLoading}
                            className={`confirmation-input__deletetournament ${isConfirmEnabled ? 'confirmed' : ''}`}
                            autoComplete="off"
                        />
                        <div className="confirmation-hint__deletetournament">
                            {confirmationText.length > 0 && (
                                <span className={isConfirmEnabled ? 'hint-success__deletetournament' : 'hint-error__deletetournament'}>
                                    {isConfirmEnabled ? '✅ Подтверждение введено верно' : '❌ Введите точно "удалить"'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="delete-tournament-modal-footer__deletetournament">
                    <button 
                        className="btn btn-secondary"
                        onClick={handleClose}
                        disabled={isLoading}
                    >
                        Отмена
                    </button>
                    <button 
                        className={`delete-tournament-confirm-btn__deletetournament ${isConfirmEnabled ? 'enabled' : 'disabled'}`}
                        onClick={handleConfirm}
                        disabled={!isConfirmEnabled || isLoading}
                    >
                        {isLoading ? (
                            <>
                                <span className="loading-spinner__deletetournament"></span>
                                Удаление...
                            </>
                        ) : (
                            'Подтверждаю'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteTournamentModal; 