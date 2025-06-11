/**
 * Скрипт для проверки эффективности системы контроля баланса команд
 * Использование: node check_team_balance.js
 */

// Пример тестовых данных для проверки алгоритма баланса
const testParticipants = [
    { name: 'HighSkill1', faceit_elo: 3000 },
    { name: 'HighSkill2', faceit_elo: 2800 },
    { name: 'HighSkill3', faceit_elo: 2600 },
    { name: 'MidSkill1', faceit_elo: 2000 },
    { name: 'MidSkill2', faceit_elo: 1800 },
    { name: 'MidSkill3', faceit_elo: 1600 },
    { name: 'MidSkill4', faceit_elo: 1400 },
    { name: 'LowSkill1', faceit_elo: 1200 },
    { name: 'LowSkill2', faceit_elo: 1000 },
    { name: 'LowSkill3', faceit_elo: 800 },
    { name: 'LowSkill4', faceit_elo: 600 },
    { name: 'VeryLowSkill1', faceit_elo: 400 },
    { name: 'VeryLowSkill2', faceit_elo: 200 },
    { name: 'VeryLowSkill3', faceit_elo: 100 }
];

function calculateTeamAverage(team) {
    const ratings = team.map(member => member.faceit_elo);
    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function checkTeamBalance(teams) {
    const teamAverages = teams.map(team => calculateTeamAverage(team));
    const minAvg = Math.min(...teamAverages);
    const maxAvg = Math.max(...teamAverages);
    const percentageDiff = ((maxAvg - minAvg) / minAvg) * 100;
    
    return {
        teamAverages,
        minAvg,
        maxAvg,
        percentageDiff,
        isBalanced: percentageDiff <= 20
    };
}

function distributePlayersToTeams(participants, teamSize) {
    const sorted = [...participants].sort((a, b) => b.faceit_elo - a.faceit_elo);
    const teamsCount = Math.floor(participants.length / teamSize);
    const teams = Array.from({ length: teamsCount }, () => []);
    
    // Простое распределение по принципу змейки
    for (let i = 0; i < sorted.length; i++) {
        if (teams[i % teamsCount].length < teamSize) {
            teams[i % teamsCount].push(sorted[i]);
        }
    }
    
    return teams.filter(team => team.length === teamSize);
}

function testTeamBalance() {
    console.log('🧪 ТЕСТИРОВАНИЕ СИСТЕМЫ КОНТРОЛЯ БАЛАНСА КОМАНД');
    console.log('=' * 60);
    
    const teamSize = 2;
    const teams = distributePlayersToTeams(testParticipants, teamSize);
    
    console.log(`📊 Участников: ${testParticipants.length}`);
    console.log(`👥 Размер команды: ${teamSize}`);
    console.log(`🏆 Команд создано: ${teams.length}`);
    console.log();
    
    teams.forEach((team, index) => {
        const avgRating = calculateTeamAverage(team);
        console.log(`Команда ${index + 1}: ${team.map(p => `${p.name}(${p.faceit_elo})`).join(', ')} - Средний рейтинг: ${Math.round(avgRating)}`);
    });
    
    console.log();
    const balance = checkTeamBalance(teams);
    console.log(`⚖️ РЕЗУЛЬТАТЫ ПРОВЕРКИ БАЛАНСА:`);
    console.log(`   - Минимальный средний рейтинг: ${Math.round(balance.minAvg)}`);
    console.log(`   - Максимальный средний рейтинг: ${Math.round(balance.maxAvg)}`);
    console.log(`   - Расхождение: ${Math.round(balance.percentageDiff)}%`);
    console.log(`   - Сбалансированы (≤20%): ${balance.isBalanced ? '✅ ДА' : '❌ НЕТ'}`);
    
    const quality = balance.percentageDiff <= 10 ? 'Отличный' : 
                   balance.percentageDiff <= 20 ? 'Хороший' : 
                   balance.percentageDiff <= 30 ? 'Удовлетворительный' : 'Плохой';
    console.log(`   - Качество баланса: ${quality}`);
    
    console.log();
    console.log('🎯 ОЖИДАНИЯ ОТ СИСТЕМЫ v4:');
    console.log('   - Расхождение должно быть ≤20%');
    console.log('   - В серверных логах должны быть сообщения о перебалансировке');
    console.log('   - API должен возвращать статистику баланса');
    
    return balance;
}

if (require.main === module) {
    testTeamBalance();
}

module.exports = { testTeamBalance, checkTeamBalance, calculateTeamAverage }; 