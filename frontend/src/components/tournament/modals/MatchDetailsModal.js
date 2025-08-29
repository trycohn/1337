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
    // По умолчанию показываем карты
    const [showTeam1Tooltip, setShowTeam1Tooltip] = useState(false);
    const [showTeam2Tooltip, setShowTeam2Tooltip] = useState(false);

    // Используем унифицированный хук модальной системы
    const modalSystem = useMatchDetailsModal({
        onClose: () => {
            setShowTeam1Tooltip(false);
            setShowTeam2Tooltip(false);
            
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

    // 🎯 Карты для отображения: только выбранные в лобби
    function normalizeMapName(map) {
        return map?.map_name || map?.map || map?.name || '';
    }
    const pickedMaps = (() => {
        const md = Array.isArray(selectedMatch.maps_data) ? selectedMatch.maps_data : [];
        if (md.length > 0) return md; // считаем maps_data источником выбранных карт
        const selections = Array.isArray(selectedMatch.selections) ? selectedMatch.selections : [];
        const picks = selections.filter(s => s.action_type === 'pick' && s.map_name);
        return picks.map((p, idx) => ({ map: p.map_name, score1: null, score2: null, index: idx }));
    })();

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
            const isLobbyEnabled = !!tournament?.lobby_enabled;
            if (!isLobbyEnabled) {
                // Лобби в турнире отключено → разрешаем выбор из полного маппула
                onEdit(selectedMatch);
                return;
            }
            // Лобби включено, но выбранных карт нет → спросить подтверждение у администратора
            if (!pickedMaps || pickedMaps.length === 0) {
                const confirmBypassLobby = window.confirm('Действительно корректируем матч без учета лобби?');
                if (confirmBypassLobby) {
                    onEdit(selectedMatch);
                }
                return;
            }
            // Лобби включено → редактируем только выбранные в лобби карты
            const trimmed = { ...selectedMatch };
            trimmed.maps_data = (pickedMaps || []).map(m => ({
                map: normalizeMapName(m),
                score1: m.score1 ?? null,
                score2: m.score2 ?? null,
            }));
            onEdit(trimmed);
        }
    };

    // Определяем статус матча
    const isMatchCompleted = selectedMatch.winner_team_id || 
                           selectedMatch.winner_id ||
                           selectedMatch.status === 'completed' || 
                           selectedMatch.status === 'DONE';

    // 🔧 ПРОВЕРКА СТАТУСА ТУРНИРА И ПРАВ РЕДАКТИРОВАНИЯ
    const canEditByTournamentStatus = tournament?.status === 'in_progress'; // ✅ ИСПРАВЛЕНО: соответствует бэкенду
    const tournamentStatusMessage = !canEditByTournamentStatus 
        ? 'Редактирование матчей возможно только в турнире со статусом "Идет"'
        : null;

    const isCS2 = tournament?.game === 'Counter-Strike 2' || 
                  tournament?.game === 'CS2' ||
                  (pickedMaps && pickedMaps.length > 0);

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
                                        {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ: имя участника или команды */}
                                        {selectedMatch.team1_name || 
                                         (tournament?.participant_type === 'solo' ? 'Участник 1' : 'Команда 1')}
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
                                        {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ: имя участника или команды */}
                                        {selectedMatch.team2_name || 
                                         (tournament?.participant_type === 'solo' ? 'Участник 2' : 'Команда 2')}
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
                            <span className="modal-system-badge">Матч #{selectedMatch.tournament_match_number || selectedMatch.match_number}</span>
                        )}
                        {selectedMatch.is_third_place_match && (
                            <span className="modal-system-badge modal-system-badge-warning">🥉 За 3-е место</span>
                        )}
                        {selectedMatch.bracket_type === 'final' && (
                            <span className="modal-system-badge modal-system-badge-success">🏆 За 1-е место</span>
                        )}
                        {selectedMatch.bracket_type === 'grand_final' && (
                            <span className="modal-system-badge modal-system-badge-success">🏆 За 1-е место</span>
                        )}
                        {selectedMatch.bracket_type === 'grand_final_reset' && (
                            <span className="modal-system-badge modal-system-badge-warning">🔄 Grand Final Triumph</span>
                        )}
                        {isCS2 && (
                            <span className="modal-system-badge">🗺️ CS2</span>
                        )}
                    </div>

                    <div className="modal-system-divider"></div>

                    {/* Контент: только карты, выбранные в лобби */}
                    <div className="modal-system-section">
                        {isCS2 && pickedMaps && pickedMaps.length > 0 ? (
                            <div>
                                <h3 className="modal-system-section-title">🗺️ Результаты по картам</h3>
                                <div className="modal-system-flex-column">
                                    {pickedMaps.map((map, index) => {
                                        const mapName = normalizeMapName(map);
                                        const score1 = parseInt(map.score1) || 0;
                                        const score2 = parseInt(map.score2) || 0;
                                        const team1Won = score1 > score2;
                                        const team2Won = score2 > score1;
                                        const isDraw = score1 === score2;
                                        
                                        return (
                                            <div key={index} className="modal-system-info">
                                                <div className="modal-system-flex-between modal-system-mb-10">
                                                    <h4 className="modal-system-bold">Карта {index + 1}: {mapName || 'Неизвестно'}</h4>
                                                    <span className={`modal-system-badge ${team1Won ? 'modal-system-badge-success' : team2Won ? 'modal-system-badge-success' : isDraw ? 'modal-system-badge-warning' : ''}`}>
                                                        {team1Won ? `🏆 ${selectedMatch.team1_name}` :
                                                         team2Won ? `🏆 ${selectedMatch.team2_name}` :
                                                         isDraw ? '🤝 Ничья' : '⏳ В процессе'}
                                                    </span>
                                                </div>
                                                <div className="modal-system-grid-3">
                                                    <div className="modal-system-text-center">
                                                        <div className="modal-system-bold">
                                                            {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ в картах MatchDetailsModal */}
                                                            {selectedMatch.team1_name || 
                                                             (tournament?.participant_type === 'solo' ? 'Участник 1' : 'Команда 1')}
                                                        </div>
                                                        <div style={{ fontSize: '20px' }}>{score1}</div>
                                                    </div>
                                                    <div className="modal-system-text-center">
                                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>:</div>
                                                    </div>
                                                    <div className="modal-system-text-center">
                                                        <div className="modal-system-bold">
                                                            {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ в картах MatchDetailsModal */}
                                                            {selectedMatch.team2_name || 
                                                             (tournament?.participant_type === 'solo' ? 'Участник 2' : 'Команда 2')}
                                                        </div>
                                                        <div style={{ fontSize: '20px' }}>{score2}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
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
                    <button className="btn btn-secondary" onClick={handleClose}>
                        Закрыть
                    </button>
                    
                    <div className="modal-system-flex">
                        <button 
                            className="btn btn-secondary"
                            onClick={() => {
                                if (selectedMatch?.tournament_id && selectedMatch?.id) {
                                    window.location.href = `/tournaments/${selectedMatch.tournament_id}/match/${selectedMatch.id}`;
                                }
                            }}
                            title="Открыть страницу матча"
                        >
                            🔎 Открыть страницу матча
                        </button>
                        
                        {canEdit && !selectedMatch.editBlocked && (
                            <button 
                                className="btn btn-secondary"
                                onClick={canEditByTournamentStatus ? handleEdit : undefined}
                                disabled={!canEditByTournamentStatus}
                                title={tournamentStatusMessage || "Редактировать результат матча"}
                            >
                                ✏️ Редактировать результат
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Убрали модальное окно шейринга */}
        </div>
    );
};

export default MatchDetailsModal; 