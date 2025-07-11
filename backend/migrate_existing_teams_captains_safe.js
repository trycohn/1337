const pool = require('./db');

/**
 * 🛡️ БЕЗОПАСНЫЙ СКРИПТ МИГРАЦИИ: Назначение капитанов для существующих команд
 * 
 * Безопасная версия без триггеров и сложной логики
 */

async function migrateExistingTeamsCaptainsSafe() {
    const startTime = Date.now();
    console.log(`🚀 [SAFE MIGRATION] Начинаем безопасное назначение капитанов...`);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Проверяем что колонки созданы
        const columnsCheck = await client.query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'tournament_team_members' 
            AND column_name IN ('is_captain', 'captain_rating')
            ORDER BY column_name
        `);
        
        if (columnsCheck.rows.length !== 2) {
            throw new Error('Колонки системы капитанов не созданы. Сначала выполните безопасную миграцию.');
        }
        
        console.log('✅ Колонки системы капитанов найдены:', columnsCheck.rows);
        
        // 2. Находим команды без капитанов
        const teamsWithoutCaptains = await client.query(`
            SELECT DISTINCT 
                tt.id as team_id, 
                tt.tournament_id, 
                tt.name as team_name,
                t.mix_rating_type,
                COUNT(ttm.id) as members_count
            FROM tournament_teams tt
            LEFT JOIN tournaments t ON tt.tournament_id = t.id
            LEFT JOIN tournament_team_members ttm ON tt.id = ttm.team_id
            WHERE NOT EXISTS (
                SELECT 1 FROM tournament_team_members captain 
                WHERE captain.team_id = tt.id 
                AND captain.is_captain = TRUE
            )
            GROUP BY tt.id, tt.tournament_id, tt.name, t.mix_rating_type
            HAVING COUNT(ttm.id) > 0
            ORDER BY tt.id
        `);
        
        console.log(`📊 Найдено команд без капитанов: ${teamsWithoutCaptains.rows.length}`);
        
        if (teamsWithoutCaptains.rows.length === 0) {
            await client.query('COMMIT');
            console.log('🎉 Все команды уже имеют капитанов!');
            return;
        }
        
        let assignedCaptains = 0;
        
        // 3. Назначаем капитанов для каждой команды
        for (const team of teamsWithoutCaptains.rows) {
            console.log(`\n👑 Назначаем капитана для команды ${team.team_id}: "${team.team_name}"`);
            
            // Получаем участников команды с рейтингами
            const members = await client.query(`
                SELECT 
                    ttm.id,
                    ttm.user_id,
                    ttm.participant_id,
                    u.username,
                    u.faceit_elo,
                    u.cs2_premier_rank,
                    tp.faceit_elo as participant_faceit_elo,
                    tp.cs2_premier_rank as participant_premier_rank
                FROM tournament_team_members ttm
                LEFT JOIN users u ON ttm.user_id = u.id  
                LEFT JOIN tournament_participants tp ON ttm.participant_id = tp.id
                WHERE ttm.team_id = $1
                ORDER BY ttm.id
            `, [team.team_id]);
            
            if (members.rows.length === 0) {
                console.log('⚠️ Команда пуста, пропускаем');
                continue;
            }
            
            // Определяем тип рейтинга (по умолчанию faceit)
            const ratingType = team.mix_rating_type || 'faceit';
            
            // Находим участника с наивысшим рейтингом
            let bestMember = null;
            let bestRating = -1;
            
            for (const member of members.rows) {
                let rating = 0;
                
                if (ratingType === 'faceit') {
                    rating = parseInt(member.participant_faceit_elo) || 
                            parseInt(member.faceit_elo) || 
                            1000;
                } else {
                    rating = parseInt(member.participant_premier_rank) || 
                            parseInt(member.cs2_premier_rank) || 
                            5;
                }
                
                if (rating > bestRating) {
                    bestRating = rating;
                    bestMember = member;
                }
            }
            
            if (bestMember) {
                // Назначаем капитана ПРОСТЫМ UPDATE (без триггеров)
                await client.query(`
                    UPDATE tournament_team_members 
                    SET 
                        is_captain = TRUE,
                        captain_rating = $1
                    WHERE id = $2
                `, [bestRating, bestMember.id]);
                
                assignedCaptains++;
                console.log(`✅ Назначен капитан: ${bestMember.username} (рейтинг: ${bestRating})`);
            } else {
                console.log('❌ Не удалось найти подходящего капитана');
            }
        }
        
        await client.query('COMMIT');
        
        const duration = Date.now() - startTime;
        console.log(`\n🎉 БЕЗОПАСНАЯ МИГРАЦИЯ ЗАВЕРШЕНА за ${duration}ms:`);
        console.log(`   👑 Назначено капитанов: ${assignedCaptains}`);
        console.log(`   📊 Обработано команд: ${teamsWithoutCaptains.rows.length}`);
        console.log(`   ✅ Без триггеров и сложной логики`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка безопасной миграции:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Запуск безопасной миграции
if (require.main === module) {
    migrateExistingTeamsCaptainsSafe()
        .then(() => {
            console.log('🚀 Безопасная миграция капитанов завершена!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Критическая ошибка:', error);
            process.exit(1);
        });
}

module.exports = { migrateExistingTeamsCaptainsSafe }; 