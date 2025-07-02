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
        
        // Выравнивание вниз до степени двойки для ровной сетки
        const powerOfTwo = Math.pow(2, Math.floor(Math.log2(participantCount)));
        const actualParticipants = Math.min(participantCount, powerOfTwo);
        
        // Базовые расчеты
        const rounds = Math.log2(actualParticipants);
        const totalMatches = actualParticipants - 1;
        const excludedCount = participantCount - actualParticipants;
        
        // Расчет матчей по раундам
        const matchesByRound = this._calculateMatchesByRound(actualParticipants);
        
        // Проверка наличия матча за 3-е место
        const hasThirdPlaceMatch = options.thirdPlaceMatch === true;
        const totalMatchesWithThirdPlace = totalMatches + (hasThirdPlaceMatch ? 1 : 0);
        
        return {
            // Исходные данные
            originalParticipantCount: participantCount,
            actualParticipants,
            excludedParticipants: excludedCount,
            powerOfTwo,
            
            // Структура сетки
            rounds,
            totalMatches,
            totalMatchesWithThirdPlace,
            firstRoundMatches: actualParticipants / 2,
            finalMatch: 1,
            
            // Распределение по раундам
            matchesByRound,
            roundNames: this._generateRoundNames(rounds),
            
            // Дополнительные матчи
            hasThirdPlaceMatch,
            thirdPlaceMatch: hasThirdPlaceMatch ? 1 : 0,
            
            // Метаданные для валидации
            isValid: this._validateParams(actualParticipants, rounds, totalMatches),
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
     * 🏷️ Генерация названий раундов
     * @param {number} totalRounds - Общее количество раундов
     * @returns {Object} - Объект с названиями раундов
     */
    static _generateRoundNames(totalRounds) {
        const names = {};
        
        for (let round = 1; round <= totalRounds; round++) {
            const remainingRounds = totalRounds - round;
            
            switch (remainingRounds) {
                case 0:
                    names[round] = 'Финал';
                    break;
                case 1:
                    names[round] = 'Полуфинал';
                    break;
                case 2:
                    names[round] = 'Четвертьфинал';
                    break;
                case 3:
                    names[round] = '1/8 финала';
                    break;
                case 4:
                    names[round] = '1/16 финала';
                    break;
                default:
                    names[round] = `Раунд ${round}`;
            }
        }
        
        return names;
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