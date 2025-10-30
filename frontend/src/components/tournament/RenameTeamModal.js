import React, { useState } from 'react';
import axios from 'axios';
import './RenameTeamModal.css';

/**
 * Модальное окно для переименования команды в турнире
 * Только для организаторов турнира
 */
function RenameTeamModal({ tournament, team, onClose, onSuccess }) {
    const [newName, setNewName] = useState(team.name || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleRename = async () => {
        if (!newName.trim()) {
            setError('Введите название команды');
            return;
        }

        if (newName.trim().length > 50) {
            setError('Название не должно превышать 50 символов');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('token');
            await axios.put(
                `${process.env.REACT_APP_API_URL}/api/tournaments/${tournament.id}/teams/${team.id}/rename`,
                { newName: newName.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (err) {
            console.error('Ошибка переименования команды:', err);
            setError(err.response?.data?.error || 'Не удалось переименовать команду');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="rename-team-modal">
                <div className="modal-header">
                    <h2>Переименовать команду</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-content">
                    <div className="current-name">
                        <span className="label">Текущее название:</span>
                        <span className="value">{team.name}</span>
                    </div>

                    <div className="form-field">
                        <label>Новое название:</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Введите новое название"
                            maxLength={50}
                            autoFocus
                        />
                        <span className="char-count">{newName.length}/50</span>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="modal-actions">
                        <button
                            className="btn-cancel"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Отмена
                        </button>
                        <button
                            className="btn-save"
                            onClick={handleRename}
                            disabled={loading || !newName.trim()}
                        >
                            {loading ? 'Сохранение...' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RenameTeamModal;

