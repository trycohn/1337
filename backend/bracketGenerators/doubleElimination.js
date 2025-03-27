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

    // Определяем количество раундов в верхней сетке
    const totalWinnerRounds = Math.ceil(Math.log2(participantCount));
    const powerOfTwo = Math.pow(2, totalWinnerRounds);

    // Генерация первого раунда верхней сетки (Winners Bracket) с бай-раундами
    const firstRoundMatches = Math.ceil(participantCount / 2); // Количество матчей зависит от числа участников
    for (let i = 0; i < firstRoundMatches; i++) {
        const team1 = shuffledParticipants[i * 2];
        const team2 = shuffledParticipants[i * 2 + 1] || null; // Бай-раунд, если второго участника нет
        if (team1) {
            matches.push({
                tournament_id: tournamentId,
                round: 0,
                match_number: matchNumber++,
                bracket_type: 'winner',
                team1_id: team1.id,
                team2_id: team2 ? team2.id : null,
                match_date: new Date()
            });
        }
    }

    // Генерация последующих раундов верхней сетки
    let currentRoundParticipants = firstRoundMatches;
    for (let round = 1; round < totalWinnerRounds; round++) {
        const roundMatches = Math.ceil(currentRoundParticipants / 2);
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
        }
        currentRoundParticipants = roundMatches;
    }

    // Генерация нижней сетки (Losers Bracket)
    const totalLoserRounds = totalWinnerRounds + 1; // Добавляем 1 раунд для финала нижней сетки
    const loserMatchesPerRound = [];

    // Создаём пустой Round 0 для нижней сетки (чтобы синхронизировать нумерацию)
    loserMatchesPerRound[0] = [];

    // Рассчитываем количество матчей в каждом раунде нижней сетки заранее
    for (let round = 1; round <= totalLoserRounds; round++) {
        let loserMatchesCount;

        if (round === 1) {
            // Round 1 нижней сетки: половина матчей первого раунда верхней сетки, округление вверх
            loserMatchesCount = Math.ceil(firstRoundMatches / 2);
        } else if (round === totalLoserRounds) {
            // Финал нижней сетки: 1 матч
            loserMatchesCount = 1;
        } else if (round === totalLoserRounds - 1) {
            // Полуфинал нижней сетки: 1 матч (победители из Round 2 нижней)
            loserMatchesCount = 1;
        } else {
            // Промежуточные раунды: (матчи верхней сетки / 2) + (матчи нижней сетки / 2)
            const prevWinnerRoundMatches = matches.filter(m => m.round === round - 1 && m.bracket_type === 'winner').length;
            const prevLoserRoundMatches = loserMatchesPerRound[round - 1] ? loserMatchesPerRound[round - 1].length : 0;
            loserMatchesCount = Math.floor(prevWinnerRoundMatches / 2) + Math.floor(prevLoserRoundMatches / 2);
            // Убедимся, что количество матчей не равно 0
            loserMatchesCount = Math.max(loserMatchesCount, 1);
        }

        loserMatchesPerRound[round] = [];
        for (let i = 0; i < loserMatchesCount; i++) {
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
            loserMatchesPerRound[round].push(match);
        }
    }

    // Генерация гранд-финала
    matches.push({
        tournament_id: tournamentId,
        round: totalWinnerRounds,
        match_number: matchNumber++,
        bracket_type: 'grand_final',
        team1_id: null,
        team2_id: null,
        match_date: new Date()
    });

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
    for (let r = 0; r < totalWinnerRounds - 1; r++) {
        const currentRoundMatches = matches.filter(m => m.round === r && m.bracket_type === 'winner');
        const nextRoundMatches = matches.filter(m => m.round === r + 1 && m.bracket_type === 'winner');
        for (let i = 0; i < currentRoundMatches.length; i += 2) {
            const match1 = currentRoundMatches[i];
            const match2 = currentRoundMatches[i + 1] || null;
            const nextMatch = nextRoundMatches[Math.floor(i / 2)];
            if (match1 && nextMatch) {
                match1.next_match_id = nextMatch.id;
                await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [nextMatch.id, match1.id]);
            }
            if (match2 && nextMatch) {
                match2.next_match_id = nextMatch.id;
                await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [nextMatch.id, match2.id]);
            }
        }
    }

    // Установка связей для проигравших из верхней сетки в нижнюю
    for (let r = 0; r < totalWinnerRounds; r++) {
        const winnerMatches = matches.filter(m => m.round === r && m.bracket_type === 'winner');
        // Проигравшие из Round 0 верхней сетки должны попадать в Round 1 нижней сетки
        // Проигравшие из финала верхней сетки (Round 2) должны попадать в финал нижней сетки (Round 4)
        const targetLoserRound = r === totalWinnerRounds - 1 ? totalLoserRounds : r + 1;
        const loserMatches = matches.filter(m => m.round === targetLoserRound && m.bracket_type === 'loser');
        for (let i = 0; i < winnerMatches.length; i++) {
            const winnerMatch = winnerMatches[i];
            const targetMatch = loserMatches[i % loserMatches.length];
            if (targetMatch) {
                winnerMatch.loser_next_match_id = targetMatch.id;
                await pool.query('UPDATE matches SET loser_next_match_id = $1 WHERE id = $2', [targetMatch.id, winnerMatch.id]);
            }
        }
    }

    // Установка связей в нижней сетке
    for (let r = 1; r < totalLoserRounds; r++) {
        const currentRoundMatches = matches.filter(m => m.round === r && m.bracket_type === 'loser');
        const nextRoundMatches = matches.filter(m => m.round === r + 1 && m.bracket_type === 'loser');
        for (let i = 0; i < currentRoundMatches.length; i += 2) {
            const match1 = currentRoundMatches[i];
            const match2 = currentRoundMatches[i + 1] || null;
            const nextMatch = nextRoundMatches[Math.floor(i / 2)];
            if (match1 && nextMatch) {
                match1.next_match_id = nextMatch.id;
                await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [nextMatch.id, match1.id]);
            }
            if (match2 && nextMatch) {
                match2.next_match_id = nextMatch.id;
                await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [nextMatch.id, match2.id]);
            }
        }
    }

    // Связь финалов с гранд-финалом
    const finalWinnerMatch = matches.find(m => m.round === totalWinnerRounds - 1 && m.bracket_type === 'winner');
    const finalLoserMatch = matches.find(m => m.round === totalLoserRounds && m.bracket_type === 'loser');
    const grandFinalMatch = matches.find(m => m.bracket_type === 'grand_final');

    if (finalWinnerMatch && grandFinalMatch) {
        finalWinnerMatch.next_match_id = grandFinalMatch.id;
        await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [grandFinalMatch.id, finalWinnerMatch.id]);
    }
    if (finalLoserMatch && grandFinalMatch) {
        finalLoserMatch.next_match_id = grandFinalMatch.id;
        await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [grandFinalMatch.id, finalLoserMatch.id]);
    }

    return matches;
};

module.exports = { generateDoubleEliminationBracket };