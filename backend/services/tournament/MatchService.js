// backend/services/tournament/MatchService.js

const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const MatchRepository = require('../../repositories/tournament/MatchRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');
const pool = require('../../db');

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
        broadcastTournamentUpdate(tournamentId, updatedTournament);

        // Отправляем объявление в чат турнира
        await this._sendMatchResultAnnouncement(match, resultData, tournament);

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
        broadcastTournamentUpdate(tournamentId, updatedTournament);

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

            // 2. Атомарное обновление результата матча
            console.log(`💾 [safeUpdateMatchResult] Обновляем результат матча ${matchId}...`);
            const updateResult = await client.query(
                `UPDATE matches 
                 SET winner_team_id = $1, score1 = $2, score2 = $3, maps_data = $4
                 WHERE id = $5 AND (winner_team_id IS NULL OR winner_team_id != $1 OR score1 != $2 OR score2 != $3)
                 RETURNING *`,
                [winnerId, score1, score2, JSON.stringify(mapsData), matchId]
            );
            
            if (updateResult.rows.length === 0) {
                console.log(`⚠️ [safeUpdateMatchResult] Результат не изменился или матч уже обновлен`);
                await client.query('ROLLBACK');
                return {
                    success: true,
                    message: 'Результат матча не изменился',
                    duration: Date.now() - startTime,
                    updated: false
                };
            }
            
            console.log(`✅ [safeUpdateMatchResult] Результат матча обновлен`);

            // 3. Упрощенное продвижение команд (если необходимо)
            let advancementResults = [];
            
            if (matchData.next_match_id && winnerId) {
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
                maps_count: mapsData?.length || 0
            }, client);

            // 6. Коммит транзакции
            await client.query('COMMIT');
            
            const duration = Date.now() - startTime;
            console.log(`🎉 [safeUpdateMatchResult] УСПЕШНО ЗАВЕРШЕНО за ${duration}ms`);
            
            return {
                success: true,
                message: 'Результат матча обновлен успешно',
                duration: duration,
                updated: true,
                advancementResults
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
     * 🚀 УЛУЧШЕННАЯ ФУНКЦИЯ ПРОДВИЖЕНИЯ КОМАНДЫ
     * @private
     */
    static async _simpleAdvanceTeam(teamId, targetMatchId, advanceType, client) {
        console.log(`🚀 [simpleAdvanceTeam] Продвигаем команду ${teamId} в матч ${targetMatchId} (${advanceType})`);
        
        try {
            // Проверяем текущее состояние целевого матча
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
            
            // 🔧 УЛУЧШЕННАЯ ЛОГИКА: Определяем куда можно поставить команду
            let updateField = null;
            let updateValue = teamId;
            
            // Сначала пытаемся заполнить team1_id, если он пустой
            if (!targetMatch.team1_id) {
                updateField = 'team1_id';
                console.log(`🎯 [simpleAdvanceTeam] Ставим команду ${teamId} в позицию team1_id`);
            } 
            // Если team1_id занят, пытаемся заполнить team2_id
            else if (!targetMatch.team2_id) {
                updateField = 'team2_id';
                console.log(`🎯 [simpleAdvanceTeam] Ставим команду ${teamId} в позицию team2_id`);
            } 
            // Если обе позиции заняты
            else {
                console.log(`⚠️ [simpleAdvanceTeam] Все позиции в матче ${targetMatchId} заняты (team1: ${targetMatch.team1_id}, team2: ${targetMatch.team2_id})`);
                return { advanced: false, reason: 'match_full' };
            }
            
            // 🔧 АТОМАРНОЕ ОБНОВЛЕНИЕ: используем WHERE условие для предотвращения race conditions
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
            
            // 🔧 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Матч готов к игре?
            const isMatchReady = updatedMatch.team1_id && updatedMatch.team2_id;
            if (isMatchReady) {
                console.log(`🏁 [simpleAdvanceTeam] Матч ${targetMatchId} теперь готов к игре!`);
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
        console.log(`🔍 MatchService: Алиас getById -> getMatchById для матча ${matchId}`);
        return await this.getMatchById(matchId);
    }
}

module.exports = MatchService; 