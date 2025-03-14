// backend/controllers/bracketController.js
const pool = require('../db');

// Функция перемешивания массива (алгоритм Фишера-Йетса)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const generateBracket = async (req, res) => {
    const { tournamentId } = req.params;
    try {
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        const tournament = tournamentResult.rows[0];
        if (!tournament) {
            return res.status(404).json({ status: 'error', message: 'Tournament not found' });
        }
        if (tournament.created_by !== req.user.id) {
            return res.status(403).json({ status: 'error', message: 'Not authorized to generate bracket for this tournament' });
        }
        const teamsResult = await pool.query('SELECT * FROM tournament_teams WHERE tournament_id = $1', [tournamentId]);
        const tournamentTeams = teamsResult.rows;
        if (tournamentTeams.length < 2) {
            return res.status(400).json({ status: 'error', message: 'Not enough teams to generate bracket' });
        }
        const shuffledTeams = shuffleArray(tournamentTeams.slice());
        const n = shuffledTeams.length;
        const p = Math.pow(2, Math.floor(Math.log2(n)));
        let matches = [];
        let round = 1;
        if (n === p) {
            for (let i = 0; i < n; i += 2) {
                matches.push({
                    tournament_id: tournamentId,
                    round: round,
                    team1_id: shuffledTeams[i].id,
                    team2_id: shuffledTeams[i + 1] ? shuffledTeams[i + 1].id : null
                });
            }
        } else {
            const numPrelimMatches = n - p;
            for (let i = 0; i < numPrelimMatches * 2; i += 2) {
                matches.push({
                    tournament_id: tournamentId,
                    round: 0,
                    team1_id: shuffledTeams[i].id,
                    team2_id: shuffledTeams[i + 1] ? shuffledTeams[i + 1].id : null
                });
            }
            // Дополнительная логика для предварительного раунда может быть добавлена здесь.
        }
        const insertedMatches = [];
        for (let match of matches) {
            const result = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id) VALUES ($1, $2, $3, $4) RETURNING *',
                [match.tournament_id, match.round, match.team1_id, match.team2_id]
            );
            insertedMatches.push(result.rows[0]);
        }
        res.status(201).json({ status: 'success', bracket: insertedMatches });
    } catch (err) {
        console.error('Error generating bracket:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

module.exports = {
    generateBracket
};
