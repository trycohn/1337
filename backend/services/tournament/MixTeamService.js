const pool = require('../../db');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');

class MixTeamService {
    /**
     * 🎯 РАСЧЕТ СРЕДНЕГО РЕЙТИНГА КОМАНДЫ
     */
    static calculateTeamAverageRating(members, ratingType) {
        if (!members || members.length === 0) return 0;
        
        const ratings = members.map(member => this.normalizeParticipantRating(member, ratingType))
                              .filter(rating => !isNaN(rating) && rating > 0);
        
        if (ratings.length === 0) return ratingType === 'faceit' ? 1000 : 5;
        
        const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        return Math.round(average);
    }

    /**
     * 🆕 ОПРЕДЕЛЕНИЕ КАПИТАНА КОМАНДЫ ПО НАИВЫСШЕМУ РЕЙТИНГУ
     * @param {Array} members - Участники команды
     * @param {string} ratingType - Тип рейтинга ('faceit' или 'premier')
     * @returns {Object} Объект с информацией о капитане и его рейтинге
     */
    static determineCaptain(members, ratingType) {
        if (!members || members.length === 0) {
            return { captain: null, captainRating: null };
        }
        
        console.log(`👑 [determineCaptain] Анализ ${members.length} участников для выбора капитана (тип рейтинга: ${ratingType})`);
        
        // Сортируем участников по рейтингу (по убыванию) с приоритизацией ручных рейтингов
        const sortedMembers = [...members].sort((a, b) => {
            const ratingA = this.normalizeParticipantRating(a, ratingType);
            const ratingB = this.normalizeParticipantRating(b, ratingType);
            return ratingB - ratingA;
        });
        
        const captain = sortedMembers[0];
        const captainRating = this.normalizeParticipantRating(captain, ratingType);
        
        // 🆕 ОПРЕДЕЛЯЕМ ИСПОЛЬЗОВАЛСЯ ЛИ РУЧНОЙ РЕЙТИНГ
        let usedManualRating = false;
        if (ratingType === 'faceit') {
            usedManualRating = Boolean(captain.faceit_elo && !isNaN(parseInt(captain.faceit_elo)) && parseInt(captain.faceit_elo) > 0);
        } else {
            usedManualRating = Boolean(captain.cs2_premier_rank && !isNaN(parseInt(captain.cs2_premier_rank)) && parseInt(captain.cs2_premier_rank) > 0);
        }
        
        console.log(`👑 [determineCaptain] Выбран капитан: ${captain.name} (рейтинг: ${captainRating}, ручной: ${usedManualRating})`);
        
        // 🆕 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ВСЕХ УЧАСТНИКОВ
        console.log(`📊 [determineCaptain] Рейтинги всех участников:`);
        sortedMembers.forEach((member, index) => {
            const memberRating = this.normalizeParticipantRating(member, ratingType);
            const memberUsedManual = ratingType === 'faceit' 
                ? Boolean(member.faceit_elo && !isNaN(parseInt(member.faceit_elo)) && parseInt(member.faceit_elo) > 0)
                : Boolean(member.cs2_premier_rank && !isNaN(parseInt(member.cs2_premier_rank)) && parseInt(member.cs2_premier_rank) > 0);
            
            console.log(`   ${index + 1}. ${member.name}: ${memberRating} (ручной: ${memberUsedManual}) ${index === 0 ? '👑 КАПИТАН' : ''}`);
        });
        
        return {
            captain,
            captainRating,
            usedManualRating, // 🆕 Флаг использования ручного рейтинга
            totalCandidates: members.length
        };
    }

    /**
     * Нормализация рейтинга участника с консистентными приоритетами
     * 🔧 ОБНОВЛЕНО: Улучшенное логирование и обработка ручных рейтингов
     */
    static normalizeParticipantRating(participant, ratingType) {
        let rating;
        let usedManualRating = false;
        let source = '';
        
        if (ratingType === 'faceit') {
            // 🎯 ПРИОРИТЕТ ДЛЯ FACEIT (согласно требованиям):
            // 1. Кастомный ELO участника турнира (РУЧНОЙ РЕЙТИНГ) - participant.faceit_elo
            // 2. ELO зарегистрированного пользователя - user_faceit_elo  
            // 3. FACEIT рейтинг пользователя (резервный) - faceit_rating
            // 4. Дефолт 1000
            
            if (participant.faceit_elo && !isNaN(parseInt(participant.faceit_elo)) && parseInt(participant.faceit_elo) > 0) {
                rating = parseInt(participant.faceit_elo);
                usedManualRating = true;
                source = 'manual_tournament_participant';
            } else if (participant.user_faceit_elo && !isNaN(parseInt(participant.user_faceit_elo)) && parseInt(participant.user_faceit_elo) > 0) {
                rating = parseInt(participant.user_faceit_elo);
                source = 'user_profile';
            } else if (participant.faceit_rating && !isNaN(parseInt(participant.faceit_rating)) && parseInt(participant.faceit_rating) > 0) {
                rating = parseInt(participant.faceit_rating);
                source = 'legacy_faceit_rating';
            } else if (participant.user_faceit_rating && !isNaN(parseInt(participant.user_faceit_rating)) && parseInt(participant.user_faceit_rating) > 0) {
                rating = parseInt(participant.user_faceit_rating);
                source = 'legacy_user_faceit_rating';
            } else {
                rating = 1000; // Дефолт для FACEIT
                source = 'default_faceit';
            }
        } else if (ratingType === 'premier') {
            // 🎯 ПРИОРИТЕТ ДЛЯ CS2 PREMIER (согласно требованиям):
            // 1. Кастомный ранг участника турнира (РУЧНОЙ РЕЙТИНГ) - participant.cs2_premier_rank
            // 2. Premier ранг зарегистрированного пользователя - user_cs2_premier_rank
            // 3. Дефолт 5
            
            if (participant.cs2_premier_rank && !isNaN(parseInt(participant.cs2_premier_rank)) && parseInt(participant.cs2_premier_rank) > 0) {
                rating = parseInt(participant.cs2_premier_rank);
                usedManualRating = true;
                source = 'manual_tournament_participant';
            } else if (participant.user_cs2_premier_rank && !isNaN(parseInt(participant.user_cs2_premier_rank)) && parseInt(participant.user_cs2_premier_rank) > 0) {
                rating = parseInt(participant.user_cs2_premier_rank);
                source = 'user_profile';
            } else if (participant.premier_rank && !isNaN(parseInt(participant.premier_rank)) && parseInt(participant.premier_rank) > 0) {
                rating = parseInt(participant.premier_rank);
                source = 'legacy_premier_rank';
            } else if (participant.premier_rating && !isNaN(parseInt(participant.premier_rating)) && parseInt(participant.premier_rating) > 0) {
                rating = parseInt(participant.premier_rating);
                source = 'legacy_premier_rating';
            } else if (participant.user_premier_rating && !isNaN(parseInt(participant.user_premier_rating)) && parseInt(participant.user_premier_rating) > 0) {
                rating = parseInt(participant.user_premier_rating);
                source = 'legacy_user_premier_rating';
            } else {
                rating = 5; // Дефолт для Premier
                source = 'default_premier';
            }
        } else {
            // Fallback на faceit если тип не определен
            rating = 1000;
            source = 'fallback_faceit';
        }
        
        // 🆕 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ С ИНФОРМАЦИЕЙ ОБ ИСТОЧНИКЕ РЕЙТИНГА
        console.log(`📊 [normalizeParticipantRating] ${participant.name}: рейтинг ${rating} (тип: ${ratingType}, источник: ${source}, ручной: ${usedManualRating})`);
        
        // 🆕 ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ ДОСТУПНЫХ РЕЙТИНГОВ
        if (process.env.NODE_ENV === 'development') {
            console.log(`   🔍 Доступные рейтинги для ${participant.name}:`, {
                faceit_elo: participant.faceit_elo,
                user_faceit_elo: participant.user_faceit_elo,
                cs2_premier_rank: participant.cs2_premier_rank,
                user_cs2_premier_rank: participant.user_cs2_premier_rank,
                faceit_rating: participant.faceit_rating,
                premier_rank: participant.premier_rank,
                premier_rating: participant.premier_rating,
                user_premier_rating: participant.user_premier_rating
            });
        }
        
        return rating;
    }

    /**
     * 🆕 УЛУЧШЕННЫЙ МАТЕМАТИЧЕСКИЙ АЛГОРИТМ ФОРМИРОВАНИЯ КОМАНД
     * Принципы:
     * 1. Минимизация расхождения между командами  
     * 2. Сильный + слабый игрок в одной команде
     * 3. Допустимое отклонение +-20% от среднего
     */
    static generateOptimalTeams(participants, teamSize, ratingType) {
        console.log(`🎯 [generateOptimalTeams] Запуск улучшенного алгоритма для ${participants.length} участников, размер команды: ${teamSize}`);
        
        // 1. Сортируем участников по рейтингу (по убыванию)
        const sortedParticipants = [...participants].sort((a, b) => {
            const ratingA = this.normalizeParticipantRating(a, ratingType);
            const ratingB = this.normalizeParticipantRating(b, ratingType);
            return ratingB - ratingA; // По убыванию (сильнейшие первыми)
        });
        
        // 2. Рассчитываем общий средний рейтинг
        const totalRating = sortedParticipants.reduce((sum, p) => 
            sum + this.normalizeParticipantRating(p, ratingType), 0
        );
        const averageRating = totalRating / sortedParticipants.length;
        const targetTeamRating = averageRating * teamSize; // Целевой рейтинг команды
        
        console.log(`📊 [generateOptimalTeams] Средний рейтинг: ${Math.round(averageRating)}, целевой рейтинг команды: ${Math.round(targetTeamRating)}`);
        
        const fullTeams = Math.floor(sortedParticipants.length / teamSize);
        const playersInTeams = fullTeams * teamSize;
        const participantsForTeams = sortedParticipants.slice(0, playersInTeams);
        
        let teams = [];
        
        if (teamSize === 2) {
            teams = this.generateOptimalPairs(participantsForTeams, ratingType, averageRating);
        } else {
            teams = this.generateOptimalLargeTeams(participantsForTeams, teamSize, ratingType, averageRating);
        }
        
        // 3. Проверяем и улучшаем баланс команд
        const balanceResult = this.optimizeTeamBalance(teams, ratingType, averageRating);
        
        console.log(`✅ [generateOptimalTeams] Создано ${teams.length} команд с балансом ${Math.round(balanceResult.finalBalance)}%`);
        return teams;
    }

    /**
     * 🎯 ОПТИМАЛЬНОЕ ПОПАРНОЕ РАСПРЕДЕЛЕНИЕ (для команд из 2 игроков)
     */
    static generateOptimalPairs(participants, ratingType, averageRating) {
        console.log(`💫 [generateOptimalPairs] Создаем оптимальные пары из ${participants.length} участников`);
        
        const teams = [];
        const used = new Set();
        const targetPairRating = averageRating * 2;
        
        // Список всех возможных пар с их отклонением от целевого рейтинга
        const allPairs = [];
        
        for (let i = 0; i < participants.length; i++) {
            for (let j = i + 1; j < participants.length; j++) {
                const player1 = participants[i];
                const player2 = participants[j];
                const rating1 = this.normalizeParticipantRating(player1, ratingType);
                const rating2 = this.normalizeParticipantRating(player2, ratingType);
                const pairRating = rating1 + rating2;
                const deviation = Math.abs(pairRating - targetPairRating);
                
                allPairs.push({
                    player1,
                    player2,
                    rating1,
                    rating2,
                    pairRating,
                    deviation,
                    averageRating: pairRating / 2
                });
            }
        }
        
        // Сортируем пары по отклонению (лучшие первыми)
        allPairs.sort((a, b) => a.deviation - b.deviation);
        
        // Жадно выбираем лучшие непересекающиеся пары
        for (const pair of allPairs) {
            if (teams.length >= Math.floor(participants.length / 2)) break;
            
            const player1Id = pair.player1.id || pair.player1.participant_id;
            const player2Id = pair.player2.id || pair.player2.participant_id;
            
            if (!used.has(player1Id) && !used.has(player2Id)) {
                // 🆕 ОПРЕДЕЛЯЕМ КАПИТАНА КОМАНДЫ ДЛЯ НАЗВАНИЯ
                const captainInfo = this.determineCaptain([pair.player1, pair.player2], ratingType);
                const teamName = captainInfo?.captain?.name ? `${captainInfo.captain.name} team` : `Команда ${teams.length + 1}`;
                
                teams.push({
                    name: teamName,
                    members: [pair.player1, pair.player2],
                    totalRating: pair.pairRating,
                    averageRating: pair.averageRating
                });
                
                used.add(player1Id);
                used.add(player2Id);
                
                console.log(`✅ Команда "${teamName}": ${pair.player1.name} (${pair.rating1}) + ${pair.player2.name} (${pair.rating2}) = ${Math.round(pair.averageRating)} средний`);
            }
        }
        
        return teams;
    }

    /**
     * 🎯 ОПТИМАЛЬНОЕ РАСПРЕДЕЛЕНИЕ ДЛЯ БОЛЬШИХ КОМАНД (5+ игроков)
     */
    static generateOptimalLargeTeams(participants, teamSize, ratingType, averageRating) {
        console.log(`🏆 [generateOptimalLargeTeams] Создаем команды из ${teamSize} игроков`);
        
        const fullTeams = Math.floor(participants.length / teamSize);
        const teams = [];
        
        // Создаем пустые команды
        for (let i = 0; i < fullTeams; i++) {
            teams.push({
                name: `Команда ${i + 1}`,
                members: [],
                totalRating: 0,
                averageRating: 0
            });
        }
        
        // 🎯 НОВЫЙ АЛГОРИТМ: "УМНАЯ ЗМЕЙКА"
        // Принцип: распределяем игроков так, чтобы в каждой команде были и сильные, и слабые
        
        let participantIndex = 0;
        
        // Раунд 1: Самые сильные игроки распределяются равномерно
        for (let teamIndex = 0; teamIndex < fullTeams && participantIndex < participants.length; teamIndex++) {
            const participant = participants[participantIndex];
            const rating = this.normalizeParticipantRating(participant, ratingType);
            
            teams[teamIndex].members.push(participant);
            teams[teamIndex].totalRating += rating;
            
            console.log(`🏅 Сильный игрок: ${participant.name} (${rating}) → Команда ${teamIndex + 1}`);
            participantIndex++;
        }
        
        // Раунды 2-N: Распределяем оставшихся игроков в обратном порядке для баланса
        for (let round = 1; round < teamSize; round++) {
            const isEvenRound = round % 2 === 0;
            
            for (let i = 0; i < fullTeams && participantIndex < participants.length; i++) {
                // В четных раундах идем прямо, в нечетных - обратно
                const teamIndex = isEvenRound ? i : (fullTeams - 1 - i);
                const participant = participants[participantIndex];
                const rating = this.normalizeParticipantRating(participant, ratingType);
                
                teams[teamIndex].members.push(participant);
                teams[teamIndex].totalRating += rating;
                
                console.log(`👤 Раунд ${round + 1}: ${participant.name} (${rating}) → Команда ${teamIndex + 1}`);
                participantIndex++;
            }
        }
        
        // Обновляем средние рейтинги команд и названия на основе капитанов
        teams.forEach((team, index) => {
            team.averageRating = team.totalRating / team.members.length;
            
            // 🆕 ОПРЕДЕЛЯЕМ КАПИТАНА И ОБНОВЛЯЕМ НАЗВАНИЕ КОМАНДЫ
            const captainInfo = this.determineCaptain(team.members, ratingType);
            const teamName = captainInfo?.captain?.name ? `${captainInfo.captain.name} team` : `Команда ${index + 1}`;
            team.name = teamName;
            
            console.log(`🏆 Команда "${teamName}": ${team.members.length} участников, средний рейтинг ${Math.round(team.averageRating)}`);
        });
        
        return teams;
    }

    /**
     * 🎯 ОПТИМИЗАЦИЯ БАЛАНСА КОМАНД (целевое отклонение +-20%)
     */
    static optimizeTeamBalance(teams, ratingType, globalAverageRating, maxIterations = 50) {
        console.log(`⚖️ [optimizeTeamBalance] Оптимизируем баланс ${teams.length} команд (цель: ±20%)`);
        
        let iteration = 0;
        let improved = true;
        
        while (improved && iteration < maxIterations) {
            improved = false;
            iteration++;
            
            // Рассчитываем текущий баланс
            const teamAverages = teams.map(team => 
                team.members.reduce((sum, member) => 
                    sum + this.normalizeParticipantRating(member, ratingType), 0
                ) / team.members.length
            );
            
            const minAvg = Math.min(...teamAverages);
            const maxAvg = Math.max(...teamAverages);
            const currentBalance = ((maxAvg - minAvg) / globalAverageRating) * 100;
            
            console.log(`🔄 Итерация ${iteration}: баланс ${Math.round(currentBalance)}%`);
            
            // Если баланс уже хороший (<=20%), завершаем
            if (currentBalance <= 20) {
                console.log(`✅ Достигнут хороший баланс: ${Math.round(currentBalance)}%`);
                break;
            }
            
            // Находим самую сильную и самую слабую команды
            const strongestTeamIndex = teamAverages.indexOf(maxAvg);
            const weakestTeamIndex = teamAverages.indexOf(minAvg);
            
            // Пытаемся найти выгодный обмен
            const strongestTeam = teams[strongestTeamIndex];
            const weakestTeam = teams[weakestTeamIndex];
            
            // Ищем самого слабого в сильной команде и самого сильного в слабой команде
            const strongTeamWeakest = strongestTeam.members.reduce((weakest, member) => {
                const memberRating = this.normalizeParticipantRating(member, ratingType);
                const weakestRating = this.normalizeParticipantRating(weakest, ratingType);
                return memberRating < weakestRating ? member : weakest;
            });
            
            const weakTeamStrongest = weakestTeam.members.reduce((strongest, member) => {
                const memberRating = this.normalizeParticipantRating(member, ratingType);
                const strongestRating = this.normalizeParticipantRating(strongest, ratingType);
                return memberRating > strongestRating ? member : strongest;
            });
            
            const strongTeamWeakestRating = this.normalizeParticipantRating(strongTeamWeakest, ratingType);
            const weakTeamStrongestRating = this.normalizeParticipantRating(weakTeamStrongest, ratingType);
            
            // Проверяем, улучшит ли обмен баланс
            if (strongTeamWeakestRating < weakTeamStrongestRating) {
                const ratingDiff = weakTeamStrongestRating - strongTeamWeakestRating;
                
                // Рассчитываем новые средние после обмена
                const newStrongAvg = (teamAverages[strongestTeamIndex] * strongestTeam.members.length - strongTeamWeakestRating + weakTeamStrongestRating) / strongestTeam.members.length;
                const newWeakAvg = (teamAverages[weakestTeamIndex] * weakestTeam.members.length - weakTeamStrongestRating + strongTeamWeakestRating) / weakestTeam.members.length;
                
                const newMaxAvg = Math.max(newStrongAvg, newWeakAvg, ...teamAverages.filter((_, i) => i !== strongestTeamIndex && i !== weakestTeamIndex));
                const newMinAvg = Math.min(newStrongAvg, newWeakAvg, ...teamAverages.filter((_, i) => i !== strongestTeamIndex && i !== weakestTeamIndex));
                const newBalance = ((newMaxAvg - newMinAvg) / globalAverageRating) * 100;
                
                // Если обмен улучшает баланс
                if (newBalance < currentBalance) {
                    console.log(`🔄 Обмен: ${strongTeamWeakest.name} (${strongTeamWeakestRating}) ↔ ${weakTeamStrongest.name} (${weakTeamStrongestRating})`);
                    
                    // Выполняем обмен
                    const strongIndex = strongestTeam.members.findIndex(m => (m.id || m.participant_id) === (strongTeamWeakest.id || strongTeamWeakest.participant_id));
                    const weakIndex = weakestTeam.members.findIndex(m => (m.id || m.participant_id) === (weakTeamStrongest.id || weakTeamStrongest.participant_id));
                    
                    strongestTeam.members[strongIndex] = weakTeamStrongest;
                    weakestTeam.members[weakIndex] = strongTeamWeakest;
                    
                    improved = true;
                }
            }
        }
        
        // Финальный расчет баланса
        const finalTeamAverages = teams.map(team => 
            team.members.reduce((sum, member) => 
                sum + this.normalizeParticipantRating(member, ratingType), 0
            ) / team.members.length
        );
        
        const finalMinAvg = Math.min(...finalTeamAverages);
        const finalMaxAvg = Math.max(...finalTeamAverages);
        const finalBalance = ((finalMaxAvg - finalMinAvg) / globalAverageRating) * 100;
        
        console.log(`✅ [optimizeTeamBalance] Финальный баланс: ${Math.round(finalBalance)}% за ${iteration} итераций`);
        
        return {
            finalBalance,
            iterations: iteration,
            teamAverages: finalTeamAverages,
            isBalanced: finalBalance <= 20
        };
    }

    /**
     * 🎯 ОСНОВНОЙ МЕТОД ГЕНЕРАЦИИ КОМАНД (обновлен для назначения капитанов)
     */
    static async generateTeams(tournamentId, ratingTypeFromRequest = null) {
        const startTime = Date.now();
        console.log(`🚀 [generateTeams] Начинаем формирование команд для турнира ${tournamentId}`);

        try {
            // 🔍 1. Получаем информацию о турнире
            const tournament = await TournamentRepository.getById(tournamentId);
            if (!tournament) {
                throw new Error(`Турнир ${tournamentId} не найден`);
            }

            // 🆕 ИСПОЛЬЗУЕМ ТИП РЕЙТИНГА ИЗ НАСТРОЕК ТУРНИРА
            const ratingType = tournament.mix_rating_type || 'faceit';
            console.log(`📊 Турнир: "${tournament.name}", размер команды: ${tournament.team_size}, тип рейтинга: ${ratingType}`);

            // 🔍 2. Получаем всех участников турнира
            const participants = await ParticipantRepository.getAllByTournamentId(tournamentId);
            if (!participants || participants.length === 0) {
                throw new Error('Нет участников для формирования команд');
            }

            console.log(`👥 Найдено ${participants.length} участников для формирования команд`);

            // 🔍 3. Проверяем достаточность участников ДЛЯ ФОРМИРОВАНИЯ КОМАНД И СЕТКИ
            const teamSize = parseInt(tournament.team_size, 10) || 5;
            const fullTeams = Math.floor(participants.length / teamSize);
            const playersInTeams = fullTeams * teamSize;

            // ⚠️ КРИТИЧЕСКАЯ ПРОВЕРКА #1: Достаточно ли участников для формирования команд
            if (fullTeams === 0) {
                throw new Error(`Недостаточно участников для формирования команд. Нужно минимум ${teamSize}, а есть ${participants.length}`);
            }

            // 🆕 КРИТИЧЕСКАЯ ПРОВЕРКА #2: Достаточно ли команд для турнирной сетки
            if (fullTeams < 2) {
                const participantsNeeded = teamSize * 2; // Минимум 2 команды для сетки
                const currentParticipants = participants.length;
                const missingParticipants = participantsNeeded - currentParticipants;
                
                throw new Error(
                    `Недостаточно команд для турнирной сетки. ` +
                    `Для турнира с командами ${teamSize}v${teamSize} нужно минимум ${participantsNeeded} участников (2 команды). ` +
                    `Сейчас ${currentParticipants} участников (${fullTeams} команда). ` +
                    `Добавьте еще ${missingParticipants} участников.`
                );
            }

            console.log(`📊 Статистика: ${participants.length} участников → ${fullTeams} команд по ${teamSize} игроков (${playersInTeams} в командах, ${participants.length - playersInTeams} останется)`);

            // 🆕 ПРЕДУПРЕЖДЕНИЕ О НЕИСПОЛЬЗОВАННЫХ УЧАСТНИКАХ
            const unusedParticipants = participants.length - playersInTeams;
            if (unusedParticipants > 0) {
                console.warn(`⚠️ [generateTeams] ${unusedParticipants} участников не попадут в турнир из-за неполной команды`);
            }

            // 🔍 4. Очищаем существующие команды
            console.log(`🗑️ Удаляем существующие команды турнира ${tournamentId}...`);
            await TeamRepository.deleteAllByTournamentId(tournamentId);

            // 🔍 5. Генерируем новые команды с улучшенным алгоритмом
            console.log(`🎯 Запускаем новый математический алгоритм формирования команд...`);
            const teams = this.generateOptimalTeams(participants, teamSize, ratingType);

            console.log(`✅ Сгенерировано ${teams.length} оптимально сбалансированных команд`);

            // 🔍 6. Сохраняем команды в базе данных С НАЗНАЧЕНИЕМ КАПИТАНОВ
            console.log(`💾 Сохраняем команды в базе данных с назначением капитанов...`);
            const createdTeams = [];

            for (let i = 0; i < teams.length; i++) {
                const team = teams[i];
                
                // 🆕 ОПРЕДЕЛЯЕМ КАПИТАНА КОМАНДЫ С УЛУЧШЕННОЙ ЛОГИКОЙ
                const captainInfo = this.determineCaptain(team.members, ratingType);
                const { captain, captainRating, usedManualRating } = captainInfo;
                
                // Создаем команду
                const createdTeam = await TeamRepository.create({
                    tournament_id: tournamentId,
                    name: team.name,
                    creator_id: tournament.created_by
                });

                // 🆕 ДОБАВЛЯЕМ УЧАСТНИКОВ В КОМАНДУ С НАЗНАЧЕНИЕМ КАПИТАНА
                const teamMembers = [];
                for (const member of team.members) {
                    const isCaptain = captain && (
                        (member.id && member.id === captain.id) || 
                        (member.participant_id && member.participant_id === captain.participant_id) ||
                        (member.user_id && member.user_id === captain.user_id)
                    );
                    
                    const memberCaptainRating = isCaptain ? captainRating : null;
                    
                    await TeamRepository.addMember(
                        createdTeam.id, 
                        member.user_id, 
                        member.id || member.participant_id,
                        isCaptain,  // 🆕 Флаг капитана
                        memberCaptainRating  // 🆕 Рейтинг капитана
                    );

                    teamMembers.push({
                        ...member,
                        team_id: createdTeam.id,
                        is_captain: isCaptain,
                        captain_rating: memberCaptainRating
                    });
                    
                    if (isCaptain) {
                        console.log(`👑 Назначен капитан: ${member.name} (рейтинг: ${captainRating}, ручной: ${usedManualRating}) для команды "${team.name}"`);
                    }
                }

                // Обновляем флаг in_team для участников
                const participantIds = team.members.map(m => m.id || m.participant_id).filter(Boolean);
                if (participantIds.length > 0) {
                    await ParticipantRepository.updateInTeamStatus(participantIds, true);
                }

                createdTeams.push({
                    ...createdTeam,
                    members: teamMembers,
                    averageRating: team.averageRating || this.calculateTeamAverageRating(team.members, ratingType),
                    averageRatingFaceit: this.calculateTeamAverageRating(team.members, 'faceit'),
                    averageRatingPremier: this.calculateTeamAverageRating(team.members, 'premier'),
                    ratingType: ratingType,
                    // 🆕 РАСШИРЕННАЯ ИНФОРМАЦИЯ О КАПИТАНЕ
                    captain_user_id: captain?.user_id,
                    captain_participant_id: captain?.id || captain?.participant_id,
                    captain_name: captain?.name,
                    captain_rating: captainRating,
                    captain_manual_rating_used: usedManualRating // 🆕 Флаг использования ручного рейтинга
                });

                console.log(`✅ Команда "${team.name}" создана с ${team.members.length} участниками и капитаном ${captain?.name || 'N/A'} (ручной рейтинг: ${usedManualRating})`);
            }

            // 🔍 7. Обновляем тип участников турнира на 'team'
            console.log(`🔄 Обновляем тип участников турнира на 'team'...`);
            await TournamentRepository.updateParticipantType(tournamentId, 'team');

            // 🔍 8. Финальная статистика
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Рассчитываем финальный баланс команд
            const teamAverages = createdTeams.map(team => team.averageRating);
            const minAvg = Math.min(...teamAverages);
            const maxAvg = Math.max(...teamAverages);
            const overallAvg = teamAverages.reduce((sum, avg) => sum + avg, 0) / teamAverages.length;
            const balance = ((maxAvg - minAvg) / overallAvg) * 100;

            // 🆕 РАСШИРЕННАЯ СТАТИСТИКА ПО КАПИТАНАМ
            const captainStats = {
                total_captains: createdTeams.filter(team => team.captain_rating).length,
                captains_with_manual_ratings: createdTeams.filter(team => team.captain_manual_rating_used).length,
                average_captain_rating: Math.round(
                    createdTeams
                        .filter(team => team.captain_rating)
                        .reduce((sum, team) => sum + team.captain_rating, 0) / 
                    createdTeams.filter(team => team.captain_rating).length || 0
                ),
                highest_captain_rating: Math.max(...createdTeams.map(team => team.captain_rating || 0)),
                lowest_captain_rating: Math.min(...createdTeams.filter(team => team.captain_rating).map(team => team.captain_rating)),
                manual_rating_usage_percentage: createdTeams.length > 0 ? 
                    Math.round((createdTeams.filter(team => team.captain_manual_rating_used).length / createdTeams.length) * 100) : 0
            };

            console.log(`🎉 [generateTeams] УСПЕШНО ЗАВЕРШЕНО за ${duration}ms:`);
            console.log(`   📊 Создано команд: ${createdTeams.length}`);
            console.log(`   👥 Участников в командах: ${playersInTeams}`);
            console.log(`   👑 Назначено капитанов: ${captainStats.total_captains}`);
            console.log(`   🎯 Капитанов с ручными рейтингами: ${captainStats.captains_with_manual_ratings} (${captainStats.manual_rating_usage_percentage}%)`);
            console.log(`   ⚖️ Баланс команд: ${Math.round(balance)}%`);
            console.log(`   🎯 Средний рейтинг: min=${Math.round(minAvg)}, max=${Math.round(maxAvg)}, общий=${Math.round(overallAvg)}`);
            console.log(`   👑 Средний рейтинг капитанов: ${captainStats.average_captain_rating}`);

            return {
                success: true,
                teams: createdTeams,
                summary: {
                    totalParticipants: participants.length,
                    teamsCreated: createdTeams.length,
                    participantsInTeams: playersInTeams,
                    participantsNotInTeams: participants.length - playersInTeams,
                    teamSize: teamSize,
                    ratingType: ratingType,
                    algorithm: teamSize === 2 ? 'optimal_pairs' : 'smart_snake',
                    balance: {
                        percentage: Math.round(balance * 100) / 100,
                        isGood: balance <= 20,
                        minTeamRating: Math.round(minAvg),
                        maxTeamRating: Math.round(maxAvg),
                        averageRating: Math.round(overallAvg)
                    },
                    captains: captainStats,  // 🆕 Расширенная статистика капитанов
                    duration: duration
                }
            };

        } catch (error) {
            const endTime = Date.now();
            console.error(`❌ [generateTeams] Ошибка формирования команд за ${endTime - startTime}ms:`, error.message);
            throw error;
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

    /**
     * Очистка всех команд турнира
     * @param {number} tournamentId - ID турнира
     * @param {number} userId - ID пользователя
     */
    static async clearTeams(tournamentId, userId) {
        console.log(`🗑️ MixTeamService: Очистка команд для турнира ${tournamentId}`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Получаем количество команд для логирования
            const teamsCountResult = await client.query(
                'SELECT COUNT(*) as count FROM tournament_teams WHERE tournament_id = $1',
                [tournamentId]
            );
            const teamsCount = parseInt(teamsCountResult.rows[0].count);
            
            if (teamsCount === 0) {
                await client.query('COMMIT');
                console.log(`ℹ️ [clearTeams] Турнир ${tournamentId} не имеет команд для удаления`);
                return {
                    success: true,
                    message: 'Команды уже отсутствуют',
                    deletedTeams: 0
                };
            }
            
            // Удаляем все команды турнира (каскадное удаление удалит и участников команд)
            await client.query(
                'DELETE FROM tournament_teams WHERE tournament_id = $1',
                [tournamentId]
            );
            
            // Сбрасываем флаги участников
            await client.query(
                'UPDATE tournament_participants SET in_team = FALSE WHERE tournament_id = $1',
                [tournamentId]
            );
            
            // Возвращаем тип турнира на индивидуальный
            await client.query(
                'UPDATE tournaments SET participant_type = $1 WHERE id = $2',
                ['individual', tournamentId]
            );
            
            await client.query('COMMIT');
            
            // Логируем событие
            await logTournamentEvent(tournamentId, userId, 'teams_cleared', {
                deletedTeams: teamsCount
            });
            
            // Отправляем объявление в чат
            await sendTournamentChatAnnouncement(
                tournamentId,
                `🗑️ Все команды турнира удалены. Участники возвращены к индивидуальному формату.`
            );
            
            console.log(`✅ [clearTeams] Удалено ${teamsCount} команд из турнира ${tournamentId}`);
            
            return {
                success: true,
                message: `Удалено команд: ${teamsCount}`,
                deletedTeams: teamsCount
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [clearTeams] Ошибка очистки команд турнира ${tournamentId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = MixTeamService; 