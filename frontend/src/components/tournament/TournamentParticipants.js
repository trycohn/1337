import React, { useState, useCallback, useEffect } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown } from '@fortawesome/free-solid-svg-icons';
// TeamGenerator рендерится в TournamentDetails (первым блоком)
import ParticipantSearchModal from './modals/ParticipantSearchModal';
import ReferralInviteModal from './modals/ReferralInviteModal';
import TeamEditModal from './modals/TeamEditModal';
import WaitingListPanel from './WaitingListPanel';
import useTournamentManagement from '../../hooks/tournament/useTournamentManagement';
import './TournamentParticipants.css';
import { getAvatarCategoryClass } from '../../utils/avatarCategory';
const byPrefixAndName = { fas: { crown: faCrown } };

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
    const [showPlayersList, setShowPlayersList] = useState(false);
    const [teamPlayers, setTeamPlayers] = useState([{ nickname: '' }]);
    
    // 🔗 СОСТОЯНИЕ ДЛЯ РЕФЕРАЛЬНОГО МОДАЛЬНОГО ОКНА
    const [referralModal, setReferralModal] = useState(false);
    
    // 🔧 СОСТОЯНИЕ ДЛЯ МОДАЛКИ РЕДАКТИРОВАНИЯ КОМАНДЫ
    const [teamEditModal, setTeamEditModal] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);

    // Хук для управления турниром
    const tournamentManagement = useTournamentManagement(tournament?.id);

    // 🔗 Реферальный интент: открыть модалку после авторизации
    useEffect(() => {
        const token = localStorage.getItem('token');
        const intent = localStorage.getItem('referralIntent');
        const intentTournamentId = localStorage.getItem('referralIntentTournamentId');

        if (token && intent === '1' && intentTournamentId && String(intentTournamentId) === String(tournament?.id)) {
            setReferralModal(true);
            localStorage.removeItem('referralIntent');
            localStorage.removeItem('referralIntentTournamentId');
        }
    }, [tournament?.id, user?.id]);

    // 🔗 Клик по «Пригласить друзей»: неавторизованному — предложить вход в новом окне
    const handleReferralInviteClick = useCallback(() => {
        if (!tournament?.id) return;

        if (!user) {
            const agreed = window.confirm('Чтобы создать реферальную ссылку, необходимо войти в аккаунт. Открыть авторизацию в новом окне?');
            if (!agreed) return;

            // Запоминаем интент и турнир, чтобы после входа автоматически открыть модалку
            localStorage.setItem('referralIntent', '1');
            localStorage.setItem('referralIntentTournamentId', String(tournament.id));
            localStorage.setItem('returnToTournament', String(tournament.id));
            localStorage.setItem('tournamentAction', 'referral');

            // Открываем окно авторизации. Передаем подсказочные параметры (если страница логина их поддерживает)
            const loginUrl = `/login?action=referral&tournamentId=${encodeURIComponent(tournament.id)}&redirect=${encodeURIComponent(`/tournaments/${tournament.id}?referral_intent=1`)}`;
            window.open(loginUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        setReferralModal(true);
    }, [user, tournament?.id]);

    // Получаем список участников в зависимости от статуса турнира
    const getParticipantsList = useCallback(() => {
        // Для MIX турниров показываем соло‑список из originalParticipants, если он передан; иначе — из tournament.participants
        if (tournament?.format === 'mix') {
            const base = Array.isArray(originalParticipants) && originalParticipants.length > 0
                ? originalParticipants
                : (tournament?.participants || []);
            console.log('📋 [TournamentParticipants] MIX — показываем соло список:', base.length);
            return base;
        }

        console.log('📋 [TournamentParticipants] НЕ-MIX — используем tournament.participants:', tournament?.participants?.length || 0);
        return tournament?.participants || [];
    }, [tournament, originalParticipants]);

    // Получаем список участников
    const participantsList = getParticipantsList();
    const isMixFormat = (tournament?.format === 'mix');
    const isLoadingInitial = !tournament || (
        isMixFormat
            ? !Array.isArray(participantsList)
            : (tournament?.participant_type === 'team')
                ? !Array.isArray(tournament?.teams)
                : !Array.isArray(participantsList)
    );
    const skeletonRows = 3;
    
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
                const participantUserIds = new Set(
                    (getParticipantsList() || [])
                        .map(p => Number(p.user_id))
                        .filter(Boolean)
                );
                const teamMemberUserIds = new Set(
                    (tournament?.teams || [])
                        .flatMap(team => (team.members || []))
                        .map(m => Number(m.user_id))
                        .filter(Boolean)
                );
                const existingUserIds = new Set([...participantUserIds, ...teamMemberUserIds]);
                const filteredResults = (result.data || []).filter(u => !existingUserIds.has(Number(u.id)));
                
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
    }, [tournamentManagement, getParticipantsList, tournament]);

    // Приглашение зарегистрированного пользователя
    const inviteParticipant = useCallback(async (userId, userName) => {
        try {
            setIsSearchingParticipants(true);
            console.log('📧 [TournamentParticipants] Приглашаем участника:', { userId, userName });
            const result = await tournamentManagement.inviteParticipant(userId, userName);
            
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

    // Добавление незарегистрированного пользователя/команды
    const addUnregisteredParticipant = useCallback(async () => {
        const isTeamTournament = tournament?.participant_type === 'team';
        const entityName = isTeamTournament ? 'команду' : 'участника';
        
        if (!newParticipantData.display_name.trim()) {
            setMessage(`❌ Укажите ${isTeamTournament ? 'название команды' : 'имя участника'}`);
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        console.log('🔍 [TournamentParticipants] addUnregisteredParticipant вызван:', {
            tournament: tournament?.participant_type,
            isTeamTournament,
            data: newParticipantData
        });

        try {
            if (isTeamTournament) {
                // Для командных турниров используем новый API
                console.log('🎯 [TournamentParticipants] Добавляем команду через /add-team');
                
                const token = localStorage.getItem('token');
                
                // Собираем игроков если указаны
                const players = showPlayersList 
                    ? teamPlayers.map(p => p.nickname.trim()).filter(n => n.length > 0)
                    : [];
                
                const payload = {
                    teamName: newParticipantData.display_name.trim(),
                    players
                };
                
                console.log('📡 [TournamentParticipants] Отправляем команду:', payload);
                
                const response = await fetch(`/api/tournaments/${tournament.id}/add-team`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    setMessage(`✅ Команда "${newParticipantData.display_name}" добавлена в турнир`);
                    setNewParticipantModal(false);
                    setNewParticipantData({
                        display_name: '',
                        email: '',
                        faceit_elo: '',
                        cs2_premier_rank: ''
                    });
                    setShowPlayersList(false);
                    setTeamPlayers([{ nickname: '' }]);
                    
                    if (onTournamentUpdate) {
                        await onTournamentUpdate();
                    }
                } else {
                    setMessage(`❌ ${data.error || 'Ошибка при добавлении команды'}`);
                }
            } else {
                // Для solo турниров используем существующий метод
                console.log('🎯 [TournamentParticipants] Добавляем участника через /add-participant');
                
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
            }
        } catch (error) {
            console.error('❌ Ошибка добавления:', error);
            setMessage(`❌ Ошибка при добавлении ${entityName}`);
        } finally {
            setTimeout(() => setMessage(''), 5000);
        }
    }, [tournamentManagement, newParticipantData, onTournamentUpdate, tournament]);

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
        // Всегда показываем список участников для любых турниров, где он применим
        return true;
    }, [tournament]);

    const statusNormalized = (tournament?.status || '').toString().trim().toLowerCase();
    const isActive = statusNormalized === 'active';
    const isFullMix = tournament?.format === 'mix' && (tournament?.mix_type || '').toLowerCase() === 'full';

    return (
        <div className="tournament-participants">
            {message && (
                <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            {/* Двухколоночный режим для MIX (classic и full): слева — участники, справа — TeamGenerator */}
            {tournament?.format === 'mix' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16 }}>
                    <div>
                        <SkeletonTheme baseColor="#2a2a2a" highlightColor="#3a3a3a">
                        <>
                            {/* Список участников для соло турниров */}
                            {tournament?.participant_type === 'solo' && (
                                <div className="participants-list-participants">
                                    {(isLoadingInitial ? [...Array(skeletonRows)] : participantsList).map((participant, index) => (
                                        <div key={participant?.id || index} className="participant-card-participants">
                                            <div className="participant-info-participants">
                                                {isLoadingInitial ? (
                                                    <>
                                                        <div className="skeleton-avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1a1a' }} />
                                                        <div className="participant-details-participants" style={{ marginLeft: 10 }}>
                                                            <span className="participant-name-participants"><Skeleton width={160} height={16} /></span>
                                                            <div className="participant-stats-participants"><Skeleton width={120} height={12} /></div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {participant.avatar_url && (
                                                            <img 
                                                                src={participant.avatar_url}
                                                                alt={participant.username || participant.name}
                                                                className={`participant-avatar-participants ${getAvatarCategoryClass(participant.avatar_url)}`}
                                                            />
                                                        )}
                                                        <div className="participant-details-participants">
                                                            <span className="participant-name-participants">
                                                                {participant.user_id ? (
                                                                    <a href={`/user/${participant.user_id}`} className="member-link-participants">
                                                                        {participant.username || participant.name || participant.display_name}
                                                                    </a>
                                                                ) : (
                                                                    participant.username || participant.name || participant.display_name
                                                                )}
                                                            </span>
                                                            <div className="participant-stats-participants">
                                                                {participant.faceit_elo && (
                                                                    <span className="stat">FACEIT: {participant.faceit_elo}</span>
                                                                )}
                                                                {participant.cs2_premier_rank && (
                                                                    <span className="stat">CS2: {participant.cs2_premier_rank}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            {isActive && isAdminOrCreator && (
                                                <button 
                                                    className="remove-participant-btn-participants"
                                                    onClick={() => !isLoadingInitial && removeParticipant(
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
                        </SkeletonTheme>
                    </div>
                    {/* TeamGenerator удален из этого места, рендерится выше в TournamentDetails */}
                </div>
            )}

            {/* Прежний режим для НЕ-MIX */}
            {tournament?.format !== 'mix' && shouldShowParticipantsList() && (
                <SkeletonTheme baseColor="#2a2a2a" highlightColor="#3a3a3a">
                <>
                    {/* MIX (classic): только соло‑список */}
                    {tournament?.format === 'mix' && (
                        <div className="participants-list-participants">
                            {(isLoadingInitial ? [...Array(skeletonRows)] : participantsList).map((participant, index) => (
                                <div key={participant?.id || index} className="participant-card-participants">
                                    <div className="participant-info-participants">
                                        {isLoadingInitial ? (
                                            <>
                                                <div className="skeleton-avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1a1a' }} />
                                                <div className="participant-details-participants" style={{ marginLeft: 10 }}>
                                                    <span className="participant-name-participants"><Skeleton width={160} height={16} /></span>
                                                    <div className="participant-stats-participants"><Skeleton width={120} height={12} /></div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {participant.avatar_url && (
                                                    <img 
                                                        src={participant.avatar_url}
                                                        alt={participant.username || participant.name}
                                                        className={`participant-avatar-participants ${getAvatarCategoryClass(participant.avatar_url)}`}
                                                    />
                                                )}
                                                <div className="participant-details-participants">
                                                    <span className="participant-name-participants">
                                                        {participant.user_id ? (
                                                            <a href={`/user/${participant.user_id}`} className="member-link-participants">
                                                                {participant.username || participant.name || participant.display_name}
                                                            </a>
                                                        ) : (
                                                            participant.username || participant.name || participant.display_name
                                                        )}
                                                    </span>
                                                    <div className="participant-stats-participants">
                                                        {participant.faceit_elo && (
                                                            <span className="stat">FACEIT: {participant.faceit_elo}</span>
                                                        )}
                                                        {participant.cs2_premier_rank && (
                                                            <span className="stat">CS2: {participant.cs2_premier_rank}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {isActive && isAdminOrCreator && (
                                        <button 
                                            className="remove-participant-btn-participants"
                                            onClick={() => !isLoadingInitial && removeParticipant(
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

                    {/* НЕ-MIX: прежняя логика */}
                    {tournament?.format !== 'mix' && tournament?.participant_type === 'team' && (
                        <div className="teams-list-participants">
                            {(isLoadingInitial ? [...Array(skeletonRows)] : tournament.teams)?.map((team, index) => (
                                <div key={team?.id || index} className="team-card-participants">
                                    <div className="team-header-participants">
                                        <div className="team-info-participants">
                                            <h4 className="team-name-participants">
                                                {isLoadingInitial ? (
                                                    <Skeleton width={160} height={18} />
                                                ) : team.id ? (
                                                    <a href={`/teams/${team.id}`} className="team-name-link-participants">{team.name}</a>
                                                ) : (
                                                    team.name
                                                )}
                                            </h4>
                                            <span className="team-members-count-participants">
                                                {isLoadingInitial ? <Skeleton width={100} height={14} /> : `${team.members?.length || 0} участников`}
                                            </span>
                                        </div>
                                        {isAdminOrCreator && (
                                            <div className="team-actions-participants">
                                                <button 
                                                    className="btn btn-secondary"
                                                    onClick={() => {
                                                        if (!isLoadingInitial) {
                                                            setSelectedTeam(team);
                                                            setTeamEditModal(true);
                                                        }
                                                    }}
                                                    title="Редактировать состав команды"
                                                >
                                                    ✏️
                                                </button>
                                                <button 
                                                    className="btn btn-secondary"
                                                    onClick={() => !isLoadingInitial && removeParticipant(team.id, team.name)}
                                                    title="Удалить команду"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="team-members-participants">
                                        {(isLoadingInitial ? [...Array(3)] : team.members)?.map((member, memberIndex) => (
                                            <div key={member?.id || memberIndex} className="team-member-participants">
                                                <div className="member-info-participants">
                                                    {isLoadingInitial ? (
                                                        <>
                                                            <div className="skeleton-avatar" style={{ width: 24, height: 24, borderRadius: '50%', background: '#1a1a1a' }} />
                                                            <span className="member-name-participants" style={{ marginLeft: 10 }}>
                                                                <Skeleton width={140} height={14} />
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <img 
                                                                src={member.avatar_url || '/uploads/avatars/preloaded/circle-user.svg'} 
                                                                alt={member.display_name || member.name || member.username}
                                                                className={`member-avatar-participants ${getAvatarCategoryClass(member.avatar_url)}`}
                                                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/uploads/avatars/preloaded/circle-user.svg'; }}
                                                            />
                                                            <span className="member-name-participants">
                                                                {member.user_id ? (
                                                                    <a href={`/user/${member.user_id}`} className="member-link-participants">
                                                                        {member.display_name || member.name || member.username}
                                                                    </a>
                                                                ) : (
                                                                    member.display_name || member.name || member.username
                                                                )}
                                                                {member.is_captain && (
                                                                    <span className="captain-icon-participants" title="Капитан">
                                                                        <FontAwesomeIcon icon={byPrefixAndName.fas['crown']} />
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="member-stats-participants">
                                                    {isLoadingInitial ? (
                                                        <Skeleton width={120} height={12} />
                                                    ) : (
                                                        <>
                                                            {member.faceit_elo && (
                                                                <span className="stat">FACEIT: {member.faceit_elo}</span>
                                                            )}
                                                            {member.cs2_premier_rank && (
                                                                <span className="stat">CS2: {member.cs2_premier_rank}</span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {tournament?.format !== 'mix' && tournament?.participant_type === 'solo' && (
                        <div className="participants-list-participants">
                            {(isLoadingInitial ? [...Array(skeletonRows)] : participantsList).map((participant, index) => (
                                <div key={participant?.id || index} className="participant-card-participants">
                                    <div className="participant-info-participants">
                                        {isLoadingInitial ? (
                                            <>
                                                <div className="skeleton-avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1a1a' }} />
                                                <div className="participant-details-participants" style={{ marginLeft: 10 }}>
                                                    <span className="participant-name-participants"><Skeleton width={160} height={16} /></span>
                                                    <div className="participant-stats-participants"><Skeleton width={120} height={12} /></div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {participant.avatar_url && (
                                                    <img 
                                                        src={participant.avatar_url}
                                                        alt={participant.username || participant.name}
                                                        className={`participant-avatar-participants ${getAvatarCategoryClass(participant.avatar_url)}`}
                                                    />
                                                )}
                                                <div className="participant-details-participants">
                                                    <span className="participant-name-participants">
                                                        {participant.user_id ? (
                                                            <a href={`/user/${participant.user_id}`} className="member-link-participants">
                                                                {participant.username || participant.name || participant.display_name}
                                                            </a>
                                                        ) : (
                                                            participant.username || participant.name || participant.display_name
                                                        )}
                                                    </span>
                                                    <div className="participant-stats-participants">
                                                        {participant.faceit_elo && (
                                                            <span className="stat">FACEIT: {participant.faceit_elo}</span>
                                                        )}
                                                        {participant.cs2_premier_rank && (
                                                            <span className="stat">CS2: {participant.cs2_premier_rank}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {isActive && isAdminOrCreator && (
                                        <button 
                                            className="remove-participant-btn-participants"
                                            onClick={() => !isLoadingInitial && removeParticipant(
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
                </SkeletonTheme>
            )}

            {/* Панель управления участниками для администраторов — скрыта если турнир идёт или завершён */}
            {isActive && isAdminOrCreator && (
                <div className="participants-admin-panel">
                    <h4>Управление участниками</h4>
                    <div className="admin-actions">
                        <button 
                            className="btn btn-secondary"
                            onClick={() => setParticipantSearchModal(true)}
                        >
                            Пригласить пользователя
                        </button>
                        <button 
                            className="btn btn-secondary"
                            onClick={() => setNewParticipantModal(true)}
                        >
                            Добавить незарегистрированного
                        </button>
                    </div>
                </div>
            )}

            {/* 🔗 КНОПКА ПРИГЛАШЕНИЯ ДРУЗЕЙ - скрыта для закрытых и финальных турниров */}
            {tournament?.status === 'active' && tournament?.access_type !== 'closed' && !tournament?.is_series_final && (
                <div className="referral-invite-panel">
                    <h4>Пригласить друзей</h4>
                    <div className="referral-actions">
                        <button 
                            className="btn btn-secondary"
                            onClick={handleReferralInviteClick}
                            title="Создать реферальную ссылку для приглашения друзей"
                        >
                            Зови друзей — делите бонусы
                        </button>
                        <p className="referral-description">
                            {user 
                                ? 'Поделитесь ссылкой с друзьями и получайте бонусы за каждого нового игрока!'
                                : 'Войдите и получите персональную ссылку, чтобы пригласить друзей!'}
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
                    existingParticipants={getParticipantsList()}
                    getUserStatus={getUserParticipationStatus}
                    mode="participants"
                />
            )}

            {/* Модальное окно добавления незарегистрированного участника */}
            {newParticipantModal && (
                <div className="modal-overlay" onClick={() => setNewParticipantModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>➕ Добавить {tournament?.participant_type === 'team' ? 'незарегистрированную команду' : 'незарегистрированного участника'}</h3>
                            <button 
                                className="modal-close"
                                onClick={() => {
                                    setNewParticipantModal(false);
                                    setShowPlayersList(false);
                                    setTeamPlayers([{ nickname: '' }]);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="display_name">{tournament?.participant_type === 'team' ? 'Название команды' : 'Имя участника'} *</label>
                                <input
                                    type="text"
                                    id="display_name"
                                    value={newParticipantData.display_name}
                                    onChange={(e) => setNewParticipantData(prev => ({
                                        ...prev,
                                        display_name: e.target.value
                                    }))}
                                    placeholder={tournament?.participant_type === 'team' ? 'Введите название команды' : 'Введите имя участника'}
                                    required
                                />
                            </div>
                            
                            {/* Для командных турниров - добавление игроков */}
                            {tournament?.participant_type === 'team' && (
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={showPlayersList}
                                            onChange={(e) => {
                                                setShowPlayersList(e.target.checked);
                                                if (!e.target.checked) {
                                                    setTeamPlayers([{ nickname: '' }]);
                                                }
                                            }}
                                        />
                                        <span style={{ marginLeft: '8px' }}>Указать игроков команды?</span>
                                    </label>

                                    {showPlayersList && (
                                        <div style={{ marginTop: '12px' }}>
                                            {teamPlayers.map((player, index) => (
                                                <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={player.nickname}
                                                        onChange={(e) => {
                                                            const updated = [...teamPlayers];
                                                            updated[index] = { nickname: e.target.value };
                                                            setTeamPlayers(updated);
                                                        }}
                                                        placeholder={`Ник игрока ${index + 1}`}
                                                        style={{ flex: 1 }}
                                                    />
                                                    {teamPlayers.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setTeamPlayers(teamPlayers.filter((_, i) => i !== index))}
                                                            style={{
                                                                padding: '8px 12px',
                                                                background: '#ff0000',
                                                                color: '#fff',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setTeamPlayers([...teamPlayers, { nickname: '' }])}
                                                style={{
                                                    padding: '8px 12px',
                                                    background: '#111',
                                                    color: '#fff',
                                                    border: '1px solid #ff0000',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    marginTop: '4px'
                                                }}
                                            >
                                                ➕ Добавить игрока
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
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
                                Добавить {tournament?.participant_type === 'team' ? 'команду' : 'участника'}
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

            {/* Модальное окно редактирования команды */}
            {teamEditModal && selectedTeam && (
                <TeamEditModal
                    isOpen={teamEditModal}
                    onClose={() => {
                        setTeamEditModal(false);
                        setSelectedTeam(null);
                    }}
                    team={selectedTeam}
                    tournament={tournament}
                    onTeamUpdated={onTournamentUpdate}
                />
            )}

            {/* Панель листа ожидания */}
            {tournament?.waiting_list_enabled && (
                <WaitingListPanel
                    tournament={tournament}
                    user={user}
                    isAdminOrCreator={isAdminOrCreator}
                    onUpdate={onTournamentUpdate}
                />
            )}
        </div>
    );
};

export default TournamentParticipants; 