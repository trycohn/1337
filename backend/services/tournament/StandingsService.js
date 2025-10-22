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

            // Получаем все команды/участников в зависимости от типа турнира
            let teams = [];
            
            // 🔧 ИСПРАВЛЕНИЕ: Поддержка SOLO турниров
            if (tournament.participant_type === 'solo') {
                // Для SOLO турниров участники напрямую в tournament_participants
                const participantsQuery = `
                    SELECT 
                        tp.id as team_id,
                        COALESCE(u.username, tp.name) as team_name,
                        u.avatar_url as avatar_url,
                        json_build_array(
                            json_build_object(
                                'user_id', u.id,
                                'name', COALESCE(u.username, tp.name),
                                'avatar_url', u.avatar_url,
                                'is_captain', true
                            )
                        ) as members
                    FROM tournament_participants tp
                    LEFT JOIN users u ON tp.user_id = u.id
                    WHERE tp.tournament_id = $1
                `;
                
                const participantsResult = await pool.query(participantsQuery, [tournamentId]);
                teams = participantsResult.rows;
                
                console.log(`📊 [Standings] SOLO турнир: получено ${teams.length} участников`);
                
            } else {
                // Для командных турниров (team, mix, cs2_*)
                const participantsQuery = `
                    SELECT 
                        tt.id as team_id,
                        tt.name as team_name,
                        NULL as avatar_url,
                        json_agg(
                            json_build_object(
                                'user_id', u.id,
                                'name', COALESCE(u.username, tp.name),
                                'avatar_url', u.avatar_url,
                                'is_captain', ttm.is_captain
                            ) ORDER BY ttm.is_captain DESC NULLS LAST, ttm.id
                        ) FILTER (WHERE u.id IS NOT NULL OR tp.id IS NOT NULL) as members
                    FROM tournament_teams tt
                    LEFT JOIN tournament_team_members ttm ON tt.id = ttm.team_id
                    LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                    LEFT JOIN users u ON tp.user_id = u.id
                    WHERE tt.tournament_id = $1
                    GROUP BY tt.id, tt.name
                `;

                const participantsResult = await pool.query(participantsQuery, [tournamentId]);
                teams = participantsResult.rows;
                
                console.log(`📊 [Standings] TEAM турнир: получено ${teams.length} команд`);
            }

            // Получаем все матчи
            const matchesQuery = `
                SELECT * FROM matches
                WHERE tournament_id = $1
                ORDER BY round ASC, match_number ASC
            `;
            const matchesResult = await pool.query(matchesQuery, [tournamentId]);
            const matches = matchesResult.rows;

            console.log(`📊 [Standings] Данные для расчета:`, {
                tournament_id: tournamentId,
                participant_type: tournament.participant_type,
                format: tournament.format,
                teams_count: teams.length,
                matches_count: matches.length
            });

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
        console.log(`🔍 [_calculateStandings] Начало расчета для ${teams.length} команд`);
        
        const standings = [];

        // Проверка на пустые данные
        if (!teams || teams.length === 0) {
            console.log(`⚠️ [_calculateStandings] Нет команд для расчета`);
            return [];
        }

        // Находим финальный матч
        const finalMatch = matches.find(m => 
            m.bracket_type === 'grand_final' || 
            m.bracket_type === 'final'
        );

        console.log(`🏆 [_calculateStandings] Финальный матч:`, {
            found: !!finalMatch,
            id: finalMatch?.id,
            winner_team_id: finalMatch?.winner_team_id,
            bracket_type: finalMatch?.bracket_type
        });

        if (!finalMatch || !finalMatch.winner_team_id) {
            // Турнир не завершен - возвращаем команды без мест
            console.log(`⚠️ [_calculateStandings] Турнир не завершен, возвращаем команды без мест`);
            
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

        // 🔧 ИСПРАВЛЕНИЕ: Разная логика для SE и DE
        const isDoubleElimination = tournament.bracket_type === 'double_elimination' || 
                                   tournament.bracket_type === 'doubleElimination';

        console.log(`🎯 [_calculateStandings] Тип турнира: ${isDoubleElimination ? 'DE' : 'SE'}`);

        if (isDoubleElimination) {
            // ═══════════════════════════════════════════
            // DOUBLE ELIMINATION: Специальная логика
            // ═══════════════════════════════════════════
            
            // 3-е место: проигравший Loser Final
            const loserFinalMatch = matches.find(m => m.bracket_type === 'loser_final');
            
            if (loserFinalMatch && loserFinalMatch.winner_team_id) {
                // Победитель Loser Final идет в Grand Final (уже учтен)
                // Проигравший Loser Final = 3-е место
                const thirdPlaceId = loserFinalMatch.team1_id === loserFinalMatch.winner_team_id
                    ? loserFinalMatch.team2_id
                    : loserFinalMatch.team1_id;
                
                const thirdPlace = teamStats.get(thirdPlaceId);
                if (thirdPlace) {
                    thirdPlace.placement = 3;
                    console.log(`🥉 [DE] 3-е место: команда ${thirdPlaceId} (проигравший Loser Final)`);
                }
            }

            // 4-е место и далее: группируем по раундам LOSERS bracket
            const losersTeams = Array.from(teamStats.values()).filter(
                team => !team.placement && 
                       team.bracket_type === 'loser' &&
                       team.eliminated_in_round !== null
            );

            console.log(`📊 [DE] Команд в Losers Bracket без места: ${losersTeams.length}`);

            // Группируем по раундам losers bracket
            const losersByRound = losersTeams.reduce((acc, team) => {
                const round = team.eliminated_in_round;
                if (!acc[round]) acc[round] = [];
                acc[round].push(team);
                return acc;
            }, {});

            // Сортируем раунды от последнего к первому
            const loserRounds = Object.keys(losersByRound).map(Number).sort((a, b) => b - a);
            let currentPlace = 4; // Начинаем с 4-го места

            loserRounds.forEach(round => {
                const teamsInRound = losersByRound[round];
                const placementRange = teamsInRound.length > 1 
                    ? `${currentPlace}-${currentPlace + teamsInRound.length - 1}`
                    : `${currentPlace}`;

                console.log(`📊 [DE] Losers Round ${round}: ${teamsInRound.length} команд → места ${placementRange}`);

                teamsInRound.forEach(team => {
                    team.placement_range = placementRange;
                    team.placement = currentPlace;
                });

                currentPlace += teamsInRound.length;
            });

            // Команды выбывшие в Winners Bracket (проиграли первый матч и сразу вылетели)
            const winnersEliminatedTeams = Array.from(teamStats.values()).filter(
                team => !team.placement && 
                       team.bracket_type === 'winner' &&
                       team.eliminated_in_round !== null
            );

            if (winnersEliminatedTeams.length > 0) {
                const placementRange = winnersEliminatedTeams.length > 1
                    ? `${currentPlace}-${currentPlace + winnersEliminatedTeams.length - 1}`
                    : `${currentPlace}`;

                console.log(`📊 [DE] Winners Round 1 eliminated: ${winnersEliminatedTeams.length} команд → места ${placementRange}`);

                winnersEliminatedTeams.forEach(team => {
                    team.placement_range = placementRange;
                    team.placement = currentPlace;
                });
            }

        } else {
            // ═══════════════════════════════════════════
            // SINGLE ELIMINATION: Стандартная логика
            // ═══════════════════════════════════════════
            
            // 3-е место: матч за 3 место
            const thirdPlaceMatch = matches.find(m => 
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
        }

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

        console.log(`📊 [_calculateStandings] Финальный результат:`, {
            total: result.length,
            with_placement: result.filter(t => t.placement).length,
            top_3: result.slice(0, 3).map(t => ({ name: t.team_name, placement: t.placement }))
        });

        return result;
    }
}

module.exports = new StandingsService();

