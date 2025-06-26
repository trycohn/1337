const pool = require('../../db');

class ParticipantRepository {
    /**
     * Получение участников турнира
     */
    static async getByTournamentId(tournamentId) {
        const result = await pool.query(`
            SELECT 
                tp.id,
                tp.tournament_id,
                tp.user_id,
                tp.name,
                tp.faceit_elo,
                tp.cs2_premier_rank,
                tp.in_team,
                tp.invited_at,
                u.username,
                u.avatar_url,
                u.faceit_elo as user_faceit_elo,
                u.cs2_premier_rank as user_cs2_premier_rank
            FROM tournament_participants tp
            LEFT JOIN users u ON tp.user_id = u.id
            WHERE tp.tournament_id = $1
            ORDER BY tp.id ASC
        `, [tournamentId]);

        return result.rows;
    }

    /**
     * Получение участия пользователя в турнире
     */
    static async getUserParticipation(tournamentId, userId) {
        const result = await pool.query(
            'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
            [tournamentId, userId]
        );

        return result.rows[0] || null;
    }

    /**
     * Создание нового участника
     */
    static async create(participantData) {
        const { tournament_id, user_id, name } = participantData;

        const result = await pool.query(
            `INSERT INTO tournament_participants (tournament_id, user_id, name, invited_at)
             VALUES ($1, $2, $3, NOW()) RETURNING *`,
            [tournament_id, user_id, name]
        );

        return result.rows[0];
    }

    /**
     * Удаление участника по ID пользователя
     */
    static async removeParticipant(tournamentId, userId) {
        const result = await pool.query(
            'DELETE FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2 RETURNING *',
            [tournamentId, userId]
        );

        return result.rows[0] || null;
    }

    /**
     * Удаление участника по ID участника
     */
    static async removeById(participantId) {
        const result = await pool.query(
            'DELETE FROM tournament_participants WHERE id = $1 RETURNING *',
            [participantId]
        );

        return result.rows[0] || null;
    }

    /**
     * Получение количества участников в турнире
     */
    static async getCountByTournamentId(tournamentId) {
        const result = await pool.query(
            'SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = $1',
            [tournamentId]
        );

        return parseInt(result.rows[0].count);
    }

    /**
     * Получение участника по ID
     */
    static async getById(participantId) {
        const result = await pool.query(
            'SELECT * FROM tournament_participants WHERE id = $1',
            [participantId]
        );

        return result.rows[0] || null;
    }

    /**
     * Обновление данных участника
     */
    static async update(participantId, updateData) {
        const { name, faceit_elo, cs2_premier_rank, in_team } = updateData;

        const result = await pool.query(
            `UPDATE tournament_participants 
             SET name = COALESCE($1, name), 
                 faceit_elo = COALESCE($2, faceit_elo), 
                 cs2_premier_rank = COALESCE($3, cs2_premier_rank),
                 in_team = COALESCE($4, in_team)
             WHERE id = $5 RETURNING *`,
            [name, faceit_elo, cs2_premier_rank, in_team, participantId]
        );

        return result.rows[0] || null;
    }

    /**
     * Получение всех участников пользователя
     */
    static async getUserParticipations(userId) {
        const result = await pool.query(`
            SELECT 
                tp.*,
                t.name as tournament_name,
                t.status as tournament_status,
                t.game as tournament_game
            FROM tournament_participants tp
            LEFT JOIN tournaments t ON tp.tournament_id = t.id
            WHERE tp.user_id = $1
            ORDER BY tp.invited_at DESC
        `, [userId]);

        return result.rows;
    }

    /**
     * Поиск участников по имени в турнире
     */
    static async searchByNameInTournament(tournamentId, searchTerm) {
        const result = await pool.query(`
            SELECT 
                tp.*,
                u.username,
                u.avatar_url
            FROM tournament_participants tp
            LEFT JOIN users u ON tp.user_id = u.id
            WHERE tp.tournament_id = $1 
            AND (tp.name ILIKE $2 OR u.username ILIKE $2)
            ORDER BY tp.name ASC
        `, [tournamentId, `%${searchTerm}%`]);

        return result.rows;
    }

    /**
     * Получение статистики участника в турнирах
     */
    static async getParticipantStats(userId) {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_tournaments,
                COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tournaments,
                COUNT(CASE WHEN t.status = 'active' THEN 1 END) as active_tournaments,
                COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tournaments
            FROM tournament_participants tp
            LEFT JOIN tournaments t ON tp.tournament_id = t.id
            WHERE tp.user_id = $1
        `, [userId]);

        return result.rows[0] || {
            total_tournaments: 0,
            completed_tournaments: 0,
            active_tournaments: 0,
            in_progress_tournaments: 0
        };
    }

    /**
     * Массовое удаление участников турнира
     */
    static async removeAllFromTournament(tournamentId) {
        const result = await pool.query(
            'DELETE FROM tournament_participants WHERE tournament_id = $1',
            [tournamentId]
        );

        return result.rowCount;
    }

    /**
     * Проверка, может ли пользователь участвовать в турнире
     */
    static async canUserParticipate(tournamentId, userId) {
        // Проверяем, не участвует ли уже
        const existingParticipation = await this.getUserParticipation(tournamentId, userId);
        if (existingParticipation) {
            return { canParticipate: false, reason: 'Уже участвует в турнире' };
        }

        // Проверяем лимит участников
        const tournament = await pool.query('SELECT max_participants FROM tournaments WHERE id = $1', [tournamentId]);
        if (tournament.rows.length === 0) {
            return { canParticipate: false, reason: 'Турнир не найден' };
        }

        const maxParticipants = tournament.rows[0].max_participants;
        if (maxParticipants) {
            const currentCount = await this.getCountByTournamentId(tournamentId);
            if (currentCount >= maxParticipants) {
                return { canParticipate: false, reason: 'Турнир заполнен' };
            }
        }

        return { canParticipate: true };
    }
}

module.exports = ParticipantRepository; 