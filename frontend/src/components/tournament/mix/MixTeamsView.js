import React from 'react';
import MixTeamCard from './MixTeamCard';

function MixTeamsView({ teams = [], isLoading = false }) {
    if (isLoading) return <p className="loading-teams">Загрузка команд...</p>;

    if (!Array.isArray(teams) || teams.length === 0) {
        return (
            <div className="no-teams-message">
                <h4>Команды еще не сформированы</h4>
                <p>Как только организатор сформирует команды, они появятся здесь.</p>
            </div>
        );
    }

    return (
        <div className="teams-display">
            <div className="mixed-teams-grid">
                {teams.map((team, idx) => (
                    <MixTeamCard key={team.id || idx} team={team} />
                ))}
            </div>
        </div>
    );
}

export default MixTeamsView;


