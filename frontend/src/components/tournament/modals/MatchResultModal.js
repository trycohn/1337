import React, { useState, useEffect } from 'react';
import { isCounterStrike2, getGameMaps } from '../../../utils/mapHelpers';
import './MatchResultModal.css';

const MatchResultModal = ({
    isOpen,
    onClose,
    match,
    tournament,
    matchResultData,
    setMatchResultData,
    onSave,
    isLoading = false
}) => {
    const [availableMaps, setAvailableMaps] = useState([]);
    
    useEffect(() => {
        if (tournament?.game) {
            const maps = getGameMaps(tournament.game);
            setAvailableMaps(maps);
        }
    }, [tournament?.game]);

    if (!isOpen || !match) return null;

    const handleScoreChange = (team, value) => {
        const score = parseInt(value) || 0;
        setMatchResultData(prev => ({
            ...prev,
            [team === 1 ? 'score1' : 'score2']: score
        }));
    };

    const handleMapScoreChange = (mapIndex, team, value) => {
        const score = parseInt(value) || 0;
        setMatchResultData(prev => {
            const newMapsData = [...(prev.maps_data || [])];
            if (!newMapsData[mapIndex]) {
                newMapsData[mapIndex] = { map: '', score1: 0, score2: 0 };
            }
            newMapsData[mapIndex] = {
                ...newMapsData[mapIndex],
                [team === 1 ? 'score1' : 'score2']: score
            };
            return { ...prev, maps_data: newMapsData };
        });
    };

    const handleMapNameChange = (mapIndex, mapName) => {
        setMatchResultData(prev => {
            const newMapsData = [...(prev.maps_data || [])];
            if (!newMapsData[mapIndex]) {
                newMapsData[mapIndex] = { map: '', score1: 0, score2: 0 };
            }
            newMapsData[mapIndex] = {
                ...newMapsData[mapIndex],
                map: mapName
            };
            return { ...prev, maps_data: newMapsData };
        });
    };

    const addMap = () => {
        setMatchResultData(prev => ({
            ...prev,
            maps_data: [
                ...(prev.maps_data || []),
                { map: '', score1: 0, score2: 0 }
            ]
        }));
    };

    const removeMap = (mapIndex) => {
        setMatchResultData(prev => {
            const newMapsData = prev.maps_data?.filter((_, index) => index !== mapIndex) || [];
            return { ...prev, maps_data: newMapsData };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave();
    };

    const isCS2 = isCounterStrike2(tournament?.game);
    const mapsData = matchResultData.maps_data || [];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content match-result-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>✏️ Редактирование результата матча</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="match-result-form">
                    {/* Информация о матче */}
                    <div className="match-info">
                        <div className="teams-display">
                            <div className="team-display">
                                <span className="team-name">{match.team1_name || 'Команда 1'}</span>
                            </div>
                            <div className="vs-separator">VS</div>
                            <div className="team-display">
                                <span className="team-name">{match.team2_name || 'Команда 2'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Общий счет */}
                    <div className="total-score-section">
                        <h4>Общий счет матча</h4>
                        <div className="score-inputs">
                            <div className="score-input-group">
                                <label>{match.team1_name || 'Команда 1'}</label>
                                <input
                                    type="number"
                                    value={matchResultData.score1}
                                    onChange={(e) => handleScoreChange(1, e.target.value)}
                                    min="0"
                                    max="999"
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="score-separator">:</div>
                            <div className="score-input-group">
                                <label>{match.team2_name || 'Команда 2'}</label>
                                <input
                                    type="number"
                                    value={matchResultData.score2}
                                    onChange={(e) => handleScoreChange(2, e.target.value)}
                                    min="0"
                                    max="999"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Карты (для CS2 и подобных игр) */}
                    {isCS2 && (
                        <div className="maps-section">
                            <div className="maps-header">
                                <h4>Результаты по картам</h4>
                                <button
                                    type="button"
                                    className="add-map-btn"
                                    onClick={addMap}
                                    disabled={isLoading}
                                >
                                    ➕ Добавить карту
                                </button>
                            </div>

                            {mapsData.length === 0 && (
                                <div className="no-maps-message">
                                    <p>Карты не добавлены</p>
                                    <span>Нажмите "Добавить карту" для детализации результата</span>
                                </div>
                            )}

                            {mapsData.map((mapData, index) => (
                                <div key={index} className="map-entry">
                                    <div className="map-header">
                                        <div className="map-select-container">
                                            <label>Карта {index + 1}:</label>
                                            <select
                                                value={mapData.map || ''}
                                                onChange={(e) => handleMapNameChange(index, e.target.value)}
                                                disabled={isLoading}
                                                className="map-select"
                                            >
                                                <option value="">Выберите карту</option>
                                                {availableMaps.map(map => (
                                                    <option key={map} value={map}>{map}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            className="remove-map-btn"
                                            onClick={() => removeMap(index)}
                                            disabled={isLoading}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                    <div className="map-scores">
                                        <div className="map-score-input">
                                            <label>{match.team1_name || 'Команда 1'}</label>
                                            <input
                                                type="number"
                                                value={mapData.score1 || 0}
                                                onChange={(e) => handleMapScoreChange(index, 1, e.target.value)}
                                                min="0"
                                                max="50"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div className="map-score-separator">:</div>
                                        <div className="map-score-input">
                                            <label>{match.team2_name || 'Команда 2'}</label>
                                            <input
                                                type="number"
                                                value={mapData.score2 || 0}
                                                onChange={(e) => handleMapScoreChange(index, 2, e.target.value)}
                                                min="0"
                                                max="50"
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Действия */}
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
                            className="save-btn"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Сохранение...' : 'Сохранить результат'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MatchResultModal; 