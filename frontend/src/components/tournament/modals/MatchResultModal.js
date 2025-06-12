import React, { useState, useEffect, useCallback } from 'react';
import { isCounterStrike2, getGameMaps } from '../../../utils/mapHelpers';
import './MatchResultModal.css';

/**
 * MatchResultModal v3.0 - Улучшенное модальное окно редактирования результатов
 * 
 * @version 3.0 (Вариант 3 с расширенной валидацией и UX)
 * @features Валидация, анимации, обработка ошибок, поддержка карт CS2
 */
const MatchResultModal = ({
    isOpen,
    onClose,
    selectedMatch,        // 🔧 ИСПРАВЛЕНО: было match, теперь selectedMatch
    matchResultData,      // 🔧 ИСПРАВЛЕНО: используется из modals hook
    setMatchResultData,   // 🔧 ИСПРАВЛЕНО: используется из modals hook
    onSave,
    isLoading = false,
    tournament = null     // 🔧 ИСПРАВЛЕНО: добавлено для совместимости
}) => {
    const [availableMaps, setAvailableMaps] = useState([]);
    const [validationErrors, setValidationErrors] = useState({});
    const [hasChanges, setHasChanges] = useState(false);

    // 🎯 УЛУЧШЕНИЕ ВАРИАНТА 3: Автоопределение турнира из localStorage или контекста
    const getTournamentGame = useCallback(() => {
        // Сначала пытаемся получить из пропса tournament
        if (tournament?.game) {
            return tournament.game;
        }
        
        // Затем из localStorage (кэш турнира)
        try {
            const tournamentData = localStorage.getItem('currentTournament');
            if (tournamentData) {
                const parsedTournament = JSON.parse(tournamentData);
                return parsedTournament.game;
            }
        } catch (error) {
            console.warn('Ошибка получения турнира из localStorage:', error);
        }
        
        // Fallback: предполагаем CS2 если selectedMatch содержит указание на карты
        if (selectedMatch?.maps_data || selectedMatch?.game === 'Counter-Strike 2') {
            return 'Counter-Strike 2';
        }
        
        return null;
    }, [tournament, selectedMatch]);

    // 🎯 ЗАГРУЗКА ДОСТУПНЫХ КАРТ
    useEffect(() => {
        const gameType = getTournamentGame();
        if (gameType) {
            const maps = getGameMaps(gameType);
            setAvailableMaps(maps);
            console.log('🗺️ Загружены карты для игры:', gameType, '- карт:', maps.length);
        }
    }, [getTournamentGame]);

    // 🎯 ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ
    useEffect(() => {
        if (matchResultData && selectedMatch) {
            const hasScoreChanges = 
                matchResultData.score1 !== (selectedMatch.score1 || 0) ||
                matchResultData.score2 !== (selectedMatch.score2 || 0);
            
            const hasMapsChanges = 
                JSON.stringify(matchResultData.maps_data || []) !== 
                JSON.stringify(selectedMatch.maps_data || []);
            
            setHasChanges(hasScoreChanges || hasMapsChanges);
        }
    }, [matchResultData, selectedMatch]);

    // 🎯 ВАЛИДАЦИЯ РЕЗУЛЬТАТОВ (ВАРИАНТ 3)
    const validateResults = useCallback(() => {
        const errors = {};
        
        if (!matchResultData) {
            errors.general = 'Отсутствуют данные матча';
            return errors;
        }

        // Валидация общего счета
        const score1 = parseInt(matchResultData.score1) || 0;
        const score2 = parseInt(matchResultData.score2) || 0;
        
        if (score1 < 0 || score2 < 0) {
            errors.scores = 'Счет не может быть отрицательным';
        }
        
        if (score1 === 0 && score2 === 0) {
            errors.scores = 'Счет не может быть 0:0';
        }

        // Валидация карт для CS2
        const isCS2 = isCounterStrike2(getTournamentGame());
        if (isCS2 && matchResultData.maps_data && matchResultData.maps_data.length > 0) {
            matchResultData.maps_data.forEach((mapData, index) => {
                if (!mapData.map || mapData.map.trim() === '') {
                    errors[`map_${index}_name`] = `Выберите название для карты ${index + 1}`;
                }
                
                const mapScore1 = parseInt(mapData.score1) || 0;
                const mapScore2 = parseInt(mapData.score2) || 0;
                
                if (mapScore1 < 0 || mapScore2 < 0) {
                    errors[`map_${index}_scores`] = `Счет карты ${index + 1} не может быть отрицательным`;
                }
                
                // Проверка логичности счета для CS2 (обычно до 16 раундов)
                if (mapScore1 > 50 || mapScore2 > 50) {
                    errors[`map_${index}_scores`] = `Счет карты ${index + 1} слишком большой (макс. 50)`;
                }
            });
            
            // Проверка соответствия общего счета картам
            const mapsWonByTeam1 = matchResultData.maps_data.filter(map => 
                (parseInt(map.score1) || 0) > (parseInt(map.score2) || 0)
            ).length;
            
            const mapsWonByTeam2 = matchResultData.maps_data.filter(map => 
                (parseInt(map.score2) || 0) > (parseInt(map.score1) || 0)
            ).length;
            
            if (mapsWonByTeam1 !== score1 || mapsWonByTeam2 !== score2) {
                errors.consistency = `Общий счет (${score1}:${score2}) не соответствует результатам по картам (${mapsWonByTeam1}:${mapsWonByTeam2})`;
            }
        }

        return errors;
    }, [matchResultData, getTournamentGame]);

    // 🎯 ОБНОВЛЕНИЕ ВАЛИДАЦИИ
    useEffect(() => {
        if (matchResultData) {
            const errors = validateResults();
            setValidationErrors(errors);
        }
    }, [matchResultData, validateResults]);

    if (!isOpen || !selectedMatch) return null;

    // 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
    const handleScoreChange = (team, value) => {
        const score = Math.max(0, parseInt(value) || 0);
        setMatchResultData(prev => ({
            ...prev,
            [team === 1 ? 'score1' : 'score2']: score
        }));
    };

    const handleMapScoreChange = (mapIndex, team, value) => {
        const score = Math.max(0, Math.min(50, parseInt(value) || 0)); // Ограничиваем 0-50
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
        const mapsCount = (matchResultData.maps_data || []).length;
        if (mapsCount >= 7) { // Максимум 7 карт (BO7)
            return;
        }
        
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
        
        const errors = validateResults();
        if (Object.keys(errors).length > 0) {
            console.warn('🚫 Валидация не прошла:', errors);
            return;
        }
        
        onSave();
    };

    // 🎯 ЗАКРЫТИЕ С ПОДТВЕРЖДЕНИЕМ ПРИ НАЛИЧИИ ИЗМЕНЕНИЙ
    const handleClose = () => {
        if (hasChanges && !isLoading) {
            const confirmed = window.confirm(
                '⚠️ У вас есть несохраненные изменения. Закрыть без сохранения?'
            );
            if (!confirmed) return;
        }
        onClose();
    };

    const isCS2 = isCounterStrike2(getTournamentGame());
    const mapsData = matchResultData.maps_data || [];
    const hasValidationErrors = Object.keys(validationErrors).length > 0;

    return (
        <div className="modal-overlay enhanced-match-result-overlay" onClick={handleClose}>
            <div className="modal-content match-result-modal enhanced-match-result-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>
                        ✏️ Редактирование результата матча
                        {hasChanges && <span className="changes-indicator">*</span>}
                    </h3>
                    <button className="close-btn" onClick={handleClose} title="Закрыть">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="match-result-form">
                    {/* Информация о матче */}
                    <div className="match-info">
                        <div className="teams-display">
                            <div className="team-display">
                                <span className="team-name">{selectedMatch.team1_name || 'Команда 1'}</span>
                            </div>
                            <div className="vs-separator">VS</div>
                            <div className="team-display">
                                <span className="team-name">{selectedMatch.team2_name || 'Команда 2'}</span>
                            </div>
                        </div>
                        
                        {/* Метаинформация о матче */}
                        <div className="match-meta">
                            {selectedMatch.round && (
                                <span className="match-round">Раунд {selectedMatch.round}</span>
                            )}
                            {selectedMatch.is_third_place_match && (
                                <span className="match-type-badge">🥉 Матч за 3-е место</span>
                            )}
                            {isCS2 && (
                                <span className="game-badge">🗺️ Counter-Strike 2</span>
                            )}
                        </div>
                    </div>

                    {/* Ошибки валидации */}
                    {hasValidationErrors && (
                        <div className="validation-errors">
                            {Object.entries(validationErrors).map(([key, error]) => (
                                <div key={key} className="validation-error">
                                    ⚠️ {error}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Общий счет */}
                    <div className="total-score-section">
                        <h4>Общий счет матча</h4>
                        <div className="score-inputs">
                            <div className="score-input-group">
                                <label>{selectedMatch.team1_name || 'Команда 1'}</label>
                                <input
                                    type="number"
                                    value={matchResultData.score1 || 0}
                                    onChange={(e) => handleScoreChange(1, e.target.value)}
                                    min="0"
                                    max="999"
                                    disabled={isLoading}
                                    className={validationErrors.scores ? 'error' : ''}
                                />
                            </div>
                            <div className="score-separator">:</div>
                            <div className="score-input-group">
                                <label>{selectedMatch.team2_name || 'Команда 2'}</label>
                                <input
                                    type="number"
                                    value={matchResultData.score2 || 0}
                                    onChange={(e) => handleScoreChange(2, e.target.value)}
                                    min="0"
                                    max="999"
                                    disabled={isLoading}
                                    className={validationErrors.scores ? 'error' : ''}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Карты (для CS2 и подобных игр) */}
                    {isCS2 && (
                        <div className="maps-section">
                            <div className="maps-header">
                                <h4>
                                    Результаты по картам
                                    {mapsData.length > 0 && (
                                        <span className="maps-count">({mapsData.length})</span>
                                    )}
                                </h4>
                                <button
                                    type="button"
                                    className="add-map-btn"
                                    onClick={addMap}
                                    disabled={isLoading || mapsData.length >= 7}
                                    title={mapsData.length >= 7 ? 'Максимум 7 карт' : 'Добавить карту'}
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

                            <div className="maps-list">
                                {mapsData.map((mapData, index) => (
                                    <div key={index} className="map-entry">
                                        <div className="map-header">
                                            <div className="map-select-container">
                                                <label>Карта {index + 1}:</label>
                                                <select
                                                    value={mapData.map || ''}
                                                    onChange={(e) => handleMapNameChange(index, e.target.value)}
                                                    disabled={isLoading}
                                                    className={`map-select ${validationErrors[`map_${index}_name`] ? 'error' : ''}`}
                                                    required={mapsData.length > 0}
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
                                                title="Удалить карту"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        
                                        <div className="map-scores">
                                            <div className="map-score-input">
                                                <label>{selectedMatch.team1_name || 'Команда 1'}</label>
                                                <input
                                                    type="number"
                                                    value={mapData.score1 || 0}
                                                    onChange={(e) => handleMapScoreChange(index, 1, e.target.value)}
                                                    min="0"
                                                    max="50"
                                                    disabled={isLoading}
                                                    className={validationErrors[`map_${index}_scores`] ? 'error' : ''}
                                                />
                                            </div>
                                            <div className="map-score-separator">:</div>
                                            <div className="map-score-input">
                                                <label>{selectedMatch.team2_name || 'Команда 2'}</label>
                                                <input
                                                    type="number"
                                                    value={mapData.score2 || 0}
                                                    onChange={(e) => handleMapScoreChange(index, 2, e.target.value)}
                                                    min="0"
                                                    max="50"
                                                    disabled={isLoading}
                                                    className={validationErrors[`map_${index}_scores`] ? 'error' : ''}
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Победитель карты */}
                                        {mapData.score1 !== mapData.score2 && (mapData.score1 > 0 || mapData.score2 > 0) && (
                                            <div className="map-winner">
                                                🏆 Победитель: {
                                                    (parseInt(mapData.score1) || 0) > (parseInt(mapData.score2) || 0) 
                                                        ? (selectedMatch.team1_name || 'Команда 1')
                                                        : (selectedMatch.team2_name || 'Команда 2')
                                                }
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Автосчет результата по картам */}
                            {mapsData.length > 0 && (
                                <div className="maps-summary">
                                    <h5>📊 Сводка по картам</h5>
                                    <div className="maps-summary-content">
                                        <div className="maps-won">
                                            <span className="team-maps-won">
                                                {selectedMatch.team1_name || 'Команда 1'}: {
                                                    mapsData.filter(map => 
                                                        (parseInt(map.score1) || 0) > (parseInt(map.score2) || 0)
                                                    ).length
                                                } карт
                                            </span>
                                            <span className="team-maps-won">
                                                {selectedMatch.team2_name || 'Команда 2'}: {
                                                    mapsData.filter(map => 
                                                        (parseInt(map.score2) || 0) > (parseInt(map.score1) || 0)
                                                    ).length
                                                } карт
                                            </span>
                                        </div>
                                        
                                        {validationErrors.consistency && (
                                            <div className="consistency-warning">
                                                ⚠️ {validationErrors.consistency}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Действия */}
                    <div className="modal-actions">
                        <button 
                            type="button" 
                            className="cancel-btn" 
                            onClick={handleClose}
                            disabled={isLoading}
                        >
                            Отмена
                        </button>
                        <button 
                            type="submit" 
                            className="save-btn"
                            disabled={isLoading || hasValidationErrors}
                            title={hasValidationErrors ? 'Исправьте ошибки перед сохранением' : 'Сохранить результат'}
                        >
                            {isLoading ? (
                                <>
                                    <span className="loading-spinner">⏳</span>
                                    Сохранение...
                                </>
                            ) : (
                                '💾 Сохранить'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MatchResultModal; 