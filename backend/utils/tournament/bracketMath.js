/**
 * 🧮 МАТЕМАТИЧЕСКИЙ МОДУЛЬ ТУРНИРНОЙ СЕТКИ
 * 
 * Модуль содержит все математические расчеты для генерации
 * турнирной сетки Single Elimination с максимальной точностью
 */

/**
 * 📊 Базовые математические расчеты для Single Elimination
 */
class BracketMath {
    
    /**
     * 🎯 Основной расчет параметров турнирной сетки
     * @param {number} participantCount - Количество участников
     * @param {Object} options - Дополнительные опции
     * @returns {Object} - Полные математические параметры сетки
     */
    static calculateSingleEliminationParams(participantCount, options = {}) {
        // Валидация входных данных
        if (!Number.isInteger(participantCount) || participantCount < 2) {
            throw new Error('Количество участников должно быть целым числом >= 2');
        }
        
        if (participantCount > 1024) {
            throw new Error('Максимальное количество участников: 1024');
        }
        
        // 🆕 НОВАЯ МАТЕМАТИКА: только предварительные раунды, никаких bye-проходов
        
        // 1. Определяем ближайшую степень двойки ВНИЗ (целевое количество для основного раунда)
        const lowerPowerOfTwo = Math.pow(2, Math.floor(Math.log2(participantCount)));
        
        // 2. Рассчитываем предварительный раунд
        const preliminaryMatches = participantCount - lowerPowerOfTwo;
        const preliminaryParticipants = preliminaryMatches * 2;
        const directAdvancers = participantCount - preliminaryParticipants;
        
        // 3. Проверяем нужен ли предварительный раунд
        const needsPreliminaryRound = preliminaryMatches > 0;
        
        // 4. Рассчитываем структуру основного турнира (всегда степень двойки)
        const mainRoundParticipants = lowerPowerOfTwo; // directAdvancers + preliminaryMatches
        const mainRounds = Math.log2(mainRoundParticipants);
        const firstRoundMatches = mainRoundParticipants / 2;
        
        // 5. Общее количество раундов и матчей
        const totalRounds = needsPreliminaryRound ? mainRounds + 1 : mainRounds;
        const totalMatches = participantCount - 1; // Классическая формула турнира на выбывание
        
        console.log(`🎯 [bracketMath] Новая математика для ${participantCount} участников:`);
        console.log(`   Степень двойки вниз: ${lowerPowerOfTwo}`);
        console.log(`   Предварительных матчей: ${preliminaryMatches}`);
        console.log(`   Участников предварительного раунда: ${preliminaryParticipants}`);
        console.log(`   Проходят напрямую в основной раунд: ${directAdvancers}`);
        console.log(`   Участников основного раунда: ${mainRoundParticipants}`);
        
        // 6. Расчет матчей по раундам
        const matchesByRound = this._calculateMatchesByRoundWithPreliminary(
            participantCount,
            needsPreliminaryRound,
            preliminaryMatches,
            mainRounds,
            firstRoundMatches
        );
        
        // 7. Проверка наличия матча за 3-е место
        const hasThirdPlaceMatch = options.thirdPlaceMatch === true;
        const totalMatchesWithThirdPlace = totalMatches + (hasThirdPlaceMatch ? 1 : 0);
        
        return {
            // Исходные данные
            originalParticipantCount: participantCount,
            actualParticipants: participantCount, // Все участники включены
            excludedParticipants: 0, // Никого не исключаем
            
            // Математика предварительного раунда
            lowerPowerOfTwo,
            needsPreliminaryRound,
            preliminaryMatches,
            preliminaryParticipants,
            directAdvancers,
            
            // Математика основного турнира
            mainRoundParticipants,
            mainRounds,
            
            // Убираем bye-проходы
            firstRoundByes: 0, // Больше нет bye-проходов
            byesNeeded: 0,
            
            // Структура сетки
            rounds: totalRounds,
            totalMatches,
            totalMatchesWithThirdPlace,
            firstRoundMatches,
            finalMatch: 1,
            
            // Распределение по раундам
            matchesByRound,
            roundNames: this._generateRoundNames(totalRounds, needsPreliminaryRound),
            
            // Дополнительные матчи
            hasThirdPlaceMatch,
            thirdPlaceMatch: hasThirdPlaceMatch ? 1 : 0,
            
            // Метаданные для валидации
            isValid: this._validateParamsWithPreliminary(participantCount, totalRounds, totalMatches, preliminaryMatches),
            generatedAt: new Date().toISOString()
        };
    }
    
    /**
     * 🔢 Расчет количества матчей по раундам
     * @param {number} participants - Количество участников
     * @returns {Array} - Массив с количеством матчей в каждом раунде
     */
    static _calculateMatchesByRound(participants) {
        const rounds = Math.log2(participants);
        const matchesByRound = [];
        
        for (let round = 1; round <= rounds; round++) {
            const matchesInRound = participants / Math.pow(2, round);
            matchesByRound.push({
                round,
                matchCount: matchesInRound,
                participantsInRound: matchesInRound * 2
            });
        }
        
        return matchesByRound;
    }
    
    /**
     * 🆕 Расчет количества матчей по раундам с учетом предварительного раунда (без bye-проходов)
     * @param {number} participantCount - Количество участников
     * @param {boolean} needsPreliminaryRound - Нужен ли предварительный раунд
     * @param {number} preliminaryMatches - Количество предварительных матчей
     * @param {number} mainRounds - Количество основных раундов
     * @param {number} firstRoundMatches - Количество матчей в первом основном раунде
     * @returns {Array} - Массив с количеством матчей в каждом раунде
     */
    static _calculateMatchesByRoundWithPreliminary(participantCount, needsPreliminaryRound, preliminaryMatches, mainRounds, firstRoundMatches) {
        const matchesByRound = [];
        
        // 🆕 Предварительный раунд (если нужен)
        if (needsPreliminaryRound) {
            matchesByRound.push({
                round: 0, // Предварительный раунд = раунд 0
                roundName: 'Предварительный',
                matchCount: preliminaryMatches,
                participantsInRound: preliminaryMatches * 2,
                winnersAdvancing: preliminaryMatches,
                byesInRound: 0 // Больше никаких bye-проходов
            });
        }
        
        // Основные раунды (всегда степень двойки участников)
        let currentRoundMatches = firstRoundMatches;
        
        for (let round = 1; round <= mainRounds; round++) {
            const participantsInRound = currentRoundMatches * 2;
            const winnersAdvancing = currentRoundMatches;
            
            matchesByRound.push({
                round: round,
                roundName: this._getRoundName(round, needsPreliminaryRound, participantCount),
                matchCount: currentRoundMatches,
                participantsInRound: participantsInRound,
                winnersAdvancing: winnersAdvancing,
                byesInRound: 0 // Никаких bye-проходов в основных раундах
            });
            
            // Для следующего раунда количество матчей делится пополам
            currentRoundMatches = Math.floor(currentRoundMatches / 2);
        }
        
        return matchesByRound;
    }
    
    /**
     * 🏷️ Генерация названий раундов
     * @param {number} totalRounds - Общее количество раундов
     * @param {boolean} hasPreliminaryRound - Есть ли предварительный раунд
     * @returns {Object} - Объект с названиями раундов
     */
    static _generateRoundNames(totalRounds, hasPreliminaryRound = false) {
        const names = {};
        const mainRounds = hasPreliminaryRound ? totalRounds - 1 : totalRounds;
        
        // Предварительный раунд (если есть)
        if (hasPreliminaryRound) {
            names[0] = 'Предварительный раунд';
        }
        
        // Основные раунды
        for (let round = 1; round <= mainRounds; round++) {
            const remainingRounds = mainRounds - round;
            names[round] = this._getRoundName(round, hasPreliminaryRound, 0, remainingRounds);
        }
        
        return names;
    }
    
    /**
     * 🆕 Получение названия раунда
     * @param {number} round - Номер раунда
     * @param {boolean} hasPreliminaryRound - Есть ли предварительный раунд
     * @param {number} participantCount - Количество участников
     * @param {number} remainingRounds - Оставшиеся раунды (опционально)
     * @returns {string} - Название раунда
     */
    static _getRoundName(round, hasPreliminaryRound = false, participantCount = 0, remainingRounds = null) {
        if (round === 0) {
            return 'Предварительный раунд';
        }
        
        // Если передано количество оставшихся раундов, используем его
        if (remainingRounds !== null) {
            const remaining = remainingRounds;
            
            switch (remaining) {
                case 0:
                    return 'Финал';
                case 1:
                    return 'Полуфинал';
                case 2:
                    return 'Четвертьфинал';
                case 3:
                    return '1/8 финала';
                case 4:
                    return '1/16 финала';
                default:
                    return `Раунд ${round}`;
            }
        }
        
        // Логика для определения названия на основе номера раунда
        const adjustedRound = hasPreliminaryRound ? round - 1 : round;
        
        switch (adjustedRound) {
            case 1:
                return participantCount <= 4 ? 'Полуфинал' : 'Раунд 1';
            case 2:
                return 'Финал';
            default:
                return `Раунд ${round}`;
        }
    }
    
    /**
     * 🆕 Валидация математических параметров с предварительными раундами (без bye-проходов)
     * @param {number} participantCount - Количество участников
     * @param {number} totalRounds - Общее количество раундов
     * @param {number} totalMatches - Общее количество матчей
     * @param {number} preliminaryMatches - Количество предварительных матчей
     * @returns {boolean} - Результат валидации
     */
    static _validateParamsWithPreliminary(participantCount, totalRounds, totalMatches, preliminaryMatches) {
        // Основная проверка: в турнире на выбывание всегда участники - 1 матч
        const expectedMatches = participantCount - 1;
        if (totalMatches !== expectedMatches) {
            console.warn(`⚠️ [bracketMath] Валидация: ожидается ${expectedMatches} матчей, получено ${totalMatches}`);
            return false;
        }
        
        // Проверка степени двойки для основного турнира
        const lowerPowerOfTwo = Math.pow(2, Math.floor(Math.log2(participantCount)));
        const expectedPreliminary = participantCount - lowerPowerOfTwo;
        if (preliminaryMatches !== expectedPreliminary) {
            console.warn(`⚠️ [bracketMath] Валидация: ожидается ${expectedPreliminary} предварительных матчей, получено ${preliminaryMatches}`);
            return false;
        }
        
        // Проверка количества раундов
        const mainRounds = Math.log2(lowerPowerOfTwo);
        const expectedRounds = preliminaryMatches > 0 ? mainRounds + 1 : mainRounds;
        if (totalRounds !== expectedRounds) {
            console.warn(`⚠️ [bracketMath] Валидация: ожидается ${expectedRounds} раундов, получено ${totalRounds}`);
            return false;
        }
        
        // Проверка количества участников
        if (participantCount < 2 || participantCount > 1024) {
            console.warn(`⚠️ [bracketMath] Валидация: некорректное количество участников: ${participantCount}`);
            return false;
        }
        
        console.log(`✅ [bracketMath] Валидация успешна: ${participantCount} участников, ${totalRounds} раундов, ${totalMatches} матчей, ${preliminaryMatches} предварительных`);
        return true;
    }
    
    /**
     * ✅ Валидация математических параметров (старый метод для обратной совместимости)
     * @param {number} participants - Количество участников
     * @param {number} rounds - Количество раундов
     * @param {number} totalMatches - Общее количество матчей
     * @returns {boolean} - Результат валидации
     */
    static _validateParams(participants, rounds, totalMatches) {
        // Проверка степени двойки
        const isPowerOfTwo = (participants & (participants - 1)) === 0;
        if (!isPowerOfTwo) return false;
        
        // Проверка количества раундов
        const expectedRounds = Math.log2(participants);
        if (rounds !== expectedRounds) return false;
        
        // Проверка общего количества матчей
        const expectedMatches = participants - 1;
        if (totalMatches !== expectedMatches) return false;
        
        return true;
    }
    
    /**
     * 🎲 Расчет посева (seeding) для участников
     * @param {number} participantCount - Количество участников
     * @returns {Array} - Массив позиций для посева
     */
    static generateSeedingPositions(participantCount) {
        if (!Number.isInteger(participantCount) || participantCount < 2) {
            throw new Error('Неверное количество участников для посева');
        }
        
        // Выравниваем до степени двойки
        const powerOfTwo = Math.pow(2, Math.floor(Math.log2(participantCount)));
        const actualParticipants = Math.min(participantCount, powerOfTwo);
        
        // Генерируем стандартный посев
        const seeds = [];
        for (let i = 1; i <= actualParticipants; i++) {
            seeds.push(i);
        }
        
        // Применяем алгоритм стандартного посева для турнирной сетки
        return this._applySeedingAlgorithm(seeds);
    }
    
    /**
     * 🔄 Применение алгоритма стандартного посева
     * @param {Array} seeds - Массив номеров посева
     * @returns {Array} - Массив пар для первого раунда
     */
    static _applySeedingAlgorithm(seeds) {
        const n = seeds.length;
        const pairs = [];
        
        // Стандартный алгоритм посева: 1 vs n, 2 vs n-1, и т.д.
        for (let i = 0; i < n / 2; i++) {
            pairs.push({
                matchNumber: i + 1,
                seed1: seeds[i],
                seed2: seeds[n - 1 - i],
                round: 1
            });
        }
        
        return pairs;
    }
    
    /**
     * 📈 Расчет прогрессии раундов
     * @param {number} participants - Количество участников
     * @returns {Array} - Детальная прогрессия по раундам
     */
    static calculateRoundProgression(participants) {
        const rounds = Math.log2(participants);
        const progression = [];
        
        for (let round = 1; round <= rounds; round++) {
            const participantsInRound = participants / Math.pow(2, round - 1);
            const matchesInRound = participantsInRound / 2;
            const winnersAdvancing = matchesInRound;
            
            progression.push({
                round,
                participantsInRound,
                matchesInRound,
                winnersAdvancing,
                isLastRound: round === rounds
            });
        }
        
        return progression;
    }
    
    /**
     * 🎯 Специальные расчеты для микс турниров
     * @param {number} soloParticipants - Количество одиночных участников
     * @param {number} teamSize - Размер команды
     * @returns {Object} - Параметры для микс турнира
     */
    static calculateMixTournamentParams(soloParticipants, teamSize = 5) {
        if (!Number.isInteger(soloParticipants) || soloParticipants < teamSize) {
            throw new Error(`Недостаточно участников для формирования команд размером ${teamSize}`);
        }
        
        // Рассчитываем количество полных команд
        const fullTeams = Math.floor(soloParticipants / teamSize);
        const remainingParticipants = soloParticipants % teamSize;
        
        // Выравниваем количество команд до степени двойки
        const powerOfTwo = Math.pow(2, Math.floor(Math.log2(fullTeams)));
        const actualTeams = Math.min(fullTeams, powerOfTwo);
        const playersInTournament = actualTeams * teamSize;
        const excludedPlayers = soloParticipants - playersInTournament;
        
        // Используем стандартные расчеты для команд
        const bracketParams = this.calculateSingleEliminationParams(actualTeams);
        
        return {
            ...bracketParams,
            // Специфичные для микс турнира
            soloParticipants,
            teamSize,
            fullTeamsAvailable: fullTeams,
            actualTeams,
            playersInTournament,
            excludedPlayers,
            remainingParticipants,
            teamsExcluded: fullTeams - actualTeams
        };
    }
}

module.exports = {
    BracketMath,
    
    // Экспорт основных функций для удобства
    calculateSingleEliminationParams: BracketMath.calculateSingleEliminationParams.bind(BracketMath),
    generateSeedingPositions: BracketMath.generateSeedingPositions.bind(BracketMath),
    calculateMixTournamentParams: BracketMath.calculateMixTournamentParams.bind(BracketMath)
}; 