// backend/bracketGenerator.js
const { generateSingleEliminationBracket } = require('./bracketGenerators/singleEliminationV2');
const { generateDoubleEliminationBracket } = require('./bracketGenerators/doubleElimination');

/**
 * Генерация турнирной сетки в зависимости от формата турнира
 * @param {string} format - Формат турнира (single_elimination, double_elimination и т.д.)
 * @param {number} tournamentId - ID турнира
 * @param {Array} participants - Массив участников [{ id, name }]
 * @param {boolean} thirdPlaceMatch - Нужен ли матч за 3-е место
 * @returns {Object} - Объект с полем matches: { matches: Array, totalMatches: Number }
 */
const generateBracket = async (format, tournamentId, participants, thirdPlaceMatch) => {
    console.log('🚨 [bracketGenerator.js] ДЕТАЛЬНАЯ ОТЛАДКА:');
    console.log('🚨 format:', format, '(type:', typeof format, ')');
    console.log('🚨 tournamentId:', tournamentId, '(type:', typeof tournamentId, ')');
    console.log('🚨 participants:', typeof participants === 'object' ? 'IS OBJECT' : typeof participants);
    console.log('🚨 participants.length:', Array.isArray(participants) ? participants.length : 'NOT ARRAY!');
    console.log('🚨 participants[0]:', Array.isArray(participants) && participants[0] ? participants[0] : 'UNDEFINED');
    console.log('🚨 thirdPlaceMatch:', thirdPlaceMatch, '(type:', typeof thirdPlaceMatch, ')');
    
    if (!Array.isArray(participants)) {
        console.error('🚨 КРИТИЧЕСКАЯ ОШИБКА: participants НЕ ЯВЛЯЕТСЯ МАССИВОМ!');
        console.error('🚨 Значение participants:', participants);
        throw new Error(`participants должен быть массивом, получен: ${typeof participants}`);
    }
    
    console.log(`🎯 Генерация сетки: формат=${format}, участников=${participants.length}, матч за 3-е место=${thirdPlaceMatch}`);
    
    let matches;
    
    switch (format.toLowerCase()) {
        case 'mix':
        case 'single_elimination':
            matches = await generateSingleEliminationBracket(tournamentId, participants, thirdPlaceMatch);
            break;
        case 'double_elimination':
            matches = await generateDoubleEliminationBracket(tournamentId, participants, thirdPlaceMatch);
            break;
        default:
            throw new Error(`Неподдерживаемый формат турнира: ${format}`);
    }
    
    console.log('🚨 [bracketGenerator.js] ГЕНЕРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!');
    console.log('🚨 [bracketGenerator.js] Создано матчей:', matches ? matches.length : 'UNDEFINED');
    
    // Возвращаем объект с полем matches для совместимости с BracketService
    const result = {
        matches: matches || [],
        totalMatches: matches ? matches.length : 0,
        success: true
    };
    
    console.log('🚨 [bracketGenerator.js] Возвращаем объект:', result);
    
    return result;
};

module.exports = {
    generateBracket
};