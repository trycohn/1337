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
     * 🆕 НАЗНАЧЕНИЕ КАПИТАНА КОМАНДЫ
     * @param {number} teamId - ID команды
     * @param {number} userId - ID пользователя, который станет капитаном
     * @param {number} captainRating - Рейтинг капитана (опционально, будет рассчитан автоматически)
     * @returns {Object} Информация о назначенном капитане
     */
    static async setCaptain(teamId, userId, captainRating = null) {
        console.log(`👑 [TeamRepository] Назначение капитана команды ${teamId}, пользователь ${userId}`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 🔧 ИСПРАВЛЕНО: Получаем полную информацию об участнике с приоритизацией ручных рейтингов
            const memberResult = await client.query(`
                SELECT 
                    ttm.id,
                    ttm.user_id,
                    ttm.participant_id,
                    u.username,
                    -- 🆕 РУЧНЫЕ РЕЙТИНГИ УЧАСТНИКА (приоритет)
                    tp.faceit_elo,
                    tp.cs2_premier_rank,
                    -- 🆕 РЕЙТИНГИ ПОЛЬЗОВАТЕЛЯ (резерв)
                    u.faceit_elo as user_faceit_elo,
                    u.cs2_premier_rank as user_premier_rank,
                    -- 🆕 ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ ДЛЯ СОВМЕСТИМОСТИ
                    tp.name as participant_name,
                    u.email as user_email
                FROM tournament_team_members ttm
                LEFT JOIN users u ON ttm.user_id = u.id  
                LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                WHERE ttm.team_id = $1 AND ttm.user_id = $2
            `, [teamId, userId]);
            
            if (memberResult.rows.length === 0) {
                throw new Error('Пользователь не является участником этой команды');
            }
            
            const member = memberResult.rows[0];
            
            // 🔧 ИСПРАВЛЕНО: Если рейтинг не передан, рассчитываем его с приоритизацией ручных рейтингов
            let finalCaptainRating = captainRating;
            if (finalCaptainRating === null) {
                // Получаем турнир для определения типа рейтинга
                const tournamentResult = await client.query(`
                    SELECT mix_rating_type 
                    FROM tournaments t
                    JOIN tournament_teams tt ON t.id = tt.tournament_id
                    WHERE tt.id = $1
                `, [teamId]);
                
                const ratingType = tournamentResult.rows[0]?.mix_rating_type || 'faceit';
                
                // 🆕 ИСПОЛЬЗУЕМ ПРИОРИТИЗАЦИЮ РУЧНЫХ РЕЙТИНГОВ
                if (ratingType === 'faceit') {
                    // ПРИОРИТЕТ: ручной рейтинг участника → рейтинг пользователя → дефолт
                    if (member.faceit_elo && !isNaN(parseInt(member.faceit_elo)) && parseInt(member.faceit_elo) > 0) {
                        finalCaptainRating = parseInt(member.faceit_elo);
                    } else if (member.user_faceit_elo && !isNaN(parseInt(member.user_faceit_elo)) && parseInt(member.user_faceit_elo) > 0) {
                        finalCaptainRating = parseInt(member.user_faceit_elo);
                    } else {
                        finalCaptainRating = 1000; // дефолт для FACEIT
                    }
                } else {
                    // ПРИОРИТЕТ: ручной рейтинг участника → рейтинг пользователя → дефолт
                    if (member.cs2_premier_rank && !isNaN(parseInt(member.cs2_premier_rank)) && parseInt(member.cs2_premier_rank) > 0) {
                        finalCaptainRating = parseInt(member.cs2_premier_rank);
                    } else if (member.user_premier_rank && !isNaN(parseInt(member.user_premier_rank)) && parseInt(member.user_premier_rank) > 0) {
                        finalCaptainRating = parseInt(member.user_premier_rank);
                    } else {
                        finalCaptainRating = 5; // дефолт для Premier
                    }
                }
                
                console.log(`📊 [setCaptain] Рассчитан рейтинг капитана: ${finalCaptainRating} (тип: ${ratingType}), ручной: ${member.faceit_elo || member.cs2_premier_rank}, пользователь: ${member.user_faceit_elo || member.user_premier_rank}`);
            }
            
            // Снимаем статус капитана со всех участников команды
            await client.query(`
                UPDATE tournament_team_members 
                SET is_captain = FALSE, captain_rating = NULL 
                WHERE team_id = $1
            `, [teamId]);
            
            // Назначаем нового капитана
            await client.query(`
                UPDATE tournament_team_members 
                SET is_captain = TRUE, captain_rating = $1 
                WHERE team_id = $2 AND user_id = $3
            `, [finalCaptainRating, teamId, userId]);
            
            await client.query('COMMIT');
            
            const captainInfo = {
                team_id: teamId,
                user_id: userId,
                username: member.username,
                participant_name: member.participant_name,
                is_captain: true,
                captain_rating: finalCaptainRating,
                manual_rating_used: Boolean(member.faceit_elo || member.cs2_premier_rank) // 🆕 Флаг использования ручного рейтинга
            };
            
            console.log(`✅ [TeamRepository] Капитан назначен: ${member.username} (рейтинг: ${finalCaptainRating}, ручной: ${captainInfo.manual_rating_used})`);
            
            return captainInfo;
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [TeamRepository] Ошибка назначения капитана:`, error);
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
     * 🆕 АВТОМАТИЧЕСКОЕ НАЗНАЧЕНИЕ КАПИТАНА ПО РЕЙТИНГУ
     * @param {number} teamId - ID команды
     * @param {string} ratingType - Тип рейтинга ('faceit' или 'premier')
     * @returns {Object} Информация о назначенном капитане
     */
    static async autoAssignCaptain(teamId, ratingType = 'faceit') {
        console.log(`🎯 [TeamRepository] Автоназначение капитана для команды ${teamId} (тип рейтинга: ${ratingType})`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 🔧 ИСПРАВЛЕНО: Получаем всех участников команды с приоритизацией ручных рейтингов
            const membersResult = await client.query(`
                SELECT 
                    ttm.id,
                    ttm.user_id,
                    ttm.participant_id,
                    ttm.is_captain,
                    u.username,
                    -- 🆕 РУЧНЫЕ РЕЙТИНГИ УЧАСТНИКА (приоритет)
                    tp.faceit_elo,
                    tp.cs2_premier_rank,
                    -- 🆕 РЕЙТИНГИ ПОЛЬЗОВАТЕЛЯ (резерв)
                    u.faceit_elo as user_faceit_elo,
                    u.cs2_premier_rank as user_premier_rank,
                    -- 🆕 ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ
                    tp.name as participant_name,
                    u.email as user_email
                FROM tournament_team_members ttm
                LEFT JOIN users u ON ttm.user_id = u.id  
                LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                WHERE ttm.team_id = $1
                ORDER BY ttm.id
            `, [teamId]);
            
            if (membersResult.rows.length === 0) {
                throw new Error('В команде нет участников');
            }
            
            // 🔧 ИСПРАВЛЕНО: Находим участника с наивысшим рейтингом с приоритизацией ручных рейтингов
            let bestMember = null;
            let bestRating = -1;
            
            for (const member of membersResult.rows) {
                let rating = 0;
                let usedManualRating = false;
                
                if (ratingType === 'faceit') {
                    // 🆕 ПРИОРИТЕТ: ручной рейтинг участника → рейтинг пользователя → дефолт
                    if (member.faceit_elo && !isNaN(parseInt(member.faceit_elo)) && parseInt(member.faceit_elo) > 0) {
                        rating = parseInt(member.faceit_elo);
                        usedManualRating = true;
                    } else if (member.user_faceit_elo && !isNaN(parseInt(member.user_faceit_elo)) && parseInt(member.user_faceit_elo) > 0) {
                        rating = parseInt(member.user_faceit_elo);
                    } else {
                        rating = 1000; // дефолт для FACEIT
                    }
                } else {
                    // 🆕 ПРИОРИТЕТ: ручной рейтинг участника → рейтинг пользователя → дефолт
                    if (member.cs2_premier_rank && !isNaN(parseInt(member.cs2_premier_rank)) && parseInt(member.cs2_premier_rank) > 0) {
                        rating = parseInt(member.cs2_premier_rank);
                        usedManualRating = true;
                    } else if (member.user_premier_rank && !isNaN(parseInt(member.user_premier_rank)) && parseInt(member.user_premier_rank) > 0) {
                        rating = parseInt(member.user_premier_rank);
                    } else {
                        rating = 5; // дефолт для Premier
                    }
                }
                
                console.log(`📊 [autoAssignCaptain] Участник ${member.username}: рейтинг ${rating} (ручной: ${usedManualRating}), ручные значения: faceit_elo=${member.faceit_elo}, cs2_premier_rank=${member.cs2_premier_rank}`);
                
                if (rating > bestRating) {
                    bestRating = rating;
                    bestMember = member;
                    bestMember.usedManualRating = usedManualRating; // 🆕 Сохраняем флаг
                } else if (rating === bestRating) {
                    // 🔧 Тай-брейк: приоритет зарегистрированным пользователям; иначе случайный выбор
                    const candidateRegistered = !!member.user_id;
                    const currentRegistered = !!(bestMember && bestMember.user_id);
                    if (candidateRegistered && !currentRegistered) {
                        bestMember = member;
                        bestMember.usedManualRating = usedManualRating;
                    } else if (candidateRegistered === currentRegistered) {
                        // Случайно выбираем одного из равных по рейтингу
                        if (Math.random() < 0.5) {
                            bestMember = member;
                            bestMember.usedManualRating = usedManualRating;
                        }
                    }
                }
            }
            
            if (!bestMember) {
                throw new Error('Не удалось найти подходящего кандидата на роль капитана');
            }
            
            // Снимаем статус капитана со всех участников команды
            await client.query(`
                UPDATE tournament_team_members 
                SET is_captain = FALSE, captain_rating = NULL 
                WHERE team_id = $1
            `, [teamId]);
            
            // Назначаем нового капитана
            await client.query(`
                UPDATE tournament_team_members 
                SET is_captain = TRUE, captain_rating = $1 
                WHERE team_id = $2 AND user_id = $3
            `, [bestRating, teamId, bestMember.user_id]);
            
            await client.query('COMMIT');
            
            const captainInfo = {
                team_id: teamId,
                user_id: bestMember.user_id,
                username: bestMember.username,
                participant_name: bestMember.participant_name,
                is_captain: true,
                captain_rating: bestRating,
                manual_rating_used: bestMember.usedManualRating, // 🆕 Флаг использования ручного рейтинга
                rating_type: ratingType
            };
            
            console.log(`✅ [TeamRepository] Автокапитан назначен: ${bestMember.username} (рейтинг: ${bestRating}, ручной: ${bestMember.usedManualRating})`);
            
            return captainInfo;
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [TeamRepository] Ошибка автоназначения капитана:`, error);
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
            ORDER BY ttm.is_captain DESC, tp.created_at ASC
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
                                tp.created_at ASC
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
                            ) ORDER BY ttm.is_captain DESC, tp.created_at ASC
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
     * Удаление одной команды по ID
     * @param {number} teamId - ID команды
     * @returns {Object} Удаленная команда
     */
    static async deleteById(teamId) {
        console.log(`🗑️ TeamRepository: Удаление команды ${teamId}`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Сначала удаляем участников команды
            await client.query(
                'DELETE FROM tournament_team_members WHERE team_id = $1',
                [teamId]
            );
            
            // Затем удаляем саму команду
            const result = await client.query(
                'DELETE FROM tournament_teams WHERE id = $1 RETURNING *',
                [teamId]
            );
            
            await client.query('COMMIT');
            
            console.log(`✅ TeamRepository: Команда ${teamId} удалена успешно`);
            return result.rows[0] || null;
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ TeamRepository: Ошибка удаления команды ${teamId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 🆕 МАССОВОЕ НАЗНАЧЕНИЕ КАПИТАНОВ ДЛЯ СУЩЕСТВУЮЩИХ КОМАНД
     * @param {number} tournamentId - ID турнира
     * @param {string} ratingType - Тип рейтинга ('faceit' или 'premier')
     * @returns {Object} Статистика назначения
     */
    static async assignCaptainsForExistingTeams(tournamentId, ratingType = 'faceit') {
        console.log(`👑 [TeamRepository] Массовое назначение капитанов для турнира ${tournamentId} (тип рейтинга: ${ratingType})`);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Получаем все команды турнира без капитанов
            const teamsResult = await client.query(`
                SELECT DISTINCT tt.id, tt.name
                FROM tournament_teams tt
                WHERE tt.tournament_id = $1
                AND NOT EXISTS (
                    SELECT 1 FROM tournament_team_members ttm 
                    WHERE ttm.team_id = tt.id AND ttm.is_captain = TRUE
                )
                ORDER BY tt.id
            `, [tournamentId]);
            
            let assignedCount = 0;
            const results = [];
            
            for (const team of teamsResult.rows) {
                try {
                    // 🔧 ИСПРАВЛЕНО: Получаем участников с приоритизацией ручных рейтингов
                    const membersResult = await client.query(`
                        SELECT 
                            ttm.id,
                            ttm.user_id,
                            ttm.participant_id,
                            u.username,
                            -- 🆕 РУЧНЫЕ РЕЙТИНГИ УЧАСТНИКА (приоритет)
                            tp.faceit_elo,
                            tp.cs2_premier_rank,
                            -- 🆕 РЕЙТИНГИ ПОЛЬЗОВАТЕЛЯ (резерв)
                            u.faceit_elo as user_faceit_elo,
                            u.cs2_premier_rank as user_premier_rank,
                            tp.name as participant_name
                        FROM tournament_team_members ttm
                        LEFT JOIN users u ON ttm.user_id = u.id  
                        LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                        WHERE ttm.team_id = $1
                    `, [team.id]);
                    
                    if (membersResult.rows.length === 0) {
                        console.log(`⚠️ [assignCaptainsForExistingTeams] Команда ${team.name} пуста, пропускаем`);
                        continue;
                    }
                    
                    // 🔧 ИСПРАВЛЕНО: Находим лучшего кандидата с приоритизацией ручных рейтингов
                    let bestMember = null;
                    let bestRating = -1;
                    
                    for (const member of membersResult.rows) {
                        let rating = 0;
                        let usedManualRating = false;
                        
                        if (ratingType === 'faceit') {
                            // 🆕 ПРИОРИТЕТ: ручной рейтинг участника → рейтинг пользователя → дефолт
                            if (member.faceit_elo && !isNaN(parseInt(member.faceit_elo)) && parseInt(member.faceit_elo) > 0) {
                                rating = parseInt(member.faceit_elo);
                                usedManualRating = true;
                            } else if (member.user_faceit_elo && !isNaN(parseInt(member.user_faceit_elo)) && parseInt(member.user_faceit_elo) > 0) {
                                rating = parseInt(member.user_faceit_elo);
                            } else {
                                rating = 1000;
                            }
                        } else {
                            // 🆕 ПРИОРИТЕТ: ручной рейтинг участника → рейтинг пользователя → дефолт
                            if (member.cs2_premier_rank && !isNaN(parseInt(member.cs2_premier_rank)) && parseInt(member.cs2_premier_rank) > 0) {
                                rating = parseInt(member.cs2_premier_rank);
                                usedManualRating = true;
                            } else if (member.user_premier_rank && !isNaN(parseInt(member.user_premier_rank)) && parseInt(member.user_premier_rank) > 0) {
                                rating = parseInt(member.user_premier_rank);
                            } else {
                                rating = 5;
                            }
                        }
                        
                        if (rating > bestRating) {
                            bestRating = rating;
                            bestMember = member;
                            bestMember.usedManualRating = usedManualRating;
                        } else if (rating === bestRating) {
                            // 🔧 Тай-брейк: приоритет зарегистрированным пользователям; иначе случайный выбор
                            const candidateRegistered = !!member.user_id;
                            const currentRegistered = !!(bestMember && bestMember.user_id);
                            if (candidateRegistered && !currentRegistered) {
                                bestMember = member;
                                bestMember.usedManualRating = usedManualRating;
                            } else if (candidateRegistered === currentRegistered) {
                                if (Math.random() < 0.5) {
                                    bestMember = member;
                                    bestMember.usedManualRating = usedManualRating;
                                }
                            }
                        }
                    }
                    
                    if (bestMember) {
                        // Назначаем капитана
                        await client.query(`
                            UPDATE tournament_team_members 
                            SET is_captain = TRUE, captain_rating = $1 
                            WHERE team_id = $2 AND user_id = $3
                        `, [bestRating, team.id, bestMember.user_id]);
                        
                        assignedCount++;
                        results.push({
                            team_id: team.id,
                            team_name: team.name,
                            captain_username: bestMember.username,
                            captain_rating: bestRating,
                            manual_rating_used: bestMember.usedManualRating
                        });
                        
                        console.log(`✅ [assignCaptainsForExistingTeams] Команда "${team.name}": капитан ${bestMember.username} (рейтинг: ${bestRating}, ручной: ${bestMember.usedManualRating})`);
                    }
                    
                } catch (error) {
                    console.error(`❌ [assignCaptainsForExistingTeams] Ошибка для команды ${team.name}:`, error);
                }
            }
            
            await client.query('COMMIT');
            
            const stats = {
                total_teams: teamsResult.rows.length,
                assigned_captains: assignedCount,
                success_rate: teamsResult.rows.length > 0 ? Math.round((assignedCount / teamsResult.rows.length) * 100) : 0,
                results: results,
                manual_ratings_used: results.filter(r => r.manual_rating_used).length // 🆕 Количество капитанов с ручными рейтингами
            };
            
            console.log(`🎉 [assignCaptainsForExistingTeams] Завершено: ${assignedCount}/${teamsResult.rows.length} капитанов назначено, из них ${stats.manual_ratings_used} с ручными рейтингами`);
            
            return stats;
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [assignCaptainsForExistingTeams] Критическая ошибка:`, error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = TeamRepository; 