import React from 'react';
import './AddParticipantModal.css';

const AddParticipantModal = ({
    isOpen,
    onClose,
    newParticipantData,
    setNewParticipantData,
    onSubmit,
    isLoading = false
}) => {
    if (!isOpen) return null;

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewParticipantData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content add-participant-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>➕ Добавить незарегистрированного участника</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="add-participant-form">
                    <div className="form-group">
                        <label htmlFor="participant-name">
                            Имя участника <span className="required">*</span>
                        </label>
                        <input
                            id="participant-name"
                            type="text"
                            name="name"
                            value={newParticipantData.name}
                            onChange={handleInputChange}
                            placeholder="Введите имя участника"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="participant-email">Email (необязательно)</label>
                        <input
                            id="participant-email"
                            type="email"
                            name="email"
                            value={newParticipantData.email}
                            onChange={handleInputChange}
                            placeholder="email@example.com"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="participant-faceit">FACEIT ELO (необязательно)</label>
                        <input
                            id="participant-faceit"
                            type="number"
                            name="faceit_elo"
                            value={newParticipantData.faceit_elo}
                            onChange={handleInputChange}
                            placeholder="1000"
                            min="1"
                            max="5000"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="participant-cs2">CS2 Premier Rank (необязательно)</label>
                        <input
                            id="participant-cs2"
                            type="number"
                            name="cs2_premier_rank"
                            value={newParticipantData.cs2_premier_rank}
                            onChange={handleInputChange}
                            placeholder="15000"
                            min="0"
                            max="50000"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="modal-actions">
                        <button 
                            type="button" 
                            className="cancel-btn" 
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Отмена
                        </button>
                        <button 
                            type="submit" 
                            className="confirm-btn"
                            disabled={isLoading || !newParticipantData.name.trim()}
                        >
                            {isLoading ? 'Добавление...' : 'Добавить участника'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddParticipantModal; 