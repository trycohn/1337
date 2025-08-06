/**
 * 📊 СЕРВИС РЕЗУЛЬТАТОВ ТУРНИРА
 * Вычисляет статистику и места участников на основе данных из БД
 */

const pool = require('../../db');

class TournamentResultsService {
    /**
     * Получить полные результаты турнира с правильной статистикой
     */
    static async getTournamentResults(tournamentId) {
        console.log(`🔍 Запрос результатов для турнира ID: ${tournamentId}`);

        try {
            // Получаем информацию о турнире
            const tournamentQuery = `
                SELECT * FROM tournaments WHERE id = $1
            `;
            
            const tournamentResult = await pool.query(tournamentQuery, [tournamentId]);
            
            if (tournamentResult.rows.length === 0) {
                throw new Error(`Турнир с ID ${tournamentId} не найден`);
            }
            
            const tournament = tournamentResult.rows[0];
            console.log(`✅ Турнир найден: ${tournament.name}, формат: ${tournament.format}`);

            // Получаем команды для микс турниров
            if (tournament.format === 'mix') {
                const teamsQuery = `
                    SELECT 
                        id, name, avatar_url, captain_id, members
                    FROM tournament_teams 
                    WHERE tournament_id = $1
                    ORDER BY id
                `;
                const teamsResult = await pool.query(teamsQuery, [tournamentId]);
                tournament.teams = teamsResult.rows;
                console.log(`👥 Найдено команд: ${tournament.teams.length}`);
            }

            // Получаем всех участников турнира
            const participantsQuery = `
                SELECT 
                    tp.id,
                    tp.user_id,
                    tp.name,
                    u.username,
                    u.avatar_url,
                    tp.in_team
                FROM tournament_participants tp
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tp.tournament_id = $1
                ORDER BY tp.id
            `;
            
            const participantsResult = await pool.query(participantsQuery, [tournamentId]);
            const participants = participantsResult.rows;
            console.log(`👥 Найдено участников: ${participants.length}`);

            // Получаем все матчи турнира
            const matchesQuery = `
                SELECT 
                    m.id,
                    m.match_number,
                    m.round,
                    m.bracket_type,
                    m.round_name,
                    m.match_title,
                    m.team1_id,
                    m.team2_id,
                    m.winner_team_id,
                    m.status,
                    m.score1,
                    m.score2,
                    m.maps_data,
                    m.created_at,
                    m.updated_at
                FROM matches m
                WHERE m.tournament_id = $1
                ORDER BY m.match_number
            `;
            
            const matchesResult = await pool.query(matchesQuery, [tournamentId]);
            const matches = matchesResult.rows;
            console.log(`🎮 Найдено матчей: ${matches.length}, завершенных: ${matches.filter(m => m.status === 'completed').length}`);

            // Вычисляем статистику
            const statisticsMap = this.calculateStatistics(tournament, participants, matches);
            
            // Определяем места
            const standings = this.calculateStandings(tournament, statisticsMap, matches);
            
            // Получаем историю матчей
            const matchHistory = this.getMatchHistory(tournament, matches, statisticsMap);
            
            // Преобразуем Map в объект для JSON сериализации
            const statistics = {};
            for (const [key, value] of statisticsMap) {
                statistics[key] = value;
            }

            return {
                tournament,
                participants,
                matches,
                statistics,
                standings,
                matchHistory
            };

        } catch (error) {
            console.error('❌ Ошибка при получении результатов турнира:', error);
            throw error;
        }
    }

    /**
     * Вычисляет статистику побед/поражений для всех участников
     */
    static calculateStatistics(tournament, participants, matches) {
        console.log('📊 Вычисляем статистику...');
        const stats = new Map();
        
        try {
            // Инициализируем статистику
            if (tournament.format === 'mix' && tournament.teams && tournament.teams.length > 0) {
                // Для микс турниров работаем с командами
                console.log(`👥 Инициализируем ${tournament.teams.length} команд`);
                tournament.teams.forEach(team => {
                    stats.set(team.id, {
                        id: team.id,
                        name: team.name,
                        avatar_url: team.avatar_url,
                        type: 'team',
                        members: team.members || [],
                        wins: 0,
                        losses: 0,
                        elimination_round: null,
                        last_match_round: 0
                    });
                });
            } else {
                // Для остальных турниров работаем с участниками
                console.log(`👤 Инициализируем ${participants.length} участников`);
                participants.forEach(participant => {
                    stats.set(participant.id, {
                        id: participant.id,
                        name: participant.name || participant.username,
                        avatar_url: participant.avatar_url,
                        user_id: participant.user_id,
                        type: 'individual',
                        wins: 0,
                        losses: 0,
                        elimination_round: null,
                        last_match_round: 0
                    });
                });
            }

            // Обрабатываем завершенные матчи
            const completedMatches = matches.filter(m => m.status === 'completed' && m.winner_team_id);
            console.log(`🎮 Обрабатываем ${completedMatches.length} завершенных матчей`);
            
            completedMatches.forEach(match => {
                const winnerId = match.winner_team_id;
                const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;
                
                // Обновляем статистику победителя
                if (stats.has(winnerId)) {
                    const winner = stats.get(winnerId);
                    winner.wins++;
                    winner.last_match_round = Math.max(winner.last_match_round, match.round);
                    stats.set(winnerId, winner);
                }
                
                // Обновляем статистику проигравшего (только если это не BYE)
                if (loserId && stats.has(loserId)) {
                    const loser = stats.get(loserId);
                    loser.losses++;
                    loser.last_match_round = Math.max(loser.last_match_round, match.round);
                    
                    // Записываем раунд выбывания
                    if (!loser.elimination_round || match.round > loser.elimination_round) {
                        loser.elimination_round = match.round;
                    }
                    
                    stats.set(loserId, loser);
                }
            });

            console.log(`✅ Статистика вычислена для ${stats.size} участников`);
            return stats;
            
        } catch (error) {
            console.error('❌ Ошибка при вычислении статистики:', error);
            return stats; // Возвращаем пустую статистику вместо ошибки
        }
    }

    /**
     * Определяет места участников на основе структуры турнира
     */
    static calculateStandings(tournament, statistics, matches) {
        console.log('🏆 Вычисляем места участников...');
        
        try {
            const participants = Array.from(statistics.values());
            console.log(`👤 Обрабатываем ${participants.length} участников`);
            
            // Простая сортировка по победам и поражениям
            const standings = participants
                .sort((a, b) => {
                    // Сначала по количеству побед (больше лучше)
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    // Потом по количеству поражений (меньше лучше)
                    if (a.losses !== b.losses) return a.losses - b.losses;
                    // Потом по последнему раунду (дальше лучше)
                    return b.last_match_round - a.last_match_round;
                })
                .map((participant, index) => ({
                    ...participant,
                    place: index + 1
                }));
            
            console.log(`✅ Места вычислены для ${standings.length} участников`);
            return standings;
            
        } catch (error) {
            console.error('❌ Ошибка при вычислении мест:', error);
            return []; // Возвращаем пустой массив вместо ошибки
        }
    }

    /**
     * Вычисляет места для Single Elimination
     */
    static calculateSingleEliminationStandings(participants, matches) {
        const standings = [...participants];
        
        // Находим финальный матч
        const finalMatch = matches.find(m => 
            m.status === 'completed' && 
            m.bracket_type === 'winner' && 
            m.round === Math.max(...matches.filter(m2 => m2.bracket_type === 'winner').map(m2 => m2.round))
        );
        
        if (finalMatch) {
            // 1 место - победитель финала
            const winner = standings.find(p => p.id === finalMatch.winner_team_id);
            if (winner) winner.place = 1;
            
            // 2 место - проигравший финала
            const finalist = standings.find(p => p.id === (
                finalMatch.team1_id === finalMatch.winner_team_id ? finalMatch.team2_id : finalMatch.team1_id
            ));
            if (finalist) finalist.place = 2;
        }
        
        // Остальные места по раунду выбывания
        const withoutTopTwo = standings.filter(p => !p.place);
        const groupedByElimination = this.groupByEliminationRound(withoutTopTwo);
        
        let currentPlace = 3;
        Object.keys(groupedByElimination)
            .sort((a, b) => parseInt(b) - parseInt(a)) // От большего раунда к меньшему
            .forEach(round => {
                const group = groupedByElimination[round];
                group.forEach(participant => {
                    participant.place = currentPlace;
                });
                currentPlace += group.length;
            });
        
        return standings.sort((a, b) => a.place - b.place);
    }

    /**
     * Вычисляет места для Double Elimination
     */
    static calculateDoubleEliminationStandings(participants, matches) {
        const standings = [...participants];
        
        // Находим Grand Final
        const grandFinal = matches.find(m => 
            m.status === 'completed' && 
            m.bracket_type === 'grand_final'
        );
        
        if (grandFinal) {
            // 1 место - победитель Grand Final
            const champion = standings.find(p => p.id === grandFinal.winner_team_id);
            if (champion) champion.place = 1;
            
            // 2 место - проигравший Grand Final
            const runnerUp = standings.find(p => p.id === (
                grandFinal.team1_id === grandFinal.winner_team_id ? grandFinal.team2_id : grandFinal.team1_id
            ));
            if (runnerUp) runnerUp.place = 2;
        }
        
        // Находим финал лузеров для 3 места
        const loserFinal = matches.find(m => 
            m.status === 'completed' && 
            m.bracket_type === 'loser_final'
        );
        
        if (loserFinal) {
            // 3 место - проигравший финала лузеров
            const thirdPlace = standings.find(p => p.id === (
                loserFinal.team1_id === loserFinal.winner_team_id ? loserFinal.team2_id : loserFinal.team1_id
            ));
            if (thirdPlace) thirdPlace.place = 3;
        }
        
        // Остальные места по раунду выбывания
        const withoutTopThree = standings.filter(p => !p.place);
        const groupedByElimination = this.groupByEliminationRound(withoutTopThree);
        
        let currentPlace = 4;
        Object.keys(groupedByElimination)
            .sort((a, b) => parseInt(b) - parseInt(a))
            .forEach(round => {
                const group = groupedByElimination[round];
                group.forEach(participant => {
                    participant.place = currentPlace;
                });
                currentPlace += group.length;
            });
        
        return standings.sort((a, b) => a.place - b.place);
    }

    /**
     * Группирует участников по раунду выбывания
     */
    static groupByEliminationRound(participants) {
        return participants.reduce((groups, participant) => {
            const round = participant.elimination_round || 0;
            if (!groups[round]) groups[round] = [];
            groups[round].push(participant);
            return groups;
        }, {});
    }

    /**
     * Получает историю матчей
     */
    static getMatchHistory(tournament, matches, statistics) {
        console.log('📋 Формируем историю матчей...');
        
        try {
            const completedMatches = matches.filter(m => m.status === 'completed' && m.winner_team_id);
            console.log(`🎮 Найдено ${completedMatches.length} завершенных матчей`);
            
            return completedMatches
                .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
                .map(match => {
                    const winner = statistics.get(match.winner_team_id);
                    const loserId = match.team1_id === match.winner_team_id ? match.team2_id : match.team1_id;
                    const loser = statistics.get(loserId);
                    
                    return {
                        id: match.id,
                        match_number: match.match_number,
                        round: match.round,
                        round_name: match.round_name || `Раунд ${match.round}`,
                        bracket_type: match.bracket_type || 'winner',
                        winner,
                        loser,
                        score1: match.score1,
                        score2: match.score2,
                        maps_data: match.maps_data,
                        created_at: match.created_at,
                        updated_at: match.updated_at
                    };
                });
                
        } catch (error) {
            console.error('❌ Ошибка при формировании истории матчей:', error);
            return []; // Возвращаем пустой массив вместо ошибки
        }
    }
}

module.exports = TournamentResultsService;