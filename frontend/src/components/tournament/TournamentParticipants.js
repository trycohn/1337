import React, { useState, useCallback, useEffect } from 'react';
import TeamGenerator from '../TeamGenerator';
import ParticipantSearchModal from './modals/ParticipantSearchModal';
import ReferralInviteModal from './modals/ReferralInviteModal';
import useTournamentManagement from '../../hooks/tournament/useTournamentManagement';
import './TournamentParticipants.css';

const TournamentParticipants = ({ 
    tournament, 
    user, 
    isAdminOrCreator, 
    originalParticipants, 
    onTeamsGenerated,
    onTournamentUpdate
}) => {
    // Состояния для управления участниками
    const [participantSearchModal, setParticipantSearchModal] = useState(false);
    const [participantSearchQuery, setParticipantSearchQuery] = useState('');
    const [participantSearchResults, setParticipantSearchResults] = useState([]);
    const [isSearchingParticipants, setIsSearchingParticipants] = useState(false);
    const [newParticipantModal, setNewParticipantModal] = useState(false);
    const [newParticipantData, setNewParticipantData] = useState({
        display_name: '',
        email: '',
        faceit_elo: '',
        cs2_premier_rank: ''
    });
    const [message, setMessage] = useState('');
    
    // 🔗 СОСТОЯНИЕ ДЛЯ РЕФЕРАЛЬНОГО МОДАЛЬНОГО ОКНА
    const [referralModal, setReferralModal] = useState(false);

    // Хук для управления турниром
    const tournamentManagement = useTournamentManagement(tournament?.id);

    // Получаем список участников в зависимости от статуса турнира
    const getParticipantsList = useCallback(() => {
        if (tournament?.format === 'mix' && tournament?.status === 'in_progress') {
            // Для микс турниров в процессе показываем оригинальных участников
            console.log('📋 [TournamentParticipants] Используем originalParticipants для микс турнира:', originalParticipants?.length || 0);
            return originalParticipants || [];
        }
        
        console.log('📋 [TournamentParticipants] Используем tournament.participants:', tournament?.participants?.length || 0);
        return tournament?.participants || [];
    }, [tournament, originalParticipants]);

    // Получаем список участников
    const participantsList = getParticipantsList();
    
    // Логируем изменения списка участников
    useEffect(() => {
        console.log('🔄 [TournamentParticipants] Список участников изменился:', {
            count: participantsList.length,
            participants: participantsList.map(p => ({ id: p.id, name: p.name }))
        });
    }, [participantsList]);

    // Поиск пользователей для приглашения
    const searchParticipants = useCallback(async (query) => {
        console.log('🔍 [TournamentParticipants] Поиск участников, запрос:', query);
        
        if (!query || query.trim().length < 3) {
            console.log('🔍 [TournamentParticipants] Запрос слишком короткий');
            setParticipantSearchResults([]);
            return;
        }

        setIsSearchingParticipants(true);
        
        try {
            const result = await tournamentManagement.searchUsers(query.trim());
            
            if (result.success) {
                console.log('🔍 [TournamentParticipants] Поиск успешный, найдено пользователей:', result.data?.length || 0);
                
                // Фильтруем уже добавленных участников
                const existingParticipantIds = getParticipantsList().map(p => p.user_id || p.id);
                const filteredResults = (result.data || []).filter(user => 
                    !existingParticipantIds.includes(user.id)
                );
                
                console.log('🔍 [TournamentParticipants] После фильтрации:', filteredResults.length);
                setParticipantSearchResults(filteredResults);
            } else {
                console.error('🔍 [TournamentParticipants] Ошибка поиска:', result.error);
                setParticipantSearchResults([]);
                setMessage(`❌ Ошибка поиска: ${result.error}`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('❌ [TournamentParticipants] Ошибка поиска участников:', error);
            setParticipantSearchResults([]);
            setMessage('❌ Ошибка при поиске пользователей');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setIsSearchingParticipants(false);
        }
    }, [tournamentManagement, getParticipantsList]);

    // Приглашение зарегистрированного пользователя
    const inviteParticipant = useCallback(async (userId, userName) => {
        try {
            setIsSearchingParticipants(true);
            const result = await tournamentManagement.inviteParticipant(userId);
            
            if (result.success) {
                setMessage(`✅ ${userName} приглашен в турнир`);
                setParticipantSearchModal(false);
                setParticipantSearchQuery('');
                setParticipantSearchResults([]);
                
                // Обновляем данные турнира
                if (onTournamentUpdate) {
                    await onTournamentUpdate();
                }
            } else {
                setMessage(`❌ ${result.message || 'Ошибка при приглашении участника'}`);
            }
        } catch (error) {
            console.error('❌ Ошибка приглашения участника:', error);
            setMessage('❌ Ошибка при приглашении участника');
        } finally {
            setIsSearchingParticipants(false);
            setTimeout(() => setMessage(''), 5000);
        }
    }, [tournamentManagement, onTournamentUpdate]);

    // Добавление незарегистрированного пользователя
    const addUnregisteredParticipant = useCallback(async () => {
        if (!newParticipantData.display_name.trim()) {
            setMessage('❌ Укажите имя участника');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        try {
            const result = await tournamentManagement.addUnregisteredParticipant(newParticipantData);
            
            if (result.success) {
                setMessage(`✅ ${newParticipantData.display_name} добавлен в турнир`);
                setNewParticipantModal(false);
                setNewParticipantData({
                    display_name: '',
                    email: '',
                    faceit_elo: '',
                    cs2_premier_rank: ''
                });
                
                // Обновляем данные турнира
                if (onTournamentUpdate) {
                    await onTournamentUpdate();
                }
            } else {
                setMessage(`❌ ${result.message || 'Ошибка при добавлении участника'}`);
            }
        } catch (error) {
            console.error('❌ Ошибка добавления участника:', error);
            setMessage('❌ Ошибка при добавлении участника');
        } finally {
            setTimeout(() => setMessage(''), 5000);
        }
    }, [tournamentManagement, newParticipantData, onTournamentUpdate]);

    // Удаление участника
    const removeParticipant = useCallback(async (participantId, participantName) => {
        const confirmed = window.confirm(`Вы уверены, что хотите удалить ${participantName} из турнира?`);
        if (!confirmed) return;

        try {
            console.log('🗑️ Удаляем участника:', participantId, participantName);
            const result = await tournamentManagement.removeParticipant(participantId);
            
            if (result.success) {
                setMessage(`✅ ${participantName} удален из турнира`);
                
                // 🚀 МГНОВЕННОЕ ОБНОВЛЕНИЕ СОСТОЯНИЯ - удаляем участника из локального состояния
                // Вызываем обновление данных турнира для синхронизации с parent компонентом
                if (onTournamentUpdate) {
                    // Создаем объект с информацией об удаленном участнике
                    const updateInfo = {
                        action: 'remove_participant',
                        participantId: participantId,
                        participantName: participantName
                    };
                    
                    console.log('🚀 Уведомляем parent компонент об удалении участника');
                    await onTournamentUpdate(updateInfo);
                }
            } else {
                setMessage(`❌ ${result.message || 'Ошибка при удалении участника'}`);
            }
        } catch (error) {
            console.error('❌ Ошибка удаления участника:', error);
            setMessage('❌ Ошибка при удалении участника');
        } finally {
            setTimeout(() => setMessage(''), 5000);
        }
    }, [tournamentManagement, onTournamentUpdate]);

    // Получаем статус пользователя для участия
    const getUserParticipationStatus = useCallback((searchUser) => {
        const participants = getParticipantsList();
        const isParticipant = participants.some(p => 
            (p.user_id && p.user_id === searchUser.id) || 
            (p.id && p.id === searchUser.id)
        );
        
        return isParticipant ? 'participant' : 'available';
    }, [getParticipantsList]);

    // 🆕 Проверка, нужно ли показывать список участников
    const shouldShowParticipantsList = useCallback(() => {
        if (!tournament) return false;
        
        // Для микс турниров ВСЕГДА используем TeamGenerator - он содержит всю необходимую логику
        if (tournament.format === 'mix') {
            return false; // Не показываем стандартные списки, используем только TeamGenerator
        }
        
        // Для всех остальных типов турниров показываем список участников
        return true;
    }, [tournament]);

    return (
        <div className="tournament-participants">
            {message && (
                <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            <div className="participants-header">
                <h3>👥 Участники турнира</h3>
                <div className="participants-count">
                    Участников: {participantsList.length}
                    {tournament?.max_participants && ` / ${tournament.max_participants}`}
                </div>
            </div>

            {/* 🆕 Для микс турниров ВСЕГДА показываем TeamGenerator */}
            {tournament?.format === 'mix' && (
                <div className="team-generator-section">
                    <TeamGenerator
                        tournament={tournament}
                        participants={participantsList}
                        onTeamsGenerated={onTeamsGenerated}
                        onTeamsUpdated={onTournamentUpdate}
                        onRemoveParticipant={removeParticipant}
                        isAdminOrCreator={isAdminOrCreator}
                    />
                </div>
            )}

            {/* Условное отображение списков участников для НЕ-микс турниров */}
            {shouldShowParticipantsList() && (
                <>
                    {/* Список участников для команд */}
                    {tournament?.participant_type === 'team' && (
                        <div className="teams-list">
                            {tournament.teams?.map((team, index) => (
                                <div key={team.id || index} className="team-card">
                                    <div className="team-header">
                                        <div className="team-info">
                                            <h4 className="team-name">{team.name}</h4>
                                            <span className="team-members-count">
                                                {team.members?.length || 0} участников
                                            </span>
                                        </div>
                                        {isAdminOrCreator && (
                                            <button 
                                                className="remove-team-btn"
                                                onClick={() => removeParticipant(team.id, team.name)}
                                                title="Удалить команду"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                    <div className="team-members">
                                        {team.members?.map((member, memberIndex) => (
                                            <div key={member.id || memberIndex} className="team-member">
                                                <div className="member-info">
                                                    {member.avatar_url && (
                                                        <img 
                                                            src={member.avatar_url} 
                                                            alt={member.username}
                                                            className="member-avatar"
                                                        />
                                                    )}
                                                    <span className="member-name">{member.username}</span>
                                                </div>
                                                <div className="member-stats">
                                                    {member.faceit_elo && (
                                                        <span className="stat">FACEIT: {member.faceit_elo}</span>
                                                    )}
                                                    {member.cs2_premier_rank && (
                                                        <span className="stat">CS2: {member.cs2_premier_rank}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Список участников для соло турниров */}
                    {tournament?.participant_type === 'solo' && (
                        <div className="participants-list">
                            {participantsList.map((participant, index) => (
                                <div key={participant.id || index} className="participant-card">
                                    <div className="participant-info">
                                        {participant.avatar_url && (
                                            <img 
                                                src={participant.avatar_url} 
                                                alt={participant.username || participant.name}
                                                className="participant-avatar"
                                            />
                                        )}
                                        <div className="participant-details">
                                            <span className="participant-name">
                                                {participant.username || participant.name || participant.display_name}
                                            </span>
                                            <div className="participant-stats">
                                                {participant.faceit_elo && (
                                                    <span className="stat">FACEIT: {participant.faceit_elo}</span>
                                                )}
                                                {participant.cs2_premier_rank && (
                                                    <span className="stat">CS2: {participant.cs2_premier_rank}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {isAdminOrCreator && (
                                        <button 
                                            className="remove-participant-btn"
                                            onClick={() => removeParticipant(
                                                participant.id, 
                                                participant.username || participant.name || participant.display_name
                                            )}
                                            title="Удалить участника"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Панель управления участниками для администраторов */}
            {isAdminOrCreator && (
                <div className="participants-admin-panel">
                    <h4>⚙️ Управление участниками</h4>
                    <div className="admin-actions">
                        <button 
                            className="invite-participant-btn"
                            onClick={() => setParticipantSearchModal(true)}
                        >
                            👤 Пригласить пользователя
                        </button>
                        <button 
                            className="add-unregistered-btn"
                            onClick={() => setNewParticipantModal(true)}
                        >
                            ➕ Добавить незарегистрированного
                        </button>
                    </div>
                </div>
            )}

            {/* 🔗 КНОПКА ПРИГЛАШЕНИЯ ДРУЗЕЙ - доступна всем авторизованным пользователям */}
            {user && tournament?.status === 'active' && (
                <div className="referral-invite-panel">
                    <h4>👥 Пригласить друзей</h4>
                    <div className="referral-actions">
                        <button 
                            className="invite-referral-btn"
                            onClick={() => setReferralModal(true)}
                            title="Создать реферальную ссылку для приглашения друзей"
                        >
                            🔗 Пригласить друга
                        </button>
                        <p className="referral-description">
                            Поделитесь ссылкой с друзьями и получайте бонусы за каждого нового игрока!
                        </p>
                    </div>
                </div>
            )}

            {/* Модальное окно поиска участников */}
            {participantSearchModal && (
                <ParticipantSearchModal
                    isOpen={participantSearchModal}
                    onClose={() => {
                        setParticipantSearchModal(false);
                        setParticipantSearchQuery('');
                        setParticipantSearchResults([]);
                    }}
                    searchQuery={participantSearchQuery}
                    setSearchQuery={setParticipantSearchQuery}
                    onSearch={searchParticipants}
                    searchResults={participantSearchResults}
                    isSearching={isSearchingParticipants}
                    onInvite={inviteParticipant}
                    getUserStatus={getUserParticipationStatus}
                    mode="participants"
                />
            )}

            {/* Модальное окно добавления незарегистрированного участника */}
            {newParticipantModal && (
                <div className="modal-overlay" onClick={() => setNewParticipantModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>➕ Добавить незарегистрированного участника</h3>
                            <button 
                                className="modal-close"
                                onClick={() => setNewParticipantModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="display_name">Имя участника *</label>
                                <input
                                    type="text"
                                    id="display_name"
                                    value={newParticipantData.display_name}
                                    onChange={(e) => setNewParticipantData(prev => ({
                                        ...prev,
                                        display_name: e.target.value
                                    }))}
                                    placeholder="Введите имя участника"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    value={newParticipantData.email}
                                    onChange={(e) => setNewParticipantData(prev => ({
                                        ...prev,
                                        email: e.target.value
                                    }))}
                                    placeholder="Введите email (необязательно)"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="faceit_elo">FACEIT ELO</label>
                                <input
                                    type="number"
                                    id="faceit_elo"
                                    value={newParticipantData.faceit_elo}
                                    onChange={(e) => setNewParticipantData(prev => ({
                                        ...prev,
                                        faceit_elo: e.target.value
                                    }))}
                                    placeholder="Введите FACEIT ELO"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="cs2_premier_rank">CS2 Premier Rank</label>
                                <input
                                    type="text"
                                    id="cs2_premier_rank"
                                    value={newParticipantData.cs2_premier_rank}
                                    onChange={(e) => setNewParticipantData(prev => ({
                                        ...prev,
                                        cs2_premier_rank: e.target.value
                                    }))}
                                    placeholder="Введите CS2 Premier Rank"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn-secondary"
                                onClick={() => setNewParticipantModal(false)}
                            >
                                Отмена
                            </button>
                            <button 
                                className="btn-primary"
                                onClick={addUnregisteredParticipant}
                                disabled={!newParticipantData.display_name.trim()}
                            >
                                Добавить участника
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно реферальных приглашений */}
            {referralModal && (
                <ReferralInviteModal
                    isOpen={referralModal}
                    onClose={() => setReferralModal(false)}
                    tournament={tournament}
                    user={user}
                />
            )}
        </div>
    );
};

export default TournamentParticipants; 