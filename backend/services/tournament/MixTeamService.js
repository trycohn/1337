const pool = require('../../db');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');

class MixTeamService {
    /**
     * Нормализация рейтинга участника с приоритетами
     */
    static normalizeParticipantRating(participant, ratingType) {
        let rating;
        
        if (ratingType === 'faceit') {
            // Приоритет для FACEIT: кастомный ELO → пользовательский ELO → дефолт
            if (participant.faceit_elo && !isNaN(parseInt(participant.faceit_elo)) && parseInt(participant.faceit_elo) > 0) {
                rating = parseInt(participant.faceit_elo);
            } else if (participant.user_faceit_elo && !isNaN(parseInt(participant.user_faceit_elo)) && parseInt(participant.user_faceit_elo) > 0) {
                rating = parseInt(participant.user_faceit_elo);
            } else if (participant.faceit_rating && !isNaN(parseInt(participant.faceit_rating)) && parseInt(participant.faceit_rating) > 0) {
                rating = parseInt(participant.faceit_rating);
            } else if (participant.user_faceit_rating && !isNaN(parseInt(participant.user_faceit_rating)) && parseInt(participant.user_faceit_rating) > 0) {
                rating = parseInt(participant.user_faceit_rating);
            } else {
                rating = 1000; // Дефолт для FACEIT
            }
        } else if (ratingType === 'premier') {
            // Приоритет для CS2 Premier: кастомный ранг → пользовательский ранг → дефолт
            if (participant.cs2_premier_rank && !isNaN(parseInt(participant.cs2_premier_rank)) && parseInt(participant.cs2_premier_rank) > 0) {
                rating = parseInt(participant.cs2_premier_rank);
            } else if (participant.user_premier_rank && !isNaN(parseInt(participant.user_premier_rank)) && parseInt(participant.user_premier_rank) > 0) {
                rating = parseInt(participant.user_premier_rank);
            } else if (participant.premier_rank && !isNaN(parseInt(participant.premier_rank)) && parseInt(participant.premier_rank) > 0) {
                rating = parseInt(participant.premier_rank);
            } else if (participant.user_premier_rating && !isNaN(parseInt(participant.user_premier_rating)) && parseInt(participant.user_premier_rating) > 0) {
                rating = parseInt(participant.user_premier_rating);
            } else {
                rating = 1; // Дефолт для Premier
            }
        } else {
            rating = 1000; // Fallback
        }
        
        console.log(`📊 Рейтинг участника ${participant.name}: ${rating} (тип: ${ratingType})`);
        return rating;
    }

    /**
     * Проверка баланса команд
     */
    static checkTeamBalance(teams, ratingType) {
        if (teams.length < 2) return { isBalanced: true, percentageDiff: 0 };

        const teamAverages = teams.map(team => {
            const ratings = team.members.map(member => 
                this.normalizeParticipantRating(member, ratingType)
            );
            return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        });

        const minAvg = Math.min(...teamAverages);
        const maxAvg = Math.max(...teamAverages);
        const percentageDiff = ((maxAvg - minAvg) / minAvg) * 100;

        return {
            teamAverages,
            minAvg,
            maxAvg,
            percentageDiff,
            isBalanced: percentageDiff <= 15
        };
    }

    /**
     * Оптимизированный попарный алгоритм для команд из 2 игроков
     */
    static generatePairedTeams(participants, ratingType) {
        console.log(`🎯 Используем оптимизированный попарный алгоритм для команд из 2 игроков`);
        
        const averageRating = participants.reduce((sum, p) => {
            return sum + this.normalizeParticipantRating(p, ratingType);
        }, 0) / participants.length;
        
        console.log(`📊 Общий средний рейтинг: ${Math.round(averageRating)}`);
        
        // Создаем все возможные пары и оцениваем их близость к среднему
        const allPairs = [];
        for (let i = 0; i < participants.length; i++) {
            for (let j = i + 1; j < participants.length; j++) {
                const player1 = participants[i];
                const player2 = participants[j];
                
                const rating1 = this.normalizeParticipantRating(player1, ratingType);
                const rating2 = this.normalizeParticipantRating(player2, ratingType);
                
                const pairAverage = (rating1 + rating2) / 2;
                const distanceFromAverage = Math.abs(pairAverage - averageRating);
                
                allPairs.push({
                    player1,
                    player2,
                    pairAverage,
                    distanceFromAverage
                });
            }
        }
        
        // Сортируем пары по близости к среднему
        allPairs.sort((a, b) => a.distanceFromAverage - b.distanceFromAverage);
        
        console.log(`📊 Создано ${allPairs.length} возможных пар`);
        
        // Жадно выбираем лучшие непересекающиеся пары
        const teams = [];
        const usedPlayers = new Set();
        const fullTeams = Math.floor(participants.length / 2);
        
        for (const pair of allPairs) {
            if (teams.length >= fullTeams) break;
            
            // Проверяем, что оба игрока не использованы
            if (!usedPlayers.has(pair.player1.participant_id) && 
                !usedPlayers.has(pair.player2.participant_id)) {
                
                teams.push({
                    name: `Команда ${teams.length + 1}`,
                    members: [pair.player1, pair.player2]
                });
                
                usedPlayers.add(pair.player1.participant_id);
                usedPlayers.add(pair.player2.participant_id);
                
                console.log(`✅ Команда ${teams.length}: ${pair.player1.name} + ${pair.player2.name} = ${Math.round(pair.pairAverage)} avg`);
            }
        }
        
        return teams;
    }

    /**
     * Алгоритм "змейка" для команд из 5+ игроков
     */
    static generateSnakeTeams(participants, teamSize, ratingType) {
        console.log(`🎯 Используем классический алгоритм "змейка" для команд из ${teamSize} игроков`);
        
        const fullTeams = Math.floor(participants.length / teamSize);
        const teams = [];
        
        // Создаем пустые команды
        for (let i = 0; i < fullTeams; i++) {
            teams.push({
                name: `Команда ${i + 1}`,
                members: []
            });
        }
        
        // Распределяем участников змейкой
        let participantIndex = 0;
        
        for (let round = 0; round < teamSize; round++) {
            const isEvenRound = round % 2 === 0;
            
            for (let i = 0; i < fullTeams && participantIndex < participants.length; i++) {
                const teamIndex = isEvenRound ? i : (fullTeams - 1 - i);
                const participant = participants[participantIndex];
                
                teams[teamIndex].members.push(participant);
                
                const participantRating = this.normalizeParticipantRating(participant, ratingType);
                console.log(`👤 Раунд ${round + 1}, игрок ${participant.name} (рейтинг: ${participantRating}) → Команда ${teamIndex + 1}`);
                
                participantIndex++;
            }
        }
        
        return teams;
    }

    /**
     * Перебалансировка команд для достижения 15% расхождения
     */
    static async rebalanceTeams(teams, ratingType, maxAttempts = 100) {
        console.log(`⚖️ НАЧИНАЕМ ПРОВЕРКУ БАЛАНСА КОМАНД (макс. расхождение 15%)`);
        
        let balanceCheck = this.checkTeamBalance(teams, ratingType);
        let rebalanceAttempts = 0;
        
        console.log(`📊 Изначальный баланс: ${Math.round(balanceCheck.percentageDiff)}%`);
        
        while (!balanceCheck.isBalanced && rebalanceAttempts < maxAttempts) {
            rebalanceAttempts++;
            
            // Находим самую сильную и самую слабую команды
            const teamAverages = teams.map((team, index) => ({
                index,
                average: team.members.reduce((sum, member) => 
                    sum + this.normalizeParticipantRating(member, ratingType), 0) / team.members.length,
                team
            }));
            
            teamAverages.sort((a, b) => b.average - a.average);
            const strongestTeam = teamAverages[0];
            const weakestTeam = teamAverages[teamAverages.length - 1];
            
            // Ищем оптимальный обмен игроками
            let swapMade = false;
            
            const strongTeamMembers = [...strongestTeam.team.members].sort((a, b) => {
                const ratingA = this.normalizeParticipantRating(a, ratingType);
                const ratingB = this.normalizeParticipantRating(b, ratingType);
                return ratingA - ratingB; // Слабейшие первыми
            });
            
            const weakTeamMembers = [...weakestTeam.team.members].sort((a, b) => {
                const ratingA = this.normalizeParticipantRating(a, ratingType);
                const ratingB = this.normalizeParticipantRating(b, ratingType);
                return ratingB - ratingA; // Сильнейшие первыми
            });
            
            // Пробуем обмены
            outerLoop: for (const strongMember of strongTeamMembers) {
                for (const weakMember of weakTeamMembers) {
                    const strongRating = this.normalizeParticipantRating(strongMember, ratingType);
                    const weakRating = this.normalizeParticipantRating(weakMember, ratingType);
                    
                    if (Math.abs(strongRating - weakRating) < 50) continue;
                    
                    // Создаем тестовые команды
                    const testTeams = teams.map((team, index) => {
                        if (index === strongestTeam.index) {
                            return {
                                ...team,
                                members: team.members.map(m => 
                                    m.participant_id === strongMember.participant_id ? weakMember : m
                                )
                            };
                        }
                        if (index === weakestTeam.index) {
                            return {
                                ...team,
                                members: team.members.map(m => 
                                    m.participant_id === weakMember.participant_id ? strongMember : m
                                )
                            };
                        }
                        return team;
                    });
                    
                    const testBalance = this.checkTeamBalance(testTeams, ratingType);
                    
                    if (testBalance.percentageDiff < balanceCheck.percentageDiff) {
                        console.log(`✅ Выгодный обмен: ${strongMember.name} ↔ ${weakMember.name}`);
                        
                        // Применяем обмен
                        teams[strongestTeam.index] = testTeams[strongestTeam.index];
                        teams[weakestTeam.index] = testTeams[weakestTeam.index];
                        
                        swapMade = true;
                        break outerLoop;
                    }
                }
            }
            
            // Если обмен не найден, пробуем случайную перестановку
            if (!swapMade && rebalanceAttempts % 10 === 0) {
                const team1Index = Math.floor(Math.random() * teams.length);
                let team2Index = Math.floor(Math.random() * teams.length);
                while (team2Index === team1Index) {
                    team2Index = Math.floor(Math.random() * teams.length);
                }
                
                const member1Index = Math.floor(Math.random() * teams[team1Index].members.length);
                const member2Index = Math.floor(Math.random() * teams[team2Index].members.length);
                
                const member1 = teams[team1Index].members[member1Index];
                const member2 = teams[team2Index].members[member2Index];
                
                teams[team1Index].members[member1Index] = member2;
                teams[team2Index].members[member2Index] = member1;
                
                swapMade = true;
            }
            
            if (!swapMade) break;
            
            balanceCheck = this.checkTeamBalance(teams, ratingType);
        }
        
        const finalBalance = this.checkTeamBalance(teams, ratingType);
        console.log(`⚖️ ФИНАЛЬНЫЙ БАЛАНС: ${Math.round(finalBalance.percentageDiff)}% за ${rebalanceAttempts} попыток`);
        
        return { teams, balanceStats: finalBalance, rebalanceAttempts };
    }

    /**
     * Генерация микс команд
     */
    static async generateMixTeams(tournamentId, userId, ratingType = 'faceit', shuffle = false) {
        console.log(`🎯 Генерация микс команд для турнира ${tournamentId}`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Получаем турнир с team_size
            const tournament = await TournamentRepository.getById(tournamentId);
            if (!tournament) {
                throw new Error('Турнир не найден');
            }
            
            if (tournament.format !== 'mix') {
                throw new Error('Генерация команд доступна только для микс турниров');
            }
            
            const teamSize = parseInt(tournament.team_size) || 5;
            console.log(`📊 Размер команды: ${teamSize}`);
            
            // Получаем участников
            const participants = await ParticipantRepository.getAllByTournamentId(tournamentId);
            if (participants.length < 2) {
                throw new Error('Недостаточно участников для формирования команд');
            }
            
            console.log(`👥 Всего участников: ${participants.length}`);
            
            // Обогащаем участников нормализованными рейтингами
            participants.forEach(participant => {
                participant.normalized_faceit_rating = this.normalizeParticipantRating(participant, 'faceit');
                participant.normalized_premier_rating = this.normalizeParticipantRating(participant, 'premier');
            });
            
            // Сортируем участников по рейтингу
            const sortedParticipants = [...participants].sort((a, b) => {
                const ratingA = ratingType === 'faceit' ? a.normalized_faceit_rating : a.normalized_premier_rating;
                const ratingB = ratingType === 'faceit' ? b.normalized_faceit_rating : b.normalized_premier_rating;
                
                if (shuffle) {
                    return Math.random() - 0.5; // Случайное перемешивание
                }
                
                if (ratingB === ratingA) {
                    return Math.random() - 0.5; // Случайность для равных рейтингов
                }
                
                return ratingB - ratingA; // По убыванию
            });
            
            const fullTeams = Math.floor(participants.length / teamSize);
            const playersInTeams = fullTeams * teamSize;
            const remainingPlayers = participants.length - playersInTeams;
            
            console.log(`📊 Статистика: ${fullTeams} команд, ${playersInTeams} в командах, ${remainingPlayers} вне команд`);
            
            if (fullTeams === 0) {
                throw new Error(`Недостаточно участников. Нужно минимум ${teamSize}, есть ${participants.length}`);
            }
            
            // Удаляем существующие команды
            await TeamRepository.deleteAllByTournamentId(tournamentId, client);
            
            // Генерируем команды в зависимости от размера
            let teams;
            if (teamSize === 2) {
                teams = this.generatePairedTeams(sortedParticipants.slice(0, playersInTeams), ratingType);
            } else {
                teams = this.generateSnakeTeams(sortedParticipants.slice(0, playersInTeams), teamSize, ratingType);
            }
            
            // Перебалансируем команды
            const balanceResult = await this.rebalanceTeams(teams, ratingType);
            teams = balanceResult.teams;
            
            // Сохраняем команды в БД
            const createdTeams = [];
            const participantIdsInTeams = [];
            
            for (const team of teams) {
                const teamResult = await client.query(
                    'INSERT INTO tournament_teams (tournament_id, name, creator_id) VALUES ($1, $2, $3) RETURNING *',
                    [tournamentId, team.name, tournament.created_by]
                );
                
                const teamId = teamResult.rows[0].id;
                const members = [];
                
                for (const member of team.members) {
                    await client.query(
                        'INSERT INTO tournament_team_members (team_id, user_id, participant_id) VALUES ($1, $2, $3)',
                        [teamId, member.user_id, member.participant_id]
                    );
                    
                    participantIdsInTeams.push(member.participant_id);
                    members.push({
                        participant_id: member.participant_id,
                        user_id: member.user_id,
                        name: member.name,
                        faceit_elo: member.faceit_elo || member.user_faceit_elo,
                        cs2_premier_rank: member.cs2_premier_rank || member.user_premier_rank,
                        normalized_faceit_rating: member.normalized_faceit_rating,
                        normalized_premier_rating: member.normalized_premier_rating
                    });
                }
                
                createdTeams.push({
                    id: teamId,
                    name: team.name,
                    members: members,
                    averageRating: balanceResult.balanceStats.teamAverages ? 
                        Math.round(balanceResult.balanceStats.teamAverages[createdTeams.length]) : 0
                });
            }
            
            // Обновляем флаги участников
            if (participantIdsInTeams.length > 0) {
                await client.query(
                    'UPDATE tournament_participants SET in_team = TRUE WHERE id = ANY($1::int[])',
                    [participantIdsInTeams]
                );
            }
            
            const participantIdsNotInTeams = sortedParticipants
                .slice(playersInTeams)
                .map(p => p.participant_id);
            
            if (participantIdsNotInTeams.length > 0) {
                await client.query(
                    'UPDATE tournament_participants SET in_team = FALSE WHERE id = ANY($1::int[])',
                    [participantIdsNotInTeams]
                );
            }
            
            // Обновляем тип турнира на командный
            await client.query(
                'UPDATE tournaments SET participant_type = $1 WHERE id = $2',
                ['team', tournamentId]
            );
            
            await client.query('COMMIT');
            
            // Логируем событие
            await logTournamentEvent(tournamentId, userId, 'mix_teams_generated', {
                teamsCount: createdTeams.length,
                participantsCount: playersInTeams,
                ratingType,
                algorithm: teamSize === 2 ? 'paired' : 'snake',
                balancePercentage: balanceResult.balanceStats.percentageDiff
            });
            
            // Отправляем объявление в чат
            await sendTournamentChatAnnouncement(
                tournamentId,
                `🏆 Сформированы микс команды! Создано ${createdTeams.length} команд из ${playersInTeams} участников. Баланс команд: ${Math.round(balanceResult.balanceStats.percentageDiff)}%`
            );
            
            return {
                teams: createdTeams,
                summary: {
                    totalParticipants: participants.length,
                    teamsCreated: fullTeams,
                    participantsInTeams: playersInTeams,
                    participantsNotInTeams: remainingPlayers,
                    ratingType,
                    teamSize,
                    algorithm: teamSize === 2 ? 'paired_optimization' : 'snake_distribution',
                    balanceStats: balanceResult.balanceStats,
                    rebalanceAttempts: balanceResult.rebalanceAttempts
                }
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Получение оригинальных участников турнира (с группировкой)
     */
    static async getOriginalParticipants(tournamentId) {
        const participants = await ParticipantRepository.getAllByTournamentId(tournamentId);
        
        const inTeam = participants.filter(p => p.in_team);
        const notInTeam = participants.filter(p => !p.in_team);
        
        return {
            all: participants,
            inTeam,
            notInTeam,
            total: participants.length,
            inTeamCount: inTeam.length,
            notInTeamCount: notInTeam.length
        };
    }
}

module.exports = MixTeamService; 