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
        
        // 🔧 ИСПРАВЛЕННЫЙ АЛГОРИТМ: используем ближайшую вышестоящую степень двойки
        // Для правильного Single Elimination с bye-проходами
        const upperPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(participantCount)));
        const byesNeeded = upperPowerOfTwo - participantCount;
        
        // 🆕 Расчет предварительных матчей для выравнивания
        // Если участников больше половины upperPowerOfTwo, нужны предварительные матчи
        const lowerPowerOfTwo = upperPowerOfTwo / 2;
        const needsPreliminaryRound = participantCount > lowerPowerOfTwo;
        
        let preliminaryMatches = 0;
        let preliminaryParticipants = 0;
        let firstRoundByes = 0;
        let actualParticipants = participantCount; // 🔧 ИСПРАВЛЕНО: включаем ВСЕХ участников
        
        if (needsPreliminaryRound) {
            // Рассчитываем предварительные матчи
            preliminaryParticipants = (participantCount - lowerPowerOfTwo) * 2;
            preliminaryMatches = preliminaryParticipants / 2;
            firstRoundByes = lowerPowerOfTwo - preliminaryMatches;
            
            console.log(`🎯 [bracketMath] Предварительный раунд: ${preliminaryMatches} матчей для ${preliminaryParticipants} участников`);
            console.log(`🎯 [bracketMath] Bye-проходы в первый раунд: ${firstRoundByes} участников`);
        } else {
            // Простые bye-проходы в первом раунде
            firstRoundByes = byesNeeded;
            console.log(`🎯 [bracketMath] Bye-проходы: ${firstRoundByes} участников проходят в следующий раунд`);
        }
        
        // Рассчитываем основную структуру турнира
        const totalRounds = Math.ceil(Math.log2(participantCount)) + (needsPreliminaryRound ? 1 : 0);
        const firstRoundMatches = needsPreliminaryRound 
            ? lowerPowerOfTwo / 2  // После предварительного раунда
            : Math.ceil((participantCount - firstRoundByes) / 2); // С учетом bye-проходов
        
        // Общее количество матчей = участники - 1 (классическая формула турнира на выбывание)
        const totalMatches = participantCount - 1 + (needsPreliminaryRound ? preliminaryMatches : 0);
        
        // Расчет матчей по раундам с учетом предварительного раунда
        const matchesByRound = this._calculateMatchesByRoundWithByes(
            participantCount, 
            upperPowerOfTwo, 
            needsPreliminaryRound, 
            preliminaryMatches,
            firstRoundByes
        );
        
        // Проверка наличия матча за 3-е место
        const hasThirdPlaceMatch = options.thirdPlaceMatch === true;
        const totalMatchesWithThirdPlace = totalMatches + (hasThirdPlaceMatch ? 1 : 0);
        
        return {
            // Исходные данные
            originalParticipantCount: participantCount,
            actualParticipants, // 🔧 ИСПРАВЛЕНО: все участники включены
            excludedParticipants: 0, // 🔧 ИСПРАВЛЕНО: никого не исключаем
            upperPowerOfTwo,
            lowerPowerOfTwo,
            
            // 🆕 Информация о bye-проходах и предварительных матчах
            byesNeeded,
            firstRoundByes,
            needsPreliminaryRound,
            preliminaryMatches,
            preliminaryParticipants,
            
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
            isValid: this._validateParamsWithByes(participantCount, totalRounds, totalMatches),
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
     * 🆕 Расчет количества матчей по раундам с учетом bye-проходов
     * @param {number} participantCount - Количество участников
     * @param {number} upperPowerOfTwo - Ближайшая вышестоящая степень двойки
     * @param {boolean} needsPreliminaryRound - Нужен ли предварительный раунд
     * @param {number} preliminaryMatches - Количество предварительных матчей
     * @param {number} firstRoundByes - Количество bye-проходов в первом раунде
     * @returns {Array} - Массив с количеством матчей в каждом раунде
     */
    static _calculateMatchesByRoundWithByes(participantCount, upperPowerOfTwo, needsPreliminaryRound, preliminaryMatches, firstRoundByes) {
        const matchesByRound = [];
        let currentRound = 1;
        
        // 🆕 Предварительный раунд (если нужен)
        if (needsPreliminaryRound) {
            matchesByRound.push({
                round: 0, // Предварительный раунд = раунд 0
                roundName: 'Предварительный',
                matchCount: preliminaryMatches,
                participantsInRound: preliminaryMatches * 2,
                winnersAdvancing: preliminaryMatches,
                byesInRound: 0
            });
        }
        
        // Рассчитываем основные раунды
        let remainingParticipants = participantCount;
        if (needsPreliminaryRound) {
            // После предварительного раунда остается: bye-участники + победители предварительных матчей
            remainingParticipants = firstRoundByes + preliminaryMatches;
        }
        
        // Генерируем раунды до финала
        while (remainingParticipants > 1) {
            const byesInThisRound = needsPreliminaryRound && currentRound === 1 ? firstRoundByes : 0;
            const activeParticipants = remainingParticipants - byesInThisRound;
            const matchesInRound = Math.floor(activeParticipants / 2);
            const winnersAdvancing = matchesInRound + byesInThisRound;
            
            matchesByRound.push({
                round: currentRound,
                roundName: this._getRoundName(currentRound, needsPreliminaryRound, participantCount),
                matchCount: matchesInRound,
                participantsInRound: activeParticipants,
                winnersAdvancing: winnersAdvancing,
                byesInRound: byesInThisRound
            });
            
            remainingParticipants = winnersAdvancing;
            currentRound++;
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
     * ✅ Валидация математических параметров
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
     * 🆕 Валидация математических параметров с учетом bye-проходов
     * @param {number} participantCount - Количество участников
     * @param {number} totalRounds - Общее количество раундов
     * @param {number} totalMatches - Общее количество матчей
     * @returns {boolean} - Результат валидации
     */
    static _validateParamsWithByes(participantCount, totalRounds, totalMatches) {
        // Основная проверка: в турнире на выбывание всегда участники - 1 матч
        const expectedMatches = participantCount - 1;
        if (totalMatches !== expectedMatches) {
            console.warn(`⚠️ [bracketMath] Валидация: ожидается ${expectedMatches} матчей, получено ${totalMatches}`);
            return false;
        }
        
        // Проверка минимального количества раундов
        const minRounds = Math.ceil(Math.log2(participantCount));
        if (totalRounds < minRounds) {
            console.warn(`⚠️ [bracketMath] Валидация: недостаточно раундов. Минимум ${minRounds}, получено ${totalRounds}`);
            return false;
        }
        
        // Проверка максимального количества раундов (не более чем minRounds + 1 для предварительного)
        const maxRounds = minRounds + 1;
        if (totalRounds > maxRounds) {
            console.warn(`⚠️ [bracketMath] Валидация: слишком много раундов. Максимум ${maxRounds}, получено ${totalRounds}`);
            return false;
        }
        
        // Проверка количества участников
        if (participantCount < 2 || participantCount > 1024) {
            console.warn(`⚠️ [bracketMath] Валидация: некорректное количество участников: ${participantCount}`);
            return false;
        }
        
        console.log(`✅ [bracketMath] Валидация успешна: ${participantCount} участников, ${totalRounds} раундов, ${totalMatches} матчей`);
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