import React, { useState } from 'react';
import './MatchDetailsModal.css';

/**
 * MatchDetailsModal v1.0 - Просмотр деталей матча
 * 
 * @version 1.0 (Отдельное окно просмотра для пользователей)
 * @features Просмотр результатов, тултипы команд, статистика, кнопка редактирования для админов
 */
const MatchDetailsModal = ({
    isOpen,
    onClose,
    selectedMatch,
    canEdit = false,
    onEdit,
    tournament = null
}) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [showTeam1Tooltip, setShowTeam1Tooltip] = useState(false);
    const [showTeam2Tooltip, setShowTeam2Tooltip] = useState(false);

    if (!isOpen || !selectedMatch) return null;

    // 🎯 РАСЧЕТ СТАТИСТИКИ ПО КАРТАМ
    const getMapStatistics = () => {
        const mapsData = selectedMatch.maps_data || [];
        if (mapsData.length === 0) return null;
        
        let team1Wins = 0;
        let team2Wins = 0;
        let team1TotalScore = 0;
        let team2TotalScore = 0;
        let draws = 0;
        
        mapsData.forEach(map => {
            const score1 = parseInt(map.score1) || 0;
            const score2 = parseInt(map.score2) || 0;
            
            team1TotalScore += score1;
            team2TotalScore += score2;
            
            if (score1 > score2) {
                team1Wins++;
            } else if (score2 > score1) {
                team2Wins++;
            } else {
                draws++;
            }
        });
        
        return {
            mapsCount: mapsData.length,
            team1Wins,
            team2Wins,
            draws,
            team1TotalScore,
            team2TotalScore,
            scoreDifference: Math.abs(team1TotalScore - team2TotalScore)
        };
    };

    // 🎯 ТУЛТИП С СОСТАВОМ КОМАНДЫ
    const TeamTooltip = ({ team, composition, show, onClose }) => {
        if (!show || !composition || !composition.members || composition.members.length === 0) {
            return null;
        }
        
        return (
            <div className="team-tooltip match-details-tooltip" onMouseLeave={onClose}>
                <div className="tooltip-header">
                    <h4>{composition.name}</h4>
                    <span className="members-count">({composition.members.length} игроков)</span>
                </div>
                <div className="tooltip-members">
                    {composition.members.map((member, index) => (
                        <div key={index} className="tooltip-member">
                            <span className="member-name">{member.name}</span>
                            {member.rating && (
                                <span className="member-rating">
                                    {member.rating} {typeof member.rating === 'number' && member.rating > 100 ? 'ELO' : 'Rank'}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const handleClose = () => {
        onClose();
    };

    const handleEdit = () => {
        if (onEdit && canEdit) {
            onEdit(selectedMatch);
        }
    };

    // Определяем статус матча
    const isMatchCompleted = selectedMatch.winner_team_id || 
                           selectedMatch.winner_id ||
                           selectedMatch.status === 'completed' || 
                           selectedMatch.status === 'DONE';

    const isCS2 = tournament?.game === 'Counter-Strike 2' || 
                  tournament?.game === 'CS2' ||
                  (selectedMatch.maps_data && selectedMatch.maps_data.length > 0);

    const mapStats = getMapStatistics();

    return (
        <div className="modal-overlay match-details-overlay" onClick={handleClose}>
            <div className="modal-content match-details-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="header-content">
                        <h3>
                            📊 Детали матча
                            {!isMatchCompleted && <span className="pending-badge">В ожидании</span>}
                            {isMatchCompleted && <span className="completed-badge">Завершен</span>}
                        </h3>
                        {selectedMatch.editBlocked && (
                            <div className="edit-blocked-notice">
                                🔒 {selectedMatch.editBlockReason}
                            </div>
                        )}
                    </div>
                    <button className="close-btn" onClick={handleClose} title="Закрыть">✕</button>
                </div>

                {/* Информация о командах */}
                <div className="match-teams">
                    <div 
                        className={`team-card ${selectedMatch.winner_team_id === selectedMatch.team1_id ? 'winner' : ''} ${selectedMatch.team1_composition ? 'has-tooltip' : ''}`}
                        onMouseEnter={() => setShowTeam1Tooltip(true)}
                        onMouseLeave={() => setShowTeam1Tooltip(false)}
                    >
                        <div className="team-info">
                            <h4>{selectedMatch.team1_name || 'Команда 1'}</h4>
                            <div className="team-score">
                                {selectedMatch.score1 !== undefined ? selectedMatch.score1 :
                                (selectedMatch.team1_score !== undefined ? selectedMatch.team1_score : 0)}
                            </div>
                            {selectedMatch.winner_team_id === selectedMatch.team1_id && (
                                <div className="winner-crown">👑 Победитель</div>
                            )}
                        </div>
                        
                        <TeamTooltip 
                            team="team1"
                            composition={selectedMatch.team1_composition}
                            show={showTeam1Tooltip}
                            onClose={() => setShowTeam1Tooltip(false)}
                        />
                    </div>

                    <div className="vs-section">
                        <div className="vs-text">VS</div>
                        <div className="match-status">
                            <div className={`status-indicator ${isMatchCompleted ? 'completed' : 'pending'}`}></div>
                            <span>{isMatchCompleted ? 'Завершен' : 'Ожидается'}</span>
                        </div>
                    </div>

                    <div 
                        className={`team-card ${selectedMatch.winner_team_id === selectedMatch.team2_id ? 'winner' : ''} ${selectedMatch.team2_composition ? 'has-tooltip' : ''}`}
                        onMouseEnter={() => setShowTeam2Tooltip(true)}
                        onMouseLeave={() => setShowTeam2Tooltip(false)}
                    >
                        <div className="team-info">
                            <h4>{selectedMatch.team2_name || 'Команда 2'}</h4>
                            <div className="team-score">
                                {selectedMatch.score2 !== undefined ? selectedMatch.score2 :
                                (selectedMatch.team2_score !== undefined ? selectedMatch.team2_score : 0)}
                            </div>
                            {selectedMatch.winner_team_id === selectedMatch.team2_id && (
                                <div className="winner-crown">👑 Победитель</div>
                            )}
                        </div>
                        
                        <TeamTooltip 
                            team="team2"
                            composition={selectedMatch.team2_composition}
                            show={showTeam2Tooltip}
                            onClose={() => setShowTeam2Tooltip(false)}
                        />
                    </div>
                </div>

                {/* Метаинформация */}
                <div className="match-meta">
                    {selectedMatch.round && (
                        <span className="meta-badge round-badge">Раунд {selectedMatch.round}</span>
                    )}
                    {selectedMatch.match_number && (
                        <span className="meta-badge match-badge">Матч #{selectedMatch.match_number}</span>
                    )}
                    {selectedMatch.is_third_place_match && (
                        <span className="meta-badge bronze-badge">🥉 За 3-е место</span>
                    )}
                    {selectedMatch.bracket_type === 'grand_final' && (
                        <span className="meta-badge final-badge">🏆 Финал</span>
                    )}
                    {isCS2 && (
                        <span className="meta-badge game-badge">🗺️ CS2</span>
                    )}
                </div>

                {/* Навигация по вкладкам */}
                {isMatchCompleted && (
                    <div className="tab-navigation">
                        <button 
                            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            📋 Обзор
                        </button>
                        {isCS2 && mapStats && (
                            <button 
                                className={`tab-btn ${activeTab === 'maps' ? 'active' : ''}`}
                                onClick={() => setActiveTab('maps')}
                            >
                                🗺️ Карты ({mapStats.mapsCount})
                            </button>
                        )}
                        <button 
                            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                            onClick={() => setActiveTab('details')}
                        >
                            ℹ️ Детали
                        </button>
                    </div>
                )}

                {/* Контент вкладок */}
                <div className="tab-content">
                    {/* Вкладка "Обзор" */}
                    {activeTab === 'overview' && (
                        <div className="overview-content">
                            {isMatchCompleted ? (
                                <>
                                    {/* Краткая статистика */}
                                    <div className="quick-stats">
                                        <div className="stat-item">
                                            <span className="stat-label">Общий счет</span>
                                            <span className="stat-value">
                                                {selectedMatch.score1 || 0} : {selectedMatch.score2 || 0}
                                            </span>
                                        </div>
                                        {mapStats && (
                                            <>
                                                <div className="stat-item">
                                                    <span className="stat-label">Карт сыграно</span>
                                                    <span className="stat-value">{mapStats.mapsCount}</span>
                                                </div>
                                                <div className="stat-item">
                                                    <span className="stat-label">Общий счет фрагов</span>
                                                    <span className="stat-value">
                                                        {mapStats.team1TotalScore} : {mapStats.team2TotalScore}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Расширенная статистика */}
                                    {mapStats && (
                                        <div className="extended-stats">
                                            <h5>📈 Детальная статистика</h5>
                                            <div className="stats-grid">
                                                <div className="stat-group">
                                                    <h6>🏆 Победы по картам</h6>
                                                    <div className="stat-row">
                                                        <span>{selectedMatch.team1_name}: {mapStats.team1Wins}</span>
                                                        <span>{selectedMatch.team2_name}: {mapStats.team2Wins}</span>
                                                        {mapStats.draws > 0 && <span>Ничьи: {mapStats.draws}</span>}
                                                    </div>
                                                </div>
                                                
                                                <div className="stat-group">
                                                    <h6>🎯 Производительность</h6>
                                                    <div className="stat-row">
                                                        <span>Разность фрагов: ±{mapStats.scoreDifference}</span>
                                                        <span>Средний счет: {Math.round((mapStats.team1TotalScore + mapStats.team2TotalScore) / mapStats.mapsCount)}</span>
                                                        {mapStats.mapsCount >= 3 && <span>Формат: BO{mapStats.mapsCount}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="no-results">
                                    <div className="no-results-icon">⏳</div>
                                    <h4>Матч еще не сыгран</h4>
                                    <p>Результаты появятся после завершения игры между командами.</p>
                                    <div className="teams-preview">
                                        <span>{selectedMatch.team1_name || 'Команда 1'}</span>
                                        <span className="vs">VS</span>
                                        <span>{selectedMatch.team2_name || 'Команда 2'}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Вкладка "Карты" */}
                    {activeTab === 'maps' && isCS2 && selectedMatch.maps_data && (
                        <div className="maps-content">
                            <h5>🗺️ Результаты по картам</h5>
                            <div className="maps-list">
                                {selectedMatch.maps_data.map((map, index) => {
                                    const score1 = parseInt(map.score1) || 0;
                                    const score2 = parseInt(map.score2) || 0;
                                    const team1Won = score1 > score2;
                                    const team2Won = score2 > score1;
                                    const isDraw = score1 === score2;
                                    
                                    return (
                                        <div key={index} className="map-card">
                                            <div className="map-header">
                                                <h6>Карта {index + 1}: {map.map || 'Неизвестно'}</h6>
                                                <div className={`map-result ${team1Won ? 'team1-win' : team2Won ? 'team2-win' : 'draw'}`}>
                                                    {team1Won ? `🏆 ${selectedMatch.team1_name}` :
                                                     team2Won ? `🏆 ${selectedMatch.team2_name}` :
                                                     isDraw ? '🤝 Ничья' : '⏳ В процессе'}
                                                </div>
                                            </div>
                                            <div className="map-scores">
                                                <div className="team-score">
                                                    <span className="team-name">{selectedMatch.team1_name}</span>
                                                    <span className="score">{score1}</span>
                                                </div>
                                                <div className="score-separator">:</div>
                                                <div className="team-score">
                                                    <span className="team-name">{selectedMatch.team2_name}</span>
                                                    <span className="score">{score2}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Вкладка "Детали" */}
                    {activeTab === 'details' && (
                        <div className="details-content">
                            <h5>ℹ️ Техническая информация</h5>
                            <div className="details-grid">
                                <div className="detail-item">
                                    <span className="detail-label">ID матча</span>
                                    <span className="detail-value">{selectedMatch.id}</span>
                                </div>
                                {selectedMatch.round && (
                                    <div className="detail-item">
                                        <span className="detail-label">Раунд турнира</span>
                                        <span className="detail-value">{selectedMatch.round}</span>
                                    </div>
                                )}
                                {selectedMatch.match_number && (
                                    <div className="detail-item">
                                        <span className="detail-label">Номер матча</span>
                                        <span className="detail-value">#{selectedMatch.match_number}</span>
                                    </div>
                                )}
                                <div className="detail-item">
                                    <span className="detail-label">Статус</span>
                                    <span className="detail-value">
                                        {isMatchCompleted ? '✅ Завершен' : '⏳ Ожидается'}
                                    </span>
                                </div>
                                {selectedMatch.bracket_type && (
                                    <div className="detail-item">
                                        <span className="detail-label">Тип матча</span>
                                        <span className="detail-value">{selectedMatch.bracket_type}</span>
                                    </div>
                                )}
                                {selectedMatch.created_at && (
                                    <div className="detail-item">
                                        <span className="detail-label">Создан</span>
                                        <span className="detail-value">
                                            {new Date(selectedMatch.created_at).toLocaleString('ru-RU')}
                                        </span>
                                    </div>
                                )}
                                {selectedMatch.completed_at && (
                                    <div className="detail-item">
                                        <span className="detail-label">Завершен</span>
                                        <span className="detail-value">
                                            {new Date(selectedMatch.completed_at).toLocaleString('ru-RU')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Сообщение о отсутствии карт */}
                    {activeTab === 'maps' && (!selectedMatch.maps_data || selectedMatch.maps_data.length === 0) && (
                        <div className="no-maps">
                            <div className="no-maps-icon">🗺️</div>
                            <h4>Карты не добавлены</h4>
                            <p>Для этого матча не было добавлено информации о картах.</p>
                        </div>
                    )}
                </div>

                {/* Действия */}
                <div className="modal-actions">
                    <button className="close-action-btn" onClick={handleClose}>
                        Закрыть
                    </button>
                    {canEdit && !selectedMatch.editBlocked && (
                        <button className="edit-action-btn" onClick={handleEdit}>
                            ✏️ Редактировать результат
                        </button>
                    )}
                    <button 
                        className="share-btn"
                        onClick={() => {
                            const url = window.location.href + '#match-' + selectedMatch.id;
                            navigator.clipboard.writeText(url);
                            // Можно добавить уведомление о копировании
                        }}
                        title="Скопировать ссылку на матч"
                    >
                        🔗 Поделиться
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MatchDetailsModal; 