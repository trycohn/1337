// =====================================================
// 🔧 ИСПРАВЛЕННЫЙ SINGLE ELIMINATION ГЕНЕРАТОР V3.0
// Версия: 3.0 - КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ МАТЕМАТИКИ
// =====================================================

const pool = require('../db');

/**
 * 🔧 ИСПРАВЛЕННЫЙ математический калькулятор для Single Elimination турниров
 * @param {number} participantsCount - Количество участников
 * @returns {Object} - Математические параметры турнира
 */
const calculateTournamentMath = (participantsCount) => {
    if (participantsCount < 2) {
        throw new Error('Минимальное количество участников: 2');
    }

    console.log(`🧮 ИСПРАВЛЕННАЯ МАТЕМАТИКА ТУРНИРА для ${participantsCount} участников:`);
    
    // 🔧 ПРАВИЛЬНАЯ МАТЕМАТИКА SINGLE ELIMINATION:
    // В Single Elimination для N участников нужно ровно N-1 матчей
    const totalMatches = participantsCount - 1;
    
    // Находим ближайшую степень двойки БОЛЬШЕ ИЛИ РАВНУЮ количеству участников
    const nextPowerExponent = Math.ceil(Math.log2(participantsCount));
    const nextPowerOfTwo = Math.pow(2, nextPowerExponent);
    
    // Количество основных раундов = количество раундов для степени двойки
    const mainRounds = nextPowerExponent;
    
    // Количество матчей в первом основном раунде
    const firstRoundMatches = nextPowerOfTwo / 2;
    
    // Количество участников с bye (автопроходом) в первый раунд
    const byeParticipants = nextPowerOfTwo - participantsCount;
    
    // Количество участников, которые должны играть в предварительном раунде
    const preliminaryParticipants = participantsCount - byeParticipants;
    
    // Количество предварительных матчей
    const preliminaryMatches = preliminaryParticipants / 2;
    
    // Количество основных матчей = общие матчи - предварительные
    const mainMatches = totalMatches - preliminaryMatches;

    console.log(`   • Ближайшая степень двойки (вверх): 2^${nextPowerExponent} = ${nextPowerOfTwo}`);
    console.log(`   • Общих матчей в турнире: ${totalMatches}`);
    console.log(`   • Участников с автопроходом (bye): ${byeParticipants}`);
    console.log(`   • Участников в предварительном раунде: ${preliminaryParticipants}`);
    console.log(`   • Предварительных матчей: ${preliminaryMatches}`);
    console.log(`   • Основных раундов: ${mainRounds}`);
    console.log(`   • Основных матчей: ${mainMatches}`);
    console.log(`   • Матчей в первом основном раунде: ${firstRoundMatches}`);

    return {
        participantsCount,
        nextPowerOfTwo,
        nextPowerExponent,
        totalMatches,
        preliminaryMatches,
        preliminaryParticipants,
        byeParticipants,
        mainRounds,
        mainMatches,
        firstRoundMatches
    };
};

/**
 * 🔧 ПРИНУДИТЕЛЬНАЯ ОЧИСТКА СУЩЕСТВУЮЩИХ МАТЧЕЙ (ОПТИМИЗИРОВАННАЯ)
 * @param {number} tournamentId - ID турнира
 */
const clearExistingMatches = async (tournamentId) => {
    console.log(`🗑️ ПРИНУДИТЕЛЬНАЯ ОЧИСТКА существующих матчей турнира ${tournamentId}`);
    
    // 🔧 ОПТИМИЗАЦИЯ: Сначала проверяем количество матчей
    const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
        [tournamentId]
    );
    const matchCount = parseInt(countResult.rows[0].count);
    console.log(`📊 Найдено ${matchCount} существующих матчей`);
    
    if (matchCount === 0) {
        console.log(`ℹ️ Матчей для удаления нет, операция пропущена`);
        return;
    }
    
    if (matchCount > 1000) {
        // 🔧 Для больших турниров используем батченое удаление
        console.log(`⚠️ Большой турнир (${matchCount} матчей), используем батченое удаление`);
        let deletedTotal = 0;
        let batchNumber = 1;
        
        while (deletedTotal < matchCount) {
            console.log(`🗑️ Батч ${batchNumber}: удаляем до 500 матчей...`);
            const batchResult = await pool.query(`
                DELETE FROM matches 
                WHERE id IN (
                    SELECT id FROM matches 
                    WHERE tournament_id = $1 
                    LIMIT 500
                )
            `, [tournamentId]);
            
            deletedTotal += batchResult.rowCount;
            console.log(`   ✅ Батч ${batchNumber}: удалено ${batchResult.rowCount} матчей (всего: ${deletedTotal}/${matchCount})`);
            
            if (batchResult.rowCount === 0) {
                break; // Больше нечего удалять
            }
            batchNumber++;
        }
        console.log(`✅ Батченое удаление завершено: ${deletedTotal} матчей`);
    } else {
        // 🔧 Для обычных турниров используем стандартное удаление
        const deleteResult = await pool.query(
            'DELETE FROM matches WHERE tournament_id = $1',
            [tournamentId]
        );
        console.log(`✅ Стандартное удаление: ${deleteResult.rowCount} матчей`);
    }
    
    // Дополнительная проверка
    const checkResult = await pool.query(
        'SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1',
        [tournamentId]
    );
    
    const remainingMatches = parseInt(checkResult.rows[0].count);
    if (remainingMatches > 0) {
        console.warn(`⚠️ ВНИМАНИЕ: Остались ${remainingMatches} матчей после очистки!`);
        throw new Error(`Не удалось полностью очистить существующие матчи. Осталось: ${remainingMatches}`);
    }
    
    console.log(`✅ Все матчи турнира ${tournamentId} успешно удалены`);
};

/**
 * Распределитель участников по раундам (ИСПРАВЛЕННЫЙ)
 * @param {Array} participants - Массив участников
 * @param {Object} tournamentMath - Математические параметры
 * @returns {Object} - Распределенные участники
 */
const distributeParticipants = (participants, tournamentMath) => {
    // Перемешиваем участников для случайного распределения
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    
    const { preliminaryParticipants, byeParticipants } = tournamentMath;
    
    // Разделяем участников
    const preliminaryRoundParticipants = shuffled.slice(0, preliminaryParticipants);
    const byeRoundParticipants = shuffled.slice(preliminaryParticipants);
    
    console.log(`👥 РАСПРЕДЕЛЕНИЕ УЧАСТНИКОВ:`);
    console.log(`   • В предварительном раунде: ${preliminaryRoundParticipants.length}`);
    console.log(`   • С автопроходом: ${byeRoundParticipants.length}`);
    
    return {
        preliminaryRoundParticipants,
        byeRoundParticipants,
        allParticipants: shuffled
    };
};

/**
 * Генератор названий раундов
 * @param {number} round - Номер раунда
 * @param {number} totalRounds - Общее количество раундов
 * @param {boolean} isPreliminary - Предварительный раунд
 * @param {boolean} isThirdPlace - Матч за 3-е место
 * @returns {Object} - Названия раунда
 */
const generateRoundNames = (round, totalRounds, isPreliminary = false, isThirdPlace = false) => {
    if (isThirdPlace) {
        return {
            roundName: 'Матч за 3-е место',
            roundTitle: 'Матч за третье место',
            shortName: '3-е место'
        };
    }
    
    if (isPreliminary) {
        return {
            roundName: 'Предварительный раунд',
            roundTitle: 'Предварительный раунд отсева',
            shortName: 'Предв.'
        };
    }
    
    // Считаем с конца: финал = последний раунд
    const roundsFromEnd = totalRounds - round - 1;
    
    switch (roundsFromEnd) {
        case 0:
            return { roundName: 'Финал', roundTitle: 'Финальный матч', shortName: 'Ф' };
        case 1:
            return { roundName: 'Полуфинал', roundTitle: 'Полуфинальные матчи', shortName: '1/2' };
        case 2:
            return { roundName: '1/4 финала', roundTitle: 'Четвертьфинальные матчи', shortName: '1/4' };
        case 3:
            return { roundName: '1/8 финала', roundTitle: 'Матчи 1/8 финала', shortName: '1/8' };
        case 4:
            return { roundName: '1/16 финала', roundTitle: 'Матчи 1/16 финала', shortName: '1/16' };
        case 5:
            return { roundName: '1/32 финала', roundTitle: 'Матчи 1/32 финала', shortName: '1/32' };
        default:
            const fraction = Math.pow(2, roundsFromEnd + 1);
            return { 
                roundName: `1/${fraction} финала`, 
                roundTitle: `Матчи 1/${fraction} финала`,
                shortName: `1/${fraction}`
            };
    }
};

/**
 * 🔧 ИСПРАВЛЕННЫЙ генератор матчей предварительного раунда
 * @param {number} tournamentId - ID турнира
 * @param {Array} preliminaryParticipants - Участники предварительного раунда
 * @param {Object} tournamentMath - Математические параметры
 * @returns {Array} - Матчи предварительного раунда
 */
const generatePreliminaryMatches = async (tournamentId, preliminaryParticipants, tournamentMath) => {
    const matches = [];
    const { preliminaryMatches } = tournamentMath;
    
    // 🔧 ИСПРАВЛЕНИЕ: Если preliminaryMatches = 0 ИЛИ дробное число, корректируем
    const actualPreliminaryMatches = Math.floor(preliminaryMatches);
    
    if (actualPreliminaryMatches === 0) {
        console.log('🎯 Предварительный раунд не требуется');
        return matches;
    }
    
    console.log(`🥊 ГЕНЕРАЦИЯ ПРЕДВАРИТЕЛЬНОГО РАУНДА: ${actualPreliminaryMatches} матчей`);
    
    // Генерируем пары для предварительного раунда
    for (let i = 0; i < actualPreliminaryMatches; i++) {
        const team1Index = i * 2;
        const team2Index = i * 2 + 1;
        
        if (team1Index < preliminaryParticipants.length && team2Index < preliminaryParticipants.length) {
            const team1 = preliminaryParticipants[team1Index];
            const team2 = preliminaryParticipants[team2Index];
            
            // Валидация ID участников
            if (typeof team1.id !== 'number' || isNaN(team1.id)) {
                throw new Error(`TEAM1 имеет некорректный ID: ${team1.id} (${typeof team1.id})`);
            }
            if (typeof team2.id !== 'number' || isNaN(team2.id)) {
                throw new Error(`TEAM2 имеет некорректный ID: ${team2.id} (${typeof team2.id})`);
            }
            
            const roundNames = generateRoundNames(0, 0, true, false);
            
            const match = await pool.query(`
                INSERT INTO matches (
                    tournament_id, round, team1_id, team2_id, match_number,
                    bracket_type, is_preliminary_round, round_name, match_title,
                    position_in_round
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                RETURNING *
            `, [
                tournamentId, 
                -1, // Предварительный раунд = -1
                team1.id, 
                team2.id, 
                i + 1,
                'winner',
                true,
                roundNames.roundName,
                `${roundNames.roundName} - Матч ${i + 1}`,
                i + 1
            ]);
            
            matches.push(match.rows[0]);
            
            console.log(`   ✅ Матч ${i + 1}: ${team1.name} vs ${team2.name} (ID ${match.rows[0].id})`);
        }
    }
    
    console.log(`✅ Создано ${matches.length} предварительных матчей`);
    return matches;
};

/**
 * 🔧 ИСПРАВЛЕННЫЙ генератор основных раундов турнира
 * @param {number} tournamentId - ID турнира
 * @param {Array} byeParticipants - Участники с автопроходом
 * @param {Object} tournamentMath - Математические параметры
 * @param {number} preliminaryMatchesCount - Количество предварительных матчей
 * @returns {Array} - Матчи основных раундов
 */
const generateMainRounds = async (tournamentId, byeParticipants, tournamentMath, preliminaryMatchesCount) => {
    const matches = [];
    const { mainRounds, firstRoundMatches } = tournamentMath;
    let matchNumber = preliminaryMatchesCount + 1;
    
    console.log(`🏆 ГЕНЕРАЦИЯ ОСНОВНЫХ РАУНДОВ: ${mainRounds} раундов`);
    
    // Генерируем каждый раунд
    for (let round = 0; round < mainRounds; round++) {
        const matchesInRound = Math.pow(2, mainRounds - round - 1);
        const roundNames = generateRoundNames(round, mainRounds, false, false);
        
        console.log(`   🎯 Раунд ${round} (${roundNames.roundName}): ${matchesInRound} матчей`);
        
        for (let matchInRound = 0; matchInRound < matchesInRound; matchInRound++) {
            let team1Id = null;
            let team2Id = null;
            
            // В первом раунде размещаем участников с автопроходом
            if (round === 0) {
                const byeIndex1 = matchInRound * 2;
                const byeIndex2 = matchInRound * 2 + 1;
                
                if (byeIndex1 < byeParticipants.length) {
                    team1Id = byeParticipants[byeIndex1].id;
                }
                if (byeIndex2 < byeParticipants.length) {
                    team2Id = byeParticipants[byeIndex2].id;
                }
            }
            
            const match = await pool.query(`
                INSERT INTO matches (
                    tournament_id, round, team1_id, team2_id, match_number,
                    bracket_type, is_preliminary_round, round_name, match_title,
                    position_in_round
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                RETURNING *
            `, [
                tournamentId,
                round,
                team1Id,
                team2Id,
                matchNumber++,
                'winner',
                false,
                roundNames.roundName,
                `${roundNames.roundName} - Матч ${matchInRound + 1}`,
                matchInRound + 1
            ]);
            
            matches.push(match.rows[0]);
            
            const team1Name = byeParticipants.find(p => p.id === team1Id)?.name || 'TBD';
            const team2Name = byeParticipants.find(p => p.id === team2Id)?.name || 'TBD';
            
            console.log(`     ✅ Матч ${matchInRound + 1}: ${team1Name} vs ${team2Name}`);
        }
    }
    
    console.log(`✅ Создано ${matches.length} основных матчей`);
    return matches;
};

/**
 * Генератор матча за 3-е место
 * @param {number} tournamentId - ID турнира
 * @param {Object} tournamentMath - Математические параметры
 * @param {number} currentMatchNumber - Текущий номер матча
 * @returns {Object|null} - Матч за 3-е место или null
 */
const generateThirdPlaceMatch = async (tournamentId, tournamentMath, currentMatchNumber) => {
    const { mainRounds } = tournamentMath;
    
    if (mainRounds < 2) {
        console.log('🚫 Матч за 3-е место невозможен (недостаточно раундов)');
        return null;
    }
    
    console.log('🥉 ГЕНЕРАЦИЯ МАТЧА ЗА 3-Е МЕСТО');
    
    const roundNames = generateRoundNames(0, 0, false, true);
    const finalRound = mainRounds - 1;
    
    const match = await pool.query(`
        INSERT INTO matches (
            tournament_id, round, team1_id, team2_id, match_number,
            bracket_type, is_third_place_match, round_name, match_title,
            position_in_round
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *
    `, [
        tournamentId,
        finalRound, // Тот же раунд что и финал
        null, // Участники определятся после полуфинала
        null,
        currentMatchNumber,
        'placement',
        true,
        roundNames.roundName,
        roundNames.roundTitle,
        999 // Высокая позиция для сортировки в конце
    ]);
    
    console.log(`   ✅ Создан матч за 3-е место (ID: ${match.rows[0].id})`);
    
    return match.rows[0];
};

/**
 * Связывание матчей в турнирное дерево
 * @param {Array} allMatches - Все матчи турнира
 * @param {Object} tournamentMath - Математические параметры
 * @param {Object} thirdPlaceMatch - Матч за 3-е место
 */
const linkMatches = async (allMatches, tournamentMath, thirdPlaceMatch = null) => {
    console.log('🔗 СВЯЗЫВАНИЕ МАТЧЕЙ В ТУРНИРНОЕ ДЕРЕВО');
    
    const preliminaryMatches = allMatches.filter(m => m.is_preliminary_round);
    const mainMatches = allMatches.filter(m => !m.is_preliminary_round && !m.is_third_place_match);
    const { mainRounds } = tournamentMath;
    
    // 1. Связываем предварительные матчи с первым основным раундом
    if (preliminaryMatches.length > 0) {
        const firstRoundMatches = mainMatches.filter(m => m.round === 0);
        
        console.log(`🔗 ИСПРАВЛЕНИЕ: Связываем ${preliminaryMatches.length} предварительных матчей с ${firstRoundMatches.length} основными`);
        
        // 🔧 ИСПРАВЛЕНИЕ: Правильно распределяем предварительные матчи
        for (let i = 0; i < preliminaryMatches.length; i++) {
            const prelimMatch = preliminaryMatches[i];
            
            // Каждый предварительный матч связывается с определенным основным матчем
            // Первый предварительный → первый основной матч (где team1_id или team2_id пустые)
            // Второй предварительный → первый основной матч (в оставшийся слот)
            // Третий предварительный → второй основной матч, и т.д.
            
            const targetMatchIndex = Math.floor(i / 2); // Каждые 2 предварительных → 1 основной
            
            if (targetMatchIndex < firstRoundMatches.length) {
                const targetMainMatch = firstRoundMatches[targetMatchIndex];
                
                await pool.query(
                    'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                    [targetMainMatch.id, prelimMatch.id]
                );
                
                console.log(`   🔗 Предварительный матч ${prelimMatch.id} → Основной матч ${targetMainMatch.id} (слот ${i % 2 + 1})`);
            }
        }
    }
    
    // 2. Связываем основные раунды между собой
    for (let round = 0; round < mainRounds - 1; round++) {
        const currentRoundMatches = mainMatches.filter(m => m.round === round);
        const nextRoundMatches = mainMatches.filter(m => m.round === round + 1);
        
        for (let i = 0; i < currentRoundMatches.length; i++) {
            const currentMatch = currentRoundMatches[i];
            const nextMatchIndex = Math.floor(i / 2);
            
            if (nextMatchIndex < nextRoundMatches.length) {
                const nextMatch = nextRoundMatches[nextMatchIndex];
                
                await pool.query(
                    'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                    [nextMatch.id, currentMatch.id]
                );
                
                console.log(`   🔗 Раунд ${round} матч ${currentMatch.id} → Раунд ${round + 1} матч ${nextMatch.id}`);
            }
        }
    }
    
    // 3. Связываем проигравших полуфинала с матчем за 3-е место
    if (thirdPlaceMatch && mainRounds >= 2) {
        const semifinalRound = mainRounds - 2;
        const semifinalMatches = mainMatches.filter(m => m.round === semifinalRound);
        
        for (const semifinalMatch of semifinalMatches) {
            await pool.query(
                'UPDATE matches SET loser_next_match_id = $1 WHERE id = $2',
                [thirdPlaceMatch.id, semifinalMatch.id]
            );
            
            console.log(`   🥉 Полуфинал ${semifinalMatch.id} (проигравший) → Матч за 3-е место ${thirdPlaceMatch.id}`);
        }
    }
    
    console.log('✅ Связывание матчей завершено');
};

/**
 * 🔧 ИСПРАВЛЕННАЯ валидация сгенерированной сетки
 * @param {number} tournamentId - ID турнира
 * @param {Object} tournamentMath - Математические параметры
 * @returns {Object} - Результат валидации
 */
const validateGeneratedBracket = async (tournamentId, tournamentMath) => {
    console.log('🔍 ВАЛИДАЦИЯ СГЕНЕРИРОВАННОЙ СЕТКИ');
    
    // Получаем все матчи турнира
    const matchesResult = await pool.query(
        'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, position_in_round',
        [tournamentId]
    );
    
    const matches = matchesResult.rows;
    const preliminaryMatches = matches.filter(m => m.is_preliminary_round);
    const mainMatches = matches.filter(m => !m.is_preliminary_round && !m.is_third_place_match);
    const thirdPlaceMatches = matches.filter(m => m.is_third_place_match);
    
    const { 
        preliminaryMatches: expectedPreliminaryFloat,
        mainMatches: expectedMain,
        totalMatches: expectedTotal
    } = tournamentMath;
    
    // 🔧 ИСПРАВЛЕНИЕ: Для предварительных матчей используем Math.floor
    const expectedPreliminary = Math.floor(expectedPreliminaryFloat);
    
    const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        stats: {
            totalMatches: matches.length,
            preliminaryMatches: preliminaryMatches.length,
            mainMatches: mainMatches.length,
            thirdPlaceMatches: thirdPlaceMatches.length
        }
    };
    
    // Проверяем количество матчей
    if (preliminaryMatches.length !== expectedPreliminary) {
        validation.errors.push(`Неверное количество предварительных матчей: ${preliminaryMatches.length}, ожидалось: ${expectedPreliminary}`);
        validation.isValid = false;
    }
    
    if (mainMatches.length !== expectedMain) {
        validation.errors.push(`Неверное количество основных матчей: ${mainMatches.length}, ожидалось: ${expectedMain}`);
        validation.isValid = false;
    }
    
    // Проверяем связи между матчами
    for (const match of matches) {
        if (match.next_match_id) {
            const nextMatch = matches.find(m => m.id === match.next_match_id);
            if (!nextMatch) {
                validation.errors.push(`Матч ${match.id} ссылается на несуществующий следующий матч ${match.next_match_id}`);
                validation.isValid = false;
            }
        }
    }
    
    console.log(`   📊 Статистика: ${validation.stats.totalMatches} матчей (${validation.stats.preliminaryMatches} предв. + ${validation.stats.mainMatches} основных + ${validation.stats.thirdPlaceMatches} за 3-е место)`);
    
    if (validation.isValid) {
        console.log('✅ Валидация успешна - сетка корректна');
    } else {
        console.log('❌ Валидация не пройдена:');
        validation.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    return validation;
};

/**
 * 🔧 ИСПРАВЛЕННАЯ ГЛАВНАЯ ФУНКЦИЯ - Генерация турнирной сетки Single Elimination
 * @param {number} tournamentId - ID турнира
 * @param {Array} participants - Массив участников [{ id, name }]
 * @param {boolean} thirdPlaceMatch - Нужен ли матч за 3-е место
 * @returns {Array} - Список сгенерированных матчей
 */
const generateSingleEliminationBracket = async (tournamentId, participants, thirdPlaceMatch = false) => {
    console.log('🚀 ЗАПУСК ИСПРАВЛЕННОГО ГЕНЕРАТОРА SINGLE ELIMINATION V3.0');
    console.log('='.repeat(60));
    
    // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА ВХОДЯЩИХ ДАННЫХ
    console.log(`🔍 ДИАГНОСТИКА ВХОДЯЩИХ ДАННЫХ:`);
    console.log(`   - Tournament ID: ${tournamentId} (тип: ${typeof tournamentId})`);
    console.log(`   - Количество участников: ${participants.length}`);
    console.log(`   - Матч за 3-е место: ${thirdPlaceMatch}`);
    
    // Общая проверка всех участников
    const invalidParticipants = participants.filter(p => typeof p.id !== 'number' || isNaN(p.id));
    if (invalidParticipants.length > 0) {
        console.log(`❌ НАЙДЕНО ${invalidParticipants.length} УЧАСТНИКОВ С НЕКОРРЕКТНЫМИ ID:`);
        invalidParticipants.forEach((p, index) => {
            console.log(`   ${index + 1}. ID: ${p.id} (${typeof p.id}), Name: ${p.name}`);
        });
        throw new Error(`БЛОКИРОВКА ГЕНЕРАЦИИ: ${invalidParticipants.length} участников имеют некорректные ID. Требуются числовые значения.`);
    }
    
    console.log(`✅ ВСЕ ${participants.length} УЧАСТНИКОВ ПРОШЛИ ВАЛИДАЦИЮ ID`);
    
    try {
        // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Принудительно очищаем существующие матчи
        await clearExistingMatches(tournamentId);
        
        // 1. Математические расчеты
        const tournamentMath = calculateTournamentMath(participants.length);
        
        // 2. Распределение участников
        const distribution = distributeParticipants(participants, tournamentMath);
        
        // 3. Генерация предварительных матчей
        const preliminaryMatches = await generatePreliminaryMatches(
            tournamentId,
            distribution.preliminaryRoundParticipants,
            tournamentMath
        );
        
        // 4. Генерация основных раундов
        const mainMatches = await generateMainRounds(
            tournamentId,
            distribution.byeRoundParticipants,
            tournamentMath,
            preliminaryMatches.length
        );
        
        // 5. Генерация матча за 3-е место (если нужен)
        let thirdPlaceMatchObj = null;
        if (thirdPlaceMatch) {
            thirdPlaceMatchObj = await generateThirdPlaceMatch(
                tournamentId,
                tournamentMath,
                preliminaryMatches.length + mainMatches.length + 1
            );
        }
        
        // 6. Объединяем все матчи
        const allMatches = [
            ...preliminaryMatches,
            ...mainMatches,
            ...(thirdPlaceMatchObj ? [thirdPlaceMatchObj] : [])
        ];
        
        // 7. Связываем матчи в турнирное дерево
        await linkMatches(allMatches, tournamentMath, thirdPlaceMatchObj);
        
        // 8. Валидация результата
        const validation = await validateGeneratedBracket(tournamentId, tournamentMath);
        
        if (!validation.isValid) {
            throw new Error(`Валидация не пройдена: ${validation.errors.join(', ')}`);
        }
        
        console.log('='.repeat(60));
        console.log('🎉 ГЕНЕРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!');
        console.log(`   📊 Создано матчей: ${allMatches.length}`);
        console.log(`   🥊 Предварительных: ${preliminaryMatches.length}`);
        console.log(`   🏆 Основных: ${mainMatches.length}`);
        console.log(`   🥉 За 3-е место: ${thirdPlaceMatchObj ? 1 : 0}`);
        
        return allMatches;
        
    } catch (error) {
        console.error('❌ ОШИБКА ГЕНЕРАЦИИ:', error.message);
        console.error('❌ Stack trace:', error.stack);
        throw error;
    }
};

module.exports = {
    generateSingleEliminationBracket,
    calculateTournamentMath,
    distributeParticipants,
    generateRoundNames,
    validateGeneratedBracket,
    clearExistingMatches
}; 