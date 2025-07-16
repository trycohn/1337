/**
 * ⚡ ДВИЖОК DOUBLE ELIMINATION
 * 
 * Движок для генерации турнирной сетки Double Elimination
 * с поддержкой winners и losers bracket
 */

const { BracketMath } = require('../../utils/tournament/bracketMath');
const { SeedingFactory, SEEDING_TYPES } = require('../../utils/tournament/seedingAlgorithms');
const pool = require('../../db');

/**
 * 🏆 Основной класс движка Double Elimination
 */
class DoubleEliminationEngine {
    
    /**
     * 🎯 Генерация полной турнирной сетки Double Elimination
     * @param {number} tournamentId - ID турнира
     * @param {Array} participants - Массив участников или команд
     * @param {Object} options - Опции генерации
     * @returns {Object} - Результат генерации с матчами и метаданными
     */
    static async generateBracket(tournamentId, participants, options = {}) {
        const startTime = Date.now();
        console.log(`⚡ [DoubleEliminationEngine] Начало генерации double elimination сетки для турнира ${tournamentId}`);
        
        try {
            // 1. Валидация входных данных
            this._validateInput(tournamentId, participants, options);
            
            // 2. Расчет математических параметров для double elimination
            const bracketMath = this._calculateDoubleEliminationParams(participants.length);
            
            console.log(`📊 Double Elimination параметры:`, {
                participants: bracketMath.participants,
                winnersRounds: bracketMath.winnersRounds,
                losersRounds: bracketMath.losersRounds,
                totalMatches: bracketMath.totalMatches
            });
            
            // 3. Применение алгоритма распределения
            const seedingType = options.seedingType || SEEDING_TYPES.RANDOM;
            const seededParticipants = SeedingFactory.createSeeding(
                seedingType,
                participants,
                participants.length,
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
            console.log(`✅ [DoubleEliminationEngine] Сетка успешно сгенерирована за ${duration}ms`);
            
            return {
                success: true,
                matches,
                bracketMath,
                seedingInfo: {
                    type: seedingType,
                    participantsUsed: seededParticipants.length,
                    participantsExcluded: 0
                },
                generationTime: duration,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [DoubleEliminationEngine] Ошибка генерации (${duration}ms):`, error.message);
            
            return {
                success: false,
                error: error.message,
                generationTime: duration,
                generatedAt: new Date().toISOString()
            };
        }
    }
    
    /**
     * 📊 Расчет параметров Double Elimination
     * @param {number} participantCount - Количество участников
     * @returns {Object} - Параметры double elimination
     */
    static _calculateDoubleEliminationParams(participantCount) {
        // Округляем количество участников до ближайшей степени двойки
        const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(participantCount)));
        
        // Расчет раундов
        const winnersRounds = Math.log2(powerOfTwo);
        const losersRounds = (winnersRounds - 1) * 2;
        
        // Расчет матчей
        const winnersMatches = powerOfTwo - 1;
        const losersMatches = powerOfTwo - 2;
        const grandFinalMatches = 2; // Может быть 1 или 2 в зависимости от результата
        
        const totalMatches = winnersMatches + losersMatches + grandFinalMatches;
        
        return {
            participants: powerOfTwo,
            actualParticipants: participantCount,
            winnersRounds,
            losersRounds,
            totalRounds: winnersRounds + losersRounds + 1, // +1 для гранд финала
            winnersMatches,
            losersMatches,
            grandFinalMatches,
            totalMatches,
            byesNeeded: powerOfTwo - participantCount
        };
    }
    
    /**
     * 🔧 Генерация матчей для double elimination
     * @param {number} tournamentId - ID турнира
     * @param {Array} participants - Участники
     * @param {Object} bracketMath - Параметры сетки
     * @param {Object} options - Опции
     * @returns {Array} - Матчи
     */
    static async _generateMatches(tournamentId, participants, bracketMath, options) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            console.log(`🏗️ [DoubleEliminationEngine] Генерация ${bracketMath.totalMatches} матчей`);
            
            // 1. Создаем матчи Winners Bracket
            const winnersMatches = await this._createWinnersMatches(
                client, 
                tournamentId, 
                bracketMath.winnersRounds,
                bracketMath.winnersMatches
            );
            
            // 2. Создаем матчи Losers Bracket
            const losersMatches = await this._createLosersMatches(
                client, 
                tournamentId, 
                bracketMath.losersRounds,
                bracketMath.losersMatches
            );
            
            // 3. Создаем Grand Final
            const grandFinalMatches = await this._createGrandFinalMatches(
                client, 
                tournamentId
            );
            
            // 4. Устанавливаем связи между матчами
            await this._establishDoubleEliminationConnections(
                client,
                winnersMatches,
                losersMatches,
                grandFinalMatches
            );
            
            // 5. Размещаем участников в первом раунде Winners Bracket
            await this._placeParticipantsInWinnersBracket(
                client,
                winnersMatches,
                participants
            );
            
            await client.query('COMMIT');
            
            return [...winnersMatches, ...losersMatches, ...grandFinalMatches];
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * 🏆 Создание матчей Winners Bracket
     */
    static async _createWinnersMatches(client, tournamentId, rounds, totalMatches) {
        const matches = [];
        let matchNumber = 1;
        
        for (let round = 1; round <= rounds; round++) {
            const matchesInRound = Math.pow(2, rounds - round);
            
            for (let i = 0; i < matchesInRound; i++) {
                const result = await client.query(`
                    INSERT INTO matches (
                        tournament_id, 
                        round, 
                        match_number, 
                        bracket_type,
                        status
                    ) VALUES ($1, $2, $3, 'winner', 'pending')
                    RETURNING *
                `, [tournamentId, round, matchNumber]);
                
                matches.push(result.rows[0]);
                matchNumber++;
            }
        }
        
        return matches;
    }
    
    /**
     * 💔 Создание матчей Losers Bracket
     */
    static async _createLosersMatches(client, tournamentId, rounds, totalMatches) {
        const matches = [];
        let matchNumber = 1000; // Начинаем с 1000 для losers bracket
        
        for (let round = 1; round <= rounds; round++) {
            // Логика количества матчей в каждом раунде losers bracket
            const matchesInRound = this._calculateLosersRoundMatches(round, rounds);
            
            for (let i = 0; i < matchesInRound; i++) {
                const result = await client.query(`
                    INSERT INTO matches (
                        tournament_id, 
                        round, 
                        match_number, 
                        bracket_type,
                        status
                    ) VALUES ($1, $2, $3, 'loser', 'pending')
                    RETURNING *
                `, [tournamentId, round, matchNumber]);
                
                matches.push(result.rows[0]);
                matchNumber++;
            }
        }
        
        return matches;
    }
    
    /**
     * 🏁 Создание Grand Final матчей
     */
    static async _createGrandFinalMatches(client, tournamentId) {
        const matches = [];
        
        // Grand Final
        const grandFinalResult = await client.query(`
            INSERT INTO matches (
                tournament_id, 
                round, 
                match_number, 
                bracket_type,
                status
            ) VALUES ($1, 999, 9999, 'grand_final', 'pending')
            RETURNING *
        `, [tournamentId]);
        
        matches.push(grandFinalResult.rows[0]);
        
        // Потенциальный второй Grand Final (если winner losers bracket выиграет)
        const grandFinalResetResult = await client.query(`
            INSERT INTO matches (
                tournament_id, 
                round, 
                match_number, 
                bracket_type,
                status
            ) VALUES ($1, 999, 9998, 'grand_final_reset', 'pending')
            RETURNING *
        `, [tournamentId]);
        
        matches.push(grandFinalResetResult.rows[0]);
        
        return matches;
    }
    
    /**
     * 📊 Расчет количества матчей в раунде losers bracket
     */
    static _calculateLosersRoundMatches(round, totalRounds) {
        // Упрощенная логика - можно улучшить
        return Math.ceil(Math.pow(2, totalRounds - round));
    }
    
    /**
     * 🔗 Установка связей между матчами
     */
    static async _establishDoubleEliminationConnections(client, winnersMatches, losersMatches, grandFinalMatches) {
        // Связи в Winners Bracket
        for (let i = 0; i < winnersMatches.length - 1; i++) {
            const currentMatch = winnersMatches[i];
            const nextMatch = winnersMatches[i + 1];
            
            if (currentMatch.round === nextMatch.round - 1) {
                await client.query(`
                    UPDATE matches SET next_match_id = $1 WHERE id = $2
                `, [nextMatch.id, currentMatch.id]);
            }
        }
        
        // Связи проигравших из Winners в Losers
        for (const winnerMatch of winnersMatches) {
            const appropriateLoserMatch = losersMatches.find(lm => 
                lm.round === winnerMatch.round
            );
            
            if (appropriateLoserMatch) {
                await client.query(`
                    UPDATE matches SET loser_next_match_id = $1 WHERE id = $2
                `, [appropriateLoserMatch.id, winnerMatch.id]);
            }
        }
        
        // Связи в Losers Bracket
        for (let i = 0; i < losersMatches.length - 1; i++) {
            const currentMatch = losersMatches[i];
            const nextMatch = losersMatches[i + 1];
            
            if (currentMatch.round === nextMatch.round - 1) {
                await client.query(`
                    UPDATE matches SET next_match_id = $1 WHERE id = $2
                `, [nextMatch.id, currentMatch.id]);
            }
        }
        
        // Связи с Grand Final
        if (winnersMatches.length > 0 && grandFinalMatches.length > 0) {
            const winnersFinal = winnersMatches[winnersMatches.length - 1];
            const grandFinal = grandFinalMatches[0];
            
            await client.query(`
                UPDATE matches SET next_match_id = $1 WHERE id = $2
            `, [grandFinal.id, winnersFinal.id]);
        }
        
        if (losersMatches.length > 0 && grandFinalMatches.length > 0) {
            const losersFinal = losersMatches[losersMatches.length - 1];
            const grandFinal = grandFinalMatches[0];
            
            await client.query(`
                UPDATE matches SET next_match_id = $1 WHERE id = $2
            `, [grandFinal.id, losersFinal.id]);
        }
    }
    
    /**
     * 👥 Размещение участников в первом раунде Winners Bracket
     */
    static async _placeParticipantsInWinnersBracket(client, winnersMatches, participants) {
        const firstRoundMatches = winnersMatches.filter(m => m.round === 1);
        
        for (let i = 0; i < firstRoundMatches.length && i * 2 < participants.length; i++) {
            const match = firstRoundMatches[i];
            const team1 = participants[i * 2];
            const team2 = participants[i * 2 + 1] || null;
            
            await client.query(`
                UPDATE matches 
                SET team1_id = $1, team2_id = $2 
                WHERE id = $3
            `, [team1.id, team2?.id || null, match.id]);
            
            console.log(`✅ Winners Bracket матч ${match.match_number}: ${team1.id} vs ${team2?.id || 'BYE'}`);
        }
    }
    
    /**
     * ✅ Валидация входных данных
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
        
        if (participants.length > 64) {
            throw new Error('Слишком много участников для double elimination (максимум 64)');
        }
        
        participants.forEach((participant, index) => {
            if (!participant || typeof participant !== 'object') {
                throw new Error(`Участник ${index + 1} имеет неверную структуру`);
            }
            
            if (!participant.id) {
                throw new Error(`У участника ${index + 1} отсутствует ID`);
            }
        });
    }
    
    /**
     * 🔍 Валидация сгенерированной сетки
     */
    static _validateGeneratedBracket(matches, bracketMath) {
        const errors = [];
        
        if (!Array.isArray(matches)) {
            errors.push('Матчи должны быть массивом');
        }
        
        if (matches.length !== bracketMath.totalMatches) {
            errors.push(`Количество матчей не совпадает: ожидается ${bracketMath.totalMatches}, получено ${matches.length}`);
        }
        
        // Проверка наличия всех типов bracket
        const bracketTypes = ['winner', 'loser', 'grand_final'];
        bracketTypes.forEach(type => {
            if (!matches.some(m => m.bracket_type === type)) {
                errors.push(`Отсутствуют матчи типа ${type}`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = { DoubleEliminationEngine }; 