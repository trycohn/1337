import React, { useState } from 'react';
import { useMatchDetailsModal } from '../../../hooks/useModalSystem';
import '../../../styles/modal-system.css';

/**
 * 🎯 MatchDetailsModal v2.0 - Унифицированная модальная система
 * Создано опытным UI/UX разработчиком
 * Использует единую дизайн-систему модальных окон
 * 
 * @version 2.0 (Использует modal-system)
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

    // Используем унифицированный хук модальной системы
    const modalSystem = useMatchDetailsModal({
        onClose: () => {
            setShowTeam1Tooltip(false);
            setShowTeam2Tooltip(false);
            setActiveTab('overview');
            onClose();
        }
    });

    // Логирование для диагностики
    if (isOpen && selectedMatch) {
        console.log('🔍 MatchDetailsModal v2.0 открылся с данными:', {
            matchId: selectedMatch.id,
            team1: selectedMatch.team1_name,
            team2: selectedMatch.team2_name,
            score: `${selectedMatch.score1}:${selectedMatch.score2}`,
            winner: selectedMatch.winner_team_id
        });
    }

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
            <div className="modal-system-tooltip modal-system-tooltip-bottom" onMouseLeave={onClose}>
                <div className="modal-system-section">
                    <div className="modal-system-section-title modal-system-text-center">
                        {composition.name}
                        <span className="modal-system-badge modal-system-ml-10">
                            {composition.members.length} игроков
                        </span>
                    </div>
                    <div className="modal-system-list">
                        {composition.members.map((member, index) => (
                            <div key={index} className="modal-system-list-item">
                                <span className="modal-system-bold">{member.name}</span>
                                {member.rating && (
                                    <span className="modal-system-badge modal-system-badge-success">
                                        {member.rating} {typeof member.rating === 'number' && member.rating > 100 ? 'ELO' : 'Rank'}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const handleClose = () => {
        modalSystem.closeModal();
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
        <div className="modal-system-overlay" onClick={handleClose}>
            <div className={modalSystem.getModalClasses('large')} onClick={(e) => e.stopPropagation()}>
                
                {/* === ЗАГОЛОВОК МОДАЛЬНОГО ОКНА === */}
                <div className="modal-system-header">
                    <div>
                        <h2 className="modal-system-title">
                            📊 Детали матча
                            {!isMatchCompleted && (
                                <span className="modal-system-badge modal-system-badge-warning modal-system-ml-10">
                                    В ожидании
                                </span>
                            )}
                            {isMatchCompleted && (
                                <span className="modal-system-badge modal-system-badge-success modal-system-ml-10">
                                    Завершен
                                </span>
                            )}
                        </h2>
                        {selectedMatch.editBlocked && (
                            <p className="modal-system-subtitle">
                                🔒 {selectedMatch.editBlockReason}
                            </p>
                        )}
                    </div>
                    <button 
                        className="modal-system-close" 
                        onClick={handleClose} 
                        aria-label="Закрыть модальное окно"
                    >
                        ✕
                    </button>
                </div>

                {/* === ТЕЛО МОДАЛЬНОГО ОКНА === */}
                <div className="modal-system-body">
                    
                    {/* Информация о командах */}
                    <div className="modal-system-section">
                        <div className="modal-system-grid-3">
                            {/* Команда 1 */}
                            <div 
                                className={`modal-system-info ${selectedMatch.winner_team_id === selectedMatch.team1_id ? 'modal-system-info-success' : ''}`}
                                onMouseEnter={() => selectedMatch.team1_composition && setShowTeam1Tooltip(true)}
                                onMouseLeave={() => setShowTeam1Tooltip(false)}
                                style={{ position: 'relative', cursor: selectedMatch.team1_composition ? 'pointer' : 'default' }}
                            >
                                <div className="modal-system-text-center">
                                    <h4 className="modal-system-bold modal-system-mb-10">
                                        {selectedMatch.team1_name || 'Команда 1'}
                                    </h4>
                                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                                        {selectedMatch.score1 !== undefined ? selectedMatch.score1 :
                                        (selectedMatch.team1_score !== undefined ? selectedMatch.team1_score : 0)}
                                    </div>
                                    {selectedMatch.winner_team_id === selectedMatch.team1_id && (
                                        <div className="modal-system-badge modal-system-badge-success modal-system-mt-10">
                                            👑 Победитель
                                        </div>
                                    )}
                                </div>
                                
                                <TeamTooltip 
                                    team="team1"
                                    composition={selectedMatch.team1_composition}
                                    show={showTeam1Tooltip}
                                    onClose={() => setShowTeam1Tooltip(false)}
                                />
                            </div>

                            {/* VS Секция */}
                            <div className="modal-system-text-center">
                                <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '20px 0' }}>VS</div>
                                <div className="modal-system-flex-center">
                                    <div className={`modal-system-badge ${isMatchCompleted ? 'modal-system-badge-success' : 'modal-system-badge-warning'}`}>
                                        {isMatchCompleted ? '✅ Завершен' : '⏳ Ожидается'}
                                    </div>
                                </div>
                            </div>

                            {/* Команда 2 */}
                            <div 
                                className={`modal-system-info ${selectedMatch.winner_team_id === selectedMatch.team2_id ? 'modal-system-info-success' : ''}`}
                                onMouseEnter={() => selectedMatch.team2_composition && setShowTeam2Tooltip(true)}
                                onMouseLeave={() => setShowTeam2Tooltip(false)}
                                style={{ position: 'relative', cursor: selectedMatch.team2_composition ? 'pointer' : 'default' }}
                            >
                                <div className="modal-system-text-center">
                                    <h4 className="modal-system-bold modal-system-mb-10">
                                        {selectedMatch.team2_name || 'Команда 2'}
                                    </h4>
                                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                                        {selectedMatch.score2 !== undefined ? selectedMatch.score2 :
                                        (selectedMatch.team2_score !== undefined ? selectedMatch.team2_score : 0)}
                                    </div>
                                    {selectedMatch.winner_team_id === selectedMatch.team2_id && (
                                        <div className="modal-system-badge modal-system-badge-success modal-system-mt-10">
                                            👑 Победитель
                                        </div>
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
                    </div>

                    {/* Метаинформация */}
                    <div className="modal-system-flex-center modal-system-mb-20">
                        {selectedMatch.round && (
                            <span className="modal-system-badge">Раунд {selectedMatch.round}</span>
                        )}
                        {selectedMatch.match_number && (
                            <span className="modal-system-badge">Матч #{selectedMatch.match_number}</span>
                        )}
                        {selectedMatch.is_third_place_match && (
                            <span className="modal-system-badge modal-system-badge-warning">🥉 За 3-е место</span>
                        )}
                        {selectedMatch.bracket_type === 'grand_final' && (
                            <span className="modal-system-badge modal-system-badge-success">🏆 Финал</span>
                        )}
                        {isCS2 && (
                            <span className="modal-system-badge">🗺️ CS2</span>
                        )}
                    </div>

                    <div className="modal-system-divider"></div>

                    {/* Навигация по вкладкам */}
                    {isMatchCompleted && (
                        <div className="modal-system-flex-center modal-system-mb-20">
                            <button 
                                className={`modal-system-btn ${activeTab === 'overview' ? 'modal-system-btn-primary' : ''}`}
                                onClick={() => setActiveTab('overview')}
                            >
                                📋 Обзор
                            </button>
                            {isCS2 && mapStats && (
                                <button 
                                    className={`modal-system-btn ${activeTab === 'maps' ? 'modal-system-btn-primary' : ''}`}
                                    onClick={() => setActiveTab('maps')}
                                >
                                    🗺️ Карты ({mapStats.mapsCount})
                                </button>
                            )}
                            <button 
                                className={`modal-system-btn ${activeTab === 'details' ? 'modal-system-btn-primary' : ''}`}
                                onClick={() => setActiveTab('details')}
                            >
                                ℹ️ Детали
                            </button>
                        </div>
                    )}

                    {/* Контент вкладок */}
                    <div className="modal-system-section">
                        {/* Вкладка "Обзор" */}
                        {activeTab === 'overview' && (
                            <div>
                                {isMatchCompleted ? (
                                    <>
                                        {/* Краткая статистика */}
                                        <div className="modal-system-section">
                                            <h3 className="modal-system-section-title">📊 Статистика матча</h3>
                                            <div className="modal-system-grid-3">
                                                <div className="modal-system-info">
                                                    <div className="modal-system-text-center">
                                                        <div className="modal-system-bold">Общий счет</div>
                                                        <div style={{ fontSize: '24px', margin: '10px 0' }}>
                                                            {selectedMatch.score1 || 0} : {selectedMatch.score2 || 0}
                                                        </div>
                                                    </div>
                                                </div>
                                                {mapStats && (
                                                    <>
                                                        <div className="modal-system-info">
                                                            <div className="modal-system-text-center">
                                                                <div className="modal-system-bold">Карт сыграно</div>
                                                                <div style={{ fontSize: '24px', margin: '10px 0' }}>
                                                                    {mapStats.mapsCount}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="modal-system-info">
                                                            <div className="modal-system-text-center">
                                                                <div className="modal-system-bold">Общий счет фрагов</div>
                                                                <div style={{ fontSize: '18px', margin: '10px 0' }}>
                                                                    {mapStats.team1TotalScore} : {mapStats.team2TotalScore}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Расширенная статистика */}
                                        {mapStats && (
                                            <div className="modal-system-section">
                                                <h3 className="modal-system-section-title">📈 Детальная статистика</h3>
                                                <div className="modal-system-grid-2">
                                                    <div className="modal-system-info">
                                                        <h4 className="modal-system-bold modal-system-mb-10">🏆 Победы по картам</h4>
                                                        <div className="modal-system-flex-column">
                                                            <span>{selectedMatch.team1_name}: {mapStats.team1Wins}</span>
                                                            <span>{selectedMatch.team2_name}: {mapStats.team2Wins}</span>
                                                            {mapStats.draws > 0 && <span>Ничьи: {mapStats.draws}</span>}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="modal-system-info">
                                                        <h4 className="modal-system-bold modal-system-mb-10">🎯 Производительность</h4>
                                                        <div className="modal-system-flex-column">
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
                                    <div className="modal-system-text-center">
                                        <div style={{ fontSize: '48px', margin: '20px 0' }}>⏳</div>
                                        <h4 className="modal-system-bold">Матч еще не сыгран</h4>
                                        <p className="modal-system-mb-20">Результаты появятся после завершения игры между командами.</p>
                                        <div className="modal-system-flex-center">
                                            <span className="modal-system-bold">{selectedMatch.team1_name || 'Команда 1'}</span>
                                            <span className="modal-system-badge">VS</span>
                                            <span className="modal-system-bold">{selectedMatch.team2_name || 'Команда 2'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Вкладка "Карты" */}
                        {activeTab === 'maps' && isCS2 && selectedMatch.maps_data && (
                            <div>
                                <h3 className="modal-system-section-title">🗺️ Результаты по картам</h3>
                                <div className="modal-system-flex-column">
                                    {selectedMatch.maps_data.map((map, index) => {
                                        const score1 = parseInt(map.score1) || 0;
                                        const score2 = parseInt(map.score2) || 0;
                                        const team1Won = score1 > score2;
                                        const team2Won = score2 > score1;
                                        const isDraw = score1 === score2;
                                        
                                        return (
                                            <div key={index} className="modal-system-info">
                                                <div className="modal-system-flex-between modal-system-mb-10">
                                                    <h4 className="modal-system-bold">Карта {index + 1}: {map.map || 'Неизвестно'}</h4>
                                                    <span className={`modal-system-badge ${team1Won ? 'modal-system-badge-success' : team2Won ? 'modal-system-badge-success' : isDraw ? 'modal-system-badge-warning' : ''}`}>
                                                        {team1Won ? `🏆 ${selectedMatch.team1_name}` :
                                                         team2Won ? `🏆 ${selectedMatch.team2_name}` :
                                                         isDraw ? '🤝 Ничья' : '⏳ В процессе'}
                                                    </span>
                                                </div>
                                                <div className="modal-system-grid-3">
                                                    <div className="modal-system-text-center">
                                                        <div className="modal-system-bold">{selectedMatch.team1_name}</div>
                                                        <div style={{ fontSize: '20px' }}>{score1}</div>
                                                    </div>
                                                    <div className="modal-system-text-center">
                                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>:</div>
                                                    </div>
                                                    <div className="modal-system-text-center">
                                                        <div className="modal-system-bold">{selectedMatch.team2_name}</div>
                                                        <div style={{ fontSize: '20px' }}>{score2}</div>
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
                            <div>
                                <h3 className="modal-system-section-title">ℹ️ Техническая информация</h3>
                                <div className="modal-system-table">
                                    <table className="modal-system-table">
                                        <tbody>
                                            <tr>
                                                <td className="modal-system-bold">ID матча</td>
                                                <td>{selectedMatch.id}</td>
                                            </tr>
                                            {selectedMatch.round && (
                                                <tr>
                                                    <td className="modal-system-bold">Раунд турнира</td>
                                                    <td>{selectedMatch.round}</td>
                                                </tr>
                                            )}
                                            {selectedMatch.match_number && (
                                                <tr>
                                                    <td className="modal-system-bold">Номер матча</td>
                                                    <td>#{selectedMatch.match_number}</td>
                                                </tr>
                                            )}
                                            <tr>
                                                <td className="modal-system-bold">Статус</td>
                                                <td>
                                                    <span className={`modal-system-badge ${isMatchCompleted ? 'modal-system-badge-success' : 'modal-system-badge-warning'}`}>
                                                        {isMatchCompleted ? '✅ Завершен' : '⏳ Ожидается'}
                                                    </span>
                                                </td>
                                            </tr>
                                            {selectedMatch.bracket_type && (
                                                <tr>
                                                    <td className="modal-system-bold">Тип матча</td>
                                                    <td>{selectedMatch.bracket_type}</td>
                                                </tr>
                                            )}
                                            {selectedMatch.created_at && (
                                                <tr>
                                                    <td className="modal-system-bold">Создан</td>
                                                    <td>{new Date(selectedMatch.created_at).toLocaleString('ru-RU')}</td>
                                                </tr>
                                            )}
                                            {selectedMatch.completed_at && (
                                                <tr>
                                                    <td className="modal-system-bold">Завершен</td>
                                                    <td>{new Date(selectedMatch.completed_at).toLocaleString('ru-RU')}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Сообщение о отсутствии карт */}
                        {activeTab === 'maps' && (!selectedMatch.maps_data || selectedMatch.maps_data.length === 0) && (
                            <div className="modal-system-text-center">
                                <div style={{ fontSize: '48px', margin: '20px 0' }}>🗺️</div>
                                <h4 className="modal-system-bold">Карты не добавлены</h4>
                                <p>Для этого матча не было добавлено информации о картах.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* === ПОДВАЛ МОДАЛЬНОГО ОКНА === */}
                <div className="modal-system-footer modal-system-space-between">
                    <button className="modal-system-btn" onClick={handleClose}>
                        Закрыть
                    </button>
                    
                    <div className="modal-system-flex">
                        <button 
                            className="modal-system-btn"
                            onClick={() => {
                                const url = window.location.href + '#match-' + selectedMatch.id;
                                navigator.clipboard.writeText(url);
                                // Можно добавить уведомление о копировании
                            }}
                            title="Скопировать ссылку на матч"
                        >
                            🔗 Поделиться
                        </button>
                        
                        {canEdit && !selectedMatch.editBlocked && (
                            <button className="modal-system-btn modal-system-btn-primary" onClick={handleEdit}>
                                ✏️ Редактировать результат
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MatchDetailsModal; 