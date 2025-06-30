// backend/services/tournament/BracketService.js

const { generateBracket } = require('../../bracketGenerator');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const MatchRepository = require('../../repositories/tournament/MatchRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');
const pool = require('../../db');

// 🔒 Хранилище времени последних регенераций для debounce защиты
const lastRegenerationTimes = new Map();
const REGENERATION_DEBOUNCE_MS = 10000; // 🔧 ИСПРАВЛЕНИЕ: Увеличено с 2 до 10 секунд

// 🆕 ГЛОБАЛЬНЫЙ МЬЮТЕКС для предотвращения одновременных операций
const activeBracketOperations = new Set();

// 🆕 ОБЩИЙ ТАЙМАУТ ДЛЯ ВСЕЙ ОПЕРАЦИИ РЕГЕНЕРАЦИИ
const OPERATION_TIMEOUT_MS = 30000; // 30 секунд

class BracketService {
    /**
     * 🆕 Проверка и установка мьютекса для предотвращения race conditions
     * @param {number} tournamentId - ID турнира
     * @param {string} operation - Тип операции
     * @returns {boolean} - можно ли выполнить операцию
     */
    static _acquireOperationLock(tournamentId, operation) {
        const lockKey = `${tournamentId}-${operation}`;
        
        if (activeBracketOperations.has(lockKey)) {
            const timeLeft = Math.ceil(REGENERATION_DEBOUNCE_MS / 1000);
            throw new Error(`Операция "${operation}" уже выполняется для турнира ${tournamentId}! Подождите ${timeLeft} секунд.`);
        }
        
        // Устанавливаем блокировку
        activeBracketOperations.add(lockKey);
        console.log(`🔒 [BracketService] Установлена блокировка операции ${lockKey}`);
        
        // Автоматически снимаем блокировку через таймаут
        setTimeout(() => {
            this._releaseOperationLock(tournamentId, operation);
        }, OPERATION_TIMEOUT_MS);
        
        return true;
    }

    /**
     * 🆕 Освобождение мьютекса операции
     * @param {number} tournamentId - ID турнира  
     * @param {string} operation - Тип операции
     */
    static _releaseOperationLock(tournamentId, operation) {
        const lockKey = `${tournamentId}-${operation}`;
        if (activeBracketOperations.has(lockKey)) {
            activeBracketOperations.delete(lockKey);
            console.log(`🔓 [BracketService] Снята блокировка операции ${lockKey}`);
        }
    }

    /**
     * 🔧 УЛУЧШЕННАЯ проверка debounce для регенерации
     * @param {number} tournamentId - ID турнира
     * @returns {boolean} - можно ли выполнить регенерацию
     */
    static _checkRegenerationDebounce(tournamentId) {
        const now = Date.now();
        const lastTime = lastRegenerationTimes.get(tournamentId) || 0;
        const timePassed = now - lastTime;
        
        if (timePassed < REGENERATION_DEBOUNCE_MS) {
            const timeLeft = Math.ceil((REGENERATION_DEBOUNCE_MS - timePassed) / 1000);
            throw new Error(`Слишком частая регенерация! Попробуйте через ${timeLeft} секунд.`);
        }
        
        // Обновляем время последней регенерации
        lastRegenerationTimes.set(tournamentId, now);
        
        console.log(`✅ [BracketService] Debounce проверка пройдена для турнира ${tournamentId}`);
        return true;
    }

    /**
     * 🆕 БЕЗОПАСНАЯ блокировка турнира с ранним обнаружением ошибок
     * @private
     */
    static async _safeLockTournament(client, tournamentId, operationName) {
        let lockAcquired = false;
        
        try {
            console.log(`🔒 [${operationName}] Устанавливаем таймаут 10 секунд для блокировки`);
            await client.query('SET statement_timeout = 10000'); // 10 секунд
            
            console.log(`🔒 [${operationName}] Блокируем турнир ${tournamentId} для безопасной операции`);
            
            // Сначала пробуем NOWAIT
            try {
                const tournamentResult = await client.query(
                    'SELECT id FROM tournaments WHERE id = $1 FOR UPDATE NOWAIT',
                    [parseInt(tournamentId)]
                );
                
                if (tournamentResult.rows.length === 0) {
                    throw new Error('Турнир не найден');
                }
                
                lockAcquired = true;
                console.log(`✅ [${operationName}] Турнир ${tournamentId} успешно заблокирован (NOWAIT)`);
                
            } catch (lockError) {
                if (lockError.code === '55P03') {
                    // Lock not available immediately - это означает что другой процесс уже работает
                    console.log(`❌ [${operationName}] Турнир ${tournamentId} заблокирован другим процессом`);
                    throw new Error(`Турнир ${tournamentId} уже обрабатывается другим процессом. Попробуйте через несколько секунд.`);
                } else {
                    throw lockError;
                }
            }
            
            // Сбрасываем таймаут после успешной блокировки
            await client.query('SET statement_timeout = 0');
            console.log(`🔓 [${operationName}] Таймаут сброшен, продолжаем операцию`);
            
            return true;
            
        } catch (error) {
            // Сбрасываем таймаут при ошибке
            try {
                await client.query('SET statement_timeout = 0');
            } catch (resetError) {
                console.warn('⚠️ Не удалось сбросить statement_timeout:', resetError.message);
            }
            
            console.error(`❌ [${operationName}] Ошибка блокировки турнира ${tournamentId}:`, error.message);
            throw error;
        }
    }

    /**
     * Генерация турнирной сетки
     */
    static async generateBracket(tournamentId, userId, thirdPlaceMatch = false) {
        console.log(`🥊 BracketService: Генерация турнирной сетки для турнира ${tournamentId}`);

        // 🆕 УСТАНАВЛИВАЕМ МЬЮТЕКС для предотвращения одновременных операций
        this._acquireOperationLock(tournamentId, 'generate');

        try {
            // Проверка прав доступа
            await this._checkBracketAccess(tournamentId, userId);

            // 🔧 ИСПРАВЛЕНИЕ: Объявляем переменные вне блоков try-catch
            let bracketData = null;
            let savedMatches = [];
            let totalMatches = 0;
            
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                // 🆕 ИСПОЛЬЗУЕМ БЕЗОПАСНУЮ БЛОКИРОВКУ
                await this._safeLockTournament(client, tournamentId, 'generateBracket');
                
                const tournamentResult = await client.query(
                    'SELECT * FROM tournaments WHERE id = $1',
                    [parseInt(tournamentId)]
                );
                
                if (tournamentResult.rows.length === 0) {
                    throw new Error('Турнир не найден');
                }
                
                const tournament = tournamentResult.rows[0];
                
                if (tournament.status !== 'active') {
                    throw new Error('Можно генерировать сетку только для активных турниров');
                }

                // 🔒 ПРОВЕРЯЕМ СУЩЕСТВУЮЩИЕ МАТЧИ В РАМКАХ ТРАНЗАКЦИИ
                console.log(`🔍 [generateBracket] Проверяем существующие матчи для турнира ${tournamentId}`);
                const existingMatchesResult = await client.query(
                    'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                    [parseInt(tournamentId)]
                );
                
                const existingMatchCount = parseInt(existingMatchesResult.rows[0].count);
                
                if (existingMatchCount > 0) {
                    console.log(`🔍 [generateBracket] Сетка уже существует для турнира ${tournamentId} (${existingMatchCount} матчей). Возвращаем существующую сетку.`);
                    
                    // Получаем существующие матчи
                    const existingMatches = await MatchRepository.getByTournamentId(tournamentId);
                    const updatedTournament = await TournamentRepository.getByIdWithCreator(tournamentId);
                    
                    await client.query('COMMIT');
                    
                    return {
                        success: true,
                        matches: existingMatches,
                        totalMatches: existingMatches.length,
                        message: `Турнирная сетка уже сгенерирована: ${existingMatches.length} матчей`,
                        tournament: updatedTournament,
                        existing: true // Флаг что сетка уже существовала
                    };
                }

                // Получаем участников или команды в зависимости от формата турнира
                let participantsForBracket;
                let participantCount;
                
                console.log(`📊 [generateBracket] Получаем участников для турнира ${tournamentId}, формат: ${tournament.format}`);
                
                if (tournament.format === 'mix') {
                    // Для микс турниров получаем команды
                    console.log(`🎯 [generateBracket] Получаем команды для микс турнира ${tournamentId}`);
                    const teams = await this._getMixTeams(tournamentId);
                    
                    // Добавляем защиту от undefined
                    if (!teams) {
                        console.error(`❌ [generateBracket] Метод _getMixTeams вернул undefined для турнира ${tournamentId}`);
                        throw new Error('Не удалось получить команды микс турнира. Возможно команды еще не сформированы.');
                    }
                    
                    if (!Array.isArray(teams)) {
                        console.error(`❌ [generateBracket] _getMixTeams вернул не массив:`, typeof teams, teams);
                        throw new Error('Некорректный формат данных команд микс турнира');
                    }
                    
                    console.log(`📊 [generateBracket] Получено команд: ${teams.length}`);
                    
                    if (teams.length < 2) {
                        throw new Error('Для генерации сетки микс турнира необходимо минимум 2 команды. Сначала сформируйте команды.');
                    }
                    participantsForBracket = teams;
                    participantCount = teams.length;
                    console.log(`📊 Команд в микс турнире: ${teams.length}`);
                } else {
                    // Для обычных турниров получаем участников
                    console.log(`👥 [generateBracket] Получаем участников для обычного турнира ${tournamentId}`);
                    const participants = await ParticipantRepository.getByTournamentId(tournamentId);
                    if (participants.length < 2) {
                        throw new Error('Для генерации сетки необходимо минимум 2 участника');
                    }
                    participantsForBracket = participants;
                    participantCount = participants.length;
                    console.log(`📊 Участников в турнире: ${participants.length}`);
                }

                // Генерируем сетку с помощью bracketGenerator
                console.log(`⚙️ [generateBracket] Вызываем генератор сетки для турнира ${tournamentId}`);
                bracketData = await generateBracket(
                    tournament.format,
                    tournamentId,
                    participantsForBracket,
                    thirdPlaceMatch
                );

                console.log(`🎯 Сгенерирована сетка: ${bracketData.matches.length} матчей`);
                
                // Проверяем, что сетка была сгенерирована корректно
                if (!bracketData.matches || bracketData.matches.length === 0) {
                    throw new Error('Не удалось создать турнирную сетку - сгенерировано 0 матчей');
                }

                // 🔒 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: убеждаемся что никто не создал матчи пока мы генерировали
                const doubleCheckResult = await client.query(
                    'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
                    [parseInt(tournamentId)]
                );
                
                if (parseInt(doubleCheckResult.rows[0].count) > 0) {
                    console.log(`⚠️ [generateBracket] Матчи были созданы другим процессом во время генерации для турнира ${tournamentId}`);
                    
                    // Получаем уже созданные матчи
                    const existingMatches = await MatchRepository.getByTournamentId(tournamentId);
                    const updatedTournament = await TournamentRepository.getByIdWithCreator(tournamentId);
                    
                    await client.query('COMMIT');
                    
                    return {
                        success: true,
                        matches: existingMatches,
                        totalMatches: existingMatches.length,
                        message: `Турнирная сетка была создана другим процессом: ${existingMatches.length} матчей`,
                        tournament: updatedTournament,
                        existing: true,
                        concurrent: true // Флаг что была конкуренция
                    };
                }

                // Логируем событие создания сетки
                console.log(`📝 [generateBracket] Логируем событие генерации сетки`);
                await logTournamentEvent(tournamentId, userId, 'bracket_generated', {
                    matchesCount: bracketData.matches.length,
                    format: tournament.format,
                    thirdPlaceMatch
                });

                // Сохраняем матчи в базу данных
                console.log(`💾 [generateBracket] Сохраняем ${bracketData.matches.length} матчей в базу данных`);
                for (const match of bracketData.matches) {
                    const matchResult = await client.query(`
                        INSERT INTO matches (
                            tournament_id, round, match_number,
                            team1_id, team2_id, next_match_id, loser_next_match_id,
                            is_third_place_match, bracket_type, target_slot
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        RETURNING *
                    `, [
                        parseInt(tournamentId),
                        match.round,
                        match.match_number,
                        match.team1_id || null,
                        match.team2_id || null,
                        match.next_match_id || null,
                        match.loser_next_match_id || null,
                        match.is_third_place_match || false,
                        match.bracket_type || 'main',
                        match.target_slot || null
                    ]);

                    savedMatches.push(matchResult.rows[0]);
                }

                totalMatches = savedMatches.length;

                // Обновляем связи между матчами
                console.log(`🔗 [generateBracket] Обновляем связи между матчами`);
                await this._updateMatchLinks(client, savedMatches, bracketData.matches);

                await client.query('COMMIT');
                
                console.log(`✅ [generateBracket] Транзакция успешно завершена для турнира ${tournamentId}`);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`❌ BracketService: Ошибка генерации сетки для турнира ${tournamentId}:`, error);
                console.error(`❌ Тип ошибки: ${error.name}, код: ${error.code}`);
                console.error(`❌ Stack trace:`, error.stack);
                
                // Добавляем специальную обработку для таймаута
                if (error.code === '57014') {
                    throw new Error('Генерация сетки прервана по таймауту. Возможно, турнир заблокирован другим процессом. Попробуйте через несколько секунд.');
                }
                
                throw error;
            } finally {
                // Сбрасываем таймаут перед освобождением соединения
                try {
                    if (client && !client._ended) {
                        await client.query('SET statement_timeout = 0');
                    }
                } catch (resetError) {
                    console.warn('⚠️ Не удалось сбросить statement_timeout:', resetError.message);
                }
                client.release();
                console.log(`🔓 [generateBracket] Соединение с БД освобождено для турнира ${tournamentId}`);
            }

            // 🔧 ИСПРАВЛЕНИЕ: Отправка уведомлений и финальные операции ПОСЛЕ освобождения транзакции
            try {
                // Проверяем что у нас есть данные для отправки уведомлений
                if (!bracketData || !bracketData.matches) {
                    console.warn('⚠️ [generateBracket] Нет данных bracketData для отправки уведомлений');
                    throw new Error('Не удалось получить данные сгенерированной сетки');
                }

                // Отправляем уведомления
                console.log(`📡 [generateBracket] Отправляем уведомления`);
                await broadcastTournamentUpdate(tournamentId);
                await sendTournamentChatAnnouncement(
                    tournamentId, 
                    `🥊 Турнирная сетка сгенерирована! Создано ${totalMatches} матчей.`,
                    'system',
                    userId
                );
            } catch (notificationError) {
                console.error('⚠️ Ошибка отправки уведомлений:', notificationError.message);
                // Не прерываем выполнение из-за ошибок уведомлений
            }

            // Получаем обновленные данные турнира
            const updatedTournament = await TournamentRepository.getByIdWithCreator(tournamentId);

            console.log(`✅ BracketService: Турнирная сетка успешно сгенерирована для турнира ${tournamentId}`);

            return {
                success: true,
                matches: bracketData.matches,
                totalMatches: totalMatches,
                message: `Турнирная сетка успешно сгенерирована: ${totalMatches} матчей`,
                tournament: updatedTournament
            };

        } finally {
            // 🆕 ОСВОБОЖДАЕМ МЬЮТЕКС в любом случае
            this._releaseOperationLock(tournamentId, 'generate');
        }
    }

    /**
     * 🔧 КРИТИЧЕСКИ ИСПРАВЛЕННАЯ регенерация турнирной сетки
     */
    static async regenerateBracket(tournamentId, userId, shuffle = false, thirdPlaceMatch = false) {
        console.log(`🔄 BracketService: Регенерация турнирной сетки для турнира ${tournamentId} (shuffle: ${shuffle})`);

        // 🔒 Проверка debounce защиты от частых регенераций
        this._checkRegenerationDebounce(tournamentId);

        // 🆕 УСТАНАВЛИВАЕМ МЬЮТЕКС для предотвращения одновременных операций
        this._acquireOperationLock(tournamentId, 'regenerate');

        try {
            // Проверка прав доступа
            await this._checkBracketAccess(tournamentId, userId);

            const tournament = await TournamentRepository.getById(tournamentId);
            if (!tournament) {
                throw new Error('Турнир не найден');
            }

            if (tournament.status !== 'active') {
                throw new Error('Можно регенерировать сетку только для активных турниров');
            }

            // 🆕 ФАЗА 1: БЕЗОПАСНОЕ УДАЛЕНИЕ СУЩЕСТВУЮЩИХ МАТЧЕЙ
            let deletedMatchesCount = 0;
            
            console.log(`🗑️ [regenerateBracket] ФАЗА 1: Удаляем существующие матчи для турнира ${tournamentId}`);
            
            const deleteClient = await pool.connect();
            try {
                await deleteClient.query('BEGIN');
                
                // 🆕 ИСПОЛЬЗУЕМ БЕЗОПАСНУЮ БЛОКИРОВКУ
                await this._safeLockTournament(deleteClient, tournamentId, 'regenerateBracket-delete');

                // Удаляем существующие матчи
                console.log(`🗑️ [regenerateBracket] Удаляем существующие матчи для турнира ${tournamentId}`);
                const deletedMatches = await deleteClient.query(
                    'DELETE FROM matches WHERE tournament_id = $1 RETURNING id',
                    [parseInt(tournamentId)]
                );

                deletedMatchesCount = deletedMatches.rows.length;
                console.log(`🗑️ Удалено ${deletedMatchesCount} старых матчей`);

                await deleteClient.query('COMMIT');
                console.log(`✅ [regenerateBracket] Транзакция удаления завершена для турнира ${tournamentId}`);
                
            } catch (deleteError) {
                await deleteClient.query('ROLLBACK');
                console.error(`❌ [regenerateBracket] Ошибка при удалении матчей для турнира ${tournamentId}:`, deleteError);
                throw deleteError;
            } finally {
                try {
                    if (deleteClient && !deleteClient._ended) {
                        await deleteClient.query('SET statement_timeout = 0');
                    }
                } catch (resetError) {
                    console.warn('⚠️ Не удалось сбросить statement_timeout после удаления:', resetError.message);
                }
                deleteClient.release();
                console.log(`🔓 [regenerateBracket] Соединение освобождено после удаления`);
            }
            
            // 🆕 ФАЗА 2: ГЕНЕРАЦИЯ НОВОЙ СЕТКИ (БЕЗ ДОПОЛНИТЕЛЬНОЙ БЛОКИРОВКИ)
            console.log(`⚙️ [regenerateBracket] ФАЗА 2: Генерируем новую сетку для турнира ${tournamentId}`);
            
            // Временно снимаем блокировку для генерации (generateBracket установит свою)
            this._releaseOperationLock(tournamentId, 'regenerate');
            
            const result = await this.generateBracket(parseInt(tournamentId), userId, thirdPlaceMatch);

            // Восстанавливаем блокировку для финальных операций
            this._acquireOperationLock(tournamentId, 'regenerate');

            // 🆕 ФАЗА 3: ОТПРАВКА УВЕДОМЛЕНИЙ
            console.log(`📡 [regenerateBracket] ФАЗА 3: Отправляем уведомления для турнира ${tournamentId}`);
            
            try {
                // Отправляем объявление в чат
                await sendTournamentChatAnnouncement(
                    tournamentId,
                    `🔄 Турнирная сетка перегенерирована! ${shuffle ? 'Участники перемешаны. ' : ''}Ссылка на сетку: /tournaments/${tournamentId}`,
                    'system',
                    userId
                );

                // Логируем событие
                console.log(`📝 [regenerateBracket] Логируем событие регенерации для турнира ${tournamentId}`);
                await logTournamentEvent(tournamentId, userId, 'bracket_regenerated', {
                    shuffle: shuffle,
                    deleted_matches: deletedMatchesCount,
                    new_matches: result.matches.length
                });
            } catch (notificationError) {
                console.error('⚠️ Ошибка отправки уведомлений при регенерации:', notificationError.message);
                // Не прерываем выполнение из-за ошибок уведомлений
            }

            console.log(`✅ BracketService: Турнирная сетка успешно регенерирована для турнира ${tournamentId}`);
            return {
                ...result,
                message: `Турнирная сетка перегенерирована${shuffle ? ' с перемешиванием участников' : ''}`,
                deleted_matches: deletedMatchesCount
            };

        } catch (error) {
            console.error(`❌ BracketService: Ошибка регенерации сетки для турнира ${tournamentId}:`, error);
            console.error(`❌ Тип ошибки: ${error.name}, код: ${error.code}`);
            console.error(`❌ Stack trace:`, error.stack);
            
            // Добавляем специальную обработку для таймаута
            if (error.code === '57014') {
                throw new Error('Регенерация сетки прервана по таймауту. Возможно, турнир заблокирован другим процессом. Попробуйте через несколько секунд.');
            }
            
            throw error;
        } finally {
            // 🆕 ОСВОБОЖДАЕМ МЬЮТЕКС в любом случае
            this._releaseOperationLock(tournamentId, 'regenerate');
        }
    }

    /**
     * Очистка результатов матчей (сброс турнира)
     */
    static async clearMatchResults(tournamentId, userId) {
        console.log(`🧹 BracketService: Очистка результатов матчей турнира ${tournamentId}`);

        // 🆕 УСТАНАВЛИВАЕМ МЬЮТЕКС для предотвращения одновременных операций
        this._acquireOperationLock(tournamentId, 'clearResults');

        try {
            // Проверка прав доступа
            await this._checkBracketAccess(tournamentId, userId);

            let resetResult; // 🔧 ИСПРАВЛЕНИЕ: Объявляем переменную вне try блоков
            
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                // 🆕 ИСПОЛЬЗУЕМ БЕЗОПАСНУЮ БЛОКИРОВКУ
                await this._safeLockTournament(client, tournamentId, 'clearMatchResults');

                // Сброс результатов всех матчей
                console.log(`🔄 [clearMatchResults] Сброс результатов матчей для турнира ${tournamentId}`);
                resetResult = await client.query(`
                    UPDATE matches 
                    SET team1_score = NULL, team2_score = NULL, 
                        winner_id = NULL, finished = false, 
                        finished_at = NULL
                    WHERE tournament_id = $1
                    RETURNING id
                `, [parseInt(tournamentId)]);

                console.log(`🔄 Сброшено результатов у ${resetResult.rows.length} матчей`);

                await client.query('COMMIT');
                console.log(`✅ [clearMatchResults] Транзакция очистки завершена для турнира ${tournamentId}`);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`❌ BracketService: Ошибка очистки результатов для турнира ${tournamentId}:`, error);
                console.error(`❌ Тип ошибки: ${error.name}, код: ${error.code}`);
                console.error(`❌ Stack trace:`, error.stack);
                
                // Добавляем специальную обработку для таймаута
                if (error.code === '57014') {
                    throw new Error('Очистка результатов прервана по таймауту. Возможно, турнир заблокирован другим процессом. Попробуйте через несколько секунд.');
                }
                
                throw error;
            } finally {
                // Сбрасываем таймаут перед освобождением соединения
                try {
                    if (client && !client._ended) {
                        await client.query('SET statement_timeout = 0');
                    }
                } catch (resetError) {
                    console.warn('⚠️ Не удалось сбросить statement_timeout:', resetError.message);
                }
                client.release();
                console.log(`🔓 [clearMatchResults] Соединение с БД освобождено для турнира ${tournamentId}`);
            }

            // Отправляем уведомления после завершения транзакции
            try {
                await broadcastTournamentUpdate(tournamentId);
                await sendTournamentChatAnnouncement(
                    tournamentId,
                    `🔄 Результаты матчей турнира сброшены! Сброшено ${resetResult.rows.length} матчей.`,
                    'system',
                    userId
                );

                // Логируем событие
                await logTournamentEvent(tournamentId, userId, 'match_results_cleared', {
                    matches_reset: resetResult.rows.length
                });
            } catch (notificationError) {
                console.error('⚠️ Ошибка отправки уведомлений при очистке результатов:', notificationError.message);
                // Не прерываем выполнение из-за ошибок уведомлений
            }

            console.log(`✅ BracketService: Результаты матчей успешно сброшены для турнира ${tournamentId}`);

            return {
                success: true,
                message: `Результаты ${resetResult.rows.length} матчей успешно сброшены`,
                matches_reset: resetResult.rows.length
            };

        } finally {
            // 🆕 ОСВОБОЖДАЕМ МЬЮТЕКС в любом случае
            this._releaseOperationLock(tournamentId, 'clearResults');
        }
    }

    /**
     * Получение турнирной сетки
     */
    static async getBracket(tournamentId) {
        console.log(`📋 BracketService: Получение турнирной сетки ${tournamentId}`);

        const matches = await MatchRepository.getByTournamentId(tournamentId);
        
        // Группируем матчи по раундам
        const bracket = matches.reduce((acc, match) => {
            if (!acc[match.round]) {
                acc[match.round] = [];
            }
            acc[match.round].push(match);
            return acc;
        }, {});

        // Сортируем матчи внутри каждого раунда по match_number
        Object.keys(bracket).forEach(round => {
            bracket[round].sort((a, b) => (a.match_number || 0) - (b.match_number || 0));
        });

        return bracket;
    }

    /**
     * Обновление связей между матчами после генерации
     * @private
     */
    static async _updateMatchLinks(client, savedMatches, originalMatches) {
        console.log('🔗 Обновление связей между матчами...');

        // Создаем мапинг старых ID на новые
        const idMapping = {};
        originalMatches.forEach((original, index) => {
            if (original.temp_id) {
                idMapping[original.temp_id] = savedMatches[index].id;
            }
        });

        // Обновляем связи
        for (let i = 0; i < savedMatches.length; i++) {
            const match = savedMatches[i];
            const original = originalMatches[i];

            let nextMatchId = null;
            let loserNextMatchId = null;

            if (original.next_match_temp_id && idMapping[original.next_match_temp_id]) {
                nextMatchId = idMapping[original.next_match_temp_id];
            }

            if (original.loser_next_match_temp_id && idMapping[original.loser_next_match_temp_id]) {
                loserNextMatchId = idMapping[original.loser_next_match_temp_id];
            }

            if (nextMatchId || loserNextMatchId) {
                await client.query(
                    'UPDATE matches SET next_match_id = $1, loser_next_match_id = $2 WHERE id = $3',
                    [nextMatchId, loserNextMatchId, match.id]
                );
            }
        }
    }

    /**
     * Сброс участников матчей в начальные позиции
     * @private
     */
    static async _resetMatchParticipants(client, tournamentId) {
        console.log('🔄 Сброс участников в начальные позиции...');

        // Получаем турнир для определения формата
        const tournament = await TournamentRepository.getById(tournamentId);
        
        let participants;
        if (tournament.format === 'mix') {
            // Для микс турниров получаем команды
            participants = await this._getMixTeams(tournamentId);
        } else {
            // Для обычных турниров получаем участников
            participants = await ParticipantRepository.getByTournamentId(tournamentId);
        }
        
        // Получаем матчи первого раунда
        const firstRoundMatches = await client.query(
            'SELECT * FROM matches WHERE tournament_id = $1 AND round = 1 ORDER BY position',
            [tournamentId]
        );

        // Очищаем все матчи от участников кроме первого раунда
        await client.query(
            'UPDATE matches SET team1_id = NULL, team2_id = NULL WHERE tournament_id = $1 AND round > 1',
            [tournamentId]
        );

        // Заполняем первый раунд участниками
        for (let i = 0; i < firstRoundMatches.rows.length && i * 2 < participants.length; i++) {
            const match = firstRoundMatches.rows[i];
            const participant1 = participants[i * 2];
            const participant2 = participants[i * 2 + 1] || null;

            await client.query(
                'UPDATE matches SET team1_id = $1, team2_id = $2 WHERE id = $3',
                [participant1.id, participant2?.id, match.id]
            );
        }
    }

    /**
     * Получение команд микс турнира в формате, совместимом с генератором сетки
     * @private
     */
    static async _getMixTeams(tournamentId) {
        console.log(`🏆 [_getMixTeams] Получение команд микс турнира ${tournamentId}`);

        try {
            const teamsQuery = await pool.query(`
                SELECT 
                    tt.id,
                    tt.name,
                    COUNT(ttm.user_id) as members_count,
                    ARRAY_AGG(
                        JSON_BUILD_OBJECT(
                            'id', u.id,
                            'username', u.username,
                            'avatar_url', u.avatar_url
                        ) ORDER BY ttm.id
                    ) as members
                FROM tournament_teams tt
                LEFT JOIN tournament_team_members ttm ON tt.id = ttm.team_id
                LEFT JOIN users u ON ttm.user_id = u.id
                WHERE tt.tournament_id = $1
                GROUP BY tt.id, tt.name
                ORDER BY tt.id
            `, [tournamentId]);

            console.log(`🔍 [_getMixTeams] SQL запрос выполнен, найдено строк: ${teamsQuery.rows.length}`);
            
            if (teamsQuery.rows.length === 0) {
                console.warn(`⚠️ [_getMixTeams] Не найдено команд для турнира ${tournamentId}`);
                return [];
            }

            const teams = teamsQuery.rows.map(team => ({
                id: team.id,
                name: team.name,
                members: team.members.filter(member => member.id !== null)
            }));

            console.log(`✅ [_getMixTeams] Обработано команд: ${teams.length}`);
            teams.forEach((team, index) => {
                console.log(`   📋 Команда ${index + 1}: "${team.name}" (ID: ${team.id}, участников: ${team.members.length})`);
            });

            return teams;

        } catch (error) {
            console.error(`❌ [_getMixTeams] Ошибка при получении команд турнира ${tournamentId}:`, error);
            throw error;
        }
    }

    /**
     * Проверка прав доступа для операций с сеткой
     * @private
     */
    static async _checkBracketAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (!isAdmin) {
                throw new Error('Только создатель или администратор может управлять турнирной сеткой');
            }
        }
    }

    /**
     * Очистка дублирующихся матчей в турнире
     * @param {number} tournamentId - ID турнира
     * @param {number} userId - ID пользователя
     */
    static async cleanupDuplicateMatches(tournamentId, userId) {
        console.log(`🧹 BracketService: Очистка дублирующихся матчей для турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkBracketAccess(tournamentId, userId);

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Находим дублирующиеся матчи (одинаковые по tournament_id, match_number, round, team1_id, team2_id)
            const duplicatesQuery = `
                SELECT 
                    array_agg(id ORDER BY id DESC) as ids,
                    COUNT(*) as count,
                    tournament_id, 
                    match_number, 
                    round, 
                    COALESCE(team1_id, -1) as team1_id, 
                    COALESCE(team2_id, -1) as team2_id
                FROM matches 
                WHERE tournament_id = $1
                GROUP BY tournament_id, match_number, round, COALESCE(team1_id, -1), COALESCE(team2_id, -1)
                HAVING COUNT(*) > 1
                ORDER BY match_number, round
            `;
            
            const duplicatesResult = await client.query(duplicatesQuery, [tournamentId]);
            
            if (duplicatesResult.rows.length === 0) {
                console.log(`✅ [cleanupDuplicateMatches] Дубликаты не найдены для турнира ${tournamentId}`);
                await client.query('COMMIT');
                return {
                    success: true,
                    removed: 0,
                    message: 'Дублирующиеся матчи не найдены'
                };
            }
            
            let totalRemoved = 0;
            
            for (const duplicate of duplicatesResult.rows) {
                const matchIds = duplicate.ids;
                const keepId = matchIds[0]; // Оставляем самый новый (первый в массиве после сортировки по id DESC)
                const removeIds = matchIds.slice(1); // Удаляем остальные
                
                console.log(`🗑️ [cleanupDuplicateMatches] Матч ${duplicate.match_number} (раунд ${duplicate.round}): оставляем ID ${keepId}, удаляем [${removeIds.join(', ')}]`);
                
                // Удаляем дублирующиеся матчи
                if (removeIds.length > 0) {
                    const deleteResult = await client.query(
                        'DELETE FROM matches WHERE id = ANY($1::int[])',
                        [removeIds]
                    );
                    totalRemoved += deleteResult.rowCount;
                }
            }
            
            await client.query('COMMIT');
            
            console.log(`✅ [cleanupDuplicateMatches] Удалено ${totalRemoved} дублирующихся матчей для турнира ${tournamentId}`);
            
            // Логируем событие
            await logTournamentEvent(tournamentId, userId, 'duplicate_matches_cleaned', {
                removedCount: totalRemoved,
                duplicateGroups: duplicatesResult.rows.length
            });
            
            return {
                success: true,
                removed: totalRemoved,
                duplicateGroups: duplicatesResult.rows.length,
                message: `Удалено ${totalRemoved} дублирующихся матчей из ${duplicatesResult.rows.length} групп`
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ BracketService: Ошибка очистки дублей:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Проверка существования дублирующихся матчей в турнире
     * @param {number} tournamentId - ID турнира
     */
    static async checkForDuplicateMatches(tournamentId) {
        console.log(`🔍 BracketService: Проверка дублирующихся матчей для турнира ${tournamentId}`);
        
        const duplicatesQuery = `
            SELECT 
                COUNT(*) as total_duplicates,
                array_agg(DISTINCT match_number ORDER BY match_number) as duplicate_match_numbers
            FROM (
                SELECT 
                    match_number,
                    COUNT(*) as count
                FROM matches 
                WHERE tournament_id = $1
                GROUP BY tournament_id, match_number, round, COALESCE(team1_id, -1), COALESCE(team2_id, -1)
                HAVING COUNT(*) > 1
            ) duplicates
        `;
        
        const result = await pool.query(duplicatesQuery, [tournamentId]);
        const duplicateInfo = result.rows[0];
        
        const hasDuplicates = parseInt(duplicateInfo.total_duplicates) > 0;
        
        if (hasDuplicates) {
            console.log(`⚠️ [checkForDuplicateMatches] Найдены дубликаты в турнире ${tournamentId}: ${duplicateInfo.total_duplicates} групп дублей в матчах ${duplicateInfo.duplicate_match_numbers.join(', ')}`);
        } else {
            console.log(`✅ [checkForDuplicateMatches] Дубликаты не найдены в турнире ${tournamentId}`);
        }
        
        return {
            hasDuplicates,
            duplicateCount: parseInt(duplicateInfo.total_duplicates),
            duplicateMatchNumbers: duplicateInfo.duplicate_match_numbers || []
        };
    }

    /**
     * Очистка турнирной сетки (удаление всех матчей)
     * 🆕 Метод для поддержки переформирования команд
     */
    static async clearBracket(tournamentId, userId) {
        console.log(`🗑️ BracketService: Удаление турнирной сетки для турнира ${tournamentId}`);

        // 🆕 УСТАНАВЛИВАЕМ МЬЮТЕКС для предотвращения одновременных операций
        this._acquireOperationLock(tournamentId, 'clearBracket');

        try {
            // Проверка прав доступа
            await this._checkBracketAccess(tournamentId, userId);

            const tournament = await TournamentRepository.getById(tournamentId);
            if (!tournament) {
                throw new Error('Турнир не найден');
            }

            if (tournament.status !== 'active') {
                throw new Error('Можно удалять сетку только для активных турниров');
            }

            let deletedMatches; // 🔧 ИСПРАВЛЕНИЕ: Объявляем переменную вне try блоков
            
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                // 🆕 ИСПОЛЬЗУЕМ БЕЗОПАСНУЮ БЛОКИРОВКУ
                await this._safeLockTournament(client, tournamentId, 'clearBracket');

                // Удаляем все матчи турнира
                console.log(`🗑️ [clearBracket] Удаляем все матчи для турнира ${tournamentId}`);
                deletedMatches = await client.query(
                    'DELETE FROM matches WHERE tournament_id = $1 RETURNING id',
                    [parseInt(tournamentId)]
                );

                console.log(`🗑️ Удалено ${deletedMatches.rows.length} матчей из турнира`);

                await client.query('COMMIT');
                console.log(`✅ [clearBracket] Транзакция удаления завершена для турнира ${tournamentId}`);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`❌ [clearBracket] Ошибка удаления сетки турнира ${tournamentId}:`, error);
                console.error(`❌ Тип ошибки: ${error.name}, код: ${error.code}`);
                console.error(`❌ Stack trace:`, error.stack);
                
                // Добавляем специальную обработку для таймаута
                if (error.code === '57014') {
                    throw new Error('Удаление сетки прервано по таймауту. Возможно, турнир заблокирован другим процессом. Попробуйте через несколько секунд.');
                }
                
                throw error;
            } finally {
                // Сбрасываем таймаут перед освобождением соединения
                try {
                    if (client && !client._ended) {
                        await client.query('SET statement_timeout = 0');
                    }
                } catch (resetError) {
                    console.warn('⚠️ Не удалось сбросить statement_timeout:', resetError.message);
                }
                client.release();
                console.log(`🔓 [clearBracket] Соединение с БД освобождено для турнира ${tournamentId}`);
            }

            // Отправляем уведомления после завершения транзакции
            try {
                await broadcastTournamentUpdate(tournamentId);
                await sendTournamentChatAnnouncement(
                    tournamentId,
                    `🗑️ Турнирная сетка удалена! Удалено ${deletedMatches.rows.length} матчей. Теперь можно перегенерировать сетку.`,
                    'system',
                    userId
                );

                // Логируем событие
                await logTournamentEvent(tournamentId, userId, 'bracket_cleared', {
                    matches_deleted: deletedMatches.rows.length
                });
            } catch (notificationError) {
                console.error('⚠️ Ошибка отправки уведомлений при удалении сетки:', notificationError.message);
                // Не прерываем выполнение из-за ошибок уведомлений
            }

            console.log(`✅ BracketService: Турнирная сетка успешно удалена для турнира ${tournamentId}`);

            return {
                success: true,
                message: `Турнирная сетка удалена. Удалено ${deletedMatches.rows.length} матчей.`,
                matches_deleted: deletedMatches.rows.length
            };

        } finally {
            // 🆕 ОСВОБОЖДАЕМ МЬЮТЕКС в любом случае
            this._releaseOperationLock(tournamentId, 'clearBracket');
        }
    }
}

module.exports = BracketService; 