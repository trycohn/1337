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
            style={{ 
                opacity: isDragging ? 0.5 : 1,
                cursor: canDrag ? 'grab' : 'not-allowed'
            }}
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

// Зона удаления игрока
const RemoveZone = ({ onMove }) => {
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: ItemTypes.PLAYER,
        drop: (item) => {
            if (onMove && item.isFromRoster) {
                onMove(item, { isRemoveSlot: true });
            }
        },
        canDrop: (item) => item.isFromRoster, // Можно удалять только из ростера
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop()
        })
    });

    return (
        <div
            ref={drop}
            className={`ctem-remove-zone ${isOver && canDrop ? 'ctem-remove-active' : ''}`}
        >
            <div className="ctem-remove-icon">🗑️</div>
            <span className="ctem-remove-text">
                {isOver && canDrop ? 'Отпустите для удаления' : 'Перетащите сюда для удаления из состава'}
            </span>
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
    
    // Поиск и приглашение игроков
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [sentInvitations, setSentInvitations] = useState([]);

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
                // Включаем всех участников, включая капитана
                setTournamentRoster(rosterResponse.data.members || []);
            }

            if (globalResponse.data.success) {
                setAvailablePlayers(globalResponse.data.availablePlayers || []);
                setGlobalTeam(globalResponse.data.globalTeam);
                setMaxTeamSize(globalResponse.data.maxTeamSize || 5);
            }

            // Загружаем отправленные приглашения
            const invitationsResponse = await api.get(
                `/api/tournaments/${tournament.id}/teams/${team.id}/invitations`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (invitationsResponse.data.success) {
                setSentInvitations(invitationsResponse.data.invitations || []);
            }

        } catch (err) {
            console.error('Ошибка загрузки данных:', err);
            setError(err.response?.data?.error || 'Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    };

    // Поиск игроков
    const searchUsers = async (query) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            setIsSearching(true);
            const token = localStorage.getItem('token');
            const response = await api.get(
                `/api/users/search?query=${encodeURIComponent(query)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Фильтруем уже добавленных и приглашенных
            const rosterUserIds = new Set(tournamentRoster.map(p => p.user_id));
            const invitedUserIds = new Set(sentInvitations.filter(inv => inv.status === 'pending').map(inv => inv.invited_user_id));
            
            console.log('🔍 [CaptainTeamEdit] Результаты поиска:', {
                total: response.data.length,
                rosterUserIds: Array.from(rosterUserIds),
                invitedUserIds: Array.from(invitedUserIds),
                currentUser: user?.id
            });
            
            const filtered = response.data.filter(searchUser => 
                !rosterUserIds.has(searchUser.id) && 
                !invitedUserIds.has(searchUser.id) &&
                searchUser.id !== user?.id
            );
            
            console.log('✅ [CaptainTeamEdit] После фильтрации:', filtered.length, filtered.map(u => u.username));
            
            setSearchResults(filtered);
        } catch (err) {
            console.error('Ошибка поиска:', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Отправить приглашение
    const handleSendInvitation = async (userId, username) => {
        try {
            setError('');
            const token = localStorage.getItem('token');
            
            const response = await api.post(
                `/api/tournaments/${tournament.id}/teams/${team.id}/invite`,
                { userId, message: `Приглашаем вас в команду ${team.name}` },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setSuccess(`✅ Приглашение отправлено ${username}`);
                setTimeout(() => setSuccess(''), 3000);
                setSearchQuery('');
                setSearchResults([]);
                
                // Обновляем список приглашений
                const invitationsResponse = await api.get(
                    `/api/tournaments/${tournament.id}/teams/${team.id}/invitations`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                if (invitationsResponse.data.success) {
                    setSentInvitations(invitationsResponse.data.invitations || []);
                }
            }
        } catch (err) {
            console.error('Ошибка отправки приглашения:', err);
            setError(err.response?.data?.error || 'Ошибка при отправке приглашения');
        }
    };

    // Отменить приглашение
    const handleCancelInvitation = async (invitationId) => {
        try {
            const token = localStorage.getItem('token');
            
            await api.delete(
                `/api/tournaments/team-invitations/${invitationId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSuccess('✅ Приглашение отменено');
            setTimeout(() => setSuccess(''), 3000);
            
            // Обновляем список
            setSentInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        } catch (err) {
            console.error('Ошибка отмены приглашения:', err);
            setError(err.response?.data?.error || 'Ошибка при отмене приглашения');
        }
    };

    // Поиск с задержкой
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length >= 2) {
                searchUsers(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, tournamentRoster, sentInvitations]);

    // Обработка перемещения игрока
    const handleMove = useCallback((draggedItem, dropTarget) => {
        const { player: draggedPlayer, isFromRoster: dragFromRoster } = draggedItem;
        const { player: targetPlayer, isRosterSlot: dropToRoster, isRemoveSlot } = dropTarget;

        console.log('🔄 Перемещение игрока:', {
            from: dragFromRoster ? 'roster' : 'available',
            to: isRemoveSlot ? 'remove' : dropToRoster ? 'roster' : 'available',
            draggedPlayer: draggedPlayer?.username,
            targetPlayer: targetPlayer?.username
        });

        // Удаление из состава
        if (isRemoveSlot && dragFromRoster) {
            setTournamentRoster(prev => prev.filter(p => p.user_id !== draggedPlayer.user_id));
            return;
        }

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
            // Фильтруем капитана - он управляется на backend автоматически
            const memberUserIds = tournamentRoster
                .filter(p => !p.is_captain)
                .map(p => p.user_id);

            console.log('💾 [CaptainTeamEdit] Сохранение состава:', {
                total: tournamentRoster.length,
                withoutCaptain: memberUserIds.length,
                userIds: memberUserIds
            });

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
                                            canDrag={!loading && !player.is_captain}
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

                            {/* 🗑️ Зона удаления игроков */}
                            <RemoveZone onMove={handleMove} />
                        </div>

                        {/* Правая колонка - Доступные игроки и приглашения */}
                        <div className="ctem-available-column">
                            {/* Доступные из глобальной команды */}
                            {globalTeam && (
                                <>
                                    <h4>📋 Доступные игроки ({availablePlayers.length})</h4>
                                    <p className="ctem-column-hint">Из вашей глобальной команды "{globalTeam?.name}"</p>
                                    
                                    {availablePlayers.length === 0 ? (
                                        <div className="ctem-empty-message-small">
                                            Все игроки из глобальной команды уже в составе
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
                                    
                                    <div className="ctem-divider"></div>
                                </>
                            )}
                            
                            {/* Поиск и приглашение игроков */}
                            <h4>➕ Пригласить игрока</h4>
                            <p className="ctem-column-hint">Поиск зарегистрированных игроков</p>
                            
                            <div className="ctem-search-section">
                                <input
                                    type="text"
                                    className="ctem-search-input"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Введите имя игрока..."
                                    disabled={loading}
                                />
                                
                                {isSearching && <div className="ctem-searching">Поиск...</div>}
                                
                                {searchResults.length > 0 && (
                                    <div className="ctem-search-results">
                                        {searchResults.map(user => (
                                            <div key={user.id} className="ctem-search-result-item">
                                                <div className="ctem-user-info">
                                                    <img 
                                                        src={ensureHttps(user.avatar_url) || '/uploads/avatars/preloaded/circle-user.svg'}
                                                        alt={user.username}
                                                        className="ctem-search-avatar"
                                                        onError={(e) => { e.currentTarget.src = '/uploads/avatars/preloaded/circle-user.svg'; }}
                                                    />
                                                    <div className="ctem-search-details">
                                                        <span className="ctem-search-name">{user.username}</span>
                                                        <span className="ctem-search-elo">FACEIT: {user.faceit_elo || 1200}</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    className="ctem-invite-btn"
                                                    onClick={() => handleSendInvitation(user.id, user.username)}
                                                    disabled={loading}
                                                >
                                                    📧
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Отправленные приглашения */}
                            {sentInvitations.filter(inv => inv.status === 'pending').length > 0 && (
                                <div className="ctem-invitations-list">
                                    <h5 className="ctem-invitations-title">Отправленные приглашения:</h5>
                                    {sentInvitations.filter(inv => inv.status === 'pending').map(inv => (
                                        <div key={inv.id} className="ctem-invitation-item">
                                            <div className="ctem-invitation-info">
                                                <img 
                                                    src={ensureHttps(inv.invited_avatar) || '/uploads/avatars/preloaded/circle-user.svg'}
                                                    alt={inv.invited_username}
                                                    className="ctem-invitation-avatar"
                                                    onError={(e) => { e.currentTarget.src = '/uploads/avatars/preloaded/circle-user.svg'; }}
                                                />
                                                <span className="ctem-invitation-name">{inv.invited_username}</span>
                                            </div>
                                            <button 
                                                className="ctem-cancel-btn"
                                                onClick={() => handleCancelInvitation(inv.id)}
                                                disabled={loading}
                                                title="Отменить приглашение"
                                            >
                                                ❌
                                            </button>
                                        </div>
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

