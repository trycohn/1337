const pool = require('./db');

/**
 * 🛡️ БЕЗОПАСНЫЙ СКРИПТ МИГРАЦИИ: Назначение капитанов для существующих команд
 * 
 * v2.0 - Обновлен с учетом приоритизации ручных рейтингов участников
 * Безопасная версия без триггеров и сложной логики
 */

async function migrateExistingTeamsCaptainsSafe() {
    const startTime = Date.now();
    console.log(`🚀 [SAFE MIGRATION v2.0] Начинаем безопасное назначение капитанов с приоритизацией ручных рейтингов...`);
    
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
        
        // 2. Находим команды без капитанов с расширенной информацией
        const teamsWithoutCaptains = await client.query(`
            SELECT DISTINCT 
                tt.id as team_id, 
                tt.tournament_id, 
                tt.name as team_name,
                t.name as tournament_name,
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
            GROUP BY tt.id, tt.tournament_id, tt.name, t.name, t.mix_rating_type
            HAVING COUNT(ttm.id) > 0
            ORDER BY tt.tournament_id, tt.id
        `);
        
        console.log(`📊 Найдено команд без капитанов: ${teamsWithoutCaptains.rows.length}`);
        
        if (teamsWithoutCaptains.rows.length === 0) {
            await client.query('COMMIT');
            console.log('🎉 Все команды уже имеют капитанов!');
            return;
        }
        
        let assignedCaptains = 0;
        let captainsWithManualRatings = 0;
        const migrationResults = [];
        
        // 3. Назначаем капитанов для каждой команды с новой логикой приоритизации
        for (const team of teamsWithoutCaptains.rows) {
            console.log(`\n👑 Назначаем капитана для команды ${team.team_id}: "${team.team_name}" (турнир: "${team.tournament_name}")`);
            
            // 🔧 ИСПРАВЛЕНО: Получаем участников команды с ПОЛНОЙ информацией о рейтингах
            const members = await client.query(`
                SELECT 
                    ttm.id,
                    ttm.user_id,
                    ttm.participant_id,
                    u.username,
                    tp.name as participant_name,
                    -- 🆕 РУЧНЫЕ РЕЙТИНГИ УЧАСТНИКА (приоритет)
                    tp.faceit_elo,
                    tp.cs2_premier_rank,
                    -- 🆕 РЕЙТИНГИ ПОЛЬЗОВАТЕЛЯ (резерв)
                    u.faceit_elo as user_faceit_elo,
                    u.cs2_premier_rank as user_cs2_premier_rank,
                    -- 🆕 ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ ДЛЯ СОВМЕСТИМОСТИ
                    tp.faceit_rating,
                    tp.premier_rank,
                    tp.premier_rating,
                    u.faceit_rating as user_faceit_rating,
                    u.premier_rating as user_premier_rating
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
            console.log(`📊 Тип рейтинга турнира: ${ratingType}`);
            
            // 🔧 ИСПРАВЛЕНО: Находим участника с наивысшим рейтингом с приоритизацией ручных рейтингов
            let bestMember = null;
            let bestRating = -1;
            let bestMemberUsedManualRating = false;
            
            console.log(`📋 Анализируем ${members.rows.length} участников команды:`);
            
            for (const member of members.rows) {
                let rating = 0;
                let usedManualRating = false;
                let ratingSource = '';
                
                if (ratingType === 'faceit') {
                    // 🆕 ПРИОРИТЕТ: ручной рейтинг участника → рейтинг пользователя → резервные поля → дефолт
                    if (member.faceit_elo && !isNaN(parseInt(member.faceit_elo)) && parseInt(member.faceit_elo) > 0) {
                        rating = parseInt(member.faceit_elo);
                        usedManualRating = true;
                        ratingSource = 'ручной (участник)';
                    } else if (member.user_faceit_elo && !isNaN(parseInt(member.user_faceit_elo)) && parseInt(member.user_faceit_elo) > 0) {
                        rating = parseInt(member.user_faceit_elo);
                        ratingSource = 'профиль пользователя';
                    } else if (member.faceit_rating && !isNaN(parseInt(member.faceit_rating)) && parseInt(member.faceit_rating) > 0) {
                        rating = parseInt(member.faceit_rating);
                        ratingSource = 'резерв (участник)';
                    } else if (member.user_faceit_rating && !isNaN(parseInt(member.user_faceit_rating)) && parseInt(member.user_faceit_rating) > 0) {
                        rating = parseInt(member.user_faceit_rating);
                        ratingSource = 'резерв (пользователь)';
                    } else {
                        rating = 1000; // дефолт для FACEIT
                        ratingSource = 'дефолт FACEIT';
                    }
                } else {
                    // 🆕 ПРИОРИТЕТ: ручной рейтинг участника → рейтинг пользователя → резервные поля → дефолт
                    if (member.cs2_premier_rank && !isNaN(parseInt(member.cs2_premier_rank)) && parseInt(member.cs2_premier_rank) > 0) {
                        rating = parseInt(member.cs2_premier_rank);
                        usedManualRating = true;
                        ratingSource = 'ручной (участник)';
                    } else if (member.user_cs2_premier_rank && !isNaN(parseInt(member.user_cs2_premier_rank)) && parseInt(member.user_cs2_premier_rank) > 0) {
                        rating = parseInt(member.user_cs2_premier_rank);
                        ratingSource = 'профиль пользователя';
                    } else if (member.premier_rank && !isNaN(parseInt(member.premier_rank)) && parseInt(member.premier_rank) > 0) {
                        rating = parseInt(member.premier_rank);
                        ratingSource = 'резерв (участник)';
                    } else if (member.premier_rating && !isNaN(parseInt(member.premier_rating)) && parseInt(member.premier_rating) > 0) {
                        rating = parseInt(member.premier_rating);
                        ratingSource = 'резерв (участник 2)';
                    } else if (member.user_premier_rating && !isNaN(parseInt(member.user_premier_rating)) && parseInt(member.user_premier_rating) > 0) {
                        rating = parseInt(member.user_premier_rating);
                        ratingSource = 'резерв (пользователь)';
                    } else {
                        rating = 5; // дефолт для Premier
                        ratingSource = 'дефолт Premier';
                    }
                }
                
                console.log(`   👤 ${member.username}: рейтинг ${rating} (${ratingSource}${usedManualRating ? ', ручной ✏️' : ''})`);
                
                if (rating > bestRating) {
                    bestRating = rating;
                    bestMember = member;
                    bestMemberUsedManualRating = usedManualRating;
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
                if (bestMemberUsedManualRating) {
                    captainsWithManualRatings++;
                }
                
                // Сохраняем результат для статистики
                migrationResults.push({
                    team_id: team.team_id,
                    team_name: team.team_name,
                    tournament_name: team.tournament_name,
                    captain_username: bestMember.username,
                    captain_rating: bestRating,
                    manual_rating_used: bestMemberUsedManualRating,
                    rating_type: ratingType
                });
                
                console.log(`✅ Назначен капитан: ${bestMember.username} (рейтинг: ${bestRating}${bestMemberUsedManualRating ? ', ручной ✏️' : ''})`);
            } else {
                console.log('❌ Не удалось найти подходящего капитана');
            }
        }
        
        await client.query('COMMIT');
        
        const duration = Date.now() - startTime;
        console.log(`\n🎉 БЕЗОПАСНАЯ МИГРАЦИЯ v2.0 ЗАВЕРШЕНА за ${duration}ms:`);
        console.log(`   👑 Назначено капитанов: ${assignedCaptains}`);
        console.log(`   ✏️ Капитанов с ручными рейтингами: ${captainsWithManualRatings} (${Math.round((captainsWithManualRatings / assignedCaptains) * 100)}%)`);
        console.log(`   📊 Обработано команд: ${teamsWithoutCaptains.rows.length}`);
        console.log(`   ✅ Без триггеров и сложной логики`);
        
        // 🆕 ДЕТАЛЬНАЯ СТАТИСТИКА ПО ТУРНИРАМ
        console.log(`\n📊 ДЕТАЛЬНАЯ СТАТИСТИКА ПО ТУРНИРАМ:`);
        
        const tournamentStats = migrationResults.reduce((acc, result) => {
            const key = `${result.tournament_name} (${result.rating_type})`;
            if (!acc[key]) {
                acc[key] = {
                    total_captains: 0,
                    manual_ratings: 0,
                    teams: []
                };
            }
            acc[key].total_captains++;
            if (result.manual_rating_used) acc[key].manual_ratings++;
            acc[key].teams.push({
                team_name: result.team_name,
                captain: result.captain_username,
                rating: result.captain_rating,
                manual: result.manual_rating_used
            });
            return acc;
        }, {});
        
        Object.entries(tournamentStats).forEach(([tournamentName, stats]) => {
            console.log(`\n🏆 ${tournamentName}:`);
            console.log(`   👑 Капитанов: ${stats.total_captains}`);
            console.log(`   ✏️ С ручными рейтингами: ${stats.manual_ratings} (${Math.round((stats.manual_ratings / stats.total_captains) * 100)}%)`);
            console.log(`   📋 Команды:`);
            
            stats.teams.forEach(team => {
                console.log(`      • ${team.team_name}: ${team.captain} (${team.rating}${team.manual ? ' ✏️' : ''})`);
            });
        });
        
        console.log(`\n🎯 ИТОГОВАЯ СТАТИСТИКА ПРИОРИТИЗАЦИИ РУЧНЫХ РЕЙТИНГОВ:`);
        console.log(`   📈 Успешность миграции: ${Math.round((assignedCaptains / teamsWithoutCaptains.rows.length) * 100)}%`);
        console.log(`   ✏️ Использование ручных рейтингов: ${Math.round((captainsWithManualRatings / assignedCaptains) * 100)}%`);
        console.log(`   🎮 Это показывает эффективность системы ручного добавления участников с кастомными рейтингами!`);
        
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
            console.log('🚀 Безопасная миграция капитанов v2.0 завершена!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Критическая ошибка:', error);
            process.exit(1);
        });
}

module.exports = { migrateExistingTeamsCaptainsSafe }; 