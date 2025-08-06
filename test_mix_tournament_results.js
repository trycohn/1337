// Тестирование результатов микс турнира
const TournamentService = require('./backend/services/tournament/TournamentService');

async function testMixTournamentResults() {
    try {
        console.log('🧪 Тестирование загрузки результатов микс турнира...');
        
        // Замените на ID реального микс турнира
        const tournamentId = 1;
        
        const tournament = await TournamentService.getTournamentDetails(tournamentId);
        
        console.log('📊 Данные турнира:');
        console.log('- ID:', tournament.id);
        console.log('- Название:', tournament.name);
        console.log('- Формат:', tournament.format);
        console.log('- Тип участников:', tournament.participant_type);
        
        console.log('\n👥 Участники:', tournament.participants?.length || 0);
        if (tournament.participants?.length > 0) {
            tournament.participants.slice(0, 3).forEach(p => {
                console.log(`  - ${p.name} (ID: ${p.id})`);
            });
        }
        
        console.log('\n🏆 Команды:', tournament.teams?.length || 0);
        if (tournament.teams?.length > 0) {
            tournament.teams.slice(0, 3).forEach(team => {
                console.log(`  - ${team.name} (ID: ${team.id})`);
                if (team.members?.length > 0) {
                    console.log(`    Состав: ${team.members.map(m => m.username || m.name).join(', ')}`);
                }
            });
        }
        
        console.log('\n⚔️ Матчи:', tournament.matches?.length || 0);
        const completedMatches = tournament.matches?.filter(m => m.status === 'completed') || [];
        console.log('- Завершенных:', completedMatches.length);
        
        if (completedMatches.length > 0) {
            console.log('\n🏁 Последние завершенные матчи:');
            completedMatches.slice(-3).forEach(match => {
                console.log(`  Матч #${match.match_number}: ${match.score1}:${match.score2} (победитель: ${match.winner_team_id})`);
            });
        }
        
        console.log('\n✅ Тест завершен успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка тестирования:', error.message);
        console.error(error.stack);
    }
}

// Запуск только если файл выполняется напрямую
if (require.main === module) {
    testMixTournamentResults().then(() => process.exit(0));
}

module.exports = { testMixTournamentResults };