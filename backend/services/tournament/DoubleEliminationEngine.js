/**
 * ⚡ ДВИЖОК DOUBLE ELIMINATION V2.0
 * 
 * Полноценный движок для генерации турнирной сетки Double Elimination
 * с математически точными расчетами и профессиональной логикой продвижения
 * 
 * Особенности:
 * - Два параллельных bracket: Winners и Losers
 * - Каждый участник исключается после 2-х поражений
 * - Grand Final может состоять из 1 или 2 матчей
 * - Поддержка bye-проходов для степеней двойки
 */

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
                actualParticipants: bracketMath.actualParticipants,
                winnersRounds: bracketMath.winnersRounds,
                losersRounds: bracketMath.losersRounds,
                totalMatches: bracketMath.totalMatches,
                hasGrandFinalReset: bracketMath.hasGrandFinalReset
            });
            
            // 3. Применение алгоритма распределения
            const seedingType = options.seedingType || SEEDING_TYPES.RANDOM;
            const seededParticipants = SeedingFactory.createSeeding(
                seedingType,
                participants,
                bracketMath.participants, // Используем степень двойки
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
                    participantsExcluded: bracketMath.participants - participants.length
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
     * 📊 Расчет параметров Double Elimination с математической точностью
     * @param {number} participantCount - Количество участников
     * @returns {Object} - Параметры double elimination
     */
    static _calculateDoubleEliminationParams(participantCount) {
        // Округляем до ближайшей степени двойки (вверх)
        const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(participantCount)));
        
        // Основные параметры
        const winnersRounds = Math.log2(powerOfTwo);
        const losersRounds = (winnersRounds - 1) * 2;
        
        // Расчет матчей в каждой сетке
        const winnersMatches = powerOfTwo - 1;
        const losersMatches = powerOfTwo - 2;
        const grandFinalMatches = 2; // Максимум 2 матча (основной + reset)
        
        // Общее количество матчей
        const totalMatches = winnersMatches + losersMatches + grandFinalMatches;
        
        // Bye-проходы (если участников меньше степени двойки)
        const byesNeeded = powerOfTwo - participantCount;
        
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
            byesNeeded,
            hasGrandFinalReset: true // Всегда возможен reset в DE
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
            
            // 3. Создаем Grand Final матчи
            const grandFinalMatches = await this._createGrandFinalMatches(
                client, 
                tournamentId
            );
            
            // 4. Устанавливаем связи между матчами
            await this._establishDoubleEliminationConnections(
                client,
                winnersMatches,
                losersMatches,
                grandFinalMatches,
                bracketMath
            );
            
            // 5. Размещаем участников в первом раунде Winners Bracket
            await this._placeParticipantsInWinnersBracket(
                client,
                winnersMatches,
                participants,
                bracketMath
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
        
        console.log(`🏆 Создание Winners Bracket: ${rounds} раундов, ${totalMatches} матчей`);
        
        for (let round = 1; round <= rounds; round++) {
            const matchesInRound = Math.pow(2, rounds - round);
            
            console.log(`   Раунд ${round}: ${matchesInRound} матчей`);
            
            for (let i = 0; i < matchesInRound; i++) {
                const result = await client.query(`
                    INSERT INTO matches (
                        tournament_id, 
                        round, 
                        match_number, 
                        bracket_type,
                        status,
                        bracket_position
                    ) VALUES ($1, $2, $3, 'winner', 'pending', $4)
                    RETURNING *
                `, [tournamentId, round, matchNumber, `WB_R${round}_M${i+1}`]);
                
                matches.push(result.rows[0]);
                matchNumber++;
            }
        }
        
        return matches;
    }
    
    /**
     * 💔 Создание матчей Losers Bracket с правильной структурой
     */
    static async _createLosersMatches(client, tournamentId, rounds, totalMatches) {
        const matches = [];
        let matchNumber = 1000; // Начинаем с 1000 для losers bracket
        
        console.log(`💔 Создание Losers Bracket: ${rounds} раундов, ${totalMatches} матчей`);
        
        for (let round = 1; round <= rounds; round++) {
            // Правильная логика для количества матчей в Losers Bracket
            const matchesInRound = this._calculateLosersRoundMatches(round, rounds);
            
            console.log(`   Losers Раунд ${round}: ${matchesInRound} матчей`);
            
            for (let i = 0; i < matchesInRound; i++) {
                const result = await client.query(`
                    INSERT INTO matches (
                        tournament_id, 
                        round, 
                        match_number, 
                        bracket_type,
                        status,
                        bracket_position
                    ) VALUES ($1, $2, $3, 'loser', 'pending', $4)
                    RETURNING *
                `, [tournamentId, round, matchNumber, `LB_R${round}_M${i+1}`]);
                
                matches.push(result.rows[0]);
                matchNumber++;
            }
        }
        
        return matches;
    }
    
    /**
     * 📊 Правильный расчет количества матчей в раунде Losers Bracket
     */
    static _calculateLosersRoundMatches(round, totalRounds) {
        // В Double Elimination структура Losers Bracket следует специфичной логике:
        // - Нечетные раунды (1, 3, 5...): только проигравшие из Winners
        // - Четные раунды (2, 4, 6...): проигравшие из Winners + победители предыдущего раунда Losers
        
        const winnersRounds = Math.log2(Math.pow(2, Math.ceil(totalRounds / 2)));
        const initialParticipants = Math.pow(2, winnersRounds);
        
        if (round % 2 === 1) {
            // Нечетные раунды: проигравшие из Winners Bracket
            const winnersRoundFeeding = Math.floor((round + 1) / 2) + 1;
            return Math.pow(2, winnersRounds - winnersRoundFeeding);
        } else {
            // Четные раунды: смешанный
            const winnersRoundFeeding = Math.floor(round / 2) + 1;
            return Math.pow(2, winnersRounds - winnersRoundFeeding);
        }
    }
    
    /**
     * 🏁 Создание Grand Final матчей
     */
    static async _createGrandFinalMatches(client, tournamentId) {
        const matches = [];
        
        console.log(`🏁 Создание Grand Final матчей`);
        
        // Grand Final (основной)
        const grandFinalResult = await client.query(`
            INSERT INTO matches (
                tournament_id, 
                round, 
                match_number, 
                bracket_type,
                status,
                bracket_position
            ) VALUES ($1, 999, 9999, 'grand_final', 'pending', 'GF_MAIN')
            RETURNING *
        `, [tournamentId]);
        
        matches.push(grandFinalResult.rows[0]);
        
        // Grand Final Reset (если winner losers bracket выиграет)
        const grandFinalResetResult = await client.query(`
            INSERT INTO matches (
                tournament_id, 
                round, 
                match_number, 
                bracket_type,
                status,
                bracket_position
            ) VALUES ($1, 999, 9998, 'grand_final_reset', 'pending', 'GF_RESET')
            RETURNING *
        `, [tournamentId]);
        
        matches.push(grandFinalResetResult.rows[0]);
        
        return matches;
    }
    
    /**
     * 🔗 Установка связей между матчами в Double Elimination
     */
    static async _establishDoubleEliminationConnections(client, winnersMatches, losersMatches, grandFinalMatches, bracketMath) {
        console.log(`🔗 Установка связей Double Elimination`);
        
        // 1. Связи внутри Winners Bracket
        await this._linkWinnersBracket(client, winnersMatches);
        
        // 2. Связи внутри Losers Bracket
        await this._linkLosersBracket(client, losersMatches);
        
        // 3. Связи проигравших из Winners в Losers
        await this._linkWinnersToLosers(client, winnersMatches, losersMatches, bracketMath);
        
        // 4. Связи с Grand Final
        await this._linkToGrandFinal(client, winnersMatches, losersMatches, grandFinalMatches);
    }
    
    /**
     * 🏆 Связывание Winners Bracket
     */
    static async _linkWinnersBracket(client, winnersMatches) {
        // Группируем матчи по раундам
        const winnersByRound = {};
        winnersMatches.forEach(match => {
            if (!winnersByRound[match.round]) {
                winnersByRound[match.round] = [];
            }
            winnersByRound[match.round].push(match);
        });
        
        // Связываем соседние раунды
        const rounds = Object.keys(winnersByRound).map(Number).sort((a, b) => a - b);
        
        for (let i = 0; i < rounds.length - 1; i++) {
            const currentRound = rounds[i];
            const nextRound = rounds[i + 1];
            
            const currentMatches = winnersByRound[currentRound];
            const nextMatches = winnersByRound[nextRound];
            
            // Каждые 2 матча текущего раунда ведут к 1 матчу следующего
            for (let j = 0; j < currentMatches.length; j++) {
                const nextMatchIndex = Math.floor(j / 2);
                if (nextMatches[nextMatchIndex]) {
                    await client.query(`
                        UPDATE matches SET next_match_id = $1 WHERE id = $2
                    `, [nextMatches[nextMatchIndex].id, currentMatches[j].id]);
                }
            }
        }
    }
    
    /**
     * 💔 Связывание Losers Bracket
     */
    static async _linkLosersBracket(client, losersMatches) {
        // Группируем матчи по раундам
        const losersByRound = {};
        losersMatches.forEach(match => {
            if (!losersByRound[match.round]) {
                losersByRound[match.round] = [];
            }
            losersByRound[match.round].push(match);
        });
        
        // Связываем соседние раунды в Losers Bracket
        const rounds = Object.keys(losersByRound).map(Number).sort((a, b) => a - b);
        
        for (let i = 0; i < rounds.length - 1; i++) {
            const currentRound = rounds[i];
            const nextRound = rounds[i + 1];
            
            const currentMatches = losersByRound[currentRound];
            const nextMatches = losersByRound[nextRound];
            
            // Логика зависит от четности раунда
            if (currentRound % 2 === 0) {
                // Четные раунды: 1 к 1 продвижение
                for (let j = 0; j < currentMatches.length && j < nextMatches.length; j++) {
                    await client.query(`
                        UPDATE matches SET next_match_id = $1 WHERE id = $2
                    `, [nextMatches[j].id, currentMatches[j].id]);
                }
            } else {
                // Нечетные раунды: 2 к 1 продвижение
                for (let j = 0; j < currentMatches.length; j++) {
                    const nextMatchIndex = Math.floor(j / 2);
                    if (nextMatches[nextMatchIndex]) {
                        await client.query(`
                            UPDATE matches SET next_match_id = $1 WHERE id = $2
                        `, [nextMatches[nextMatchIndex].id, currentMatches[j].id]);
                    }
                }
            }
        }
    }
    
    /**
     * 🔄 Связывание проигравших из Winners в Losers
     */
    static async _linkWinnersToLosers(client, winnersMatches, losersMatches, bracketMath) {
        // Группируем матчи по раундам
        const winnersByRound = {};
        winnersMatches.forEach(match => {
            if (!winnersByRound[match.round]) {
                winnersByRound[match.round] = [];
            }
            winnersByRound[match.round].push(match);
        });
        
        const losersByRound = {};
        losersMatches.forEach(match => {
            if (!losersByRound[match.round]) {
                losersByRound[match.round] = [];
            }
            losersByRound[match.round].push(match);
        });
        
        // Связываем проигравших из Winners в соответствующие раунды Losers
        const winnersRounds = Object.keys(winnersByRound).map(Number).sort((a, b) => a - b);
        
        winnersRounds.forEach(winnersRound => {
            const winnersMatches = winnersByRound[winnersRound];
            
            // Проигравшие из каждого раунда Winners идут в определенный раунд Losers
            const targetLosersRound = this._calculateTargetLosersRound(winnersRound, bracketMath);
            const targetLosersMatches = losersByRound[targetLosersRound];
            
            if (targetLosersMatches) {
                winnersMatches.forEach(async (winnerMatch, index) => {
                    const targetLoserMatch = targetLosersMatches[index] || targetLosersMatches[0];
                    
                    await client.query(`
                        UPDATE matches SET loser_next_match_id = $1 WHERE id = $2
                    `, [targetLoserMatch.id, winnerMatch.id]);
                });
            }
        });
    }
    
    /**
     * 🎯 Расчет целевого раунда Losers для проигравших из Winners
     */
    static _calculateTargetLosersRound(winnersRound, bracketMath) {
        // В Double Elimination проигравшие из Winners Bracket попадают в Losers Bracket
        // по определенной формуле, зависящей от структуры турнира
        
        const totalWinnersRounds = bracketMath.winnersRounds;
        
        // Проигравшие из раунда 1 Winners идут в раунд 1 Losers
        // Проигравшие из раунда 2 Winners идут в раунд 3 Losers
        // И так далее...
        
        if (winnersRound === 1) {
            return 1;
        } else {
            return (winnersRound - 1) * 2 + 1;
        }
    }
    
    /**
     * 🏁 Связывание с Grand Final
     */
    static async _linkToGrandFinal(client, winnersMatches, losersMatches, grandFinalMatches) {
        // Финалист Winners Bracket идет в Grand Final
        const winnersFinal = winnersMatches.find(m => m.round === Math.max(...winnersMatches.map(m => m.round)));
        
        // Финалист Losers Bracket идет в Grand Final
        const losersFinal = losersMatches.find(m => m.round === Math.max(...losersMatches.map(m => m.round)));
        
        const grandFinal = grandFinalMatches.find(m => m.bracket_type === 'grand_final');
        
        if (winnersFinal && grandFinal) {
            await client.query(`
                UPDATE matches SET next_match_id = $1 WHERE id = $2
            `, [grandFinal.id, winnersFinal.id]);
        }
        
        if (losersFinal && grandFinal) {
            await client.query(`
                UPDATE matches SET next_match_id = $1 WHERE id = $2
            `, [grandFinal.id, losersFinal.id]);
        }
    }
    
    /**
     * 👥 Размещение участников в первом раунде Winners Bracket
     */
    static async _placeParticipantsInWinnersBracket(client, winnersMatches, participants, bracketMath) {
        console.log(`👥 Размещение ${participants.length} участников в Winners Bracket`);
        
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
            
            console.log(`✅ Winners Bracket матч ${match.match_number}: ${team1.name || team1.id} vs ${team2?.name || team2?.id || 'BYE'}`);
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
        
        if (participants.length > 128) {
            throw new Error('Слишком много участников для double elimination (максимум 128)');
        }
        
        participants.forEach((participant, index) => {
            if (!participant || typeof participant !== 'object') {
                throw new Error(`Участник ${index + 1} имеет неверную структуру`);
            }
            
            if (!participant.id) {
                throw new Error(`У участника ${index + 1} отсутствует ID`);
            }
        });
        
        if (options.seedingType && !Object.values(SEEDING_TYPES).includes(options.seedingType)) {
            throw new Error(`Неверный тип распределения: ${options.seedingType}`);
        }
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
        const requiredBracketTypes = ['winner', 'loser', 'grand_final', 'grand_final_reset'];
        requiredBracketTypes.forEach(type => {
            if (!matches.some(m => m.bracket_type === type)) {
                errors.push(`Отсутствуют матчи типа ${type}`);
            }
        });
        
        // Проверка структуры Winners Bracket
        const winnersMatches = matches.filter(m => m.bracket_type === 'winner');
        if (winnersMatches.length !== bracketMath.winnersMatches) {
            errors.push(`Неверное количество матчей Winners Bracket: ${winnersMatches.length}, ожидается ${bracketMath.winnersMatches}`);
        }
        
        // Проверка структуры Losers Bracket
        const losersMatches = matches.filter(m => m.bracket_type === 'loser');
        if (losersMatches.length !== bracketMath.losersMatches) {
            errors.push(`Неверное количество матчей Losers Bracket: ${losersMatches.length}, ожидается ${bracketMath.losersMatches}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            statistics: {
                totalMatches: matches.length,
                winnersMatches: winnersMatches.length,
                losersMatches: losersMatches.length,
                grandFinalMatches: matches.filter(m => m.bracket_type.includes('grand_final')).length
            }
        };
    }
    
    /**
     * 🎯 Продвижение участника в Double Elimination
     * @param {number} matchId - ID завершенного матча
     * @param {number} winnerId - ID победителя
     * @param {number} loserId - ID проигравшего
     */
    static async advanceParticipant(matchId, winnerId, loserId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Получаем информацию о матче
            const matchResult = await client.query(`
                SELECT * FROM matches WHERE id = $1
            `, [matchId]);
            
            const match = matchResult.rows[0];
            if (!match) {
                throw new Error('Матч не найден');
            }
            
            // Обновляем результат матча
            await client.query(`
                UPDATE matches 
                SET winner_team_id = $1, status = 'completed'
                WHERE id = $2
            `, [winnerId, matchId]);
            
            // Продвигаем победителя
            if (match.next_match_id) {
                await this._advanceWinner(client, winnerId, match.next_match_id);
            }
            
            // Продвигаем проигравшего (если есть куда)
            if (match.loser_next_match_id) {
                await this._advanceLoser(client, loserId, match.loser_next_match_id);
            }
            
            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * 🏆 Продвижение победителя
     */
    static async _advanceWinner(client, winnerId, nextMatchId) {
        const nextMatch = await client.query(`
            SELECT * FROM matches WHERE id = $1
        `, [nextMatchId]);
        
        if (nextMatch.rows.length === 0) {
            throw new Error('Следующий матч не найден');
        }
        
        const match = nextMatch.rows[0];
        
        // Размещаем победителя в свободной позиции
        if (!match.team1_id) {
            await client.query(`
                UPDATE matches SET team1_id = $1 WHERE id = $2
            `, [winnerId, nextMatchId]);
        } else if (!match.team2_id) {
            await client.query(`
                UPDATE matches SET team2_id = $1 WHERE id = $2
            `, [winnerId, nextMatchId]);
        } else {
            throw new Error('Следующий матч уже заполнен');
        }
    }
    
    /**
     * 💔 Продвижение проигравшего в Losers Bracket
     */
    static async _advanceLoser(client, loserId, loserNextMatchId) {
        const nextMatch = await client.query(`
            SELECT * FROM matches WHERE id = $1
        `, [loserNextMatchId]);
        
        if (nextMatch.rows.length === 0) {
            throw new Error('Следующий матч в Losers Bracket не найден');
        }
        
        const match = nextMatch.rows[0];
        
        // Размещаем проигравшего в свободной позиции Losers Bracket
        if (!match.team1_id) {
            await client.query(`
                UPDATE matches SET team1_id = $1 WHERE id = $2
            `, [loserId, loserNextMatchId]);
        } else if (!match.team2_id) {
            await client.query(`
                UPDATE matches SET team2_id = $1 WHERE id = $2
            `, [loserId, loserNextMatchId]);
        } else {
            throw new Error('Следующий матч в Losers Bracket уже заполнен');
        }
    }
}

module.exports = { DoubleEliminationEngine }; 