import React, { useState, useEffect } from 'react';
import './AddParticipantModal.css';

const AddParticipantModal = ({
    isOpen,
    onClose,
    newParticipantData,
    setNewParticipantData,
    onSubmit,
    isLoading = false,
    tournamentType = 'solo' // 'team' или 'solo'
}) => {
    const [showPlayersList, setShowPlayersList] = useState(false);
    const [teamPlayers, setTeamPlayers] = useState([{ nickname: '' }]);

    useEffect(() => {
        // Сбрасываем состояние при открытии модалки
        if (isOpen) {
            setShowPlayersList(false);
            setTeamPlayers([{ nickname: '' }]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isTeamTournament = tournamentType === 'team';

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewParticipantData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAddPlayer = () => {
        setTeamPlayers(prev => [...prev, { nickname: '' }]);
    };

    const handleRemovePlayer = (index) => {
        setTeamPlayers(prev => prev.filter((_, i) => i !== index));
    };

    const handlePlayerChange = (index, value) => {
        setTeamPlayers(prev => {
            const updated = [...prev];
            updated[index] = { nickname: value };
            return updated;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Для командных турниров добавляем информацию об игроках
        if (isTeamTournament && showPlayersList) {
            const players = teamPlayers
                .map(p => p.nickname.trim())
                .filter(n => n.length > 0);
            
            onSubmit({ ...newParticipantData, players });
        } else {
            onSubmit(newParticipantData);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content add-participant-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>➕ Добавить {isTeamTournament ? 'незарегистрированную команду' : 'незарегистрированного участника'}</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="add-participant-form">
                    <div className="form-group">
                        <label htmlFor="participant-name">
                            {isTeamTournament ? 'Название команды' : 'Имя участника'} <span className="required">*</span>
                        </label>
                        <input
                            id="participant-name"
                            type="text"
                            name="display_name"
                            value={newParticipantData.display_name || ''}
                            onChange={handleInputChange}
                            placeholder={isTeamTournament ? 'Введите название команды' : 'Введите имя участника'}
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

                    {/* Для командных турниров - добавление игроков */}
                    {isTeamTournament && (
                        <div className="form-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={showPlayersList}
                                    onChange={(e) => setShowPlayersList(e.target.checked)}
                                    disabled={isLoading}
                                />
                                <span style={{ marginLeft: '8px' }}>Указать игроков команды?</span>
                            </label>

                            {showPlayersList && (
                                <div className="players-list" style={{ marginTop: '12px' }}>
                                    {teamPlayers.map((player, index) => (
                                        <div key={index} className="player-input-row" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                            <input
                                                type="text"
                                                value={player.nickname}
                                                onChange={(e) => handlePlayerChange(index, e.target.value)}
                                                placeholder={`Ник игрока ${index + 1}`}
                                                disabled={isLoading}
                                                style={{ flex: 1 }}
                                            />
                                            {teamPlayers.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePlayer(index)}
                                                    disabled={isLoading}
                                                    className="remove-player-btn"
                                                    style={{
                                                        padding: '8px 12px',
                                                        background: '#ff0000',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={handleAddPlayer}
                                        disabled={isLoading}
                                        className="add-player-btn"
                                        style={{
                                            padding: '8px 12px',
                                            background: '#111',
                                            color: '#fff',
                                            border: '1px solid #ff0000',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            marginTop: '4px'
                                        }}
                                    >
                                        ➕ Добавить игрока
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

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
                            disabled={isLoading || !newParticipantData.display_name?.trim()}
                        >
                            {isLoading ? 'Добавление...' : 'Добавить'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddParticipantModal; 