#!/usr/bin/env node

/**
 * Скрипт для диагностики и исправления турнирной сетки Single Elimination
 * Использование: node fix_tournament_bracket.js [tournament_id] [action]
 * 
 * Actions:
 * - validate: только валидация (по умолчанию)
 * - fix: валидация + исправление
 * 
 * Примеры:
 * node fix_tournament_bracket.js 59 validate
 * node fix_tournament_bracket.js 59 fix
 */

const { 
    validateSingleEliminationBracket, 
    fixSingleEliminationBracket 
} = require('./bracketGenerators/singleElimination');

const pool = require('./db');

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
📋 Скрипт диагностики турнирной сетки Single Elimination

Использование:
  node fix_tournament_bracket.js <tournament_id> [action]

Параметры:
  tournament_id  - ID турнира для проверки
  action         - validate (валидация) или fix (исправление)

Примеры:
  node fix_tournament_bracket.js 59 validate    # Только проверка
  node fix_tournament_bracket.js 59 fix         # Проверка + исправление
        `);
        process.exit(0);
    }
    
    const tournamentId = parseInt(args[0]);
    const action = args[1] || 'validate';
    
    if (isNaN(tournamentId)) {
        console.error('❌ Ошибка: tournament_id должен быть числом');
        process.exit(1);
    }
    
    if (!['validate', 'fix'].includes(action)) {
        console.error('❌ Ошибка: action должен быть "validate" или "fix"');
        process.exit(1);
    }
    
    console.log(`🔍 Диагностика турнира ID: ${tournamentId}`);
    console.log(`📋 Действие: ${action === 'validate' ? 'Только валидация' : 'Валидация + исправление'}`);
    console.log('=' .repeat(60));
    
    try {
        // Проверяем существование турнира
        const tournamentResult = await pool.query(
            'SELECT id, name, format FROM tournaments WHERE id = $1',
            [tournamentId]
        );
        
        if (tournamentResult.rows.length === 0) {
            console.error(`❌ Турнир с ID ${tournamentId} не найден`);
            process.exit(1);
        }
        
        const tournament = tournamentResult.rows[0];
        console.log(`🏆 Турнир: "${tournament.name}"`);
        console.log(`📊 Формат: ${tournament.format}`);
        
        if (tournament.format !== 'single-elimination') {
            console.warn(`⚠️  Предупреждение: турнир имеет формат "${tournament.format}", а не "single-elimination"`);
            console.log('Продолжаем диагностику...\n');
        }
        
        // Валидация
        console.log('\n🔍 Запуск валидации...');
        const validation = await validateSingleEliminationBracket(tournamentId);
        
        console.log('\n📊 РЕЗУЛЬТАТЫ ВАЛИДАЦИИ:');
        console.log(`Статус: ${validation.valid ? '✅ Валидна' : '❌ Найдены проблемы'}`);
        console.log(`Матчей: ${validation.matchesCount}`);
        console.log(`Раундов: ${validation.roundsCount}`);
        console.log(`Проблем: ${validation.issues ? validation.issues.length : 0}`);
        
        if (!validation.valid && validation.issues) {
            console.log('\n🚨 НАЙДЕННЫЕ ПРОБЛЕМЫ:');
            validation.issues.forEach((issue, index) => {
                console.log(`  ${index + 1}. [${issue.type}] ${issue.message}`);
            });
        }
        
        // Исправление (если требуется)
        if (action === 'fix') {
            if (validation.valid) {
                console.log('\n✅ Исправление не требуется - сетка уже валидна');
            } else {
                console.log('\n🔧 Запуск исправления...');
                const fixResult = await fixSingleEliminationBracket(tournamentId);
                
                if (fixResult.success) {
                    console.log('\n📊 РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ:');
                    console.log(`Применено исправлений: ${fixResult.fixesApplied}`);
                    
                    if (fixResult.fixes && fixResult.fixes.length > 0) {
                        console.log('\n✅ ПРИМЕНЕННЫЕ ИСПРАВЛЕНИЯ:');
                        fixResult.fixes.forEach((fix, index) => {
                            console.log(`  ${index + 1}. [${fix.type}] ${fix.message}`);
                        });
                    }
                    
                    if (fixResult.stillHasIssues) {
                        console.log('\n⚠️  ОСТАЛИСЬ ПРОБЛЕМЫ:');
                        fixResult.remainingIssues.forEach((issue, index) => {
                            console.log(`  ${index + 1}. [${issue.type}] ${issue.message}`);
                        });
                        console.log('\nТребуется ручное вмешательство для решения оставшихся проблем.');
                    } else {
                        console.log('\n🎉 Все проблемы успешно исправлены!');
                    }
                } else {
                    console.error(`\n❌ Ошибка исправления: ${fixResult.error}`);
                }
            }
        }
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅ Диагностика завершена');
        
    } catch (error) {
        console.error(`\n❌ Ошибка выполнения: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Закрываем соединение с БД
        await pool.end();
    }
}

// Запускаем скрипт
main().catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
}); 