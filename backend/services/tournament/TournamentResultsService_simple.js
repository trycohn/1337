/**
 * 📊 УПРОЩЕННЫЙ СЕРВИС РЕЗУЛЬТАТОВ ТУРНИРА
 * Для тестирования и отладки
 */

const pool = require('../../db');

class TournamentResultsService {
    static async getTournamentResults(tournamentId) {
        console.log(`🔍 [SIMPLE] Запрос результатов для турнира ID: ${tournamentId}`);

        try {
            // Простой запрос турнира без JOIN
            const tournamentResult = await pool.query(
                'SELECT * FROM tournaments WHERE id = $1', 
                [tournamentId]
            );
            
            if (tournamentResult.rows.length === 0) {
                throw new Error(`Турнир с ID ${tournamentId} не найден`);
            }
            
            const tournament = tournamentResult.rows[0];
            console.log(`✅ Турнир найден: ${tournament.name}`);

            // Простой запрос участников
            const participantsResult = await pool.query(
                'SELECT * FROM tournament_participants WHERE tournament_id = $1', 
                [tournamentId]
            );
            const participants = participantsResult.rows;
            console.log(`👥 Найдено участников: ${participants.length}`);

            // Простой запрос матчей
            const matchesResult = await pool.query(
                'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY match_number', 
                [tournamentId]
            );
            const matches = matchesResult.rows;
            console.log(`🎮 Найдено матчей: ${matches.length}`);

            // Возвращаем минимальные данные
            return {
                tournament,
                participants,
                matches,
                statistics: {},
                standings: [],
                matchHistory: []
            };

        } catch (error) {
            console.error('❌ [SIMPLE] Ошибка при получении результатов турнира:', error);
            throw error;
        }
    }
}

module.exports = TournamentResultsService;