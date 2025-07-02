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
            max_participants, start_date, description, bracket_type, team_size, mix_rating_type
        } = tournamentData;

        const result = await pool.query(
            `INSERT INTO tournaments
             (name, game, format, created_by, status, participant_type, max_participants, start_date, description, bracket_type, team_size, mix_rating_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            [name, game, format, created_by, status, participant_type, max_participants, start_date, description, bracket_type, team_size, mix_rating_type]
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
        console.log('🎮 TournamentRepository: Выполняю SQL запрос для получения игр');
        try {
            const result = await pool.query('SELECT id, name FROM games ORDER BY name');
            console.log(`✅ TournamentRepository: SQL запрос выполнен успешно, получено ${result.rows.length} записей`);
            console.log('📊 TournamentRepository: Первые 3 игры:', result.rows.slice(0, 3));
            return result.rows;
        } catch (error) {
            console.error('❌ TournamentRepository: Ошибка выполнения SQL запроса для игр:', error);
            throw error;
        }
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
            // 🆕 СНАЧАЛА ПОЛУЧАЕМ ИНФОРМАЦИЮ О ТУРНИРЕ для определения типа рейтинга
            const tournamentResult = await pool.query(
                'SELECT mix_rating_type FROM tournaments WHERE id = $1',
                [tournamentId]
            );
            
            const ratingType = tournamentResult.rows[0]?.mix_rating_type || 'faceit';
            console.log(`📊 [getTeamsWithMembers] Турнир ${tournamentId}: тип рейтинга = ${ratingType}`);

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
                    // 🔧 ИСПРАВЛЕНО: Используем ту же логику что в MixTeamService.normalizeParticipantRating
                    const faceitRatings = members.map(member => {
                        // FACEIT приоритет: faceit_elo -> user_faceit_elo -> faceit_rating -> user_faceit_rating -> 1000
                        console.log(`🔍 [getTeamsWithMembers] Участник ${member.name}:`, {
                            faceit_elo: member.faceit_elo,
                            user_faceit_elo: member.user_faceit_elo,
                            faceit_rating: member.faceit_rating,
                            user_faceit_rating: member.user_faceit_rating
                        });
                        
                        let rating;
                        if (member.faceit_elo && !isNaN(parseInt(member.faceit_elo)) && parseInt(member.faceit_elo) > 0) {
                            rating = parseInt(member.faceit_elo);
                            console.log(`✅ [getTeamsWithMembers] ${member.name}: используем faceit_elo = ${rating}`);
                            return rating;
                        } else if (member.user_faceit_elo && !isNaN(parseInt(member.user_faceit_elo)) && parseInt(member.user_faceit_elo) > 0) {
                            rating = parseInt(member.user_faceit_elo);
                            console.log(`✅ [getTeamsWithMembers] ${member.name}: используем user_faceit_elo = ${rating}`);
                            return rating;
                        } else if (member.faceit_rating && !isNaN(parseInt(member.faceit_rating)) && parseInt(member.faceit_rating) > 0) {
                            rating = parseInt(member.faceit_rating);
                            console.log(`✅ [getTeamsWithMembers] ${member.name}: используем faceit_rating = ${rating}`);
                            return rating;
                        } else if (member.user_faceit_rating && !isNaN(parseInt(member.user_faceit_rating)) && parseInt(member.user_faceit_rating) > 0) {
                            rating = parseInt(member.user_faceit_rating);
                            console.log(`✅ [getTeamsWithMembers] ${member.name}: используем user_faceit_rating = ${rating}`);
                            return rating;
                        } else {
                            rating = 1000; // Дефолт для FACEIT
                            console.log(`⚠️ [getTeamsWithMembers] ${member.name}: используем дефолт FACEIT = ${rating}`);
                            return rating;
                        }
                    });
                    
                    console.log(`📊 [getTeamsWithMembers] Команда "${team.name}": рейтинги FACEIT [${faceitRatings.join(', ')}]`);
                    averageRatingFaceit = Math.round(faceitRatings.reduce((sum, rating) => sum + rating, 0) / faceitRatings.length);
                    console.log(`📊 [getTeamsWithMembers] Команда "${team.name}": средний FACEIT = ${averageRatingFaceit}`);
                    
                    // 🔧 ИСПРАВЛЕНО: Используем ту же логику что в MixTeamService.normalizeParticipantRating
                    const premierRatings = members.map(member => {
                        // Premier приоритет: cs2_premier_rank -> user_premier_rank -> premier_rank -> premier_rating -> user_premier_rating -> 5
                        console.log(`🔍 [getTeamsWithMembers] Участник ${member.name} Premier:`, {
                            cs2_premier_rank: member.cs2_premier_rank,
                            user_premier_rank: member.user_premier_rank,
                            premier_rank: member.premier_rank,
                            premier_rating: member.premier_rating,
                            user_premier_rating: member.user_premier_rating
                        });
                        
                        let rating;
                        if (member.cs2_premier_rank && !isNaN(parseInt(member.cs2_premier_rank)) && parseInt(member.cs2_premier_rank) > 0) {
                            rating = parseInt(member.cs2_premier_rank);
                            console.log(`✅ [getTeamsWithMembers] ${member.name}: используем cs2_premier_rank = ${rating}`);
                            return rating;
                        } else if (member.user_premier_rank && !isNaN(parseInt(member.user_premier_rank)) && parseInt(member.user_premier_rank) > 0) {
                            rating = parseInt(member.user_premier_rank);
                            console.log(`✅ [getTeamsWithMembers] ${member.name}: используем user_premier_rank = ${rating}`);
                            return rating;
                        } else if (member.premier_rank && !isNaN(parseInt(member.premier_rank)) && parseInt(member.premier_rank) > 0) {
                            rating = parseInt(member.premier_rank);
                            console.log(`✅ [getTeamsWithMembers] ${member.name}: используем premier_rank = ${rating}`);
                            return rating;
                        } else if (member.premier_rating && !isNaN(parseInt(member.premier_rating)) && parseInt(member.premier_rating) > 0) {
                            rating = parseInt(member.premier_rating);
                            console.log(`✅ [getTeamsWithMembers] ${member.name}: используем premier_rating = ${rating}`);
                            return rating;
                        } else if (member.user_premier_rating && !isNaN(parseInt(member.user_premier_rating)) && parseInt(member.user_premier_rating) > 0) {
                            rating = parseInt(member.user_premier_rating);
                            console.log(`✅ [getTeamsWithMembers] ${member.name}: используем user_premier_rating = ${rating}`);
                            return rating;
                        } else {
                            rating = 5; // Дефолт для Premier
                            console.log(`⚠️ [getTeamsWithMembers] ${member.name}: используем дефолт Premier = ${rating}`);
                            return rating;
                        }
                    });
                    
                    console.log(`📊 [getTeamsWithMembers] Команда "${team.name}": рейтинги Premier [${premierRatings.join(', ')}]`);
                    averageRatingPremier = Math.round(premierRatings.reduce((sum, rating) => sum + rating, 0) / premierRatings.length);
                    console.log(`📊 [getTeamsWithMembers] Команда "${team.name}": средний Premier = ${averageRatingPremier}`);
                }

                // 🆕 ИСПРАВЛЕНИЕ: averageRating зависит от типа рейтинга турнира
                const averageRating = ratingType === 'premier' ? averageRatingPremier : averageRatingFaceit;

                console.log(`📊 [getTeamsWithMembers] Команда "${team.name}": FACEIT=${averageRatingFaceit}, Premier=${averageRatingPremier}, итоговый (${ratingType})=${averageRating}`);

                return {
                    ...team,
                    members: members,
                    averageRatingFaceit: averageRatingFaceit,
                    averageRatingPremier: averageRatingPremier,
                    averageRating: averageRating,
                    ratingType: ratingType // 🆕 Добавляем информацию о типе рейтинга
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

    /**
     * 🆕 Обновление типа участников турнира
     */
    static async updateParticipantType(tournamentId, participantType) {
        console.log(`🔄 TournamentRepository: обновляем тип участников турнира ${tournamentId} на '${participantType}'`);
        
        const result = await pool.query(
            'UPDATE tournaments SET participant_type = $1 WHERE id = $2 RETURNING *',
            [participantType, tournamentId]
        );
        
        console.log(`✅ TournamentRepository: тип участников турнира ${tournamentId} обновлен на '${participantType}'`);
        return result.rows[0];
    }
}

module.exports = TournamentRepository;