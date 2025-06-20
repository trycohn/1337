import React, { useState } from 'react';
import api from '../../utils/api';
import './CreateTeamModal.css';

const CreateTeamModal = ({ onClose, onTeamCreated }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            setError('Название команды обязательно');
            return;
        }

        if (formData.name.trim().length > 20) {
            setError('Название команды не должно превышать 20 символов');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/teams', {
                name: formData.name.trim(),
                description: formData.description.trim() || null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            onTeamCreated(response.data);
        } catch (err) {
            console.error('Ошибка создания команды:', err);
            setError(err.response?.data?.error || 'Ошибка создания команды');
        } finally {
            setLoading(false);
        }
    };

    const handleModalClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const remainingChars = 20 - formData.name.length;

    return (
        <div className="modal-overlay" onClick={handleModalClick}>
            <div className="create-team-modal">
                <div className="modal-header">
                    <h2>Создать команду</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="create-team-form">
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="name">
                            Название команды *
                            <span className={`char-counter ${remainingChars < 0 ? 'over-limit' : ''}`}>
                                {remainingChars} символов осталось
                            </span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="Введите название команды"
                            maxLength="25"
                            required
                            className={remainingChars < 0 ? 'over-limit' : ''}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">
                            Описание команды (необязательно)
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Краткое описание команды..."
                            rows="3"
                            maxLength="500"
                        />
                    </div>

                    <div className="form-actions">
                        <button 
                            type="button" 
                            className="cancel-btn" 
                            onClick={onClose}
                            disabled={loading}
                        >
                            Отмена
                        </button>
                        <button 
                            type="submit" 
                            className="create-btn"
                            disabled={loading || !formData.name.trim() || remainingChars < 0}
                        >
                            {loading ? 'Создание...' : 'Создать команду'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTeamModal; 