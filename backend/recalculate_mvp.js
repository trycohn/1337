/**
 * 🏆 Скрипт пересчета MVP для существующих матчей
 * Использование: node recalculate_mvp.js
 */

const MVPCalculator = require('./services/mvpCalculator');
const pool = require('./db');

async function recalculateAllMVP() {
    console.log('🏆 [MVP Recalculator] Начинаем пересчет MVP для существующих матчей...');
    
    const client = await pool.connect();
    
    try {
        // Получаем список всех матчей с импортированной статистикой
        const matchesResult = await client.query(`
            SELECT DISTINCT
                mm.matchid,
                mm.our_match_id,
                m.source_type
            FROM matchzy_matches mm
            JOIN matches m ON m.id = mm.our_match_id
            WHERE mm.our_match_id IS NOT NULL
              AND m.source_type IN ('tournament', 'custom')
              AND EXISTS (
                  SELECT 1 FROM matchzy_players mp 
                  WHERE mp.matchid = mm.matchid
              )
            ORDER BY mm.matchid
        `);
        
        const matches = matchesResult.rows;
        console.log(`📊 Найдено ${matches.length} матчей для обработки`);
        
        if (matches.length === 0) {
            console.log('ℹ️ Нет матчей для пересчета');
            return;
        }
        
        let processed = 0;
        let errors = 0;
        
        for (const match of matches) {
            try {
                console.log(`\n⏳ [${processed + 1}/${matches.length}] Обрабатываем matchid=${match.matchid} (our_match_id=${match.our_match_id})...`);
                
                const result = await MVPCalculator.calculateMatchMVP(match.matchid);
                
                if (result?.mvp) {
                    console.log(`   ✅ MVP: ${result.mvp.name} (${result.mvp.mvp_score.toFixed(2)} очков)`);
                    processed++;
                } else {
                    console.log(`   ⚠️ MVP не определен (возможно, нет данных)`);
                }
                
            } catch (error) {
                console.error(`   ❌ Ошибка обработки matchid=${match.matchid}:`, error.message);
                errors++;
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Пересчет завершен!');
        console.log(`📊 Обработано матчей: ${processed}/${matches.length}`);
        if (errors > 0) {
            console.log(`⚠️ Ошибок: ${errors}`);
        }
        console.log('='.repeat(60));
        
        // Показываем топ-5 MVP
        console.log('\n🏆 ТОП-5 MVP по всем матчам:');
        const topMVPResult = await client.query(`
            SELECT 
                u.username,
                mp.name as ingame_name,
                ROUND(mvp.mvp_score::numeric, 2) as mvp_score,
                ROUND(mvp.s_base::numeric, 2) as s_base,
                ROUND(mvp.s_impact::numeric, 2) as s_impact,
                mvp.our_match_id as match_id
            FROM match_player_mvp mvp
            LEFT JOIN users u ON u.id = mvp.user_id
            LEFT JOIN matchzy_players mp 
                ON mp.matchid = mvp.matchzy_matchid 
                AND mp.mapnumber = mvp.mapnumber 
                AND mp.steamid64 = mvp.steamid64
            ORDER BY mvp.mvp_score DESC
            LIMIT 5
        `);
        
        topMVPResult.rows.forEach((row, idx) => {
            console.log(`${idx + 1}. ${row.username || row.ingame_name} - ${row.mvp_score} очков (Match #${row.match_id})`);
        });
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Запускаем
recalculateAllMVP()
    .then(() => {
        console.log('\n✅ Скрипт завершен успешно');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Скрипт завершен с ошибкой:', error);
        process.exit(1);
    });

