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
        
        // Получаем матч и его турнир
        const match = await MatchRepository.getById(matchId);
        if (!match) {
            throw new Error('Матч не найден');
        }

        const tournamentId = match.tournament_id;
        
        // Проверка прав доступа
        await this._checkMatchAccess(tournamentId, userId);

        // Проверяем, изменились ли данные матча
        const scoreChanged = match.score1 !== resultData.score1 || match.score2 !== resultData.score2;
        const mapsChanged = resultData.maps_data && Array.isArray(resultData.maps_data) && resultData.maps_data.length > 0;
        
        if (match.winner_team_id === resultData.winner_team_id && !scoreChanged && !mapsChanged) {
            throw new Error('Результат матча не изменился');
        }

        // 🔥 Используем безопасную функцию обновления результата матча
        const updateResult = await this._safeUpdateMatchResult(
            matchId, 
            resultData.winner_team_id, 
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
     * 🔥 БЕЗОПАСНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ РЕЗУЛЬТАТА МАТЧА С ТРАНЗАКЦИЯМИ
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
            console.log(`🔄 [safeUpdateMatchResult] Начинаем транзакцию...`);
            await client.query('BEGIN');
            
            // 1. Получаем и блокируем текущий матч с ТАЙМАУТОМ
            console.log(`🔍 [safeUpdateMatchResult] Получаем данные матча ${matchId} с блокировкой...`);
            
            let matchData;
            try {
                // Устанавливаем таймаут на блокировку (5 секунд)
                await client.query('SET statement_timeout = 5000');
                
                const matchResult = await client.query(
                    'SELECT m.*, t.format as tournament_format FROM matches m JOIN tournaments t ON m.tournament_id = t.id WHERE m.id = $1 FOR UPDATE',
                    [matchId]
                );
                
                if (matchResult.rows.length === 0) {
                    throw new Error(`Матч ${matchId} не найден`);
                }
                
                matchData = matchResult.rows[0];
                console.log(`✅ [safeUpdateMatchResult] Матч заблокирован успешно`);
                
            } catch (lockError) {
                console.log(`⚠️ [safeUpdateMatchResult] ОШИБКА БЛОКИРОВКИ: ${lockError.message}`);
                
                // Если блокировка не удалась, пробуем без FOR UPDATE
                const matchResult = await client.query(
                    'SELECT m.*, t.format as tournament_format FROM matches m JOIN tournaments t ON m.tournament_id = t.id WHERE m.id = $1',
                    [matchId]
                );
                
                if (matchResult.rows.length === 0) {
                    throw new Error(`Матч ${matchId} не найден`);
                }
                
                matchData = matchResult.rows[0];
            }
            
            // Сбрасываем таймаут
            await client.query('SET statement_timeout = 0');

            // 2. Обновляем результат матча
            console.log(`💾 [safeUpdateMatchResult] Обновляем результат матча ${matchId}...`);
            
            await client.query(
                'UPDATE matches SET winner_team_id = $1, score1 = $2, score2 = $3, maps_data = $4 WHERE id = $5',
                [winnerId, score1, score2, JSON.stringify(mapsData), matchId]
            );
            
            console.log(`✅ [safeUpdateMatchResult] Результат матча обновлен`);

            // 3. Продвигаем победителя если есть следующий матч
            let advancementResult = null;
            if (matchData.next_match_id) {
                console.log(`🏆 [safeUpdateMatchResult] Продвигаем победителя ${winnerId} в матч ${matchData.next_match_id}...`);
                advancementResult = await this._safeAdvanceWinner(matchId, winnerId, client);
                console.log(`✅ [safeUpdateMatchResult] Победитель продвинут`);
            }

            // 4. Обрабатываем проигравшего (для double elimination)
            let loserAdvancementResult = null;
            const loserId = matchData.team1_id === winnerId ? matchData.team2_id : matchData.team1_id;
            if (matchData.loser_next_match_id) {
                console.log(`💔 [safeUpdateMatchResult] Продвигаем проигравшего ${loserId} в матч ${matchData.loser_next_match_id}...`);
                loserAdvancementResult = await this._safeAdvanceLoser(matchId, loserId, client);
                console.log(`✅ [safeUpdateMatchResult] Проигравший продвинут`);
            }

            // 5. Логируем событие
            console.log(`📝 [safeUpdateMatchResult] Логируем событие...`);
            await logTournamentEvent(matchData.tournament_id, userId, 'match_completed', {
                match_id: matchId,
                winner_team_id: winnerId,
                score: `${score1}:${score2}`,
                maps_count: mapsData?.length || 0
            }, client);

            // 6. Коммитим транзакцию
            console.log(`✅ [safeUpdateMatchResult] Коммитим транзакцию...`);
            await client.query('COMMIT');
            
            const duration = Date.now() - startTime;
            console.log(`🎉 [safeUpdateMatchResult] УСПЕШНО ЗАВЕРШЕНО за ${duration}ms`);
            
            return {
                success: true,
                message: 'Результат матча обновлен успешно',
                duration: duration,
                advancementResult,
                loserAdvancementResult
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
     * 🔥 БЕЗОПАСНОЕ ПРОДВИЖЕНИЕ ПОБЕДИТЕЛЯ
     * @private
     */
    static async _safeAdvanceWinner(matchId, winnerId, client = pool) {
        const startTime = Date.now();
        console.log(`🔧 [safeAdvanceWinner] НАЧАЛО: продвижение победителя ${winnerId} из матча ${matchId}`);
        
        try {
            // 1. Получаем данные текущего матча с блокировкой
            const matchResult = await client.query(
                'SELECT * FROM matches WHERE id = $1 FOR UPDATE',
                [matchId]
            );
            
            if (matchResult.rows.length === 0) {
                throw new Error(`Матч ${matchId} не найден`);
            }
            
            const match = matchResult.rows[0];
            console.log(`✅ [safeAdvanceWinner] Матч получен, next_match_id: ${match.next_match_id}`);
            
            // 2. Валидация: проверяем, что победитель является участником матча
            if (![match.team1_id, match.team2_id].includes(winnerId)) {
                throw new Error(`Команда ${winnerId} не является участником матча ${matchId}`);
            }
            
            // 3. Если нет следующего матча - продвижение не требуется
            if (!match.next_match_id) {
                console.log(`✅ [safeAdvanceWinner] Матч ${matchId} не имеет следующего матча (финал?)`);
                return { advanced: false, reason: 'no_next_match' };
            }
            
            // 4. Получаем следующий матч с блокировкой
            console.log(`🔍 [safeAdvanceWinner] Получаем следующий матч ${match.next_match_id}...`);
            const nextMatchResult = await client.query(
                'SELECT * FROM matches WHERE id = $1 FOR UPDATE',
                [match.next_match_id]
            );
            
            if (nextMatchResult.rows.length === 0) {
                throw new Error(`Следующий матч ${match.next_match_id} не найден`);
            }
            
            const nextMatch = nextMatchResult.rows[0];
            console.log(`🔧 [safeAdvanceWinner] Следующий матч ${nextMatch.id}: team1=${nextMatch.team1_id}, team2=${nextMatch.team2_id}`);
            
            // 5. ИСПРАВЛЕННАЯ ЛОГИКА: Определяем свободную позицию в следующем матче
            let updateField = null;
            
            if (!nextMatch.team1_id) {
                updateField = 'team1_id';
                console.log(`📍 [safeAdvanceWinner] Найдена свободная позиция: team1_id`);
            } else if (!nextMatch.team2_id) {
                updateField = 'team2_id';
                console.log(`📍 [safeAdvanceWinner] Найдена свободная позиция: team2_id`);
            } else {
                // 6. Все позиции заняты - проверяем, не находится ли уже наш победитель там
                if (nextMatch.team1_id === winnerId || nextMatch.team2_id === winnerId) {
                    console.log(`✅ [safeAdvanceWinner] Победитель ${winnerId} уже находится в матче ${nextMatch.id} (team1=${nextMatch.team1_id}, team2=${nextMatch.team2_id})`);
                    return { advanced: false, reason: 'already_advanced' };
                } else {
                    // 🆕 УЛУЧШЕННАЯ ОБРАБОТКА: Проверяем проблему структуры сетки
                    console.log(`❌ [safeAdvanceWinner] КОНФЛИКТ СТРУКТУРЫ СЕТКИ: Все позиции заняты (team1=${nextMatch.team1_id}, team2=${nextMatch.team2_id}), но победитель ${winnerId} не находится в матче ${nextMatch.id}`);
                    
                    // Проверяем сколько матчей ведут в этот матч
                    const incomingMatchesResult = await client.query(
                        'SELECT COUNT(*) as count FROM matches WHERE next_match_id = $1 AND tournament_id = $2',
                        [nextMatch.id, match.tournament_id]
                    );
                    
                    const incomingCount = parseInt(incomingMatchesResult.rows[0].count);
                    console.log(`🔍 [safeAdvanceWinner] В матч ${nextMatch.id} ведут ${incomingCount} матчей`);
                    
                    if (incomingCount > 2) {
                        // Проблема структуры сетки - слишком много входящих матчей
                        throw new Error(
                            `ПРОБЛЕМА СТРУКТУРЫ СЕТКИ: В матч ${nextMatch.id} ведут ${incomingCount} матчей, но максимум может быть 2. ` +
                            `Требуется исправление структуры турнирной сетки. ` +
                            `Команды в матче: team1=${nextMatch.team1_id}, team2=${nextMatch.team2_id}. ` +
                            `Попытка добавить команду: ${winnerId}. ` +
                            `РЕШЕНИЕ: Выполните SQL скрипт 'quick_fix_tournament_${match.tournament_id}.sql' или обратитесь к администратору.`
                        );
                    } else {
                        // Обычная ошибка переполнения
                        throw new Error(`Все позиции в следующем матче ${nextMatch.id} уже заняты: team1=${nextMatch.team1_id}, team2=${nextMatch.team2_id}`);
                    }
                }
            }
            
            console.log(`💾 [safeAdvanceWinner] Обновляем позицию ${updateField} в матче ${nextMatch.id}...`);
            
            // 7. Атомарно обновляем следующий матч
            const updateResult = await client.query(
                `UPDATE matches SET ${updateField} = $1 WHERE id = $2 AND ${updateField} IS NULL RETURNING *`,
                [winnerId, nextMatch.id]
            );
            
            if (updateResult.rows.length === 0) {
                // Кто-то другой уже занял эту позицию
                throw new Error(`Позиция ${updateField} в матче ${nextMatch.id} была занята другим процессом`);
            }
            
            const endTime = Date.now();
            console.log(`✅ [safeAdvanceWinner] Успешно продвинут победитель ${winnerId} в позицию ${updateField} матча ${nextMatch.id} за ${endTime - startTime}ms`);
            
            return {
                advanced: true,
                nextMatchId: nextMatch.id,
                position: updateField,
                previousTeam1: nextMatch.team1_id,
                previousTeam2: nextMatch.team2_id,
                newTeam1: updateField === 'team1_id' ? winnerId : nextMatch.team1_id,
                newTeam2: updateField === 'team2_id' ? winnerId : nextMatch.team2_id
            };
            
        } catch (error) {
            const endTime = Date.now();
            console.error(`❌ [safeAdvanceWinner] Ошибка продвижения победителя ${winnerId} из матча ${matchId} за ${endTime - startTime}ms:`, error.message);
            throw error;
        }
    }

    /**
     * 🔥 БЕЗОПАСНОЕ ПРОДВИЖЕНИЕ ПРОИГРАВШЕГО (для матчей за 3-е место)
     * @private
     */
    static async _safeAdvanceLoser(matchId, loserId, client = pool) {
        console.log(`🔧 [safeAdvanceLoser] НАЧАЛО: продвижение проигравшего ${loserId} из матча ${matchId}`);
        
        try {
            // Получаем данные текущего матча
            const matchResult = await client.query(
                'SELECT * FROM matches WHERE id = $1 FOR UPDATE',
                [matchId]
            );
            
            if (matchResult.rows.length === 0) {
                throw new Error(`Матч ${matchId} не найден`);
            }
            
            const match = matchResult.rows[0];
            
            // Если нет матча для проигравшего - продвижение не требуется
            if (!match.loser_next_match_id) {
                console.log(`✅ [safeAdvanceLoser] Матч ${matchId} не имеет матча для проигравшего`);
                return { advanced: false, reason: 'no_loser_match' };
            }
            
            // Получаем матч для проигравшего (обычно матч за 3-е место)
            const loserMatchResult = await client.query(
                'SELECT * FROM matches WHERE id = $1 FOR UPDATE',
                [match.loser_next_match_id]
            );
            
            if (loserMatchResult.rows.length === 0) {
                throw new Error(`Матч для проигравшего ${match.loser_next_match_id} не найден`);
            }
            
            const loserMatch = loserMatchResult.rows[0];
            
            // Определяем свободную позицию
            let updateField = null;
            
            if (!loserMatch.team1_id) {
                updateField = 'team1_id';
            } else if (!loserMatch.team2_id) {
                updateField = 'team2_id';
            } else {
                console.log(`⚠️ [safeAdvanceLoser] Все позиции в матче проигравших ${loserMatch.id} уже заняты`);
                return { advanced: false, reason: 'match_full' };
            }
            
            // Атомарно обновляем матч для проигравшего
            const updateResult = await client.query(
                `UPDATE matches SET ${updateField} = $1 WHERE id = $2 AND ${updateField} IS NULL RETURNING *`,
                [loserId, loserMatch.id]
            );
            
            if (updateResult.rows.length === 0) {
                throw new Error(`Позиция ${updateField} в матче проигравших ${loserMatch.id} была занята другим процессом`);
            }
            
            console.log(`✅ [safeAdvanceLoser] Успешно продвинут проигравший ${loserId} в позицию ${updateField} матча ${loserMatch.id}`);
            
            return {
                advanced: true,
                loserMatchId: loserMatch.id,
                position: updateField
            };
            
        } catch (error) {
            console.error(`❌ [safeAdvanceLoser] Ошибка продвижения проигравшего ${loserId} из матча ${matchId}:`, error.message);
            throw error;
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
            // Получаем имена команд/участников
            let team1Name, team2Name;
            
            if (tournament.participant_type === 'solo') {
                const p1 = await pool.query('SELECT name FROM tournament_participants WHERE id=$1', [match.team1_id]);
                team1Name = p1.rows[0]?.name;
                const p2 = await pool.query('SELECT name FROM tournament_participants WHERE id=$1', [match.team2_id]);
                team2Name = p2.rows[0]?.name;
            } else {
                const t1 = await pool.query('SELECT name FROM tournament_teams WHERE id=$1', [match.team1_id]);
                team1Name = t1.rows[0]?.name;
                const t2 = await pool.query('SELECT name FROM tournament_teams WHERE id=$1', [match.team2_id]);
                team2Name = t2.rows[0]?.name;
            }
            
            const winName = resultData.winner_team_id ? 
                (resultData.winner_team_id === match.team1_id ? team1Name : team2Name) : '';
            
            const announcement = `Матч ${match.match_number} ${team1Name} vs ${team2Name} завершен со счетом ${resultData.score1}:${resultData.score2}${winName ? `, победил ${winName}` : ''}. Ссылка на сетку: /tournaments/${tournament.id}`;
            
            await sendTournamentChatAnnouncement(tournament.id, announcement);
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