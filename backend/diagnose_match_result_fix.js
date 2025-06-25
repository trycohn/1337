#!/usr/bin/env node

/**
 * 🔍 Скрипт диагностики проблемы с сохранением результатов матчей
 * 
 * Проблема: POST /api/tournaments/matches/1606/result возвращает 404 (Not Found)
 * Причина: Матч с указанным ID не найден в базе данных
 * 
 * Этот скрипт:
 * 1. Проверяет существование матча с заданным ID
 * 2. Показывает все матчи турнира
 * 3. Проверяет структуру API endpoints
 * 4. Предлагает решения
 */

const { Pool } = require('pg');

// Настройки подключения к БД (локальные)
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: '1337community',
    password: '01012006Fortnite!',
    port: 5432,
});

console.log('🔍 ДИАГНОСТИКА ПРОБЛЕМЫ С СОХРАНЕНИЕМ РЕЗУЛЬТАТОВ МАТЧЕЙ');
console.log('='.repeat(60));

async function diagnoseMatchResultProblem() {
    try {
        // ID матча из ошибки
        const problemMatchId = 1606;
        
        console.log(`\n1. 🔍 Проверяем существование матча ${problemMatchId}...`);
        
        const matchCheck = await pool.query('SELECT * FROM matches WHERE id = $1', [problemMatchId]);
        
        if (matchCheck.rows.length === 0) {
            console.log(`❌ МАТЧ ${problemMatchId} НЕ НАЙДЕН В БАЗЕ ДАННЫХ!`);
            console.log(`   Это объясняет ошибку 404.`);
        } else {
            console.log(`✅ Матч ${problemMatchId} найден:`);
            console.log(`   - Tournament ID: ${matchCheck.rows[0].tournament_id}`);
            console.log(`   - Team 1 ID: ${matchCheck.rows[0].team1_id}`);
            console.log(`   - Team 2 ID: ${matchCheck.rows[0].team2_id}`);
            console.log(`   - Winner: ${matchCheck.rows[0].winner_team_id || 'не определен'}`);
            console.log(`   - Score: ${matchCheck.rows[0].score1 || 0}:${matchCheck.rows[0].score2 || 0}`);
        }
        
        console.log(`\n2. 🔍 Ищем матчи рядом с ID ${problemMatchId}...`);
        
        const nearbyMatches = await pool.query(
            'SELECT id, tournament_id, team1_id, team2_id, winner_team_id, score1, score2, created_at ' +
            'FROM matches WHERE id BETWEEN $1 AND $2 ORDER BY id',
            [problemMatchId - 10, problemMatchId + 10]
        );
        
        if (nearbyMatches.rows.length > 0) {
            console.log(`📊 Найдено ${nearbyMatches.rows.length} матчей рядом с ${problemMatchId}:`);
            nearbyMatches.rows.forEach(match => {
                console.log(`   ID ${match.id}: Tournament ${match.tournament_id}, Teams ${match.team1_id} vs ${match.team2_id}, Winner: ${match.winner_team_id || 'TBD'}`);
            });
        } else {
            console.log(`❌ Нет матчей в диапазоне ID ${problemMatchId - 10} - ${problemMatchId + 10}`);
        }
        
        console.log(`\n3. 🔍 Проверяем последние созданные матчи...`);
        
        const recentMatches = await pool.query(
            'SELECT id, tournament_id, team1_id, team2_id, winner_team_id, score1, score2, created_at ' +
            'FROM matches ORDER BY created_at DESC LIMIT 20'
        );
        
        if (recentMatches.rows.length > 0) {
            console.log(`📊 Последние 20 созданных матчей:`);
            recentMatches.rows.forEach(match => {
                const date = new Date(match.created_at).toLocaleString('ru-RU');
                console.log(`   ID ${match.id}: Tournament ${match.tournament_id}, создан ${date}`);
            });
        }
        
        console.log(`\n4. 🔍 Проверяем активные турниры...`);
        
        const activeTournaments = await pool.query(
            `SELECT t.id, t.name, t.status, COUNT(m.id) as matches_count 
             FROM tournaments t 
             LEFT JOIN matches m ON t.id = m.tournament_id 
             WHERE t.status = 'active' 
             GROUP BY t.id, t.name, t.status 
             ORDER BY t.id DESC LIMIT 10`
        );
        
        if (activeTournaments.rows.length > 0) {
            console.log(`📊 Активные турниры с матчами:`);
            activeTournaments.rows.forEach(tournament => {
                console.log(`   Tournament ${tournament.id}: "${tournament.name}", матчей: ${tournament.matches_count}`);
            });
        }
        
        console.log(`\n5. 🔍 Ищем турнир, к которому мог бы относиться матч ${problemMatchId}...`);
        
        // Проверим, есть ли турниры с матчами близко к этому ID
        const possibleTournaments = await pool.query(
            `SELECT DISTINCT m.tournament_id, t.name, COUNT(m.id) as matches_count,
                    MIN(m.id) as min_match_id, MAX(m.id) as max_match_id
             FROM matches m
             JOIN tournaments t ON m.tournament_id = t.id
             WHERE m.id BETWEEN $1 AND $2
             GROUP BY m.tournament_id, t.name
             ORDER BY m.tournament_id DESC`,
            [problemMatchId - 100, problemMatchId + 100]
        );
        
        if (possibleTournaments.rows.length > 0) {
            console.log(`📊 Турниры с матчами в диапазоне ${problemMatchId - 100} - ${problemMatchId + 100}:`);
            possibleTournaments.rows.forEach(tournament => {
                console.log(`   Tournament ${tournament.tournament_id}: "${tournament.name}"`);
                console.log(`     Матчей: ${tournament.matches_count}, ID диапазон: ${tournament.min_match_id} - ${tournament.max_match_id}`);
            });
        }
        
        console.log(`\n6. 💡 ВОЗМОЖНЫЕ РЕШЕНИЯ:`);
        
        if (matchCheck.rows.length === 0) {
            console.log(`❌ Матч ${problemMatchId} не существует. Возможные причины:`);
            console.log(`   • Матч был удален из базы данных`);
            console.log(`   • ID матча некорректный`);
            console.log(`   • Frontend передает неверный ID матча`);
            console.log(`   • Произошла рассинхронизация данных`);
            
            console.log(`\n🔧 Рекомендуемые действия:`);
            console.log(`   1. Проверить логи frontend - какой именно ID матча передается`);
            console.log(`   2. Обновить данные турнира в frontend`);
            console.log(`   3. Проверить, не было ли недавней перегенерации сетки`);
            console.log(`   4. Добавить более детальное логирование в API endpoint`);
        } else {
            console.log(`✅ Матч ${problemMatchId} существует, проблема в другом`);
            console.log(`🔧 Рекомендуемые действия:`);
            console.log(`   1. Проверить логи backend на детали ошибки`);
            console.log(`   2. Проверить права доступа пользователя`);
            console.log(`   3. Проверить валидность данных запроса`);
        }
        
        console.log(`\n7. 🔧 ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА:`);
        
        // Проверим структуру таблицы matches
        const tableStructure = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'matches' 
            ORDER BY ordinal_position
        `);
        
        console.log(`📋 Структура таблицы matches:`);
        tableStructure.rows.forEach(col => {
            console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
    } catch (error) {
        console.error('❌ Ошибка диагностики:', error);
    } finally {
        await pool.end();
    }
}

// Функция для тестирования API endpoint напрямую
async function testMatchResultEndpoint() {
    console.log(`\n8. 🧪 ТЕСТИРОВАНИЕ API ENDPOINT:`);
    console.log(`   Endpoint: POST /api/tournaments/matches/:matchId/result`);
    console.log(`   Базовый путь: /api/tournaments/`);
    console.log(`   Полный путь для матча 1606: /api/tournaments/matches/1606/result`);
    
    const testUrl = 'https://1337community.com/api/tournaments/matches/1606/result';
    console.log(`   Полный URL: ${testUrl}`);
    
    console.log(`\n💡 Для тестирования endpoint можно использовать:`);
    console.log(`   curl -X POST "${testUrl}" \\`);
    console.log(`        -H "Authorization: Bearer YOUR_TOKEN" \\`);
    console.log(`        -H "Content-Type: application/json" \\`);
    console.log(`        -d '{"winner_team_id": 123, "score1": 1, "score2": 0}'`);
}

// Запуск диагностики
(async () => {
    await diagnoseMatchResultProblem();
    await testMatchResultEndpoint();
    
    console.log(`\n✅ ДИАГНОСТИКА ЗАВЕРШЕНА`);
    console.log(`📋 Проверьте результаты выше для определения причины проблемы`);
})(); 