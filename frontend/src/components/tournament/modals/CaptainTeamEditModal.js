import React, { useState, useEffect, useCallback } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { isMobile } from 'react-device-detect';
import api from '../../../utils/api';
import { ensureHttps } from '../../../utils/userHelpers';
import './CaptainTeamEditModal.css';

const ItemTypes = {
    PLAYER: 'player'
};

// Компонент перетаскиваемого игрока
const DraggablePlayer = ({ player, index, onMove, isRosterSlot, slotIndex, canDrag }) => {
    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.PLAYER,
        item: { player, sourceIndex: index, isFromRoster: isRosterSlot },
        canDrag: () => canDrag,
        collect: (monitor) => ({
            isDragging: monitor.isDragging()
        })
    });

    const [{ isOver }, drop] = useDrop({
        accept: ItemTypes.PLAYER,
        drop: (item) => {
            if (onMove) {
                onMove(item, { player, targetIndex: slotIndex, isRosterSlot });
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver()
        })
    });

    const faceitElo = player?.faceit_elo || player?.user_faceit_elo || 1200;

    return (
        <div
            ref={(node) => drag(drop(node))}
            className={`ctem-draggable-player ${isDragging ? 'ctem-dragging' : ''} ${isOver ? 'ctem-drop-target' : ''}`}
            style={{ opacity: isDragging ? 0.5 : 1 }}
        >
            <div className="ctem-player-info">
                <img 
                    src={ensureHttps(player?.avatar_url) || '/uploads/avatars/preloaded/circle-user.svg'}
                    alt={player?.username || player?.name}
                    className="ctem-player-avatar"
                    onError={(e) => { e.currentTarget.src = '/uploads/avatars/preloaded/circle-user.svg'; }}
                />
                <div className="ctem-player-details">
                    <span className="ctem-player-name">
                        {player?.username || player?.name}
                        {player?.is_captain && <span className="ctem-captain-badge"> 👑</span>}
                    </span>
                    <span className="ctem-player-elo">FACEIT: {faceitElo}</span>
                </div>
            </div>
        </div>
    );
};

// Пустой слот для ростера
const EmptySlot = ({ slotIndex, onMove }) => {
    const [{ isOver }, drop] = useDrop({
        accept: ItemTypes.PLAYER,
        drop: (item) => {
            if (onMove) {
                onMove(item, { player: null, targetIndex: slotIndex, isRosterSlot: true });
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver()
        })
    });

    return (
        <div
            ref={drop}
            className={`ctem-empty-slot ${isOver ? 'ctem-drop-target' : ''}`}
        >
            <span>Перетащите игрока сюда</span>
        </div>
    );
};

/**
 * Модалка редактирования турнирного состава команды для капитана
 */
const CaptainTeamEditModal = ({ 
    isOpen, 
    onClose, 
    team, 
    tournament,
    user,
    onSuccess 
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Данные
    const [tournamentRoster, setTournamentRoster] = useState([]);
    const [availablePlayers, setAvailablePlayers] = useState([]);
    const [globalTeam, setGlobalTeam] = useState(null);
    const [maxTeamSize, setMaxTeamSize] = useState(5);

    // Загрузка данных при открытии
    useEffect(() => {
        if (isOpen && team?.id && tournament?.id) {
            loadData();
        }
    }, [isOpen, team?.id, tournament?.id]);

    // Загрузка турнирного состава и доступных игроков
    const loadData = async () => {
        try {
            setLoading(true);
            setError('');
            
            const token = localStorage.getItem('token');
            
            // Получаем текущий турнирный состав
            const rosterResponse = await api.get(
                `/api/tournaments/${tournament.id}/teams/${team.id}/members`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Получаем доступных игроков из глобальной команды
            const globalResponse = await api.get(
                `/api/tournaments/${tournament.id}/teams/${team.id}/global-roster`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (rosterResponse.data.success) {
                // Фильтруем капитана из редактируемого состава
                const nonCaptainMembers = rosterResponse.data.members.filter(m => !m.is_captain);
                setTournamentRoster(nonCaptainMembers);
            }

            if (globalResponse.data.success) {
                setAvailablePlayers(globalResponse.data.availablePlayers || []);
                setGlobalTeam(globalResponse.data.globalTeam);
                setMaxTeamSize(globalResponse.data.maxTeamSize || 5);
            }

        } catch (err) {
            console.error('Ошибка загрузки данных:', err);
            setError(err.response?.data?.error || 'Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    };

    // Обработка перемещения игрока
    const handleMove = useCallback((draggedItem, dropTarget) => {
        const { player: draggedPlayer, isFromRoster: dragFromRoster } = draggedItem;
        const { player: targetPlayer, isRosterSlot: dropToRoster } = dropTarget;

        console.log('🔄 Перемещение игрока:', {
            from: dragFromRoster ? 'roster' : 'available',
            to: dropToRoster ? 'roster' : 'available',
            draggedPlayer: draggedPlayer?.username,
            targetPlayer: targetPlayer?.username
        });

        // Из ростера в доступные
        if (dragFromRoster && !dropToRoster) {
            setTournamentRoster(prev => prev.filter(p => p.user_id !== draggedPlayer.user_id));
            setAvailablePlayers(prev => [...prev, draggedPlayer]);
        }
        // Из доступных в ростер
        else if (!dragFromRoster && dropToRoster) {
            // Проверка лимита
            if (tournamentRoster.length >= maxTeamSize) {
                setError(`Достигнут лимит команды (${maxTeamSize} игроков)`);
                setTimeout(() => setError(''), 3000);
                return;
            }

            // Если это замена (есть target игрок)
            if (targetPlayer) {
                // Меняем местами
                setTournamentRoster(prev => 
                    prev.map(p => p.user_id === targetPlayer.user_id ? draggedPlayer : p)
                );
                setAvailablePlayers(prev => [
                    ...prev.filter(p => p.user_id !== draggedPlayer.user_id),
                    targetPlayer
                ]);
            } else {
                // Просто добавляем
                setTournamentRoster(prev => [...prev, draggedPlayer]);
                setAvailablePlayers(prev => prev.filter(p => p.user_id !== draggedPlayer.user_id));
            }
        }
        // Swap внутри ростера
        else if (dragFromRoster && dropToRoster && targetPlayer) {
            const dragIndex = tournamentRoster.findIndex(p => p.user_id === draggedPlayer.user_id);
            const dropIndex = tournamentRoster.findIndex(p => p.user_id === targetPlayer.user_id);
            
            const newRoster = [...tournamentRoster];
            [newRoster[dragIndex], newRoster[dropIndex]] = [newRoster[dropIndex], newRoster[dragIndex]];
            setTournamentRoster(newRoster);
        }
    }, [tournamentRoster, maxTeamSize]);

    // Сохранение изменений
    const handleSave = async () => {
        try {
            setLoading(true);
            setError('');
            
            const token = localStorage.getItem('token');
            const memberUserIds = tournamentRoster.map(p => p.user_id);

            const response = await api.put(
                `/api/tournaments/${tournament.id}/teams/${team.id}/roster`,
                { memberUserIds },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setSuccess('✅ Состав команды обновлен!');
                setTimeout(() => {
                    if (onSuccess) onSuccess();
                    onClose();
                }, 1500);
            }

        } catch (err) {
            console.error('Ошибка сохранения:', err);
            setError(err.response?.data?.error || 'Ошибка при сохранении изменений');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const backend = isMobile ? TouchBackend : HTML5Backend;

    return (
        <DndProvider backend={backend}>
            <div className="modal-overlay" onClick={onClose}>
                <div 
                    className="ctem-modal"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="ctem-modal-header">
                        <h3>✏️ Редактирование состава "{team?.name}"</h3>
                        <button className="ctem-close-btn" onClick={onClose}>✕</button>
                    </div>

                    {error && <div className="ctem-error-message">{error}</div>}
                    {success && <div className="ctem-success-message">{success}</div>}

                    {!globalTeam && !loading && (
                        <div className="ctem-info-message">
                            У вас нет глобальной команды. Создайте команду в разделе "Мои команды" чтобы управлять расширенным составом.
                        </div>
                    )}

                    <div className="ctem-modal-body">
                        {/* Левая колонка - Турнирный ростер */}
                        <div className="ctem-roster-column">
                            <h4>👥 Турнирный состав ({tournamentRoster.length}/{maxTeamSize})</h4>
                            <p className="ctem-column-hint">Игроки, заявленные на турнир</p>
                            
                            <div className="ctem-roster-slots">
                                {Array.from({ length: maxTeamSize }).map((_, index) => {
                                    const player = tournamentRoster[index];
                                    
                                    return player ? (
                                        <DraggablePlayer
                                            key={player.user_id}
                                            player={player}
                                            index={index}
                                            slotIndex={index}
                                            onMove={handleMove}
                                            isRosterSlot={true}
                                            canDrag={!loading}
                                        />
                                    ) : (
                                        <EmptySlot 
                                            key={`empty-${index}`}
                                            slotIndex={index}
                                            onMove={handleMove}
                                        />
                                    );
                                })}
                            </div>

                            <div className="ctem-roster-stats">
                                <div className="ctem-stat-item">
                                    <span className="ctem-stat-label">Σ FACEIT ELO:</span>
                                    <span className="ctem-stat-value">
                                        {tournamentRoster.reduce((sum, p) => sum + (p.faceit_elo || p.user_faceit_elo || 1200), 0).toLocaleString('ru-RU')}
                                    </span>
                                </div>
                                <div className="ctem-stat-item">
                                    <span className="ctem-stat-label">⌀ FACEIT ELO:</span>
                                    <span className="ctem-stat-value">
                                        {tournamentRoster.length > 0 
                                            ? Math.round(tournamentRoster.reduce((sum, p) => sum + (p.faceit_elo || p.user_faceit_elo || 1200), 0) / tournamentRoster.length)
                                            : 0
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Правая колонка - Доступные игроки */}
                        <div className="ctem-available-column">
                            <h4>📋 Доступные игроки ({availablePlayers.length})</h4>
                            <p className="ctem-column-hint">Из вашей глобальной команды "{globalTeam?.name}"</p>
                            
                            {availablePlayers.length === 0 ? (
                                <div className="ctem-empty-message">
                                    Все игроки из глобальной команды уже в турнирном составе
                                </div>
                            ) : (
                                <div className="ctem-available-players-list">
                                    {availablePlayers.map((player, index) => (
                                        <DraggablePlayer
                                            key={player.user_id}
                                            player={player}
                                            index={index}
                                            onMove={handleMove}
                                            isRosterSlot={false}
                                            canDrag={!loading}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="ctem-modal-footer">
                        <div className="ctem-footer-info">
                            <span>💡 Перетащите игроков между списками для формирования состава</span>
                        </div>
                        <div className="ctem-footer-actions">
                            <button 
                                className="btn btn-secondary"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Отмена
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={loading || tournamentRoster.length === 0}
                            >
                                {loading ? 'Сохранение...' : 'Сохранить состав'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DndProvider>
    );
};

export default CaptainTeamEditModal;

