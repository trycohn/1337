const pool = require('../../db');

/**
 * Repository для работы с запросами на вступление в команды
 */
class TeamJoinRequestRepository {
    /**
     * Создание запроса на вступление в команду
     */
    static async create(requestData) {
        const {
            team_id,
            tournament_id,
            user_id,
            message = null
        } = requestData;

        try {
            const result = await pool.query(
                `INSERT INTO team_join_requests 
                 (team_id, tournament_id, user_id, message, status)
                 VALUES ($1, $2, $3, $4, 'pending')
                 RETURNING *`,
                [team_id, tournament_id, user_id, message]
            );

            return result.rows[0];
        } catch (error) {
            // Обработка ошибки уникального ограничения
            if (error.code === '23505') { // unique_violation
                throw new Error('REQUEST_ALREADY_EXISTS');
            }
            throw error;
        }
    }

    /**
     * Получение запроса по ID
     */
    static async getById(requestId) {
        const result = await pool.query(
            `SELECT 
                tjr.*,
                u.username as user_username,
                u.avatar_url as user_avatar,
                tt.name as team_name,
                tt.creator_id as team_creator_id,
                t.name as tournament_name
             FROM team_join_requests tjr
             JOIN users u ON tjr.user_id = u.id
             JOIN tournament_teams tt ON tjr.team_id = tt.id
             JOIN tournaments t ON tjr.tournament_id = t.id
             WHERE tjr.id = $1`,
            [requestId]
        );

        return result.rows[0] || null;
    }

    /**
     * Получение всех pending запросов для команды
     */
    static async getPendingByTeam(teamId) {
        const result = await pool.query(
            `SELECT 
                tjr.*,
                u.username as user_username,
                u.avatar_url as user_avatar,
                u.faceit_elo,
                u.cs2_premier_rank
             FROM team_join_requests tjr
             JOIN users u ON tjr.user_id = u.id
             WHERE tjr.team_id = $1 AND tjr.status = 'pending'
             ORDER BY tjr.created_at ASC`,
            [teamId]
        );

        return result.rows;
    }

    /**
     * Получение всех запросов пользователя для турнира
     */
    static async getByUserAndTournament(userId, tournamentId) {
        const result = await pool.query(
            `SELECT 
                tjr.*,
                tt.name as team_name,
                tt.creator_id as team_creator_id
             FROM team_join_requests tjr
             JOIN tournament_teams tt ON tjr.team_id = tt.id
             WHERE tjr.user_id = $1 AND tjr.tournament_id = $2
             ORDER BY tjr.created_at DESC`,
            [userId, tournamentId]
        );

        return result.rows;
    }

    /**
     * Проверка наличия pending запроса пользователя в команду
     */
    static async hasPendingRequest(teamId, userId) {
        const result = await pool.query(
            `SELECT id FROM team_join_requests 
             WHERE team_id = $1 AND user_id = $2 AND status = 'pending'`,
            [teamId, userId]
        );

        return result.rows.length > 0;
    }

    /**
     * Принятие запроса
     */
    static async accept(requestId, reviewedBy) {
        const result = await pool.query(
            `UPDATE team_join_requests 
             SET status = 'accepted', 
                 reviewed_by = $2, 
                 reviewed_at = NOW()
             WHERE id = $1 AND status = 'pending'
             RETURNING *`,
            [requestId, reviewedBy]
        );

        return result.rows[0] || null;
    }

    /**
     * Отклонение запроса
     */
    static async reject(requestId, reviewedBy) {
        const result = await pool.query(
            `UPDATE team_join_requests 
             SET status = 'rejected', 
                 reviewed_by = $2, 
                 reviewed_at = NOW()
             WHERE id = $1 AND status = 'pending'
             RETURNING *`,
            [requestId, reviewedBy]
        );

        return result.rows[0] || null;
    }

    /**
     * Отмена запроса пользователем
     */
    static async cancel(requestId, userId) {
        const result = await pool.query(
            `DELETE FROM team_join_requests 
             WHERE id = $1 AND user_id = $2 AND status = 'pending'
             RETURNING *`,
            [requestId, userId]
        );

        return result.rows[0] || null;
    }

    /**
     * Получение количества pending запросов для команды
     */
    static async countPendingByTeam(teamId) {
        const result = await pool.query(
            `SELECT COUNT(*) as count 
             FROM team_join_requests 
             WHERE team_id = $1 AND status = 'pending'`,
            [teamId]
        );

        return parseInt(result.rows[0].count);
    }

    /**
     * Получение всех команд турнира с количеством pending запросов
     */
    static async getTeamsWithPendingCounts(tournamentId) {
        const result = await pool.query(
            `SELECT 
                tt.id,
                tt.name,
                tt.creator_id,
                COUNT(tjr.id) as pending_requests_count
             FROM tournament_teams tt
             LEFT JOIN team_join_requests tjr ON tt.id = tjr.team_id AND tjr.status = 'pending'
             WHERE tt.tournament_id = $1
             GROUP BY tt.id
             ORDER BY tt.name`,
            [tournamentId]
        );

        return result.rows;
    }

    /**
     * Удаление всех запросов пользователя для турнира
     */
    static async deleteUserRequestsForTournament(userId, tournamentId) {
        await pool.query(
            `DELETE FROM team_join_requests 
             WHERE user_id = $1 AND tournament_id = $2`,
            [userId, tournamentId]
        );
    }
}

module.exports = TeamJoinRequestRepository;

