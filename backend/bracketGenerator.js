// backend/bracketGenerator.js
const { generateSingleEliminationBracket } = require('./bracketGenerators/singleElimination');
const { generateDoubleEliminationBracket } = require('./bracketGenerators/doubleElimination');

/**
 * Генерация турнирной сетки в зависимости от формата турнира
 * @param {string} format - Формат турнира (single_elimination, double_elimination и т.д.)
 * @param {number} tournamentId - ID турнира
 * @param {Array} participants - Массив участников [{ id, name }]
 * @param {boolean} thirdPlaceMatch - Нужен ли матч за 3-е место
 * @returns {Array} - Список сгенерированных матчей
 */
const generateBracket = async (format, tournamentId, participants, thirdPlaceMatch) => {
    switch (format.toLowerCase()) {
        case 'mix':
        case 'single_elimination':
            return await generateSingleEliminationBracket(tournamentId, participants, thirdPlaceMatch);
        case 'double_elimination':
            return await generateDoubleEliminationBracket(tournamentId, participants, thirdPlaceMatch);
        default:
            throw new Error(`Неподдерживаемый формат турнира: ${format}`);
    }
};

module.exports = { generateBracket };