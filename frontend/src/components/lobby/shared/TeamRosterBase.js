// 👥 TeamRosterBase - Базовый компонент отображения состава команды
import React from 'react';
import './TeamRosterBase.css';

function TeamRosterBase({ 
    teamName,
    players = [],
    teamNumber = 1,
    showReady = false,
    isReady = false,
    canToggleReady = false,
    onToggleReady = null,
    emptySlots = 0,
    children // для кастомизации (например, drag-drop)
}) {
    return (
        <div className={`team-roster-base team-${teamNumber}`}>
            <div className="team-roster-header">
                <h3 className="team-roster-name">{teamName}</h3>
                {showReady && (
                    <div className={`team-roster-ready-indicator ${isReady ? 'ready' : 'not-ready'}`}>
                        <span className="ready-icon">{isReady ? '✅' : '❌'}</span>
                        <span className="ready-text">{isReady ? 'Готова' : 'Не готова'}</span>
                    </div>
                )}
            </div>
            
            <div className="team-roster-players">
                {players.map((player, idx) => (
                    <div key={player.id || idx} className="team-roster-player">
                        <div className="player-avatar">
                            <img 
                                src={player.avatar || '/default-avatar.png'} 
                                alt={player.username || player.display_name}
                                onError={(e) => { e.target.src = '/default-avatar.png'; }}
                            />
                        </div>
                        <div className="player-info">
                            <span className="player-name">
                                {player.username || player.display_name || 'Игрок'}
                            </span>
                            {player.is_captain && (
                                <span className="player-captain-badge" title="Капитан">👑</span>
                            )}
                        </div>
                        {showReady && (
                            <div className="player-ready-status">
                                <span 
                                    className={`ready-indicator ${player.is_ready ? 'ready' : 'not-ready'}`}
                                    title={player.is_ready ? 'Готов' : 'Не готов'}
                                >
                                    {player.is_ready ? '✅' : '❌'}
                                </span>
                            </div>
                        )}
                    </div>
                ))}
                
                {/* Пустые слоты */}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="team-roster-player empty-slot">
                        <div className="player-avatar empty">
                            <span>?</span>
                        </div>
                        <div className="player-info">
                            <span className="player-name empty">Пусто</span>
                        </div>
                    </div>
                ))}
            </div>
            
            {canToggleReady && onToggleReady && (
                <button 
                    className={`team-roster-ready-btn ${isReady ? 'ready' : 'not-ready'}`}
                    onClick={onToggleReady}
                >
                    {isReady ? 'Отменить готовность' : 'Готовы к игре'}
                </button>
            )}
            
            {/* Кастомный контент (для расширения в custom лобби) */}
            {children}
        </div>
    );
}

export default TeamRosterBase;

