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

    // Определяем количество раундов (включая финал)
    // Math.ceil(log2(n)) дает минимальное количество раундов для n участников
    const numberOfRounds = Math.ceil(Math.log2(participantCount));
    console.log(`Количество раундов: ${numberOfRounds}`);

    // Ближайшая степень двойки ≥ participantCount (количество мест в первом полном раунде)
    // Это нужно для определения количества матчей в первом полном раунде
    const fullRoundSpots = Math.pow(2, numberOfRounds);
    
    // Количество участников, которые получат автоматический проход ("bye")
    const byeCount = fullRoundSpots - participantCount;
    console.log(`Количество "bye" проходов: ${byeCount}`);

    // Количество матчей в предварительном раунде
    // participantCount - byeCount = количество участников, которые должны играть в предварительном раунде
    // Делим на 2, так как в каждом матче по 2 участника
    const preliminaryMatches = (participantCount - byeCount) / 2;
    console.log(`Количество матчей в предварительном раунде: ${preliminaryMatches}`);

    // Количество участников, которые получают автоматический проход в первый полный раунд
    const byeParticipants = shuffledParticipants.slice(0, byeCount);
    
    // Участники, которые играют в предварительном раунде
    const prelimParticipants = shuffledParticipants.slice(byeCount);

    // Матчи и победители по раундам
    // roundMatches[round] = массив матчей раунда round
    const roundMatches = {};

    // Создаем структуру раундов
    for (let round = 0; round < numberOfRounds; round++) {
        roundMatches[round] = [];
    }

    // Если есть предварительный раунд, добавляем его
    if (preliminaryMatches > 0) {
        roundMatches[-1] = [];
    }

    // Создаем предварительный раунд (если нужен)
    if (preliminaryMatches > 0) {
        for (let i = 0; i < preliminaryMatches; i++) {
            const team1 = prelimParticipants[i * 2];
            const team2 = prelimParticipants[i * 2 + 1];

            const match = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [tournamentId, -1, team1.id, team2.id, matchNumber++, 'winner']
            );
            
            roundMatches[-1].push(match.rows[0]);
            matches.push(match.rows[0]);
        }
    }

    // Создаем первый полный раунд (Round 0)
    // Количество матчей в этом раунде = fullRoundSpots / 2
    const round0MatchesCount = fullRoundSpots / 2;
    
    // Распределяем участников с автоматическим проходом
    for (let i = 0; i < round0MatchesCount; i++) {
        // Если есть участник с "bye", он становится первым участником матча
        const team1 = i < byeCount ? byeParticipants[i] : null;
        
        const match = await pool.query(
            'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [tournamentId, 0, team1?.id || null, null, matchNumber++, 'winner']
        );
        
        roundMatches[0].push(match.rows[0]);
        matches.push(match.rows[0]);
    }

    // Создаем остальные раунды (от Round 1 до финала)
    for (let round = 1; round < numberOfRounds; round++) {
        const roundMatchCount = Math.pow(2, numberOfRounds - round - 1);
        
        for (let i = 0; i < roundMatchCount; i++) {
            const match = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [tournamentId, round, null, null, matchNumber++, 'winner']
            );
            
            roundMatches[round].push(match.rows[0]);
            matches.push(match.rows[0]);
        }
    }

    // Если нужен матч за 3-е место, создаем его
    let thirdPlaceMatchObj = null;
    if (thirdPlaceMatch) {
        const tpMatch = await pool.query(
            'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, is_third_place_match, bracket_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [tournamentId, numberOfRounds - 1, null, null, matchNumber++, true, 'placement']
        );
        
        thirdPlaceMatchObj = tpMatch.rows[0];
        matches.push(thirdPlaceMatchObj);
    }

    // Связываем матчи предварительного раунда с первым полным раундом
    if (preliminaryMatches > 0) {
        for (let i = 0; i < roundMatches[-1].length; i++) {
            const prelimMatch = roundMatches[-1][i];
            // Каждый победитель предварительного матча идет в соответствующий матч первого полного раунда
            const targetMatch = roundMatches[0][i];
            
            await pool.query(
                'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                [targetMatch.id, prelimMatch.id]
            );
            console.log(`Связываем предварительный матч ${prelimMatch.match_number} -> матч ${targetMatch.match_number} раунда 0`);
        }
    }

    // Связываем все остальные матчи с матчами следующего раунда
    for (let round = 0; round < numberOfRounds - 1; round++) {
        const currentRoundMatches = roundMatches[round];
        const nextRoundMatches = roundMatches[round + 1];
        
        for (let i = 0; i < currentRoundMatches.length; i++) {
            const currentMatch = currentRoundMatches[i];
            // Каждая пара матчей (i*2, i*2+1) ведет в один матч следующего раунда (i)
            const nextMatchIndex = Math.floor(i / 2);
            const nextMatch = nextRoundMatches[nextMatchIndex];
            
            await pool.query(
                'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                [nextMatch.id, currentMatch.id]
            );
            console.log(`Связываем матч ${currentMatch.match_number} раунда ${round} -> матч ${nextMatch.match_number} раунда ${round + 1}`);
            
            // Если это полуфинал (предпоследний раунд) и нужен матч за 3-е место,
            // связываем проигравших с матчем за 3-е место
            if (round === numberOfRounds - 2 && thirdPlaceMatch) {
                // Проигравший из полуфинала идет в матч за 3-е место
                const isFirstSemifinal = i === 0;
                
                await pool.query(
                    'UPDATE matches SET loser_next_match_id = $1 WHERE id = $2',
                    [thirdPlaceMatchObj.id, currentMatch.id]
                );
                console.log(`Связываем проигравшего из полуфинала ${currentMatch.match_number} -> матч за 3-е место ${thirdPlaceMatchObj.match_number}`);
            }
        }
    }

    return matches;
};

module.exports = { generateSingleEliminationBracket };