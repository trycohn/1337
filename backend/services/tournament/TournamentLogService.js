// 📝 TournamentLogService - Сервис логирования событий турнира
const pool = require('../../db');

class TournamentLogService {
    /**
     * Логирование события турнира
     */
    static async logTournamentEvent(tournamentId, userId, eventType, eventData = {}) {
        try {
            console.log(`📝 [TournamentLogService] Событие турнира ${tournamentId}:`, {
                eventType,
                userId,
                eventData
            });
            
            // Простое логирование в базу данных (если есть таблица)
            // Если таблицы нет, просто логируем в консоль
            const query = `
                INSERT INTO tournament_events (tournament_id, user_id, event_type, event_data, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            `;
            
            await pool.query(query, [tournamentId, userId, eventType, JSON.stringify(eventData)]);
            
        } catch (error) {
            // Не критично для работы системы, просто логируем ошибку
            console.warn(`⚠️ [TournamentLogService] Ошибка логирования события:`, error.message);
        }
    }
    
    /**
     * Логирование продвижения в турнире
     */
    static async logAdvancement(tournamentId, teamId, fromRound, toRound, reason = '') {
        try {
            console.log(`📝 [TournamentLogService] Продвижение в турнире ${tournamentId}:`, {
                teamId,
                fromRound,
                toRound,
                reason
            });
            
            // Простое логирование в базу данных (если есть таблица)
            const query = `
                INSERT INTO tournament_advancements (tournament_id, team_id, from_round, to_round, reason, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
            `;
            
            await pool.query(query, [tournamentId, teamId, fromRound, toRound, reason]);
            
        } catch (error) {
            // Не критично для работы системы, просто логируем ошибку
            console.warn(`⚠️ [TournamentLogService] Ошибка логирования продвижения:`, error.message);
        }
    }
}

// Экспортируем функции для совместимости
const logTournamentEvent = TournamentLogService.logTournamentEvent;
const logAdvancement = TournamentLogService.logAdvancement;

module.exports = { 
    logTournamentEvent, 
    logAdvancement,
    TournamentLogService 
}; 