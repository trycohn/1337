/**
 * ⚡ ДВИЖОК SINGLE ELIMINATION
 * 
 * Основной движок для генерации турнирной сетки Single Elimination
 * с поддержкой различных типов распределения и максимальной валидацией
 */

const { BracketMath } = require('../../utils/tournament/bracketMath');
const { SeedingFactory, SEEDING_TYPES } = require('../../utils/tournament/seedingAlgorithms');
const pool = require('../../db');

/**
 * 🏆 Основной класс движка Single Elimination
 */
class SingleEliminationEngine {
    
    /**
     * 🎯 Генерация полной турнирной сетки
     * @param {number} tournamentId - ID турнира
     * @param {Array} participants - Массив участников или команд
     * @param {Object} options - Опции генерации
     * @returns {Object} - Результат генерации с матчами и метаданными
     */
    static async generateBracket(tournamentId, participants, options = {}) {
        const startTime = Date.now();
        console.log(`⚡ [SingleEliminationEngine] Начало генерации турнирной сетки для турнира ${tournamentId}`);
        
        try {
            // 1. Валидация входных данных
            this._validateInput(tournamentId, participants, options);
            
            // 2. Расчет математических параметров
            const bracketMath = BracketMath.calculateSingleEliminationParams(
                participants.length, 
                { thirdPlaceMatch: options.thirdPlaceMatch || false }
            );
            
            console.log(`📊 Математические параметры:`, {
                originalParticipants: bracketMath.originalParticipantCount,
                actualParticipants: bracketMath.actualParticipants,
                excludedParticipants: bracketMath.excludedParticipants,
                totalMatches: bracketMath.totalMatches,
                rounds: bracketMath.rounds
            });
            
            // 3. Применение алгоритма распределения
            const seedingType = options.seedingType || SEEDING_TYPES.RANDOM;
            const seededParticipants = SeedingFactory.createSeeding(
                seedingType,
                participants,
                bracketMath.actualParticipants,
                options.seedingOptions || {}
            );
            
            console.log(`🎲 Распределение участников: тип ${seedingType}, количество ${seededParticipants.length}`);
            
            // 4. Генерация структуры матчей
            const matches = await this._generateMatches(
                tournamentId,
                seededParticipants,
                bracketMath,
                options
            );
            
            // 5. Финальная валидация
            const validationResult = this._validateGeneratedBracket(matches, bracketMath);
            if (!validationResult.isValid) {
                throw new Error(`Валидация сетки не прошла: ${validationResult.errors.join(', ')}`);
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ [SingleEliminationEngine] Сетка успешно сгенерирована за ${duration}ms`);
            
            return {
                success: true,
                matches,
                excludedParticipants: participants.slice(bracketMath.actualParticipants),
                bracketMath,
                seedingInfo: {
                    type: seedingType,
                    participantsUsed: seededParticipants.length,
                    participantsExcluded: bracketMath.excludedParticipants
                },
                generationTime: duration,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [SingleEliminationEngine] Ошибка генерации (${duration}ms):`, error.message);
            
            return {
                success: false,
                error: error.message,
                generationTime: duration,
                generatedAt: new Date().toISOString()
            };
        }
    }
    
    /**
     * 🔧 Генерация матчей для турнирной сетки
     * @param {number} tournamentId - ID турнира
     * @param {Array} participants - Распределенные участники
     * @param {Object} bracketMath - Математические параметры
     * @param {Object} options - Опции генерации
     * @returns {Array} - Массив сгенерированных матчей
     */
    static async _generateMatches(tournamentId, participants, bracketMath, options) {
        const matches = [];
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. Генерируем матчи первого раунда
            const firstRoundMatches = await this._generateFirstRoundMatches(
                client,
                tournamentId,
                participants,
                bracketMath
            );
            matches.push(...firstRoundMatches);
            
            // 2. Генерируем матчи последующих раундов
            const subsequentRoundMatches = await this._generateSubsequentRounds(
                client,
                tournamentId,
                firstRoundMatches,
                bracketMath
            );
            matches.push(...subsequentRoundMatches);
            
            // 3. Генерируем матч за 3-е место (если нужен)
            if (bracketMath.hasThirdPlaceMatch) {
                const thirdPlaceMatch = await this._generateThirdPlaceMatch(
                    client,
                    tournamentId,
                    matches,
                    bracketMath
                );
                matches.push(thirdPlaceMatch);
            }
            
            await client.query('COMMIT');
            
            console.log(`🔧 Сгенерировано матчей: ${matches.length}`);
            return matches;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * 🥇 Генерация матчей первого раунда
     * @param {Object} client - Клиент БД
     * @param {number} tournamentId - ID турнира
     * @param {Array} participants - Участники
     * @param {Object} bracketMath - Математические параметры
     * @returns {Array} - Матчи первого раунда
     */
    static async _generateFirstRoundMatches(client, tournamentId, participants, bracketMath) {
        console.log(`🥇 Генерация первого раунда: ${bracketMath.firstRoundMatches} матчей`);
        
        const firstRoundMatches = [];
        const matchPromises = [];
        
        for (let i = 0; i < bracketMath.firstRoundMatches; i++) {
            const participant1 = participants[i * 2];
            const participant2 = participants[i * 2 + 1];
            
            const matchData = {
                tournament_id: tournamentId,
                round: 1,
                match_number: i + 1,
                team1_id: participant1?.id || null,
                team2_id: participant2?.id || null,
                status: 'pending',
                bracket_type: 'winner'
            };
            
            // Создаем промис для вставки матча
            const matchPromise = this._insertMatch(client, matchData);
            matchPromises.push(matchPromise);
        }
        
        // Выполняем все вставки параллельно
        const insertedMatches = await Promise.all(matchPromises);
        firstRoundMatches.push(...insertedMatches);
        
        console.log(`✅ Первый раунд: создано ${firstRoundMatches.length} матчей`);
        return firstRoundMatches;
    }
    
    /**
     * ⏭️ Генерация матчей последующих раундов
     * @param {Object} client - Клиент БД
     * @param {number} tournamentId - ID турнира
     * @param {Array} firstRoundMatches - Матчи первого раунда
     * @param {Object} bracketMath - Математические параметры
     * @returns {Array} - Матчи всех последующих раундов
     */
    static async _generateSubsequentRounds(client, tournamentId, firstRoundMatches, bracketMath) {
        const allMatches = [...firstRoundMatches];
        let currentRoundMatches = firstRoundMatches;
        
        // Генерируем раунды от 2 до финала
        for (let round = 2; round <= bracketMath.rounds; round++) {
            const matchesInRound = Math.pow(2, bracketMath.rounds - round);
            console.log(`⏭️ Генерация раунда ${round}: ${matchesInRound} матчей`);
            
            const roundMatches = [];
            const matchPromises = [];
            
            for (let i = 0; i < matchesInRound; i++) {
                const sourceMatch1 = currentRoundMatches[i * 2];
                const sourceMatch2 = currentRoundMatches[i * 2 + 1];
                
                const matchData = {
                    tournament_id: tournamentId,
                    round: round,
                    match_number: i + 1,
                    team1_id: null, // Будет заполнено после завершения source матчей
                    team2_id: null,
                    status: 'pending',
                    bracket_type: 'winner',
                    source_match1_id: sourceMatch1?.id || null,
                    source_match2_id: sourceMatch2?.id || null
                };
                
                const matchPromise = this._insertMatch(client, matchData);
                matchPromises.push(matchPromise);
            }
            
            const insertedMatches = await Promise.all(matchPromises);
            roundMatches.push(...insertedMatches);
            
            // Обновляем next_match_id для матчей предыдущего раунда
            await this._updateNextMatchIds(client, currentRoundMatches, roundMatches);
            
            allMatches.push(...roundMatches);
            currentRoundMatches = roundMatches;
            
            console.log(`✅ Раунд ${round}: создано ${roundMatches.length} матчей`);
        }
        
        return allMatches.slice(firstRoundMatches.length); // Возвращаем только новые матчи
    }
    
    /**
     * 🥉 Генерация матча за 3-е место
     * @param {Object} client - Клиент БД
     * @param {number} tournamentId - ID турнира
     * @param {Array} allMatches - Все матчи
     * @param {Object} bracketMath - Математические параметры
     * @returns {Object} - Матч за 3-е место
     */
    static async _generateThirdPlaceMatch(client, tournamentId, allMatches, bracketMath) {
        console.log(`🥉 Генерация матча за 3-е место`);
        
        // Находим полуфинальные матчи (матчи раунда rounds-1)
        const semifinalMatches = allMatches.filter(match => 
            match.round === bracketMath.rounds - 1 && 
            match.bracket_type === 'winner'
        );
        
        if (semifinalMatches.length !== 2) {
            throw new Error(`Не найдены полуфинальные матчи для матча за 3-е место`);
        }
        
        const thirdPlaceMatchData = {
            tournament_id: tournamentId,
            round: bracketMath.rounds,
            match_number: 1,
            team1_id: null, // Будет заполнено после полуфиналов
            team2_id: null,
            status: 'pending',
            bracket_type: 'placement',
            is_third_place_match: true,
            source_match1_id: semifinalMatches[0].id,
            source_match2_id: semifinalMatches[1].id
        };
        
        const thirdPlaceMatch = await this._insertMatch(client, thirdPlaceMatchData);
        
        console.log(`✅ Матч за 3-е место создан: ID ${thirdPlaceMatch.id}`);
        return thirdPlaceMatch;
    }
    
    /**
     * 💾 Вставка матча в базу данных
     * @param {Object} client - Клиент БД
     * @param {Object} matchData - Данные матча
     * @returns {Object} - Созданный матч
     */
    static async _insertMatch(client, matchData) {
        const query = `
            INSERT INTO matches (
                tournament_id, round, match_number, team1_id, team2_id,
                status, bracket_type, is_third_place_match, 
                source_match1_id, source_match2_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        
        const values = [
            matchData.tournament_id,
            matchData.round,
            matchData.match_number,
            matchData.team1_id,
            matchData.team2_id,
            matchData.status || 'pending',
            matchData.bracket_type || 'winner',
            matchData.is_third_place_match || false,
            matchData.source_match1_id,
            matchData.source_match2_id
        ];
        
        const result = await client.query(query, values);
        return result.rows[0];
    }
    
    /**
     * 🔗 Обновление next_match_id для связи матчей
     * @param {Object} client - Клиент БД
     * @param {Array} currentRoundMatches - Матчи текущего раунда
     * @param {Array} nextRoundMatches - Матчи следующего раунда
     */
    static async _updateNextMatchIds(client, currentRoundMatches, nextRoundMatches) {
        const updatePromises = [];
        
        for (let i = 0; i < currentRoundMatches.length; i++) {
            const nextMatchIndex = Math.floor(i / 2);
            const nextMatch = nextRoundMatches[nextMatchIndex];
            
            if (nextMatch) {
                const updatePromise = client.query(
                    'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                    [nextMatch.id, currentRoundMatches[i].id]
                );
                updatePromises.push(updatePromise);
            }
        }
        
        await Promise.all(updatePromises);
    }
    
    /**
     * ✅ Валидация входных данных
     * @param {number} tournamentId - ID турнира
     * @param {Array} participants - Участники
     * @param {Object} options - Опции
     */
    static _validateInput(tournamentId, participants, options) {
        if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
            throw new Error('ID турнира должен быть положительным целым числом');
        }
        
        if (!Array.isArray(participants)) {
            throw new Error('Участники должны быть переданы в виде массива');
        }
        
        if (participants.length < 2) {
            throw new Error('Недостаточно участников для создания турнирной сетки (минимум 2)');
        }
        
        if (participants.length > 1024) {
            throw new Error('Слишком много участников (максимум 1024)');
        }
        
        // Проверяем структуру участников
        participants.forEach((participant, index) => {
            if (!participant || typeof participant !== 'object') {
                throw new Error(`Участник ${index + 1} имеет неверную структуру`);
            }
            
            if (!participant.id) {
                throw new Error(`У участника ${index + 1} отсутствует ID`);
            }
        });
        
        // Валидация опций
        if (options.seedingType && !Object.values(SEEDING_TYPES).includes(options.seedingType)) {
            throw new Error(`Неверный тип распределения: ${options.seedingType}`);
        }
    }
    
    /**
     * 🔍 Валидация сгенерированной турнирной сетки
     * @param {Array} matches - Сгенерированные матчи
     * @param {Object} bracketMath - Математические параметры
     * @returns {Object} - Результат валидации
     */
    static _validateGeneratedBracket(matches, bracketMath) {
        const errors = [];
        
        try {
            // 1. Проверка общего количества матчей
            const expectedTotal = bracketMath.totalMatchesWithThirdPlace;
            if (matches.length !== expectedTotal) {
                errors.push(`Неверное общее количество матчей: ${matches.length}, ожидалось: ${expectedTotal}`);
            }
            
            // 2. Проверка количества матчей по раундам
            const matchesByRound = {};
            matches.forEach(match => {
                if (!matchesByRound[match.round]) {
                    matchesByRound[match.round] = [];
                }
                matchesByRound[match.round].push(match);
            });
            
            // Проверяем каждый раунд
            for (let round = 1; round <= bracketMath.rounds; round++) {
                const expectedMatches = Math.pow(2, bracketMath.rounds - round);
                const actualMatches = matchesByRound[round]?.filter(m => !m.is_third_place_match).length || 0;
                
                if (actualMatches !== expectedMatches) {
                    errors.push(`Раунд ${round}: неверное количество матчей ${actualMatches}, ожидалось: ${expectedMatches}`);
                }
            }
            
            // 3. Проверка связей между матчами
            const sourceMatchIds = new Set();
            const nextMatchIds = new Set();
            
            matches.forEach(match => {
                if (match.source_match1_id) sourceMatchIds.add(match.source_match1_id);
                if (match.source_match2_id) sourceMatchIds.add(match.source_match2_id);
                if (match.next_match_id) nextMatchIds.add(match.next_match_id);
            });
            
            // Проверяем, что все source матчи существуют
            const matchIds = new Set(matches.map(m => m.id));
            for (const sourceId of sourceMatchIds) {
                if (!matchIds.has(sourceId)) {
                    errors.push(`Ссылка на несуществующий source матч: ${sourceId}`);
                }
            }
            
            // 4. Проверка матча за 3-е место
            if (bracketMath.hasThirdPlaceMatch) {
                const thirdPlaceMatches = matches.filter(m => m.is_third_place_match);
                if (thirdPlaceMatches.length !== 1) {
                    errors.push(`Неверное количество матчей за 3-е место: ${thirdPlaceMatches.length}, ожидалось: 1`);
                }
            }
            
            console.log(`🔍 Валидация сетки: ${errors.length === 0 ? 'УСПЕШНО' : 'ОШИБКИ'}`);
            
            return {
                isValid: errors.length === 0,
                errors,
                matchCount: matches.length,
                expectedMatchCount: expectedTotal,
                roundsValidated: Object.keys(matchesByRound).length
            };
            
        } catch (error) {
            console.error(`❌ Ошибка валидации:`, error);
            errors.push(`Ошибка валидации: ${error.message}`);
            
            return {
                isValid: false,
                errors,
                validationError: error.message
            };
        }
    }
}

module.exports = {
    SingleEliminationEngine
}; 