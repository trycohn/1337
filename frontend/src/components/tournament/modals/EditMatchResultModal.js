import React, { useState, useEffect } from 'react';
import './EditMatchResultModal.css';

/**
 * ✏️ EditMatchResultModal - Модальное окно редактирования завершенного матча
 * Позволяет редактировать только счет на картах для завершенных матчей
 * @version 1.0
 */
const EditMatchResultModal = ({
    isOpen,
    onClose,
    matchData,
    onSave,
    match
}) => {
    const [editedMapsData, setEditedMapsData] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && matchData) {
            // Инициализируем данные карт для редактирования
            setEditedMapsData(matchData.maps_data || []);
        }
    }, [isOpen, matchData]);

    if (!isOpen || !matchData) return null;

    const handleMapScoreChange = (mapIndex, field, value) => {
        const newMapsData = [...editedMapsData];
        if (!newMapsData[mapIndex]) {
            newMapsData[mapIndex] = {};
        }
        newMapsData[mapIndex][field] = parseInt(value) || 0;
        setEditedMapsData(newMapsData);
    };

    const handleSave = async () => {
        setIsSaving(true);
        
        try {
            // Пересчитываем общий счет на основе карт
            let score1 = 0;
            let score2 = 0;
            
            if (editedMapsData.length > 1) {
                // Если несколько карт, считаем выигранные карты
                editedMapsData.forEach(map => {
                    const m1 = parseInt(map.score1 || map.team1_score || 0);
                    const m2 = parseInt(map.score2 || map.team2_score || 0);
                    if (m1 > m2) score1++;
                    else if (m2 > m1) score2++;
                });
            } else if (editedMapsData.length === 1) {
                // Если одна карта, используем её счет
                score1 = parseInt(editedMapsData[0].score1 || editedMapsData[0].team1_score || 0);
                score2 = parseInt(editedMapsData[0].score2 || editedMapsData[0].team2_score || 0);
            }

            // Определяем победителя
            let winnerId = matchData.winner_team_id;
            if (score1 > score2) {
                winnerId = match.team1_id;
            } else if (score2 > score1) {
                winnerId = match.team2_id;
            }

            const updatedData = {
                maps_data: editedMapsData,
                score1,
                score2,
                winner_team_id: winnerId
            };

            await onSave(updatedData);
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content edit-match-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>✏️ Редактирование матча</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="edit-match-info">
                        <p className="info-text">
                            Вы можете изменить счет на картах. Общий результат будет пересчитан автоматически.
                        </p>
                        <p className="warning-text">
                            ⚠️ Если уже сыграны следующие матчи с участием команд из этого матча, 
                            изменение победителя будет запрещено.
                        </p>
                    </div>

                    <div className="maps-editor">
                        <h3>Карты матча:</h3>
                        
                        {editedMapsData.length === 0 ? (
                            <p className="no-maps-text">Нет данных о картах для редактирования</p>
                        ) : (
                            <div className="maps-list">
                                {editedMapsData.map((map, index) => (
                                    <div key={index} className="map-editor-row">
                                        <div className="map-name">
                                            {map.map_name || map.map || map.name || `Карта ${index + 1}`}
                                        </div>
                                        <div className="map-score-inputs">
                                            <div className="score-input-group">
                                                <label>{match.team1_name || 'Команда 1'}</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={map.score1 !== undefined ? map.score1 : (map.team1_score || 0)}
                                                    onChange={e => handleMapScoreChange(index, 'score1', e.target.value)}
                                                    className="score-input"
                                                />
                                            </div>
                                            <span className="score-separator">:</span>
                                            <div className="score-input-group">
                                                <label>{match.team2_name || 'Команда 2'}</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={map.score2 !== undefined ? map.score2 : (map.team2_score || 0)}
                                                    onChange={e => handleMapScoreChange(index, 'score2', e.target.value)}
                                                    className="score-input"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="calculated-result">
                        <h4>Итоговый результат:</h4>
                        <div className="result-preview">
                            {(() => {
                                let score1 = 0;
                                let score2 = 0;
                                
                                if (editedMapsData.length > 1) {
                                    editedMapsData.forEach(map => {
                                        const m1 = parseInt(map.score1 || map.team1_score || 0);
                                        const m2 = parseInt(map.score2 || map.team2_score || 0);
                                        if (m1 > m2) score1++;
                                        else if (m2 > m1) score2++;
                                    });
                                } else if (editedMapsData.length === 1) {
                                    score1 = parseInt(editedMapsData[0].score1 || editedMapsData[0].team1_score || 0);
                                    score2 = parseInt(editedMapsData[0].score2 || editedMapsData[0].team2_score || 0);
                                }

                                const winner = score1 > score2 ? match.team1_name : 
                                             score2 > score1 ? match.team2_name : 
                                             'Ничья';

                                return (
                                    <>
                                        <span className="result-score">{score1} : {score2}</span>
                                        <span className="result-winner">
                                            {winner !== 'Ничья' && `Победитель: ${winner}`}
                                            {winner === 'Ничья' && 'Ничья'}
                                        </span>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button 
                        className="btn btn-secondary" 
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        Отмена
                    </button>
                    <button 
                        className="btn btn-primary" 
                        onClick={handleSave}
                        disabled={isSaving || editedMapsData.length === 0}
                    >
                        {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditMatchResultModal;

