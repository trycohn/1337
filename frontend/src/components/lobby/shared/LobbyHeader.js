// 📋 LobbyHeader - Заголовок лобби с информацией о командах и формате
import React from 'react';
import './LobbyHeader.css';

const FORMAT_LABELS = {
    'bo1': 'Best of 1',
    'bo3': 'Best of 3',
    'bo5': 'Best of 5'
};

function LobbyHeader({ 
    team1Name, 
    team2Name, 
    matchFormat, 
    tournamentName = null,
    matchNumber = null,
    lobbyType = 'tournament' // 'tournament' | 'custom'
}) {
    return (
        <div className="lobby-header">
            <div className="lobby-header-main">
                <div className="lobby-team-info">
                    <h2 className="lobby-team-name team-1">{team1Name || 'Команда 1'}</h2>
                </div>
                
                <div className="lobby-vs-block">
                    <span className="lobby-vs-text">VS</span>
                    {matchFormat && (
                        <div className="lobby-format-badge">
                            {FORMAT_LABELS[matchFormat] || matchFormat}
                        </div>
                    )}
                </div>
                
                <div className="lobby-team-info">
                    <h2 className="lobby-team-name team-2">{team2Name || 'Команда 2'}</h2>
                </div>
            </div>
            
            {lobbyType === 'tournament' && (tournamentName || matchNumber) && (
                <div className="lobby-header-meta">
                    {tournamentName && (
                        <span className="lobby-tournament-name">
                            🏆 {tournamentName}
                        </span>
                    )}
                    {matchNumber && (
                        <span className="lobby-match-number">
                            Матч #{matchNumber}
                        </span>
                    )}
                </div>
            )}
            
            {lobbyType === 'custom' && (
                <div className="lobby-header-meta">
                    <span className="lobby-custom-badge">
                        🎮 Кастомный матч
                    </span>
                </div>
            )}
        </div>
    );
}

export default LobbyHeader;

