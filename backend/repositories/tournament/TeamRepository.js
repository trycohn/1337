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
     * 🆕 Добавление участника в команду с поддержкой капитанства
     * @param {number} teamId - ID команды
     * @param {number} userId - ID пользователя
     * @param {number} participantId - ID участника турнира
     * @param {boolean} isCaptain - Является ли участник капитаном
     * @param {number} captainRating - Рейтинг капитана на момент назначения
     */
    static async addMember(teamId, userId, participantId, isCaptain = false, captainRating = null) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Если назначаем нового капитана, убираем флаг у предыдущего
            if (isCaptain) {
                await client.query(
                    'UPDATE tournament_team_members SET is_captain = FALSE WHERE team_id = $1',
                    [teamId]
                );
            }
            
            const result = await client.query(
                `INSERT INTO tournament_team_members (team_id, user_id, participant_id, is_captain, captain_rating)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [teamId, userId, participantId, isCaptain, captainRating]
            );
            
            await client.query('COMMIT');
            console.log(`✅ TeamRepository: Добавлен участник ${userId} в команду ${teamId}${isCaptain ? ' (капитан)' : ''}`);
            return result.rows[0];
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ TeamRepository: Ошибка добавления участника в команду:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 🆕 Назначение капитана команды
     * @param {number} teamId - ID команды
     * @param {number} userId - ID пользователя для назначения капитаном
     * @param {number} captainRating - Рейтинг нового капитана
     */
    static async setCaptain(teamId, userId, captainRating = null) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Проверяем что пользователь является участником команды
            const memberCheck = await client.query(
                'SELECT id FROM tournament_team_members WHERE team_id = $1 AND user_id = $2',
                [teamId, userId]
            );
            
            if (memberCheck.rows.length === 0) {
                throw new Error('Пользователь не является участником команды');
            }
            
            // Убираем капитанство у всех участников команды
            await client.query(
                'UPDATE tournament_team_members SET is_captain = FALSE WHERE team_id = $1',
                [teamId]
            );
            
            // Назначаем нового капитана
            const result = await client.query(
                `UPDATE tournament_team_members 
                 SET is_captain = TRUE, captain_rating = $3
                 WHERE team_id = $1 AND user_id = $2 
                 RETURNING *`,
                [teamId, userId, captainRating]
            );
            
            await client.query('COMMIT');
            console.log(`✅ TeamRepository: Назначен новый капитан ${userId} для команды ${teamId}`);
            return result.rows[0];
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ TeamRepository: Ошибка назначения капитана:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 🆕 Получение информации о капитане команды
     * @param {number} teamId - ID команды
     */
    static async getTeamCaptain(teamId) {
        const result = await pool.query(`
            SELECT 
                ttm.*,
                u.username,
                u.avatar_url,
                tp.name as participant_name,
                tp.faceit_elo,
                tp.cs2_premier_rank,
                u.faceit_elo as user_faceit_elo,
                u.cs2_premier_rank as user_cs2_premier_rank
            FROM tournament_team_members ttm
            LEFT JOIN users u ON ttm.user_id = u.id
            LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
            WHERE ttm.team_id = $1 AND ttm.is_captain = TRUE
        `, [teamId]);
        
        return result.rows[0] || null;
    }

    /**
     * 🆕 Автоматическое назначение капитана по наивысшему рейтингу
     * @param {number} teamId - ID команды
     * @param {string} ratingType - Тип рейтинга ('faceit' или 'premier')
     */
    static async autoAssignCaptain(teamId, ratingType = 'faceit') {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Определяем приоритет полей рейтинга в зависимости от типа
            let orderBy = '';
            if (ratingType === 'faceit') {
                orderBy = `
                    COALESCE(tp.faceit_elo, u.faceit_elo, 1000) DESC,
                    ttm.created_at ASC
                `;
            } else {
                orderBy = `
                    COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank, 5) DESC,
                    ttm.created_at ASC
                `;
            }
            
            // Находим участника с наивысшим рейтингом
            const result = await client.query(`
                SELECT 
                    ttm.*,
                    COALESCE(tp.faceit_elo, u.faceit_elo, 1000) as faceit_rating,
                    COALESCE(tp.cs2_premier_rank, u.cs2_premier_rank, 5) as premier_rating
                FROM tournament_team_members ttm
                LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                LEFT JOIN users u ON ttm.user_id = u.id
                WHERE ttm.team_id = $1
                ORDER BY ${orderBy}
                LIMIT 1
            `, [teamId]);
            
            if (result.rows.length === 0) {
                throw new Error('В команде нет участников для назначения капитаном');
            }
            
            const newCaptain = result.rows[0];
            const captainRating = ratingType === 'faceit' ? newCaptain.faceit_rating : newCaptain.premier_rating;
            
            // Убираем капитанство у всех
            await client.query(
                'UPDATE tournament_team_members SET is_captain = FALSE WHERE team_id = $1',
                [teamId]
            );
            
            // Назначаем нового капитана
            await client.query(
                'UPDATE tournament_team_members SET is_captain = TRUE, captain_rating = $2 WHERE id = $1',
                [newCaptain.id, captainRating]
            );
            
            await client.query('COMMIT');
            console.log(`✅ TeamRepository: Автоназначен капитан ${newCaptain.user_id} для команды ${teamId} (рейтинг: ${captainRating})`);
            
            return await this.getTeamCaptain(teamId);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ TeamRepository: Ошибка автоназначения капитана:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 🆕 Проверка является ли пользователь капитаном команды
     * @param {number} teamId - ID команды
     * @param {number} userId - ID пользователя
     */
    static async isUserCaptain(teamId, userId) {
        const result = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM tournament_team_members WHERE team_id = $1 AND user_id = $2 AND is_captain = TRUE) as is_captain',
            [teamId, userId]
        );
        
        return result.rows[0].is_captain;
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
     * 🔧 Получение участников команды (обновлено для поддержки капитанов)
     */
    static async getMembers(teamId) {
        const result = await pool.query(`
            SELECT 
                ttm.*,
                u.username,
                u.avatar_url,
                tp.name as participant_name,
                tp.faceit_elo,
                tp.cs2_premier_rank,
                u.faceit_elo as user_faceit_elo,
                u.cs2_premier_rank as user_cs2_premier_rank
            FROM tournament_team_members ttm
            LEFT JOIN users u ON ttm.user_id = u.id
            LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
            WHERE ttm.team_id = $1
            ORDER BY ttm.is_captain DESC, ttm.created_at ASC
        `, [teamId]);

        return result.rows;
    }

    /**
     * Удаление участника из команды
     */
    static async removeMember(teamId, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Проверяем был ли удаляемый участник капитаном
            const memberInfo = await client.query(
                'SELECT is_captain FROM tournament_team_members WHERE team_id = $1 AND user_id = $2',
                [teamId, userId]
            );
            
            const wasCaptain = memberInfo.rows[0]?.is_captain || false;
            
            // Удаляем участника
            const result = await client.query(
                'DELETE FROM tournament_team_members WHERE team_id = $1 AND user_id = $2 RETURNING *',
                [teamId, userId]
            );
            
            // Если удаленный участник был капитаном, автоматически назначаем нового
            if (wasCaptain) {
                const remainingMembers = await client.query(
                    'SELECT COUNT(*) as count FROM tournament_team_members WHERE team_id = $1',
                    [teamId]
                );
                
                if (parseInt(remainingMembers.rows[0].count) > 0) {
                    // Назначаем нового капитана из оставшихся участников
                    await client.query(`
                        UPDATE tournament_team_members 
                        SET is_captain = TRUE 
                        WHERE team_id = $1 
                        AND id = (
                            SELECT ttm.id 
                            FROM tournament_team_members ttm
                            LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                            LEFT JOIN users u ON ttm.user_id = u.id
                            WHERE ttm.team_id = $1
                            ORDER BY 
                                COALESCE(tp.faceit_elo, u.faceit_elo, 1000) DESC,
                                ttm.created_at ASC
                            LIMIT 1
                        )
                    `, [teamId]);
                    
                    console.log(`🔄 TeamRepository: Автоназначен новый капитан после удаления капитана из команды ${teamId}`);
                }
            }
            
            await client.query('COMMIT');
            console.log(`✅ TeamRepository: Удален участник ${userId} из команды ${teamId}`);
            return result.rows[0] || null;
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ TeamRepository: Ошибка удаления участника из команды:`, error);
            throw error;
        } finally {
            client.release();
        }
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
     * 🔧 Получение всех команд турнира с участниками (обновлено для поддержки капитанов)
     */
    static async getByTournamentId(tournamentId) {
        console.log(`🔍 TeamRepository: Получение команд турнира ${tournamentId} с капитанами`);
        
        try {
            const result = await pool.query(`
                SELECT 
                    tt.*,
                    
                    -- Информация о капитане
                    captain.user_id as captain_user_id,
                    captain.participant_id as captain_participant_id,
                    captain.captain_rating,
                    captain_user.username as captain_username,
                    captain_user.avatar_url as captain_avatar_url,
                    captain_participant.name as captain_name,
                    
                    -- Участники команды
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', ttm.id,
                                'user_id', ttm.user_id,
                                'participant_id', ttm.participant_id,
                                'is_captain', ttm.is_captain,
                                'captain_rating', ttm.captain_rating,
                                'username', u.username,
                                'avatar_url', u.avatar_url,
                                'name', COALESCE(tp.name, u.username),
                                'faceit_elo', tp.faceit_elo,
                                'cs2_premier_rank', tp.cs2_premier_rank,
                                'user_faceit_elo', u.faceit_elo,
                                'user_cs2_premier_rank', u.cs2_premier_rank,
                                'faceit_rating', tp.faceit_elo,
                                'premier_rating', tp.cs2_premier_rank,
                                'user_faceit_rating', u.faceit_elo,
                                'user_premier_rating', u.cs2_premier_rank
                            ) ORDER BY ttm.is_captain DESC, ttm.created_at ASC
                        ) FILTER (WHERE ttm.id IS NOT NULL), 
                        '[]'
                    ) as members
                    
                FROM tournament_teams tt
                
                -- JOIN с участниками команды
                LEFT JOIN tournament_team_members ttm ON tt.id = ttm.team_id
                LEFT JOIN users u ON ttm.user_id = u.id
                LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                
                -- JOIN с капитаном команды
                LEFT JOIN tournament_team_members captain ON (
                    tt.id = captain.team_id AND captain.is_captain = TRUE
                )
                LEFT JOIN users captain_user ON captain.user_id = captain_user.id
                LEFT JOIN tournament_participants captain_participant ON captain.participant_id = captain_participant.id
                
                WHERE tt.tournament_id = $1
                GROUP BY 
                    tt.id, 
                    captain.user_id, captain.participant_id, captain.captain_rating,
                    captain_user.username, captain_user.avatar_url,
                    captain_participant.name
                ORDER BY tt.id
            `, [tournamentId]);
            
            console.log(`✅ TeamRepository: Найдено ${result.rows.length} команд для турнира ${tournamentId}`);
            return result.rows;
            
        } catch (error) {
            console.error(`❌ TeamRepository: Ошибка получения команд турнира ${tournamentId}:`, error);
            throw error;
        }
    }

    /**
     * 🆕 Получение статистики капитанов турнира
     * @param {number} tournamentId - ID турнира
     */
    static async getCaptainStats(tournamentId) {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_captains,
                ROUND(AVG(ttm.captain_rating)) as average_captain_rating,
                MAX(ttm.captain_rating) as highest_captain_rating,
                MIN(ttm.captain_rating) as lowest_captain_rating
            FROM tournament_teams tt
            JOIN tournament_team_members ttm ON tt.id = ttm.team_id
            WHERE tt.tournament_id = $1 AND ttm.is_captain = TRUE
        `, [tournamentId]);
        
        return result.rows[0];
    }

    /**
     * 🆕 Массовое назначение капитанов для существующих команд турнира
     * @param {number} tournamentId - ID турнира
     * @param {string} ratingType - Тип рейтинга для определения капитана
     */
    static async assignCaptainsForExistingTeams(tournamentId, ratingType = 'faceit') {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Получаем все команды турнира без капитанов
            const teams = await client.query(`
                SELECT tt.id as team_id
                FROM tournament_teams tt
                LEFT JOIN tournament_team_members captain ON (
                    tt.id = captain.team_id AND captain.is_captain = TRUE
                )
                WHERE tt.tournament_id = $1 AND captain.id IS NULL
            `, [tournamentId]);
            
            let assignedCount = 0;
            
            // Назначаем капитанов для каждой команды
            for (const team of teams.rows) {
                try {
                    await this.autoAssignCaptain(team.team_id, ratingType);
                    assignedCount++;
                } catch (error) {
                    console.warn(`⚠️ Не удалось назначить капитана для команды ${team.team_id}:`, error.message);
                }
            }
            
            await client.query('COMMIT');
            console.log(`✅ TeamRepository: Назначено ${assignedCount} капитанов для турнира ${tournamentId}`);
            
            return {
                total_teams: teams.rows.length,
                assigned_captains: assignedCount
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ TeamRepository: Ошибка массового назначения капитанов:`, error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = TeamRepository; 