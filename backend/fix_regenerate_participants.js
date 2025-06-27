// backend/fix_regenerate_participants.js
// Исправление проблемы с типами данных ID участников при перегенерации сетки

const pool = require('./db');

/**
 * 🔧 Безопасное получение и валидация участников турнира
 * @param {number} tournamentId - ID турнира
 * @param {string} participantType - Тип участников ('solo' или 'team')
 * @returns {Array} - Массив валидированных участников [{ id: number, name: string }]
 */
async function getSafeParticipants(tournamentId, participantType) {
    console.log(`🔍 [getSafeParticipants] Получаем участников турнира ${tournamentId}, тип: ${participantType}`);
    
    let participants = [];
    
    try {
        // Получаем участников в зависимости от типа
        if (participantType === 'solo') {
            const result = await pool.query(
                'SELECT id, name FROM tournament_participants WHERE tournament_id = $1',
                [tournamentId]
            );
            participants = result.rows;
        } else {
            const result = await pool.query(
                'SELECT id, name FROM tournament_teams WHERE tournament_id = $1',
                [tournamentId]
            );
            participants = result.rows;
        }
        
        console.log(`📊 [getSafeParticipants] Получено ${participants.length} участников из БД`);
        
        // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА ПОЛУЧЕННЫХ ДАННЫХ
        console.log(`🔍 [getSafeParticipants] ДИАГНОСТИКА ПОЛУЧЕННЫХ УЧАСТНИКОВ:`);
        
        if (participants.length > 0) {
            console.log(`   - Первые 3 участника из БД:`);
            participants.slice(0, 3).forEach((participant, index) => {
                console.log(`     ${index + 1}. ID: ${participant.id} (тип: ${typeof participant.id}), Name: "${participant.name}"`);
                console.log(`        Полный объект: ${JSON.stringify(participant)}`);
            });
        }
        
        // 🔧 ПРИНУДИТЕЛЬНОЕ ПРИВЕДЕНИЕ ID К ЧИСЛАМ
        console.log(`🔧 [getSafeParticipants] Приводим все ID к числовому типу...`);
        
        const validatedParticipants = participants.map((participant, index) => {
            const originalId = participant.id;
            let numericId;
            
            // Попытка приведения к числу
            if (typeof originalId === 'string') {
                // Если это строка, пытаемся парсить
                if (originalId.startsWith('{"') || originalId.startsWith('{')) {
                    // Это JSON строка - пытаемся извлечь ID
                    try {
                        const parsed = JSON.parse(originalId);
                        numericId = Number(parsed.id);
                        console.log(`   🔧 Участник ${index + 1}: Извлечен ID ${numericId} из JSON объекта`);
                    } catch (parseError) {
                        console.log(`   ❌ Участник ${index + 1}: Не удалось парсить JSON: ${originalId}`);
                        throw new Error(`Участник ${index + 1} содержит некорректный JSON: ${originalId}`);
                    }
                } else {
                    // Обычная строка с числом
                    numericId = Number(originalId);
                    console.log(`   🔧 Участник ${index + 1}: Приведена строка "${originalId}" к числу ${numericId}`);
                }
            } else if (typeof originalId === 'number') {
                // Уже число
                numericId = originalId;
                console.log(`   ✅ Участник ${index + 1}: ID уже является числом ${numericId}`);
            } else {
                // Неопознанный тип
                console.log(`   ❌ Участник ${index + 1}: Неопознанный тип ID: ${typeof originalId}, значение: ${originalId}`);
                throw new Error(`Участник ${index + 1} имеет неопознанный тип ID: ${typeof originalId}`);
            }
            
            // Финальная проверка получившегося числа
            if (isNaN(numericId) || numericId <= 0) {
                console.log(`   ❌ Участник ${index + 1}: Получено некорректное число ${numericId} из ${originalId}`);
                throw new Error(`Участник ${index + 1}: ID не является положительным числом: ${numericId}`);
            }
            
            return {
                id: numericId,
                name: participant.name || `Участник ${numericId}`
            };
        });
        
        console.log(`✅ [getSafeParticipants] Все ${validatedParticipants.length} участников валидированы`);
        console.log(`   - Итоговые ID: [${validatedParticipants.map(p => p.id).join(', ')}]`);
        
        return validatedParticipants;
        
    } catch (error) {
        console.error(`❌ [getSafeParticipants] Ошибка получения участников:`, error);
        throw error;
    }
}

/**
 * 🧪 Тестирование валидации участников
 * @param {number} tournamentId - ID турнира для тестирования
 */
async function testParticipantValidation(tournamentId) {
    console.log(`🧪 ТЕСТИРОВАНИЕ ВАЛИДАЦИИ УЧАСТНИКОВ ДЛЯ ТУРНИРА ${tournamentId}`);
    console.log('='.repeat(60));
    
    try {
        // Получаем информацию о турнире
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        if (tournamentResult.rows.length === 0) {
            throw new Error(`Турнир ${tournamentId} не найден`);
        }
        
        const tournament = tournamentResult.rows[0];
        console.log(`📋 Турнир: "${tournament.name}", тип участников: ${tournament.participant_type}`);
        
        // Тестируем валидацию
        const participants = await getSafeParticipants(tournamentId, tournament.participant_type);
        
        console.log(`✅ ТЕСТ ПРОЙДЕН: ${participants.length} участников успешно валидированы`);
        console.log(`   - Все ID являются числами: ${participants.every(p => typeof p.id === 'number')}`);
        console.log(`   - Все ID положительные: ${participants.every(p => p.id > 0)}`);
        console.log(`   - Все имеют имена: ${participants.every(p => p.name && p.name.trim().length > 0)}`);
        
        return participants;
        
    } catch (error) {
        console.error(`❌ ТЕСТ НЕ ПРОЙДЕН:`, error.message);
        throw error;
    }
}

module.exports = {
    getSafeParticipants,
    testParticipantValidation
}; 