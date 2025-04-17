// backend/bracketGenerators/singleElimination.js
const pool = require('../db');

/**
 * Генерация турнирной сетки для формата Single Elimination
 * @param {number} tournamentId - ID турнира
 * @param {Array} participants - Массив участников [{ id, name }]
 * @param {boolean} thirdPlaceMatch - Нужен ли матч за 3-е место
 * @returns {Array} - Список сгенерированных матчей
 */
const generateSingleEliminationBracket = async (tournamentId, participants, thirdPlaceMatch) => {
    const matches = [];
    let matchNumber = 1;

    // Рандомизируем участников
    const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
    const participantCount = shuffledParticipants.length;
    
    console.log(`Генерация сетки для ${participantCount} участников`);

    // Определяем ближайшую степень двойки с округлением ВНИЗ
    // Например: для 6 участников это будет 4 (2^2)
    const powerOfTwo = Math.pow(2, Math.floor(Math.log2(participantCount)));
    console.log(`Ближайшая степень двойки (округление вниз): ${powerOfTwo}`);

    // Количество матчей в предварительном раунде
    // Нужно "отсеять" лишних участников, чтобы осталось powerOfTwo участников
    const preliminaryMatchesCount = Math.ceil((participantCount - powerOfTwo) / 2);
    console.log(`Количество матчей в предварительном раунде: ${preliminaryMatchesCount}`);

    // Количество участников, которые должны играть в предварительном раунде
    const preliminaryParticipantsCount = preliminaryMatchesCount * 2;
    
    // Разделяем участников: кто играет в предварительном раунде, а кто проходит автоматически
    const prelimParticipants = shuffledParticipants.slice(0, preliminaryParticipantsCount);
    const byeParticipants = shuffledParticipants.slice(preliminaryParticipantsCount);
    
    console.log(`Участников в предварительном раунде: ${prelimParticipants.length}`);
    console.log(`Участников с автоматическим проходом: ${byeParticipants.length}`);

    // Создаем объект для хранения матчей по раундам
    const roundMatches = {};
    
    // Всего раундов в сетке (включая финал)
    const totalRounds = Math.log2(powerOfTwo) + 1; // +1 для финала
    console.log(`Всего раундов в основной сетке: ${totalRounds}`);
    
    // Инициализируем структуру раундов
    for (let round = 0; round < totalRounds; round++) {
        roundMatches[round] = [];
    }
    
    // Если есть предварительный раунд, добавляем его
    if (preliminaryMatchesCount > 0) {
        roundMatches[-1] = [];
    }

    // Создаем матчи предварительного раунда
    if (preliminaryMatchesCount > 0) {
        for (let i = 0; i < preliminaryMatchesCount; i++) {
            const team1Index = i * 2;
            const team2Index = i * 2 + 1;
            
            const team1 = prelimParticipants[team1Index];
            // Проверяем, что второй участник существует (на случай нечетного числа)
            const team2 = team2Index < prelimParticipants.length ? prelimParticipants[team2Index] : null;

            const match = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [tournamentId, -1, team1.id, team2 ? team2.id : null, matchNumber++, 'winner']
            );
            
            const newMatch = match.rows[0];
            roundMatches[-1].push(newMatch);
            matches.push(newMatch);
            
            console.log(`Создан матч предварительного раунда #${newMatch.match_number}: ${team1.name} vs ${team2 ? team2.name : 'Bye'}`);
        }
    }

    // Создаем матчи первого полного раунда (раунд 0)
    // Количество матчей в первом раунде = powerOfTwo / 2
    const round0MatchCount = powerOfTwo / 2;
    
    for (let i = 0; i < round0MatchCount; i++) {
        // Определяем начальных участников для первого раунда
        let team1 = null;
        let team2 = null;
        
        // Если у нас есть предварительный раунд, первые матчи будут заполняться его победителями
        // и участниками с автоматическим проходом
        if (i < preliminaryMatchesCount) {
            // Этот матч будет заполнен победителем предварительного матча
            team1 = null;
        } else {
            // Участник с автоматическим проходом
            const byeIndex = i - preliminaryMatchesCount;
            if (byeIndex < byeParticipants.length) {
                team1 = byeParticipants[byeIndex];
            }
        }
        
        // Для следующего автоматического участника
        const nextByeIndex = i - preliminaryMatchesCount + round0MatchCount / 2;
        if (nextByeIndex < byeParticipants.length) {
            team2 = byeParticipants[nextByeIndex];
        }

        const match = await pool.query(
            'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [tournamentId, 0, team1 ? team1.id : null, team2 ? team2.id : null, matchNumber++, 'winner']
        );
        
        const newMatch = match.rows[0];
        roundMatches[0].push(newMatch);
        matches.push(newMatch);
        
        console.log(`Создан матч раунда 0 #${newMatch.match_number}: ${team1 ? team1.name : 'TBD'} vs ${team2 ? team2.name : 'TBD'}`);
    }

    // Создаем матчи для остальных раундов
    for (let round = 1; round < totalRounds; round++) {
        // Количество матчей в текущем раунде = количество матчей в предыдущем раунде / 2
        const matchCount = Math.max(1, roundMatches[round - 1].length / 2);
        
        for (let i = 0; i < matchCount; i++) {
            const match = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [tournamentId, round, null, null, matchNumber++, 'winner']
            );
            
            const newMatch = match.rows[0];
            roundMatches[round].push(newMatch);
            matches.push(newMatch);
            
            console.log(`Создан матч раунда ${round} #${newMatch.match_number}`);
        }
    }

    // Создаем матч за 3-е место, если нужно
    let thirdPlaceMatchObj = null;
    if (thirdPlaceMatch && totalRounds >= 2) {
        // Матч за 3-е место будет в последнем раунде (как и финал)
        const lastRound = totalRounds - 1;
        
        const match = await pool.query(
            'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, is_third_place_match, bracket_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [tournamentId, lastRound, null, null, matchNumber++, true, 'placement']
        );
        
        thirdPlaceMatchObj = match.rows[0];
        matches.push(thirdPlaceMatchObj);
        
        console.log(`Создан матч за 3-е место #${thirdPlaceMatchObj.match_number}`);
    }

    // Связываем матчи между раундами
    
    // 1. Связываем предварительный раунд с раундом 0
    if (preliminaryMatchesCount > 0) {
        for (let i = 0; i < preliminaryMatchesCount; i++) {
            const prelimMatch = roundMatches[-1][i];
            const targetMatch = roundMatches[0][i];
            
            await pool.query(
                'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                [targetMatch.id, prelimMatch.id]
            );
            
            console.log(`Связан матч предварительного раунда #${prelimMatch.match_number} с матчем раунда 0 #${targetMatch.match_number}`);
        }
    }
    
    // 2. Связываем остальные раунды
    for (let round = 0; round < totalRounds - 1; round++) {
        const currentRoundMatches = roundMatches[round];
        const nextRoundMatches = roundMatches[round + 1];
        
        for (let i = 0; i < currentRoundMatches.length; i++) {
            const currentMatch = currentRoundMatches[i];
            const nextMatchIndex = Math.floor(i / 2);
            
            if (nextMatchIndex < nextRoundMatches.length) {
                const nextMatch = nextRoundMatches[nextMatchIndex];
                
                await pool.query(
                    'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                    [nextMatch.id, currentMatch.id]
                );
                
                console.log(`Связан матч раунда ${round} #${currentMatch.match_number} с матчем раунда ${round + 1} #${nextMatch.match_number}`);
                
                // Если это полуфинал (предпоследний раунд) и нужен матч за 3-е место
                if (round === totalRounds - 2 && thirdPlaceMatch) {
                    await pool.query(
                        'UPDATE matches SET loser_next_match_id = $1 WHERE id = $2',
                        [thirdPlaceMatchObj.id, currentMatch.id]
                    );
                    
                    console.log(`Связан проигравший матча #${currentMatch.match_number} с матчем за 3-е место #${thirdPlaceMatchObj.match_number}`);
                }
            }
        }
    }

    return matches;
};

module.exports = { generateSingleEliminationBracket };