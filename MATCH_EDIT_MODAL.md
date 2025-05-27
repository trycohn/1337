# Модальное окно для редактирования результатов матча

Добавить этот код в файл `frontend/src/components/TournamentDetails.js` после модального окна просмотра результатов матча (после строки 3444):

```jsx
{/* Модальное окно для редактирования результатов матча */}
{isEditingMatch && editingMatchData && (
    <div className="modal match-edit-modal" onClick={cancelEditingMatch}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <span className="close" onClick={cancelEditingMatch}>&times;</span>
            <h4>Редактирование результатов матча</h4>
            
            <div className="match-teams">
                <div className="team-info">
                    <h5>{editingMatchData.team1.name}</h5>
                    <div className="team-score">{editingScores.team1}</div>
                </div>
                
                <div className="match-score">vs</div>
                
                <div className="team-info">
                    <h5>{editingMatchData.team2.name}</h5>
                    <div className="team-score">{editingScores.team2}</div>
                </div>
            </div>

            {/* Выбор победителя */}
            <div className="winner-selection">
                <h4>Выберите победителя:</h4>
                <div className="winner-options">
                    <label className="winner-option">
                        <input
                            type="radio"
                            name="winner"
                            value={editingMatchData.team1.id}
                            checked={editingWinner === editingMatchData.team1.id}
                            onChange={(e) => setEditingWinner(parseInt(e.target.value))}
                        />
                        <span>{editingMatchData.team1.name}</span>
                    </label>
                    <label className="winner-option">
                        <input
                            type="radio"
                            name="winner"
                            value={editingMatchData.team2.id}
                            checked={editingWinner === editingMatchData.team2.id}
                            onChange={(e) => setEditingWinner(parseInt(e.target.value))}
                        />
                        <span>{editingMatchData.team2.name}</span>
                    </label>
                </div>
            </div>

            {/* Редактирование карт для игр, которые их поддерживают */}
            {tournament && gameHasMaps(tournament.game) ? (
                <div className="maps-container">
                    <h4>Карты матча</h4>
                    {editingMaps.map((mapData, index) => (
                        <div key={index} className="map-entry">
                            <div className="map-select-container">
                                <select 
                                    value={mapData.map}
                                    onChange={(e) => updateEditingMapSelection(index, e.target.value)}
                                    className="map-select"
                                >
                                    {getGameMaps(tournament.game).map(map => (
                                        <option key={map.name} value={map.name}>{map.name}</option>
                                    ))}
                                </select>
                                {editingMaps.length > 1 && (
                                    <button 
                                        onClick={() => removeEditingMap(index)}
                                        className="remove-map-btn"
                                        title="Удалить карту"
                                    >
                                        ✖
                                    </button>
                                )}
                            </div>
                            <div className="map-scores">
                                <div className="score-container">
                                    <span className="participant-name">
                                        {editingMatchData.team1.name}
                                    </span>
                                    <input
                                        type="number"
                                        value={mapData.score1}
                                        onChange={(e) => updateEditingMapScore(index, 1, Number(e.target.value))}
                                        className="score-input"
                                        min="0"
                                    />
                                </div>
                                <div className="score-container">
                                    <span className="participant-name">
                                        {editingMatchData.team2.name}
                                    </span>
                                    <input
                                        type="number"
                                        value={mapData.score2}
                                        onChange={(e) => updateEditingMapScore(index, 2, Number(e.target.value))}
                                        className="score-input"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {editingMaps.length < 7 && (
                        <button 
                            onClick={addEditingMap} 
                            className="add-map-btn"
                            title="Добавить карту"
                        >
                            + Добавить карту
                        </button>
                    )}
                    
                    {editingMaps.length > 1 && (
                        <div className="total-score">
                            <h4>Общий счет</h4>
                            <div className="score-summary">
                                <div className="team-score">
                                    <span className="team-name">
                                        {editingMatchData.team1.name}:
                                    </span>
                                    <span className="score-value">
                                        {editingMaps.filter(m => parseInt(m.score1) > parseInt(m.score2)).length}
                                    </span>
                                </div>
                                <div className="team-score">
                                    <span className="team-name">
                                        {editingMatchData.team2.name}:
                                    </span>
                                    <span className="score-value">
                                        {editingMaps.filter(m => parseInt(m.score2) > parseInt(m.score1)).length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="score-inputs">
                    <h4>Счет матча</h4>
                    <div className="score-container">
                        <span className="participant-name">
                            {editingMatchData.team1.name}
                        </span>
                        <input
                            type="number"
                            value={editingScores.team1}
                            onChange={(e) => setEditingScores({ ...editingScores, team1: Number(e.target.value) })}
                            className="score-input"
                            min="0"
                        />
                    </div>
                    <div className="score-container">
                        <span className="participant-name">
                            {editingMatchData.team2.name}
                        </span>
                        <input
                            type="number"
                            value={editingScores.team2}
                            onChange={(e) => setEditingScores({ ...editingScores, team2: Number(e.target.value) })}
                            className="score-input"
                            min="0"
                        />
                    </div>
                </div>
            )}
            
            <div className="modal-actions">
                <button className="cancel-btn" onClick={cancelEditingMatch}>
                    Отмена
                </button>
                <button 
                    className="confirm-winner"
                    onClick={saveMatchEdit}
                    disabled={!editingWinner}
                >
                    Сохранить изменения
                </button>
            </div>
        </div>
    </div>
)}
```

## Инструкции по добавлению

1. Откройте файл `frontend/src/components/TournamentDetails.js`
2. Найдите строку 3444 (после закрытия модального окна просмотра результатов)
3. Добавьте код модального окна редактирования перед строкой `{message && (`
4. Сохраните файл
5. Пересоберите frontend: `npm run build` 