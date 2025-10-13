import React, { useMemo, useState } from 'react';
import { getParticipantInfo, enrichMatchWithParticipantNames } from '../../utils/participantHelpers';
import { ensureHttps } from '../../utils/userHelpers';
import MatchDetailsModal from './modals/MatchDetailsModal';
import './TournamentResults.css';
import PodiumSection from './PodiumSection';
import TournamentStatsPanel from './TournamentStatsPanel';

const TournamentResults = ({ tournament }) => {
    // Состояние для модального окна деталей матча
    const [selectedMatchForDetails, setSelectedMatchForDetails] = useState(null);
    const [isMatchDetailsOpen, setIsMatchDetailsOpen] = useState(false);

    // Функции для работы с модальным окном
    const openMatchDetails = (match) => {
        const enrichedMatch = enrichMatchWithParticipantNames(match, tournament);
        setSelectedMatchForDetails(enrichedMatch);
        setIsMatchDetailsOpen(true);
    };

    const closeMatchDetails = () => {
        setIsMatchDetailsOpen(false);
        setSelectedMatchForDetails(null);
    };

    // Используем ту же логику, что и подиум для определения мест
    const tournamentResults = useMemo(() => {
        if (!tournament?.matches || tournament.matches.length === 0) {
            return { completedMatches: [], hasResults: false };
        }

        const matches = tournament.matches;
        
        // Находим завершенные матчи (используем гибкую логику как в TournamentProgressBar)
        const completedMatches = matches.filter(match => {
            // Проверяем по различным критериям завершенности
            const hasValidState = match.state === 'DONE' || match.state === 'SCORE_DONE' || match.status === 'completed';
            const hasScore = (match.score1 !== null && match.score1 !== undefined) || 
                            (match.score2 !== null && match.score2 !== undefined);
            const hasWinner = match.winner_team_id !== null && match.winner_team_id !== undefined;
            
            return hasValidState || hasScore || hasWinner;
        });

        console.log('🏆 TournamentResults: Анализируем матчи', {
            totalMatches: matches.length,
            completedMatches: completedMatches.length,
            format: tournament.format || tournament.bracket_type
        });

        // Отладочная информация для диагностики
        if (process.env.NODE_ENV === 'development') {
            console.log('🔍 Детальный анализ матчей:');
            matches.slice(0, 5).forEach((match, index) => {
                console.log(`  Матч ${index + 1}:`, {
                    id: match.id,
                    status: match.status,
                    state: match.state,
                    winner_team_id: match.winner_team_id,
                    team1_id: match.team1_id,
                    team2_id: match.team2_id,
                    score1: match.score1,
                    score2: match.score2,
                    bracket_type: match.bracket_type,
                    // Проверяем критерии завершенности
                    hasValidState: match.state === 'DONE' || match.state === 'SCORE_DONE' || match.status === 'completed',
                    hasScore: (match.score1 !== null && match.score1 !== undefined) || (match.score2 !== null && match.score2 !== undefined),
                    hasWinner: match.winner_team_id !== null && match.winner_team_id !== undefined,
                    isCompleted: (match.state === 'DONE' || match.state === 'SCORE_DONE' || match.status === 'completed') || 
                                ((match.score1 !== null && match.score1 !== undefined) || (match.score2 !== null && match.score2 !== undefined)) || 
                                (match.winner_team_id !== null && match.winner_team_id !== undefined)
                });
            });
            
            const statusCounts = matches.reduce((acc, m) => {
                acc[m.status] = (acc[m.status] || 0) + 1;
                return acc;
            }, {});
            console.log('📊 Статусы матчей:', statusCounts);
            
            const stateCounts = matches.reduce((acc, m) => {
                acc[m.state || 'undefined'] = (acc[m.state || 'undefined'] || 0) + 1;
                return acc;
            }, {});
            console.log('📊 Состояния матчей (state):', stateCounts);
            
            const withWinners = matches.filter(m => m.winner_team_id).length;
            const withScores = matches.filter(m => (m.score1 !== null && m.score1 !== undefined) || (m.score2 !== null && m.score2 !== undefined)).length;
            console.log(`🏆 Матчей с победителями: ${withWinners}`);
            console.log(`📊 Матчей со счетом: ${withScores}`);
        }

        if (completedMatches.length === 0) {
            return { completedMatches: [], hasResults: false };
        }

        return {
            completedMatches: completedMatches.reverse(),
            hasResults: true
        };
    }, [tournament]);

    if (!tournament) {
        return (
            <div className="results-error">
                <div>Нет данных о турнире</div>
            </div>
        );
    }

    if (!tournamentResults.hasResults) {
        return (
            <div className="results-empty-state">
                <div className="results-empty-content">
                    <h3>Результаты пока недоступны</h3>
                    <p>Результаты появятся после завершения первых матчей</p>
                    <div className="results-debug-info">
                        <p>Турнир: {tournament.name}</p>
                        <p>Формат: {tournament.format || tournament.bracket_type}</p>
                        <p>Статус: {tournament.status}</p>
                        <p>Всего матчей: {tournament.matches?.length || 0}</p>
                        <p>Завершенных матчей: {tournament.matches?.filter(m => m.status === 'completed').length || 0}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="results-tournament-results">
            {/* Блок 1: Призовые места (если турнир завершен и есть призеры) */}
            {tournament.status === 'completed' && (
                <div className="results-winners-section">
                    <div className="results-section-header">
                        <h3>Призовые места</h3>
                        <div className="results-tournament-info">
                            <span className="results-format">{getFormatDisplayName(tournament.format || tournament.bracket_type)}</span>
                        </div>
                    </div>
                    <div className="results-podium">
                        <PodiumSection tournament={tournament} matches={tournament.matches} />
                    </div>
                </div>
            )}

            {/* Блок 2: Статистика турнира (только для завершенных турниров с лобби) */}
            {tournament.status === 'completed' && tournament.lobby_enabled && tournament.game === 'Counter-Strike 2' && (
                <TournamentStatsPanel tournamentId={tournament.id} />
            )}

            {/* Блок 3: История матчей */}
            {tournamentResults.completedMatches.length > 0 && (
                <div className="results-match-history-section">
                    <div className="results-section-header">
                        <h3>История матчей</h3>
                        <div className="results-history-stats">
                            <span className="results-matches-count">{tournamentResults.completedMatches.length} завершенных матчей</span>
                        </div>
                    </div>
                    
                    <div className="results-match-history-list">
                        {tournamentResults.completedMatches.map((match, idx) => renderMatchHistoryItem(match, tournament, openMatchDetails))}
                    </div>
                </div>
            )}

            {/* Модальное окно деталей матча */}
            {isMatchDetailsOpen && selectedMatchForDetails && (
                <MatchDetailsModal
                    isOpen={isMatchDetailsOpen}
                    onClose={closeMatchDetails}
                    selectedMatch={selectedMatchForDetails}
                    canEdit={false}
                    tournament={tournament}
                />
            )}
        </div>
    );
};

// Функция определения призеров (идентична подиуму)
function calculateWinners(matches, tournament) {
    console.log('🔍 Определяем призеров турнира...');
    
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

    console.log('🔍 Найденные ключевые матчи:', {
        finalMatch: finalMatch ? `ID ${finalMatch.id}, раунд ${finalMatch.round}` : 'не найден',
        thirdPlaceMatch: thirdPlaceMatch ? `ID ${thirdPlaceMatch.id}` : 'не найден'
    });

    if (!finalMatch || !finalMatch.winner_team_id) {
        console.log('❌ Финал не найден или не завершен', {
            finalMatch: !!finalMatch,
            winner_team_id: finalMatch?.winner_team_id
        });
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

    console.log('🏆 Призеры определены:', {
        first: firstPlace?.name,
        second: secondPlace?.name,
        third: thirdPlace?.name
    });

    console.log('🔍 Детальная информация о призерах:', {
        firstPlace,
        secondPlace,
        thirdPlace,
        firstPlaceExists: !!firstPlace,
        secondPlaceExists: !!secondPlace
    });

    if (!firstPlace) {
        console.log('❌ КРИТИЧЕСКАЯ ОШИБКА: firstPlace не найден!', {
            winner_team_id: finalMatch.winner_team_id,
            tournament_teams_count: tournament.teams?.length,
            tournament_participants_count: tournament.participants?.length
        });
        return null;
    }

    return {
        first: firstPlace,
        second: secondPlace,
        third: thirdPlace
    };
}

// Рендер призеров
function renderWinners(winners) {
    return (
        <div className="results-winners-list">
            {/* 1-е место */}
            <div className="results-winner-card results-place-1">
                    {/* номер убран, есть медаль */}
                <div className="results-winner-info">
                    <div className="results-winner-avatar">
                        <img 
                            src={ensureHttps(winners.first.avatar_url) || '/default-avatar.png'}
                            alt={winners.first.name}
                            onError={(e) => { e.target.src = '/default-avatar.png'; }}
                        />
                    </div>
                    <div className="results-winner-name">{winners.first.name}</div>
                    {winners.first.members && winners.first.members.length > 0 && (
                        <div className="results-team-members">
                            {winners.first.members.map((member, index) => (
                                <span key={index} className="results-member">
                                    {member.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 2-е место */}
            <div className="results-winner-card results-place-2">
                    {/* номер убран, есть медаль */}
                <div className="results-winner-info">
                    <div className="results-winner-avatar">
                        <img 
                            src={ensureHttps(winners.second.avatar_url) || '/default-avatar.png'}
                            alt={winners.second.name}
                            onError={(e) => { e.target.src = '/default-avatar.png'; }}
                        />
                    </div>
                    <div className="results-winner-name">{winners.second.name}</div>
                    {winners.second.members && winners.second.members.length > 0 && (
                        <div className="results-team-members">
                            {winners.second.members.map((member, index) => (
                                <span key={index} className="results-member">
                                    {member.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 3-е место */}
            {winners.third && (
                <div className="results-winner-card results-place-3">
                    {/* номер убран, есть медаль */}
                    <div className="results-winner-info">
                        <div className="results-winner-avatar">
                            <img 
                                src={ensureHttps(winners.third.avatar_url) || '/default-avatar.png'}
                                alt={winners.third.name}
                                onError={(e) => { e.target.src = '/default-avatar.png'; }}
                            />
                        </div>
                        <div className="results-winner-name">{winners.third.name}</div>
                    {winners.third.members && winners.third.members.length > 0 && (
                        <div className="results-team-members">
                            {winners.third.members.map((member, index) => (
                                <span key={index} className="results-member">
                                    {member.name}
                                </span>
                            ))}
                        </div>
                    )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Рендер элемента истории матчей
function renderMatchHistoryItem(match, tournament, openMatchDetails) {
    const winner = getParticipantInfo(match.winner_team_id, tournament);
    const loserId = match.winner_team_id === match.team1_id ? match.team2_id : match.team1_id;
    const loser = getParticipantInfo(loserId, tournament);

    // Особые матчи
    const special = getBracketTypeDisplayName(match.bracket_type);

    return (
        <div key={match.id} className="results-match-history-item">
            <div className="results-match-info">
                <div className="results-match-header">
                    <span className="results-match-number">#{match.tournament_match_number || match.match_number || match.id}</span>
                    {special && <span className="results-bracket-type">{special}</span>}
                </div>
                
                <div className="results-match-result">
                    <div className="results-participants">
                        <div className="results-participant results-winner" style={{fontWeight: 700, color: '#ff0000'}}>
                            <div className="results-participant-avatar">
                                <img 
                                    src={ensureHttps(winner?.avatar_url) || '/default-avatar.png'}
                                    alt={winner?.name || 'Winner'}
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                            </div>
                            <span className="results-participant-name">{winner?.name || 'Winner'}</span>
                        </div>
                        
                        <div className="results-score">
                            {getFormattedScore(match)}
                        </div>
                        
                        <div className="results-participant results-loser">
                            <div className="results-participant-avatar">
                                <img 
                                    src={ensureHttps(loser?.avatar_url) || '/default-avatar.png'}
                                    alt={loser?.name || 'Loser'}
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                            </div>
                            <span className="results-participant-name">{loser?.name || 'Loser'}</span>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => window.open(`/tournaments/${tournament.id}/match/${match.id}`, '_blank')}
                        className="results-match-details-link"
                        title="Открыть страницу матча"
                    >
                        Посмотреть матч
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TournamentResults;

// Вспомогательные функции
function getComputedScoresForMatch(m) {
    const maps = m?.maps_data;
    if (Array.isArray(maps) && maps.length > 0) {
        if (maps.length === 1) {
            const only = maps[0];
            const s1 = (only.score1 ?? only.team1_score);
            const s2 = (only.score2 ?? only.team2_score);
            if (typeof s1 === 'number' && typeof s2 === 'number') return [s1, s2];
        } else {
            let wins1 = 0, wins2 = 0;
            for (const mm of maps) {
                const s1 = (mm.score1 ?? mm.team1_score);
                const s2 = (mm.score2 ?? mm.team2_score);
                if (typeof s1 === 'number' && typeof s2 === 'number') {
                    if (s1 > s2) wins1++; else if (s2 > s1) wins2++;
                }
            }
            if (wins1 + wins2 > 0) return [wins1, wins2];
        }
    }
    const s1 = (typeof m?.score1 === 'number') ? m.score1 : 0;
    const s2 = (typeof m?.score2 === 'number') ? m.score2 : 0;
    return [s1, s2];
}
function getFormatDisplayName(format) {
    const formats = {
        'single_elimination': 'Single Elimination',
        'double_elimination': 'Double Elimination',
        'mix': 'Mix'
    };
    return formats[format] || format;
}

function getBracketTypeDisplayName(bracketType) {
    const types = {
        'winner': 'Винеры',
        'loser': 'Лузеры',
        'loser_semifinal': 'Малый финал лузеров',
        'loser_final': 'Финал лузеров',
        'grand_final': 'Гранд финал',
        'grand_final_reset': 'Гранд финал (реванш)',
        'placement': 'Матч за 3-е место',
        'final': 'Финал',
        'semifinal': 'Полуфинал'
    };
    return types[bracketType] || bracketType;
}

function getFormattedScore(match) {
    const [team1Display, team2Display] = getComputedScoresForMatch(match);
    if (!match.winner_team_id) return `${team1Display}:${team2Display}`;
    return match.winner_team_id === match.team1_id
        ? `${team1Display}:${team2Display}`
        : `${team2Display}:${team1Display}`;
}