/**
 * ⚡ ДВИЖОК DOUBLE ELIMINATION V3.0 - ТАБЛИЧНЫЙ ПОДХОД
 * 
 * Полноценный движок для генерации турнирной сетки Double Elimination
 * с использованием предрасчитанных табличных структур
 * 
 * Особенности v3.0:
 * - Использует предрасчитанные таблицы для точной генерации
 * - Поддержка размеров: 4, 8, 16, 32, 64, 128 участников
 * - Математически корректные структуры Losers Bracket
 * - Правильные связи Winners → Losers с маппингом
 * - Включает "Малый финал лузеров"
 */

const { SeedingFactory, SEEDING_TYPES } = require('../../utils/tournament/seedingAlgorithms');
const { 
    getDoubleEliminationStructure, 
    validateStructure, 
    calculateTargetLosersRound,
    getLosersRoundDescription,
    getSupportedSizes 
} = require('../../utils/tournament/doubleEliminationStructures');
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
            
            // 4. Коррекция параметров под Full Double Elimination
            const isFullDE = options.fullDoubleElimination === true;
            if (!isFullDE && bracketMath.hasGrandFinalReset) {
                // Если reset-матч заложен в структуру, но отключен в опциях, корректируем ожидания
                const adjustedGrandFinalMatches = Math.max(1, (bracketMath.grandFinalMatches || 2) - 1);
                const adjustedTotalMatches = Math.max(0, (bracketMath.totalMatches || 0) - 1);
                bracketMath = {
                    ...bracketMath,
                    hasGrandFinalReset: false,
                    grandFinalMatches: adjustedGrandFinalMatches,
                    totalMatches: adjustedTotalMatches
                };
                console.log(`🛠️ Коррекция параметров под FullDE=false: GF=${bracketMath.grandFinalMatches}, total=${bracketMath.totalMatches}`);
            }

            // 5. Генерация структуры матчей
            const matches = await this._generateMatches(
                tournamentId,
                seededParticipants,
                bracketMath,
                options
            );
            
            // 6. Финальная валидация
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
     * 📊 Получение параметров Double Elimination из табличных структур  
     * @param {number} participantCount - Количество участников
     * @returns {Object} - Параметры double elimination
     */
    static _calculateDoubleEliminationParams(participantCount) {
        try {
            // Получаем структуру из предрасчитанных таблиц
            const structure = getDoubleEliminationStructure(participantCount);
            
            // Валидируем структуру
            const validation = validateStructure(structure);
            if (!validation.isValid) {
                throw new Error(`Некорректная структура турнира: ${validation.errors.join(', ')}`);
            }
            
            console.log(`📊 Использована табличная структура для ${structure.participants} участников:`);
            console.log(`   - Winners: ${structure.winnersRounds} раундов, ${structure.winnersStructure.join('+')} = ${validation.statistics.winnersMatches} матчей`);
            console.log(`   - Losers: ${structure.losersRounds} раундов, ${structure.losersStructure.join('+')} = ${validation.statistics.losersMatches} матчей`);
            console.log(`   - Grand Final: ${validation.statistics.grandFinalMatches} матча`);
            console.log(`   - Общий итог: ${validation.statistics.totalMatches} матчей`);
            
            return {
                // Основные параметры
                participants: structure.participants,
                actualParticipants: structure.actualParticipants,
                byesNeeded: structure.byesNeeded,
                
                // Структуры раундов
                winnersRounds: structure.winnersRounds,
                losersRounds: structure.losersRounds,
                winnersStructure: structure.winnersStructure,
                losersStructure: structure.losersStructure,
                
                // Количество матчей
                winnersMatches: validation.statistics.winnersMatches,
                losersMatches: validation.statistics.losersMatches,
                grandFinalMatches: validation.statistics.grandFinalMatches,
                totalMatches: validation.statistics.totalMatches,
                
                // Маппинг связей Winners → Losers
                winnersToLosersMapping: structure.winnersToLosersMapping,
                
                // Дополнительная информация
                description: structure.description,
                hasGrandFinalReset: true,
                
                // Валидация
                validation: validation
            };
            
        } catch (error) {
            // Проверяем поддерживаемые размеры
            const supportedSizes = getSupportedSizes();
            const maxSupported = Math.max(...supportedSizes);
            
            if (participantCount > maxSupported) {
                throw new Error(`Слишком много участников для Double Elimination: ${participantCount}. Максимум поддерживается: ${maxSupported}`);
            } else {
                throw new Error(`Ошибка получения структуры Double Elimination: ${error.message}. Поддерживаемые размеры: ${supportedSizes.join(', ')}`);
            }
        }
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
            
            // 🆕 ЛОКАЛЬНАЯ НУМЕРАЦИЯ МАТЧЕЙ ВНУТРИ ТУРНИРА
            let currentMatchNumber = 1;
            let currentTournamentMatchNumber = 1;
            console.log(`🔢 [DoubleEliminationEngine] Используем tournament_match_number для турнира ${tournamentId}`);
            
            // 1. Создаем матчи Winners Bracket
            const winnersResult = await this._createWinnersMatches(
                client, 
                tournamentId, 
                bracketMath.winnersRounds,
                bracketMath.winnersMatches,
                currentMatchNumber,
                currentTournamentMatchNumber
            );
            const winnersMatches = winnersResult.matches;
            currentMatchNumber = winnersResult.nextMatchNumber;
            currentTournamentMatchNumber = winnersResult.nextTournamentMatchNumber;
            
            console.log(`✅ [DoubleEliminationEngine] Winners Bracket создан: ${winnersMatches.length} матчей`);
            
            // 2. Создаем матчи Losers Bracket
            const losersResult = await this._createLosersMatches(
                client, 
                tournamentId, 
                bracketMath,
                currentMatchNumber,
                currentTournamentMatchNumber
            );
            const losersMatches = losersResult.matches;
            currentMatchNumber = losersResult.nextMatchNumber;
            currentTournamentMatchNumber = losersResult.nextTournamentMatchNumber;
            
            console.log(`✅ [DoubleEliminationEngine] Losers Bracket создан: ${losersMatches.length} матчей`);
            
            // 3. Создаем Grand Final матчи
            const grandFinalResult = await this._createGrandFinalMatches(
                client, 
                tournamentId,
                bracketMath,
                currentMatchNumber,
                currentTournamentMatchNumber,
                options // 🆕 НОВОЕ: Передаем опции для проверки fullDoubleElimination
            );
            const grandFinalMatches = grandFinalResult.matches;
            
            console.log(`✅ [DoubleEliminationEngine] Grand Final матчи созданы: ${grandFinalMatches.length} матчей`);
            
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
    static async _createWinnersMatches(client, tournamentId, rounds, totalMatches, startMatchNumber, startTournamentMatchNumber) {
        const matches = [];
        let matchNumber = startMatchNumber;
        let tournamentMatchNumber = startTournamentMatchNumber;
        
        console.log(`🏆 Создание Winners Bracket: ${rounds} раундов, ${totalMatches} матчей, старт с номера ${startMatchNumber}`);
        
        for (let round = 1; round <= rounds; round++) {
            const matchesInRound = Math.pow(2, rounds - round);
            
            console.log(`   🔢 Раунд ${round}: ${matchesInRound} матчей (номера ${matchNumber}-${matchNumber + matchesInRound - 1}, локальные ${tournamentMatchNumber}-${tournamentMatchNumber + matchesInRound - 1})`);
            
            for (let i = 0; i < matchesInRound; i++) {
                const result = await client.query(`
                    INSERT INTO matches (
                        tournament_id, 
                        round, 
                        match_number,
                        tournament_match_number,
                        bracket_type,
                        status
                    ) VALUES ($1, $2, $3, $4, 'winner', 'pending')
                    RETURNING *
                `, [tournamentId, round, matchNumber, tournamentMatchNumber]);
                
                matches.push(result.rows[0]);
                console.log(`     ✅ Создан матч ID ${result.rows[0].id} с номером ${matchNumber} (локальный ${tournamentMatchNumber}) (WB R${round})`);
                matchNumber++;
                tournamentMatchNumber++;
            }
        }
        
        console.log(`🏆 Winners Bracket завершен: номера ${startMatchNumber}-${matchNumber-1}, следующий номер: ${matchNumber}`);
        return { 
            matches, 
            nextMatchNumber: matchNumber,
            nextTournamentMatchNumber: tournamentMatchNumber
        };
    }
    
    /**
     * 💔 Создание матчей Losers Bracket по табличной структуре
     * 🆕 С поддержкой специальных названий матчей
     */
    static async _createLosersMatches(client, tournamentId, bracketMath, startMatchNumber, startTournamentMatchNumber) {
        const matches = [];
        let matchNumber = startMatchNumber;
        let tournamentMatchNumber = startTournamentMatchNumber;
        
        const { losersStructure, losersRounds } = bracketMath;
        
        console.log(`💔 Создание Losers Bracket по табличной структуре: ${losersRounds} раундов, старт с номера ${startMatchNumber}`);
        console.log(`   Структура: [${losersStructure.join(', ')}] = ${bracketMath.losersMatches} матчей`);
        
        for (let round = 1; round <= losersRounds; round++) {
            const matchesInRound = losersStructure[round - 1];
            const roundDescription = getLosersRoundDescription(round, bracketMath);
            
            console.log(`   🔢 Losers Раунд ${round}: ${matchesInRound} матчей (${roundDescription}) номера ${matchNumber}-${matchNumber + matchesInRound - 1}, локальные ${tournamentMatchNumber}-${tournamentMatchNumber + matchesInRound - 1}`);
            
            for (let i = 0; i < matchesInRound; i++) {
                // 🆕 Определяем тип и названия матча
                const matchInfo = this._determineLoserMatchInfo(round, i, matchesInRound, losersRounds);
                
                const result = await client.query(`
                    INSERT INTO matches (
                        tournament_id, 
                        round, 
                        match_number,
                        tournament_match_number,
                        bracket_type,
                        round_name,
                        match_title,
                        status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                    RETURNING *
                `, [
                    tournamentId, 
                    round, 
                    matchNumber, 
                    tournamentMatchNumber,
                    matchInfo.bracketType,
                    matchInfo.roundName, 
                    matchInfo.matchTitle
                ]);
                
                matches.push(result.rows[0]);
                console.log(`     ✅ Создан ${matchInfo.description} ID ${result.rows[0].id} с номером ${matchNumber} (локальный ${tournamentMatchNumber}) (LB R${round})`);
                matchNumber++;
                tournamentMatchNumber++;
            }
        }
        
        console.log(`💔 Losers Bracket завершен: номера ${startMatchNumber}-${matchNumber-1}, следующий номер: ${matchNumber}`);
        console.log(`✅ Создано ${matches.length} матчей Losers Bracket (ожидалось ${bracketMath.losersMatches})`);
        
        return { 
            matches, 
            nextMatchNumber: matchNumber,
            nextTournamentMatchNumber: tournamentMatchNumber
        };
    }
    
    /**
     * 🏁 Создание Grand Final матчей
     */
    static async _createGrandFinalMatches(client, tournamentId, bracketMath, startMatchNumber, startTournamentMatchNumber, options = {}) {
        const matches = [];
        let matchNumber = startMatchNumber;
        let tournamentMatchNumber = startTournamentMatchNumber;
        
        // 🆕 НОВОЕ: Проверяем опцию Full Double Elimination
        const fullDoubleElimination = options.fullDoubleElimination || false;
        
        console.log(`🏁 Создание Grand Final матчей, старт с номера ${startMatchNumber} (локальный ${startTournamentMatchNumber})`);
        console.log(`🎯 Full Double Elimination: ${fullDoubleElimination ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
        
        // Определяем правильный раунд для Grand Final
        const grandFinalRound = Math.max(bracketMath.winnersRounds, bracketMath.losersRounds) + 1;
        
        // Grand Final (основной) - создается всегда
        const grandFinalResult = await client.query(`
            INSERT INTO matches (
                tournament_id, 
                round, 
                match_number,
                tournament_match_number,
                bracket_type,
                status
            ) VALUES ($1, $2, $3, $4, 'grand_final', 'pending')
            RETURNING *
        `, [tournamentId, grandFinalRound, matchNumber, tournamentMatchNumber]);
        
        matches.push(grandFinalResult.rows[0]);
        console.log(`     ✅ Создан Grand Final ID ${grandFinalResult.rows[0].id} с номером ${matchNumber} (локальный ${tournamentMatchNumber}) (GF R${grandFinalRound})`);
        matchNumber++;
        tournamentMatchNumber++;
        
        // 🆕 УСЛОВНОЕ СОЗДАНИЕ: Grand Final Triumph только если включен Full Double Elimination
        if (fullDoubleElimination) {
            const grandFinalResetResult = await client.query(`
                INSERT INTO matches (
                    tournament_id, 
                    round, 
                    match_number,
                    tournament_match_number,
                    bracket_type,
                    status
                ) VALUES ($1, $2, $3, $4, 'grand_final_reset', 'pending')
                RETURNING *
            `, [tournamentId, grandFinalRound, matchNumber, tournamentMatchNumber]);
            
            matches.push(grandFinalResetResult.rows[0]);
            console.log(`     ✅ Создан Grand Final Triumph ID ${grandFinalResetResult.rows[0].id} с номером ${matchNumber} (локальный ${tournamentMatchNumber}) (GF Triumph R${grandFinalRound})`);
            matchNumber++;
            tournamentMatchNumber++;
        } else {
            console.log(`     ⏭️ Grand Final Triumph ПРОПУЩЕН (Full Double Elimination выключен)`);
        }
        
        console.log(`🏁 Grand Final завершен: номера ${startMatchNumber}-${matchNumber-1}, следующий номер: ${matchNumber}`);
        return { 
            matches, 
            nextMatchNumber: matchNumber,
            nextTournamentMatchNumber: tournamentMatchNumber
        };
    }
    
    /**
     * 🔗 Установка связей между матчами в Double Elimination
     */
    static async _establishDoubleEliminationConnections(client, winnersMatches, losersMatches, grandFinalMatches, bracketMath) {
        console.log(`🔗 Установка связей Double Elimination`);
        console.log(`📊 Статистика: Winners: ${winnersMatches.length}, Losers: ${losersMatches.length}, Grand Final: ${grandFinalMatches.length}`);
        
        // 1. Связи внутри Winners Bracket
        console.log(`\n1️⃣ Связывание Winners Bracket...`);
        await this._linkWinnersBracket(client, winnersMatches);
        
        // 2. Связи внутри Losers Bracket
        console.log(`\n2️⃣ Связывание Losers Bracket...`);
        await this._linkLosersBracket(client, losersMatches);
        
        // 3. Связи проигравших из Winners в Losers
        console.log(`\n3️⃣ Связывание Winners → Losers (проигравшие)...`);
        await this._linkWinnersToLosers(client, winnersMatches, losersMatches, bracketMath);
        
        // 4. Связи с Grand Final
        console.log(`\n4️⃣ Связывание с Grand Final...`);
        await this._linkToGrandFinal(client, winnersMatches, losersMatches, grandFinalMatches);
        
        console.log(`✅ Все связи Double Elimination установлены`);
    }
    
    /**
     * 🏆 Связывание Winners Bracket
     */
    static async _linkWinnersBracket(client, winnersMatches) {
        console.log(`🏆 Связывание Winners Bracket (${winnersMatches.length} матчей)`);
        
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
        console.log(`🏆 Winners раунды: ${rounds.join(', ')}`);
        
        for (let i = 0; i < rounds.length - 1; i++) {
            const currentRound = rounds[i];
            const nextRound = rounds[i + 1];
            
            const currentMatches = winnersByRound[currentRound];
            const nextMatches = winnersByRound[nextRound];
            
            console.log(`🔗 Связывание Winners R${currentRound} (${currentMatches.length} матчей) → R${nextRound} (${nextMatches.length} матчей)`);
            
            // Каждые 2 матча текущего раунда ведут к 1 матчу следующего
            for (let j = 0; j < currentMatches.length; j++) {
                const nextMatchIndex = Math.floor(j / 2);
                if (nextMatches[nextMatchIndex]) {
                    await client.query(`
                        UPDATE matches SET next_match_id = $1 WHERE id = $2
                    `, [nextMatches[nextMatchIndex].id, currentMatches[j].id]);
                    
                    console.log(`  🔗 Winners матч ${currentMatches[j].id} → матч ${nextMatches[nextMatchIndex].id}`);
                }
            }
        }
    }
    
    /**
     * 💔 Связывание Losers Bracket
     */
    static async _linkLosersBracket(client, losersMatches) {
        console.log(`💔 Связывание Losers Bracket (${losersMatches.length} матчей)`);
        
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
        console.log(`💔 Losers раунды: ${rounds.join(', ')}`);
        
        for (let i = 0; i < rounds.length - 1; i++) {
            const currentRound = rounds[i];
            const nextRound = rounds[i + 1];
            
            const currentMatches = losersByRound[currentRound];
            const nextMatches = losersByRound[nextRound];
            
            console.log(`🔗 Связывание Losers R${currentRound} (${currentMatches.length} матчей) → R${nextRound} (${nextMatches.length} матчей)`);
            
            // Логика зависит от четности раунда
            if (currentRound % 2 === 0) {
                // Четные раунды: 1 к 1 продвижение
                console.log(`  📋 Четный раунд R${currentRound}: связывание 1 к 1`);
                for (let j = 0; j < currentMatches.length && j < nextMatches.length; j++) {
                    await client.query(`
                        UPDATE matches SET next_match_id = $1 WHERE id = $2
                    `, [nextMatches[j].id, currentMatches[j].id]);
                    
                    console.log(`  🔗 Losers матч ${currentMatches[j].id} → матч ${nextMatches[j].id}`);
                }
            } else {
                // Нечетные раунды: 2 к 1 продвижение
                console.log(`  📋 Нечетный раунд R${currentRound}: связывание 2 к 1`);
                for (let j = 0; j < currentMatches.length; j++) {
                    const nextMatchIndex = Math.floor(j / 2);
                    if (nextMatches[nextMatchIndex]) {
                        await client.query(`
                            UPDATE matches SET next_match_id = $1 WHERE id = $2
                        `, [nextMatches[nextMatchIndex].id, currentMatches[j].id]);
                        
                        console.log(`  🔗 Losers матч ${currentMatches[j].id} → матч ${nextMatches[nextMatchIndex].id}`);
                    }
                }
            }
        }
    }
    
    /**
     * 🔄 Связывание проигравших из Winners в Losers
     */
    static async _linkWinnersToLosers(client, winnersMatches, losersMatches, bracketMath) {
        console.log(`🔄 Связывание проигравших Winners → Losers`);
        
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
        
        console.log(`📊 Winners раунды: ${Object.keys(winnersByRound).join(', ')}`);
        console.log(`📊 Losers раунды: ${Object.keys(losersByRound).join(', ')}`);
        
        // Связываем проигравших из Winners в соответствующие раунды Losers
        const winnersRounds = Object.keys(winnersByRound).map(Number).sort((a, b) => a - b);
        
        for (const winnersRound of winnersRounds) {
            const winnersMatches = winnersByRound[winnersRound];
            
            // Проигравшие из каждого раунда Winners идут в определенный раунд Losers
            const targetLosersRound = this._calculateTargetLosersRound(winnersRound, bracketMath);
            const targetLosersMatches = losersByRound[targetLosersRound];
            
            console.log(`🎯 Winners R${winnersRound} (${winnersMatches.length} матчей) → Losers R${targetLosersRound} (${targetLosersMatches?.length || 0} матчей)`);
            
            if (targetLosersMatches) {
                for (let index = 0; index < winnersMatches.length; index++) {
                    const winnerMatch = winnersMatches[index];
                    const targetLoserMatch = targetLosersMatches[index] || targetLosersMatches[0];
                    
                    await client.query(`
                        UPDATE matches SET loser_next_match_id = $1 WHERE id = $2
                    `, [targetLoserMatch.id, winnerMatch.id]);
                    
                    console.log(`🔗 Winners R${winnersRound} матч ${winnerMatch.id} (проигравший) → Losers R${targetLosersRound} матч ${targetLoserMatch.id}`);
                }
            } else {
                console.log(`⚠️ Не найдены матчи в Losers R${targetLosersRound} для Winners R${winnersRound}`);
            }
        }
    }
    
    /**
     * 🎯 Расчет целевого раунда Losers с использованием табличного маппинга
     */
    static _calculateTargetLosersRound(winnersRound, bracketMath) {
        const targetRound = calculateTargetLosersRound(winnersRound, bracketMath);
        
        if (!targetRound) {
            console.log(`⚠️ Не найден целевой раунд Losers для Winners R${winnersRound}`);
            return null;
        }
        
        console.log(`🎯 Winners R${winnersRound} → Losers R${targetRound} (по табличному маппингу)`);
        return targetRound;
    }
    
    /**
     * 🏁 Связывание с Grand Final
     */
    static async _linkToGrandFinal(client, winnersMatches, losersMatches, grandFinalMatches) {
        console.log(`🏁 Связывание с Grand Final`);
        
        // Финалист Winners Bracket идет в Grand Final
        const winnersFinal = winnersMatches.find(m => m.round === Math.max(...winnersMatches.map(m => m.round)));
        
        // Финалист Losers Bracket идет в Grand Final
        const losersFinal = losersMatches.find(m => m.round === Math.max(...losersMatches.map(m => m.round)));
        
        const grandFinal = grandFinalMatches.find(m => m.bracket_type === 'grand_final');
        
        if (winnersFinal && grandFinal) {
            await client.query(`
                UPDATE matches SET next_match_id = $1 WHERE id = $2
            `, [grandFinal.id, winnersFinal.id]);
            
            console.log(`🔗 Winners Final матч ${winnersFinal.id} → Grand Final ${grandFinal.id}`);
        }
        
        if (losersFinal && grandFinal) {
            await client.query(`
                UPDATE matches SET next_match_id = $1 WHERE id = $2
            `, [grandFinal.id, losersFinal.id]);
            
            console.log(`🔗 Losers Final матч ${losersFinal.id} → Grand Final ${grandFinal.id}`);
        }
    }
    
    /**
     * 👥 Размещение участников в первом раунде Winners Bracket
     * 🆕 УЛУЧШЕННЫЙ АЛГОРИТМ: равномерное распределение, исключение BYE vs BYE матчей
     */
    static async _placeParticipantsInWinnersBracket(client, winnersMatches, participants, bracketMath) {
        console.log(`👥 Размещение ${participants.length} участников в Winners Bracket`);
        console.log(`📊 Сетка рассчитана на ${bracketMath.participants} участников (bye-раунды: ${bracketMath.byesNeeded})`);
        
        const firstRoundMatches = winnersMatches.filter(m => m.round === 1);
        console.log(`🥊 Матчей в первом раунде: ${firstRoundMatches.length}`);
        
        // 🆕 УЛУЧШЕННЫЙ АЛГОРИТМ: равномерное распределение участников
        const optimizedPlacement = this._calculateOptimizedPlacement(participants, firstRoundMatches.length);
        
        console.log(`🎯 Оптимизированное размещение (исключаем BYE vs BYE):`);
        for (let i = 0; i < optimizedPlacement.length; i++) {
            const placement = optimizedPlacement[i];
            console.log(`   Матч ${i + 1}: ${placement.team1?.name || placement.team1?.id || 'BYE'} vs ${placement.team2?.name || placement.team2?.id || 'BYE'}`);
        }
        
        // Применяем оптимизированное размещение
        for (let i = 0; i < firstRoundMatches.length; i++) {
            const match = firstRoundMatches[i];
            const placement = optimizedPlacement[i];
            
            await client.query(`
                UPDATE matches 
                SET team1_id = $1, team2_id = $2 
                WHERE id = $3
            `, [placement.team1?.id || null, placement.team2?.id || null, match.id]);
            
            const team1Name = placement.team1?.name || placement.team1?.id || 'BYE';
            const team2Name = placement.team2?.name || placement.team2?.id || 'BYE';
            
            console.log(`✅ Winners Bracket матч ${match.match_number}: ${team1Name} vs ${team2Name}`);
        }
    }
    
    /**
     * 🧮 Расчет оптимизированного размещения участников
     * Исключает BYE vs BYE матчи путем равномерного распределения
     * @param {Array} participants - Участники турнира
     * @param {number} totalMatches - Количество матчей в первом раунде
     * @returns {Array} - Массив объектов {team1, team2} для каждого матча
     */
    static _calculateOptimizedPlacement(participants, totalMatches) {
        const placement = [];
        const totalSlots = totalMatches * 2; // Всего позиций в матчах
        const byesNeeded = totalSlots - participants.length;
        
        console.log(`🧮 Расчет размещения: ${participants.length} участников, ${totalMatches} матчей (${totalSlots} позиций), ${byesNeeded} bye-раундов`);
        
        if (byesNeeded === 0) {
            // Идеальный случай: участников ровно столько, сколько позиций
            console.log(`✅ Идеальное заполнение: без bye-раундов`);
            for (let i = 0; i < totalMatches; i++) {
                placement.push({
                    team1: participants[i * 2],
                    team2: participants[i * 2 + 1]
                });
            }
        } else if (byesNeeded >= totalMatches) {
            // Критический случай: bye-раундов больше чем матчей
            // Распределяем участников по одному на матч, остальные матчи - BYE vs BYE
            console.log(`⚠️ Критическое заполнение: ${byesNeeded} bye-раундов для ${totalMatches} матчей`);
            for (let i = 0; i < totalMatches; i++) {
                if (i < participants.length) {
                    placement.push({
                        team1: participants[i],
                        team2: null // BYE
                    });
                } else {
                    placement.push({
                        team1: null, // BYE
                        team2: null  // BYE
                    });
                }
            }
        } else {
            // 🎯 ОСНОВНОЙ АЛГОРИТМ: умное распределение bye-раундов
            console.log(`🎯 Умное распределение: ${byesNeeded} bye-раундов равномерно по ${totalMatches} матчам`);
            
            // Вычисляем, сколько матчей будет с одним bye, а сколько без bye
            const matchesWithBye = byesNeeded;
            const matchesWithoutBye = totalMatches - byesNeeded;
            
            console.log(`   - Матчей без bye: ${matchesWithoutBye}`);
            console.log(`   - Матчей с одним bye: ${matchesWithBye}`);
            
            // Создаем список позиций для равномерного распределения bye
            const byePositions = this._calculateEvenByeDistribution(totalMatches, byesNeeded);
            console.log(`   - Позиции bye-раундов: [${byePositions.join(', ')}]`);
            
            let participantIndex = 0;
            
            for (let matchIndex = 0; matchIndex < totalMatches; matchIndex++) {
                const hasByeInThisMatch = byePositions.includes(matchIndex);
                
                if (hasByeInThisMatch) {
                    // Матч с одним bye
                    placement.push({
                        team1: participants[participantIndex++],
                        team2: null // BYE
                    });
                } else {
                    // Матч без bye (два участника)
                    placement.push({
                        team1: participants[participantIndex++],
                        team2: participants[participantIndex++]
                    });
                }
            }
        }
        
        // Валидация результата
        const actualParticipants = placement.reduce((count, match) => {
            return count + (match.team1 ? 1 : 0) + (match.team2 ? 1 : 0);
        }, 0);
        
        const byeVsByeMatches = placement.filter(match => !match.team1 && !match.team2).length;
        
        console.log(`✅ Валидация размещения:`);
        console.log(`   - Участников размещено: ${actualParticipants} (ожидалось: ${participants.length})`);
        console.log(`   - BYE vs BYE матчей: ${byeVsByeMatches}`);
        
        if (actualParticipants !== participants.length) {
            console.error(`❌ ОШИБКА: потеряны участники в размещении!`);
        }
        
        return placement;
    }
    
    /**
     * 📐 Расчет равномерного распределения bye-раундов по матчам
     * @param {number} totalMatches - Общее количество матчей
     * @param {number} byesNeeded - Количество bye-раундов
     * @returns {Array} - Массив индексов матчей, которые получат bye
     */
    static _calculateEvenByeDistribution(totalMatches, byesNeeded) {
        if (byesNeeded === 0) return [];
        if (byesNeeded >= totalMatches) return Array.from({length: totalMatches}, (_, i) => i);
        
        // Равномерное распределение bye по матчам
        const step = totalMatches / byesNeeded;
        const byePositions = [];
        
        for (let i = 0; i < byesNeeded; i++) {
            const position = Math.floor(i * step);
            byePositions.push(position);
        }
        
        // Если есть дубликаты, распределяем их равномерно
        const uniquePositions = [...new Set(byePositions)];
        if (uniquePositions.length < byesNeeded) {
            // Добавляем недостающие позиции
            const remaining = byesNeeded - uniquePositions.length;
            for (let i = 0; i < remaining; i++) {
                let position = (uniquePositions[uniquePositions.length - 1] + 1 + i) % totalMatches;
                while (uniquePositions.includes(position)) {
                    position = (position + 1) % totalMatches;
                }
                uniquePositions.push(position);
            }
        }
        
        return uniquePositions.slice(0, byesNeeded).sort((a, b) => a - b);
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
     * 🔍 Валидация сгенерированной сетки с использованием табличной валидации
     */
    static _validateGeneratedBracket(matches, bracketMath) {
        const errors = [];
        
        if (!Array.isArray(matches)) {
            errors.push('Матчи должны быть массивом');
            return {
                isValid: false,
                errors,
                statistics: { totalMatches: 0 }
            };
        }
        
        // Используем встроенную валидацию из табличной структуры
        const structureValidation = bracketMath.validation;
        if (!structureValidation.isValid) {
            errors.push(`Структурная валидация не прошла: ${structureValidation.errors.join(', ')}`);
        }
        
        // Проверяем соответствие созданных матчей ожидаемому количеству
        if (matches.length !== bracketMath.totalMatches) {
            errors.push(`Количество матчей не совпадает: ожидается ${bracketMath.totalMatches}, получено ${matches.length}`);
        }
        
        // Проверка наличия всех типов bracket (🆕 включая специальные типы)
        const requiredBracketTypes = bracketMath.hasGrandFinalReset
            ? ['winner', 'loser', 'grand_final', 'grand_final_reset']
            : ['winner', 'loser', 'grand_final'];
        requiredBracketTypes.forEach(type => {
            const matchesOfType = matches.filter(m => m.bracket_type === type);
            if (matchesOfType.length === 0) {
                errors.push(`Отсутствуют матчи типа ${type}`);
            }
        });
        
        // Подробная проверка по типам матчей (🆕 включая специальные матчи лузеров)
        const winnersMatches = matches.filter(m => m.bracket_type === 'winner');
        const losersMatches = matches.filter(m => 
            m.bracket_type === 'loser' || 
            m.bracket_type === 'loser_semifinal' || 
            m.bracket_type === 'loser_final'
        );
        const grandFinalMatches = matches.filter(m => m.bracket_type.includes('grand_final'));
        
        if (winnersMatches.length !== bracketMath.winnersMatches) {
            errors.push(`Winners Bracket: ожидается ${bracketMath.winnersMatches} матчей, получено ${winnersMatches.length}`);
        }
        
        if (losersMatches.length !== bracketMath.losersMatches) {
            errors.push(`Losers Bracket: ожидается ${bracketMath.losersMatches} матчей, получено ${losersMatches.length}`);
        }
        
        if (grandFinalMatches.length !== bracketMath.grandFinalMatches) {
            errors.push(`Grand Final: ожидается ${bracketMath.grandFinalMatches} матчей, получено ${grandFinalMatches.length}`);
        }
        
        // Проверка структуры раундов
        console.log(`🔍 Валидация: создано матчей Winners=${winnersMatches.length}, Losers=${losersMatches.length}, GF=${grandFinalMatches.length}`);
        console.log(`🔍 Ожидалось: Winners=${bracketMath.winnersMatches}, Losers=${bracketMath.losersMatches}, GF=${bracketMath.grandFinalMatches}`);
        
        return {
            isValid: errors.length === 0,
            errors,
            statistics: {
                totalMatches: matches.length,
                winnersMatches: winnersMatches.length,
                losersMatches: losersMatches.length,
                grandFinalMatches: grandFinalMatches.length,
                description: bracketMath.description || 'Табличная структура Double Elimination'
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
    
    /**
     * 🎯 Определение типа и названий матча в Losers Bracket
     * 🆕 Интегрированная логика специальных матчей
     * 
     * @param {number} round - Номер раунда
     * @param {number} matchIndex - Индекс матча в раунде  
     * @param {number} matchesInRound - Количество матчей в раунде
     * @param {number} totalLosersRounds - Общее количество раундов Losers
     * @returns {Object} - Информация о матче
     */
    static _determineLoserMatchInfo(round, matchIndex, matchesInRound, totalLosersRounds) {
        // 🥉 Предпоследний раунд, единственный матч = Малый финал лузеров
        if (round === totalLosersRounds - 1 && matchesInRound === 1) {
            return {
                bracketType: 'loser_semifinal',
                roundName: 'Малый финал лузеров',
                matchTitle: 'Малый финал лузеров',
                description: 'Малый финал лузеров'
            };
        }
        
        // 🥈 Последний раунд = Финал лузеров
        if (round === totalLosersRounds && matchesInRound === 1) {
            return {
                bracketType: 'loser_final',
                roundName: 'Финал лузеров',
                matchTitle: 'Финал лузеров',
                description: 'Финал лузеров'
            };
        }
        
        // 💔 Обычный матч лузеров
        return {
            bracketType: 'loser',
            roundName: `Раунд ${round} (Losers)`,
            matchTitle: `Losers R${round} Матч ${matchIndex + 1}`,
            description: 'обычный матч лузеров'
        };
    }
}

module.exports = { DoubleEliminationEngine }; 