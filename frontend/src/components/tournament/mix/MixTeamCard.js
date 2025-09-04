import React from 'react';

export function MixTeamCard({ team }) {
    const members = Array.isArray(team?.members) ? team.members : [];
    return (
        <div className="enhanced-team-card">
            <div className="team-card-header">
                <div className="team-title">
                    <h4>{team?.name || 'Команда'}</h4>
                    <div className="team-members-count">👥 {members.length} игрок{members.length === 1 ? '' : members.length > 4 ? 'ов' : 'а'}</div>
                </div>
            </div>

            <div className="team-composition">
                <h5>👥 Состав</h5>
                {members.length > 0 ? (
                    <div className="team-members-list">
                        {members.map((member, idx) => (
                            <div key={idx} className="team-member-row">
                                <div className="member-avatar">
                                    <img 
                                        src={member.avatar_url || '/default-avatar.png'} 
                                        alt={member.name || member.username || 'Игрок'}
                                        onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                <div className="member-info">
                                    <div className={`member-name ${member.is_captain ? 'captain-name' : ''}`}>
                                        {member.is_captain && <span className="captain-crown">👑 </span>}
                                        {member.user_id ? (
                                            <a href={`/user/${member.user_id}`} className="member-profile-link">{member.name || member.username}</a>
                                        ) : (
                                            member.name || member.username || 'Игрок'
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-members">🚫 Состав команды не определен</div>
                )}
            </div>
        </div>
    );
}

export default MixTeamCard;


