/**
 * 🧪 ТЕСТИРОВАНИЕ ТАБЛИЧНЫХ СТРУКТУР DOUBLE ELIMINATION
 * 
 * Скрипт для проверки корректности всех предрасчитанных структур
 * и валидации математики Double Elimination
 */

const { 
    getDoubleEliminationStructure, 
    validateStructure, 
    getSupportedSizes,
    calculateTargetLosersRound,
    DOUBLE_ELIMINATION_STRUCTURES 
} = require('./backend/utils/tournament/doubleEliminationStructures');

/**
 * 🔍 Тестирование всех поддерживаемых размеров
 */
function testAllSizes() {
    console.log('🧪 === ТЕСТИРОВАНИЕ ТАБЛИЧНЫХ СТРУКТУР DOUBLE ELIMINATION ===\n');
    
    const supportedSizes = getSupportedSizes();
    console.log(`📊 Поддерживаемые размеры: ${supportedSizes.join(', ')}\n`);
    
    let allValid = true;
    
    for (const size of supportedSizes) {
        console.log(`🏆 Тестирование ${size} участников:`);
        
        try {
            // Получаем структуру
            const structure = getDoubleEliminationStructure(size);
            
            // Валидируем
            const validation = validateStructure(structure);
            
            if (validation.isValid) {
                console.log(`  ✅ Структура корректна`);
                console.log(`     Winners: ${structure.winnersStructure.join('+')} = ${validation.statistics.winnersMatches}`);
                console.log(`     Losers:  ${structure.losersStructure.join('+')} = ${validation.statistics.losersMatches}`);
                console.log(`     Grand Final: ${validation.statistics.grandFinalMatches}`);
                console.log(`     Итого: ${validation.statistics.totalMatches} матчей`);
                console.log(`     Описание: ${structure.description}`);
            } else {
                console.log(`  ❌ Ошибки валидации:`);
                validation.errors.forEach(error => console.log(`     - ${error}`));
                allValid = false;
            }
            
        } catch (error) {
            console.log(`  ❌ Ошибка: ${error.message}`);
            allValid = false;
        }
        
        console.log('');
    }
    
    return allValid;
}

/**
 * 🎯 Тестирование маппинга Winners → Losers
 */
function testWinnersToLosersMapping() {
    console.log('🎯 === ТЕСТИРОВАНИЕ МАППИНГА WINNERS → LOSERS ===\n');
    
    const testSizes = [4, 8, 16, 32];
    
    for (const size of testSizes) {
        console.log(`🏆 Маппинг для ${size} участников:`);
        
        const structure = getDoubleEliminationStructure(size);
        
        for (let winnersRound = 1; winnersRound <= structure.winnersRounds; winnersRound++) {
            const targetLosersRound = calculateTargetLosersRound(winnersRound, structure);
            
            if (targetLosersRound) {
                console.log(`  Winners R${winnersRound} → Losers R${targetLosersRound}`);
            } else {
                console.log(`  Winners R${winnersRound} → НЕТ СВЯЗИ (ошибка!)`);
            }
        }
        
        console.log('');
    }
}

/**
 * 📊 Сравнение с ожидаемыми значениями
 */
function testExpectedValues() {
    console.log('📊 === СРАВНЕНИЕ С ОЖИДАЕМЫМИ ЗНАЧЕНИЯМИ ===\n');
    
    const expectedValues = {
        4: { winners: 3, losers: 2, total: 7 },
        8: { winners: 7, losers: 6, total: 15 },
        16: { winners: 15, losers: 14, total: 31 },
        32: { winners: 31, losers: 30, total: 63 },
        64: { winners: 63, losers: 62, total: 127 },
        128: { winners: 127, losers: 126, total: 255 }
    };
    
    let allMatch = true;
    
    for (const [size, expected] of Object.entries(expectedValues)) {
        const sizeNum = parseInt(size);
        console.log(`🏆 Проверка ${size} участников:`);
        
        const structure = getDoubleEliminationStructure(sizeNum);
        const validation = validateStructure(structure);
        
        const winnersMatches = validation.statistics.winnersMatches;
        const losersMatches = validation.statistics.losersMatches;
        const totalMatches = validation.statistics.totalMatches;
        
        const winnersOk = winnersMatches === expected.winners;
        const losersOk = losersMatches === expected.losers;
        const totalOk = totalMatches === expected.total;
        
        console.log(`  Winners: ${winnersMatches} ${winnersOk ? '✅' : '❌'} (ожидалось ${expected.winners})`);
        console.log(`  Losers:  ${losersMatches} ${losersOk ? '✅' : '❌'} (ожидалось ${expected.losers})`);
        console.log(`  Итого:   ${totalMatches} ${totalOk ? '✅' : '❌'} (ожидалось ${expected.total})`);
        
        if (!winnersOk || !losersOk || !totalOk) {
            allMatch = false;
        }
        
        console.log('');
    }
    
    return allMatch;
}

/**
 * 🚀 Запуск всех тестов
 */
function runAllTests() {
    console.log('🚀 Запуск полного тестирования Double Elimination структур...\n');
    
    const test1 = testAllSizes();
    const test2 = testExpectedValues();
    testWinnersToLosersMapping();
    
    console.log('📋 === ИТОГИ ТЕСТИРОВАНИЯ ===');
    console.log(`✅ Валидация структур: ${test1 ? 'ПРОЙДЕНА' : 'ПРОВАЛЕНА'}`);
    console.log(`✅ Сравнение с ожиданиями: ${test2 ? 'ПРОЙДЕНА' : 'ПРОВАЛЕНА'}`);
    
    if (test1 && test2) {
        console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Табличные структуры готовы к использованию.');
        return true;
    } else {
        console.log('\n❌ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ! Необходимо исправить структуры.');
        return false;
    }
}

// Если скрипт запущен напрямую
if (require.main === module) {
    runAllTests();
}

module.exports = {
    testAllSizes,
    testWinnersToLosersMapping,
    testExpectedValues,
    runAllTests
}; 