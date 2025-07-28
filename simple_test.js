const { getSupportedSizes, getDoubleEliminationStructure, validateStructure } = require('./backend/utils/tournament/doubleEliminationStructures');

console.log('Testing DE structures...');

try {
    const sizes = getSupportedSizes();
    console.log('Supported sizes:', sizes);
    
    // Test 8 participants
    const structure8 = getDoubleEliminationStructure(8);
    console.log('Structure for 8:', {
        winners: structure8.winnersStructure,
        losers: structure8.losersStructure,
        winnersMatches: structure8.winnersStructure.reduce((a,b) => a+b, 0),
        losersMatches: structure8.losersStructure.reduce((a,b) => a+b, 0)
    });
    
    const validation8 = validateStructure(structure8);
    console.log('Validation for 8:', validation8.isValid ? 'PASS' : 'FAIL');
    if (!validation8.isValid) {
        console.log('Errors:', validation8.errors);
    }
    
} catch (error) {
    console.error('Error:', error.message);
} 