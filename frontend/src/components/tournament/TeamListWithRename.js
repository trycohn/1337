import React, { useState } from 'react';
import RenameTeamModal from './RenameTeamModal';
import './TeamListWithRename.css';

/**
 * Список команд с возможностью переименования (для организаторов)
 */
function TeamListWithRename({ tournament, teams, isAdminOrCreator, onTeamRenamed }) {
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);

    const handleRenameClick = (team) => {
        setSelectedTeam(team);
        setRenameModalOpen(true);
    };

    const handleRenameSuccess = () => {
        setRenameModalOpen(false);
        setSelectedTeam(null);
        if (onTeamRenamed) {
            onTeamRenamed();
        }
    };

    if (!teams || teams.length === 0) {
        return (
            <div className="teams-empty">
                <p>В турнире пока нет команд</p>
            </div>
        );
    }

    return (
        <>
            <div className="tournament-teams-list">
                <h3>Команды турнира</h3>
                <div className="teams-grid">
                    {teams.map(team => (
                        <div key={team.id} className="team-card">
                            <div className="team-header">
                                <span className="team-name">{team.name}</span>
                                {isAdminOrCreator && (
                                    <button
                                        className="btn-rename"
                                        onClick={() => handleRenameClick(team)}
                                        title="Переименовать команду"
                                    >
                                        ✏️
                                    </button>
                                )}
                            </div>
                            <div className="team-info">
                                <span className="team-members">
                                    👥 {team.member_count || 0} участников
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Модальное окно переименования */}
            {renameModalOpen && selectedTeam && (
                <RenameTeamModal
                    tournament={tournament}
                    team={selectedTeam}
                    onClose={() => {
                        setRenameModalOpen(false);
                        setSelectedTeam(null);
                    }}
                    onSuccess={handleRenameSuccess}
                />
            )}
        </>
    );
}

export default TeamListWithRename;

