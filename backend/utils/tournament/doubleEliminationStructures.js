/**
 * 🏆 СТРУКТУРЫ DOUBLE ELIMINATION ТУРНИРОВ
 * 
 * Предрасчитанные таблицы для всех поддерживаемых размеров турниров.
 * Каждая структура содержит точное количество матчей в каждом раунде
 * для Winners Bracket и Losers Bracket.
 * 
 * Логика Double Elimination:
 * - Winners Bracket: каждый раунд делит участников пополам
 * - Losers Bracket: сложная структура с чередованием матчей
 * - Проигравшие из Winners попадают в определенные раунды Losers
 * - Grand Final: основной матч + возможный reset
 */

/**
 * 🏗️ ТАБЛИЦЫ СТРУКТУР DOUBLE ELIMINATION
 */
const DOUBLE_ELIMINATION_STRUCTURES = {
    /**
     * 🏆 4 УЧАСТНИКА
     * 
     * Winners Bracket:
     * R1: A vs B, C vs D (2 матча) → 2 победителя
     * R2: W1 vs W2 (1 матч) → 1 финалист Winners
     * 
     * Losers Bracket:
     * L1: L1 vs L2 (1 матч) → 1 участник
     * L2: L(R2) vs W(L1) (1 матч) → 1 финалист Losers
     * 
     * Grand Final: Winners vs Losers (+ reset при необходимости)
     */
    4: {
        participants: 4,
        winnersRounds: 2,
        winnersStructure: [2, 1], // R1: 2 матча, R2: 1 матч
        losersRounds: 2,
        losersStructure: [1, 1],  // R1: 1 матч, R2: 1 матч
        
        // Связи Winners → Losers (какие раунды Winners кормят какие раунды Losers)
        winnersToLosersMapping: {
            1: 1, // Проигравшие W1 → L1
            2: 2  // Проигравшие W2 → L2 (финал Losers)
        },
        
        totalMatches: 7, // 3 Winners + 2 Losers + 2 Grand Final
        description: "Минимальный DE турнир - каждый участник может проиграть максимум 1 раз"
    },

    /**
     * 🏆 8 УЧАСТНИКОВ  
     * 
     * Winners Bracket:
     * R1: 4 матча (8→4)
     * R2: 2 матча (4→2) 
     * R3: 1 матч (2→1)
     * 
     * Losers Bracket:
     * L1: 2 матча (4 проигравших W1 → 2)
     * L2: 2 матча (2 проигравших W2 + 2 победителя L1 → 2)
     * L3: 1 матч (2 победителя L2 → 1)
     * L4: 1 матч (1 проигравший W3 + 1 победитель L3 → 1) [Малый финал]
     */
    8: {
        participants: 8,
        winnersRounds: 3,
        winnersStructure: [4, 2, 1], // R1: 4, R2: 2, R3: 1
        losersRounds: 4,
        losersStructure: [2, 2, 1, 1], // L1: 2, L2: 2, L3: 1, L4: 1
        
        winnersToLosersMapping: {
            1: 1, // Проигравшие W1 → L1
            2: 2, // Проигравшие W2 → L2  
            3: 4  // Проигравшие W3 → L4 (малый финал)
        },
        
        totalMatches: 15, // 7 Winners + 6 Losers + 2 Grand Final
        description: "Стандартный малый DE турнир с малым финалом лузеров"
    },

    /**
     * 🏆 16 УЧАСТНИКОВ
     * 
     * Winners Bracket:
     * R1: 8 матчей (16→8)
     * R2: 4 матча (8→4)
     * R3: 2 матча (4→2)
     * R4: 1 матч (2→1)
     * 
     * Losers Bracket:
     * L1: 4 матча (8 проигравших W1 → 4)
     * L2: 4 матча (4 проигравших W2 + 4 победителя L1 → 4)
     * L3: 2 матча (4 победителя L2 → 2)
     * L4: 2 матча (2 проигравших W3 + 2 победителя L3 → 2)
     * L5: 1 матч (2 победителя L4 → 1)
     * L6: 1 матч (1 проигравший W4 + 1 победитель L5 → 1) [Малый финал]
     */
    16: {
        participants: 16,
        winnersRounds: 4,
        winnersStructure: [8, 4, 2, 1], // R1: 8, R2: 4, R3: 2, R4: 1
        losersRounds: 6,
        losersStructure: [4, 4, 2, 2, 1, 1], // L1: 4, L2: 4, L3: 2, L4: 2, L5: 1, L6: 1
        
        winnersToLosersMapping: {
            1: 1, // Проигравшие W1 → L1
            2: 2, // Проигравшие W2 → L2
            3: 4, // Проигравшие W3 → L4
            4: 6  // Проигравшие W4 → L6 (малый финал)
        },
        
        totalMatches: 31, // 15 Winners + 14 Losers + 2 Grand Final
        description: "Средний DE турнир с развитой структурой лузеров"
    },

    /**
     * 🏆 32 УЧАСТНИКА
     * 
     * 5 раундов Winners, 8 раундов Losers
     */
    32: {
        participants: 32,
        winnersRounds: 5,
        winnersStructure: [16, 8, 4, 2, 1], // R1: 16, R2: 8, R3: 4, R4: 2, R5: 1
        losersRounds: 8,
        losersStructure: [8, 8, 4, 4, 2, 2, 1, 1], // L1: 8, L2: 8, L3: 4, L4: 4, L5: 2, L6: 2, L7: 1, L8: 1
        
        winnersToLosersMapping: {
            1: 1, // Проигравшие W1 → L1
            2: 2, // Проигравшие W2 → L2
            3: 4, // Проигравшие W3 → L4
            4: 6, // Проигравшие W4 → L6
            5: 8  // Проигравшие W5 → L8 (малый финал)
        },
        
        totalMatches: 63, // 31 Winners + 30 Losers + 2 Grand Final
        description: "Большой DE турнир для профессиональных соревнований"
    },

    /**
     * 🏆 64 УЧАСТНИКА
     * 
     * 6 раундов Winners, 10 раундов Losers
     */
    64: {
        participants: 64,
        winnersRounds: 6,
        winnersStructure: [32, 16, 8, 4, 2, 1], // R1: 32, R2: 16, R3: 8, R4: 4, R5: 2, R6: 1
        losersRounds: 10,
        losersStructure: [16, 16, 8, 8, 4, 4, 2, 2, 1, 1], // L1: 16, L2: 16, L3: 8, L4: 8, L5: 4, L6: 4, L7: 2, L8: 2, L9: 1, L10: 1
        
        winnersToLosersMapping: {
            1: 1,  // Проигравшие W1 → L1
            2: 2,  // Проигравшие W2 → L2
            3: 4,  // Проигравшие W3 → L4
            4: 6,  // Проигравшие W4 → L6
            5: 8,  // Проигравшие W5 → L8
            6: 10  // Проигравшие W6 → L10 (малый финал)
        },
        
        totalMatches: 127, // 63 Winners + 62 Losers + 2 Grand Final
        description: "Очень большой DE турнир для мейджор-турниров"
    },

    /**
     * 🏆 128 УЧАСТНИКОВ
     * 
     * 7 раундов Winners, 12 раундов Losers
     */
    128: {
        participants: 128,
        winnersRounds: 7,
        winnersStructure: [64, 32, 16, 8, 4, 2, 1], // R1: 64, R2: 32, R3: 16, R4: 8, R5: 4, R6: 2, R7: 1
        losersRounds: 12,
        losersStructure: [32, 32, 16, 16, 8, 8, 4, 4, 2, 2, 1, 1], // L1: 32, L2: 32, ..., L11: 1, L12: 1
        
        winnersToLosersMapping: {
            1: 1,  // Проигравшие W1 → L1
            2: 2,  // Проигравшие W2 → L2
            3: 4,  // Проигравшие W3 → L4
            4: 6,  // Проигравшие W4 → L6
            5: 8,  // Проигравшие W5 → L8
            6: 10, // Проигравшие W6 → L10
            7: 12  // Проигравшие W7 → L12 (малый финал)
        },
        
        totalMatches: 255, // 127 Winners + 126 Losers + 2 Grand Final
        description: "Максимальный DE турнир для крупнейших чемпионатов"
    }
};

/**
 * 🔍 ПОЛУЧЕНИЕ СТРУКТУРЫ ПО КОЛИЧЕСТВУ УЧАСТНИКОВ
 * @param {number} participantCount - Количество участников
 * @returns {Object} Структура турнира
 */
function getDoubleEliminationStructure(participantCount) {
    // Округляем до ближайшей степени двойки (вверх)
    const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(participantCount)));
    
    const structure = DOUBLE_ELIMINATION_STRUCTURES[powerOfTwo];
    
    if (!structure) {
        throw new Error(`Неподдерживаемый размер турнира: ${participantCount} участников (степень двойки: ${powerOfTwo})`);
    }
    
    return {
        ...structure,
        actualParticipants: participantCount,
        byesNeeded: powerOfTwo - participantCount
    };
}

/**
 * 🧮 ВАЛИДАЦИЯ СТРУКТУРЫ
 * @param {Object} structure - Структура для валидации
 * @returns {Object} Результат валидации
 */
function validateStructure(structure) {
    const errors = [];
    
    // Проверка Winners Bracket
    const winnersTotal = structure.winnersStructure.reduce((a, b) => a + b, 0);
    const expectedWinners = structure.participants - 1;
    if (winnersTotal !== expectedWinners) {
        errors.push(`Winners Bracket: ожидается ${expectedWinners} матчей, получено ${winnersTotal}`);
    }
    
    // Проверка Losers Bracket
    const losersTotal = structure.losersStructure.reduce((a, b) => a + b, 0);
    const expectedLosers = structure.participants - 2; // Все кроме финалиста Winners и чемпиона
    if (losersTotal !== expectedLosers) {
        errors.push(`Losers Bracket: ожидается ${expectedLosers} матчей, получено ${losersTotal}`);
    }
    
    // Проверка общего количества
    const calculatedTotal = winnersTotal + losersTotal + 2; // +2 для Grand Final
    if (calculatedTotal !== structure.totalMatches) {
        errors.push(`Общее количество: ожидается ${structure.totalMatches}, рассчитано ${calculatedTotal}`);
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        statistics: {
            participants: structure.participants,
            winnersMatches: winnersTotal,
            losersMatches: losersTotal,
            grandFinalMatches: 2,
            totalMatches: calculatedTotal
        }
    };
}

/**
 * 📊 ПОЛУЧЕНИЕ СПИСКА ПОДДЕРЖИВАЕМЫХ РАЗМЕРОВ
 * @returns {Array} Массив поддерживаемых размеров
 */
function getSupportedSizes() {
    return Object.keys(DOUBLE_ELIMINATION_STRUCTURES).map(Number).sort((a, b) => a - b);
}

/**
 * 🎯 РАСЧЕТ ЦЕЛЕВОГО РАУНДА LOSERS ДЛЯ ПРОИГРАВШИХ WINNERS
 * @param {number} winnersRound - Раунд Winners Bracket
 * @param {Object} structure - Структура турнира
 * @returns {number} Номер раунда Losers Bracket
 */
function calculateTargetLosersRound(winnersRound, structure) {
    return structure.winnersToLosersMapping[winnersRound] || null;
}

/**
 * 🏷️ ПОЛУЧЕНИЕ ОПИСАНИЯ МАТЧА В LOSERS BRACKET
 * @param {number} losersRound - Раунд Losers Bracket
 * @param {Object} structure - Структура турнира
 * @returns {string} Описание типа матча
 */
function getLosersRoundDescription(losersRound, structure) {
    if (losersRound === structure.losersRounds) {
        return "Малый финал лузеров";
    } else if (losersRound % 2 === 1) {
        return "Прием проигравших из Winners";
    } else {
        return "Смешанный раунд";
    }
}

module.exports = {
    DOUBLE_ELIMINATION_STRUCTURES,
    getDoubleEliminationStructure,
    validateStructure,
    getSupportedSizes,
    calculateTargetLosersRound,
    getLosersRoundDescription
}; 