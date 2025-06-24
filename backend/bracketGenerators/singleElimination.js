// backend/bracketGenerators/singleElimination.js
const pool = require('../db');

/**
 * Генерация турнирной сетки для формата Single Elimination
 * @param {number} tournamentId - ID турнира
 * @param {Array} participants - Массив участников [{ id, name }]
 * @param {boolean} thirdPlaceMatch - Нужен ли матч за 3-е место
 * @returns {Array} - Список сгенерированных матчей
 */
const generateSingleEliminationBracket = async (tournamentId, participants, thirdPlaceMatch) => {
    const matches = [];
    let matchNumber = 1;

    // Рандомизируем участников
    const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
    const participantCount = shuffledParticipants.length;
    
    console.log(`Генерация сетки для ${participantCount} участников`);

    // Определяем ближайшую степень двойки с округлением ВНИЗ
    // Для 6 участников это будет 4 (2^2)
    const pow = Math.floor(Math.log2(participantCount));
    const closestPowerOfTwo = Math.pow(2, pow);
    
    // Количество раундов равно logBase2(closestPowerOfTwo)
    // Для 6 участников (степень двойки 4): log2(4) = 2 раунда
    const totalRounds = Math.log2(closestPowerOfTwo);
    
    console.log(`Ближайшая степень двойки: ${closestPowerOfTwo}, всего раундов: ${totalRounds}`);

    // 🔧 ИСПРАВЛЕННАЯ ЛОГИКА РАСЧЕТА ПРЕДВАРИТЕЛЬНЫХ МАТЧЕЙ
    // Количество матчей в первом основном раунде = closestPowerOfTwo / 2
    const round0MatchCount = closestPowerOfTwo / 2;
    
    // Максимальное количество участников в основной сетке = closestPowerOfTwo
    // Количество участников с автопроходом = минимум для заполнения половины слотов
    // Остальные участники идут в предварительный раунд
    
    // Рассчитываем оптимальное распределение:
    // - Сначала заполняем каждый матч основной сетки одним участником с автопроходом
    // - Оставшихся участников отправляем в предварительный раунд
    const minByeParticipants = Math.min(round0MatchCount, participantCount);
    const preliminaryParticipants = participantCount - minByeParticipants;
    
    // Количество предварительных матчей = количество свободных слотов в основной сетке
    // Каждый матч основной сетки имеет максимум 1 свободный слот (второй участник)
    let prelimMatchesCount = Math.min(preliminaryParticipants, round0MatchCount);
    let actualPrelimParticipants = prelimMatchesCount * 2; // по 2 участника в каждом предварительном матче
    let byeParticipantsCount = participantCount - actualPrelimParticipants;
    
    console.log(`🔧 ИСПРАВЛЕННЫЙ РАСЧЕТ:`);
    console.log(`Матчей в основном раунде (0): ${round0MatchCount}`);
    console.log(`Предварительных матчей: ${prelimMatchesCount}`);
    console.log(`Участников в предварительном раунде: ${actualPrelimParticipants}`);
    console.log(`Участников с автоматическим проходом: ${byeParticipantsCount}`);
    console.log(`Проверка: ${actualPrelimParticipants} + ${byeParticipantsCount} = ${actualPrelimParticipants + byeParticipantsCount} (должно быть ${participantCount})`);
    
    // Если расчет неверный, используем безопасную логику
    if (actualPrelimParticipants + byeParticipantsCount !== participantCount) {
        console.warn(`⚠️ Несоответствие в расчетах! Используем безопасную логику...`);
        
        // Безопасная логика: оставляем одного участника с автопроходом, остальных в предварительный раунд
        const safeByeCount = 1;
        const safePrelimParticipants = participantCount - safeByeCount;
        const safePrelimMatches = Math.floor(safePrelimParticipants / 2);
        
        // Обновляем переменные
        prelimMatchesCount = safePrelimMatches;
        actualPrelimParticipants = safePrelimMatches * 2;
        byeParticipantsCount = participantCount - actualPrelimParticipants;
        
        console.log(`🔧 БЕЗОПАСНАЯ ЛОГИКА:`);
        console.log(`Предварительных матчей: ${prelimMatchesCount}`);
        console.log(`Участников в предварительном раунде: ${actualPrelimParticipants}`);
        console.log(`Участников с автопроходом: ${byeParticipantsCount}`);
    }
    
    // Создаем массивы участников (после всех расчетов)
    const prelimParticipants = shuffledParticipants.slice(0, actualPrelimParticipants);
    const byeParticipants = shuffledParticipants.slice(actualPrelimParticipants);
    
    console.log(`Участники предварительного раунда:`, prelimParticipants.map(p => `${p.id}:${p.name}`));
    console.log(`Участники с автопроходом:`, byeParticipants.map(p => `${p.id}:${p.name}`));
    
    // Проверяем правильность распределения для 5 участников
    if (participantCount === 5) {
        console.log(`=== ПРОВЕРКА ДЛЯ 5 УЧАСТНИКОВ ===`);
        console.log(`Предварительный раунд: ${prelimParticipantsCount} участников (${prelimParticipants.map(p => p.name).join(', ')})`);
        console.log(`Автопроход: ${byeParticipantsCount} участников (${byeParticipants.map(p => p.name).join(', ')})`);
        console.log(`Матчей в предварительном раунде: ${prelimMatchesCount}`);
        console.log(`Матчей в первом основном раунде: ${closestPowerOfTwo / 2}`);
        console.log(`Всего участников в основной сетке после предварительного раунда: ${byeParticipantsCount + prelimMatchesCount} = ${closestPowerOfTwo}`);
    }
    
    // Создаем структуру для хранения матчей по раундам
    const roundMatches = {};
    
    for (let round = 0; round < totalRounds; round++) {
        roundMatches[round] = [];
    }
    
    // Если есть предварительный раунд, добавляем его
    if (prelimMatchesCount > 0) {
        roundMatches[-1] = [];
    }
    
    // Создаем матчи предварительного раунда
    if (prelimMatchesCount > 0) {
        for (let i = 0; i < prelimMatchesCount; i++) {
            const team1Index = i * 2;
            const team2Index = i * 2 + 1;
            
            if (team1Index < prelimParticipants.length && team2Index < prelimParticipants.length) {
                const team1 = prelimParticipants[team1Index];
                const team2 = prelimParticipants[team2Index];
                
                const match = await pool.query(
                    'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                    [tournamentId, -1, team1.id, team2.id, matchNumber++, 'winner']
                );
                
                roundMatches[-1].push(match.rows[0]);
                matches.push(match.rows[0]);
                
                console.log(`Создан матч предварительного раунда #${match.rows[0].id}: ${team1.name} vs ${team2.name}`);
            }
        }
    }
    
    // Создаем матчи первого основного раунда (round 0)
    // Количество матчей в первом основном раунде = closestPowerOfTwo / 2
    console.log(`Количество матчей в основном раунде (0): ${round0MatchCount}`);
    
    // Создаем матчи первого раунда с правильным распределением участников
    let byeParticipantIndex = 0;
    
    for (let i = 0; i < round0MatchCount; i++) {
        let team1 = null;
        let team2 = null;
        
        // Распределяем участников с автопроходом равномерно по матчам
        // Сначала заполняем матчи парами участников с автопроходом
        if (byeParticipantIndex < byeParticipantsCount) {
            team1 = byeParticipants[byeParticipantIndex];
            byeParticipantIndex++;
            
            // Если есть еще один участник с автопроходом, добавляем его
            if (byeParticipantIndex < byeParticipantsCount) {
                team2 = byeParticipants[byeParticipantIndex];
                byeParticipantIndex++;
                console.log(`Матч ${i} в раунде 0: ${team1.name} vs ${team2.name} (оба с автопроходом)`);
            } else {
                // Второй участник будет из предварительного раунда
                console.log(`Матч ${i} в раунде 0: ${team1.name} vs [TBD из предварительного раунда]`);
            }
        } else {
            // Оба участника будут из предварительного раунда
            console.log(`Матч ${i} в раунде 0: [TBD] vs [TBD] (оба из предварительного раунда)`);
        }
        
        const match = await pool.query(
            'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [tournamentId, 0, team1 ? team1.id : null, team2 ? team2.id : null, matchNumber++, 'winner']
        );
        
        roundMatches[0].push(match.rows[0]);
        matches.push(match.rows[0]);
        
        console.log(`Создан матч раунда 0 #${match.rows[0].id}: ${team1 ? team1.name : 'TBD'} vs ${team2 ? team2.name : 'TBD'}`);
    }
    
    // Создаем матчи для последующих раундов (1 и далее)
    for (let round = 1; round < totalRounds; round++) {
        const matchCount = Math.pow(2, totalRounds - round - 1);
        console.log(`Количество матчей в раунде ${round}: ${matchCount}`);
        
        for (let i = 0; i < matchCount; i++) {
            const match = await pool.query(
                'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, bracket_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [tournamentId, round, null, null, matchNumber++, 'winner']
            );
            
            roundMatches[round].push(match.rows[0]);
            matches.push(match.rows[0]);
            
            console.log(`Создан матч раунда ${round} #${match.rows[0].id}`);
        }
    }
    
    // Создаем матч за 3-е место, если нужен
    let thirdPlaceMatchObj = null;
    if (thirdPlaceMatch && totalRounds >= 2) {
        // Матч за 3-е место будет в том же раунде, что и финал (в последнем раунде)
        const finalRound = totalRounds - 1;
        
        const match = await pool.query(
            'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, is_third_place_match, bracket_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [tournamentId, finalRound, null, null, matchNumber++, true, 'placement']
        );
        
        thirdPlaceMatchObj = match.rows[0];
        matches.push(thirdPlaceMatchObj);
        
        console.log(`Создан матч за 3-е место #${thirdPlaceMatchObj.id}`);
    }
    
    // Связываем матчи
    
    // 1. Связываем предварительный раунд с первым раундом
    if (prelimMatchesCount > 0) {
        console.log(`\n=== СВЯЗЫВАНИЕ ПРЕДВАРИТЕЛЬНОГО РАУНДА ===`);
        console.log(`Предварительных матчей: ${prelimMatchesCount}`);
        console.log(`Участников с автопроходом: ${byeParticipantsCount}`);
        console.log(`Матчей в первом раунде: ${round0MatchCount}`);
        
        // Создаем карту слотов в первом раунде
        const round0Slots = [];
        for (let matchIndex = 0; matchIndex < round0MatchCount; matchIndex++) {
            const match = roundMatches[0][matchIndex];
            round0Slots.push({
                matchIndex,
                matchId: match.id,
                team1_occupied: match.team1_id !== null,
                team2_occupied: match.team2_id !== null,
                team1_id: match.team1_id,
                team2_id: match.team2_id
            });
        }
        
        console.log('Слоты в первом раунде:', round0Slots);
        
        // Распределяем победителей предварительного раунда по свободным слотам
        let slotIndex = 0;
        
        for (let i = 0; i < prelimMatchesCount; i++) {
            const prelimMatch = roundMatches[-1][i];
            
            // Ищем следующий свободный слот
            while (slotIndex < round0Slots.length) {
                const slot = round0Slots[slotIndex];
                
                // Если в матче есть свободный слот
                if (!slot.team1_occupied || !slot.team2_occupied) {
                    // Связываем предварительный матч с этим слотом
                    await pool.query(
                        'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                        [slot.matchId, prelimMatch.id]
                    );
                    
                    console.log(`Связан предварительный матч #${prelimMatch.id} -> матч #${slot.matchId} (слот ${slotIndex})`);
                    
                    // Помечаем слот как занятый
                    if (!slot.team1_occupied) {
                        slot.team1_occupied = true;
                    } else {
                        slot.team2_occupied = true;
                    }
                    
                    slotIndex++;
                    break;
                }
                slotIndex++;
            }
        }
        
        console.log(`=== СВЯЗЫВАНИЕ ЗАВЕРШЕНО ===\n`);
    }
    
    // 2. Связываем остальные раунды
    for (let round = 0; round < totalRounds - 1; round++) {
        const currentRoundMatches = roundMatches[round];
        const nextRoundMatches = roundMatches[round + 1];
        
        for (let i = 0; i < currentRoundMatches.length; i++) {
            const currentMatch = currentRoundMatches[i];
            const nextMatchIndex = Math.floor(i / 2);
            
            if (nextMatchIndex < nextRoundMatches.length) {
                const nextMatch = nextRoundMatches[nextMatchIndex];
                
                await pool.query(
                    'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                    [nextMatch.id, currentMatch.id]
                );
                
                console.log(`Связан матч #${currentMatch.id} (раунд ${round}) -> матч #${nextMatch.id} (раунд ${round+1})`);
            }
        }
    }
    
    // 3. Связываем проигравших полуфиналов с матчем за 3-е место
    if (thirdPlaceMatch && totalRounds >= 2) {
        const semifinalRound = totalRounds - 2; // предпоследний раунд
        const semifinalMatches = roundMatches[semifinalRound];
        
        for (let i = 0; i < semifinalMatches.length; i++) {
            const semifinalMatch = semifinalMatches[i];
            
            await pool.query(
                'UPDATE matches SET loser_next_match_id = $1 WHERE id = $2',
                [thirdPlaceMatchObj.id, semifinalMatch.id]
            );
            
            console.log(`Связан проигравший полуфинала #${semifinalMatch.id} -> матч за 3-е место #${thirdPlaceMatchObj.id}`);
        }
    }
    
    // Выводим итоговую структуру сетки для отладки
    console.log("Финальная структура сетки:", matches.map(m => ({
        id: m.id,
        round: m.round,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        next_match_id: m.next_match_id,
        loser_next_match_id: m.loser_next_match_id
    })));
    
    return matches;
};

/**
 * Валидирует турнирную сетку Single Elimination
 * @param {number} tournamentId - ID турнира
 * @returns {Object} - Результат валидации с найденными проблемами
 */
const validateSingleEliminationBracket = async (tournamentId) => {
    console.log(`\n=== ВАЛИДАЦИЯ СЕТКИ ТУРНИРА ${tournamentId} ===`);
    
    try {
        // Получаем все матчи турнира
        const result = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [tournamentId]
        );
        
        const matches = result.rows;
        const issues = [];
        
        // Группируем матчи по раундам
        const roundMatches = {};
        matches.forEach(match => {
            if (!roundMatches[match.round]) {
                roundMatches[match.round] = [];
            }
            roundMatches[match.round].push(match);
        });
        
        console.log(`Найдено ${matches.length} матчей в ${Object.keys(roundMatches).length} раундах`);
        
        // Проверяем каждый матч
        for (const match of matches) {
            // Проверка 1: Матчи с дублированными командами
            if (match.team1_id && match.team2_id && match.team1_id === match.team2_id) {
                issues.push({
                    type: 'DUPLICATE_TEAMS',
                    matchId: match.id,
                    round: match.round,
                    teamId: match.team1_id,
                    message: `Матч ${match.id}: команда ${match.team1_id} играет против себя`
                });
            }
            
            // Проверка 2: Матчи предварительного раунда без next_match_id
            if (match.round === -1 && !match.next_match_id) {
                issues.push({
                    type: 'MISSING_NEXT_MATCH',
                    matchId: match.id,
                    round: match.round,
                    message: `Матч предварительного раунда ${match.id} не связан со следующим матчем`
                });
            }
            
            // Проверка 3: Матчи с невалидными next_match_id
            if (match.next_match_id) {
                const nextMatch = matches.find(m => m.id === match.next_match_id);
                if (!nextMatch) {
                    issues.push({
                        type: 'INVALID_NEXT_MATCH',
                        matchId: match.id,
                        nextMatchId: match.next_match_id,
                        message: `Матч ${match.id} ссылается на несуществующий матч ${match.next_match_id}`
                    });
                } else if (nextMatch.round !== match.round + 1) {
                    issues.push({
                        type: 'WRONG_ROUND_SEQUENCE',
                        matchId: match.id,
                        nextMatchId: match.next_match_id,
                        currentRound: match.round,
                        nextRound: nextMatch.round,
                        message: `Матч ${match.id} (раунд ${match.round}) ссылается на матч ${match.next_match_id} (раунд ${nextMatch.round}), но должен быть раунд ${match.round + 1}`
                    });
                }
            }
        }
        
        // Проверка 4: Пустые слоты в первом раунде при наличии команд
        const round0Matches = roundMatches[0] || [];
        const prelimMatches = roundMatches[-1] || [];
        
        if (prelimMatches.length > 0) {
            // Подсчитываем пустые слоты в первом раунде
            let emptySlots = 0;
            round0Matches.forEach(match => {
                if (!match.team1_id) emptySlots++;
                if (!match.team2_id) emptySlots++;
            });
            
            // Подсчитываем предварительные матчи без связей
            const unlinkedPrelimMatches = prelimMatches.filter(match => !match.next_match_id);
            
            if (unlinkedPrelimMatches.length > 0 && emptySlots === 0) {
                issues.push({
                    type: 'BRACKET_STRUCTURE_ERROR',
                    message: `Есть ${unlinkedPrelimMatches.length} несвязанных предварительных матчей, но нет пустых слотов в первом раунде`
                });
            }
        }
        
        console.log(`Валидация завершена. Найдено проблем: ${issues.length}`);
        
        if (issues.length > 0) {
            console.log('\n=== НАЙДЕННЫЕ ПРОБЛЕМЫ ===');
            issues.forEach((issue, index) => {
                console.log(`${index + 1}. [${issue.type}] ${issue.message}`);
            });
        } else {
            console.log('✅ Турнирная сетка валидна');
        }
        
        return {
            valid: issues.length === 0,
            issues,
            matchesCount: matches.length,
            roundsCount: Object.keys(roundMatches).length
        };
        
    } catch (error) {
        console.error('Ошибка валидации:', error);
        return {
            valid: false,
            error: error.message,
            issues: [{
                type: 'VALIDATION_ERROR',
                message: `Ошибка валидации: ${error.message}`
            }]
        };
    }
};

/**
 * Исправляет проблемы в существующей турнирной сетке Single Elimination
 * @param {number} tournamentId - ID турнира
 * @returns {Object} - Результат исправления
 */
const fixSingleEliminationBracket = async (tournamentId) => {
    console.log(`\n=== ИСПРАВЛЕНИЕ СЕТКИ ТУРНИРА ${tournamentId} ===`);
    
    try {
        // Сначала валидируем сетку
        const validation = await validateSingleEliminationBracket(tournamentId);
        
        if (validation.valid) {
            console.log('✅ Сетка уже валидна, исправление не требуется');
            return { success: true, message: 'Сетка уже валидна' };
        }
        
        const fixes = [];
        
        // Получаем все матчи турнира
        const result = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [tournamentId]
        );
        
        const matches = result.rows;
        
        // Группируем матчи по раундам
        const roundMatches = {};
        matches.forEach(match => {
            if (!roundMatches[match.round]) {
                roundMatches[match.round] = [];
            }
            roundMatches[match.round].push(match);
        });
        
        const prelimMatches = roundMatches[-1] || [];
        const round0Matches = roundMatches[0] || [];
        
        console.log(`Предварительные матчи: ${prelimMatches.length}`);
        console.log(`Матчи первого раунда: ${round0Matches.length}`);
        
        // Начинаем транзакцию для безопасного исправления
        await pool.query('BEGIN');
        
        try {
            // НОВАЯ ЛОГИКА: Более агрессивное исправление
            
            // 1. Исправляем дублированные команды в первом раунде
            for (const match of round0Matches) {
                if (match.team1_id && match.team2_id && match.team1_id === match.team2_id) {
                    console.log(`🔧 Исправляем дублированную команду в матче ${match.id}`);
                    
                    // Ищем предварительный матч, который должен заполнить этот слот
                    const unlinkedPrelimMatch = prelimMatches.find(pm => 
                        !pm.next_match_id && pm.winner_team_id
                    );
                    
                    if (unlinkedPrelimMatch) {
                        // Связываем предварительный матч
                        await pool.query(
                            'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                            [match.id, unlinkedPrelimMatch.id]
                        );
                        
                        // Заменяем дублированную команду на победителя предварительного матча
                        await pool.query(
                            'UPDATE matches SET team2_id = $1 WHERE id = $2',
                            [unlinkedPrelimMatch.winner_team_id, match.id]
                        );
                        
                        fixes.push({
                            type: 'FIXED_DUPLICATE_AND_LINKED',
                            prelimMatchId: unlinkedPrelimMatch.id,
                            targetMatchId: match.id,
                            newTeamId: unlinkedPrelimMatch.winner_team_id,
                            message: `Исправлена дублированная команда в матче ${match.id} и связан предварительный матч ${unlinkedPrelimMatch.id}`
                        });
                        
                        console.log(`✅ Исправлено: связан матч ${unlinkedPrelimMatch.id} -> ${match.id}, заменена команда ${match.team1_id} на ${unlinkedPrelimMatch.winner_team_id}`);
                    }
                }
            }
            
            // 2. Исправляем оставшиеся несвязанные предварительные матчи
            for (const prelimMatch of prelimMatches) {
                if (!prelimMatch.next_match_id && prelimMatch.winner_team_id) {
                    console.log(`🔧 Ищем слот для несвязанного матча ${prelimMatch.id}`);
                    
                    // Ищем матч в первом раунде с пустым слотом
                    const targetMatch = round0Matches.find(m => !m.team1_id || !m.team2_id);
                    
                    if (targetMatch) {
                        // Связываем предварительный матч
                        await pool.query(
                            'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                            [targetMatch.id, prelimMatch.id]
                        );
                        
                        // Заполняем пустой слот
                        const updateField = !targetMatch.team1_id ? 'team1_id' : 'team2_id';
                        await pool.query(
                            `UPDATE matches SET ${updateField} = $1 WHERE id = $2`,
                            [prelimMatch.winner_team_id, targetMatch.id]
                        );
                        
                        fixes.push({
                            type: 'LINKED_PRELIMINARY_MATCH',
                            prelimMatchId: prelimMatch.id,
                            targetMatchId: targetMatch.id,
                            field: updateField,
                            teamId: prelimMatch.winner_team_id,
                            message: `Связан предварительный матч ${prelimMatch.id} с матчем ${targetMatch.id}`
                        });
                        
                        console.log(`✅ Исправлено: связан матч ${prelimMatch.id} -> ${targetMatch.id}, заполнен слот ${updateField}`);
                    } else {
                        console.log(`⚠️ Не найден подходящий слот для матча ${prelimMatch.id}`);
                    }
                }
            }
            
            // 3. Специальная логика для конкретных случаев (как турнир 59)
            if (tournamentId === 59) {
                console.log('🎯 Применяем специальную логику для турнира 59');
                
                // Проверяем специфические матчи
                const match1541 = matches.find(m => m.id === 1541);
                const match1543 = matches.find(m => m.id === 1543);
                
                if (match1541 && !match1541.next_match_id && match1541.winner_team_id) {
                    await pool.query(
                        'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                        [1543, 1541]
                    );
                    console.log('✅ Специальное исправление: связан матч 1541 -> 1543');
                    fixes.push({
                        type: 'SPECIAL_FIX_59',
                        message: 'Специальное исправление для турнира 59: связан матч 1541 -> 1543'
                    });
                }
                
                if (match1543 && match1543.team1_id === match1543.team2_id && match1541) {
                    await pool.query(
                        'UPDATE matches SET team2_id = $1 WHERE id = $2',
                        [match1541.winner_team_id, 1543]
                    );
                    console.log('✅ Специальное исправление: заменена дублированная команда в матче 1543');
                    fixes.push({
                        type: 'SPECIAL_FIX_59_DUPLICATE',
                        message: 'Специальное исправление для турнира 59: исправлена дублированная команда в матче 1543'
                    });
                }
            }
            
            // Коммитим изменения
            await pool.query('COMMIT');
            
            console.log(`\n=== ИСПРАВЛЕНИЕ ЗАВЕРШЕНО ===`);
            console.log(`Применено исправлений: ${fixes.length}`);
            
            // Повторно валидируем сетку
            const revalidation = await validateSingleEliminationBracket(tournamentId);
            
            return {
                success: true,
                fixesApplied: fixes.length,
                fixes,
                stillHasIssues: !revalidation.valid,
                remainingIssues: revalidation.issues || []
            };
            
        } catch (fixError) {
            await pool.query('ROLLBACK');
            throw fixError;
        }
        
    } catch (error) {
        console.error('Ошибка исправления:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    generateSingleEliminationBracket,
    validateSingleEliminationBracket,
    fixSingleEliminationBracket
};