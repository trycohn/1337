import React from 'react';
import { Link } from 'react-router-dom';
import { ensureHttps } from '../../utils/userHelpers';

// Компонент призеров турнира
const TournamentWinners = React.memo(({ tournament }) => {
    if (tournament.status !== 'completed' || !tournament.winners) {
        return null;
    }

    const winners = Array.isArray(tournament.winners) ? tournament.winners : [];
    
    if (winners.length === 0) {
        return null;
    }

    return (
        <div className="winners-section">
            <h3>🏆 Призеры турнира</h3>
            <div className="winners-podium">
                {winners.slice(0, 3).map((winner, index) => (
                    <div key={winner.id || index} className={`winner-card place-${index + 1}`}>
                        <div className="medal-icon">
                            {index === 0 && <span className="gold-medal">🥇</span>}
                            {index === 1 && <span className="silver-medal">🥈</span>}
                            {index === 2 && <span className="bronze-medal">🥉</span>}
                        </div>
                        <div className="winner-info">
                            {winner.avatar_url && (
                                <img 
                                    src={ensureHttps(winner.avatar_url)} 
                                    alt={`Призер ${index + 1}`}
                                    className="winner-avatar"
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                            )}
                            <div className="winner-name">
                                {winner.user_id ? (
                                    <Link to={`/user/${winner.user_id}`} target="_blank" rel="noopener noreferrer">
                                        {winner.name || winner.username || 'Участник'}
                                    </Link>
                                ) : (
                                    <span>{winner.name || winner.username || 'Участник'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

export default TournamentWinners; 