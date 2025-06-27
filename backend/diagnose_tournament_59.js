// backend/diagnose_tournament_59.js
// Диагностика турнира 59 для выявления проблем с отображением сетки

const pool = require('./db');

async function diagnoseTournament59() {
    console.log('🔍 ДИАГНОСТИКА ТУРНИРА 59');
    console.log('='*50);
    
    try {
        // 1. Проверяем основную информацию о турнире
        console.log('📋 1. ОСНОВНАЯ ИНФОРМАЦИЯ О ТУРНИРЕ');
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [59]);
        
        if (tournamentResult.rows.length === 0) {
            console.log('❌ ТУРНИР 59 НЕ НАЙДЕН!');
            return;
        }
        
        const tournament = tournamentResult.rows[0];
        console.log(`   - Название: ${tournament.name}`);
        console.log(`   - Статус: ${tournament.status}`);
        console.log(`   - Тип участников: ${tournament.participant_type}`);
        console.log(`   - Формат: ${tournament.format}`);
        console.log(`   - Создатель: ${tournament.created_by}`);
        
        // 2. Проверяем участников
        console.log('\n👥 2. УЧАСТНИКИ ТУРНИРА');
        let participants = [];
        
        if (tournament.participant_type === 'solo') {
            const participantsResult = await pool.query(
                'SELECT id, user_id, name, in_team FROM tournament_participants WHERE tournament_id = $1 ORDER BY id',
                [59]
            );
            participants = participantsResult.rows;
        } else {
            const participantsResult = await pool.query(
                'SELECT id, name, creator_id FROM tournament_teams WHERE tournament_id = $1 ORDER BY id',
                [59]
            );
            participants = participantsResult.rows;
        }
        
        console.log(`   - Всего участников: ${participants.length}`);
        console.log(`   - Первые 5 участников:`);
        participants.slice(0, 5).forEach((p, index) => {
            console.log(`     ${index + 1}. ID: ${p.id}, Name: "${p.name}"`);
        });
        
        // 3. Проверяем матчи
        console.log('\n⚔️ 3. МАТЧИ ТУРНИРА');
        const matchesResult = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [59]
        );
        
        console.log(`   - Всего матчей: ${matchesResult.rows.length}`);
        
        if (matchesResult.rows.length === 0) {
            console.log('❌ МАТЧИ НЕ НАЙДЕНЫ! Сетка не сгенерирована.');
        } else {
            console.log(`   - Матчи по раундам:`);
            const matchesByRound = {};
            matchesResult.rows.forEach(match => {
                if (!matchesByRound[match.round]) {
                    matchesByRound[match.round] = [];
                }
                matchesByRound[match.round].push(match);
            });
            
            Object.keys(matchesByRound).sort((a, b) => a - b).forEach(round => {
                const roundMatches = matchesByRound[round];
                console.log(`     Раунд ${round}: ${roundMatches.length} матчей`);
                roundMatches.forEach(match => {
                    const team1 = match.team1_id || 'TBD';
                    const team2 = match.team2_id || 'TBD';
                    const winner = match.winner_team_id || 'не определен';
                    console.log(`       Матч ${match.id}: ${team1} vs ${team2} (победитель: ${winner})`);
                });
            });
        }
        
        // 4. Проверяем команды (если это командный турнир)
        if (tournament.participant_type === 'team') {
            console.log('\n🏆 4. КОМАНДЫ ТУРНИРА');
            const teamsResult = await pool.query(
                'SELECT id, name, creator_id FROM tournament_teams WHERE tournament_id = $1',
                [59]
            );
            
            console.log(`   - Всего команд: ${teamsResult.rows.length}`);
            
            for (const team of teamsResult.rows) {
                const membersResult = await pool.query(
                    'SELECT * FROM tournament_team_members WHERE team_id = $1',
                    [team.id]
                );
                console.log(`     Команда ${team.name} (ID: ${team.id}): ${membersResult.rows.length} участников`);
            }
        }
        
        // 5. Проверяем возможность генерации сетки
        console.log('\n🎯 5. ВОЗМОЖНОСТЬ ГЕНЕРАЦИИ СЕТКИ');
        
        if (participants.length < 2) {
            console.log('❌ Недостаточно участников для генерации сетки');
        } else {
            console.log(`✅ Участников достаточно: ${participants.length}`);
        }
        
        if (matchesResult.rows.length > 0) {
            console.log('⚠️ Сетка уже сгенерирована, требуется перегенерация');
        } else {
            console.log('✅ Можно генерировать сетку');
        }
        
        // 6. Проверяем структуру данных участников
        console.log('\n🔍 6. СТРУКТУРА ДАННЫХ УЧАСТНИКОВ');
        const invalidParticipants = participants.filter(p => 
            typeof p.id !== 'number' || isNaN(p.id) || !p.name
        );
        
        if (invalidParticipants.length > 0) {
            console.log(`❌ Найдены некорректные участники: ${invalidParticipants.length}`);
            invalidParticipants.forEach((p, index) => {
                console.log(`   ${index + 1}. ID: ${p.id} (${typeof p.id}), Name: "${p.name}"`);
            });
        } else {
            console.log('✅ Все участники имеют корректную структуру данных');
        }
        
        // 7. Итоговые рекомендации
        console.log('\n💡 7. РЕКОМЕНДАЦИИ');
        
        if (matchesResult.rows.length === 0) {
            console.log('🔧 Рекомендация: Необходимо сгенерировать сетку турнира');
            console.log('   Команда: POST /api/tournaments/59/generate-bracket');
        } else if (invalidParticipants.length > 0) {
            console.log('🔧 Рекомендация: Исправить данные участников перед перегенерацией');
        } else {
            console.log('🔧 Рекомендация: Попробовать перегенерировать сетку');
            console.log('   Команда: POST /api/tournaments/59/regenerate-bracket');
        }
        
    } catch (error) {
        console.error('❌ ОШИБКА ДИАГНОСТИКИ:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Дополнительная функция - симуляция генерации сетки
async function testBracketGeneration() {
    console.log('\n🧪 ТЕСТ ГЕНЕРАЦИИ СЕТКИ');
    console.log('='*30);
    
    try {
        const { generateBracket } = require('./bracketGenerator');
        
        // Получаем участников
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [59]);
        const tournament = tournamentResult.rows[0];
        
        let participants;
        if (tournament.participant_type === 'solo') {
            const participantsResult = await pool.query(
                'SELECT id, name FROM tournament_participants WHERE tournament_id = $1',
                [59]
            );
            participants = participantsResult.rows;
        } else {
            const participantsResult = await pool.query(
                'SELECT id, name FROM tournament_teams WHERE tournament_id = $1',
                [59]
            );
            participants = participantsResult.rows;
        }
        
        console.log(`🎯 Попытка генерации для ${participants.length} участников`);
        
        // Проверяем участников
        participants.forEach((p, index) => {
            if (typeof p.id !== 'number' || isNaN(p.id)) {
                throw new Error(`Участник ${index + 1} имеет некорректный ID: ${p.id} (${typeof p.id})`);
            }
        });
        
        console.log('✅ Все участники прошли проверку ID');
        console.log('🎯 Генерация сетки не выполняется (только тест структуры данных)');
        
        return true;
    } catch (error) {
        console.error('❌ ОШИБКА ТЕСТА ГЕНЕРАЦИИ:', error.message);
        return false;
    }
}

// Запуск диагностики
if (require.main === module) {
    (async () => {
        await diagnoseTournament59();
        await testBracketGeneration();
        process.exit(0);
    })();
}

module.exports = { diagnoseTournament59, testBracketGeneration }; 