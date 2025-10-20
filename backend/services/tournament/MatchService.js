// backend/services/tournament/MatchService.js

const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const MatchRepository = require('../../repositories/tournament/MatchRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');
const pool = require('../../db');
const FullMixService = require('./FullMixService');
const { sendSystemNotification } = require('../../utils/systemNotifications');

class MatchService {
    /**
     * Обновление результата матча в рамках турнира
     */
    static async updateMatchResult(tournamentId, resultData, userId) {
        console.log(`🏆 MatchService: Обновление результата матча в турнире ${tournamentId}`);
        
        const { matchId, winner_team_id, score1, score2, maps } = resultData;
        
        // Проверка прав доступа
        await this._checkMatchAccess(tournamentId, userId);

        // Проверка существования матча
        const match = await MatchRepository.getById(matchId);
        if (!match || match.tournament_id !== tournamentId) {
            throw new Error('Матч не найден или не принадлежит турниру');
        }

        // Проверяем, изменились ли данные матча
        const scoreChanged = match.score1 !== score1 || match.score2 !== score2;
        const mapsChanged = maps && Array.isArray(maps) && maps.length > 0;
        
        if (match.winner_team_id === winner_team_id && !scoreChanged && !mapsChanged) {
            throw new Error('Результат матча не изменился');
        }

        // Подготовка данных о картах
        let mapsData = null;
        
        // Получаем турнир для проверки игры
        const tournament = await TournamentRepository.getById(tournamentId);
        const isGameSupportingMaps = this._isGameSupportingMaps(tournament.game);
        
        if (Array.isArray(maps) && maps.length > 0 && isGameSupportingMaps) {
            console.log(`✅ Сохраняем данные о картах для игры: ${tournament.game}`);
            mapsData = maps;
            
            // Пересчитываем общий счет на основе выигранных карт
            if (maps.length > 1) {
                let team1Wins = 0;
                let team2Wins = 0;
                
                maps.forEach(map => {
                    if (parseInt(map.score1) > parseInt(map.score2)) {
                        team1Wins++;
                    } else if (parseInt(map.score2) > parseInt(map.score1)) {
                        team2Wins++;
                    }
                });
                
                // Обновляем счет на основе карт
                resultData.score1 = team1Wins;
                resultData.score2 = team2Wins;
                
                // Определяем победителя на основе количества выигранных карт
                if (team1Wins > team2Wins) {
                    resultData.winner_team_id = match.team1_id;
                } else if (team2Wins > team1Wins) {
                    resultData.winner_team_id = match.team2_id;
                }
            }
        }

        // 🔥 Используем безопасную функцию обновления результата матча
        const updateResult = await this._safeUpdateMatchResult(
            matchId, 
            resultData.winner_team_id, 
            resultData.score1, 
            resultData.score2, 
            mapsData, 
            userId
        );

        // Получаем обновленные данные турнира
        const updatedTournament = await TournamentRepository.getByIdWithCreator(tournamentId);

        // Отправляем обновления через WebSocket
        try {
            const { broadcastToTournament } = require('../../socketio-server');
            broadcastToTournament(tournamentId, 'fullmix_match_updated', { tournamentId, matchId, round: match.round });
        } catch (_) {}
        broadcastTournamentUpdate(tournamentId, updatedTournament, 'updateMatchResult');

        // Отправляем объявление в чат турнира
        await this._sendMatchResultAnnouncement(match, resultData, tournament);

        // 🆕 ДЛЯ FULL MIX SE/DE: ОБРАБОТКА ВЫБЫВАНИЯ УЧАСТНИКОВ
        await this._handleFullMixElimination(tournament, match, resultData.winner_team_id);

        console.log('✅ MatchService: Результат матча обновлен');
        return { 
            tournament: updatedTournament,
            ...updateResult
        };
    }

    /**
     * Обновление результата конкретного матча (альтернативный endpoint)
     */
    static async updateSpecificMatchResult(matchId, resultData, userId) {
        console.log(`🎯 MatchService: Обновление результата матча ${matchId}`);
        console.log(`📊 Полученные данные:`, {
            winner_team_id: resultData.winner_team_id,
            winner: resultData.winner,
            score1: resultData.score1,
            score2: resultData.score2,
            maps_data: resultData.maps_data
        });
        
        // Получаем матч и его турнир
        const match = await MatchRepository.getById(matchId);
        if (!match) {
            throw new Error('Матч не найден');
        }

        const tournamentId = match.tournament_id;
        
        // Проверка прав доступа
        await this._checkMatchAccess(tournamentId, userId);

        // 🔧 ИСПРАВЛЕНИЕ: Определяем winner_team_id если не передан напрямую
        let finalWinnerTeamId = resultData.winner_team_id;
        
        if (!finalWinnerTeamId && resultData.winner && match.team1_id && match.team2_id) {
            if (resultData.winner === 'team1') {
                finalWinnerTeamId = match.team1_id;
            } else if (resultData.winner === 'team2') {
                finalWinnerTeamId = match.team2_id;
            }
            console.log(`🔄 Преобразован winner "${resultData.winner}" в winner_team_id: ${finalWinnerTeamId}`);
        }

        console.log(`🏆 Итоговый winner_team_id: ${finalWinnerTeamId}`);

        // Проверяем, изменились ли данные матча
        const scoreChanged = match.score1 !== resultData.score1 || match.score2 !== resultData.score2;
        const mapsChanged = resultData.maps_data && Array.isArray(resultData.maps_data) && resultData.maps_data.length > 0;
        
        if (match.winner_team_id === finalWinnerTeamId && !scoreChanged && !mapsChanged) {
            throw new Error('Результат матча не изменился');
        }

        // 🛡️ ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ЦЕЛОСТНОСТИ (быстрая, без транзакции)
        const client = await pool.connect();
        try {
            // Получаем расширенные данные матча для проверки
            const matchWithLinks = await client.query(
                `SELECT m.*, t.format as tournament_format 
                 FROM matches m 
                 JOIN tournaments t ON m.tournament_id = t.id 
                 WHERE m.id = $1`,
                [matchId]
            );
            
            if (matchWithLinks.rows.length > 0) {
                await this._validateTournamentIntegrity(client, matchWithLinks.rows[0], finalWinnerTeamId, resultData.score1, resultData.score2);
            }
        } finally {
            client.release();
        }

        // 🔥 Используем безопасную функцию обновления результата матча
        const updateResult = await this._safeUpdateMatchResult(
            matchId, 
            finalWinnerTeamId,  // ✅ Передаем исправленный winner_team_id
            resultData.score1, 
            resultData.score2, 
            resultData.maps_data, 
            userId
        );

        // Получаем обновленные данные турнира
        const updatedTournament = await TournamentRepository.getByIdWithCreator(tournamentId);

        // Отправляем обновления через WebSocket
        try {
            const { broadcastToTournament } = require('../../socketio-server');
            broadcastToTournament(tournamentId, 'fullmix_match_updated', { tournamentId, matchId, round: match.round });
        } catch (_) {}
        broadcastTournamentUpdate(tournamentId, updatedTournament, 'updateSpecificMatchResult');

        // 📊 НОВОЕ v4.28.0: Обновление статистики турнира после завершения матча
        try {
            console.log(`📊 [MatchService] Запуск обновления статистики турнира ${tournamentId}`);
            const TournamentStatsService = require('./TournamentStatsService');
            await TournamentStatsService.updateStatsAfterMatch(matchId, tournamentId);
            console.log(`✅ [MatchService] Статистика турнира ${tournamentId} обновлена`);
        } catch (statsError) {
            // Не прерываем выполнение, если ошибка в статистике
            console.error(`⚠️ [MatchService] Ошибка обновления статистики турнира:`, statsError);
        }

        console.log('✅ MatchService: Результат матча обновлен');
        return { 
            tournament: updatedTournament,
            ...updateResult
        };
    }

    /**
     * Получение матчей турнира
     */
    static async getMatches(tournamentId) {
        console.log(`📋 MatchService: Получение матчей турнира ${tournamentId}`);
        return await MatchRepository.getByTournamentId(tournamentId);
    }

    /**
     * 🔄 Алиас для getMatches (обратная совместимость)
     */
    static async getMatchesByTournament(tournamentId) {
        console.log(`🔄 MatchService: Алиас getMatchesByTournament перенаправляет на getMatches для турнира ${tournamentId}`);
        return await this.getMatches(tournamentId);
    }

    /**
     * Получение конкретного матча
     */
    static async getMatchById(matchId) {
        console.log(`🔍 MatchService: Получение матча ${matchId}`);
        return await MatchRepository.getById(matchId);
    }

    /**
     * 🔄 Редактирование завершенного матча с ограничениями
     * @param {number} matchId - ID матча
     * @param {Object} editData - Данные для редактирования
     * @param {number} userId - ID пользователя
     * @returns {Object} Результат редактирования
     */
    static async editCompletedMatch(matchId, editData, userId) {
        console.log(`✏️ [MatchService] Редактирование завершенного матча ${matchId}`);
        console.log(`📊 Данные для редактирования:`, {
            maps_data: editData.maps_data?.length || 0,
            userId
        });

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. Получаем данные матча
            const matchResult = await client.query(
                `SELECT m.*, t.format as tournament_format, t.id as tournament_id
                 FROM matches m 
                 JOIN tournaments t ON m.tournament_id = t.id 
                 WHERE m.id = $1`,
                [matchId]
            );
            
            if (matchResult.rows.length === 0) {
                throw new Error('Матч не найден');
            }
            
            const match = matchResult.rows[0];
            console.log(`✅ Матч найден: ${match.team1_id} vs ${match.team2_id}, статус: ${match.status}`);
            
            // 2. Проверка прав доступа
            await this._checkMatchAccess(match.tournament_id, userId);
            
            // 3. Проверяем, что матч завершен
            if (match.status !== 'completed') {
                throw new Error('Можно редактировать только завершенные матчи');
            }
            
            // 4. Проверяем наличие всех участников
            if (!match.team1_id || !match.team2_id) {
                throw new Error('Не все участники матча определены. Редактирование невозможно.');
            }
            
            // 5. Проверяем, есть ли последующие матчи, которые уже сыграны
            const hasPlayedNextMatches = await this._checkPlayedNextMatches(client, match);
            
            console.log(`🔍 Проверка последующих матчей:`, {
                hasPlayedNextMatches,
                next_match_id: match.next_match_id,
                loser_next_match_id: match.loser_next_match_id
            });
            
            // 6. Если есть сыгранные следующие матчи, разрешаем только редактирование карт
            if (hasPlayedNextMatches) {
                console.log(`⚠️ Есть сыгранные следующие матчи. Разрешено только редактирование счета на картах.`);
                
                // Проверяем, что пытаются изменить только данные карт
                if (editData.winner_team_id && editData.winner_team_id !== match.winner_team_id) {
                    throw new Error('Нельзя изменить победителя матча, так как уже сыграны следующие матчи с участием команд из этого матча');
                }
                
                // Обновляем только данные карт
                if (editData.maps_data && Array.isArray(editData.maps_data)) {
                    await client.query(
                        `UPDATE matches SET maps_data = $1 WHERE id = $2`,
                        [JSON.stringify(editData.maps_data), matchId]
                    );
                    
                    console.log(`✅ Обновлены данные карт для матча ${matchId}`);
                }
            } else {
                // 7. Если нет сыгранных следующих матчей, разрешаем полное редактирование
                console.log(`✅ Нет сыгранных следующих матчей. Разрешено полное редактирование.`);
                
                let finalWinnerId = editData.winner_team_id || match.winner_team_id;
                let finalScore1 = editData.score1 !== undefined ? editData.score1 : match.score1;
                let finalScore2 = editData.score2 !== undefined ? editData.score2 : match.score2;
                let mapsData = editData.maps_data || match.maps_data;
                
                // Пересчитываем счет на основе карт, если есть несколько карт
                if (Array.isArray(mapsData) && mapsData.length > 1) {
                    let team1Wins = 0;
                    let team2Wins = 0;
                    
                    mapsData.forEach(map => {
                        const m1 = parseInt(map.score1 || map.team1_score || 0);
                        const m2 = parseInt(map.score2 || map.team2_score || 0);
                        if (m1 > m2) team1Wins++;
                        else if (m2 > m1) team2Wins++;
                    });
                    
                    finalScore1 = team1Wins;
                    finalScore2 = team2Wins;
                    
                    // Определяем победителя
                    if (team1Wins > team2Wins) finalWinnerId = match.team1_id;
                    else if (team2Wins > team1Wins) finalWinnerId = match.team2_id;
                }
                
                // Обновляем результат матча
                await client.query(
                    `UPDATE matches 
                     SET winner_team_id = $1, score1 = $2, score2 = $3, maps_data = $4
                     WHERE id = $5`,
                    [finalWinnerId, finalScore1, finalScore2, JSON.stringify(mapsData), matchId]
                );
                
                console.log(`✅ Полностью обновлен матч ${matchId}: winner=${finalWinnerId}, score=${finalScore1}:${finalScore2}`);
                
                // 8. Обновляем последующие матчи, если изменился победитель
                if (finalWinnerId !== match.winner_team_id) {
                    await this._updateNextMatches(client, match, finalWinnerId);
                }
            }
            
            // 9. Логируем событие
            await logTournamentEvent(match.tournament_id, userId, 'match_edited', { 
                matchId, 
                hasPlayedNextMatches,
                editedFields: hasPlayedNextMatches ? ['maps_data'] : ['winner', 'score', 'maps_data']
            });
            
            await client.query('COMMIT');
            
            // 10. Получаем обновленный матч
            const updatedMatch = await MatchRepository.getById(matchId);
            
            // 11. Отправляем обновление через WebSocket
            broadcastTournamentUpdate(match.tournament_id, { matchId, updated: true }, 'matchEdited');
            
            console.log(`✅ Матч ${matchId} успешно отредактирован`);
            
            return {
                success: true,
                match: updatedMatch,
                limitedEdit: hasPlayedNextMatches,
                message: hasPlayedNextMatches 
                    ? 'Изменены только данные карт, так как уже сыграны следующие матчи'
                    : 'Матч полностью отредактирован'
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ Ошибка редактирования матча ${matchId}:`, error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Проверка наличия сыгранных последующих матчей
     * @private
     */
    static async _checkPlayedNextMatches(client, match) {
        const nextMatchIds = [];
        
        if (match.next_match_id) nextMatchIds.push(match.next_match_id);
        if (match.loser_next_match_id) nextMatchIds.push(match.loser_next_match_id);
        
        if (nextMatchIds.length === 0) {
            return false;
        }
        
        const result = await client.query(
            `SELECT id, status, winner_team_id 
             FROM matches 
             WHERE id = ANY($1::int[]) 
             AND status = 'completed' 
             AND winner_team_id IS NOT NULL`,
            [nextMatchIds]
        );
        
        return result.rows.length > 0;
    }

    /**
     * Обновление последующих матчей при изменении победителя
     * @private
     */
    static async _updateNextMatches(client, match, newWinnerId) {
        console.log(`🔄 Обновление последующих матчей для матча ${match.id}, новый победитель: ${newWinnerId}`);
        
        const oldWinnerId = match.winner_team_id;
        const loserId = oldWinnerId === match.team1_id ? match.team2_id : match.team1_id;
        const newLoserId = newWinnerId === match.team1_id ? match.team2_id : match.team1_id;
        
        // Обновляем матч победителя
        if (match.next_match_id) {
            await client.query(
                `UPDATE matches 
                 SET team1_id = CASE WHEN team1_id = $1 THEN $2 ELSE team1_id END,
                     team2_id = CASE WHEN team2_id = $1 THEN $2 ELSE team2_id END
                 WHERE id = $3 AND status != 'completed'`,
                [oldWinnerId, newWinnerId, match.next_match_id]
            );
            console.log(`✅ Обновлен матч победителя: ${match.next_match_id}`);
        }
        
        // Обновляем матч проигравшего (для Double Elimination)
        if (match.loser_next_match_id) {
            await client.query(
                `UPDATE matches 
                 SET team1_id = CASE WHEN team1_id = $1 THEN $2 ELSE team1_id END,
                     team2_id = CASE WHEN team2_id = $1 THEN $2 ELSE team2_id END
                 WHERE id = $3 AND status != 'completed'`,
                [loserId, newLoserId, match.loser_next_match_id]
            );
            console.log(`✅ Обновлен матч проигравшего: ${match.loser_next_match_id}`);
        }
    }

    /**
     * 🔥 УПРОЩЕННАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ РЕЗУЛЬТАТА МАТЧА (БЕЗ ТАЙМАУТОВ)
     * @private
     */
    static async _safeUpdateMatchResult(matchId, winnerId, score1, score2, mapsData, userId) {
        console.log(`🔒 [safeUpdateMatchResult] НАЧАЛО ФУНКЦИИ для матча ${matchId}`);
        console.log(`   - Winner ID: ${winnerId}`);
        console.log(`   - Score: ${score1}:${score2}`);
        console.log(`   - User ID: ${userId}`);
        console.log(`   - Maps data:`, mapsData);
        
        const startTime = Date.now();
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            console.log(`🔄 [safeUpdateMatchResult] Транзакция начата`);
            
            // 1. Простое получение данных матча без блокировки
            console.log(`🔍 [safeUpdateMatchResult] Получаем данные матча ${matchId}...`);
            const matchResult = await client.query(
                `SELECT m.*, t.format as tournament_format 
                 FROM matches m 
                 JOIN tournaments t ON m.tournament_id = t.id 
                 WHERE m.id = $1`,
                [matchId]
            );
            
            if (matchResult.rows.length === 0) {
                throw new Error(`Матч ${matchId} не найден`);
            }
            
            const matchData = matchResult.rows[0];
            console.log(`✅ [safeUpdateMatchResult] Матч получен: ${matchData.team1_id} vs ${matchData.team2_id}`);
            console.log(`🔍 [safeUpdateMatchResult] Диагностика связей: next_match_id=${matchData.next_match_id}, loser_next_match_id=${matchData.loser_next_match_id}, round=${matchData.round}, match_number=${matchData.match_number}`);
            
            // 🔧 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Если next_match_id null, проверим в базе еще раз
            if (!matchData.next_match_id) {
                console.log(`🔍 [safeUpdateMatchResult] next_match_id = null, проверяем связи в базе...`);
                const linkCheckResult = await client.query(
                    `SELECT m1.id, m1.round, m1.match_number, m1.next_match_id,
                            m2.id as target_match_id, m2.round as target_round, m2.match_number as target_match_number
                     FROM matches m1
                     LEFT JOIN matches m2 ON m1.next_match_id = m2.id
                     WHERE m1.id = $1`,
                    [matchId]
                );
                
                if (linkCheckResult.rows.length > 0) {
                    const linkInfo = linkCheckResult.rows[0];
                    console.log(`🔍 [safeUpdateMatchResult] Связи матча:`, {
                        match_id: linkInfo.id,
                        round: linkInfo.round,
                        match_number: linkInfo.match_number,
                        next_match_id: linkInfo.next_match_id,
                        target_exists: !!linkInfo.target_match_id,
                        target_round: linkInfo.target_round,
                        target_match_number: linkInfo.target_match_number
                    });
                    
                    // Обновляем matchData если найден next_match_id
                    if (linkInfo.next_match_id && !matchData.next_match_id) {
                        matchData.next_match_id = linkInfo.next_match_id;
                        console.log(`🔄 [safeUpdateMatchResult] Обновлен next_match_id из дополнительного запроса: ${linkInfo.next_match_id}`);
                    }
                }
            }

            // 🛡️ ПРОВЕРКА ЦЕЛОСТНОСТИ ТУРНИРНОЙ СЕТКИ
            await this._validateTournamentIntegrity(client, matchData, winnerId, score1, score2);
            
            // 2. Атомарное обновление результата матча
            console.log(`💾 [safeUpdateMatchResult] Обновляем результат матча ${matchId}...`);
            const updateResult = await client.query(
                `UPDATE matches 
                 SET winner_team_id = $1, score1 = $2, score2 = $3, maps_data = $4
                 WHERE id = $5 AND (winner_team_id IS NULL OR winner_team_id != $1 OR score1 != $2 OR score2 != $3)
                 RETURNING *`,
                [winnerId, score1, score2, JSON.stringify(mapsData), matchId]
            );
            
            let matchWasUpdated = false;
            if (updateResult.rows.length === 0) {
                console.log(`⚠️ [safeUpdateMatchResult] Результат не изменился, но проверяем продвижение команд...`);
                // Получаем текущие данные матча даже если обновления не было
                const currentMatchResult = await client.query(
                    'SELECT * FROM matches WHERE id = $1',
                    [matchId]
                );
                if (currentMatchResult.rows.length === 0) {
                    throw new Error(`Матч ${matchId} не найден после попытки обновления`);
                }
                matchWasUpdated = false;
            } else {
                console.log(`✅ [safeUpdateMatchResult] Результат матча обновлен`);
                matchWasUpdated = true;
            }
            
            // 🎮 FEEDBACK: Создать pending feedback для всех участников матча
            try {
                if (winnerId && matchData.team1_id && matchData.team2_id) {
                    const participantsResult = await client.query(`
                        SELECT DISTINCT ttm.user_id
                        FROM tournament_team_members ttm
                        WHERE ttm.team_id IN ($1, $2)
                    `, [matchData.team1_id, matchData.team2_id]);
                    
                    for (const participant of participantsResult.rows) {
                        await client.query(`
                            INSERT INTO match_feedback_pending (match_id, user_id)
                            VALUES ($1, $2)
                            ON CONFLICT (match_id, user_id) DO NOTHING
                        `, [matchId, participant.user_id]);
                    }
                    
                    console.log(`📝 [Match Feedback] Создано ${participantsResult.rows.length} pending feedback запросов для матча ${matchId}`);
                }
            } catch (feedbackError) {
                console.error('⚠️ [Match Feedback] Ошибка создания pending:', feedbackError);
                // Не падаем, это некритично
            }

            // 2.1. 🆕 Принудительное завершение BYE vs BYE и матчей без winner: статус -> completed
            const shouldSoftComplete = (!winnerId) && (!matchData.team1_id && !matchData.team2_id);
            if ((winnerId || shouldSoftComplete) && matchData.status !== 'completed') {
                console.log(`📝 [safeUpdateMatchResult] Устанавливаем статус 'completed' (winnerId=${winnerId || 'null'}, BYEvsBYE=${shouldSoftComplete})`);
                await client.query('UPDATE matches SET status = $1 WHERE id = $2', ['completed', matchId]);
                matchWasUpdated = true;
            }

            // 3. Продвижение команд (выполняется ВСЕГДА если есть winner_team_id)
            let advancementResults = [];
            
            if (winnerId && matchData.next_match_id) {
                console.log(`🏆 [safeUpdateMatchResult] Продвигаем победителя ${winnerId} в матч ${matchData.next_match_id}...`);
                const advanceResult = await this._simpleAdvanceTeam(
                    winnerId, 
                    matchData.next_match_id, 
                    'winner',
                    client
                );
                advancementResults.push(advanceResult);
                
                if (advanceResult.advanced) {
                    console.log(`✅ [safeUpdateMatchResult] Победитель успешно продвинут в ${advanceResult.position} матча ${advanceResult.targetMatchId}`);
                    if (advanceResult.isMatchReady) {
                        console.log(`🏁 [safeUpdateMatchResult] Матч ${advanceResult.targetMatchId} готов к игре! Участники: ${advanceResult.matchDetails.team1_id} vs ${advanceResult.matchDetails.team2_id}`);
                    }
                } else {
                    console.log(`❌ [safeUpdateMatchResult] Не удалось продвинуть победителя: ${advanceResult.reason}`);
                }
            } else {
                if (!winnerId) {
                    console.log(`⚠️ [safeUpdateMatchResult] Нет winner_team_id для продвижения`);
                } else if (!matchData.next_match_id) {
                    console.log(`⚠️ [safeUpdateMatchResult] У матча ${matchId} нет next_match_id (возможно, финальный матч)`);
                    // Проверим в базе данных
                    const matchCheckResult = await client.query(
                        'SELECT next_match_id, round, match_number FROM matches WHERE id = $1',
                        [matchId]
                    );
                    if (matchCheckResult.rows.length > 0) {
                        const matchInfo = matchCheckResult.rows[0];
                        console.log(`🔍 [safeUpdateMatchResult] Данные матча: раунд ${matchInfo.round}, матч №${matchInfo.match_number}, next_match_id=${matchInfo.next_match_id}`);
                    }
                }
            }

            // 4. Продвижение проигравшего (для double elimination)
            if (matchData.loser_next_match_id && winnerId) {
                const loserId = matchData.team1_id === winnerId ? matchData.team2_id : matchData.team1_id;
                console.log(`💔 [safeUpdateMatchResult] Продвигаем проигравшего ${loserId} в матч ${matchData.loser_next_match_id}...`);
                const loserAdvanceResult = await this._simpleAdvanceTeam(
                    loserId, 
                    matchData.loser_next_match_id, 
                    'loser',
                    client
                );
                advancementResults.push(loserAdvanceResult);
                
                if (loserAdvanceResult.advanced) {
                    console.log(`✅ [safeUpdateMatchResult] Проигравший успешно продвинут в ${loserAdvanceResult.position} матча ${loserAdvanceResult.targetMatchId}`);
                    if (loserAdvanceResult.isMatchReady) {
                        console.log(`🏁 [safeUpdateMatchResult] Матч ${loserAdvanceResult.targetMatchId} готов к игре! Участники: ${loserAdvanceResult.matchDetails.team1_id} vs ${loserAdvanceResult.matchDetails.team2_id}`);
                    }
                } else {
                    console.log(`❌ [safeUpdateMatchResult] Не удалось продвинуть проигравшего: ${loserAdvanceResult.reason}`);
                }
            }

            // 5. Простое логирование события
            console.log(`📝 [safeUpdateMatchResult] Логируем событие...`);
            await logTournamentEvent(matchData.tournament_id, userId, 'match_completed', {
                match_id: matchId,
                winner_team_id: winnerId,
                score: `${score1}:${score2}`,
                maps_count: mapsData?.length || 0,
                match_updated: matchWasUpdated
            }, client);

            // 6. Коммит транзакции
            await client.query('COMMIT');
            
            const duration = Date.now() - startTime;
            console.log(`🎉 [safeUpdateMatchResult] УСПЕШНО ЗАВЕРШЕНО за ${duration}ms`);
            
            // 🛎️ ПОСЛЕ КОММИТА: Оповещение админов о завершении раунда в FULL MIX
            try {
                const roundNumber = matchData.round;
                const tournamentId = matchData.tournament_id;
                if (matchData.tournament_format === 'full_mix' && roundNumber) {
                    const isCompleted = await FullMixService.isRoundCompleted(tournamentId, roundNumber);
                    if (isCompleted) {
                        // Получаем админов и создателя
                        const admins = await TournamentRepository.getAdmins(tournamentId);
                        const tInfo = await TournamentRepository.getById(tournamentId);
                        const recipients = new Set();
                        if (tInfo?.created_by) recipients.add(tInfo.created_by);
                        (admins || []).forEach(a => a?.user_id && recipients.add(a.user_id));

                        const message = `✅ Раунд ${roundNumber} завершен. Можно начинать следующий раунд.`;
                        const metadata = {
                            type: 'fullmix_round_completed',
                            round_number: roundNumber,
                            tournament_id: tournamentId,
                            action: 'generate_next_round'
                        };

                        // Личные системные уведомления
                        for (const userId of recipients) {
                            await sendSystemNotification(userId, message, 'fullmix_round_completed', metadata);
                        }

                        // Анонс в чат турнира
                        await sendTournamentChatAnnouncement(
                            tournamentId,
                            `✅ Все матчи раунда ${roundNumber} сыграны. Администраторы могут запустить следующий раунд.`
                        );

                        // Широковещательное обновление
                        await broadcastTournamentUpdate(tournamentId, { event: 'fullmix_round_completed', round: roundNumber }, 'fullmix');
                    }
                }
            } catch (notifErr) {
                console.warn('⚠️ [safeUpdateMatchResult] Не удалось отправить оповещение о завершении раунда:', notifErr?.message || notifErr);
            }

            return {
                success: true,
                message: matchWasUpdated ? 'Результат матча обновлен успешно' : 'Результат матча не изменился, но продвижение выполнено',
                duration: duration,
                updated: matchWasUpdated,
                advancementResults,
                advancementCount: advancementResults.filter(r => r.advanced).length
            };

        } catch (error) {
            console.log(`❌ [safeUpdateMatchResult] ОШИБКА:`, error.message);
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 🚀 УПРОЩЕННАЯ ФУНКЦИЯ ПРОДВИЖЕНИЯ КОМАНДЫ (для предустановленной структуры)
     * @private
     */
    static async _simpleAdvanceTeam(teamId, targetMatchId, advanceType, client) {
        console.log(`🚀 [simpleAdvanceTeam] Продвижение команды ${teamId} в предустановленный матч ${targetMatchId} (${advanceType})`);
        
        try {
            // Получаем целевой матч
            const targetMatchResult = await client.query(
                'SELECT id, team1_id, team2_id, round, match_number FROM matches WHERE id = $1',
                [targetMatchId]
            );
            
            if (targetMatchResult.rows.length === 0) {
                console.log(`⚠️ [simpleAdvanceTeam] Целевой матч ${targetMatchId} не найден`);
                return { advanced: false, reason: 'target_match_not_found' };
            }
            
            const targetMatch = targetMatchResult.rows[0];
            console.log(`🎯 [simpleAdvanceTeam] Целевой матч: раунд ${targetMatch.round}, матч №${targetMatch.match_number}`);
            console.log(`🎯 [simpleAdvanceTeam] Текущие участники: team1_id=${targetMatch.team1_id}, team2_id=${targetMatch.team2_id}`);
            
            // Проверяем, не находится ли команда уже в матче
            if (targetMatch.team1_id === teamId || targetMatch.team2_id === teamId) {
                console.log(`✅ [simpleAdvanceTeam] Команда ${teamId} уже в матче ${targetMatchId}`);
                return { advanced: false, reason: 'already_in_match' };
            }
            
            // 🆕 НОВАЯ УПРОЩЕННАЯ ЛОГИКА: Определяем позицию для команды
            let updateField = null;
            let updateValue = teamId;
            
            // Заполняем первую свободную позицию
            if (!targetMatch.team1_id) {
                updateField = 'team1_id';
                console.log(`🎯 [simpleAdvanceTeam] Ставим команду ${teamId} в позицию team1_id`);
            } else if (!targetMatch.team2_id) {
                updateField = 'team2_id';
                console.log(`🎯 [simpleAdvanceTeam] Ставим команду ${teamId} в позицию team2_id`);
            } else {
                console.log(`⚠️ [simpleAdvanceTeam] Обе позиции в матче ${targetMatchId} уже заняты (team1: ${targetMatch.team1_id}, team2: ${targetMatch.team2_id})`);
                console.log(`🤔 [simpleAdvanceTeam] Это неожиданно в предустановленной структуре - возможна ошибка генерации`);
                return { advanced: false, reason: 'unexpected_match_full' };
            }
            
            // 🔧 АТОМАРНОЕ ОБНОВЛЕНИЕ
            const updateResult = await client.query(
                `UPDATE matches 
                 SET ${updateField} = $1
                 WHERE id = $2 AND ${updateField} IS NULL
                 RETURNING id, team1_id, team2_id, round, match_number`,
                [updateValue, targetMatchId]
            );
            
            if (updateResult.rows.length === 0) {
                console.log(`⚠️ [simpleAdvanceTeam] Позиция ${updateField} уже занята в матче ${targetMatchId} (race condition)`);
                return { advanced: false, reason: 'position_taken_race_condition' };
            }
            
            const updatedMatch = updateResult.rows[0];
            console.log(`✅ [simpleAdvanceTeam] Команда ${teamId} успешно продвинута в позицию ${updateField} матча ${targetMatchId}`);
            console.log(`✅ [simpleAdvanceTeam] Обновленный матч: team1_id=${updatedMatch.team1_id}, team2_id=${updatedMatch.team2_id}`);
            
            // Проверяем готовность матча
            const isMatchReady = updatedMatch.team1_id && updatedMatch.team2_id;
            if (isMatchReady) {
                console.log(`🏁 [simpleAdvanceTeam] Матч ${targetMatchId} теперь готов к игре!`);
            } else {
                console.log(`⏳ [simpleAdvanceTeam] Матч ${targetMatchId} ожидает второго участника`);
            }
            
            return {
                advanced: true,
                targetMatchId: targetMatchId,
                position: updateField,
                advanceType: advanceType,
                isMatchReady: isMatchReady,
                matchDetails: {
                    round: updatedMatch.round,
                    matchNumber: updatedMatch.match_number,
                    team1_id: updatedMatch.team1_id,
                    team2_id: updatedMatch.team2_id
                }
            };
            
        } catch (error) {
            console.error(`❌ [simpleAdvanceTeam] Ошибка продвижения команды ${teamId}:`, error.message);
            return { advanced: false, reason: 'database_error', error: error.message };
        }
    }

    /**
     * 🛡️ ПРОВЕРКА ЦЕЛОСТНОСТИ ТУРНИРНОЙ СЕТКИ
     * Запрещает изменение результата матча, если любой из участников уже сыграл следующий матч
     * @private
     */
    static async _validateTournamentIntegrity(client, matchData, winnerId, score1, score2) {
        console.log(`🛡️ [validateTournamentIntegrity] Проверка целостности для матча ${matchData.id}`);
        
        const team1_id = matchData.team1_id;
        const team2_id = matchData.team2_id;
        const matchesToCheck = [];
        
        // Добавляем следующий матч для проверки (winner bracket)
        if (matchData.next_match_id) {
            matchesToCheck.push({
                match_id: matchData.next_match_id,
                type: 'winner_bracket',
                description: 'следующий матч для победителя'
            });
        }
        
        // Добавляем матч для проигравшего (loser bracket в double elimination)
        if (matchData.loser_next_match_id) {
            matchesToCheck.push({
                match_id: matchData.loser_next_match_id,
                type: 'loser_bracket',
                description: 'матч для проигравшего (loser bracket)'
            });
        }
        
        if (matchesToCheck.length === 0) {
            console.log(`✅ [validateTournamentIntegrity] Нет следующих матчей для проверки`);
            return;
        }
        
        for (const checkMatch of matchesToCheck) {
            console.log(`🔍 [validateTournamentIntegrity] Проверяем ${checkMatch.description} (ID: ${checkMatch.match_id})`);
            
            // Получаем данные следующего матча
            const nextMatchResult = await client.query(
                `SELECT id, team1_id, team2_id, winner_team_id, score1, score2, 
                        round, match_number, status, maps_data
                 FROM matches 
                 WHERE id = $1`,
                [checkMatch.match_id]
            );
            
            if (nextMatchResult.rows.length === 0) {
                console.log(`⚠️ [validateTournamentIntegrity] Следующий матч ${checkMatch.match_id} не найден`);
                continue;
            }
            
            const nextMatch = nextMatchResult.rows[0];
            console.log(`🔍 [validateTournamentIntegrity] Следующий матч: ${nextMatch.team1_id} vs ${nextMatch.team2_id}, статус: ${nextMatch.status}`);
            
            // Проверяем участие наших команд в следующем матче
            const ourTeamsInNextMatch = [];
            if (nextMatch.team1_id === team1_id || nextMatch.team1_id === team2_id) {
                ourTeamsInNextMatch.push({ team_id: nextMatch.team1_id, position: 'team1' });
            }
            if (nextMatch.team2_id === team1_id || nextMatch.team2_id === team2_id) {
                ourTeamsInNextMatch.push({ team_id: nextMatch.team2_id, position: 'team2' });
            }
            
            if (ourTeamsInNextMatch.length === 0) {
                console.log(`✅ [validateTournamentIntegrity] Наши команды не участвуют в матче ${checkMatch.match_id}`);
                continue;
            }
            
            console.log(`🎯 [validateTournamentIntegrity] Наши команды в следующем матче:`, ourTeamsInNextMatch);
            
            // Проверяем, завершен ли следующий матч
            const isNextMatchCompleted = this._isMatchCompleted(nextMatch);
            
            if (isNextMatchCompleted) {
                // Следующий матч завершен - нельзя изменять результат текущего матча
                const participantsInfo = ourTeamsInNextMatch.map(p => `команда ${p.team_id} (${p.position})`).join(', ');
                
                const errorMessage = `🚫 Нельзя изменить результат матча ${matchData.id} (раунд ${matchData.round}, матч №${matchData.match_number}), ` +
                    `так как ${participantsInfo} уже сыграли в следующем матче ${nextMatch.id} ` +
                    `(раунд ${nextMatch.round}, матч №${nextMatch.match_number}). ` +
                    `Следующий матч завершен со счетом ${nextMatch.score1}:${nextMatch.score2}`;
                
                console.log(`❌ [validateTournamentIntegrity] ${errorMessage}`);
                throw new Error(errorMessage);
            } else {
                console.log(`✅ [validateTournamentIntegrity] Следующий матч ${checkMatch.match_id} еще не завершен - изменение разрешено`);
            }
        }
        
        console.log(`✅ [validateTournamentIntegrity] Проверка целостности пройдена - изменение результата разрешено`);
    }
    
    /**
     * 🔍 Проверка завершенности матча
     * @private
     */
    static _isMatchCompleted(match) {
        // Матч считается завершенным если:
        // 1. Есть winner_team_id ИЛИ
        // 2. Есть результат (score1 и score2 не null и не равны 0:0) ИЛИ
        // 3. Статус completed/finished ИЛИ
        // 4. Есть данные о картах с результатами
        
        if (match.winner_team_id) {
            return true;
        }
        
        if (match.status === 'completed' || match.status === 'finished') {
            return true;
        }
        
        if (match.score1 !== null && match.score2 !== null && 
            !(match.score1 === 0 && match.score2 === 0)) {
            return true;
        }
        
        if (match.maps_data && Array.isArray(match.maps_data) && match.maps_data.length > 0) {
            // Проверяем есть ли результаты в картах
            const hasMapResults = match.maps_data.some(map => 
                (parseInt(map.score1) || 0) > 0 || (parseInt(map.score2) || 0) > 0
            );
            if (hasMapResults) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Проверка, поддерживает ли игра карты
     * @private
     */
    static _isGameSupportingMaps(gameName) {
        if (!gameName) return false;
        
        return gameName === 'Counter-Strike 2' ||
               gameName === 'Counter Strike 2' ||
               gameName === 'CS2' ||
               gameName === 'cs2' ||
               gameName.toLowerCase().includes('counter') ||
               gameName.toLowerCase().includes('cs') ||
               gameName === 'Valorant' ||
               gameName === 'VALORANT' ||
               gameName.toLowerCase().includes('valorant') ||
               gameName.toLowerCase().includes('overwatch') ||
               gameName.toLowerCase().includes('dota') ||
               gameName.toLowerCase().includes('league');
    }

    /**
     * Отправка объявления о результате матча в чат
     * @private
     */
    static async _sendMatchResultAnnouncement(match, resultData, tournament) {
        try {
            // 🆕 УНИВЕРСАЛЬНАЯ ЛОГИКА: Получаем имена команд/участников в зависимости от типа турнира
            let team1Name, team2Name, winnerName;
            
            console.log(`📢 Отправка уведомления для турнира типа "${tournament.participant_type}"`);
            
            if (tournament.participant_type === 'solo') {
                // Для соло турниров участники из tournament_participants
                const p1 = await pool.query('SELECT name, username FROM tournament_participants WHERE id = $1', [match.team1_id]);
                const p2 = await pool.query('SELECT name, username FROM tournament_participants WHERE id = $1', [match.team2_id]);
                
                team1Name = p1.rows[0]?.name || p1.rows[0]?.username || `Участник ${match.team1_id}`;
                team2Name = p2.rows[0]?.name || p2.rows[0]?.username || `Участник ${match.team2_id}`;
                
                console.log(`✅ Получены имена участников: "${team1Name}" vs "${team2Name}"`);
            } else {
                // Для командных турниров команды из tournament_teams
                const t1 = await pool.query('SELECT name FROM tournament_teams WHERE id = $1', [match.team1_id]);
                const t2 = await pool.query('SELECT name FROM tournament_teams WHERE id = $1', [match.team2_id]);
                
                team1Name = t1.rows[0]?.name || `Команда ${match.team1_id}`;
                team2Name = t2.rows[0]?.name || `Команда ${match.team2_id}`;
                
                console.log(`✅ Получены названия команд: "${team1Name}" vs "${team2Name}"`);
            }
            
            // 🆕 УНИВЕРСАЛЬНОЕ ОПРЕДЕЛЕНИЕ ПОБЕДИТЕЛЯ
            if (resultData.winner_team_id) {
                if (resultData.winner_team_id === match.team1_id) {
                    winnerName = team1Name;
                } else if (resultData.winner_team_id === match.team2_id) {
                    winnerName = team2Name;
                } else {
                    console.warn('⚠️ winner_team_id не совпадает ни с team1_id, ни с team2_id');
                    winnerName = null;
                }
            }
            
            // 🆕 УНИВЕРСАЛЬНОЕ СООБЩЕНИЕ
            const entityType = tournament.participant_type === 'solo' ? 'участников' : 'команд';
            const matchType = tournament.participant_type === 'solo' ? 'Поединок' : 'Матч';
            
            const announcement = `${matchType} ${match.match_number || '№' + match.id} между ${entityType} ${team1Name} и ${team2Name} завершен со счетом ${resultData.score1}:${resultData.score2}${winnerName ? `. Победил: ${winnerName}` : ''}. Ссылка на сетку: /tournaments/${tournament.id}`;
            
            console.log(`📢 Отправляем уведомление: "${announcement}"`);
            
            await sendTournamentChatAnnouncement(tournament.id, announcement);
            
            console.log('✅ Уведомление о результате матча отправлено');
        } catch (error) {
            console.error('❌ Ошибка отправки объявления о результате матча:', error);
        }
    }

    /**
     * Проверка прав доступа для операций с матчами
     * @private
     */
    static async _checkMatchAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (!isAdmin) {
                throw new Error('Только создатель или администратор может обновлять результаты матчей');
            }
        }
    }

    /**
     * 🔄 АЛИАСЫ ДЛЯ СОВМЕСТИМОСТИ С MatchController
     */
    
    // Алиас для saveMatchResult (используется в MatchController)
    static async saveResult(matchId, resultData, userId) {
        console.log(`💾 MatchService: Алиас saveResult -> updateSpecificMatchResult для матча ${matchId}`);
        return await this.updateSpecificMatchResult(matchId, resultData, userId);
    }
    
    // Алиас для getMatches (используется в MatchController)
    static async getByTournamentId(tournamentId) {
        console.log(`📋 MatchService: Алиас getByTournamentId -> getMatches для турнира ${tournamentId}`);
        return await this.getMatches(tournamentId);
    }
    
    // Алиас для getMatchById (используется в MatchController)
    static async getById(matchId) {
        console.log(`🔍 MatchService: Получение матча ${matchId} с информацией об участниках`);
        return await MatchRepository.getByIdWithParticipants(matchId);
    }

    /**
     * 🆕 ОБРАБОТКА ВЫБЫВАНИЯ УЧАСТНИКОВ ДЛЯ FULL MIX SE/DE
     * При поражении команды все её участники выбывают из турнира
     * @private
     */
    static async _handleFullMixElimination(tournament, match, winnerTeamId) {
        try {
            // Проверяем, является ли это Full Mix турниром
            const isFullMix = tournament.format === 'full_mix' || 
                             (tournament.format === 'mix' && tournament.mix_type === 'full');
            
            if (!isFullMix) {
                return; // Не Full Mix - пропускаем
            }
            
            // Проверяем тип сетки
            const isSEorDE = tournament.bracket_type === 'single_elimination' || 
                            tournament.bracket_type === 'double_elimination';
            
            if (!isSEorDE) {
                return; // Не SE/DE - пропускаем (Swiss использует свою логику)
            }
            
            console.log(`🏴 [handleFullMixElimination] Обработка выбывания для Full Mix ${tournament.bracket_type}`);
            
            // Определяем проигравшую команду
            const loserTeamId = winnerTeamId === match.team1_id ? match.team2_id : match.team1_id;
            
            console.log(`📊 Матч: ${match.id}, Победитель: ${winnerTeamId}, Проигравший: ${loserTeamId}`);
            
            // Проверяем, это матч из верхней или нижней сетки (для DE)
            let shouldEliminate = true;
            
            if (tournament.bracket_type === 'double_elimination') {
                // В DE проверяем, есть ли у матча loser_next_match_id
                // Если есть - команда идет в нижнюю сетку, не выбывает
                if (match.loser_next_match_id) {
                    console.log(`⬇️ Команда ${loserTeamId} идет в нижнюю сетку (матч ${match.loser_next_match_id})`);
                    shouldEliminate = false;
                } else {
                    console.log(`🏴 Команда ${loserTeamId} выбывает (матч из нижней сетки или финал)`);
                }
            }
            
            if (!shouldEliminate) {
                return; // Команда не выбывает, идет в нижнюю сетку
            }
            
            // Получаем участников проигравшей команды
            const membersResult = await pool.query(
                `SELECT ttm.participant_id, ttm.user_id, tp.name
                 FROM tournament_team_members ttm
                 LEFT JOIN tournament_participants tp ON tp.id = ttm.participant_id
                 WHERE ttm.team_id = $1`,
                [loserTeamId]
            );
            
            const eliminatedMembers = membersResult.rows;
            
            console.log(`👥 Выбывает ${eliminatedMembers.length} участников команды ${loserTeamId}`);
            
            // Получаем текущий список выбывших из последнего снапшота
            const snapshotResult = await pool.query(
                `SELECT id, snapshot FROM full_mix_snapshots 
                 WHERE tournament_id = $1 
                 ORDER BY round_number DESC 
                 LIMIT 1`,
                [tournament.id]
            );
            
            if (snapshotResult.rows.length > 0) {
                const currentSnapshot = snapshotResult.rows[0].snapshot;
                const currentEliminated = currentSnapshot?.meta?.eliminated || [];
                
                // Добавляем новых выбывших
                const newEliminated = eliminatedMembers.map(m => ({
                    participant_id: m.participant_id,
                    user_id: m.user_id,
                    name: m.name,
                    eliminated_in_round: match.round,
                    eliminated_in_match: match.id,
                    team_id: loserTeamId
                }));
                
                const updatedEliminated = [...currentEliminated, ...newEliminated];
                
                // Обновляем снапшот
                const updatedSnapshot = {
                    ...currentSnapshot,
                    meta: {
                        ...currentSnapshot.meta,
                        eliminated: updatedEliminated
                    }
                };
                
                await pool.query(
                    `UPDATE full_mix_snapshots SET snapshot = $1 WHERE id = $2`,
                    [JSON.stringify(updatedSnapshot), snapshotResult.rows[0].id]
                );
                
                console.log(`✅ Обновлен список выбывших: было ${currentEliminated.length}, стало ${updatedEliminated.length}`);
            }
            
        } catch (error) {
            console.error(`❌ Ошибка при обработке выбывания:`, error);
            // Не прерываем основной процесс
        }
    }
}

module.exports = MatchService; 