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
    
    return (
        <div className="team-card">
            <div className="team-card-header">
                <h3>{team.name || `Команда ${index + 1}`}</h3>
                {team.totalRating && (
                    <span className="team-rating">
                        Общий рейтинг: {Math.round(team.totalRating)}
                    </span>
                )}
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
                        <span className="player-rating">
                            {getPlayerRating(player)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TeamCard;
