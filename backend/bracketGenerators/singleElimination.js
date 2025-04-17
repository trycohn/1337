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
    // Для 6 участников это будет 4 (2^2)
    const pow = Math.floor(Math.log2(participantCount));
    const closestPowerOfTwo = Math.pow(2, pow);
    
    // Количество раундов равно logBase2(closestPowerOfTwo)
    // Для 6 участников (степень двойки 4): log2(4) = 2 раунда
    const totalRounds = Math.log2(closestPowerOfTwo);
    
    console.log(`Ближайшая степень двойки: ${closestPowerOfTwo}, всего раундов: ${totalRounds}`);

    // Распределяем участников на тех, кто играет в предварительном раунде, и тех, кто получает "бай"
    // Количество матчей в предварительном раунде
    const prelimMatchesNeeded = participantCount - closestPowerOfTwo;
    
    // Количество участников в предварительном раунде (2 на каждый матч)
    const preliminaryParticipantsCount = prelimMatchesNeeded * 2;
    
    // Участники для предварительного раунда
    const prelimParticipants = shuffledParticipants.slice(0, preliminaryParticipantsCount);
    
    // Участники, получающие автоматический проход в первый раунд
    const byeParticipants = shuffledParticipants.slice(preliminaryParticipantsCount);
    
    console.log(`Участников в предварительном раунде: ${prelimParticipants.length}`);
    console.log(`Участников с "bye": ${byeParticipants.length}`);

    // Создаем структуру для хранения матчей по раундам
    const roundMatches = {};
    
    for (let round = 0; round < totalRounds; round++) {
        roundMatches[round] = [];
    }
    
    // Если есть предварительный раунд, добавляем его
    if (preliminaryParticipantsCount > 0) {
        roundMatches[-1] = [];
    }
    
    // Создаем матчи предварительного раунда
    if (preliminaryParticipantsCount > 0) {
        for (let i = 0; i < prelimMatchesNeeded; i++) {
            const team1Index = i * 2;
            const team2Index = i * 2 + 1;
            
            const team1 = prelimParticipants[team1Index];
            const team2 = prelimParticipants[team2Index];
            
            const match = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [tournamentId, -1, team1.id, team2.id, matchNumber++, 'winner']
            );
            
            roundMatches[-1].push(match.rows[0]);
            matches.push(match.rows[0]);
            
            console.log(`Создан матч предварительного раунда #${match.rows[0].id}: ${team1.name} vs ${team2.name}`);
        }
    }
    
    // Создаем матчи первого раунда (раунд 0)
    // Количество матчей в первом раунде = closestPowerOfTwo / 2
    const firstRoundMatchCount = closestPowerOfTwo / 2;
    
    for (let i = 0; i < firstRoundMatchCount; i++) {
        let team1 = null;
        let team2 = null;
        
        if (i < prelimMatchesNeeded) {
            // Этот матч будет заполнен победителем предварительного матча
            team1 = null;
        } else {
            // Заполняем матч участниками с автоматическим проходом
            const byeIndex = i - prelimMatchesNeeded;
            if (byeIndex * 2 < byeParticipants.length) {
                team1 = byeParticipants[byeIndex * 2];
            }
            
            if (byeIndex * 2 + 1 < byeParticipants.length) {
                team2 = byeParticipants[byeIndex * 2 + 1];
            }
        }
        
        const match = await pool.query(
            'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [tournamentId, 0, team1 ? team1.id : null, team2 ? team2.id : null, matchNumber++, 'winner']
        );
        
        roundMatches[0].push(match.rows[0]);
        matches.push(match.rows[0]);
        
        console.log(`Создан матч раунда 0 #${match.rows[0].id}: ${team1 ? team1.name : 'TBD'} vs ${team2 ? team2.name : 'TBD'}`);
    }
    
    // Создаем матчи для последующих раундов (1 и далее)
    for (let round = 1; round < totalRounds; round++) {
        const matchCount = Math.pow(2, totalRounds - round - 1);
        
        for (let i = 0; i < matchCount; i++) {
            const match = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [tournamentId, round, null, null, matchNumber++, 'winner']
            );
            
            roundMatches[round].push(match.rows[0]);
            matches.push(match.rows[0]);
            
            console.log(`Создан матч раунда ${round} #${match.rows[0].id}`);
        }
    }
    
    // Создаем матч за 3-е место, если нужен
    let thirdPlaceMatchObj = null;
    if (thirdPlaceMatch && totalRounds >= 2) {
        // Матч за 3-е место будет в том же раунде, что и финал (последний раунд)
        const finalRound = totalRounds - 1;
        
        const match = await pool.query(
            'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, is_third_place_match, bracket_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [tournamentId, finalRound, null, null, matchNumber++, true, 'placement']
        );
        
        thirdPlaceMatchObj = match.rows[0];
        matches.push(thirdPlaceMatchObj);
        
        console.log(`Создан матч за 3-е место #${thirdPlaceMatchObj.id}`);
    }
    
    // Связываем матчи
    
    // 1. Связываем предварительный раунд с первым раундом
    if (preliminaryParticipantsCount > 0) {
        for (let i = 0; i < prelimMatchesNeeded; i++) {
            const prelimMatch = roundMatches[-1][i];
            const targetMatch = roundMatches[0][i];
            
            await pool.query(
                'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                [targetMatch.id, prelimMatch.id]
            );
            
            console.log(`Связан матч предварительного раунда #${prelimMatch.id} -> матч первого раунда #${targetMatch.id}`);
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
                
                console.log(`Связан матч #${currentMatch.id} (раунд ${round}) -> матч #${nextMatch.id} (раунд ${round+1})`);
            }
        }
    }
    
    // 3. Связываем проигравших полуфиналов с матчем за 3-е место
    if (thirdPlaceMatch && totalRounds >= 2) {
        const semifinalRound = totalRounds - 2; // предпоследний раунд
        const semifinalMatches = roundMatches[semifinalRound];
        
        for (let i = 0; i < semifinalMatches.length; i++) {
            const semifinalMatch = semifinalMatches[i];
            
            await pool.query(
                'UPDATE matches SET loser_next_match_id = $1 WHERE id = $2',
                [thirdPlaceMatchObj.id, semifinalMatch.id]
            );
            
            console.log(`Связан проигравший полуфинала #${semifinalMatch.id} -> матч за 3-е место #${thirdPlaceMatchObj.id}`);
        }
    }
    
    return matches;
};

module.exports = { generateSingleEliminationBracket };