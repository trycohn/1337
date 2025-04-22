import React, { useState } from 'react';
import './TournamentInfoSection.css';

const TournamentInfoSection = ({ tournament, onSave }) => {
    const [description, setDescription] = useState(tournament?.description || '');
    const [regulations, setRegulations] = useState(tournament?.regulations || '');
    const [gameDiscipline, setGameDiscipline] = useState(tournament?.gameDiscipline || '');
    const [showPrizePool, setShowPrizePool] = useState(tournament?.showPrizePool || false);
    const [prizePool, setPrizePool] = useState(tournament?.prizePool || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            description,
            regulations,
            gameDiscipline,
            showPrizePool,
            prizePool: showPrizePool ? prizePool : null
        });
    };

    return (
        <div className="tournament-info-section">
            <h2>Информация о турнире</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="description">Описание турнира</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Введите описание турнира..."
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="regulations">Регламент турнира</label>
                    <textarea
                        id="regulations"
                        value={regulations}
                        onChange={(e) => setRegulations(e.target.value)}
                        placeholder="Введите регламент турнира..."
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="gameDiscipline">Дисциплина</label>
                    <select
                        id="gameDiscipline"
                        value={gameDiscipline}
                        onChange={(e) => setGameDiscipline(e.target.value)}
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
                            />
                        </div>
                    )}
                </div>

                <button type="submit" className="save-button">
                    Сохранить изменения
                </button>
            </form>
        </div>
    );
};

export default TournamentInfoSection; 