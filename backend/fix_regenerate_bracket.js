// backend/fix_regenerate_bracket.js
// Диагностика и исправление проблемы с перегенерацией турнирной сетки
// Проблема: invalid input syntax for type integer - передается JSON вместо числового ID

const pool = require('./db');
const { generateBracket } = require('./bracketGenerator');

/**
 * Диагностика проблемы с участниками
 */
async function diagnoseParticipantsData(tournamentId) {
    console.log(`🔍 ДИАГНОСТИКА ДАННЫХ УЧАСТНИКОВ ДЛЯ ТУРНИРА ${tournamentId}`);
    console.log('='*60);
    
    // Получаем данные турнира
    const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    if (tournamentResult.rows.length === 0) {
        throw new Error('Турнир не найден');
    }
    const tournament = tournamentResult.rows[0];
    
    console.log(`📋 Турнир: "${tournament.name}"`);
    console.log(`   - Тип участников: ${tournament.participant_type}`);
    console.log(`   - Формат: ${tournament.format}`);
    
    // Получаем участников так же, как в маршруте перегенерации
    let participants;
    if (tournament.participant_type === 'solo') {
        const participantsResult = await pool.query(
            'SELECT id, name FROM tournament_participants WHERE tournament_id = $1',
            [tournamentId]
        );
        participants = participantsResult.rows;
    } else {
        const participantsResult = await pool.query(
            'SELECT id, name FROM tournament_teams WHERE tournament_id = $1',
            [tournamentId]
        );
        participants = participantsResult.rows;
    }
    
    console.log(`👥 Найдено ${participants.length} участников:`);
    
    // Детальная диагностика каждого участника
    participants.forEach((participant, index) => {
        console.log(`   ${index + 1}. ID: ${participant.id} (тип: ${typeof participant.id}), Name: "${participant.name}"`);
        console.log(`      Весь объект:`, JSON.stringify(participant));
        
        // Проверяем корректность ID
        if (typeof participant.id !== 'number' || isNaN(participant.id)) {
            console.log(`      ❌ НЕКОРРЕКТНЫЙ ID!`);
        } else {
            console.log(`      ✅ ID корректен`);
        }
    });
    
    // Проверяем все типы данных
    const invalidParticipants = participants.filter(p => typeof p.id !== 'number' || isNaN(p.id));
    
    if (invalidParticipants.length > 0) {
        console.log(`❌ НАЙДЕНЫ НЕКОРРЕКТНЫЕ УЧАСТНИКИ:`);
        invalidParticipants.forEach((p, index) => {
            console.log(`   ${index + 1}. ID: ${p.id} (${typeof p.id}), Name: ${p.name}`);
        });
        
        return {
            success: false,
            error: 'Некорректные ID участников',
            invalidParticipants,
            participants
        };
    }
    
    console.log(`✅ Все участники имеют корректные ID`);
    
    return {
        success: true,
        participants,
        tournament
    };
}

/**
 * Исправление данных участников
 */
async function fixParticipantsData(tournamentId) {
    console.log(`🔧 ИСПРАВЛЕНИЕ ДАННЫХ УЧАСТНИКОВ ДЛЯ ТУРНИРА ${tournamentId}`);
    
    const diagnosis = await diagnoseParticipantsData(tournamentId);
    
    if (diagnosis.success) {
        console.log(`✅ Участники уже корректны, исправление не требуется`);
        return diagnosis;
    }
    
    console.log(`🔧 Попытка исправления некорректных участников...`);
    
    // Пытаемся исправить данные
    const fixedParticipants = diagnosis.participants.map(participant => {
        if (typeof participant.id !== 'number' || isNaN(participant.id)) {
            // Пытаемся извлечь ID из JSON-строки
            if (typeof participant.id === 'string') {
                try {
                    const parsed = JSON.parse(participant.id);
                    if (parsed && typeof parsed.id === 'number') {
                        console.log(`🔧 Исправляем ID участника: "${participant.id}" -> ${parsed.id}`);
                        return {
                            id: parsed.id,
                            name: participant.name || parsed.name
                        };
                    }
                } catch (e) {
                    // Пытаемся извлечь числовой ID другими способами
                    const numericMatch = participant.id.match(/\\\"id\\\":(\\d+)/);
                    if (numericMatch) {
                        const extractedId = parseInt(numericMatch[1]);
                        console.log(`🔧 Извлекаем ID из строки: "${participant.id}" -> ${extractedId}`);
                        return {
                            id: extractedId,
                            name: participant.name
                        };
                    }
                }
            }
            
            console.log(`❌ Не удалось исправить участника:`, participant);
            return null;
        }
        
        return participant;
    }).filter(Boolean);
    
    console.log(`🔧 Исправлено участников: ${fixedParticipants.length} из ${diagnosis.participants.length}`);
    
    return {
        success: fixedParticipants.length === diagnosis.participants.length,
        participants: fixedParticipants,
        tournament: diagnosis.tournament,
        fixedCount: fixedParticipants.length,
        originalCount: diagnosis.participants.length
    };
}

/**
 * Безопасная перегенерация турнирной сетки
 */
async function safeRegenerateBracket(tournamentId, thirdPlaceMatch = false) {
    console.log(`🚀 БЕЗОПАСНАЯ ПЕРЕГЕНЕРАЦИЯ ТУРНИРНОЙ СЕТКИ ${tournamentId}`);
    console.log('='*70);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Диагностика и исправление участников
        const participantsFix = await fixParticipantsData(tournamentId);
        if (!participantsFix.success) {
            throw new Error(`Не удалось исправить данные участников: ${participantsFix.fixedCount}/${participantsFix.originalCount}`);
        }
        
        const { participants, tournament } = participantsFix;
        
        // 2. Очистка существующих матчей
        console.log(`🧹 Очищаем существующие матчи турнира ${tournamentId}...`);
        const deleteResult = await client.query('DELETE FROM matches WHERE tournament_id = $1', [tournamentId]);
        console.log(`   Удалено ${deleteResult.rowCount} матчей`);
        
        // 3. Генерация новой сетки с безопасной проверкой
        console.log(`🎯 Генерируем новую сетку:`);
        console.log(`   - Формат: ${tournament.format}`);
        console.log(`   - Участников: ${participants.length}`);
        console.log(`   - Матч за 3-е место: ${thirdPlaceMatch}`);
        
        // Дополнительная проверка участников перед генерацией
        participants.forEach((p, index) => {
            if (typeof p.id !== 'number' || isNaN(p.id)) {
                throw new Error(`Участник ${index + 1} имеет некорректный ID: ${p.id} (${typeof p.id})`);
            }
        });
        
        console.log(`✅ Все участники прошли финальную проверку`);
        
        // Генерируем сетку
        const matches = await generateBracket(tournament.format, tournamentId, participants, thirdPlaceMatch);
        
        console.log(`✅ Создано ${matches.length} новых матчей`);
        
        await client.query('COMMIT');
        
        return {
            success: true,
            message: 'Турнирная сетка успешно перегенерирована',
            matchesCount: matches.length,
            participantsCount: participants.length,
            fixedParticipants: participantsFix.fixedCount !== participantsFix.originalCount
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Диагностика конкретного турнира 59
 */
async function diagnoseTournament59() {
    console.log(`🔍 СПЕЦИАЛЬНАЯ ДИАГНОСТИКА ТУРНИРА 59`);
    return await diagnoseParticipantsData(59);
}

/**
 * Исправление турнира 59
 */
async function fixTournament59() {
    console.log(`🔧 ИСПРАВЛЕНИЕ ТУРНИРА 59`);
    return await safeRegenerateBracket(59, false);
}

module.exports = {
    diagnoseParticipantsData,
    fixParticipantsData,
    safeRegenerateBracket,
    diagnoseTournament59,
    fixTournament59
};

// Если запускается напрямую
if (require.main === module) {
    diagnoseTournament59()
        .then(result => {
            console.log('\\n🎯 РЕЗУЛЬТАТ ДИАГНОСТИКИ:');
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ ОШИБКА:', error);
            process.exit(1);
        });
} 