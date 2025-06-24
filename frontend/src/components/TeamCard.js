import React from 'react';
import { ensureHttps } from '../utils/userHelpers';
import './TeamCard.css';

const TeamCard = ({ team, index, ratingType }) => {
    // Определяем, какое свойство использовать для участников
    const teamMembers = team.members || team.players || [];
    
    const getFaceitRating = (player) => {
        // Приоритет: кастомный ELO → пользовательский ELO → faceit_rating → user_faceit_rating → дефолт
        if (player.faceit_elo && !isNaN(parseInt(player.faceit_elo)) && parseInt(player.faceit_elo) > 0) {
            return parseInt(player.faceit_elo);
        } else if (player.user_faceit_elo && !isNaN(parseInt(player.user_faceit_elo)) && parseInt(player.user_faceit_elo) > 0) {
            return parseInt(player.user_faceit_elo);
        } else if (player.faceit_rating && !isNaN(parseInt(player.faceit_rating)) && parseInt(player.faceit_rating) > 0) {
            return parseInt(player.faceit_rating);
        } else if (player.user_faceit_rating && !isNaN(parseInt(player.user_faceit_rating)) && parseInt(player.user_faceit_rating) > 0) {
            return parseInt(player.user_faceit_rating);
        }
        return 1000; // дефолт
    };
    
    const getPremierRating = (player) => {
        // Приоритет: кастомный ранг → пользовательский ранг → premier_rank → user_premier_rank → дефолт
        if (player.cs2_premier_rank && !isNaN(parseInt(player.cs2_premier_rank)) && parseInt(player.cs2_premier_rank) > 0) {
            return parseInt(player.cs2_premier_rank);
        } else if (player.premier_rank && !isNaN(parseInt(player.premier_rank)) && parseInt(player.premier_rank) > 0) {
            return parseInt(player.premier_rank);
        } else if (player.premier_rating && !isNaN(parseInt(player.premier_rating)) && parseInt(player.premier_rating) > 0) {
            return parseInt(player.premier_rating);
        } else if (player.user_premier_rank && !isNaN(parseInt(player.user_premier_rank)) && parseInt(player.user_premier_rank) > 0) {
            return parseInt(player.user_premier_rank);
        } else if (player.user_premier_rating && !isNaN(parseInt(player.user_premier_rating)) && parseInt(player.user_premier_rating) > 0) {
            return parseInt(player.user_premier_rating);
        }
        return 5; // дефолт
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
        
        const ratings = teamMembers.map(player => {
            if (ratingType === 'faceit') {
                return getFaceitRating(player);
            } else {
                return getPremierRating(player);
            }
        }).filter(rating => !isNaN(rating) && rating > 0);
        
        if (ratings.length === 0) return ratingType === 'faceit' ? 1000 : 5;
        
        const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        return Math.round(average);
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
