// backend/bracketGenerators/doubleElimination.js
const pool = require('../db');

/**
 * Генерация турнирной сетки для формата Double Elimination с бай-раундами
 * @param {number} tournamentId - ID турнира
 * @param {Array} participants - Массив участников [{ id, name }]
 * @param {boolean} thirdPlaceMatch - Нужен ли матч за 3-е место
 * @returns {Array} - Список сгенерированных матчей
 */
const generateDoubleEliminationBracket = async (tournamentId, participants, thirdPlaceMatch) => {
    const matches = [];
    let matchNumber = 1;

    // Перемешиваем участников перед распределением для случайного порядка
    const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
    const participantCount = shuffledParticipants.length;

    console.log('Перемешанные участники:', shuffledParticipants.map(p => ({ id: p.id, name: p.name })));

    // Определяем количество раундов в верхней сетке (округление до степени двойки ВВЕРХ)
    // Для 9 участников: nextPowerOfTwo = 16, logRounds = 4
    const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(participantCount)));
    const totalWinnerRounds = Math.log2(nextPowerOfTwo);

    console.log(`Количество участников: ${participantCount}`);
    console.log(`Ближайшая степень двойки (округленная вверх): ${nextPowerOfTwo}`);
    console.log(`Количество раундов верхней сетки: ${totalWinnerRounds}`);

    // Определяем количество матчей в первом раунде верхней сетки
    const firstRoundMatches = nextPowerOfTwo / 2;
    console.log(`Количество матчей в первом раунде: ${firstRoundMatches}`);

    // Определяем, сколько участников получат "bye" в первом раунде
    const byeCount = nextPowerOfTwo - participantCount;
    console.log(`Количество "bye" позиций: ${byeCount}`);

    // Определяем, сколько матчей будут иметь только одного участника (автоматическая победа)
    const matchesWithBye = byeCount;
    console.log(`Количество матчей с "bye": ${matchesWithBye}`);

    // Равномерно распределяем "bye" по матчам
    // Создаем массив индексов матчей
    const matchIndexes = Array.from({ length: firstRoundMatches }, (_, i) => i);

    // Перемешиваем индексы для случайного распределения "bye"
    const shuffledMatchIndexes = [...matchIndexes].sort(() => Math.random() - 0.5);

    // Выбираем первые matchesWithBye индексов для матчей с "bye"
    const byeMatchIndexes = new Set(shuffledMatchIndexes.slice(0, matchesWithBye));

    console.log('Индексы матчей с "bye":', Array.from(byeMatchIndexes));

    // Генерация первого раунда верхней сетки (Winners Bracket)
    let participantIndex = 0;
    for (let i = 0; i < firstRoundMatches; i++) {
        let team1 = null;
        let team2 = null;

        if (byeMatchIndexes.has(i)) {
            // Матч с "bye" - только один участник
            if (participantIndex < participantCount) {
                team1 = shuffledParticipants[participantIndex++];
            }
        } else {
            // Обычный матч - два участника
            if (participantIndex < participantCount) {
                team1 = shuffledParticipants[participantIndex++];
            }
            if (participantIndex < participantCount) {
                team2 = shuffledParticipants[participantIndex++];
            }
        }

        matches.push({
            tournament_id: tournamentId,
            round: 0,
            match_number: matchNumber++,
            bracket_type: 'winner',
            team1_id: team1 ? team1.id : null,
            team2_id: team2 ? team2.id : null,
            match_date: new Date()
        });

        console.log(`Создан матч первого раунда ${i}: ${team1 ? team1.name : 'TBD'} vs ${team2 ? team2.name : 'TBD'}`);
    }

    // Генерация последующих раундов верхней сетки
    for (let round = 1; round < totalWinnerRounds; round++) {
        const roundMatches = Math.pow(2, totalWinnerRounds - round - 1);
        console.log(`Количество матчей в раунде ${round}: ${roundMatches}`);
        
        for (let i = 0; i < roundMatches; i++) {
            matches.push({
                tournament_id: tournamentId,
                round: round,
                match_number: matchNumber++,
                bracket_type: 'winner',
                team1_id: null,
                team2_id: null,
                match_date: new Date()
            });
            console.log(`Создан матч раунда ${round}, номер ${i}`);
        }
    }

    // Генерация нижней сетки (Losers Bracket)
    // Количество раундов нижней сетки = количество раундов верхней сетки + 1
    const totalLoserRounds = totalWinnerRounds + 1;
    console.log(`Количество раундов нижней сетки: ${totalLoserRounds}`);

    // Массив для хранения матчей каждого раунда
    const loserRoundMatches = Array(totalLoserRounds + 1).fill(null).map(() => []);

    // Генерация матчей нижней сетки для каждого раунда
    for (let round = 1; round <= totalLoserRounds; round++) {
        let matchesInRound;

        if (round === 1) {
            // Первый раунд нижней сетки: количество матчей первого раунда верхней сетки / 4
            matchesInRound = Math.max(1, Math.ceil(firstRoundMatches / 4));
        } else if (round === totalLoserRounds) {
            // Финал нижней сетки: 1 матч
            matchesInRound = 1;
        } else {
            // Промежуточные раунды:
            // Проигравшие из победителей + Победители из лузеров предыдущего раунда
            const winnersRound = round - 1;
            const winnersMatches = Math.pow(2, totalWinnerRounds - winnersRound - 1);
            const prevLosersMatches = loserRoundMatches[round - 1].length;
            
            matchesInRound = Math.max(1, Math.ceil((winnersMatches + prevLosersMatches) / 4));
        }

        console.log(`Количество матчей в раунде ${round} нижней сетки: ${matchesInRound}`);

        for (let i = 0; i < matchesInRound; i++) {
            const match = {
                tournament_id: tournamentId,
                round: round,
                match_number: matchNumber++,
                bracket_type: 'loser',
                team1_id: null,
                team2_id: null,
                match_date: new Date()
            };
            matches.push(match);
            loserRoundMatches[round].push(match);
            console.log(`Создан матч нижней сетки раунда ${round}, номер ${i}`);
        }
    }

    // Генерация гранд-финала
    const grandFinalMatch = {
        tournament_id: tournamentId,
        round: totalWinnerRounds,
        match_number: matchNumber++,
        bracket_type: 'grand_final',
        team1_id: null,
        team2_id: null,
        match_date: new Date()
    };
    matches.push(grandFinalMatch);
    console.log('Создан гранд-финал');

    // Сначала вставляем все матчи в базу без связей
    for (const match of matches) {
        const result = await pool.query(
            'INSERT INTO matches (tournament_id, round, match_number, bracket_type, team1_id, team2_id, match_date) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [match.tournament_id, match.round, match.match_number, match.bracket_type, match.team1_id, match.team2_id, match.match_date]
        );
        match.id = result.rows[0].id;
    }

    // Установка связей для верхней сетки
    console.log('Установка связей для верхней сетки:');
    for (let round = 0; round < totalWinnerRounds - 1; round++) {
        const currentRoundMatches = matches.filter(m => m.round === round && m.bracket_type === 'winner');
        const nextRoundMatches = matches.filter(m => m.round === round + 1 && m.bracket_type === 'winner');
        
        console.log(`Связи из раунда ${round} (${currentRoundMatches.length} матчей) в раунд ${round + 1} (${nextRoundMatches.length} матчей)`);
        
        for (let i = 0; i < currentRoundMatches.length; i += 2) {
            const match1 = currentRoundMatches[i];
            const match2 = currentRoundMatches[i + 1] || null;
            const nextMatchIndex = Math.floor(i / 2);
            
            if (nextMatchIndex < nextRoundMatches.length) {
                const nextMatch = nextRoundMatches[nextMatchIndex];
                
                if (match1) {
                    match1.next_match_id = nextMatch.id;
                    await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [nextMatch.id, match1.id]);
                    console.log(`Матч ${match1.id} раунда ${round} связан с матчем ${nextMatch.id} раунда ${round + 1}`);
                }
                
                if (match2) {
                    match2.next_match_id = nextMatch.id;
                    await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [nextMatch.id, match2.id]);
                    console.log(`Матч ${match2 ? match2.id : 'null'} раунда ${round} связан с матчем ${nextMatch.id} раунда ${round + 1}`);
                }
            }
        }
    }

    // Установка связей для проигравших из верхней сетки в нижнюю
    console.log('Установка связей для проигравших из верхней сетки в нижнюю:');
    
    // Создаем структуру распределения проигравших по раундам нижней сетки
    const loserDistribution = {};
    
    // Для каждого раунда верхней сетки определяем, куда падают проигравшие
    for (let round = 0; round < totalWinnerRounds; round++) {
        // В каком раунде нижней сетки окажутся проигравшие из этого раунда верхней сетки
        let targetLoserRound;
        
        if (round === totalWinnerRounds - 1) {
            // Проигравший финала верхней сетки падает в финал нижней сетки
            targetLoserRound = totalLoserRounds;
        } else {
            // Остальные проигравшие распределяются по раундам нижней сетки
            targetLoserRound = Math.ceil((round + 1) / 2);
        }
        
        if (!loserDistribution[targetLoserRound]) {
            loserDistribution[targetLoserRound] = [];
        }
        
        loserDistribution[targetLoserRound].push(round);
        console.log(`Проигравшие из раунда ${round} верхней сетки попадают в раунд ${targetLoserRound} нижней сетки`);
    }
    
    // Распределяем проигравших равномерно по матчам нижней сетки
    for (let loserRound = 1; loserRound <= totalLoserRounds; loserRound++) {
        const loserMatches = loserRoundMatches[loserRound];
        
        if (!loserMatches || loserMatches.length === 0 || !loserDistribution[loserRound]) {
            continue;
        }
        
        // Собираем все матчи верхней сетки, проигравшие из которых попадают в этот раунд нижней сетки
        const sourceWinnerRounds = loserDistribution[loserRound];
        const sourceWinnerMatches = [];
        
        for (const round of sourceWinnerRounds) {
            const winnerMatches = matches.filter(m => m.round === round && m.bracket_type === 'winner');
            sourceWinnerMatches.push(...winnerMatches);
        }
        
        console.log(`Для раунда ${loserRound} нижней сетки (${loserMatches.length} матчей) есть ${sourceWinnerMatches.length} матчей верхней сетки`);
        
        // Равномерно распределяем матчи верхней сетки по матчам нижней сетки
        for (let i = 0; i < sourceWinnerMatches.length; i++) {
            const winnerMatch = sourceWinnerMatches[i];
            const targetLoserMatchIndex = i % loserMatches.length;
            const targetLoserMatch = loserMatches[targetLoserMatchIndex];
            
            if (winnerMatch && targetLoserMatch) {
                winnerMatch.loser_next_match_id = targetLoserMatch.id;
                await pool.query('UPDATE matches SET loser_next_match_id = $1 WHERE id = $2', [targetLoserMatch.id, winnerMatch.id]);
                console.log(`Проигравший из матча ${winnerMatch.id} раунда ${winnerMatch.round} верхней сетки попадет в матч ${targetLoserMatch.id} раунда ${loserRound} нижней сетки`);
            }
        }
    }

    // Установка связей в нижней сетке (победители переходят в следующий раунд)
    console.log('Установка связей в нижней сетке:');
    for (let round = 1; round < totalLoserRounds; round++) {
        const currentRoundMatches = loserRoundMatches[round];
        const nextRoundMatches = loserRoundMatches[round + 1];
        
        if (!currentRoundMatches || currentRoundMatches.length === 0 || !nextRoundMatches || nextRoundMatches.length === 0) {
            continue;
        }
        
        console.log(`Связи из раунда ${round} (${currentRoundMatches.length} матчей) в раунд ${round + 1} (${nextRoundMatches.length} матчей) нижней сетки`);
        
        for (let i = 0; i < currentRoundMatches.length; i++) {
            const match = currentRoundMatches[i];
            const targetNextMatchIndex = i % nextRoundMatches.length;
            const nextMatch = nextRoundMatches[targetNextMatchIndex];
            
            if (match && nextMatch) {
                match.next_match_id = nextMatch.id;
                await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [nextMatch.id, match.id]);
                console.log(`Победитель матча ${match.id} раунда ${round} нижней сетки переходит в матч ${nextMatch.id} раунда ${round + 1}`);
            }
        }
    }

    // Связь финалов с гранд-финалом
    const finalWinnerMatch = matches.find(m => m.round === totalWinnerRounds - 1 && m.bracket_type === 'winner');
    const finalLoserMatch = loserRoundMatches[totalLoserRounds][0];
    
    if (finalWinnerMatch && grandFinalMatch) {
        finalWinnerMatch.next_match_id = grandFinalMatch.id;
        await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [grandFinalMatch.id, finalWinnerMatch.id]);
        console.log(`Победитель матча ${finalWinnerMatch.id} финала верхней сетки переходит в гранд-финал ${grandFinalMatch.id}`);
    }
    
    if (finalLoserMatch && grandFinalMatch) {
        finalLoserMatch.next_match_id = grandFinalMatch.id;
        await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [grandFinalMatch.id, finalLoserMatch.id]);
        console.log(`Победитель матча ${finalLoserMatch.id} финала нижней сетки переходит в гранд-финал ${grandFinalMatch.id}`);
    }

    // Добавляем матч за третье место, если нужно
    if (thirdPlaceMatch) {
        const thirdPlaceMatch = {
            tournament_id: tournamentId,
            round: totalWinnerRounds,
            match_number: matchNumber++,
            bracket_type: 'placement',
            is_third_place_match: true,
            team1_id: null,
            team2_id: null,
            match_date: new Date()
        };
        
        const thirdPlaceResult = await pool.query(
            'INSERT INTO matches (tournament_id, round, match_number, bracket_type, is_third_place_match, team1_id, team2_id, match_date) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [thirdPlaceMatch.tournament_id, thirdPlaceMatch.round, thirdPlaceMatch.match_number, 
             thirdPlaceMatch.bracket_type, thirdPlaceMatch.is_third_place_match, 
             thirdPlaceMatch.team1_id, thirdPlaceMatch.team2_id, thirdPlaceMatch.match_date]
        );
        
        thirdPlaceMatch.id = thirdPlaceResult.rows[0].id;
        matches.push(thirdPlaceMatch);
        console.log(`Создан матч за третье место ${thirdPlaceMatch.id}`);
        
        // Связываем проигравших полуфинала верхней сетки с матчем за 3-е место
        const semifinalMatches = matches.filter(m => m.round === totalWinnerRounds - 2 && m.bracket_type === 'winner');
        for (const semifinalMatch of semifinalMatches) {
            // Если у матча уже есть loser_next_match_id, не меняем его
            if (!semifinalMatch.loser_next_match_id) {
                semifinalMatch.loser_next_match_id = thirdPlaceMatch.id;
                await pool.query('UPDATE matches SET loser_next_match_id = $1 WHERE id = $2', [thirdPlaceMatch.id, semifinalMatch.id]);
                console.log(`Проигравший полуфинала ${semifinalMatch.id} переходит в матч за 3-е место ${thirdPlaceMatch.id}`);
            }
        }
    }

    return matches;
};

module.exports = { generateDoubleEliminationBracket };