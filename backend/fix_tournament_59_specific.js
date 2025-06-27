// backend/fix_tournament_59_specific.js
// Специальное исправление турнира 59 с диагностикой

const pool = require('./db');

async function fixTournament59() {
    console.log('🔧 СПЕЦИАЛЬНОЕ ИСПРАВЛЕНИЕ ТУРНИРА 59');
    console.log('='*50);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Диагностика текущего состояния
        console.log('\n🔍 1. ДИАГНОСТИКА ТЕКУЩЕГО СОСТОЯНИЯ');
        console.log('-'*30);
        
        const matches = await client.query(`
            SELECT id, round, match_number, team1_id, team2_id, winner_team_id, 
                   next_match_id, status
            FROM matches 
            WHERE tournament_id = 59 
            ORDER BY round, match_number
        `);

        console.log('📋 Текущие матчи турнира 59:');
        matches.rows.forEach(match => {
            console.log(`   Матч ${match.id}: round=${match.round}, ` +
                       `team1=${match.team1_id}, team2=${match.team2_id}, ` +
                       `winner=${match.winner_team_id}, next=${match.next_match_id}`);
        });

        // 2. Анализ проблем структуры
        console.log('\n🔍 2. АНАЛИЗ ПРОБЛЕМ СТРУКТУРЫ');
        console.log('-'*30);
        
        const nextMatchCounts = {};
        matches.rows.forEach(match => {
            if (match.next_match_id) {
                nextMatchCounts[match.next_match_id] = (nextMatchCounts[match.next_match_id] || 0) + 1;
            }
        });

        console.log('📊 Счетчик входящих матчей:');
        Object.entries(nextMatchCounts).forEach(([nextMatchId, count]) => {
            const status = count > 2 ? '❌ ПЕРЕПОЛНЕНИЕ' : '✅';
            console.log(`   Матч ${nextMatchId}: ${count} входящих матчей ${status}`);
        });

        // 3. Определяем проблемные матчи
        const problematicMatches = Object.entries(nextMatchCounts)
            .filter(([_, count]) => count > 2)
            .map(([matchId, count]) => ({ matchId: parseInt(matchId), count }));

        if (problematicMatches.length === 0) {
            console.log('✅ Проблем структуры не обнаружено!');
            await client.query('ROLLBACK');
            return;
        }

        console.log(`\n🚨 Найдено ${problematicMatches.length} проблемных матчей`);

        // 4. Исправление каждого проблемного матча
        for (const problem of problematicMatches) {
            console.log(`\n🔧 Исправляем матч ${problem.matchId} (${problem.count} входящих)`);
            
            // Получаем все матчи, ведущие в проблемный
            const incomingMatches = await client.query(`
                SELECT id, round, match_number, team1_id, team2_id, winner_team_id
                FROM matches 
                WHERE tournament_id = 59 AND next_match_id = $1
                ORDER BY round, match_number
            `, [problem.matchId]);

            console.log(`   📋 Входящие матчи:`);
            incomingMatches.rows.forEach((match, index) => {
                console.log(`      ${index+1}. Матч ${match.id}: round=${match.round}, ` +
                           `winner=${match.winner_team_id}`);
            });

            // Очищаем переполненный матч
            await client.query(
                'UPDATE matches SET team1_id = NULL, team2_id = NULL WHERE id = $1',
                [problem.matchId]
            );

            console.log(`   🧹 Очищен матч ${problem.matchId}`);

            // Размещаем только завершенные матчи (с победителями)
            const completedMatches = incomingMatches.rows.filter(m => m.winner_team_id !== null);
            
            if (completedMatches.length > 0) {
                // Размещаем первого победителя в team1
                await client.query(
                    'UPDATE matches SET team1_id = $1 WHERE id = $2',
                    [completedMatches[0].winner_team_id, problem.matchId]
                );
                console.log(`   ✅ Размещен победитель ${completedMatches[0].winner_team_id} в team1`);

                if (completedMatches.length > 1) {
                    // Размещаем второго победителя в team2
                    await client.query(
                        'UPDATE matches SET team2_id = $1 WHERE id = $2',
                        [completedMatches[1].winner_team_id, problem.matchId]
                    );
                    console.log(`   ✅ Размещен победитель ${completedMatches[1].winner_team_id} в team2`);
                }
            }

            // Остальные матчи переключаем на другие следующие матчи или обнуляем
            if (incomingMatches.rows.length > 2) {
                const excessMatches = incomingMatches.rows.slice(2);
                
                for (const excessMatch of excessMatches) {
                    // Ищем альтернативный следующий матч того же раунда
                    const alternativeMatch = await client.query(`
                        SELECT id FROM matches 
                        WHERE tournament_id = 59 
                        AND round = (SELECT round FROM matches WHERE id = $1) + 1
                        AND id != $1
                        AND (team1_id IS NULL OR team2_id IS NULL)
                        LIMIT 1
                    `, [problem.matchId]);

                    if (alternativeMatch.rows.length > 0) {
                        // Переключаем на альтернативный матч
                        await client.query(
                            'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                            [alternativeMatch.rows[0].id, excessMatch.id]
                        );
                        console.log(`   🔄 Матч ${excessMatch.id} переключен на матч ${alternativeMatch.rows[0].id}`);
                    } else {
                        // Обнуляем next_match_id
                        await client.query(
                            'UPDATE matches SET next_match_id = NULL WHERE id = $1',
                            [excessMatch.id]
                        );
                        console.log(`   🔄 Матч ${excessMatch.id} отключен от следующего матча`);
                    }
                }
            }
        }

        // 5. Финальная проверка
        console.log('\n🔍 5. ФИНАЛЬНАЯ ПРОВЕРКА');
        console.log('-'*30);
        
        const finalMatches = await client.query(`
            SELECT id, round, match_number, team1_id, team2_id, winner_team_id, 
                   next_match_id, status
            FROM matches 
            WHERE tournament_id = 59 
            ORDER BY round, match_number
        `);

        const finalNextMatchCounts = {};
        finalMatches.rows.forEach(match => {
            if (match.next_match_id) {
                finalNextMatchCounts[match.next_match_id] = (finalNextMatchCounts[match.next_match_id] || 0) + 1;
            }
        });

        console.log('📊 Итоговый счетчик входящих матчей:');
        Object.entries(finalNextMatchCounts).forEach(([nextMatchId, count]) => {
            const status = count > 2 ? '❌ ВСЕ ЕЩЕ ПЕРЕПОЛНЕНИЕ' : '✅ ИСПРАВЛЕНО';
            console.log(`   Матч ${nextMatchId}: ${count} входящих матчей ${status}`);
        });

        const stillProblematic = Object.values(finalNextMatchCounts).some(count => count > 2);
        
        if (stillProblematic) {
            console.log('❌ Некоторые проблемы не решены, откат изменений');
            await client.query('ROLLBACK');
            return false;
        } else {
            console.log('✅ Все проблемы решены, применяем изменения');
            await client.query('COMMIT');
            
            console.log('\n🎉 ТУРНИР 59 УСПЕШНО ИСПРАВЛЕН!');
            console.log('📋 Итоговые матчи:');
            finalMatches.rows.forEach(match => {
                console.log(`   Матч ${match.id}: round=${match.round}, ` +
                           `team1=${match.team1_id}, team2=${match.team2_id}, ` +
                           `winner=${match.winner_team_id}, next=${match.next_match_id}`);
            });
            
            return true;
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка исправления турнира 59:', error);
        return false;
    } finally {
        client.release();
    }
}

// Экспорт для использования
module.exports = { fixTournament59 };

// Запуск если файл вызван напрямую
if (require.main === module) {
    fixTournament59().then(success => {
        if (success) {
            console.log('\n✅ Исправление завершено успешно');
            process.exit(0);
        } else {
            console.log('\n❌ Исправление не удалось');
            process.exit(1);
        }
    }).catch(error => {
        console.error('💥 Критическая ошибка:', error);
        process.exit(1);
    });
} 