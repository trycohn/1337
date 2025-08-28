const pool = require('../../db');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const MatchRepository = require('../../repositories/tournament/MatchRepository');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const ChatService = require('../tournament/ChatService');
const MatchLobbyService = require('../matchLobby/MatchLobbyService');
const { logTournamentEvent, logAdvancement } = require('./TournamentLogService');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');

class TournamentService {
    /**
     * Получение всех турниров с количеством участников
     */
    static async getAllTournaments() {
        console.log('🔍 TournamentService: Получение всех турниров');
        return await TournamentRepository.getAllWithParticipantCount();
    }

    /**
     * Получение турнира по ID с полной информацией
     */
    static async getTournamentById(tournamentId) {
        const startTime = Date.now();
        console.log(`🔍 [TournamentService] Получение турнира ${tournamentId}`);

        try {
            // Получаем основную информацию о турнире
            const tournament = await TournamentRepository.getByIdWithCreator(tournamentId);
            if (!tournament) {
                return null;
            }
            console.log(`🏆 [getTournamentById] Турнир ${tournamentId}: ${tournament.name}, формат: ${tournament.format}, статус: ${tournament.status}`);

            // Получаем администраторов
            const admins = await TournamentRepository.getAdmins(tournamentId);
            console.log(`👥 [getTournamentById] Турнир ${tournamentId}: найдено ${admins.length} администраторов`);

            // Получаем участников
            const participants = await ParticipantRepository.getByTournamentId(tournamentId);
            console.log(`🎯 [getTournamentById] Турнир ${tournamentId}: найдено ${participants.length} участников`);

            // Получаем матчи
            const matches = await MatchRepository.getByTournamentId(tournamentId);
            console.log(`⚔️ [getTournamentById] Турнир ${tournamentId}: найдено ${matches.length} матчей`);
            
            // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА ДЛЯ МИКС ТУРНИРОВ
            if (tournament.format === 'mix') {
                console.log(`🧩 [getTournamentById] МИКС ТУРНИР ${tournamentId} - детальная диагностика:`);
                console.log(`   📊 Участников: ${participants.length}`);
                console.log(`   ⚔️ Матчей в базе: ${matches.length}`);
                
                if (matches.length > 0) {
                    console.log(`   🎯 Первый матч:`, {
                        id: matches[0].id,
                        team1_id: matches[0].team1_id,
                        team2_id: matches[0].team2_id,
                        round: matches[0].round,
                        bracket_type: matches[0].bracket_type
                    });
                    console.log(`   🎯 Последний матч:`, {
                        id: matches[matches.length - 1].id,
                        team1_id: matches[matches.length - 1].team1_id,
                        team2_id: matches[matches.length - 1].team2_id,
                        round: matches[matches.length - 1].round,
                        bracket_type: matches[matches.length - 1].bracket_type
                    });
                }
            }

            // Получаем команды для командных турниров
            let teams = [];
            if (tournament.format === 'mix' || tournament.participant_type === 'team') {
                teams = await TournamentRepository.getTeamsWithMembers(tournamentId);
                console.log(`🏆 [getTournamentById] Турнир ${tournamentId}: найдено ${teams.length} команд`);
                
                // 🔍 ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА ДЛЯ КОМАНД
                if (tournament.format === 'mix' && teams.length > 0) {
                    console.log(`   🧩 Первая команда:`, {
                        id: teams[0].id,
                        name: teams[0].name,
                        members_count: teams[0].members ? teams[0].members.length : 0
                    });
                }
            }

            const result = {
                ...tournament,
                creator_name: tournament.creator_username,
                creator_avatar_url: tournament.creator_avatar_url,
                participants: participants,
                participant_count: participants.length,
                matches: matches,
                teams: teams,
                mixed_teams: teams,
                admins: admins
            };

            const endTime = Date.now();
            console.log(`✅ [TournamentService] Турнир ${tournamentId} получен за ${endTime - startTime}ms`);
            console.log(`📋 [getTournamentById] Итоговые данные турнира ${tournamentId}:`, {
                name: result.name,
                format: result.format,
                status: result.status,
                participants_count: result.participants.length,
                matches_count: result.matches.length,
                teams_count: result.teams.length,
                admins_count: result.admins.length
            });
            
            // 🔍 ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА ВОЗВРАЩАЕМЫХ МАТЧЕЙ
            console.log(`🔍 [getTournamentById] ДЕТАЛЬНАЯ ПРОВЕРКА МАТЧЕЙ для турнира ${tournamentId}:`);
            console.log(`   📊 result.matches is Array: ${Array.isArray(result.matches)}`);
            console.log(`   📊 result.matches length: ${result.matches ? result.matches.length : 'undefined'}`);
            if (result.matches && result.matches.length > 0) {
                console.log(`   🎯 Первый матч в result:`, {
                    id: result.matches[0].id,
                    tournament_id: result.matches[0].tournament_id,
                    team1_id: result.matches[0].team1_id,
                    team2_id: result.matches[0].team2_id,
                    round: result.matches[0].round
                });
            } else {
                console.log(`   ⚠️ result.matches пустой или undefined!`);
            }

            return result;

        } catch (error) {
            console.error(`❌ [TournamentService] Ошибка получения турнира ${tournamentId}:`, error);
            throw error;
        }
    }

    /**
     * Создание нового турнира
     */
    static async createTournament(tournamentData, userId) {
        console.log('➕ TournamentService: Создание турнира', tournamentData);

        const {
            name, game, format, participant_type, max_participants,
            start_date, description, bracket_type, team_size, mix_rating_type,
            lobby_enabled, lobby_match_format, selected_maps, full_double_elimination,
            require_faceit_linked, require_steam_linked,
            is_series_final
        } = tournamentData;

        const tournament = await TournamentRepository.create({
            name,
            game,
            format,
            created_by: userId,
            status: 'active',
            participant_type,
            max_participants: max_participants || null,
            start_date: start_date || null,
            description: description || null,
            bracket_type: bracket_type || 'single_elimination', // 🔧 ИСПРАВЛЕНО: устанавливаем single_elimination по умолчанию
            team_size: team_size || 1,
            mix_rating_type: (format === 'mix' && mix_rating_type) ? mix_rating_type : null,
            lobby_enabled: lobby_enabled || false,
            // 🆕 НОВОЕ: Опция Full Double Elimination
            full_double_elimination: (bracket_type === 'double_elimination' && full_double_elimination) || false,
            // 🆕 Требования привязки аккаунтов (только для MIX)
            require_faceit_linked: format === 'mix' ? !!require_faceit_linked : false,
            require_steam_linked: format === 'mix' ? !!require_steam_linked : false,
            // 🆕 Флаг финального турнира серии
            is_series_final: !!is_series_final
        });

        // Если включены настройки лобби, создаем их
        if (lobby_enabled && selected_maps && selected_maps.length === 7) {
            await MatchLobbyService.createLobbySettings(tournament.id, {
                enabled: true,
                matchFormat: lobby_match_format
            });
            
            await MatchLobbyService.setTournamentMaps(tournament.id, selected_maps);
        }

        // Логируем создание турнира
        await logTournamentEvent(tournament.id, userId, 'tournament_created', {
            name: tournament.name,
            game: tournament.game,
            format: tournament.format,
            mix_rating_type: tournament.mix_rating_type,
            lobby_enabled: tournament.lobby_enabled
        });

        console.log('✅ TournamentService: Турнир создан', tournament);
        return tournament;
    }

    /**
     * 🆕 Обновление флага финального турнира серии
     */
    static async updateSeriesFinalFlag(tournamentId, isFinal, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) throw new Error('Турнир не найден');
        if (tournament.created_by !== userId) {
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (!isAdmin) throw new Error('Недостаточно прав');
        }
        const result = await pool.query(
            'UPDATE tournaments SET is_series_final = $1 WHERE id = $2 RETURNING *',
            [!!isFinal, tournamentId]
        );
        return result.rows[0];
    }

    /**
     * 🆕 Установка связей финал ↔ отборочные (перезапись)
     */
    static async setFinalQualifiers(finalTournamentId, qualifiers, userId) {
        const tournament = await TournamentRepository.getById(finalTournamentId);
        if (!tournament) throw new Error('Турнир не найден');
        if (!tournament.is_series_final) throw new Error('Турнир не помечен как финал серии');
        if (tournament.created_by !== userId) {
            const isAdmin = await TournamentRepository.isAdmin(finalTournamentId, userId);
            if (!isAdmin) throw new Error('Недостаточно прав');
        }
        return TournamentRepository.setFinalQualifiers(finalTournamentId, qualifiers);
    }

    /**
     * 🆕 Получить список отборочных турниров финала
     */
    static async getFinalQualifiers(finalTournamentId) {
        return TournamentRepository.getFinalQualifiers(finalTournamentId);
    }

    /**
     * 🆕 Ручная синхронизация победителей отборочных турниров в финал
     * Берём top N мест (1..slots) из каждого отборочного и добавляем участников в финальный турнир
     */
    static async syncQualifiersToFinal(finalTournamentId, userId) {
        const finalTournament = await TournamentRepository.getById(finalTournamentId);
        if (!finalTournament) throw new Error('Турнир не найден');
        if (!finalTournament.is_series_final) throw new Error('Турнир не помечен как финал серии');
        if (finalTournament.created_by !== userId) {
            const isAdmin = await TournamentRepository.isAdmin(finalTournamentId, userId);
            if (!isAdmin) throw new Error('Недостаточно прав');
        }

        const qualifiers = await TournamentRepository.getFinalQualifiers(finalTournamentId);
        const promotions = [];

        for (const q of qualifiers) {
            const qualifierId = q.qualifier_tournament_id;
            const slots = Math.max(1, Math.min(3, parseInt(q.slots || 1)));

            // Получаем призовые места отборочного
            const res = await pool.query(`
                WITH finals AS (
                  SELECT m.* FROM matches m WHERE m.tournament_id = $1::int
                ),
                gf AS (
                  SELECT winner_team_id, team1_id, team2_id
                  FROM finals
                  WHERE bracket_type IN ('grand_final_reset','grand_final','final')
                  ORDER BY (bracket_type='grand_final_reset') DESC, id DESC
                  LIMIT 1
                ),
                first_place AS (
                  SELECT COALESCE(gf.winner_team_id, NULL) AS id FROM gf
                ),
                second_place AS (
                  SELECT CASE WHEN gf.winner_team_id = gf.team1_id THEN gf.team2_id ELSE gf.team1_id END AS id FROM gf
                ),
                third_place AS (
                  SELECT winner_team_id AS id
                  FROM finals
                  WHERE bracket_type = 'placement' OR is_third_place_match = true
                  ORDER BY id DESC LIMIT 1
                )
                SELECT id FROM (
                  SELECT id FROM first_place
                  UNION ALL
                  SELECT id FROM second_place
                  UNION ALL
                  SELECT id FROM third_place
                ) places WHERE id IS NOT NULL LIMIT $2::int;
            `, [qualifierId, slots]);

            const promotedIds = res.rows.map(r => r.id);
            for (let placed = 1; placed <= promotedIds.length; placed++) {
                const refId = promotedIds[placed - 1];
                if (!refId) continue;

                // Поддержка командных турниров: считаем, что refId указывает на team_id/participant_id
                // Добавляем как участника в финальный турнир (минимально: ссылка на participant/team запись)
                await pool.query(
                    `INSERT INTO tournament_promotions (final_tournament_id, qualifier_tournament_id, team_id, placed, meta)
                     VALUES ($1::int,$2::int,$3::int,$4::int,$5::jsonb)
                     ON CONFLICT (final_tournament_id, qualifier_tournament_id, team_id, placed)
                     DO UPDATE SET meta = EXCLUDED.meta, created_at = NOW()`,
                    [finalTournamentId, qualifierId, refId, placed, JSON.stringify({ source: 'manual_sync' })]
                );

                // Вставляем участника в финал в зависимости от participant_type
                if (['team','cs2_classic_5v5','cs2_wingman_2v2'].includes(finalTournament.participant_type)) {
                    // Командный финал: создаём команду по имени источника и переносим состав
                    // 1) Определяем имя и создателя исходной команды/участника
                    const srcTeamRes = await pool.query(
                        `SELECT id, name, creator_id FROM tournament_teams WHERE id = $1::int`,
                        [refId]
                    );
                    let sourceName = null;
                    let sourceCreatorId = null;
                    let isTeamSource = false;
                    if (srcTeamRes.rows.length > 0) {
                        isTeamSource = true;
                        sourceName = srcTeamRes.rows[0].name;
                        sourceCreatorId = srcTeamRes.rows[0].creator_id || null;
                    } else {
                        const srcPartRes = await pool.query(
                            `SELECT tp.name, tp.user_id FROM tournament_participants tp WHERE tp.id = $1::int`,
                            [refId]
                        );
                        if (srcPartRes.rows.length > 0) {
                            sourceName = srcPartRes.rows[0].name || ('Qualified #' + refId);
                            sourceCreatorId = srcPartRes.rows[0].user_id || null;
                        } else {
                            sourceName = 'Qualified #' + refId;
                            sourceCreatorId = null;
                        }
                    }

                    // 2) Создаём команду в финале, если нет
                    const insertTeamRes = await pool.query(
                        `WITH ins AS (
                           INSERT INTO tournament_teams (tournament_id, name, creator_id)
                           SELECT $1::int, $2::text, $3
                           WHERE NOT EXISTS (
                             SELECT 1 FROM tournament_teams t WHERE t.tournament_id = $1::int AND t.name = $2::text
                           )
                           RETURNING id
                         )
                         SELECT id FROM ins
                         UNION ALL
                         SELECT id FROM tournament_teams WHERE tournament_id = $1::int AND name = $2::text LIMIT 1`,
                        [finalTournamentId, sourceName, sourceCreatorId]
                    );
                    const finalTeamId = insertTeamRes.rows[0]?.id;

                    // 3) Переносим состав (и синхронизируем: добавляем недостающих, удаляем лишних)
                    if (isTeamSource && finalTeamId) {
                        const membersRes = await pool.query(
                            `SELECT user_id, participant_id, is_captain, captain_rating
                             FROM tournament_team_members WHERE team_id = $1::int`,
                            [refId]
                        );

                        // Текущее состояние финальной команды
                        const finalMembersRes = await pool.query(
                            `SELECT user_id, participant_id FROM tournament_team_members WHERE team_id = $1::int`,
                            [finalTeamId]
                        );
                        const finalMembers = finalMembersRes.rows || [];

                        // Добавляем недостающих из источника
                        for (const m of (membersRes.rows || [])) {
                            let newUserId = m.user_id || null;
                            let newParticipantId = null;

                            // Если нет user_id, но есть participant_id — создадим участника в финале с тем же именем
                            if (!newUserId && m.participant_id) {
                                const srcP = await pool.query(
                                    `SELECT name FROM tournament_participants WHERE id = $1::int`,
                                    [m.participant_id]
                                );
                                const pName = srcP.rows[0]?.name || ('Qualified #' + refId);
                                const insP = await pool.query(
                                    `WITH ins AS (
                                       INSERT INTO tournament_participants (tournament_id, user_id, name, in_team)
                                       SELECT $1::int, NULL, $2::text, false
                                       WHERE NOT EXISTS (
                                         SELECT 1 FROM tournament_participants p WHERE p.tournament_id = $1::int AND p.name = $2::text
                                       )
                                       RETURNING id
                                     )
                                     SELECT id FROM ins
                                     UNION ALL
                                     SELECT id FROM tournament_participants WHERE tournament_id = $1::int AND name = $2::text LIMIT 1`,
                                    [finalTournamentId, pName]
                                );
                                newParticipantId = insP.rows[0]?.id || null;
                            }

                            // Вставляем участника команды в финале, избегая дублей по user_id/participant_id
                            await pool.query(
                                `INSERT INTO tournament_team_members (team_id, user_id, participant_id, is_captain, captain_rating)
                                 SELECT $1::int, $2::int, $3::int, $4, $5
                                 WHERE NOT EXISTS (
                                   SELECT 1 FROM tournament_team_members ttm
                                   WHERE ttm.team_id = $1::int AND (
                                     (ttm.user_id IS NOT DISTINCT FROM $2::int)
                                     OR ($3::int IS NOT NULL AND ttm.participant_id IS NOT DISTINCT FROM $3::int)
                                   )
                                 )`,
                                [finalTeamId, newUserId, newParticipantId, !!m.is_captain, m.captain_rating || null]
                            );
                        }

                        // Мягкая чистка: удаляем только тех, у кого есть user_id, которого нет в источнике
                        const sourceUserIds = (membersRes.rows || [])
                            .map(x => x.user_id)
                            .filter(uid => uid !== null && uid !== undefined);
                        if (sourceUserIds.length > 0) {
                            await pool.query(
                                `DELETE FROM tournament_team_members 
                                 WHERE team_id = $1::int 
                                   AND user_id IS NOT NULL 
                                   AND NOT (user_id = ANY($2::int[]))`,
                                [finalTeamId, sourceUserIds]
                            );
                        }
                    } else if (finalTeamId) {
                        // Источник не команда — добавим одного участника как члена команды
                        const srcPartRes = await pool.query(
                            `SELECT tp.user_id, COALESCE(tp.name, u.username, 'Qualified #' || $3) AS name
                             FROM tournament_participants tp
                             LEFT JOIN users u ON u.id = tp.user_id
                             WHERE tp.id = $2::int`,
                            [finalTournamentId, refId, String(refId)]
                        );
                        const userId = srcPartRes.rows[0]?.user_id || null;
                        let participantId = null;
                        if (!userId) {
                            const name = srcPartRes.rows[0]?.name || ('Qualified #' + refId);
                            const insP = await pool.query(
                                `WITH ins AS (
                                   INSERT INTO tournament_participants (tournament_id, user_id, name, in_team)
                                   SELECT $1, NULL, $2, false
                                   WHERE NOT EXISTS (
                                     SELECT 1 FROM tournament_participants p WHERE p.tournament_id = $1 AND p.name = $2
                                   )
                                   RETURNING id
                                 )
                                 SELECT id FROM ins
                                 UNION ALL
                                 SELECT id FROM tournament_participants WHERE tournament_id = $1 AND name = $2 LIMIT 1`,
                                [finalTournamentId, name]
                            );
                            participantId = insP.rows[0]?.id || null;
                        }

                        await pool.query(
                            `INSERT INTO tournament_team_members (team_id, user_id, participant_id, is_captain, captain_rating)
                             SELECT $1::int, $2::int, $3::int, false, NULL
                             WHERE NOT EXISTS (
                               SELECT 1 FROM tournament_team_members ttm
                               WHERE ttm.team_id = $1::int AND (
                                 (ttm.user_id IS NOT DISTINCT FROM $2::int)
                                 OR ($3::int IS NOT NULL AND ttm.participant_id IS NOT DISTINCT FROM $3::int)
                               )
                             )`,
                            [finalTeamId, userId, participantId]
                        );
                        
                        // Не удаляем остальных членов: только добавляем недостающего участника
                    }
                } else {
                    // Индивидуальный финал: добавляем участника
                    await pool.query(
                        `INSERT INTO tournament_participants (tournament_id, user_id, name, in_team)
                         SELECT $1, tp.user_id, COALESCE(tp.name, u.username, 'Qualified #' || $3), false
                         FROM tournament_participants tp
                         LEFT JOIN users u ON u.id = tp.user_id
                         WHERE tp.id = $2::int
                         AND NOT EXISTS (
                            SELECT 1 FROM tournament_participants p
                            WHERE p.tournament_id = $1 AND (p.user_id = tp.user_id OR p.name = COALESCE(tp.name, u.username))
                         )`,
                        [finalTournamentId, refId, String(refId)]
                    );
                }

                promotions.push({ qualifierId, refId, placed });
            }
        }

        // Лог продвижения: не критично к падению (в БД может не быть таблицы)
        try {
            await logAdvancement(finalTournamentId, userId, { type: 'manual_sync', promotions_count: promotions.length });
        } catch (e) {
            console.warn('⚠️ [TournamentLogService] Пропуск логирования продвижения:', e?.message || e);
        }

        // Отправка обновления: передаем полные данные турнира
        try {
            const fullTournamentData = await this.getTournamentById(finalTournamentId);
            await broadcastTournamentUpdate(finalTournamentId, fullTournamentData, 'qualifiersSync');
        } catch (e) {
            console.warn('⚠️ [broadcastTournamentUpdate] Ошибка при отправке обновления турнира', finalTournamentId, e?.message || e);
        }

        return { success: true, promotions };
    }

    /**
     * 🆕 Live‑поиск турниров
     */
    static async searchTournaments(q, status, limit = 20) {
        return TournamentRepository.searchTournaments(q, status, limit);
    }

    /**
     * Обновление турнира
     */
    static async updateTournament(tournamentId, updateData, userId) {
        console.log(`✏️ TournamentService: Обновление турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (tournament.status !== 'active') {
            throw new Error('Турнир неактивен');
        }

        const updatedTournament = await TournamentRepository.update(tournamentId, updateData);

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для общих обновлений турнира
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateTournament');
        console.log(`📡 [updateTournament] WebSocket обновление отправлено`);

        console.log('✅ TournamentService: Турнир обновлен');
        return updatedTournament;
    }

    /**
     * Удаление турнира
     */
    static async deleteTournament(tournamentId, userId) {
        console.log(`🗑️ TournamentService: Удаление турнира ${tournamentId}`);

        // Проверка прав доступа - только создатель может удалить турнир
        await this._checkTournamentDeletionAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        // 🗑️ ИСПРАВЛЕНО: Убрана проверка статуса турнира
        // Создатель может удалить турнир в любом статусе
        console.log(`🗑️ [deleteTournament] Удаление турнира "${tournament.name}" (статус: ${tournament.status})`);

        await TournamentRepository.delete(tournamentId);

        console.log('✅ TournamentService: Турнир удален');
    }

    /**
     * Начало турнира
     */
    static async startTournament(tournamentId, userId) {
        console.log(`🚀 TournamentService: Начало турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        
        // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА СТАТУСА ТУРНИРА
        console.log(`🔍 [startTournament] Диагностика турнира ${tournamentId}:`, {
            id: tournament?.id,
            name: tournament?.name,
            status: tournament?.status,
            format: tournament?.format,
            created_by: tournament?.created_by,
            userId: userId,
            hasPermission: tournament?.created_by === userId
        });
        
        if (tournament.status !== 'active') {
            const errorMessage = `Можно начать только активный турнир. Текущий статус: "${tournament.status}"`;
            console.error(`❌ [startTournament] ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Проверка наличия сгенерированной сетки
        const matchesCount = await MatchRepository.getCountByTournamentId(tournamentId);
        console.log(`🔍 [startTournament] Количество матчей в турнире: ${matchesCount}`);
        
        if (matchesCount === 0) {
            const errorMessage = 'Перед началом турнира необходимо сгенерировать сетку';
            console.error(`❌ [startTournament] ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // 🆕 АВТОМАТИЧЕСКОЕ ЗАВЕРШЕНИЕ BYE МАТЧЕЙ
        console.log(`🎯 [startTournament] Автоматическое завершение BYE матчей...`);
        const byeResults = await this._autoCompleteBYEMatches(tournamentId);
        console.log(`✅ [startTournament] BYE матчи завершены:`, byeResults);

        // Изменение статуса турнира
        console.log(`🔄 [startTournament] Меняем статус турнира с "${tournament.status}" на "in_progress"`);
        await TournamentRepository.updateStatus(tournamentId, 'in_progress');

        // 🆕 ИСПРАВЛЕНИЕ: Получаем обновленные данные турнира и отправляем WebSocket событие
        const updatedTournament = await this.getTournamentById(tournamentId);
        console.log(`✅ [startTournament] Турнир обновлен, новый статус: "${updatedTournament.status}"`);

        // Отправляем обновление через WebSocket (аналогично endTournament)
        broadcastTournamentUpdate(tournamentId, updatedTournament, 'startTournament');
        console.log(`📡 [startTournament] WebSocket обновление отправлено`);

        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'tournament_started', {
            previous_status: tournament.status,
            new_status: 'in_progress'
        });

        // Отправляем уведомление в чат
        await sendTournamentChatAnnouncement(
            tournamentId,
            `🚀 Турнир начат! Удачи всем участникам!`
        );

        console.log('✅ TournamentService: Турнир начат');
        return { 
            success: true, 
            message: 'Турнир успешно начат' 
        };
    }

    /**
     * Завершение турнира
     */
    static async endTournament(tournamentId, userId) {
        console.log(`🏁 TournamentService: Завершение турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        
        // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА СТАТУСА ТУРНИРА
        console.log(`🔍 [endTournament] Диагностика турнира ${tournamentId}:`, {
            id: tournament?.id,
            name: tournament?.name,
            status: tournament?.status,
            format: tournament?.format,
            created_by: tournament?.created_by,
            userId: userId,
            hasPermission: tournament?.created_by === userId
        });
        
        if (tournament.status !== 'in_progress') {
            const errorMessage = `Можно завершить только турнир в процессе. Текущий статус: "${tournament.status}"`;
            console.error(`❌ [endTournament] ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Проверка наличия сгенерированной сетки
        const matchesCount = await MatchRepository.getCountByTournamentId(tournamentId);
        console.log(`🔍 [endTournament] Количество матчей в турнире: ${matchesCount}`);
        
        if (matchesCount === 0) {
            const errorMessage = 'Нельзя завершить турнир без сгенерированной сетки';
            console.error(`❌ [endTournament] ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Изменение статуса турнира на завершенный
        console.log(`🔄 [endTournament] Меняем статус турнира с "${tournament.status}" на "completed"`);
        await TournamentRepository.updateStatus(tournamentId, 'completed');

        // Получаем обновленные данные турнира
        const updatedTournament = await this.getTournamentById(tournamentId);
        console.log(`✅ [endTournament] Турнир обновлен, новый статус: "${updatedTournament.status}"`);

        // Отправляем обновление через WebSocket
        broadcastTournamentUpdate(tournamentId, updatedTournament, 'endTournament');

        // Логируем завершение турнира
        await logTournamentEvent(tournamentId, userId, 'tournament_ended', {
            participantCount: updatedTournament.participant_count,
            matchesCount: matchesCount,
            endedBy: userId
        });

        // Отправляем объявление в чат турнира
        await sendTournamentChatAnnouncement(
            tournamentId,
            `Турнир "${updatedTournament.name}" завершен`
        );

        // 🆕 Авто‑промо: если турнир является отборочным для одного или нескольких финалов — синхронизируем победителей
        try {
            const finals = await TournamentRepository.getFinalsByQualifier(tournamentId);
            if (Array.isArray(finals) && finals.length > 0) {
                console.log(`🔄 [endTournament] Найдено финалов для авто‑промо: ${finals.length}`);
                for (const f of finals) {
                    if (!f.is_series_final) continue;
                    try {
                        // Используем системного инициатора = автор финала либо завершивший пользователь
                        await this.syncQualifiersToFinal(f.id, f.created_by || userId);
                        console.log(`✅ [endTournament] Автосинхронизация в финал ${f.id} выполнена`);
                    } catch (e) {
                        console.warn(`⚠️ [endTournament] Автосинхронизация в финал ${f.id} не удалась:`, e.message);
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ [endTournament] Ошибка во время авто‑промо:', e.message);
        }

        console.log('✅ TournamentService: Турнир завершен');
        return updatedTournament;
    }

    /**
     * Получение списка игр
     */
    static async getGames() {
        console.log('🎮 TournamentService: Получение списка игр');
        try {
            const games = await TournamentRepository.getGames();
            console.log(`✅ TournamentService: Получено ${games.length} игр из репозитория`);
            return games;
        } catch (error) {
            console.error('❌ TournamentService: Ошибка получения списка игр:', error);
            throw error;
        }
    }

    /**
     * Сброс результатов матчей турнира
     */
    static async resetMatchResults(tournamentId, userId) {
        console.log(`🔄 TournamentService: Сброс результатов турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const result = await TournamentRepository.resetMatchResults(tournamentId, userId);

        // Отправляем уведомление в чат
        const tournament = await TournamentRepository.getById(tournamentId);
        await sendTournamentChatAnnouncement(
            tournamentId,
            `🔄 Администратор сбросил результаты матчей и восстановил изначальную структуру турнирной сетки. Статус турнира изменен на "Активный".`
        );

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для сброса результатов
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'resetMatchResults');
        console.log(`📡 [resetMatchResults] WebSocket обновление отправлено`);

        console.log('✅ TournamentService: Результаты матчей сброшены');
        return result;
    }

    /**
     * Получение команд турнира
     */
    static async getTeams(tournamentId) {
        console.log(`🏆 TournamentService: Получение команд турнира ${tournamentId}`);
        return await TournamentRepository.getTeamsWithMembers(tournamentId);
    }

    /**
     * Обновление описания турнира
     */
    static async updateDescription(tournamentId, description, userId) {
        console.log(`📝 TournamentService: Обновление описания турнира ${tournamentId}`);

        await this._checkTournamentAccess(tournamentId, userId);
        const updatedTournament = await TournamentRepository.updateDescription(tournamentId, description);

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления описания
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateDescription');
        console.log(`📡 [updateDescription] WebSocket обновление отправлено`);

        return updatedTournament;
    }

    /**
     * Обновление полного описания турнира
     */
    static async updateFullDescription(tournamentId, fullDescription, userId) {
        console.log(`📜 TournamentService: Обновление полного описания турнира ${tournamentId}`);

        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (tournament.status !== 'active') {
            throw new Error('Турнир неактивен');
        }

        const updatedTournament = await TournamentRepository.updateFullDescription(tournamentId, fullDescription);

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления полного описания
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateFullDescription');
        console.log(`📡 [updateFullDescription] WebSocket обновление отправлено`);

        return updatedTournament;
    }

    /**
     * Обновление регламента турнира
     */

    static async updateRules(tournamentId, rules, userId) {
        console.log(`⚖️ TournamentService: Обновление регламента турнира ${tournamentId}`);

        await this._checkTournamentAccess(tournamentId, userId);

    // 🔧 ИСПРАВЛЕНО: Убрана проверка статуса турнира
    // Регламент можно редактировать в любом статусе турнира (active, completed, in_progress)
    
        const updatedTournament = await TournamentRepository.updateRules(tournamentId, rules);

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления регламента
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateRules');
        console.log(`📡 [updateRules] WebSocket обновление отправлено`);

        return updatedTournament;
    }

    /**
     * Обновление призового фонда турнира
     */
    static async updatePrizePool(tournamentId, prizePool, userId) {
        console.log(`💰 TournamentService: Обновление призового фонда турнира ${tournamentId}`);

        await this._checkTournamentAccess(tournamentId, userId);
        const updatedTournament = await TournamentRepository.updatePrizePool(tournamentId, prizePool);

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления призового фонда
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updatePrizePool');
        console.log(`📡 [updatePrizePool] WebSocket обновление отправлено`);

        return updatedTournament;
    }

    /**
     * 🏆 Обновление типа турнирной сетки
     */
    static async updateBracketType(tournamentId, bracketType, userId) {
        console.log(`🏆 [TournamentService.updateBracketType] Обновление типа сетки турнира ${tournamentId} на "${bracketType}"`);
        
        // 🔧 ИСПРАВЛЕНО: Проверка прав доступа только для создателя турнира
        const tournament = await this._checkTournamentCreatorAccess(tournamentId, userId);
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.status !== 'active') {
            throw new Error('Изменение типа сетки доступно только для активных турниров');
        }
        
        // Проверка на наличие сгенерированной сетки
        const matchesCount = await TournamentRepository.getMatchesCount(tournamentId);
        if (matchesCount > 0) {
            throw new Error('Нельзя изменить тип сетки при наличии сгенерированных матчей');
        }
        
        // Валидация типа сетки
        const validBracketTypes = ['single_elimination', 'double_elimination'];
        if (!validBracketTypes.includes(bracketType)) {
            throw new Error(`Неподдерживаемый тип сетки: ${bracketType}`);
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateBracketType(tournamentId, bracketType);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'bracket_type_changed', {
            old_bracket_type: tournament.bracket_type,
            new_bracket_type: bracketType
        });
        
        // Уведомление в чат турнира
        const bracketTypeNames = {
            'single_elimination': 'Single Elimination',
            'double_elimination': 'Double Elimination'
        };
        
        const message = `Тип турнирной сетки изменен на: ${bracketTypeNames[bracketType]}`;
        await sendTournamentChatAnnouncement(tournamentId, message);
        
        // Broadcast обновления
        await broadcastTournamentUpdate(tournamentId, {
            type: 'bracket_type_updated',
            bracket_type: bracketType,
            message
        }, 'updateBracketType');
        
        console.log(`✅ [TournamentService.updateBracketType] Тип сетки успешно обновлен на "${bracketType}"`);
        return updatedTournament;
    }

    /**
     * 👥 Обновление размера команды для микс-турниров
     */
    static async updateTeamSize(tournamentId, teamSize, userId) {
        console.log(`👥 [TournamentService.updateTeamSize] Обновление размера команды турнира ${tournamentId} на ${teamSize}`);
        
        // 🔧 Проверка прав доступа - только создатель турнира
        const tournament = await this._checkTournamentCreatorAccess(tournamentId, userId);
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.format !== 'mix') {
            throw new Error('Изменение размера команды доступно только для микс-турниров');
        }
        
        if (tournament.status !== 'active') {
            throw new Error('Изменение размера команды доступно только для активных турниров');
        }
        
        // 🔧 НОВАЯ ЛОГИКА: Автоматическое удаление команд при изменении размера
        const teamsCount = await TournamentRepository.getTeamsCount(tournamentId);
        let teamsDeleted = false;
        let matchesDeleted = false;
        
        if (teamsCount > 0) {
            console.log(`🗑️ [TournamentService.updateTeamSize] Найдено ${teamsCount} команд, удаляем их при изменении размера`);
            
            // Сначала удаляем турнирную сетку если она есть
            const matchesCount = await TournamentRepository.getMatchesCount(tournamentId);
            if (matchesCount > 0) {
                console.log(`🗑️ [TournamentService.updateTeamSize] Удаляем ${matchesCount} матчей турнирной сетки`);
                await TournamentRepository.deleteMatches(tournamentId);
                matchesDeleted = true;
            }
            
            // Затем удаляем команды
            await TournamentRepository.deleteTeams(tournamentId);
            teamsDeleted = true;
            
            console.log(`✅ [TournamentService.updateTeamSize] Удалено ${teamsCount} команд и ${matchesCount} матчей`);
        }
        
        // Валидация размера команды
        const validTeamSizes = [2, 3, 4, 5];
        if (!validTeamSizes.includes(teamSize)) {
            throw new Error(`Неподдерживаемый размер команды: ${teamSize}. Доступные: ${validTeamSizes.join(', ')}`);
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateTeamSize(tournamentId, teamSize);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'team_size_changed', {
            old_team_size: tournament.team_size,
            new_team_size: teamSize,
            teams_deleted: teamsDeleted,
            matches_deleted: matchesDeleted,
            teams_count: teamsDeleted ? teamsCount : 0
        });
        
        // Уведомление в чат турнира
        const sizeNames = {
            2: '2 игрока',
            3: '3 игрока',
            4: '4 игрока',
            5: '5 игроков'
        };
        
        let message = `👥 Размер команды изменен на: ${sizeNames[teamSize]}`;
        
        if (teamsDeleted) {
            message += `\n🗑️ Удалено ${teamsCount} команд${matchesDeleted ? ' и турнирная сетка' : ''}`;
            message += `\n🔄 Участники снова доступны для формирования новых команд`;
        }
        
        await sendTournamentChatAnnouncement(tournamentId, message);
        
        // Broadcast обновления
        await broadcastTournamentUpdate(tournamentId, {
            type: 'team_size_updated',
            team_size: teamSize,
            message
        }, 'updateTeamSize');
        
        console.log(`✅ [TournamentService.updateTeamSize] Размер команды успешно обновлен на ${teamSize}`);
        
        // Добавляем информацию об удалении команд к турниру
        return {
            ...updatedTournament,
            teams_deleted: teamsDeleted,
            matches_deleted: matchesDeleted,
            deleted_teams_count: teamsDeleted ? teamsCount : 0
        };
    }

    /**
     * 🎯 Обновление типа рейтинга для микс-турниров
     */
    static async updateRatingType(tournamentId, mixRatingType, userId) {
        console.log(`🎯 [TournamentService.updateRatingType] Обновление типа рейтинга турнира ${tournamentId} на ${mixRatingType}`);
        
        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);
        
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.format !== 'mix') {
            throw new Error('Изменение типа рейтинга доступно только для микс-турниров');
        }
        
        if (tournament.status !== 'active') {
            throw new Error('Изменение типа рейтинга доступно только для активных турниров');
        }
        
        // Проверка на уже сформированные команды (можно менять только до формирования команд)
        const teamsCount = await TournamentRepository.getTeamsCount(tournamentId);
        if (teamsCount > 0) {
            throw new Error('Нельзя изменить тип рейтинга после формирования команд');
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateMixRatingType(tournamentId, mixRatingType);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'rating_type_changed', {
            old_rating_type: tournament.mix_rating_type,
            new_rating_type: mixRatingType
        });
        
        // Уведомление в чат турнира
        const typeNames = {
            'faceit': 'FACEIT ELO',
            'premier': 'CS2 Premier Rank',
            'mixed': 'Случайный микс'
        };
        
        await sendTournamentChatAnnouncement(
            tournamentId,
            `🎯 Тип рейтинга изменен на: ${typeNames[mixRatingType]}`
        );

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления типа рейтинга
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateRatingType');
        console.log(`📡 [updateRatingType] WebSocket обновление отправлено`);
        
        console.log(`✅ [updateRatingType] Тип рейтинга турнира ${tournamentId} обновлен на ${mixRatingType}`);
        return updatedTournament;
    }

    /**
     * 🆕 Обновление требований привязки аккаунтов для MIX турниров
     */
    static async updateMixLinkRequirements(tournamentId, { require_faceit_linked, require_steam_linked }, userId) {
        console.log(`🔗 [TournamentService.updateMixLinkRequirements] t=${tournamentId}, faceit=${require_faceit_linked}, steam=${require_steam_linked}`);

        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) throw new Error('Турнир не найден');
        if (tournament.format !== 'mix') throw new Error('Требования привязки доступны только для MIX турниров');

        // Нормализация: запрещаем конфликты и зависим от текущего типа рейтинга
        let faceitReq = !!require_faceit_linked;
        let steamReq = !!require_steam_linked;
        if (tournament.mix_rating_type === 'faceit') steamReq = false;
        if (tournament.mix_rating_type === 'premier') faceitReq = false;
        if (tournament.mix_rating_type === 'mixed') { faceitReq = false; steamReq = false; }

        const updated = await TournamentRepository.updateMixLinkRequirements(tournamentId, faceitReq, steamReq);

        await logTournamentEvent(tournamentId, userId, 'mix_link_requirements_updated', {
            require_faceit_linked: faceitReq,
            require_steam_linked: steamReq
        });

        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateMixLinkRequirements');
        return updated;
    }

    /**
     * 🎮 Обновление дисциплины турнира
     */
    static async updateGame(tournamentId, game, userId) {
        console.log(`🎮 [TournamentService.updateGame] Обновление дисциплины турнира ${tournamentId} на "${game}"`);
        
        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);
        
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.status !== 'active') {
            throw new Error('Изменение дисциплины доступно только для активных турниров');
        }
        
        // Проверка на уже созданную сетку (можно менять только до создания сетки)
        const hasMatches = await this.hasMatches(tournamentId);
        if (hasMatches) {
            throw new Error('Нельзя изменить дисциплину после создания турнирной сетки');
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateGame(tournamentId, game);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'game_changed', {
            old_game: tournament.game,
            new_game: game
        });
        
        // Уведомление в чат турнира
        await sendTournamentChatAnnouncement(
            tournamentId,
            `🎮 Дисциплина турнира изменена на: ${game}`
        );

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления дисциплины
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateGame');
        console.log(`📡 [updateGame] WebSocket обновление отправлено`);
        
        console.log(`✅ [updateGame] Дисциплина турнира ${tournamentId} обновлена на "${game}"`);
        return updatedTournament;
    }

    /**
     * 🏆 Обновление формата турнира
     */
    static async updateFormat(tournamentId, format, userId) {
        console.log(`🏆 [TournamentService.updateFormat] Обновление формата турнира ${tournamentId} на "${format}"`);
        
        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);
        
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.status !== 'active') {
            throw new Error('Изменение формата доступно только для активных турниров');
        }
        
        // Проверка на участников и команды
        const participantsCount = await TournamentRepository.getParticipantsCount(tournamentId);
        const teamsCount = await TournamentRepository.getTeamsCount(tournamentId);
        
        if (participantsCount > 0 || teamsCount > 0) {
            throw new Error('Нельзя изменить формат турнира при наличии участников или команд');
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateFormat(tournamentId, format);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'format_changed', {
            old_format: tournament.format,
            new_format: format
        });
        
        // Уведомление в чат турнира
        const formatNames = {
            'single_elimination': 'Single Elimination',
            'double_elimination': 'Double Elimination',
            'mix': 'Микс-турнир'
        };
        
        await sendTournamentChatAnnouncement(
            tournamentId,
            `🏆 Формат турнира изменен на: ${formatNames[format]}`
        );

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления формата
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateFormat');
        console.log(`📡 [updateFormat] WebSocket обновление отправлено`);
        
        console.log(`✅ [updateFormat] Формат турнира ${tournamentId} обновлен на "${format}"`);
        return updatedTournament;
    }

    /**
     * 📅 Обновление даты старта турнира
     */
    static async updateStartDate(tournamentId, startDate, userId) {
        console.log(`📅 [TournamentService.updateStartDate] Обновление даты старта турнира ${tournamentId} на "${startDate}"`);
        
        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);
        
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.status === 'completed') {
            throw new Error('Нельзя изменить дату старта завершенного турнира');
        }
        
        // Проверяем, что дата не в прошлом (с учетом разницы в 1 час для защиты от ошибок)
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        if (startDate < oneHourAgo) {
            throw new Error('Дата старта не может быть в прошлом');
        }
        
        // Обновление в базе данных
        const updatedTournament = await TournamentRepository.updateStartDate(tournamentId, startDate);
        
        // Логирование события
        await logTournamentEvent(tournamentId, userId, 'start_date_changed', {
            old_start_date: tournament.start_date,
            new_start_date: startDate
        });
        
        // Уведомление в чат турнира
        await sendTournamentChatAnnouncement(
            tournamentId,
            `📅 Дата старта турнира изменена на: ${startDate.toLocaleString('ru-RU')}`
        );

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления даты старта
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateStartDate');
        console.log(`📡 [updateStartDate] WebSocket обновление отправлено`);
        
        console.log(`✅ [updateStartDate] Дата старта турнира ${tournamentId} обновлена на "${startDate}"`);
        return updatedTournament;
    }

    /**
     * Обновление настроек лобби
     */
    static async updateLobbyEnabled(tournamentId, lobbyEnabled, userId) {
        console.log(`🎮 [TournamentService] Обновление настроек лобби турнира ${tournamentId} на ${lobbyEnabled}`);

        // Проверка прав доступа
        await this._checkTournamentAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        // Обновляем настройки лобби
        const updatedTournament = await TournamentRepository.update(tournamentId, {
            lobby_enabled: lobbyEnabled
        });

        // Обновляем настройки в таблице лобби
        if (lobbyEnabled) {
            await MatchLobbyService.createLobbySettings(tournamentId, {
                enabled: true,
                matchFormat: null
            });
        }

        await logTournamentEvent(tournamentId, userId, 'lobby_settings_updated', {
            lobby_enabled: lobbyEnabled
        });

        // 🆕 ДОБАВЛЕНО: WebSocket уведомление для обновления настроек лобби
        const fullTournamentData = await this.getTournamentById(tournamentId);
        broadcastTournamentUpdate(tournamentId, fullTournamentData, 'updateLobbyEnabled');
        console.log(`📡 [updateLobbyEnabled] WebSocket обновление отправлено`);

        console.log('✅ [TournamentService] Настройки лобби обновлены');
        return updatedTournament;
    }

    /**
     * ✏️ Ручное редактирование сетки турнира
     */
    static async manualBracketEdit(tournamentId, bracketData, userId) {
        console.log(`✏️ TournamentService: Ручное редактирование сетки турнира ${tournamentId}`);

        // Проверка прав доступа - только создатель турнира
        const tournament = await this._checkTournamentCreatorAccess(tournamentId, userId);
        
        // 🔧 ВАЛИДАЦИЯ УСЛОВИЙ
        if (tournament.status === 'completed') {
            throw new Error('Нельзя редактировать сетку завершенного турнира');
        }
        
        // Проверка наличия сгенерированной сетки
        const matchesCount = await MatchRepository.getCountByTournamentId(tournamentId);
        if (matchesCount === 0) {
            throw new Error('Нельзя редактировать несуществующую сетку. Сначала сгенерируйте сетку турнира');
        }

        console.log(`📊 [manualBracketEdit] Турнир ${tournamentId}: найдено ${matchesCount} матчей для редактирования`);

        const client = await pool.connect();
        let updatedMatches = 0;
        let clearedResults = 0;

        try {
            await client.query('BEGIN');

            // 🔄 ШАГ 1: Сброс всех результатов матчей
            console.log(`🔄 [manualBracketEdit] Сбрасываем результаты всех матчей турнира ${tournamentId}`);
            
            const clearResultsQuery = `
                UPDATE matches SET 
                    winner_team_id = NULL,
                    score1 = NULL,
                    score2 = NULL,
                    status = 'pending'
                WHERE tournament_id = $1
                  AND (winner_team_id IS NOT NULL 
                       OR score1 IS NOT NULL 
                       OR score2 IS NOT NULL 
                       OR status != 'pending')
            `;
            
            const clearResult = await client.query(clearResultsQuery, [tournamentId]);
            clearedResults = clearResult.rowCount;
            
            console.log(`✅ [manualBracketEdit] Очищено результатов: ${clearedResults}`);

            // ✏️ ШАГ 2: Обновление расстановки участников
            console.log(`✏️ [manualBracketEdit] Обновляем расстановку участников в ${bracketData.length} матчах`);
            
            for (const matchUpdate of bracketData) {
                const { matchId, team1_id, team2_id } = matchUpdate;
                
                // Валидация данных матча
                if (!matchId || typeof matchId !== 'number') {
                    console.warn(`⚠️ [manualBracketEdit] Пропускаем невалидный matchId: ${matchId}`);
                    continue;
                }

                const updateQuery = `
                    UPDATE matches 
                    SET team1_id = $1,
                        team2_id = $2
                    WHERE id = $3 
                      AND tournament_id = $4
                      AND round = 1
                `;
                
                const result = await client.query(updateQuery, [
                    team1_id || null,
                    team2_id || null,
                    matchId,
                    tournamentId
                ]);
                
                if (result.rowCount > 0) {
                    updatedMatches++;
                    console.log(`✅ [manualBracketEdit] Обновлен матч ${matchId}: team1=${team1_id}, team2=${team2_id}`);
                } else {
                    console.warn(`⚠️ [manualBracketEdit] Не найден матч ${matchId} в первом раунде турнира ${tournamentId}`);
                }
            }

            // 🔄 ШАГ 3: Возвращаем турнир в активное состояние если он был в процессе
            if (tournament.status === 'in_progress') {
                await client.query(
                    'UPDATE tournaments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    ['active', tournamentId]
                );
                console.log(`🔄 [manualBracketEdit] Статус турнира изменен с "in_progress" на "active"`);
            }

            await client.query('COMMIT');

            // 📝 Логирование события
            await logTournamentEvent(tournamentId, userId, 'manual_bracket_edit', {
                updatedMatches,
                clearedResults,
                previousStatus: tournament.status,
                bracketDataCount: bracketData.length
            });

            // 💬 Уведомление в чат турнира
            await sendTournamentChatAnnouncement(
                tournamentId,
                `✏️ Администратор вручную изменил расстановку участников. ` +
                `Обновлено матчей: ${updatedMatches}, очищено результатов: ${clearedResults}. ` +
                `Турнир готов к проведению с новой расстановкой.`
            );

            // 🆕 WebSocket уведомление об изменениях
            const fullTournamentData = await this.getTournamentById(tournamentId);
            broadcastTournamentUpdate(tournamentId, fullTournamentData, 'manualBracketEdit');
            console.log(`📡 [manualBracketEdit] WebSocket обновление отправлено`);

            console.log(`✅ TournamentService: Ручное редактирование завершено. Обновлено матчей: ${updatedMatches}, очищено результатов: ${clearedResults}`);
            
            return {
                success: true,
                updatedMatches,
                clearedResults,
                message: 'Расстановка участников успешно обновлена'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [manualBracketEdit] Ошибка при редактировании сетки турнира ${tournamentId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Проверка прав доступа к турниру
     * @private
     */
    static async _checkTournamentAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (!isAdmin) {
                throw new Error('Только создатель или администратор может выполнить это действие');
            }
        }
    }

    /**
     * Проверка прав доступа к удалению турнира (только создатель)
     * @private
     */
    static async _checkTournamentDeletionAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            throw new Error('Только создатель может удалить турнир');
        }
    }

    /**
     * Проверка прав создателя турнира
     * @private
     */
    static async _checkTournamentCreatorAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            throw new Error('Только создатель турнира может выполнить это действие');
        }
        
        return tournament;
    }

    /**
     * Получение турнира по ID (простая версия без дополнительных данных)
     */
    static async getTournament(tournamentId) {
        console.log(`🔍 [TournamentService] Получение базовой информации о турнире ${tournamentId}`);
        return await TournamentRepository.getById(tournamentId);
    }

    /**
     * Получение детальной информации о турнире с дополнительными данными
     */
    static async getTournamentDetails(tournamentId) {
        try {
            const tournament = await TournamentRepository.getByIdWithCreator(tournamentId);
            
            if (!tournament) {
                throw new Error('Турнир не найден');
            }

            // Получаем участников или команды в зависимости от типа турнира
            let participants = [];
            let teams = [];
            // 🆕 Администраторы турнира
            let admins = [];

            // 🆕 ОБНОВЛЕННАЯ ЛОГИКА: поддержка CS2 типов участников
            const isTeamTournament = ['team', 'cs2_classic_5v5', 'cs2_wingman_2v2'].includes(tournament.participant_type);
            const isSoloTournament = tournament.participant_type === 'solo';

            if (tournament.format === 'mix' || isSoloTournament) {
                participants = await ParticipantRepository.getByTournamentId(tournamentId);
                teams = await TeamRepository.getByTournamentId(tournamentId);
            } else if (isTeamTournament) {
                teams = await TournamentRepository.getTeamsWithMembers(tournamentId);
            }

            // Получаем матчи
            const matches = await MatchRepository.getByTournamentId(tournamentId);
            // Получаем администраторов
            admins = await TournamentRepository.getAdmins(tournamentId);

            // Добавляем CS2-специфичную информацию
            const enhancedTournament = this._enhanceWithCS2Info(tournament);

            return {
                ...enhancedTournament,
                participants,
                teams,
                matches,
                admins
            };

        } catch (error) {
            console.error(`❌ Ошибка получения деталей турнира ${tournamentId}:`, error.message);
            throw error;
        }
    }

    /**
     * 🆕 Улучшение турнира с CS2-специфичной информацией
     */
    static _enhanceWithCS2Info(tournament) {
        if (tournament.game === 'Counter-Strike 2' && tournament.format !== 'mix') {
            return {
                ...tournament,
                display_participant_type: this._getCS2DisplayName(tournament.participant_type),
                min_team_size: this._getCS2MinTeamSize(tournament.participant_type),
                is_cs2_tournament: true
            };
        }

        return {
            ...tournament,
            display_participant_type: this._getStandardDisplayName(tournament.participant_type),
            is_cs2_tournament: false
        };
    }

    /**
     * 🆕 Получить отображаемое имя для CS2 типов
     */
    static _getCS2DisplayName(participantType) {
        const names = {
            'cs2_classic_5v5': 'Классический 5х5',
            'cs2_wingman_2v2': 'Wingman 2х2'
        };
        return names[participantType] || participantType;
    }

    /**
     * 🆕 Получить минимальный размер команды для CS2
     */
    static _getCS2MinTeamSize(participantType) {
        const sizes = {
            'cs2_classic_5v5': 5,
            'cs2_wingman_2v2': 2
        };
        return sizes[participantType] || 5;
    }

    /**
     * 🆕 Получить стандартное отображаемое имя
     */
    static _getStandardDisplayName(participantType) {
        const names = {
            'team': 'Командный',
            'solo': 'Одиночный'
        };
        return names[participantType] || participantType;
    }

    /**
     * Проверка прав пользователя на выполнение действий с турниром
     */
    static async checkUserPermission(tournamentId, userId, permission = 'general') {
        try {
            const tournament = await TournamentRepository.getById(tournamentId);
            if (!tournament) {
                return false;
            }

            // Создатель турнира имеет все права
            if (tournament.created_by === userId) {
                return true;
            }

            // Проверяем администраторов турнира
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (isAdmin) {
                return true;
            }

            // Для микс турниров и CS2 турниров проверяем специфичные права
            if (['mix', 'cs2_classic_5v5', 'cs2_wingman_2v2'].includes(tournament.format) || 
                ['cs2_classic_5v5', 'cs2_wingman_2v2'].includes(tournament.participant_type)) {
                
                // Права управления командами для микс и CS2 турниров
                if (permission === 'manage_teams') {
                    return tournament.created_by === userId || isAdmin;
                }
            }

            return false;

        } catch (error) {
            console.error(`❌ Ошибка проверки прав пользователя ${userId} для турнира ${tournamentId}:`, error.message);
            return false;
        }
    }

    /**
     * Проверка наличия матчей в турнире
     * @param {number} tournamentId - ID турнира
     * @returns {boolean} - есть ли матчи в турнире
     */
    static async hasMatches(tournamentId) {
        console.log(`🔍 [TournamentService] Проверка наличия матчей в турнире ${tournamentId}`);
        
        try {
            const matchesCount = await MatchRepository.getCountByTournamentId(tournamentId);
            const hasMatches = matchesCount > 0;
            
            console.log(`📊 [hasMatches] Турнир ${tournamentId}: ${matchesCount} матчей, hasMatches: ${hasMatches}`);
            return hasMatches;
            
        } catch (error) {
            console.error(`❌ [hasMatches] Ошибка проверки матчей турнира ${tournamentId}:`, error);
            return false;
        }
    }

    // Получение победителей последних турниров
    static async getWinners(limit = 5) {
        try {
            const result = await pool.query(`
                WITH recent AS (
                    SELECT t.*
                    FROM tournaments t
                    WHERE t.status = 'completed'
                    ORDER BY COALESCE(t.completed_at, t.end_date, t.updated_at, t.created_at) DESC, t.id DESC
                    LIMIT $1
                ), winners AS (
                    SELECT 
                        r.id AS tournament_id,
                        r.name AS tournament_name,
                        r.game,
                        COALESCE(r.completed_at, r.end_date, r.updated_at, r.created_at) AS date,
                        COALESCE(
                            (
                                SELECT m.winner_team_id FROM matches m
                                WHERE m.tournament_id = r.id
                                  AND m.bracket_type = 'grand_final_reset'
                                  AND m.winner_team_id IS NOT NULL
                                ORDER BY m.id DESC LIMIT 1
                            ),
                            (
                                SELECT m.winner_team_id FROM matches m
                                WHERE m.tournament_id = r.id
                                  AND m.bracket_type IN ('grand_final','final')
                                  AND m.winner_team_id IS NOT NULL
                                ORDER BY m.id DESC LIMIT 1
                            ),
                            (
                                SELECT m.winner_team_id FROM matches m
                                WHERE m.tournament_id = r.id
                                  AND m.winner_team_id IS NOT NULL
                                ORDER BY m.id DESC LIMIT 1
                            )
                        ) AS winner_ref_id
                    FROM recent r
                )
                SELECT 
                    w.tournament_id AS id,
                    w.tournament_name,
                    w.game,
                    w.date,
                    COALESCE(tt.name, u.username, tp.name) AS winner_name,
                    CASE 
                        WHEN tt.id IS NOT NULL THEN tt.id
                        WHEN u.id IS NOT NULL THEN u.id
                        ELSE NULL
                    END AS winner_id,
                    ('$' || COALESCE(t.prize_pool, '50000')) AS prize
                FROM winners w
                JOIN tournaments t ON t.id = w.tournament_id
                LEFT JOIN tournament_teams tt ON tt.id = w.winner_ref_id
                LEFT JOIN tournament_participants tp ON tp.id = w.winner_ref_id
                LEFT JOIN users u ON u.id = tp.user_id
                ORDER BY w.date DESC NULLS LAST, w.tournament_id DESC
            `, [limit]);

            return result.rows;
        } catch (error) {
            console.error('Ошибка при получении победителей:', error);
            throw error;
        }
    }

    /**
     * 🆕 АВТОМАТИЧЕСКОЕ ЗАВЕРШЕНИЕ BYE МАТЧЕЙ
     * Завершает все матчи где один или оба участника - BYE
     * @param {number} tournamentId - ID турнира
     * @returns {Object} - Статистика завершенных матчей
     */
    static async _autoCompleteBYEMatches(tournamentId) {
        const pool = require('../../db');
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Получаем все незавершенные матчи турнира
            const matchesResult = await client.query(`
                SELECT id, round, match_number, team1_id, team2_id,
                       winner_team_id, next_match_id, loser_next_match_id,
                       bracket_type, status
                FROM matches
                WHERE tournament_id = $1
                  AND winner_team_id IS NULL
                  AND status = 'pending'
                  AND (team1_id IS NOT NULL OR team2_id IS NOT NULL) -- обрабатываем только матчи с реальным участником
                ORDER BY round, match_number
            `, [tournamentId]);
            
            const matches = matchesResult.rows;
            console.log(`🔍 [_autoCompleteBYEMatches] Найдено ${matches.length} незавершенных матчей`);
            
            const stats = {
                totalProcessed: 0,
                singleBYEMatches: 0,
                doubleBYEMatches: 0,
                regularMatches: 0,
                advancedParticipants: 0
            };
            
            for (const match of matches) {
                const { id, team1_id, team2_id, next_match_id, loser_next_match_id } = match;
                const isSingleBYE = (team1_id && !team2_id) || (!team1_id && team2_id);
                const isDoubleBYE = !team1_id && !team2_id;
                
                stats.totalProcessed++;
                
                if (isSingleBYE) {
                    // Матч с одним реальным участником против BYE
                    const winnerId = team1_id || team2_id;
                    console.log(`🎯 [BYE] Матч ${match.match_number}: Участник ${winnerId} проходит автоматически`);
                    
                    // Завершаем матч победой реального участника
                    await client.query(`
                        UPDATE matches 
                        SET winner_team_id = $1, score1 = 1, score2 = 0, 
                            status = 'completed'
                        WHERE id = $2
                    `, [winnerId, id]);
                    
                    // Продвигаем победителя в следующий матч
                    if (next_match_id) {
                        await this._advanceWinnerToNextMatch(client, winnerId, next_match_id);
                        stats.advancedParticipants++;
                    }
                    
                    stats.singleBYEMatches++;
                    
                } else if (isDoubleBYE) {
                    // Больше не завершаем пустые placeholder-матчи (оба слота NULL)
                    // Пропускаем их, чтобы нижняя сетка оставалась ожидающей входящих участников
                    stats.doubleBYEMatches++;
                } else {
                    // Обычный матч с двумя реальными участниками
                    stats.regularMatches++;
                }
            }
            
            await client.query('COMMIT');
            console.log(`✅ [_autoCompleteBYEMatches] Завершено:`, stats);
            
            // 🆕 Этап 2: автозавершение BYE vs BYE в лузерах, когда все входящие матчи закрыты
            const secondStage = await this._autoCompleteLosersDoubleBYEPlaceholders(tournamentId);
            console.log(`✅ [_autoCompleteBYEMatches] Этап 2 (лузеры BYE vs BYE):`, secondStage);
            
            return { ...stats, secondStage };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [_autoCompleteBYEMatches] Ошибка:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 🆕 ЭТАП 2: Автозавершение матчей BYE vs BYE в нижней сетке,
     * когда все связанные (входящие) матчи уже завершены
     */
    static async _autoCompleteLosersDoubleBYEPlaceholders(tournamentId) {
        const pool = require('../../db');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Выбираем матчи лузеров без участников, ожидающие, для которых нет незавершенных входящих матчей
            const selectRes = await client.query(`
                SELECT m.id
                FROM matches m
                WHERE m.tournament_id = $1
                  AND m.status = 'pending'
                  AND m.team1_id IS NULL AND m.team2_id IS NULL
                  AND m.bracket_type IN ('loser','loser_semifinal','loser_final')
                  AND NOT EXISTS (
                      SELECT 1 FROM matches u
                      WHERE u.tournament_id = m.tournament_id
                        AND (u.loser_next_match_id = m.id OR u.next_match_id = m.id)
                        AND u.status <> 'completed'
                  )
            `, [tournamentId]);

            const ids = selectRes.rows.map(r => r.id);
            let updated = 0;
            if (ids.length) {
                const updRes = await client.query(`
                    UPDATE matches
                    SET status = 'completed', score1 = 0, score2 = 0, maps_data = NULL
                    WHERE id = ANY($1)
                `, [ids]);
                updated = updRes.rowCount;
            }

            await client.query('COMMIT');
            return { placeholdersCompleted: updated, matchIds: ids };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ [_autoCompleteLosersDoubleBYEPlaceholders] Ошибка:', error.message);
            return { placeholdersCompleted: 0, error: error.message };
        } finally {
            client.release();
        }
    }

    /**
     * 🎯 Продвижение победителя в следующий матч
     */
    static async _advanceWinnerToNextMatch(client, winnerId, nextMatchId) {
        // Определяем свободную позицию в следующем матче
        const nextMatchResult = await client.query(
            'SELECT team1_id, team2_id FROM matches WHERE id = $1',
            [nextMatchId]
        );
        
        if (nextMatchResult.rows.length === 0) {
            console.warn(`⚠️ Следующий матч ${nextMatchId} не найден`);
            return;
        }
        
        const nextMatch = nextMatchResult.rows[0];
        
        if (!nextMatch.team1_id) {
            // Размещаем в первую позицию
            await client.query(
                'UPDATE matches SET team1_id = $1 WHERE id = $2',
                [winnerId, nextMatchId]
            );
            console.log(`   ↗️ Участник ${winnerId} размещен в team1 матча ${nextMatchId}`);
        } else if (!nextMatch.team2_id) {
            // Размещаем во вторую позицию
            await client.query(
                'UPDATE matches SET team2_id = $1 WHERE id = $2',
                [winnerId, nextMatchId]
            );
            console.log(`   ↗️ Участник ${winnerId} размещен в team2 матча ${nextMatchId}`);
        } else {
            console.warn(`⚠️ Матч ${nextMatchId} уже заполнен: team1=${nextMatch.team1_id}, team2=${nextMatch.team2_id}`);
        }
    }

    /**
     * 🔄 Продвижение BYE в следующий матч
     */
    static async _advanceBYEToNextMatch(client, nextMatchId) {
        // Для BYE матчей просто логируем - следующий матч останется с незаполненными позициями
        console.log(`   ↗️ BYE передан в матч ${nextMatchId} (позиция останется пустой)`);
        // В реальности BYE не добавляется в следующий матч - позиция остается NULL
    }
}

module.exports = TournamentService; 