const fs = require('fs');

console.log('Проверка TDZ ошибок в TournamentDetails.js...');

try {
    const content = fs.readFileSync('frontend/src/components/TournamentDetails.js', 'utf8');
    console.log('Файл загружен, размер:', Math.round(content.length / 1024), 'KB');
    
    // Ищем проблемные паттерны
    const problems = [];
    
    // 1. fetchCreatorInfo в зависимостях до определения
    if (content.includes(', fetchCreatorInfo]);') && content.indexOf(', fetchCreatorInfo]);') < content.indexOf('const fetchCreatorInfo = async')) {
        problems.push('fetchCreatorInfo используется в зависимостях до определения');
    }
    
    // 2. Дублированный setupWebSocket
    const setupWebSocketMatches = (content.match(/const setupWebSocket = useCallback/g) || []).length;
    if (setupWebSocketMatches > 1) {
        problems.push(`Дублированный setupWebSocket (${setupWebSocketMatches} раз)`);
    }
    
    // 3. Проверяем, что fetchCreatorInfo не useCallback
    if (content.includes('const fetchCreatorInfo = async (creatorId) => {')) {
        problems.push('fetchCreatorInfo должен быть useCallback');
    }
    
    console.log('Найденные проблемы:', problems.length);
    problems.forEach((problem, index) => {
        console.log(`${index + 1}. ${problem}`);
    });
    
    if (problems.length > 0) {
        console.log('\nНачинаю исправление...');
        // Здесь будут исправления
        console.log('Исправления требуют ручной работы');
    } else {
        console.log('✅ TDZ проблем не найдено!');
    }
    
} catch (error) {
    console.error('Ошибка:', error.message);
} 