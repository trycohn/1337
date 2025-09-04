import React, { useMemo } from 'react';

export function MixTeamCard({ team }) {
    const members = Array.isArray(team?.members) ? team.members : [];

    const captain = useMemo(() => members.find(m => m.is_captain) || members[0], [members]);
    const teamAvatar = useMemo(() => {
        return team?.logo_url || team?.avatar_url || captain?.avatar_url || '/default-avatar.png';
    }, [team?.logo_url, team?.avatar_url, captain?.avatar_url]);

    const ratingLabel = useMemo(() => {
        const val = team?.averageRating || team?.averageRatingFaceit || team?.averageRatingPremier;
        if (!val) return '—';
        const type = (team?.ratingType || '').toString().toLowerCase();
        return type === 'premier' ? `${val} Ранг` : `${val} ELO`;
    }, [team?.averageRating, team?.averageRatingFaceit, team?.averageRatingPremier, team?.ratingType]);

    return (
        <div className="enhanced-team-card enhanced-team-card-mixteams">
            <div className="team-card-header team-card-header-mixteams">
                <div className="team-header-left team-header-left-mixteams">
                    <div className="team-avatar-lg team-avatar-lg-mixteams">
                        <img src={teamAvatar} alt={team?.name || 'Команда'} onError={(e)=>{ e.currentTarget.src='/default-avatar.png'; }} />
                    </div>
                    <div className="team-title team-title-mixteams">
                        <h4>{team?.name || 'Команда'}</h4>
                    </div>
                </div>
                <div className="team-header-center team-header-center-mixteams">
                    <div className="member-avatars-stack member-avatars-stack-mixteams">
                        {members.slice(0, 8).map((m, i) => (
                            <div key={m.user_id || m.participant_id || i} className="stack-avatar stack-avatar-mixteams" style={{ left: `${i * 20}%` }}>
                                <img src={m.avatar_url || '/default-avatar.png'} alt={m.name || m.username || 'Игрок'} onError={(e)=>{ e.currentTarget.src='/default-avatar.png'; }} />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="team-header-right team-header-right-mixteams">
                    <div className="team-rating-badge team-rating-badge-mixteams">{ratingLabel}</div>
                </div>
            </div>

            <div className="team-composition team-composition-mixteams">
                
                {members.length > 0 ? (
                    <div className="team-members-list team-members-list-mixteams">
                        {members.map((member, idx) => (
                            <div key={idx} className="team-member-row team-member-row-mixteams">
                                <div className="member-avatar member-avatar-mixteams">
                                    <img 
                                        src={member.avatar_url || '/default-avatar.png'} 
                                        alt={member.name || member.username || 'Игрок'}
                                        onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.png'; }}
                                    />
                                </div>
                                <div className="member-info member-info-mixteams">
                                    <div className={`member-name member-name-mixteams ${member.is_captain ? 'captain-name' : ''}`}>
                                        {member.is_captain && <span className="captain-crown">👑 </span>}
                                        {member.user_id ? (
                                            <a href={`/user/${member.user_id}`} className="member-profile-link member-profile-link-mixteams">{member.name || member.username}</a>
                                        ) : (
                                            member.name || member.username || 'Игрок'
                                        )}
                                    </div>
                                </div>
                                <div className="member-rating-badge member-rating-badge-mixteams">
                                    {(() => {
                                        const t = (team?.ratingType || '').toString().toLowerCase();
                                        const elo = member.faceit_elo || member.user_faceit_elo || member.faceit_rating || member.user_faceit_rating;
                                        const prem = member.cs2_premier_rank || member.user_premier_rank || member.premier_rank || member.premier_rating || member.user_premier_rating;
                                        if (t === 'premier') return prem ? `${prem}` : '—';
                                        return elo ? `${elo}` : '—';
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-members no-members-mixteams">Состав команды не определен</div>
                )}
            </div>
        </div>
    );
}

export default MixTeamCard;


