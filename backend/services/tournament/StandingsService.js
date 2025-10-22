/**
 * 📊 STANDINGS SERVICE
 * Сервис для определения итоговых мест команд в турнире
 * @version 1.0.0
 */

const pool = require('../../db');

class StandingsService {
    /**
     * 🏆 Получение итоговой таблицы мест всех команд
     * @param {number} tournamentId 
     */
    async getTournamentStandings(tournamentId) {
        console.log(`📊 [Standings] Расчет итоговой таблицы для турнира ${tournamentId}`);

        try {
            // Получаем данные турнира
            const tournamentQuery = `
                SELECT * FROM tournaments WHERE id = $1
            `;
            const tournamentResult = await pool.query(tournamentQuery, [tournamentId]);
            const tournament = tournamentResult.rows[0];

            if (!tournament) {
                throw new Error('Tournament not found');
            }

            // Получаем все команды/участников
            const participantsQuery = `
                SELECT 
                    tt.id as team_id,
                    tt.name as team_name,
                    tt.avatar_url,
                    json_agg(
                        json_build_object(
                            'user_id', u.id,
                            'name', COALESCE(u.username, tp.name),
                            'avatar_url', u.avatar_url,
                            'is_captain', ttm.is_captain
                        ) ORDER BY ttm.is_captain DESC NULLS LAST, ttm.id
                    ) as members
                FROM tournament_teams tt
                LEFT JOIN tournament_team_members ttm ON tt.id = ttm.team_id
                LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tt.tournament_id = $1
                GROUP BY tt.id, tt.name, tt.avatar_url
            `;

            const participantsResult = await pool.query(participantsQuery, [tournamentId]);
            const teams = participantsResult.rows;

            // Получаем все матчи
            const matchesQuery = `
                SELECT * FROM matches
                WHERE tournament_id = $1
                ORDER BY round ASC, match_number ASC
            `;
            const matchesResult = await pool.query(matchesQuery, [tournamentId]);
            const matches = matchesResult.rows;

            // Рассчитываем места команд
            const standings = this._calculateStandings(teams, matches, tournament);

            console.log(`✅ [Standings] Рассчитано ${standings.length} позиций`);

            return {
                success: true,
                standings,
                totalTeams: teams.length
            };

        } catch (error) {
            console.error(`❌ [Standings] Ошибка расчета:`, error);
            throw error;
        }
    }

    /**
     * 📊 Алгоритм расчета мест команд
     * @private
     */
    _calculateStandings(teams, matches, tournament) {
        const standings = [];

        // Находим финальный матч
        const finalMatch = matches.find(m => 
            m.bracket_type === 'grand_final' || 
            m.bracket_type === 'final' ||
            m.is_final === true
        );

        if (!finalMatch || !finalMatch.winner_team_id) {
            // Турнир не завершен - возвращаем команды без мест
            return teams.map(team => ({
                ...team,
                placement: null,
                placement_range: null,
                eliminated_in_round: null,
                wins: 0,
                losses: 0
            }));
        }

        // Создаем карту статистики команд
        const teamStats = new Map();
        
        teams.forEach(team => {
            teamStats.set(team.team_id, {
                team_id: team.team_id,
                team_name: team.team_name,
                avatar_url: team.avatar_url,
                members: team.members,
                wins: 0,
                losses: 0,
                last_match_round: 0,
                is_winner: false,
                eliminated_in_round: null,
                bracket_type: null
            });
        });

        // Проходим по всем завершенным матчам
        matches.forEach(match => {
            if (!match.winner_team_id) return;

            const winnerId = match.winner_team_id;
            const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;

            // Обновляем статистику победителя
            if (teamStats.has(winnerId)) {
                const team = teamStats.get(winnerId);
                team.wins++;
                team.last_match_round = Math.max(team.last_match_round, match.round || 0);
            }

            // Обновляем статистику проигравшего
            if (teamStats.has(loserId)) {
                const team = teamStats.get(loserId);
                team.losses++;
                team.last_match_round = Math.max(team.last_match_round, match.round || 0);
                team.eliminated_in_round = match.round;
                team.bracket_type = match.bracket_type;
            }
        });

        // Определяем места
        const winner = teamStats.get(finalMatch.winner_team_id);
        if (winner) {
            winner.placement = 1;
            winner.is_winner = true;
        }

        // 2-е место - проигравший финала
        const secondPlaceId = finalMatch.team1_id === finalMatch.winner_team_id 
            ? finalMatch.team2_id 
            : finalMatch.team1_id;
        const secondPlace = teamStats.get(secondPlaceId);
        if (secondPlace) {
            secondPlace.placement = 2;
        }

        // 3-е место
        const thirdPlaceMatch = matches.find(m => 
            m.is_third_place_match === true || 
            m.bracket_type === 'placement'
        );

        if (thirdPlaceMatch && thirdPlaceMatch.winner_team_id) {
            const thirdPlace = teamStats.get(thirdPlaceMatch.winner_team_id);
            if (thirdPlace) {
                thirdPlace.placement = 3;
            }

            // 4-е место
            const fourthPlaceId = thirdPlaceMatch.team1_id === thirdPlaceMatch.winner_team_id
                ? thirdPlaceMatch.team2_id
                : thirdPlaceMatch.team1_id;
            const fourthPlace = teamStats.get(fourthPlaceId);
            if (fourthPlace) {
                fourthPlace.placement = 4;
            }
        }

        // Группируем остальные команды по раундам выбывания
        const eliminatedTeams = Array.from(teamStats.values()).filter(
            team => !team.placement && team.eliminated_in_round !== null
        );

        // Группируем по раундам
        const byRound = eliminatedTeams.reduce((acc, team) => {
            const round = team.eliminated_in_round;
            if (!acc[round]) acc[round] = [];
            acc[round].push(team);
            return acc;
        }, {});

        // Назначаем места группами
        const rounds = Object.keys(byRound).map(Number).sort((a, b) => b - a);
        let currentPlace = 5; // Начинаем с 5-го места (1-4 уже заняты)

        rounds.forEach(round => {
            const teamsInRound = byRound[round];
            const placementRange = teamsInRound.length > 1 
                ? `${currentPlace}-${currentPlace + teamsInRound.length - 1}`
                : `${currentPlace}`;

            teamsInRound.forEach(team => {
                team.placement_range = placementRange;
                team.placement = currentPlace;
            });

            currentPlace += teamsInRound.length;
        });

        // Собираем финальный массив
        const result = Array.from(teamStats.values())
            .map(team => ({
                team_id: team.team_id,
                team_name: team.team_name,
                avatar_url: team.avatar_url,
                members: team.members,
                placement: team.placement,
                placement_range: team.placement_range,
                wins: team.wins,
                losses: team.losses,
                eliminated_in_round: team.eliminated_in_round,
                is_winner: team.is_winner
            }))
            .sort((a, b) => (a.placement || 999) - (b.placement || 999));

        return result;
    }
}

module.exports = new StandingsService();

