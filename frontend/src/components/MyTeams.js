import React, { useState, useEffect } from 'react';
import api from '../axios';
import { ensureHttps } from '../utils/userHelpers';
import './MyTeams.css';
import TeamModal from './modals/TeamModal';
import CreateTeamModal from './modals/CreateTeamModal';
import TournamentHistory from './TournamentHistory';

const MyTeams = ({ user }) => {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [invitations, setInvitations] = useState([]);
    const [activeSubTab, setActiveSubTab] = useState('teams'); // teams, history

    // Загрузка команд пользователя
    const fetchTeams = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await api.get('/api/teams/my-teams', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeams(response.data);
        } catch (err) {
            console.error('Ошибка загрузки команд:', err);
            setError('Ошибка загрузки команд');
        } finally {
            setLoading(false);
        }
    };

    // Загрузка приглашений
    const fetchInvitations = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/teams/invitations', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvitations(response.data);
        } catch (err) {
            console.error('Ошибка загрузки приглашений:', err);
        }
    };

    useEffect(() => {
        fetchTeams();
        fetchInvitations();
    }, []);

    // Открыть модалку команды
    const openTeamModal = (team) => {
        setSelectedTeam(team);
        setShowTeamModal(true);
    };

    // Закрыть модалку команды
    const closeTeamModal = () => {
        setSelectedTeam(null);
        setShowTeamModal(false);
    };

    // Открыть модалку создания команды
    const openCreateModal = () => {
        setShowCreateModal(true);
    };

    // Закрыть модалку создания команды
    const closeCreateModal = () => {
        setShowCreateModal(false);
    };

    // Обработка создания команды
    const handleTeamCreated = (newTeam) => {
        setTeams([newTeam, ...teams]);
        closeCreateModal();
    };

    // Обработка обновления команды
    const handleTeamUpdated = (updatedTeam) => {
        setTeams(teams.map(team => 
            team.id === updatedTeam.id ? updatedTeam : team
        ));
    };

    // Обработка удаления команды
    const handleTeamDeleted = (teamId) => {
        setTeams(teams.filter(team => team.id !== teamId));
        closeTeamModal();
    };

    // Ответ на приглашение
    const respondToInvitation = async (invitationId, status) => {
        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/teams/invitations/${invitationId}/respond`, 
                { status }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Обновляем список приглашений
            setInvitations(invitations.filter(inv => inv.id !== invitationId));
            
            // Если приглашение принято, обновляем список команд
            if (status === 'accepted') {
                fetchTeams();
            }
        } catch (err) {
            console.error('Ошибка ответа на приглашение:', err);
            setError('Ошибка при ответе на приглашение');
        }
    };

    if (loading) {
        return <div className="MT-teams-loading">Загрузка команд...</div>;
    }

    return (
        <div className="MT-my-teams">
            {error && (
                <div className="MT-error-message">
                    {error}
                    <button onClick={() => setError('')}>✕</button>
                </div>
            )}

            {/* Sub-tabs Navigation */}
            <div className="MT-my-teams-tabs">
                <button 
                    className={`MT-my-teams-tab ${activeSubTab === 'teams' ? 'MT-active' : ''}`}
                    onClick={() => setActiveSubTab('teams')}
                >
                    <span className="MT-tab-icon">⚔️</span>
                    <span className="MT-tab-text">Мои команды</span>
                    {teams.length > 0 && <span className="MT-tab-count">{teams.length}</span>}
                </button>
                <button 
                    className={`MT-my-teams-tab ${activeSubTab === 'history' ? 'MT-active' : ''}`}
                    onClick={() => setActiveSubTab('history')}
                >
                    <span className="MT-tab-icon">🏆</span>
                    <span className="MT-tab-text">История турниров</span>
                </button>
            </div>

            {/* Tab Content */}
            {activeSubTab === 'teams' && (
                <>
                    {/* Приглашения в команды */}
                    {invitations.length > 0 && (
                <div className="MT-team-invitations">
                    <h3>Приглашения в команды</h3>
                    {invitations.map(invitation => (
                        <div key={invitation.id} className="MT-invitation-card">
                            <div className="MT-invitation-info">
                                <div className="MT-team-info">
                                    {invitation.team_avatar && (
                                        <img 
                                            src={ensureHttps(invitation.team_avatar)} 
                                            alt={invitation.team_name}
                                            className="MT-team-avatar-small"
                                        />
                                    )}
                                    <div>
                                        <h4>{invitation.team_name}</h4>
                                        <p>от {invitation.inviter_username}</p>
                                        {invitation.message && (
                                            <p className="MT-invitation-message">"{invitation.message}"</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="MT-invitation-actions">
                                <button 
                                    className="MT-accept-btn"
                                    onClick={() => respondToInvitation(invitation.id, 'accepted')}
                                >
                                    Принять
                                </button>
                                <button 
                                    className="MT-reject-btn"
                                    onClick={() => respondToInvitation(invitation.id, 'rejected')}
                                >
                                    Отклонить
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Заголовок и кнопка создания */}
            <div className="MT-teams-header">
                <h2>Мои команды</h2>
                <button className="btn btn-secondary" onClick={openCreateModal}>
                    + Создать команду
                </button>
            </div>

            {/* Список команд */}
            <div className="MT-teams-grid">
                {teams.length === 0 ? (
                    <div className="MT-no-teams">
                        <p>У вас пока нет команд</p>
                    </div>
                ) : (
                    teams.map(team => (
                        <div 
                            key={team.id} 
                            className="MT-my-team-card"
                            onClick={() => openTeamModal(team)}
                        >
                            <div className="MT-my-team-header">
                                <div className="MT-my-team-avatar-container">
                                    {team.avatar_url ? (
                                        <img 
                                            src={ensureHttps(team.avatar_url)} 
                                            alt={team.name}
                                            className="MT-team-avatar"
                                        />
                                    ) : (
                                        <div className="MT-my-team-avatar-placeholder">
                                            {team.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="MT-team-info">
                                    <h3 className="MT-my-team-name">{team.name}</h3>
                                    <div className="MT-my-team-badges">
                                        {team.is_captain && (
                                            <span className="MT-captain-badge">Капитан</span>
                                        )}
                                        {!team.is_permanent && (
                                            <span className="MT-temporary-badge">Разовая</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="MT-my-team-members">
                                <div className="MT-my-members-list">
                                    {team.members.slice(0, 4).map(member => (
                                        <div key={member.id} className="MT-my-team-member-item">
                                            <div className="MT-my-team-member-avatar">
                                                {member.avatar_url ? (
                                                    <img 
                                                        src={ensureHttps(member.avatar_url)} 
                                                        alt={member.username}
                                                    />
                                                ) : (
                                                    <div className="MT-my-team-avatar-placeholder">
                                                        {member.username.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="MT-my-team-member-name">
                                                {member.username}
                                                {member.role === 'captain' && ' 👑'}
                                            </span>
                                        </div>
                                    ))}
                                    {team.member_count > 4 && (
                                        <div className="MT-my-more-members">
                                            +{team.member_count - 4} еще
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
                </>
            )}

            {/* History Tab */}
            {activeSubTab === 'history' && (
                <TournamentHistory userId={user?.id} />
            )}

            {/* Модальные окна */}
            {showTeamModal && selectedTeam && (
                <TeamModal
                    team={selectedTeam}
                    onClose={closeTeamModal}
                    onTeamUpdated={handleTeamUpdated}
                    onTeamDeleted={handleTeamDeleted}
                    currentUser={user}
                />
            )}

            {showCreateModal && (
                <CreateTeamModal
                    onClose={closeCreateModal}
                    onTeamCreated={handleTeamCreated}
                />
            )}
        </div>
    );
};

export default MyTeams; 