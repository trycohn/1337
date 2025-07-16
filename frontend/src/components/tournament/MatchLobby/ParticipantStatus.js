// 👥 ParticipantStatus - Компонент статусов участников лобби
import React from 'react';
import './ParticipantStatus.css';

function ParticipantStatus({ 
    team1, 
    team2, 
    myTeamId, 
    onReadyToggle, 
    ready, 
    canToggle 
}) {
    const isTeam1 = myTeamId === team1.id;
    const isTeam2 = myTeamId === team2.id;
    const isParticipant = isTeam1 || isTeam2;

    return (
        <div className="lobby-participant-status">
            <div className="lobby-participants-container">
                {/* Команда 1 */}
                <div className={`lobby-team-status ${isTeam1 ? 'my-team' : ''}`}>
                    <div className="lobby-team-header">
                        <h3>{team1.name}</h3>
                        {isTeam1 && <span className="lobby-my-team-badge">Ваша команда</span>}
                    </div>
                    
                    <div className="lobby-ready-status">
                        {team1.ready ? (
                            <div className="lobby-status-ready">
                                <span className="lobby-status-icon">✅</span>
                                <span className="lobby-status-text">Готов</span>
                            </div>
                        ) : (
                            <div className="lobby-status-not-ready">
                                <span className="lobby-status-icon">❌</span>
                                <span className="lobby-status-text">Не готов</span>
                            </div>
                        )}
                    </div>

                    {isTeam1 && canToggle && (
                        <button 
                            className={`lobby-ready-toggle-btn ${ready ? 'ready' : 'not-ready'}`}
                            onClick={onReadyToggle}
                        >
                            {ready ? 'Отменить готовность' : 'Готов к игре'}
                        </button>
                    )}
                </div>

                {/* Разделитель VS */}
                <div className="lobby-vs-separator">
                    <span>VS</span>
                </div>

                {/* Команда 2 */}
                <div className={`lobby-team-status ${isTeam2 ? 'my-team' : ''}`}>
                    <div className="lobby-team-header">
                        <h3>{team2.name}</h3>
                        {isTeam2 && <span className="lobby-my-team-badge">Ваша команда</span>}
                    </div>
                    
                    <div className="lobby-ready-status">
                        {team2.ready ? (
                            <div className="lobby-status-ready">
                                <span className="lobby-status-icon">✅</span>
                                <span className="lobby-status-text">Готов</span>
                            </div>
                        ) : (
                            <div className="lobby-status-not-ready">
                                <span className="lobby-status-icon">❌</span>
                                <span className="lobby-status-text">Не готов</span>
                            </div>
                        )}
                    </div>

                    {isTeam2 && canToggle && (
                        <button 
                            className={`lobby-ready-toggle-btn ${ready ? 'ready' : 'not-ready'}`}
                            onClick={onReadyToggle}
                        >
                            {ready ? 'Отменить готовность' : 'Готов к игре'}
                        </button>
                    )}
                </div>
            </div>

            {/* Общий статус готовности */}
            <div className="lobby-overall-status">
                {team1.ready && team2.ready ? (
                    <div className="lobby-all-ready">
                        <span className="lobby-status-icon">🚀</span>
                        <span>Все участники готовы! Ожидание начала выбора карт...</span>
                    </div>
                ) : (
                    <div className="lobby-waiting-ready">
                        <span className="lobby-status-icon">⏳</span>
                        <span>Ожидание готовности всех участников...</span>
                    </div>
                )}
            </div>

            {/* Инструкция для неучастников */}
            {!isParticipant && (
                <div className="lobby-spectator-info">
                    <span className="lobby-info-icon">👁️</span>
                    <span>Вы наблюдаете за этим лобби</span>
                </div>
            )}
        </div>
    );
}

export default ParticipantStatus; 