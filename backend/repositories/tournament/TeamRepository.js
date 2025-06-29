const pool = require('../../db');

class TeamRepository {
    /**
     * Получение команды по ID
     */
    static async getById(teamId) {
        const result = await pool.query('SELECT * FROM tournament_teams WHERE id = $1', [teamId]);
        return result.rows[0] || null;
    }

    /**
     * Создание новой команды
     */
    static async create(teamData) {
        const { tournament_id, name, creator_id } = teamData;

        const result = await pool.query(
            `INSERT INTO tournament_teams (tournament_id, name, creator_id)
             VALUES ($1, $2, $3) RETURNING *`,
            [tournament_id, name, creator_id]
        );

        return result.rows[0];
    }

    /**
     * Добавление участника в команду
     */
    static async addMember(teamId, userId, participantId) {
        const result = await pool.query(
            `INSERT INTO tournament_team_members (team_id, user_id, participant_id)
             VALUES ($1, $2, $3) RETURNING *`,
            [teamId, userId, participantId]
        );

        return result.rows[0];
    }

    /**
     * Получение количества участников в команде
     */
    static async getMembersCount(teamId) {
        const result = await pool.query(
            'SELECT COUNT(*) as count FROM tournament_team_members WHERE team_id = $1',
            [teamId]
        );

        return parseInt(result.rows[0].count);
    }

    /**
     * Получение участников команды
     */
    static async getMembers(teamId) {
        const result = await pool.query(`
            SELECT 
                ttm.*,
                u.username,
                u.avatar_url,
                tp.name as participant_name
            FROM tournament_team_members ttm
            LEFT JOIN users u ON ttm.user_id = u.id
            LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
            WHERE ttm.team_id = $1
        `, [teamId]);

        return result.rows;
    }

    /**
     * Удаление участника из команды
     */
    static async removeMember(teamId, userId) {
        const result = await pool.query(
            'DELETE FROM tournament_team_members WHERE team_id = $1 AND user_id = $2 RETURNING *',
            [teamId, userId]
        );

        return result.rows[0] || null;
    }

    /**
     * Удаление всех команд турнира
     * @param {number} tournamentId - ID турнира
     * @param {object} client - подключение к БД (опционально)
     */
    static async deleteAllByTournamentId(tournamentId, client = pool) {
        console.log(`🗑️ TeamRepository: Удаление всех команд турнира ${tournamentId}`);
        
        try {
            // Сначала удаляем участников команд (связанные записи)
            await client.query(
                'DELETE FROM tournament_team_members ttm USING tournament_teams tt WHERE ttm.team_id = tt.id AND tt.tournament_id = $1',
                [tournamentId]
            );
            
            // Затем удаляем сами команды
            const result = await client.query(
                'DELETE FROM tournament_teams WHERE tournament_id = $1',
                [tournamentId]
            );
            
            console.log(`✅ TeamRepository: Удалено ${result.rowCount} команд из турнира ${tournamentId}`);
            return result.rowCount;
            
        } catch (error) {
            console.error(`❌ TeamRepository: Ошибка удаления команд турнира ${tournamentId}:`, error);
            throw error;
        }
    }

    /**
     * Получение всех команд турнира с участниками
     */
}

module.exports = TeamRepository; 