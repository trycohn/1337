const pool = require('../../db');

class MatchRepository {
    /**
     * Получение матчей турнира
     */
    static async getByTournamentId(tournamentId) {
        const result = await pool.query(`
            SELECT * FROM matches 
            WHERE tournament_id = $1 
            ORDER BY round, match_number
        `, [tournamentId]);

        return result.rows;
    }

    /**
     * Получение количества матчей в турнире
     */
    static async getCountByTournamentId(tournamentId) {
        const result = await pool.query(
            'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
            [tournamentId]
        );

        return parseInt(result.rows[0].count);
    }

    /**
     * Получение матча по ID
     */
    static async getById(matchId) {
        const result = await pool.query('SELECT * FROM matches WHERE id = $1', [matchId]);
        return result.rows[0] || null;
    }

    /**
     * Обновление результата матча
     */
    static async updateResult(matchId, resultData) {
        const { winner_team_id, score1, score2, maps_data } = resultData;

        const result = await pool.query(
            `UPDATE matches 
             SET winner_team_id = $1, score1 = $2, score2 = $3, maps_data = $4
             WHERE id = $5 RETURNING *`,
            [winner_team_id, score1, score2, JSON.stringify(maps_data), matchId]
        );

        return result.rows[0];
    }

    /**
     * Удаление всех матчей турнира
     */
    static async deleteByTournamentId(tournamentId) {
        const result = await pool.query(
            'DELETE FROM matches WHERE tournament_id = $1',
            [tournamentId]
        );

        return result.rowCount;
    }
}

module.exports = MatchRepository; 