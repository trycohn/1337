// 👁️ ObserverZone - Зона наблюдателей (админы, стримеры, менеджеры)
import React from 'react';
import './ObserverZone.css';

function ObserverZone({ 
    observers = [], 
    unassignedPlayers = [], // для custom лобби
    showUnassigned = false,
    onDragStart = null, // для drag-drop в custom
    children // для дополнительных элементов управления
}) {
    return (
        <div className="observer-zone">
            <div className="observer-zone-header">
                <h3>👁️ Наблюдатели</h3>
                <span className="observer-count">{observers.length}</span>
            </div>
            
            {observers.length > 0 ? (
                <div className="observer-list">
                    {observers.map((observer, idx) => (
                        <div key={observer.id || idx} className="observer-item">
                            <div className="observer-avatar">
                                <img 
                                    src={observer.avatar || '/default-avatar.png'} 
                                    alt={observer.username || observer.display_name}
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                            </div>
                            <div className="observer-info">
                                <span className="observer-name">
                                    {observer.username || observer.display_name}
                                </span>
                                {observer.role && (
                                    <span className="observer-role">
                                        {observer.role === 'admin' && '🛡️ Админ'}
                                        {observer.role === 'streamer' && '📹 Стример'}
                                        {observer.role === 'manager' && '👔 Менеджер'}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="observer-empty">
                    <span>Нет наблюдателей</span>
                </div>
            )}
            
            {showUnassigned && unassignedPlayers.length > 0 && (
                <div className="unassigned-section">
                    <div className="unassigned-header">
                        <h4>Не в команде</h4>
                        <span className="unassigned-hint">
                            Перетащите игроков в команды
                        </span>
                    </div>
                    <div className="unassigned-list">
                        {unassignedPlayers.map((player, idx) => (
                            <div 
                                key={player.id || idx} 
                                className="unassigned-player"
                                draggable={!!onDragStart}
                                onDragStart={(e) => onDragStart && onDragStart(e, player)}
                            >
                                <div className="player-avatar">
                                    <img 
                                        src={player.avatar || '/default-avatar.png'} 
                                        alt={player.username || player.display_name}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                <div className="player-info">
                                    <span className="player-name">
                                        {player.username || player.display_name}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {children}
        </div>
    );
}

export default ObserverZone;

