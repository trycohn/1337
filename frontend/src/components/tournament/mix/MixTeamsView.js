import React from 'react';
import Skeleton from 'react-loading-skeleton';
import MixTeamCard from './MixTeamCard';

function MixTeamsView({ teams = [], isLoading = false }) {
    if (isLoading) {
        return (
            <div className="teams-display-mixteams">
                <div className="mixed-teams-grid-mixteams">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="mixteam-card-skeleton" style={{ padding: 16, border: '1px solid #1f1f1f', borderRadius: 8, background: '#0a0a0a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <Skeleton circle width={32} height={32} />
                                <Skeleton width={140} height={18} />
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {[...Array(4)].map((__, j) => (
                                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <Skeleton circle width={20} height={20} />
                                        <Skeleton width={120} height={14} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!Array.isArray(teams) || teams.length === 0) {
        return (
            <div className="no-teams-message-mixteams">
                <h4>Команды еще не сформированы</h4>
                <p>Как только организатор сформирует команды, они появятся здесь.</p>
            </div>
        );
    }

    return (
        <div className="teams-display-mixteams">
            <div className="mixed-teams-grid-mixteams">
                {teams.map((team, idx) => (
                    <MixTeamCard key={team.id || idx} team={team} />
                ))}
            </div>
        </div>
    );
}

export default MixTeamsView;


