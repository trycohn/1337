import React, { useMemo } from 'react';
import { getParticipantInfo } from '../../utils/participantHelpers';
import { ensureHttps } from '../../utils/userHelpers';
import './TournamentResults.css';

/**
 * 🏆 PodiumSection - Подиум с призерами турнира
 * 
 * Красивый минималистический подиум, отображающий:
 * - 1-е место (финалист-победитель)
 * - 2-е место (финалист-проигравший) 
 * - 3-е место (если есть матч за 3-е место)
 * 
 * @param {Object} tournament - Данные турнира
 * @param {Array} matches - Матчи турнира
 */
const PodiumSection = ({ tournament, matches }) => {
    // Определяем призеров турнира
    const winners = useMemo(() => {
        if (!matches || matches.length === 0) return null;

        // Находим финальный матч
        const finalMatch = matches.find(match => 
            match.bracket_type === 'grand_final' || 
            match.is_final === true ||
            (match.round && parseInt(match.round) === Math.max(...matches.map(m => parseInt(m.round) || 0)))
        );

        // Находим матч за 3-е место (SE) или вычисляем 3-е место для DE
        const thirdPlaceMatch = matches.find(match => 
            match.is_third_place_match === true ||
            match.bracket_type === 'placement'
        );

        if (!finalMatch || !finalMatch.winner_team_id) {
            console.log('🏆 PodiumSection: Финал не найден или не завершен');
            return null;
        }

        // Определяем 1-е и 2-е места из финала
        const firstPlace = getParticipantInfo(finalMatch.winner_team_id, tournament);
        const secondPlaceId = finalMatch.winner_team_id === finalMatch.team1_id 
            ? finalMatch.team2_id 
            : finalMatch.team1_id;
        const secondPlace = getParticipantInfo(secondPlaceId, tournament);

        // Определяем 3-е место
        let thirdPlace = null;
        if (thirdPlaceMatch && thirdPlaceMatch.winner_team_id) {
            // SE: победитель матча за 3-е место
            thirdPlace = getParticipantInfo(thirdPlaceMatch.winner_team_id, tournament);
        } else {
            // DE: проигравший финала лузеров
            const losersFinal = matches.find(m => m.bracket_type === 'loser_final');
            if (losersFinal && losersFinal.winner_team_id && (losersFinal.team1_id || losersFinal.team2_id)) {
                const loserId = losersFinal.winner_team_id === losersFinal.team1_id ? losersFinal.team2_id : losersFinal.team1_id;
                thirdPlace = getParticipantInfo(loserId, tournament);
            } else {
                // Fallback: последний раунд нижней сетки
                const losersMatches = matches.filter(m => m.bracket_type === 'loser');
                if (losersMatches.length > 0) {
                    const maxLosersRound = Math.max(...losersMatches.map(m => parseInt(m.round) || 0));
                    const lastLosersRoundMatch = losersMatches.find(m => (parseInt(m.round) || 0) === maxLosersRound && m.winner_team_id);
                    if (lastLosersRoundMatch) {
                        const loserId = lastLosersRoundMatch.winner_team_id === lastLosersRoundMatch.team1_id 
                            ? lastLosersRoundMatch.team2_id 
                            : lastLosersRoundMatch.team1_id;
                        thirdPlace = getParticipantInfo(loserId, tournament);
                    }
                }
            }
        }

        return {
            first: firstPlace,
            second: secondPlace,
            third: thirdPlace
        };
    }, [matches, tournament]);

    // Если нет призеров - не отображаем подиум
    if (!winners || !winners.first) {
        return null;
    }

    return (
        <div className="results-winners-list">
            {winners.second && (
                <div className="results-winner-card results-place-2">
                    <div className="results-place-medal">🥈</div>
                    <div className="results-winner-info">
                        <div className="results-winner-avatar">
                            <img src={ensureHttps(winners.second.avatar_url) || '/default-avatar.png'} alt={winners.second.name} onError={(e)=>{e.target.src='/default-avatar.png';}} />
                        </div>
                        <div className="results-winner-name">{winners.second.name}</div>
                        {Array.isArray(winners.second.members) && winners.second.members.length > 0 && (
                            <div className="results-team-members">
                                {winners.second.members.map((m, i) => (
                                    <span key={i} className="results-member">{m.name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="results-winner-card results-place-1">
                <div className="results-place-medal">🥇</div>
                <div className="results-winner-info">
                    <div className="results-winner-avatar">
                        <img src={ensureHttps(winners.first.avatar_url) || '/default-avatar.png'} alt={winners.first.name} onError={(e)=>{e.target.src='/default-avatar.png';}} />
                    </div>
                    <div className="results-winner-name">{winners.first.name}</div>
                    {Array.isArray(winners.first.members) && winners.first.members.length > 0 && (
                        <div className="results-team-members">
                            {winners.first.members.map((m, i) => (
                                <span key={i} className="results-member">{m.name}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {winners.third && (
                <div className="results-winner-card results-place-3">
                    <div className="results-place-medal">🥉</div>
                    <div className="results-winner-info">
                        <div className="results-winner-avatar">
                            <img src={ensureHttps(winners.third.avatar_url) || '/default-avatar.png'} alt={winners.third.name} onError={(e)=>{e.target.src='/default-avatar.png';}} />
                        </div>
                        <div className="results-winner-name">{winners.third.name}</div>
                        {Array.isArray(winners.third.members) && winners.third.members.length > 0 && (
                            <div className="results-team-members">
                                {winners.third.members.map((m, i) => (
                                    <span key={i} className="results-member">{m.name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PodiumSection; 