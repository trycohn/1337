import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import MixTeamCard from './MixTeamCard';

function MixTeamsView({ teams = [], isLoading = false }) {
    if (isLoading) {
        return (
            <SkeletonTheme baseColor="#2a2a2a" highlightColor="#3a3a3a">
                <div className="teams-display-mixteams">
                    <div className="mixed-teams-grid-mixteams">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="mixteam-card-skeleton" style={{ padding: 16, border: '1px solid #1f1f1f', borderRadius: 8, background: '#0a0a0a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <Skeleton circle width={32} height={32} />
                                    <Skeleton width={160} height={16} />
                                </div>
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {[...Array(4)].map((__, j) => (
                                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Skeleton circle width={24} height={24} />
                                            <Skeleton width={160} height={16} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </SkeletonTheme>
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


