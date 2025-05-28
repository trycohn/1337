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

    // Количество участников, которые должны сыграть в предварительном раунде,
    // чтобы количество участников в основной сетке было равно степени двойки
    const prelimParticipantsCount = (participantCount - closestPowerOfTwo) * 2;
    
    // Количество матчей в предварительном раунде
    const prelimMatchesCount = Math.floor(prelimParticipantsCount / 2);
    
    // Количество участников, которые сразу проходят в основную сетку (round 0)
    const byeParticipantsCount = participantCount - prelimParticipantsCount;
    
    console.log(`Матчей в предварительном раунде: ${prelimMatchesCount}`);
    console.log(`Участников в предварительном раунде: ${prelimParticipantsCount}`);
    console.log(`Участников с автоматическим проходом: ${byeParticipantsCount}`);
    
    // Создаем массивы участников предварительного раунда и участников с автоматическим проходом
    const prelimParticipants = shuffledParticipants.slice(0, prelimParticipantsCount);
    const byeParticipants = shuffledParticipants.slice(prelimParticipantsCount);
    
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
    const round0MatchCount = closestPowerOfTwo / 2;
    console.log(`Количество матчей в основном раунде (0): ${round0MatchCount}`);
    
    // Создаем матчи первого раунда
    for (let i = 0; i < round0MatchCount; i++) {
        let team1 = null;
        let team2 = null;
        
        // Новая логика распределения участников
        // Сначала размещаем всех участников с автопроходом
        if (byeParticipantsCount > 0) {
            // Определяем сколько участников с автопроходом можем разместить парами
            const pairsFromBye = Math.floor(byeParticipantsCount / 2);
            
            if (i < pairsFromBye) {
                // Матчи между участниками с автопроходом
            const index1 = i * 2;
            const index2 = i * 2 + 1;
            
                team1 = byeParticipants[index1];
                team2 = byeParticipants[index2];
            
                console.log(`Матч ${i} в раунде 0: ${team1?.name || 'null'} vs ${team2?.name || 'null'} (оба с автопроходом)`);
            } else if (i === pairsFromBye && byeParticipantsCount % 2 === 1) {
                // Если есть нечетный участник с автопроходом, он играет против победителя предварительного раунда
                team1 = byeParticipants[byeParticipantsCount - 1]; // последний участник с автопроходом
                team2 = null; // будет заполнен победителем предварительного раунда
                
                console.log(`Матч ${i} в раунде 0: ${team1?.name || 'null'} vs [победитель предварительного раунда] (смешанный)`);
            } else {
                // Остальные матчи ожидают победителей предварительного раунда
                console.log(`Матч ${i} в раунде 0: ожидает победителей из предварительного раунда`);
            }
        } else {
            // Если нет участников с автопроходом, все матчи ожидают победителей предварительного раунда
            console.log(`Матч ${i} в раунде 0: ожидает победителей из предварительного раунда`);
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
        // Новая логика связывания
        // Определяем индекс матча, где есть свободное место для победителя предварительного раунда
        const pairsFromBye = Math.floor(byeParticipantsCount / 2);
        let targetMatchIndex = pairsFromBye; // начинаем с первого матча после парных матчей участников с автопроходом
        
        // Если есть нечетный участник с автопроходом, он уже занял место в матче pairsFromBye
        if (byeParticipantsCount % 2 === 1) {
            targetMatchIndex = pairsFromBye; // матч со смешанными участниками
        }
        
        for (let i = 0; i < roundMatches[-1].length; i++) {
            const prelimMatch = roundMatches[-1][i];
            
            if (targetMatchIndex < roundMatches[0].length) {
                const targetMatch = roundMatches[0][targetMatchIndex];
                
                await pool.query(
                    'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                    [targetMatch.id, prelimMatch.id]
                );
                
                console.log(`Связан матч предварительного раунда #${prelimMatch.id} -> матч первого раунда #${targetMatch.id}`);
                
                // Если у нас есть нечетный участник с автопроходом, он должен играть против победителя предварительного раунда
                if (byeParticipantsCount % 2 === 1 && i === 0) {
                    // Обновляем матч, добавляя победителя предварительного раунда как второго участника
                    // Но это будет обработано автоматически через next_match_id
                }
                
                targetMatchIndex++;
            }
        }
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

module.exports = { generateSingleEliminationBracket };