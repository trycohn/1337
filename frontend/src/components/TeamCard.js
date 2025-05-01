import React from 'react';
import { ensureHttps } from '../utils/userHelpers';
import './TeamCard.css';

const TeamCard = ({ team, index, ratingType }) => {
    // Определяем, какое свойство использовать для участников
    const teamMembers = team.members || team.players || [];
    
    const getFaceitRating = (player) => {
        return player.faceit_elo || player.faceit_rating || 1000;
    };
    
    const getPremierRating = (player) => {
        return player.premier_rank || player.cs2_premier_rank || 5;
    };
    
    const getPlayerRating = (player) => {
        if (ratingType === 'faceit') {
            return `FACEIT: ${getFaceitRating(player)}`;
        } else {
            return `Premier: ${getPremierRating(player)}`;
        }
    };
    
    const getPlayerAvatar = (player) => {
        return ensureHttps(player.avatar_url) || '/default-avatar.png';
    };
    
    const getPlayerName = (player) => {
        return player.name || player.username || 'Участник';
    };

    // Расчет среднего рейтинга команды
    const calculateAverageRating = () => {
        if (!teamMembers || teamMembers.length === 0) return 0;
        
        if (ratingType === 'faceit') {
            const total = teamMembers.reduce((sum, player) => sum + getFaceitRating(player), 0);
            return Math.round(total / teamMembers.length);
        } else {
            const total = teamMembers.reduce((sum, player) => sum + getPremierRating(player), 0);
            return Math.round(total / teamMembers.length);
        }
    };
    
    const averageRating = team.totalRating ? Math.round(team.totalRating) : calculateAverageRating();
    
    return (
        <div className="team-card">
            <div className="team-card-header">
                <div className="team-title">
                    <h3>{team.name || `Команда ${index + 1}`}</h3>
                    <span className="team-members-count">
                        {teamMembers.length} участников
                    </span>
                </div>
                <span className="team-rating">
                    {ratingType === 'faceit' ? 'FACEIT:' : 'Premier:'} {averageRating}
                </span>
            </div>
            <div className="team-players">
                {teamMembers.map((player, playerIndex) => (
                    <div key={playerIndex} className="player-row">
                        <div className="player-info">
                            <div className="player-avatar">
                                <img 
                                    src={getPlayerAvatar(player)} 
                                    alt={`${getPlayerName(player)} avatar`}
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = '/default-avatar.png';
                                    }}
                                />
                            </div>
                            <span className="player-name">{getPlayerName(player)}</span>
                        </div>
                        <span className="player-rating" title={getPlayerRating(player)}>
                            {getPlayerRating(player)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TeamCard;
