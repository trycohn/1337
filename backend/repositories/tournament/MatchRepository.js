const pool = require('../../db');

class MatchRepository {
    /**
     * Получение матчей турнира
     */
    static async getByTournamentId(tournamentId) {
        const result = await pool.query(`
            SELECT 
                id,
                tournament_id,
                round,
                match_number,
                tournament_match_number,
                team1_id,
                team2_id,
                score1,
                score2,
                winner_team_id,
                match_date,
                status,
                maps_data,
                -- ключевые поля для Double Elimination
                bracket_type,
                next_match_id,
                loser_next_match_id,
                -- доп. метаданные для UI
                is_third_place_match,
                is_preliminary_round,
                bye_match,
                target_slot,
                position_in_round,
                source_match1_id,
                source_match2_id,
                round_name,
                match_title
            FROM matches 
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
     * Получение матча по ID с полной информацией об участниках
     */
    static async getByIdWithParticipants(matchId) {
        const result = await pool.query(`
            SELECT 
                m.*,
                -- Информация о первом участнике/команде
                CASE 
                    WHEN tt1.id IS NOT NULL THEN 
                        json_build_object(
                            'id', tt1.id,
                            'name', tt1.name,
                            'avatar_url', tt1.avatar_url,
                            'user_id', tt1.captain_id,
                            'type', 'team'
                        )
                    WHEN tp1.id IS NOT NULL THEN
                        json_build_object(
                            'id', tp1.id,
                            'name', COALESCE(u1.username, tp1.name),
                            'avatar_url', u1.avatar_url,
                            'user_id', u1.id,
                            'type', 'individual'
                        )
                    ELSE NULL
                END as team1,
                
                -- Информация о втором участнике/команде
                CASE 
                    WHEN tt2.id IS NOT NULL THEN 
                        json_build_object(
                            'id', tt2.id,
                            'name', tt2.name,
                            'avatar_url', tt2.avatar_url,
                            'user_id', tt2.captain_id,
                            'type', 'team'
                        )
                    WHEN tp2.id IS NOT NULL THEN
                        json_build_object(
                            'id', tp2.id,
                            'name', COALESCE(u2.username, tp2.name),
                            'avatar_url', u2.avatar_url,
                            'user_id', u2.id,
                            'type', 'individual'
                        )
                    ELSE NULL
                END as team2
                
            FROM matches m
            LEFT JOIN tournament_teams tt1 ON m.team1_id = tt1.id
            LEFT JOIN tournament_teams tt2 ON m.team2_id = tt2.id
            LEFT JOIN tournament_participants tp1 ON m.team1_id = tp1.id
            LEFT JOIN tournament_participants tp2 ON m.team2_id = tp2.id
            LEFT JOIN users u1 ON tp1.user_id = u1.id
            LEFT JOIN users u2 ON tp2.user_id = u2.id
            WHERE m.id = $1
        `, [matchId]);
        
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