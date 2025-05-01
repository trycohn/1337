import React from 'react';
import { ensureHttps } from '../utils/userHelpers';
import './TeamCard.css';

const TeamCard = ({ team, index, ratingType }) => {
    return (
        <div className="team-card">
            <div className="team-card-header">
                <h3>Команда {index + 1}</h3>
                <span className="team-rating">
                    Общий рейтинг: {Math.round(team.totalRating)}
                </span>
            </div>
            <div className="team-players">
                {team.players.map((player, playerIndex) => (
                    <div key={playerIndex} className="player-row">
                        <div className="player-info">
                            <div className="player-avatar">
                                <img 
                                    src={ensureHttps(player.avatar_url) || '/default-avatar.png'} 
                                    alt={`${player.name} avatar`}
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = '/default-avatar.png';
                                    }}
                                />
                            </div>
                            <span className="player-name">{player.name}</span>
                        </div>
                        <span className="player-rating">
                            {ratingType === 'faceit' 
                                ? `FACEit: ${player.faceit_rating || 1000}`
                                : `Premier: ${player.premier_rank || 5}`
                            }
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TeamCard;
