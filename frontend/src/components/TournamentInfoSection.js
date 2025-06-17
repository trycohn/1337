import React, { useState, useEffect } from 'react';
import './TournamentInfoSection.css';

const TournamentInfoSection = ({ tournament, onSave, currentUser, onRemoveParticipant }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [description, setDescription] = useState(tournament?.description || '');
    const [regulations, setRegulations] = useState(tournament?.regulations || '');
    const [gameDiscipline, setGameDiscipline] = useState(tournament?.gameDiscipline || '');
    const [showPrizePool, setShowPrizePool] = useState(tournament?.showPrizePool || false);
    const [prizePool, setPrizePool] = useState(tournament?.prizePool || '');
    const [canEdit, setCanEdit] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [showActions, setShowActions] = useState(false);

    useEffect(() => {
        // Проверяем права на редактирование
        const isAdmin = currentUser?.role === 'admin';
        const isCreator = currentUser?.id === tournament?.creatorId;
        setCanEdit(isAdmin || isCreator);
    }, [currentUser, tournament]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            description,
            regulations,
            gameDiscipline,
            showPrizePool,
            prizePool: showPrizePool ? prizePool : null
        });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setDescription(tournament?.description || '');
        setRegulations(tournament?.regulations || '');
        setGameDiscipline(tournament?.gameDiscipline || '');
        setShowPrizePool(tournament?.showPrizePool || false);
        setPrizePool(tournament?.prizePool || '');
        setIsEditing(false);
    };

    const handleParticipantClick = (participant) => {
        setSelectedParticipant(participant);
        setShowActions(true);
    };

    const handleRemoveParticipant = () => {
        if (selectedParticipant && onRemoveParticipant) {
            onRemoveParticipant(selectedParticipant.id);
            setShowActions(false);
            setSelectedParticipant(null);
        }
    };

    const handleOpenProfile = () => {
        if (selectedParticipant) {
            window.open(`/profile/${selectedParticipant.id}`, '_blank');
            setShowActions(false);
            setSelectedParticipant(null);
        }
    };

    return (
        <div className="tournament-info-section">
            <div className="section-header">
                <h2>Информация о турнире</h2>
                {canEdit && (
                    <button 
                        className="edit-button"
                        onClick={() => setIsEditing(!isEditing)}
                    >
                        {isEditing ? 'Отменить' : 'Редактировать'}
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="description">Полное описание турнира</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Введите полное описание турнира..."
                        disabled={!isEditing}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="regulations">Регламент турнира</label>
                    <textarea
                        id="regulations"
                        value={regulations}
                        onChange={(e) => setRegulations(e.target.value)}
                        placeholder="Введите регламент турнира..."
                        disabled={!isEditing}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="gameDiscipline">Дисциплина турнира</label>
                    <select
                        id="gameDiscipline"
                        value={gameDiscipline}
                        onChange={(e) => setGameDiscipline(e.target.value)}
                        disabled={!isEditing}
                    >
                        <option value="">Выберите дисциплину</option>
                        <option value="cs2">Counter-Strike 2</option>
                        <option value="dota2">Dota 2</option>
                        <option value="valorant">Valorant</option>
                        <option value="lol">League of Legends</option>
                    </select>
                </div>

                <div className="prize-pool-section">
                    <div className="prize-pool-toggle">
                        <label>
                            <input
                                type="checkbox"
                                checked={showPrizePool}
                                onChange={(e) => setShowPrizePool(e.target.checked)}
                                disabled={!isEditing}
                            />
                            Показывать призовой фонд
                        </label>
                    </div>

                    {showPrizePool && (
                        <div className="form-group">
                            <label htmlFor="prizePool">Призовой фонд</label>
                            <input
                                id="prizePool"
                                type="text"
                                value={prizePool}
                                onChange={(e) => setPrizePool(e.target.value)}
                                placeholder="Введите сумму призового фонда..."
                                disabled={!isEditing}
                            />
                        </div>
                    )}
                </div>

                {isEditing && (
                    <div className="form-actions">
                        <button type="submit" className="save-button">
                            Сохранить изменения
                        </button>
                        <button type="button" className="cancel-button" onClick={handleCancel}>
                            Отменить
                        </button>
                    </div>
                )}
            </form>

            {/* Участники турнира - скрываем для микс-турниров с сформированными командами */}
            {!(tournament?.format === 'mix' && tournament?.teams && tournament?.teams.length > 0) && (
                <div className="participants-section">
                    <h3>Участники турнира</h3>
                    <div className="participants-list">
                        {tournament?.participants?.map(participant => (
                            <div 
                                key={participant.id} 
                                className="participant-item"
                                onClick={() => handleParticipantClick(participant)}
                            >
                                <img 
                                    src={participant.avatar || '/default-avatar.png'} 
                                    alt={participant.username || participant.name || 'Участник'}
                                    className="participant-avatar"
                                />
                                <span className="participant-name">{participant.username || participant.name}</span>
                            </div>
                        ))}
                    </div>

                    {showActions && selectedParticipant && (
                        <div className="participant-actions-modal">
                            <div className="actions-content">
                                <h4>Действия с участником</h4>
                                <button 
                                    className="action-button profile-button"
                                    onClick={handleOpenProfile}
                                >
                                    Открыть профиль
                                </button>
                                {canEdit && (
                                    <button 
                                        className="action-button remove-button"
                                        onClick={handleRemoveParticipant}
                                    >
                                        Удалить из турнира
                                    </button>
                                )}
                                <button 
                                    className="action-button cancel-button"
                                    onClick={() => setShowActions(false)}
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Настройки микса - скрываем для турниров с уже сформированными командами */}
            {tournament?.format === 'mix' && !(tournament?.teams && tournament?.teams.length > 0) && (
                <div className="mix-settings">
                    <h3>Настройки микса</h3>
                    <div className="mix-options">
                        <div className="form-group">
                            <label>
                                <input type="checkbox" />
                                Случайное распределение
                            </label>
                        </div>
                        <div className="form-group">
                            <label>
                                <input type="checkbox" />
                                Учитывать рейтинг
                            </label>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentInfoSection; 