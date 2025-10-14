// 🗺️ MapSelectionBoard - Компонент доски выбора карт
import React, { useMemo } from 'react';
import './MapSelectionBoard.css';

// Карты CS2
const MAP_INFO = {
    'de_mirage':   { displayName: 'Mirage',   thumbnail: '/images/maps/mirage.jpg' },
    'de_inferno':  { displayName: 'Inferno',  thumbnail: '/images/maps/inferno.jpg' },
    'de_dust2':    { displayName: 'Dust II',  thumbnail: '/images/maps/dust2.jpg' },
    'de_nuke':     { displayName: 'Nuke',     thumbnail: '/images/maps/nuke.jpg' },
    'de_ancient':  { displayName: 'Ancient',  thumbnail: '/images/maps/ancient.jpg' },
    'de_vertigo':  { displayName: 'Vertigo',  thumbnail: '/images/maps/vertigo.jpg' },
    'de_anubis':   { displayName: 'Anubis',   thumbnail: '/images/maps/anubis.jpg' },
    'de_overpass': { displayName: 'Overpass', thumbnail: '/images/maps/overpass.jpg' },
    'de_train':    { displayName: 'Train',    thumbnail: '/images/maps/train.jpg' }
};

function MapSelectionBoard({ 
    maps, 
    selections, 
    currentTurn, 
    myTeamId, 
    format, 
    status, 
    onMapAction,
    teamNames = {},
    isCaptain = false
}) {
    // 🎯 Определение последовательности действий
    const actionSequence = useMemo(() => {
        const sequences = {
            'bo1': ['ban', 'ban', 'ban', 'ban', 'ban', 'ban', 'pick'],
            'bo3': ['ban', 'ban', 'pick', 'pick', 'ban', 'ban', 'pick'],
            'bo5': ['pick', 'pick', 'ban', 'ban', 'pick', 'pick', 'pick']
        };
        return sequences[format] || [];
    }, [format]);

    // 🔍 Получение информации о выборе карты
    const getMapSelection = (mapName) => {
        return selections.find(s => s.map_name === mapName);
    };

    // 🎨 Определение стиля карты
    const getMapStyle = (mapName) => {
        const selection = getMapSelection(mapName);
        if (!selection) return '';
        
        if (selection.action_type === 'pick') {
            return 'map-picked';
        } else if (selection.action_type === 'ban') {
            return 'map-banned';
        }
        return '';
    };

    // 🔄 Определение текущего действия
    const currentAction = useMemo(() => {
        const actionIndex = selections.length;
        if (actionIndex >= actionSequence.length) {
            return null;
        }
        return actionSequence[actionIndex];
    }, [selections, actionSequence]);

    // 🎯 Проверка, можем ли мы сделать действие
    const canMakeAction = useMemo(() => {
        return status === 'picking' && 
               currentTurn === myTeamId && 
               currentAction !== null &&
               isCaptain === true;
    }, [status, currentTurn, myTeamId, currentAction, isCaptain]);

    // 🏁 Проверка, завершен ли выбор
    const isSelectionComplete = useMemo(() => {
        return selections.length >= actionSequence.length || status === 'completed';
    }, [selections, actionSequence, status]);

    // 🗺️ Обработка клика по карте
    const handleMapClick = (mapName, action) => {
        if (!canMakeAction) return;
        
        const selection = getMapSelection(mapName);
        if (selection) return; // Карта уже выбрана/забанена
        
        if (action !== currentAction) return; // Неправильное действие
        
        onMapAction(mapName, action);
    };

    return (
        <div className="lobby-map-selection-board">
            <div className="lobby-selection-header">
                <h3>Выбор карт - {format.toUpperCase()}</h3>
                {currentAction && !isSelectionComplete && (
                    <div className="lobby-current-action">
                        <p>Текущее действие: 
                            <span className={`lobby-action-type ${currentAction}`}>
                                {currentAction === 'pick' ? '✅ PICK' : '❌ BAN'}
                            </span>
                        </p>
                        {canMakeAction ? (
                            <p className="lobby-your-turn">Ваш ход!</p>
                        ) : (
                            <p className="lobby-waiting">Ожидание хода соперника...</p>
                        )}
                    </div>
                )}
                {isSelectionComplete && (
                    <p className="lobby-selection-complete">Выбор карт завершен!</p>
                )}
            </div>

            <div className="lobby-maps-grid">
                {maps.map((mapData) => {
                    const mapName = mapData.map_name;
                    const mapInfo = MAP_INFO[mapName] || { 
                        displayName: mapName, 
                        thumbnail: '/images/maps/mirage.jpg' 
                    };
                    const selection = getMapSelection(mapName);
                    const mapStyle = getMapStyle(mapName);
                    const isSelectable = canMakeAction && !selection;

                    return (
                        <div 
                            key={mapName}
                            className={`lobby-map-item ${mapStyle} ${isSelectable ? 'selectable' : ''}`}
                        >
                            <div className="lobby-map-thumbnail">
                                <img 
                                    src={mapInfo.thumbnail} 
                                    alt={mapInfo.displayName}
                                    onError={(e) => {
                                        e.target.src = '/images/maps/mirage.jpg';
                                    }}
                                />
                                {selection && (
                                    <div className={`lobby-selection-overlay ${selection.action_type}`}>
                                        {selection.action_type === 'pick' ? '✅' : '❌'}
                                    </div>
                                )}
                            </div>
                            
                            <div className="lobby-map-name">
                                {mapInfo.displayName}
                            </div>
                            
                            {isSelectable && currentAction && (
                                <div className="lobby-map-actions">
                                    {currentAction === 'pick' ? (
                                        <button 
                                            className="lobby-action-button pick"
                                            onClick={() => handleMapClick(mapName, 'pick')}
                                        >
                                            Pick
                                        </button>
                                    ) : (
                                        <button 
                                            className="lobby-action-button ban"
                                            onClick={() => handleMapClick(mapName, 'ban')}
                                        >
                                            Ban
                                        </button>
                                    )}
                                </div>
                            )}
                            
                            {selection && (
                                <div className="lobby-selection-info">
                                    <span className={`lobby-selection-badge ${selection.action_type}`}>
                                        {selection.action_type.toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* История выборов */}
            {selections.length > 0 && (
                <div className="lobby-selection-history">
                    <h4>📜 История выборов:</h4>
                    <div className="lobby-history-list">
                        {selections.map((selection, index) => {
                            const mapInfo = MAP_INFO[selection.map_name] || { 
                                displayName: selection.map_name 
                            };
                            const actorName = teamNames?.[selection.team_id] || 'Команда';
                            const actionText = selection.action_type;
                            return (
                                <div key={index} className="lobby-history-item">
                                    <span className="lobby-history-index">{index + 1}.</span>
                                    <span className={`lobby-history-action ${selection.action_type}`}>
                                        {selection.action_type === 'pick' ? '✅' : '❌'}
                                    </span>
                                    <span className="lobby-history-map">{`${actorName} ${actionText} ${mapInfo.displayName}`}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Выбранные карты для матча */}
            {isSelectionComplete && (
                <div className="lobby-selected-maps">
                    <h4>🎮 Карты для матча:</h4>
                    <div className="lobby-picked-maps-list">
                        {(() => {
                            const picked = selections.filter(s => s.action_type === 'pick');
                            return picked.map((selection, index) => {
                                const mapInfo = MAP_INFO[selection.map_name] || { displayName: selection.map_name };
                                const opponentTeamId = selection.team_id && teamNames
                                    ? (Object.keys(teamNames).map(Number).find(id => id !== selection.team_id) || null)
                                    : null;
                                const opponentName = opponentTeamId ? teamNames[opponentTeamId] : 'Соперник';
                                return (
                                    <div key={index} className="lobby-picked-map">
                                        <span className="lobby-map-number">Карта {index + 1}:</span>
                                        <span className="lobby-map-name">{mapInfo.displayName}</span>
                                        <span className="lobby-map-side-chooser"> — Сторону выбирает: {opponentName}</span>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MapSelectionBoard; 