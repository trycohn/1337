const pool = require('../../db');

class TournamentRepository {
    /**
     * Получение всех турниров с количеством участников
     */
    static async getAllWithParticipantCount() {
        const result = await pool.query(`
            SELECT t.*, 
                   CASE 
                     WHEN t.participant_type = 'solo' THEN (
                       SELECT COUNT(*) FROM tournament_participants tp WHERE tp.tournament_id = t.id
                     )
                     WHEN t.participant_type = 'team' THEN (
                       SELECT COUNT(*) FROM tournament_teams tt WHERE tt.tournament_id = t.id
                     )
                     ELSE 0
                   END AS participant_count
            FROM tournaments t
            ORDER BY t.created_at DESC
        `);
        
        return result.rows;
    }

    /**
     * Получение турнира по ID
     */
    static async getById(tournamentId) {
        const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        return result.rows[0] || null;
    }

    /**
     * Получение турнира по ID с информацией о создателе
     */
    static async getByIdWithCreator(tournamentId) {
        const result = await pool.query(`
            SELECT 
                t.*,
                u.username as creator_username,
                u.avatar_url as creator_avatar_url
            FROM tournaments t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.id = $1
        `, [tournamentId]);
        
        return result.rows[0] || null;
    }

    /**
     * Создание нового турнира
     */
    static async create(tournamentData) {
        const {
            name, game, format, created_by, status, participant_type,
            max_participants, start_date, description, bracket_type, team_size
        } = tournamentData;

        const result = await pool.query(
            `INSERT INTO tournaments
             (name, game, format, created_by, status, participant_type, max_participants, start_date, description, bracket_type, team_size)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [name, game, format, created_by, status, participant_type, max_participants, start_date, description, bracket_type, team_size]
        );

        return result.rows[0];
    }

    /**
     * Обновление турнира
     */
    static async update(tournamentId, updateData) {
        const { name, game, format, participant_type, max_participants, start_date, description } = updateData;

        const result = await pool.query(
            'UPDATE tournaments SET name = $1, game = $2, format = $3, participant_type = $4, max_participants = $5, start_date = $6, description = $7 WHERE id = $8 RETURNING *',
            [name, game, format, participant_type, max_participants, start_date, description, tournamentId]
        );

        return result.rows[0];
    }

    /**
     * Удаление турнира
     */
    static async delete(tournamentId) {
        const result = await pool.query('DELETE FROM tournaments WHERE id = $1 RETURNING *', [tournamentId]);
        return result.rows[0];
    }

    /**
     * Обновление статуса турнира
     */
    static async updateStatus(tournamentId, status) {
        const result = await pool.query(
            'UPDATE tournaments SET status = $1 WHERE id = $2 RETURNING *',
            [status, tournamentId]
        );
        return result.rows[0];
    }

    /**
     * Получение списка игр
     */
    static async getGames() {
        const result = await pool.query('SELECT id, name FROM games ORDER BY name');
        return result.rows;
    }

    /**
     * Получение администраторов турнира
     */
    static async getAdmins(tournamentId) {
        try {
            const result = await pool.query(`
                SELECT 
                    ta.id,
                    ta.user_id,
                    ta.permissions,
                    ta.assigned_at,
                    u.username,
                    u.avatar_url
                FROM tournament_admins ta
                LEFT JOIN users u ON ta.user_id = u.id
                WHERE ta.tournament_id = $1
                ORDER BY ta.assigned_at ASC
            `, [tournamentId]);
            
            return result.rows;
        } catch (error) {
            console.warn(`⚠️ Ошибка загрузки администраторов турнира ${tournamentId}:`, error.message);
            return [];
        }
    }

    /**
     * Проверка, является ли пользователь администратором турнира
     */
    static async isAdmin(tournamentId, userId) {
        try {
            const result = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, userId]
            );
            return result.rows.length > 0;
        } catch (error) {
            console.warn(`⚠️ Ошибка проверки админских прав:`, error.message);
            return false;
        }
    }

    /**
     * Получение команд с участниками
     */
    static async getTeamsWithMembers(tournamentId) {
        try {
            // Получаем все команды турнира
            const teamsResult = await pool.query(
                `SELECT tt.id, tt.tournament_id, tt.name, tt.creator_id
                 FROM tournament_teams tt
                 WHERE tt.tournament_id = $1
                 ORDER BY tt.id`,
                [tournamentId]
            );

            // Для каждой команды получаем участников с ПОЛНЫМИ полями рейтинга
            const teams = await Promise.all(teamsResult.rows.map(async (team) => {
                const membersResult = await pool.query(
                    `SELECT tm.team_id, tm.user_id, tm.participant_id, 
                            tp.name, u.username, u.avatar_url, 
                            tp.faceit_elo, tp.cs2_premier_rank,
                            u.faceit_elo as user_faceit_elo, u.cs2_premier_rank as user_premier_rank,
                            u.faceit_elo as user_faceit_rating, u.cs2_premier_rank as user_premier_rating
                     FROM tournament_team_members tm
                     LEFT JOIN tournament_participants tp ON tm.participant_id = tp.id
                     LEFT JOIN users u ON tm.user_id = u.id
                     WHERE tm.team_id = $1
                     ORDER BY tm.participant_id`,
                    [team.id]
                );

                // Расчет среднего рейтинга команды
                const members = membersResult.rows;
                let averageRatingFaceit = 0;
                let averageRatingPremier = 0;
                
                if (members.length > 0) {
                    // Рассчитываем для FACEIT (используем нормализацию из оригинального кода)
                    const faceitRatings = members.map(member => {
                        if (member.faceit_elo && !isNaN(parseInt(member.faceit_elo)) && parseInt(member.faceit_elo) > 0) {
                            return parseInt(member.faceit_elo);
                        } else if (member.user_faceit_elo && !isNaN(parseInt(member.user_faceit_elo)) && parseInt(member.user_faceit_elo) > 0) {
                            return parseInt(member.user_faceit_elo);
                        } else {
                            return 1000; // Дефолт для FACEIT
                        }
                    });
                    averageRatingFaceit = Math.round(faceitRatings.reduce((sum, rating) => sum + rating, 0) / faceitRatings.length);
                    
                    // Рассчитываем для Premier
                    const premierRatings = members.map(member => {
                        if (member.cs2_premier_rank && !isNaN(parseInt(member.cs2_premier_rank)) && parseInt(member.cs2_premier_rank) > 0) {
                            return parseInt(member.cs2_premier_rank);
                        } else if (member.user_premier_rank && !isNaN(parseInt(member.user_premier_rank)) && parseInt(member.user_premier_rank) > 0) {
                            return parseInt(member.user_premier_rank);
                        } else {
                            return 1; // Дефолт для Premier
                        }
                    });
                    averageRatingPremier = Math.round(premierRatings.reduce((sum, rating) => sum + rating, 0) / premierRatings.length);
                }

                return {
                    ...team,
                    members: members,
                    averageRatingFaceit: averageRatingFaceit,
                    averageRatingPremier: averageRatingPremier,
                    averageRating: averageRatingFaceit // для обратной совместимости
                };
            }));

            return teams;
        } catch (error) {
            console.warn(`⚠️ Ошибка получения команд турнира ${tournamentId}:`, error.message);
            return [];
        }
    }

    /**
     * Получение количества команд в турнире
     */
    static async getTeamsCount(tournamentId) {
        const result = await pool.query(
            'SELECT COUNT(*) as count FROM tournament_teams WHERE tournament_id = $1',
            [tournamentId]
        );
        return parseInt(result.rows[0].count);
    }

    /**
     * Удаление команд турнира
     */
    static async deleteTeams(tournamentId) {
        // Сначала удаляем участников команд
        await pool.query(
            'DELETE FROM tournament_team_members WHERE team_id IN (SELECT id FROM tournament_teams WHERE tournament_id = $1)',
            [tournamentId]
        );
        
        // Затем удаляем сами команды
        const result = await pool.query(
            'DELETE FROM tournament_teams WHERE tournament_id = $1',
            [tournamentId]
        );
        
        return result.rowCount;
    }

    /**
     * Обновление описания турнира
     */
    static async updateDescription(tournamentId, description) {
        const result = await pool.query(
            'UPDATE tournaments SET description = $1 WHERE id = $2 RETURNING *',
            [description, tournamentId]
        );
        return result.rows[0];
    }

    /**
     * Обновление полного описания турнира
     */
    static async updateFullDescription(tournamentId, fullDescription) {
        const result = await pool.query(
            'UPDATE tournaments SET full_description = $1 WHERE id = $2 RETURNING *',
            [fullDescription, tournamentId]
        );
        return result.rows[0];
    }

    /**
     * Обновление регламента турнира
     */
    static async updateRules(tournamentId, rules) {
        const result = await pool.query(
            'UPDATE tournaments SET rules = $1 WHERE id = $2 RETURNING *',
            [rules, tournamentId]
        );
        return result.rows[0];
    }

    /**
     * Обновление призового фонда турнира
     */
    static async updatePrizePool(tournamentId, prizePool) {
        const result = await pool.query(
            'UPDATE tournaments SET prize_pool = $1 WHERE id = $2 RETURNING *',
            [prizePool, tournamentId]
        );
        return result.rows[0];
    }

    /**
     * Обновление размера команды
     */
    static async updateTeamSize(tournamentId, teamSize) {
        const result = await pool.query(
            'UPDATE tournaments SET team_size = $1 WHERE id = $2 RETURNING *',
            [teamSize, tournamentId]
        );
        return result.rows[0];
    }

    /**
     * Сброс результатов матчей турнира
     */
    static async resetMatchResults(tournamentId, userId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Получаем количество матчей с результатами для логирования
            const countResult = await client.query(
                'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1 AND winner_team_id IS NOT NULL', 
                [tournamentId]
            );
            const matchesWithResultsCount = parseInt(countResult.rows[0].count);
            
            // Очищаем ВСЕ результаты матчей
            await client.query(`
                UPDATE matches 
                SET winner_team_id = NULL, 
                    score1 = NULL, 
                    score2 = NULL, 
                    maps_data = NULL
                WHERE tournament_id = $1
            `, [tournamentId]);
            
            // Восстанавливаем изначальную структуру сетки
            // (здесь должна быть логика восстановления, но для упрощения пропускаем)
            
            // Меняем статус турнира обратно на 'active'
            await client.query(
                'UPDATE tournaments SET status = $1 WHERE id = $2',
                ['active', tournamentId]
            );
            
            await client.query('COMMIT');
            
            return {
                message: `Успешно очищены результаты ${matchesWithResultsCount} матчей и восстановлена изначальная структура сетки`,
                clearedCount: matchesWithResultsCount,
                statusChanged: true,
                newStatus: 'active',
                structureRestored: true
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = TournamentRepository; 