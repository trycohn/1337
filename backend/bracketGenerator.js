const pool = require('./db');

async function generateBracket(tournamentId, participants, thirdPlaceMatch) {
    const matches = [];
    const n = participants.length;
    const nearestPowerOf2 = Math.pow(2, Math.floor(Math.log2(n)));
    let hasPreliminaryRound = false;

    console.log(`Participants: ${n}, Nearest power of 2: ${nearestPowerOf2}`);

    let matchNumber = 1;
    let currentParticipants = [...participants];

    // Проверяем, нужен ли предварительный раунд
    if (n !== nearestPowerOf2) {
        hasPreliminaryRound = true;
        const excessParticipants = n - nearestPowerOf2;
        const prelimParticipantsCount = excessParticipants * 2;
        const prelimMatchCount = excessParticipants;

        console.log(`Preliminary round: ${prelimParticipantsCount} participants, ${prelimMatchCount} matches`);

        const prelimParticipants = currentParticipants.slice(0, prelimParticipantsCount);
        for (let i = 0; i < prelimMatchCount; i++) {
            const team1 = prelimParticipants[i * 2];
            const team2 = prelimParticipants[i * 2 + 1];
            const matchResult = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [tournamentId, 0, team1.id, team2.id, matchNumber++]
            );
            matches.push(matchResult.rows[0]);
        }

        currentParticipants = currentParticipants.slice(prelimParticipantsCount);
    }

    // Основная сетка
    let round = 1;
    let totalMatches = hasPreliminaryRound ? nearestPowerOf2 : n;

    // Раунд 1: заполняем оставшихся участников
    const round1Matches = [];
    const matchCountRound1 = Math.ceil(totalMatches / 2);

    console.log(`Round ${round}, matches: ${matchCountRound1}`);

    let participantIndex = 0;
    for (let i = 0; i < matchCountRound1; i++) {
        let team1 = null;
        let team2 = null;

        if (participantIndex < currentParticipants.length) {
            team1 = currentParticipants[participantIndex++];
        }
        if (participantIndex < currentParticipants.length) {
            team2 = currentParticipants[participantIndex++];
        } else if (i === 0 && hasPreliminaryRound) {
            team2 = null; // Место для победителя предварительного раунда
        }

        const matchResult = await pool.query(
            'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [tournamentId, round, team1 ? team1.id : null, team2 ? team2.id : null, matchNumber++]
        );
        round1Matches.push(matchResult.rows[0]);
    }
    matches.push(...round1Matches);

    // Создаём пустые матчи для оставшихся раундов, включая финал
    round++;
    totalMatches = matchCountRound1;
    const totalRounds = Math.ceil(Math.log2(nearestPowerOf2));
    while (round <= totalRounds) {
        const matchCount = Math.max(1, Math.floor(totalMatches / 2)); // Гарантируем минимум 1 матч для финала

        console.log(`Round ${round}, matches: ${matchCount}`);

        for (let i = 0; i < matchCount; i++) {
            const matchResult = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [tournamentId, round, null, null, matchNumber++]
            );
            matches.push(matchResult.rows[0]);
        }

        totalMatches = matchCount;
        round++;
    }

    // Матч за 3-е место (если чекбокс активен), создаём пустой матч
    if (thirdPlaceMatch && totalRounds > 1) {
        const semiFinalMatches = matches.filter(m => m.round === totalRounds - 1); // Полуфиналы
        if (semiFinalMatches.length >= 2) {
            const matchResult = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, is_third_place_match) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [tournamentId, totalRounds, null, null, matchNumber++, true]
            );
            matches.push(matchResult.rows[0]);
        }
    }

    return matches;
}

module.exports = { generateBracket };