/**
 * 📊 TOURNAMENT STATS REPOSITORY
 * Репозиторий для работы со статистикой турниров
 * @version 1.0.0
 * @date 13 октября 2025
 */

const pool = require('../../db');

class TournamentStatsRepository {
    /**
     * 🔄 Обновление статистики игрока в турнире (инкрементальное)
     * @param {Object} data - Данные статистики из player_match_stats
     * @returns {Promise<Object>} Обновленная статистика
     */
    async upsertPlayerStats(data) {
        const {
            tournament_id,
            user_id,
            steam_id,
            kills = 0,
            deaths = 0,
            assists = 0,
            headshot_kills = 0,
            damage_dealt = 0,
            shots_fired = 0,
            shots_on_target = 0,
            clutch_1v1_attempts = 0,
            clutch_1v1_won = 0,
            clutch_1v2_attempts = 0,
            clutch_1v2_won = 0,
            entry_attempts = 0,
            entry_wins = 0,
            utility_damage = 0,
            enemies_flashed = 0,
            flash_assists = 0,
            enemy_5ks = 0,
            enemy_4ks = 0,
            enemy_3ks = 0,
            enemy_2ks = 0,
            rating = 0,
            kast = 0,
            impact = 0,
            rounds_played = 0,
            cash_earned = 0,
            equipment_value = 0,
            is_winner = false
        } = data;

        const query = `
            INSERT INTO tournament_player_stats (
                tournament_id, user_id, steam_id,
                matches_played, rounds_played, wins, losses,
                total_kills, total_deaths, total_assists,
                total_headshot_kills, total_damage,
                shots_fired, shots_on_target,
                clutch_1v1_attempts, clutch_1v1_won,
                clutch_1v2_attempts, clutch_1v2_won,
                entry_attempts, entry_wins,
                utility_damage, enemies_flashed, flash_assists,
                enemy_5ks, enemy_4ks, enemy_3ks, enemy_2ks,
                total_money_earned, total_equipment_value,
                updated_at
            )
            VALUES (
                $1, $2, $3,
                1, $4, $5, $6,
                $7, $8, $9,
                $10, $11,
                $12, $13,
                $14, $15,
                $16, $17,
                $18, $19,
                $20, $21, $22,
                $23, $24, $25, $26,
                $27, $28,
                NOW()
            )
            ON CONFLICT (tournament_id, user_id)
            DO UPDATE SET
                matches_played = tournament_player_stats.matches_played + 1,
                rounds_played = tournament_player_stats.rounds_played + EXCLUDED.rounds_played,
                wins = tournament_player_stats.wins + EXCLUDED.wins,
                losses = tournament_player_stats.losses + EXCLUDED.losses,
                total_kills = tournament_player_stats.total_kills + EXCLUDED.total_kills,
                total_deaths = tournament_player_stats.total_deaths + EXCLUDED.total_deaths,
                total_assists = tournament_player_stats.total_assists + EXCLUDED.total_assists,
                total_headshot_kills = tournament_player_stats.total_headshot_kills + EXCLUDED.total_headshot_kills,
                total_damage = tournament_player_stats.total_damage + EXCLUDED.total_damage,
                shots_fired = tournament_player_stats.shots_fired + EXCLUDED.shots_fired,
                shots_on_target = tournament_player_stats.shots_on_target + EXCLUDED.shots_on_target,
                clutch_1v1_attempts = tournament_player_stats.clutch_1v1_attempts + EXCLUDED.clutch_1v1_attempts,
                clutch_1v1_won = tournament_player_stats.clutch_1v1_won + EXCLUDED.clutch_1v1_won,
                clutch_1v2_attempts = tournament_player_stats.clutch_1v2_attempts + EXCLUDED.clutch_1v2_attempts,
                clutch_1v2_won = tournament_player_stats.clutch_1v2_won + EXCLUDED.clutch_1v2_won,
                entry_attempts = tournament_player_stats.entry_attempts + EXCLUDED.entry_attempts,
                entry_wins = tournament_player_stats.entry_wins + EXCLUDED.entry_wins,
                utility_damage = tournament_player_stats.utility_damage + EXCLUDED.utility_damage,
                enemies_flashed = tournament_player_stats.enemies_flashed + EXCLUDED.enemies_flashed,
                flash_assists = tournament_player_stats.flash_assists + EXCLUDED.flash_assists,
                enemy_5ks = tournament_player_stats.enemy_5ks + EXCLUDED.enemy_5ks,
                enemy_4ks = tournament_player_stats.enemy_4ks + EXCLUDED.enemy_4ks,
                enemy_3ks = tournament_player_stats.enemy_3ks + EXCLUDED.enemy_3ks,
                enemy_2ks = tournament_player_stats.enemy_2ks + EXCLUDED.enemy_2ks,
                total_money_earned = tournament_player_stats.total_money_earned + EXCLUDED.total_money_earned,
                total_equipment_value = tournament_player_stats.total_equipment_value + EXCLUDED.total_equipment_value,
                updated_at = NOW()
            RETURNING *;
        `;

        const values = [
            tournament_id, user_id, steam_id,
            rounds_played, is_winner ? 1 : 0, is_winner ? 0 : 1,
            kills, deaths, assists,
            headshot_kills, damage_dealt,
            shots_fired, shots_on_target,
            clutch_1v1_attempts, clutch_1v1_won,
            clutch_1v2_attempts, clutch_1v2_won,
            entry_attempts, entry_wins,
            utility_damage, enemies_flashed, flash_assists,
            enemy_5ks, enemy_4ks, enemy_3ks, enemy_2ks,
            cash_earned, equipment_value
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * 🔢 Пересчет производных метрик для игрока
     * @param {number} tournamentId 
     * @param {number} userId 
     */
    async recalculatePlayerMetrics(tournamentId, userId) {
        const query = `
            UPDATE tournament_player_stats
            SET 
                kd_ratio = CASE 
                    WHEN total_deaths > 0 THEN ROUND(total_kills::DECIMAL / total_deaths, 2)
                    ELSE total_kills::DECIMAL
                END,
                hs_percentage = CASE 
                    WHEN total_kills > 0 THEN ROUND((total_headshot_kills::DECIMAL / total_kills) * 100, 2)
                    ELSE 0
                END,
                accuracy = CASE 
                    WHEN shots_fired > 0 THEN ROUND((shots_on_target::DECIMAL / shots_fired) * 100, 2)
                    ELSE 0
                END,
                avg_adr = CASE 
                    WHEN rounds_played > 0 THEN ROUND(total_damage::DECIMAL / rounds_played, 2)
                    ELSE 0
                END,
                clutch_1v1_rate = CASE 
                    WHEN clutch_1v1_attempts > 0 THEN ROUND((clutch_1v1_won::DECIMAL / clutch_1v1_attempts) * 100, 2)
                    ELSE 0
                END,
                clutch_1v2_rate = CASE 
                    WHEN clutch_1v2_attempts > 0 THEN ROUND((clutch_1v2_won::DECIMAL / clutch_1v2_attempts) * 100, 2)
                    ELSE 0
                END,
                entry_success_rate = CASE 
                    WHEN entry_attempts > 0 THEN ROUND((entry_wins::DECIMAL / entry_attempts) * 100, 2)
                    ELSE 0
                END,
                updated_at = NOW()
            WHERE tournament_id = $1 AND user_id = $2
            RETURNING *;
        `;

        const result = await pool.query(query, [tournamentId, userId]);
        return result.rows[0];
    }

    /**
     * 🏆 Расчет MVP рейтинга для всех игроков турнира
     * @param {number} tournamentId 
     */
    async calculateMVPRatings(tournamentId) {
        const query = `
            UPDATE tournament_player_stats
            SET 
                mvp_points = (
                    (COALESCE(avg_rating, 0) * 0.35) +
                    (COALESCE(kd_ratio, 0) * 0.20) +
                    ((COALESCE(avg_adr, 0) / 100) * 0.15) +
                    ((COALESCE(avg_kast, 0) / 100) * 0.15) +
                    ((COALESCE(hs_percentage, 0) / 100) * 0.10) +
                    ((COALESCE(clutch_1v1_rate, 0) / 100) * 0.05)
                ) * LEAST(matches_played, 5),  -- Match weight (max 5)
                mvp_rating = (
                    (COALESCE(avg_rating, 0) * 0.35) +
                    (COALESCE(kd_ratio, 0) * 0.20) +
                    ((COALESCE(avg_adr, 0) / 100) * 0.15) +
                    ((COALESCE(avg_kast, 0) / 100) * 0.15) +
                    ((COALESCE(hs_percentage, 0) / 100) * 0.10) +
                    ((COALESCE(clutch_1v1_rate, 0) / 100) * 0.05)
                ),
                updated_at = NOW()
            WHERE tournament_id = $1
            RETURNING *;
        `;

        const result = await pool.query(query, [tournamentId]);
        return result.rows;
    }

    /**
     * 👑 Определение MVP турнира
     * @param {number} tournamentId 
     */
    async determineMVP(tournamentId) {
        // Сбрасываем все is_tournament_mvp флаги
        await pool.query(
            'UPDATE tournament_player_stats SET is_tournament_mvp = FALSE WHERE tournament_id = $1',
            [tournamentId]
        );

        // Находим игрока с максимальным mvp_points (учитывает количество матчей)
        const query = `
            UPDATE tournament_player_stats
            SET is_tournament_mvp = TRUE
            WHERE tournament_id = $1
            AND id = (
                SELECT id 
                FROM tournament_player_stats
                WHERE tournament_id = $1
                AND matches_played >= 1  -- Минимум 1 матч
                ORDER BY mvp_points DESC, total_kills DESC
                LIMIT 1
            )
            RETURNING *;
        `;

        const result = await pool.query(query, [tournamentId]);
        return result.rows[0];
    }

    /**
     * 📊 Получение лидерборда по категории
     * @param {number} tournamentId 
     * @param {string} category - most_kills, highest_adr, best_hs, clutch_king, etc
     * @param {number} limit - Количество результатов (default 10)
     */
    async getLeaderboard(tournamentId, category = 'most_kills', limit = 10) {
        const categoryColumns = {
            'most_kills': 'total_kills',
            'highest_adr': 'avg_adr',
            'best_hs': 'hs_percentage',
            'clutch_king': 'clutch_1v1_rate',
            'eco_master': 'total_money_earned',
            'most_assists': 'total_assists',
            'best_accuracy': 'accuracy',
            'best_kd': 'kd_ratio',
            'entry_master': 'entry_success_rate',
            'flash_king': 'enemies_flashed'
        };

        const column = categoryColumns[category] || 'total_kills';

        const query = `
            SELECT 
                tps.*,
                u.username,
                u.avatar_url
            FROM tournament_player_stats tps
            LEFT JOIN users u ON tps.user_id = u.id
            WHERE tps.tournament_id = $1
            AND tps.matches_played >= 1
            AND tps.${column} > 0
            ORDER BY tps.${column} DESC, tps.total_kills DESC
            LIMIT $2;
        `;

        const result = await pool.query(query, [tournamentId, limit]);
        return result.rows;
    }

    /**
     * 🎯 Получение всей статистики турнира
     * @param {number} tournamentId 
     */
    async getAllTournamentStats(tournamentId) {
        const query = `
            SELECT 
                tps.*,
                u.username,
                u.avatar_url,
                u.steam_id as user_steam_id
            FROM tournament_player_stats tps
            LEFT JOIN users u ON tps.user_id = u.id
            WHERE tps.tournament_id = $1
            AND tps.matches_played >= 1
            ORDER BY tps.mvp_points DESC, tps.total_kills DESC;
        `;

        const result = await pool.query(query, [tournamentId]);
        return result.rows;
    }

    /**
     * 👤 Получение статистики конкретного игрока в турнире
     * @param {number} tournamentId 
     * @param {number} userId 
     */
    async getPlayerStats(tournamentId, userId) {
        const query = `
            SELECT 
                tps.*,
                u.username,
                u.avatar_url
            FROM tournament_player_stats tps
            LEFT JOIN users u ON tps.user_id = u.id
            WHERE tps.tournament_id = $1 AND tps.user_id = $2;
        `;

        const result = await pool.query(query, [tournamentId, userId]);
        return result.rows[0];
    }

    /**
     * 🏆 Генерация достижений турнира (топ-3 по каждой категории)
     * @param {number} tournamentId 
     */
    async generateAchievements(tournamentId) {
        const categories = [
            { type: 'mvp', column: 'mvp_points' },
            { type: 'most_kills', column: 'total_kills' },
            { type: 'highest_adr', column: 'avg_adr' },
            { type: 'best_hs', column: 'hs_percentage' },
            { type: 'clutch_king', column: 'clutch_1v1_won' },
            { type: 'eco_master', column: 'total_money_earned' },
            { type: 'most_assists', column: 'total_assists' },
            { type: 'best_accuracy', column: 'accuracy' }
        ];

        // Очистка старых достижений
        await pool.query('DELETE FROM tournament_achievements WHERE tournament_id = $1', [tournamentId]);

        const achievements = [];

        for (const { type, column } of categories) {
            const query = `
                INSERT INTO tournament_achievements (tournament_id, achievement_type, user_id, value, rank, player_name)
                SELECT 
                    $1 as tournament_id,
                    $2 as achievement_type,
                    tps.user_id,
                    tps.${column} as value,
                    ROW_NUMBER() OVER (ORDER BY tps.${column} DESC) as rank,
                    COALESCE(u.username, 'Unknown') as player_name
                FROM tournament_player_stats tps
                LEFT JOIN users u ON tps.user_id = u.id
                WHERE tps.tournament_id = $1
                AND tps.matches_played >= 1
                AND tps.${column} > 0
                ORDER BY tps.${column} DESC
                LIMIT 3
                RETURNING *;
            `;

            const result = await pool.query(query, [tournamentId, type]);
            achievements.push(...result.rows);
        }

        return achievements;
    }

    /**
     * 🗑️ Очистка статистики турнира (для пересчета)
     * @param {number} tournamentId 
     */
    async clearTournamentStats(tournamentId) {
        await pool.query('DELETE FROM tournament_player_stats WHERE tournament_id = $1', [tournamentId]);
        await pool.query('DELETE FROM tournament_achievements WHERE tournament_id = $1', [tournamentId]);
    }

    /**
     * 📈 Получение сводной статистики турнира
     * @param {number} tournamentId 
     */
    async getTournamentSummary(tournamentId) {
        const query = `
            SELECT 
                COUNT(DISTINCT user_id) as total_players,
                SUM(matches_played) as total_matches_played,
                AVG(kd_ratio) as avg_kd_ratio,
                AVG(avg_adr) as avg_adr,
                AVG(hs_percentage) as avg_hs_percentage,
                SUM(total_kills) as total_kills,
                SUM(total_deaths) as total_deaths,
                SUM(enemy_5ks) as total_aces
            FROM tournament_player_stats
            WHERE tournament_id = $1;
        `;

        const result = await pool.query(query, [tournamentId]);
        return result.rows[0];
    }
}

module.exports = new TournamentStatsRepository();

