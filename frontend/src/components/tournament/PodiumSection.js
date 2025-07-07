import React, { useMemo } from 'react';
import { getParticipantInfo } from '../../utils/participantHelpers';
import './PodiumSection.css';

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

        // Находим матч за 3-е место
        const thirdPlaceMatch = matches.find(match => 
            match.is_third_place_match === true ||
            match.bracket_type === 'third_place'
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

        // Определяем 3-е место (если есть матч за 3-е место)
        let thirdPlace = null;
        if (thirdPlaceMatch && thirdPlaceMatch.winner_team_id) {
            thirdPlace = getParticipantInfo(thirdPlaceMatch.winner_team_id, tournament);
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
        <div className="podium-section">
            <div className="podium-container">
                <h2 className="podium-title">🏆 Призеры турнира</h2>
                
                <div className={`podium ${winners.third ? 'podium-three' : 'podium-two'}`}>
                    {/* 2-е место */}
                    {winners.second && (
                        <div className="podium-place podium-second">
                            <div className="podium-medal">🥈</div>
                            <div className="podium-platform podium-platform-second">
                                <div className="podium-number">2</div>
                            </div>
                            <div className="podium-info">
                                <div className="podium-participant-name">
                                    {winners.second.name}
                                </div>
                                {winners.second.members && winners.second.members.length > 0 && (
                                    <div className="podium-team-members">
                                        {winners.second.members.slice(0, 3).map((member, index) => (
                                            <span key={index} className="podium-member">
                                                {member.name}
                                            </span>
                                        ))}
                                        {winners.second.members.length > 3 && (
                                            <span className="podium-member-more">
                                                +{winners.second.members.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 1-е место */}
                    <div className="podium-place podium-first">
                        <div className="podium-medal">🥇</div>
                        <div className="podium-platform podium-platform-first">
                            <div className="podium-number">1</div>
                        </div>
                        <div className="podium-info">
                            <div className="podium-participant-name">
                                {winners.first.name}
                            </div>
                            {winners.first.members && winners.first.members.length > 0 && (
                                <div className="podium-team-members">
                                    {winners.first.members.slice(0, 3).map((member, index) => (
                                        <span key={index} className="podium-member">
                                            {member.name}
                                        </span>
                                    ))}
                                    {winners.first.members.length > 3 && (
                                        <span className="podium-member-more">
                                            +{winners.first.members.length - 3}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3-е место (если есть) */}
                    {winners.third && (
                        <div className="podium-place podium-third">
                            <div className="podium-medal">🥉</div>
                            <div className="podium-platform podium-platform-third">
                                <div className="podium-number">3</div>
                            </div>
                            <div className="podium-info">
                                <div className="podium-participant-name">
                                    {winners.third.name}
                                </div>
                                {winners.third.members && winners.third.members.length > 0 && (
                                    <div className="podium-team-members">
                                        {winners.third.members.slice(0, 3).map((member, index) => (
                                            <span key={index} className="podium-member">
                                                {member.name}
                                            </span>
                                        ))}
                                        {winners.third.members.length > 3 && (
                                            <span className="podium-member-more">
                                                +{winners.third.members.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Дополнительная информация */}
            </div>
        </div>
    );
};

export default PodiumSection; 