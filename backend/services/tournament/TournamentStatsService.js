/**
 * 📊 TOURNAMENT STATS SERVICE
 * Сервис для работы со статистикой турниров
 * @version 1.0.0
 * @date 13 октября 2025
 */

const TournamentStatsRepository = require('../../repositories/tournament/TournamentStatsRepository');
const pool = require('../../db');

class TournamentStatsService {
    /**
     * 🔄 Обновление статистики после завершения матча
     * @param {number} matchId - ID завершенного матча
     * @param {number} tournamentId - ID турнира
     */
    async updateStatsAfterMatch(matchId, tournamentId) {
        console.log(`📊 [TournamentStats] Обновление статистики турнира ${tournamentId} после матча ${matchId}`);

        try {
            // Получаем статистику игроков из player_match_stats
            const statsQuery = `
                SELECT 
                    pms.*,
                    m.winner_team_id,
                    m.team1_id,
                    m.team2_id
                FROM player_match_stats pms
                JOIN matches m ON pms.match_id = m.id
                WHERE pms.match_id = $1;
            `;

            const statsResult = await pool.query(statsQuery, [matchId]);
            const playerStats = statsResult.rows;

            if (playerStats.length === 0) {
                console.log(`⚠️ [TournamentStats] Нет статистики для матча ${matchId}`);
                return null;
            }

            console.log(`📈 [TournamentStats] Найдено ${playerStats.length} игроков для обновления`);

            // Обновляем статистику для каждого игрока
            for (const stats of playerStats) {
                // Определяем команду игрока через team1_players / team2_players
                const isWinner = this._isPlayerWinner(stats);

                // Получаем rounds_played из матча или используем сумму раундов
                const roundsPlayed = await this._getMatchRounds(matchId);

                // Подготавливаем данные для upsert
                const updateData = {
                    tournament_id: tournamentId,
                    user_id: stats.user_id,
                    steam_id: stats.steam_id,
                    kills: stats.kills || 0,
                    deaths: stats.deaths || 0,
                    assists: stats.assists || 0,
                    headshot_kills: stats.head_shot_kills || 0,
                    damage_dealt: stats.damage_dealt || 0,
                    shots_fired: stats.shots_fired_total || 0,
                    shots_on_target: stats.shots_on_target_total || 0,
                    clutch_1v1_attempts: (stats.v1_count || 0),
                    clutch_1v1_won: (stats.v1_wins || 0),
                    clutch_1v2_attempts: (stats.v2_count || 0),
                    clutch_1v2_won: (stats.v2_wins || 0),
                    entry_attempts: (stats.entry_count || 0),
                    entry_wins: (stats.entry_wins || 0),
                    utility_damage: stats.utility_damage || 0,
                    enemies_flashed: stats.enemies_flashed || 0,
                    flash_assists: stats.flash_assists || 0,
                    enemy_5ks: stats.enemy_5ks || 0,
                    enemy_4ks: stats.enemy_4ks || 0,
                    enemy_3ks: stats.enemy_3ks || 0,
                    enemy_2ks: stats.enemy_2ks || 0,
                    rating: stats.rating || 0,
                    kast: stats.kast || 0,
                    impact: stats.impact || 0,
                    rounds_played: roundsPlayed,
                    cash_earned: stats.cash_earned || 0,
                    equipment_value: stats.equipment_value || 0,
                    is_winner: isWinner
                };

                // Инкрементальное обновление
                await TournamentStatsRepository.upsertPlayerStats(updateData);

                // Пересчет производных метрик
                await TournamentStatsRepository.recalculatePlayerMetrics(tournamentId, stats.user_id);
            }

            // Пересчитываем средние рейтинги для всех игроков
            await this._recalculateAverageRatings(tournamentId);

            // Пересчитываем MVP рейтинги
            await TournamentStatsRepository.calculateMVPRatings(tournamentId);

            console.log(`✅ [TournamentStats] Статистика турнира ${tournamentId} успешно обновлена`);

            return { success: true, playersUpdated: playerStats.length };

        } catch (error) {
            console.error(`❌ [TournamentStats] Ошибка при обновлении статистики:`, error);
            throw error;
        }
    }

    /**
     * 🏆 Финализация турнира: определение MVP и генерация достижений
     * @param {number} tournamentId 
     */
    async finalizeTournament(tournamentId) {
        console.log(`🏆 [TournamentStats] Финализация турнира ${tournamentId}`);

        try {
            // 1. Пересчитываем средние рейтинги
            await this._recalculateAverageRatings(tournamentId);

            // 2. Пересчитываем MVP рейтинги
            await TournamentStatsRepository.calculateMVPRatings(tournamentId);

            // 3. Определяем MVP турнира
            const mvp = await TournamentStatsRepository.determineMVP(tournamentId);

            // 4. Генерируем достижения (топ-3 по категориям)
            const achievements = await TournamentStatsRepository.generateAchievements(tournamentId);

            console.log(`✅ [TournamentStats] Турнир ${tournamentId} финализирован. MVP: ${mvp?.username || mvp?.user_id}`);

            return {
                success: true,
                mvp,
                achievements: achievements.length,
                message: 'Tournament statistics finalized successfully'
            };

        } catch (error) {
            console.error(`❌ [TournamentStats] Ошибка при финализации турнира:`, error);
            throw error;
        }
    }

    /**
     * 📊 Получение полной статистики турнира для отображения
     * @param {number} tournamentId 
     */
    async getTournamentStats(tournamentId) {
        console.log(`📊 [TournamentStats] Получение статистики турнира ${tournamentId}`);

        try {
            // Получаем все статистики игроков
            const allStats = await TournamentStatsRepository.getAllTournamentStats(tournamentId);

            if (allStats.length === 0) {
                return {
                    hasStats: false,
                    message: 'No statistics available for this tournament'
                };
            }

            // Находим MVP
            const mvp = allStats.find(s => s.is_tournament_mvp) || allStats[0];

            // Получаем лидеров по категориям
            const leaders = {
                mvp: mvp,
                most_kills: allStats[0], // уже отсортировано по mvp_points, но можем пересортировать
                highest_adr: [...allStats].sort((a, b) => b.avg_adr - a.avg_adr)[0],
                best_hs: [...allStats].sort((a, b) => b.hs_percentage - a.hs_percentage)[0],
                clutch_king: [...allStats].sort((a, b) => b.clutch_1v1_won - a.clutch_1v1_won)[0],
                eco_master: [...allStats].sort((a, b) => b.total_money_earned - a.total_money_earned)[0],
                most_assists: [...allStats].sort((a, b) => b.total_assists - a.total_assists)[0],
                best_accuracy: [...allStats].sort((a, b) => b.accuracy - a.accuracy)[0]
            };

            // Пересортируем для most_kills
            leaders.most_kills = [...allStats].sort((a, b) => b.total_kills - a.total_kills)[0];

            // Получаем сводную статистику
            const summary = await TournamentStatsRepository.getTournamentSummary(tournamentId);

            return {
                hasStats: true,
                mvp,
                leaders,
                allStats,
                summary,
                totalPlayers: allStats.length
            };

        } catch (error) {
            console.error(`❌ [TournamentStats] Ошибка при получении статистики:`, error);
            throw error;
        }
    }

    /**
     * 🔄 Полный пересчет статистики турнира (для админов)
     * @param {number} tournamentId 
     */
    async recalculateTournamentStats(tournamentId) {
        console.log(`🔄 [TournamentStats] Полный пересчет статистики турнира ${tournamentId}`);

        try {
            // 1. Очищаем существующую статистику
            await TournamentStatsRepository.clearTournamentStats(tournamentId);

            // 2. Получаем все завершенные матчи турнира
            const matchesQuery = `
                SELECT DISTINCT id
                FROM matches
                WHERE tournament_id = $1
                AND (state = 'DONE' OR state = 'SCORE_DONE' OR status = 'completed')
                AND winner_team_id IS NOT NULL
                ORDER BY id ASC;
            `;

            const matchesResult = await pool.query(matchesQuery, [tournamentId]);
            const matches = matchesResult.rows;

            console.log(`🔄 [TournamentStats] Найдено ${matches.length} завершенных матчей`);

            // 3. Обрабатываем каждый матч
            for (const match of matches) {
                await this.updateStatsAfterMatch(match.id, tournamentId);
            }

            // 4. Финализация (MVP и достижения)
            await this.finalizeTournament(tournamentId);

            console.log(`✅ [TournamentStats] Пересчет завершен для турнира ${tournamentId}`);

            return {
                success: true,
                matchesProcessed: matches.length,
                message: 'Tournament statistics recalculated successfully'
            };

        } catch (error) {
            console.error(`❌ [TournamentStats] Ошибка при пересчете статистики:`, error);
            throw error;
        }
    }

    /**
     * 🔍 Вспомогательная функция: проверка является ли игрок победителем
     * @private
     */
    _isPlayerWinner(stats) {
        // Логика определения победителя матча для игрока
        // Предполагается что в stats есть winner_team_id, team1_id, team2_id
        // И мы можем определить команду игрока через team1_players / team2_players
        // Для упрощения пока используем простую проверку
        
        // TODO: Улучшить логику определения команды игрока
        // Возможно нужно добавить поле team в player_match_stats
        
        return false; // Временно, будет улучшено
    }

    /**
     * 🔢 Вспомогательная функция: получение количества раундов в матче
     * @private
     */
    async _getMatchRounds(matchId) {
        try {
            const query = `
                SELECT 
                    COALESCE(
                        (SELECT SUM(score1 + score2) FROM UNNEST(maps_data) as m),
                        score1 + score2,
                        0
                    ) as total_rounds
                FROM matches
                WHERE id = $1;
            `;

            const result = await pool.query(query, [matchId]);
            return result.rows[0]?.total_rounds || 0;

        } catch (error) {
            console.error(`❌ [TournamentStats] Ошибка получения rounds:`, error);
            return 0;
        }
    }

    /**
     * 📊 Вспомогательная функция: пересчет средних рейтингов
     * @private
     */
    async _recalculateAverageRatings(tournamentId) {
        try {
            // Пересчитываем средний rating и kast из player_match_stats
            const query = `
                UPDATE tournament_player_stats tps
                SET 
                    avg_rating = COALESCE((
                        SELECT AVG(pms.rating)
                        FROM player_match_stats pms
                        JOIN matches m ON pms.match_id = m.id
                        WHERE m.tournament_id = $1
                        AND pms.user_id = tps.user_id
                        AND pms.rating IS NOT NULL
                    ), 0),
                    avg_kast = COALESCE((
                        SELECT AVG(pms.kast)
                        FROM player_match_stats pms
                        JOIN matches m ON pms.match_id = m.id
                        WHERE m.tournament_id = $1
                        AND pms.user_id = tps.user_id
                        AND pms.kast IS NOT NULL
                    ), 0) * 100,  -- Конвертируем в проценты
                    impact_rating = COALESCE((
                        SELECT AVG(pms.impact)
                        FROM player_match_stats pms
                        JOIN matches m ON pms.match_id = m.id
                        WHERE m.tournament_id = $1
                        AND pms.user_id = tps.user_id
                        AND pms.impact IS NOT NULL
                    ), 0),
                    updated_at = NOW()
                WHERE tps.tournament_id = $1;
            `;

            await pool.query(query, [tournamentId]);

            console.log(`✅ [TournamentStats] Средние рейтинги пересчитаны для турнира ${tournamentId}`);

        } catch (error) {
            console.error(`❌ [TournamentStats] Ошибка при пересчете средних рейтингов:`, error);
        }
    }
}

module.exports = new TournamentStatsService();

