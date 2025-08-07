// ===============================================
// ПРОДВИНУТАЯ ДИАГНОСТИКА ТУРНИРА В БРАУЗЕРЕ
// ===============================================

console.log('🔍 ПРОДВИНУТАЯ ДИАГНОСТИКА ТУРНИРА');
console.log('=====================================');

// Проверяем наличие данных
if (!window.apiData) {
    console.log('❌ Данные не загружены! Сначала выполните:');
    console.log('fetch(`/api/tournaments/1`).then(r => r.json()).then(d => { window.apiData = d; console.log("✅ Данные загружены"); });');
    return;
}

const tournament = window.apiData;
const matches = tournament.matches || [];

console.log('📊 ОСНОВНАЯ ИНФОРМАЦИЯ:');
console.log('Турнир:', tournament.name);
console.log('Формат:', tournament.format || tournament.bracket_type);
console.log('Статус:', tournament.status);
console.log('Всего матчей:', matches.length);

// Анализируем финальные матчи
console.log('\n🏆 АНАЛИЗ ФИНАЛЬНЫХ МАТЧЕЙ:');
const finalMatches = matches.filter(m => 
    m.bracket_type === 'grand_final' || 
    m.is_final === true ||
    m.bracket_type === 'final'
);

console.log('Найдено финальных матчей:', finalMatches.length);
if (finalMatches.length > 0) {
    finalMatches.forEach(match => {
        console.log(`  Финал ID ${match.id}:`);
        console.log(`    Статус: ${match.status}`);
        console.log(`    State: ${match.state || 'undefined'}`);
        console.log(`    Команды: ${match.team1_id} vs ${match.team2_id}`);
        console.log(`    Счет: ${match.score1}:${match.score2}`);
        console.log(`    Победитель: ${match.winner_team_id}`);
        console.log(`    Тип: ${match.bracket_type}`);
        console.log(`    Раунд: ${match.round}`);
        
        // Проверяем критерии завершенности
        const hasValidState = match.state === 'DONE' || match.state === 'SCORE_DONE' || match.status === 'completed';
        const hasScore = (match.score1 !== null && match.score1 !== undefined) || 
                        (match.score2 !== null && match.score2 !== undefined);
        const hasWinner = match.winner_team_id !== null && match.winner_team_id !== undefined;
        
        console.log(`    Критерии завершенности:`);
        console.log(`      hasValidState: ${hasValidState}`);
        console.log(`      hasScore: ${hasScore}`);
        console.log(`      hasWinner: ${hasWinner}`);
        console.log(`      isCompleted: ${hasValidState || hasScore || hasWinner}`);
    });
}

// Проверяем команды
console.log('\n👥 ИНФОРМАЦИЯ О КОМАНДАХ:');
const teams = tournament.teams || tournament.participants || [];
console.log('Найдено команд/участников:', teams.length);

if (finalMatches.length > 0) {
    const finalMatch = finalMatches[0];
    const team1 = teams.find(t => t.id === finalMatch.team1_id);
    const team2 = teams.find(t => t.id === finalMatch.team2_id);
    const winner = teams.find(t => t.id === finalMatch.winner_team_id);
    
    console.log('В финале:');
    console.log(`  Команда 1 (ID ${finalMatch.team1_id}): ${team1 ? team1.name : 'НЕ НАЙДЕНА'}`);
    console.log(`  Команда 2 (ID ${finalMatch.team2_id}): ${team2 ? team2.name : 'НЕ НАЙДЕНА'}`);
    console.log(`  Победитель (ID ${finalMatch.winner_team_id}): ${winner ? winner.name : 'НЕ НАЙДЕН'}`);
}

// Эмулируем логику TournamentResults
console.log('\n🧪 ЭМУЛЯЦИЯ ЛОГИКИ TournamentResults:');

// Фильтрация завершенных матчей
const completedMatches = matches.filter(match => {
    const hasValidState = match.state === 'DONE' || match.state === 'SCORE_DONE' || match.status === 'completed';
    const hasScore = (match.score1 !== null && match.score1 !== undefined) || 
                    (match.score2 !== null && match.score2 !== undefined);
    const hasWinner = match.winner_team_id !== null && match.winner_team_id !== undefined;
    
    return hasValidState || hasScore || hasWinner;
});

console.log('Завершенных матчей по логике компонента:', completedMatches.length);

// Проверяем условие hasResults
const hasResults = completedMatches.length > 0;
console.log('hasResults:', hasResults);

// Проверяем условие для отображения призеров
const isCompleted = tournament.status === 'completed';
console.log('Турнир завершен (status === completed):', isCompleted);

// Эмулируем calculateWinners
console.log('\n🏆 ЭМУЛЯЦИЯ calculateWinners:');

const finalMatch = matches.find(match => 
    match.bracket_type === 'grand_final' || 
    match.is_final === true ||
    (match.round && parseInt(match.round) === Math.max(...matches.map(m => parseInt(m.round) || 0)))
);

const thirdPlaceMatch = matches.find(match => 
    match.is_third_place_match === true ||
    match.bracket_type === 'placement'
);

console.log('Найден финал:', !!finalMatch);
console.log('Финал завершен (есть победитель):', finalMatch && finalMatch.winner_team_id);
console.log('Найден матч за 3-е место:', !!thirdPlaceMatch);

if (finalMatch && finalMatch.winner_team_id) {
    console.log('✅ Призеры должны отображаться');
    
    const firstPlace = teams.find(t => t.id === finalMatch.winner_team_id);
    const secondPlaceId = finalMatch.winner_team_id === finalMatch.team1_id 
        ? finalMatch.team2_id 
        : finalMatch.team1_id;
    const secondPlace = teams.find(t => t.id === secondPlaceId);
    
    console.log('1-е место:', firstPlace?.name);
    console.log('2-е место:', secondPlace?.name);
} else {
    console.log('❌ Призеры НЕ должны отображаться');
}

// Проверяем что должно отображаться
console.log('\n📋 ЧТО ДОЛЖНО ОТОБРАЖАТЬСЯ:');
console.log('Блок "Результаты пока недоступны":', !hasResults);
console.log('Блок "Призовые места":', hasResults && isCompleted && finalMatch && finalMatch.winner_team_id);
console.log('Блок "История матчей":', hasResults && completedMatches.length > 0);

console.log('\n✅ Диагностика завершена!');